/**
 * @fileoverview 數據模版 React Query Hooks
 * @description
 *   提供數據模版的 CRUD 操作 Hooks：
 *   - useDataTemplates - 列表查詢
 *   - useDataTemplate - 單一模版查詢
 *   - useAvailableDataTemplates - 可用模版（下拉選單）
 *   - useCreateDataTemplate - 創建
 *   - useUpdateDataTemplate - 更新
 *   - useDeleteDataTemplate - 刪除
 *
 * @module src/hooks/use-data-templates
 * @since Epic 16 - Story 16.7
 * @lastModified 2026-01-13
 *
 * @features
 *   - React Query 整合
 *   - 自動快取管理
 *   - 樂觀更新
 *
 * @dependencies
 *   - @tanstack/react-query - 資料查詢
 *   - src/types/data-template.ts - 類型定義
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  DataTemplate,
  DataTemplateSummary,
  DataTemplateFilters,
  DataTemplateOption,
} from '@/types/data-template';
import type {
  CreateDataTemplateInput,
  UpdateDataTemplateInput,
} from '@/validations/data-template';

// ============================================================================
// Query Keys
// ============================================================================

/** 查詢鍵前綴 */
const QUERY_KEY_PREFIX = 'data-templates';

/** 查詢鍵工廠 */
export const dataTemplateKeys = {
  all: [QUERY_KEY_PREFIX] as const,
  lists: () => [...dataTemplateKeys.all, 'list'] as const,
  list: (filters: DataTemplateFilters) =>
    [...dataTemplateKeys.lists(), filters] as const,
  details: () => [...dataTemplateKeys.all, 'detail'] as const,
  detail: (id: string) => [...dataTemplateKeys.details(), id] as const,
  available: (companyId?: string) =>
    [...dataTemplateKeys.all, 'available', companyId] as const,
};

// ============================================================================
// API Functions
// ============================================================================

/** API 響應包裝器 */
interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    type: string;
    title: string;
    status: number;
    detail?: string;
  };
}

/** 列表響應 */
interface ListResponse {
  templates: DataTemplateSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * 取得模版列表
 */
async function fetchDataTemplates(
  filters: DataTemplateFilters = {},
  page: number = 1,
  limit: number = 20
): Promise<ListResponse> {
  const params = new URLSearchParams();

  if (filters.scope) params.set('scope', filters.scope);
  if (filters.companyId) params.set('companyId', filters.companyId);
  if (filters.isActive !== undefined)
    params.set('isActive', String(filters.isActive));
  if (filters.isSystem !== undefined)
    params.set('isSystem', String(filters.isSystem));
  if (filters.search) params.set('search', filters.search);
  params.set('page', String(page));
  params.set('limit', String(limit));

  const response = await fetch(`/api/v1/data-templates?${params.toString()}`);
  const result: ApiResponse<ListResponse> = await response.json();

  if (!result.success) {
    throw new Error(result.error?.detail || result.error?.title || '取得模版列表失敗');
  }

  return result.data;
}

/**
 * 取得單一模版
 */
async function fetchDataTemplate(id: string): Promise<DataTemplate> {
  const response = await fetch(`/api/v1/data-templates/${id}`);
  const result: ApiResponse<DataTemplate> = await response.json();

  if (!result.success) {
    throw new Error(result.error?.detail || result.error?.title || '取得模版詳情失敗');
  }

  return result.data;
}

/**
 * 取得可用模版
 */
async function fetchAvailableTemplates(
  companyId?: string
): Promise<DataTemplateOption[]> {
  const params = new URLSearchParams();
  if (companyId) params.set('companyId', companyId);

  const response = await fetch(
    `/api/v1/data-templates/available?${params.toString()}`
  );
  const result: ApiResponse<DataTemplateOption[]> = await response.json();

  if (!result.success) {
    throw new Error(result.error?.detail || result.error?.title || '取得可用模版失敗');
  }

  return result.data;
}

/**
 * 創建模版
 */
async function createDataTemplate(
  input: CreateDataTemplateInput
): Promise<DataTemplate> {
  const response = await fetch('/api/v1/data-templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  const result: ApiResponse<DataTemplate> = await response.json();

  if (!result.success) {
    throw new Error(result.error?.detail || result.error?.title || '創建模版失敗');
  }

  return result.data;
}

/**
 * 更新模版
 */
async function updateDataTemplate(
  id: string,
  input: UpdateDataTemplateInput
): Promise<DataTemplate> {
  const response = await fetch(`/api/v1/data-templates/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  const result: ApiResponse<DataTemplate> = await response.json();

  if (!result.success) {
    throw new Error(result.error?.detail || result.error?.title || '更新模版失敗');
  }

  return result.data;
}

/**
 * 刪除模版
 */
async function deleteDataTemplate(id: string): Promise<void> {
  const response = await fetch(`/api/v1/data-templates/${id}`, {
    method: 'DELETE',
  });

  const result: ApiResponse<{ deleted: boolean }> = await response.json();

  if (!result.success) {
    throw new Error(result.error?.detail || result.error?.title || '刪除模版失敗');
  }
}

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * 取得模版列表
 */
export function useDataTemplates(
  filters: DataTemplateFilters = {},
  page: number = 1,
  limit: number = 20
) {
  return useQuery({
    queryKey: [...dataTemplateKeys.list(filters), page, limit],
    queryFn: () => fetchDataTemplates(filters, page, limit),
  });
}

/**
 * 取得單一模版
 */
export function useDataTemplate(id: string | undefined) {
  return useQuery({
    queryKey: dataTemplateKeys.detail(id!),
    queryFn: () => fetchDataTemplate(id!),
    enabled: !!id,
  });
}

/**
 * 取得可用模版（下拉選單用）
 */
export function useAvailableDataTemplates(companyId?: string) {
  return useQuery({
    queryKey: dataTemplateKeys.available(companyId),
    queryFn: () => fetchAvailableTemplates(companyId),
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * 創建模版
 */
export function useCreateDataTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createDataTemplate,
    onSuccess: () => {
      // 清除列表快取
      queryClient.invalidateQueries({ queryKey: dataTemplateKeys.lists() });
      queryClient.invalidateQueries({ queryKey: dataTemplateKeys.all });
    },
  });
}

/**
 * 更新模版
 */
export function useUpdateDataTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateDataTemplateInput }) =>
      updateDataTemplate(id, input),
    onSuccess: (data) => {
      // 更新詳情快取
      queryClient.setQueryData(dataTemplateKeys.detail(data.id), data);
      // 清除列表快取
      queryClient.invalidateQueries({ queryKey: dataTemplateKeys.lists() });
    },
  });
}

/**
 * 刪除模版
 */
export function useDeleteDataTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteDataTemplate,
    onSuccess: (_, id) => {
      // 清除詳情快取
      queryClient.removeQueries({ queryKey: dataTemplateKeys.detail(id) });
      // 清除列表快取
      queryClient.invalidateQueries({ queryKey: dataTemplateKeys.lists() });
      queryClient.invalidateQueries({ queryKey: dataTemplateKeys.all });
    },
  });
}
