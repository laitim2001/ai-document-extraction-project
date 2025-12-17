# Tech Spec: Story 12-2 - 效能指標追蹤

## 1. Overview

### 1.1 Story Information
- **Story ID**: 12-2
- **Epic**: Epic 12 - 系統管理與監控
- **Priority**: High
- **Story Points**: 8
- **Functional Requirements**: FR60 (效能監控)

### 1.2 User Story
**As a** 系統管理員,
**I want** 追蹤系統效能指標,
**So that** 我可以識別效能瓶頸並進行優化。

### 1.3 Acceptance Criteria Summary
1. **AC1**: 即時效能指標顯示 - API 回應時間、數據庫查詢、AI 服務、系統資源
2. **AC2**: 時間範圍選擇 - 1小時、6小時、24小時、7天、30天
3. **AC3**: 閾值警告顯示 - 超標指標標記、警告區域
4. **AC4**: 深入分析功能 - 最慢 API、最慢查詢、資源消耗分析
5. **AC5**: 數據匯出 - CSV 格式匯出

### 1.4 Dependencies
- Story 12-1: 系統健康監控儀表板（整合顯示）
- Story 12-3: 錯誤告警配置（閾值觸發）

---

## 2. Architecture Design

### 2.1 System Architecture
```
┌─────────────────────────────────────────────────────────────────────┐
│                     Performance Monitoring System                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────────┐    │
│  │   API       │───▶│ Performance  │───▶│  ApiPerformance     │    │
│  │  Requests   │    │ Middleware   │    │  Metric             │    │
│  └─────────────┘    └──────────────┘    └─────────────────────┘    │
│                                                                      │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────────┐    │
│  │   AI        │───▶│ AI Service   │───▶│  AiServiceMetric    │    │
│  │  Service    │    │ Collector    │    │                     │    │
│  └─────────────┘    └──────────────┘    └─────────────────────┘    │
│                                                                      │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────────┐    │
│  │  Database   │───▶│ DB Query     │───▶│  DatabaseQuery      │    │
│  │  Queries    │    │ Collector    │    │  Metric             │    │
│  └─────────────┘    └──────────────┘    └─────────────────────┘    │
│                                                                      │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────────┐    │
│  │  System     │───▶│ System       │───▶│  SystemResource     │    │
│  │  Resources  │    │ Metrics Job  │    │  Metric             │    │
│  └─────────────┘    └──────────────┘    └─────────────────────┘    │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                  Performance Collector                        │  │
│  │  - Batch Write (every 10s)                                   │  │
│  │  - In-Memory Buffer                                          │  │
│  │  - Auto Flush on 100+ items                                  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                  Hourly Aggregation Job                       │  │
│  │  - Calculate P50, P95, P99                                   │  │
│  │  - Compute averages and counts                               │  │
│  │  - Store in PerformanceHourlySummary                         │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow
```
Request Flow:
┌─────────┐    ┌────────────┐    ┌─────────────┐    ┌──────────┐
│ Request │───▶│ Middleware │───▶│  Handler    │───▶│ Response │
└─────────┘    └────────────┘    └─────────────┘    └──────────┘
                    │                    │
                    │                    │
                    ▼                    ▼
             ┌────────────┐      ┌─────────────┐
             │ Start Time │      │   End Time  │
             │   Record   │      │   + Status  │
             └────────────┘      └─────────────┘
                                       │
                                       ▼
                               ┌─────────────┐
                               │ Performance │
                               │  Collector  │
                               │  (Buffer)   │
                               └─────────────┘
                                       │
                                       ▼ (Batch 10s)
                               ┌─────────────┐
                               │  Database   │
                               │  (Metrics)  │
                               └─────────────┘
```

### 2.3 Component Interaction
```
┌─────────────────────────────────────────────────────────────────────┐
│                      Frontend (React)                                │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐ │
│  │ MetricsOverview │  │  TimeSeriesChart │  │  SlowestEndpoints  │ │
│  │   (Dashboard)   │  │   (Recharts)    │  │     (Table)        │ │
│  └────────┬────────┘  └────────┬────────┘  └─────────┬───────────┘ │
│           │                    │                      │             │
│           └────────────────────┼──────────────────────┘             │
│                                │                                    │
│                                ▼                                    │
│                    ┌───────────────────────┐                       │
│                    │  usePerformance Hook  │                       │
│                    └───────────┬───────────┘                       │
└────────────────────────────────┼────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       API Layer                                      │
├─────────────────────────────────────────────────────────────────────┤
│  GET /api/admin/performance           - Overview metrics            │
│  GET /api/admin/performance/timeseries - Time series data          │
│  GET /api/admin/performance/slowest   - Slowest endpoints/queries  │
│  GET /api/admin/performance/export    - CSV export                 │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Service Layer                                    │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                   PerformanceService                          │  │
│  │  - getOverview(timeRange)                                    │  │
│  │  - getTimeSeries(metric, timeRange, endpoint?)               │  │
│  │  - getSlowestEndpoints(timeRange, limit)                     │  │
│  │  - getSlowestQueries(timeRange, limit)                       │  │
│  │  - exportToCsv(metric, timeRange)                            │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                  PerformanceCollector                         │  │
│  │  - recordApi(metric)                                         │  │
│  │  - recordSystemResource(metric)                              │  │
│  │  - recordAiService(metric)                                   │  │
│  │  - recordDbQuery(metric)                                     │  │
│  │  - flush() (batch write)                                     │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Database Design

### 3.1 Prisma Schema

```prisma
// ============================================================
// API 效能指標
// ============================================================
model ApiPerformanceMetric {
  id              String    @id @default(cuid())

  // 請求資訊
  method          String    // HTTP 方法: GET, POST, PUT, DELETE
  endpoint        String    // 標準化端點: /api/invoices/{id}
  path            String    // 實際路徑: /api/invoices/abc123

  // 時間指標 (毫秒)
  responseTime    Int       // 總回應時間
  dbQueryTime     Int?      // 數據庫查詢時間
  externalApiTime Int?      // 外部 API 調用時間
  processingTime  Int?      // 業務邏輯處理時間

  // 回應資訊
  statusCode      Int       // HTTP 狀態碼
  responseSize    Int?      // 回應大小 (bytes)

  // 請求資訊
  requestSize     Int?      // 請求大小 (bytes)
  userId          String?   // 用戶 ID

  // 時間記錄
  timestamp       DateTime  @default(now())

  // 城市隔離
  cityId          String?

  @@index([endpoint])
  @@index([timestamp])
  @@index([responseTime])
  @@index([cityId, timestamp])
}

// ============================================================
// 系統資源指標
// ============================================================
model SystemResourceMetric {
  id              String    @id @default(cuid())

  // CPU 指標
  cpuUsage        Float     // CPU 使用率 (百分比)
  cpuSystem       Float?    // 系統 CPU 時間
  cpuUser         Float?    // 用戶 CPU 時間

  // 記憶體指標
  memoryUsage     Float     // 記憶體使用率 (百分比)
  memoryUsed      BigInt    // 已使用記憶體 (bytes)
  memoryTotal     BigInt    // 總記憶體 (bytes)
  heapUsed        BigInt?   // Node.js Heap 使用量
  heapTotal       BigInt?   // Node.js Heap 總量

  // 其他指標
  activeConnections Int?    // 活躍連接數
  eventLoopLag    Float?    // Event Loop 延遲 (毫秒)

  // 磁碟 I/O
  diskReadBytes   BigInt?   // 磁碟讀取 (bytes)
  diskWriteBytes  BigInt?   // 磁碟寫入 (bytes)

  // 時間記錄
  timestamp       DateTime  @default(now())

  @@index([timestamp])
}

// ============================================================
// AI 服務效能指標
// ============================================================
model AiServiceMetric {
  id              String    @id @default(cuid())

  // 操作類型
  operationType   String    // ocr, extraction, identification, classification

  // 時間指標 (毫秒)
  totalTime       Int       // 總處理時間
  queueTime       Int?      // 排隊等待時間
  processingTime  Int?      // 實際處理時間
  networkTime     Int?      // 網路傳輸時間

  // 文件資訊
  documentId      String?
  fileSize        Int?      // 檔案大小 (bytes)
  pageCount       Int?      // 頁數

  // 結果
  success         Boolean
  errorCode       String?
  errorMessage    String?

  // Token 使用 (LLM)
  tokensUsed      Int?
  promptTokens    Int?
  completionTokens Int?
  modelName       String?

  // 成本追蹤
  estimatedCost   Decimal?  @db.Decimal(10, 6)

  // 城市隔離
  cityId          String?

  // 時間記錄
  timestamp       DateTime  @default(now())

  @@index([operationType])
  @@index([timestamp])
  @@index([cityId, timestamp])
}

// ============================================================
// 數據庫查詢效能
// ============================================================
model DatabaseQueryMetric {
  id              String    @id @default(cuid())

  // 查詢資訊
  queryType       String    // select, insert, update, delete, transaction
  tableName       String?   // 主要操作的表
  queryHash       String?   // 查詢模式的 hash (用於分組)

  // 時間指標 (毫秒)
  executionTime   Int       // 執行時間
  planningTime    Int?      // 查詢計劃時間
  lockWaitTime    Int?      // 鎖等待時間

  // 結果統計
  rowsAffected    Int?      // 影響的行數
  rowsReturned    Int?      // 返回的行數

  // 來源追蹤
  endpoint        String?   // 觸發查詢的 API 端點
  userId          String?   // 觸發查詢的用戶
  correlationId   String?   // 請求追蹤 ID

  // 時間記錄
  timestamp       DateTime  @default(now())

  @@index([queryType])
  @@index([executionTime])
  @@index([timestamp])
  @@index([tableName, timestamp])
}

// ============================================================
// 效能指標彙總 (每小時)
// ============================================================
model PerformanceHourlySummary {
  id              String    @id @default(cuid())
  date            DateTime  @db.Date
  hour            Int       // 0-23
  metricType      String    // api, database, ai, system

  // API 指標
  apiP50          Float?    // 中位數回應時間
  apiP95          Float?    // 95th 百分位
  apiP99          Float?    // 99th 百分位
  apiAvg          Float?    // 平均回應時間
  apiMin          Float?    // 最小回應時間
  apiMax          Float?    // 最大回應時間
  apiCount        Int?      // 請求總數

  // 數據庫指標
  dbP50           Float?
  dbP95           Float?
  dbP99           Float?
  dbAvg           Float?
  dbCount         Int?

  // AI 指標
  aiP50           Float?
  aiP95           Float?
  aiP99           Float?
  aiAvg           Float?
  aiCount         Int?
  aiSuccessRate   Float?    // 成功率

  // 系統指標
  cpuAvg          Float?
  cpuMax          Float?
  memoryAvg       Float?
  memoryMax       Float?

  // 錯誤統計
  errorCount      Int       @default(0)
  errorRate       Float?    // 錯誤率 (百分比)

  // 吞吐量
  requestsPerSecond Float?  // RPS

  // 城市隔離
  cityId          String?

  createdAt       DateTime  @default(now())

  @@unique([date, hour, metricType, cityId])
  @@index([date])
  @@index([metricType])
  @@index([cityId, date])
}

// ============================================================
// 效能閾值配置
// ============================================================
model PerformanceThreshold {
  id              String    @id @default(cuid())

  // 指標識別
  metricType      String    // api_response, db_query, ai_processing, cpu, memory
  metricName      String    // 指標名稱

  // 閾值設定
  warningThreshold  Float   // 警告閾值
  criticalThreshold Float   // 嚴重閾值

  // 單位
  unit            String    // ms, percent, count

  // 狀態
  isEnabled       Boolean   @default(true)

  // 說明
  description     String?

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@unique([metricType, metricName])
}
```

### 3.2 Index Strategy

```sql
-- API 效能查詢優化
CREATE INDEX CONCURRENTLY idx_api_perf_endpoint_time
ON "ApiPerformanceMetric" (endpoint, timestamp DESC);

CREATE INDEX CONCURRENTLY idx_api_perf_response_time
ON "ApiPerformanceMetric" (response_time DESC)
WHERE timestamp > NOW() - INTERVAL '7 days';

-- 系統資源查詢優化
CREATE INDEX CONCURRENTLY idx_system_resource_time
ON "SystemResourceMetric" (timestamp DESC);

-- AI 服務查詢優化
CREATE INDEX CONCURRENTLY idx_ai_service_type_time
ON "AiServiceMetric" (operation_type, timestamp DESC);

-- 數據庫查詢優化
CREATE INDEX CONCURRENTLY idx_db_query_exec_time
ON "DatabaseQueryMetric" (execution_time DESC)
WHERE timestamp > NOW() - INTERVAL '24 hours';

-- 彙總表查詢優化
CREATE INDEX CONCURRENTLY idx_hourly_summary_date_type
ON "PerformanceHourlySummary" (date DESC, metric_type);
```

### 3.3 Data Retention Policy

```typescript
// 數據保留策略
const DATA_RETENTION = {
  // 原始數據保留天數
  raw: {
    ApiPerformanceMetric: 7,      // 7 天
    SystemResourceMetric: 7,      // 7 天
    AiServiceMetric: 14,          // 14 天
    DatabaseQueryMetric: 3,       // 3 天
  },
  // 彙總數據保留天數
  summary: {
    PerformanceHourlySummary: 90, // 90 天
  },
};
```

---

## 4. API Design

### 4.1 API Endpoints

```yaml
# Performance Monitoring APIs
paths:
  /api/admin/performance:
    get:
      summary: 取得效能概覽
      parameters:
        - name: range
          in: query
          schema:
            type: string
            enum: [1h, 6h, 24h, 7d, 30d]
            default: 24h
        - name: cityId
          in: query
          schema:
            type: string
      responses:
        200:
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PerformanceOverview'

  /api/admin/performance/timeseries:
    get:
      summary: 取得時間序列數據
      parameters:
        - name: metric
          in: query
          required: true
          schema:
            type: string
            enum:
              - api_response_time
              - db_query_time
              - ai_processing_time
              - cpu_usage
              - memory_usage
        - name: range
          in: query
          schema:
            type: string
            enum: [1h, 6h, 24h, 7d, 30d]
        - name: endpoint
          in: query
          description: Filter by specific endpoint
          schema:
            type: string
        - name: percentile
          in: query
          schema:
            type: string
            enum: [p50, p95, p99, avg]
            default: avg
      responses:
        200:
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TimeSeriesResponse'

  /api/admin/performance/slowest:
    get:
      summary: 取得最慢端點/查詢
      parameters:
        - name: type
          in: query
          required: true
          schema:
            type: string
            enum: [endpoints, queries, ai_operations]
        - name: range
          in: query
          schema:
            type: string
            default: 24h
        - name: limit
          in: query
          schema:
            type: integer
            default: 10
            maximum: 50
      responses:
        200:
          content:
            application/json:
              schema:
                oneOf:
                  - $ref: '#/components/schemas/SlowestEndpointsResponse'
                  - $ref: '#/components/schemas/SlowestQueriesResponse'

  /api/admin/performance/export:
    get:
      summary: 匯出效能數據
      parameters:
        - name: metric
          in: query
          required: true
          schema:
            type: string
        - name: range
          in: query
          required: true
          schema:
            type: string
        - name: format
          in: query
          schema:
            type: string
            enum: [csv, json]
            default: csv
      responses:
        200:
          content:
            text/csv:
              schema:
                type: string

  /api/admin/performance/thresholds:
    get:
      summary: 取得效能閾值配置
      responses:
        200:
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ThresholdsResponse'

    put:
      summary: 更新效能閾值
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UpdateThresholdRequest'
      responses:
        200:
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ThresholdResponse'

components:
  schemas:
    PerformanceOverview:
      type: object
      properties:
        api:
          type: object
          properties:
            p50:
              type: number
            p95:
              type: number
            p99:
              type: number
            avg:
              type: number
            count:
              type: integer
            errorRate:
              type: number
        database:
          type: object
          properties:
            p50:
              type: number
            p95:
              type: number
            p99:
              type: number
            avg:
              type: number
            count:
              type: integer
        ai:
          type: object
          properties:
            p50:
              type: number
            p95:
              type: number
            p99:
              type: number
            avg:
              type: number
            count:
              type: integer
            successRate:
              type: number
        system:
          type: object
          properties:
            cpuCurrent:
              type: number
            cpuAvg:
              type: number
            memoryCurrent:
              type: number
            memoryAvg:
              type: number

    TimeSeriesResponse:
      type: object
      properties:
        data:
          type: array
          items:
            type: object
            properties:
              timestamp:
                type: string
                format: date-time
              value:
                type: number
        thresholds:
          type: object
          properties:
            warning:
              type: number
            critical:
              type: number

    SlowestEndpointsResponse:
      type: object
      properties:
        endpoints:
          type: array
          items:
            type: object
            properties:
              endpoint:
                type: string
              avgResponseTime:
                type: number
              p95ResponseTime:
                type: number
              count:
                type: integer
              errorRate:
                type: number
```

### 4.2 Response Examples

```json
// GET /api/admin/performance?range=24h
{
  "data": {
    "api": {
      "p50": 45,
      "p95": 180,
      "p99": 350,
      "avg": 65,
      "count": 15420,
      "errorRate": 0.8
    },
    "database": {
      "p50": 5,
      "p95": 25,
      "p99": 80,
      "avg": 12,
      "count": 48500
    },
    "ai": {
      "p50": 2500,
      "p95": 8000,
      "p99": 15000,
      "avg": 3200,
      "count": 1250,
      "successRate": 98.5
    },
    "system": {
      "cpuCurrent": 35.5,
      "cpuAvg": 28.3,
      "memoryCurrent": 68.2,
      "memoryAvg": 62.5
    }
  },
  "timestamp": "2024-01-15T10:30:00Z"
}

// GET /api/admin/performance/slowest?type=endpoints&range=24h&limit=5
{
  "data": {
    "endpoints": [
      {
        "endpoint": "/api/invoices/{id}/process",
        "method": "POST",
        "avgResponseTime": 2850,
        "p95ResponseTime": 8500,
        "count": 342,
        "errorRate": 2.3
      },
      {
        "endpoint": "/api/documents/{id}/ocr",
        "method": "POST",
        "avgResponseTime": 1950,
        "p95ResponseTime": 5200,
        "count": 856,
        "errorRate": 1.1
      }
    ]
  },
  "timeRange": "24h",
  "generatedAt": "2024-01-15T10:30:00Z"
}
```

---

## 5. TypeScript Type Definitions

### 5.1 Core Types

```typescript
// types/performance.ts

// ============================================================
// Time Range Types
// ============================================================
export type TimeRange = '1h' | '6h' | '24h' | '7d' | '30d';

export const TIME_RANGE_MS: Record<TimeRange, number> = {
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

// 聚合粒度 (分鐘)
export const GRANULARITY_MINUTES: Record<TimeRange, number> = {
  '1h': 1,      // 1 分鐘
  '6h': 5,      // 5 分鐘
  '24h': 15,    // 15 分鐘
  '7d': 60,     // 1 小時
  '30d': 360,   // 6 小時
};

// ============================================================
// Metric Types
// ============================================================
export type MetricType =
  | 'api_response_time'
  | 'db_query_time'
  | 'ai_processing_time'
  | 'cpu_usage'
  | 'memory_usage';

export type PercentileType = 'p50' | 'p95' | 'p99' | 'avg';

// ============================================================
// API Performance
// ============================================================
export interface ApiMetricInput {
  method: string;
  endpoint: string;
  path: string;
  responseTime: number;
  dbQueryTime?: number;
  externalApiTime?: number;
  processingTime?: number;
  statusCode: number;
  responseSize?: number;
  requestSize?: number;
  userId?: string;
  cityId?: string;
}

export interface ApiStats {
  p50: number;
  p95: number;
  p99: number;
  avg: number;
  min: number;
  max: number;
  count: number;
  errorRate: number;
}

// ============================================================
// System Resource
// ============================================================
export interface SystemResourceInput {
  cpuUsage: number;
  cpuSystem?: number;
  cpuUser?: number;
  memoryUsage: number;
  memoryUsed: bigint;
  memoryTotal: bigint;
  heapUsed?: bigint;
  heapTotal?: bigint;
  activeConnections?: number;
  eventLoopLag?: number;
  diskReadBytes?: bigint;
  diskWriteBytes?: bigint;
}

export interface SystemStats {
  cpuCurrent: number;
  cpuAvg: number;
  cpuMax: number;
  memoryCurrent: number;
  memoryAvg: number;
  memoryMax: number;
}

// ============================================================
// AI Service
// ============================================================
export type AiOperationType =
  | 'ocr'
  | 'extraction'
  | 'identification'
  | 'classification'
  | 'validation';

export interface AiMetricInput {
  operationType: AiOperationType;
  totalTime: number;
  queueTime?: number;
  processingTime?: number;
  networkTime?: number;
  documentId?: string;
  fileSize?: number;
  pageCount?: number;
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  tokensUsed?: number;
  promptTokens?: number;
  completionTokens?: number;
  modelName?: string;
  estimatedCost?: number;
  cityId?: string;
}

export interface AiStats {
  p50: number;
  p95: number;
  p99: number;
  avg: number;
  count: number;
  successRate: number;
  totalTokens: number;
  totalCost: number;
}

// ============================================================
// Database Query
// ============================================================
export type QueryType = 'select' | 'insert' | 'update' | 'delete' | 'transaction';

export interface DbQueryMetricInput {
  queryType: QueryType;
  tableName?: string;
  queryHash?: string;
  executionTime: number;
  planningTime?: number;
  lockWaitTime?: number;
  rowsAffected?: number;
  rowsReturned?: number;
  endpoint?: string;
  userId?: string;
  correlationId?: string;
}

export interface DbStats {
  p50: number;
  p95: number;
  p99: number;
  avg: number;
  count: number;
}

// ============================================================
// Performance Overview
// ============================================================
export interface PerformanceOverview {
  api: ApiStats;
  database: DbStats;
  ai: AiStats;
  system: SystemStats;
  timestamp: Date;
}

// ============================================================
// Time Series
// ============================================================
export interface TimeSeriesDataPoint {
  timestamp: string;
  value: number;
}

export interface TimeSeriesResponse {
  data: TimeSeriesDataPoint[];
  metric: MetricType;
  timeRange: TimeRange;
  thresholds?: {
    warning: number;
    critical: number;
  };
}

// ============================================================
// Slowest Analysis
// ============================================================
export interface SlowestEndpoint {
  endpoint: string;
  method: string;
  avgResponseTime: number;
  p95ResponseTime: number;
  count: number;
  errorRate: number;
  trend: 'up' | 'down' | 'stable';
}

export interface SlowestQuery {
  queryType: string;
  tableName: string | null;
  avgExecutionTime: number;
  maxExecutionTime: number;
  count: number;
}

export interface SlowestAiOperation {
  operationType: string;
  avgProcessingTime: number;
  p95ProcessingTime: number;
  count: number;
  successRate: number;
}

// ============================================================
// Threshold Configuration
// ============================================================
export interface PerformanceThresholdConfig {
  metricType: string;
  metricName: string;
  warningThreshold: number;
  criticalThreshold: number;
  unit: 'ms' | 'percent' | 'count';
  description?: string;
  isEnabled: boolean;
}

// ============================================================
// Export Types
// ============================================================
export interface ExportOptions {
  metric: MetricType;
  timeRange: TimeRange;
  format: 'csv' | 'json';
  includeHeaders?: boolean;
}

export interface ExportResult {
  content: string;
  filename: string;
  mimeType: string;
  recordCount: number;
}
```

### 5.2 Collector Types

```typescript
// types/collector.ts

export interface BufferedMetric<T> {
  type: 'api' | 'system' | 'ai' | 'database';
  data: T;
  timestamp: Date;
}

export interface CollectorConfig {
  flushIntervalMs: number;      // 批量寫入間隔
  maxBufferSize: number;        // 最大緩衝區大小
  retryAttempts: number;        // 重試次數
  retryDelayMs: number;         // 重試延遲
}

export interface CollectorStats {
  bufferedCount: number;
  flushedCount: number;
  failedCount: number;
  lastFlushTime: Date | null;
  averageFlushDuration: number;
}
```

---

## 6. Service Layer Implementation

### 6.1 Performance Collector Service

```typescript
// lib/services/monitoring/performanceCollector.ts
import { prisma } from '@/lib/prisma';
import {
  ApiMetricInput,
  SystemResourceInput,
  AiMetricInput,
  DbQueryMetricInput,
  BufferedMetric,
  CollectorConfig,
  CollectorStats,
} from '@/types/performance';

const DEFAULT_CONFIG: CollectorConfig = {
  flushIntervalMs: 10000,  // 10 秒
  maxBufferSize: 100,
  retryAttempts: 3,
  retryDelayMs: 1000,
};

/**
 * 效能指標收集器
 * - 使用內存緩衝區批量收集指標
 * - 定期批量寫入數據庫
 * - 支援自動重試和錯誤處理
 */
export class PerformanceCollector {
  private buffer: BufferedMetric<any>[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private config: CollectorConfig;
  private stats: CollectorStats = {
    bufferedCount: 0,
    flushedCount: 0,
    failedCount: 0,
    lastFlushTime: null,
    averageFlushDuration: 0,
  };
  private flushDurations: number[] = [];

  constructor(config: Partial<CollectorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 啟動收集器
   */
  start(): void {
    if (this.flushInterval) {
      console.warn('PerformanceCollector already started');
      return;
    }

    console.log('Starting PerformanceCollector with config:', this.config);

    this.flushInterval = setInterval(
      () => this.flush(),
      this.config.flushIntervalMs
    );

    // 處理程序退出時確保數據寫入
    process.on('beforeExit', () => this.stop());
    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());
  }

  /**
   * 停止收集器
   */
  async stop(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    // 最後一次 flush
    await this.flush();
    console.log('PerformanceCollector stopped. Stats:', this.stats);
  }

  /**
   * 記錄 API 效能指標
   */
  recordApi(metric: ApiMetricInput): void {
    this.addToBuffer('api', metric);
  }

  /**
   * 記錄系統資源指標
   */
  recordSystemResource(metric: SystemResourceInput): void {
    this.addToBuffer('system', metric);
  }

  /**
   * 記錄 AI 服務效能指標
   */
  recordAiService(metric: AiMetricInput): void {
    this.addToBuffer('ai', metric);
  }

  /**
   * 記錄數據庫查詢指標
   */
  recordDbQuery(metric: DbQueryMetricInput): void {
    this.addToBuffer('database', metric);
  }

  /**
   * 取得收集器統計
   */
  getStats(): CollectorStats {
    return { ...this.stats, bufferedCount: this.buffer.length };
  }

  /**
   * 添加到緩衝區
   */
  private addToBuffer<T>(type: BufferedMetric<T>['type'], data: T): void {
    this.buffer.push({
      type,
      data,
      timestamp: new Date(),
    });

    this.stats.bufferedCount++;

    // 如果緩衝區滿了，立即 flush
    if (this.buffer.length >= this.config.maxBufferSize) {
      this.flush().catch(console.error);
    }
  }

  /**
   * 批量寫入數據庫
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const startTime = Date.now();
    const toFlush = [...this.buffer];
    this.buffer = [];

    try {
      // 分類指標
      const apiMetrics = toFlush.filter(m => m.type === 'api');
      const systemMetrics = toFlush.filter(m => m.type === 'system');
      const aiMetrics = toFlush.filter(m => m.type === 'ai');
      const dbMetrics = toFlush.filter(m => m.type === 'database');

      // 並行批量插入
      await Promise.all([
        apiMetrics.length > 0 && this.flushApiMetrics(apiMetrics),
        systemMetrics.length > 0 && this.flushSystemMetrics(systemMetrics),
        aiMetrics.length > 0 && this.flushAiMetrics(aiMetrics),
        dbMetrics.length > 0 && this.flushDbMetrics(dbMetrics),
      ]);

      // 更新統計
      this.stats.flushedCount += toFlush.length;
      this.stats.lastFlushTime = new Date();

      const duration = Date.now() - startTime;
      this.updateAverageFlushDuration(duration);

    } catch (error) {
      console.error('Failed to flush performance metrics:', error);
      this.stats.failedCount += toFlush.length;

      // 重試邏輯
      await this.retryFlush(toFlush);
    }
  }

  /**
   * 寫入 API 指標
   */
  private async flushApiMetrics(
    metrics: BufferedMetric<ApiMetricInput>[]
  ): Promise<void> {
    await prisma.apiPerformanceMetric.createMany({
      data: metrics.map(m => ({
        method: m.data.method,
        endpoint: m.data.endpoint,
        path: m.data.path,
        responseTime: m.data.responseTime,
        dbQueryTime: m.data.dbQueryTime,
        externalApiTime: m.data.externalApiTime,
        processingTime: m.data.processingTime,
        statusCode: m.data.statusCode,
        responseSize: m.data.responseSize,
        requestSize: m.data.requestSize,
        userId: m.data.userId,
        cityId: m.data.cityId,
        timestamp: m.timestamp,
      })),
      skipDuplicates: true,
    });
  }

  /**
   * 寫入系統資源指標
   */
  private async flushSystemMetrics(
    metrics: BufferedMetric<SystemResourceInput>[]
  ): Promise<void> {
    await prisma.systemResourceMetric.createMany({
      data: metrics.map(m => ({
        cpuUsage: m.data.cpuUsage,
        cpuSystem: m.data.cpuSystem,
        cpuUser: m.data.cpuUser,
        memoryUsage: m.data.memoryUsage,
        memoryUsed: m.data.memoryUsed,
        memoryTotal: m.data.memoryTotal,
        heapUsed: m.data.heapUsed,
        heapTotal: m.data.heapTotal,
        activeConnections: m.data.activeConnections,
        eventLoopLag: m.data.eventLoopLag,
        diskReadBytes: m.data.diskReadBytes,
        diskWriteBytes: m.data.diskWriteBytes,
        timestamp: m.timestamp,
      })),
      skipDuplicates: true,
    });
  }

  /**
   * 寫入 AI 服務指標
   */
  private async flushAiMetrics(
    metrics: BufferedMetric<AiMetricInput>[]
  ): Promise<void> {
    await prisma.aiServiceMetric.createMany({
      data: metrics.map(m => ({
        operationType: m.data.operationType,
        totalTime: m.data.totalTime,
        queueTime: m.data.queueTime,
        processingTime: m.data.processingTime,
        networkTime: m.data.networkTime,
        documentId: m.data.documentId,
        fileSize: m.data.fileSize,
        pageCount: m.data.pageCount,
        success: m.data.success,
        errorCode: m.data.errorCode,
        errorMessage: m.data.errorMessage,
        tokensUsed: m.data.tokensUsed,
        promptTokens: m.data.promptTokens,
        completionTokens: m.data.completionTokens,
        modelName: m.data.modelName,
        estimatedCost: m.data.estimatedCost,
        cityId: m.data.cityId,
        timestamp: m.timestamp,
      })),
      skipDuplicates: true,
    });
  }

  /**
   * 寫入數據庫查詢指標
   */
  private async flushDbMetrics(
    metrics: BufferedMetric<DbQueryMetricInput>[]
  ): Promise<void> {
    await prisma.databaseQueryMetric.createMany({
      data: metrics.map(m => ({
        queryType: m.data.queryType,
        tableName: m.data.tableName,
        queryHash: m.data.queryHash,
        executionTime: m.data.executionTime,
        planningTime: m.data.planningTime,
        lockWaitTime: m.data.lockWaitTime,
        rowsAffected: m.data.rowsAffected,
        rowsReturned: m.data.rowsReturned,
        endpoint: m.data.endpoint,
        userId: m.data.userId,
        correlationId: m.data.correlationId,
        timestamp: m.timestamp,
      })),
      skipDuplicates: true,
    });
  }

  /**
   * 重試失敗的寫入
   */
  private async retryFlush(
    metrics: BufferedMetric<any>[]
  ): Promise<void> {
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        await new Promise(resolve =>
          setTimeout(resolve, this.config.retryDelayMs * attempt)
        );

        // 重新分類並寫入
        await this.flush();
        console.log(`Retry attempt ${attempt} successful`);
        return;
      } catch (error) {
        console.error(`Retry attempt ${attempt} failed:`, error);
      }
    }

    // 所有重試都失敗，記錄錯誤
    console.error(
      `Failed to flush ${metrics.length} metrics after ${this.config.retryAttempts} attempts`
    );
  }

  /**
   * 更新平均 flush 時間
   */
  private updateAverageFlushDuration(duration: number): void {
    this.flushDurations.push(duration);

    // 只保留最近 100 次的記錄
    if (this.flushDurations.length > 100) {
      this.flushDurations.shift();
    }

    this.stats.averageFlushDuration =
      this.flushDurations.reduce((a, b) => a + b, 0) / this.flushDurations.length;
  }
}

// 全局單例
let collectorInstance: PerformanceCollector | null = null;

export function getPerformanceCollector(): PerformanceCollector {
  if (!collectorInstance) {
    collectorInstance = new PerformanceCollector();
    collectorInstance.start();
  }
  return collectorInstance;
}

// 方便直接使用的導出
export const performanceCollector = getPerformanceCollector();
```

### 6.2 Performance Service

```typescript
// lib/services/monitoring/performanceService.ts
import { prisma } from '@/lib/prisma';
import os from 'os';
import {
  TimeRange,
  MetricType,
  PercentileType,
  TIME_RANGE_MS,
  GRANULARITY_MINUTES,
  PerformanceOverview,
  ApiStats,
  DbStats,
  AiStats,
  SystemStats,
  TimeSeriesDataPoint,
  TimeSeriesResponse,
  SlowestEndpoint,
  SlowestQuery,
  SlowestAiOperation,
  ExportOptions,
  ExportResult,
} from '@/types/performance';

/**
 * 效能指標查詢服務
 */
export class PerformanceService {

  /**
   * 取得效能概覽
   */
  async getOverview(
    timeRange: TimeRange,
    cityId?: string
  ): Promise<PerformanceOverview> {
    const since = new Date(Date.now() - TIME_RANGE_MS[timeRange]);

    const [apiStats, dbStats, aiStats, systemStats] = await Promise.all([
      this.getApiStats(since, cityId),
      this.getDatabaseStats(since),
      this.getAiStats(since, cityId),
      this.getSystemStats(since),
    ]);

    return {
      api: apiStats,
      database: dbStats,
      ai: aiStats,
      system: systemStats,
      timestamp: new Date(),
    };
  }

  /**
   * API 統計
   */
  private async getApiStats(since: Date, cityId?: string): Promise<ApiStats> {
    const where: any = { timestamp: { gt: since } };
    if (cityId) where.cityId = cityId;

    const metrics = await prisma.apiPerformanceMetric.findMany({
      where,
      select: { responseTime: true, statusCode: true },
    });

    if (metrics.length === 0) {
      return {
        p50: 0, p95: 0, p99: 0, avg: 0,
        min: 0, max: 0, count: 0, errorRate: 0
      };
    }

    const times = metrics.map(m => m.responseTime).sort((a, b) => a - b);
    const errors = metrics.filter(m => m.statusCode >= 400).length;

    return {
      p50: this.percentile(times, 50),
      p95: this.percentile(times, 95),
      p99: this.percentile(times, 99),
      avg: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
      min: Math.min(...times),
      max: Math.max(...times),
      count: metrics.length,
      errorRate: Math.round((errors / metrics.length) * 10000) / 100,
    };
  }

  /**
   * 數據庫統計
   */
  private async getDatabaseStats(since: Date): Promise<DbStats> {
    const metrics = await prisma.databaseQueryMetric.findMany({
      where: { timestamp: { gt: since } },
      select: { executionTime: true },
    });

    if (metrics.length === 0) {
      return { p50: 0, p95: 0, p99: 0, avg: 0, count: 0 };
    }

    const times = metrics.map(m => m.executionTime).sort((a, b) => a - b);

    return {
      p50: this.percentile(times, 50),
      p95: this.percentile(times, 95),
      p99: this.percentile(times, 99),
      avg: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
      count: metrics.length,
    };
  }

  /**
   * AI 服務統計
   */
  private async getAiStats(since: Date, cityId?: string): Promise<AiStats> {
    const where: any = { timestamp: { gt: since } };
    if (cityId) where.cityId = cityId;

    const metrics = await prisma.aiServiceMetric.findMany({
      where,
      select: { totalTime: true, success: true, tokensUsed: true, estimatedCost: true },
    });

    if (metrics.length === 0) {
      return {
        p50: 0, p95: 0, p99: 0, avg: 0,
        count: 0, successRate: 100, totalTokens: 0, totalCost: 0
      };
    }

    const times = metrics.map(m => m.totalTime).sort((a, b) => a - b);
    const successes = metrics.filter(m => m.success).length;
    const totalTokens = metrics.reduce((sum, m) => sum + (m.tokensUsed || 0), 0);
    const totalCost = metrics.reduce(
      (sum, m) => sum + (m.estimatedCost ? Number(m.estimatedCost) : 0),
      0
    );

    return {
      p50: this.percentile(times, 50),
      p95: this.percentile(times, 95),
      p99: this.percentile(times, 99),
      avg: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
      count: metrics.length,
      successRate: Math.round((successes / metrics.length) * 10000) / 100,
      totalTokens,
      totalCost: Math.round(totalCost * 100) / 100,
    };
  }

  /**
   * 系統資源統計
   */
  private async getSystemStats(since: Date): Promise<SystemStats> {
    const metrics = await prisma.systemResourceMetric.findMany({
      where: { timestamp: { gt: since } },
      orderBy: { timestamp: 'desc' },
      take: 1000,
    });

    // 取得當前系統狀態
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();

    const cpuCurrent = cpus.reduce((acc, cpu) => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
      const idle = cpu.times.idle;
      return acc + ((total - idle) / total) * 100;
    }, 0) / cpus.length;

    const memoryCurrent = ((totalMem - freeMem) / totalMem) * 100;

    if (metrics.length === 0) {
      return {
        cpuCurrent: Math.round(cpuCurrent * 100) / 100,
        cpuAvg: Math.round(cpuCurrent * 100) / 100,
        cpuMax: Math.round(cpuCurrent * 100) / 100,
        memoryCurrent: Math.round(memoryCurrent * 100) / 100,
        memoryAvg: Math.round(memoryCurrent * 100) / 100,
        memoryMax: Math.round(memoryCurrent * 100) / 100,
      };
    }

    const cpuValues = metrics.map(m => m.cpuUsage);
    const memValues = metrics.map(m => m.memoryUsage);

    return {
      cpuCurrent: Math.round(cpuCurrent * 100) / 100,
      cpuAvg: Math.round((cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length) * 100) / 100,
      cpuMax: Math.round(Math.max(...cpuValues) * 100) / 100,
      memoryCurrent: Math.round(memoryCurrent * 100) / 100,
      memoryAvg: Math.round((memValues.reduce((a, b) => a + b, 0) / memValues.length) * 100) / 100,
      memoryMax: Math.round(Math.max(...memValues) * 100) / 100,
    };
  }

  /**
   * 計算百分位數
   */
  private percentile(sortedArray: number[], p: number): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil((p / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  /**
   * 取得時間序列數據
   */
  async getTimeSeries(
    metric: MetricType,
    timeRange: TimeRange,
    options: {
      endpoint?: string;
      percentile?: PercentileType;
      cityId?: string;
    } = {}
  ): Promise<TimeSeriesResponse> {
    const since = new Date(Date.now() - TIME_RANGE_MS[timeRange]);
    const granularity = GRANULARITY_MINUTES[timeRange];

    let data: TimeSeriesDataPoint[] = [];

    switch (metric) {
      case 'api_response_time':
        data = await this.getApiTimeSeries(since, granularity, options);
        break;
      case 'db_query_time':
        data = await this.getDbTimeSeries(since, granularity);
        break;
      case 'ai_processing_time':
        data = await this.getAiTimeSeries(since, granularity, options.cityId);
        break;
      case 'cpu_usage':
        data = await this.getCpuTimeSeries(since, granularity);
        break;
      case 'memory_usage':
        data = await this.getMemoryTimeSeries(since, granularity);
        break;
    }

    // 取得閾值配置
    const thresholds = await this.getThresholds(metric);

    return {
      data,
      metric,
      timeRange,
      thresholds,
    };
  }

  /**
   * API 時間序列
   */
  private async getApiTimeSeries(
    since: Date,
    granularityMinutes: number,
    options: { endpoint?: string; percentile?: PercentileType; cityId?: string }
  ): Promise<TimeSeriesDataPoint[]> {
    const where: any = { timestamp: { gt: since } };
    if (options.endpoint) where.endpoint = options.endpoint;
    if (options.cityId) where.cityId = options.cityId;

    const metrics = await prisma.apiPerformanceMetric.findMany({
      where,
      select: { timestamp: true, responseTime: true },
      orderBy: { timestamp: 'asc' },
    });

    return this.aggregateTimeSeries(metrics, granularityMinutes, 'responseTime');
  }

  /**
   * 數據庫時間序列
   */
  private async getDbTimeSeries(
    since: Date,
    granularityMinutes: number
  ): Promise<TimeSeriesDataPoint[]> {
    const metrics = await prisma.databaseQueryMetric.findMany({
      where: { timestamp: { gt: since } },
      select: { timestamp: true, executionTime: true },
      orderBy: { timestamp: 'asc' },
    });

    return this.aggregateTimeSeries(metrics, granularityMinutes, 'executionTime');
  }

  /**
   * AI 時間序列
   */
  private async getAiTimeSeries(
    since: Date,
    granularityMinutes: number,
    cityId?: string
  ): Promise<TimeSeriesDataPoint[]> {
    const where: any = { timestamp: { gt: since } };
    if (cityId) where.cityId = cityId;

    const metrics = await prisma.aiServiceMetric.findMany({
      where,
      select: { timestamp: true, totalTime: true },
      orderBy: { timestamp: 'asc' },
    });

    return this.aggregateTimeSeries(metrics, granularityMinutes, 'totalTime');
  }

  /**
   * CPU 時間序列
   */
  private async getCpuTimeSeries(
    since: Date,
    granularityMinutes: number
  ): Promise<TimeSeriesDataPoint[]> {
    const metrics = await prisma.systemResourceMetric.findMany({
      where: { timestamp: { gt: since } },
      select: { timestamp: true, cpuUsage: true },
      orderBy: { timestamp: 'asc' },
    });

    return this.aggregateTimeSeries(metrics, granularityMinutes, 'cpuUsage');
  }

  /**
   * 記憶體時間序列
   */
  private async getMemoryTimeSeries(
    since: Date,
    granularityMinutes: number
  ): Promise<TimeSeriesDataPoint[]> {
    const metrics = await prisma.systemResourceMetric.findMany({
      where: { timestamp: { gt: since } },
      select: { timestamp: true, memoryUsage: true },
      orderBy: { timestamp: 'asc' },
    });

    return this.aggregateTimeSeries(metrics, granularityMinutes, 'memoryUsage');
  }

  /**
   * 聚合時間序列數據
   */
  private aggregateTimeSeries(
    data: Array<{ timestamp: Date; [key: string]: any }>,
    granularityMinutes: number,
    valueField: string
  ): TimeSeriesDataPoint[] {
    if (data.length === 0) return [];

    const buckets = new Map<string, number[]>();
    const granularityMs = granularityMinutes * 60 * 1000;

    for (const item of data) {
      const bucketTime = new Date(
        Math.floor(item.timestamp.getTime() / granularityMs) * granularityMs
      );
      const key = bucketTime.toISOString();

      if (!buckets.has(key)) {
        buckets.set(key, []);
      }
      buckets.get(key)!.push(item[valueField]);
    }

    const result: TimeSeriesDataPoint[] = [];
    for (const [timestamp, values] of buckets) {
      result.push({
        timestamp,
        value: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100,
      });
    }

    return result.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  /**
   * 取得閾值配置
   */
  private async getThresholds(
    metric: MetricType
  ): Promise<{ warning: number; critical: number } | undefined> {
    const threshold = await prisma.performanceThreshold.findFirst({
      where: { metricType: metric, isEnabled: true },
    });

    if (!threshold) return undefined;

    return {
      warning: threshold.warningThreshold,
      critical: threshold.criticalThreshold,
    };
  }

  /**
   * 取得最慢的 API 端點
   */
  async getSlowestEndpoints(
    timeRange: TimeRange,
    limit: number = 10,
    cityId?: string
  ): Promise<SlowestEndpoint[]> {
    const since = new Date(Date.now() - TIME_RANGE_MS[timeRange]);

    const where: any = { timestamp: { gt: since } };
    if (cityId) where.cityId = cityId;

    // 先取得端點分組統計
    const endpointGroups = await prisma.apiPerformanceMetric.groupBy({
      by: ['endpoint', 'method'],
      where,
      _avg: { responseTime: true },
      _count: true,
    });

    // 取得詳細統計
    const detailedStats = await Promise.all(
      endpointGroups.slice(0, limit * 2).map(async (group) => {
        const endpointMetrics = await prisma.apiPerformanceMetric.findMany({
          where: {
            endpoint: group.endpoint,
            timestamp: { gt: since },
            ...(cityId && { cityId }),
          },
          select: { responseTime: true, statusCode: true },
        });

        const times = endpointMetrics.map(m => m.responseTime).sort((a, b) => a - b);
        const errors = endpointMetrics.filter(m => m.statusCode >= 400).length;

        // 計算趨勢 (比較前後半段)
        const midpoint = Math.floor(times.length / 2);
        const firstHalf = times.slice(0, midpoint);
        const secondHalf = times.slice(midpoint);
        const firstAvg = firstHalf.length > 0
          ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
          : 0;
        const secondAvg = secondHalf.length > 0
          ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
          : 0;

        let trend: 'up' | 'down' | 'stable' = 'stable';
        if (secondAvg > firstAvg * 1.1) trend = 'up';
        else if (secondAvg < firstAvg * 0.9) trend = 'down';

        return {
          endpoint: group.endpoint,
          method: group.method,
          avgResponseTime: Math.round(group._avg.responseTime || 0),
          p95ResponseTime: this.percentile(times, 95),
          count: group._count,
          errorRate: Math.round((errors / endpointMetrics.length) * 10000) / 100,
          trend,
        };
      })
    );

    return detailedStats
      .sort((a, b) => b.avgResponseTime - a.avgResponseTime)
      .slice(0, limit);
  }

  /**
   * 取得最慢的數據庫查詢
   */
  async getSlowestQueries(
    timeRange: TimeRange,
    limit: number = 10
  ): Promise<SlowestQuery[]> {
    const since = new Date(Date.now() - TIME_RANGE_MS[timeRange]);

    const queryGroups = await prisma.databaseQueryMetric.groupBy({
      by: ['queryType', 'tableName'],
      where: { timestamp: { gt: since } },
      _avg: { executionTime: true },
      _max: { executionTime: true },
      _count: true,
    });

    return queryGroups
      .map(group => ({
        queryType: group.queryType,
        tableName: group.tableName,
        avgExecutionTime: Math.round(group._avg.executionTime || 0),
        maxExecutionTime: group._max.executionTime || 0,
        count: group._count,
      }))
      .sort((a, b) => b.avgExecutionTime - a.avgExecutionTime)
      .slice(0, limit);
  }

  /**
   * 取得最慢的 AI 操作
   */
  async getSlowestAiOperations(
    timeRange: TimeRange,
    limit: number = 10,
    cityId?: string
  ): Promise<SlowestAiOperation[]> {
    const since = new Date(Date.now() - TIME_RANGE_MS[timeRange]);

    const where: any = { timestamp: { gt: since } };
    if (cityId) where.cityId = cityId;

    const operationGroups = await prisma.aiServiceMetric.groupBy({
      by: ['operationType'],
      where,
      _avg: { totalTime: true },
      _count: true,
    });

    const detailedStats = await Promise.all(
      operationGroups.map(async (group) => {
        const metrics = await prisma.aiServiceMetric.findMany({
          where: {
            operationType: group.operationType,
            timestamp: { gt: since },
            ...(cityId && { cityId }),
          },
          select: { totalTime: true, success: true },
        });

        const times = metrics.map(m => m.totalTime).sort((a, b) => a - b);
        const successes = metrics.filter(m => m.success).length;

        return {
          operationType: group.operationType,
          avgProcessingTime: Math.round(group._avg.totalTime || 0),
          p95ProcessingTime: this.percentile(times, 95),
          count: group._count,
          successRate: Math.round((successes / metrics.length) * 10000) / 100,
        };
      })
    );

    return detailedStats
      .sort((a, b) => b.avgProcessingTime - a.avgProcessingTime)
      .slice(0, limit);
  }

  /**
   * 匯出效能數據為 CSV
   */
  async exportToCsv(options: ExportOptions): Promise<ExportResult> {
    const timeSeries = await this.getTimeSeries(options.metric, options.timeRange);

    const headers = ['Timestamp', 'Value', 'Metric', 'TimeRange'];
    const rows = timeSeries.data.map(d => [
      d.timestamp,
      d.value.toString(),
      options.metric,
      options.timeRange,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    const filename = `performance_${options.metric}_${options.timeRange}_${Date.now()}.csv`;

    return {
      content: csvContent,
      filename,
      mimeType: 'text/csv',
      recordCount: rows.length,
    };
  }
}

// 導出單例
export const performanceService = new PerformanceService();
```

### 6.3 System Metrics Job

```typescript
// lib/jobs/systemMetricsJob.ts
import os from 'os';
import { performanceCollector } from '@/lib/services/monitoring/performanceCollector';

/**
 * 系統指標定期收集任務
 */
export class SystemMetricsJob {
  private intervalId: NodeJS.Timeout | null = null;
  private lastCpuInfo: os.CpuInfo[] | null = null;

  /**
   * 啟動系統指標收集
   */
  start(intervalMs: number = 60000): void {
    if (this.intervalId) {
      console.warn('System metrics job already running');
      return;
    }

    console.log(`Starting system metrics job with ${intervalMs}ms interval`);

    // 立即收集一次
    this.collect();

    // 定期收集
    this.intervalId = setInterval(() => {
      this.collect();
    }, intervalMs);
  }

  /**
   * 停止收集
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('System metrics job stopped');
    }
  }

  /**
   * 收集系統指標
   */
  private collect(): void {
    try {
      const cpus = os.cpus();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();

      // 計算 CPU 使用率 (需要兩個時間點比較)
      let cpuUsage = 0;
      let cpuSystem = 0;
      let cpuUser = 0;

      if (this.lastCpuInfo) {
        const cpuDiffs = cpus.map((cpu, i) => {
          const lastCpu = this.lastCpuInfo![i];
          return {
            idle: cpu.times.idle - lastCpu.times.idle,
            total: Object.values(cpu.times).reduce((a, b) => a + b, 0) -
                   Object.values(lastCpu.times).reduce((a, b) => a + b, 0),
            user: cpu.times.user - lastCpu.times.user,
            sys: cpu.times.sys - lastCpu.times.sys,
          };
        });

        const totalIdle = cpuDiffs.reduce((sum, d) => sum + d.idle, 0);
        const totalTotal = cpuDiffs.reduce((sum, d) => sum + d.total, 0);
        const totalUser = cpuDiffs.reduce((sum, d) => sum + d.user, 0);
        const totalSys = cpuDiffs.reduce((sum, d) => sum + d.sys, 0);

        cpuUsage = totalTotal > 0 ? ((totalTotal - totalIdle) / totalTotal) * 100 : 0;
        cpuUser = totalTotal > 0 ? (totalUser / totalTotal) * 100 : 0;
        cpuSystem = totalTotal > 0 ? (totalSys / totalTotal) * 100 : 0;
      }

      this.lastCpuInfo = cpus;

      // 記憶體使用率
      const memoryUsage = ((totalMem - freeMem) / totalMem) * 100;

      // Node.js 記憶體
      const nodeMemory = process.memoryUsage();

      // Event Loop 延遲 (簡化版本)
      const eventLoopLag = this.measureEventLoopLag();

      performanceCollector.recordSystemResource({
        cpuUsage,
        cpuSystem,
        cpuUser,
        memoryUsage,
        memoryUsed: BigInt(totalMem - freeMem),
        memoryTotal: BigInt(totalMem),
        heapUsed: BigInt(nodeMemory.heapUsed),
        heapTotal: BigInt(nodeMemory.heapTotal),
        eventLoopLag,
      });
    } catch (error) {
      console.error('Failed to collect system metrics:', error);
    }
  }

  /**
   * 測量 Event Loop 延遲
   */
  private measureEventLoopLag(): number {
    const start = process.hrtime.bigint();

    // 使用 setImmediate 測量
    return new Promise<number>((resolve) => {
      setImmediate(() => {
        const end = process.hrtime.bigint();
        const lagNs = Number(end - start);
        resolve(lagNs / 1_000_000); // 轉換為毫秒
      });
    }) as unknown as number; // 同步返回上次測量結果
  }
}

// 導出單例
export const systemMetricsJob = new SystemMetricsJob();
```

---

## 7. UI Components

### 7.1 Performance Dashboard Component

```typescript
// components/admin/performance/PerformanceDashboard.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  TimeRange,
  MetricType,
  PerformanceOverview,
  TimeSeriesDataPoint,
  SlowestEndpoint,
} from '@/types/performance';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart,
} from 'recharts';

// ============================================================
// Time Range Options
// ============================================================
const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: '1h', label: '最近 1 小時' },
  { value: '6h', label: '最近 6 小時' },
  { value: '24h', label: '最近 24 小時' },
  { value: '7d', label: '最近 7 天' },
  { value: '30d', label: '最近 30 天' },
];

// ============================================================
// Metric Card Component
// ============================================================
interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  trend?: 'up' | 'down' | 'stable';
  status?: 'normal' | 'warning' | 'critical';
  icon?: string;
}

function MetricCard({
  title,
  value,
  unit,
  subtitle,
  trend,
  status = 'normal',
  icon,
}: MetricCardProps) {
  const statusColors = {
    normal: 'bg-green-50 border-green-200',
    warning: 'bg-yellow-50 border-yellow-200',
    critical: 'bg-red-50 border-red-200',
  };

  const trendIcons = {
    up: '↑',
    down: '↓',
    stable: '→',
  };

  const trendColors = {
    up: 'text-red-500',
    down: 'text-green-500',
    stable: 'text-gray-500',
  };

  return (
    <div className={`p-4 rounded-lg border ${statusColors[status]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-500">{title}</span>
        {icon && <span className="text-xl">{icon}</span>}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold">{value}</span>
        {unit && <span className="text-sm text-gray-500">{unit}</span>}
        {trend && (
          <span className={`ml-2 ${trendColors[trend]}`}>
            {trendIcons[trend]}
          </span>
        )}
      </div>
      {subtitle && (
        <div className="text-sm text-gray-500 mt-1">{subtitle}</div>
      )}
    </div>
  );
}

// ============================================================
// Performance Chart Component
// ============================================================
interface PerformanceChartProps {
  data: TimeSeriesDataPoint[];
  title: string;
  color: string;
  unit: string;
  thresholds?: {
    warning: number;
    critical: number;
  };
  isLoading?: boolean;
}

function PerformanceChart({
  data,
  title,
  color,
  unit,
  thresholds,
  isLoading,
}: PerformanceChartProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-4 h-64 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="font-medium mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatTime}
            tick={{ fontSize: 12 }}
            stroke="#9ca3af"
          />
          <YAxis
            tick={{ fontSize: 12 }}
            stroke="#9ca3af"
            tickFormatter={(v) => `${v}${unit}`}
          />
          <Tooltip
            labelFormatter={(label) => new Date(label).toLocaleString()}
            formatter={(value: number) => [`${value.toFixed(2)}${unit}`, '值']}
          />
          {thresholds && (
            <>
              <ReferenceLine
                y={thresholds.warning}
                stroke="#f59e0b"
                strokeDasharray="5 5"
                label={{ value: '警告', fill: '#f59e0b', fontSize: 10 }}
              />
              <ReferenceLine
                y={thresholds.critical}
                stroke="#ef4444"
                strokeDasharray="5 5"
                label={{ value: '嚴重', fill: '#ef4444', fontSize: 10 }}
              />
            </>
          )}
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            fill={`url(#gradient-${color})`}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============================================================
// Slowest Endpoints Table
// ============================================================
interface SlowestEndpointsTableProps {
  endpoints: SlowestEndpoint[];
  isLoading?: boolean;
}

function SlowestEndpointsTable({ endpoints, isLoading }: SlowestEndpointsTableProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-4" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-8 bg-gray-100 rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-4 py-3 border-b">
        <h3 className="font-medium">最慢的 API 端點</h3>
      </div>
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">端點</th>
            <th className="px-4 py-2 text-right text-sm font-medium text-gray-500">平均</th>
            <th className="px-4 py-2 text-right text-sm font-medium text-gray-500">P95</th>
            <th className="px-4 py-2 text-right text-sm font-medium text-gray-500">請求數</th>
            <th className="px-4 py-2 text-right text-sm font-medium text-gray-500">錯誤率</th>
            <th className="px-4 py-2 text-center text-sm font-medium text-gray-500">趨勢</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {endpoints.map((ep, idx) => (
            <tr key={idx} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    ep.method === 'GET' ? 'bg-green-100 text-green-700' :
                    ep.method === 'POST' ? 'bg-blue-100 text-blue-700' :
                    ep.method === 'PUT' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {ep.method}
                  </span>
                  <span className="font-mono text-sm">{ep.endpoint}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-right">
                <span className={ep.avgResponseTime > 500 ? 'text-red-600 font-medium' : ''}>
                  {ep.avgResponseTime}ms
                </span>
              </td>
              <td className="px-4 py-3 text-right">{ep.p95ResponseTime}ms</td>
              <td className="px-4 py-3 text-right">{ep.count.toLocaleString()}</td>
              <td className="px-4 py-3 text-right">
                <span className={ep.errorRate > 5 ? 'text-red-600 font-medium' : ''}>
                  {ep.errorRate.toFixed(2)}%
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className={
                  ep.trend === 'up' ? 'text-red-500' :
                  ep.trend === 'down' ? 'text-green-500' : 'text-gray-500'
                }>
                  {ep.trend === 'up' ? '↑' : ep.trend === 'down' ? '↓' : '→'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// Main Dashboard Component
// ============================================================
export function PerformanceDashboard() {
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [overview, setOverview] = useState<PerformanceOverview | null>(null);
  const [apiTimeSeries, setApiTimeSeries] = useState<TimeSeriesDataPoint[]>([]);
  const [systemTimeSeries, setSystemTimeSeries] = useState<{
    cpu: TimeSeriesDataPoint[];
    memory: TimeSeriesDataPoint[];
  }>({ cpu: [], memory: [] });
  const [slowestEndpoints, setSlowestEndpoints] = useState<SlowestEndpoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // 取得效能數據
  const fetchData = useCallback(async () => {
    try {
      const [overviewRes, apiTsRes, cpuTsRes, memoryTsRes, slowestRes] = await Promise.all([
        fetch(`/api/admin/performance?range=${timeRange}`),
        fetch(`/api/admin/performance/timeseries?metric=api_response_time&range=${timeRange}`),
        fetch(`/api/admin/performance/timeseries?metric=cpu_usage&range=${timeRange}`),
        fetch(`/api/admin/performance/timeseries?metric=memory_usage&range=${timeRange}`),
        fetch(`/api/admin/performance/slowest?type=endpoints&range=${timeRange}&limit=10`),
      ]);

      const [overviewData, apiTsData, cpuTsData, memoryTsData, slowestData] = await Promise.all([
        overviewRes.json(),
        apiTsRes.json(),
        cpuTsRes.json(),
        memoryTsRes.json(),
        slowestRes.json(),
      ]);

      setOverview(overviewData.data);
      setApiTimeSeries(apiTsData.data);
      setSystemTimeSeries({
        cpu: cpuTsData.data,
        memory: memoryTsData.data,
      });
      setSlowestEndpoints(slowestData.data?.endpoints || []);
    } catch (error) {
      console.error('Failed to fetch performance data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [timeRange]);

  // 初始載入和自動刷新
  useEffect(() => {
    fetchData();

    if (autoRefresh) {
      const interval = setInterval(fetchData, 30000); // 30 秒刷新
      return () => clearInterval(interval);
    }
  }, [fetchData, autoRefresh]);

  // 處理匯出
  const handleExport = async () => {
    try {
      const response = await fetch(
        `/api/admin/performance/export?metric=api_response_time&range=${timeRange}`
      );
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `performance_${timeRange}_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  // 判斷閾值狀態
  const getApiStatus = () => {
    if (!overview) return 'normal';
    if (overview.api.p95 > 500) return 'critical';
    if (overview.api.p95 > 200) return 'warning';
    return 'normal';
  };

  const getCpuStatus = () => {
    if (!overview) return 'normal';
    if (overview.system.cpuCurrent > 90) return 'critical';
    if (overview.system.cpuCurrent > 70) return 'warning';
    return 'normal';
  };

  const getMemoryStatus = () => {
    if (!overview) return 'normal';
    if (overview.system.memoryCurrent > 90) return 'critical';
    if (overview.system.memoryCurrent > 80) return 'warning';
    return 'normal';
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">效能監控</h1>
        <div className="flex items-center gap-4">
          {/* 時間範圍選擇 */}
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as TimeRange)}
            className="px-3 py-2 border rounded-lg"
          >
            {TIME_RANGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {/* 自動刷新開關 */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">自動刷新</span>
          </label>

          {/* 匯出按鈕 */}
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            匯出 CSV
          </button>

          {/* 手動刷新 */}
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            刷新
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-6 gap-4 mb-6">
        <MetricCard
          title="API 回應時間 (P95)"
          value={overview?.api.p95 || 0}
          unit="ms"
          subtitle={`平均: ${overview?.api.avg || 0}ms`}
          status={getApiStatus() as any}
          icon="⚡"
        />
        <MetricCard
          title="API 請求數"
          value={(overview?.api.count || 0).toLocaleString()}
          subtitle={`錯誤率: ${overview?.api.errorRate || 0}%`}
          status={overview && overview.api.errorRate > 5 ? 'warning' : 'normal'}
          icon="📊"
        />
        <MetricCard
          title="數據庫查詢 (P95)"
          value={overview?.database.p95 || 0}
          unit="ms"
          subtitle={`平均: ${overview?.database.avg || 0}ms`}
          icon="🗄️"
        />
        <MetricCard
          title="AI 處理時間 (P95)"
          value={overview?.ai.p95 || 0}
          unit="ms"
          subtitle={`成功率: ${overview?.ai.successRate || 0}%`}
          icon="🤖"
        />
        <MetricCard
          title="CPU 使用率"
          value={overview?.system.cpuCurrent.toFixed(1) || 0}
          unit="%"
          subtitle={`平均: ${overview?.system.cpuAvg.toFixed(1) || 0}%`}
          status={getCpuStatus() as any}
          icon="💻"
        />
        <MetricCard
          title="記憶體使用率"
          value={overview?.system.memoryCurrent.toFixed(1) || 0}
          unit="%"
          subtitle={`平均: ${overview?.system.memoryAvg.toFixed(1) || 0}%`}
          status={getMemoryStatus() as any}
          icon="🧠"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <PerformanceChart
          data={apiTimeSeries}
          title="API 回應時間趨勢"
          color="#3b82f6"
          unit="ms"
          thresholds={{ warning: 200, critical: 500 }}
          isLoading={isLoading}
        />
        <PerformanceChart
          data={systemTimeSeries.cpu}
          title="CPU 使用率趨勢"
          color="#10b981"
          unit="%"
          thresholds={{ warning: 70, critical: 90 }}
          isLoading={isLoading}
        />
      </div>

      {/* Slowest Endpoints */}
      <SlowestEndpointsTable
        endpoints={slowestEndpoints}
        isLoading={isLoading}
      />
    </div>
  );
}

export default PerformanceDashboard;
```

---

## 8. API Routes Implementation

### 8.1 Performance Overview Route

```typescript
// app/api/admin/performance/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { performanceService } from '@/lib/services/monitoring/performanceService';
import { TimeRange } from '@/types/performance';

export async function GET(request: NextRequest) {
  try {
    // 認證檢查
    const session = await getServerSession(authOptions);
    if (!session?.user || !['ADMIN', 'SUPER_USER'].includes(session.user.role)) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Admin access required' } },
        { status: 403 }
      );
    }

    // 取得參數
    const searchParams = request.nextUrl.searchParams;
    const timeRange = (searchParams.get('range') || '24h') as TimeRange;
    const cityId = searchParams.get('cityId') || undefined;

    // 驗證時間範圍
    const validRanges: TimeRange[] = ['1h', '6h', '24h', '7d', '30d'];
    if (!validRanges.includes(timeRange)) {
      return NextResponse.json(
        { error: { code: 'INVALID_PARAM', message: 'Invalid time range' } },
        { status: 400 }
      );
    }

    // 取得效能概覽
    const overview = await performanceService.getOverview(timeRange, cityId);

    return NextResponse.json(
      { data: overview },
      { status: 200 }
    );
  } catch (error) {
    console.error('Get performance overview error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to get performance data' } },
      { status: 500 }
    );
  }
}
```

### 8.2 Time Series Route

```typescript
// app/api/admin/performance/timeseries/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { performanceService } from '@/lib/services/monitoring/performanceService';
import { TimeRange, MetricType } from '@/types/performance';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !['ADMIN', 'SUPER_USER'].includes(session.user.role)) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Admin access required' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const metric = searchParams.get('metric') as MetricType;
    const timeRange = (searchParams.get('range') || '24h') as TimeRange;
    const endpoint = searchParams.get('endpoint') || undefined;
    const cityId = searchParams.get('cityId') || undefined;

    // 驗證必要參數
    const validMetrics: MetricType[] = [
      'api_response_time',
      'db_query_time',
      'ai_processing_time',
      'cpu_usage',
      'memory_usage',
    ];

    if (!metric || !validMetrics.includes(metric)) {
      return NextResponse.json(
        { error: { code: 'INVALID_PARAM', message: 'Valid metric parameter is required' } },
        { status: 400 }
      );
    }

    const timeSeries = await performanceService.getTimeSeries(
      metric,
      timeRange,
      { endpoint, cityId }
    );

    return NextResponse.json(timeSeries, { status: 200 });
  } catch (error) {
    console.error('Get time series error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to get time series data' } },
      { status: 500 }
    );
  }
}
```

### 8.3 Slowest Analysis Route

```typescript
// app/api/admin/performance/slowest/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { performanceService } from '@/lib/services/monitoring/performanceService';
import { TimeRange } from '@/types/performance';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !['ADMIN', 'SUPER_USER'].includes(session.user.role)) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Admin access required' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    const timeRange = (searchParams.get('range') || '24h') as TimeRange;
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);
    const cityId = searchParams.get('cityId') || undefined;

    if (!type || !['endpoints', 'queries', 'ai_operations'].includes(type)) {
      return NextResponse.json(
        { error: { code: 'INVALID_PARAM', message: 'Valid type parameter is required' } },
        { status: 400 }
      );
    }

    let data;
    switch (type) {
      case 'endpoints':
        data = { endpoints: await performanceService.getSlowestEndpoints(timeRange, limit, cityId) };
        break;
      case 'queries':
        data = { queries: await performanceService.getSlowestQueries(timeRange, limit) };
        break;
      case 'ai_operations':
        data = { operations: await performanceService.getSlowestAiOperations(timeRange, limit, cityId) };
        break;
    }

    return NextResponse.json(
      { data, timeRange, generatedAt: new Date().toISOString() },
      { status: 200 }
    );
  } catch (error) {
    console.error('Get slowest analysis error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to get slowest analysis' } },
      { status: 500 }
    );
  }
}
```

### 8.4 Export Route

```typescript
// app/api/admin/performance/export/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { performanceService } from '@/lib/services/monitoring/performanceService';
import { TimeRange, MetricType } from '@/types/performance';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !['ADMIN', 'SUPER_USER'].includes(session.user.role)) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Admin access required' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const metric = (searchParams.get('metric') || 'api_response_time') as MetricType;
    const timeRange = (searchParams.get('range') || '24h') as TimeRange;

    const result = await performanceService.exportToCsv({
      metric,
      timeRange,
      format: 'csv',
    });

    return new NextResponse(result.content, {
      status: 200,
      headers: {
        'Content-Type': result.mimeType,
        'Content-Disposition': `attachment; filename="${result.filename}"`,
      },
    });
  } catch (error) {
    console.error('Export performance data error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to export data' } },
      { status: 500 }
    );
  }
}
```

---

## 9. Test Plan

### 9.1 Unit Tests

```typescript
// __tests__/services/monitoring/performanceService.test.ts
import { PerformanceService } from '@/lib/services/monitoring/performanceService';
import { prismaMock } from '@/lib/__mocks__/prisma';

describe('PerformanceService', () => {
  let service: PerformanceService;

  beforeEach(() => {
    service = new PerformanceService();
  });

  describe('getOverview', () => {
    it('should return performance overview for given time range', async () => {
      // Mock API metrics
      prismaMock.apiPerformanceMetric.findMany.mockResolvedValue([
        { responseTime: 100, statusCode: 200 },
        { responseTime: 200, statusCode: 200 },
        { responseTime: 150, statusCode: 500 },
      ] as any);

      // Mock DB metrics
      prismaMock.databaseQueryMetric.findMany.mockResolvedValue([
        { executionTime: 10 },
        { executionTime: 20 },
      ] as any);

      // Mock AI metrics
      prismaMock.aiServiceMetric.findMany.mockResolvedValue([
        { totalTime: 1000, success: true, tokensUsed: 100 },
        { totalTime: 2000, success: false, tokensUsed: 150 },
      ] as any);

      // Mock System metrics
      prismaMock.systemResourceMetric.findMany.mockResolvedValue([]);

      const overview = await service.getOverview('24h');

      expect(overview.api.count).toBe(3);
      expect(overview.api.errorRate).toBeCloseTo(33.33, 0);
      expect(overview.database.count).toBe(2);
      expect(overview.ai.count).toBe(2);
      expect(overview.ai.successRate).toBe(50);
    });

    it('should return zeros when no metrics exist', async () => {
      prismaMock.apiPerformanceMetric.findMany.mockResolvedValue([]);
      prismaMock.databaseQueryMetric.findMany.mockResolvedValue([]);
      prismaMock.aiServiceMetric.findMany.mockResolvedValue([]);
      prismaMock.systemResourceMetric.findMany.mockResolvedValue([]);

      const overview = await service.getOverview('24h');

      expect(overview.api.count).toBe(0);
      expect(overview.api.p50).toBe(0);
    });
  });

  describe('percentile calculation', () => {
    it('should calculate correct percentiles', () => {
      const times = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

      expect(service['percentile'](times, 50)).toBe(50);
      expect(service['percentile'](times, 95)).toBe(100);
      expect(service['percentile'](times, 99)).toBe(100);
    });

    it('should handle empty array', () => {
      expect(service['percentile']([], 50)).toBe(0);
    });

    it('should handle single element', () => {
      expect(service['percentile']([42], 50)).toBe(42);
    });
  });

  describe('getSlowestEndpoints', () => {
    it('should return endpoints sorted by average response time', async () => {
      prismaMock.apiPerformanceMetric.groupBy.mockResolvedValue([
        { endpoint: '/api/slow', method: 'GET', _avg: { responseTime: 500 }, _count: 100 },
        { endpoint: '/api/fast', method: 'GET', _avg: { responseTime: 50 }, _count: 200 },
      ] as any);

      prismaMock.apiPerformanceMetric.findMany.mockResolvedValue([
        { responseTime: 500, statusCode: 200 },
      ] as any);

      const endpoints = await service.getSlowestEndpoints('24h', 10);

      expect(endpoints[0].endpoint).toBe('/api/slow');
      expect(endpoints[0].avgResponseTime).toBe(500);
    });
  });
});
```

### 9.2 Integration Tests

```typescript
// __tests__/api/admin/performance.integration.test.ts
import { createMocks } from 'node-mocks-http';
import { GET as getOverview } from '@/app/api/admin/performance/route';
import { GET as getTimeSeries } from '@/app/api/admin/performance/timeseries/route';

describe('Performance API Integration', () => {
  describe('GET /api/admin/performance', () => {
    it('should return 403 for non-admin users', async () => {
      const { req } = createMocks({
        method: 'GET',
        url: '/api/admin/performance?range=24h',
      });

      // Mock non-admin session
      jest.spyOn(require('next-auth'), 'getServerSession').mockResolvedValue({
        user: { role: 'USER' },
      });

      const response = await getOverview(req as any);
      expect(response.status).toBe(403);
    });

    it('should return 400 for invalid time range', async () => {
      const { req } = createMocks({
        method: 'GET',
        url: '/api/admin/performance?range=invalid',
      });

      jest.spyOn(require('next-auth'), 'getServerSession').mockResolvedValue({
        user: { role: 'ADMIN' },
      });

      const response = await getOverview(req as any);
      expect(response.status).toBe(400);
    });

    it('should return performance overview for valid request', async () => {
      const { req } = createMocks({
        method: 'GET',
        url: '/api/admin/performance?range=24h',
      });

      jest.spyOn(require('next-auth'), 'getServerSession').mockResolvedValue({
        user: { role: 'ADMIN' },
      });

      const response = await getOverview(req as any);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('data.api');
      expect(data).toHaveProperty('data.database');
      expect(data).toHaveProperty('data.ai');
      expect(data).toHaveProperty('data.system');
    });
  });

  describe('GET /api/admin/performance/timeseries', () => {
    it('should require metric parameter', async () => {
      const { req } = createMocks({
        method: 'GET',
        url: '/api/admin/performance/timeseries?range=24h',
      });

      jest.spyOn(require('next-auth'), 'getServerSession').mockResolvedValue({
        user: { role: 'ADMIN' },
      });

      const response = await getTimeSeries(req as any);
      expect(response.status).toBe(400);
    });

    it('should return time series data', async () => {
      const { req } = createMocks({
        method: 'GET',
        url: '/api/admin/performance/timeseries?metric=api_response_time&range=24h',
      });

      jest.spyOn(require('next-auth'), 'getServerSession').mockResolvedValue({
        user: { role: 'ADMIN' },
      });

      const response = await getTimeSeries(req as any);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('data');
      expect(Array.isArray(data.data)).toBe(true);
    });
  });
});
```

### 9.3 E2E Tests

```typescript
// e2e/admin/performance.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Performance Monitoring', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/login');
    await page.fill('[name="email"]', 'admin@test.com');
    await page.fill('[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should display performance dashboard', async ({ page }) => {
    await page.goto('/admin/performance');

    // Check title
    await expect(page.locator('h1')).toContainText('效能監控');

    // Check metric cards exist
    await expect(page.locator('text=API 回應時間')).toBeVisible();
    await expect(page.locator('text=CPU 使用率')).toBeVisible();
    await expect(page.locator('text=記憶體使用率')).toBeVisible();
  });

  test('should change time range', async ({ page }) => {
    await page.goto('/admin/performance');

    // Change time range
    await page.selectOption('select', '7d');

    // Wait for data refresh
    await page.waitForResponse(
      (response) => response.url().includes('/api/admin/performance')
    );
  });

  test('should export CSV', async ({ page }) => {
    await page.goto('/admin/performance');

    // Click export button
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button:has-text("匯出 CSV")'),
    ]);

    expect(download.suggestedFilename()).toContain('.csv');
  });

  test('should display slowest endpoints', async ({ page }) => {
    await page.goto('/admin/performance');

    // Check slowest endpoints table
    await expect(page.locator('text=最慢的 API 端點')).toBeVisible();
    await expect(page.locator('th:has-text("端點")')).toBeVisible();
    await expect(page.locator('th:has-text("平均")')).toBeVisible();
  });
});
```

---

## 10. Security Considerations

### 10.1 Access Control
- 所有效能 API 端點需要 ADMIN 或 SUPER_USER 角色
- 支援城市隔離 (cityId) 過濾，確保數據隔離

### 10.2 Data Protection
- 效能數據不包含敏感用戶資訊
- 匯出功能限制最大記錄數

### 10.3 Rate Limiting
```typescript
// 建議的 API Rate Limiting
const RATE_LIMITS = {
  overview: { limit: 60, window: '1m' },
  timeseries: { limit: 30, window: '1m' },
  export: { limit: 5, window: '1m' },
};
```

---

## 11. Deployment & Configuration

### 11.1 Environment Variables

```env
# Performance Collector Configuration
PERF_COLLECTOR_FLUSH_INTERVAL=10000
PERF_COLLECTOR_MAX_BUFFER=100

# System Metrics Job
SYSTEM_METRICS_INTERVAL=60000

# Data Retention (days)
PERF_RAW_DATA_RETENTION=7
PERF_SUMMARY_DATA_RETENTION=90

# Thresholds
PERF_API_WARNING_THRESHOLD=200
PERF_API_CRITICAL_THRESHOLD=500
PERF_CPU_WARNING_THRESHOLD=70
PERF_CPU_CRITICAL_THRESHOLD=90
PERF_MEMORY_WARNING_THRESHOLD=80
PERF_MEMORY_CRITICAL_THRESHOLD=90
```

### 11.2 Startup Configuration

```typescript
// lib/startup.ts
import { performanceCollector } from '@/lib/services/monitoring/performanceCollector';
import { systemMetricsJob } from '@/lib/jobs/systemMetricsJob';

export async function initializeMonitoring() {
  // 啟動效能收集器
  performanceCollector.start();

  // 啟動系統指標收集
  const interval = parseInt(process.env.SYSTEM_METRICS_INTERVAL || '60000');
  systemMetricsJob.start(interval);

  console.log('Performance monitoring initialized');
}
```

### 11.3 Scheduled Jobs

```typescript
// Cron jobs for data maintenance
// 每小時: 生成彙總數據
// 每日凌晨: 清理過期原始數據

// 使用 n8n 或 node-cron 配置
const CRON_JOBS = {
  hourlyAggregation: '0 * * * *',     // 每小時
  dailyCleanup: '0 2 * * *',          // 每天凌晨 2 點
};
```

---

## 12. Appendix

### 12.1 Performance Thresholds Reference

| Metric | Warning | Critical | Unit |
|--------|---------|----------|------|
| API Response Time (P95) | 200 | 500 | ms |
| Database Query Time (P95) | 50 | 100 | ms |
| AI Processing Time (P95) | 5000 | 15000 | ms |
| CPU Usage | 70 | 90 | % |
| Memory Usage | 80 | 90 | % |
| Error Rate | 1 | 5 | % |

### 12.2 Related Documentation
- Story 12-1: 系統健康監控儀表板
- Story 12-3: 錯誤告警配置
- Story 12-7: 系統日誌查詢

### 12.3 Revision History
| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2024-01-15 | System | Initial version |
