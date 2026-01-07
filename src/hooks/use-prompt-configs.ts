/**
 * @fileoverview Prompt 配置 React Query Hooks
 * @description
 *   提供 Prompt 配置的資料查詢和變更操作 hooks。
 *   使用 React Query 進行伺服器狀態管理。
 *
 * @module src/hooks/use-prompt-configs
 * @since Epic 14 - Story 14.2
 * @lastModified 2026-01-02
 *
 * @features
 *   - usePromptConfigs - 查詢配置列表
 *   - usePromptConfig - 查詢單一配置
 *   - useCreatePromptConfig - 建立配置
 *   - useUpdatePromptConfig - 更新配置
 *   - useDeletePromptConfig - 刪除配置
 *   - useTestPromptConfig - 測試配置
 *
 * @dependencies
 *   - @tanstack/react-query - 資料查詢庫
 *   - @/types/prompt-config - 配置類型定義
 *   - @/types/prompt-config-ui - UI 類型定義
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';
import type {
  PromptConfigListResponse,
  PromptConfigResponse,
  CreatePromptConfigRequest,
  UpdatePromptConfigRequest,
  GetPromptConfigsParams,
} from '@/types/prompt-config';
import type { PromptTestResult } from '@/types/prompt-config-ui';

// ============================================================================
// 常數
// ============================================================================

const QUERY_KEY = 'prompt-configs';
const API_BASE = '/api/v1/prompt-configs';

// ============================================================================
// 查詢 Hooks
// ============================================================================

/**
 * 查詢 Prompt 配置列表
 */
export function usePromptConfigs(
  params: GetPromptConfigsParams = {},
  options?: Omit<
    UseQueryOptions<PromptConfigListResponse, Error>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: [QUERY_KEY, 'list', params],
    queryFn: async (): Promise<PromptConfigListResponse> => {
      const searchParams = new URLSearchParams();

      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.set(key, String(value));
        }
      });

      const url = `${API_BASE}?${searchParams.toString()}`;
      const res = await fetch(url);

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.detail || '載入配置列表失敗');
      }

      return res.json();
    },
    ...options,
  });
}

/**
 * 查詢單一 Prompt 配置
 */
export function usePromptConfig(
  id: string,
  options?: Omit<
    UseQueryOptions<PromptConfigResponse, Error>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: [QUERY_KEY, 'detail', id],
    queryFn: async (): Promise<PromptConfigResponse> => {
      const res = await fetch(`${API_BASE}/${id}`);

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.detail || '載入配置詳情失敗');
      }

      return res.json();
    },
    enabled: !!id,
    ...options,
  });
}

// ============================================================================
// 變更 Hooks
// ============================================================================

/**
 * 建立 Prompt 配置
 */
export function useCreatePromptConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      data: CreatePromptConfigRequest
    ): Promise<PromptConfigResponse> => {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.detail || '建立配置失敗');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

/**
 * 更新 Prompt 配置
 */
export function useUpdatePromptConfig(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      data: UpdatePromptConfigRequest
    ): Promise<PromptConfigResponse> => {
      const res = await fetch(`${API_BASE}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.detail || '更新配置失敗');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

/**
 * 刪除 Prompt 配置
 */
export function useDeletePromptConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const res = await fetch(`${API_BASE}/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.detail || '刪除配置失敗');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

// ============================================================================
// 測試 Hook
// ============================================================================

/**
 * 測試 Prompt 配置
 */
export function useTestPromptConfig(configId: string) {
  return useMutation({
    mutationFn: async (file: File): Promise<PromptTestResult> => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('configId', configId);

      const res = await fetch(`${API_BASE}/test`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.detail || '測試失敗');
      }

      return res.json();
    },
  });
}

// ============================================================================
// 輔助 Hooks
// ============================================================================

/**
 * 查詢配置可用的公司列表
 */
export function useCompaniesForPromptConfig() {
  return useQuery({
    queryKey: ['companies', 'prompt-config-select'],
    queryFn: async (): Promise<Array<{ id: string; name: string }>> => {
      const res = await fetch('/api/companies?limit=100&sortBy=name');

      if (!res.ok) {
        throw new Error('載入公司列表失敗');
      }

      const data = await res.json();
      return data.data || [];
    },
  });
}

/**
 * 查詢配置可用的文件格式列表
 */
export function useDocumentFormatsForPromptConfig(companyId?: string) {
  return useQuery({
    queryKey: ['document-formats', 'prompt-config-select', companyId],
    queryFn: async (): Promise<Array<{ id: string; name: string }>> => {
      const params = new URLSearchParams({ limit: '100', sortBy: 'name' });
      if (companyId) {
        params.set('companyId', companyId);
      }

      const res = await fetch(`/api/v1/document-formats?${params}`);

      if (!res.ok) {
        throw new Error('載入文件格式列表失敗');
      }

      const data = await res.json();
      return data.data || [];
    },
    enabled: true,
  });
}
