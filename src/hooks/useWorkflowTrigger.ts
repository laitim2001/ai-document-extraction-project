'use client';

/**
 * @fileoverview 工作流觸發 React Query Hooks
 * @description
 *   提供手動觸發工作流的數據獲取和操作功能：
 *   - useTriggerableWorkflows: 獲取可觸發工作流列表
 *   - useTriggerWorkflow: 觸發工作流 Mutation
 *   - useRetryWorkflow: 重試工作流 Mutation
 *   - useCancelExecution: 取消執行 Mutation
 *
 *   特性：
 *   - 可觸發工作流列表快取（1 分鐘）
 *   - 觸發後自動刷新執行列表
 *   - 城市數據隔離
 *
 * @module src/hooks/useWorkflowTrigger
 * @since Epic 10 - Story 10.4 (Manual Trigger Workflow)
 * @lastModified 2025-12-20
 *
 * @dependencies
 *   - @tanstack/react-query - React Query
 *   - @/types/workflow-trigger - 類型定義
 *
 * @related
 *   - src/app/api/workflows/triggerable/ - 可觸發工作流 API
 *   - src/app/api/workflows/trigger/ - 觸發工作流 API
 *   - src/services/n8n/workflow-trigger.service.ts - 服務層
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  TriggerableWorkflow,
  TriggerableWorkflowsResponse,
  TriggerWorkflowResponse,
  RetryWorkflowResponse,
  CancelExecutionResponse,
  TriggerWorkflowRequest,
} from '@/types/workflow-trigger';

// ============================================================
// Types
// ============================================================

/**
 * 可觸發工作流查詢選項
 */
export interface TriggerableWorkflowsOptions {
  /** 是否啟用查詢 */
  enabled?: boolean;
  /** 分類篩選 */
  category?: string;
}

/**
 * API 錯誤響應
 */
interface ApiErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: unknown;
}

// ============================================================
// Query Keys
// ============================================================

export const workflowTriggerKeys = {
  all: ['workflow-trigger'] as const,
  triggerableList: () => [...workflowTriggerKeys.all, 'triggerable'] as const,
  triggerable: (cityCode: string, category?: string) =>
    [...workflowTriggerKeys.triggerableList(), { cityCode, category }] as const,
};

// ============================================================
// API Clients
// ============================================================

/**
 * 獲取可觸發工作流列表
 */
async function fetchTriggerableWorkflows(
  cityCode: string,
  category?: string
): Promise<TriggerableWorkflow[]> {
  const params = new URLSearchParams({ cityCode });
  if (category) params.set('category', category);

  const response = await fetch(`/api/workflows/triggerable?${params}`);
  const result = await response.json();

  if (!response.ok) {
    const errorResponse = result as ApiErrorResponse;
    throw new Error(errorResponse.error || '獲取可觸發工作流失敗');
  }

  return (result as TriggerableWorkflowsResponse).data;
}

/**
 * 觸發工作流
 */
async function triggerWorkflow(
  input: TriggerWorkflowRequest
): Promise<TriggerWorkflowResponse['data']> {
  const response = await fetch('/api/workflows/trigger', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  const result = await response.json();

  if (!response.ok) {
    const errorResponse = result as ApiErrorResponse;
    throw new Error(errorResponse.error || '觸發工作流失敗');
  }

  return result.data;
}

/**
 * 重試工作流
 */
async function retryWorkflow(
  executionId: string
): Promise<RetryWorkflowResponse['data']> {
  const response = await fetch(`/api/workflows/executions/${executionId}/retry`, {
    method: 'POST',
  });

  const result = await response.json();

  if (!response.ok) {
    const errorResponse = result as ApiErrorResponse;
    throw new Error(errorResponse.error || '重試工作流失敗');
  }

  return result.data;
}

/**
 * 取消執行
 */
async function cancelExecution(
  executionId: string
): Promise<CancelExecutionResponse['data']> {
  const response = await fetch(`/api/workflows/executions/${executionId}/cancel`, {
    method: 'POST',
  });

  const result = await response.json();

  if (!response.ok) {
    const errorResponse = result as ApiErrorResponse;
    throw new Error(errorResponse.error || '取消執行失敗');
  }

  return result.data;
}

// ============================================================
// Hooks - Queries
// ============================================================

/**
 * 可觸發工作流列表 Hook
 *
 * @description
 *   獲取用戶可手動觸發的工作流列表，根據城市和角色權限過濾。
 *
 * @param cityCode - 城市代碼
 * @param options - 查詢選項
 * @returns React Query 結果
 *
 * @example
 * ```typescript
 * const { data, isLoading, error } = useTriggerableWorkflows('HKG', {
 *   category: 'document-processing',
 * })
 * ```
 */
export function useTriggerableWorkflows(
  cityCode: string,
  options: TriggerableWorkflowsOptions = {}
) {
  const { enabled = true, category } = options;

  return useQuery({
    queryKey: workflowTriggerKeys.triggerable(cityCode, category),
    queryFn: () => fetchTriggerableWorkflows(cityCode, category),
    enabled: enabled && !!cityCode,
    staleTime: 60 * 1000, // 1 分鐘後標記為過時
    refetchOnWindowFocus: true,
    retry: 2,
  });
}

// ============================================================
// Hooks - Mutations
// ============================================================

/**
 * 觸發工作流 Mutation Hook
 *
 * @description
 *   手動觸發 n8n 工作流執行，成功後自動刷新執行列表。
 *
 * @returns React Query Mutation 結果
 *
 * @example
 * ```typescript
 * const { mutate, isPending, error } = useTriggerWorkflow()
 *
 * mutate({
 *   workflowId: 'workflow-123',
 *   parameters: { batchSize: 10 },
 *   documentIds: ['doc-1', 'doc-2'],
 *   cityCode: 'HKG',
 * })
 * ```
 */
export function useTriggerWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: triggerWorkflow,
    onSuccess: () => {
      // 刷新執行列表
      queryClient.invalidateQueries({ queryKey: ['workflowExecutions'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-executions'] });
      // 刷新執行中工作流
      queryClient.invalidateQueries({ queryKey: ['running-executions'] });
    },
  });
}

/**
 * 重試工作流 Mutation Hook
 *
 * @description
 *   重新觸發失敗的工作流執行，使用原始參數和文件。
 *
 * @returns React Query Mutation 結果
 *
 * @example
 * ```typescript
 * const { mutate, isPending, error } = useRetryWorkflow()
 *
 * mutate('execution-123')
 * ```
 */
export function useRetryWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: retryWorkflow,
    onSuccess: () => {
      // 刷新執行列表
      queryClient.invalidateQueries({ queryKey: ['workflowExecutions'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-executions'] });
    },
  });
}

/**
 * 取消執行 Mutation Hook
 *
 * @description
 *   取消等待中或排隊中的工作流執行。
 *
 * @returns React Query Mutation 結果
 *
 * @example
 * ```typescript
 * const { mutate, isPending, error } = useCancelExecution()
 *
 * mutate('execution-123')
 * ```
 */
export function useCancelExecution() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cancelExecution,
    onSuccess: () => {
      // 刷新執行列表
      queryClient.invalidateQueries({ queryKey: ['workflowExecutions'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-executions'] });
    },
  });
}

// ============================================================
// Utilities
// ============================================================

/**
 * 刷新工作流觸發相關數據 Hook
 *
 * @returns 刷新函數集合
 *
 * @example
 * ```typescript
 * const { refreshTriggerableList, refreshAll } = useRefreshWorkflowTrigger()
 * // 刷新可觸發列表
 * refreshTriggerableList()
 * ```
 */
export function useRefreshWorkflowTrigger() {
  const queryClient = useQueryClient();

  return {
    /** 刷新可觸發工作流列表 */
    refreshTriggerableList: () => {
      queryClient.invalidateQueries({
        queryKey: workflowTriggerKeys.triggerableList(),
      });
    },
    /** 刷新所有工作流觸發相關數據 */
    refreshAll: () => {
      queryClient.invalidateQueries({
        queryKey: workflowTriggerKeys.all,
      });
    },
  };
}
