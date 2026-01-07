/**
 * @fileoverview Field Mapping 配置 React Query Hooks
 * @description
 *   提供 Field Mapping 配置的資料查詢和變更操作 hooks。
 *   使用 React Query 進行伺服器狀態管理。
 *
 * @module src/hooks/use-field-mapping-configs
 * @since Epic 13 - Story 13.7
 * @lastModified 2026-01-07
 *
 * @features
 *   - useFieldMappingConfigs - 查詢配置列表
 *   - useFieldMappingConfig - 查詢單一配置
 *   - useCreateFieldMappingConfig - 建立配置
 *   - useUpdateFieldMappingConfig - 更新配置
 *   - useDeleteFieldMappingConfig - 刪除配置
 *   - useCreateFieldMappingRule - 建立規則
 *   - useUpdateFieldMappingRule - 更新規則
 *   - useDeleteFieldMappingRule - 刪除規則
 *   - useReorderFieldMappingRules - 重排序規則
 *   - useTestFieldMappingConfig - 測試配置
 *
 * @dependencies
 *   - @tanstack/react-query - 資料查詢庫
 *   - @/types/field-mapping - 配置類型定義
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';
import type {
  ConfigScope,
  TransformType,
  TransformParams,
  VisualMappingConfig,
  VisualMappingRule,
} from '@/types/field-mapping';

// ============================================================================
// 類型定義
// ============================================================================

/**
 * 查詢參數
 */
export interface GetFieldMappingConfigsParams {
  scope?: ConfigScope;
  companyId?: string;
  documentFormatId?: string;
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

/**
 * 配置列表項目
 */
export interface FieldMappingConfigListItem {
  id: string;
  name: string;
  description: string | null;
  scope: ConfigScope;
  companyId: string | null;
  companyName: string | null;
  documentFormatId: string | null;
  documentFormatName: string | null;
  isActive: boolean;
  rulesCount: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * 配置列表響應
 */
export interface FieldMappingConfigListResponse {
  success: true;
  data: FieldMappingConfigListItem[];
  meta?: {
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

/**
 * 規則 DTO
 */
export interface FieldMappingRuleDTO {
  id: string;
  configId: string;
  sourceFields: string[];
  targetField: string;
  transformType: TransformType;
  transformParams: TransformParams;
  priority: number;
  isActive: boolean;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * 配置詳情
 */
export interface FieldMappingConfigDetail extends FieldMappingConfigListItem {
  rules: FieldMappingRuleDTO[];
}

/**
 * 配置詳情響應
 */
export interface FieldMappingConfigResponse {
  success: true;
  data: FieldMappingConfigDetail;
}

/**
 * 建立配置請求
 */
export interface CreateFieldMappingConfigRequest {
  name: string;
  description?: string;
  scope: ConfigScope;
  companyId?: string | null;
  documentFormatId?: string | null;
  isActive?: boolean;
}

/**
 * 更新配置請求
 */
export interface UpdateFieldMappingConfigRequest {
  name?: string;
  description?: string | null;
  scope?: ConfigScope;
  companyId?: string | null;
  documentFormatId?: string | null;
  isActive?: boolean;
  version: number;
}

/**
 * 建立規則請求
 */
export interface CreateFieldMappingRuleRequest {
  sourceFields: string[];
  targetField: string;
  transformType: TransformType;
  transformParams?: TransformParams;
  priority?: number;
  isActive?: boolean;
  description?: string;
}

/**
 * 更新規則請求
 */
export interface UpdateFieldMappingRuleRequest {
  sourceFields?: string[];
  targetField?: string;
  transformType?: TransformType;
  transformParams?: TransformParams;
  priority?: number;
  isActive?: boolean;
  description?: string | null;
}

/**
 * 測試結果
 */
export interface FieldMappingTestResult {
  success: boolean;
  results: Array<{
    ruleId: string;
    sourceValues: Record<string, unknown>;
    transformedValue: unknown;
    targetField: string;
  }>;
  errors?: string[];
  executionTimeMs: number;
}

// ============================================================================
// 常數
// ============================================================================

const QUERY_KEY = 'field-mapping-configs';
const API_BASE = '/api/v1/field-mapping-configs';

// ============================================================================
// 查詢 Hooks
// ============================================================================

/**
 * 查詢 Field Mapping 配置列表
 */
export function useFieldMappingConfigs(
  params: GetFieldMappingConfigsParams = {},
  options?: Omit<
    UseQueryOptions<FieldMappingConfigListResponse, Error>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: [QUERY_KEY, 'list', params],
    queryFn: async (): Promise<FieldMappingConfigListResponse> => {
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
 * 查詢單一 Field Mapping 配置
 */
export function useFieldMappingConfig(
  id: string,
  options?: Omit<
    UseQueryOptions<FieldMappingConfigResponse, Error>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: [QUERY_KEY, 'detail', id],
    queryFn: async (): Promise<FieldMappingConfigResponse> => {
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
 * 建立 Field Mapping 配置
 */
export function useCreateFieldMappingConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      data: CreateFieldMappingConfigRequest
    ): Promise<FieldMappingConfigResponse> => {
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
 * 更新 Field Mapping 配置
 */
export function useUpdateFieldMappingConfig(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      data: UpdateFieldMappingConfigRequest
    ): Promise<FieldMappingConfigResponse> => {
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
 * 刪除 Field Mapping 配置
 */
export function useDeleteFieldMappingConfig() {
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
// 規則 Hooks
// ============================================================================

/**
 * 建立 Field Mapping 規則
 */
export function useCreateFieldMappingRule(configId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      data: CreateFieldMappingRuleRequest
    ): Promise<{ success: true; data: FieldMappingRuleDTO }> => {
      const res = await fetch(`${API_BASE}/${configId}/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.detail || '建立規則失敗');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEY, 'detail', configId],
      });
    },
  });
}

/**
 * 更新 Field Mapping 規則
 */
export function useUpdateFieldMappingRule(configId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      ruleId,
      data,
    }: {
      ruleId: string;
      data: UpdateFieldMappingRuleRequest;
    }): Promise<{ success: true; data: FieldMappingRuleDTO }> => {
      const res = await fetch(`${API_BASE}/${configId}/rules/${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.detail || '更新規則失敗');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEY, 'detail', configId],
      });
    },
  });
}

/**
 * 刪除 Field Mapping 規則
 */
export function useDeleteFieldMappingRule(configId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ruleId: string): Promise<void> => {
      const res = await fetch(`${API_BASE}/${configId}/rules/${ruleId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.detail || '刪除規則失敗');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEY, 'detail', configId],
      });
    },
  });
}

/**
 * 重排序 Field Mapping 規則
 */
export function useReorderFieldMappingRules(configId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      ruleIds: string[]
    ): Promise<{ success: true; data: FieldMappingRuleDTO[] }> => {
      const res = await fetch(`${API_BASE}/${configId}/rules/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleIds }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.detail || '重排序失敗');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEY, 'detail', configId],
      });
    },
  });
}

// ============================================================================
// 測試 Hook
// ============================================================================

/**
 * 測試 Field Mapping 配置
 */
export function useTestFieldMappingConfig(configId: string) {
  return useMutation({
    mutationFn: async (testData: {
      sampleInput: Record<string, unknown>;
    }): Promise<FieldMappingTestResult> => {
      const res = await fetch(`${API_BASE}/${configId}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testData),
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
export function useCompaniesForFieldMapping() {
  return useQuery({
    queryKey: ['companies', 'field-mapping-select'],
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
export function useDocumentFormatsForFieldMapping(companyId?: string) {
  return useQuery({
    queryKey: ['document-formats', 'field-mapping-select', companyId],
    queryFn: async (): Promise<Array<{ id: string; name: string }>> => {
      const params = new URLSearchParams({ limit: '100', sortBy: 'name' });
      if (companyId) {
        params.set('companyId', companyId);
      }

      const res = await fetch(`/api/v1/formats?${params}`);

      if (!res.ok) {
        throw new Error('載入文件格式列表失敗');
      }

      const data = await res.json();
      // API 返回 { data: { formats: [...], pagination: {...} } }
      return data.data?.formats || [];
    },
    enabled: true,
  });
}

// ============================================================================
// 工具函數
// ============================================================================

/**
 * 將 API 響應轉換為 VisualMappingConfig 格式
 */
export function transformToVisualConfig(
  apiData: FieldMappingConfigDetail
): VisualMappingConfig {
  return {
    id: apiData.id,
    scope: apiData.scope,
    companyId: apiData.companyId,
    documentFormatId: apiData.documentFormatId,
    name: apiData.name,
    description: apiData.description || undefined,
    rules: (apiData.rules || []).map((rule) => ({
      id: rule.id,
      configId: rule.configId,
      sourceFields: rule.sourceFields,
      targetField: rule.targetField,
      transformType: rule.transformType,
      transformParams: rule.transformParams || {},
      priority: rule.priority,
      isActive: rule.isActive,
      description: rule.description || undefined,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    })),
    isActive: apiData.isActive,
    version: apiData.version,
    createdAt: apiData.createdAt,
    updatedAt: apiData.updatedAt,
  };
}
