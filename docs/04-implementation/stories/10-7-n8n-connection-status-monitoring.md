# Story 10-7: n8n 連接狀態監控

## Story 資訊

- **Epic**: 10 - n8n 工作流整合
- **功能需求**: FR56 (執行狀態監控), FR57 (錯誤診斷)
- **優先級**: Medium
- **故事點數**: 5
- **相關 Stories**:
  - Story 10-2 (Webhook 配置管理)
  - Story 10-5 (工作流錯誤詳情查看)
  - Story 12-1 (系統健康監控儀表板)

## 使用者故事

**As a** 系統管理員,
**I want** 監控 n8n 的連接狀態,
**So that** 我可以及時發現和處理連接問題。

## 驗收標準

### AC1: 連接狀態顯示

**Given** 系統管理員在系統監控頁面
**When** 查看「n8n 連接狀態」區塊
**Then** 顯示：
- 連接狀態（正常/異常/未配置）
- 最後成功通訊時間
- 24 小時內的成功/失敗調用統計

### AC2: 異常告警

**Given** n8n 連接異常
**When** 連續 3 次調用失敗
**Then** 系統狀態變更為「異常」
**And** 發送告警通知給管理員

### AC3: 狀態歷史記錄

**Given** 連接狀態頁面
**When** 點擊「查看歷史」
**Then** 顯示近期的連接狀態變化記錄
**And** 包含每次狀態變化的原因

### AC4: 自動恢復檢測

**Given** 連接異常後恢復
**When** 調用成功
**Then** 系統狀態自動恢復為「正常」
**And** 發送恢復通知

## 技術規格

### 1. 資料模型

```prisma
// 系統健康日誌
model SystemHealthLog {
  id            String    @id @default(cuid())

  // 服務標識
  service       String    // 'n8n' | 'azure_blob' | 'azure_ai' | 'database'
  serviceUrl    String?   // 服務 URL

  // 狀態
  status        HealthStatus
  previousStatus HealthStatus?

  // 詳情
  message       String?
  details       Json?     // 額外詳情

  // 檢查資訊
  checkType     HealthCheckType
  responseTimeMs Int?
  httpStatus    Int?

  // 城市關聯（如適用）
  cityCode      String?
  city          City?     @relation(fields: [cityCode], references: [code])

  // 審計
  createdAt     DateTime  @default(now())

  @@index([service])
  @@index([status])
  @@index([createdAt])
  @@index([cityCode])
}

enum HealthStatus {
  HEALTHY       // 正常
  DEGRADED      // 降級
  UNHEALTHY     // 異常
  UNKNOWN       // 未知
  UNCONFIGURED  // 未配置
}

enum HealthCheckType {
  SCHEDULED     // 定期檢查
  MANUAL        // 手動檢查
  ON_ERROR      // 錯誤觸發
  ON_RECOVERY   // 恢復檢測
}

// n8n 連接統計（聚合資料）
model N8nConnectionStats {
  id            String    @id @default(cuid())

  // 時間範圍
  periodStart   DateTime
  periodEnd     DateTime
  periodType    StatsPeriodType  // 'hourly' | 'daily'

  // 城市
  cityCode      String?
  city          City?     @relation(fields: [cityCode], references: [code])

  // 統計數據
  totalCalls    Int       @default(0)
  successCalls  Int       @default(0)
  failedCalls   Int       @default(0)
  avgResponseMs Float?
  maxResponseMs Int?
  minResponseMs Int?

  // 錯誤分類
  errorsByType  Json?     // { 'CONNECTION_ERROR': 5, 'TIMEOUT': 2, ... }

  createdAt     DateTime  @default(now())

  @@unique([periodStart, periodType, cityCode])
  @@index([periodStart])
  @@index([cityCode])
}

enum StatsPeriodType {
  HOURLY
  DAILY
  WEEKLY
  MONTHLY
}

// 告警記錄
model AlertRecord {
  id            String    @id @default(cuid())

  // 告警資訊
  alertType     AlertType
  severity      AlertSeverity
  title         String
  message       String
  details       Json?

  // 來源
  service       String
  cityCode      String?

  // 狀態
  status        AlertStatus @default(ACTIVE)
  acknowledgedBy String?
  acknowledgedAt DateTime?
  resolvedAt    DateTime?

  // 通知
  notificationsSent Json?  // [{ channel: 'email', sentAt: '...', recipient: '...' }]

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([alertType])
  @@index([status])
  @@index([service])
  @@index([createdAt])
}

enum AlertType {
  CONNECTION_FAILURE    // 連線失敗
  HIGH_ERROR_RATE       // 高錯誤率
  RESPONSE_TIMEOUT      // 回應逾時
  SERVICE_DEGRADED      // 服務降級
  SERVICE_RECOVERED     // 服務恢復
  CONFIGURATION_ERROR   // 配置錯誤
}

enum AlertSeverity {
  INFO
  WARNING
  ERROR
  CRITICAL
}

enum AlertStatus {
  ACTIVE
  ACKNOWLEDGED
  RESOLVED
  SUPPRESSED
}
```

### 2. 連接狀態監控服務

```typescript
// lib/services/n8n/n8nHealthService.ts
import { prisma } from '@/lib/prisma'
import { webhookConfigService } from './webhookConfigService'
import { alertService } from '../alertService'
import { HealthStatus, HealthCheckType, AlertType, AlertSeverity } from '@prisma/client'

export interface N8nHealthStatus {
  status: HealthStatus
  lastSuccessAt?: Date
  lastCheckAt?: Date
  consecutiveFailures: number
  stats24h: {
    totalCalls: number
    successCalls: number
    failedCalls: number
    successRate: number
    avgResponseMs?: number
  }
  cityStatuses?: Array<{
    cityCode: string
    cityName: string
    status: HealthStatus
    lastCheckAt?: Date
  }>
}

export interface HealthCheckResult {
  success: boolean
  status: HealthStatus
  responseTimeMs?: number
  error?: string
  httpStatus?: number
}

const CONSECUTIVE_FAILURES_THRESHOLD = 3
const HEALTH_CHECK_TIMEOUT = 10000 // 10 秒

export class N8nHealthService {
  private consecutiveFailures: Map<string, number> = new Map()

  // 獲取整體健康狀態
  async getOverallHealth(): Promise<N8nHealthStatus> {
    // 獲取所有活躍配置
    const configs = await webhookConfigService.listConfigs({ isActive: true })

    if (configs.length === 0) {
      return {
        status: 'UNCONFIGURED',
        consecutiveFailures: 0,
        stats24h: {
          totalCalls: 0,
          successCalls: 0,
          failedCalls: 0,
          successRate: 0,
        },
      }
    }

    // 獲取最近的健康檢查記錄
    const latestCheck = await prisma.systemHealthLog.findFirst({
      where: { service: 'n8n' },
      orderBy: { createdAt: 'desc' },
    })

    // 獲取最後成功時間
    const lastSuccess = await prisma.systemHealthLog.findFirst({
      where: {
        service: 'n8n',
        status: 'HEALTHY',
      },
      orderBy: { createdAt: 'desc' },
    })

    // 獲取 24 小時統計
    const stats24h = await this.get24HourStats()

    // 獲取各城市狀態
    const cityStatuses = await this.getCityStatuses(configs)

    // 計算連續失敗次數
    const consecutiveFailures = await this.getConsecutiveFailures()

    // 判斷整體狀態
    const status = this.determineOverallStatus(consecutiveFailures, stats24h.successRate)

    return {
      status,
      lastSuccessAt: lastSuccess?.createdAt || undefined,
      lastCheckAt: latestCheck?.createdAt || undefined,
      consecutiveFailures,
      stats24h,
      cityStatuses,
    }
  }

  // 執行健康檢查
  async performHealthCheck(options?: {
    cityCode?: string
    checkType?: HealthCheckType
  }): Promise<HealthCheckResult> {
    const { cityCode, checkType = 'MANUAL' } = options || {}

    // 獲取適用的配置
    const config = cityCode
      ? await webhookConfigService.getActiveConfigForCity(cityCode)
      : (await webhookConfigService.listConfigs({ isActive: true }))[0]

    if (!config) {
      return {
        success: false,
        status: 'UNCONFIGURED',
        error: 'No active webhook configuration found',
      }
    }

    const configKey = cityCode || 'global'
    const startTime = Date.now()

    try {
      // 執行健康檢查請求
      const testResult = await webhookConfigService.testConnection(config.id)

      const responseTimeMs = Date.now() - startTime
      const status: HealthStatus = testResult.success ? 'HEALTHY' : 'UNHEALTHY'

      // 更新連續失敗計數
      if (testResult.success) {
        this.consecutiveFailures.set(configKey, 0)
      } else {
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
        },
      })

      // 處理告警
      await this.handleAlerts(configKey, status, previousLog?.status, testResult.error)

      return {
        success: testResult.success,
        status,
        responseTimeMs,
        error: testResult.error,
        httpStatus: testResult.statusCode,
      }
    } catch (error) {
      const responseTimeMs = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      // 更新連續失敗計數
      const current = this.consecutiveFailures.get(configKey) || 0
      this.consecutiveFailures.set(configKey, current + 1)

      // 記錄失敗
      await prisma.systemHealthLog.create({
        data: {
          service: 'n8n',
          status: 'UNHEALTHY',
          message: errorMessage,
          checkType,
          responseTimeMs,
          cityCode,
        },
      })

      // 處理告警
      await this.handleAlerts(configKey, 'UNHEALTHY', undefined, errorMessage)

      return {
        success: false,
        status: 'UNHEALTHY',
        responseTimeMs,
        error: errorMessage,
      }
    }
  }

  // 獲取健康歷史
  async getHealthHistory(options: {
    cityCode?: string
    limit?: number
    startDate?: Date
    endDate?: Date
  }): Promise<Array<{
    status: HealthStatus
    message?: string
    responseTimeMs?: number
    createdAt: Date
  }>> {
    const { cityCode, limit = 100, startDate, endDate } = options

    const where: any = { service: 'n8n' }
    if (cityCode) where.cityCode = cityCode
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = startDate
      if (endDate) where.createdAt.lte = endDate
    }

    const logs = await prisma.systemHealthLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        status: true,
        message: true,
        responseTimeMs: true,
        createdAt: true,
      },
    })

    return logs
  }

  // 獲取狀態變化記錄
  async getStatusChanges(limit: number = 20): Promise<Array<{
    previousStatus?: HealthStatus
    newStatus: HealthStatus
    reason?: string
    changedAt: Date
    cityCode?: string
  }>> {
    const logs = await prisma.systemHealthLog.findMany({
      where: {
        service: 'n8n',
        previousStatus: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        previousStatus: true,
        status: true,
        message: true,
        createdAt: true,
        cityCode: true,
      },
    })

    return logs
      .filter((log) => log.previousStatus !== log.status)
      .map((log) => ({
        previousStatus: log.previousStatus || undefined,
        newStatus: log.status,
        reason: log.message || undefined,
        changedAt: log.createdAt,
        cityCode: log.cityCode || undefined,
      }))
  }

  // 獲取 24 小時統計
  private async get24HourStats(): Promise<{
    totalCalls: number
    successCalls: number
    failedCalls: number
    successRate: number
    avgResponseMs?: number
  }> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const stats = await prisma.n8nApiCall.aggregate({
      where: {
        timestamp: { gte: since },
      },
      _count: true,
      _avg: { durationMs: true },
    })

    const successCount = await prisma.n8nApiCall.count({
      where: {
        timestamp: { gte: since },
        statusCode: { gte: 200, lt: 300 },
      },
    })

    const totalCalls = stats._count
    const successCalls = successCount
    const failedCalls = totalCalls - successCalls
    const successRate = totalCalls > 0 ? (successCalls / totalCalls) * 100 : 0

    return {
      totalCalls,
      successCalls,
      failedCalls,
      successRate,
      avgResponseMs: stats._avg.durationMs || undefined,
    }
  }

  // 獲取各城市狀態
  private async getCityStatuses(configs: any[]): Promise<Array<{
    cityCode: string
    cityName: string
    status: HealthStatus
    lastCheckAt?: Date
  }>> {
    const cityStatuses: Array<{
      cityCode: string
      cityName: string
      status: HealthStatus
      lastCheckAt?: Date
    }> = []

    for (const config of configs) {
      if (!config.cityCode) continue

      const lastCheck = await prisma.systemHealthLog.findFirst({
        where: {
          service: 'n8n',
          cityCode: config.cityCode,
        },
        orderBy: { createdAt: 'desc' },
      })

      cityStatuses.push({
        cityCode: config.cityCode,
        cityName: config.city?.name || config.cityCode,
        status: lastCheck?.status || 'UNKNOWN',
        lastCheckAt: lastCheck?.createdAt || undefined,
      })
    }

    return cityStatuses
  }

  // 獲取連續失敗次數
  private async getConsecutiveFailures(): Promise<number> {
    const recentLogs = await prisma.systemHealthLog.findMany({
      where: { service: 'n8n' },
      orderBy: { createdAt: 'desc' },
      take: CONSECUTIVE_FAILURES_THRESHOLD + 1,
    })

    let failures = 0
    for (const log of recentLogs) {
      if (log.status === 'UNHEALTHY') {
        failures++
      } else {
        break
      }
    }

    return failures
  }

  // 判斷整體狀態
  private determineOverallStatus(
    consecutiveFailures: number,
    successRate: number
  ): HealthStatus {
    if (consecutiveFailures >= CONSECUTIVE_FAILURES_THRESHOLD) {
      return 'UNHEALTHY'
    }
    if (successRate < 90 && successRate >= 70) {
      return 'DEGRADED'
    }
    if (successRate < 70) {
      return 'UNHEALTHY'
    }
    return 'HEALTHY'
  }

  // 處理告警
  private async handleAlerts(
    configKey: string,
    newStatus: HealthStatus,
    previousStatus?: HealthStatus,
    errorMessage?: string
  ): Promise<void> {
    const consecutiveFailures = this.consecutiveFailures.get(configKey) || 0

    // 狀態從健康變為異常
    if (previousStatus === 'HEALTHY' && newStatus === 'UNHEALTHY') {
      if (consecutiveFailures >= CONSECUTIVE_FAILURES_THRESHOLD) {
        await alertService.createAlert({
          alertType: 'CONNECTION_FAILURE',
          severity: 'ERROR',
          title: 'n8n 連接失敗',
          message: `n8n 連接已連續失敗 ${consecutiveFailures} 次`,
          details: { errorMessage, configKey },
          service: 'n8n',
        })
      }
    }

    // 狀態從異常恢復為健康
    if (previousStatus === 'UNHEALTHY' && newStatus === 'HEALTHY') {
      await alertService.createAlert({
        alertType: 'SERVICE_RECOVERED',
        severity: 'INFO',
        title: 'n8n 連接已恢復',
        message: 'n8n 服務連接已恢復正常',
        details: { configKey },
        service: 'n8n',
      })

      // 自動解決相關的未解決告警
      await alertService.resolveAlertsByService('n8n')
    }
  }

  // 定期健康檢查（由 cron job 調用）
  async scheduledHealthCheck(): Promise<void> {
    const configs = await webhookConfigService.listConfigs({ isActive: true })

    for (const config of configs) {
      await this.performHealthCheck({
        cityCode: config.cityCode || undefined,
        checkType: 'SCHEDULED',
      })
    }
  }
}

export const n8nHealthService = new N8nHealthService()
```

### 3. 告警服務

```typescript
// lib/services/alertService.ts
import { prisma } from '@/lib/prisma'
import { AlertType, AlertSeverity, AlertStatus } from '@prisma/client'
import { sendEmail } from '@/lib/utils/email'
import { sendTeamsNotification } from '@/lib/utils/teams'

export interface CreateAlertInput {
  alertType: AlertType
  severity: AlertSeverity
  title: string
  message: string
  details?: Record<string, any>
  service: string
  cityCode?: string
}

export class AlertService {
  // 創建告警
  async createAlert(input: CreateAlertInput): Promise<void> {
    // 檢查是否已有相同的活躍告警
    const existingAlert = await prisma.alertRecord.findFirst({
      where: {
        alertType: input.alertType,
        service: input.service,
        cityCode: input.cityCode,
        status: 'ACTIVE',
      },
    })

    if (existingAlert) {
      // 更新現有告警
      await prisma.alertRecord.update({
        where: { id: existingAlert.id },
        data: {
          message: input.message,
          details: input.details,
          updatedAt: new Date(),
        },
      })
      return
    }

    // 創建新告警
    const alert = await prisma.alertRecord.create({
      data: {
        alertType: input.alertType,
        severity: input.severity,
        title: input.title,
        message: input.message,
        details: input.details,
        service: input.service,
        cityCode: input.cityCode,
      },
    })

    // 發送通知
    await this.sendNotifications(alert)
  }

  // 發送通知
  private async sendNotifications(alert: any): Promise<void> {
    const notifications: Array<{ channel: string; sentAt: string; recipient: string }> = []

    // 獲取通知配置
    const notifyConfig = await prisma.systemConfig.findFirst({
      where: { key: 'alert.notifications' },
    })

    const config = notifyConfig?.value as any || {}

    // Email 通知
    if (config.email?.enabled && alert.severity !== 'INFO') {
      try {
        await sendEmail({
          to: config.email.recipients,
          subject: `[${alert.severity}] ${alert.title}`,
          body: `
            <h2>${alert.title}</h2>
            <p>${alert.message}</p>
            <p><strong>服務:</strong> ${alert.service}</p>
            <p><strong>時間:</strong> ${alert.createdAt.toISOString()}</p>
            ${alert.details ? `<pre>${JSON.stringify(alert.details, null, 2)}</pre>` : ''}
          `,
        })
        notifications.push({
          channel: 'email',
          sentAt: new Date().toISOString(),
          recipient: config.email.recipients.join(', '),
        })
      } catch (error) {
        console.error('Failed to send email notification:', error)
      }
    }

    // Teams 通知
    if (config.teams?.enabled && ['ERROR', 'CRITICAL'].includes(alert.severity)) {
      try {
        await sendTeamsNotification({
          webhookUrl: config.teams.webhookUrl,
          title: alert.title,
          message: alert.message,
          severity: alert.severity,
        })
        notifications.push({
          channel: 'teams',
          sentAt: new Date().toISOString(),
          recipient: 'teams-channel',
        })
      } catch (error) {
        console.error('Failed to send Teams notification:', error)
      }
    }

    // 更新告警記錄的通知狀態
    if (notifications.length > 0) {
      await prisma.alertRecord.update({
        where: { id: alert.id },
        data: { notificationsSent: notifications },
      })
    }
  }

  // 解決服務相關告警
  async resolveAlertsByService(service: string): Promise<void> {
    await prisma.alertRecord.updateMany({
      where: {
        service,
        status: 'ACTIVE',
      },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
      },
    })
  }

  // 確認告警
  async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    await prisma.alertRecord.update({
      where: { id: alertId },
      data: {
        status: 'ACKNOWLEDGED',
        acknowledgedBy: userId,
        acknowledgedAt: new Date(),
      },
    })
  }

  // 獲取活躍告警
  async getActiveAlerts(service?: string): Promise<any[]> {
    return prisma.alertRecord.findMany({
      where: {
        status: { in: ['ACTIVE', 'ACKNOWLEDGED'] },
        ...(service ? { service } : {}),
      },
      orderBy: [
        { severity: 'desc' },
        { createdAt: 'desc' },
      ],
    })
  }
}

export const alertService = new AlertService()
```

### 4. API 路由實現

```typescript
// app/api/admin/n8n-health/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { n8nHealthService } from '@/lib/services/n8n/n8nHealthService'
import { hasRole } from '@/lib/utils/permissions'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user || !hasRole(session.user, 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
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

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user || !hasRole(session.user, 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const searchParams = request.nextUrl.searchParams
  const cityCode = searchParams.get('cityCode') || undefined

  try {
    const result = await n8nHealthService.performHealthCheck({
      cityCode,
      checkType: 'MANUAL',
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

```typescript
// app/api/admin/n8n-health/history/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { n8nHealthService } from '@/lib/services/n8n/n8nHealthService'
import { hasRole } from '@/lib/utils/permissions'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user || !hasRole(session.user, 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const searchParams = request.nextUrl.searchParams
  const cityCode = searchParams.get('cityCode') || undefined
  const limit = parseInt(searchParams.get('limit') || '100')

  try {
    const history = await n8nHealthService.getHealthHistory({
      cityCode,
      limit,
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

```typescript
// app/api/admin/n8n-health/changes/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { n8nHealthService } from '@/lib/services/n8n/n8nHealthService'
import { hasRole } from '@/lib/utils/permissions'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user || !hasRole(session.user, 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const searchParams = request.nextUrl.searchParams
  const limit = parseInt(searchParams.get('limit') || '20')

  try {
    const changes = await n8nHealthService.getStatusChanges(limit)

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

### 5. React 組件

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
} from '@mui/material'
import {
  CheckCircle,
  Error,
  Warning,
  HelpOutline,
  Refresh,
  History,
  TrendingUp,
  TrendingDown,
  ArrowUpward,
  ArrowDownward,
} from '@mui/icons-material'
import { formatDistanceToNow, format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts'

interface N8nHealthStatusProps {
  health: {
    status: string
    lastSuccessAt?: Date
    lastCheckAt?: Date
    consecutiveFailures: number
    stats24h: {
      totalCalls: number
      successCalls: number
      failedCalls: number
      successRate: number
      avgResponseMs?: number
    }
    cityStatuses?: Array<{
      cityCode: string
      cityName: string
      status: string
      lastCheckAt?: Date
    }>
  }
  onRefresh: () => Promise<void>
}

const statusConfig: Record<string, {
  label: string
  color: 'success' | 'error' | 'warning' | 'default'
  icon: React.ReactNode
}> = {
  HEALTHY: { label: '正常', color: 'success', icon: <CheckCircle /> },
  DEGRADED: { label: '降級', color: 'warning', icon: <Warning /> },
  UNHEALTHY: { label: '異常', color: 'error', icon: <Error /> },
  UNKNOWN: { label: '未知', color: 'default', icon: <HelpOutline /> },
  UNCONFIGURED: { label: '未配置', color: 'default', icon: <HelpOutline /> },
}

export function N8nHealthStatus({ health, onRefresh }: N8nHealthStatusProps) {
  const [refreshing, setRefreshing] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  const config = statusConfig[health.status] || statusConfig.UNKNOWN

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setRefreshing(false)
    }
  }

  const chartData = [
    { name: '成功', value: health.stats24h.successCalls, color: '#4caf50' },
    { name: '失敗', value: health.stats24h.failedCalls, color: '#f44336' },
  ]

  return (
    <Paper sx={{ p: 3 }}>
      {/* 標題 */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">
          n8n 連接狀態
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="查看歷史">
            <IconButton onClick={() => setHistoryOpen(true)} size="small">
              <History />
            </IconButton>
          </Tooltip>
          <Button
            startIcon={refreshing ? <CircularProgress size={16} /> : <Refresh />}
            onClick={handleRefresh}
            disabled={refreshing}
            size="small"
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
        {health.lastCheckAt && (
          <Typography variant="body2" color="text.secondary">
            上次檢查：{formatDistanceToNow(new Date(health.lastCheckAt), {
              addSuffix: true,
              locale: zhTW,
            })}
          </Typography>
        )}
        {health.consecutiveFailures > 0 && (
          <Chip
            label={`連續失敗 ${health.consecutiveFailures} 次`}
            color="error"
            size="small"
            variant="outlined"
          />
        )}
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* 24 小時統計 */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            24 小時統計
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Box sx={{ width: 120, height: 120 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={50}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            </Box>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Box sx={{ width: 12, height: 12, bgcolor: '#4caf50', borderRadius: '50%' }} />
                <Typography variant="body2">
                  成功：{health.stats24h.successCalls}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Box sx={{ width: 12, height: 12, bgcolor: '#f44336', borderRadius: '50%' }} />
                <Typography variant="body2">
                  失敗：{health.stats24h.failedCalls}
                </Typography>
              </Box>
              <Typography variant="h6" color={health.stats24h.successRate >= 90 ? 'success.main' : 'error.main'}>
                {health.stats24h.successRate.toFixed(1)}% 成功率
              </Typography>
            </Box>
          </Box>
        </Grid>

        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            性能指標
          </Typography>
          <List dense>
            <ListItem>
              <ListItemText
                primary="總調用次數"
                secondary={health.stats24h.totalCalls}
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="平均回應時間"
                secondary={health.stats24h.avgResponseMs
                  ? `${health.stats24h.avgResponseMs.toFixed(0)} ms`
                  : '-'}
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="最後成功時間"
                secondary={health.lastSuccessAt
                  ? format(new Date(health.lastSuccessAt), 'PPpp', { locale: zhTW })
                  : '-'}
              />
            </ListItem>
          </List>
        </Grid>
      </Grid>

      {/* 城市狀態 */}
      {health.cityStatuses && health.cityStatuses.length > 0 && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            各城市狀態
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {health.cityStatuses.map((city) => {
              const cityConfig = statusConfig[city.status] || statusConfig.UNKNOWN
              return (
                <Tooltip
                  key={city.cityCode}
                  title={city.lastCheckAt
                    ? `上次檢查：${formatDistanceToNow(new Date(city.lastCheckAt), {
                        addSuffix: true,
                        locale: zhTW,
                      })}`
                    : '未檢查'}
                >
                  <Chip
                    icon={cityConfig.icon as React.ReactElement}
                    label={city.cityName}
                    color={cityConfig.color}
                    size="small"
                    variant="outlined"
                  />
                </Tooltip>
              )
            })}
          </Box>
        </>
      )}

      {/* 歷史記錄對話框 */}
      <HealthHistoryDialog open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </Paper>
  )
}

function HealthHistoryDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
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
      const res = await fetch('/api/admin/n8n-health/changes')
      const data = await res.json()
      setHistory(data.data || [])
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
        ) : (
          <List>
            {history.map((item, index) => {
              const fromConfig = statusConfig[item.previousStatus] || statusConfig.UNKNOWN
              const toConfig = statusConfig[item.newStatus] || statusConfig.UNKNOWN
              const isRecovery = item.newStatus === 'HEALTHY'

              return (
                <ListItem key={index}>
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
                        →
                        <Chip
                          label={toConfig.label}
                          color={toConfig.color}
                          size="small"
                        />
                        {item.cityCode && (
                          <Typography variant="caption" color="text.secondary">
                            ({item.cityCode})
                          </Typography>
                        )}
                      </Box>
                    }
                    secondary={
                      <>
                        {item.reason && <span>{item.reason}</span>}
                        <br />
                        {format(new Date(item.changedAt), 'PPpp', { locale: zhTW })}
                      </>
                    }
                  />
                </ListItem>
              )
            })}

            {history.length === 0 && (
              <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                暫無狀態變化記錄
              </Typography>
            )}
          </List>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

## 測試案例

### 單元測試

```typescript
// __tests__/services/n8n/n8nHealthService.test.ts
import { n8nHealthService } from '@/lib/services/n8n/n8nHealthService'
import { prismaMock } from '@/lib/__mocks__/prisma'

describe('N8nHealthService', () => {
  describe('determineOverallStatus', () => {
    it('should return UNHEALTHY when consecutive failures exceed threshold', () => {
      const status = n8nHealthService['determineOverallStatus'](3, 95)
      expect(status).toBe('UNHEALTHY')
    })

    it('should return DEGRADED when success rate is between 70-90%', () => {
      const status = n8nHealthService['determineOverallStatus'](0, 85)
      expect(status).toBe('DEGRADED')
    })

    it('should return HEALTHY when success rate is above 90%', () => {
      const status = n8nHealthService['determineOverallStatus'](0, 95)
      expect(status).toBe('HEALTHY')
    })
  })

  describe('getConsecutiveFailures', () => {
    it('should count consecutive failures correctly', async () => {
      prismaMock.systemHealthLog.findMany.mockResolvedValue([
        { status: 'UNHEALTHY' },
        { status: 'UNHEALTHY' },
        { status: 'HEALTHY' },
      ] as any)

      const failures = await n8nHealthService['getConsecutiveFailures']()
      expect(failures).toBe(2)
    })
  })
})
```

## 部署注意事項

1. **定期健康檢查**
   - 配置 cron job 每 5 分鐘執行一次
   - 建議使用 Azure Functions Timer Trigger

2. **告警配置**
   - 設定 Email 和 Teams 通知接收者
   - 根據嚴重程度配置不同通知策略

3. **監控指標**
   - n8n 服務可用性
   - 平均回應時間趨勢
   - 告警觸發頻率

4. **安全考量**
   - 健康檢查 API 僅限管理員存取
   - 告警通知不包含敏感資訊

## 相依性

- Story 10-2: Webhook 配置管理（配置來源）
- Story 10-5: 工作流錯誤詳情查看（錯誤關聯）
- Story 12-1: 系統健康監控儀表板（整合顯示）
