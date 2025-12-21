/**
 * @fileoverview 警報規則 React Hooks
 * @description
 *   提供警報規則的 CRUD 操作 hooks，包括：
 *   - useAlertRules: 獲取規則列表
 *   - useAlertRule: 獲取單個規則
 *   - useCreateAlertRule: 創建規則
 *   - useUpdateAlertRule: 更新規則
 *   - useDeleteAlertRule: 刪除規則
 *   - useToggleAlertRule: 切換規則狀態
 *
 * @module src/hooks/useAlertRules
 * @since Epic 12 - Story 12-3 (錯誤警報設定)
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  CreateAlertRuleRequest,
  UpdateAlertRuleRequest,
  AlertRuleResponse,
  AlertRuleListParams,
  AlertConditionType,
  AlertSeverity,
} from '@/types/alerts';

// ============================================================
// Query Keys
// ============================================================

export const alertRuleKeys = {
  all: ['alertRules'] as const,
  lists: () => [...alertRuleKeys.all, 'list'] as const,
  list: (params: AlertRuleListParams) => [...alertRuleKeys.lists(), params] as const,
  details: () => [...alertRuleKeys.all, 'detail'] as const,
  detail: (id: string) => [...alertRuleKeys.details(), id] as const,
};

// ============================================================
// Types
// ============================================================

interface AlertRuleListResponse {
  success: boolean;
  data: AlertRuleResponse[];
  meta: {
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

interface AlertRuleDetailResponse {
  success: boolean;
  data: AlertRuleResponse;
}

interface MutationResponse {
  success: boolean;
  data: AlertRuleResponse;
  message?: string;
}

// ============================================================
// API Functions
// ============================================================

async function fetchAlertRules(params: AlertRuleListParams): Promise<AlertRuleListResponse> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.isActive !== undefined) searchParams.set('isActive', String(params.isActive));
  if (params.severity) searchParams.set('severity', params.severity);
  if (params.conditionType) searchParams.set('conditionType', params.conditionType);
  if (params.cityId) searchParams.set('cityId', params.cityId);
  if (params.search) searchParams.set('search', params.search);

  const response = await fetch(`/api/admin/alerts/rules?${searchParams.toString()}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '獲取警報規則失敗');
  }
  return response.json();
}

async function fetchAlertRule(id: string): Promise<AlertRuleDetailResponse> {
  const response = await fetch(`/api/admin/alerts/rules/${id}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '獲取警報規則失敗');
  }
  return response.json();
}

async function createAlertRule(data: CreateAlertRuleRequest): Promise<MutationResponse> {
  const response = await fetch('/api/admin/alerts/rules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '創建警報規則失敗');
  }
  return response.json();
}

async function updateAlertRule({
  id,
  data,
}: {
  id: string;
  data: UpdateAlertRuleRequest;
}): Promise<MutationResponse> {
  const response = await fetch(`/api/admin/alerts/rules/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '更新警報規則失敗');
  }
  return response.json();
}

async function deleteAlertRule(id: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`/api/admin/alerts/rules/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '刪除警報規則失敗');
  }
  return response.json();
}

async function toggleAlertRule(id: string): Promise<MutationResponse> {
  const response = await fetch(`/api/admin/alerts/rules/${id}/toggle`, {
    method: 'PATCH',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '切換警報規則狀態失敗');
  }
  return response.json();
}

// ============================================================
// Hooks
// ============================================================

/**
 * 獲取警報規則列表
 */
export function useAlertRules(params: AlertRuleListParams = {}) {
  return useQuery({
    queryKey: alertRuleKeys.list(params),
    queryFn: () => fetchAlertRules(params),
  });
}

/**
 * 獲取單個警報規則
 */
export function useAlertRule(id: string | undefined) {
  return useQuery({
    queryKey: alertRuleKeys.detail(id!),
    queryFn: () => fetchAlertRule(id!),
    enabled: !!id,
  });
}

/**
 * 創建警報規則
 */
export function useCreateAlertRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createAlertRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: alertRuleKeys.lists() });
    },
  });
}

/**
 * 更新警報規則
 */
export function useUpdateAlertRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateAlertRule,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: alertRuleKeys.lists() });
      queryClient.invalidateQueries({ queryKey: alertRuleKeys.detail(variables.id) });
    },
  });
}

/**
 * 刪除警報規則
 */
export function useDeleteAlertRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteAlertRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: alertRuleKeys.lists() });
    },
  });
}

/**
 * 切換警報規則狀態
 */
export function useToggleAlertRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: toggleAlertRule,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: alertRuleKeys.lists() });
      queryClient.invalidateQueries({ queryKey: alertRuleKeys.detail(id) });
    },
  });
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 獲取條件類型顯示文字
 */
export function getConditionTypeText(type: AlertConditionType): string {
  const texts: Record<AlertConditionType, string> = {
    SERVICE_DOWN: '服務停機',
    ERROR_RATE: '錯誤率',
    RESPONSE_TIME: '回應時間',
    QUEUE_BACKLOG: '佇列積壓',
    STORAGE_LOW: '儲存空間不足',
    CPU_HIGH: 'CPU 使用率過高',
    MEMORY_HIGH: '記憶體使用率過高',
    CUSTOM_METRIC: '自定義指標',
  };
  return texts[type] || type;
}

/**
 * 獲取嚴重程度顯示文字
 */
export function getSeverityText(severity: AlertSeverity): string {
  const texts: Record<AlertSeverity, string> = {
    INFO: '資訊',
    WARNING: '警告',
    ERROR: '錯誤',
    CRITICAL: '嚴重',
    EMERGENCY: '緊急',
  };
  return texts[severity] || severity;
}

/**
 * 獲取嚴重程度顏色
 */
export function getSeverityColor(severity: AlertSeverity): string {
  const colors: Record<AlertSeverity, string> = {
    INFO: 'bg-blue-100 text-blue-800',
    WARNING: 'bg-yellow-100 text-yellow-800',
    ERROR: 'bg-orange-100 text-orange-800',
    CRITICAL: 'bg-red-100 text-red-800',
    EMERGENCY: 'bg-purple-100 text-purple-800',
  };
  return colors[severity] || 'bg-gray-100 text-gray-800';
}
