/**
 * @fileoverview 警報 React Hooks
 * @description
 *   提供警報相關操作 hooks，包括：
 *   - useAlerts: 獲取警報列表
 *   - useAlert: 獲取單個警報詳情
 *   - useAlertStatistics: 獲取警報統計
 *   - useAcknowledgeAlert: 確認警報
 *   - useResolveAlert: 解決警報
 *
 * @module src/hooks/useAlerts
 * @since Epic 12 - Story 12-3 (錯誤警報設定)
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { AlertResponse, AlertListParams, AlertStatistics, AlertStatus } from '@/types/alerts';

// ============================================================
// Query Keys
// ============================================================

export const alertKeys = {
  all: ['alerts'] as const,
  lists: () => [...alertKeys.all, 'list'] as const,
  list: (params: AlertListParams) => [...alertKeys.lists(), params] as const,
  details: () => [...alertKeys.all, 'detail'] as const,
  detail: (id: string) => [...alertKeys.details(), id] as const,
  statistics: () => [...alertKeys.all, 'statistics'] as const,
};

// ============================================================
// Types
// ============================================================

interface AlertListResponse {
  success: boolean;
  data: AlertResponse[];
  meta: {
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

interface AlertDetailResponse {
  success: boolean;
  data: AlertResponse & {
    notifications: Array<{
      id: string;
      channel: string;
      recipient: string;
      status: string;
      sentAt: string | null;
      errorMessage: string | null;
    }>;
  };
}

interface AlertStatisticsResponse {
  success: boolean;
  data: {
    alerts: AlertStatistics;
    rules: {
      bySeverity: Record<string, number>;
      byConditionType: Record<string, number>;
    };
  };
}

interface MutationResponse {
  success: boolean;
  data: AlertResponse;
  message: string;
}

// ============================================================
// API Functions
// ============================================================

async function fetchAlerts(params: AlertListParams): Promise<AlertListResponse> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.status) searchParams.set('status', params.status);
  if (params.severity) searchParams.set('severity', params.severity);
  if (params.ruleId) searchParams.set('ruleId', params.ruleId);
  if (params.cityId) searchParams.set('cityId', params.cityId);
  if (params.startDate) searchParams.set('startDate', params.startDate);
  if (params.endDate) searchParams.set('endDate', params.endDate);

  const response = await fetch(`/api/admin/alerts?${searchParams.toString()}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '獲取警報失敗');
  }
  return response.json();
}

async function fetchAlert(id: string): Promise<AlertDetailResponse> {
  const response = await fetch(`/api/admin/alerts/${id}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '獲取警報失敗');
  }
  return response.json();
}

async function fetchAlertStatistics(): Promise<AlertStatisticsResponse> {
  const response = await fetch('/api/admin/alerts/statistics');
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '獲取警報統計失敗');
  }
  return response.json();
}

async function acknowledgeAlert(id: string): Promise<MutationResponse> {
  const response = await fetch(`/api/admin/alerts/${id}/acknowledge`, {
    method: 'POST',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '確認警報失敗');
  }
  return response.json();
}

async function resolveAlert({
  id,
  resolution,
}: {
  id: string;
  resolution: string;
}): Promise<MutationResponse> {
  const response = await fetch(`/api/admin/alerts/${id}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resolution }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '解決警報失敗');
  }
  return response.json();
}

// ============================================================
// Hooks
// ============================================================

/**
 * 獲取警報列表
 */
export function useAlerts(params: AlertListParams = {}) {
  return useQuery({
    queryKey: alertKeys.list(params),
    queryFn: () => fetchAlerts(params),
  });
}

/**
 * 獲取單個警報詳情
 */
export function useAlert(id: string | undefined) {
  return useQuery({
    queryKey: alertKeys.detail(id!),
    queryFn: () => fetchAlert(id!),
    enabled: !!id,
  });
}

/**
 * 獲取警報統計
 */
export function useAlertStatistics() {
  return useQuery({
    queryKey: alertKeys.statistics(),
    queryFn: fetchAlertStatistics,
    refetchInterval: 60000, // 每分鐘刷新一次
  });
}

/**
 * 確認警報
 */
export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: acknowledgeAlert,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: alertKeys.lists() });
      queryClient.invalidateQueries({ queryKey: alertKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: alertKeys.statistics() });
    },
  });
}

/**
 * 解決警報
 */
export function useResolveAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: resolveAlert,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: alertKeys.lists() });
      queryClient.invalidateQueries({ queryKey: alertKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: alertKeys.statistics() });
    },
  });
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 獲取警報狀態顯示文字
 */
export function getAlertStatusText(status: AlertStatus): string {
  const texts: Record<AlertStatus, string> = {
    FIRING: '觸發中',
    ACKNOWLEDGED: '已確認',
    RESOLVED: '已解決',
    RECOVERED: '已恢復',
  };
  return texts[status] || status;
}

/**
 * 獲取警報狀態顏色
 */
export function getAlertStatusColor(status: AlertStatus): string {
  const colors: Record<AlertStatus, string> = {
    FIRING: 'bg-red-100 text-red-800',
    ACKNOWLEDGED: 'bg-yellow-100 text-yellow-800',
    RESOLVED: 'bg-green-100 text-green-800',
    RECOVERED: 'bg-blue-100 text-blue-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}
