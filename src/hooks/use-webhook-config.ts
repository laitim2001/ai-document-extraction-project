/**
 * @fileoverview n8n Webhook 配置管理 Hooks
 * @description
 *   提供 n8n Webhook 配置的 React Query hooks，包含：
 *   - 配置列表查詢
 *   - 配置新增、更新、刪除
 *   - 連線測試
 *   - 配置歷史查詢
 *
 * @module src/hooks/use-webhook-config
 * @author Development Team
 * @since Epic 10 - Story 10.2 (Webhook Configuration Management)
 * @lastModified 2025-12-20
 *
 * @features
 *   - 配置 CRUD 操作
 *   - 自動快取失效
 *   - 連線測試
 *   - 配置變更歷史
 *   - 錯誤處理
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  WebhookConfigDto,
  WebhookConfigListItem,
  CreateWebhookConfigInput,
  UpdateWebhookConfigInput,
  TestConnectionResult,
  WebhookConfigHistoryDto,
  ListWebhookConfigsOptions,
  ListWebhookConfigsResult,
  ListConfigHistoryResult,
  ConfigChangeType,
} from '@/types/n8n';

// ============================================================
// Query Keys
// ============================================================

export const webhookConfigKeys = {
  all: ['webhook-configs'] as const,
  lists: () => [...webhookConfigKeys.all, 'list'] as const,
  list: (filters: Omit<ListWebhookConfigsOptions, 'page' | 'pageSize'>) =>
    [...webhookConfigKeys.lists(), filters] as const,
  details: () => [...webhookConfigKeys.all, 'detail'] as const,
  detail: (id: string) => [...webhookConfigKeys.details(), id] as const,
  histories: () => [...webhookConfigKeys.all, 'history'] as const,
  history: (configId: string, filters?: { changeType?: ConfigChangeType }) =>
    [...webhookConfigKeys.histories(), configId, filters] as const,
};

// ============================================================
// API Functions
// ============================================================

const API_BASE = '/api/admin/integrations/n8n/webhook-configs';

type FetchConfigsOptions = ListWebhookConfigsOptions;

interface FetchConfigsResponse {
  success: boolean;
  data: WebhookConfigListItem[];
  meta: {
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  };
}

async function fetchConfigs(
  options?: FetchConfigsOptions
): Promise<ListWebhookConfigsResult> {
  const params = new URLSearchParams();
  if (options?.cityCode) params.set('cityCode', options.cityCode);
  if (options?.isActive !== undefined) params.set('isActive', String(options.isActive));
  if (options?.page) params.set('page', String(options.page));
  if (options?.pageSize) params.set('pageSize', String(options.pageSize));
  if (options?.orderBy) params.set('orderBy', options.orderBy);
  if (options?.order) params.set('order', options.order);

  const response = await fetch(`${API_BASE}?${params.toString()}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '無法獲取配置列表');
  }
  const data: FetchConfigsResponse = await response.json();
  return {
    items: data.data,
    total: data.meta.pagination.total,
    page: data.meta.pagination.page,
    pageSize: data.meta.pagination.pageSize,
    totalPages: data.meta.pagination.totalPages,
  };
}

async function fetchConfig(configId: string): Promise<WebhookConfigDto> {
  const response = await fetch(`${API_BASE}/${configId}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '無法獲取配置');
  }
  const data = await response.json();
  return data.data;
}

async function createConfig(
  input: CreateWebhookConfigInput
): Promise<WebhookConfigDto> {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '無法建立配置');
  }
  const data = await response.json();
  return data.data;
}

async function updateConfig(
  configId: string,
  input: UpdateWebhookConfigInput
): Promise<WebhookConfigDto> {
  const response = await fetch(`${API_BASE}/${configId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '無法更新配置');
  }
  const data = await response.json();
  return data.data;
}

async function deleteConfig(configId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/${configId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '無法刪除配置');
  }
}

async function toggleConfigActive(
  configId: string,
  isActive: boolean
): Promise<WebhookConfigDto> {
  const response = await fetch(`${API_BASE}/${configId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isActive }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '無法更新配置狀態');
  }
  const data = await response.json();
  return data.data;
}

async function testConfig(configId: string): Promise<TestConnectionResult> {
  const response = await fetch(`${API_BASE}/${configId}/test`, {
    method: 'POST',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '連線測試失敗');
  }
  const data = await response.json();
  return data.data;
}

interface FetchHistoryOptions {
  configId: string;
  changeType?: ConfigChangeType;
  page?: number;
  pageSize?: number;
}

interface FetchHistoryResponse {
  success: boolean;
  data: WebhookConfigHistoryDto[];
  meta: {
    pagination: {
      page: number;
      pageSize: number;
      total: number;
    };
  };
}

async function fetchHistory(
  options: FetchHistoryOptions
): Promise<ListConfigHistoryResult> {
  const params = new URLSearchParams();
  if (options.changeType) params.set('changeType', options.changeType);
  if (options.page) params.set('page', String(options.page));
  if (options.pageSize) params.set('pageSize', String(options.pageSize));

  const response = await fetch(
    `${API_BASE}/${options.configId}/history?${params.toString()}`
  );
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '無法獲取配置歷史');
  }
  const data: FetchHistoryResponse = await response.json();
  return {
    items: data.data,
    total: data.meta.pagination.total,
    page: data.meta.pagination.page,
    pageSize: data.meta.pagination.pageSize,
  };
}

// ============================================================
// Hooks
// ============================================================

/**
 * 獲取 Webhook 配置列表
 */
export function useWebhookConfigs(options?: FetchConfigsOptions) {
  return useQuery({
    queryKey: webhookConfigKeys.list(options ?? {}),
    queryFn: () => fetchConfigs(options),
  });
}

/**
 * 獲取單一 Webhook 配置
 */
export function useWebhookConfig(configId: string) {
  return useQuery({
    queryKey: webhookConfigKeys.detail(configId),
    queryFn: () => fetchConfig(configId),
    enabled: !!configId,
  });
}

/**
 * 建立 Webhook 配置
 */
export function useCreateWebhookConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: webhookConfigKeys.lists() });
    },
  });
}

/**
 * 更新 Webhook 配置
 */
export function useUpdateWebhookConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      configId,
      input,
    }: {
      configId: string;
      input: UpdateWebhookConfigInput;
    }) => updateConfig(configId, input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: webhookConfigKeys.lists() });
      queryClient.setQueryData(webhookConfigKeys.detail(data.id), data);
    },
  });
}

/**
 * 刪除 Webhook 配置
 */
export function useDeleteWebhookConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: webhookConfigKeys.lists() });
    },
  });
}

/**
 * 切換 Webhook 配置啟用狀態
 */
export function useToggleWebhookConfigActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ configId, isActive }: { configId: string; isActive: boolean }) =>
      toggleConfigActive(configId, isActive),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: webhookConfigKeys.lists() });
      queryClient.setQueryData(webhookConfigKeys.detail(data.id), data);
    },
  });
}

/**
 * 測試 Webhook 配置連線
 */
export function useTestWebhookConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: testConfig,
    onSuccess: (_data, configId) => {
      // 測試後刷新列表和詳情以顯示最新測試結果
      queryClient.invalidateQueries({ queryKey: webhookConfigKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: webhookConfigKeys.detail(configId),
      });
    },
  });
}

/**
 * 獲取 Webhook 配置變更歷史
 */
export function useWebhookConfigHistory(
  configId: string,
  options?: {
    changeType?: ConfigChangeType;
    page?: number;
    pageSize?: number;
  }
) {
  return useQuery({
    queryKey: webhookConfigKeys.history(configId, {
      changeType: options?.changeType,
    }),
    queryFn: () =>
      fetchHistory({
        configId,
        ...options,
      }),
    enabled: !!configId,
  });
}
