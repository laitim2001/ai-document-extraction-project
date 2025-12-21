/**
 * @fileoverview 儀表板統計服務
 * @description
 *   提供儀表板統計數據的計算和快取：
 *   - 處理量統計（今日/本週/本月）
 *   - 成功率計算
 *   - 自動化率計算
 *   - 平均處理時間計算
 *   - 待審核數量統計
 *
 *   ## 快取策略
 *   使用記憶體快取，TTL 為 5 分鐘。
 *   快取鍵包含城市代碼以支援城市隔離。
 *
 *   ## 城市數據隔離
 *   所有查詢都會根據用戶的城市訪問權限進行過濾。
 *
 * @module src/services/dashboard-statistics.service
 * @author Development Team
 * @since Epic 7 - Story 7.1 (Processing Statistics Dashboard)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - prisma - 資料庫操作
 *   - CityFilterContext - 城市過濾上下文
 *
 * @related
 *   - src/middleware/city-filter.ts - 城市過濾中間件
 *   - src/app/api/dashboard/statistics/route.ts - 統計 API
 *   - src/types/dashboard.ts - 類型定義
 */

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { CityFilterContext, buildCityWhereClause } from '@/middlewares/city-filter'
import {
  DashboardStatistics,
  StatisticsQueryParams,
  ProcessingVolume,
  PercentageMetric,
  ProcessingTimeMetric,
  PendingReviewMetric,
  TrendDirection,
  CacheEntry,
} from '@/types/dashboard'

// ============================================================
// Constants
// ============================================================

/** 快取 TTL（毫秒）- 5 分鐘 */
const CACHE_TTL_MS = 5 * 60 * 1000

/** 清理快取間隔（毫秒）- 1 分鐘 */
const CACHE_CLEANUP_INTERVAL_MS = 60 * 1000

// ============================================================
// DashboardStatisticsService
// ============================================================

/**
 * 儀表板統計服務
 *
 * @description
 *   提供處理量、成功率、自動化率等關鍵指標的計算。
 *   使用記憶體快取減少資料庫負載。
 */
export class DashboardStatisticsService {
  private static instance: DashboardStatisticsService | null = null

  /** 統計快取 */
  private cache: Map<string, CacheEntry<DashboardStatistics>> = new Map()

  /** 快取清理定時器 */
  private cleanupTimer: NodeJS.Timeout | null = null

  /**
   * 私有建構函數（單例模式）
   */
  private constructor() {
    // 定期清理過期快取
    this.cleanupTimer = setInterval(() => this.cleanExpiredCache(), CACHE_CLEANUP_INTERVAL_MS)
  }

  /**
   * 取得 DashboardStatisticsService 單例
   */
  static getInstance(): DashboardStatisticsService {
    if (!DashboardStatisticsService.instance) {
      DashboardStatisticsService.instance = new DashboardStatisticsService()
    }
    return DashboardStatisticsService.instance
  }

  /**
   * 重置單例（僅用於測試）
   */
  static resetInstance(): void {
    if (DashboardStatisticsService.instance?.cleanupTimer) {
      clearInterval(DashboardStatisticsService.instance.cleanupTimer)
    }
    DashboardStatisticsService.instance = null
  }

  // ============================================================
  // Main API
  // ============================================================

  /**
   * 獲取儀表板統計數據
   *
   * @param cityContext - 城市過濾上下文
   * @param params - 查詢參數（可選）
   * @returns 儀表板統計數據
   */
  async getStatistics(
    cityContext: CityFilterContext,
    params?: StatisticsQueryParams
  ): Promise<DashboardStatistics> {
    const cacheKey = this.buildCacheKey(cityContext, params)
    const now = Date.now()

    // 嘗試從快取獲取
    const cached = this.cache.get(cacheKey)
    if (cached && cached.expiresAt > now) {
      return cached.data
    }

    // 構建城市過濾條件
    const cityWhere = buildCityWhereClause(cityContext)
    const currentTime = new Date()

    // 並行查詢所有統計數據
    const [processingVolume, successRate, automationRate, avgProcessingTime, pendingReview] =
      await Promise.all([
        this.getProcessingVolume(cityWhere, currentTime),
        this.getSuccessRate(cityWhere, currentTime),
        this.getAutomationRate(cityWhere, currentTime),
        this.getAverageProcessingTime(cityWhere, currentTime),
        this.getPendingReviewCount(cityWhere),
      ])

    const statistics: DashboardStatistics = {
      processingVolume,
      successRate,
      automationRate,
      averageProcessingTime: avgProcessingTime,
      pendingReview,
      lastUpdated: currentTime.toISOString(),
    }

    // 寫入快取
    this.cache.set(cacheKey, {
      data: statistics,
      expiresAt: now + CACHE_TTL_MS,
    })

    return statistics
  }

  // ============================================================
  // Processing Volume
  // ============================================================

  /**
   * 計算處理量統計（今日/本週/本月）
   */
  private async getProcessingVolume(
    cityWhere: Record<string, unknown>,
    now: Date
  ): Promise<ProcessingVolume> {
    // 計算時間範圍
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)

    const weekStart = new Date(now)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    weekStart.setHours(0, 0, 0, 0)

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    // 已完成狀態
    const completedStatuses = ['COMPLETED', 'APPROVED'] as const
    const completedStatus = { in: [...completedStatuses] }

    // 並行查詢各時間範圍的處理量
    const [today, thisWeek, thisMonth, lastMonth] = await Promise.all([
      prisma.document.count({
        where: {
          ...cityWhere,
          status: completedStatus,
          updatedAt: { gte: todayStart },
        },
      }),
      prisma.document.count({
        where: {
          ...cityWhere,
          status: completedStatus,
          updatedAt: { gte: weekStart },
        },
      }),
      prisma.document.count({
        where: {
          ...cityWhere,
          status: completedStatus,
          updatedAt: { gte: monthStart },
        },
      }),
      prisma.document.count({
        where: {
          ...cityWhere,
          status: completedStatus,
          updatedAt: {
            gte: lastMonthStart,
            lt: monthStart,
          },
        },
      }),
    ])

    // 計算趨勢
    const { trend, trendPercentage } = this.calculateTrend(thisMonth, lastMonth)

    return {
      today,
      thisWeek,
      thisMonth,
      trend,
      trendPercentage,
    }
  }

  // ============================================================
  // Success Rate
  // ============================================================

  /**
   * 計算成功率
   */
  private async getSuccessRate(
    cityWhere: Record<string, unknown>,
    now: Date
  ): Promise<PercentageMetric> {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    // 排除還在處理中的狀態
    const processedStatuses = ['COMPLETED', 'APPROVED', 'FAILED'] as const
    const processedStatus = { in: [...processedStatuses] }

    // 本月數據
    const [totalThisMonth, successfulThisMonth] = await Promise.all([
      prisma.document.count({
        where: {
          ...cityWhere,
          status: processedStatus,
          updatedAt: { gte: monthStart },
        },
      }),
      prisma.document.count({
        where: {
          ...cityWhere,
          status: { in: ['COMPLETED', 'APPROVED'] },
          updatedAt: { gte: monthStart },
        },
      }),
    ])

    // 上月數據（用於趨勢計算）
    const [totalLastMonth, successfulLastMonth] = await Promise.all([
      prisma.document.count({
        where: {
          ...cityWhere,
          status: processedStatus,
          updatedAt: { gte: lastMonthStart, lt: monthStart },
        },
      }),
      prisma.document.count({
        where: {
          ...cityWhere,
          status: { in: ['COMPLETED', 'APPROVED'] },
          updatedAt: { gte: lastMonthStart, lt: monthStart },
        },
      }),
    ])

    const currentRate = totalThisMonth > 0 ? (successfulThisMonth / totalThisMonth) * 100 : 0
    const lastRate = totalLastMonth > 0 ? (successfulLastMonth / totalLastMonth) * 100 : 0

    const { trend, trendPercentage } = this.calculateTrend(currentRate, lastRate)

    return {
      value: Math.round(currentRate * 10) / 10,
      trend,
      trendPercentage,
    }
  }

  // ============================================================
  // Automation Rate
  // ============================================================

  /**
   * 計算自動化率（無需人工審核的比例）
   *
   * @description
   *   使用 ProcessingQueue 的 processingPath 判斷是否為自動通過。
   *   AUTO_APPROVE 路徑表示自動化處理。
   */
  private async getAutomationRate(
    cityWhere: Record<string, unknown>,
    now: Date
  ): Promise<PercentageMetric> {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    // 本月數據：通過 ProcessingQueue 判斷
    const [totalThisMonth, autoApprovedThisMonth] = await Promise.all([
      prisma.processingQueue.count({
        where: {
          ...cityWhere,
          status: 'COMPLETED',
          completedAt: { gte: monthStart },
        },
      }),
      prisma.processingQueue.count({
        where: {
          ...cityWhere,
          status: 'COMPLETED',
          processingPath: 'AUTO_APPROVE',
          completedAt: { gte: monthStart },
        },
      }),
    ])

    // 上月數據
    const [totalLastMonth, autoApprovedLastMonth] = await Promise.all([
      prisma.processingQueue.count({
        where: {
          ...cityWhere,
          status: 'COMPLETED',
          completedAt: { gte: lastMonthStart, lt: monthStart },
        },
      }),
      prisma.processingQueue.count({
        where: {
          ...cityWhere,
          status: 'COMPLETED',
          processingPath: 'AUTO_APPROVE',
          completedAt: { gte: lastMonthStart, lt: monthStart },
        },
      }),
    ])

    const currentRate = totalThisMonth > 0 ? (autoApprovedThisMonth / totalThisMonth) * 100 : 0
    const lastRate = totalLastMonth > 0 ? (autoApprovedLastMonth / totalLastMonth) * 100 : 0

    const { trend, trendPercentage } = this.calculateTrend(currentRate, lastRate)

    return {
      value: Math.round(currentRate * 10) / 10,
      trend,
      trendPercentage,
    }
  }

  // ============================================================
  // Average Processing Time
  // ============================================================

  /**
   * 計算平均處理時間
   *
   * @description
   *   使用 ProcessingQueue 的 startedAt 和 completedAt 計算處理時間。
   *   處理時間下降是好事，趨勢方向相反。
   */
  private async getAverageProcessingTime(
    cityWhere: Record<string, unknown>,
    now: Date
  ): Promise<ProcessingTimeMetric> {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    // 建立城市過濾條件片段
    const cityFilter = cityWhere.cityCode
      ? Prisma.sql`AND city_code = ${cityWhere.cityCode}`
      : Prisma.empty

    // 使用原生 SQL 計算平均處理時間（秒）
    // 因為 Prisma aggregate 不直接支援 DateTime 差計算
    const currentResult = await prisma.$queryRaw<{ avg_seconds: number | null }[]>`
      SELECT AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_seconds
      FROM processing_queues
      WHERE status = 'COMPLETED'
        AND completed_at >= ${monthStart}
        AND started_at IS NOT NULL
        AND completed_at IS NOT NULL
        ${cityFilter}
    `

    const lastResult = await prisma.$queryRaw<{ avg_seconds: number | null }[]>`
      SELECT AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_seconds
      FROM processing_queues
      WHERE status = 'COMPLETED'
        AND completed_at >= ${lastMonthStart}
        AND completed_at < ${monthStart}
        AND started_at IS NOT NULL
        AND completed_at IS NOT NULL
        ${cityFilter}
    `

    const currentAvg = currentResult[0]?.avg_seconds || 0
    const lastAvg = lastResult[0]?.avg_seconds || 0

    // 處理時間下降是好事，所以趨勢邏輯相反
    const { trend, trendPercentage } = this.calculateTrend(
      lastAvg, // 注意：參數順序相反
      currentAvg
    )

    return {
      value: Math.round(currentAvg),
      formatted: this.formatDuration(currentAvg),
      trend,
      trendPercentage,
    }
  }

  // ============================================================
  // Pending Review
  // ============================================================

  /**
   * 獲取待審核數量
   */
  private async getPendingReviewCount(
    cityWhere: Record<string, unknown>
  ): Promise<PendingReviewMetric> {
    const urgentThreshold = new Date()
    urgentThreshold.setHours(urgentThreshold.getHours() - 24)

    const [total, urgent] = await Promise.all([
      prisma.document.count({
        where: {
          ...cityWhere,
          status: 'PENDING_REVIEW',
        },
      }),
      prisma.document.count({
        where: {
          ...cityWhere,
          status: 'PENDING_REVIEW',
          createdAt: { lt: urgentThreshold },
        },
      }),
    ])

    return { count: total, urgent }
  }

  // ============================================================
  // Helper Methods
  // ============================================================

  /**
   * 計算趨勢
   */
  private calculateTrend(
    current: number,
    previous: number
  ): { trend: TrendDirection; trendPercentage: number } {
    if (previous === 0) {
      return { trend: 'stable', trendPercentage: 0 }
    }

    const change = ((current - previous) / previous) * 100
    const trendPercentage = Math.abs(Math.round(change * 10) / 10)

    let trend: TrendDirection = 'stable'
    if (change > 1) trend = 'up'
    else if (change < -1) trend = 'down'

    return { trend, trendPercentage }
  }

  /**
   * 格式化時間長度
   */
  private formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`
    }
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.round(seconds % 60)
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
  }

  /**
   * 建構快取鍵
   */
  private buildCacheKey(
    cityContext: CityFilterContext,
    params?: StatisticsQueryParams
  ): string {
    const cityPart = cityContext.isGlobalAdmin ? 'global' : cityContext.cityCodes.sort().join(',')
    const datePart =
      params?.startDate && params?.endDate ? `${params.startDate}_${params.endDate}` : 'default'
    return `dashboard:stats:${cityPart}:${datePart}`
  }

  /**
   * 清理過期快取
   */
  private cleanExpiredCache(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key)
      }
    }
  }

  // ============================================================
  // Cache Management
  // ============================================================

  /**
   * 清除儀表板快取
   *
   * @param cityCode - 特定城市代碼（可選，不指定則清除全部）
   */
  invalidateCache(cityCode?: string): void {
    if (cityCode) {
      // 清除特定城市的快取
      for (const key of this.cache.keys()) {
        if (key.includes(cityCode)) {
          this.cache.delete(key)
        }
      }
    } else {
      // 清除所有快取
      this.cache.clear()
    }
  }

  /**
   * 取得快取統計
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    }
  }
}

// ============================================================
// Singleton Export
// ============================================================

/**
 * DashboardStatisticsService 單例實例
 */
export const dashboardStatisticsService = DashboardStatisticsService.getInstance()
