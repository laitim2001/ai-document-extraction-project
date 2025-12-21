/**
 * @fileoverview Performance Monitoring Types
 * @description
 *   Type definitions for system performance monitoring including:
 *   - API response time metrics (P50/P95/P99)
 *   - Database query performance
 *   - AI service metrics
 *   - System resource usage (CPU, Memory)
 *   - Time series data for charts
 *   - Performance thresholds and warnings
 *
 * @module src/types/performance
 * @since Epic 12 - Story 12-2
 * @lastModified 2025-12-21
 */

// ============================================================
// Time Range Types
// ============================================================

/**
 * Available time ranges for performance data queries
 */
export type TimeRange = '1h' | '6h' | '24h' | '7d' | '30d';

/**
 * Time range in milliseconds mapping
 */
export const TIME_RANGE_MS: Record<TimeRange, number> = {
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

/**
 * Aggregation granularity in minutes for each time range
 */
export const GRANULARITY_MINUTES: Record<TimeRange, number> = {
  '1h': 1, // 1 minute
  '6h': 5, // 5 minutes
  '24h': 15, // 15 minutes
  '7d': 60, // 1 hour
  '30d': 360, // 6 hours
};

/**
 * Time range display labels (Traditional Chinese)
 */
export const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  '1h': '最近 1 小時',
  '6h': '最近 6 小時',
  '24h': '最近 24 小時',
  '7d': '最近 7 天',
  '30d': '最近 30 天',
};

// ============================================================
// Metric Types
// ============================================================

/**
 * Types of performance metrics tracked
 */
export type MetricType =
  | 'api_response_time'
  | 'db_query_time'
  | 'ai_processing_time'
  | 'cpu_usage'
  | 'memory_usage';

/**
 * Percentile types for statistical analysis
 */
export type PercentileType = 'p50' | 'p95' | 'p99' | 'avg';

/**
 * Metric display labels (Traditional Chinese)
 */
export const METRIC_LABELS: Record<MetricType, string> = {
  api_response_time: 'API 回應時間',
  db_query_time: '資料庫查詢時間',
  ai_processing_time: 'AI 處理時間',
  cpu_usage: 'CPU 使用率',
  memory_usage: '記憶體使用率',
};

// ============================================================
// API Performance Types
// ============================================================

/**
 * Input for recording API performance metrics
 */
export interface ApiMetricInput {
  /** HTTP method */
  method: string;
  /** Normalized endpoint (e.g., /api/invoices/{id}) */
  endpoint: string;
  /** Actual request path */
  path: string;
  /** Total response time in ms */
  responseTime: number;
  /** Database query time in ms */
  dbQueryTime?: number;
  /** External API call time in ms */
  externalApiTime?: number;
  /** Business logic processing time in ms */
  processingTime?: number;
  /** HTTP status code */
  statusCode: number;
  /** Response body size in bytes */
  responseSize?: number;
  /** Request body size in bytes */
  requestSize?: number;
  /** User ID if authenticated */
  userId?: string;
  /** City ID for multi-tenancy */
  cityId?: string;
  /** Correlation ID for request tracing */
  correlationId?: string;
}

/**
 * API statistics aggregated data
 */
export interface ApiStats {
  /** 50th percentile response time */
  p50: number;
  /** 95th percentile response time */
  p95: number;
  /** 99th percentile response time */
  p99: number;
  /** Average response time */
  avg: number;
  /** Minimum response time */
  min: number;
  /** Maximum response time */
  max: number;
  /** Total request count */
  count: number;
  /** Error rate percentage (4xx + 5xx) */
  errorRate: number;
}

// ============================================================
// System Resource Types
// ============================================================

/**
 * Input for recording system resource metrics
 */
export interface SystemResourceInput {
  /** Total CPU usage percentage */
  cpuUsage: number;
  /** System CPU usage percentage */
  cpuSystem?: number;
  /** User CPU usage percentage */
  cpuUser?: number;
  /** Memory usage percentage */
  memoryUsage: number;
  /** Used memory in bytes */
  memoryUsed: bigint;
  /** Total memory in bytes */
  memoryTotal: bigint;
  /** Node.js heap used in bytes */
  heapUsed?: bigint;
  /** Node.js heap total in bytes */
  heapTotal?: bigint;
  /** Number of active connections */
  activeConnections?: number;
  /** Event loop lag in ms */
  eventLoopLag?: number;
  /** Disk read bytes */
  diskReadBytes?: bigint;
  /** Disk write bytes */
  diskWriteBytes?: bigint;
}

/**
 * System resource statistics
 */
export interface SystemStats {
  /** Current CPU usage */
  cpuCurrent: number;
  /** Average CPU usage */
  cpuAvg: number;
  /** Maximum CPU usage */
  cpuMax: number;
  /** Current memory usage */
  memoryCurrent: number;
  /** Average memory usage */
  memoryAvg: number;
  /** Maximum memory usage */
  memoryMax: number;
}

// ============================================================
// AI Service Types
// ============================================================

/**
 * AI operation types
 */
export type AiOperationType =
  | 'ocr'
  | 'extraction'
  | 'identification'
  | 'classification'
  | 'validation';

/**
 * Input for recording AI service metrics
 */
export interface AiMetricInput {
  /** Type of AI operation */
  operationType: AiOperationType;
  /** Total processing time in ms */
  totalTime: number;
  /** Time waiting in queue in ms */
  queueTime?: number;
  /** Actual processing time in ms */
  processingTime?: number;
  /** Network transfer time in ms */
  networkTime?: number;
  /** Related document ID */
  documentId?: string;
  /** File size in bytes */
  fileSize?: number;
  /** Number of pages processed */
  pageCount?: number;
  /** Whether operation was successful */
  success: boolean;
  /** Error code if failed */
  errorCode?: string;
  /** Error message if failed */
  errorMessage?: string;
  /** Total tokens used */
  tokensUsed?: number;
  /** Prompt tokens used */
  promptTokens?: number;
  /** Completion tokens used */
  completionTokens?: number;
  /** AI model name */
  modelName?: string;
  /** Estimated cost in USD */
  estimatedCost?: number;
  /** City ID for multi-tenancy */
  cityId?: string;
}

/**
 * AI service statistics
 */
export interface AiStats {
  /** 50th percentile processing time */
  p50: number;
  /** 95th percentile processing time */
  p95: number;
  /** 99th percentile processing time */
  p99: number;
  /** Average processing time */
  avg: number;
  /** Total operation count */
  count: number;
  /** Success rate percentage */
  successRate: number;
  /** Total tokens used */
  totalTokens: number;
  /** Total estimated cost */
  totalCost: number;
}

// ============================================================
// Database Query Types
// ============================================================

/**
 * Database query types
 */
export type QueryType = 'select' | 'insert' | 'update' | 'delete' | 'transaction';

/**
 * Input for recording database query metrics
 */
export interface DbQueryMetricInput {
  /** Type of query */
  queryType: QueryType;
  /** Primary table name */
  tableName?: string;
  /** Query fingerprint for aggregation */
  queryHash?: string;
  /** Execution time in ms */
  executionTime: number;
  /** Query planning time in ms */
  planningTime?: number;
  /** Lock wait time in ms */
  lockWaitTime?: number;
  /** Number of rows affected */
  rowsAffected?: number;
  /** Number of rows returned */
  rowsReturned?: number;
  /** Source API endpoint */
  endpoint?: string;
  /** User ID */
  userId?: string;
  /** Correlation ID for request tracing */
  correlationId?: string;
}

/**
 * Database query statistics
 */
export interface DbStats {
  /** 50th percentile execution time */
  p50: number;
  /** 95th percentile execution time */
  p95: number;
  /** 99th percentile execution time */
  p99: number;
  /** Average execution time */
  avg: number;
  /** Total query count */
  count: number;
}

// ============================================================
// Performance Overview Types
// ============================================================

/**
 * Complete performance overview
 */
export interface PerformanceOverview {
  /** API performance statistics */
  api: ApiStats;
  /** Database performance statistics */
  database: DbStats;
  /** AI service statistics */
  ai: AiStats;
  /** System resource statistics */
  system: SystemStats;
  /** Timestamp of this overview */
  timestamp: Date;
}

// ============================================================
// Time Series Types
// ============================================================

/**
 * Single data point in a time series
 */
export interface TimeSeriesDataPoint {
  /** ISO timestamp */
  timestamp: string;
  /** Metric value */
  value: number;
}

/**
 * Time series response with thresholds
 */
export interface TimeSeriesResponse {
  /** Array of data points */
  data: TimeSeriesDataPoint[];
  /** Metric type */
  metric: MetricType;
  /** Time range queried */
  timeRange: TimeRange;
  /** Optional threshold values */
  thresholds?: {
    warning: number;
    critical: number;
  };
}

// ============================================================
// Slowest Analysis Types
// ============================================================

/**
 * Slowest API endpoint analysis
 */
export interface SlowestEndpoint {
  /** API endpoint path */
  endpoint: string;
  /** HTTP method */
  method: string;
  /** Average response time in ms */
  avgResponseTime: number;
  /** 95th percentile response time in ms */
  p95ResponseTime: number;
  /** Total request count */
  count: number;
  /** Error rate percentage */
  errorRate: number;
  /** Performance trend */
  trend: 'up' | 'down' | 'stable';
}

/**
 * Slowest database query analysis
 */
export interface SlowestQuery {
  /** Query type */
  queryType: string;
  /** Primary table name */
  tableName: string | null;
  /** Average execution time in ms */
  avgExecutionTime: number;
  /** Maximum execution time in ms */
  maxExecutionTime: number;
  /** Total query count */
  count: number;
}

/**
 * Slowest AI operation analysis
 */
export interface SlowestAiOperation {
  /** Operation type */
  operationType: string;
  /** Average processing time in ms */
  avgProcessingTime: number;
  /** 95th percentile processing time in ms */
  p95ProcessingTime: number;
  /** Total operation count */
  count: number;
  /** Success rate percentage */
  successRate: number;
}

// ============================================================
// Threshold Configuration Types
// ============================================================

/**
 * Performance threshold configuration
 */
export interface PerformanceThresholdConfig {
  /** Metric type */
  metricType: MetricType;
  /** Display name */
  metricName: string;
  /** Warning threshold value */
  warningThreshold: number;
  /** Critical threshold value */
  criticalThreshold: number;
  /** Unit of measurement */
  unit: 'ms' | 'percent' | 'count';
  /** Optional description */
  description?: string;
  /** Whether this threshold is enabled */
  isEnabled: boolean;
}

/**
 * Default performance thresholds
 */
export const DEFAULT_THRESHOLDS: Record<MetricType, { warning: number; critical: number }> = {
  api_response_time: { warning: 200, critical: 500 },
  db_query_time: { warning: 50, critical: 200 },
  ai_processing_time: { warning: 5000, critical: 15000 },
  cpu_usage: { warning: 70, critical: 90 },
  memory_usage: { warning: 80, critical: 90 },
};

// ============================================================
// Export Types
// ============================================================

/**
 * Export format options
 */
export type ExportFormat = 'csv' | 'json';

/**
 * Export options
 */
export interface ExportOptions {
  /** Metric to export */
  metric: MetricType;
  /** Time range to export */
  timeRange: TimeRange;
  /** Export format */
  format: ExportFormat;
  /** Include CSV headers */
  includeHeaders?: boolean;
}

/**
 * Export result
 */
export interface ExportResult {
  /** File content */
  content: string;
  /** Suggested filename */
  filename: string;
  /** MIME type */
  mimeType: string;
  /** Number of records exported */
  recordCount: number;
}

// ============================================================
// Collector Types
// ============================================================

/**
 * Buffered metric for batch processing
 */
export interface BufferedMetric<T> {
  /** Metric type */
  type: 'api' | 'system' | 'ai' | 'database';
  /** Metric data */
  data: T;
  /** Timestamp when recorded */
  timestamp: Date;
}

/**
 * Collector configuration
 */
export interface CollectorConfig {
  /** Flush interval in milliseconds */
  flushIntervalMs: number;
  /** Maximum buffer size before forced flush */
  maxBufferSize: number;
  /** Number of retry attempts */
  retryAttempts: number;
  /** Delay between retries in milliseconds */
  retryDelayMs: number;
}

/**
 * Collector statistics
 */
export interface CollectorStats {
  /** Current buffered count */
  bufferedCount: number;
  /** Total flushed count */
  flushedCount: number;
  /** Total failed count */
  failedCount: number;
  /** Last flush timestamp */
  lastFlushTime: Date | null;
  /** Average flush duration in ms */
  averageFlushDuration: number;
}

// ============================================================
// API Response Types
// ============================================================

/**
 * GET /api/admin/performance response
 */
export interface GetPerformanceOverviewResponse {
  success: true;
  data: PerformanceOverview;
}

/**
 * GET /api/admin/performance/timeseries response
 */
export interface GetTimeSeriesResponse {
  success: true;
  data: TimeSeriesDataPoint[];
  metric: MetricType;
  timeRange: TimeRange;
  thresholds?: {
    warning: number;
    critical: number;
  };
}

/**
 * GET /api/admin/performance/slowest response
 */
export interface GetSlowestResponse {
  success: true;
  data: {
    endpoints?: SlowestEndpoint[];
    queries?: SlowestQuery[];
    operations?: SlowestAiOperation[];
  };
  timeRange: TimeRange;
  generatedAt: string;
}

// ============================================================
// UI Helper Types
// ============================================================

/**
 * Metric card status
 */
export type MetricStatus = 'normal' | 'warning' | 'critical';

/**
 * Performance trend direction
 */
export type TrendDirection = 'up' | 'down' | 'stable';

/**
 * Get metric status based on value and thresholds
 */
export function getMetricStatus(
  value: number,
  thresholds: { warning: number; critical: number }
): MetricStatus {
  if (value >= thresholds.critical) return 'critical';
  if (value >= thresholds.warning) return 'warning';
  return 'normal';
}

/**
 * Format milliseconds for display
 */
export function formatMs(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  return `${ms.toFixed(0)}ms`;
}

/**
 * Format percentage for display
 */
export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Status color mapping for UI
 */
export const METRIC_STATUS_COLORS: Record<MetricStatus, string> = {
  normal: 'bg-green-100 text-green-700 border-green-200',
  warning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  critical: 'bg-red-100 text-red-700 border-red-200',
};

/**
 * Trend icons
 */
export const TREND_ICONS: Record<TrendDirection, string> = {
  up: '↑',
  down: '↓',
  stable: '→',
};

/**
 * Trend colors
 */
export const TREND_COLORS: Record<TrendDirection, string> = {
  up: 'text-red-500',
  down: 'text-green-500',
  stable: 'text-gray-500',
};
