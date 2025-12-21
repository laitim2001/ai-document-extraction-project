'use client';

/**
 * @fileoverview 健康監控查詢 Hook
 * @description
 *   提供客戶端健康監控功能，包含系統健康狀態查詢、
 *   服務詳情查詢和手動健康檢查觸發等操作。
 *   使用 React Query 進行資料緩存和狀態管理。
 *
 *   主要功能：
 *   - 系統整體健康狀態查詢
 *   - 各服務詳細狀態查詢（含歷史記錄）
 *   - 手動觸發所有服務健康檢查
 *   - 自動輪詢刷新（預設 30 秒）
 *
 * @module src/hooks/use-health-monitoring
 * @author Development Team
 * @since Epic 12 - Story 12.1 (System Health Monitoring Dashboard)
 * @lastModified 2025-12-21
 *
 * @dependencies
 *   - @tanstack/react-query - 資料查詢和緩存
 *
 * @example
 *   // 查詢系統健康狀態
 *   const { data: health, isLoading, refetch } = useHealthStatus();
 *
 *   // 查詢服務詳情
 *   const { data: details } = useServiceDetails('database', 24);
 *
 *   // 手動觸發健康檢查
 *   const { mutate: triggerCheck, isPending } = useTriggerHealthCheck();
 *   triggerCheck();
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import type { HealthStatus, ServiceType } from '@prisma/client';

// ============================================================
// Types
// ============================================================

/**
 * 服務健康狀態結果
 */
export interface ServiceHealthResult {
  serviceName: string;
  serviceType: ServiceType;
  status: HealthStatus;
  statusText: string;
  responseTime: number | null;
  errorMessage: string | null;
  details: Record<string, unknown> | null;
  checkedAt: string;
}

/**
 * 系統整體健康狀態
 */
export interface OverallHealthStatus {
  status: HealthStatus;
  statusText: string;
  services: ServiceHealthResult[];
  activeUsers: number;
  availability24h: number;
  lastUpdated: string;
}

/**
 * 服務歷史記錄
 */
export interface ServiceHistoryItem {
  checkedAt: string;
  status: HealthStatus;
  statusText: string;
  responseTime: number | null;
}

/**
 * 錯誤日誌
 */
export interface ErrorLog {
  checkedAt: string;
  errorMessage: string | null;
  errorCode: string | null;
}

/**
 * 效能指標
 */
export interface ServiceMetrics {
  avgResponseTime: number;
  maxResponseTime: number;
  minResponseTime: number;
  errorRate: number;
}

/**
 * 服務詳情
 */
export interface ServiceHealthDetails {
  service: ServiceHealthResult | null;
  history: ServiceHistoryItem[];
  errorLogs: ErrorLog[];
  metrics: ServiceMetrics;
  queryParams: {
    hours: number;
  };
}

/**
 * API 響應格式
 */
interface ApiResponse<T> {
  success: boolean;
  data: T;
}

/**
 * API 錯誤格式
 */
interface ApiError {
  type: string;
  title: string;
  status: number;
  detail: string;
}

// ============================================================
// Query Keys
// ============================================================

/**
 * 健康監控查詢鍵
 */
export const healthQueryKeys = {
  /** 所有健康相關查詢 */
  all: ['health'] as const,
  /** 系統整體健康狀態 */
  status: () => [...healthQueryKeys.all, 'status'] as const,
  /** 服務詳情 */
  serviceDetails: (serviceName: string, hours: number) =>
    [...healthQueryKeys.all, 'service', serviceName, hours] as const,
};

// ============================================================
// API Functions
// ============================================================

/**
 * 獲取系統健康狀態
 */
async function fetchHealthStatus(): Promise<OverallHealthStatus> {
  const response = await fetch('/api/admin/health');

  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(error.detail || '獲取健康狀態失敗');
  }

  const result: ApiResponse<OverallHealthStatus> = await response.json();
  return result.data;
}

/**
 * 獲取服務詳情
 */
async function fetchServiceDetails(
  serviceName: string,
  hours: number
): Promise<ServiceHealthDetails> {
  const response = await fetch(
    `/api/admin/health/${serviceName}?hours=${hours}`
  );

  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(error.detail || '獲取服務詳情失敗');
  }

  const result: ApiResponse<ServiceHealthDetails> = await response.json();
  return result.data;
}

/**
 * 觸發健康檢查
 */
async function triggerHealthCheck(): Promise<ServiceHealthResult[]> {
  const response = await fetch('/api/admin/health', {
    method: 'POST',
  });

  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(error.detail || '健康檢查失敗');
  }

  const result: ApiResponse<ServiceHealthResult[]> = await response.json();
  return result.data;
}

// ============================================================
// Hooks
// ============================================================

/**
 * 系統健康狀態查詢 Hook
 *
 * @description
 *   查詢系統整體健康狀態，包含各服務狀態、活躍用戶數和可用性。
 *   預設每 30 秒自動刷新。
 *
 * @param options - 查詢選項
 * @param options.refetchInterval - 自動刷新間隔（毫秒），設為 false 禁用
 * @param options.enabled - 是否啟用查詢
 *
 * @returns React Query 查詢結果
 *
 * @example
 *   const { data, isLoading, error, refetch } = useHealthStatus();
 *
 *   // 禁用自動刷新
 *   const { data } = useHealthStatus({ refetchInterval: false });
 */
export function useHealthStatus(options?: {
  refetchInterval?: number | false;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: healthQueryKeys.status(),
    queryFn: fetchHealthStatus,
    staleTime: 10 * 1000, // 10 秒內視為新鮮
    refetchInterval: options?.refetchInterval ?? 30 * 1000, // 預設 30 秒刷新
    enabled: options?.enabled ?? true,
    placeholderData: keepPreviousData,
  });
}

/**
 * 服務詳情查詢 Hook
 *
 * @description
 *   查詢特定服務的詳細資訊，包含歷史記錄、效能指標和錯誤日誌。
 *
 * @param serviceName - 服務名稱
 * @param hours - 查詢時間範圍（小時），預設 24
 * @param options - 查詢選項
 *
 * @returns React Query 查詢結果
 *
 * @example
 *   const { data, isLoading } = useServiceDetails('database', 24);
 */
export function useServiceDetails(
  serviceName: string | null,
  hours: number = 24,
  options?: {
    enabled?: boolean;
  }
) {
  return useQuery({
    queryKey: healthQueryKeys.serviceDetails(serviceName || '', hours),
    queryFn: () => fetchServiceDetails(serviceName!, hours),
    enabled: !!serviceName && (options?.enabled ?? true),
    staleTime: 30 * 1000, // 30 秒內視為新鮮
    placeholderData: keepPreviousData,
  });
}

/**
 * 手動觸發健康檢查 Hook
 *
 * @description
 *   觸發所有服務的健康檢查，並自動更新快取的健康狀態。
 *
 * @returns React Query 變更結果
 *
 * @example
 *   const { mutate: triggerCheck, isPending } = useTriggerHealthCheck();
 *
 *   const handleRefresh = () => {
 *     triggerCheck(undefined, {
 *       onSuccess: () => toast.success('健康檢查完成'),
 *       onError: () => toast.error('健康檢查失敗'),
 *     });
 *   };
 */
export function useTriggerHealthCheck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: triggerHealthCheck,
    onSuccess: () => {
      // 使健康狀態查詢失效，觸發重新獲取
      queryClient.invalidateQueries({ queryKey: healthQueryKeys.all });
    },
  });
}

/**
 * 健康監控組合 Hook
 *
 * @description
 *   組合健康狀態查詢和手動觸發檢查功能的便捷 Hook。
 *
 * @param options - 選項
 * @param options.refetchInterval - 自動刷新間隔
 *
 * @returns 健康監控相關的狀態和函數
 *
 * @example
 *   const {
 *     health,
 *     isLoading,
 *     isRefreshing,
 *     refresh,
 *     error,
 *   } = useHealthMonitoring();
 */
export function useHealthMonitoring(options?: {
  refetchInterval?: number | false;
}) {
  const healthQuery = useHealthStatus({
    refetchInterval: options?.refetchInterval,
  });

  const triggerMutation = useTriggerHealthCheck();

  return {
    /** 系統健康狀態 */
    health: healthQuery.data,
    /** 是否正在載入 */
    isLoading: healthQuery.isLoading,
    /** 是否正在刷新 */
    isRefreshing: healthQuery.isFetching || triggerMutation.isPending,
    /** 手動刷新函數 */
    refresh: () => triggerMutation.mutate(),
    /** 重新獲取數據 */
    refetch: healthQuery.refetch,
    /** 錯誤資訊 */
    error: healthQuery.error || triggerMutation.error,
    /** 最後更新時間 */
    lastUpdated: healthQuery.dataUpdatedAt
      ? new Date(healthQuery.dataUpdatedAt)
      : null,
  };
}
