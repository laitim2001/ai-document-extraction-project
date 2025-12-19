'use client';

/**
 * @fileoverview 儀表板統計 React Query Hook
 * @description
 *   提供儀表板統計數據獲取功能：
 *   - useDashboardStatistics: 獲取統計數據
 *   - useRefreshDashboardStatistics: 手動刷新統計
 *
 *   特性：
 *   - 整合日期範圍 Context
 *   - 5 分鐘 staleTime（與後端快取一致）
 *   - 視窗聚焦時刷新
 *   - 支援城市篩選
 *
 * @module src/hooks/useDashboardStatistics
 * @since Epic 7 - Story 7.2 (時間範圍篩選器)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @tanstack/react-query - React Query
 *   - @/types/dashboard - 類型定義
 *   - @/contexts/DateRangeContext - 日期範圍 Context
 *
 * @related
 *   - src/app/api/dashboard/statistics/route.ts - API 端點
 *   - src/components/dashboard/DashboardStats.tsx - 儀表板組件
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  DashboardStatistics,
  DashboardStatisticsResponse,
} from '@/types/dashboard';
import type { DateRange } from '@/types/date-range';
import { formatISODate } from '@/lib/date-range-utils';
import { useDateRangeOptional } from '@/contexts/DateRangeContext';

// ============================================================
// Types
// ============================================================

/**
 * 統計查詢參數
 */
export interface DashboardStatisticsParams {
  /** 日期範圍 */
  dateRange?: DateRange;
  /** 城市代碼列表 */
  cities?: string[];
}

/**
 * API 查詢參數（內部使用）
 */
interface ApiQueryParams {
  startDate?: string;
  endDate?: string;
  cities?: string;
}

// ============================================================
// API Client
// ============================================================

/**
 * 獲取儀表板統計數據
 * @param params - 查詢參數
 * @returns API 響應
 */
async function fetchDashboardStatistics(
  params: ApiQueryParams
): Promise<DashboardStatistics> {
  const searchParams = new URLSearchParams();

  if (params.startDate) {
    // 轉換為 ISO 8601 datetime 格式（API 驗證需要）
    searchParams.set('startDate', `${params.startDate}T00:00:00.000Z`);
  }
  if (params.endDate) {
    searchParams.set('endDate', `${params.endDate}T23:59:59.999Z`);
  }
  if (params.cities) {
    searchParams.set('cities', params.cities);
  }

  const queryString = searchParams.toString();
  const url = queryString
    ? `/api/dashboard/statistics?${queryString}`
    : '/api/dashboard/statistics';

  const response = await fetch(url);
  const result: DashboardStatisticsResponse = await response.json();

  if (!result.success) {
    throw new Error(result.error || '獲取統計數據失敗');
  }

  if (!result.data) {
    throw new Error('統計數據為空');
  }

  return result.data;
}

// ============================================================
// Query Keys
// ============================================================

export const dashboardStatisticsKeys = {
  all: ['dashboardStatistics'] as const,
  statistics: (params: ApiQueryParams) =>
    ['dashboardStatistics', params] as const,
};

// ============================================================
// Hooks
// ============================================================

/**
 * 儀表板統計 Hook
 * 獲取儀表板統計數據，自動整合日期範圍 Context
 *
 * @param options - 額外選項
 * @returns React Query 結果
 *
 * @example
 * ```typescript
 * // 使用 DateRangeContext
 * const { data, isLoading, error } = useDashboardStatistics()
 *
 * // 手動指定日期範圍
 * const { data } = useDashboardStatistics({
 *   dateRange: {
 *     startDate: new Date('2025-01-01'),
 *     endDate: new Date('2025-01-31'),
 *   }
 * })
 * ```
 */
export function useDashboardStatistics(
  options: DashboardStatisticsParams = {}
) {
  // 從 Context 獲取日期範圍（可選）
  const dateRangeContext = useDateRangeOptional();
  const dateRange = options.dateRange || dateRangeContext?.dateRange;

  // 構建 API 參數
  const apiParams: ApiQueryParams = {
    startDate: dateRange ? formatISODate(dateRange.startDate) : undefined,
    endDate: dateRange ? formatISODate(dateRange.endDate) : undefined,
    cities: options.cities?.join(','),
  };

  return useQuery({
    queryKey: dashboardStatisticsKeys.statistics(apiParams),
    queryFn: () => fetchDashboardStatistics(apiParams),
    staleTime: 5 * 60 * 1000, // 5 分鐘後標記為過時（與後端快取一致）
    refetchOnWindowFocus: true, // 視窗聚焦時刷新
    retry: 2, // 失敗重試 2 次
  });
}

/**
 * 刷新儀表板統計 Hook
 * 提供手動刷新統計數據的功能
 *
 * @returns 刷新函數
 *
 * @example
 * ```typescript
 * const refresh = useRefreshDashboardStatistics()
 * // 手動刷新
 * refresh()
 * ```
 */
export function useRefreshDashboardStatistics() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: dashboardStatisticsKeys.all });
  };
}

/**
 * 使用獨立日期範圍的統計 Hook
 * 不依賴 DateRangeContext，直接使用傳入的日期範圍
 *
 * @param dateRange - 日期範圍
 * @param cities - 城市代碼列表
 * @returns React Query 結果
 */
export function useDashboardStatisticsWithRange(
  dateRange: DateRange,
  cities?: string[]
) {
  const apiParams: ApiQueryParams = {
    startDate: formatISODate(dateRange.startDate),
    endDate: formatISODate(dateRange.endDate),
    cities: cities?.join(','),
  };

  return useQuery({
    queryKey: dashboardStatisticsKeys.statistics(apiParams),
    queryFn: () => fetchDashboardStatistics(apiParams),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 2,
  });
}
