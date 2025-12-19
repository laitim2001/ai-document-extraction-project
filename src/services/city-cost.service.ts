/**
 * @fileoverview 城市 AI 成本追蹤服務
 * @description
 *   提供城市級別 AI API 成本追蹤功能：
 *   - 城市成本摘要查詢
 *   - 城市成本趨勢分析
 *   - 城市間成本比較
 *   - 計價配置管理
 *
 * @module src/services/city-cost.service
 * @since Epic 7 - Story 7.8 (城市 AI 成本追蹤)
 * @lastModified 2025-12-19
 *
 * @features
 *   - AC1: 追蹤各城市 AI API 使用成本
 *   - AC2: 提供城市成本趨勢數據
 *   - AC3: 城市間成本比較分析
 *   - AC4: 計價配置管理
 *
 * @dependencies
 *   - @/lib/prisma - 資料庫客戶端
 *   - @/middleware/city-filter - 城市過濾
 *   - @/types/city-cost - 類型定義
 */

import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { CityFilterContext } from '@/middleware/city-filter'
import type { ApiProviderType } from '@/types/ai-cost'
import type {
  CityCostSummary,
  CityCostSummaryResponse,
  CityCostTrend,
  CityCostTrendDataPoint,
  CityCostTrendResponse,
  CityCostComparisonItem,
  CityCostComparisonResponse,
  ApiPricingConfig,
  PricingConfigListResponse,
  PricingConfigDetailResponse,
  CityCostSummaryParams,
  CityCostTrendParams,
  CityCostComparisonParams,
  PricingConfigListParams,
  CreatePricingConfigRequest,
  UpdatePricingConfigRequest,
} from '@/types/city-cost'

// ============================================================
// Constants
// ============================================================

/**
 * 快取 TTL（毫秒）- 5 分鐘
 */
const CACHE_TTL_MS = 5 * 60 * 1000

// ============================================================
// Simple Memory Cache
// ============================================================

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

/**
 * 簡單內存快取
 */
class SimpleCache {
  private cache = new Map<string, CacheEntry<unknown>>()

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }
    return entry.data as T
  }

  set<T>(key: string, data: T, ttlMs: number = CACHE_TTL_MS): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    })
  }

  delete(key: string): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }
}

const cityCostCache = new SimpleCache()

// ============================================================
// Helper Functions
// ============================================================

/**
 * 產生快取鍵
 */
function generateCacheKey(prefix: string, params: Record<string, unknown>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map((k) => `${k}:${JSON.stringify(params[k])}`)
    .join('|')
  return `${prefix}:${sortedParams}`
}

/**
 * 格式化日期為 YYYY-MM-DD
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

/**
 * 根據期間計算日期範圍
 */
function getDateRange(days: number = 30): { startDate: Date; endDate: Date } {
  const endDate = new Date()
  endDate.setHours(23, 59, 59, 999)
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  startDate.setHours(0, 0, 0, 0)
  return { startDate, endDate }
}

/**
 * 取得城市名稱對應表
 */
async function getCityNames(cityCodes: string[]): Promise<Map<string, string>> {
  const cities = await prisma.city.findMany({
    where: { code: { in: cityCodes } },
    select: { code: true, name: true },
  })
  return new Map(cities.map((c) => [c.code, c.name]))
}

// ============================================================
// CityCostService Class
// ============================================================

/**
 * 城市成本服務
 *
 * @description
 *   提供城市級別 AI API 成本的完整追蹤功能
 */
export class CityCostService {
  /**
   * 取得城市成本摘要
   *
   * @param params - 查詢參數
   * @param cityFilter - 城市過濾上下文
   * @returns 城市成本摘要響應
   */
  async getCityCostSummary(
    params: CityCostSummaryParams,
    cityFilter: CityFilterContext
  ): Promise<CityCostSummaryResponse> {
    const { startDate, endDate } =
      params.startDate && params.endDate
        ? { startDate: new Date(params.startDate), endDate: new Date(params.endDate) }
        : getDateRange(30)

    const cityCodes = params.cityCodes || cityFilter.cityCodes

    // 檢查快取
    const cacheKey = generateCacheKey('city-cost-summary', {
      cityCodes,
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
    })

    if (!params.forceRefresh) {
      const cached = cityCostCache.get<CityCostSummaryResponse>(cacheKey)
      if (cached) return cached
    }

    // 查詢所有符合條件的使用記錄
    const usageLogs = await prisma.apiUsageLog.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        ...(cityCodes.length > 0 ? { cityCode: { in: cityCodes } } : {}),
      },
      select: {
        cityCode: true,
        provider: true,
        tokensInput: true,
        tokensOutput: true,
        estimatedCost: true,
        success: true,
        createdAt: true,
      },
    })

    // 按城市分組統計
    const cityStats = new Map<
      string,
      {
        totalCost: number
        totalCalls: number
        successCalls: number
        totalInputTokens: number
        totalOutputTokens: number
        providerStats: Map<
          ApiProviderType,
          {
            totalCalls: number
            successCalls: number
            failedCalls: number
            totalInputTokens: number
            totalOutputTokens: number
            totalCost: number
          }
        >
      }
    >()

    for (const log of usageLogs) {
      const stats = cityStats.get(log.cityCode) || {
        totalCost: 0,
        totalCalls: 0,
        successCalls: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        providerStats: new Map(),
      }

      stats.totalCost += Number(log.estimatedCost)
      stats.totalCalls++
      if (log.success) stats.successCalls++
      stats.totalInputTokens += log.tokensInput || 0
      stats.totalOutputTokens += log.tokensOutput || 0

      // Provider 統計
      const provider = log.provider as ApiProviderType
      const providerStat = stats.providerStats.get(provider) || {
        totalCalls: 0,
        successCalls: 0,
        failedCalls: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCost: 0,
      }
      providerStat.totalCalls++
      if (log.success) {
        providerStat.successCalls++
      } else {
        providerStat.failedCalls++
      }
      providerStat.totalInputTokens += log.tokensInput || 0
      providerStat.totalOutputTokens += log.tokensOutput || 0
      providerStat.totalCost += Number(log.estimatedCost)
      stats.providerStats.set(provider, providerStat)

      cityStats.set(log.cityCode, stats)
    }

    // 計算上期數據（用於比較）
    const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    const prevEndDate = new Date(startDate)
    prevEndDate.setDate(prevEndDate.getDate() - 1)
    const prevStartDate = new Date(prevEndDate)
    prevStartDate.setDate(prevStartDate.getDate() - periodDays)

    const prevLogs = await prisma.apiUsageLog.findMany({
      where: {
        createdAt: {
          gte: prevStartDate,
          lte: prevEndDate,
        },
        ...(cityCodes.length > 0 ? { cityCode: { in: cityCodes } } : {}),
      },
      select: {
        cityCode: true,
        estimatedCost: true,
      },
    })

    // 上期城市成本統計
    const prevCityStats = new Map<string, { totalCost: number; totalCalls: number }>()
    for (const log of prevLogs) {
      const stats = prevCityStats.get(log.cityCode) || { totalCost: 0, totalCalls: 0 }
      stats.totalCost += Number(log.estimatedCost)
      stats.totalCalls++
      prevCityStats.set(log.cityCode, stats)
    }

    // 取得城市名稱
    const allCityCodes = Array.from(cityStats.keys())
    const cityNames = await getCityNames(allCityCodes)

    // 建構響應
    const cities: CityCostSummary[] = []
    let totalCost = 0
    let totalCalls = 0
    let totalInputTokens = 0
    let totalOutputTokens = 0
    let totalSuccessCalls = 0

    for (const [cityCode, stats] of cityStats) {
      const prevStats = prevCityStats.get(cityCode)
      const costChangePercentage =
        prevStats && prevStats.totalCost > 0
          ? ((stats.totalCost - prevStats.totalCost) / prevStats.totalCost) * 100
          : null
      const callsChangePercentage =
        prevStats && prevStats.totalCalls > 0
          ? ((stats.totalCalls - prevStats.totalCalls) / prevStats.totalCalls) * 100
          : null

      const providerBreakdown = Array.from(stats.providerStats).map(([provider, pStats]) => ({
        provider,
        totalCalls: pStats.totalCalls,
        successCalls: pStats.successCalls,
        failedCalls: pStats.failedCalls,
        totalInputTokens: pStats.totalInputTokens,
        totalOutputTokens: pStats.totalOutputTokens,
        totalCost: pStats.totalCost,
        averageCostPerCall: pStats.totalCalls > 0 ? pStats.totalCost / pStats.totalCalls : 0,
        successRate: pStats.totalCalls > 0 ? (pStats.successCalls / pStats.totalCalls) * 100 : 100,
      }))

      cities.push({
        cityCode,
        cityName: cityNames.get(cityCode) || cityCode,
        periodStart: formatDate(startDate),
        periodEnd: formatDate(endDate),
        totalCost: stats.totalCost,
        totalCalls: stats.totalCalls,
        totalInputTokens: stats.totalInputTokens,
        totalOutputTokens: stats.totalOutputTokens,
        overallSuccessRate:
          stats.totalCalls > 0 ? (stats.successCalls / stats.totalCalls) * 100 : 100,
        providerBreakdown,
        costChangePercentage,
        callsChangePercentage,
        averageDailyCost: periodDays > 0 ? stats.totalCost / periodDays : 0,
        averageCostPerCall: stats.totalCalls > 0 ? stats.totalCost / stats.totalCalls : 0,
      })

      totalCost += stats.totalCost
      totalCalls += stats.totalCalls
      totalInputTokens += stats.totalInputTokens
      totalOutputTokens += stats.totalOutputTokens
      totalSuccessCalls += stats.successCalls
    }

    // 依成本排序
    cities.sort((a, b) => b.totalCost - a.totalCost)

    const response: CityCostSummaryResponse = {
      cities,
      totals: {
        totalCost,
        totalCalls,
        totalInputTokens,
        totalOutputTokens,
        overallSuccessRate: totalCalls > 0 ? (totalSuccessCalls / totalCalls) * 100 : 100,
      },
    }

    // 存入快取
    cityCostCache.set(cacheKey, response)

    return response
  }

  /**
   * 取得城市成本趨勢
   *
   * @param params - 查詢參數
   * @param cityFilter - 城市過濾上下文
   * @returns 城市成本趨勢響應
   */
  async getCityCostTrend(
    params: CityCostTrendParams,
    cityFilter: CityFilterContext
  ): Promise<CityCostTrendResponse> {
    const startDate = new Date(params.startDate)
    const endDate = new Date(params.endDate)
    const granularity = params.granularity || 'day'
    const cityCodes = params.cityCodes || cityFilter.cityCodes

    // 查詢數據
    const usageLogs = await prisma.apiUsageLog.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        ...(cityCodes.length > 0 ? { cityCode: { in: cityCodes } } : {}),
        ...(params.providers?.length ? { provider: { in: params.providers } } : {}),
      },
      select: {
        cityCode: true,
        provider: true,
        estimatedCost: true,
        success: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    // 按城市和日期分組
    const cityDateGroups = new Map<
      string,
      Map<
        string,
        {
          totalCost: number
          totalCalls: number
          successCalls: number
          providerCosts: Map<ApiProviderType, { cost: number; calls: number }>
        }
      >
    >()

    for (const log of usageLogs) {
      let dateKey: string
      const logDate = new Date(log.createdAt)

      switch (granularity) {
        case 'week': {
          const weekStart = new Date(logDate)
          weekStart.setDate(weekStart.getDate() - weekStart.getDay())
          dateKey = formatDate(weekStart)
          break
        }
        case 'month':
          dateKey = `${logDate.getFullYear()}-${String(logDate.getMonth() + 1).padStart(2, '0')}-01`
          break
        default:
          dateKey = formatDate(logDate)
      }

      const cityGroups = cityDateGroups.get(log.cityCode) || new Map()
      const group = cityGroups.get(dateKey) || {
        totalCost: 0,
        totalCalls: 0,
        successCalls: 0,
        providerCosts: new Map(),
      }

      const cost = Number(log.estimatedCost)
      group.totalCost += cost
      group.totalCalls++
      if (log.success) group.successCalls++

      const provider = log.provider as ApiProviderType
      const providerCost = group.providerCosts.get(provider) || { cost: 0, calls: 0 }
      providerCost.cost += cost
      providerCost.calls++
      group.providerCosts.set(provider, providerCost)

      cityGroups.set(dateKey, group)
      cityDateGroups.set(log.cityCode, cityGroups)
    }

    // 取得城市名稱
    const allCityCodes = Array.from(cityDateGroups.keys())
    const cityNames = await getCityNames(allCityCodes)

    // 轉換為響應格式
    const cityTrends: CityCostTrend[] = []

    for (const [cityCode, dateGroups] of cityDateGroups) {
      const data: CityCostTrendDataPoint[] = []
      let periodTotal = 0
      let peakCost = 0
      let peakDate = ''

      for (const [date, group] of dateGroups) {
        periodTotal += group.totalCost
        if (group.totalCost > peakCost) {
          peakCost = group.totalCost
          peakDate = date
        }

        const providerCosts = Array.from(group.providerCosts).map(([provider, cost]) => ({
          provider,
          cost: cost.cost,
          calls: cost.calls,
        }))

        data.push({
          date,
          totalCost: group.totalCost,
          totalCalls: group.totalCalls,
          successRate: group.totalCalls > 0 ? (group.successCalls / group.totalCalls) * 100 : 100,
          providerCosts,
        })
      }

      // 排序
      data.sort((a, b) => a.date.localeCompare(b.date))

      const totalDays = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      )
      const averageDailyCost = totalDays > 0 ? periodTotal / totalDays : 0

      cityTrends.push({
        cityCode,
        cityName: cityNames.get(cityCode) || cityCode,
        granularity,
        data,
        periodTotal,
        averageDailyCost,
        peakCost,
        peakDate,
      })
    }

    // 依成本排序
    cityTrends.sort((a, b) => b.periodTotal - a.periodTotal)

    return {
      cityTrends,
      granularity,
    }
  }

  /**
   * 取得城市成本比較
   *
   * @param params - 查詢參數
   * @param cityFilter - 城市過濾上下文
   * @returns 城市成本比較響應
   */
  async getCityCostComparison(
    params: CityCostComparisonParams,
    cityFilter: CityFilterContext
  ): Promise<CityCostComparisonResponse> {
    const { startDate, endDate } =
      params.startDate && params.endDate
        ? { startDate: new Date(params.startDate), endDate: new Date(params.endDate) }
        : getDateRange(30)

    const cityCodes = params.cityCodes || cityFilter.cityCodes
    const sortBy = params.sortBy || 'cost'
    const sortOrder = params.sortOrder || 'desc'

    // 查詢當期數據
    const usageLogs = await prisma.apiUsageLog.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        ...(cityCodes.length > 0 ? { cityCode: { in: cityCodes } } : {}),
      },
      select: {
        cityCode: true,
        estimatedCost: true,
        success: true,
      },
    })

    // 按城市分組統計
    const cityStats = new Map<
      string,
      {
        totalCost: number
        totalCalls: number
        successCalls: number
      }
    >()

    for (const log of usageLogs) {
      const stats = cityStats.get(log.cityCode) || {
        totalCost: 0,
        totalCalls: 0,
        successCalls: 0,
      }
      stats.totalCost += Number(log.estimatedCost)
      stats.totalCalls++
      if (log.success) stats.successCalls++
      cityStats.set(log.cityCode, stats)
    }

    // 計算上期數據
    const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    const prevEndDate = new Date(startDate)
    prevEndDate.setDate(prevEndDate.getDate() - 1)
    const prevStartDate = new Date(prevEndDate)
    prevStartDate.setDate(prevStartDate.getDate() - periodDays)

    const prevLogs = await prisma.apiUsageLog.findMany({
      where: {
        createdAt: {
          gte: prevStartDate,
          lte: prevEndDate,
        },
        ...(cityCodes.length > 0 ? { cityCode: { in: cityCodes } } : {}),
      },
      select: {
        cityCode: true,
        estimatedCost: true,
      },
    })

    const prevCityStats = new Map<string, number>()
    for (const log of prevLogs) {
      const prevCost = prevCityStats.get(log.cityCode) || 0
      prevCityStats.set(log.cityCode, prevCost + Number(log.estimatedCost))
    }

    // 取得城市名稱
    const allCityCodes = Array.from(cityStats.keys())
    const cityNames = await getCityNames(allCityCodes)

    // 計算總計
    let totalCost = 0
    let totalCalls = 0
    let totalSuccessCalls = 0

    for (const stats of cityStats.values()) {
      totalCost += stats.totalCost
      totalCalls += stats.totalCalls
      totalSuccessCalls += stats.successCalls
    }

    // 建構比較項目
    const cities: CityCostComparisonItem[] = []

    for (const [cityCode, stats] of cityStats) {
      const prevCost = prevCityStats.get(cityCode) || 0
      const costChangePercentage =
        prevCost > 0 ? ((stats.totalCost - prevCost) / prevCost) * 100 : null

      cities.push({
        cityCode,
        cityName: cityNames.get(cityCode) || cityCode,
        totalCost: stats.totalCost,
        totalCalls: stats.totalCalls,
        averageCostPerCall: stats.totalCalls > 0 ? stats.totalCost / stats.totalCalls : 0,
        successRate: stats.totalCalls > 0 ? (stats.successCalls / stats.totalCalls) * 100 : 100,
        costPercentage: totalCost > 0 ? (stats.totalCost / totalCost) * 100 : 0,
        callsPercentage: totalCalls > 0 ? (stats.totalCalls / totalCalls) * 100 : 0,
        costChangePercentage,
        rank: 0, // 稍後設定
      })
    }

    // 排序
    const sortFn = (a: CityCostComparisonItem, b: CityCostComparisonItem): number => {
      let comparison: number
      switch (sortBy) {
        case 'calls':
          comparison = a.totalCalls - b.totalCalls
          break
        case 'efficiency':
          comparison = a.averageCostPerCall - b.averageCostPerCall
          break
        default:
          comparison = a.totalCost - b.totalCost
      }
      return sortOrder === 'desc' ? -comparison : comparison
    }

    cities.sort(sortFn)

    // 設定排名
    cities.forEach((city, index) => {
      city.rank = index + 1
    })

    // 應用限制
    const limitedCities = params.limit ? cities.slice(0, params.limit) : cities

    return {
      periodStart: formatDate(startDate),
      periodEnd: formatDate(endDate),
      cities: limitedCities,
      totals: {
        totalCost,
        totalCalls,
        averageCostPerCall: totalCalls > 0 ? totalCost / totalCalls : 0,
        overallSuccessRate: totalCalls > 0 ? (totalSuccessCalls / totalCalls) * 100 : 100,
      },
    }
  }

  /**
   * 取得計價配置列表
   *
   * @param params - 查詢參數
   * @returns 計價配置列表響應
   */
  async getPricingConfigs(params: PricingConfigListParams): Promise<PricingConfigListResponse> {
    const page = params.page || 1
    const limit = params.limit || 50

    const where: Prisma.ApiPricingConfigWhereInput = {
      ...(params.provider ? { provider: params.provider } : {}),
      ...(params.activeOnly ? { isActive: true } : {}),
    }

    const [total, configs] = await Promise.all([
      prisma.apiPricingConfig.count({ where }),
      prisma.apiPricingConfig.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ provider: 'asc' }, { operation: 'asc' }],
      }),
    ])

    return {
      configs: configs.map((c) => ({
        id: c.id,
        provider: c.provider as ApiProviderType,
        operation: c.operation,
        pricePerCall: c.pricePerCall ? Number(c.pricePerCall) : null,
        pricePerInputToken: c.pricePerInputToken ? Number(c.pricePerInputToken) : null,
        pricePerOutputToken: c.pricePerOutputToken ? Number(c.pricePerOutputToken) : null,
        currency: c.currency,
        effectiveFrom: c.effectiveFrom.toISOString(),
        effectiveTo: c.effectiveTo?.toISOString() || null,
        isActive: c.isActive,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  /**
   * 取得計價配置詳情（含歷史）
   *
   * @param id - 配置 ID
   * @returns 計價配置詳情響應
   */
  async getPricingConfigDetail(id: string): Promise<PricingConfigDetailResponse | null> {
    const config = await prisma.apiPricingConfig.findUnique({
      where: { id },
      include: {
        history: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    })

    if (!config) return null

    return {
      config: {
        id: config.id,
        provider: config.provider as ApiProviderType,
        operation: config.operation,
        pricePerCall: config.pricePerCall ? Number(config.pricePerCall) : null,
        pricePerInputToken: config.pricePerInputToken ? Number(config.pricePerInputToken) : null,
        pricePerOutputToken: config.pricePerOutputToken
          ? Number(config.pricePerOutputToken)
          : null,
        currency: config.currency,
        effectiveFrom: config.effectiveFrom.toISOString(),
        effectiveTo: config.effectiveTo?.toISOString() || null,
        isActive: config.isActive,
        createdAt: config.createdAt.toISOString(),
        updatedAt: config.updatedAt.toISOString(),
      },
      history: config.history.map((h) => ({
        id: h.id,
        pricingConfigId: h.pricingConfigId,
        provider: h.provider as ApiProviderType,
        operation: h.operation,
        previousPricePerCall: h.previousPricePerCall ? Number(h.previousPricePerCall) : null,
        previousPricePerInputToken: h.previousPricePerInputToken
          ? Number(h.previousPricePerInputToken)
          : null,
        previousPricePerOutputToken: h.previousPricePerOutputToken
          ? Number(h.previousPricePerOutputToken)
          : null,
        newPricePerCall: h.newPricePerCall ? Number(h.newPricePerCall) : null,
        newPricePerInputToken: h.newPricePerInputToken ? Number(h.newPricePerInputToken) : null,
        newPricePerOutputToken: h.newPricePerOutputToken ? Number(h.newPricePerOutputToken) : null,
        changedBy: h.changedBy,
        changeReason: h.changeReason,
        effectiveFrom: h.effectiveFrom.toISOString(),
        createdAt: h.createdAt.toISOString(),
      })),
    }
  }

  /**
   * 建立計價配置
   *
   * @param data - 建立請求
   * @returns 新建的計價配置
   */
  async createPricingConfig(data: CreatePricingConfigRequest): Promise<ApiPricingConfig> {
    const config = await prisma.apiPricingConfig.create({
      data: {
        provider: data.provider,
        operation: data.operation,
        pricePerCall: data.pricePerCall,
        pricePerInputToken: data.pricePerInputToken,
        pricePerOutputToken: data.pricePerOutputToken,
        currency: data.currency || 'USD',
        effectiveFrom: new Date(data.effectiveFrom),
        isActive: true,
      },
    })

    return {
      id: config.id,
      provider: config.provider as ApiProviderType,
      operation: config.operation,
      pricePerCall: config.pricePerCall ? Number(config.pricePerCall) : null,
      pricePerInputToken: config.pricePerInputToken ? Number(config.pricePerInputToken) : null,
      pricePerOutputToken: config.pricePerOutputToken ? Number(config.pricePerOutputToken) : null,
      currency: config.currency,
      effectiveFrom: config.effectiveFrom.toISOString(),
      effectiveTo: config.effectiveTo?.toISOString() || null,
      isActive: config.isActive,
      createdAt: config.createdAt.toISOString(),
      updatedAt: config.updatedAt.toISOString(),
    }
  }

  /**
   * 更新計價配置
   *
   * @param id - 配置 ID
   * @param data - 更新請求
   * @param userId - 操作者 ID
   * @returns 更新後的計價配置
   */
  async updatePricingConfig(
    id: string,
    data: UpdatePricingConfigRequest,
    userId: string
  ): Promise<ApiPricingConfig | null> {
    // 取得原始配置
    const existing = await prisma.apiPricingConfig.findUnique({
      where: { id },
    })

    if (!existing) return null

    // 建立歷史記錄（如果價格有變更）
    const hasPriceChange =
      (data.pricePerCall !== undefined &&
        Number(existing.pricePerCall) !== data.pricePerCall) ||
      (data.pricePerInputToken !== undefined &&
        Number(existing.pricePerInputToken) !== data.pricePerInputToken) ||
      (data.pricePerOutputToken !== undefined &&
        Number(existing.pricePerOutputToken) !== data.pricePerOutputToken)

    if (hasPriceChange) {
      await prisma.apiPricingHistory.create({
        data: {
          pricingConfigId: id,
          provider: existing.provider,
          operation: existing.operation,
          previousPricePerCall: existing.pricePerCall,
          previousPricePerInputToken: existing.pricePerInputToken,
          previousPricePerOutputToken: existing.pricePerOutputToken,
          newPricePerCall: data.pricePerCall ?? null,
          newPricePerInputToken: data.pricePerInputToken ?? null,
          newPricePerOutputToken: data.pricePerOutputToken ?? null,
          changedBy: userId,
          changeReason: data.changeReason,
          effectiveFrom: new Date(),
        },
      })
    }

    // 更新配置
    const config = await prisma.apiPricingConfig.update({
      where: { id },
      data: {
        ...(data.pricePerCall !== undefined ? { pricePerCall: data.pricePerCall } : {}),
        ...(data.pricePerInputToken !== undefined
          ? { pricePerInputToken: data.pricePerInputToken }
          : {}),
        ...(data.pricePerOutputToken !== undefined
          ? { pricePerOutputToken: data.pricePerOutputToken }
          : {}),
        ...(data.effectiveTo !== undefined
          ? { effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null }
          : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    })

    return {
      id: config.id,
      provider: config.provider as ApiProviderType,
      operation: config.operation,
      pricePerCall: config.pricePerCall ? Number(config.pricePerCall) : null,
      pricePerInputToken: config.pricePerInputToken ? Number(config.pricePerInputToken) : null,
      pricePerOutputToken: config.pricePerOutputToken ? Number(config.pricePerOutputToken) : null,
      currency: config.currency,
      effectiveFrom: config.effectiveFrom.toISOString(),
      effectiveTo: config.effectiveTo?.toISOString() || null,
      isActive: config.isActive,
      createdAt: config.createdAt.toISOString(),
      updatedAt: config.updatedAt.toISOString(),
    }
  }

  /**
   * 清除快取
   */
  clearCache(): void {
    cityCostCache.clear()
  }
}

// ============================================================
// Export Singleton Instance
// ============================================================

export const cityCostService = new CityCostService()
