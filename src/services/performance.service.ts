/**
 * @fileoverview Performance Service
 * @description
 *   效能指標查詢服務，負責：
 *   - 效能概覽統計（API、數據庫、AI、系統資源）
 *   - 時間序列數據查詢和聚合
 *   - 最慢端點/查詢/操作分析
 *   - 百分位數計算（P50/P95/P99）
 *   - CSV 匯出功能
 *
 * @module src/services/performance
 * @since Epic 12 - Story 12-2
 * @lastModified 2025-12-21
 *
 * @features
 *   - 多指標類型效能概覽
 *   - 可配置時間範圍（1h/6h/24h/7d/30d）
 *   - 自動聚合粒度調整
 *   - 閾值警告/嚴重狀態
 *   - 趨勢分析（上升/下降/穩定）
 *
 * @dependencies
 *   - @/lib/prisma - 資料庫客戶端
 *   - @/types/performance - 效能類型定義
 *   - os - Node.js 系統模組
 *
 * @related
 *   - src/services/performance-collector.service.ts - 效能數據收集
 *   - src/app/api/admin/performance/route.ts - 效能 API 端點
 */

import os from 'os';
import { prisma } from '@/lib/prisma';
import type {
  TimeRange,
  MetricType,
  PercentileType,
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
import { TIME_RANGE_MS, GRANULARITY_MINUTES, DEFAULT_THRESHOLDS } from '@/types/performance';

// ============================================================
// PerformanceService Class
// ============================================================

/**
 * 效能指標查詢服務
 *
 * @description
 *   提供效能數據的查詢、聚合和分析功能。
 *   支援多種時間範圍和指標類型。
 *
 * @example
 * ```typescript
 * import { performanceService } from '@/services/performance.service';
 *
 * // 取得效能概覽
 * const overview = await performanceService.getOverview('24h');
 *
 * // 取得時間序列數據
 * const timeSeries = await performanceService.getTimeSeries('api_response_time', '1h');
 *
 * // 取得最慢的 API 端點
 * const slowest = await performanceService.getSlowestEndpoints('24h', 10);
 * ```
 */
export class PerformanceService {
  /**
   * 取得效能概覽
   *
   * @param timeRange - 時間範圍
   * @param cityId - 可選的城市 ID 過濾
   * @returns 效能概覽數據
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
    const where: Record<string, unknown> = { timestamp: { gt: since } };
    if (cityId) where.cityId = cityId;

    const metrics = await prisma.apiPerformanceMetric.findMany({
      where,
      select: { responseTime: true, statusCode: true },
    });

    if (metrics.length === 0) {
      return {
        p50: 0,
        p95: 0,
        p99: 0,
        avg: 0,
        min: 0,
        max: 0,
        count: 0,
        errorRate: 0,
      };
    }

    const times = metrics.map((m) => m.responseTime).sort((a, b) => a - b);
    const errors = metrics.filter((m) => m.statusCode >= 400).length;

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

    const times = metrics.map((m) => m.executionTime).sort((a, b) => a - b);

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
    const where: Record<string, unknown> = { timestamp: { gt: since } };
    if (cityId) where.cityId = cityId;

    const metrics = await prisma.aiServiceMetric.findMany({
      where,
      select: {
        totalTime: true,
        success: true,
        tokensUsed: true,
        estimatedCost: true,
      },
    });

    if (metrics.length === 0) {
      return {
        p50: 0,
        p95: 0,
        p99: 0,
        avg: 0,
        count: 0,
        successRate: 100,
        totalTokens: 0,
        totalCost: 0,
      };
    }

    const times = metrics.map((m) => m.totalTime).sort((a, b) => a - b);
    const successes = metrics.filter((m) => m.success).length;
    const totalTokens = metrics.reduce(
      (sum, m) => sum + (m.tokensUsed || 0),
      0
    );
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

    const cpuCurrent =
      cpus.reduce((acc, cpu) => {
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

    const cpuValues = metrics.map((m) => m.cpuUsage);
    const memValues = metrics.map((m) => m.memoryUsage);

    return {
      cpuCurrent: Math.round(cpuCurrent * 100) / 100,
      cpuAvg:
        Math.round(
          (cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length) * 100
        ) / 100,
      cpuMax: Math.round(Math.max(...cpuValues) * 100) / 100,
      memoryCurrent: Math.round(memoryCurrent * 100) / 100,
      memoryAvg:
        Math.round(
          (memValues.reduce((a, b) => a + b, 0) / memValues.length) * 100
        ) / 100,
      memoryMax: Math.round(Math.max(...memValues) * 100) / 100,
    };
  }

  /**
   * 計算百分位數
   *
   * @param sortedArray - 已排序的數值陣列
   * @param p - 百分位數 (0-100)
   * @returns 百分位數值
   */
  private percentile(sortedArray: number[], p: number): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil((p / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  /**
   * 取得時間序列數據
   *
   * @param metric - 指標類型
   * @param timeRange - 時間範圍
   * @param options - 過濾選項
   * @returns 時間序列響應
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
    const where: Record<string, unknown> = { timestamp: { gt: since } };
    if (options.endpoint) where.endpoint = options.endpoint;
    if (options.cityId) where.cityId = options.cityId;

    const metrics = await prisma.apiPerformanceMetric.findMany({
      where,
      select: { timestamp: true, responseTime: true },
      orderBy: { timestamp: 'asc' },
    });

    return this.aggregateTimeSeries(
      metrics,
      granularityMinutes,
      'responseTime'
    );
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

    return this.aggregateTimeSeries(
      metrics,
      granularityMinutes,
      'executionTime'
    );
  }

  /**
   * AI 時間序列
   */
  private async getAiTimeSeries(
    since: Date,
    granularityMinutes: number,
    cityId?: string
  ): Promise<TimeSeriesDataPoint[]> {
    const where: Record<string, unknown> = { timestamp: { gt: since } };
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
   *
   * @param data - 原始數據
   * @param granularityMinutes - 聚合粒度（分鐘）
   * @param valueField - 值欄位名稱
   * @returns 聚合後的時間序列數據點
   */
  private aggregateTimeSeries(
    data: Array<{ timestamp: Date; [key: string]: unknown }>,
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
      buckets.get(key)!.push(item[valueField] as number);
    }

    const result: TimeSeriesDataPoint[] = [];
    for (const [timestamp, values] of buckets) {
      result.push({
        timestamp,
        value:
          Math.round(
            (values.reduce((a, b) => a + b, 0) / values.length) * 100
          ) / 100,
      });
    }

    return result.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  /**
   * 取得閾值配置
   *
   * @param metric - 指標類型
   * @returns 閾值配置或預設值
   */
  private async getThresholds(
    metric: MetricType
  ): Promise<{ warning: number; critical: number } | undefined> {
    const threshold = await prisma.performanceThreshold.findFirst({
      where: { metricType: metric, isEnabled: true },
    });

    if (!threshold) {
      // 使用預設閾值
      return DEFAULT_THRESHOLDS[metric];
    }

    return {
      warning: threshold.warningThreshold,
      critical: threshold.criticalThreshold,
    };
  }

  /**
   * 取得最慢的 API 端點
   *
   * @param timeRange - 時間範圍
   * @param limit - 返回數量限制
   * @param cityId - 可選的城市 ID 過濾
   * @returns 最慢的端點列表
   */
  async getSlowestEndpoints(
    timeRange: TimeRange,
    limit: number = 10,
    cityId?: string
  ): Promise<SlowestEndpoint[]> {
    const since = new Date(Date.now() - TIME_RANGE_MS[timeRange]);

    const where: Record<string, unknown> = { timestamp: { gt: since } };
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

        const times = endpointMetrics
          .map((m) => m.responseTime)
          .sort((a, b) => a - b);
        const errors = endpointMetrics.filter((m) => m.statusCode >= 400).length;

        // 計算趨勢 (比較前後半段)
        const midpoint = Math.floor(times.length / 2);
        const firstHalf = times.slice(0, midpoint);
        const secondHalf = times.slice(midpoint);
        const firstAvg =
          firstHalf.length > 0
            ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
            : 0;
        const secondAvg =
          secondHalf.length > 0
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
          errorRate:
            Math.round((errors / endpointMetrics.length) * 10000) / 100,
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
   *
   * @param timeRange - 時間範圍
   * @param limit - 返回數量限制
   * @returns 最慢的查詢列表
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
      .map((group) => ({
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
   *
   * @param timeRange - 時間範圍
   * @param limit - 返回數量限制
   * @param cityId - 可選的城市 ID 過濾
   * @returns 最慢的 AI 操作列表
   */
  async getSlowestAiOperations(
    timeRange: TimeRange,
    limit: number = 10,
    cityId?: string
  ): Promise<SlowestAiOperation[]> {
    const since = new Date(Date.now() - TIME_RANGE_MS[timeRange]);

    const where: Record<string, unknown> = { timestamp: { gt: since } };
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

        const times = metrics.map((m) => m.totalTime).sort((a, b) => a - b);
        const successes = metrics.filter((m) => m.success).length;

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
   *
   * @param options - 匯出選項
   * @returns 匯出結果
   */
  async exportToCsv(options: ExportOptions): Promise<ExportResult> {
    const timeSeries = await this.getTimeSeries(
      options.metric,
      options.timeRange
    );

    const headers = ['Timestamp', 'Value', 'Metric', 'TimeRange'];
    const rows = timeSeries.data.map((d) => [
      d.timestamp,
      d.value.toString(),
      options.metric,
      options.timeRange,
    ]);

    const csvContent = options.includeHeaders !== false
      ? [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
      : rows.map((row) => row.join(',')).join('\n');

    const filename = `performance_${options.metric}_${options.timeRange}_${Date.now()}.csv`;

    return {
      content: csvContent,
      filename,
      mimeType: 'text/csv',
      recordCount: rows.length,
    };
  }

  /**
   * 匯出效能數據為 JSON
   *
   * @param options - 匯出選項
   * @returns 匯出結果
   */
  async exportToJson(options: ExportOptions): Promise<ExportResult> {
    const timeSeries = await this.getTimeSeries(
      options.metric,
      options.timeRange
    );

    const jsonContent = JSON.stringify(
      {
        metric: options.metric,
        timeRange: options.timeRange,
        generatedAt: new Date().toISOString(),
        thresholds: timeSeries.thresholds,
        data: timeSeries.data,
      },
      null,
      2
    );

    const filename = `performance_${options.metric}_${options.timeRange}_${Date.now()}.json`;

    return {
      content: jsonContent,
      filename,
      mimeType: 'application/json',
      recordCount: timeSeries.data.length,
    };
  }

  /**
   * 匯出效能數據（自動選擇格式）
   *
   * @param options - 匯出選項
   * @returns 匯出結果
   */
  async export(options: ExportOptions): Promise<ExportResult> {
    if (options.format === 'json') {
      return this.exportToJson(options);
    }
    return this.exportToCsv(options);
  }
}

// ============================================================
// Singleton Instance
// ============================================================

/**
 * PerformanceService 單例實例
 */
export const performanceService = new PerformanceService();
