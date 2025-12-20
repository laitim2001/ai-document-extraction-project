'use client';

/**
 * @fileoverview 工作流錯誤 React Query Hooks
 * @description
 *   提供工作流錯誤診斷的數據獲取功能：
 *   - useWorkflowErrorDetail: 獲取錯誤詳情
 *   - useErrorStatistics: 獲取錯誤統計
 *
 *   特性：
 *   - 錯誤詳情快取（1 分鐘）
 *   - 統計數據快取（5 分鐘）
 *   - 城市數據隔離
 *
 * @module src/hooks/useWorkflowError
 * @since Epic 10 - Story 10.5 (Workflow Error Detail View)
 * @lastModified 2025-12-20
 *
 * @dependencies
 *   - @tanstack/react-query - React Query
 *   - @/types/workflow-error - 類型定義
 *
 * @related
 *   - src/app/api/workflows/executions/[id]/error/ - 錯誤詳情 API
 *   - src/app/api/workflow-errors/statistics/ - 錯誤統計 API
 *   - src/services/n8n/workflow-error.service.ts - 服務層
 */

import { useQuery } from '@tanstack/react-query';
import type { ErrorDetailResponse, ErrorStatistics } from '@/types/workflow-error';

// ============================================================
// Types
// ============================================================

/**
 * 錯誤詳情查詢選項
 */
export interface WorkflowErrorDetailOptions {
  /** 是否啟用查詢 */
  enabled?: boolean;
}

/**
 * 錯誤統計查詢選項
 */
export interface ErrorStatisticsOptions {
  /** 城市代碼 */
  cityCode?: string;
  /** 開始日期 */
  startDate?: Date;
  /** 結束日期 */
  endDate?: Date;
  /** 是否啟用查詢 */
  enabled?: boolean;
}

/**
 * API 錯誤響應
 */
interface ApiErrorResponse {
  success: false;
  error: string;
  code?: string;
}

/**
 * 成功響應（錯誤詳情）
 */
interface ErrorDetailApiResponse {
  data: ErrorDetailResponse;
}

/**
 * 成功響應（統計）
 */
interface ErrorStatisticsApiResponse {
  data: ErrorStatistics;
}

// ============================================================
// Query Keys
// ============================================================

/**
 * 工作流錯誤查詢鍵
 */
export const workflowErrorKeys = {
  all: ['workflow-error'] as const,
  details: () => [...workflowErrorKeys.all, 'detail'] as const,
  detail: (executionId: string) => [...workflowErrorKeys.details(), executionId] as const,
  statistics: () => [...workflowErrorKeys.all, 'statistics'] as const,
  statistic: (cityCode?: string, startDate?: string, endDate?: string) =>
    [...workflowErrorKeys.statistics(), { cityCode, startDate, endDate }] as const,
};

// ============================================================
// API Clients
// ============================================================

/**
 * 獲取錯誤詳情
 *
 * @param executionId - 執行記錄 ID
 * @returns 錯誤詳情
 */
async function fetchErrorDetail(executionId: string): Promise<ErrorDetailResponse> {
  const response = await fetch(`/api/workflows/executions/${executionId}/error`);
  const result = await response.json();

  if (!response.ok) {
    const errorResponse = result as ApiErrorResponse;
    throw new Error(errorResponse.error || '獲取錯誤詳情失敗');
  }

  return (result as ErrorDetailApiResponse).data;
}

/**
 * 獲取錯誤統計
 *
 * @param options - 統計選項
 * @returns 錯誤統計
 */
async function fetchErrorStatistics(options: {
  cityCode?: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<ErrorStatistics> {
  const params = new URLSearchParams();

  if (options.cityCode) {
    params.set('cityCode', options.cityCode);
  }
  if (options.startDate) {
    params.set('startDate', options.startDate.toISOString());
  }
  if (options.endDate) {
    params.set('endDate', options.endDate.toISOString());
  }

  const url = `/api/workflow-errors/statistics${params.toString() ? `?${params}` : ''}`;
  const response = await fetch(url);
  const result = await response.json();

  if (!response.ok) {
    const errorResponse = result as ApiErrorResponse;
    throw new Error(errorResponse.error || '獲取錯誤統計失敗');
  }

  return (result as ErrorStatisticsApiResponse).data;
}

// ============================================================
// Hooks
// ============================================================

/**
 * 獲取工作流錯誤詳情
 *
 * @description
 *   使用此 Hook 獲取工作流執行的錯誤詳細資訊。
 *   只有當 executionId 有效且 enabled 為 true 時才會執行查詢。
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useWorkflowErrorDetail('exec-123');
 *
 * if (isLoading) return <Loading />;
 * if (error) return <Error message={error.message} />;
 *
 * return (
 *   <WorkflowErrorDetail
 *     executionId={data.execution.id}
 *     error={data.error}
 *     execution={data.execution}
 *     documents={data.documents}
 *     canRetry={data.canRetry}
 *     n8nUrl={data.n8nUrl}
 *     onRetry={handleRetry}
 *   />
 * );
 * ```
 *
 * @param executionId - 執行記錄 ID（可為 null 以暫時禁用查詢）
 * @param options - 查詢選項
 * @returns React Query 查詢結果
 */
export function useWorkflowErrorDetail(
  executionId: string | null,
  options: WorkflowErrorDetailOptions = {}
) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: workflowErrorKeys.detail(executionId ?? ''),
    queryFn: () => fetchErrorDetail(executionId!),
    enabled: enabled && !!executionId,
    staleTime: 60000, // 1 分鐘
    retry: false,
  });
}

/**
 * 獲取錯誤統計
 *
 * @description
 *   使用此 Hook 獲取工作流錯誤的統計資訊。
 *   支援按城市和時間範圍篩選。
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useErrorStatistics({
 *   cityCode: 'TPE',
 *   startDate: new Date('2025-01-01'),
 *   endDate: new Date('2025-12-31'),
 * });
 *
 * if (isLoading) return <Loading />;
 * if (error) return <Error message={error.message} />;
 *
 * return (
 *   <ErrorStatisticsCard statistics={data} />
 * );
 * ```
 *
 * @param options - 統計選項（城市、時間範圍、啟用狀態）
 * @returns React Query 查詢結果
 */
export function useErrorStatistics(options: ErrorStatisticsOptions = {}) {
  const { enabled = true, cityCode, startDate, endDate } = options;

  return useQuery({
    queryKey: workflowErrorKeys.statistic(
      cityCode,
      startDate?.toISOString(),
      endDate?.toISOString()
    ),
    queryFn: () => fetchErrorStatistics({ cityCode, startDate, endDate }),
    enabled,
    staleTime: 300000, // 5 分鐘
  });
}
