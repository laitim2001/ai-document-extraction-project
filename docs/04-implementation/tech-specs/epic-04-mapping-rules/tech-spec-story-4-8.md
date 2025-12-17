# Tech Spec: Story 4-8 規則自動回滾

## 1. Overview

### 1.1 Story Reference
- **Story ID**: 4.8
- **Epic**: Epic 4 - 映射規則管理與自動學習
- **Title**: 規則自動回滾
- **Status**: Ready for Dev

### 1.2 Summary
實作規則自動回滾機制，透過定時監控規則準確率，當檢測到新規則導致準確率下降超過 10% 時，系統自動觸發回滾至上一個穩定版本，並發送告警通知給 Super User。此機制確保系統能自我保護，避免錯誤規則對生產環境造成持續影響。

### 1.3 Acceptance Criteria Overview
| AC ID | Description | Priority |
|-------|-------------|----------|
| AC1 | 準確率監控 - 每小時計算規則應用後的準確率 | Must Have |
| AC2 | 自動回滾觸發 - 準確率下降超過 10% 時自動回滾 | Must Have |
| AC3 | 告警通知 - 發送告警給 Super User，記錄回滾原因和時間 | Must Have |

---

## 2. Technical Design

### 2.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Auto-Rollback System                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     CronJob (Hourly @ 0 * * * *)                     │    │
│  │                     ruleAccuracyMonitorJob                           │    │
│  └──────────────────────────────┬──────────────────────────────────────┘    │
│                                 │                                            │
│                                 ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     RuleAccuracyService                              │    │
│  │  ┌────────────────┐  ┌────────────────┐  ┌─────────────────────┐   │    │
│  │  │calculateAccuracy│  │getHistorical   │  │checkAccuracyDrop    │   │    │
│  │  │                │  │Accuracy        │  │                     │   │    │
│  │  └────────────────┘  └────────────────┘  └─────────────────────┘   │    │
│  └──────────────────────────────┬──────────────────────────────────────┘    │
│                                 │                                            │
│                                 ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     AutoRollbackService                              │    │
│  │  ┌────────────────┐  ┌────────────────┐  ┌─────────────────────┐   │    │
│  │  │checkAndRollback│  │executeRollback │  │sendAlert            │   │    │
│  │  │                │  │(Transaction)   │  │                     │   │    │
│  │  └────────────────┘  └────────────────┘  └─────────────────────┘   │    │
│  └──────────────────────────────┬──────────────────────────────────────┘    │
│                                 │                                            │
│         ┌───────────────────────┼───────────────────────┐                   │
│         ▼                       ▼                       ▼                   │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐           │
│  │ MappingRule │         │ RollbackLog │         │Notification │           │
│  │ (Update)    │         │ (Create)    │         │ Service     │           │
│  └─────────────┘         └─────────────┘         └─────────────┘           │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     Data Sources                                     │    │
│  │  ┌────────────────┐  ┌────────────────┐  ┌─────────────────────┐   │    │
│  │  │RuleApplication │  │RuleVersion     │  │User (Super Users)   │   │    │
│  │  │(Accuracy Data) │  │(Rollback Target)│  │                     │   │    │
│  │  └────────────────┘  └────────────────┘  └─────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Models

#### 2.2.1 Prisma Schema

```prisma
// RuleApplication - 規則應用記錄，用於追蹤準確率
model RuleApplication {
  id             String    @id @default(uuid())
  ruleId         String    @map("rule_id")
  ruleVersion    Int       @map("rule_version")
  documentId     String    @map("document_id")
  fieldName      String    @map("field_name")
  extractedValue String?   @map("extracted_value")
  isAccurate     Boolean?  @map("is_accurate")  // null = 未驗證
  verifiedBy     String?   @map("verified_by")
  verifiedAt     DateTime? @map("verified_at")
  createdAt      DateTime  @default(now()) @map("created_at")

  rule     MappingRule @relation(fields: [ruleId], references: [id], onDelete: Cascade)
  document Document    @relation(fields: [documentId], references: [id], onDelete: Cascade)
  verifier User?       @relation(fields: [verifiedBy], references: [id])

  @@index([ruleId, ruleVersion])
  @@index([ruleId, createdAt])
  @@index([documentId])
  @@index([isAccurate])
  @@map("rule_applications")
}

// RollbackLog - 回滾日誌記錄
model RollbackLog {
  id             String          @id @default(uuid())
  ruleId         String          @map("rule_id")
  fromVersion    Int             @map("from_version")
  toVersion      Int             @map("to_version")
  trigger        RollbackTrigger
  reason         String
  accuracyBefore Float           @map("accuracy_before")
  accuracyAfter  Float           @map("accuracy_after")
  metadata       Json?           // 額外的回滾資訊
  createdAt      DateTime        @default(now()) @map("created_at")

  rule MappingRule @relation(fields: [ruleId], references: [id], onDelete: Cascade)

  @@index([ruleId])
  @@index([trigger])
  @@index([createdAt])
  @@map("rollback_logs")
}

// 回滾觸發類型
enum RollbackTrigger {
  AUTO       // 自動回滾（準確率下降觸發）
  MANUAL     // 手動回滾（用戶操作）
  EMERGENCY  // 緊急回滾（系統錯誤）
}

// 告警通知模型
model Notification {
  id        String           @id @default(uuid())
  userId    String           @map("user_id")
  type      NotificationType
  title     String
  message   String
  data      Json?            // 附加資料
  priority  NotificationPriority @default(NORMAL)
  isRead    Boolean          @default(false) @map("is_read")
  readAt    DateTime?        @map("read_at")
  createdAt DateTime         @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, isRead])
  @@index([type])
  @@index([createdAt])
  @@map("notifications")
}

enum NotificationType {
  RULE_AUTO_ROLLBACK
  RULE_SUGGESTION
  SYSTEM_ALERT
  GENERAL
}

enum NotificationPriority {
  LOW
  NORMAL
  HIGH
  URGENT
}
```

#### 2.2.2 TypeScript Types

```typescript
// src/types/accuracy.ts

/**
 * 準確率指標
 */
export interface AccuracyMetrics {
  total: number           // 總應用次數
  accurate: number        // 準確次數
  inaccurate: number      // 不準確次數
  unverified: number      // 未驗證次數
  accuracy: number | null // 準確率 (0-1)，null 表示數據不足
  sampleSize: number      // 有效樣本數
}

/**
 * 準確率下降檢測結果
 */
export interface AccuracyDropResult {
  ruleId: string
  ruleName: string
  fieldName: string
  currentVersion: number
  previousVersion: number
  currentAccuracy: number
  previousAccuracy: number
  drop: number            // 下降幅度 (0-1)
  dropPercentage: number  // 下降百分比 (0-100)
  shouldRollback: boolean
  sampleSizes: {
    current: number
    previous: number
  }
}

/**
 * 回滾結果
 */
export interface RollbackResult {
  success: boolean
  ruleId: string
  ruleName: string
  fromVersion: number
  toVersion: number
  newVersion: number
  logId: string
  triggeredBy: RollbackTrigger
  reason: string
  timestamp: string
}

/**
 * 回滾觸發類型
 */
export type RollbackTrigger = 'AUTO' | 'MANUAL' | 'EMERGENCY'

/**
 * 監控任務結果
 */
export interface MonitoringResult {
  processedRules: number
  rolledBackRules: string[]
  errors: Array<{
    ruleId: string
    error: string
  }>
  startTime: string
  endTime: string
  duration: number // milliseconds
}

/**
 * 準確率監控配置
 */
export interface AccuracyMonitorConfig {
  dropThreshold: number        // 下降閾值 (預設 0.10 = 10%)
  minSampleSize: number        // 最小樣本數 (預設 10)
  timeWindowHours: number      // 時間窗口 (預設 24 小時)
  cooldownMinutes: number      // 回滾冷卻時間 (預設 60 分鐘)
}

/**
 * 告警通知請求
 */
export interface AlertNotificationRequest {
  userId: string
  type: NotificationType
  title: string
  message: string
  data?: Record<string, unknown>
  priority: NotificationPriority
}

export type NotificationType =
  | 'RULE_AUTO_ROLLBACK'
  | 'RULE_SUGGESTION'
  | 'SYSTEM_ALERT'
  | 'GENERAL'

export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'

/**
 * 回滾歷史項目
 */
export interface RollbackHistoryItem {
  id: string
  ruleId: string
  ruleName: string
  fieldName: string
  fromVersion: number
  toVersion: number
  trigger: RollbackTrigger
  reason: string
  accuracyBefore: number
  accuracyAfter: number
  createdAt: string
}

/**
 * 回滾歷史列表響應
 */
export interface RollbackHistoryResponse {
  items: RollbackHistoryItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
```

### 2.3 Service Layer

#### 2.3.1 RuleAccuracyService

```typescript
// src/services/rule-accuracy.ts

import { prisma } from '@/lib/prisma'
import type { AccuracyMetrics, AccuracyDropResult, AccuracyMonitorConfig } from '@/types/accuracy'

/**
 * 預設監控配置
 */
const DEFAULT_CONFIG: AccuracyMonitorConfig = {
  dropThreshold: 0.10,      // 10% 下降閾值
  minSampleSize: 10,        // 最少 10 個樣本
  timeWindowHours: 24,      // 24 小時時間窗口
  cooldownMinutes: 60,      // 60 分鐘冷卻時間
}

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
   * 比較當前版本與上一版本的準確率
   */
  async checkAccuracyDrop(ruleId: string): Promise<AccuracyDropResult | null> {
    // 獲取規則資訊
    const rule = await prisma.mappingRule.findUnique({
      where: { id: ruleId },
      include: {
        field: { select: { name: true } },
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
      ruleName: rule.name,
      fieldName: rule.field.name,
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
   * 更新應用記錄的準確性（用戶驗證後）
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
}

export const ruleAccuracyService = new RuleAccuracyService()
```

#### 2.3.2 AutoRollbackService

```typescript
// src/services/auto-rollback.ts

import { prisma } from '@/lib/prisma'
import { RuleAccuracyService } from './rule-accuracy'
import { NotificationService } from './notification'
import type { RollbackResult, AccuracyDropResult, RollbackTrigger } from '@/types/accuracy'

/**
 * 自動回滾服務
 * 負責檢測準確率下降並執行自動回滾
 */
export class AutoRollbackService {
  private accuracyService: RuleAccuracyService
  private notificationService: NotificationService

  constructor() {
    this.accuracyService = new RuleAccuracyService()
    this.notificationService = new NotificationService()
  }

  /**
   * 檢查並執行回滾（如需要）
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
   */
  async executeRollback(
    ruleId: string,
    dropResult: AccuracyDropResult,
    trigger: RollbackTrigger
  ): Promise<RollbackResult> {
    const rule = await prisma.mappingRule.findUnique({
      where: { id: ruleId },
      include: {
        field: { select: { name: true } },
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
          extractionType: previousVersion.extractionType,
          pattern: previousVersion.pattern,
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
          extractionType: previousVersion.extractionType,
          pattern: previousVersion.pattern,
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

    return {
      success: true,
      ruleId,
      ruleName: rule.name,
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
   * 生成回滾原因說明
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
        return `緊急回滾：系統檢測到嚴重問題`
      default:
        return '回滾原因未知'
    }
  }

  /**
   * 發送告警通知給所有 Super User
   */
  private async sendAlerts(
    result: RollbackResult,
    dropResult: AccuracyDropResult
  ): Promise<void> {
    // 獲取所有具有 RULE_MANAGE 權限的用戶
    const superUsers = await prisma.user.findMany({
      where: {
        roles: {
          some: {
            permissions: {
              some: {
                permission: { name: 'RULE_MANAGE' },
              },
            },
          },
        },
      },
      select: { id: true, name: true, email: true },
    })

    console.log(`Sending rollback alerts to ${superUsers.length} super users`)

    // 並行發送通知
    await Promise.all(
      superUsers.map((user) =>
        this.notificationService.send({
          userId: user.id,
          type: 'RULE_AUTO_ROLLBACK',
          title: '規則自動回滾告警',
          message: this.generateAlertMessage(result, dropResult),
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
          },
          priority: 'HIGH',
        })
      )
    )
  }

  /**
   * 生成告警訊息
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
   */
  async getRollbackHistory(
    options: {
      ruleId?: string
      trigger?: RollbackTrigger
      page?: number
      pageSize?: number
    } = {}
  ) {
    const { ruleId, trigger, page = 1, pageSize = 20 } = options

    const where: any = {}
    if (ruleId) where.ruleId = ruleId
    if (trigger) where.trigger = trigger

    const [items, total] = await Promise.all([
      prisma.rollbackLog.findMany({
        where,
        include: {
          rule: {
            include: {
              field: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.rollbackLog.count({ where }),
    ])

    return {
      items: items.map((item) => ({
        id: item.id,
        ruleId: item.ruleId,
        ruleName: item.rule.name,
        fieldName: item.rule.field.name,
        fromVersion: item.fromVersion,
        toVersion: item.toVersion,
        trigger: item.trigger,
        reason: item.reason,
        accuracyBefore: item.accuracyBefore,
        accuracyAfter: item.accuracyAfter,
        createdAt: item.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }
  }
}

export const autoRollbackService = new AutoRollbackService()
```

#### 2.3.3 NotificationService

```typescript
// src/services/notification.ts

import { prisma } from '@/lib/prisma'
import type { AlertNotificationRequest } from '@/types/accuracy'

/**
 * 通知服務
 * 負責發送和管理用戶通知
 */
export class NotificationService {
  /**
   * 發送通知
   */
  async send(request: AlertNotificationRequest): Promise<string> {
    const notification = await prisma.notification.create({
      data: {
        userId: request.userId,
        type: request.type,
        title: request.title,
        message: request.message,
        data: request.data ?? {},
        priority: request.priority,
        isRead: false,
      },
    })

    // TODO: 可以在此處整合即時推送（WebSocket、Server-Sent Events）
    // await this.pushRealtime(request.userId, notification)

    // TODO: 可以在此處整合 Email 通知
    // if (request.priority === 'HIGH' || request.priority === 'URGENT') {
    //   await this.sendEmail(request)
    // }

    console.log(`Notification sent to user ${request.userId}: ${request.title}`)

    return notification.id
  }

  /**
   * 批量發送通知
   */
  async sendBulk(requests: AlertNotificationRequest[]): Promise<string[]> {
    const notifications = await prisma.notification.createMany({
      data: requests.map((r) => ({
        userId: r.userId,
        type: r.type,
        title: r.title,
        message: r.message,
        data: r.data ?? {},
        priority: r.priority,
        isRead: false,
      })),
    })

    console.log(`Bulk notifications sent: ${notifications.count} notifications`)

    // Note: createMany doesn't return IDs, would need separate queries if IDs needed
    return []
  }

  /**
   * 獲取用戶未讀通知
   */
  async getUnreadNotifications(userId: string, limit: number = 20) {
    return prisma.notification.findMany({
      where: {
        userId,
        isRead: false,
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
      take: limit,
    })
  }

  /**
   * 標記通知為已讀
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId, // 確保只能標記自己的通知
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    })
  }

  /**
   * 標記所有通知為已讀
   */
  async markAllAsRead(userId: string): Promise<number> {
    const result = await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    })

    return result.count
  }

  /**
   * 獲取未讀通知數量
   */
  async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    })
  }
}

export const notificationService = new NotificationService()
```

### 2.4 CronJob Implementation

#### 2.4.1 Rule Accuracy Monitor Job

```typescript
// src/jobs/rule-accuracy-monitor.ts

import { CronJob } from 'cron'
import { prisma } from '@/lib/prisma'
import { AutoRollbackService } from '@/services/auto-rollback'
import type { MonitoringResult } from '@/types/accuracy'

/**
 * 規則準確率監控任務
 * 每小時執行一次，檢查所有活躍規則的準確率
 */
export const ruleAccuracyMonitorJob = new CronJob(
  '0 * * * *', // 每小時的第 0 分鐘執行
  async () => {
    console.log(`[${new Date().toISOString()}] Starting rule accuracy monitoring...`)

    const startTime = Date.now()
    const autoRollbackService = new AutoRollbackService()
    const result: MonitoringResult = {
      processedRules: 0,
      rolledBackRules: [],
      errors: [],
      startTime: new Date().toISOString(),
      endTime: '',
      duration: 0,
    }

    try {
      // 獲取所有活躍且版本大於 1 的規則
      const activeRules = await prisma.mappingRule.findMany({
        where: {
          status: 'ACTIVE',
          version: { gt: 1 }, // 只檢查有歷史版本的規則
        },
        select: {
          id: true,
          name: true,
        },
      })

      console.log(`Found ${activeRules.length} active rules to check`)

      // 逐一檢查每個規則
      for (const rule of activeRules) {
        result.processedRules++

        try {
          const rollbackResult = await autoRollbackService.checkAndRollback(rule.id)

          if (rollbackResult) {
            console.log(`Auto rolled back rule: ${rule.name} (${rule.id})`)
            result.rolledBackRules.push(rule.id)
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          console.error(`Error checking rule ${rule.id}:`, errorMessage)
          result.errors.push({
            ruleId: rule.id,
            error: errorMessage,
          })
        }
      }
    } catch (error) {
      console.error('Critical error in accuracy monitoring job:', error)
    } finally {
      result.endTime = new Date().toISOString()
      result.duration = Date.now() - startTime

      console.log(
        `[${result.endTime}] Monitoring completed. ` +
        `Processed: ${result.processedRules}, ` +
        `Rolled back: ${result.rolledBackRules.length}, ` +
        `Errors: ${result.errors.length}, ` +
        `Duration: ${result.duration}ms`
      )

      // 可選：將結果記錄到資料庫或監控系統
      await logMonitoringResult(result)
    }
  },
  null, // onComplete
  false, // start immediately
  'Asia/Taipei' // timezone
)

/**
 * 記錄監控結果
 */
async function logMonitoringResult(result: MonitoringResult): Promise<void> {
  try {
    // 可以記錄到資料庫或外部監控系統
    // 這裡簡單地記錄到控制台
    if (result.errors.length > 0) {
      console.warn('Monitoring errors:', JSON.stringify(result.errors, null, 2))
    }

    // 如果有回滾發生，可以觸發額外的告警
    if (result.rolledBackRules.length > 0) {
      console.log('Rules rolled back:', result.rolledBackRules.join(', '))
    }
  } catch (error) {
    console.error('Failed to log monitoring result:', error)
  }
}

/**
 * 啟動監控任務
 */
export function startRuleAccuracyMonitor(): void {
  ruleAccuracyMonitorJob.start()
  console.log('Rule accuracy monitoring job started')
}

/**
 * 停止監控任務
 */
export function stopRuleAccuracyMonitor(): void {
  ruleAccuracyMonitorJob.stop()
  console.log('Rule accuracy monitoring job stopped')
}

/**
 * 手動觸發監控（用於測試或緊急情況）
 */
export async function triggerManualMonitoring(): Promise<MonitoringResult> {
  console.log('Manual monitoring triggered')
  // 直接執行 job 的回調函數
  await ruleAccuracyMonitorJob.fireOnTick()
  return {} as MonitoringResult // 實際實現中應返回真實結果
}
```

#### 2.4.2 Job Initialization

```typescript
// src/lib/jobs/index.ts

import { startRuleAccuracyMonitor, stopRuleAccuracyMonitor } from '@/jobs/rule-accuracy-monitor'

/**
 * 啟動所有定時任務
 * 應在應用啟動時調用
 */
export function initializeJobs(): void {
  console.log('Initializing background jobs...')

  // 啟動規則準確率監控
  startRuleAccuracyMonitor()

  console.log('Background jobs initialized')
}

/**
 * 停止所有定時任務
 * 應在應用關閉時調用
 */
export function shutdownJobs(): void {
  console.log('Shutting down background jobs...')

  stopRuleAccuracyMonitor()

  console.log('Background jobs stopped')
}

// 處理進程終止信號
if (typeof process !== 'undefined') {
  process.on('SIGTERM', () => {
    console.log('SIGTERM received')
    shutdownJobs()
    process.exit(0)
  })

  process.on('SIGINT', () => {
    console.log('SIGINT received')
    shutdownJobs()
    process.exit(0)
  })
}
```

### 2.5 API Design

#### 2.5.1 GET /api/rollback-logs - 獲取回滾歷史

```typescript
// src/app/api/rollback-logs/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { checkPermission } from '@/lib/permissions'
import { autoRollbackService } from '@/services/auto-rollback'
import { z } from 'zod'

const querySchema = z.object({
  ruleId: z.string().uuid().optional(),
  trigger: z.enum(['AUTO', 'MANUAL', 'EMERGENCY']).optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
})

export async function GET(request: NextRequest) {
  try {
    // 1. Authentication
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/unauthorized',
            title: 'Unauthorized',
            status: 401,
            detail: 'Authentication required',
            instance: '/api/rollback-logs',
          },
        },
        { status: 401 }
      )
    }

    // 2. Authorization
    const hasPermission = await checkPermission(session.user.id, 'RULE_VIEW')
    if (!hasPermission) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/forbidden',
            title: 'Forbidden',
            status: 403,
            detail: 'RULE_VIEW permission required',
            instance: '/api/rollback-logs',
          },
        },
        { status: 403 }
      )
    }

    // 3. Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const queryResult = querySchema.safeParse({
      ruleId: searchParams.get('ruleId'),
      trigger: searchParams.get('trigger'),
      page: searchParams.get('page'),
      pageSize: searchParams.get('pageSize'),
    })

    if (!queryResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: queryResult.error.issues[0].message,
            instance: '/api/rollback-logs',
          },
        },
        { status: 400 }
      )
    }

    // 4. Fetch rollback history
    const history = await autoRollbackService.getRollbackHistory(queryResult.data)

    return NextResponse.json({
      success: true,
      data: history,
    })
  } catch (error) {
    console.error('Error fetching rollback logs:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'https://api.example.com/errors/internal',
          title: 'Internal Server Error',
          status: 500,
          detail: 'An unexpected error occurred',
          instance: '/api/rollback-logs',
        },
      },
      { status: 500 }
    )
  }
}
```

#### 2.5.2 GET /api/rules/[id]/accuracy - 獲取規則準確率

```typescript
// src/app/api/rules/[id]/accuracy/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission } from '@/lib/permissions'
import { ruleAccuracyService } from '@/services/rule-accuracy'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Authentication
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/unauthorized',
            title: 'Unauthorized',
            status: 401,
            detail: 'Authentication required',
            instance: `/api/rules/${params.id}/accuracy`,
          },
        },
        { status: 401 }
      )
    }

    // 2. Authorization
    const hasPermission = await checkPermission(session.user.id, 'RULE_VIEW')
    if (!hasPermission) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/forbidden',
            title: 'Forbidden',
            status: 403,
            detail: 'RULE_VIEW permission required',
            instance: `/api/rules/${params.id}/accuracy`,
          },
        },
        { status: 403 }
      )
    }

    // 3. Get rule
    const rule = await prisma.mappingRule.findUnique({
      where: { id: params.id },
      select: { version: true },
    })

    if (!rule) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/not-found',
            title: 'Rule Not Found',
            status: 404,
            detail: `Rule ${params.id} not found`,
            instance: `/api/rules/${params.id}/accuracy`,
          },
        },
        { status: 404 }
      )
    }

    // 4. Calculate current accuracy
    const currentMetrics = await ruleAccuracyService.calculateAccuracy(
      params.id,
      rule.version
    )

    // 5. Get historical trend
    const historicalTrend = await ruleAccuracyService.getHistoricalAccuracy(
      params.id,
      7
    )

    return NextResponse.json({
      success: true,
      data: {
        ruleId: params.id,
        currentVersion: rule.version,
        current: currentMetrics,
        historical: historicalTrend,
      },
    })
  } catch (error) {
    console.error('Error fetching accuracy:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'https://api.example.com/errors/internal',
          title: 'Internal Server Error',
          status: 500,
          detail: 'An unexpected error occurred',
          instance: `/api/rules/${params.id}/accuracy`,
        },
      },
      { status: 500 }
    )
  }
}
```

### 2.6 UI Components

#### 2.6.1 Rollback History Page

```typescript
// src/app/(dashboard)/rollback-history/page.tsx
'use client'

import { useState } from 'react'
import { useRollbackHistory } from '@/hooks/use-rollback'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Pagination } from '@/components/ui/pagination'
import { formatDate } from '@/lib/utils'
import { History, AlertTriangle, User, Zap, ChevronRight } from 'lucide-react'
import Link from 'next/link'

const triggerLabels = {
  AUTO: { label: '自動', icon: Zap, variant: 'destructive' as const },
  MANUAL: { label: '手動', icon: User, variant: 'secondary' as const },
  EMERGENCY: { label: '緊急', icon: AlertTriangle, variant: 'destructive' as const },
}

export default function RollbackHistoryPage() {
  const [page, setPage] = useState(1)
  const [triggerFilter, setTriggerFilter] = useState<string>('all')

  const { data, isLoading, error } = useRollbackHistory({
    page,
    pageSize: 20,
    trigger: triggerFilter === 'all' ? undefined : triggerFilter,
  })

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="flex items-center justify-center h-48">
            <p className="text-destructive">載入回滾歷史失敗</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <History className="h-6 w-6" />
            回滾歷史
          </h1>
          <p className="text-muted-foreground">
            查看系統的規則回滾記錄
          </p>
        </div>

        <Select value={triggerFilter} onValueChange={setTriggerFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="篩選類型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="AUTO">自動回滾</SelectItem>
            <SelectItem value="MANUAL">手動回滾</SelectItem>
            <SelectItem value="EMERGENCY">緊急回滾</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                總回滾次數
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                自動回滾
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {data.items.filter((i) => i.trigger === 'AUTO').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                手動回滾
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data.items.filter((i) => i.trigger === 'MANUAL').length}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* History Table */}
      <Card>
        <CardHeader>
          <CardTitle>回滾記錄</CardTitle>
          <CardDescription>
            系統所有的規則回滾操作記錄
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>規則名稱</TableHead>
                    <TableHead>欄位</TableHead>
                    <TableHead>版本變更</TableHead>
                    <TableHead>類型</TableHead>
                    <TableHead>準確率變化</TableHead>
                    <TableHead>時間</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.items.map((item) => {
                    const TriggerIcon = triggerLabels[item.trigger].icon
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {item.ruleName}
                        </TableCell>
                        <TableCell>{item.fieldName}</TableCell>
                        <TableCell>
                          <span className="font-mono">
                            v{item.fromVersion} → v{item.toVersion}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={triggerLabels[item.trigger].variant}>
                            <TriggerIcon className="h-3 w-3 mr-1" />
                            {triggerLabels[item.trigger].label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-red-500">
                              {(item.accuracyBefore * 100).toFixed(1)}%
                            </span>
                            <span>→</span>
                            <span className="text-green-500">
                              {(item.accuracyAfter * 100).toFixed(1)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(item.createdAt)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" asChild>
                            <Link href={`/rules/${item.ruleId}`}>
                              <ChevronRight className="h-4 w-4" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              {data && data.totalPages > 1 && (
                <div className="mt-4 flex justify-center">
                  <Pagination
                    currentPage={page}
                    totalPages={data.totalPages}
                    onPageChange={setPage}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

#### 2.6.2 Accuracy Metrics Component

```typescript
// src/components/rules/AccuracyMetrics.tsx
'use client'

import { useRuleAccuracy } from '@/hooks/use-accuracy'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react'

interface Props {
  ruleId: string
}

export function AccuracyMetrics({ ruleId }: Props) {
  const { data, isLoading, error } = useRuleAccuracy(ruleId)

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </CardContent>
      </Card>
    )
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-48">
          <p className="text-destructive">載入準確率資料失敗</p>
        </CardContent>
      </Card>
    )
  }

  const { current, historical } = data
  const accuracyPercent = current.accuracy !== null
    ? (current.accuracy * 100).toFixed(1)
    : null

  // 計算趨勢
  const validHistorical = historical.filter((h) => h.accuracy !== null)
  let trend: 'up' | 'down' | 'stable' = 'stable'
  if (validHistorical.length >= 2) {
    const latest = validHistorical[validHistorical.length - 1].accuracy!
    const previous = validHistorical[validHistorical.length - 2].accuracy!
    if (latest > previous + 0.02) trend = 'up'
    else if (latest < previous - 0.02) trend = 'down'
  }

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  const trendColor = trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-gray-500'

  // 準備圖表資料
  const chartData = historical.map((h) => ({
    date: h.period,
    accuracy: h.accuracy !== null ? h.accuracy * 100 : null,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          準確率指標
          {current.accuracy !== null && current.accuracy < 0.8 && (
            <Badge variant="destructive" className="ml-2">
              <AlertTriangle className="h-3 w-3 mr-1" />
              低於閾值
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          基於最近 24 小時的驗證數據
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Accuracy */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">當前準確率</span>
            <div className="flex items-center gap-2">
              <TrendIcon className={`h-4 w-4 ${trendColor}`} />
              <span className="text-2xl font-bold">
                {accuracyPercent !== null ? `${accuracyPercent}%` : '數據不足'}
              </span>
            </div>
          </div>
          {current.accuracy !== null && (
            <Progress value={current.accuracy * 100} className="h-2" />
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold">{current.total}</div>
            <div className="text-xs text-muted-foreground">總應用次數</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-500">{current.accurate}</div>
            <div className="text-xs text-muted-foreground">準確</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-500">{current.inaccurate}</div>
            <div className="text-xs text-muted-foreground">不準確</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-500">{current.unverified}</div>
            <div className="text-xs text-muted-foreground">未驗證</div>
          </div>
        </div>

        {/* Historical Chart */}
        {chartData.some((d) => d.accuracy !== null) && (
          <div className="h-48">
            <h4 className="text-sm font-medium mb-2">歷史趨勢（7天）</h4>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(value) => value.slice(5)} // Show MM-DD
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 10 }}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip
                  formatter={(value: number) => [`${value.toFixed(1)}%`, '準確率']}
                />
                <Line
                  type="monotone"
                  dataKey="accuracy"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6' }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Warning Message */}
        {current.sampleSize < 10 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/10 p-3 rounded-lg text-sm">
            <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
              <AlertTriangle className="h-4 w-4" />
              <span>
                樣本數量不足（{current.sampleSize}/10），準確率計算可能不準確
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

### 2.7 React Query Hooks

```typescript
// src/hooks/use-rollback.ts
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { RollbackHistoryResponse, RollbackTrigger } from '@/types/accuracy'

interface RollbackHistoryOptions {
  page?: number
  pageSize?: number
  ruleId?: string
  trigger?: string
}

export function useRollbackHistory(options: RollbackHistoryOptions = {}) {
  return useQuery({
    queryKey: ['rollback-history', options],
    queryFn: async (): Promise<RollbackHistoryResponse> => {
      const params = new URLSearchParams()
      if (options.page) params.set('page', String(options.page))
      if (options.pageSize) params.set('pageSize', String(options.pageSize))
      if (options.ruleId) params.set('ruleId', options.ruleId)
      if (options.trigger) params.set('trigger', options.trigger)

      const response = await apiClient.get(`/api/rollback-logs?${params}`)
      if (!response.success) {
        throw new Error(response.error?.detail || 'Failed to fetch rollback history')
      }
      return response.data
    },
  })
}

// src/hooks/use-accuracy.ts
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { AccuracyMetrics } from '@/types/accuracy'

interface AccuracyResponse {
  ruleId: string
  currentVersion: number
  current: AccuracyMetrics
  historical: Array<{
    period: string
    accuracy: number | null
    sampleSize: number
  }>
}

export function useRuleAccuracy(ruleId: string) {
  return useQuery({
    queryKey: ['rule-accuracy', ruleId],
    queryFn: async (): Promise<AccuracyResponse> => {
      const response = await apiClient.get(`/api/rules/${ruleId}/accuracy`)
      if (!response.success) {
        throw new Error(response.error?.detail || 'Failed to fetch accuracy')
      }
      return response.data
    },
    enabled: !!ruleId,
    refetchInterval: 5 * 60 * 1000, // 每 5 分鐘自動重新獲取
  })
}
```

---

## 3. Test Specifications

### 3.1 Unit Tests

```typescript
// src/services/__tests__/rule-accuracy.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { RuleAccuracyService } from '../rule-accuracy'
import { prisma } from '@/lib/prisma'

vi.mock('@/lib/prisma')

describe('RuleAccuracyService', () => {
  let service: RuleAccuracyService

  beforeEach(() => {
    service = new RuleAccuracyService({
      dropThreshold: 0.10,
      minSampleSize: 10,
      timeWindowHours: 24,
      cooldownMinutes: 60,
    })
    vi.clearAllMocks()
  })

  describe('calculateAccuracy', () => {
    it('should calculate accuracy correctly with sufficient samples', async () => {
      const mockApplications = [
        { isAccurate: true },
        { isAccurate: true },
        { isAccurate: true },
        { isAccurate: true },
        { isAccurate: true },
        { isAccurate: true },
        { isAccurate: true },
        { isAccurate: true },
        { isAccurate: false },
        { isAccurate: false },
      ]

      vi.mocked(prisma.ruleApplication.findMany).mockResolvedValue(mockApplications)

      const result = await service.calculateAccuracy('rule-1', 1)

      expect(result.accuracy).toBe(0.8) // 8/10
      expect(result.total).toBe(10)
      expect(result.accurate).toBe(8)
      expect(result.inaccurate).toBe(2)
      expect(result.sampleSize).toBe(10)
    })

    it('should return null accuracy when sample size is insufficient', async () => {
      const mockApplications = [
        { isAccurate: true },
        { isAccurate: true },
        { isAccurate: false },
      ]

      vi.mocked(prisma.ruleApplication.findMany).mockResolvedValue(mockApplications)

      const result = await service.calculateAccuracy('rule-1', 1)

      expect(result.accuracy).toBeNull()
      expect(result.sampleSize).toBe(3)
    })

    it('should exclude unverified applications from accuracy calculation', async () => {
      const mockApplications = [
        { isAccurate: true },
        { isAccurate: true },
        { isAccurate: null }, // unverified
        { isAccurate: null }, // unverified
      ]

      vi.mocked(prisma.ruleApplication.findMany).mockResolvedValue(mockApplications)

      const result = await service.calculateAccuracy('rule-1', 1)

      expect(result.total).toBe(4)
      expect(result.unverified).toBe(2)
      expect(result.sampleSize).toBe(2)
    })
  })

  describe('checkAccuracyDrop', () => {
    it('should detect accuracy drop above threshold', async () => {
      vi.mocked(prisma.mappingRule.findUnique).mockResolvedValue({
        id: 'rule-1',
        name: 'Test Rule',
        version: 2,
        field: { name: 'invoice_number' },
      })

      vi.mocked(prisma.rollbackLog.findFirst).mockResolvedValue(null)

      // Current version: 70% accuracy
      vi.mocked(prisma.ruleApplication.findMany)
        .mockResolvedValueOnce(
          Array(10).fill(null).map((_, i) => ({ isAccurate: i < 7 }))
        )
        // Previous version: 90% accuracy
        .mockResolvedValueOnce(
          Array(10).fill(null).map((_, i) => ({ isAccurate: i < 9 }))
        )

      const result = await service.checkAccuracyDrop('rule-1')

      expect(result).not.toBeNull()
      expect(result!.shouldRollback).toBe(true)
      expect(result!.drop).toBeCloseTo(0.2) // 20% drop
      expect(result!.dropPercentage).toBeCloseTo(20)
    })

    it('should not trigger rollback when drop is below threshold', async () => {
      vi.mocked(prisma.mappingRule.findUnique).mockResolvedValue({
        id: 'rule-1',
        name: 'Test Rule',
        version: 2,
        field: { name: 'invoice_number' },
      })

      vi.mocked(prisma.rollbackLog.findFirst).mockResolvedValue(null)

      // Current version: 85% accuracy
      vi.mocked(prisma.ruleApplication.findMany)
        .mockResolvedValueOnce(
          Array(20).fill(null).map((_, i) => ({ isAccurate: i < 17 }))
        )
        // Previous version: 90% accuracy
        .mockResolvedValueOnce(
          Array(20).fill(null).map((_, i) => ({ isAccurate: i < 18 }))
        )

      const result = await service.checkAccuracyDrop('rule-1')

      expect(result).toBeNull() // 5% drop is below 10% threshold
    })

    it('should respect cooldown period', async () => {
      vi.mocked(prisma.mappingRule.findUnique).mockResolvedValue({
        id: 'rule-1',
        name: 'Test Rule',
        version: 2,
        field: { name: 'invoice_number' },
      })

      // Recent rollback exists
      vi.mocked(prisma.rollbackLog.findFirst).mockResolvedValue({
        id: 'log-1',
        createdAt: new Date(),
      })

      const result = await service.checkAccuracyDrop('rule-1')

      expect(result).toBeNull()
    })
  })
})
```

### 3.2 Integration Tests

```typescript
// src/services/__tests__/auto-rollback.integration.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AutoRollbackService } from '../auto-rollback'
import { prisma } from '@/lib/prisma'
import { NotificationService } from '../notification'

vi.mock('@/lib/prisma')
vi.mock('../notification')

describe('AutoRollbackService Integration', () => {
  let service: AutoRollbackService

  beforeEach(() => {
    service = new AutoRollbackService()
    vi.clearAllMocks()
  })

  describe('checkAndRollback', () => {
    it('should execute full rollback flow when accuracy drops', async () => {
      // Setup mocks for a complete rollback scenario
      vi.mocked(prisma.mappingRule.findUnique).mockResolvedValue({
        id: 'rule-1',
        name: 'Test Rule',
        version: 2,
        extractionType: 'REGEX',
        pattern: 'new-pattern',
        confidence: 0.7,
        priority: 1,
        field: { name: 'invoice_number' },
      })

      vi.mocked(prisma.rollbackLog.findFirst).mockResolvedValue(null)

      // Accuracy data showing drop
      vi.mocked(prisma.ruleApplication.findMany)
        .mockResolvedValueOnce(Array(10).fill({ isAccurate: false })) // 0% current
        .mockResolvedValueOnce(Array(10).fill({ isAccurate: true })) // 100% previous

      vi.mocked(prisma.ruleVersion.findFirst).mockResolvedValue({
        id: 'version-1',
        version: 1,
        extractionType: 'REGEX',
        pattern: 'old-pattern',
        confidence: 0.9,
        priority: 0,
      })

      vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
        return fn(prisma)
      })

      vi.mocked(prisma.mappingRule.update).mockResolvedValue({})
      vi.mocked(prisma.ruleVersion.create).mockResolvedValue({})
      vi.mocked(prisma.rollbackLog.create).mockResolvedValue({
        id: 'log-1',
      })

      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { id: 'user-1', name: 'Admin', email: 'admin@test.com' },
      ])

      const result = await service.checkAndRollback('rule-1')

      expect(result).not.toBeNull()
      expect(result!.success).toBe(true)
      expect(result!.triggeredBy).toBe('AUTO')
      expect(prisma.$transaction).toHaveBeenCalled()
    })
  })
})
```

### 3.3 CronJob Tests

```typescript
// src/jobs/__tests__/rule-accuracy-monitor.test.ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { ruleAccuracyMonitorJob, triggerManualMonitoring } from '../rule-accuracy-monitor'
import { prisma } from '@/lib/prisma'
import { AutoRollbackService } from '@/services/auto-rollback'

vi.mock('@/lib/prisma')
vi.mock('@/services/auto-rollback')

describe('Rule Accuracy Monitor Job', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    ruleAccuracyMonitorJob.stop()
  })

  it('should process all active rules', async () => {
    const mockRules = [
      { id: 'rule-1', name: 'Rule 1' },
      { id: 'rule-2', name: 'Rule 2' },
    ]

    vi.mocked(prisma.mappingRule.findMany).mockResolvedValue(mockRules)

    const mockCheckAndRollback = vi.fn().mockResolvedValue(null)
    vi.mocked(AutoRollbackService).mockImplementation(() => ({
      checkAndRollback: mockCheckAndRollback,
    }))

    // Trigger the job manually
    await ruleAccuracyMonitorJob.fireOnTick()

    expect(prisma.mappingRule.findMany).toHaveBeenCalledWith({
      where: {
        status: 'ACTIVE',
        version: { gt: 1 },
      },
      select: { id: true, name: true },
    })

    expect(mockCheckAndRollback).toHaveBeenCalledTimes(2)
  })

  it('should handle errors gracefully', async () => {
    const mockRules = [
      { id: 'rule-1', name: 'Rule 1' },
      { id: 'rule-2', name: 'Rule 2' },
    ]

    vi.mocked(prisma.mappingRule.findMany).mockResolvedValue(mockRules)

    const mockCheckAndRollback = vi.fn()
      .mockRejectedValueOnce(new Error('Test error'))
      .mockResolvedValueOnce(null)

    vi.mocked(AutoRollbackService).mockImplementation(() => ({
      checkAndRollback: mockCheckAndRollback,
    }))

    // Should not throw
    await expect(ruleAccuracyMonitorJob.fireOnTick()).resolves.not.toThrow()

    // Both rules should still be processed
    expect(mockCheckAndRollback).toHaveBeenCalledTimes(2)
  })
})
```

---

## 4. Implementation Checklist

### Phase 1: Data Layer
- [ ] 確認 RuleApplication Prisma schema
- [ ] 確認 RollbackLog Prisma schema
- [ ] 確認 Notification Prisma schema
- [ ] 建立 TypeScript types (`src/types/accuracy.ts`)
- [ ] 執行 Prisma migration

### Phase 2: Service Layer
- [ ] 實作 RuleAccuracyService (`src/services/rule-accuracy.ts`)
- [ ] 實作 AutoRollbackService (`src/services/auto-rollback.ts`)
- [ ] 實作 NotificationService (`src/services/notification.ts`)
- [ ] 撰寫 Service 單元測試

### Phase 3: CronJob
- [ ] 實作 ruleAccuracyMonitorJob (`src/jobs/rule-accuracy-monitor.ts`)
- [ ] 建立 Job 初始化機制 (`src/lib/jobs/index.ts`)
- [ ] 撰寫 CronJob 測試
- [ ] 整合到應用啟動流程

### Phase 4: API Layer
- [ ] 實作 GET `/api/rollback-logs` endpoint
- [ ] 實作 GET `/api/rules/[id]/accuracy` endpoint
- [ ] 撰寫 API 測試

### Phase 5: UI Layer
- [ ] 建立 Rollback History Page (`src/app/(dashboard)/rollback-history/page.tsx`)
- [ ] 建立 AccuracyMetrics Component
- [ ] 實作 React Query hooks
- [ ] 整合到規則詳情頁面

### Phase 6: Integration
- [ ] 整合通知系統
- [ ] 端對端測試驗證完整流程
- [ ] 壓力測試與性能優化

---

## 5. Dependencies

### 5.1 Internal Dependencies
- **Story 4-7**: 版本管理功能（RuleVersion 模型）
- **MappingRule**: 規則主表
- **Document**: 文件表（用於 RuleApplication）
- **User**: 用戶表（通知接收者）

### 5.2 External Libraries
- `cron` - 定時任務排程
- `@tanstack/react-query` - 資料獲取與快取
- `recharts` - 圖表視覺化
- `zod` - 請求驗證

---

## 6. Security Considerations

### 6.1 Authentication & Authorization
- 所有 API 需要 NextAuth session
- 回滾歷史查看需要 `RULE_VIEW` 權限
- 通知只發送給有 `RULE_MANAGE` 權限的用戶

### 6.2 System Protection
- 回滾冷卻期防止頻繁回滾
- 最小樣本數要求避免誤判
- 完整的錯誤處理和日誌記錄

### 6.3 Data Integrity
- 回滾操作使用 Prisma transaction
- 所有回滾都有完整的日誌記錄
- 回滾不會刪除任何版本，只創建新版本

---

## 7. Performance Considerations

### 7.1 CronJob Optimization
- 只檢查 version > 1 的規則
- 批量處理規則以提高效率
- 錯誤隔離避免單一規則影響整體

### 7.2 Database Optimization
- RuleApplication 表建立適當索引
- 時間窗口查詢使用索引
- 分頁查詢減少記憶體使用

### 7.3 Monitoring
- 記錄每次監控任務的執行時間
- 追蹤錯誤率和回滾頻率
- 告警過多回滾情況

---

## 8. Configuration

### 8.1 Environment Variables

```env
# 準確率監控配置
ACCURACY_DROP_THRESHOLD=0.10          # 觸發回滾的下降閾值 (10%)
ACCURACY_MIN_SAMPLE_SIZE=10           # 最小樣本數
ACCURACY_TIME_WINDOW_HOURS=24         # 計算時間窗口
ACCURACY_COOLDOWN_MINUTES=60          # 回滾冷卻時間

# CronJob 配置
ENABLE_ACCURACY_MONITORING=true       # 是否啟用準確率監控
ACCURACY_MONITOR_CRON="0 * * * *"     # 監控執行週期
```

### 8.2 Runtime Configuration

```typescript
// src/config/accuracy.ts
export const accuracyConfig = {
  dropThreshold: parseFloat(process.env.ACCURACY_DROP_THRESHOLD || '0.10'),
  minSampleSize: parseInt(process.env.ACCURACY_MIN_SAMPLE_SIZE || '10'),
  timeWindowHours: parseInt(process.env.ACCURACY_TIME_WINDOW_HOURS || '24'),
  cooldownMinutes: parseInt(process.env.ACCURACY_COOLDOWN_MINUTES || '60'),
  enabled: process.env.ENABLE_ACCURACY_MONITORING !== 'false',
}
```

---

## 9. References

- [Story 4-8 定義](../stories/4-8-rule-auto-rollback.md)
- [Story 4-7 版本管理](./tech-spec-story-4-7.md)
- [Epic 4 概覽](../../03-epics/sections/epic-4-mapping-rules-auto-learning.md)
- [Cron Library](https://www.npmjs.com/package/cron)
