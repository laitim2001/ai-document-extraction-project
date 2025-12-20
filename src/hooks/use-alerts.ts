/**
 * @fileoverview 告警管理 Hooks
 * @description
 *   提供告警管理的 React Query hooks，包含：
 *   - 告警列表查詢
 *   - 告警詳情
 *   - 確認和解決告警
 *   - 告警摘要統計
 *
 * @module src/hooks/use-alerts
 * @author Development Team
 * @since Epic 10 - Story 10.7 (n8n Connection Status Monitoring)
 * @lastModified 2025-12-20
 *
 * @features
 *   - 告警列表分頁查詢
 *   - 告警狀態管理
 *   - 告警摘要統計
 *   - 自動快取失效
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  AlertType,
  AlertSeverity,
  AlertStatus,
  AlertRecordListItem,
  AlertRecordDto,
  AlertSummary,
} from '@/types/alert-service';

// ============================================================
// Query Keys
// ============================================================

export const alertKeys = {
  all: ['alerts'] as const,
  lists: () => [...alertKeys.all, 'list'] as const,
  list: (filters?: AlertListFilters) => [...alertKeys.lists(), filters] as const,
  details: () => [...alertKeys.all, 'detail'] as const,
  detail: (id: string) => [...alertKeys.details(), id] as const,
  summary: () => [...alertKeys.all, 'summary'] as const,
};

// ============================================================
// Types
// ============================================================

interface AlertListFilters {
  service?: string;
  cityCode?: string;
  status?: AlertStatus;
  severity?: AlertSeverity;
  alertType?: AlertType;
  page?: number;
  pageSize?: number;
  startDate?: string;
  endDate?: string;
}

interface AlertListResponse {
  items: AlertRecordListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

interface AcknowledgeAlertParams {
  alertId: string;
  note?: string;
}

interface ResolveAlertParams {
  alertId: string;
  note?: string;
}

// ============================================================
// API Functions
// ============================================================

const API_BASE = '/api/admin/alerts';

async function fetchAlerts(filters?: AlertListFilters): Promise<AlertListResponse> {
  const params = new URLSearchParams();
  if (filters?.service) params.set('service', filters.service);
  if (filters?.cityCode) params.set('cityCode', filters.cityCode);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.severity) params.set('severity', filters.severity);
  if (filters?.alertType) params.set('alertType', filters.alertType);
  if (filters?.page) params.set('page', String(filters.page));
  if (filters?.pageSize) params.set('pageSize', String(filters.pageSize));
  if (filters?.startDate) params.set('startDate', filters.startDate);
  if (filters?.endDate) params.set('endDate', filters.endDate);

  const response = await fetch(`${API_BASE}?${params.toString()}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '無法獲取告警列表');
  }
  const data = await response.json();
  return {
    items: data.data,
    pagination: data.meta.pagination,
  };
}

async function fetchAlert(alertId: string): Promise<AlertRecordDto> {
  const response = await fetch(`${API_BASE}/${alertId}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '無法獲取告警詳情');
  }
  const data = await response.json();
  return data.data;
}

async function fetchAlertSummary(): Promise<AlertSummary> {
  const response = await fetch(`${API_BASE}/summary`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '無法獲取告警摘要');
  }
  const data = await response.json();
  return data.data;
}

async function acknowledgeAlert(params: AcknowledgeAlertParams): Promise<AlertRecordDto> {
  const response = await fetch(`${API_BASE}/${params.alertId}/acknowledge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note: params.note }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '無法確認告警');
  }
  const data = await response.json();
  return data.data;
}

async function resolveAlert(params: ResolveAlertParams): Promise<AlertRecordDto> {
  const response = await fetch(`${API_BASE}/${params.alertId}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note: params.note }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '無法解決告警');
  }
  const data = await response.json();
  return data.data;
}

// ============================================================
// Hooks
// ============================================================

/**
 * 獲取告警列表
 * @param filters - 篩選條件
 */
export function useAlerts(filters?: AlertListFilters) {
  return useQuery({
    queryKey: alertKeys.list(filters),
    queryFn: () => fetchAlerts(filters),
  });
}

/**
 * 獲取告警詳情
 * @param alertId - 告警 ID
 */
export function useAlert(alertId: string) {
  return useQuery({
    queryKey: alertKeys.detail(alertId),
    queryFn: () => fetchAlert(alertId),
    enabled: !!alertId,
  });
}

/**
 * 獲取告警摘要統計
 */
export function useAlertSummary() {
  return useQuery({
    queryKey: alertKeys.summary(),
    queryFn: fetchAlertSummary,
    refetchInterval: 60000, // 每分鐘刷新一次
  });
}

/**
 * 確認告警
 */
export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: acknowledgeAlert,
    onSuccess: (data) => {
      // 更新告警詳情快取
      queryClient.setQueryData(alertKeys.detail(data.id), data);
      // 刷新告警列表
      queryClient.invalidateQueries({ queryKey: alertKeys.lists() });
      // 刷新告警摘要
      queryClient.invalidateQueries({ queryKey: alertKeys.summary() });
    },
  });
}

/**
 * 解決告警
 */
export function useResolveAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: resolveAlert,
    onSuccess: (data) => {
      // 更新告警詳情快取
      queryClient.setQueryData(alertKeys.detail(data.id), data);
      // 刷新告警列表
      queryClient.invalidateQueries({ queryKey: alertKeys.lists() });
      // 刷新告警摘要
      queryClient.invalidateQueries({ queryKey: alertKeys.summary() });
    },
  });
}

/**
 * 獲取嚴重程度顏色
 */
export function getAlertSeverityColor(
  severity: AlertSeverity
): 'info' | 'warning' | 'error' | 'destructive' {
  const colorMap: Record<AlertSeverity, 'info' | 'warning' | 'error' | 'destructive'> = {
    INFO: 'info',
    WARNING: 'warning',
    ERROR: 'error',
    CRITICAL: 'destructive',
  };
  return colorMap[severity] || 'info';
}

/**
 * 判斷告警是否需要處理
 */
export function isAlertActionRequired(status: AlertStatus): boolean {
  return status === 'ACTIVE' || status === 'ACKNOWLEDGED';
}
