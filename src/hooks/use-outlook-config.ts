/**
 * @fileoverview Outlook 配置管理 Hooks
 * @description
 *   提供 Outlook 配置的 React Query hooks，包含：
 *   - 配置列表查詢
 *   - 配置新增、更新、刪除
 *   - 連線測試
 *   - 過濾規則 CRUD
 *   - 規則重新排序
 *
 * @module src/hooks/use-outlook-config
 * @author Development Team
 * @since Epic 9 - Story 9.4 (Outlook 連線設定)
 * @lastModified 2025-12-20
 *
 * @features
 *   - 配置 CRUD 操作
 *   - 過濾規則管理
 *   - 自動快取失效
 *   - 連線測試
 *   - 錯誤處理
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { OutlookFilterRule } from '@prisma/client';
import type {
  OutlookConfigApiResponse,
  CreateOutlookConfigInput,
  UpdateOutlookConfigInput,
  CreateFilterRuleInput,
  UpdateFilterRuleInput,
  OutlookConnectionTestResult,
  TestConnectionInput,
  GetOutlookConfigsOptions,
} from '@/types/outlook-config.types';

// ============================================================
// Query Keys
// ============================================================

export const outlookConfigKeys = {
  all: ['outlook-configs'] as const,
  lists: () => [...outlookConfigKeys.all, 'list'] as const,
  list: (filters: GetOutlookConfigsOptions) =>
    [...outlookConfigKeys.lists(), filters] as const,
  details: () => [...outlookConfigKeys.all, 'detail'] as const,
  detail: (id: string) => [...outlookConfigKeys.details(), id] as const,
  rules: (configId: string) => [...outlookConfigKeys.all, 'rules', configId] as const,
};

// ============================================================
// API Functions - Config
// ============================================================

const API_BASE = '/api/admin/integrations/outlook';

async function fetchConfigs(
  options?: GetOutlookConfigsOptions
): Promise<OutlookConfigApiResponse[]> {
  const params = new URLSearchParams();
  if (options?.cityId) params.set('cityId', options.cityId);
  if (options?.includeInactive) params.set('includeInactive', 'true');
  if (options?.includeRules) params.set('includeRules', 'true');

  const response = await fetch(`${API_BASE}?${params.toString()}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '無法獲取配置列表');
  }
  const data = await response.json();
  return data.data;
}

async function fetchConfig(configId: string): Promise<OutlookConfigApiResponse> {
  const response = await fetch(`${API_BASE}/${configId}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '無法獲取配置');
  }
  const data = await response.json();
  return data.data;
}

async function createConfig(
  input: CreateOutlookConfigInput
): Promise<OutlookConfigApiResponse> {
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
  input: UpdateOutlookConfigInput
): Promise<OutlookConfigApiResponse> {
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
): Promise<OutlookConfigApiResponse> {
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

async function testExistingConfig(
  configId: string
): Promise<OutlookConnectionTestResult> {
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

async function testNewConfig(
  input: TestConnectionInput
): Promise<OutlookConnectionTestResult> {
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
// API Functions - Filter Rules
// ============================================================

async function fetchRules(configId: string): Promise<OutlookFilterRule[]> {
  const response = await fetch(`${API_BASE}/${configId}/rules`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '無法獲取規則列表');
  }
  const data = await response.json();
  return data.data;
}

async function createRule(
  configId: string,
  input: CreateFilterRuleInput
): Promise<OutlookFilterRule> {
  const response = await fetch(`${API_BASE}/${configId}/rules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '無法建立規則');
  }
  const data = await response.json();
  return data.data;
}

async function updateRule(
  configId: string,
  ruleId: string,
  input: UpdateFilterRuleInput
): Promise<OutlookFilterRule> {
  const response = await fetch(`${API_BASE}/${configId}/rules/${ruleId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '無法更新規則');
  }
  const data = await response.json();
  return data.data;
}

async function deleteRule(configId: string, ruleId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/${configId}/rules/${ruleId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '無法刪除規則');
  }
}

async function reorderRules(
  configId: string,
  ruleIds: string[]
): Promise<OutlookFilterRule[]> {
  const response = await fetch(`${API_BASE}/${configId}/rules/reorder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ruleIds }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '無法重新排序規則');
  }
  const data = await response.json();
  return data.data;
}

// ============================================================
// Config Hooks
// ============================================================

/**
 * 獲取 Outlook 配置列表
 */
export function useOutlookConfigs(options?: GetOutlookConfigsOptions) {
  return useQuery({
    queryKey: outlookConfigKeys.list(options ?? {}),
    queryFn: () => fetchConfigs(options),
  });
}

/**
 * 獲取單一 Outlook 配置
 */
export function useOutlookConfig(configId: string) {
  return useQuery({
    queryKey: outlookConfigKeys.detail(configId),
    queryFn: () => fetchConfig(configId),
    enabled: !!configId,
  });
}

/**
 * 建立 Outlook 配置
 */
export function useCreateOutlookConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: outlookConfigKeys.lists() });
    },
  });
}

/**
 * 更新 Outlook 配置
 */
export function useUpdateOutlookConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      configId,
      input,
    }: {
      configId: string;
      input: UpdateOutlookConfigInput;
    }) => updateConfig(configId, input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: outlookConfigKeys.lists() });
      queryClient.setQueryData(outlookConfigKeys.detail(data.id), data);
    },
  });
}

/**
 * 刪除 Outlook 配置
 */
export function useDeleteOutlookConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: outlookConfigKeys.lists() });
    },
  });
}

/**
 * 切換 Outlook 配置啟用狀態
 */
export function useToggleOutlookConfigActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      configId,
      isActive,
    }: {
      configId: string;
      isActive: boolean;
    }) => toggleConfigActive(configId, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: outlookConfigKeys.lists() });
    },
  });
}

/**
 * 測試現有配置連線
 */
export function useTestOutlookConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: testExistingConfig,
    onSuccess: () => {
      // 測試後刷新列表以顯示最新測試結果
      queryClient.invalidateQueries({ queryKey: outlookConfigKeys.lists() });
    },
  });
}

/**
 * 測試新配置連線（不儲存）
 */
export function useTestNewOutlookConfig() {
  return useMutation({
    mutationFn: testNewConfig,
  });
}

// ============================================================
// Filter Rules Hooks
// ============================================================

/**
 * 獲取過濾規則列表
 */
export function useOutlookFilterRules(configId: string) {
  return useQuery({
    queryKey: outlookConfigKeys.rules(configId),
    queryFn: () => fetchRules(configId),
    enabled: !!configId,
  });
}

/**
 * 建立過濾規則
 */
export function useCreateOutlookFilterRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      configId,
      input,
    }: {
      configId: string;
      input: CreateFilterRuleInput;
    }) => createRule(configId, input),
    onSuccess: (_, { configId }) => {
      queryClient.invalidateQueries({ queryKey: outlookConfigKeys.rules(configId) });
      queryClient.invalidateQueries({ queryKey: outlookConfigKeys.detail(configId) });
    },
  });
}

/**
 * 更新過濾規則
 */
export function useUpdateOutlookFilterRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      configId,
      ruleId,
      input,
    }: {
      configId: string;
      ruleId: string;
      input: UpdateFilterRuleInput;
    }) => updateRule(configId, ruleId, input),
    onSuccess: (_, { configId }) => {
      queryClient.invalidateQueries({ queryKey: outlookConfigKeys.rules(configId) });
      queryClient.invalidateQueries({ queryKey: outlookConfigKeys.detail(configId) });
    },
  });
}

/**
 * 刪除過濾規則
 */
export function useDeleteOutlookFilterRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ configId, ruleId }: { configId: string; ruleId: string }) =>
      deleteRule(configId, ruleId),
    onSuccess: (_, { configId }) => {
      queryClient.invalidateQueries({ queryKey: outlookConfigKeys.rules(configId) });
      queryClient.invalidateQueries({ queryKey: outlookConfigKeys.detail(configId) });
    },
  });
}

/**
 * 重新排序過濾規則
 */
export function useReorderOutlookFilterRules() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ configId, ruleIds }: { configId: string; ruleIds: string[] }) =>
      reorderRules(configId, ruleIds),
    onSuccess: (data, { configId }) => {
      queryClient.setQueryData(outlookConfigKeys.rules(configId), data);
    },
  });
}
