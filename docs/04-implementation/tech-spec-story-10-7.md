# Tech Spec: Story 10-7 - n8n 連接狀態監控

## 1. 概述

### 1.1 Story 資訊
- **Story ID**: 10-7
- **標題**: n8n 連接狀態監控
- **Epic**: 10 - n8n 工作流整合
- **功能需求**: FR56 (執行狀態監控), FR57 (錯誤診斷)
- **優先級**: Medium
- **故事點數**: 5

### 1.2 目標
實現 n8n 服務連接的完整健康監控系統，讓系統管理員能夠：
- 即時監控 n8n 連接狀態（正常/異常/未配置）
- 查看 24 小時內的成功/失敗調用統計
- 在連接異常時收到自動告警通知
- 查看狀態變化歷史記錄及原因
- 自動檢測連接恢復並發送通知

### 1.3 相依性
| 類型 | Story | 說明 |
|------|-------|------|
| 前置 | 10-2 | Webhook 配置管理（配置來源） |
| 相關 | 10-5 | 工作流錯誤詳情查看（錯誤關聯） |
| 相關 | 12-1 | 系統健康監控儀表板（整合顯示） |

---

## 2. 資料庫設計

### 2.1 Prisma Schema

```prisma
// ===========================================
// 系統健康日誌
// ===========================================

model SystemHealthLog {
  id             String          @id @default(cuid())

  // 服務標識
  service        String          // 'n8n' | 'azure_blob' | 'azure_ai' | 'database'
  serviceUrl     String?         // 服務 URL（用於診斷）

  // 狀態
  status         HealthStatus
  previousStatus HealthStatus?   // 前一次狀態（用於變化追蹤）

  // 詳情
  message        String?         // 狀態說明或錯誤訊息
  details        Json?           // 額外詳情 (HealthCheckDetailsSchema)

  // 檢查資訊
  checkType      HealthCheckType
  responseTimeMs Int?            // 回應時間（毫秒）
  httpStatus     Int?            // HTTP 狀態碼

  // 城市關聯（如適用）
  cityCode       String?
  city           City?           @relation(fields: [cityCode], references: [code])

  // 審計
  createdAt      DateTime        @default(now())

  @@index([service])
  @@index([status])
  @@index([createdAt])
  @@index([cityCode])
  @@index([service, status])
  @@index([service, createdAt])
  @@map("system_health_logs")
}

// ===========================================
// 健康狀態枚舉
// ===========================================

enum HealthStatus {
  HEALTHY       // 正常 - 服務運作正常
  DEGRADED      // 降級 - 服務可用但性能下降
  UNHEALTHY     // 異常 - 服務無法正常運作
  UNKNOWN       // 未知 - 無法確定狀態
  UNCONFIGURED  // 未配置 - 服務尚未設定
}

// ===========================================
// 健康檢查類型枚舉
// ===========================================

enum HealthCheckType {
  SCHEDULED     // 定期檢查 - 由排程任務觸發
  MANUAL        // 手動檢查 - 管理員主動觸發
  ON_ERROR      // 錯誤觸發 - 發生錯誤時觸發
  ON_RECOVERY   // 恢復檢測 - 恢復後驗證
  STARTUP       // 啟動檢查 - 系統啟動時
}

// ===========================================
// n8n 連接統計（聚合資料）
// ===========================================

model N8nConnectionStats {
  id             String          @id @default(cuid())

  // 時間範圍
  periodStart    DateTime
  periodEnd      DateTime
  periodType     StatsPeriodType

  // 城市
  cityCode       String?
  city           City?           @relation(fields: [cityCode], references: [code])

  // 統計數據
  totalCalls     Int             @default(0)
  successCalls   Int             @default(0)
  failedCalls    Int             @default(0)
  avgResponseMs  Float?          // 平均回應時間
  maxResponseMs  Int?            // 最大回應時間
  minResponseMs  Int?            // 最小回應時間
  p95ResponseMs  Int?            // P95 回應時間
  p99ResponseMs  Int?            // P99 回應時間

  // 錯誤分類
  errorsByType   Json?           // ErrorsByTypeSchema

  createdAt      DateTime        @default(now())

  @@unique([periodStart, periodType, cityCode])
  @@index([periodStart])
  @@index([cityCode])
  @@index([periodType, periodStart])
  @@map("n8n_connection_stats")
}

// ===========================================
// 統計週期類型枚舉
// ===========================================

enum StatsPeriodType {
  HOURLY        // 每小時
  DAILY         // 每日
  WEEKLY        // 每週
  MONTHLY       // 每月
}

// ===========================================
// 告警記錄
// ===========================================

model AlertRecord {
  id               String        @id @default(cuid())

  // 告警資訊
  alertType        AlertType
  severity         AlertSeverity
  title            String
  message          String        @db.Text
  details          Json?         // AlertDetailsSchema

  // 來源
  service          String        // 觸發告警的服務
  cityCode         String?       // 相關城市

  // 狀態
  status           AlertStatus   @default(ACTIVE)
  acknowledgedBy   String?       // 確認者 ID
  acknowledgedAt   DateTime?     // 確認時間
  resolvedAt       DateTime?     // 解決時間
  resolvedBy       String?       // 解決者 ID
  resolutionNote   String?       // 解決備註

  // 通知
  notificationsSent Json?        // NotificationsSentSchema

  // 關聯
  relatedAlertId   String?       // 相關告警 ID（用於告警串聯）

  // 審計
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt

  @@index([alertType])
  @@index([status])
  @@index([service])
  @@index([severity])
  @@index([createdAt])
  @@index([service, status])
  @@map("alert_records")
}

// ===========================================
// 告警類型枚舉
// ===========================================

enum AlertType {
  CONNECTION_FAILURE    // 連線失敗
  HIGH_ERROR_RATE       // 高錯誤率
  RESPONSE_TIMEOUT      // 回應逾時
  SERVICE_DEGRADED      // 服務降級
  SERVICE_RECOVERED     // 服務恢復
  CONFIGURATION_ERROR   // 配置錯誤
  AUTHENTICATION_FAILURE // 認證失敗
  RATE_LIMIT_EXCEEDED   // 超過速率限制
}

// ===========================================
// 告警嚴重程度枚舉
// ===========================================

enum AlertSeverity {
  INFO      // 資訊 - 一般性通知
  WARNING   // 警告 - 需要注意
  ERROR     // 錯誤 - 需要處理
  CRITICAL  // 嚴重 - 需要立即處理
}

// ===========================================
// 告警狀態枚舉
// ===========================================

enum AlertStatus {
  ACTIVE        // 活躍 - 需要處理
  ACKNOWLEDGED  // 已確認 - 已知曉但未解決
  RESOLVED      // 已解決 - 問題已處理
  SUPPRESSED    // 已抑制 - 暫時忽略
}

// ===========================================
// 告警通知配置
// ===========================================

model AlertNotificationConfig {
  id             String        @id @default(cuid())

  // 配置名稱
  name           String
  description    String?

  // 觸發條件
  services       String[]      // 適用的服務列表
  alertTypes     AlertType[]   // 適用的告警類型
  minSeverity    AlertSeverity // 最低嚴重程度

  // 通知管道
  emailEnabled   Boolean       @default(false)
  emailRecipients String[]     // Email 收件人列表
  teamsEnabled   Boolean       @default(false)
  teamsWebhookUrl String?      // Teams Webhook URL
  slackEnabled   Boolean       @default(false)
  slackWebhookUrl String?      // Slack Webhook URL

  // 抑制設定
  cooldownMinutes Int          @default(30) // 相同告警的冷卻時間
  suppressDuplicates Boolean   @default(true)

  // 狀態
  isActive       Boolean       @default(true)

  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  @@map("alert_notification_configs")
}
```

### 2.2 JSON Schema 定義

```typescript
// ===========================================
// 健康檢查詳情 Schema
// ===========================================

interface HealthCheckDetailsSchema {
  // 連接資訊
  endpoint?: string             // 檢查的端點
  method?: string               // HTTP 方法

  // 回應資訊
  responseBody?: string         // 回應內容（截斷）
  responseHeaders?: Record<string, string> // 回應標頭

  // 錯誤資訊
  errorCode?: string            // 錯誤代碼
  errorStack?: string           // 錯誤堆疊（僅開發環境）

  // SSL/TLS 資訊
  sslValid?: boolean            // SSL 是否有效
  sslExpiry?: string            // SSL 到期日

  // 額外資訊
  version?: string              // 服務版本
  uptime?: number               // 服務運行時間（秒）
}

// ===========================================
// 錯誤分類統計 Schema
// ===========================================

interface ErrorsByTypeSchema {
  CONNECTION_ERROR?: number     // 連線錯誤次數
  TIMEOUT_ERROR?: number        // 逾時錯誤次數
  AUTHENTICATION_ERROR?: number // 認證錯誤次數
  VALIDATION_ERROR?: number     // 驗證錯誤次數
  RATE_LIMIT_ERROR?: number     // 速率限制錯誤次數
  SERVER_ERROR?: number         // 伺服器錯誤次數
  UNKNOWN_ERROR?: number        // 未知錯誤次數
}

// ===========================================
// 告警詳情 Schema
// ===========================================

interface AlertDetailsSchema {
  // 觸發條件
  triggerCondition?: string     // 觸發條件描述
  triggerValue?: number         // 觸發值
  thresholdValue?: number       // 閾值

  // 連線資訊
  consecutiveFailures?: number  // 連續失敗次數
  lastSuccessAt?: string        // 最後成功時間
  lastErrorMessage?: string     // 最後錯誤訊息

  // 統計資訊
  errorRate?: number            // 錯誤率
  avgResponseMs?: number        // 平均回應時間

  // 影響範圍
  affectedCities?: string[]     // 受影響城市
  affectedWorkflows?: string[]  // 受影響工作流

  // 建議動作
  suggestedActions?: string[]   // 建議的處理動作
}

// ===========================================
// 通知發送記錄 Schema
// ===========================================

interface NotificationsSentSchema {
  notifications: Array<{
    channel: 'email' | 'teams' | 'slack' // 通知管道
    sentAt: string                        // 發送時間
    recipient: string                     // 接收者
    success: boolean                      // 是否成功
    errorMessage?: string                 // 失敗原因
    messageId?: string                    // 訊息 ID（用於追蹤）
  }>
}
```

### 2.3 索引策略

```sql
-- 複合索引：服務健康查詢
CREATE INDEX idx_health_logs_service_time
ON system_health_logs(service, created_at DESC);

-- 複合索引：狀態變化查詢
CREATE INDEX idx_health_logs_status_change
ON system_health_logs(service, previous_status, status)
WHERE previous_status IS NOT NULL;

-- 部分索引：異常狀態監控
CREATE INDEX idx_health_logs_unhealthy
ON system_health_logs(service, created_at DESC)
WHERE status = 'UNHEALTHY';

-- 複合索引：告警查詢
CREATE INDEX idx_alerts_service_status_time
ON alert_records(service, status, created_at DESC);

-- 部分索引：活躍告警
CREATE INDEX idx_alerts_active
ON alert_records(service, severity DESC, created_at DESC)
WHERE status IN ('ACTIVE', 'ACKNOWLEDGED');

-- 統計查詢索引
CREATE INDEX idx_stats_period_query
ON n8n_connection_stats(period_type, period_start DESC, city_code);
```

---

## 3. 類型定義

### 3.1 核心類型

```typescript
// lib/types/healthMonitoring.ts

import { HealthStatus, HealthCheckType, AlertType, AlertSeverity, AlertStatus } from '@prisma/client'

// ===========================================
// 健康檢查結果
// ===========================================

export interface HealthCheckResult {
  success: boolean
  status: HealthStatus
  responseTimeMs?: number
  error?: string
  httpStatus?: number
  details?: HealthCheckDetailsSchema
}

// ===========================================
// n8n 健康狀態
// ===========================================

export interface N8nHealthStatus {
  status: HealthStatus
  lastSuccessAt?: Date
  lastCheckAt?: Date
  consecutiveFailures: number
  stats24h: ConnectionStats24h
  cityStatuses?: CityHealthStatus[]
  activeAlerts: ActiveAlert[]
}

export interface ConnectionStats24h {
  totalCalls: number
  successCalls: number
  failedCalls: number
  successRate: number           // 0-100
  avgResponseMs?: number
  maxResponseMs?: number
  minResponseMs?: number
  errorsByType?: ErrorsByTypeSchema
}

export interface CityHealthStatus {
  cityCode: string
  cityName: string
  status: HealthStatus
  lastCheckAt?: Date
  consecutiveFailures: number
}

export interface ActiveAlert {
  id: string
  alertType: AlertType
  severity: AlertSeverity
  title: string
  message: string
  createdAt: Date
  status: AlertStatus
}

// ===========================================
// 狀態變化記錄
// ===========================================

export interface StatusChangeRecord {
  previousStatus?: HealthStatus
  newStatus: HealthStatus
  reason?: string
  changedAt: Date
  cityCode?: string
  cityName?: string
  responseTimeMs?: number
}

// ===========================================
// 健康歷史記錄
// ===========================================

export interface HealthHistoryEntry {
  status: HealthStatus
  message?: string
  responseTimeMs?: number
  httpStatus?: number
  createdAt: Date
  cityCode?: string
}

// ===========================================
// 告警配置
// ===========================================

export interface AlertThresholds {
  consecutiveFailuresThreshold: number  // 連續失敗次數閾值
  errorRateThreshold: number            // 錯誤率閾值 (0-100)
  responseTimeThreshold: number         // 回應時間閾值 (ms)
  degradedSuccessRateMin: number        // 降級狀態最低成功率
  healthySuccessRateMin: number         // 健康狀態最低成功率
}

export const DEFAULT_ALERT_THRESHOLDS: AlertThresholds = {
  consecutiveFailuresThreshold: 3,
  errorRateThreshold: 30,               // 30% 以上錯誤率觸發告警
  responseTimeThreshold: 10000,         // 10 秒以上視為逾時
  degradedSuccessRateMin: 70,           // 70-90% 為降級
  healthySuccessRateMin: 90,            // 90% 以上為健康
}

// ===========================================
// API 請求/回應類型
// ===========================================

export interface GetHealthParams {
  cityCode?: string
  includeHistory?: boolean
  historyLimit?: number
}

export interface PerformHealthCheckParams {
  cityCode?: string
  checkType?: HealthCheckType
}

export interface GetHealthHistoryParams {
  cityCode?: string
  limit?: number
  startDate?: Date
  endDate?: Date
  status?: HealthStatus
}

export interface GetStatusChangesParams {
  limit?: number
  cityCode?: string
  startDate?: Date
}

export interface CreateAlertParams {
  alertType: AlertType
  severity: AlertSeverity
  title: string
  message: string
  details?: AlertDetailsSchema
  service: string
  cityCode?: string
}

export interface AcknowledgeAlertParams {
  alertId: string
  userId: string
  note?: string
}

export interface ResolveAlertParams {
  alertId: string
  userId: string
  note?: string
}
```

### 3.2 告警服務類型

```typescript
// lib/types/alertService.ts

import { AlertType, AlertSeverity, AlertStatus } from '@prisma/client'

// ===========================================
// 通知管道配置
// ===========================================

export interface EmailNotificationConfig {
  enabled: boolean
  recipients: string[]
  templateId?: string           // Email 範本 ID
}

export interface TeamsNotificationConfig {
  enabled: boolean
  webhookUrl: string
  channelName?: string
}

export interface SlackNotificationConfig {
  enabled: boolean
  webhookUrl: string
  channelId?: string
}

export interface NotificationConfig {
  email?: EmailNotificationConfig
  teams?: TeamsNotificationConfig
  slack?: SlackNotificationConfig
}

// ===========================================
// 通知訊息
// ===========================================

export interface NotificationMessage {
  title: string
  body: string
  severity: AlertSeverity
  service: string
  timestamp: Date
  actionUrl?: string            // 處理連結
  details?: Record<string, unknown>
}

// ===========================================
// 告警摘要
// ===========================================

export interface AlertSummary {
  total: number
  bySeverity: Record<AlertSeverity, number>
  byStatus: Record<AlertStatus, number>
  byService: Record<string, number>
  recentAlerts: Array<{
    id: string
    title: string
    severity: AlertSeverity
    createdAt: Date
  }>
}
```

---

## 4. 服務實現

### 4.1 n8n 健康監控服務

```typescript
// lib/services/n8n/n8nHealthService.ts

import { prisma } from '@/lib/prisma'
import { HealthStatus, HealthCheckType, AlertType, AlertSeverity } from '@prisma/client'
import {
  N8nHealthStatus,
  HealthCheckResult,
  StatusChangeRecord,
  HealthHistoryEntry,
  ConnectionStats24h,
  CityHealthStatus,
  DEFAULT_ALERT_THRESHOLDS,
  AlertThresholds,
} from '@/lib/types/healthMonitoring'
import { webhookConfigService } from './webhookConfigService'
import { alertService } from '../alertService'

export class N8nHealthService {
  private consecutiveFailures: Map<string, number> = new Map()
  private thresholds: AlertThresholds = DEFAULT_ALERT_THRESHOLDS

  // ===========================================
  // 公開方法
  // ===========================================

  /**
   * 獲取整體健康狀態
   */
  async getOverallHealth(): Promise<N8nHealthStatus> {
    // 獲取所有活躍配置
    const configs = await webhookConfigService.listConfigs({ isActive: true })

    if (configs.length === 0) {
      return this.buildUnconfiguredStatus()
    }

    // 並行獲取所有必要數據
    const [
      latestCheck,
      lastSuccess,
      stats24h,
      consecutiveFailures,
      activeAlerts,
    ] = await Promise.all([
      this.getLatestHealthCheck(),
      this.getLastSuccessfulCheck(),
      this.get24HourStats(),
      this.getConsecutiveFailures(),
      alertService.getActiveAlerts('n8n'),
    ])

    // 獲取各城市狀態
    const cityStatuses = await this.getCityStatuses(configs)

    // 判斷整體狀態
    const status = this.determineOverallStatus(consecutiveFailures, stats24h.successRate)

    return {
      status,
      lastSuccessAt: lastSuccess?.createdAt ?? undefined,
      lastCheckAt: latestCheck?.createdAt ?? undefined,
      consecutiveFailures,
      stats24h,
      cityStatuses,
      activeAlerts: activeAlerts.map((alert) => ({
        id: alert.id,
        alertType: alert.alertType,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        createdAt: alert.createdAt,
        status: alert.status,
      })),
    }
  }

  /**
   * 執行健康檢查
   */
  async performHealthCheck(options?: {
    cityCode?: string
    checkType?: HealthCheckType
  }): Promise<HealthCheckResult> {
    const { cityCode, checkType = HealthCheckType.MANUAL } = options || {}

    // 獲取適用的配置
    const config = cityCode
      ? await webhookConfigService.getActiveConfigForCity(cityCode)
      : (await webhookConfigService.listConfigs({ isActive: true }))[0]

    if (!config) {
      return {
        success: false,
        status: HealthStatus.UNCONFIGURED,
        error: 'No active webhook configuration found',
      }
    }

    const configKey = cityCode || 'global'
    const startTime = Date.now()

    try {
      // 執行健康檢查請求
      const testResult = await webhookConfigService.testConnection(config.id)
      const responseTimeMs = Date.now() - startTime

      // 判斷狀態
      let status: HealthStatus
      if (testResult.success) {
        status = HealthStatus.HEALTHY
        this.consecutiveFailures.set(configKey, 0)
      } else {
        status = HealthStatus.UNHEALTHY
        const current = this.consecutiveFailures.get(configKey) || 0
        this.consecutiveFailures.set(configKey, current + 1)
      }

      // 記錄健康檢查結果
      const previousLog = await prisma.systemHealthLog.findFirst({
        where: { service: 'n8n', cityCode },
        orderBy: { createdAt: 'desc' },
      })

      await prisma.systemHealthLog.create({
        data: {
          service: 'n8n',
          serviceUrl: `${config.baseUrl}${config.endpointPath}`,
          status,
          previousStatus: previousLog?.status,
          message: testResult.success ? 'Connection successful' : testResult.error,
          checkType,
          responseTimeMs,
          httpStatus: testResult.statusCode,
          cityCode,
          details: {
            endpoint: `${config.baseUrl}${config.endpointPath}`,
            method: 'POST',
          },
        },
      })

      // 處理告警
      await this.handleStatusChange(configKey, status, previousLog?.status, testResult.error)

      return {
        success: testResult.success,
        status,
        responseTimeMs,
        error: testResult.error,
        httpStatus: testResult.statusCode,
      }
    } catch (error) {
      return await this.handleHealthCheckError(error, configKey, cityCode, checkType, startTime)
    }
  }

  /**
   * 獲取健康歷史記錄
   */
  async getHealthHistory(options: {
    cityCode?: string
    limit?: number
    startDate?: Date
    endDate?: Date
    status?: HealthStatus
  }): Promise<HealthHistoryEntry[]> {
    const { cityCode, limit = 100, startDate, endDate, status } = options

    const where: any = { service: 'n8n' }
    if (cityCode) where.cityCode = cityCode
    if (status) where.status = status
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = startDate
      if (endDate) where.createdAt.lte = endDate
    }

    const logs = await prisma.systemHealthLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
      select: {
        status: true,
        message: true,
        responseTimeMs: true,
        httpStatus: true,
        createdAt: true,
        cityCode: true,
      },
    })

    return logs.map((log) => ({
      status: log.status,
      message: log.message ?? undefined,
      responseTimeMs: log.responseTimeMs ?? undefined,
      httpStatus: log.httpStatus ?? undefined,
      createdAt: log.createdAt,
      cityCode: log.cityCode ?? undefined,
    }))
  }

  /**
   * 獲取狀態變化記錄
   */
  async getStatusChanges(options: {
    limit?: number
    cityCode?: string
  }): Promise<StatusChangeRecord[]> {
    const { limit = 20, cityCode } = options

    const where: any = {
      service: 'n8n',
      previousStatus: { not: null },
    }
    if (cityCode) where.cityCode = cityCode

    const logs = await prisma.systemHealthLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        previousStatus: true,
        status: true,
        message: true,
        responseTimeMs: true,
        createdAt: true,
        cityCode: true,
        city: {
          select: { name: true },
        },
      },
    })

    return logs
      .filter((log) => log.previousStatus !== log.status)
      .map((log) => ({
        previousStatus: log.previousStatus ?? undefined,
        newStatus: log.status,
        reason: log.message ?? undefined,
        changedAt: log.createdAt,
        cityCode: log.cityCode ?? undefined,
        cityName: log.city?.name ?? undefined,
        responseTimeMs: log.responseTimeMs ?? undefined,
      }))
  }

  /**
   * 定期健康檢查（由排程任務調用）
   */
  async scheduledHealthCheck(): Promise<void> {
    const configs = await webhookConfigService.listConfigs({ isActive: true })

    // 並行檢查所有配置
    await Promise.all(
      configs.map((config) =>
        this.performHealthCheck({
          cityCode: config.cityCode ?? undefined,
          checkType: HealthCheckType.SCHEDULED,
        }).catch((error) => {
          console.error(`Health check failed for ${config.cityCode || 'global'}:`, error)
        })
      )
    )
  }

  /**
   * 設定告警閾值
   */
  setThresholds(thresholds: Partial<AlertThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds }
  }

  // ===========================================
  // 私有方法
  // ===========================================

  /**
   * 建立未配置狀態
   */
  private buildUnconfiguredStatus(): N8nHealthStatus {
    return {
      status: HealthStatus.UNCONFIGURED,
      consecutiveFailures: 0,
      stats24h: {
        totalCalls: 0,
        successCalls: 0,
        failedCalls: 0,
        successRate: 0,
      },
      activeAlerts: [],
    }
  }

  /**
   * 獲取最新健康檢查記錄
   */
  private async getLatestHealthCheck() {
    return prisma.systemHealthLog.findFirst({
      where: { service: 'n8n' },
      orderBy: { createdAt: 'desc' },
    })
  }

  /**
   * 獲取最後成功的健康檢查
   */
  private async getLastSuccessfulCheck() {
    return prisma.systemHealthLog.findFirst({
      where: {
        service: 'n8n',
        status: HealthStatus.HEALTHY,
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  /**
   * 獲取 24 小時統計
   */
  private async get24HourStats(): Promise<ConnectionStats24h> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const [stats, successCount, errorStats] = await Promise.all([
      prisma.n8nApiCall.aggregate({
        where: { timestamp: { gte: since } },
        _count: true,
        _avg: { durationMs: true },
        _max: { durationMs: true },
        _min: { durationMs: true },
      }),
      prisma.n8nApiCall.count({
        where: {
          timestamp: { gte: since },
          statusCode: { gte: 200, lt: 300 },
        },
      }),
      prisma.n8nApiCall.groupBy({
        by: ['errorType'],
        where: {
          timestamp: { gte: since },
          statusCode: { gte: 400 },
        },
        _count: true,
      }),
    ])

    const totalCalls = stats._count
    const successCalls = successCount
    const failedCalls = totalCalls - successCalls
    const successRate = totalCalls > 0 ? (successCalls / totalCalls) * 100 : 100

    // 構建錯誤分類
    const errorsByType: Record<string, number> = {}
    errorStats.forEach((stat) => {
      if (stat.errorType) {
        errorsByType[stat.errorType] = stat._count
      }
    })

    return {
      totalCalls,
      successCalls,
      failedCalls,
      successRate,
      avgResponseMs: stats._avg.durationMs ?? undefined,
      maxResponseMs: stats._max.durationMs ?? undefined,
      minResponseMs: stats._min.durationMs ?? undefined,
      errorsByType: Object.keys(errorsByType).length > 0 ? errorsByType : undefined,
    }
  }

  /**
   * 獲取各城市狀態
   */
  private async getCityStatuses(configs: any[]): Promise<CityHealthStatus[]> {
    const cityStatuses: CityHealthStatus[] = []

    for (const config of configs) {
      if (!config.cityCode) continue

      const lastCheck = await prisma.systemHealthLog.findFirst({
        where: {
          service: 'n8n',
          cityCode: config.cityCode,
        },
        orderBy: { createdAt: 'desc' },
      })

      // 計算城市的連續失敗次數
      const recentLogs = await prisma.systemHealthLog.findMany({
        where: {
          service: 'n8n',
          cityCode: config.cityCode,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      })

      let consecutiveFailures = 0
      for (const log of recentLogs) {
        if (log.status === HealthStatus.UNHEALTHY) {
          consecutiveFailures++
        } else {
          break
        }
      }

      cityStatuses.push({
        cityCode: config.cityCode,
        cityName: config.city?.name || config.cityCode,
        status: lastCheck?.status || HealthStatus.UNKNOWN,
        lastCheckAt: lastCheck?.createdAt ?? undefined,
        consecutiveFailures,
      })
    }

    return cityStatuses
  }

  /**
   * 獲取連續失敗次數
   */
  private async getConsecutiveFailures(): Promise<number> {
    const recentLogs = await prisma.systemHealthLog.findMany({
      where: { service: 'n8n' },
      orderBy: { createdAt: 'desc' },
      take: this.thresholds.consecutiveFailuresThreshold + 1,
    })

    let failures = 0
    for (const log of recentLogs) {
      if (log.status === HealthStatus.UNHEALTHY) {
        failures++
      } else {
        break
      }
    }

    return failures
  }

  /**
   * 判斷整體狀態
   */
  private determineOverallStatus(
    consecutiveFailures: number,
    successRate: number
  ): HealthStatus {
    // 連續失敗超過閾值
    if (consecutiveFailures >= this.thresholds.consecutiveFailuresThreshold) {
      return HealthStatus.UNHEALTHY
    }

    // 根據成功率判斷
    if (successRate < this.thresholds.degradedSuccessRateMin) {
      return HealthStatus.UNHEALTHY
    }

    if (successRate < this.thresholds.healthySuccessRateMin) {
      return HealthStatus.DEGRADED
    }

    return HealthStatus.HEALTHY
  }

  /**
   * 處理狀態變化
   */
  private async handleStatusChange(
    configKey: string,
    newStatus: HealthStatus,
    previousStatus: HealthStatus | undefined,
    errorMessage?: string
  ): Promise<void> {
    const consecutiveFailures = this.consecutiveFailures.get(configKey) || 0

    // 狀態從健康變為異常
    if (
      previousStatus === HealthStatus.HEALTHY &&
      newStatus === HealthStatus.UNHEALTHY
    ) {
      if (consecutiveFailures >= this.thresholds.consecutiveFailuresThreshold) {
        await alertService.createAlert({
          alertType: AlertType.CONNECTION_FAILURE,
          severity: AlertSeverity.ERROR,
          title: 'n8n 連接失敗',
          message: `n8n 連接已連續失敗 ${consecutiveFailures} 次`,
          details: {
            consecutiveFailures,
            lastErrorMessage: errorMessage,
            triggerCondition: `連續失敗 >= ${this.thresholds.consecutiveFailuresThreshold}`,
            suggestedActions: [
              '檢查 n8n 服務是否正常運行',
              '確認網路連接正常',
              '驗證 Webhook 配置是否正確',
              '查看 n8n 日誌檔案',
            ],
          },
          service: 'n8n',
          cityCode: configKey === 'global' ? undefined : configKey,
        })
      }
    }

    // 狀態從異常恢復為健康
    if (
      previousStatus === HealthStatus.UNHEALTHY &&
      newStatus === HealthStatus.HEALTHY
    ) {
      await alertService.createAlert({
        alertType: AlertType.SERVICE_RECOVERED,
        severity: AlertSeverity.INFO,
        title: 'n8n 連接已恢復',
        message: 'n8n 服務連接已恢復正常',
        details: {
          triggerCondition: '連接測試成功',
        },
        service: 'n8n',
        cityCode: configKey === 'global' ? undefined : configKey,
      })

      // 自動解決相關的活躍告警
      await alertService.resolveAlertsByService('n8n', {
        note: '服務已自動恢復',
      })
    }

    // 狀態變為降級
    if (newStatus === HealthStatus.DEGRADED && previousStatus !== HealthStatus.DEGRADED) {
      await alertService.createAlert({
        alertType: AlertType.SERVICE_DEGRADED,
        severity: AlertSeverity.WARNING,
        title: 'n8n 服務降級',
        message: '部分 n8n 請求失敗，服務處於降級狀態',
        details: {
          triggerCondition: `成功率低於 ${this.thresholds.healthySuccessRateMin}%`,
          suggestedActions: [
            '監控服務狀態',
            '檢查錯誤日誌',
            '考慮擴展服務資源',
          ],
        },
        service: 'n8n',
        cityCode: configKey === 'global' ? undefined : configKey,
      })
    }
  }

  /**
   * 處理健康檢查錯誤
   */
  private async handleHealthCheckError(
    error: unknown,
    configKey: string,
    cityCode: string | undefined,
    checkType: HealthCheckType,
    startTime: number
  ): Promise<HealthCheckResult> {
    const responseTimeMs = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // 更新連續失敗計數
    const current = this.consecutiveFailures.get(configKey) || 0
    this.consecutiveFailures.set(configKey, current + 1)

    // 獲取前一次狀態
    const previousLog = await prisma.systemHealthLog.findFirst({
      where: { service: 'n8n', cityCode },
      orderBy: { createdAt: 'desc' },
    })

    // 記錄失敗
    await prisma.systemHealthLog.create({
      data: {
        service: 'n8n',
        status: HealthStatus.UNHEALTHY,
        previousStatus: previousLog?.status,
        message: errorMessage,
        checkType,
        responseTimeMs,
        cityCode,
        details: {
          errorCode: error instanceof Error ? error.name : 'UNKNOWN',
        },
      },
    })

    // 處理告警
    await this.handleStatusChange(
      configKey,
      HealthStatus.UNHEALTHY,
      previousLog?.status,
      errorMessage
    )

    return {
      success: false,
      status: HealthStatus.UNHEALTHY,
      responseTimeMs,
      error: errorMessage,
    }
  }
}

// 匯出單例
export const n8nHealthService = new N8nHealthService()
```

### 4.2 告警服務

```typescript
// lib/services/alertService.ts

import { prisma } from '@/lib/prisma'
import { AlertType, AlertSeverity, AlertStatus } from '@prisma/client'
import {
  CreateAlertParams,
  AcknowledgeAlertParams,
  ResolveAlertParams,
  AlertSummary,
} from '@/lib/types/healthMonitoring'
import { NotificationConfig, NotificationMessage } from '@/lib/types/alertService'
import { sendEmail } from '@/lib/utils/email'
import { sendTeamsNotification } from '@/lib/utils/teams'
import { sendSlackNotification } from '@/lib/utils/slack'

export class AlertService {
  // ===========================================
  // 告警管理
  // ===========================================

  /**
   * 創建告警
   */
  async createAlert(params: CreateAlertParams): Promise<string> {
    const { alertType, severity, title, message, details, service, cityCode } = params

    // 檢查是否已有相同的活躍告警
    const existingAlert = await prisma.alertRecord.findFirst({
      where: {
        alertType,
        service,
        cityCode: cityCode || null,
        status: { in: [AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED] },
      },
    })

    if (existingAlert) {
      // 更新現有告警
      await prisma.alertRecord.update({
        where: { id: existingAlert.id },
        data: {
          message,
          details: details as any,
          updatedAt: new Date(),
        },
      })
      return existingAlert.id
    }

    // 創建新告警
    const alert = await prisma.alertRecord.create({
      data: {
        alertType,
        severity,
        title,
        message,
        details: details as any,
        service,
        cityCode,
      },
    })

    // 發送通知
    await this.sendNotifications(alert)

    return alert.id
  }

  /**
   * 確認告警
   */
  async acknowledgeAlert(params: AcknowledgeAlertParams): Promise<void> {
    const { alertId, userId, note } = params

    await prisma.alertRecord.update({
      where: { id: alertId },
      data: {
        status: AlertStatus.ACKNOWLEDGED,
        acknowledgedBy: userId,
        acknowledgedAt: new Date(),
        ...(note && { resolutionNote: note }),
      },
    })
  }

  /**
   * 解決告警
   */
  async resolveAlert(params: ResolveAlertParams): Promise<void> {
    const { alertId, userId, note } = params

    await prisma.alertRecord.update({
      where: { id: alertId },
      data: {
        status: AlertStatus.RESOLVED,
        resolvedBy: userId,
        resolvedAt: new Date(),
        ...(note && { resolutionNote: note }),
      },
    })
  }

  /**
   * 解決服務相關的所有告警
   */
  async resolveAlertsByService(
    service: string,
    options?: { cityCode?: string; note?: string }
  ): Promise<void> {
    await prisma.alertRecord.updateMany({
      where: {
        service,
        ...(options?.cityCode && { cityCode: options.cityCode }),
        status: { in: [AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED] },
      },
      data: {
        status: AlertStatus.RESOLVED,
        resolvedAt: new Date(),
        ...(options?.note && { resolutionNote: options.note }),
      },
    })
  }

  /**
   * 抑制告警
   */
  async suppressAlert(alertId: string, userId: string): Promise<void> {
    await prisma.alertRecord.update({
      where: { id: alertId },
      data: {
        status: AlertStatus.SUPPRESSED,
        acknowledgedBy: userId,
        acknowledgedAt: new Date(),
      },
    })
  }

  // ===========================================
  // 告警查詢
  // ===========================================

  /**
   * 獲取活躍告警
   */
  async getActiveAlerts(service?: string): Promise<any[]> {
    return prisma.alertRecord.findMany({
      where: {
        status: { in: [AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED] },
        ...(service && { service }),
      },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
    })
  }

  /**
   * 獲取告警摘要
   */
  async getAlertSummary(): Promise<AlertSummary> {
    const [
      totalCount,
      bySeverity,
      byStatus,
      byService,
      recentAlerts,
    ] = await Promise.all([
      prisma.alertRecord.count(),
      prisma.alertRecord.groupBy({
        by: ['severity'],
        _count: true,
      }),
      prisma.alertRecord.groupBy({
        by: ['status'],
        _count: true,
      }),
      prisma.alertRecord.groupBy({
        by: ['service'],
        _count: true,
      }),
      prisma.alertRecord.findMany({
        where: { status: AlertStatus.ACTIVE },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          severity: true,
          createdAt: true,
        },
      }),
    ])

    return {
      total: totalCount,
      bySeverity: Object.fromEntries(
        bySeverity.map((s) => [s.severity, s._count])
      ) as Record<AlertSeverity, number>,
      byStatus: Object.fromEntries(
        byStatus.map((s) => [s.status, s._count])
      ) as Record<AlertStatus, number>,
      byService: Object.fromEntries(
        byService.map((s) => [s.service, s._count])
      ) as Record<string, number>,
      recentAlerts,
    }
  }

  /**
   * 獲取告警歷史
   */
  async getAlertHistory(options: {
    service?: string
    alertType?: AlertType
    severity?: AlertSeverity
    status?: AlertStatus
    startDate?: Date
    endDate?: Date
    limit?: number
  }): Promise<any[]> {
    const { service, alertType, severity, status, startDate, endDate, limit = 100 } = options

    const where: any = {}
    if (service) where.service = service
    if (alertType) where.alertType = alertType
    if (severity) where.severity = severity
    if (status) where.status = status
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = startDate
      if (endDate) where.createdAt.lte = endDate
    }

    return prisma.alertRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
    })
  }

  // ===========================================
  // 通知發送
  // ===========================================

  /**
   * 發送通知
   */
  private async sendNotifications(alert: any): Promise<void> {
    const notifications: Array<{
      channel: string
      sentAt: string
      recipient: string
      success: boolean
      errorMessage?: string
    }> = []

    // 獲取通知配置
    const config = await this.getNotificationConfig(alert)
    if (!config) return

    const message: NotificationMessage = {
      title: `[${alert.severity}] ${alert.title}`,
      body: alert.message,
      severity: alert.severity,
      service: alert.service,
      timestamp: alert.createdAt,
      actionUrl: `/admin/alerts/${alert.id}`,
      details: alert.details,
    }

    // Email 通知
    if (config.email?.enabled && this.shouldSendEmail(alert.severity)) {
      try {
        await sendEmail({
          to: config.email.recipients,
          subject: message.title,
          body: this.buildEmailBody(message),
        })
        notifications.push({
          channel: 'email',
          sentAt: new Date().toISOString(),
          recipient: config.email.recipients.join(', '),
          success: true,
        })
      } catch (error) {
        notifications.push({
          channel: 'email',
          sentAt: new Date().toISOString(),
          recipient: config.email.recipients.join(', '),
          success: false,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    // Teams 通知
    if (config.teams?.enabled && this.shouldSendTeams(alert.severity)) {
      try {
        await sendTeamsNotification({
          webhookUrl: config.teams.webhookUrl,
          title: message.title,
          message: message.body,
          severity: message.severity,
          actionUrl: message.actionUrl,
        })
        notifications.push({
          channel: 'teams',
          sentAt: new Date().toISOString(),
          recipient: 'teams-channel',
          success: true,
        })
      } catch (error) {
        notifications.push({
          channel: 'teams',
          sentAt: new Date().toISOString(),
          recipient: 'teams-channel',
          success: false,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    // Slack 通知
    if (config.slack?.enabled && this.shouldSendSlack(alert.severity)) {
      try {
        await sendSlackNotification({
          webhookUrl: config.slack.webhookUrl,
          title: message.title,
          message: message.body,
          severity: message.severity,
        })
        notifications.push({
          channel: 'slack',
          sentAt: new Date().toISOString(),
          recipient: 'slack-channel',
          success: true,
        })
      } catch (error) {
        notifications.push({
          channel: 'slack',
          sentAt: new Date().toISOString(),
          recipient: 'slack-channel',
          success: false,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    // 更新告警記錄的通知狀態
    if (notifications.length > 0) {
      await prisma.alertRecord.update({
        where: { id: alert.id },
        data: { notificationsSent: { notifications } },
      })
    }
  }

  /**
   * 獲取通知配置
   */
  private async getNotificationConfig(alert: any): Promise<NotificationConfig | null> {
    // 查找適用的通知配置
    const configs = await prisma.alertNotificationConfig.findMany({
      where: {
        isActive: true,
        OR: [
          { services: { has: alert.service } },
          { services: { isEmpty: true } },
        ],
      },
    })

    // 過濾符合條件的配置
    const matchingConfig = configs.find(
      (config) =>
        (config.alertTypes.length === 0 || config.alertTypes.includes(alert.alertType)) &&
        this.severityLevel(alert.severity) >= this.severityLevel(config.minSeverity)
    )

    if (!matchingConfig) return null

    return {
      email: matchingConfig.emailEnabled
        ? {
            enabled: true,
            recipients: matchingConfig.emailRecipients,
          }
        : undefined,
      teams: matchingConfig.teamsEnabled && matchingConfig.teamsWebhookUrl
        ? {
            enabled: true,
            webhookUrl: matchingConfig.teamsWebhookUrl,
          }
        : undefined,
      slack: matchingConfig.slackEnabled && matchingConfig.slackWebhookUrl
        ? {
            enabled: true,
            webhookUrl: matchingConfig.slackWebhookUrl,
          }
        : undefined,
    }
  }

  /**
   * 判斷是否應發送 Email
   */
  private shouldSendEmail(severity: AlertSeverity): boolean {
    return severity !== AlertSeverity.INFO
  }

  /**
   * 判斷是否應發送 Teams
   */
  private shouldSendTeams(severity: AlertSeverity): boolean {
    return [AlertSeverity.ERROR, AlertSeverity.CRITICAL].includes(severity)
  }

  /**
   * 判斷是否應發送 Slack
   */
  private shouldSendSlack(severity: AlertSeverity): boolean {
    return [AlertSeverity.ERROR, AlertSeverity.CRITICAL].includes(severity)
  }

  /**
   * 獲取嚴重程度等級
   */
  private severityLevel(severity: AlertSeverity): number {
    const levels: Record<AlertSeverity, number> = {
      INFO: 1,
      WARNING: 2,
      ERROR: 3,
      CRITICAL: 4,
    }
    return levels[severity] || 0
  }

  /**
   * 構建 Email 內容
   */
  private buildEmailBody(message: NotificationMessage): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2 style="color: ${this.getSeverityColor(message.severity)}">${message.title}</h2>
        <p>${message.body}</p>
        <hr />
        <p><strong>服務:</strong> ${message.service}</p>
        <p><strong>時間:</strong> ${message.timestamp.toISOString()}</p>
        ${message.details ? `<pre style="background: #f5f5f5; padding: 10px; overflow: auto;">${JSON.stringify(message.details, null, 2)}</pre>` : ''}
        ${message.actionUrl ? `<p><a href="${message.actionUrl}" style="color: #1976d2;">查看詳情</a></p>` : ''}
      </div>
    `
  }

  /**
   * 獲取嚴重程度對應顏色
   */
  private getSeverityColor(severity: AlertSeverity): string {
    const colors: Record<AlertSeverity, string> = {
      INFO: '#2196f3',
      WARNING: '#ff9800',
      ERROR: '#f44336',
      CRITICAL: '#d32f2f',
    }
    return colors[severity] || '#757575'
  }
}

// 匯出單例
export const alertService = new AlertService()
```

---

## 5. API 路由

### 5.1 健康狀態 API

```typescript
// app/api/admin/n8n-health/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { n8nHealthService } from '@/lib/services/n8n/n8nHealthService'
import { hasRole } from '@/lib/utils/permissions'
import { HealthCheckType } from '@prisma/client'

/**
 * GET /api/admin/n8n-health
 * 獲取 n8n 整體健康狀態
 *
 * Response:
 * - 200: { data: N8nHealthStatus }
 * - 403: Forbidden (non-admin)
 * - 500: Internal server error
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user || !hasRole(session.user, 'ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const health = await n8nHealthService.getOverallHealth()
    return NextResponse.json({ data: health })
  } catch (error) {
    console.error('Get n8n health error:', error)
    return NextResponse.json(
      { error: 'Failed to get health status' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/n8n-health
 * 執行手動健康檢查
 *
 * Query Parameters:
 * - cityCode: string (optional)
 *
 * Response:
 * - 200: { data: HealthCheckResult }
 * - 403: Forbidden (non-admin)
 * - 500: Internal server error
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user || !hasRole(session.user, 'ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const searchParams = request.nextUrl.searchParams
  const cityCode = searchParams.get('cityCode') || undefined

  try {
    const result = await n8nHealthService.performHealthCheck({
      cityCode,
      checkType: HealthCheckType.MANUAL,
    })

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('Health check error:', error)
    return NextResponse.json(
      { error: 'Health check failed' },
      { status: 500 }
    )
  }
}
```

### 5.2 健康歷史 API

```typescript
// app/api/admin/n8n-health/history/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { n8nHealthService } from '@/lib/services/n8n/n8nHealthService'
import { hasRole } from '@/lib/utils/permissions'
import { HealthStatus } from '@prisma/client'

/**
 * GET /api/admin/n8n-health/history
 * 獲取健康檢查歷史
 *
 * Query Parameters:
 * - cityCode: string (optional)
 * - limit: number (default: 100)
 * - startDate: ISO string (optional)
 * - endDate: ISO string (optional)
 * - status: HealthStatus (optional)
 *
 * Response:
 * - 200: { data: HealthHistoryEntry[] }
 * - 403: Forbidden (non-admin)
 * - 500: Internal server error
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user || !hasRole(session.user, 'ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const searchParams = request.nextUrl.searchParams
  const cityCode = searchParams.get('cityCode') || undefined
  const limit = parseInt(searchParams.get('limit') || '100', 10)
  const startDateStr = searchParams.get('startDate')
  const endDateStr = searchParams.get('endDate')
  const status = searchParams.get('status') as HealthStatus | null

  try {
    const history = await n8nHealthService.getHealthHistory({
      cityCode,
      limit: Math.min(limit, 500),
      startDate: startDateStr ? new Date(startDateStr) : undefined,
      endDate: endDateStr ? new Date(endDateStr) : undefined,
      status: status || undefined,
    })

    return NextResponse.json({ data: history })
  } catch (error) {
    console.error('Get health history error:', error)
    return NextResponse.json(
      { error: 'Failed to get health history' },
      { status: 500 }
    )
  }
}
```

### 5.3 狀態變化 API

```typescript
// app/api/admin/n8n-health/changes/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { n8nHealthService } from '@/lib/services/n8n/n8nHealthService'
import { hasRole } from '@/lib/utils/permissions'

/**
 * GET /api/admin/n8n-health/changes
 * 獲取狀態變化記錄
 *
 * Query Parameters:
 * - limit: number (default: 20)
 * - cityCode: string (optional)
 *
 * Response:
 * - 200: { data: StatusChangeRecord[] }
 * - 403: Forbidden (non-admin)
 * - 500: Internal server error
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user || !hasRole(session.user, 'ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const searchParams = request.nextUrl.searchParams
  const limit = parseInt(searchParams.get('limit') || '20', 10)
  const cityCode = searchParams.get('cityCode') || undefined

  try {
    const changes = await n8nHealthService.getStatusChanges({
      limit: Math.min(limit, 100),
      cityCode,
    })

    return NextResponse.json({ data: changes })
  } catch (error) {
    console.error('Get status changes error:', error)
    return NextResponse.json(
      { error: 'Failed to get status changes' },
      { status: 500 }
    )
  }
}
```

### 5.4 告警管理 API

```typescript
// app/api/admin/alerts/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { alertService } from '@/lib/services/alertService'
import { hasRole } from '@/lib/utils/permissions'

/**
 * GET /api/admin/alerts
 * 獲取告警列表
 *
 * Query Parameters:
 * - service: string (optional)
 * - status: AlertStatus (optional)
 * - severity: AlertSeverity (optional)
 * - limit: number (default: 50)
 *
 * Response:
 * - 200: { data: AlertRecord[] }
 * - 403: Forbidden
 * - 500: Internal server error
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user || !hasRole(session.user, 'ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const searchParams = request.nextUrl.searchParams
  const service = searchParams.get('service') || undefined
  const status = searchParams.get('status') as any
  const severity = searchParams.get('severity') as any
  const limit = parseInt(searchParams.get('limit') || '50', 10)

  try {
    const alerts = await alertService.getAlertHistory({
      service,
      status,
      severity,
      limit,
    })

    return NextResponse.json({ data: alerts })
  } catch (error) {
    console.error('Get alerts error:', error)
    return NextResponse.json(
      { error: 'Failed to get alerts' },
      { status: 500 }
    )
  }
}
```

```typescript
// app/api/admin/alerts/[id]/acknowledge/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { alertService } from '@/lib/services/alertService'
import { hasRole } from '@/lib/utils/permissions'

/**
 * POST /api/admin/alerts/[id]/acknowledge
 * 確認告警
 *
 * Body:
 * - note: string (optional)
 *
 * Response:
 * - 200: { success: true }
 * - 403: Forbidden
 * - 500: Internal server error
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user || !hasRole(session.user, 'ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json().catch(() => ({}))

    await alertService.acknowledgeAlert({
      alertId: params.id,
      userId: session.user.id,
      note: body.note,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Acknowledge alert error:', error)
    return NextResponse.json(
      { error: 'Failed to acknowledge alert' },
      { status: 500 }
    )
  }
}
```

```typescript
// app/api/admin/alerts/[id]/resolve/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { alertService } from '@/lib/services/alertService'
import { hasRole } from '@/lib/utils/permissions'

/**
 * POST /api/admin/alerts/[id]/resolve
 * 解決告警
 *
 * Body:
 * - note: string (optional)
 *
 * Response:
 * - 200: { success: true }
 * - 403: Forbidden
 * - 500: Internal server error
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user || !hasRole(session.user, 'ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json().catch(() => ({}))

    await alertService.resolveAlert({
      alertId: params.id,
      userId: session.user.id,
      note: body.note,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Resolve alert error:', error)
    return NextResponse.json(
      { error: 'Failed to resolve alert' },
      { status: 500 }
    )
  }
}
```

---

## 6. 前端組件

### 6.1 n8n 健康狀態組件

```typescript
// components/admin/N8nHealthStatus.tsx

'use client'

import React, { useState } from 'react'
import {
  Box,
  Paper,
  Typography,
  Chip,
  Button,
  CircularProgress,
  Grid,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  Alert,
  Badge,
} from '@mui/material'
import {
  CheckCircle,
  Error,
  Warning,
  HelpOutline,
  Refresh,
  History,
  Notifications,
  ArrowUpward,
  ArrowDownward,
  Settings,
} from '@mui/icons-material'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts'
import { formatDistanceToNow, format } from 'date-fns'
import { zhTW } from 'date-fns/locale'

import { N8nHealthStatus as N8nHealthStatusType } from '@/lib/types/healthMonitoring'
import { useN8nHealth, useHealthCheck } from '@/hooks/useN8nHealth'

// ===========================================
// 常數
// ===========================================

const STATUS_CONFIG: Record<string, {
  label: string
  color: 'success' | 'error' | 'warning' | 'default' | 'info'
  icon: React.ReactNode
  description: string
}> = {
  HEALTHY: {
    label: '正常',
    color: 'success',
    icon: <CheckCircle />,
    description: '服務運作正常',
  },
  DEGRADED: {
    label: '降級',
    color: 'warning',
    icon: <Warning />,
    description: '服務可用但性能下降',
  },
  UNHEALTHY: {
    label: '異常',
    color: 'error',
    icon: <Error />,
    description: '服務無法正常運作',
  },
  UNKNOWN: {
    label: '未知',
    color: 'default',
    icon: <HelpOutline />,
    description: '無法確定狀態',
  },
  UNCONFIGURED: {
    label: '未配置',
    color: 'default',
    icon: <Settings />,
    description: '尚未設定 Webhook 配置',
  },
}

const CHART_COLORS = {
  success: '#4caf50',
  failed: '#f44336',
}

// ===========================================
// 主組件
// ===========================================

export function N8nHealthStatusCard() {
  const { health, isLoading, error, refresh } = useN8nHealth()
  const { performCheck, isChecking } = useHealthCheck()
  const [historyOpen, setHistoryOpen] = useState(false)

  if (isLoading) {
    return (
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      </Paper>
    )
  }

  if (error) {
    return (
      <Paper sx={{ p: 3 }}>
        <Alert severity="error">載入健康狀態失敗：{error.message}</Alert>
      </Paper>
    )
  }

  if (!health) {
    return null
  }

  const config = STATUS_CONFIG[health.status] || STATUS_CONFIG.UNKNOWN

  const handleCheckConnection = async () => {
    await performCheck()
    refresh()
  }

  return (
    <Paper sx={{ p: 3 }}>
      {/* 標題列 */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">n8n 連接狀態</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {health.activeAlerts.length > 0 && (
            <Badge badgeContent={health.activeAlerts.length} color="error">
              <Tooltip title="有活躍告警">
                <IconButton size="small">
                  <Notifications />
                </IconButton>
              </Tooltip>
            </Badge>
          )}
          <Tooltip title="查看歷史">
            <IconButton onClick={() => setHistoryOpen(true)} size="small">
              <History />
            </IconButton>
          </Tooltip>
          <Button
            startIcon={isChecking ? <CircularProgress size={16} /> : <Refresh />}
            onClick={handleCheckConnection}
            disabled={isChecking}
            size="small"
            variant="outlined"
          >
            檢查連線
          </Button>
        </Box>
      </Box>

      {/* 主要狀態 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Chip
          icon={config.icon as React.ReactElement}
          label={config.label}
          color={config.color}
          size="medium"
        />
        <Typography variant="body2" color="text.secondary">
          {config.description}
        </Typography>
        {health.lastCheckAt && (
          <Typography variant="caption" color="text.secondary">
            上次檢查：
            {formatDistanceToNow(new Date(health.lastCheckAt), {
              addSuffix: true,
              locale: zhTW,
            })}
          </Typography>
        )}
      </Box>

      {/* 連續失敗警告 */}
      {health.consecutiveFailures > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          連線已連續失敗 {health.consecutiveFailures} 次
        </Alert>
      )}

      <Divider sx={{ my: 2 }} />

      {/* 統計區域 */}
      <Grid container spacing={3}>
        {/* 圓餅圖 */}
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            24 小時調用統計
          </Typography>
          <Stats24hChart stats={health.stats24h} />
        </Grid>

        {/* 性能指標 */}
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            性能指標
          </Typography>
          <PerformanceMetrics
            stats={health.stats24h}
            lastSuccessAt={health.lastSuccessAt}
          />
        </Grid>
      </Grid>

      {/* 城市狀態 */}
      {health.cityStatuses && health.cityStatuses.length > 0 && (
        <>
          <Divider sx={{ my: 2 }} />
          <CityStatusList cityStatuses={health.cityStatuses} />
        </>
      )}

      {/* 歷史對話框 */}
      <HealthHistoryDialog open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </Paper>
  )
}

// ===========================================
// 子組件：24小時統計圖表
// ===========================================

interface Stats24hChartProps {
  stats: N8nHealthStatusType['stats24h']
}

function Stats24hChart({ stats }: Stats24hChartProps) {
  const chartData = [
    { name: '成功', value: stats.successCalls, color: CHART_COLORS.success },
    { name: '失敗', value: stats.failedCalls, color: CHART_COLORS.failed },
  ]

  const hasData = stats.totalCalls > 0

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <Box sx={{ width: 150, height: 150 }}>
        {hasData ? (
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={60}
                paddingAngle={2}
              >
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <RechartsTooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography color="text.secondary">無數據</Typography>
          </Box>
        )}
      </Box>

      <Box>
        <Typography
          variant="h4"
          color={stats.successRate >= 90 ? 'success.main' : stats.successRate >= 70 ? 'warning.main' : 'error.main'}
        >
          {stats.successRate.toFixed(1)}%
        </Typography>
        <Typography variant="body2" color="text.secondary">
          成功率
        </Typography>
        <Typography variant="caption" color="text.secondary">
          共 {stats.totalCalls} 次調用
        </Typography>
      </Box>
    </Box>
  )
}

// ===========================================
// 子組件：性能指標
// ===========================================

interface PerformanceMetricsProps {
  stats: N8nHealthStatusType['stats24h']
  lastSuccessAt?: Date
}

function PerformanceMetrics({ stats, lastSuccessAt }: PerformanceMetricsProps) {
  return (
    <List dense>
      <ListItem>
        <ListItemText
          primary="總調用次數"
          secondary={stats.totalCalls.toLocaleString()}
        />
      </ListItem>
      <ListItem>
        <ListItemText
          primary="成功 / 失敗"
          secondary={`${stats.successCalls.toLocaleString()} / ${stats.failedCalls.toLocaleString()}`}
        />
      </ListItem>
      <ListItem>
        <ListItemText
          primary="平均回應時間"
          secondary={
            stats.avgResponseMs
              ? `${stats.avgResponseMs.toFixed(0)} ms`
              : '-'
          }
        />
      </ListItem>
      <ListItem>
        <ListItemText
          primary="最後成功時間"
          secondary={
            lastSuccessAt
              ? format(new Date(lastSuccessAt), 'PPpp', { locale: zhTW })
              : '-'
          }
        />
      </ListItem>
    </List>
  )
}

// ===========================================
// 子組件：城市狀態列表
// ===========================================

interface CityStatusListProps {
  cityStatuses: N8nHealthStatusType['cityStatuses']
}

function CityStatusList({ cityStatuses }: CityStatusListProps) {
  if (!cityStatuses || cityStatuses.length === 0) return null

  return (
    <>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        各城市狀態
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {cityStatuses.map((city) => {
          const config = STATUS_CONFIG[city.status] || STATUS_CONFIG.UNKNOWN
          return (
            <Tooltip
              key={city.cityCode}
              title={
                <>
                  <div>
                    {city.lastCheckAt
                      ? `上次檢查：${formatDistanceToNow(new Date(city.lastCheckAt), {
                          addSuffix: true,
                          locale: zhTW,
                        })}`
                      : '未檢查'}
                  </div>
                  {city.consecutiveFailures > 0 && (
                    <div>連續失敗：{city.consecutiveFailures} 次</div>
                  )}
                </>
              }
            >
              <Chip
                icon={config.icon as React.ReactElement}
                label={city.cityName}
                color={config.color}
                size="small"
                variant="outlined"
              />
            </Tooltip>
          )
        })}
      </Box>
    </>
  )
}

// ===========================================
// 子組件：歷史記錄對話框
// ===========================================

interface HealthHistoryDialogProps {
  open: boolean
  onClose: () => void
}

function HealthHistoryDialog({ open, onClose }: HealthHistoryDialogProps) {
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  React.useEffect(() => {
    if (open) {
      loadHistory()
    }
  }, [open])

  const loadHistory = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/n8n-health/changes?limit=30')
      const data = await res.json()
      setHistory(data.data || [])
    } catch (error) {
      console.error('Failed to load history:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>連接狀態歷史</DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : history.length === 0 ? (
          <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
            暫無狀態變化記錄
          </Typography>
        ) : (
          <List>
            {history.map((item, index) => {
              const fromConfig = STATUS_CONFIG[item.previousStatus] || STATUS_CONFIG.UNKNOWN
              const toConfig = STATUS_CONFIG[item.newStatus] || STATUS_CONFIG.UNKNOWN
              const isRecovery = item.newStatus === 'HEALTHY'

              return (
                <ListItem key={index} divider={index < history.length - 1}>
                  <ListItemIcon>
                    {isRecovery ? (
                      <ArrowUpward color="success" />
                    ) : (
                      <ArrowDownward color="error" />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          label={fromConfig.label}
                          color={fromConfig.color}
                          size="small"
                        />
                        <span>→</span>
                        <Chip
                          label={toConfig.label}
                          color={toConfig.color}
                          size="small"
                        />
                        {item.cityCode && (
                          <Typography variant="caption" color="text.secondary">
                            ({item.cityName || item.cityCode})
                          </Typography>
                        )}
                      </Box>
                    }
                    secondary={
                      <>
                        {item.reason && <span>{item.reason}</span>}
                        <br />
                        <span>
                          {format(new Date(item.changedAt), 'PPpp', { locale: zhTW })}
                        </span>
                        {item.responseTimeMs && (
                          <span> ({item.responseTimeMs}ms)</span>
                        )}
                      </>
                    }
                  />
                </ListItem>
              )
            })}
          </List>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

### 6.2 React Query Hooks

```typescript
// hooks/useN8nHealth.ts

import useSWR from 'swr'
import { N8nHealthStatus, HealthCheckResult, StatusChangeRecord } from '@/lib/types/healthMonitoring'

// ===========================================
// 通用 Fetcher
// ===========================================

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || 'Request failed')
  }
  const json = await res.json()
  return json.data
}

// ===========================================
// n8n 健康狀態 Hook
// ===========================================

export function useN8nHealth() {
  const { data, error, isLoading, mutate } = useSWR<N8nHealthStatus>(
    '/api/admin/n8n-health',
    fetcher,
    {
      refreshInterval: 30000, // 30 秒自動刷新
      revalidateOnFocus: true,
    }
  )

  return {
    health: data ?? null,
    isLoading,
    error,
    refresh: mutate,
  }
}

// ===========================================
// 健康檢查 Hook
// ===========================================

export function useHealthCheck() {
  const [isChecking, setIsChecking] = useState(false)
  const [result, setResult] = useState<HealthCheckResult | null>(null)
  const [error, setError] = useState<Error | null>(null)

  const performCheck = async (cityCode?: string) => {
    setIsChecking(true)
    setError(null)

    try {
      const url = cityCode
        ? `/api/admin/n8n-health?cityCode=${cityCode}`
        : '/api/admin/n8n-health'

      const res = await fetch(url, { method: 'POST' })
      if (!res.ok) {
        throw new Error('Health check failed')
      }

      const data = await res.json()
      setResult(data.data)
      return data.data
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
      throw err
    } finally {
      setIsChecking(false)
    }
  }

  return {
    performCheck,
    isChecking,
    result,
    error,
  }
}

// ===========================================
// 狀態變化歷史 Hook
// ===========================================

export function useStatusChanges(options?: {
  limit?: number
  cityCode?: string
}) {
  const params = new URLSearchParams()
  if (options?.limit) params.set('limit', String(options.limit))
  if (options?.cityCode) params.set('cityCode', options.cityCode)

  const queryString = params.toString()
  const url = `/api/admin/n8n-health/changes${queryString ? `?${queryString}` : ''}`

  const { data, error, isLoading, mutate } = useSWR<StatusChangeRecord[]>(
    url,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  )

  return {
    changes: data ?? null,
    isLoading,
    error,
    refresh: mutate,
  }
}

// ===========================================
// 告警 Hook
// ===========================================

export function useAlerts(service?: string) {
  const url = service
    ? `/api/admin/alerts?service=${service}`
    : '/api/admin/alerts'

  const { data, error, isLoading, mutate } = useSWR<any[]>(
    url,
    fetcher,
    {
      refreshInterval: 60000, // 1 分鐘刷新
    }
  )

  const acknowledgeAlert = async (alertId: string, note?: string) => {
    await fetch(`/api/admin/alerts/${alertId}/acknowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note }),
    })
    mutate()
  }

  const resolveAlert = async (alertId: string, note?: string) => {
    await fetch(`/api/admin/alerts/${alertId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note }),
    })
    mutate()
  }

  return {
    alerts: data ?? null,
    isLoading,
    error,
    refresh: mutate,
    acknowledgeAlert,
    resolveAlert,
  }
}

import { useState } from 'react'
```

---

## 7. 測試計畫

### 7.1 單元測試

```typescript
// __tests__/services/n8n/n8nHealthService.test.ts

import { n8nHealthService } from '@/lib/services/n8n/n8nHealthService'
import { prismaMock } from '@/lib/__mocks__/prisma'
import { HealthStatus, HealthCheckType } from '@prisma/client'

describe('N8nHealthService', () => {
  describe('determineOverallStatus', () => {
    it('should return UNHEALTHY when consecutive failures exceed threshold', () => {
      const status = (n8nHealthService as any).determineOverallStatus(3, 95)
      expect(status).toBe(HealthStatus.UNHEALTHY)
    })

    it('should return DEGRADED when success rate is between 70-90%', () => {
      const status = (n8nHealthService as any).determineOverallStatus(0, 85)
      expect(status).toBe(HealthStatus.DEGRADED)
    })

    it('should return HEALTHY when success rate is above 90%', () => {
      const status = (n8nHealthService as any).determineOverallStatus(0, 95)
      expect(status).toBe(HealthStatus.HEALTHY)
    })

    it('should return UNHEALTHY when success rate is below 70%', () => {
      const status = (n8nHealthService as any).determineOverallStatus(0, 60)
      expect(status).toBe(HealthStatus.UNHEALTHY)
    })
  })

  describe('getConsecutiveFailures', () => {
    it('should count consecutive failures correctly', async () => {
      prismaMock.systemHealthLog.findMany.mockResolvedValue([
        { status: HealthStatus.UNHEALTHY },
        { status: HealthStatus.UNHEALTHY },
        { status: HealthStatus.HEALTHY },
      ] as any)

      const failures = await (n8nHealthService as any).getConsecutiveFailures()
      expect(failures).toBe(2)
    })

    it('should return 0 when most recent check is healthy', async () => {
      prismaMock.systemHealthLog.findMany.mockResolvedValue([
        { status: HealthStatus.HEALTHY },
        { status: HealthStatus.UNHEALTHY },
      ] as any)

      const failures = await (n8nHealthService as any).getConsecutiveFailures()
      expect(failures).toBe(0)
    })
  })

  describe('getOverallHealth', () => {
    it('should return UNCONFIGURED when no configs exist', async () => {
      prismaMock.webhookConfig.findMany.mockResolvedValue([])

      const health = await n8nHealthService.getOverallHealth()

      expect(health.status).toBe(HealthStatus.UNCONFIGURED)
      expect(health.consecutiveFailures).toBe(0)
    })

    it('should return complete health status when configs exist', async () => {
      prismaMock.webhookConfig.findMany.mockResolvedValue([
        { id: 'config-1', isActive: true, cityCode: 'TPE' },
      ] as any)
      prismaMock.systemHealthLog.findFirst.mockResolvedValue({
        status: HealthStatus.HEALTHY,
        createdAt: new Date(),
      } as any)
      prismaMock.systemHealthLog.findMany.mockResolvedValue([
        { status: HealthStatus.HEALTHY },
      ] as any)
      prismaMock.n8nApiCall.aggregate.mockResolvedValue({
        _count: 100,
        _avg: { durationMs: 500 },
        _max: { durationMs: 2000 },
        _min: { durationMs: 100 },
      } as any)
      prismaMock.n8nApiCall.count.mockResolvedValue(95)
      prismaMock.n8nApiCall.groupBy.mockResolvedValue([])
      prismaMock.alertRecord.findMany.mockResolvedValue([])

      const health = await n8nHealthService.getOverallHealth()

      expect(health.status).toBe(HealthStatus.HEALTHY)
      expect(health.stats24h.totalCalls).toBe(100)
      expect(health.stats24h.successRate).toBe(95)
    })
  })

  describe('performHealthCheck', () => {
    it('should create health log on successful check', async () => {
      const mockConfig = {
        id: 'config-1',
        baseUrl: 'https://n8n.example.com',
        endpointPath: '/webhook/test',
      }
      prismaMock.webhookConfig.findFirst.mockResolvedValue(mockConfig as any)
      prismaMock.webhookConfig.findUnique.mockResolvedValue(mockConfig as any)
      prismaMock.systemHealthLog.findFirst.mockResolvedValue(null)
      prismaMock.systemHealthLog.create.mockResolvedValue({} as any)

      // Mock successful connection test
      jest.spyOn(n8nHealthService as any, 'webhookConfigService', 'get').mockReturnValue({
        testConnection: jest.fn().mockResolvedValue({ success: true, statusCode: 200 }),
        listConfigs: jest.fn().mockResolvedValue([mockConfig]),
      })

      const result = await n8nHealthService.performHealthCheck({
        checkType: HealthCheckType.MANUAL,
      })

      expect(result.success).toBe(true)
      expect(result.status).toBe(HealthStatus.HEALTHY)
      expect(prismaMock.systemHealthLog.create).toHaveBeenCalled()
    })
  })
})
```

### 7.2 告警服務測試

```typescript
// __tests__/services/alertService.test.ts

import { alertService } from '@/lib/services/alertService'
import { prismaMock } from '@/lib/__mocks__/prisma'
import { AlertType, AlertSeverity, AlertStatus } from '@prisma/client'

describe('AlertService', () => {
  describe('createAlert', () => {
    it('should create new alert when no existing alert', async () => {
      prismaMock.alertRecord.findFirst.mockResolvedValue(null)
      prismaMock.alertRecord.create.mockResolvedValue({
        id: 'alert-1',
        alertType: AlertType.CONNECTION_FAILURE,
        severity: AlertSeverity.ERROR,
      } as any)
      prismaMock.alertNotificationConfig.findMany.mockResolvedValue([])

      const alertId = await alertService.createAlert({
        alertType: AlertType.CONNECTION_FAILURE,
        severity: AlertSeverity.ERROR,
        title: 'Test Alert',
        message: 'Test message',
        service: 'n8n',
      })

      expect(alertId).toBe('alert-1')
      expect(prismaMock.alertRecord.create).toHaveBeenCalled()
    })

    it('should update existing alert instead of creating new', async () => {
      const existingAlert = {
        id: 'alert-existing',
        alertType: AlertType.CONNECTION_FAILURE,
        status: AlertStatus.ACTIVE,
      }
      prismaMock.alertRecord.findFirst.mockResolvedValue(existingAlert as any)
      prismaMock.alertRecord.update.mockResolvedValue(existingAlert as any)

      const alertId = await alertService.createAlert({
        alertType: AlertType.CONNECTION_FAILURE,
        severity: AlertSeverity.ERROR,
        title: 'Test Alert',
        message: 'Updated message',
        service: 'n8n',
      })

      expect(alertId).toBe('alert-existing')
      expect(prismaMock.alertRecord.update).toHaveBeenCalled()
      expect(prismaMock.alertRecord.create).not.toHaveBeenCalled()
    })
  })

  describe('resolveAlertsByService', () => {
    it('should resolve all active alerts for service', async () => {
      prismaMock.alertRecord.updateMany.mockResolvedValue({ count: 2 })

      await alertService.resolveAlertsByService('n8n', {
        note: 'Service recovered',
      })

      expect(prismaMock.alertRecord.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            service: 'n8n',
            status: { in: [AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED] },
          }),
        })
      )
    })
  })
})
```

---

## 8. 部署注意事項

### 8.1 資料庫遷移

```bash
# 1. 建立遷移檔案
npx prisma migrate dev --name add_health_monitoring_tables

# 2. 生成 Prisma Client
npx prisma generate

# 3. 生產環境部署
npx prisma migrate deploy
```

### 8.2 環境變數

```env
# 告警通知配置
ALERT_EMAIL_ENABLED=true
ALERT_EMAIL_RECIPIENTS=admin@example.com,ops@example.com

ALERT_TEAMS_ENABLED=true
ALERT_TEAMS_WEBHOOK_URL=https://outlook.office.com/webhook/xxx

ALERT_SLACK_ENABLED=false
ALERT_SLACK_WEBHOOK_URL=

# 健康檢查配置
HEALTH_CHECK_INTERVAL_MS=300000  # 5 分鐘
HEALTH_CHECK_TIMEOUT_MS=10000    # 10 秒

# 告警閾值
ALERT_CONSECUTIVE_FAILURES_THRESHOLD=3
ALERT_ERROR_RATE_THRESHOLD=30
ALERT_RESPONSE_TIME_THRESHOLD_MS=10000
```

### 8.3 定期排程任務

```typescript
// 使用 Vercel Cron 或 Azure Functions Timer Trigger

// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/health-check",
      "schedule": "*/5 * * * *"
    }
  ]
}

// app/api/cron/health-check/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { n8nHealthService } from '@/lib/services/n8n/n8nHealthService'

export async function GET(request: NextRequest) {
  // 驗證 cron 請求
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await n8nHealthService.scheduledHealthCheck()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Scheduled health check failed:', error)
    return NextResponse.json({ error: 'Health check failed' }, { status: 500 })
  }
}
```

### 8.4 監控指標

```typescript
// 建議的監控指標
const METRICS = {
  // 健康檢查
  'n8n.health.status': 'gauge',                    // 當前狀態 (0=unhealthy, 1=degraded, 2=healthy)
  'n8n.health.check.duration': 'histogram',        // 檢查耗時
  'n8n.health.consecutive_failures': 'gauge',      // 連續失敗次數

  // 調用統計
  'n8n.calls.total': 'counter',                    // 總調用次數
  'n8n.calls.success': 'counter',                  // 成功次數
  'n8n.calls.failed': 'counter',                   // 失敗次數
  'n8n.calls.duration': 'histogram',               // 調用耗時

  // 告警
  'n8n.alerts.active': 'gauge',                    // 活躍告警數
  'n8n.alerts.created': 'counter',                 // 新建告警數
  'n8n.alerts.resolved': 'counter',                // 解決告警數
}
```

---

## 9. 驗收標準對應

| AC | 描述 | 實現方式 |
|----|------|----------|
| AC1 | 連接狀態顯示 | `N8nHealthStatusCard` 組件顯示狀態、最後通訊時間、24小時統計 |
| AC2 | 異常告警 | `handleStatusChange` 在連續失敗 >= 3 次時創建告警並發送通知 |
| AC3 | 狀態歷史記錄 | `HealthHistoryDialog` 顯示狀態變化記錄及原因 |
| AC4 | 自動恢復檢測 | 狀態從 UNHEALTHY 變為 HEALTHY 時自動解決告警並發送恢復通知 |

---

## 10. 開放問題

### 10.1 待確認事項

1. **告警通知頻率**
   - 相同類型告警的冷卻時間應該設為多少？
   - 目前預設 30 分鐘

2. **健康檢查間隔**
   - 建議每 5 分鐘檢查一次
   - 是否需要根據狀態動態調整？（異常時更頻繁）

3. **歷史數據保留**
   - 健康檢查日誌應保留多長時間？
   - 建議：詳細日誌 7 天，聚合統計 90 天

### 10.2 已知限制

1. **即時性**
   - 健康檢查為輪詢機制，非即時
   - 最壞情況下發現異常可能延遲 5 分鐘

2. **跨區域監控**
   - 目前從單一位置執行健康檢查
   - 無法檢測特定區域的網路問題

---

## 11. 參考資料

- [Story 10-7 需求文件](./stories/10-7-n8n-connection-status-monitoring.md)
- [Story 10-2 Tech Spec - Webhook 配置管理](./tech-spec-story-10-2.md)
- [Story 10-5 Tech Spec - 工作流錯誤詳情檢視](./tech-spec-story-10-5.md)
- [Recharts 圖表庫文檔](https://recharts.org/)
- [Microsoft Teams Webhook 文檔](https://docs.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook)
