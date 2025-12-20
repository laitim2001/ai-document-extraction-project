/**
 * @fileoverview n8n 健康監控 Hooks
 * @description
 *   提供 n8n 連線健康狀態的 React Query hooks，包含：
 *   - 整體健康狀態查詢
 *   - 手動健康檢查
 *   - 健康歷史記錄
 *   - 狀態變化記錄
 *
 * @module src/hooks/use-n8n-health
 * @author Development Team
 * @since Epic 10 - Story 10.7 (n8n Connection Status Monitoring)
 * @lastModified 2025-12-20
 *
 * @features
 *   - 健康狀態查詢與自動刷新
 *   - 手動觸發健康檢查
 *   - 歷史記錄分頁查詢
 *   - 狀態變化追蹤
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  HealthStatus,
  HealthCheckType,
  HealthStatusResponse,
  HealthCheckResponse,
  HealthHistoryResponse,
  StatusChangesResponse,
} from '@/types/health-monitoring';

// ============================================================
// Query Keys
// ============================================================

export const n8nHealthKeys = {
  all: ['n8n-health'] as const,
  status: (cityCode?: string) => [...n8nHealthKeys.all, 'status', cityCode] as const,
  history: (filters?: HealthHistoryFilters) => [...n8nHealthKeys.all, 'history', filters] as const,
  changes: (filters?: StatusChangesFilters) => [...n8nHealthKeys.all, 'changes', filters] as const,
};

// ============================================================
// Types
// ============================================================

interface HealthHistoryFilters {
  cityCode?: string;
  page?: number;
  pageSize?: number;
  startDate?: string;
  endDate?: string;
  status?: HealthStatus;
}

interface StatusChangesFilters {
  cityCode?: string;
  limit?: number;
  startDate?: string;
}

interface HealthCheckParams {
  cityCode?: string;
  checkType?: HealthCheckType;
}

// ============================================================
// API Functions
// ============================================================

const API_BASE = '/api/admin/n8n-health';

async function fetchHealthStatus(cityCode?: string): Promise<HealthStatusResponse> {
  const params = new URLSearchParams();
  if (cityCode) params.set('cityCode', cityCode);

  const response = await fetch(`${API_BASE}?${params.toString()}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '無法獲取健康狀態');
  }
  const data = await response.json();
  return data.data;
}

async function performHealthCheck(
  params?: HealthCheckParams
): Promise<HealthCheckResponse> {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params ?? {}),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '健康檢查失敗');
  }
  const data = await response.json();
  return data.data;
}

async function fetchHealthHistory(
  filters?: HealthHistoryFilters
): Promise<HealthHistoryResponse> {
  const params = new URLSearchParams();
  if (filters?.cityCode) params.set('cityCode', filters.cityCode);
  if (filters?.page) params.set('page', String(filters.page));
  if (filters?.pageSize) params.set('pageSize', String(filters.pageSize));
  if (filters?.startDate) params.set('startDate', filters.startDate);
  if (filters?.endDate) params.set('endDate', filters.endDate);
  if (filters?.status) params.set('status', filters.status);

  const response = await fetch(`${API_BASE}/history?${params.toString()}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '無法獲取健康歷史');
  }
  const data = await response.json();
  return data.data;
}

async function fetchStatusChanges(
  filters?: StatusChangesFilters
): Promise<StatusChangesResponse> {
  const params = new URLSearchParams();
  if (filters?.cityCode) params.set('cityCode', filters.cityCode);
  if (filters?.limit) params.set('limit', String(filters.limit));
  if (filters?.startDate) params.set('startDate', filters.startDate);

  const response = await fetch(`${API_BASE}/changes?${params.toString()}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '無法獲取狀態變化記錄');
  }
  const data = await response.json();
  return data.data;
}

// ============================================================
// Hooks
// ============================================================

/**
 * 獲取 n8n 整體健康狀態
 * @param cityCode - 可選，特定城市代碼
 * @param options - 查詢選項
 */
export function useN8nHealthStatus(
  cityCode?: string,
  options?: {
    refetchInterval?: number;
    enabled?: boolean;
  }
) {
  return useQuery({
    queryKey: n8nHealthKeys.status(cityCode),
    queryFn: () => fetchHealthStatus(cityCode),
    refetchInterval: options?.refetchInterval ?? 30000, // 預設 30 秒自動刷新
    enabled: options?.enabled ?? true,
  });
}

/**
 * 手動觸發健康檢查
 */
export function usePerformHealthCheck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: performHealthCheck,
    onSuccess: (_data, params) => {
      // 刷新健康狀態
      queryClient.invalidateQueries({
        queryKey: n8nHealthKeys.status(params?.cityCode),
      });
      // 刷新健康歷史
      queryClient.invalidateQueries({
        queryKey: n8nHealthKeys.history(),
      });
      // 刷新狀態變化
      queryClient.invalidateQueries({
        queryKey: n8nHealthKeys.changes(),
      });
    },
  });
}

/**
 * 獲取健康歷史記錄
 * @param filters - 篩選條件
 */
export function useN8nHealthHistory(filters?: HealthHistoryFilters) {
  return useQuery({
    queryKey: n8nHealthKeys.history(filters),
    queryFn: () => fetchHealthHistory(filters),
  });
}

/**
 * 獲取狀態變化記錄
 * @param filters - 篩選條件
 */
export function useN8nStatusChanges(filters?: StatusChangesFilters) {
  return useQuery({
    queryKey: n8nHealthKeys.changes(filters),
    queryFn: () => fetchStatusChanges(filters),
  });
}

/**
 * 判斷狀態是否需要關注
 */
export function isAlertStatus(status: HealthStatus): boolean {
  return status === 'UNHEALTHY' || status === 'DEGRADED';
}

/**
 * 獲取狀態顏色
 */
export function getHealthStatusColor(
  status: HealthStatus
): 'success' | 'warning' | 'error' | 'default' {
  const colorMap: Record<HealthStatus, 'success' | 'warning' | 'error' | 'default'> = {
    HEALTHY: 'success',
    DEGRADED: 'warning',
    UNHEALTHY: 'error',
    UNKNOWN: 'default',
    UNCONFIGURED: 'default',
  };
  return colorMap[status] || 'default';
}
