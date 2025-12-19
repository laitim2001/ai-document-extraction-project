/**
 * @fileoverview Forwarder List Hook
 * @description
 *   提供貨代商列表查詢功能：
 *   - 使用 React Query 進行資料獲取和快取
 *   - 支援自動刷新
 *   - 整合 DashboardFilterContext
 *
 * @module src/hooks/useForwarderList
 * @since Epic 4 - Story 4.1 (映射規則列表與查看)
 * @lastModified 2025-12-19 (Story 7.3 更新)
 *
 * @dependencies
 *   - @tanstack/react-query - 資料查詢和快取
 *   - @/types/forwarder-filter - 類型定義
 *
 * @related
 *   - src/app/api/forwarders/list/route.ts - API 端點
 *   - src/components/dashboard/ForwarderMultiSelect.tsx - UI 組件
 */

import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import type {
  ForwarderOption,
  ForwarderListResponse,
} from '@/types/forwarder-filter';

// ============================================================
// Re-export Types for backward compatibility
// ============================================================

export type { ForwarderOption };

// ============================================================
// Constants
// ============================================================

/**
 * Query key for forwarder list
 */
export const FORWARDER_LIST_QUERY_KEY = ['forwarders', 'list'] as const;

/**
 * Stale time for forwarder list (5 minutes)
 */
const STALE_TIME = 5 * 60 * 1000;

/**
 * Cache time for forwarder list (10 minutes)
 */
const CACHE_TIME = 10 * 60 * 1000;

// ============================================================
// Hook Options
// ============================================================

/**
 * Hook 選項
 */
interface UseForwarderListOptions {
  /** 是否只獲取啟用的 Forwarder（預設 true） */
  activeOnly?: boolean;
  /** 是否啟用查詢（預設 true） */
  enabled?: boolean;
  /** 是否在 window focus 時重新獲取 */
  refetchOnWindowFocus?: boolean;
  /** React Query 額外選項 */
  queryOptions?: Omit<
    UseQueryOptions<ForwarderOption[], Error>,
    'queryKey' | 'queryFn' | 'enabled'
  >;
}

// ============================================================
// API Functions
// ============================================================

/**
 * 獲取貨代商列表（使用新的 /api/forwarders/list 端點）
 * @returns 貨代商列表
 */
async function fetchForwarderListFromApi(): Promise<ForwarderOption[]> {
  const response = await fetch('/api/forwarders/list', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.detail || 'Failed to fetch forwarder list');
  }

  const data: ForwarderListResponse = await response.json();

  if (!data.success) {
    throw new Error('Failed to fetch forwarder list');
  }

  return data.data;
}

// Note: Legacy function removed. The new /api/forwarders/list endpoint
// always returns active-only forwarders with simplified response.

// ============================================================
// Hook
// ============================================================

/**
 * Forwarder 列表 Hook
 * @description 獲取貨代商列表，支援快取和自動刷新
 * @param options - 查詢選項
 * @returns React Query 結果
 *
 * @example
 * ```tsx
 * function ForwarderSelect({ value, onChange }) {
 *   const { data: forwarders, isLoading } = useForwarderList()
 *
 *   return (
 *     <Select value={value} onValueChange={onChange}>
 *       <SelectTrigger>
 *         <SelectValue placeholder="選擇 Forwarder" />
 *       </SelectTrigger>
 *       <SelectContent>
 *         {forwarders?.map((fw) => (
 *           <SelectItem key={fw.id} value={fw.id}>
 *             {fw.displayName} ({fw.code})
 *           </SelectItem>
 *         ))}
 *       </SelectContent>
 *     </Select>
 *   )
 * }
 * ```
 */
export function useForwarderList(options?: UseForwarderListOptions) {
  const {
    // Note: activeOnly is kept for API compatibility but new endpoint returns active-only by default
    activeOnly: _activeOnly = true,
    enabled = true,
    refetchOnWindowFocus = false,
    queryOptions,
  } = options ?? {};

  return useQuery<ForwarderOption[], Error>({
    queryKey: FORWARDER_LIST_QUERY_KEY,
    queryFn: fetchForwarderListFromApi,
    enabled,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    refetchOnWindowFocus,
    ...queryOptions,
  });
}

// ============================================================
// Query Key Factory
// ============================================================

/**
 * Query Key 工廠函數
 */
export const forwarderListKeys = {
  all: ['forwarders'] as const,
  list: () => FORWARDER_LIST_QUERY_KEY,
  listWithFilter: (activeOnly: boolean) =>
    [...forwarderListKeys.all, { activeOnly }] as const,
};

// ============================================================
// Helper Functions
// ============================================================

/**
 * 根據 ID 獲取單個貨代商
 * @param forwarders - 貨代商列表
 * @param id - 貨代商 ID
 * @returns 貨代商物件或 undefined
 */
export function getForwarderById(
  forwarders: ForwarderOption[],
  id: string
): ForwarderOption | undefined {
  return forwarders.find((f) => f.id === id);
}

/**
 * 根據 IDs 獲取多個貨代商
 * @param forwarders - 貨代商列表
 * @param ids - 貨代商 ID 列表
 * @returns 貨代商物件列表
 */
export function getForwardersByIds(
  forwarders: ForwarderOption[],
  ids: string[]
): ForwarderOption[] {
  return forwarders.filter((f) => ids.includes(f.id));
}

/**
 * 根據 Code 獲取貨代商
 * @param forwarders - 貨代商列表
 * @param code - 貨代商 Code
 * @returns 貨代商物件或 undefined
 */
export function getForwarderByCode(
  forwarders: ForwarderOption[],
  code: string
): ForwarderOption | undefined {
  return forwarders.find((f) => f.code === code);
}
