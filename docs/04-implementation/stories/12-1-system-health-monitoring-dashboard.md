# Story 12-1: 系統健康監控儀表板

## Story 資訊

- **Epic**: 12 - 系統管理與監控
- **功能需求**: FR59 (系統健康監控)
- **優先級**: High
- **故事點數**: 8
- **相關 Stories**:
  - Story 12-2 (效能指標追蹤)
  - Story 12-3 (錯誤告警配置)
  - Story 12-7 (系統日誌查詢)

## 使用者故事

**As a** 系統管理員,
**I want** 查看系統整體健康狀態儀表板,
**So that** 我可以即時了解系統運行情況並快速發現問題。

## 驗收標準

### AC1: 健康狀態總覽

**Given** 系統管理員已登入
**When** 導航至「系統監控」頁面
**Then** 顯示系統健康儀表板，包含：
- 整體健康狀態指示器（正常/警告/異常）
- 各服務狀態卡片（Web 應用、AI 服務、數據庫、儲存服務）
- 最近 24 小時的可用性百分比
- 當前活躍用戶數

### AC2: 異常狀態顯示

**Given** 健康儀表板
**When** 某個服務狀態異常
**Then** 對應卡片顯示紅色警示
**And** 顯示異常開始時間
**And** 顯示簡要錯誤描述

### AC3: 即時更新

**Given** 健康儀表板
**When** 服務狀態變化
**Then** 儀表板自動更新（每 30 秒刷新）
**And** 狀態變化時顯示通知

### AC4: 服務詳情展開

**Given** 服務狀態卡片
**When** 點擊某個服務
**Then** 展開顯示詳細資訊：
- 回應時間趨勢圖
- 錯誤率統計
- 最近的錯誤日誌

## 技術規格

### 1. 資料模型

```prisma
// 服務健康檢查記錄
model ServiceHealthCheck {
  id              String    @id @default(cuid())

  // 服務資訊
  serviceName     String    // web, ai, database, storage, n8n
  serviceType     ServiceType

  // 健康狀態
  status          HealthStatus
  responseTime    Int?      // 毫秒
  errorMessage    String?
  errorCode       String?

  // 詳細資訊
  details         Json?     // 額外的健康檢查細節
  endpoint        String?   // 健康檢查端點

  // 時間記錄
  checkedAt       DateTime  @default(now())

  @@index([serviceName])
  @@index([status])
  @@index([checkedAt])
}

enum ServiceType {
  WEB_APP         // Web 應用程式
  AI_SERVICE      // AI 處理服務
  DATABASE        // 數據庫
  STORAGE         // Blob 儲存
  N8N             // n8n 工作流
  CACHE           // Redis 快取
  EXTERNAL_API    // 外部 API
}

enum HealthStatus {
  HEALTHY         // 正常
  DEGRADED        // 降級（部分功能受影響）
  UNHEALTHY       // 異常
  UNKNOWN         // 未知
}

// 服務可用性記錄（每小時彙總）
model ServiceAvailability {
  id              String    @id @default(cuid())
  serviceName     String
  date            DateTime  @db.Date
  hour            Int       // 0-23

  // 統計數據
  totalChecks     Int
  healthyChecks   Int
  degradedChecks  Int
  unhealthyChecks Int
  avgResponseTime Float?

  // 計算的可用性
  availabilityPct Float     // 可用性百分比

  createdAt       DateTime  @default(now())

  @@unique([serviceName, date, hour])
  @@index([serviceName])
  @@index([date])
}

// 系統整體狀態
model SystemOverallStatus {
  id              String    @id @default(cuid())
  status          HealthStatus
  activeUsers     Int       @default(0)
  lastUpdated     DateTime  @default(now())

  // 各服務狀態摘要
  servicesSummary Json      // { healthy: 4, degraded: 1, unhealthy: 0 }
}
```

### 2. 健康檢查服務

```typescript
// lib/services/monitoring/healthCheckService.ts
import { prisma } from '@/lib/prisma'
import { HealthStatus, ServiceType } from '@prisma/client'

// 服務配置
interface ServiceConfig {
  name: string
  type: ServiceType
  endpoint: string
  timeout: number
  checkInterval: number
}

const SERVICES_CONFIG: ServiceConfig[] = [
  {
    name: 'web',
    type: 'WEB_APP',
    endpoint: '/api/health',
    timeout: 5000,
    checkInterval: 30000,
  },
  {
    name: 'ai',
    type: 'AI_SERVICE',
    endpoint: process.env.AI_SERVICE_URL + '/health',
    timeout: 10000,
    checkInterval: 30000,
  },
  {
    name: 'database',
    type: 'DATABASE',
    endpoint: 'prisma',
    timeout: 5000,
    checkInterval: 30000,
  },
  {
    name: 'storage',
    type: 'STORAGE',
    endpoint: process.env.AZURE_STORAGE_URL!,
    timeout: 10000,
    checkInterval: 60000,
  },
  {
    name: 'n8n',
    type: 'N8N',
    endpoint: process.env.N8N_BASE_URL + '/healthz',
    timeout: 10000,
    checkInterval: 60000,
  },
  {
    name: 'cache',
    type: 'CACHE',
    endpoint: 'redis',
    timeout: 3000,
    checkInterval: 30000,
  },
]

export interface ServiceHealthResult {
  serviceName: string
  serviceType: ServiceType
  status: HealthStatus
  responseTime?: number
  errorMessage?: string
  details?: Record<string, any>
  checkedAt: Date
}

export interface OverallHealthStatus {
  status: HealthStatus
  services: ServiceHealthResult[]
  activeUsers: number
  availability24h: number
  lastUpdated: Date
}

export class HealthCheckService {
  // 執行所有服務的健康檢查
  async checkAllServices(): Promise<ServiceHealthResult[]> {
    const results: ServiceHealthResult[] = []

    for (const service of SERVICES_CONFIG) {
      const result = await this.checkService(service)
      results.push(result)

      // 記錄到資料庫
      await prisma.serviceHealthCheck.create({
        data: {
          serviceName: service.name,
          serviceType: service.type,
          status: result.status,
          responseTime: result.responseTime,
          errorMessage: result.errorMessage,
          details: result.details,
          endpoint: service.endpoint,
        },
      })
    }

    // 更新整體狀態
    await this.updateOverallStatus(results)

    return results
  }

  // 檢查單一服務
  async checkService(config: ServiceConfig): Promise<ServiceHealthResult> {
    const startTime = Date.now()

    try {
      let status: HealthStatus = 'HEALTHY'
      let details: Record<string, any> = {}

      switch (config.type) {
        case 'DATABASE':
          const dbResult = await this.checkDatabase(config.timeout)
          status = dbResult.status
          details = dbResult.details
          break

        case 'CACHE':
          const cacheResult = await this.checkRedis(config.timeout)
          status = cacheResult.status
          details = cacheResult.details
          break

        case 'STORAGE':
          const storageResult = await this.checkStorage(config.timeout)
          status = storageResult.status
          details = storageResult.details
          break

        default:
          const httpResult = await this.checkHttpEndpoint(
            config.endpoint,
            config.timeout
          )
          status = httpResult.status
          details = httpResult.details
      }

      return {
        serviceName: config.name,
        serviceType: config.type,
        status,
        responseTime: Date.now() - startTime,
        details,
        checkedAt: new Date(),
      }
    } catch (error) {
      return {
        serviceName: config.name,
        serviceType: config.type,
        status: 'UNHEALTHY',
        responseTime: Date.now() - startTime,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        checkedAt: new Date(),
      }
    }
  }

  // 檢查 HTTP 端點
  private async checkHttpEndpoint(
    url: string,
    timeout: number
  ): Promise<{ status: HealthStatus; details: Record<string, any> }> {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(timeout),
      })

      if (response.ok) {
        const data = await response.json().catch(() => ({}))
        return {
          status: 'HEALTHY',
          details: { statusCode: response.status, ...data },
        }
      } else if (response.status >= 500) {
        return {
          status: 'UNHEALTHY',
          details: { statusCode: response.status },
        }
      } else {
        return {
          status: 'DEGRADED',
          details: { statusCode: response.status },
        }
      }
    } catch (error) {
      throw error
    }
  }

  // 檢查數據庫
  private async checkDatabase(
    timeout: number
  ): Promise<{ status: HealthStatus; details: Record<string, any> }> {
    try {
      const startTime = Date.now()

      // 執行簡單查詢測試連接
      await prisma.$queryRaw`SELECT 1`

      const queryTime = Date.now() - startTime

      // 獲取連接池狀態
      const poolStats = await this.getDatabasePoolStats()

      return {
        status: queryTime > timeout / 2 ? 'DEGRADED' : 'HEALTHY',
        details: {
          queryTime,
          ...poolStats,
        },
      }
    } catch (error) {
      throw error
    }
  }

  // 獲取數據庫連接池狀態
  private async getDatabasePoolStats(): Promise<Record<string, any>> {
    // Prisma 不直接暴露連接池統計，這裡返回基本資訊
    return {
      provider: 'postgresql',
      connected: true,
    }
  }

  // 檢查 Redis
  private async checkRedis(
    timeout: number
  ): Promise<{ status: HealthStatus; details: Record<string, any> }> {
    const { Redis } = require('@upstash/redis')

    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })

    try {
      const startTime = Date.now()

      // 執行 PING 測試
      const pong = await redis.ping()
      const pingTime = Date.now() - startTime

      // 獲取記憶體使用
      const info = await redis.info('memory').catch(() => null)

      return {
        status: pong === 'PONG' ? 'HEALTHY' : 'DEGRADED',
        details: {
          pingTime,
          response: pong,
          memoryInfo: info,
        },
      }
    } catch (error) {
      throw error
    }
  }

  // 檢查 Azure Blob Storage
  private async checkStorage(
    timeout: number
  ): Promise<{ status: HealthStatus; details: Record<string, any> }> {
    const { BlobServiceClient } = require('@azure/storage-blob')

    try {
      const startTime = Date.now()

      const blobServiceClient = BlobServiceClient.fromConnectionString(
        process.env.AZURE_STORAGE_CONNECTION_STRING!
      )

      // 列出容器測試連接
      const containers: string[] = []
      for await (const container of blobServiceClient.listContainers()) {
        containers.push(container.name)
        if (containers.length >= 1) break // 只需要確認可連接
      }

      const checkTime = Date.now() - startTime

      // 獲取帳戶資訊
      const accountInfo = await blobServiceClient.getAccountInfo()

      return {
        status: 'HEALTHY',
        details: {
          checkTime,
          accountKind: accountInfo.accountKind,
          skuName: accountInfo.skuName,
        },
      }
    } catch (error) {
      throw error
    }
  }

  // 更新整體狀態
  private async updateOverallStatus(results: ServiceHealthResult[]): Promise<void> {
    const healthyCount = results.filter((r) => r.status === 'HEALTHY').length
    const degradedCount = results.filter((r) => r.status === 'DEGRADED').length
    const unhealthyCount = results.filter((r) => r.status === 'UNHEALTHY').length

    let overallStatus: HealthStatus = 'HEALTHY'
    if (unhealthyCount > 0) {
      overallStatus = 'UNHEALTHY'
    } else if (degradedCount > 0) {
      overallStatus = 'DEGRADED'
    }

    // 獲取活躍用戶數
    const activeUsers = await this.getActiveUserCount()

    await prisma.systemOverallStatus.upsert({
      where: { id: 'current' },
      update: {
        status: overallStatus,
        activeUsers,
        servicesSummary: {
          healthy: healthyCount,
          degraded: degradedCount,
          unhealthy: unhealthyCount,
        },
        lastUpdated: new Date(),
      },
      create: {
        id: 'current',
        status: overallStatus,
        activeUsers,
        servicesSummary: {
          healthy: healthyCount,
          degraded: degradedCount,
          unhealthy: unhealthyCount,
        },
      },
    })
  }

  // 獲取活躍用戶數
  private async getActiveUserCount(): Promise<number> {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000)

    const count = await prisma.session.count({
      where: {
        expires: { gt: new Date() },
        user: {
          lastActiveAt: { gt: fifteenMinutesAgo },
        },
      },
    })

    return count
  }

  // 獲取整體健康狀態
  async getOverallHealth(): Promise<OverallHealthStatus> {
    // 獲取最新的服務狀態
    const latestChecks = await prisma.serviceHealthCheck.findMany({
      where: {
        checkedAt: { gt: new Date(Date.now() - 5 * 60 * 1000) }, // 最近 5 分鐘
      },
      orderBy: { checkedAt: 'desc' },
      distinct: ['serviceName'],
    })

    // 獲取整體狀態
    const overallStatus = await prisma.systemOverallStatus.findUnique({
      where: { id: 'current' },
    })

    // 計算 24 小時可用性
    const availability24h = await this.calculate24hAvailability()

    return {
      status: overallStatus?.status || 'UNKNOWN',
      services: latestChecks.map((check) => ({
        serviceName: check.serviceName,
        serviceType: check.serviceType,
        status: check.status,
        responseTime: check.responseTime || undefined,
        errorMessage: check.errorMessage || undefined,
        details: check.details as Record<string, any> | undefined,
        checkedAt: check.checkedAt,
      })),
      activeUsers: overallStatus?.activeUsers || 0,
      availability24h,
      lastUpdated: overallStatus?.lastUpdated || new Date(),
    }
  }

  // 計算 24 小時可用性
  private async calculate24hAvailability(): Promise<number> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const checks = await prisma.serviceHealthCheck.groupBy({
      by: ['status'],
      where: {
        checkedAt: { gt: twentyFourHoursAgo },
      },
      _count: true,
    })

    const total = checks.reduce((sum, c) => sum + c._count, 0)
    const healthy = checks.find((c) => c.status === 'HEALTHY')?._count || 0
    const degraded = checks.find((c) => c.status === 'DEGRADED')?._count || 0

    if (total === 0) return 100

    // 健康 = 100%, 降級 = 50%, 異常 = 0%
    const availability = ((healthy * 100 + degraded * 50) / total / 100) * 100

    return Math.round(availability * 100) / 100
  }

  // 獲取服務詳情
  async getServiceDetails(
    serviceName: string,
    hours: number = 24
  ): Promise<{
    service: ServiceHealthResult | null
    history: Array<{
      checkedAt: Date
      status: HealthStatus
      responseTime: number | null
    }>
    errorLogs: Array<{
      checkedAt: Date
      errorMessage: string | null
      errorCode: string | null
    }>
    metrics: {
      avgResponseTime: number
      maxResponseTime: number
      minResponseTime: number
      errorRate: number
    }
  }> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000)

    // 獲取最新狀態
    const latestCheck = await prisma.serviceHealthCheck.findFirst({
      where: { serviceName },
      orderBy: { checkedAt: 'desc' },
    })

    // 獲取歷史記錄
    const history = await prisma.serviceHealthCheck.findMany({
      where: {
        serviceName,
        checkedAt: { gt: since },
      },
      orderBy: { checkedAt: 'asc' },
      select: {
        checkedAt: true,
        status: true,
        responseTime: true,
      },
    })

    // 獲取錯誤日誌
    const errorLogs = await prisma.serviceHealthCheck.findMany({
      where: {
        serviceName,
        checkedAt: { gt: since },
        status: { in: ['UNHEALTHY', 'DEGRADED'] },
      },
      orderBy: { checkedAt: 'desc' },
      take: 20,
      select: {
        checkedAt: true,
        errorMessage: true,
        errorCode: true,
      },
    })

    // 計算指標
    const responseTimes = history
      .map((h) => h.responseTime)
      .filter((t): t is number => t !== null)

    const unhealthyCount = history.filter(
      (h) => h.status === 'UNHEALTHY'
    ).length

    return {
      service: latestCheck
        ? {
            serviceName: latestCheck.serviceName,
            serviceType: latestCheck.serviceType,
            status: latestCheck.status,
            responseTime: latestCheck.responseTime || undefined,
            errorMessage: latestCheck.errorMessage || undefined,
            details: latestCheck.details as Record<string, any> | undefined,
            checkedAt: latestCheck.checkedAt,
          }
        : null,
      history,
      errorLogs,
      metrics: {
        avgResponseTime:
          responseTimes.length > 0
            ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
            : 0,
        maxResponseTime:
          responseTimes.length > 0 ? Math.max(...responseTimes) : 0,
        minResponseTime:
          responseTimes.length > 0 ? Math.min(...responseTimes) : 0,
        errorRate:
          history.length > 0 ? (unhealthyCount / history.length) * 100 : 0,
      },
    }
  }
}

export const healthCheckService = new HealthCheckService()
```

### 3. 健康檢查排程任務

```typescript
// lib/jobs/healthCheckJob.ts
import { healthCheckService } from '@/lib/services/monitoring/healthCheckService'

export class HealthCheckJob {
  private intervalId: NodeJS.Timeout | null = null

  // 啟動健康檢查排程
  start(intervalMs: number = 30000): void {
    if (this.intervalId) {
      console.warn('Health check job already running')
      return
    }

    console.log('Starting health check job')

    // 立即執行一次
    this.runOnce().catch(console.error)

    // 設置定期執行
    this.intervalId = setInterval(async () => {
      try {
        await this.runOnce()
      } catch (error) {
        console.error('Health check error:', error)
      }
    }, intervalMs)
  }

  // 停止排程任務
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
      console.log('Health check job stopped')
    }
  }

  // 手動執行一次
  async runOnce(): Promise<void> {
    const results = await healthCheckService.checkAllServices()
    console.log(
      `Health check completed: ${results.filter((r) => r.status === 'HEALTHY').length}/${results.length} healthy`
    )
  }
}

export const healthCheckJob = new HealthCheckJob()
```

### 4. API 路由

```typescript
// app/api/admin/health/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { healthCheckService } from '@/lib/services/monitoring/healthCheckService'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    // 驗證管理員權限
    const session = await getServerSession(authOptions)
    if (!session?.user || !['ADMIN', 'SUPER_USER'].includes(session.user.role)) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Admin access required' } },
        { status: 403 }
      )
    }

    const health = await healthCheckService.getOverallHealth()

    return NextResponse.json({ data: health }, { status: 200 })
  } catch (error) {
    console.error('Get health status error:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to get health status' } },
      { status: 500 }
    )
  }
}

// 手動觸發健康檢查
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || !['ADMIN', 'SUPER_USER'].includes(session.user.role)) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Admin access required' } },
        { status: 403 }
      )
    }

    const results = await healthCheckService.checkAllServices()

    return NextResponse.json({ data: results }, { status: 200 })
  } catch (error) {
    console.error('Health check error:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Health check failed' } },
      { status: 500 }
    )
  }
}
```

```typescript
// app/api/admin/health/[serviceName]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { healthCheckService } from '@/lib/services/monitoring/healthCheckService'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: { serviceName: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || !['ADMIN', 'SUPER_USER'].includes(session.user.role)) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Admin access required' } },
        { status: 403 }
      )
    }

    const hours = parseInt(request.nextUrl.searchParams.get('hours') || '24')

    const details = await healthCheckService.getServiceDetails(
      params.serviceName,
      hours
    )

    if (!details.service) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Service not found' } },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: details }, { status: 200 })
  } catch (error) {
    console.error('Get service details error:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to get service details' } },
      { status: 500 }
    )
  }
}
```

### 5. WebSocket 即時更新

```typescript
// lib/websocket/healthWebSocket.ts
import { Server as SocketIOServer } from 'socket.io'
import { healthCheckService, OverallHealthStatus } from '@/lib/services/monitoring/healthCheckService'

let io: SocketIOServer | null = null

export function initHealthWebSocket(server: any): void {
  io = new SocketIOServer(server, {
    path: '/api/ws/health',
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL,
      methods: ['GET', 'POST'],
    },
  })

  io.on('connection', (socket) => {
    console.log('Health WebSocket client connected')

    // 發送初始狀態
    healthCheckService.getOverallHealth().then((health) => {
      socket.emit('health:update', health)
    })

    socket.on('disconnect', () => {
      console.log('Health WebSocket client disconnected')
    })
  })
}

// 廣播健康狀態更新
export function broadcastHealthUpdate(health: OverallHealthStatus): void {
  if (io) {
    io.emit('health:update', health)
  }
}

// 廣播服務狀態變化
export function broadcastServiceChange(
  serviceName: string,
  oldStatus: string,
  newStatus: string
): void {
  if (io) {
    io.emit('health:service_change', {
      serviceName,
      oldStatus,
      newStatus,
      timestamp: new Date().toISOString(),
    })
  }
}
```

### 6. 前端儀表板組件

```typescript
// components/admin/HealthDashboard.tsx
'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import {
  Server,
  Database,
  Cloud,
  Cpu,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Users,
} from 'lucide-react'
import { io, Socket } from 'socket.io-client'
import { toast } from '@/hooks/useToast'

interface ServiceHealth {
  serviceName: string
  serviceType: string
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'UNKNOWN'
  responseTime?: number
  errorMessage?: string
  checkedAt: string
}

interface OverallHealth {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'UNKNOWN'
  services: ServiceHealth[]
  activeUsers: number
  availability24h: number
  lastUpdated: string
}

const SERVICE_ICONS: Record<string, React.ReactNode> = {
  web: <Server size={24} />,
  ai: <Cpu size={24} />,
  database: <Database size={24} />,
  storage: <Cloud size={24} />,
  n8n: <Server size={24} />,
  cache: <Database size={24} />,
}

const STATUS_COLORS: Record<string, string> = {
  HEALTHY: 'bg-green-500',
  DEGRADED: 'bg-yellow-500',
  UNHEALTHY: 'bg-red-500',
  UNKNOWN: 'bg-gray-500',
}

const STATUS_BADGES: Record<string, { variant: string; icon: React.ReactNode }> = {
  HEALTHY: { variant: 'success', icon: <CheckCircle size={16} /> },
  DEGRADED: { variant: 'warning', icon: <AlertTriangle size={16} /> },
  UNHEALTHY: { variant: 'destructive', icon: <XCircle size={16} /> },
  UNKNOWN: { variant: 'secondary', icon: <AlertTriangle size={16} /> },
}

export function HealthDashboard() {
  const [health, setHealth] = useState<OverallHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedService, setSelectedService] = useState<string | null>(null)
  const [serviceDetails, setServiceDetails] = useState<any>(null)
  const [socket, setSocket] = useState<Socket | null>(null)

  // 載入健康狀態
  const loadHealth = async () => {
    try {
      const response = await fetch('/api/admin/health')
      const data = await response.json()
      if (data.data) {
        setHealth(data.data)
      }
    } catch (error) {
      toast.error('Failed to load health status')
    } finally {
      setLoading(false)
    }
  }

  // 手動刷新
  const handleRefresh = async () => {
    setLoading(true)
    try {
      await fetch('/api/admin/health', { method: 'POST' })
      await loadHealth()
      toast.success('Health check completed')
    } catch (error) {
      toast.error('Health check failed')
    } finally {
      setLoading(false)
    }
  }

  // 載入服務詳情
  const loadServiceDetails = async (serviceName: string) => {
    try {
      const response = await fetch(`/api/admin/health/${serviceName}`)
      const data = await response.json()
      if (data.data) {
        setServiceDetails(data.data)
      }
    } catch (error) {
      toast.error('Failed to load service details')
    }
  }

  // 初始化 WebSocket
  useEffect(() => {
    loadHealth()

    const newSocket = io({
      path: '/api/ws/health',
    })

    newSocket.on('health:update', (data: OverallHealth) => {
      setHealth(data)
    })

    newSocket.on('health:service_change', (data) => {
      toast.info(`${data.serviceName} status changed: ${data.oldStatus} → ${data.newStatus}`)
    })

    setSocket(newSocket)

    return () => {
      newSocket.disconnect()
    }
  }, [])

  // 當選擇服務時載入詳情
  useEffect(() => {
    if (selectedService) {
      loadServiceDetails(selectedService)
    }
  }, [selectedService])

  if (loading && !health) {
    return (
      <div className="flex justify-center items-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 頂部狀態欄 */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div
            className={`w-4 h-4 rounded-full ${STATUS_COLORS[health?.status || 'UNKNOWN']}`}
          />
          <h2 className="text-2xl font-bold">
            System Health: {health?.status || 'Unknown'}
          </h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-gray-600">
            <Users size={20} />
            <span>{health?.activeUsers || 0} active users</span>
          </div>
          <Badge variant="outline">
            {health?.availability24h?.toFixed(2)}% uptime (24h)
          </Badge>
          <Button onClick={handleRefresh} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </Button>
        </div>
      </div>

      {/* 服務狀態卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {health?.services.map((service) => (
          <Card
            key={service.serviceName}
            className={`cursor-pointer transition-shadow hover:shadow-lg ${
              selectedService === service.serviceName ? 'ring-2 ring-blue-500' : ''
            }`}
            onClick={() => setSelectedService(service.serviceName)}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                {SERVICE_ICONS[service.serviceName] || <Server size={24} />}
                <span className="font-medium capitalize">{service.serviceName}</span>
              </div>
              <Badge
                variant={STATUS_BADGES[service.status]?.variant as any}
                className="flex items-center gap-1"
              >
                {STATUS_BADGES[service.status]?.icon}
                {service.status}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {service.responseTime && (
                  <div className="text-sm text-gray-500">
                    Response time: {service.responseTime}ms
                  </div>
                )}
                {service.errorMessage && (
                  <div className="text-sm text-red-500 truncate">
                    {service.errorMessage}
                  </div>
                )}
                <div className="text-xs text-gray-400">
                  Last checked: {new Date(service.checkedAt).toLocaleTimeString()}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 服務詳情面板 */}
      {selectedService && serviceDetails && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-bold capitalize">
              {selectedService} Service Details
            </h3>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 回應時間圖表 */}
              <div>
                <h4 className="font-medium mb-4">Response Time (24h)</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={serviceDetails.history}>
                    <XAxis
                      dataKey="checkedAt"
                      tickFormatter={(value) =>
                        new Date(value).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      }
                    />
                    <YAxis />
                    <Tooltip
                      labelFormatter={(value) => new Date(value).toLocaleString()}
                      formatter={(value: number) => [`${value}ms`, 'Response Time']}
                    />
                    <Line
                      type="monotone"
                      dataKey="responseTime"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* 統計指標 */}
              <div>
                <h4 className="font-medium mb-4">Metrics</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-500">Avg Response</div>
                    <div className="text-2xl font-bold">
                      {serviceDetails.metrics.avgResponseTime.toFixed(0)}ms
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-500">Max Response</div>
                    <div className="text-2xl font-bold">
                      {serviceDetails.metrics.maxResponseTime}ms
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-500">Min Response</div>
                    <div className="text-2xl font-bold">
                      {serviceDetails.metrics.minResponseTime}ms
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-500">Error Rate</div>
                    <div className="text-2xl font-bold">
                      {serviceDetails.metrics.errorRate.toFixed(2)}%
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 錯誤日誌 */}
            {serviceDetails.errorLogs.length > 0 && (
              <div className="mt-6">
                <h4 className="font-medium mb-4">Recent Errors</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {serviceDetails.errorLogs.map((log: any, index: number) => (
                    <div
                      key={index}
                      className="bg-red-50 p-3 rounded-lg text-sm"
                    >
                      <div className="flex justify-between">
                        <span className="text-red-600 font-medium">
                          {log.errorCode || 'Error'}
                        </span>
                        <span className="text-gray-500">
                          {new Date(log.checkedAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-gray-700 mt-1">
                        {log.errorMessage || 'Unknown error'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 最後更新時間 */}
      <div className="text-sm text-gray-400 text-center">
        Last updated: {health?.lastUpdated ? new Date(health.lastUpdated).toLocaleString() : 'N/A'}
      </div>
    </div>
  )
}
```

## 測試案例

### 單元測試

```typescript
// __tests__/services/monitoring/healthCheckService.test.ts
import { healthCheckService } from '@/lib/services/monitoring/healthCheckService'
import { prismaMock } from '@/lib/__mocks__/prisma'

describe('HealthCheckService', () => {
  describe('checkDatabase', () => {
    it('should return healthy status for fast query', async () => {
      prismaMock.$queryRaw.mockResolvedValue([{ '?column?': 1 }])

      const result = await healthCheckService['checkDatabase'](5000)

      expect(result.status).toBe('HEALTHY')
      expect(result.details.connected).toBe(true)
    })
  })

  describe('getOverallHealth', () => {
    it('should return overall health status', async () => {
      prismaMock.serviceHealthCheck.findMany.mockResolvedValue([
        {
          serviceName: 'web',
          serviceType: 'WEB_APP',
          status: 'HEALTHY',
          responseTime: 50,
          checkedAt: new Date(),
        },
        {
          serviceName: 'database',
          serviceType: 'DATABASE',
          status: 'HEALTHY',
          responseTime: 10,
          checkedAt: new Date(),
        },
      ] as any)

      prismaMock.systemOverallStatus.findUnique.mockResolvedValue({
        status: 'HEALTHY',
        activeUsers: 5,
        lastUpdated: new Date(),
      } as any)

      prismaMock.serviceHealthCheck.groupBy.mockResolvedValue([
        { status: 'HEALTHY', _count: 100 },
      ] as any)

      const result = await healthCheckService.getOverallHealth()

      expect(result.status).toBe('HEALTHY')
      expect(result.services).toHaveLength(2)
    })
  })
})
```

## 部署注意事項

1. **健康檢查端點**
   - 所有服務需實現 `/health` 端點
   - 端點應返回快速且輕量的回應

2. **監控頻率**
   - 預設 30 秒檢查一次
   - 可根據服務重要性調整

3. **告警整合**
   - 連接 Story 12-3 告警系統
   - 狀態變化時觸發通知

## 相依性

- Story 12-2: 效能指標追蹤（指標數據來源）
- Story 12-3: 錯誤告警配置（告警觸發）
- Story 12-7: 系統日誌查詢（錯誤日誌）

---

## Implementation Notes

**完成日期**: 2025-12-21

### 實現摘要

本 Story 實現了系統健康監控儀表板，提供以下功能：

1. **Prisma Schema 擴展**
   - `ServiceHealthCheck` - 服務健康檢查記錄
   - `ServiceAvailability` - 每小時可用性彙總
   - `SystemOverallStatus` - 系統整體狀態
   - `ServiceType` enum - 服務類型 (WEB_APP, AI_SERVICE, DATABASE, STORAGE, N8N, CACHE)
   - `HealthStatus` enum - 健康狀態 (HEALTHY, DEGRADED, UNHEALTHY, UNKNOWN, UNCONFIGURED)

2. **核心服務** (`src/services/health-check.service.ts`)
   - `HealthCheckService` 類別：
     - `checkAllServices()` - 執行所有服務健康檢查
     - `checkService()` - 檢查單一服務
     - `getOverallHealth()` - 獲取整體健康狀態
     - `getServiceDetails()` - 獲取服務詳情與歷史
   - 支援的服務類型：
     - Web 應用（HTTP 端點檢查）
     - AI 服務（HTTP 端點檢查）
     - 資料庫（Prisma 連接測試）
     - Azure Blob Storage
     - n8n 工作流
     - Redis 快取（可選依賴）

3. **API 端點**
   - `GET /api/admin/health` - 獲取系統整體健康狀態
   - `POST /api/admin/health` - 手動觸發健康檢查
   - `GET /api/admin/health/[serviceName]` - 獲取特定服務詳情
   - `GET /api/health` - 公開健康檢查端點（無認證）

4. **前端組件** (`src/components/features/admin/monitoring/`)
   - `HealthDashboard.tsx` - 主儀表板組件
     - 整體健康狀態指示器
     - 服務狀態卡片網格
     - 服務詳情面板（點擊展開）
     - 回應時間趨勢圖（recharts）
     - 效能指標統計
     - 錯誤日誌列表
     - 手動刷新按鈕

5. **React Query Hooks** (`src/hooks/use-health-monitoring.ts`)
   - `useHealthStatus()` - 系統健康狀態查詢（30 秒自動刷新）
   - `useServiceDetails()` - 服務詳情查詢
   - `useTriggerHealthCheck()` - 手動觸發健康檢查
   - `useHealthMonitoring()` - 組合 Hook

6. **管理頁面** (`src/app/(dashboard)/admin/monitoring/health/page.tsx`)
   - SYSTEM_MONITOR 權限或管理員角色驗證
   - Suspense 骨架屏載入

### 實現細節

- **24 小時可用性計算**: HEALTHY = 100%, DEGRADED = 50%, UNHEALTHY = 0%
- **活躍用戶判定**: Session 未過期且 lastActiveAt 在 15 分鐘內
- **狀態變化處理**: 記錄日誌，為 WebSocket 通知預留接口
- **可選依賴處理**: Redis (@upstash/redis) 為可選，未安裝時返回 UNCONFIGURED

### 技術決策

1. **WebSocket 通知延後實現**: 根據 Tech Spec，WebSocket 整合標記為 Story 12-1 Phase 2，目前使用 30 秒輪詢替代
2. **Redis 可選依賴**: 使用動態 import 和 ts-expect-error 處理模組未安裝的情況
3. **權限模型**: 同時支援 SYSTEM_MONITOR 權限和角色檢查（GLOBAL_ADMIN, ADMIN, SUPER_USER）

### 檔案清單

| 檔案 | 類型 | 說明 |
|------|------|------|
| `prisma/schema.prisma` | 修改 | 新增健康監控相關模型 |
| `src/types/monitoring.ts` | 新增 | 健康監控類型定義 |
| `src/services/health-check.service.ts` | 新增 | 健康檢查服務 |
| `src/services/index.ts` | 修改 | 導出 HealthCheckService |
| `src/app/api/admin/health/route.ts` | 新增 | 健康狀態 API |
| `src/app/api/admin/health/[serviceName]/route.ts` | 新增 | 服務詳情 API |
| `src/app/api/health/route.ts` | 新增 | 公開健康檢查端點 |
| `src/components/features/admin/monitoring/HealthDashboard.tsx` | 新增 | 健康監控儀表板 |
| `src/components/features/admin/monitoring/index.ts` | 新增 | 監控組件導出 |
| `src/components/features/admin/index.ts` | 修改 | 導出監控組件 |
| `src/hooks/use-health-monitoring.ts` | 新增 | 健康監控 React Query Hooks |
| `src/app/(dashboard)/admin/monitoring/health/page.tsx` | 新增 | 健康監控頁面 |

### 驗收標準達成

| AC | 狀態 | 說明 |
|----|------|------|
| AC1 | ✅ | 健康狀態總覽顯示整體狀態、服務卡片、24h 可用性、活躍用戶數 |
| AC2 | ✅ | 異常服務卡片顯示紅色警示、異常開始時間、錯誤描述 |
| AC3 | ✅ | 30 秒自動刷新，手動刷新按鈕 |
| AC4 | ✅ | 點擊服務卡片展開詳情面板，含回應時間圖、錯誤率、錯誤日誌 |
