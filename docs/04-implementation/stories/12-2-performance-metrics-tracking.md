# Story 12-2: 效能指標追蹤

## Story 資訊

- **Epic**: 12 - 系統管理與監控
- **功能需求**: FR60 (效能監控)
- **優先級**: High
- **故事點數**: 8
- **相關 Stories**:
  - Story 12-1 (系統健康監控儀表板)
  - Story 12-3 (錯誤告警配置)
  - Story 12-7 (系統日誌查詢)

## 使用者故事

**As a** 系統管理員,
**I want** 追蹤系統效能指標,
**So that** 我可以識別效能瓶頸並進行優化。

## 驗收標準

### AC1: 即時效能指標顯示

**Given** 系統管理員在效能監控頁面
**When** 查看效能指標
**Then** 顯示以下指標的即時數據和趨勢圖：
- API 回應時間（P50, P95, P99）
- 數據庫查詢時間
- AI 服務處理時間
- 文件上傳/下載速度
- 記憶體使用率
- CPU 使用率

### AC2: 時間範圍選擇

**Given** 效能指標
**When** 選擇時間範圍
**Then** 支援：最近 1 小時、6 小時、24 小時、7 天、30 天

### AC3: 閾值警告顯示

**Given** 效能指標
**When** 某項指標超過閾值
**Then** 在圖表上標記警告區域
**And** 顯示超標時間點

### AC4: 深入分析功能

**Given** 效能監控頁面
**When** 需要深入分析
**Then** 可以查看：
- 最慢的 API 端點列表
- 最慢的數據庫查詢列表
- 資源消耗最高的操作

### AC5: 數據匯出

**Given** 效能數據
**When** 需要匯出
**Then** 支援匯出為 CSV 格式
**And** 包含完整的時間序列數據

## 技術規格

### 1. 資料模型

```prisma
// API 效能指標
model ApiPerformanceMetric {
  id              String    @id @default(cuid())

  // 請求資訊
  method          String
  endpoint        String    // 標準化的端點（如 /api/invoices/{id}）
  path            String    // 實際路徑

  // 時間指標
  responseTime    Int       // 總回應時間（毫秒）
  dbQueryTime     Int?      // 數據庫查詢時間
  externalApiTime Int?      // 外部 API 調用時間
  processingTime  Int?      // 業務邏輯處理時間

  // 回應資訊
  statusCode      Int
  responseSize    Int?      // bytes

  // 請求資訊
  requestSize     Int?      // bytes
  userId          String?

  // 時間記錄
  timestamp       DateTime  @default(now())

  @@index([endpoint])
  @@index([timestamp])
  @@index([responseTime])
}

// 系統資源指標
model SystemResourceMetric {
  id              String    @id @default(cuid())

  // CPU
  cpuUsage        Float     // 百分比
  cpuSystem       Float?
  cpuUser         Float?

  // 記憶體
  memoryUsage     Float     // 百分比
  memoryUsed      BigInt    // bytes
  memoryTotal     BigInt    // bytes
  heapUsed        BigInt?   // Node.js heap

  // 其他
  activeConnections Int?
  eventLoopLag    Float?    // 毫秒

  timestamp       DateTime  @default(now())

  @@index([timestamp])
}

// AI 服務效能指標
model AiServiceMetric {
  id              String    @id @default(cuid())

  // 操作類型
  operationType   String    // ocr, extraction, identification

  // 時間指標
  totalTime       Int       // 總處理時間（毫秒）
  queueTime       Int?      // 等待時間
  processingTime  Int?      // 實際處理時間

  // 文件資訊
  documentId      String?
  fileSize        Int?
  pageCount       Int?

  // 結果
  success         Boolean
  errorCode       String?

  // Token 使用（如果適用）
  tokensUsed      Int?
  modelName       String?

  timestamp       DateTime  @default(now())

  @@index([operationType])
  @@index([timestamp])
}

// 數據庫查詢效能
model DatabaseQueryMetric {
  id              String    @id @default(cuid())

  // 查詢資訊
  queryType       String    // select, insert, update, delete
  tableName       String?
  queryHash       String?   // 查詢的 hash（用於分組）

  // 時間指標
  executionTime   Int       // 毫秒
  planningTime    Int?

  // 結果
  rowsAffected    Int?
  rowsReturned    Int?

  // 來源
  endpoint        String?   // 觸發查詢的 API 端點
  userId          String?

  timestamp       DateTime  @default(now())

  @@index([queryType])
  @@index([executionTime])
  @@index([timestamp])
}

// 效能指標彙總（每小時）
model PerformanceHourlySummary {
  id              String    @id @default(cuid())
  date            DateTime  @db.Date
  hour            Int       // 0-23
  metricType      String    // api, database, ai, system

  // API 指標
  apiP50          Float?
  apiP95          Float?
  apiP99          Float?
  apiAvg          Float?
  apiCount        Int?

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

  // 系統指標
  cpuAvg          Float?
  cpuMax          Float?
  memoryAvg       Float?
  memoryMax       Float?

  // 錯誤
  errorCount      Int       @default(0)
  errorRate       Float?

  createdAt       DateTime  @default(now())

  @@unique([date, hour, metricType])
  @@index([date])
  @@index([metricType])
}
```

### 2. 效能收集中間件

```typescript
// lib/middleware/performanceMiddleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 效能指標收集器
export class PerformanceCollector {
  private metrics: any[] = []
  private flushInterval: NodeJS.Timeout | null = null

  constructor() {
    // 每 10 秒批量寫入一次
    this.flushInterval = setInterval(() => this.flush(), 10000)
  }

  // 記錄 API 效能
  recordApi(metric: {
    method: string
    endpoint: string
    path: string
    responseTime: number
    dbQueryTime?: number
    statusCode: number
    responseSize?: number
    requestSize?: number
    userId?: string
  }): void {
    this.metrics.push({
      type: 'api',
      data: metric,
      timestamp: new Date(),
    })

    // 如果積累太多，立即 flush
    if (this.metrics.length >= 100) {
      this.flush()
    }
  }

  // 記錄系統資源
  recordSystemResource(metric: {
    cpuUsage: number
    memoryUsage: number
    memoryUsed: number
    memoryTotal: number
    heapUsed?: number
    activeConnections?: number
    eventLoopLag?: number
  }): void {
    this.metrics.push({
      type: 'system',
      data: metric,
      timestamp: new Date(),
    })
  }

  // 記錄 AI 服務效能
  recordAiService(metric: {
    operationType: string
    totalTime: number
    queueTime?: number
    processingTime?: number
    documentId?: string
    fileSize?: number
    pageCount?: number
    success: boolean
    errorCode?: string
    tokensUsed?: number
    modelName?: string
  }): void {
    this.metrics.push({
      type: 'ai',
      data: metric,
      timestamp: new Date(),
    })
  }

  // 記錄數據庫查詢
  recordDbQuery(metric: {
    queryType: string
    tableName?: string
    queryHash?: string
    executionTime: number
    planningTime?: number
    rowsAffected?: number
    rowsReturned?: number
    endpoint?: string
    userId?: string
  }): void {
    this.metrics.push({
      type: 'database',
      data: metric,
      timestamp: new Date(),
    })
  }

  // 批量寫入數據庫
  private async flush(): Promise<void> {
    if (this.metrics.length === 0) return

    const toFlush = [...this.metrics]
    this.metrics = []

    try {
      // 分類並批量插入
      const apiMetrics = toFlush.filter((m) => m.type === 'api')
      const systemMetrics = toFlush.filter((m) => m.type === 'system')
      const aiMetrics = toFlush.filter((m) => m.type === 'ai')
      const dbMetrics = toFlush.filter((m) => m.type === 'database')

      await Promise.all([
        apiMetrics.length > 0 &&
          prisma.apiPerformanceMetric.createMany({
            data: apiMetrics.map((m) => ({
              ...m.data,
              timestamp: m.timestamp,
            })),
          }),
        systemMetrics.length > 0 &&
          prisma.systemResourceMetric.createMany({
            data: systemMetrics.map((m) => ({
              ...m.data,
              timestamp: m.timestamp,
            })),
          }),
        aiMetrics.length > 0 &&
          prisma.aiServiceMetric.createMany({
            data: aiMetrics.map((m) => ({
              ...m.data,
              timestamp: m.timestamp,
            })),
          }),
        dbMetrics.length > 0 &&
          prisma.databaseQueryMetric.createMany({
            data: dbMetrics.map((m) => ({
              ...m.data,
              timestamp: m.timestamp,
            })),
          }),
      ])
    } catch (error) {
      console.error('Failed to flush performance metrics:', error)
      // 失敗的指標不重新加入隊列，避免積累
    }
  }

  // 關閉收集器
  stop(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
      this.flush() // 最後 flush 一次
    }
  }
}

// 全局實例
export const performanceCollector = new PerformanceCollector()

// 標準化端點路徑
function normalizeEndpoint(path: string): string {
  return path
    .replace(/\/[a-zA-Z0-9_-]{20,}(?=\/|$)/g, '/{id}')
    .replace(/\/\d+(?=\/|$)/g, '/{id}')
}

// API 效能中間件
export function withPerformanceTracking<T>(
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const startTime = Date.now()
    const url = new URL(request.url)

    let dbQueryTime = 0
    // 可以通過 AsyncLocalStorage 追蹤數據庫查詢時間

    try {
      const response = await handler(request)
      const responseTime = Date.now() - startTime

      // 記錄效能指標
      performanceCollector.recordApi({
        method: request.method,
        endpoint: normalizeEndpoint(url.pathname),
        path: url.pathname,
        responseTime,
        dbQueryTime: dbQueryTime > 0 ? dbQueryTime : undefined,
        statusCode: response.status,
        requestSize: parseInt(request.headers.get('content-length') || '0'),
      })

      return response
    } catch (error) {
      const responseTime = Date.now() - startTime

      performanceCollector.recordApi({
        method: request.method,
        endpoint: normalizeEndpoint(url.pathname),
        path: url.pathname,
        responseTime,
        statusCode: 500,
      })

      throw error
    }
  }
}
```

### 3. 效能指標服務

```typescript
// lib/services/monitoring/performanceService.ts
import { prisma } from '@/lib/prisma'
import os from 'os'

type TimeRange = '1h' | '6h' | '24h' | '7d' | '30d'

// 時間範圍轉換為毫秒
const TIME_RANGE_MS: Record<TimeRange, number> = {
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
}

export interface PerformanceOverview {
  api: {
    p50: number
    p95: number
    p99: number
    avg: number
    count: number
    errorRate: number
  }
  database: {
    p50: number
    p95: number
    p99: number
    avg: number
    count: number
  }
  ai: {
    p50: number
    p95: number
    p99: number
    avg: number
    count: number
    successRate: number
  }
  system: {
    cpuCurrent: number
    cpuAvg: number
    memoryCurrent: number
    memoryAvg: number
  }
}

export interface TimeSeriesData {
  timestamp: string
  value: number
}

export class PerformanceService {
  // 獲取效能概覽
  async getOverview(timeRange: TimeRange): Promise<PerformanceOverview> {
    const since = new Date(Date.now() - TIME_RANGE_MS[timeRange])

    const [apiStats, dbStats, aiStats, systemStats] = await Promise.all([
      this.getApiStats(since),
      this.getDatabaseStats(since),
      this.getAiStats(since),
      this.getSystemStats(since),
    ])

    return {
      api: apiStats,
      database: dbStats,
      ai: aiStats,
      system: systemStats,
    }
  }

  // API 統計
  private async getApiStats(since: Date) {
    const metrics = await prisma.apiPerformanceMetric.findMany({
      where: { timestamp: { gt: since } },
      select: { responseTime: true, statusCode: true },
    })

    if (metrics.length === 0) {
      return { p50: 0, p95: 0, p99: 0, avg: 0, count: 0, errorRate: 0 }
    }

    const times = metrics.map((m) => m.responseTime).sort((a, b) => a - b)
    const errors = metrics.filter((m) => m.statusCode >= 400).length

    return {
      p50: this.percentile(times, 50),
      p95: this.percentile(times, 95),
      p99: this.percentile(times, 99),
      avg: times.reduce((a, b) => a + b, 0) / times.length,
      count: metrics.length,
      errorRate: (errors / metrics.length) * 100,
    }
  }

  // 數據庫統計
  private async getDatabaseStats(since: Date) {
    const metrics = await prisma.databaseQueryMetric.findMany({
      where: { timestamp: { gt: since } },
      select: { executionTime: true },
    })

    if (metrics.length === 0) {
      return { p50: 0, p95: 0, p99: 0, avg: 0, count: 0 }
    }

    const times = metrics.map((m) => m.executionTime).sort((a, b) => a - b)

    return {
      p50: this.percentile(times, 50),
      p95: this.percentile(times, 95),
      p99: this.percentile(times, 99),
      avg: times.reduce((a, b) => a + b, 0) / times.length,
      count: metrics.length,
    }
  }

  // AI 服務統計
  private async getAiStats(since: Date) {
    const metrics = await prisma.aiServiceMetric.findMany({
      where: { timestamp: { gt: since } },
      select: { totalTime: true, success: true },
    })

    if (metrics.length === 0) {
      return { p50: 0, p95: 0, p99: 0, avg: 0, count: 0, successRate: 100 }
    }

    const times = metrics.map((m) => m.totalTime).sort((a, b) => a - b)
    const successes = metrics.filter((m) => m.success).length

    return {
      p50: this.percentile(times, 50),
      p95: this.percentile(times, 95),
      p99: this.percentile(times, 99),
      avg: times.reduce((a, b) => a + b, 0) / times.length,
      count: metrics.length,
      successRate: (successes / metrics.length) * 100,
    }
  }

  // 系統統計
  private async getSystemStats(since: Date) {
    const metrics = await prisma.systemResourceMetric.findMany({
      where: { timestamp: { gt: since } },
      orderBy: { timestamp: 'desc' },
      take: 100,
    })

    // 當前系統狀態
    const cpus = os.cpus()
    const totalMem = os.totalmem()
    const freeMem = os.freemem()

    const cpuUsage = cpus.reduce((acc, cpu) => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b, 0)
      const idle = cpu.times.idle
      return acc + ((total - idle) / total) * 100
    }, 0) / cpus.length

    const memoryUsage = ((totalMem - freeMem) / totalMem) * 100

    if (metrics.length === 0) {
      return {
        cpuCurrent: cpuUsage,
        cpuAvg: cpuUsage,
        memoryCurrent: memoryUsage,
        memoryAvg: memoryUsage,
      }
    }

    const cpuValues = metrics.map((m) => m.cpuUsage)
    const memValues = metrics.map((m) => m.memoryUsage)

    return {
      cpuCurrent: cpuUsage,
      cpuAvg: cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length,
      memoryCurrent: memoryUsage,
      memoryAvg: memValues.reduce((a, b) => a + b, 0) / memValues.length,
    }
  }

  // 計算百分位數
  private percentile(sortedArray: number[], p: number): number {
    if (sortedArray.length === 0) return 0
    const index = Math.ceil((p / 100) * sortedArray.length) - 1
    return sortedArray[Math.max(0, index)]
  }

  // 獲取時間序列數據
  async getTimeSeries(
    metric: 'api_response_time' | 'db_query_time' | 'ai_processing_time' | 'cpu_usage' | 'memory_usage',
    timeRange: TimeRange,
    endpoint?: string
  ): Promise<TimeSeriesData[]> {
    const since = new Date(Date.now() - TIME_RANGE_MS[timeRange])

    // 根據時間範圍決定聚合粒度
    const granularity = this.getGranularity(timeRange)

    switch (metric) {
      case 'api_response_time':
        return this.getApiTimeSeries(since, granularity, endpoint)
      case 'db_query_time':
        return this.getDbTimeSeries(since, granularity)
      case 'ai_processing_time':
        return this.getAiTimeSeries(since, granularity)
      case 'cpu_usage':
        return this.getCpuTimeSeries(since, granularity)
      case 'memory_usage':
        return this.getMemoryTimeSeries(since, granularity)
      default:
        return []
    }
  }

  // 根據時間範圍獲取聚合粒度（分鐘）
  private getGranularity(timeRange: TimeRange): number {
    switch (timeRange) {
      case '1h':
        return 1      // 1 分鐘
      case '6h':
        return 5      // 5 分鐘
      case '24h':
        return 15     // 15 分鐘
      case '7d':
        return 60     // 1 小時
      case '30d':
        return 360    // 6 小時
      default:
        return 15
    }
  }

  // API 時間序列
  private async getApiTimeSeries(
    since: Date,
    granularityMinutes: number,
    endpoint?: string
  ): Promise<TimeSeriesData[]> {
    const where: any = { timestamp: { gt: since } }
    if (endpoint) where.endpoint = endpoint

    const metrics = await prisma.apiPerformanceMetric.findMany({
      where,
      select: { timestamp: true, responseTime: true },
      orderBy: { timestamp: 'asc' },
    })

    return this.aggregateTimeSeries(metrics, granularityMinutes, 'responseTime')
  }

  // 數據庫時間序列
  private async getDbTimeSeries(
    since: Date,
    granularityMinutes: number
  ): Promise<TimeSeriesData[]> {
    const metrics = await prisma.databaseQueryMetric.findMany({
      where: { timestamp: { gt: since } },
      select: { timestamp: true, executionTime: true },
      orderBy: { timestamp: 'asc' },
    })

    return this.aggregateTimeSeries(metrics, granularityMinutes, 'executionTime')
  }

  // AI 時間序列
  private async getAiTimeSeries(
    since: Date,
    granularityMinutes: number
  ): Promise<TimeSeriesData[]> {
    const metrics = await prisma.aiServiceMetric.findMany({
      where: { timestamp: { gt: since } },
      select: { timestamp: true, totalTime: true },
      orderBy: { timestamp: 'asc' },
    })

    return this.aggregateTimeSeries(metrics, granularityMinutes, 'totalTime')
  }

  // CPU 時間序列
  private async getCpuTimeSeries(
    since: Date,
    granularityMinutes: number
  ): Promise<TimeSeriesData[]> {
    const metrics = await prisma.systemResourceMetric.findMany({
      where: { timestamp: { gt: since } },
      select: { timestamp: true, cpuUsage: true },
      orderBy: { timestamp: 'asc' },
    })

    return this.aggregateTimeSeries(metrics, granularityMinutes, 'cpuUsage')
  }

  // 記憶體時間序列
  private async getMemoryTimeSeries(
    since: Date,
    granularityMinutes: number
  ): Promise<TimeSeriesData[]> {
    const metrics = await prisma.systemResourceMetric.findMany({
      where: { timestamp: { gt: since } },
      select: { timestamp: true, memoryUsage: true },
      orderBy: { timestamp: 'asc' },
    })

    return this.aggregateTimeSeries(metrics, granularityMinutes, 'memoryUsage')
  }

  // 聚合時間序列數據
  private aggregateTimeSeries(
    data: Array<{ timestamp: Date; [key: string]: any }>,
    granularityMinutes: number,
    valueField: string
  ): TimeSeriesData[] {
    if (data.length === 0) return []

    const buckets = new Map<string, number[]>()
    const granularityMs = granularityMinutes * 60 * 1000

    for (const item of data) {
      const bucketTime = new Date(
        Math.floor(item.timestamp.getTime() / granularityMs) * granularityMs
      )
      const key = bucketTime.toISOString()

      if (!buckets.has(key)) {
        buckets.set(key, [])
      }
      buckets.get(key)!.push(item[valueField])
    }

    const result: TimeSeriesData[] = []
    for (const [timestamp, values] of buckets) {
      result.push({
        timestamp,
        value: values.reduce((a, b) => a + b, 0) / values.length,
      })
    }

    return result.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  }

  // 獲取最慢的 API 端點
  async getSlowestEndpoints(
    timeRange: TimeRange,
    limit: number = 10
  ): Promise<Array<{
    endpoint: string
    avgResponseTime: number
    p95ResponseTime: number
    count: number
    errorRate: number
  }>> {
    const since = new Date(Date.now() - TIME_RANGE_MS[timeRange])

    const metrics = await prisma.apiPerformanceMetric.groupBy({
      by: ['endpoint'],
      where: { timestamp: { gt: since } },
      _avg: { responseTime: true },
      _count: true,
    })

    // 獲取更詳細的統計
    const detailedStats = await Promise.all(
      metrics.map(async (m) => {
        const endpointMetrics = await prisma.apiPerformanceMetric.findMany({
          where: {
            endpoint: m.endpoint,
            timestamp: { gt: since },
          },
          select: { responseTime: true, statusCode: true },
        })

        const times = endpointMetrics.map((e) => e.responseTime).sort((a, b) => a - b)
        const errors = endpointMetrics.filter((e) => e.statusCode >= 400).length

        return {
          endpoint: m.endpoint,
          avgResponseTime: m._avg.responseTime || 0,
          p95ResponseTime: this.percentile(times, 95),
          count: m._count,
          errorRate: (errors / endpointMetrics.length) * 100,
        }
      })
    )

    return detailedStats
      .sort((a, b) => b.avgResponseTime - a.avgResponseTime)
      .slice(0, limit)
  }

  // 獲取最慢的數據庫查詢
  async getSlowestQueries(
    timeRange: TimeRange,
    limit: number = 10
  ): Promise<Array<{
    queryType: string
    tableName: string | null
    avgExecutionTime: number
    maxExecutionTime: number
    count: number
  }>> {
    const since = new Date(Date.now() - TIME_RANGE_MS[timeRange])

    const metrics = await prisma.databaseQueryMetric.groupBy({
      by: ['queryType', 'tableName'],
      where: { timestamp: { gt: since } },
      _avg: { executionTime: true },
      _max: { executionTime: true },
      _count: true,
    })

    return metrics
      .map((m) => ({
        queryType: m.queryType,
        tableName: m.tableName,
        avgExecutionTime: m._avg.executionTime || 0,
        maxExecutionTime: m._max.executionTime || 0,
        count: m._count,
      }))
      .sort((a, b) => b.avgExecutionTime - a.avgExecutionTime)
      .slice(0, limit)
  }

  // 匯出效能數據
  async exportToCsv(
    metric: string,
    timeRange: TimeRange
  ): Promise<string> {
    const timeSeries = await this.getTimeSeries(metric as any, timeRange)

    const headers = ['Timestamp', 'Value']
    const rows = timeSeries.map((d) => [d.timestamp, d.value.toString()])

    return [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n')
  }
}

export const performanceService = new PerformanceService()
```

### 4. 系統資源收集任務

```typescript
// lib/jobs/systemMetricsJob.ts
import os from 'os'
import { performanceCollector } from '@/lib/middleware/performanceMiddleware'

export class SystemMetricsJob {
  private intervalId: NodeJS.Timeout | null = null

  // 啟動系統指標收集
  start(intervalMs: number = 60000): void {
    if (this.intervalId) {
      console.warn('System metrics job already running')
      return
    }

    console.log('Starting system metrics job')

    // 立即收集一次
    this.collect()

    // 定期收集
    this.intervalId = setInterval(() => {
      this.collect()
    }, intervalMs)
  }

  // 停止收集
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
      console.log('System metrics job stopped')
    }
  }

  // 收集系統指標
  private collect(): void {
    const cpus = os.cpus()
    const totalMem = os.totalmem()
    const freeMem = os.freemem()

    // 計算 CPU 使用率
    const cpuUsage = cpus.reduce((acc, cpu) => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b, 0)
      const idle = cpu.times.idle
      return acc + ((total - idle) / total) * 100
    }, 0) / cpus.length

    // 記憶體使用率
    const memoryUsage = ((totalMem - freeMem) / totalMem) * 100

    // Node.js 記憶體
    const nodeMemory = process.memoryUsage()

    performanceCollector.recordSystemResource({
      cpuUsage,
      memoryUsage,
      memoryUsed: totalMem - freeMem,
      memoryTotal: totalMem,
      heapUsed: nodeMemory.heapUsed,
    })
  }
}

export const systemMetricsJob = new SystemMetricsJob()
```

### 5. API 路由

```typescript
// app/api/admin/performance/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { performanceService } from '@/lib/services/monitoring/performanceService'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || !['ADMIN', 'SUPER_USER'].includes(session.user.role)) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Admin access required' } },
        { status: 403 }
      )
    }

    const timeRange = (request.nextUrl.searchParams.get('range') || '24h') as any

    const overview = await performanceService.getOverview(timeRange)

    return NextResponse.json({ data: overview }, { status: 200 })
  } catch (error) {
    console.error('Get performance overview error:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to get performance data' } },
      { status: 500 }
    )
  }
}
```

```typescript
// app/api/admin/performance/timeseries/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { performanceService } from '@/lib/services/monitoring/performanceService'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || !['ADMIN', 'SUPER_USER'].includes(session.user.role)) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Admin access required' } },
        { status: 403 }
      )
    }

    const metric = request.nextUrl.searchParams.get('metric') as any
    const timeRange = (request.nextUrl.searchParams.get('range') || '24h') as any
    const endpoint = request.nextUrl.searchParams.get('endpoint') || undefined

    if (!metric) {
      return NextResponse.json(
        { error: { code: 'MISSING_PARAM', message: 'metric parameter is required' } },
        { status: 400 }
      )
    }

    const timeSeries = await performanceService.getTimeSeries(metric, timeRange, endpoint)

    return NextResponse.json({ data: timeSeries }, { status: 200 })
  } catch (error) {
    console.error('Get time series error:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to get time series data' } },
      { status: 500 }
    )
  }
}
```

```typescript
// app/api/admin/performance/export/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { performanceService } from '@/lib/services/monitoring/performanceService'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || !['ADMIN', 'SUPER_USER'].includes(session.user.role)) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Admin access required' } },
        { status: 403 }
      )
    }

    const metric = request.nextUrl.searchParams.get('metric') || 'api_response_time'
    const timeRange = (request.nextUrl.searchParams.get('range') || '24h') as any

    const csv = await performanceService.exportToCsv(metric, timeRange)

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="performance_${metric}_${timeRange}.csv"`,
      },
    })
  } catch (error) {
    console.error('Export performance data error:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to export data' } },
      { status: 500 }
    )
  }
}
```

## 測試案例

### 單元測試

```typescript
// __tests__/services/monitoring/performanceService.test.ts
import { performanceService } from '@/lib/services/monitoring/performanceService'
import { prismaMock } from '@/lib/__mocks__/prisma'

describe('PerformanceService', () => {
  describe('getOverview', () => {
    it('should return performance overview', async () => {
      prismaMock.apiPerformanceMetric.findMany.mockResolvedValue([
        { responseTime: 100, statusCode: 200 },
        { responseTime: 200, statusCode: 200 },
        { responseTime: 150, statusCode: 500 },
      ] as any)

      prismaMock.databaseQueryMetric.findMany.mockResolvedValue([
        { executionTime: 10 },
        { executionTime: 20 },
      ] as any)

      prismaMock.aiServiceMetric.findMany.mockResolvedValue([
        { totalTime: 1000, success: true },
        { totalTime: 2000, success: false },
      ] as any)

      prismaMock.systemResourceMetric.findMany.mockResolvedValue([])

      const overview = await performanceService.getOverview('24h')

      expect(overview.api.count).toBe(3)
      expect(overview.api.errorRate).toBeCloseTo(33.33, 1)
      expect(overview.database.count).toBe(2)
    })
  })

  describe('percentile', () => {
    it('should calculate correct percentile', () => {
      const times = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

      expect(performanceService['percentile'](times, 50)).toBe(50)
      expect(performanceService['percentile'](times, 95)).toBe(100)
    })
  })
})
```

## 部署注意事項

1. **數據保留策略**
   - 原始數據保留 7 天
   - 彙總數據保留 90 天
   - 配置自動清理任務

2. **效能影響**
   - 指標收集使用批量寫入
   - 避免影響主要業務效能

3. **閾值配置**
   - API 回應時間: P95 < 500ms
   - 數據庫查詢: P95 < 100ms
   - CPU 使用率: < 80%

## 相依性

- Story 12-1: 系統健康監控儀表板（整合顯示）
- Story 12-3: 錯誤告警配置（閾值觸發）
