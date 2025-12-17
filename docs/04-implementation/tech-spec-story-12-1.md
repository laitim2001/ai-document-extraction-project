# Tech Spec: Story 12-1 - 系統健康監控儀表板

## 1. Overview

### 1.1 Purpose
本技術規格書詳細描述系統健康監控儀表板的完整實作方案，提供即時的系統狀態可視化，讓系統管理員能夠快速了解各服務的運行狀況並及時發現問題。

### 1.2 Scope
- **服務健康檢查引擎**: 定期檢查 Web 應用、AI 服務、資料庫、儲存服務、n8n 工作流、快取等服務
- **即時監控儀表板**: 整體健康狀態指示器、各服務狀態卡片、可用性統計
- **WebSocket 即時更新**: 狀態變化時自動推送更新
- **服務詳情分析**: 回應時間趨勢圖、錯誤率統計、錯誤日誌

### 1.3 Background
系統健康監控是維運可靠性的基礎。透過主動式健康檢查和即時儀表板，管理員可以在問題發生的第一時間獲得通知，大幅降低系統停機時間和影響範圍。

### 1.4 Dependencies
- **Story 12-2**: 效能指標追蹤（指標數據來源）
- **Story 12-3**: 錯誤告警配置（告警觸發整合）
- **Story 12-7**: 系統日誌查詢（錯誤日誌整合）

---

## 2. Architecture & Design

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        System Health Monitoring                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐     │
│  │  Health Check   │    │   Health API    │    │   WebSocket     │     │
│  │    Scheduler    │───▶│   Endpoints     │───▶│    Server       │     │
│  │  (30s interval) │    │                 │    │                 │     │
│  └────────┬────────┘    └────────┬────────┘    └────────┬────────┘     │
│           │                      │                      │               │
│           ▼                      ▼                      ▼               │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    HealthCheckService                            │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │   │
│  │  │  Web    │ │   AI    │ │ Database│ │ Storage │ │  n8n    │   │   │
│  │  │ Checker │ │ Checker │ │ Checker │ │ Checker │ │ Checker │   │   │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘   │   │
│  └───────┼──────────┼──────────┼──────────┼──────────┼──────────┘   │
│          │          │          │          │          │               │
│          ▼          ▼          ▼          ▼          ▼               │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      PostgreSQL Database                         │   │
│  │  ┌────────────────────┐  ┌─────────────────────┐                │   │
│  │  │ ServiceHealthCheck │  │ ServiceAvailability │                │   │
│  │  └────────────────────┘  └─────────────────────┘                │   │
│  │  ┌────────────────────┐                                          │   │
│  │  │ SystemOverallStatus│                                          │   │
│  │  └────────────────────┘                                          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Health Dashboard UI                           │   │
│  │  ┌──────────────┐  ┌────────────────┐  ┌──────────────────┐    │   │
│  │  │ Status Cards │  │ Response Chart │  │   Error Logs     │    │   │
│  │  └──────────────┘  └────────────────┘  └──────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Component Interaction Flow

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────────┐
│   Scheduler │────▶│ HealthCheck     │────▶│ Check Each       │
│  (cron job) │     │ Service         │     │ Service          │
└─────────────┘     └─────────────────┘     └────────┬─────────┘
                                                      │
                    ┌─────────────────────────────────┼─────────────────┐
                    │                                 │                 │
                    ▼                                 ▼                 ▼
            ┌───────────────┐              ┌──────────────┐    ┌───────────┐
            │ HTTP Endpoint │              │  Database    │    │   Redis   │
            │    Check      │              │    Query     │    │   Ping    │
            └───────────────┘              └──────────────┘    └───────────┘
                    │                                 │                 │
                    └─────────────────────────────────┼─────────────────┘
                                                      │
                                                      ▼
                                            ┌──────────────────┐
                                            │ Save to Database │
                                            │ + Update Status  │
                                            └────────┬─────────┘
                                                     │
                              ┌───────────────────────┼────────────────────┐
                              │                       │                    │
                              ▼                       ▼                    ▼
                    ┌──────────────────┐   ┌──────────────────┐  ┌──────────────┐
                    │ Broadcast via    │   │ Trigger Alerts   │  │ Log Status   │
                    │ WebSocket        │   │ (if abnormal)    │  │ Change       │
                    └──────────────────┘   └──────────────────┘  └──────────────┘
```

### 2.3 Design Principles

1. **主動式健康檢查**: 定期主動檢查各服務，而非被動等待故障
2. **多維度健康評估**: 結合可達性、回應時間、錯誤率等多維度評估
3. **即時狀態推送**: 透過 WebSocket 實現狀態變化的即時通知
4. **歷史數據保留**: 保留健康檢查歷史以供分析和趨勢觀察
5. **可擴展架構**: 易於新增服務健康檢查類型

---

## 3. Database Design

### 3.1 Prisma Schema

```prisma
// 服務類型枚舉
enum ServiceType {
  WEB_APP         // Web 應用程式
  AI_SERVICE      // AI 處理服務
  DATABASE        // 數據庫
  STORAGE         // Blob 儲存
  N8N             // n8n 工作流
  CACHE           // Redis 快取
  EXTERNAL_API    // 外部 API
}

// 健康狀態枚舉
enum HealthStatus {
  HEALTHY         // 正常
  DEGRADED        // 降級（部分功能受影響）
  UNHEALTHY       // 異常
  UNKNOWN         // 未知
}

// 服務健康檢查記錄
model ServiceHealthCheck {
  id              String       @id @default(cuid())

  // 服務資訊
  serviceName     String       // web, ai, database, storage, n8n, cache
  serviceType     ServiceType

  // 健康狀態
  status          HealthStatus
  responseTime    Int?         // 毫秒
  errorMessage    String?
  errorCode       String?

  // 詳細資訊
  details         Json?        // 額外的健康檢查細節
  endpoint        String?      // 健康檢查端點

  // 時間記錄
  checkedAt       DateTime     @default(now())

  @@index([serviceName])
  @@index([status])
  @@index([checkedAt])
  @@index([serviceName, checkedAt])
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
  @@index([serviceName, date])
}

// 系統整體狀態
model SystemOverallStatus {
  id              String       @id @default(cuid())
  status          HealthStatus
  activeUsers     Int          @default(0)
  lastUpdated     DateTime     @default(now())

  // 各服務狀態摘要
  servicesSummary Json         // { healthy: 4, degraded: 1, unhealthy: 0 }
}
```

### 3.2 Entity Relationship Diagram

```
┌─────────────────────────────────────┐
│         ServiceHealthCheck          │
├─────────────────────────────────────┤
│ id              String (PK)         │
│ serviceName     String              │
│ serviceType     ServiceType         │
│ status          HealthStatus        │
│ responseTime    Int?                │
│ errorMessage    String?             │
│ errorCode       String?             │
│ details         Json?               │
│ endpoint        String?             │
│ checkedAt       DateTime            │
└─────────────────────────────────────┘
              │
              │ aggregates to
              ▼
┌─────────────────────────────────────┐
│        ServiceAvailability          │
├─────────────────────────────────────┤
│ id              String (PK)         │
│ serviceName     String              │
│ date            DateTime            │
│ hour            Int                 │
│ totalChecks     Int                 │
│ healthyChecks   Int                 │
│ degradedChecks  Int                 │
│ unhealthyChecks Int                 │
│ avgResponseTime Float?              │
│ availabilityPct Float               │
│ createdAt       DateTime            │
└─────────────────────────────────────┘
              │
              │ summarizes to
              ▼
┌─────────────────────────────────────┐
│        SystemOverallStatus          │
├─────────────────────────────────────┤
│ id              String (PK)         │
│ status          HealthStatus        │
│ activeUsers     Int                 │
│ lastUpdated     DateTime            │
│ servicesSummary Json                │
└─────────────────────────────────────┘
```

### 3.3 Index Strategy

```sql
-- 高頻查詢索引
CREATE INDEX idx_health_check_service_time ON "ServiceHealthCheck" ("serviceName", "checkedAt" DESC);
CREATE INDEX idx_health_check_status_time ON "ServiceHealthCheck" ("status", "checkedAt" DESC);
CREATE INDEX idx_availability_service_date ON "ServiceAvailability" ("serviceName", "date" DESC);

-- 效能優化索引
CREATE INDEX idx_health_check_recent ON "ServiceHealthCheck" ("checkedAt" DESC)
  WHERE "checkedAt" > NOW() - INTERVAL '24 hours';
```

---

## 4. API Design

### 4.1 RESTful Endpoints

#### GET /api/admin/health
獲取系統整體健康狀態

**Request:**
```http
GET /api/admin/health
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "data": {
    "status": "HEALTHY",
    "services": [
      {
        "serviceName": "web",
        "serviceType": "WEB_APP",
        "status": "HEALTHY",
        "responseTime": 45,
        "checkedAt": "2025-01-15T10:30:00Z"
      },
      {
        "serviceName": "ai",
        "serviceType": "AI_SERVICE",
        "status": "HEALTHY",
        "responseTime": 230,
        "checkedAt": "2025-01-15T10:30:00Z"
      },
      {
        "serviceName": "database",
        "serviceType": "DATABASE",
        "status": "HEALTHY",
        "responseTime": 8,
        "details": {
          "provider": "postgresql",
          "connected": true
        },
        "checkedAt": "2025-01-15T10:30:00Z"
      }
    ],
    "activeUsers": 25,
    "availability24h": 99.95,
    "lastUpdated": "2025-01-15T10:30:00Z"
  }
}
```

#### POST /api/admin/health
手動觸發健康檢查

**Request:**
```http
POST /api/admin/health
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "data": [
    {
      "serviceName": "web",
      "serviceType": "WEB_APP",
      "status": "HEALTHY",
      "responseTime": 42,
      "checkedAt": "2025-01-15T10:31:00Z"
    }
  ]
}
```

#### GET /api/admin/health/{serviceName}
獲取特定服務的詳細資訊

**Request:**
```http
GET /api/admin/health/ai?hours=24
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "data": {
    "service": {
      "serviceName": "ai",
      "serviceType": "AI_SERVICE",
      "status": "HEALTHY",
      "responseTime": 230,
      "checkedAt": "2025-01-15T10:30:00Z"
    },
    "history": [
      {
        "checkedAt": "2025-01-15T10:30:00Z",
        "status": "HEALTHY",
        "responseTime": 230
      },
      {
        "checkedAt": "2025-01-15T10:00:00Z",
        "status": "HEALTHY",
        "responseTime": 215
      }
    ],
    "errorLogs": [
      {
        "checkedAt": "2025-01-14T22:15:00Z",
        "errorMessage": "Connection timeout",
        "errorCode": "ECONNREFUSED"
      }
    ],
    "metrics": {
      "avgResponseTime": 225.5,
      "maxResponseTime": 890,
      "minResponseTime": 180,
      "errorRate": 0.5
    }
  }
}
```

### 4.2 WebSocket Events

#### Connection
```javascript
// Client connects to WebSocket
const socket = io({
  path: '/api/ws/health',
})
```

#### Events

**health:update** - 健康狀態更新
```json
{
  "status": "HEALTHY",
  "services": [...],
  "activeUsers": 25,
  "availability24h": 99.95,
  "lastUpdated": "2025-01-15T10:30:00Z"
}
```

**health:service_change** - 服務狀態變化
```json
{
  "serviceName": "ai",
  "oldStatus": "HEALTHY",
  "newStatus": "DEGRADED",
  "timestamp": "2025-01-15T10:35:00Z"
}
```

---

## 5. TypeScript Types & Interfaces

### 5.1 Core Types

```typescript
// types/monitoring/health.ts

import { ServiceType, HealthStatus } from '@prisma/client'

/**
 * 服務配置
 */
export interface ServiceConfig {
  name: string
  type: ServiceType
  endpoint: string
  timeout: number      // 檢查超時時間（毫秒）
  checkInterval: number // 檢查間隔（毫秒）
}

/**
 * 服務健康檢查結果
 */
export interface ServiceHealthResult {
  serviceName: string
  serviceType: ServiceType
  status: HealthStatus
  responseTime?: number
  errorMessage?: string
  errorCode?: string
  details?: Record<string, any>
  checkedAt: Date
}

/**
 * 系統整體健康狀態
 */
export interface OverallHealthStatus {
  status: HealthStatus
  services: ServiceHealthResult[]
  activeUsers: number
  availability24h: number
  lastUpdated: Date
}

/**
 * 服務健康詳情
 */
export interface ServiceHealthDetails {
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
  metrics: ServiceMetrics
}

/**
 * 服務效能指標
 */
export interface ServiceMetrics {
  avgResponseTime: number
  maxResponseTime: number
  minResponseTime: number
  errorRate: number
}

/**
 * 健康檢查細節結果
 */
export interface HealthCheckDetailResult {
  status: HealthStatus
  details: Record<string, any>
}

/**
 * 服務狀態摘要
 */
export interface ServicesSummary {
  healthy: number
  degraded: number
  unhealthy: number
}
```

### 5.2 API Request/Response Types

```typescript
// types/api/health.ts

import { OverallHealthStatus, ServiceHealthResult, ServiceHealthDetails } from '../monitoring/health'

/**
 * GET /api/admin/health 響應
 */
export interface GetHealthResponse {
  data: OverallHealthStatus
}

/**
 * POST /api/admin/health 響應
 */
export interface TriggerHealthCheckResponse {
  data: ServiceHealthResult[]
}

/**
 * GET /api/admin/health/{serviceName} 查詢參數
 */
export interface GetServiceHealthParams {
  serviceName: string
  hours?: number
}

/**
 * GET /api/admin/health/{serviceName} 響應
 */
export interface GetServiceHealthResponse {
  data: ServiceHealthDetails
}
```

### 5.3 WebSocket Event Types

```typescript
// types/websocket/health.ts

import { OverallHealthStatus, HealthStatus } from '../monitoring/health'

/**
 * WebSocket 健康狀態更新事件
 */
export interface HealthUpdateEvent {
  type: 'health:update'
  payload: OverallHealthStatus
}

/**
 * WebSocket 服務狀態變化事件
 */
export interface ServiceChangeEvent {
  type: 'health:service_change'
  payload: {
    serviceName: string
    oldStatus: HealthStatus
    newStatus: HealthStatus
    timestamp: string
  }
}

/**
 * 所有 WebSocket 事件類型
 */
export type HealthWebSocketEvent = HealthUpdateEvent | ServiceChangeEvent
```

---

## 6. Service Layer Implementation

### 6.1 Health Check Service

```typescript
// lib/services/monitoring/healthCheckService.ts
import { prisma } from '@/lib/prisma'
import { HealthStatus, ServiceType } from '@prisma/client'
import { Redis } from '@upstash/redis'
import { BlobServiceClient } from '@azure/storage-blob'
import {
  ServiceConfig,
  ServiceHealthResult,
  OverallHealthStatus,
  ServiceHealthDetails,
  HealthCheckDetailResult,
} from '@/types/monitoring/health'

/**
 * 服務配置列表
 */
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

/**
 * 健康檢查服務
 */
export class HealthCheckService {
  private redis: Redis | null = null

  constructor() {
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      this.redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    }
  }

  /**
   * 執行所有服務的健康檢查
   */
  async checkAllServices(): Promise<ServiceHealthResult[]> {
    const results: ServiceHealthResult[] = []
    const previousStatuses = await this.getPreviousStatuses()

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

      // 檢查狀態變化
      const previousStatus = previousStatuses.get(service.name)
      if (previousStatus && previousStatus !== result.status) {
        await this.handleStatusChange(service.name, previousStatus, result.status)
      }
    }

    // 更新整體狀態
    await this.updateOverallStatus(results)

    return results
  }

  /**
   * 獲取之前的服務狀態
   */
  private async getPreviousStatuses(): Promise<Map<string, HealthStatus>> {
    const statuses = new Map<string, HealthStatus>()

    const latestChecks = await prisma.serviceHealthCheck.findMany({
      where: {
        checkedAt: { gt: new Date(Date.now() - 5 * 60 * 1000) },
      },
      orderBy: { checkedAt: 'desc' },
      distinct: ['serviceName'],
    })

    for (const check of latestChecks) {
      statuses.set(check.serviceName, check.status)
    }

    return statuses
  }

  /**
   * 處理狀態變化
   */
  private async handleStatusChange(
    serviceName: string,
    oldStatus: HealthStatus,
    newStatus: HealthStatus
  ): Promise<void> {
    // 發送 WebSocket 通知
    const { broadcastServiceChange } = await import('@/lib/websocket/healthWebSocket')
    broadcastServiceChange(serviceName, oldStatus, newStatus)

    // 記錄到系統日誌
    console.log(`Service ${serviceName} status changed: ${oldStatus} → ${newStatus}`)
  }

  /**
   * 檢查單一服務
   */
  async checkService(config: ServiceConfig): Promise<ServiceHealthResult> {
    const startTime = Date.now()

    try {
      let checkResult: HealthCheckDetailResult

      switch (config.type) {
        case 'DATABASE':
          checkResult = await this.checkDatabase(config.timeout)
          break

        case 'CACHE':
          checkResult = await this.checkRedis(config.timeout)
          break

        case 'STORAGE':
          checkResult = await this.checkStorage(config.timeout)
          break

        default:
          checkResult = await this.checkHttpEndpoint(config.endpoint, config.timeout)
      }

      return {
        serviceName: config.name,
        serviceType: config.type,
        status: checkResult.status,
        responseTime: Date.now() - startTime,
        details: checkResult.details,
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

  /**
   * 檢查 HTTP 端點
   */
  private async checkHttpEndpoint(
    url: string,
    timeout: number
  ): Promise<HealthCheckDetailResult> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      const response = await fetch(url, {
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

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

  /**
   * 檢查數據庫
   */
  private async checkDatabase(timeout: number): Promise<HealthCheckDetailResult> {
    try {
      const startTime = Date.now()

      // 執行簡單查詢測試連接
      await prisma.$queryRaw`SELECT 1`

      const queryTime = Date.now() - startTime

      return {
        status: queryTime > timeout / 2 ? 'DEGRADED' : 'HEALTHY',
        details: {
          queryTime,
          provider: 'postgresql',
          connected: true,
        },
      }
    } catch (error) {
      throw error
    }
  }

  /**
   * 檢查 Redis
   */
  private async checkRedis(timeout: number): Promise<HealthCheckDetailResult> {
    if (!this.redis) {
      return {
        status: 'UNKNOWN',
        details: { message: 'Redis not configured' },
      }
    }

    try {
      const startTime = Date.now()

      // 執行 PING 測試
      const pong = await this.redis.ping()
      const pingTime = Date.now() - startTime

      return {
        status: pong === 'PONG' ? 'HEALTHY' : 'DEGRADED',
        details: {
          pingTime,
          response: pong,
        },
      }
    } catch (error) {
      throw error
    }
  }

  /**
   * 檢查 Azure Blob Storage
   */
  private async checkStorage(timeout: number): Promise<HealthCheckDetailResult> {
    try {
      const startTime = Date.now()

      const blobServiceClient = BlobServiceClient.fromConnectionString(
        process.env.AZURE_STORAGE_CONNECTION_STRING!
      )

      // 列出容器測試連接
      const containers: string[] = []
      for await (const container of blobServiceClient.listContainers()) {
        containers.push(container.name)
        if (containers.length >= 1) break
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

  /**
   * 更新整體狀態
   */
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

    // 廣播更新
    const overallHealth = await this.getOverallHealth()
    const { broadcastHealthUpdate } = await import('@/lib/websocket/healthWebSocket')
    broadcastHealthUpdate(overallHealth)
  }

  /**
   * 獲取活躍用戶數
   */
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

  /**
   * 獲取整體健康狀態
   */
  async getOverallHealth(): Promise<OverallHealthStatus> {
    // 獲取最新的服務狀態
    const latestChecks = await prisma.serviceHealthCheck.findMany({
      where: {
        checkedAt: { gt: new Date(Date.now() - 5 * 60 * 1000) },
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

  /**
   * 計算 24 小時可用性
   */
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

  /**
   * 獲取服務詳情
   */
  async getServiceDetails(serviceName: string, hours: number = 24): Promise<ServiceHealthDetails> {
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

    const unhealthyCount = history.filter((h) => h.status === 'UNHEALTHY').length

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
      history: history.map((h) => ({
        checkedAt: h.checkedAt,
        status: h.status,
        responseTime: h.responseTime,
      })),
      errorLogs: errorLogs.map((e) => ({
        checkedAt: e.checkedAt,
        errorMessage: e.errorMessage,
        errorCode: e.errorCode,
      })),
      metrics: {
        avgResponseTime:
          responseTimes.length > 0
            ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
            : 0,
        maxResponseTime: responseTimes.length > 0 ? Math.max(...responseTimes) : 0,
        minResponseTime: responseTimes.length > 0 ? Math.min(...responseTimes) : 0,
        errorRate: history.length > 0 ? (unhealthyCount / history.length) * 100 : 0,
      },
    }
  }
}

export const healthCheckService = new HealthCheckService()
```

### 6.2 Health Check Job

```typescript
// lib/jobs/healthCheckJob.ts
import { healthCheckService } from '@/lib/services/monitoring/healthCheckService'

/**
 * 健康檢查排程任務
 */
export class HealthCheckJob {
  private intervalId: NodeJS.Timeout | null = null

  /**
   * 啟動健康檢查排程
   */
  start(intervalMs: number = 30000): void {
    if (this.intervalId) {
      console.warn('Health check job already running')
      return
    }

    console.log(`Starting health check job with interval ${intervalMs}ms`)

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

  /**
   * 停止排程任務
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
      console.log('Health check job stopped')
    }
  }

  /**
   * 手動執行一次
   */
  async runOnce(): Promise<void> {
    const results = await healthCheckService.checkAllServices()
    const healthyCount = results.filter((r) => r.status === 'HEALTHY').length
    console.log(`Health check completed: ${healthyCount}/${results.length} healthy`)
  }
}

export const healthCheckJob = new HealthCheckJob()
```

### 6.3 WebSocket Handler

```typescript
// lib/websocket/healthWebSocket.ts
import { Server as SocketIOServer } from 'socket.io'
import { healthCheckService } from '@/lib/services/monitoring/healthCheckService'
import { OverallHealthStatus, HealthStatus } from '@/types/monitoring/health'

let io: SocketIOServer | null = null

/**
 * 初始化健康檢查 WebSocket
 */
export function initHealthWebSocket(server: any): void {
  io = new SocketIOServer(server, {
    path: '/api/ws/health',
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL,
      methods: ['GET', 'POST'],
    },
  })

  io.on('connection', async (socket) => {
    console.log('Health WebSocket client connected:', socket.id)

    // 發送初始狀態
    try {
      const health = await healthCheckService.getOverallHealth()
      socket.emit('health:update', health)
    } catch (error) {
      console.error('Failed to send initial health status:', error)
    }

    socket.on('disconnect', () => {
      console.log('Health WebSocket client disconnected:', socket.id)
    })

    // 處理手動刷新請求
    socket.on('health:refresh', async () => {
      try {
        const health = await healthCheckService.getOverallHealth()
        socket.emit('health:update', health)
      } catch (error) {
        console.error('Failed to refresh health status:', error)
      }
    })
  })
}

/**
 * 廣播健康狀態更新
 */
export function broadcastHealthUpdate(health: OverallHealthStatus): void {
  if (io) {
    io.emit('health:update', health)
  }
}

/**
 * 廣播服務狀態變化
 */
export function broadcastServiceChange(
  serviceName: string,
  oldStatus: HealthStatus,
  newStatus: HealthStatus
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

---

## 7. UI Components

### 7.1 Health Dashboard Component

```typescript
// components/admin/monitoring/HealthDashboard.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
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
  Activity,
} from 'lucide-react'
import { io, Socket } from 'socket.io-client'
import { toast } from '@/hooks/useToast'
import {
  ServiceHealthResult,
  OverallHealthStatus,
  ServiceHealthDetails,
  HealthStatus,
} from '@/types/monitoring/health'

/**
 * 服務圖標映射
 */
const SERVICE_ICONS: Record<string, React.ReactNode> = {
  web: <Server size={24} />,
  ai: <Cpu size={24} />,
  database: <Database size={24} />,
  storage: <Cloud size={24} />,
  n8n: <Server size={24} />,
  cache: <Database size={24} />,
}

/**
 * 狀態顏色映射
 */
const STATUS_COLORS: Record<HealthStatus, string> = {
  HEALTHY: 'bg-green-500',
  DEGRADED: 'bg-yellow-500',
  UNHEALTHY: 'bg-red-500',
  UNKNOWN: 'bg-gray-500',
}

/**
 * 狀態標籤配置
 */
const STATUS_BADGES: Record<HealthStatus, { variant: string; icon: React.ReactNode }> = {
  HEALTHY: { variant: 'success', icon: <CheckCircle size={16} /> },
  DEGRADED: { variant: 'warning', icon: <AlertTriangle size={16} /> },
  UNHEALTHY: { variant: 'destructive', icon: <XCircle size={16} /> },
  UNKNOWN: { variant: 'secondary', icon: <AlertTriangle size={16} /> },
}

/**
 * 健康監控儀表板
 */
export function HealthDashboard() {
  const [health, setHealth] = useState<OverallHealthStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedService, setSelectedService] = useState<string | null>(null)
  const [serviceDetails, setServiceDetails] = useState<ServiceHealthDetails | null>(null)
  const [socket, setSocket] = useState<Socket | null>(null)

  /**
   * 載入健康狀態
   */
  const loadHealth = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/health')
      const data = await response.json()
      if (data.data) {
        setHealth(data.data)
      }
    } catch (error) {
      toast.error('載入健康狀態失敗')
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * 手動刷新
   */
  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await fetch('/api/admin/health', { method: 'POST' })
      await loadHealth()
      toast.success('健康檢查完成')
    } catch (error) {
      toast.error('健康檢查失敗')
    } finally {
      setRefreshing(false)
    }
  }

  /**
   * 載入服務詳情
   */
  const loadServiceDetails = async (serviceName: string) => {
    try {
      const response = await fetch(`/api/admin/health/${serviceName}?hours=24`)
      const data = await response.json()
      if (data.data) {
        setServiceDetails(data.data)
      }
    } catch (error) {
      toast.error('載入服務詳情失敗')
    }
  }

  // 初始化 WebSocket
  useEffect(() => {
    loadHealth()

    const newSocket = io({
      path: '/api/ws/health',
    })

    newSocket.on('health:update', (data: OverallHealthStatus) => {
      setHealth(data)
    })

    newSocket.on('health:service_change', (data) => {
      toast.info(
        `${data.serviceName} 狀態變更: ${data.oldStatus} → ${data.newStatus}`
      )
    })

    setSocket(newSocket)

    return () => {
      newSocket.disconnect()
    }
  }, [loadHealth])

  // 當選擇服務時載入詳情
  useEffect(() => {
    if (selectedService) {
      loadServiceDetails(selectedService)
    } else {
      setServiceDetails(null)
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
            className={`w-4 h-4 rounded-full ${
              STATUS_COLORS[health?.status || 'UNKNOWN']
            }`}
          />
          <h2 className="text-2xl font-bold">
            系統健康狀態: {getStatusLabel(health?.status)}
          </h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-gray-600">
            <Users size={20} />
            <span>{health?.activeUsers || 0} 活躍用戶</span>
          </div>
          <Badge variant="outline">
            <Activity className="w-4 h-4 mr-1" />
            {health?.availability24h?.toFixed(2)}% 可用性 (24h)
          </Badge>
          <Button onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            刷新
          </Button>
        </div>
      </div>

      {/* 服務狀態卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {health?.services.map((service) => (
          <ServiceCard
            key={service.serviceName}
            service={service}
            isSelected={selectedService === service.serviceName}
            onClick={() =>
              setSelectedService(
                selectedService === service.serviceName ? null : service.serviceName
              )
            }
          />
        ))}
      </div>

      {/* 服務詳情面板 */}
      {selectedService && serviceDetails && (
        <ServiceDetailsPanel
          serviceName={selectedService}
          details={serviceDetails}
        />
      )}

      {/* 最後更新時間 */}
      <div className="text-sm text-gray-400 text-center">
        最後更新:{' '}
        {health?.lastUpdated
          ? new Date(health.lastUpdated).toLocaleString()
          : 'N/A'}
      </div>
    </div>
  )
}

/**
 * 服務狀態卡片
 */
interface ServiceCardProps {
  service: ServiceHealthResult
  isSelected: boolean
  onClick: () => void
}

function ServiceCard({ service, isSelected, onClick }: ServiceCardProps) {
  const badgeConfig = STATUS_BADGES[service.status]

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-lg ${
        isSelected ? 'ring-2 ring-blue-500' : ''
      }`}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          {SERVICE_ICONS[service.serviceName] || <Server size={24} />}
          <span className="font-medium capitalize">{service.serviceName}</span>
        </div>
        <Badge
          variant={badgeConfig?.variant as any}
          className="flex items-center gap-1"
        >
          {badgeConfig?.icon}
          {getStatusLabel(service.status)}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {service.responseTime && (
            <div className="text-sm text-gray-500">
              回應時間: {service.responseTime}ms
            </div>
          )}
          {service.errorMessage && (
            <div className="text-sm text-red-500 truncate">
              {service.errorMessage}
            </div>
          )}
          <div className="text-xs text-gray-400">
            最後檢查: {new Date(service.checkedAt).toLocaleTimeString()}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * 服務詳情面板
 */
interface ServiceDetailsPanelProps {
  serviceName: string
  details: ServiceHealthDetails
}

function ServiceDetailsPanel({ serviceName, details }: ServiceDetailsPanelProps) {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-bold capitalize">
          {serviceName} 服務詳情
        </h3>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 回應時間圖表 */}
          <div>
            <h4 className="font-medium mb-4">回應時間 (24h)</h4>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={details.history}>
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
                  formatter={(value: number) => [`${value}ms`, '回應時間']}
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
            <h4 className="font-medium mb-4">效能指標</h4>
            <div className="grid grid-cols-2 gap-4">
              <MetricCard
                label="平均回應"
                value={`${details.metrics.avgResponseTime.toFixed(0)}ms`}
              />
              <MetricCard
                label="最大回應"
                value={`${details.metrics.maxResponseTime}ms`}
              />
              <MetricCard
                label="最小回應"
                value={`${details.metrics.minResponseTime}ms`}
              />
              <MetricCard
                label="錯誤率"
                value={`${details.metrics.errorRate.toFixed(2)}%`}
                isError={details.metrics.errorRate > 5}
              />
            </div>
          </div>
        </div>

        {/* 錯誤日誌 */}
        {details.errorLogs.length > 0 && (
          <div className="mt-6">
            <h4 className="font-medium mb-4">最近錯誤</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {details.errorLogs.map((log, index) => (
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
                    {log.errorMessage || '未知錯誤'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * 指標卡片
 */
interface MetricCardProps {
  label: string
  value: string
  isError?: boolean
}

function MetricCard({ label, value, isError }: MetricCardProps) {
  return (
    <div className="bg-gray-50 p-4 rounded-lg">
      <div className="text-sm text-gray-500">{label}</div>
      <div className={`text-2xl font-bold ${isError ? 'text-red-500' : ''}`}>
        {value}
      </div>
    </div>
  )
}

/**
 * 獲取狀態標籤
 */
function getStatusLabel(status?: HealthStatus): string {
  const labels: Record<HealthStatus, string> = {
    HEALTHY: '正常',
    DEGRADED: '降級',
    UNHEALTHY: '異常',
    UNKNOWN: '未知',
  }
  return labels[status || 'UNKNOWN']
}

export default HealthDashboard
```

---

## 8. API Routes Implementation

### 8.1 Health API Route

```typescript
// app/api/admin/health/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { healthCheckService } from '@/lib/services/monitoring/healthCheckService'

/**
 * GET /api/admin/health
 * 獲取系統整體健康狀態
 */
export async function GET(request: NextRequest) {
  try {
    // 驗證管理員權限
    const session = await getServerSession(authOptions)
    if (!session?.user || !['ADMIN', 'SUPER_USER'].includes(session.user.role)) {
      return NextResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: '需要管理員權限',
          },
        },
        { status: 403 }
      )
    }

    const health = await healthCheckService.getOverallHealth()

    return NextResponse.json({ data: health }, { status: 200 })
  } catch (error) {
    console.error('Get health status error:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: '獲取健康狀態失敗',
        },
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/health
 * 手動觸發健康檢查
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || !['ADMIN', 'SUPER_USER'].includes(session.user.role)) {
      return NextResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: '需要管理員權限',
          },
        },
        { status: 403 }
      )
    }

    const results = await healthCheckService.checkAllServices()

    return NextResponse.json({ data: results }, { status: 200 })
  } catch (error) {
    console.error('Health check error:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: '健康檢查失敗',
        },
      },
      { status: 500 }
    )
  }
}
```

### 8.2 Service Health Detail API Route

```typescript
// app/api/admin/health/[serviceName]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { healthCheckService } from '@/lib/services/monitoring/healthCheckService'

/**
 * GET /api/admin/health/{serviceName}
 * 獲取特定服務的詳細資訊
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { serviceName: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || !['ADMIN', 'SUPER_USER'].includes(session.user.role)) {
      return NextResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: '需要管理員權限',
          },
        },
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
        {
          error: {
            code: 'NOT_FOUND',
            message: '服務不存在',
          },
        },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: details }, { status: 200 })
  } catch (error) {
    console.error('Get service details error:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: '獲取服務詳情失敗',
        },
      },
      { status: 500 }
    )
  }
}
```

---

## 9. Test Plan

### 9.1 Unit Tests

```typescript
// __tests__/services/monitoring/healthCheckService.test.ts
import { healthCheckService, HealthCheckService } from '@/lib/services/monitoring/healthCheckService'
import { prismaMock } from '@/lib/__mocks__/prisma'

describe('HealthCheckService', () => {
  describe('checkDatabase', () => {
    it('should return healthy status for fast query', async () => {
      prismaMock.$queryRaw.mockResolvedValue([{ '?column?': 1 }])

      const service = new HealthCheckService()
      const result = await service['checkDatabase'](5000)

      expect(result.status).toBe('HEALTHY')
      expect(result.details.connected).toBe(true)
    })

    it('should return degraded status for slow query', async () => {
      // 模擬慢查詢
      prismaMock.$queryRaw.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 3000))
        return [{ '?column?': 1 }]
      })

      const service = new HealthCheckService()
      const result = await service['checkDatabase'](5000)

      expect(result.status).toBe('DEGRADED')
    })

    it('should throw error for failed query', async () => {
      prismaMock.$queryRaw.mockRejectedValue(new Error('Connection failed'))

      const service = new HealthCheckService()

      await expect(service['checkDatabase'](5000)).rejects.toThrow('Connection failed')
    })
  })

  describe('getOverallHealth', () => {
    it('should return overall health status', async () => {
      prismaMock.serviceHealthCheck.findMany.mockResolvedValue([
        {
          id: 'check-1',
          serviceName: 'web',
          serviceType: 'WEB_APP',
          status: 'HEALTHY',
          responseTime: 50,
          errorMessage: null,
          errorCode: null,
          details: null,
          endpoint: '/api/health',
          checkedAt: new Date(),
        },
        {
          id: 'check-2',
          serviceName: 'database',
          serviceType: 'DATABASE',
          status: 'HEALTHY',
          responseTime: 10,
          errorMessage: null,
          errorCode: null,
          details: null,
          endpoint: 'prisma',
          checkedAt: new Date(),
        },
      ] as any)

      prismaMock.systemOverallStatus.findUnique.mockResolvedValue({
        id: 'current',
        status: 'HEALTHY',
        activeUsers: 5,
        servicesSummary: { healthy: 2, degraded: 0, unhealthy: 0 },
        lastUpdated: new Date(),
      } as any)

      prismaMock.serviceHealthCheck.groupBy.mockResolvedValue([
        { status: 'HEALTHY', _count: 100 },
      ] as any)

      const result = await healthCheckService.getOverallHealth()

      expect(result.status).toBe('HEALTHY')
      expect(result.services).toHaveLength(2)
      expect(result.activeUsers).toBe(5)
    })
  })

  describe('calculate24hAvailability', () => {
    it('should calculate correct availability percentage', async () => {
      prismaMock.serviceHealthCheck.groupBy.mockResolvedValue([
        { status: 'HEALTHY', _count: 90 },
        { status: 'DEGRADED', _count: 8 },
        { status: 'UNHEALTHY', _count: 2 },
      ] as any)

      const service = new HealthCheckService()
      const availability = await service['calculate24hAvailability']()

      // (90*100 + 8*50 + 2*0) / 100 / 100 * 100 = 94%
      expect(availability).toBeCloseTo(94, 1)
    })

    it('should return 100% for empty data', async () => {
      prismaMock.serviceHealthCheck.groupBy.mockResolvedValue([])

      const service = new HealthCheckService()
      const availability = await service['calculate24hAvailability']()

      expect(availability).toBe(100)
    })
  })

  describe('getServiceDetails', () => {
    it('should return service details with metrics', async () => {
      prismaMock.serviceHealthCheck.findFirst.mockResolvedValue({
        id: 'check-1',
        serviceName: 'ai',
        serviceType: 'AI_SERVICE',
        status: 'HEALTHY',
        responseTime: 230,
        checkedAt: new Date(),
      } as any)

      prismaMock.serviceHealthCheck.findMany.mockResolvedValue([
        { checkedAt: new Date(), status: 'HEALTHY', responseTime: 200 },
        { checkedAt: new Date(), status: 'HEALTHY', responseTime: 230 },
        { checkedAt: new Date(), status: 'DEGRADED', responseTime: 500 },
      ] as any)

      const result = await healthCheckService.getServiceDetails('ai', 24)

      expect(result.service).toBeDefined()
      expect(result.history).toHaveLength(3)
      expect(result.metrics.avgResponseTime).toBeCloseTo(310, 0)
      expect(result.metrics.maxResponseTime).toBe(500)
      expect(result.metrics.minResponseTime).toBe(200)
    })
  })
})
```

### 9.2 Integration Tests

```typescript
// __tests__/api/admin/health.test.ts
import { createMocks } from 'node-mocks-http'
import { GET, POST } from '@/app/api/admin/health/route'
import { getServerSession } from 'next-auth'
import { healthCheckService } from '@/lib/services/monitoring/healthCheckService'

jest.mock('next-auth')
jest.mock('@/lib/services/monitoring/healthCheckService')

describe('/api/admin/health', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET', () => {
    it('should return 403 for non-admin users', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-1', role: 'OPERATOR' },
      })

      const { req, res } = createMocks({ method: 'GET' })
      const response = await GET(req as any)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })

    it('should return health status for admin users', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'admin-1', role: 'ADMIN' },
      })

      const mockHealth = {
        status: 'HEALTHY',
        services: [],
        activeUsers: 10,
        availability24h: 99.9,
        lastUpdated: new Date(),
      }

      ;(healthCheckService.getOverallHealth as jest.Mock).mockResolvedValue(mockHealth)

      const { req } = createMocks({ method: 'GET' })
      const response = await GET(req as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.status).toBe('HEALTHY')
    })
  })

  describe('POST', () => {
    it('should trigger health check for admin users', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'admin-1', role: 'SUPER_USER' },
      })

      const mockResults = [
        { serviceName: 'web', status: 'HEALTHY', responseTime: 50 },
        { serviceName: 'database', status: 'HEALTHY', responseTime: 10 },
      ]

      ;(healthCheckService.checkAllServices as jest.Mock).mockResolvedValue(mockResults)

      const { req } = createMocks({ method: 'POST' })
      const response = await POST(req as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toHaveLength(2)
      expect(healthCheckService.checkAllServices).toHaveBeenCalled()
    })
  })
})
```

### 9.3 E2E Tests

```typescript
// e2e/admin/health-dashboard.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Health Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // 以管理員身份登入
    await page.goto('/login')
    await page.fill('[name="email"]', 'admin@example.com')
    await page.fill('[name="password"]', 'admin123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')
  })

  test('should display health dashboard', async ({ page }) => {
    await page.goto('/admin/monitoring/health')

    // 驗證頁面標題
    await expect(page.locator('h2')).toContainText('系統健康狀態')

    // 驗證服務卡片存在
    await expect(page.locator('[data-testid="service-card"]')).toHaveCount.greaterThan(0)
  })

  test('should show service details on click', async ({ page }) => {
    await page.goto('/admin/monitoring/health')

    // 點擊第一個服務卡片
    await page.locator('[data-testid="service-card"]').first().click()

    // 驗證詳情面板顯示
    await expect(page.locator('[data-testid="service-details"]')).toBeVisible()

    // 驗證圖表存在
    await expect(page.locator('.recharts-wrapper')).toBeVisible()
  })

  test('should refresh health status', async ({ page }) => {
    await page.goto('/admin/monitoring/health')

    // 記錄刷新前的時間
    const lastUpdatedBefore = await page.locator('[data-testid="last-updated"]').textContent()

    // 點擊刷新按鈕
    await page.click('button:has-text("刷新")')

    // 等待刷新完成
    await page.waitForTimeout(2000)

    // 驗證時間已更新
    const lastUpdatedAfter = await page.locator('[data-testid="last-updated"]').textContent()
    expect(lastUpdatedAfter).not.toBe(lastUpdatedBefore)
  })

  test('should receive WebSocket updates', async ({ page }) => {
    await page.goto('/admin/monitoring/health')

    // 監聽 console 訊息以驗證 WebSocket 連接
    const wsConnected = page.waitForEvent('console', (msg) =>
      msg.text().includes('WebSocket connected')
    )

    await wsConnected
  })
})
```

---

## 10. Security Considerations

### 10.1 Authentication & Authorization

```typescript
// lib/middleware/adminAuth.ts
import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'

/**
 * 管理員認證中間件
 */
export async function adminAuthMiddleware(
  request: NextRequest
): Promise<NextResponse | null> {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json(
      {
        error: {
          code: 'UNAUTHENTICATED',
          message: '請先登入',
        },
      },
      { status: 401 }
    )
  }

  if (!['ADMIN', 'SUPER_USER'].includes(session.user.role)) {
    return NextResponse.json(
      {
        error: {
          code: 'UNAUTHORIZED',
          message: '需要管理員權限',
        },
      },
      { status: 403 }
    )
  }

  return null // 允許繼續
}
```

### 10.2 Rate Limiting

```typescript
// lib/rateLimit/healthApiRateLimit.ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

/**
 * 健康檢查 API 速率限制
 * - 手動觸發: 每分鐘最多 10 次
 * - 讀取狀態: 每分鐘最多 60 次
 */
export const healthApiRateLimit = {
  trigger: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 m'),
    prefix: 'ratelimit:health:trigger',
  }),
  read: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, '1 m'),
    prefix: 'ratelimit:health:read',
  }),
}
```

### 10.3 Input Validation

```typescript
// lib/validation/health.ts
import { z } from 'zod'

/**
 * 服務名稱驗證
 */
export const serviceNameSchema = z.string().regex(
  /^[a-z][a-z0-9_-]*$/,
  '服務名稱必須以小寫字母開頭，只能包含小寫字母、數字、底線和連字號'
)

/**
 * 查詢時間範圍驗證
 */
export const hoursSchema = z
  .string()
  .transform(Number)
  .pipe(z.number().int().min(1).max(168)) // 最多 7 天
```

### 10.4 Audit Logging

```typescript
// lib/audit/healthAudit.ts
import { prisma } from '@/lib/prisma'

/**
 * 記錄健康檢查操作
 */
export async function logHealthCheckAction(
  userId: string,
  action: 'MANUAL_CHECK' | 'VIEW_DETAILS',
  details?: Record<string, any>
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId,
      action: `HEALTH_${action}`,
      resourceType: 'SystemHealth',
      resourceId: 'system',
      description: action === 'MANUAL_CHECK' ? '手動觸發健康檢查' : '查看服務詳情',
      details,
    },
  })
}
```

---

## 11. Deployment & Configuration

### 11.1 Environment Variables

```bash
# .env.local

# Health Check Configuration
HEALTH_CHECK_INTERVAL_MS=30000          # 健康檢查間隔（毫秒）
HEALTH_CHECK_TIMEOUT_MS=10000           # 健康檢查超時（毫秒）

# Service Endpoints
AI_SERVICE_URL=https://ai-service.example.com
N8N_BASE_URL=https://n8n.example.com
AZURE_STORAGE_URL=https://storage.example.com
AZURE_STORAGE_CONNECTION_STRING=...

# Redis Configuration
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# WebSocket Configuration
WS_PATH=/api/ws/health
```

### 11.2 Startup Configuration

```typescript
// lib/startup/healthCheckStartup.ts
import { healthCheckJob } from '@/lib/jobs/healthCheckJob'

/**
 * 應用啟動時初始化健康檢查
 */
export function initializeHealthCheck(): void {
  const intervalMs = parseInt(
    process.env.HEALTH_CHECK_INTERVAL_MS || '30000'
  )

  // 啟動健康檢查排程
  healthCheckJob.start(intervalMs)

  // 註冊關閉處理
  process.on('SIGTERM', () => {
    healthCheckJob.stop()
  })

  console.log('Health check initialized with interval:', intervalMs, 'ms')
}
```

### 11.3 Database Migration

```bash
# 執行資料庫遷移
npx prisma migrate dev --name add_health_monitoring

# 生成 Prisma Client
npx prisma generate
```

### 11.4 Monitoring Metrics

```typescript
// lib/metrics/healthMetrics.ts

/**
 * 健康檢查指標收集
 */
export const healthMetrics = {
  // 健康檢查執行次數
  checksTotal: 0,
  // 健康檢查失敗次數
  checksFailed: 0,
  // 最後一次健康檢查時間
  lastCheckTime: null as Date | null,
  // 各服務狀態計數
  serviceStatusCounts: {
    healthy: 0,
    degraded: 0,
    unhealthy: 0,
  },

  /**
   * 記錄健康檢查結果
   */
  recordCheck(results: Array<{ status: string }>): void {
    this.checksTotal++
    this.lastCheckTime = new Date()

    const failed = results.filter((r) => r.status === 'UNHEALTHY').length
    if (failed > 0) {
      this.checksFailed++
    }

    this.serviceStatusCounts = {
      healthy: results.filter((r) => r.status === 'HEALTHY').length,
      degraded: results.filter((r) => r.status === 'DEGRADED').length,
      unhealthy: failed,
    }
  },

  /**
   * 獲取指標摘要
   */
  getSummary() {
    return {
      checksTotal: this.checksTotal,
      checksFailed: this.checksFailed,
      failureRate: this.checksTotal > 0
        ? (this.checksFailed / this.checksTotal) * 100
        : 0,
      lastCheckTime: this.lastCheckTime,
      serviceStatusCounts: this.serviceStatusCounts,
    }
  },
}
```

---

## 12. Appendix

### 12.1 Service Health Check Endpoints

| Service | Type | Endpoint | Timeout | Interval |
|---------|------|----------|---------|----------|
| Web | WEB_APP | /api/health | 5s | 30s |
| AI | AI_SERVICE | {AI_SERVICE_URL}/health | 10s | 30s |
| Database | DATABASE | Prisma query | 5s | 30s |
| Storage | STORAGE | Azure Blob list | 10s | 60s |
| n8n | N8N | {N8N_BASE_URL}/healthz | 10s | 60s |
| Cache | CACHE | Redis ping | 3s | 30s |

### 12.2 Health Status Definitions

| Status | Description | Action Required |
|--------|-------------|-----------------|
| HEALTHY | 服務正常運行，回應時間在預期範圍內 | None |
| DEGRADED | 服務運行中但效能降低或部分功能受影響 | 監控，考慮排查 |
| UNHEALTHY | 服務無法正常回應或完全不可用 | 立即處理 |
| UNKNOWN | 無法確定服務狀態 | 檢查監控配置 |

### 12.3 Availability Calculation

```
可用性 = (健康檢查次數 × 100% + 降級檢查次數 × 50%) / 總檢查次數 × 100%
```

例如：
- 90 次健康檢查
- 8 次降級檢查
- 2 次異常檢查

可用性 = (90 × 100 + 8 × 50 + 2 × 0) / 100 / 100 × 100 = 94%
