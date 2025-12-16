# Story 12-3: 錯誤告警配置

## Story 資訊

- **Epic**: 12 - 系統管理與監控
- **功能需求**: FR61 (告警配置)
- **優先級**: High
- **故事點數**: 8
- **相關 Stories**:
  - Story 12-1 (系統健康監控儀表板)
  - Story 12-2 (效能指標追蹤)
  - Story 12-7 (系統日誌查詢)

## 使用者故事

**As a** 系統管理員,
**I want** 配置錯誤告警規則,
**So that** 當系統出現問題時能及時收到通知。

## 驗收標準

### AC1: 告警規則創建

**Given** 系統管理員在告警配置頁面
**When** 創建新告警規則
**Then** 可以設定：
- 告警名稱和描述
- 觸發條件（指標類型、閾值、持續時間）
- 告警級別（資訊/警告/嚴重/緊急）
- 通知管道（Email/Microsoft Teams）
- 通知對象（用戶或群組）

### AC2: 觸發條件類型

**Given** 告警規則
**When** 配置觸發條件
**Then** 支援以下條件類型：
- 服務不可用持續 X 分鐘
- 錯誤率超過 X%
- 回應時間超過 X 毫秒
- 隊列積壓超過 X 筆
- 儲存空間低於 X%

### AC3: 告警通知發送

**Given** 告警觸發
**When** 條件滿足
**Then** 系統發送通知：
- 包含告警名稱、級別、觸發時間
- 包含相關指標數據
- 包含快速連結至監控頁面

### AC4: 恢復通知

**Given** 告警已觸發
**When** 條件恢復正常
**Then** 系統發送恢復通知
**And** 記錄告警持續時間

### AC5: 告警歷史記錄

**Given** 告警歷史
**When** 查看告警記錄
**Then** 顯示所有歷史告警：
- 觸發時間、恢復時間、持續時間
- 告警級別和類型
- 處理狀態（未處理/已確認/已解決）

## 技術規格

### 1. 資料模型

```prisma
// 告警規則
model AlertRule {
  id              String    @id @default(cuid())

  // 基本資訊
  name            String
  description     String?
  isActive        Boolean   @default(true)

  // 觸發條件
  conditionType   AlertConditionType
  metric          String    // 監控的指標名稱
  operator        AlertOperator
  threshold       Float
  duration        Int       // 持續時間（秒）

  // 進階條件
  serviceName     String?   // 特定服務
  endpoint        String?   // 特定端點

  // 告警級別
  severity        AlertSeverity

  // 通知設定
  channels        Json      // AlertChannel[]
  recipients      Json      // string[] - 用戶 ID 或 Email

  // 冷卻時間
  cooldownMinutes Int       @default(15)  // 同一告警再次觸發的最小間隔

  // 創建者
  createdById     String
  createdBy       User      @relation(fields: [createdById], references: [id])

  // 時間記錄
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  // 關聯
  alerts          Alert[]

  @@index([isActive])
  @@index([conditionType])
}

enum AlertConditionType {
  SERVICE_DOWN        // 服務不可用
  ERROR_RATE          // 錯誤率
  RESPONSE_TIME       // 回應時間
  QUEUE_BACKLOG       // 隊列積壓
  STORAGE_LOW         // 儲存空間不足
  CPU_HIGH            // CPU 使用率高
  MEMORY_HIGH         // 記憶體使用率高
  CUSTOM_METRIC       // 自定義指標
}

enum AlertOperator {
  GREATER_THAN        // >
  GREATER_THAN_EQ     // >=
  LESS_THAN           // <
  LESS_THAN_EQ        // <=
  EQUALS              // =
  NOT_EQUALS          // !=
}

enum AlertSeverity {
  INFO                // 資訊
  WARNING             // 警告
  CRITICAL            // 嚴重
  EMERGENCY           // 緊急
}

// 告警實例
model Alert {
  id              String    @id @default(cuid())

  // 規則關聯
  ruleId          String
  rule            AlertRule @relation(fields: [ruleId], references: [id])

  // 狀態
  status          AlertStatus @default(FIRING)
  acknowledgedBy  String?
  acknowledgedAt  DateTime?
  resolvedBy      String?
  resolvedAt      DateTime?
  resolution      String?   // 解決說明

  // 觸發資訊
  triggeredValue  Float     // 觸發時的值
  triggeredAt     DateTime  @default(now())
  recoveredAt     DateTime?

  // 詳細資訊
  details         Json?     // 額外的上下文資訊
  metricData      Json?     // 觸發時的指標數據

  // 通知記錄
  notificationsSent Json?   // 發送的通知記錄

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([ruleId])
  @@index([status])
  @@index([triggeredAt])
}

enum AlertStatus {
  FIRING            // 告警中
  ACKNOWLEDGED      // 已確認
  RESOLVED          // 已解決
  RECOVERED         // 自動恢復
}

// 通知發送記錄
model AlertNotification {
  id              String    @id @default(cuid())
  alertId         String
  channel         NotificationChannel
  recipient       String
  subject         String
  body            String    @db.Text
  status          NotificationStatus
  errorMessage    String?
  sentAt          DateTime?
  createdAt       DateTime  @default(now())

  @@index([alertId])
  @@index([status])
}

enum NotificationChannel {
  EMAIL
  TEAMS
  WEBHOOK
}

enum NotificationStatus {
  PENDING
  SENT
  FAILED
}
```

### 2. 告警規則服務

```typescript
// lib/services/monitoring/alertRuleService.ts
import { prisma } from '@/lib/prisma'
import { AlertConditionType, AlertOperator, AlertSeverity } from '@prisma/client'

export interface CreateAlertRuleRequest {
  name: string
  description?: string
  conditionType: AlertConditionType
  metric: string
  operator: AlertOperator
  threshold: number
  duration: number
  serviceName?: string
  endpoint?: string
  severity: AlertSeverity
  channels: Array<{
    type: 'EMAIL' | 'TEAMS' | 'WEBHOOK'
    config: Record<string, any>
  }>
  recipients: string[]
  cooldownMinutes?: number
}

export interface AlertRuleResponse {
  id: string
  name: string
  description?: string
  isActive: boolean
  conditionType: string
  metric: string
  operator: string
  threshold: number
  duration: number
  severity: string
  channels: any[]
  recipients: string[]
  cooldownMinutes: number
  createdAt: string
  updatedAt: string
}

export class AlertRuleService {
  // 創建告警規則
  async createRule(
    request: CreateAlertRuleRequest,
    userId: string
  ): Promise<AlertRuleResponse> {
    const rule = await prisma.alertRule.create({
      data: {
        name: request.name,
        description: request.description,
        conditionType: request.conditionType,
        metric: request.metric,
        operator: request.operator,
        threshold: request.threshold,
        duration: request.duration,
        serviceName: request.serviceName,
        endpoint: request.endpoint,
        severity: request.severity,
        channels: request.channels,
        recipients: request.recipients,
        cooldownMinutes: request.cooldownMinutes || 15,
        createdById: userId,
      },
    })

    return this.toResponse(rule)
  }

  // 更新告警規則
  async updateRule(
    ruleId: string,
    updates: Partial<CreateAlertRuleRequest>,
    userId: string
  ): Promise<AlertRuleResponse | null> {
    const existing = await prisma.alertRule.findFirst({
      where: { id: ruleId, createdById: userId },
    })

    if (!existing) return null

    const rule = await prisma.alertRule.update({
      where: { id: ruleId },
      data: {
        name: updates.name,
        description: updates.description,
        conditionType: updates.conditionType,
        metric: updates.metric,
        operator: updates.operator,
        threshold: updates.threshold,
        duration: updates.duration,
        serviceName: updates.serviceName,
        endpoint: updates.endpoint,
        severity: updates.severity,
        channels: updates.channels,
        recipients: updates.recipients,
        cooldownMinutes: updates.cooldownMinutes,
      },
    })

    return this.toResponse(rule)
  }

  // 啟用/停用規則
  async toggleRule(ruleId: string, isActive: boolean): Promise<boolean> {
    await prisma.alertRule.update({
      where: { id: ruleId },
      data: { isActive },
    })
    return true
  }

  // 刪除規則
  async deleteRule(ruleId: string): Promise<boolean> {
    await prisma.alertRule.delete({
      where: { id: ruleId },
    })
    return true
  }

  // 獲取規則列表
  async listRules(options?: {
    isActive?: boolean
    severity?: AlertSeverity
    page?: number
    pageSize?: number
  }): Promise<{
    items: AlertRuleResponse[]
    total: number
    page: number
    pageSize: number
  }> {
    const { isActive, severity, page = 1, pageSize = 20 } = options || {}

    const where: any = {}
    if (isActive !== undefined) where.isActive = isActive
    if (severity) where.severity = severity

    const [rules, total] = await Promise.all([
      prisma.alertRule.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.alertRule.count({ where }),
    ])

    return {
      items: rules.map((r) => this.toResponse(r)),
      total,
      page,
      pageSize,
    }
  }

  // 獲取規則詳情
  async getRule(ruleId: string): Promise<AlertRuleResponse | null> {
    const rule = await prisma.alertRule.findUnique({
      where: { id: ruleId },
    })

    return rule ? this.toResponse(rule) : null
  }

  // 獲取活躍規則（用於評估）
  async getActiveRules(): Promise<any[]> {
    return prisma.alertRule.findMany({
      where: { isActive: true },
    })
  }

  private toResponse(rule: any): AlertRuleResponse {
    return {
      id: rule.id,
      name: rule.name,
      description: rule.description || undefined,
      isActive: rule.isActive,
      conditionType: rule.conditionType,
      metric: rule.metric,
      operator: rule.operator,
      threshold: rule.threshold,
      duration: rule.duration,
      severity: rule.severity,
      channels: rule.channels as any[],
      recipients: rule.recipients as string[],
      cooldownMinutes: rule.cooldownMinutes,
      createdAt: rule.createdAt.toISOString(),
      updatedAt: rule.updatedAt.toISOString(),
    }
  }
}

export const alertRuleService = new AlertRuleService()
```

### 3. 告警評估服務

```typescript
// lib/services/monitoring/alertEvaluationService.ts
import { prisma } from '@/lib/prisma'
import { AlertConditionType, AlertOperator, AlertRule, AlertStatus } from '@prisma/client'
import { alertNotificationService } from './alertNotificationService'
import { healthCheckService } from './healthCheckService'
import { performanceService } from './performanceService'

interface MetricValue {
  value: number
  timestamp: Date
  details?: Record<string, any>
}

export class AlertEvaluationService {
  // 評估所有活躍規則
  async evaluateAllRules(): Promise<void> {
    const rules = await prisma.alertRule.findMany({
      where: { isActive: true },
    })

    for (const rule of rules) {
      try {
        await this.evaluateRule(rule)
      } catch (error) {
        console.error(`Error evaluating rule ${rule.id}:`, error)
      }
    }
  }

  // 評估單一規則
  async evaluateRule(rule: AlertRule): Promise<void> {
    // 獲取當前指標值
    const metric = await this.getMetricValue(rule)

    if (!metric) {
      console.warn(`Could not get metric value for rule ${rule.id}`)
      return
    }

    // 檢查是否滿足觸發條件
    const isTriggered = this.checkCondition(
      metric.value,
      rule.operator,
      rule.threshold
    )

    // 獲取現有的告警
    const existingAlert = await prisma.alert.findFirst({
      where: {
        ruleId: rule.id,
        status: { in: ['FIRING', 'ACKNOWLEDGED'] },
      },
      orderBy: { triggeredAt: 'desc' },
    })

    if (isTriggered) {
      if (!existingAlert) {
        // 檢查冷卻時間
        const lastAlert = await prisma.alert.findFirst({
          where: { ruleId: rule.id },
          orderBy: { triggeredAt: 'desc' },
        })

        if (lastAlert) {
          const cooldownEnd = new Date(
            lastAlert.triggeredAt.getTime() + rule.cooldownMinutes * 60 * 1000
          )
          if (new Date() < cooldownEnd) {
            console.log(`Rule ${rule.id} is in cooldown period`)
            return
          }
        }

        // 創建新告警
        await this.createAlert(rule, metric)
      }
    } else {
      if (existingAlert && existingAlert.status === 'FIRING') {
        // 恢復告警
        await this.recoverAlert(existingAlert.id, metric)
      }
    }
  }

  // 獲取指標值
  private async getMetricValue(rule: AlertRule): Promise<MetricValue | null> {
    const since = new Date(Date.now() - rule.duration * 1000)

    switch (rule.conditionType) {
      case 'SERVICE_DOWN':
        return this.getServiceHealthMetric(rule.serviceName!)

      case 'ERROR_RATE':
        return this.getErrorRateMetric(since, rule.endpoint)

      case 'RESPONSE_TIME':
        return this.getResponseTimeMetric(since, rule.endpoint)

      case 'QUEUE_BACKLOG':
        return this.getQueueBacklogMetric()

      case 'STORAGE_LOW':
        return this.getStorageMetric()

      case 'CPU_HIGH':
        return this.getCpuMetric(since)

      case 'MEMORY_HIGH':
        return this.getMemoryMetric(since)

      default:
        return null
    }
  }

  // 服務健康指標
  private async getServiceHealthMetric(serviceName: string): Promise<MetricValue> {
    const health = await healthCheckService.getOverallHealth()
    const service = health.services.find((s) => s.serviceName === serviceName)

    return {
      value: service?.status === 'HEALTHY' ? 1 : 0,
      timestamp: new Date(),
      details: { serviceName, status: service?.status },
    }
  }

  // 錯誤率指標
  private async getErrorRateMetric(
    since: Date,
    endpoint?: string | null
  ): Promise<MetricValue> {
    const where: any = { timestamp: { gt: since } }
    if (endpoint) where.endpoint = endpoint

    const metrics = await prisma.apiPerformanceMetric.findMany({
      where,
      select: { statusCode: true },
    })

    if (metrics.length === 0) {
      return { value: 0, timestamp: new Date() }
    }

    const errors = metrics.filter((m) => m.statusCode >= 400).length
    const errorRate = (errors / metrics.length) * 100

    return {
      value: errorRate,
      timestamp: new Date(),
      details: { totalRequests: metrics.length, errors, endpoint },
    }
  }

  // 回應時間指標 (P95)
  private async getResponseTimeMetric(
    since: Date,
    endpoint?: string | null
  ): Promise<MetricValue> {
    const where: any = { timestamp: { gt: since } }
    if (endpoint) where.endpoint = endpoint

    const metrics = await prisma.apiPerformanceMetric.findMany({
      where,
      select: { responseTime: true },
    })

    if (metrics.length === 0) {
      return { value: 0, timestamp: new Date() }
    }

    const times = metrics.map((m) => m.responseTime).sort((a, b) => a - b)
    const p95Index = Math.ceil(0.95 * times.length) - 1
    const p95 = times[Math.max(0, p95Index)]

    return {
      value: p95,
      timestamp: new Date(),
      details: { sampleSize: metrics.length, endpoint },
    }
  }

  // 隊列積壓指標
  private async getQueueBacklogMetric(): Promise<MetricValue> {
    const pendingTasks = await prisma.document.count({
      where: { status: 'PENDING' },
    })

    return {
      value: pendingTasks,
      timestamp: new Date(),
    }
  }

  // 儲存空間指標
  private async getStorageMetric(): Promise<MetricValue> {
    // 這裡需要調用 Azure Blob Storage API 獲取使用量
    // 簡化實現，返回模擬值
    const usedPercent = 50 // 實際應從 Azure 獲取

    return {
      value: 100 - usedPercent, // 返回剩餘百分比
      timestamp: new Date(),
    }
  }

  // CPU 指標
  private async getCpuMetric(since: Date): Promise<MetricValue> {
    const metrics = await prisma.systemResourceMetric.findMany({
      where: { timestamp: { gt: since } },
      select: { cpuUsage: true },
      orderBy: { timestamp: 'desc' },
      take: 10,
    })

    if (metrics.length === 0) {
      return { value: 0, timestamp: new Date() }
    }

    const avgCpu = metrics.reduce((sum, m) => sum + m.cpuUsage, 0) / metrics.length

    return {
      value: avgCpu,
      timestamp: new Date(),
      details: { sampleSize: metrics.length },
    }
  }

  // 記憶體指標
  private async getMemoryMetric(since: Date): Promise<MetricValue> {
    const metrics = await prisma.systemResourceMetric.findMany({
      where: { timestamp: { gt: since } },
      select: { memoryUsage: true },
      orderBy: { timestamp: 'desc' },
      take: 10,
    })

    if (metrics.length === 0) {
      return { value: 0, timestamp: new Date() }
    }

    const avgMemory = metrics.reduce((sum, m) => sum + m.memoryUsage, 0) / metrics.length

    return {
      value: avgMemory,
      timestamp: new Date(),
      details: { sampleSize: metrics.length },
    }
  }

  // 檢查條件
  private checkCondition(
    value: number,
    operator: AlertOperator,
    threshold: number
  ): boolean {
    switch (operator) {
      case 'GREATER_THAN':
        return value > threshold
      case 'GREATER_THAN_EQ':
        return value >= threshold
      case 'LESS_THAN':
        return value < threshold
      case 'LESS_THAN_EQ':
        return value <= threshold
      case 'EQUALS':
        return value === threshold
      case 'NOT_EQUALS':
        return value !== threshold
      default:
        return false
    }
  }

  // 創建告警
  private async createAlert(rule: AlertRule, metric: MetricValue): Promise<void> {
    const alert = await prisma.alert.create({
      data: {
        ruleId: rule.id,
        status: 'FIRING',
        triggeredValue: metric.value,
        details: metric.details,
        metricData: {
          metric: rule.metric,
          threshold: rule.threshold,
          operator: rule.operator,
          duration: rule.duration,
        },
      },
      include: { rule: true },
    })

    console.log(`Alert triggered: ${rule.name} (${alert.id})`)

    // 發送通知
    await alertNotificationService.sendAlertNotification(alert, 'triggered')
  }

  // 恢復告警
  private async recoverAlert(alertId: string, metric: MetricValue): Promise<void> {
    const alert = await prisma.alert.update({
      where: { id: alertId },
      data: {
        status: 'RECOVERED',
        recoveredAt: new Date(),
      },
      include: { rule: true },
    })

    console.log(`Alert recovered: ${alert.rule.name} (${alertId})`)

    // 發送恢復通知
    await alertNotificationService.sendAlertNotification(alert, 'recovered')
  }
}

export const alertEvaluationService = new AlertEvaluationService()
```

### 4. 告警通知服務

```typescript
// lib/services/monitoring/alertNotificationService.ts
import { prisma } from '@/lib/prisma'
import { Alert, AlertRule, NotificationChannel } from '@prisma/client'

interface AlertWithRule extends Alert {
  rule: AlertRule
}

export class AlertNotificationService {
  // 發送告警通知
  async sendAlertNotification(
    alert: AlertWithRule,
    type: 'triggered' | 'recovered'
  ): Promise<void> {
    const channels = alert.rule.channels as Array<{
      type: string
      config: Record<string, any>
    }>
    const recipients = alert.rule.recipients as string[]

    const { subject, body } = this.buildNotificationContent(alert, type)

    // 記錄發送的通知
    const notificationsSent: any[] = []

    for (const channel of channels) {
      for (const recipient of recipients) {
        try {
          await this.sendToChannel(channel.type as NotificationChannel, {
            recipient,
            subject,
            body,
            config: channel.config,
          })

          await prisma.alertNotification.create({
            data: {
              alertId: alert.id,
              channel: channel.type as NotificationChannel,
              recipient,
              subject,
              body,
              status: 'SENT',
              sentAt: new Date(),
            },
          })

          notificationsSent.push({
            channel: channel.type,
            recipient,
            status: 'sent',
            sentAt: new Date().toISOString(),
          })
        } catch (error) {
          await prisma.alertNotification.create({
            data: {
              alertId: alert.id,
              channel: channel.type as NotificationChannel,
              recipient,
              subject,
              body,
              status: 'FAILED',
              errorMessage: error instanceof Error ? error.message : 'Unknown error',
            },
          })

          notificationsSent.push({
            channel: channel.type,
            recipient,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      }
    }

    // 更新告警的通知記錄
    await prisma.alert.update({
      where: { id: alert.id },
      data: { notificationsSent },
    })
  }

  // 構建通知內容
  private buildNotificationContent(
    alert: AlertWithRule,
    type: 'triggered' | 'recovered'
  ): { subject: string; body: string } {
    const severityEmoji = {
      INFO: 'ℹ️',
      WARNING: '⚠️',
      CRITICAL: '🔴',
      EMERGENCY: '🚨',
    }[alert.rule.severity]

    const statusText = type === 'triggered' ? 'TRIGGERED' : 'RECOVERED'
    const statusEmoji = type === 'triggered' ? '🔔' : '✅'

    const subject = `${statusEmoji} [${alert.rule.severity}] ${alert.rule.name} - ${statusText}`

    const metricData = alert.metricData as Record<string, any>
    const duration =
      type === 'recovered' && alert.recoveredAt
        ? this.formatDuration(alert.triggeredAt, alert.recoveredAt)
        : null

    const body = `
${severityEmoji} **Alert ${statusText}**

**Name:** ${alert.rule.name}
**Severity:** ${alert.rule.severity}
**Condition:** ${alert.rule.metric} ${this.formatOperator(alert.rule.operator)} ${alert.rule.threshold}
**Current Value:** ${alert.triggeredValue}
**Triggered At:** ${alert.triggeredAt.toISOString()}
${duration ? `**Duration:** ${duration}` : ''}
${type === 'recovered' ? `**Recovered At:** ${alert.recoveredAt?.toISOString()}` : ''}

${alert.rule.description ? `**Description:** ${alert.rule.description}` : ''}

[View in Dashboard](${process.env.NEXT_PUBLIC_APP_URL}/admin/monitoring/alerts/${alert.id})
    `.trim()

    return { subject, body }
  }

  // 格式化運算符
  private formatOperator(operator: string): string {
    const map: Record<string, string> = {
      GREATER_THAN: '>',
      GREATER_THAN_EQ: '>=',
      LESS_THAN: '<',
      LESS_THAN_EQ: '<=',
      EQUALS: '=',
      NOT_EQUALS: '!=',
    }
    return map[operator] || operator
  }

  // 格式化持續時間
  private formatDuration(start: Date, end: Date): string {
    const durationMs = end.getTime() - start.getTime()
    const minutes = Math.floor(durationMs / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`
    if (hours > 0) return `${hours}h ${minutes % 60}m`
    return `${minutes}m`
  }

  // 發送到指定管道
  private async sendToChannel(
    channel: NotificationChannel,
    options: {
      recipient: string
      subject: string
      body: string
      config: Record<string, any>
    }
  ): Promise<void> {
    switch (channel) {
      case 'EMAIL':
        await this.sendEmail(options)
        break
      case 'TEAMS':
        await this.sendTeams(options)
        break
      case 'WEBHOOK':
        await this.sendWebhook(options)
        break
    }
  }

  // 發送 Email
  private async sendEmail(options: {
    recipient: string
    subject: string
    body: string
    config: Record<string, any>
  }): Promise<void> {
    // 使用 nodemailer 或其他郵件服務
    const nodemailer = require('nodemailer')

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })

    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'alerts@example.com',
      to: options.recipient,
      subject: options.subject,
      text: options.body,
      html: options.body.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'),
    })
  }

  // 發送 Microsoft Teams
  private async sendTeams(options: {
    recipient: string
    subject: string
    body: string
    config: Record<string, any>
  }): Promise<void> {
    const webhookUrl = options.config.webhookUrl || process.env.TEAMS_WEBHOOK_URL

    if (!webhookUrl) {
      throw new Error('Teams webhook URL not configured')
    }

    const card = {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: this.getSeverityColor(options.config.severity),
      summary: options.subject,
      sections: [
        {
          activityTitle: options.subject,
          facts: this.parseBodyToFacts(options.body),
          markdown: true,
        },
      ],
      potentialAction: [
        {
          '@type': 'OpenUri',
          name: 'View in Dashboard',
          targets: [
            {
              os: 'default',
              uri: `${process.env.NEXT_PUBLIC_APP_URL}/admin/monitoring/alerts`,
            },
          ],
        },
      ],
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card),
    })

    if (!response.ok) {
      throw new Error(`Teams webhook failed: ${response.status}`)
    }
  }

  // 發送 Webhook
  private async sendWebhook(options: {
    recipient: string
    subject: string
    body: string
    config: Record<string, any>
  }): Promise<void> {
    const webhookUrl = options.config.url || options.recipient

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.config.headers,
      },
      body: JSON.stringify({
        subject: options.subject,
        body: options.body,
        timestamp: new Date().toISOString(),
      }),
    })

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status}`)
    }
  }

  // 獲取嚴重度顏色
  private getSeverityColor(severity?: string): string {
    const colors: Record<string, string> = {
      INFO: '0076D7',
      WARNING: 'FFA500',
      CRITICAL: 'FF0000',
      EMERGENCY: '8B0000',
    }
    return colors[severity || 'INFO'] || '0076D7'
  }

  // 解析 body 為 facts
  private parseBodyToFacts(body: string): Array<{ name: string; value: string }> {
    const facts: Array<{ name: string; value: string }> = []
    const lines = body.split('\n')

    for (const line of lines) {
      const match = line.match(/\*\*(.+?):\*\*\s*(.+)/)
      if (match) {
        facts.push({ name: match[1], value: match[2] })
      }
    }

    return facts
  }
}

export const alertNotificationService = new AlertNotificationService()
```

### 5. 告警評估排程任務

```typescript
// lib/jobs/alertEvaluationJob.ts
import { alertEvaluationService } from '@/lib/services/monitoring/alertEvaluationService'

export class AlertEvaluationJob {
  private intervalId: NodeJS.Timeout | null = null

  // 啟動告警評估排程
  start(intervalMs: number = 60000): void {
    if (this.intervalId) {
      console.warn('Alert evaluation job already running')
      return
    }

    console.log('Starting alert evaluation job')

    // 定期評估
    this.intervalId = setInterval(async () => {
      try {
        await alertEvaluationService.evaluateAllRules()
      } catch (error) {
        console.error('Alert evaluation error:', error)
      }
    }, intervalMs)
  }

  // 停止排程
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
      console.log('Alert evaluation job stopped')
    }
  }

  // 手動觸發評估
  async runOnce(): Promise<void> {
    await alertEvaluationService.evaluateAllRules()
  }
}

export const alertEvaluationJob = new AlertEvaluationJob()
```

### 6. API 路由

```typescript
// app/api/admin/alerts/rules/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { alertRuleService } from '@/lib/services/monitoring/alertRuleService'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'

const createRuleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  conditionType: z.enum([
    'SERVICE_DOWN', 'ERROR_RATE', 'RESPONSE_TIME',
    'QUEUE_BACKLOG', 'STORAGE_LOW', 'CPU_HIGH', 'MEMORY_HIGH', 'CUSTOM_METRIC'
  ]),
  metric: z.string().min(1),
  operator: z.enum([
    'GREATER_THAN', 'GREATER_THAN_EQ', 'LESS_THAN',
    'LESS_THAN_EQ', 'EQUALS', 'NOT_EQUALS'
  ]),
  threshold: z.number(),
  duration: z.number().min(30).max(3600),
  serviceName: z.string().optional(),
  endpoint: z.string().optional(),
  severity: z.enum(['INFO', 'WARNING', 'CRITICAL', 'EMERGENCY']),
  channels: z.array(z.object({
    type: z.enum(['EMAIL', 'TEAMS', 'WEBHOOK']),
    config: z.record(z.any()),
  })).min(1),
  recipients: z.array(z.string()).min(1),
  cooldownMinutes: z.number().min(5).max(1440).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || !['ADMIN', 'SUPER_USER'].includes(session.user.role)) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Admin access required' } },
        { status: 403 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const options = {
      isActive: searchParams.get('isActive') === 'true' ? true :
                searchParams.get('isActive') === 'false' ? false : undefined,
      severity: searchParams.get('severity') as any || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      pageSize: Math.min(parseInt(searchParams.get('pageSize') || '20'), 100),
    }

    const result = await alertRuleService.listRules(options)

    return NextResponse.json({ data: result }, { status: 200 })
  } catch (error) {
    console.error('List alert rules error:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to list alert rules' } },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || !['ADMIN', 'SUPER_USER'].includes(session.user.role)) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Admin access required' } },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validated = createRuleSchema.parse(body)

    const rule = await alertRuleService.createRule(validated as any, session.user.id)

    return NextResponse.json({ data: rule }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request parameters',
            details: error.errors,
          },
        },
        { status: 400 }
      )
    }

    console.error('Create alert rule error:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create alert rule' } },
      { status: 500 }
    )
  }
}
```

## 測試案例

### 單元測試

```typescript
// __tests__/services/monitoring/alertEvaluationService.test.ts
import { alertEvaluationService } from '@/lib/services/monitoring/alertEvaluationService'
import { prismaMock } from '@/lib/__mocks__/prisma'

describe('AlertEvaluationService', () => {
  describe('checkCondition', () => {
    it('should correctly evaluate GREATER_THAN', () => {
      expect(
        alertEvaluationService['checkCondition'](100, 'GREATER_THAN', 50)
      ).toBe(true)
      expect(
        alertEvaluationService['checkCondition'](50, 'GREATER_THAN', 100)
      ).toBe(false)
    })

    it('should correctly evaluate LESS_THAN', () => {
      expect(
        alertEvaluationService['checkCondition'](50, 'LESS_THAN', 100)
      ).toBe(true)
    })
  })

  describe('evaluateRule', () => {
    it('should create alert when condition is met', async () => {
      const rule = {
        id: 'rule-1',
        conditionType: 'ERROR_RATE',
        metric: 'api_error_rate',
        operator: 'GREATER_THAN',
        threshold: 5,
        duration: 300,
        cooldownMinutes: 15,
      } as any

      prismaMock.apiPerformanceMetric.findMany.mockResolvedValue([
        { statusCode: 500 },
        { statusCode: 500 },
        { statusCode: 200 },
      ] as any)

      prismaMock.alert.findFirst.mockResolvedValue(null)
      prismaMock.alert.create.mockResolvedValue({ id: 'alert-1' } as any)

      await alertEvaluationService.evaluateRule(rule)

      expect(prismaMock.alert.create).toHaveBeenCalled()
    })
  })
})
```

## 部署注意事項

1. **通知管道配置**
   - SMTP 設定用於 Email
   - Teams Webhook URL 配置

2. **評估頻率**
   - 預設每 60 秒評估一次
   - 可根據需求調整

3. **冷卻時間**
   - 避免告警風暴
   - 建議至少 15 分鐘

## 相依性

- Story 12-1: 系統健康監控儀表板（健康指標來源）
- Story 12-2: 效能指標追蹤（效能指標來源）
