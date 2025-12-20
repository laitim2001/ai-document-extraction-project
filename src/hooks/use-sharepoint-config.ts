/**
 * @fileoverview SharePoint 配置管理 Hooks
 * @description
 *   提供 SharePoint 配置的 React Query hooks，包含：
 *   - 配置列表查詢
 *   - 配置新增、更新、刪除
 *   - 連線測試
 *
 * @module src/hooks/use-sharepoint-config
 * @author Development Team
 * @since Epic 9 - Story 9.2 (SharePoint 連線配置)
 * @lastModified 2025-12-20
 *
 * @features
 *   - 配置 CRUD 操作
 *   - 自動快取失效
 *   - 連線測試
 *   - 錯誤處理
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  SharePointConfigListItem,
  SharePointConfigResponse,
  SharePointConfigInput,
  SharePointConfigUpdateInput,
  ConnectionTestResult,
} from '@/types/sharepoint';

// ============================================================
// Query Keys
// ============================================================

export const sharePointConfigKeys = {
  all: ['sharepoint-configs'] as const,
  lists: () => [...sharePointConfigKeys.all, 'list'] as const,
  list: (filters: { cityId?: string; includeInactive?: boolean }) =>
    [...sharePointConfigKeys.lists(), filters] as const,
  details: () => [...sharePointConfigKeys.all, 'detail'] as const,
  detail: (id: string) => [...sharePointConfigKeys.details(), id] as const,
};

// ============================================================
// API Functions
// ============================================================

const API_BASE = '/api/admin/integrations/sharepoint';

async function fetchConfigs(options?: {
  cityId?: string;
  includeInactive?: boolean;
}): Promise<SharePointConfigListItem[]> {
  const params = new URLSearchParams();
  if (options?.cityId) params.set('cityId', options.cityId);
  if (options?.includeInactive) params.set('includeInactive', 'true');

  const response = await fetch(`${API_BASE}?${params.toString()}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '無法獲取配置列表');
  }
  const data = await response.json();
  return data.data;
}

async function fetchConfig(configId: string): Promise<SharePointConfigResponse> {
  const response = await fetch(`${API_BASE}/${configId}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '無法獲取配置');
  }
  const data = await response.json();
  return data.data;
}

async function createConfig(
  input: SharePointConfigInput
): Promise<SharePointConfigResponse> {
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
  input: SharePointConfigUpdateInput
): Promise<SharePointConfigResponse> {
  const response = await fetch(`${API_BASE}/${configId}`, {
    method: 'PUT',
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
): Promise<SharePointConfigResponse> {
  const response = await fetch(`${API_BASE}/${configId}`, {
    method: 'PUT',
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

async function testExistingConfig(configId: string): Promise<ConnectionTestResult> {
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

async function testNewConfig(input: {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  siteUrl: string;
  libraryPath: string;
}): Promise<ConnectionTestResult> {
  const response = await fetch(`${API_BASE}/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '連線測試失敗');
  }
  const data = await response.json();
  return data.data;
}

// ============================================================
// Hooks
// ============================================================

/**
 * 獲取 SharePoint 配置列表
 */
export function useSharePointConfigs(options?: {
  cityId?: string;
  includeInactive?: boolean;
}) {
  return useQuery({
    queryKey: sharePointConfigKeys.list(options ?? {}),
    queryFn: () => fetchConfigs(options),
  });
}

/**
 * 獲取單一 SharePoint 配置
 */
export function useSharePointConfig(configId: string) {
  return useQuery({
    queryKey: sharePointConfigKeys.detail(configId),
    queryFn: () => fetchConfig(configId),
    enabled: !!configId,
  });
}

/**
 * 建立 SharePoint 配置
 */
export function useCreateSharePointConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sharePointConfigKeys.lists() });
    },
  });
}

/**
 * 更新 SharePoint 配置
 */
export function useUpdateSharePointConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ configId, input }: { configId: string; input: SharePointConfigUpdateInput }) =>
      updateConfig(configId, input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: sharePointConfigKeys.lists() });
      queryClient.setQueryData(sharePointConfigKeys.detail(data.id), data);
    },
  });
}

/**
 * 刪除 SharePoint 配置
 */
export function useDeleteSharePointConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sharePointConfigKeys.lists() });
    },
  });
}

/**
 * 切換 SharePoint 配置啟用狀態
 */
export function useToggleSharePointConfigActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ configId, isActive }: { configId: string; isActive: boolean }) =>
      toggleConfigActive(configId, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sharePointConfigKeys.lists() });
    },
  });
}

/**
 * 測試現有配置連線
 */
export function useTestSharePointConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: testExistingConfig,
    onSuccess: () => {
      // 測試後刷新列表以顯示最新測試結果
      queryClient.invalidateQueries({ queryKey: sharePointConfigKeys.lists() });
    },
  });
}

/**
 * 測試新配置連線（不儲存）
 */
export function useTestNewSharePointConfig() {
  return useMutation({
    mutationFn: testNewConfig,
  });
}
