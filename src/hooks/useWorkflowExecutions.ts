'use client';

/**
 * @fileoverview 工作流執行 React Query Hooks
 * @description
 *   提供工作流執行狀態視圖的數據獲取功能：
 *   - useWorkflowExecutions: 獲取執行列表
 *   - useWorkflowExecutionDetail: 獲取執行詳情
 *   - useRunningExecutions: 獲取執行中工作流（支援輪詢）
 *   - useExecutionStats: 獲取執行統計
 *
 *   特性：
 *   - 支援分頁和篩選
 *   - 執行中狀態輪詢（3-5 秒間隔）
 *   - 視窗聚焦時刷新
 *   - 城市數據隔離
 *
 * @module src/hooks/useWorkflowExecutions
 * @since Epic 10 - Story 10.3 (Workflow Execution Status View)
 * @lastModified 2025-12-20
 *
 * @dependencies
 *   - @tanstack/react-query - React Query
 *   - @/types/workflow-execution - 類型定義
 *
 * @related
 *   - src/app/api/workflow-executions/ - API 端點
 *   - src/services/n8n/workflow-execution.service.ts - 服務層
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ExecutionSummary,
  ExecutionDetail,
  ExecutionStats,
  ExecutionListResponse,
  ExecutionDetailResponse,
  RunningExecutionsResponse,
  ExecutionStatsResponse,
  ExecutionFilterValues,
  WorkflowExecutionStatus,
  WorkflowTriggerType,
} from '@/types/workflow-execution';

// ============================================================
// Types
// ============================================================

/**
 * 執行列表查詢參數
 */
export interface ExecutionsQueryParams {
  /** 頁碼 */
  page?: number;
  /** 每頁數量 */
  pageSize?: number;
  /** 執行狀態篩選 */
  status?: WorkflowExecutionStatus | '';
  /** 觸發類型篩選 */
  triggerType?: WorkflowTriggerType | '';
  /** 工作流名稱搜尋 */
  workflowName?: string;
  /** 開始日期 */
  startDate?: Date | null;
  /** 結束日期 */
  endDate?: Date | null;
  /** 排序欄位 */
  orderBy?: 'startedAt' | 'createdAt' | 'completedAt';
  /** 排序方向 */
  orderDirection?: 'asc' | 'desc';
}

/**
 * 統計查詢參數
 */
export interface StatsQueryParams {
  /** 開始日期 */
  startDate?: Date | null;
  /** 結束日期 */
  endDate?: Date | null;
}

/**
 * 分頁資訊
 */
export interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/**
 * 執行列表結果
 */
export interface ExecutionsResult {
  data: ExecutionSummary[];
  pagination: PaginationInfo;
}

// ============================================================
// API Clients
// ============================================================

/**
 * 獲取執行列表
 */
async function fetchExecutions(
  params: ExecutionsQueryParams
): Promise<ExecutionsResult> {
  const searchParams = new URLSearchParams();

  if (params.page) searchParams.set('page', params.page.toString());
  if (params.pageSize) searchParams.set('pageSize', params.pageSize.toString());
  if (params.status) searchParams.set('status', params.status);
  if (params.triggerType) searchParams.set('triggerType', params.triggerType);
  if (params.workflowName) searchParams.set('workflowName', params.workflowName);
  if (params.startDate) {
    searchParams.set('startDate', params.startDate.toISOString());
  }
  if (params.endDate) {
    searchParams.set('endDate', params.endDate.toISOString());
  }
  if (params.orderBy) searchParams.set('orderBy', params.orderBy);
  if (params.orderDirection) searchParams.set('orderDirection', params.orderDirection);

  const queryString = searchParams.toString();
  const url = queryString
    ? `/api/workflow-executions?${queryString}`
    : '/api/workflow-executions';

  const response = await fetch(url);
  const result: ExecutionListResponse | { success: false; error: string } =
    await response.json();

  if ('success' in result && !result.success) {
    throw new Error(result.error || '獲取執行列表失敗');
  }

  return result as ExecutionsResult;
}

/**
 * 獲取執行詳情
 */
async function fetchExecutionDetail(id: string): Promise<ExecutionDetail> {
  const response = await fetch(`/api/workflow-executions/${id}`);
  const result: ExecutionDetailResponse | { success: false; error: string } =
    await response.json();

  if ('success' in result && !result.success) {
    throw new Error(result.error || '獲取執行詳情失敗');
  }

  return (result as ExecutionDetailResponse).data;
}

/**
 * 獲取執行中工作流
 */
async function fetchRunningExecutions(): Promise<ExecutionSummary[]> {
  const response = await fetch('/api/workflow-executions/running');
  const result: RunningExecutionsResponse | { success: false; error: string } =
    await response.json();

  if ('success' in result && !result.success) {
    throw new Error(result.error || '獲取執行中工作流失敗');
  }

  return (result as RunningExecutionsResponse).data;
}

/**
 * 獲取執行統計
 */
async function fetchExecutionStats(
  params: StatsQueryParams
): Promise<ExecutionStats> {
  const searchParams = new URLSearchParams();

  if (params.startDate) {
    searchParams.set('startDate', params.startDate.toISOString());
  }
  if (params.endDate) {
    searchParams.set('endDate', params.endDate.toISOString());
  }

  const queryString = searchParams.toString();
  const url = queryString
    ? `/api/workflow-executions/stats?${queryString}`
    : '/api/workflow-executions/stats';

  const response = await fetch(url);
  const result: ExecutionStatsResponse | { success: false; error: string } =
    await response.json();

  if ('success' in result && !result.success) {
    throw new Error(result.error || '獲取執行統計失敗');
  }

  return (result as ExecutionStatsResponse).data;
}

// ============================================================
// Query Keys
// ============================================================

export const workflowExecutionKeys = {
  all: ['workflowExecutions'] as const,
  lists: () => [...workflowExecutionKeys.all, 'list'] as const,
  list: (params: ExecutionsQueryParams) =>
    [...workflowExecutionKeys.lists(), params] as const,
  details: () => [...workflowExecutionKeys.all, 'detail'] as const,
  detail: (id: string) => [...workflowExecutionKeys.details(), id] as const,
  running: () => [...workflowExecutionKeys.all, 'running'] as const,
  stats: (params: StatsQueryParams) =>
    [...workflowExecutionKeys.all, 'stats', params] as const,
};

// ============================================================
// Hooks
// ============================================================

/**
 * 工作流執行列表 Hook
 *
 * @param params - 查詢參數
 * @returns React Query 結果
 *
 * @example
 * ```typescript
 * const { data, isLoading, error } = useWorkflowExecutions({
 *   page: 1,
 *   pageSize: 20,
 *   status: 'RUNNING',
 * })
 * ```
 */
export function useWorkflowExecutions(params: ExecutionsQueryParams = {}) {
  const queryParams: ExecutionsQueryParams = {
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 20,
    status: params.status || undefined,
    triggerType: params.triggerType || undefined,
    workflowName: params.workflowName,
    startDate: params.startDate,
    endDate: params.endDate,
    orderBy: params.orderBy ?? 'startedAt',
    orderDirection: params.orderDirection ?? 'desc',
  };

  return useQuery({
    queryKey: workflowExecutionKeys.list(queryParams),
    queryFn: () => fetchExecutions(queryParams),
    staleTime: 30 * 1000, // 30 秒後標記為過時
    refetchOnWindowFocus: true,
    retry: 2,
  });
}

/**
 * 工作流執行詳情 Hook
 *
 * @param id - 執行 ID
 * @returns React Query 結果
 *
 * @example
 * ```typescript
 * const { data, isLoading, error } = useWorkflowExecutionDetail('exec-123')
 * ```
 */
export function useWorkflowExecutionDetail(id: string | null | undefined) {
  return useQuery({
    queryKey: workflowExecutionKeys.detail(id ?? ''),
    queryFn: () => fetchExecutionDetail(id!),
    enabled: !!id,
    staleTime: 10 * 1000, // 10 秒後標記為過時
    refetchOnWindowFocus: true,
    retry: 2,
  });
}

/**
 * 執行中工作流 Hook（支援輪詢）
 *
 * @param options - 選項
 * @param options.enabled - 是否啟用
 * @param options.refetchInterval - 輪詢間隔（毫秒，預設 5000）
 * @returns React Query 結果
 *
 * @example
 * ```typescript
 * // 每 3 秒輪詢
 * const { data, isLoading } = useRunningExecutions({
 *   refetchInterval: 3000,
 * })
 * ```
 */
export function useRunningExecutions(
  options: {
    enabled?: boolean;
    refetchInterval?: number;
  } = {}
) {
  const { enabled = true, refetchInterval = 5000 } = options;

  return useQuery({
    queryKey: workflowExecutionKeys.running(),
    queryFn: fetchRunningExecutions,
    enabled,
    staleTime: 0, // 始終視為過時以確保即時性
    refetchInterval, // 輪詢間隔
    refetchIntervalInBackground: false, // 背景時不輪詢
    refetchOnWindowFocus: true,
    retry: 1,
  });
}

/**
 * 執行統計 Hook
 *
 * @param params - 查詢參數
 * @returns React Query 結果
 *
 * @example
 * ```typescript
 * const { data, isLoading } = useExecutionStats({
 *   startDate: new Date('2025-01-01'),
 *   endDate: new Date('2025-01-31'),
 * })
 * ```
 */
export function useExecutionStats(params: StatsQueryParams = {}) {
  return useQuery({
    queryKey: workflowExecutionKeys.stats(params),
    queryFn: () => fetchExecutionStats(params),
    staleTime: 60 * 1000, // 1 分鐘後標記為過時
    refetchOnWindowFocus: true,
    retry: 2,
  });
}

/**
 * 刷新工作流執行數據 Hook
 *
 * @returns 刷新函數集合
 *
 * @example
 * ```typescript
 * const { refreshList, refreshRunning, refreshAll } = useRefreshWorkflowExecutions()
 * // 刷新列表
 * refreshList()
 * // 刷新所有
 * refreshAll()
 * ```
 */
export function useRefreshWorkflowExecutions() {
  const queryClient = useQueryClient();

  return {
    /** 刷新列表 */
    refreshList: () => {
      queryClient.invalidateQueries({
        queryKey: workflowExecutionKeys.lists(),
      });
    },
    /** 刷新詳情 */
    refreshDetail: (id: string) => {
      queryClient.invalidateQueries({
        queryKey: workflowExecutionKeys.detail(id),
      });
    },
    /** 刷新執行中 */
    refreshRunning: () => {
      queryClient.invalidateQueries({
        queryKey: workflowExecutionKeys.running(),
      });
    },
    /** 刷新統計 */
    refreshStats: () => {
      queryClient.invalidateQueries({
        queryKey: [...workflowExecutionKeys.all, 'stats'],
      });
    },
    /** 刷新所有 */
    refreshAll: () => {
      queryClient.invalidateQueries({
        queryKey: workflowExecutionKeys.all,
      });
    },
  };
}

/**
 * 從篩選值轉換為查詢參數
 *
 * @param filters - 篩選值
 * @param page - 頁碼
 * @param pageSize - 每頁數量
 * @returns 查詢參數
 */
export function filtersToParams(
  filters: ExecutionFilterValues,
  page: number = 1,
  pageSize: number = 20
): ExecutionsQueryParams {
  return {
    page,
    pageSize,
    status: filters.status || undefined,
    triggerType: filters.triggerType || undefined,
    workflowName: filters.workflowName,
    startDate: filters.startDate,
    endDate: filters.endDate,
  };
}
