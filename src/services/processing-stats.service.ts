/**
 * @fileoverview 城市處理量統計服務
 * @description
 *   提供城市處理量追蹤功能：
 *   - 記錄文件處理結果
 *   - 更新每日和每小時統計
 *   - 獲取聚合統計數據
 *   - 數據一致性校驗與修正
 *
 * @module src/services/processing-stats.service
 * @since Epic 7 - Story 7.7 (城市處理數量追蹤)
 * @lastModified 2025-12-19
 *
 * @features
 *   - AC1: 處理結果記錄（增量更新）
 *   - AC2: 時間維度聚合（日/週/月/年）
 *   - AC3: 即時更新（5分鐘快取）
 *   - AC4: 數據準確性校驗
 *
 * @dependencies
 *   - @/lib/prisma - 資料庫客戶端
 *   - @/middleware/city-filter - 城市過濾
 *   - @/types/processing-statistics - 類型定義
 */

import { prisma } from '@/lib/prisma'
import { CityFilterContext, buildCityWhereClause } from '@/middleware/city-filter'
import type {
  ProcessingResultType,
  AggregatedStats,
  StatsQueryParams,
  CityStatsSummary,
  ReconciliationResult,
  StatDiscrepancy,
  RealtimeStats,
  ProcessingCounts
} from '@/types/processing-statistics'

// ============================================================
// Constants
// ============================================================

/**
 * 快取 TTL（毫秒）- 5 分鐘
 */
const CACHE_TTL_MS = 5 * 60 * 1000

/**
 * 即時數據快取 TTL（毫秒）- 1 分鐘
 */
const REALTIME_CACHE_TTL_MS = 60 * 1000

/**
 * 樂觀鎖最大重試次數
 */
const MAX_RETRIES = 3

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
      expiresAt: Date.now() + ttlMs
    })
  }

  delete(key: string): void {
    this.cache.delete(key)
  }

  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'))
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key)
      }
    }
  }

  clear(): void {
    this.cache.clear()
  }
}

const statsCache = new SimpleCache()

// ============================================================
// Helper Functions
// ============================================================

/**
 * 產生快取鍵
 */
function generateCacheKey(prefix: string, params: Record<string, unknown>): string {
  const sortedParams = Object.keys(params).sort().map(k => `${k}:${JSON.stringify(params[k])}`).join('|')
  return `${prefix}:${sortedParams}`
}

/**
 * 格式化日期為 YYYY-MM-DD
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

/**
 * 格式化日期為 HH:00
 */
function formatHour(date: Date): string {
  return date.toISOString().slice(11, 16).replace(/:\d{2}$/, ':00')
}

/**
 * 獲取今日起始時間
 */
function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * 獲取今日結束時間
 */
function endOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

/**
 * 獲取當前小時起始時間
 */
function startOfHour(date: Date): Date {
  const d = new Date(date)
  d.setMinutes(0, 0, 0)
  return d
}

/**
 * 計算百分比變化
 */
function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0
  }
  return ((current - previous) / previous) * 100
}

/**
 * 獲取城市過濾鍵
 */
function getCityFilterKey(context: CityFilterContext): string {
  if (context.isGlobalAdmin) {
    return 'global'
  }
  return context.cityCodes.sort().join(',')
}

// ============================================================
// Processing Stats Service
// ============================================================

export class ProcessingStatsService {
  /**
   * 記錄處理結果
   * 在文件處理完成時調用
   *
   * @param cityCode - 城市代碼
   * @param resultType - 處理結果類型
   * @param processingTimeSeconds - 處理時間（秒）
   */
  async recordProcessingResult(
    cityCode: string,
    resultType: ProcessingResultType,
    processingTimeSeconds: number
  ): Promise<void> {
    const today = startOfDay(new Date())
    const currentHour = startOfHour(new Date())

    // 並行更新日統計和小時統計
    await Promise.all([
      this.updateDailyStats(cityCode, today, resultType, processingTimeSeconds),
      this.updateHourlyStats(cityCode, currentHour, resultType, processingTimeSeconds)
    ])

    // 清除相關快取
    this.invalidateRelatedCaches(cityCode)
  }

  /**
   * 更新每日統計
   */
  private async updateDailyStats(
    cityCode: string,
    date: Date,
    resultType: ProcessingResultType,
    processingTimeSeconds: number
  ): Promise<void> {
    await this.updateWithOptimisticLock(cityCode, date, resultType, processingTimeSeconds)
  }

  /**
   * 樂觀鎖更新
   */
  private async updateWithOptimisticLock(
    cityCode: string,
    date: Date,
    resultType: ProcessingResultType,
    processingTimeSeconds: number,
    attempt: number = 0
  ): Promise<void> {
    if (attempt >= MAX_RETRIES) {
      throw new Error(`Failed to update stats after ${MAX_RETRIES} attempts`)
    }

    try {
      const existing = await prisma.processingStatistics.findUnique({
        where: { cityCode_date: { cityCode, date } }
      })

      if (!existing) {
        // 創建新記錄
        await prisma.processingStatistics.create({
          data: {
            cityCode,
            date,
            totalProcessed: 1,
            autoApproved: resultType === 'AUTO_APPROVED' ? 1 : 0,
            manualReviewed: resultType === 'MANUAL_REVIEWED' ? 1 : 0,
            escalated: resultType === 'ESCALATED' ? 1 : 0,
            failed: resultType === 'FAILED' ? 1 : 0,
            totalProcessingTime: processingTimeSeconds,
            successCount: resultType !== 'FAILED' ? 1 : 0,
            avgProcessingTime: processingTimeSeconds,
            minProcessingTime: processingTimeSeconds,
            maxProcessingTime: processingTimeSeconds,
            successRate: resultType !== 'FAILED' ? 100 : 0,
            automationRate: resultType === 'AUTO_APPROVED' ? 100 : 0,
            version: 1
          }
        })
        return
      }

      // 計算新值
      const newTotal = existing.totalProcessed + 1
      const newProcessingTime = existing.totalProcessingTime + processingTimeSeconds
      const newSuccessCount = existing.successCount + (resultType !== 'FAILED' ? 1 : 0)
      const newAutoApproved = existing.autoApproved + (resultType === 'AUTO_APPROVED' ? 1 : 0)

      // 使用版本號進行樂觀鎖更新
      const updateResult = await prisma.processingStatistics.updateMany({
        where: {
          cityCode,
          date,
          version: existing.version
        },
        data: {
          totalProcessed: newTotal,
          autoApproved: newAutoApproved,
          manualReviewed: existing.manualReviewed + (resultType === 'MANUAL_REVIEWED' ? 1 : 0),
          escalated: existing.escalated + (resultType === 'ESCALATED' ? 1 : 0),
          failed: existing.failed + (resultType === 'FAILED' ? 1 : 0),
          totalProcessingTime: newProcessingTime,
          successCount: newSuccessCount,
          avgProcessingTime: newProcessingTime / newTotal,
          successRate: (newSuccessCount / newTotal) * 100,
          automationRate: (newAutoApproved / newTotal) * 100,
          minProcessingTime: existing.minProcessingTime
            ? Math.min(existing.minProcessingTime, processingTimeSeconds)
            : processingTimeSeconds,
          maxProcessingTime: existing.maxProcessingTime
            ? Math.max(existing.maxProcessingTime, processingTimeSeconds)
            : processingTimeSeconds,
          lastUpdatedAt: new Date(),
          version: existing.version + 1
        }
      })

      if (updateResult.count === 0) {
        // 版本衝突，重試
        await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)))
        await this.updateWithOptimisticLock(
          cityCode,
          date,
          resultType,
          processingTimeSeconds,
          attempt + 1
        )
      }
    } catch (error) {
      if (attempt < MAX_RETRIES - 1) {
        await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)))
        await this.updateWithOptimisticLock(
          cityCode,
          date,
          resultType,
          processingTimeSeconds,
          attempt + 1
        )
      } else {
        throw error
      }
    }
  }

  /**
   * 更新小時統計
   */
  private async updateHourlyStats(
    cityCode: string,
    hour: Date,
    resultType: ProcessingResultType,
    processingTimeSeconds: number
  ): Promise<void> {
    await prisma.hourlyProcessingStats.upsert({
      where: {
        cityCode_hour: { cityCode, hour }
      },
      create: {
        cityCode,
        hour,
        totalProcessed: 1,
        autoApproved: resultType === 'AUTO_APPROVED' ? 1 : 0,
        manualReviewed: resultType === 'MANUAL_REVIEWED' ? 1 : 0,
        escalated: resultType === 'ESCALATED' ? 1 : 0,
        failed: resultType === 'FAILED' ? 1 : 0,
        totalProcessingTime: processingTimeSeconds
      },
      update: {
        totalProcessed: { increment: 1 },
        autoApproved: resultType === 'AUTO_APPROVED' ? { increment: 1 } : undefined,
        manualReviewed: resultType === 'MANUAL_REVIEWED' ? { increment: 1 } : undefined,
        escalated: resultType === 'ESCALATED' ? { increment: 1 } : undefined,
        failed: resultType === 'FAILED' ? { increment: 1 } : undefined,
        totalProcessingTime: { increment: processingTimeSeconds }
      }
    })
  }

  /**
   * 獲取聚合統計數據
   */
  async getAggregatedStats(
    cityFilter: CityFilterContext,
    params: StatsQueryParams
  ): Promise<AggregatedStats[]> {
    const cacheKey = generateCacheKey('aggregated', {
      cityFilter: getCityFilterKey(cityFilter),
      ...params
    })

    // 嘗試從快取獲取
    const cached = statsCache.get<AggregatedStats[]>(cacheKey)
    if (cached) {
      return cached
    }

    const startDate = new Date(params.startDate)
    const endDate = new Date(params.endDate)

    let result: AggregatedStats[]

    switch (params.granularity) {
      case 'hour':
        result = await this.getHourlyAggregation(cityFilter, startDate, endDate)
        break
      case 'day':
        result = await this.getDailyAggregation(cityFilter, startDate, endDate)
        break
      case 'week':
      case 'month':
      case 'year':
        result = await this.getPeriodAggregation(cityFilter, startDate, endDate, params.granularity)
        break
      default:
        result = await this.getDailyAggregation(cityFilter, startDate, endDate)
    }

    // 寫入快取
    statsCache.set(cacheKey, result, CACHE_TTL_MS)

    return result
  }

  /**
   * 每小時聚合
   */
  private async getHourlyAggregation(
    cityFilter: CityFilterContext,
    startDate: Date,
    endDate: Date
  ): Promise<AggregatedStats[]> {
    const cityWhere = buildCityWhereClause(cityFilter, 'cityCode')

    const stats = await prisma.hourlyProcessingStats.groupBy({
      by: ['hour'],
      where: {
        ...cityWhere,
        hour: { gte: startDate, lte: endDate }
      },
      _sum: {
        totalProcessed: true,
        autoApproved: true,
        manualReviewed: true,
        escalated: true,
        failed: true,
        totalProcessingTime: true
      },
      orderBy: { hour: 'asc' }
    })

    return stats.map(s => this.mapToAggregatedStats(
      s.hour.toISOString(),
      s._sum as ProcessingCounts
    ))
  }

  /**
   * 每日聚合
   */
  private async getDailyAggregation(
    cityFilter: CityFilterContext,
    startDate: Date,
    endDate: Date
  ): Promise<AggregatedStats[]> {
    const cityWhere = buildCityWhereClause(cityFilter, 'cityCode')

    const stats = await prisma.processingStatistics.groupBy({
      by: ['date'],
      where: {
        ...cityWhere,
        date: { gte: startDate, lte: endDate }
      },
      _sum: {
        totalProcessed: true,
        autoApproved: true,
        manualReviewed: true,
        escalated: true,
        failed: true,
        totalProcessingTime: true,
        successCount: true
      },
      orderBy: { date: 'asc' }
    })

    return stats.map(s => this.mapToAggregatedStats(
      formatDate(s.date),
      s._sum as ProcessingCounts
    ))
  }

  /**
   * 週/月/年聚合
   */
  private async getPeriodAggregation(
    cityFilter: CityFilterContext,
    startDate: Date,
    endDate: Date,
    granularity: 'week' | 'month' | 'year'
  ): Promise<AggregatedStats[]> {
    const cityWhere = buildCityWhereClause(cityFilter, 'cityCode')

    // 獲取原始每日數據
    const dailyStats = await prisma.processingStatistics.findMany({
      where: {
        ...cityWhere,
        date: { gte: startDate, lte: endDate }
      },
      orderBy: { date: 'asc' }
    })

    // 按期間分組
    const groupedData = new Map<string, ProcessingCounts>()

    for (const stat of dailyStats) {
      const periodKey = this.getPeriodKey(stat.date, granularity)
      const existing = groupedData.get(periodKey) || {
        totalProcessed: 0,
        autoApproved: 0,
        manualReviewed: 0,
        escalated: 0,
        failed: 0,
        totalProcessingTime: 0,
        successCount: 0
      }

      groupedData.set(periodKey, {
        totalProcessed: existing.totalProcessed + stat.totalProcessed,
        autoApproved: existing.autoApproved + stat.autoApproved,
        manualReviewed: existing.manualReviewed + stat.manualReviewed,
        escalated: existing.escalated + stat.escalated,
        failed: existing.failed + stat.failed,
        totalProcessingTime: existing.totalProcessingTime + stat.totalProcessingTime,
        successCount: existing.successCount + stat.successCount
      })
    }

    // 轉換為結果陣列
    return Array.from(groupedData.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, counts]) => this.mapToAggregatedStats(period, counts))
  }

  /**
   * 獲取期間鍵
   */
  private getPeriodKey(date: Date, granularity: 'week' | 'month' | 'year'): string {
    const year = date.getFullYear()
    const month = date.getMonth() + 1

    switch (granularity) {
      case 'week': {
        // 計算 ISO 週數
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
        const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
        return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
      }
      case 'month':
        return `${year}-${String(month).padStart(2, '0')}`
      case 'year':
        return `${year}`
    }
  }

  /**
   * 獲取城市統計匯總
   */
  async getCityStatsSummary(
    cityFilter: CityFilterContext,
    startDate: Date,
    endDate: Date
  ): Promise<CityStatsSummary[]> {
    const cacheKey = generateCacheKey('city-summary', {
      cityFilter: getCityFilterKey(cityFilter),
      startDate: formatDate(startDate),
      endDate: formatDate(endDate)
    })

    const cached = statsCache.get<CityStatsSummary[]>(cacheKey)
    if (cached) {
      return cached
    }

    const cityWhere = buildCityWhereClause(cityFilter, 'cityCode')

    // 當前期間統計
    const currentStats = await prisma.processingStatistics.groupBy({
      by: ['cityCode'],
      where: {
        ...cityWhere,
        date: { gte: startDate, lte: endDate }
      },
      _sum: {
        totalProcessed: true,
        autoApproved: true,
        manualReviewed: true,
        escalated: true,
        failed: true,
        totalProcessingTime: true,
        successCount: true
      }
    })

    // 上一期間統計（用於趨勢計算）
    const periodLength = endDate.getTime() - startDate.getTime()
    const prevStartDate = new Date(startDate.getTime() - periodLength)
    const prevEndDate = new Date(startDate.getTime() - 1)

    const prevStats = await prisma.processingStatistics.groupBy({
      by: ['cityCode'],
      where: {
        ...cityWhere,
        date: { gte: prevStartDate, lte: prevEndDate }
      },
      _sum: {
        totalProcessed: true,
        autoApproved: true
      }
    })

    const prevStatsMap = new Map(
      prevStats.map(s => [s.cityCode, s._sum])
    )

    // 獲取城市名稱
    const cities = await prisma.city.findMany({
      where: { code: { in: currentStats.map(s => s.cityCode) } },
      select: { code: true, name: true }
    })
    const cityNameMap = new Map(cities.map(c => [c.code, c.name]))

    const result: CityStatsSummary[] = currentStats.map(s => {
      const prev = prevStatsMap.get(s.cityCode)
      const totalProcessed = s._sum.totalProcessed || 0
      const autoApproved = s._sum.autoApproved || 0

      return {
        cityCode: s.cityCode,
        cityName: cityNameMap.get(s.cityCode) || s.cityCode,
        totalProcessed,
        autoApproved,
        manualReviewed: s._sum.manualReviewed || 0,
        escalated: s._sum.escalated || 0,
        failed: s._sum.failed || 0,
        avgProcessingTime: totalProcessed
          ? (s._sum.totalProcessingTime || 0) / totalProcessed
          : 0,
        successRate: totalProcessed
          ? ((s._sum.successCount || 0) / totalProcessed) * 100
          : 0,
        automationRate: totalProcessed
          ? (autoApproved / totalProcessed) * 100
          : 0,
        trend: {
          processedChange: calculatePercentageChange(
            totalProcessed,
            prev?.totalProcessed || 0
          ),
          automationChange: calculatePercentageChange(
            autoApproved,
            prev?.autoApproved || 0
          )
        }
      }
    })

    statsCache.set(cacheKey, result, CACHE_TTL_MS)

    return result
  }

  /**
   * 獲取即時統計（當日）
   */
  async getRealtimeStats(cityFilter: CityFilterContext): Promise<RealtimeStats> {
    const cacheKey = generateCacheKey('realtime', {
      cityFilter: getCityFilterKey(cityFilter)
    })

    const cached = statsCache.get<RealtimeStats>(cacheKey)
    if (cached) {
      return cached
    }

    const today = startOfDay(new Date())
    const cityWhere = buildCityWhereClause(cityFilter, 'cityCode')

    // 獲取今日統計
    const todayStatsRaw = await prisma.processingStatistics.aggregate({
      where: {
        ...cityWhere,
        date: today
      },
      _sum: {
        totalProcessed: true,
        autoApproved: true,
        manualReviewed: true,
        escalated: true,
        failed: true,
        totalProcessingTime: true,
        successCount: true
      }
    })

    // 獲取今日每小時趨勢
    const hourlyTrend = await prisma.hourlyProcessingStats.groupBy({
      by: ['hour'],
      where: {
        ...cityWhere,
        hour: { gte: today }
      },
      _sum: { totalProcessed: true },
      orderBy: { hour: 'asc' }
    })

    const totalProcessed = todayStatsRaw._sum.totalProcessed || 0

    const result: RealtimeStats = {
      todayStats: totalProcessed > 0 ? {
        cityCode: cityFilter.isGlobalAdmin ? 'ALL' : cityFilter.cityCodes.join(','),
        date: formatDate(today),
        totalProcessed,
        autoApproved: todayStatsRaw._sum.autoApproved || 0,
        manualReviewed: todayStatsRaw._sum.manualReviewed || 0,
        escalated: todayStatsRaw._sum.escalated || 0,
        failed: todayStatsRaw._sum.failed || 0,
        totalProcessingTime: todayStatsRaw._sum.totalProcessingTime || 0,
        avgProcessingTime: totalProcessed
          ? (todayStatsRaw._sum.totalProcessingTime || 0) / totalProcessed
          : null,
        minProcessingTime: null,
        maxProcessingTime: null,
        successCount: todayStatsRaw._sum.successCount || 0,
        successRate: totalProcessed
          ? ((todayStatsRaw._sum.successCount || 0) / totalProcessed) * 100
          : null,
        automationRate: totalProcessed
          ? ((todayStatsRaw._sum.autoApproved || 0) / totalProcessed) * 100
          : null,
        lastUpdatedAt: new Date().toISOString()
      } : null,
      hourlyTrend: hourlyTrend.map(h => ({
        hour: formatHour(h.hour),
        count: h._sum.totalProcessed || 0
      }))
    }

    statsCache.set(cacheKey, result, REALTIME_CACHE_TTL_MS)

    return result
  }

  /**
   * 數據一致性校驗與修正
   */
  async verifyAndReconcile(
    cityCode: string,
    date: Date,
    executedBy: string = 'SYSTEM'
  ): Promise<ReconciliationResult> {
    const stats = await prisma.processingStatistics.findUnique({
      where: { cityCode_date: { cityCode, date } }
    })

    const startOfDayDate = startOfDay(date)
    const endOfDayDate = endOfDay(date)

    // 從原始文件數據計算實際值 - 按狀態和處理路徑分組
    const actualCounts = await prisma.document.groupBy({
      by: ['status', 'processingPath'],
      where: {
        cityCode,
        createdAt: { gte: startOfDayDate, lte: endOfDayDate }
      },
      _count: { id: true }
    })

    // 計算實際統計
    const actual: ProcessingCounts = {
      totalProcessed: 0,
      autoApproved: 0,
      manualReviewed: 0,
      escalated: 0,
      failed: 0,
      totalProcessingTime: 0,
      successCount: 0
    }

    for (const row of actualCounts) {
      actual.totalProcessed += row._count.id

      // 檢查失敗狀態
      if (row.status === 'FAILED' || row.status === 'OCR_FAILED') {
        actual.failed += row._count.id
      } else {
        actual.successCount += row._count.id
        if (row.status === 'ESCALATED') {
          actual.escalated += row._count.id
        } else if (row.status === 'APPROVED' || row.status === 'COMPLETED') {
          // 根據處理路徑判斷自動通過或人工審核
          if (row.processingPath === 'AUTO_APPROVE') {
            actual.autoApproved += row._count.id
          } else {
            actual.manualReviewed += row._count.id
          }
        }
      }
    }

    // 比對並記錄差異
    const discrepancies: StatDiscrepancy[] = []

    if (stats) {
      const fields: (keyof ProcessingCounts)[] = [
        'totalProcessed', 'autoApproved', 'manualReviewed',
        'escalated', 'failed', 'successCount'
      ]

      for (const field of fields) {
        const expected = actual[field]
        const statsValue = stats[field as keyof typeof stats] as number

        if (expected !== statsValue) {
          discrepancies.push({
            field,
            expected,
            actual: statsValue,
            difference: expected - statsValue
          })
        }
      }
    }

    const needsCorrection = discrepancies.length > 0 || !stats
    let corrected = false

    if (needsCorrection) {
      // 執行修正
      await this.recalculateFromSource(cityCode, date, actual)
      corrected = true
    }

    // 記錄審計日誌
    const auditLog = await prisma.statisticsAuditLog.create({
      data: {
        cityCode,
        date,
        auditType: executedBy === 'SYSTEM' ? 'SCHEDULED' : 'MANUAL',
        verified: discrepancies.length === 0,
        discrepancies: discrepancies.length > 0
          ? JSON.parse(JSON.stringify(discrepancies))
          : undefined,
        corrections: corrected
          ? JSON.parse(JSON.stringify(actual))
          : undefined,
        executedBy
      }
    })

    return {
      verified: discrepancies.length === 0,
      discrepancies,
      corrected,
      auditLogId: auditLog.id
    }
  }

  /**
   * 從原始數據重新計算統計
   */
  private async recalculateFromSource(
    cityCode: string,
    date: Date,
    counts: ProcessingCounts
  ): Promise<void> {
    const avgProcessingTime = counts.totalProcessed > 0
      ? counts.totalProcessingTime / counts.totalProcessed
      : null

    await prisma.processingStatistics.upsert({
      where: { cityCode_date: { cityCode, date } },
      create: {
        cityCode,
        date,
        ...counts,
        avgProcessingTime,
        successRate: counts.totalProcessed > 0
          ? (counts.successCount / counts.totalProcessed) * 100
          : null,
        automationRate: counts.totalProcessed > 0
          ? (counts.autoApproved / counts.totalProcessed) * 100
          : null,
        minProcessingTime: null,
        maxProcessingTime: null
      },
      update: {
        ...counts,
        avgProcessingTime,
        successRate: counts.totalProcessed > 0
          ? (counts.successCount / counts.totalProcessed) * 100
          : null,
        automationRate: counts.totalProcessed > 0
          ? (counts.autoApproved / counts.totalProcessed) * 100
          : null,
        lastUpdatedAt: new Date(),
        version: { increment: 1 }
      }
    })
  }

  // ==================== Helper Methods ====================

  private mapToAggregatedStats(period: string, sum: ProcessingCounts): AggregatedStats {
    const totalProcessed = sum.totalProcessed || 0
    const successCount = sum.successCount || (totalProcessed - (sum.failed || 0))

    return {
      period,
      totalProcessed,
      autoApproved: sum.autoApproved || 0,
      manualReviewed: sum.manualReviewed || 0,
      escalated: sum.escalated || 0,
      failed: sum.failed || 0,
      avgProcessingTime: totalProcessed
        ? (sum.totalProcessingTime || 0) / totalProcessed
        : 0,
      successRate: totalProcessed
        ? (successCount / totalProcessed) * 100
        : 0,
      automationRate: totalProcessed
        ? ((sum.autoApproved || 0) / totalProcessed) * 100
        : 0
    }
  }

  private invalidateRelatedCaches(cityCode: string): void {
    statsCache.invalidatePattern(`.*${cityCode}.*`)
    statsCache.invalidatePattern('.*global.*')
    statsCache.invalidatePattern('realtime.*')
    statsCache.invalidatePattern('city-summary.*')
  }
}

// 導出單例
export const processingStatsService = new ProcessingStatsService()
