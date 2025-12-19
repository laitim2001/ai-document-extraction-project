/**
 * @fileoverview 自動回滾服務
 * @description
 *   負責檢測準確率下降並執行自動回滾。
 *   當規則準確率下降超過閾值時，自動回滾到上一個穩定版本並發送告警通知。
 *
 * @module src/services/auto-rollback
 * @since Epic 4 - Story 4.8
 * @lastModified 2025-12-19
 *
 * @features
 *   - 檢查並自動執行回滾
 *   - 事務性回滾操作
 *   - 發送告警通知給 Super User
 *   - 獲取回滾歷史記錄
 *
 * @dependencies
 *   - @/lib/prisma - Prisma 客戶端
 *   - @/services/rule-accuracy - 準確率計算服務
 *   - @/services/notification.service - 通知服務
 *   - @/types/accuracy - 準確率相關類型
 *
 * @related
 *   - src/services/rule-accuracy.ts - 準確率計算服務
 *   - prisma/schema.prisma - RollbackLog, MappingRule, RuleVersion 模型
 */

import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { RuleAccuracyService } from './rule-accuracy'
import { notifySuperUsers } from './notification.service'
import type {
  RollbackResult,
  AccuracyDropResult,
  RollbackTrigger,
  RollbackHistoryItem,
  RollbackHistoryResponse,
  RollbackHistoryQueryOptions,
} from '@/types/accuracy'

// ============================================================
// Constants
// ============================================================

/**
 * 自動回滾通知類型
 */
export const ROLLBACK_NOTIFICATION_TYPE = 'RULE_AUTO_ROLLBACK'

// ============================================================
// Service Class
// ============================================================

/**
 * 自動回滾服務
 * 負責檢測準確率下降並執行自動回滾
 */
export class AutoRollbackService {
  private accuracyService: RuleAccuracyService

  constructor() {
    this.accuracyService = new RuleAccuracyService()
  }

  /**
   * 檢查並執行回滾（如需要）
   *
   * @description 檢查指定規則的準確率，如果下降超過閾值則執行回滾
   * @param ruleId - 規則 ID
   * @returns 回滾結果，如果不需要回滾則返回 null
   */
  async checkAndRollback(ruleId: string): Promise<RollbackResult | null> {
    // 檢查準確率是否下降
    const dropResult = await this.accuracyService.checkAccuracyDrop(ruleId)

    if (!dropResult?.shouldRollback) {
      return null
    }

    // 執行回滾
    const result = await this.executeRollback(ruleId, dropResult, 'AUTO')

    // 發送告警通知
    await this.sendAlerts(result, dropResult)

    return result
  }

  /**
   * 執行回滾操作
   *
   * @description 將規則回滾到上一個版本，使用事務確保數據一致性
   * @param ruleId - 規則 ID
   * @param dropResult - 準確率下降檢測結果
   * @param trigger - 觸發類型
   * @returns 回滾結果
   */
  async executeRollback(
    ruleId: string,
    dropResult: AccuracyDropResult,
    trigger: RollbackTrigger
  ): Promise<RollbackResult> {
    const rule = await prisma.mappingRule.findUnique({
      where: { id: ruleId },
      select: {
        id: true,
        fieldName: true,
        fieldLabel: true,
        version: true,
        extractionPattern: true,
        confidence: true,
        priority: true,
      },
    })

    if (!rule) {
      throw new Error(`Rule ${ruleId} not found`)
    }

    // 獲取上一個穩定版本
    const previousVersion = await prisma.ruleVersion.findFirst({
      where: {
        ruleId,
        version: rule.version - 1,
      },
    })

    if (!previousVersion) {
      throw new Error(`Previous version not found for rule ${ruleId}`)
    }

    // 生成回滾原因
    const reason = this.generateRollbackReason(trigger, dropResult)

    // 執行回滾事務
    const result = await prisma.$transaction(async (tx) => {
      const newVersionNumber = rule.version + 1

      // 1. 更新規則為上一版本的內容
      await tx.mappingRule.update({
        where: { id: ruleId },
        data: {
          extractionPattern: previousVersion.extractionPattern as Prisma.InputJsonValue,
          confidence: previousVersion.confidence,
          priority: previousVersion.priority,
          version: newVersionNumber,
          updatedAt: new Date(),
        },
      })

      // 2. 創建新版本記錄（回滾版本）
      await tx.ruleVersion.create({
        data: {
          ruleId,
          version: newVersionNumber,
          extractionPattern: previousVersion.extractionPattern as Prisma.InputJsonValue,
          confidence: previousVersion.confidence,
          priority: previousVersion.priority,
          changeReason: reason,
          createdBy: 'SYSTEM', // 系統自動回滾
        },
      })

      // 3. 創建回滾日誌
      const log = await tx.rollbackLog.create({
        data: {
          ruleId,
          fromVersion: rule.version,
          toVersion: previousVersion.version,
          trigger,
          reason,
          accuracyBefore: dropResult.currentAccuracy,
          accuracyAfter: dropResult.previousAccuracy,
          metadata: {
            dropPercentage: dropResult.dropPercentage,
            sampleSizes: dropResult.sampleSizes,
            timestamp: new Date().toISOString(),
          },
        },
      })

      return {
        newVersion: newVersionNumber,
        logId: log.id,
      }
    })

    console.log(
      `[AutoRollback] Rule ${ruleId} rolled back from v${rule.version} to v${previousVersion.version} ` +
      `(new version: v${result.newVersion})`
    )

    return {
      success: true,
      ruleId,
      ruleName: rule.fieldLabel || rule.fieldName,
      fromVersion: rule.version,
      toVersion: previousVersion.version,
      newVersion: result.newVersion,
      logId: result.logId,
      triggeredBy: trigger,
      reason,
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * 手動執行回滾
   *
   * @description 手動將規則回滾到指定版本
   * @param ruleId - 規則 ID
   * @param targetVersion - 目標版本號
   * @param userId - 執行者用戶 ID
   * @returns 回滾結果
   */
  async manualRollback(
    ruleId: string,
    targetVersion: number,
    userId: string
  ): Promise<RollbackResult> {
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
      throw new Error(`Rule ${ruleId} not found`)
    }

    if (targetVersion >= rule.version) {
      throw new Error(`Target version must be less than current version (${rule.version})`)
    }

    // 獲取目標版本
    const targetVersionRecord = await prisma.ruleVersion.findFirst({
      where: {
        ruleId,
        version: targetVersion,
      },
    })

    if (!targetVersionRecord) {
      throw new Error(`Version ${targetVersion} not found for rule ${ruleId}`)
    }

    // 創建模擬的 drop result
    const mockDropResult: AccuracyDropResult = {
      ruleId,
      ruleName: rule.fieldLabel || rule.fieldName,
      fieldName: rule.fieldName,
      currentVersion: rule.version,
      previousVersion: targetVersion,
      currentAccuracy: 0,
      previousAccuracy: 0,
      drop: 0,
      dropPercentage: 0,
      shouldRollback: true,
      sampleSizes: { current: 0, previous: 0 },
    }

    // 獲取準確率數據（用於記錄）
    const currentMetrics = await this.accuracyService.calculateAccuracy(ruleId, rule.version)
    const targetMetrics = await this.accuracyService.calculateAccuracy(ruleId, targetVersion)

    if (currentMetrics.accuracy !== null) {
      mockDropResult.currentAccuracy = currentMetrics.accuracy
      mockDropResult.sampleSizes.current = currentMetrics.sampleSize
    }
    if (targetMetrics.accuracy !== null) {
      mockDropResult.previousAccuracy = targetMetrics.accuracy
      mockDropResult.sampleSizes.previous = targetMetrics.sampleSize
    }

    const reason = `手動回滾至版本 ${targetVersion}（由用戶 ${userId} 執行）`

    // 執行回滾事務
    const result = await prisma.$transaction(async (tx) => {
      const newVersionNumber = rule.version + 1

      // 1. 更新規則為目標版本的內容
      await tx.mappingRule.update({
        where: { id: ruleId },
        data: {
          extractionPattern: targetVersionRecord.extractionPattern as Prisma.InputJsonValue,
          confidence: targetVersionRecord.confidence,
          priority: targetVersionRecord.priority,
          version: newVersionNumber,
          updatedAt: new Date(),
        },
      })

      // 2. 創建新版本記錄（回滾版本）
      await tx.ruleVersion.create({
        data: {
          ruleId,
          version: newVersionNumber,
          extractionPattern: targetVersionRecord.extractionPattern as Prisma.InputJsonValue,
          confidence: targetVersionRecord.confidence,
          priority: targetVersionRecord.priority,
          changeReason: reason,
          createdBy: userId,
        },
      })

      // 3. 創建回滾日誌
      const log = await tx.rollbackLog.create({
        data: {
          ruleId,
          fromVersion: rule.version,
          toVersion: targetVersion,
          trigger: 'MANUAL',
          reason,
          accuracyBefore: mockDropResult.currentAccuracy,
          accuracyAfter: mockDropResult.previousAccuracy,
          metadata: {
            executedBy: userId,
            timestamp: new Date().toISOString(),
          },
        },
      })

      return {
        newVersion: newVersionNumber,
        logId: log.id,
      }
    })

    return {
      success: true,
      ruleId,
      ruleName: rule.fieldLabel || rule.fieldName,
      fromVersion: rule.version,
      toVersion: targetVersion,
      newVersion: result.newVersion,
      logId: result.logId,
      triggeredBy: 'MANUAL',
      reason,
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * 生成回滾原因說明
   *
   * @description 根據觸發類型和準確率數據生成人類可讀的回滾原因
   */
  private generateRollbackReason(
    trigger: RollbackTrigger,
    dropResult: AccuracyDropResult
  ): string {
    switch (trigger) {
      case 'AUTO':
        return (
          `自動回滾：準確率從 ${(dropResult.previousAccuracy * 100).toFixed(1)}% ` +
          `下降至 ${(dropResult.currentAccuracy * 100).toFixed(1)}% ` +
          `（下降 ${dropResult.dropPercentage.toFixed(1)}%，超過 10% 閾值）`
        )
      case 'MANUAL':
        return `手動回滾至版本 ${dropResult.previousVersion}`
      case 'EMERGENCY':
        return '緊急回滾：系統檢測到嚴重問題'
      default:
        return '回滾原因未知'
    }
  }

  /**
   * 發送告警通知給所有 Super User
   *
   * @description 通知所有具有規則管理權限的用戶關於自動回滾事件
   */
  private async sendAlerts(
    result: RollbackResult,
    dropResult: AccuracyDropResult
  ): Promise<void> {
    const message = this.generateAlertMessage(result, dropResult)

    await notifySuperUsers({
      type: ROLLBACK_NOTIFICATION_TYPE,
      title: '規則自動回滾告警',
      message,
      data: {
        ruleId: result.ruleId,
        ruleName: result.ruleName,
        fromVersion: result.fromVersion,
        toVersion: result.toVersion,
        newVersion: result.newVersion,
        logId: result.logId,
        accuracyBefore: dropResult.currentAccuracy,
        accuracyAfter: dropResult.previousAccuracy,
        dropPercentage: dropResult.dropPercentage,
        priority: 'HIGH',
      },
    })

    console.log(`[AutoRollback] Alert sent for rule ${result.ruleId}`)
  }

  /**
   * 生成告警訊息
   *
   * @description 生成詳細的告警訊息內容
   */
  private generateAlertMessage(
    result: RollbackResult,
    dropResult: AccuracyDropResult
  ): string {
    return (
      `規則「${result.ruleName}」（欄位：${dropResult.fieldName}）因準確率下降已自動回滾。\n\n` +
      `詳情：\n` +
      `- 原版本：v${result.fromVersion}\n` +
      `- 回滾至：v${result.toVersion}（新版本號：v${result.newVersion}）\n` +
      `- 準確率變化：${(dropResult.previousAccuracy * 100).toFixed(1)}% → ${(dropResult.currentAccuracy * 100).toFixed(1)}%\n` +
      `- 下降幅度：${dropResult.dropPercentage.toFixed(1)}%\n\n` +
      `請檢查該規則的設定並評估是否需要進一步調整。`
    )
  }

  /**
   * 獲取回滾歷史
   *
   * @description 獲取分頁的回滾歷史記錄
   * @param options - 查詢選項
   * @returns 分頁的回滾歷史響應
   */
  async getRollbackHistory(
    options: RollbackHistoryQueryOptions = {}
  ): Promise<RollbackHistoryResponse> {
    const { ruleId, trigger, page = 1, pageSize = 20 } = options

    const where: Record<string, unknown> = {}
    if (ruleId) where.ruleId = ruleId
    if (trigger) where.trigger = trigger

    const [items, total] = await Promise.all([
      prisma.rollbackLog.findMany({
        where,
        include: {
          rule: {
            select: {
              fieldName: true,
              fieldLabel: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.rollbackLog.count({ where }),
    ])

    const historyItems: RollbackHistoryItem[] = items.map((item) => ({
      id: item.id,
      ruleId: item.ruleId,
      ruleName: item.rule.fieldLabel || item.rule.fieldName,
      fieldName: item.rule.fieldName,
      fromVersion: item.fromVersion,
      toVersion: item.toVersion,
      trigger: item.trigger as RollbackTrigger,
      reason: item.reason,
      accuracyBefore: item.accuracyBefore,
      accuracyAfter: item.accuracyAfter,
      createdAt: item.createdAt.toISOString(),
    }))

    return {
      items: historyItems,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }
  }

  /**
   * 獲取指定規則的回滾統計
   *
   * @description 獲取規則的回滾次數統計
   * @param ruleId - 規則 ID
   * @returns 回滾統計
   */
  async getRollbackStats(ruleId: string): Promise<{
    totalRollbacks: number
    autoRollbacks: number
    manualRollbacks: number
    emergencyRollbacks: number
    lastRollbackAt: string | null
  }> {
    const [total, auto, manual, emergency, lastRollback] = await Promise.all([
      prisma.rollbackLog.count({ where: { ruleId } }),
      prisma.rollbackLog.count({ where: { ruleId, trigger: 'AUTO' } }),
      prisma.rollbackLog.count({ where: { ruleId, trigger: 'MANUAL' } }),
      prisma.rollbackLog.count({ where: { ruleId, trigger: 'EMERGENCY' } }),
      prisma.rollbackLog.findFirst({
        where: { ruleId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ])

    return {
      totalRollbacks: total,
      autoRollbacks: auto,
      manualRollbacks: manual,
      emergencyRollbacks: emergency,
      lastRollbackAt: lastRollback?.createdAt.toISOString() ?? null,
    }
  }
}

// ============================================================
// Singleton Export
// ============================================================

/**
 * 自動回滾服務單例
 */
export const autoRollbackService = new AutoRollbackService()
