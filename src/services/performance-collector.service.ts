/**
 * @fileoverview Performance Collector Service
 * @description
 *   效能指標收集器服務，負責：
 *   - 使用內存緩衝區批量收集指標
 *   - 定期批量寫入數據庫（每 10 秒）
 *   - 支援自動重試和錯誤處理
 *   - 處理程序退出時確保數據寫入
 *
 * @module src/services/performance-collector
 * @since Epic 12 - Story 12-2
 * @lastModified 2025-12-21
 *
 * @features
 *   - 批量緩衝寫入（減少數據庫壓力）
 *   - 自動 flush（可配置間隔）
 *   - 緩衝區滿時自動觸發 flush
 *   - 優雅關閉（確保數據不丟失）
 *   - 重試機制（失敗後自動重試）
 *   - 統計追蹤（flush 次數、失敗次數等）
 *
 * @dependencies
 *   - @/lib/prisma - 資料庫客戶端
 *   - @/types/performance - 效能類型定義
 *
 * @related
 *   - src/services/performance.service.ts - 效能數據查詢服務
 *   - src/app/api/admin/performance/route.ts - 效能 API 端點
 */

import { prisma } from '@/lib/prisma';
import type {
  ApiMetricInput,
  SystemResourceInput,
  AiMetricInput,
  DbQueryMetricInput,
  BufferedMetric,
  CollectorConfig,
  CollectorStats,
} from '@/types/performance';

// ============================================================
// Constants
// ============================================================

/**
 * Default collector configuration
 */
const DEFAULT_CONFIG: CollectorConfig = {
  flushIntervalMs: 10000, // 10 seconds
  maxBufferSize: 100,
  retryAttempts: 3,
  retryDelayMs: 1000,
};

// ============================================================
// PerformanceCollector Class
// ============================================================

/**
 * 效能指標收集器
 *
 * @description
 *   使用內存緩衝區批量收集指標，定期批量寫入數據庫。
 *   支援自動重試和錯誤處理，確保數據不丟失。
 *
 * @example
 * ```typescript
 * import { performanceCollector } from '@/services/performance-collector.service';
 *
 * // 記錄 API 指標
 * performanceCollector.recordApi({
 *   method: 'GET',
 *   endpoint: '/api/documents',
 *   path: '/api/documents',
 *   responseTime: 150,
 *   statusCode: 200,
 * });
 *
 * // 取得統計
 * const stats = performanceCollector.getStats();
 * ```
 */
export class PerformanceCollector {
  private buffer: BufferedMetric<unknown>[] = [];
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private config: CollectorConfig;
  private stats: CollectorStats = {
    bufferedCount: 0,
    flushedCount: 0,
    failedCount: 0,
    lastFlushTime: null,
    averageFlushDuration: 0,
  };
  private flushDurations: number[] = [];
  private isShuttingDown = false;

  constructor(config: Partial<CollectorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 啟動收集器
   *
   * @description 開始定期 flush 緩衝區到數據庫
   */
  start(): void {
    if (this.flushInterval) {
      console.warn('[PerformanceCollector] Already started');
      return;
    }

    console.log('[PerformanceCollector] Starting with config:', this.config);

    this.flushInterval = setInterval(
      () => this.flush(),
      this.config.flushIntervalMs
    );

    // 處理程序退出時確保數據寫入
    if (typeof process !== 'undefined') {
      process.on('beforeExit', () => this.handleShutdown());
      process.on('SIGINT', () => this.handleShutdown());
      process.on('SIGTERM', () => this.handleShutdown());
    }
  }

  /**
   * 停止收集器
   *
   * @description 停止定期 flush 並執行最後一次 flush
   */
  async stop(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    // 最後一次 flush
    await this.flush();
    console.log('[PerformanceCollector] Stopped. Stats:', this.stats);
  }

  /**
   * 記錄 API 效能指標
   *
   * @param metric - API 指標數據
   */
  recordApi(metric: ApiMetricInput): void {
    this.addToBuffer('api', metric);
  }

  /**
   * 記錄系統資源指標
   *
   * @param metric - 系統資源指標數據
   */
  recordSystemResource(metric: SystemResourceInput): void {
    this.addToBuffer('system', metric);
  }

  /**
   * 記錄 AI 服務效能指標
   *
   * @param metric - AI 服務指標數據
   */
  recordAiService(metric: AiMetricInput): void {
    this.addToBuffer('ai', metric);
  }

  /**
   * 記錄數據庫查詢指標
   *
   * @param metric - 數據庫查詢指標數據
   */
  recordDbQuery(metric: DbQueryMetricInput): void {
    this.addToBuffer('database', metric);
  }

  /**
   * 取得收集器統計
   *
   * @returns 當前收集器統計數據
   */
  getStats(): CollectorStats {
    return { ...this.stats, bufferedCount: this.buffer.length };
  }

  /**
   * 取得當前緩衝區大小
   *
   * @returns 緩衝區中的指標數量
   */
  getBufferSize(): number {
    return this.buffer.length;
  }

  /**
   * 添加到緩衝區
   *
   * @param type - 指標類型
   * @param data - 指標數據
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
      this.flush().catch((error) => {
        console.error('[PerformanceCollector] Auto-flush failed:', error);
      });
    }
  }

  /**
   * 批量寫入數據庫
   *
   * @description 將緩衝區中的所有指標批量寫入數據庫
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const startTime = Date.now();
    const toFlush = [...this.buffer];
    this.buffer = [];

    try {
      // 分類指標
      const apiMetrics = toFlush.filter((m) => m.type === 'api');
      const systemMetrics = toFlush.filter((m) => m.type === 'system');
      const aiMetrics = toFlush.filter((m) => m.type === 'ai');
      const dbMetrics = toFlush.filter((m) => m.type === 'database');

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
      console.error('[PerformanceCollector] Failed to flush metrics:', error);
      this.stats.failedCount += toFlush.length;

      // 重試邏輯
      await this.retryFlush(toFlush);
    }
  }

  /**
   * 寫入 API 指標
   */
  private async flushApiMetrics(
    metrics: BufferedMetric<unknown>[]
  ): Promise<void> {
    const typedMetrics = metrics as BufferedMetric<ApiMetricInput>[];
    await prisma.apiPerformanceMetric.createMany({
      data: typedMetrics.map((m) => ({
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
        correlationId: m.data.correlationId,
        timestamp: m.timestamp,
      })),
      skipDuplicates: true,
    });
  }

  /**
   * 寫入系統資源指標
   */
  private async flushSystemMetrics(
    metrics: BufferedMetric<unknown>[]
  ): Promise<void> {
    const typedMetrics = metrics as BufferedMetric<SystemResourceInput>[];
    await prisma.systemResourceMetric.createMany({
      data: typedMetrics.map((m) => ({
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
    metrics: BufferedMetric<unknown>[]
  ): Promise<void> {
    const typedMetrics = metrics as BufferedMetric<AiMetricInput>[];
    await prisma.aiServiceMetric.createMany({
      data: typedMetrics.map((m) => ({
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
        estimatedCost: m.data.estimatedCost
          ? parseFloat(m.data.estimatedCost.toFixed(6))
          : null,
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
    metrics: BufferedMetric<unknown>[]
  ): Promise<void> {
    const typedMetrics = metrics as BufferedMetric<DbQueryMetricInput>[];
    await prisma.databaseQueryMetric.createMany({
      data: typedMetrics.map((m) => ({
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
  private async retryFlush(metrics: BufferedMetric<unknown>[]): Promise<void> {
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        await new Promise((resolve) =>
          setTimeout(resolve, this.config.retryDelayMs * attempt)
        );

        // 將指標放回緩衝區並重試
        this.buffer = [...metrics, ...this.buffer];
        await this.flush();

        console.log(`[PerformanceCollector] Retry attempt ${attempt} successful`);
        return;
      } catch (error) {
        console.error(
          `[PerformanceCollector] Retry attempt ${attempt} failed:`,
          error
        );
      }
    }

    // 所有重試都失敗，記錄錯誤
    console.error(
      `[PerformanceCollector] Failed to flush ${metrics.length} metrics after ${this.config.retryAttempts} attempts`
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
      this.flushDurations.reduce((a, b) => a + b, 0) /
      this.flushDurations.length;
  }

  /**
   * 處理關閉
   */
  private async handleShutdown(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    console.log('[PerformanceCollector] Shutting down...');
    await this.stop();
  }
}

// ============================================================
// Singleton Instance
// ============================================================

let collectorInstance: PerformanceCollector | null = null;

/**
 * 取得 PerformanceCollector 單例
 *
 * @description
 *   如果實例不存在，會創建並啟動一個新的收集器。
 *   確保整個應用只使用一個收集器實例。
 *
 * @returns PerformanceCollector 單例實例
 */
export function getPerformanceCollector(): PerformanceCollector {
  if (!collectorInstance) {
    collectorInstance = new PerformanceCollector();
    // Only start if not in test environment
    if (process.env.NODE_ENV !== 'test') {
      collectorInstance.start();
    }
  }
  return collectorInstance;
}

/**
 * 重置收集器（僅用於測試）
 */
export function resetPerformanceCollector(): void {
  if (collectorInstance) {
    collectorInstance.stop();
    collectorInstance = null;
  }
}

/**
 * 預設的 PerformanceCollector 實例
 *
 * @description
 *   方便直接導入使用，會自動啟動收集器。
 *
 * @example
 * ```typescript
 * import { performanceCollector } from '@/services/performance-collector.service';
 *
 * performanceCollector.recordApi({
 *   method: 'GET',
 *   endpoint: '/api/documents',
 *   path: '/api/documents',
 *   responseTime: 150,
 *   statusCode: 200,
 * });
 * ```
 */
export const performanceCollector = getPerformanceCollector();
