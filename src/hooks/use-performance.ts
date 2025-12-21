/**
 * @fileoverview Performance Monitoring Hooks
 * @description
 *   React Query hooks for performance monitoring data fetching:
 *   - usePerformanceOverview - 效能概覽
 *   - usePerformanceTimeSeries - 時間序列數據
 *   - useSlowestEndpoints - 最慢端點分析
 *   - useSlowestQueries - 最慢查詢分析
 *   - useSlowestAiOperations - 最慢 AI 操作分析
 *   - usePerformanceExport - 數據匯出
 *
 * @module src/hooks/use-performance
 * @since Epic 12 - Story 12-2
 * @lastModified 2025-12-21
 *
 * @dependencies
 *   - @tanstack/react-query - React Query
 *   - @/types/performance - 效能類型定義
 */

import { useQuery, useMutation } from '@tanstack/react-query';
import type {
  TimeRange,
  MetricType,
  PerformanceOverview,
  TimeSeriesDataPoint,
  SlowestEndpoint,
  SlowestQuery,
  SlowestAiOperation,
  ExportFormat,
} from '@/types/performance';

// ============================================================
// Query Keys
// ============================================================

export const performanceKeys = {
  all: ['performance'] as const,
  overview: (timeRange: TimeRange, cityId?: string) =>
    [...performanceKeys.all, 'overview', timeRange, cityId] as const,
  timeSeries: (metric: MetricType, timeRange: TimeRange, options?: { endpoint?: string; cityId?: string }) =>
    [...performanceKeys.all, 'timeSeries', metric, timeRange, options] as const,
  slowest: (type: 'endpoints' | 'queries' | 'operations' | 'all', timeRange: TimeRange, cityId?: string) =>
    [...performanceKeys.all, 'slowest', type, timeRange, cityId] as const,
};

// ============================================================
// API Functions
// ============================================================

async function fetchPerformanceOverview(
  timeRange: TimeRange,
  cityId?: string
): Promise<PerformanceOverview> {
  const params = new URLSearchParams({ range: timeRange });
  if (cityId) params.set('cityId', cityId);

  const response = await fetch(`/api/admin/performance?${params}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to fetch performance overview');
  }

  const data = await response.json();
  return data.data;
}

async function fetchTimeSeries(
  metric: MetricType,
  timeRange: TimeRange,
  options?: { endpoint?: string; cityId?: string }
): Promise<{
  data: TimeSeriesDataPoint[];
  thresholds?: { warning: number; critical: number };
}> {
  const params = new URLSearchParams({
    metric,
    range: timeRange,
  });
  if (options?.endpoint) params.set('endpoint', options.endpoint);
  if (options?.cityId) params.set('cityId', options.cityId);

  const response = await fetch(`/api/admin/performance/timeseries?${params}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to fetch time series data');
  }

  const result = await response.json();
  return {
    data: result.data,
    thresholds: result.thresholds,
  };
}

async function fetchSlowestEndpoints(
  timeRange: TimeRange,
  limit: number = 10,
  cityId?: string
): Promise<SlowestEndpoint[]> {
  const params = new URLSearchParams({
    type: 'endpoints',
    range: timeRange,
    limit: limit.toString(),
  });
  if (cityId) params.set('cityId', cityId);

  const response = await fetch(`/api/admin/performance/slowest?${params}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to fetch slowest endpoints');
  }

  const data = await response.json();
  return data.data.endpoints || [];
}

async function fetchSlowestQueries(
  timeRange: TimeRange,
  limit: number = 10
): Promise<SlowestQuery[]> {
  const params = new URLSearchParams({
    type: 'queries',
    range: timeRange,
    limit: limit.toString(),
  });

  const response = await fetch(`/api/admin/performance/slowest?${params}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to fetch slowest queries');
  }

  const data = await response.json();
  return data.data.queries || [];
}

async function fetchSlowestAiOperations(
  timeRange: TimeRange,
  limit: number = 10,
  cityId?: string
): Promise<SlowestAiOperation[]> {
  const params = new URLSearchParams({
    type: 'operations',
    range: timeRange,
    limit: limit.toString(),
  });
  if (cityId) params.set('cityId', cityId);

  const response = await fetch(`/api/admin/performance/slowest?${params}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to fetch slowest AI operations');
  }

  const data = await response.json();
  return data.data.operations || [];
}

async function exportPerformanceData(
  metric: MetricType,
  timeRange: TimeRange,
  format: ExportFormat = 'csv'
): Promise<Blob> {
  const params = new URLSearchParams({
    metric,
    range: timeRange,
    format,
  });

  const response = await fetch(`/api/admin/performance/export?${params}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to export performance data');
  }

  return response.blob();
}

// ============================================================
// Hooks
// ============================================================

/**
 * Hook for fetching performance overview
 *
 * @param timeRange - Time range for data
 * @param cityId - Optional city filter
 * @param options - Query options
 */
export function usePerformanceOverview(
  timeRange: TimeRange,
  cityId?: string,
  options?: {
    enabled?: boolean;
    refetchInterval?: number;
  }
) {
  return useQuery({
    queryKey: performanceKeys.overview(timeRange, cityId),
    queryFn: () => fetchPerformanceOverview(timeRange, cityId),
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchInterval,
    staleTime: 10000, // 10 seconds
  });
}

/**
 * Hook for fetching performance time series data
 *
 * @param metric - Metric type
 * @param timeRange - Time range
 * @param options - Query and filter options
 */
export function usePerformanceTimeSeries(
  metric: MetricType,
  timeRange: TimeRange,
  options?: {
    endpoint?: string;
    cityId?: string;
    enabled?: boolean;
    refetchInterval?: number;
  }
) {
  return useQuery({
    queryKey: performanceKeys.timeSeries(metric, timeRange, {
      endpoint: options?.endpoint,
      cityId: options?.cityId,
    }),
    queryFn: () =>
      fetchTimeSeries(metric, timeRange, {
        endpoint: options?.endpoint,
        cityId: options?.cityId,
      }),
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchInterval,
    staleTime: 10000, // 10 seconds
  });
}

/**
 * Hook for fetching slowest endpoints
 *
 * @param timeRange - Time range
 * @param limit - Number of results
 * @param cityId - Optional city filter
 * @param options - Query options
 */
export function useSlowestEndpoints(
  timeRange: TimeRange,
  limit: number = 10,
  cityId?: string,
  options?: {
    enabled?: boolean;
    refetchInterval?: number;
  }
) {
  return useQuery({
    queryKey: performanceKeys.slowest('endpoints', timeRange, cityId),
    queryFn: () => fetchSlowestEndpoints(timeRange, limit, cityId),
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchInterval,
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Hook for fetching slowest database queries
 *
 * @param timeRange - Time range
 * @param limit - Number of results
 * @param options - Query options
 */
export function useSlowestQueries(
  timeRange: TimeRange,
  limit: number = 10,
  options?: {
    enabled?: boolean;
    refetchInterval?: number;
  }
) {
  return useQuery({
    queryKey: performanceKeys.slowest('queries', timeRange),
    queryFn: () => fetchSlowestQueries(timeRange, limit),
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchInterval,
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Hook for fetching slowest AI operations
 *
 * @param timeRange - Time range
 * @param limit - Number of results
 * @param cityId - Optional city filter
 * @param options - Query options
 */
export function useSlowestAiOperations(
  timeRange: TimeRange,
  limit: number = 10,
  cityId?: string,
  options?: {
    enabled?: boolean;
    refetchInterval?: number;
  }
) {
  return useQuery({
    queryKey: performanceKeys.slowest('operations', timeRange, cityId),
    queryFn: () => fetchSlowestAiOperations(timeRange, limit, cityId),
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchInterval,
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Hook for exporting performance data
 *
 * @returns Mutation for triggering export and download
 */
export function usePerformanceExport() {
  return useMutation({
    mutationFn: async ({
      metric,
      timeRange,
      format = 'csv',
    }: {
      metric: MetricType;
      timeRange: TimeRange;
      format?: ExportFormat;
    }) => {
      const blob = await exportPerformanceData(metric, timeRange, format);

      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `performance_${metric}_${timeRange}_${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return blob;
    },
  });
}

// ============================================================
// Combined Hook for Dashboard
// ============================================================

/**
 * Combined hook for performance dashboard data
 *
 * @param timeRange - Time range
 * @param cityId - Optional city filter
 * @param autoRefresh - Enable auto refresh (30s interval)
 */
export function usePerformanceDashboard(
  timeRange: TimeRange,
  cityId?: string,
  autoRefresh: boolean = true
) {
  const refetchInterval = autoRefresh ? 30000 : undefined;

  const overview = usePerformanceOverview(timeRange, cityId, { refetchInterval });
  const apiTimeSeries = usePerformanceTimeSeries('api_response_time', timeRange, {
    cityId,
    refetchInterval,
  });
  const cpuTimeSeries = usePerformanceTimeSeries('cpu_usage', timeRange, {
    refetchInterval,
  });
  const memoryTimeSeries = usePerformanceTimeSeries('memory_usage', timeRange, {
    refetchInterval,
  });
  const slowestEndpoints = useSlowestEndpoints(timeRange, 10, cityId, {
    refetchInterval,
  });
  const exportMutation = usePerformanceExport();

  const isLoading =
    overview.isLoading ||
    apiTimeSeries.isLoading ||
    cpuTimeSeries.isLoading ||
    memoryTimeSeries.isLoading ||
    slowestEndpoints.isLoading;

  const isError =
    overview.isError ||
    apiTimeSeries.isError ||
    cpuTimeSeries.isError ||
    memoryTimeSeries.isError ||
    slowestEndpoints.isError;

  const refetchAll = () => {
    overview.refetch();
    apiTimeSeries.refetch();
    cpuTimeSeries.refetch();
    memoryTimeSeries.refetch();
    slowestEndpoints.refetch();
  };

  return {
    overview: overview.data,
    apiTimeSeries: apiTimeSeries.data,
    cpuTimeSeries: cpuTimeSeries.data,
    memoryTimeSeries: memoryTimeSeries.data,
    slowestEndpoints: slowestEndpoints.data,
    isLoading,
    isError,
    refetchAll,
    exportData: exportMutation.mutate,
    isExporting: exportMutation.isPending,
  };
}
