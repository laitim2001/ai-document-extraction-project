/**
 * @fileoverview 城市成本報表服務
 * @description
 *   提供城市級別成本報表功能，整合 AI 成本與人工成本：
 *   - 城市成本報表查詢（結合 AI 與人工成本）
 *   - 成本趨勢分析
 *   - 成本異常檢測
 *
 * @module src/services/city-cost-report.service
 * @since Epic 7 - Story 7.9 (城市成本報表)
 * @lastModified 2025-12-19
 *
 * @features
 *   - AC1: 城市成本報表（含 AI + 人工成本）
 *   - AC2: 成本趨勢分析
 *   - AC3: 異常檢測與警示
 *   - AC4: 成本比較
 *   - AC5: 報表匯出
 *
 * @dependencies
 *   - @/lib/prisma - 資料庫客戶端
 *   - @/middleware/city-filter - 城市過濾
 *   - @/types/city-cost - 類型定義
 */

import { prisma } from '@/lib/prisma'
import { CityFilterContext } from '@/middleware/city-filter'
import type {
  CityCostReport,
  CityCostReportResponse,
  CityCostReportParams,
  CostTrendPoint,
  CostTrendResponse,
  CostTrendParams,
  CostAnomalyDetail,
  AnomalyAnalysisResponse,
  AnomalyAnalysisParams,
  AnomalyType,
  AnomalySeverity,
  LaborCostConfig,
  AnomalyThresholds,
} from '@/types/city-cost'
import {
  DEFAULT_LABOR_COST_CONFIG,
  DEFAULT_ANOMALY_THRESHOLDS,
} from '@/types/city-cost'

// ============================================================
// Constants
// ============================================================

/**
 * 報表快取 TTL（毫秒）- 10 分鐘
 */
const REPORT_CACHE_TTL_MS = 10 * 60 * 1000

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
class ReportCache {
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

  set<T>(key: string, data: T, ttlMs: number = REPORT_CACHE_TTL_MS): void {
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

const reportCache = new ReportCache()

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
  if (cityCodes.length === 0) return new Map()
  const cities = await prisma.city.findMany({
    where: { code: { in: cityCodes } },
    select: { code: true, name: true },
  })
  return new Map(cities.map((c) => [c.code, c.name]))
}

/**
 * 計算人工成本
 *
 * @description
 *   人工成本計算公式：
 *   (manualReviewed * $0.50 + escalated * $2.00) * 1.2 (20% overhead)
 */
function calculateLaborCost(
  manualReviewed: number,
  escalated: number,
  config: LaborCostConfig = DEFAULT_LABOR_COST_CONFIG
): number {
  const directCost =
    manualReviewed * config.manualReviewCostPerDoc +
    escalated * config.escalationCostPerDoc
  return directCost * config.overheadMultiplier
}

/**
 * 計算異常嚴重度
 */
function calculateSeverity(changePercentage: number): AnomalySeverity {
  const absChange = Math.abs(changePercentage)
  if (absChange >= 50) return 'high'
  if (absChange >= 30) return 'medium'
  return 'low'
}

/**
 * 生成異常 ID
 */
function generateAnomalyId(cityCode: string, type: AnomalyType, date: string): string {
  return `${cityCode}-${type}-${date}`.replace(/[^a-zA-Z0-9-]/g, '')
}

/**
 * 生成異常建議
 */
function getAnomalyRecommendation(type: AnomalyType, changePercentage: number): string {
  const direction = changePercentage > 0 ? '增加' : '減少'

  switch (type) {
    case 'volume_spike':
      return '建議檢查是否有異常批次上傳，或確認業務量增長是否符合預期'
    case 'volume_drop':
      return '建議確認是否有系統問題導致處理量下降，或業務量變化是否符合預期'
    case 'cost_per_doc_increase':
      return '建議檢查 AI 模型配置或審核流程是否有變更，評估成本優化方案'
    case 'cost_per_doc_decrease':
      return '成本效率提升，建議記錄優化措施以供其他城市參考'
    case 'api_cost_spike':
      return '建議檢查 API 呼叫模式是否有變更，評估是否需要調整配置'
    case 'labor_cost_spike':
      return '建議檢查自動化率是否下降，評估規則優化或培訓需求'
    case 'automation_rate_drop':
      return '建議檢查映射規則覆蓋率，考慮新增或優化規則'
    default:
      return `檢測到${direction} ${Math.abs(changePercentage).toFixed(1)}%，建議進一步調查原因`
  }
}

// ============================================================
// CityCostReportService Class
// ============================================================

/**
 * 城市成本報表服務
 *
 * @description
 *   提供城市級別成本報表的完整功能，整合 AI 成本與估算人工成本
 */
export class CityCostReportService {
  private laborConfig: LaborCostConfig
  private anomalyThresholds: AnomalyThresholds

  constructor(
    laborConfig: LaborCostConfig = DEFAULT_LABOR_COST_CONFIG,
    anomalyThresholds: AnomalyThresholds = DEFAULT_ANOMALY_THRESHOLDS
  ) {
    this.laborConfig = laborConfig
    this.anomalyThresholds = anomalyThresholds
  }

  /**
   * 取得城市成本報表
   *
   * @param params - 查詢參數
   * @param cityFilter - 城市過濾上下文
   * @returns 城市成本報表響應
   */
  async getCityCostReport(
    params: CityCostReportParams,
    cityFilter: CityFilterContext
  ): Promise<CityCostReportResponse> {
    const { startDate, endDate } =
      params.startDate && params.endDate
        ? { startDate: new Date(params.startDate), endDate: new Date(params.endDate) }
        : getDateRange(30)

    const cityCodes = params.cityCodes || cityFilter.cityCodes
    const includeTrend = params.includeTrend ?? true
    const includeAnomalies = params.includeAnomalies ?? true

    // 檢查快取
    const cacheKey = generateCacheKey('city-cost-report', {
      cityCodes,
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      includeTrend,
      includeAnomalies,
    })

    if (!params.forceRefresh) {
      const cached = reportCache.get<CityCostReportResponse>(cacheKey)
      if (cached) return cached
    }

    // 查詢處理統計數據
    const processingStats = await prisma.document.groupBy({
      by: ['cityCode'],
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        ...(cityCodes.length > 0 ? { cityCode: { in: cityCodes } } : {}),
      },
      _count: {
        id: true,
      },
    })

    // 查詢審核狀態統計
    const reviewStats = await prisma.document.groupBy({
      by: ['cityCode', 'processingPath'],
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        ...(cityCodes.length > 0 ? { cityCode: { in: cityCodes } } : {}),
      },
      _count: {
        _all: true,
      },
    })

    // 查詢 API 成本
    const apiCosts = await prisma.apiUsageLog.groupBy({
      by: ['cityCode'],
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        ...(cityCodes.length > 0 ? { cityCode: { in: cityCodes } } : {}),
      },
      _sum: {
        estimatedCost: true,
      },
    })

    // 查詢上期數據（用於比較）
    const periodDays = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    )
    const prevEndDate = new Date(startDate)
    prevEndDate.setDate(prevEndDate.getDate() - 1)
    const prevStartDate = new Date(prevEndDate)
    prevStartDate.setDate(prevStartDate.getDate() - periodDays)

    const prevApiCosts = await prisma.apiUsageLog.groupBy({
      by: ['cityCode'],
      where: {
        createdAt: {
          gte: prevStartDate,
          lte: prevEndDate,
        },
        ...(cityCodes.length > 0 ? { cityCode: { in: cityCodes } } : {}),
      },
      _sum: {
        estimatedCost: true,
      },
    })

    // 建立城市統計 Map
    const cityStatsMap = new Map<
      string,
      {
        totalDocuments: number
        autoApproved: number
        manualReviewed: number
        escalated: number
        apiCost: number
        prevApiCost: number
      }
    >()

    // 處理處理統計
    for (const stat of processingStats) {
      if (!stat.cityCode) continue
      const existing = cityStatsMap.get(stat.cityCode) || {
        totalDocuments: 0,
        autoApproved: 0,
        manualReviewed: 0,
        escalated: 0,
        apiCost: 0,
        prevApiCost: 0,
      }
      existing.totalDocuments = stat._count?.id ?? 0
      cityStatsMap.set(stat.cityCode, existing)
    }

    // 處理審核統計
    for (const stat of reviewStats) {
      if (!stat.cityCode) continue
      const existing = cityStatsMap.get(stat.cityCode) || {
        totalDocuments: 0,
        autoApproved: 0,
        manualReviewed: 0,
        escalated: 0,
        apiCost: 0,
        prevApiCost: 0,
      }

      const count = stat._count?._all ?? 0
      switch (stat.processingPath) {
        case 'AUTO_APPROVE':
          existing.autoApproved = count
          break
        case 'QUICK_REVIEW':
          existing.manualReviewed = count
          break
        case 'FULL_REVIEW':
        case 'MANUAL_REQUIRED':
          existing.escalated += count
          break
      }

      cityStatsMap.set(stat.cityCode, existing)
    }

    // 處理 API 成本
    for (const cost of apiCosts) {
      if (!cost.cityCode) continue
      const existing = cityStatsMap.get(cost.cityCode)
      if (existing) {
        existing.apiCost = Number(cost._sum.estimatedCost) || 0
      }
    }

    // 處理上期 API 成本
    for (const cost of prevApiCosts) {
      if (!cost.cityCode) continue
      const existing = cityStatsMap.get(cost.cityCode)
      if (existing) {
        existing.prevApiCost = Number(cost._sum.estimatedCost) || 0
      }
    }

    // 取得城市名稱
    const allCityCodes = Array.from(cityStatsMap.keys())
    const cityNames = await getCityNames(allCityCodes)

    // 建構報表
    const reports: CityCostReport[] = []
    let totalDocuments = 0
    let totalApiCost = 0
    let totalLaborCost = 0
    let totalAutoApproved = 0

    for (const [cityCode, stats] of cityStatsMap) {
      const laborCost = calculateLaborCost(
        stats.manualReviewed,
        stats.escalated,
        this.laborConfig
      )
      const totalCost = stats.apiCost + laborCost
      const costPerDocument =
        stats.totalDocuments > 0 ? totalCost / stats.totalDocuments : 0
      const automationRate =
        stats.totalDocuments > 0
          ? (stats.autoApproved / stats.totalDocuments) * 100
          : 0

      // 計算與上期比較的變化
      const prevLaborCost = calculateLaborCost(
        stats.manualReviewed,
        stats.escalated,
        this.laborConfig
      )
      const prevTotalCost = stats.prevApiCost + prevLaborCost
      const changeFromLastPeriod =
        prevTotalCost > 0 ? ((totalCost - prevTotalCost) / prevTotalCost) * 100 : null

      // 取得趨勢數據（如需要）
      let trend: CostTrendPoint[] = []
      if (includeTrend) {
        trend = await this.getCityTrendData(cityCode, startDate, endDate)
      }

      // 檢測異常（如需要）
      let anomalies: CostAnomalyDetail[] = []
      if (includeAnomalies) {
        anomalies = await this.detectAnomalies(
          cityCode,
          cityNames.get(cityCode) || cityCode,
          stats,
          startDate,
          endDate
        )
      }

      reports.push({
        cityCode,
        cityName: cityNames.get(cityCode) || cityCode,
        periodStart: formatDate(startDate),
        periodEnd: formatDate(endDate),
        processing: {
          totalDocuments: stats.totalDocuments,
          autoApproved: stats.autoApproved,
          manualReviewed: stats.manualReviewed,
          escalated: stats.escalated,
          automationRate,
        },
        costs: {
          apiCost: stats.apiCost,
          laborCost,
          totalCost,
          costPerDocument,
          changeFromLastPeriod,
        },
        anomalies,
        trend,
      })

      // 累計總計
      totalDocuments += stats.totalDocuments
      totalApiCost += stats.apiCost
      totalLaborCost += laborCost
      totalAutoApproved += stats.autoApproved
    }

    // 依總成本排序
    reports.sort((a, b) => b.costs.totalCost - a.costs.totalCost)

    const totalCost = totalApiCost + totalLaborCost
    const response: CityCostReportResponse = {
      reports,
      totals: {
        totalDocuments,
        totalApiCost,
        totalLaborCost,
        totalCost,
        averageCostPerDocument: totalDocuments > 0 ? totalCost / totalDocuments : 0,
        overallAutomationRate:
          totalDocuments > 0 ? (totalAutoApproved / totalDocuments) * 100 : 0,
      },
      generatedAt: new Date().toISOString(),
    }

    // 存入快取
    reportCache.set(cacheKey, response)

    return response
  }

  /**
   * 取得城市成本趨勢
   *
   * @param params - 查詢參數
   * @param cityFilter - 城市過濾上下文
   * @returns 成本趨勢響應
   */
  async getCostTrend(
    params: CostTrendParams,
    cityFilter: CityFilterContext
  ): Promise<CostTrendResponse> {
    const startDate = new Date(params.startDate)
    const endDate = new Date(params.endDate)
    const cityCode = params.cityCode

    // 驗證城市權限
    if (
      cityFilter.cityCodes.length > 0 &&
      !cityFilter.cityCodes.includes(cityCode)
    ) {
      throw new Error('Access denied: City not in allowed list')
    }

    // 取得城市名稱
    const cityNames = await getCityNames([cityCode])
    const cityName = cityNames.get(cityCode) || cityCode

    // 取得趨勢數據
    const trend = await this.getCityTrendData(cityCode, startDate, endDate)

    // 計算統計摘要
    let totalApiCost = 0
    let totalLaborCost = 0
    let totalDocuments = 0
    let peakCost = 0
    let peakDate = ''

    for (const point of trend) {
      totalApiCost += point.apiCost
      totalLaborCost += point.laborCost
      totalDocuments += point.documentCount

      if (point.totalCost > peakCost) {
        peakCost = point.totalCost
        peakDate = point.date
      }
    }

    const totalCost = totalApiCost + totalLaborCost

    return {
      cityCode,
      cityName,
      trend,
      summary: {
        totalApiCost,
        totalLaborCost,
        totalCost,
        totalDocuments,
        averageCostPerDocument: totalDocuments > 0 ? totalCost / totalDocuments : 0,
        peakCost,
        peakDate,
      },
    }
  }

  /**
   * 分析城市成本異常
   *
   * @param params - 查詢參數
   * @param cityFilter - 城市過濾上下文
   * @returns 異常分析響應
   */
  async analyzeAnomaly(
    params: AnomalyAnalysisParams,
    cityFilter: CityFilterContext
  ): Promise<AnomalyAnalysisResponse> {
    const { startDate, endDate } =
      params.startDate && params.endDate
        ? { startDate: new Date(params.startDate), endDate: new Date(params.endDate) }
        : getDateRange(30)

    const cityCode = params.cityCode

    // 驗證城市權限
    if (
      cityFilter.cityCodes.length > 0 &&
      !cityFilter.cityCodes.includes(cityCode)
    ) {
      throw new Error('Access denied: City not in allowed list')
    }

    // 取得城市名稱
    const cityNames = await getCityNames([cityCode])
    const cityName = cityNames.get(cityCode) || cityCode

    // 取得當前期間統計
    const [processingStats, reviewStats, apiCost] = await Promise.all([
      prisma.document.count({
        where: {
          cityCode,
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
      prisma.document.groupBy({
        by: ['processingPath'],
        where: {
          cityCode,
          createdAt: { gte: startDate, lte: endDate },
        },
        _count: { _all: true },
      }),
      prisma.apiUsageLog.aggregate({
        where: {
          cityCode,
          createdAt: { gte: startDate, lte: endDate },
        },
        _sum: { estimatedCost: true },
      }),
    ])

    // 計算統計數據
    let manualReviewed = 0
    let escalated = 0
    let autoApproved = 0

    for (const stat of reviewStats) {
      const count = stat._count?._all ?? 0
      switch (stat.processingPath) {
        case 'AUTO_APPROVE':
          autoApproved = count
          break
        case 'QUICK_REVIEW':
          manualReviewed = count
          break
        case 'FULL_REVIEW':
        case 'MANUAL_REQUIRED':
          escalated += count
          break
      }
    }

    const stats = {
      totalDocuments: processingStats,
      autoApproved,
      manualReviewed,
      escalated,
      apiCost: Number(apiCost._sum.estimatedCost) || 0,
      prevApiCost: 0,
    }

    // 檢測所有異常
    let anomalies = await this.detectAnomalies(
      cityCode,
      cityName,
      stats,
      startDate,
      endDate
    )

    // 應用過濾器
    if (params.severity?.length) {
      anomalies = anomalies.filter((a) => params.severity!.includes(a.severity))
    }
    if (params.types?.length) {
      anomalies = anomalies.filter((a) => params.types!.includes(a.type))
    }

    // 計算統計摘要
    const summary = {
      totalAnomalies: anomalies.length,
      highSeverityCount: anomalies.filter((a) => a.severity === 'high').length,
      mediumSeverityCount: anomalies.filter((a) => a.severity === 'medium').length,
      lowSeverityCount: anomalies.filter((a) => a.severity === 'low').length,
    }

    return {
      cityCode,
      cityName,
      anomalies,
      summary,
    }
  }

  /**
   * 取得城市趨勢數據
   *
   * @private
   */
  private async getCityTrendData(
    cityCode: string,
    startDate: Date,
    endDate: Date
  ): Promise<CostTrendPoint[]> {
    // 查詢每日處理統計
    const dailyDocs = await prisma.$queryRaw<
      Array<{
        date: Date
        total: bigint
        auto_approved: bigint
        manual_reviewed: bigint
        escalated: bigint
      }>
    >`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as total,
        SUM(CASE WHEN review_type = 'AUTO_APPROVE' THEN 1 ELSE 0 END) as auto_approved,
        SUM(CASE WHEN review_type = 'QUICK_REVIEW' THEN 1 ELSE 0 END) as manual_reviewed,
        SUM(CASE WHEN review_type = 'FULL_REVIEW' THEN 1 ELSE 0 END) as escalated
      FROM documents
      WHERE city_code = ${cityCode}
        AND created_at >= ${startDate}
        AND created_at <= ${endDate}
      GROUP BY DATE(created_at)
      ORDER BY date
    `

    // 查詢每日 API 成本
    const dailyApiCosts = await prisma.$queryRaw<
      Array<{
        date: Date
        cost: number
      }>
    >`
      SELECT
        DATE(created_at) as date,
        SUM(estimated_cost) as cost
      FROM api_usage_logs
      WHERE city_code = ${cityCode}
        AND created_at >= ${startDate}
        AND created_at <= ${endDate}
      GROUP BY DATE(created_at)
      ORDER BY date
    `

    // 建立日期對應的 API 成本 Map
    const apiCostMap = new Map<string, number>()
    for (const item of dailyApiCosts) {
      apiCostMap.set(formatDate(new Date(item.date)), Number(item.cost) || 0)
    }

    // 建構趨勢數據
    const trend: CostTrendPoint[] = []

    for (const doc of dailyDocs) {
      const dateStr = formatDate(new Date(doc.date))
      const documentCount = Number(doc.total)
      const manualReviewed = Number(doc.manual_reviewed)
      const escalated = Number(doc.escalated)
      const apiCost = apiCostMap.get(dateStr) || 0
      const laborCost = calculateLaborCost(manualReviewed, escalated, this.laborConfig)
      const totalCost = apiCost + laborCost
      const costPerDocument = documentCount > 0 ? totalCost / documentCount : 0

      trend.push({
        date: dateStr,
        apiCost,
        laborCost,
        totalCost,
        documentCount,
        costPerDocument,
      })
    }

    return trend
  }

  /**
   * 檢測城市成本異常
   *
   * @private
   */
  private async detectAnomalies(
    cityCode: string,
    cityName: string,
    currentStats: {
      totalDocuments: number
      autoApproved: number
      manualReviewed: number
      escalated: number
      apiCost: number
      prevApiCost: number
    },
    startDate: Date,
    endDate: Date
  ): Promise<CostAnomalyDetail[]> {
    const anomalies: CostAnomalyDetail[] = []
    const periodDays = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    // 計算上期數據
    const prevEndDate = new Date(startDate)
    prevEndDate.setDate(prevEndDate.getDate() - 1)
    const prevStartDate = new Date(prevEndDate)
    prevStartDate.setDate(prevStartDate.getDate() - periodDays)

    // 查詢上期統計
    const [prevDocCount, prevReviewStats, prevApiCostResult] = await Promise.all([
      prisma.document.count({
        where: {
          cityCode,
          createdAt: { gte: prevStartDate, lte: prevEndDate },
        },
      }),
      prisma.document.groupBy({
        by: ['processingPath'],
        where: {
          cityCode,
          createdAt: { gte: prevStartDate, lte: prevEndDate },
        },
        _count: { _all: true },
      }),
      prisma.apiUsageLog.aggregate({
        where: {
          cityCode,
          createdAt: { gte: prevStartDate, lte: prevEndDate },
        },
        _sum: { estimatedCost: true },
      }),
    ])

    let prevManualReviewed = 0
    let prevEscalated = 0
    let prevAutoApproved = 0

    for (const stat of prevReviewStats) {
      const count = stat._count?._all ?? 0
      switch (stat.processingPath) {
        case 'AUTO_APPROVE':
          prevAutoApproved = count
          break
        case 'QUICK_REVIEW':
          prevManualReviewed = count
          break
        case 'FULL_REVIEW':
        case 'MANUAL_REQUIRED':
          prevEscalated += count
          break
      }
    }

    const prevApiCost = Number(prevApiCostResult._sum.estimatedCost) || 0
    const prevLaborCost = calculateLaborCost(prevManualReviewed, prevEscalated, this.laborConfig)
    const prevTotalCost = prevApiCost + prevLaborCost

    // 當期計算
    const currentLaborCost = calculateLaborCost(
      currentStats.manualReviewed,
      currentStats.escalated,
      this.laborConfig
    )
    const currentTotalCost = currentStats.apiCost + currentLaborCost
    const currentCostPerDoc =
      currentStats.totalDocuments > 0
        ? currentTotalCost / currentStats.totalDocuments
        : 0
    const prevCostPerDoc = prevDocCount > 0 ? prevTotalCost / prevDocCount : 0
    const currentAutomationRate =
      currentStats.totalDocuments > 0
        ? (currentStats.autoApproved / currentStats.totalDocuments) * 100
        : 0
    const prevAutomationRate =
      prevDocCount > 0 ? (prevAutoApproved / prevDocCount) * 100 : 0

    const now = new Date().toISOString()
    const periodStartStr = formatDate(startDate)
    const periodEndStr = formatDate(endDate)

    // 檢測處理量異常
    if (prevDocCount > 0) {
      const volumeChange =
        ((currentStats.totalDocuments - prevDocCount) / prevDocCount) * 100

      if (Math.abs(volumeChange) >= this.anomalyThresholds.volumeChangeThreshold) {
        const type: AnomalyType = volumeChange > 0 ? 'volume_spike' : 'volume_drop'
        anomalies.push({
          id: generateAnomalyId(cityCode, type, periodStartStr),
          cityCode,
          cityName,
          type,
          severity: calculateSeverity(volumeChange),
          description:
            volumeChange > 0
              ? `處理量較上期增加 ${volumeChange.toFixed(1)}%`
              : `處理量較上期減少 ${Math.abs(volumeChange).toFixed(1)}%`,
          currentValue: currentStats.totalDocuments,
          baselineValue: prevDocCount,
          changePercentage: volumeChange,
          detectedAt: now,
          periodStart: periodStartStr,
          periodEnd: periodEndStr,
          recommendation: getAnomalyRecommendation(type, volumeChange),
        })
      }
    }

    // 檢測單據成本異常
    if (prevCostPerDoc > 0) {
      const costPerDocChange =
        ((currentCostPerDoc - prevCostPerDoc) / prevCostPerDoc) * 100

      if (
        Math.abs(costPerDocChange) >= this.anomalyThresholds.costPerDocChangeThreshold
      ) {
        const type: AnomalyType =
          costPerDocChange > 0 ? 'cost_per_doc_increase' : 'cost_per_doc_decrease'
        anomalies.push({
          id: generateAnomalyId(cityCode, type, periodStartStr),
          cityCode,
          cityName,
          type,
          severity: calculateSeverity(costPerDocChange),
          description:
            costPerDocChange > 0
              ? `單據成本較上期增加 ${costPerDocChange.toFixed(1)}%`
              : `單據成本較上期減少 ${Math.abs(costPerDocChange).toFixed(1)}%`,
          currentValue: currentCostPerDoc,
          baselineValue: prevCostPerDoc,
          changePercentage: costPerDocChange,
          detectedAt: now,
          periodStart: periodStartStr,
          periodEnd: periodEndStr,
          recommendation: getAnomalyRecommendation(type, costPerDocChange),
        })
      }
    }

    // 檢測 API 成本異常
    if (prevApiCost > 0) {
      const apiCostChange =
        ((currentStats.apiCost - prevApiCost) / prevApiCost) * 100

      if (apiCostChange >= this.anomalyThresholds.costChangeThreshold) {
        anomalies.push({
          id: generateAnomalyId(cityCode, 'api_cost_spike', periodStartStr),
          cityCode,
          cityName,
          type: 'api_cost_spike',
          severity: calculateSeverity(apiCostChange),
          description: `API 成本較上期增加 ${apiCostChange.toFixed(1)}%`,
          currentValue: currentStats.apiCost,
          baselineValue: prevApiCost,
          changePercentage: apiCostChange,
          detectedAt: now,
          periodStart: periodStartStr,
          periodEnd: periodEndStr,
          recommendation: getAnomalyRecommendation('api_cost_spike', apiCostChange),
        })
      }
    }

    // 檢測人工成本異常
    if (prevLaborCost > 0) {
      const laborCostChange =
        ((currentLaborCost - prevLaborCost) / prevLaborCost) * 100

      if (laborCostChange >= this.anomalyThresholds.costChangeThreshold) {
        anomalies.push({
          id: generateAnomalyId(cityCode, 'labor_cost_spike', periodStartStr),
          cityCode,
          cityName,
          type: 'labor_cost_spike',
          severity: calculateSeverity(laborCostChange),
          description: `人工成本較上期增加 ${laborCostChange.toFixed(1)}%`,
          currentValue: currentLaborCost,
          baselineValue: prevLaborCost,
          changePercentage: laborCostChange,
          detectedAt: now,
          periodStart: periodStartStr,
          periodEnd: periodEndStr,
          recommendation: getAnomalyRecommendation('labor_cost_spike', laborCostChange),
        })
      }
    }

    // 檢測自動化率下降
    if (prevAutomationRate > 0) {
      const automationChange = currentAutomationRate - prevAutomationRate

      // 自動化率下降超過 10%（絕對值）視為異常
      if (automationChange < -10) {
        anomalies.push({
          id: generateAnomalyId(cityCode, 'automation_rate_drop', periodStartStr),
          cityCode,
          cityName,
          type: 'automation_rate_drop',
          severity:
            automationChange < -20
              ? 'high'
              : automationChange < -15
                ? 'medium'
                : 'low',
          description: `自動化率較上期下降 ${Math.abs(automationChange).toFixed(1)} 個百分點`,
          currentValue: currentAutomationRate,
          baselineValue: prevAutomationRate,
          changePercentage: (automationChange / prevAutomationRate) * 100,
          detectedAt: now,
          periodStart: periodStartStr,
          periodEnd: periodEndStr,
          recommendation: getAnomalyRecommendation(
            'automation_rate_drop',
            automationChange
          ),
        })
      }
    }

    // 依嚴重度排序
    const severityOrder: Record<AnomalySeverity, number> = {
      high: 0,
      medium: 1,
      low: 2,
    }
    anomalies.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

    return anomalies
  }

  /**
   * 清除快取
   */
  clearCache(): void {
    reportCache.clear()
  }
}

// ============================================================
// Export Singleton Instance
// ============================================================

export const cityCostReportService = new CityCostReportService()
