/**
 * @fileoverview 規則準確率服務
 * @description
 *   負責計算和監控規則的準確率指標。
 *   支援 Story 4-8 的自動回滾功能，提供準確率計算、歷史趨勢和下降檢測功能。
 *
 * @module src/services/rule-accuracy
 * @since Epic 4 - Story 4.8
 * @lastModified 2025-12-19
 *
 * @features
 *   - 計算指定規則版本的準確率
 *   - 獲取規則的歷史準確率趨勢
 *   - 檢查準確率是否下降超過閾值
 *   - 記錄和更新規則應用結果
 *
 * @dependencies
 *   - @/lib/prisma - Prisma 客戶端
 *   - @/types/accuracy - 準確率相關類型
 *
 * @related
 *   - src/services/auto-rollback.ts - 自動回滾服務
 *   - prisma/schema.prisma - RuleApplication 模型
 */

import { prisma } from '@/lib/prisma'
import type {
  AccuracyMetrics,
  AccuracyDropResult,
  AccuracyMonitorConfig,
} from '@/types/accuracy'

// ============================================================
// Constants
// ============================================================

/**
 * 預設監控配置
 */
const DEFAULT_CONFIG: AccuracyMonitorConfig = {
  dropThreshold: 0.10,      // 10% 下降閾值
  minSampleSize: 10,        // 最少 10 個樣本
  timeWindowHours: 24,      // 24 小時時間窗口
  cooldownMinutes: 60,      // 60 分鐘冷卻時間
}

// ============================================================
// Service Class
// ============================================================

/**
 * 規則準確率服務
 * 負責計算和監控規則的準確率指標
 */
export class RuleAccuracyService {
  private config: AccuracyMonitorConfig

  constructor(config: Partial<AccuracyMonitorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * 計算指定規則版本的準確率
   *
   * @description 查詢指定時間窗口內的規則應用記錄，計算準確率指標
   * @param ruleId - 規則 ID
   * @param version - 規則版本號
   * @param timeWindowHours - 時間窗口（小時），預設使用配置值
   * @returns 準確率指標
   */
  async calculateAccuracy(
    ruleId: string,
    version: number,
    timeWindowHours?: number
  ): Promise<AccuracyMetrics> {
    const windowHours = timeWindowHours ?? this.config.timeWindowHours
    const cutoffTime = new Date(Date.now() - windowHours * 60 * 60 * 1000)

    // 查詢該版本在時間窗口內的所有應用記錄
    const applications = await prisma.ruleApplication.findMany({
      where: {
        ruleId,
        ruleVersion: version,
        createdAt: { gte: cutoffTime },
      },
      select: {
        isAccurate: true,
      },
    })

    const total = applications.length
    const verified = applications.filter((a) => a.isAccurate !== null)
    const accurate = verified.filter((a) => a.isAccurate === true).length
    const inaccurate = verified.filter((a) => a.isAccurate === false).length
    const unverified = total - verified.length
    const sampleSize = verified.length

    return {
      total,
      accurate,
      inaccurate,
      unverified,
      accuracy: sampleSize >= this.config.minSampleSize
        ? accurate / sampleSize
        : null,
      sampleSize,
    }
  }

  /**
   * 獲取規則的歷史準確率趨勢
   *
   * @description 獲取過去多個時間段的準確率數據，用於趨勢分析
   * @param ruleId - 規則 ID
   * @param periods - 時間段數量（天），預設 7 天
   * @returns 歷史準確率數據陣列
   */
  async getHistoricalAccuracy(
    ruleId: string,
    periods: number = 7
  ): Promise<Array<{ period: string; accuracy: number | null; sampleSize: number }>> {
    const results: Array<{ period: string; accuracy: number | null; sampleSize: number }> = []
    const now = new Date()

    for (let i = 0; i < periods; i++) {
      const endTime = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000)

      const applications = await prisma.ruleApplication.findMany({
        where: {
          ruleId,
          isAccurate: { not: null },
          createdAt: {
            gte: startTime,
            lt: endTime,
          },
        },
        select: {
          isAccurate: true,
        },
      })

      const sampleSize = applications.length
      const accurate = applications.filter((a) => a.isAccurate).length

      results.push({
        period: startTime.toISOString().split('T')[0],
        accuracy: sampleSize >= this.config.minSampleSize
          ? accurate / sampleSize
          : null,
        sampleSize,
      })
    }

    return results.reverse()
  }

  /**
   * 檢查準確率是否下降
   *
   * @description 比較當前版本與上一版本的準確率，判斷是否需要觸發回滾
   * @param ruleId - 規則 ID
   * @returns 準確率下降結果，如果不需要回滾則返回 null
   */
  async checkAccuracyDrop(ruleId: string): Promise<AccuracyDropResult | null> {
    // 獲取規則資訊
    const rule = await prisma.mappingRule.findUnique({
      where: { id: ruleId },
      select: {
        id: true,
        fieldName: true,
        fieldLabel: true,
        version: true,
      },
    })

    if (!rule) {
      console.warn(`Rule ${ruleId} not found`)
      return null
    }

    // 版本 1 無法比較
    if (rule.version <= 1) {
      return null
    }

    // 檢查是否在冷卻期內（最近已回滾過）
    const recentRollback = await prisma.rollbackLog.findFirst({
      where: {
        ruleId,
        trigger: 'AUTO',
        createdAt: {
          gte: new Date(Date.now() - this.config.cooldownMinutes * 60 * 1000),
        },
      },
    })

    if (recentRollback) {
      console.log(`Rule ${ruleId} is in cooldown period, skipping`)
      return null
    }

    // 計算當前版本準確率
    const currentMetrics = await this.calculateAccuracy(ruleId, rule.version)

    // 計算上一版本準確率
    const previousMetrics = await this.calculateAccuracy(ruleId, rule.version - 1)

    // 如果任一版本數據不足，無法比較
    if (currentMetrics.accuracy === null || previousMetrics.accuracy === null) {
      console.log(`Insufficient data for rule ${ruleId} accuracy comparison`)
      return null
    }

    // 計算下降幅度
    const drop = previousMetrics.accuracy - currentMetrics.accuracy
    const dropPercentage = drop * 100

    const result: AccuracyDropResult = {
      ruleId,
      ruleName: rule.fieldLabel || rule.fieldName,
      fieldName: rule.fieldName,
      currentVersion: rule.version,
      previousVersion: rule.version - 1,
      currentAccuracy: currentMetrics.accuracy,
      previousAccuracy: previousMetrics.accuracy,
      drop,
      dropPercentage,
      shouldRollback: drop > this.config.dropThreshold,
      sampleSizes: {
        current: currentMetrics.sampleSize,
        previous: previousMetrics.sampleSize,
      },
    }

    if (result.shouldRollback) {
      console.log(
        `Rule ${ruleId} accuracy dropped by ${dropPercentage.toFixed(1)}% ` +
        `(${(previousMetrics.accuracy * 100).toFixed(1)}% → ${(currentMetrics.accuracy * 100).toFixed(1)}%), ` +
        `triggering rollback`
      )
    }

    return result
  }

  /**
   * 記錄規則應用結果
   *
   * @description 在規則應用時創建記錄，供後續準確率計算使用
   * @param data - 應用記錄數據
   */
  async recordApplication(data: {
    ruleId: string
    ruleVersion: number
    documentId: string
    fieldName: string
    extractedValue: string | null
  }): Promise<void> {
    await prisma.ruleApplication.create({
      data: {
        ruleId: data.ruleId,
        ruleVersion: data.ruleVersion,
        documentId: data.documentId,
        fieldName: data.fieldName,
        extractedValue: data.extractedValue,
        isAccurate: null, // 初始為未驗證
      },
    })
  }

  /**
   * 更新應用記錄的準確性
   *
   * @description 用戶驗證後更新應用記錄的準確性標記
   * @param applicationId - 應用記錄 ID
   * @param isAccurate - 是否準確
   * @param verifiedBy - 驗證者用戶 ID
   */
  async updateApplicationAccuracy(
    applicationId: string,
    isAccurate: boolean,
    verifiedBy: string
  ): Promise<void> {
    await prisma.ruleApplication.update({
      where: { id: applicationId },
      data: {
        isAccurate,
        verifiedBy,
        verifiedAt: new Date(),
      },
    })
  }

  /**
   * 批量更新應用記錄的準確性
   *
   * @description 用於審核完成時批量更新多個欄位的準確性
   * @param updates - 更新資料陣列
   * @param verifiedBy - 驗證者用戶 ID
   */
  async batchUpdateAccuracy(
    updates: Array<{ applicationId: string; isAccurate: boolean }>,
    verifiedBy: string
  ): Promise<void> {
    await prisma.$transaction(
      updates.map((update) =>
        prisma.ruleApplication.update({
          where: { id: update.applicationId },
          data: {
            isAccurate: update.isAccurate,
            verifiedBy,
            verifiedAt: new Date(),
          },
        })
      )
    )
  }

  /**
   * 獲取指定規則的所有版本準確率摘要
   *
   * @description 獲取規則各版本的準確率統計，用於版本比較
   * @param ruleId - 規則 ID
   * @returns 各版本的準確率摘要
   */
  async getVersionAccuracySummary(ruleId: string): Promise<
    Array<{
      version: number
      metrics: AccuracyMetrics
    }>
  > {
    const rule = await prisma.mappingRule.findUnique({
      where: { id: ruleId },
      select: { version: true },
    })

    if (!rule) {
      return []
    }

    const results: Array<{ version: number; metrics: AccuracyMetrics }> = []

    for (let v = 1; v <= rule.version; v++) {
      const metrics = await this.calculateAccuracy(ruleId, v)
      results.push({ version: v, metrics })
    }

    return results
  }
}

// ============================================================
// Singleton Export
// ============================================================

/**
 * 規則準確率服務單例
 */
export const ruleAccuracyService = new RuleAccuracyService()
