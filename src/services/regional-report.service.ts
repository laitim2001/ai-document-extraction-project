/**
 * @fileoverview 區域報表服務
 * @description
 *   提供跨城市匯總報表功能：
 *   - 區域匯總數據獲取（各城市處理量、成功率、自動化率等）
 *   - 城市詳情報表（趨勢數據、Top Forwarders）
 *   - 支援快取以提升效能
 *   - 權限控制（僅區域經理和全局管理員）
 *
 * @module src/services/regional-report.service
 * @since Epic 7 - Story 7.5 (跨城市匯總報表)
 * @lastModified 2025-12-19
 *
 * @features
 *   - AC1: 區域報表頁面入口
 *   - AC2: 對比數據內容（城市名、處理量、成功率、自動化率、平均時間、AI成本）
 *   - AC3: 城市詳情展開（趨勢圖表、Top Forwarders）
 *   - AC4: 報表匯出
 *   - AC5: 權限控制（非區域經理重導向）
 *
 * @dependencies
 *   - @/lib/prisma - 資料庫客戶端
 *   - @/middleware/city-filter - 城市過濾
 *   - @/types/regional-report - 類型定義
 */

import { prisma } from '@/lib/prisma'
import { CityFilterContext } from '@/middleware/city-filter'
import {
  RegionalSummary,
  CitySummary,
  CityDetailReport,
  CityTrendData,
  TopForwarderData,
  TimeGranularity,
  REGIONAL_REPORT_CACHE_TTL,
  DEFAULT_TOP_FORWARDERS_LIMIT
} from '@/types/regional-report'

// ============================================================
// Types
// ============================================================

/**
 * 期間統計數據
 */
interface PeriodStats {
  volume: number
  successRate: number
  automationRate: number
  avgProcessingTime: number
  aiCost: number
  pendingReview: number
}

/**
 * 簡單的記憶體快取
 * 注意：生產環境應使用 Redis
 */
const memoryCache = new Map<string, { data: unknown; expiry: number }>()

// ============================================================
// RegionalReportService Class
// ============================================================

/**
 * 區域報表服務
 *
 * @description
 *   提供區域報表的完整功能：
 *   1. 區域匯總數據
 *   2. 城市詳情報表
 *   3. 趨勢數據
 *   4. Top Forwarders
 *
 * @example
 * ```typescript
 * const service = new RegionalReportService()
 *
 * // 獲取區域匯總
 * const summary = await service.getRegionalSummary(
 *   cityFilter,
 *   new Date('2025-01-01'),
 *   new Date('2025-01-31')
 * )
 *
 * // 獲取城市詳情
 * const detail = await service.getCityDetail(
 *   'HKG',
 *   new Date('2025-01-01'),
 *   new Date('2025-01-31'),
 *   'day'
 * )
 * ```
 */
export class RegionalReportService {
  /**
   * 獲取區域匯總報表
   *
   * @param cityFilter - 城市過濾上下文
   * @param startDate - 開始日期
   * @param endDate - 結束日期
   * @returns 區域匯總數據
   * @throws Error 如果用戶沒有區域經理權限
   */
  async getRegionalSummary(
    cityFilter: CityFilterContext,
    startDate: Date,
    endDate: Date
  ): Promise<RegionalSummary> {
    // 驗證權限
    if (!cityFilter.isGlobalAdmin && !cityFilter.isRegionalManager) {
      throw new Error('Access denied: Regional manager access required')
    }

    const cacheKey = this.buildCacheKey(
      'regional:summary',
      cityFilter,
      startDate,
      endDate
    )

    // 嘗試快取
    const cached = this.getFromCache<RegionalSummary>(cacheKey)
    if (cached) return cached

    // 獲取授權城市列表
    const cities = await prisma.city.findMany({
      where: cityFilter.isGlobalAdmin
        ? { status: 'ACTIVE' }
        : { code: { in: cityFilter.cityCodes }, status: 'ACTIVE' },
      include: {
        region: { select: { name: true } }
      }
    })

    // 並行查詢各城市數據
    const citySummaries = await Promise.all(
      cities.map(city =>
        this.getCitySummary(city.code, city.name, startDate, endDate, city.region?.name)
      )
    )

    // 計算區域匯總（使用加權平均）
    const totalVolume = citySummaries.reduce((sum, c) => sum + c.processingVolume, 0)

    const summary: RegionalSummary = {
      totalCities: cities.length,
      totalVolume,
      avgSuccessRate: this.calculateWeightedAverage(
        citySummaries.map(c => ({ value: c.successRate, weight: c.processingVolume }))
      ),
      avgAutomationRate: this.calculateWeightedAverage(
        citySummaries.map(c => ({ value: c.automationRate, weight: c.processingVolume }))
      ),
      totalAiCost: citySummaries.reduce((sum, c) => sum + c.aiCost, 0),
      cities: citySummaries.sort((a, b) => b.processingVolume - a.processingVolume)
    }

    this.setToCache(cacheKey, summary)
    return summary
  }

  /**
   * 獲取單一城市摘要
   */
  private async getCitySummary(
    cityCode: string,
    cityName: string,
    startDate: Date,
    endDate: Date,
    region?: string
  ): Promise<CitySummary> {
    const [current, previous] = await Promise.all([
      this.getPeriodStats(cityCode, startDate, endDate),
      this.getPreviousPeriodStats(cityCode, startDate, endDate)
    ])

    return {
      cityCode,
      cityName,
      region,
      processingVolume: current.volume,
      successRate: current.successRate,
      automationRate: current.automationRate,
      avgProcessingTime: current.avgProcessingTime,
      aiCost: current.aiCost,
      pendingReview: current.pendingReview,
      trend: {
        volumeChange: this.calculatePercentageChange(current.volume, previous.volume),
        successRateChange: Number((current.successRate - previous.successRate).toFixed(1)),
        costChange: this.calculatePercentageChange(current.aiCost, previous.aiCost)
      }
    }
  }

  /**
   * 獲取期間統計數據
   *
   * @description
   *   使用實際的 Prisma schema 欄位：
   *   - 處理量：基於 createdAt 在日期範圍內的文件
   *   - 成功率：COMPLETED 或 APPROVED 狀態
   *   - 自動化率：processingPath = AUTO_APPROVE
   *   - 處理時間：從 extractionResult.processingTime
   *   - AI 成本：目前未追蹤，返回 0
   */
  private async getPeriodStats(
    cityCode: string,
    startDate: Date,
    endDate: Date
  ): Promise<PeriodStats> {
    const [
      totalCount,
      successCount,
      autoApprovedCount,
      avgTimeResult,
      pendingCount
    ] = await Promise.all([
      // 總處理量（在日期範圍內建立的文件）
      prisma.document.count({
        where: {
          cityCode,
          createdAt: { gte: startDate, lte: endDate }
        }
      }),
      // 成功數量
      prisma.document.count({
        where: {
          cityCode,
          createdAt: { gte: startDate, lte: endDate },
          status: { in: ['COMPLETED', 'APPROVED'] }
        }
      }),
      // 自動處理數量（processingPath = AUTO_APPROVE）
      prisma.document.count({
        where: {
          cityCode,
          createdAt: { gte: startDate, lte: endDate },
          status: { in: ['COMPLETED', 'APPROVED'] },
          processingPath: 'AUTO_APPROVE'
        }
      }),
      // 平均處理時間（從 extractionResult.processingTime，單位 ms）
      prisma.extractionResult.aggregate({
        where: {
          document: {
            cityCode,
            createdAt: { gte: startDate, lte: endDate },
            status: { in: ['COMPLETED', 'APPROVED'] }
          },
          processingTime: { not: null }
        },
        _avg: { processingTime: true }
      }),
      // 待審核數量（當前待審核，不限日期）
      prisma.document.count({
        where: { cityCode, status: 'PENDING_REVIEW' }
      })
    ])

    const successRate = totalCount > 0 ? (successCount / totalCount) * 100 : 0
    const automationRate = successCount > 0 ? (autoApprovedCount / successCount) * 100 : 0
    // processingTime 是 ms，轉換為秒
    const avgProcessingTimeMs = avgTimeResult._avg.processingTime || 0
    const avgProcessingTimeSec = avgProcessingTimeMs / 1000

    return {
      volume: totalCount,
      successRate: Number(successRate.toFixed(1)),
      automationRate: Number(automationRate.toFixed(1)),
      avgProcessingTime: Number(avgProcessingTimeSec.toFixed(1)),
      aiCost: 0, // AI 成本追蹤功能待實現
      pendingReview: pendingCount
    }
  }

  /**
   * 獲取上一期間統計
   */
  private async getPreviousPeriodStats(
    cityCode: string,
    startDate: Date,
    endDate: Date
  ): Promise<PeriodStats> {
    const periodLength = endDate.getTime() - startDate.getTime()
    const prevStartDate = new Date(startDate.getTime() - periodLength)
    const prevEndDate = new Date(startDate.getTime() - 1)

    return this.getPeriodStats(cityCode, prevStartDate, prevEndDate)
  }

  /**
   * 獲取城市詳情
   *
   * @param cityCode - 城市代碼
   * @param startDate - 開始日期
   * @param endDate - 結束日期
   * @param granularity - 時間粒度
   * @returns 城市詳情報表
   */
  async getCityDetail(
    cityCode: string,
    startDate: Date,
    endDate: Date,
    granularity: TimeGranularity = 'day'
  ): Promise<CityDetailReport> {
    const city = await prisma.city.findUnique({
      where: { code: cityCode },
      select: { code: true, name: true }
    })

    if (!city) {
      throw new Error('City not found')
    }

    const [summary, trend, topForwarders] = await Promise.all([
      this.getCitySummary(city.code, city.name, startDate, endDate),
      this.getCityTrend(cityCode, startDate, endDate, granularity),
      this.getTopForwarders(cityCode, startDate, endDate)
    ])

    return {
      cityCode: city.code,
      cityName: city.name,
      summary,
      trend,
      topForwarders
    }
  }

  /**
   * 獲取城市趨勢數據
   *
   * @description
   *   使用 Prisma 聚合而非原生 SQL，以保持相容性。
   *   根據粒度生成日期分組的統計數據。
   */
  private async getCityTrend(
    cityCode: string,
    startDate: Date,
    endDate: Date,
    granularity: TimeGranularity
  ): Promise<CityTrendData[]> {
    // 獲取日期範圍內的所有文件
    const documents = await prisma.document.findMany({
      where: {
        cityCode,
        createdAt: { gte: startDate, lte: endDate }
      },
      select: {
        id: true,
        createdAt: true,
        status: true,
        processingPath: true
      },
      orderBy: { createdAt: 'asc' }
    })

    // 根據粒度分組
    const groupedData = new Map<string, {
      volume: number
      success: number
      autoApproved: number
    }>()

    for (const doc of documents) {
      const dateKey = this.formatDateKey(doc.createdAt, granularity)
      const existing = groupedData.get(dateKey) || { volume: 0, success: 0, autoApproved: 0 }

      existing.volume++
      if (['COMPLETED', 'APPROVED'].includes(doc.status)) {
        existing.success++
        if (doc.processingPath === 'AUTO_APPROVE') {
          existing.autoApproved++
        }
      }

      groupedData.set(dateKey, existing)
    }

    // 轉換為輸出格式
    const result: CityTrendData[] = []
    for (const [date, data] of groupedData) {
      result.push({
        date,
        volume: data.volume,
        successRate: data.volume > 0 ? Number(((data.success / data.volume) * 100).toFixed(1)) : 0,
        automationRate: data.success > 0 ? Number(((data.autoApproved / data.success) * 100).toFixed(1)) : 0,
        aiCost: 0 // AI 成本追蹤功能待實現
      })
    }

    return result.sort((a, b) => a.date.localeCompare(b.date))
  }

  /**
   * 格式化日期鍵
   */
  private formatDateKey(date: Date, granularity: TimeGranularity): string {
    const d = new Date(date)
    if (granularity === 'day') {
      return d.toISOString().slice(0, 10) // YYYY-MM-DD
    } else if (granularity === 'week') {
      // 獲取週一日期
      const day = d.getDay()
      const diff = d.getDate() - day + (day === 0 ? -6 : 1)
      const monday = new Date(d.setDate(diff))
      const year = monday.getFullYear()
      const week = this.getWeekNumber(monday)
      return `${year}-W${week.toString().padStart(2, '0')}`
    } else {
      return d.toISOString().slice(0, 7) // YYYY-MM
    }
  }

  /**
   * 獲取週數
   */
  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  }

  /**
   * 獲取 Top Forwarders
   */
  private async getTopForwarders(
    cityCode: string,
    startDate: Date,
    endDate: Date,
    limit: number = DEFAULT_TOP_FORWARDERS_LIMIT
  ): Promise<TopForwarderData[]> {
    const result = await prisma.document.groupBy({
      by: ['forwarderId'],
      where: {
        cityCode,
        createdAt: { gte: startDate, lte: endDate },
        forwarderId: { not: null }
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit
    })

    if (result.length === 0) return []

    const forwarderIds = result
      .map(r => r.forwarderId)
      .filter((id): id is string => id !== null)

    const forwarders = await prisma.forwarder.findMany({
      where: { id: { in: forwarderIds } },
      select: { id: true, code: true, name: true }
    })

    // 獲取成功率
    const successRates = await Promise.all(
      forwarderIds.map(async (forwarderId) => {
        const [total, success] = await Promise.all([
          prisma.document.count({
            where: { cityCode, forwarderId, createdAt: { gte: startDate, lte: endDate } }
          }),
          prisma.document.count({
            where: {
              cityCode,
              forwarderId,
              createdAt: { gte: startDate, lte: endDate },
              status: { in: ['COMPLETED', 'APPROVED'] }
            }
          })
        ])
        return { forwarderId, rate: total > 0 ? (success / total) * 100 : 0 }
      })
    )

    return result.map(r => {
      const forwarder = forwarders.find(f => f.id === r.forwarderId)
      const rateData = successRates.find(s => s.forwarderId === r.forwarderId)
      return {
        code: forwarder?.code || '',
        name: forwarder?.name || '',
        volume: r._count.id,
        successRate: Number((rateData?.rate || 0).toFixed(1))
      }
    })
  }

  /**
   * 計算加權平均
   */
  private calculateWeightedAverage(
    items: { value: number; weight: number }[]
  ): number {
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0)
    if (totalWeight === 0) return 0

    const weightedSum = items.reduce(
      (sum, item) => sum + item.value * item.weight,
      0
    )
    return Number((weightedSum / totalWeight).toFixed(1))
  }

  /**
   * 計算百分比變化
   */
  private calculatePercentageChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0
    return Number((((current - previous) / previous) * 100).toFixed(1))
  }

  // ============================================================
  // 快取工具方法（簡單記憶體快取）
  // ============================================================

  /**
   * 建構快取鍵
   */
  private buildCacheKey(
    prefix: string,
    cityFilter: CityFilterContext,
    startDate: Date,
    endDate: Date
  ): string {
    const cityPart = cityFilter.isGlobalAdmin
      ? 'all'
      : cityFilter.cityCodes.sort().join(',')
    return `${prefix}:${cityPart}:${startDate.toISOString()}:${endDate.toISOString()}`
  }

  /**
   * 從快取獲取
   */
  private getFromCache<T>(key: string): T | null {
    const cached = memoryCache.get(key)
    if (!cached) return null
    if (Date.now() > cached.expiry) {
      memoryCache.delete(key)
      return null
    }
    return cached.data as T
  }

  /**
   * 設置快取
   */
  private setToCache(key: string, data: unknown): void {
    memoryCache.set(key, {
      data,
      expiry: Date.now() + REGIONAL_REPORT_CACHE_TTL * 1000
    })
  }

  // ============================================================
  // 匯出功能
  // ============================================================

  /**
   * 匯出區域報表到 Excel
   *
   * @param cityFilter - 城市過濾上下文
   * @param startDate - 開始日期
   * @param endDate - 結束日期
   * @param options - 匯出選項
   * @returns Excel Buffer
   */
  async exportToExcel(
    cityFilter: CityFilterContext,
    startDate: Date,
    endDate: Date,
    options: {
      includeTrend?: boolean
      includeForwarders?: boolean
    } = {}
  ): Promise<Buffer> {
    const summary = await this.getRegionalSummary(cityFilter, startDate, endDate)

    // 動態導入 ExcelJS
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.default.Workbook()

    // 建立匯總工作表
    const summarySheet = workbook.addWorksheet('區域匯總')
    this.buildSummarySheet(summarySheet, summary, startDate, endDate)

    // 建立城市對比工作表
    const citiesSheet = workbook.addWorksheet('城市對比')
    this.buildCitiesSheet(citiesSheet, summary.cities)

    // 如果需要趨勢數據，為每個城市建立詳情工作表
    if (options.includeTrend || options.includeForwarders) {
      for (const city of summary.cities.slice(0, 10)) { // 限制最多 10 個城市
        const detail = await this.getCityDetail(
          city.cityCode,
          startDate,
          endDate,
          'day'
        )
        const detailSheet = workbook.addWorksheet(`${city.cityCode} 詳情`)
        this.buildCityDetailSheet(detailSheet, detail, options)
      }
    }

    return Buffer.from(await workbook.xlsx.writeBuffer())
  }

  /**
   * 建立匯總工作表
   */
  private buildSummarySheet(
    sheet: import('exceljs').Worksheet,
    summary: RegionalSummary,
    startDate: Date,
    endDate: Date
  ): void {
    // 標題
    sheet.addRow(['區域匯總報表'])
    sheet.mergeCells('A1:D1')
    sheet.getCell('A1').font = { bold: true, size: 14 }

    // 日期範圍
    sheet.addRow(['報表期間', `${startDate.toISOString().split('T')[0]} 至 ${endDate.toISOString().split('T')[0]}`])
    sheet.addRow([])

    // 匯總數據
    sheet.addRow(['城市總數', summary.totalCities])
    sheet.addRow(['總處理量', summary.totalVolume])
    sheet.addRow(['平均成功率', `${summary.avgSuccessRate.toFixed(1)}%`])
    sheet.addRow(['平均自動化率', `${summary.avgAutomationRate.toFixed(1)}%`])
    sheet.addRow(['總 AI 成本', `$${summary.totalAiCost.toFixed(2)}`])

    // 設置欄寬
    sheet.getColumn(1).width = 20
    sheet.getColumn(2).width = 30
  }

  /**
   * 建立城市對比工作表
   */
  private buildCitiesSheet(
    sheet: import('exceljs').Worksheet,
    cities: CitySummary[]
  ): void {
    // 表頭
    const headers = ['城市代碼', '城市名稱', '區域', '處理量', '成功率', '自動化率', '平均時間(秒)', 'AI 成本', '待審核', '處理量變化', '成功率變化', '成本變化']
    sheet.addRow(headers)

    // 設置表頭樣式
    const headerRow = sheet.getRow(1)
    headerRow.font = { bold: true }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    }

    // 數據行
    for (const city of cities) {
      sheet.addRow([
        city.cityCode,
        city.cityName,
        city.region || '',
        city.processingVolume,
        `${city.successRate.toFixed(1)}%`,
        `${city.automationRate.toFixed(1)}%`,
        city.avgProcessingTime.toFixed(1),
        `$${city.aiCost.toFixed(2)}`,
        city.pendingReview,
        `${city.trend.volumeChange >= 0 ? '+' : ''}${city.trend.volumeChange.toFixed(1)}%`,
        `${city.trend.successRateChange >= 0 ? '+' : ''}${city.trend.successRateChange.toFixed(1)}%`,
        `${city.trend.costChange >= 0 ? '+' : ''}${city.trend.costChange.toFixed(1)}%`
      ])
    }

    // 設置欄寬
    sheet.getColumn(1).width = 12
    sheet.getColumn(2).width = 20
    sheet.getColumn(3).width = 15
    sheet.getColumn(4).width = 12
    sheet.getColumn(5).width = 10
    sheet.getColumn(6).width = 10
    sheet.getColumn(7).width = 14
    sheet.getColumn(8).width = 12
    sheet.getColumn(9).width = 10
    sheet.getColumn(10).width = 12
    sheet.getColumn(11).width = 12
    sheet.getColumn(12).width = 12
  }

  /**
   * 建立城市詳情工作表
   */
  private buildCityDetailSheet(
    sheet: import('exceljs').Worksheet,
    detail: CityDetailReport,
    options: { includeTrend?: boolean; includeForwarders?: boolean }
  ): void {
    let currentRow = 1

    // 城市標題
    sheet.addRow([`${detail.cityName} (${detail.cityCode}) 詳情`])
    sheet.mergeCells(`A${currentRow}:D${currentRow}`)
    sheet.getCell(`A${currentRow}`).font = { bold: true, size: 14 }
    currentRow++

    // 趨勢數據
    if (options.includeTrend && detail.trend.length > 0) {
      sheet.addRow([])
      currentRow++
      sheet.addRow(['處理趨勢'])
      sheet.getRow(currentRow).font = { bold: true }
      currentRow++

      // 趨勢表頭
      sheet.addRow(['日期', '處理量', '成功率', '自動化率', 'AI 成本'])
      const trendHeaderRow = sheet.getRow(currentRow)
      trendHeaderRow.font = { bold: true }
      trendHeaderRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      }
      currentRow++

      // 趨勢數據
      for (const item of detail.trend) {
        sheet.addRow([
          item.date,
          item.volume,
          `${item.successRate.toFixed(1)}%`,
          `${item.automationRate.toFixed(1)}%`,
          `$${item.aiCost.toFixed(2)}`
        ])
        currentRow++
      }
    }

    // Top Forwarders
    if (options.includeForwarders && detail.topForwarders.length > 0) {
      sheet.addRow([])
      currentRow++
      sheet.addRow(['Top Forwarders'])
      sheet.getRow(currentRow).font = { bold: true }
      currentRow++

      // Forwarder 表頭
      sheet.addRow(['排名', '代碼', '名稱', '處理量', '成功率'])
      const forwarderHeaderRow = sheet.getRow(currentRow)
      forwarderHeaderRow.font = { bold: true }
      forwarderHeaderRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      }
      currentRow++

      // Forwarder 數據
      detail.topForwarders.forEach((forwarder, index) => {
        sheet.addRow([
          index + 1,
          forwarder.code,
          forwarder.name,
          forwarder.volume,
          `${forwarder.successRate.toFixed(1)}%`
        ])
        currentRow++
      })
    }

    // 設置欄寬
    sheet.getColumn(1).width = 12
    sheet.getColumn(2).width = 15
    sheet.getColumn(3).width = 25
    sheet.getColumn(4).width = 12
    sheet.getColumn(5).width = 12
  }
}

// ============================================================
// Export Singleton Instance
// ============================================================

/**
 * 區域報表服務實例
 */
export const regionalReportService = new RegionalReportService()
