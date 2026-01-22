/**
 * @fileoverview 模版實例 React Query Hooks
 * @description
 *   提供模版實例相關的資料獲取和操作 hooks，使用 React Query 進行伺服器狀態管理
 *
 * @module src/hooks/use-template-instances
 * @since Epic 19 - Story 19.5
 * @lastModified 2026-01-22
 *
 * @features
 *   - 實例列表查詢和篩選
 *   - 實例詳情獲取
 *   - 實例創建、更新、刪除
 *   - 行數據查詢和操作
 *   - 批量操作支援
 *
 * @dependencies
 *   - @tanstack/react-query - 伺服器狀態管理
 *   - src/types/template-instance - 類型定義
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  TemplateInstanceSummary,
  TemplateInstance,
  TemplateInstanceRow,
  TemplateInstanceFilters,
  TemplateInstanceRowFilters,
  TemplateInstanceListResponse,
  TemplateInstanceRowListResponse,
  TemplateInstanceStatus,
  BatchValidationResult,
} from '@/types/template-instance';
import type { DataTemplate } from '@/types/data-template';

// ============================================================================
// Types
// ============================================================================

interface UseTemplateInstancesOptions extends TemplateInstanceFilters {
  page?: number;
  limit?: number;
  enabled?: boolean;
}

interface UseTemplateInstanceRowsOptions extends TemplateInstanceRowFilters {
  page?: number;
  limit?: number;
  enabled?: boolean;
}

interface CreateInstanceInput {
  dataTemplateId: string;
  name: string;
  description?: string;
}

interface UpdateRowInput {
  fieldValues?: Record<string, unknown>;
  rowKey?: string;
  status?: string;
}

// ============================================================================
// API Functions
// ============================================================================

async function fetchInstances(
  params: UseTemplateInstancesOptions
): Promise<TemplateInstanceListResponse> {
  const searchParams = new URLSearchParams();

  if (params.dataTemplateId) searchParams.set('dataTemplateId', params.dataTemplateId);
  if (params.status) searchParams.set('status', params.status);
  if (params.search) searchParams.set('search', params.search);
  if (params.dateFrom) searchParams.set('dateFrom', params.dateFrom);
  if (params.dateTo) searchParams.set('dateTo', params.dateTo);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));

  const response = await fetch(`/api/v1/template-instances?${searchParams}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.detail || 'Failed to fetch instances');
  }

  const data = await response.json();
  return data.data;
}

interface DataTemplateInfo {
  id: string;
  name: string;
  fields: DataTemplate['fields'];
}

interface TemplateInstanceWithFields extends TemplateInstance {
  dataTemplate: DataTemplateInfo | null;
}

async function fetchInstance(id: string): Promise<TemplateInstanceWithFields> {
  const response = await fetch(`/api/v1/template-instances/${id}?includeTemplate=true`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.detail || 'Failed to fetch instance');
  }

  const data = await response.json();
  return data.data;
}

async function fetchInstanceRows(
  instanceId: string,
  params: UseTemplateInstanceRowsOptions
): Promise<TemplateInstanceRowListResponse> {
  const searchParams = new URLSearchParams();

  if (params.status) searchParams.set('status', params.status);
  if (params.search) searchParams.set('search', params.search);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));

  const response = await fetch(`/api/v1/template-instances/${instanceId}/rows?${searchParams}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.detail || 'Failed to fetch rows');
  }

  const data = await response.json();
  return data.data;
}

async function createInstance(input: CreateInstanceInput): Promise<TemplateInstance> {
  const response = await fetch('/api/v1/template-instances', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.detail || 'Failed to create instance');
  }

  const data = await response.json();
  return data.data;
}

async function deleteInstance(id: string): Promise<void> {
  const response = await fetch(`/api/v1/template-instances/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.detail || 'Failed to delete instance');
  }
}

async function updateRow(
  instanceId: string,
  rowId: string,
  input: UpdateRowInput
): Promise<TemplateInstanceRow> {
  const response = await fetch(`/api/v1/template-instances/${instanceId}/rows/${rowId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.detail || 'Failed to update row');
  }

  const data = await response.json();
  return data.data;
}

async function deleteRow(instanceId: string, rowId: string): Promise<void> {
  const response = await fetch(`/api/v1/template-instances/${instanceId}/rows/${rowId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.detail || 'Failed to delete row');
  }
}

async function deleteRows(instanceId: string, rowIds: string[]): Promise<void> {
  // 批量刪除使用 Promise.all
  await Promise.all(rowIds.map(rowId => deleteRow(instanceId, rowId)));
}

async function validateAllRows(instanceId: string): Promise<BatchValidationResult> {
  const response = await fetch(`/api/v1/template-instances/${instanceId}/validate`, {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.detail || 'Failed to validate rows');
  }

  const data = await response.json();
  return data.data;
}

async function fetchDataTemplates(): Promise<{ id: string; name: string }[]> {
  const response = await fetch('/api/v1/data-templates?isActive=true&limit=100');

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  return data.data?.templates ?? [];
}

// ============================================================================
// Query Keys
// ============================================================================

export const templateInstanceKeys = {
  all: ['template-instances'] as const,
  lists: () => [...templateInstanceKeys.all, 'list'] as const,
  list: (filters: TemplateInstanceFilters) => [...templateInstanceKeys.lists(), filters] as const,
  details: () => [...templateInstanceKeys.all, 'detail'] as const,
  detail: (id: string) => [...templateInstanceKeys.details(), id] as const,
  rows: (instanceId: string) => [...templateInstanceKeys.detail(instanceId), 'rows'] as const,
  rowList: (instanceId: string, filters: TemplateInstanceRowFilters) =>
    [...templateInstanceKeys.rows(instanceId), filters] as const,
};

export const dataTemplateKeys = {
  all: ['data-templates'] as const,
  options: () => [...dataTemplateKeys.all, 'options'] as const,
};

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * 獲取模版實例列表
 */
export function useTemplateInstances(options: UseTemplateInstancesOptions = {}) {
  const { enabled = true, ...params } = options;

  return useQuery({
    queryKey: templateInstanceKeys.list(params),
    queryFn: () => fetchInstances(params),
    enabled,
  });
}

/**
 * 獲取單一實例詳情（含 DataTemplate 欄位定義）
 */
export function useTemplateInstance(id: string, enabled = true) {
  return useQuery({
    queryKey: templateInstanceKeys.detail(id),
    queryFn: () => fetchInstance(id),
    enabled: enabled && !!id,
  });
}

export type { TemplateInstanceWithFields };

/**
 * 獲取實例的行數據
 */
export function useTemplateInstanceRows(
  instanceId: string,
  options: UseTemplateInstanceRowsOptions = {}
) {
  const { enabled = true, ...params } = options;

  return useQuery({
    queryKey: templateInstanceKeys.rowList(instanceId, params),
    queryFn: () => fetchInstanceRows(instanceId, params),
    enabled: enabled && !!instanceId,
  });
}

/**
 * 獲取可用數據模版列表（用於下拉選單）
 */
export function useDataTemplateOptions() {
  return useQuery({
    queryKey: dataTemplateKeys.options(),
    queryFn: fetchDataTemplates,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * 創建模版實例
 */
export function useCreateTemplateInstance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createInstance,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateInstanceKeys.lists() });
    },
  });
}

/**
 * 刪除模版實例
 */
export function useDeleteTemplateInstance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteInstance,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateInstanceKeys.lists() });
    },
  });
}

/**
 * 更新行數據
 */
export function useUpdateRow(instanceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ rowId, input }: { rowId: string; input: UpdateRowInput }) =>
      updateRow(instanceId, rowId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateInstanceKeys.rows(instanceId) });
      queryClient.invalidateQueries({ queryKey: templateInstanceKeys.detail(instanceId) });
    },
  });
}

/**
 * 刪除單行
 */
export function useDeleteRow(instanceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (rowId: string) => deleteRow(instanceId, rowId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateInstanceKeys.rows(instanceId) });
      queryClient.invalidateQueries({ queryKey: templateInstanceKeys.detail(instanceId) });
    },
  });
}

/**
 * 批量刪除行
 */
export function useBulkDeleteRows(instanceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (rowIds: string[]) => deleteRows(instanceId, rowIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateInstanceKeys.rows(instanceId) });
      queryClient.invalidateQueries({ queryKey: templateInstanceKeys.detail(instanceId) });
    },
  });
}

/**
 * 重新驗證所有行
 */
export function useValidateAllRows(instanceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => validateAllRows(instanceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateInstanceKeys.rows(instanceId) });
      queryClient.invalidateQueries({ queryKey: templateInstanceKeys.detail(instanceId) });
    },
  });
}
