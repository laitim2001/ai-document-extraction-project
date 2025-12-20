/**
 * @fileoverview 變更歷史 Hooks
 * @description
 *   使用 React Query 管理資源變更歷史功能，包含：
 *   - 變更歷史列表查詢
 *   - 時間線格式查詢
 *   - 版本快照查詢
 *   - 版本比較查詢
 *   - 自動快取管理
 *
 * @module src/hooks/useChangeHistory
 * @since Epic 8 - Story 8.2 (數據變更追蹤)
 * @lastModified 2025-12-20
 *
 * @dependencies
 *   - @tanstack/react-query - React Query
 *   - @/types/change-tracking - 類型定義
 */

import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import type {
  TrackedModel,
  TimelineItem,
  VersionSnapshot,
  VersionCompareResult,
  HistoryQueryResult,
} from '@/types/change-tracking';

// ============================================================
// Types
// ============================================================

/**
 * API 錯誤響應
 */
interface HistoryErrorResponse {
  success: false;
  error: {
    type: string;
    title: string;
    status: number;
    detail: string;
  };
}

/**
 * 歷史查詢 Hook 選項
 */
interface UseHistoryOptions {
  /** 返回數量限制 */
  limit?: number;
  /** 分頁偏移 */
  offset?: number;
  /** React Query 選項 */
  queryOptions?: Omit<
    UseQueryOptions<HistoryQueryResult, Error>,
    'queryKey' | 'queryFn' | 'enabled'
  >;
}

/**
 * 時間線 Hook 選項
 */
interface UseTimelineOptions {
  /** 返回數量限制 */
  limit?: number;
  /** React Query 選項 */
  queryOptions?: Omit<
    UseQueryOptions<TimelineItem[], Error>,
    'queryKey' | 'queryFn' | 'enabled'
  >;
}

/**
 * 版本快照 Hook 選項
 */
interface UseVersionSnapshotOptions {
  /** React Query 選項 */
  queryOptions?: Omit<
    UseQueryOptions<VersionSnapshot, Error>,
    'queryKey' | 'queryFn' | 'enabled'
  >;
}

/**
 * 版本比較 Hook 選項
 */
interface UseHistoryCompareOptions {
  /** React Query 選項 */
  queryOptions?: Omit<
    UseQueryOptions<VersionCompareResult, Error>,
    'queryKey' | 'queryFn' | 'enabled'
  >;
}

// ============================================================
// API Functions
// ============================================================

/**
 * 獲取變更歷史列表
 *
 * @param resourceType - 資源類型
 * @param resourceId - 資源 ID
 * @param limit - 返回數量限制
 * @param offset - 分頁偏移
 * @returns 歷史列表響應
 * @throws 當 API 回傳錯誤時拋出
 */
async function fetchHistory(
  resourceType: TrackedModel,
  resourceId: string,
  limit: number = 20,
  offset: number = 0
): Promise<HistoryQueryResult> {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  });

  const response = await fetch(
    `/api/history/${resourceType}/${resourceId}?${params}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  const result = await response.json();

  if (!response.ok || !result.success) {
    const errorResponse = result as HistoryErrorResponse;
    throw new Error(errorResponse.error?.detail || 'Failed to fetch history');
  }

  return {
    data: result.data,
    pagination: result.meta?.pagination || {
      total: result.data.length,
      limit,
      offset,
      hasMore: false,
    },
  };
}

/**
 * 獲取時間線格式的歷史
 *
 * @param resourceType - 資源類型
 * @param resourceId - 資源 ID
 * @param limit - 返回數量限制
 * @returns 時間線項目列表
 * @throws 當 API 回傳錯誤時拋出
 */
async function fetchTimeline(
  resourceType: TrackedModel,
  resourceId: string,
  limit: number = 20
): Promise<TimelineItem[]> {
  const params = new URLSearchParams({
    limit: limit.toString(),
    format: 'timeline',
  });

  const response = await fetch(
    `/api/history/${resourceType}/${resourceId}?${params}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  const result = await response.json();

  if (!response.ok || !result.success) {
    const errorResponse = result as HistoryErrorResponse;
    throw new Error(errorResponse.error?.detail || 'Failed to fetch timeline');
  }

  return result.data;
}

/**
 * 獲取特定版本快照
 *
 * @param resourceType - 資源類型
 * @param resourceId - 資源 ID
 * @param version - 版本號
 * @returns 版本快照
 * @throws 當 API 回傳錯誤時拋出
 */
async function fetchVersionSnapshot(
  resourceType: TrackedModel,
  resourceId: string,
  version: number
): Promise<VersionSnapshot> {
  const params = new URLSearchParams({
    version: version.toString(),
  });

  const response = await fetch(
    `/api/history/${resourceType}/${resourceId}?${params}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  const result = await response.json();

  if (!response.ok || !result.success) {
    const errorResponse = result as HistoryErrorResponse;
    throw new Error(
      errorResponse.error?.detail || 'Failed to fetch version snapshot'
    );
  }

  return result.data;
}

/**
 * 比較兩個版本
 *
 * @param resourceType - 資源類型
 * @param resourceId - 資源 ID
 * @param fromVersion - 起始版本號
 * @param toVersion - 目標版本號
 * @returns 版本比較結果
 * @throws 當 API 回傳錯誤時拋出
 */
async function fetchHistoryCompare(
  resourceType: TrackedModel,
  resourceId: string,
  fromVersion: number,
  toVersion: number
): Promise<VersionCompareResult> {
  const params = new URLSearchParams({
    fromVersion: fromVersion.toString(),
    toVersion: toVersion.toString(),
  });

  const response = await fetch(
    `/api/history/${resourceType}/${resourceId}/compare?${params}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  const result = await response.json();

  if (!response.ok || !result.success) {
    const errorResponse = result as HistoryErrorResponse;
    throw new Error(errorResponse.error?.detail || 'Failed to compare versions');
  }

  return result.data;
}

// ============================================================
// Hooks
// ============================================================

/**
 * 變更歷史列表查詢 Hook
 *
 * @param resourceType - 資源類型
 * @param resourceId - 資源 ID
 * @param options - Hook 選項
 * @returns React Query 結果
 *
 * @example
 * ```tsx
 * function HistoryPage({ resourceType, resourceId }: Props) {
 *   const { data, isLoading, error } = useChangeHistory(
 *     resourceType,
 *     resourceId
 *   )
 *
 *   if (isLoading) return <Skeleton />
 *   if (error) return <ErrorMessage message={error.message} />
 *
 *   return <HistoryList items={data?.data} />
 * }
 * ```
 */
export function useChangeHistory(
  resourceType: TrackedModel | undefined,
  resourceId: string | undefined,
  options?: UseHistoryOptions
) {
  const { limit = 20, offset = 0, queryOptions } = options ?? {};

  return useQuery<HistoryQueryResult, Error>({
    queryKey: ['change-history', resourceType, resourceId, { limit, offset }],
    queryFn: () => fetchHistory(resourceType!, resourceId!, limit, offset),
    enabled: !!resourceType && !!resourceId,
    staleTime: 30 * 1000, // 30 秒
    gcTime: 5 * 60 * 1000, // 5 分鐘
    ...queryOptions,
  });
}

/**
 * 時間線格式歷史查詢 Hook
 *
 * @param resourceType - 資源類型
 * @param resourceId - 資源 ID
 * @param options - Hook 選項
 * @returns React Query 結果
 *
 * @example
 * ```tsx
 * function TimelineView({ resourceType, resourceId }: Props) {
 *   const { data, isLoading } = useChangeTimeline(resourceType, resourceId)
 *
 *   return <ChangeHistoryTimeline items={data ?? []} isLoading={isLoading} />
 * }
 * ```
 */
export function useChangeTimeline(
  resourceType: TrackedModel | undefined,
  resourceId: string | undefined,
  options?: UseTimelineOptions
) {
  const { limit = 20, queryOptions } = options ?? {};

  return useQuery<TimelineItem[], Error>({
    queryKey: ['change-timeline', resourceType, resourceId, { limit }],
    queryFn: () => fetchTimeline(resourceType!, resourceId!, limit),
    enabled: !!resourceType && !!resourceId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    ...queryOptions,
  });
}

/**
 * 版本快照查詢 Hook
 *
 * @param resourceType - 資源類型
 * @param resourceId - 資源 ID
 * @param version - 版本號
 * @param enabled - 是否啟用查詢
 * @param options - Hook 選項
 * @returns React Query 結果
 *
 * @example
 * ```tsx
 * function VersionDetail({ resourceType, resourceId, version }: Props) {
 *   const { data, isLoading } = useVersionSnapshot(
 *     resourceType,
 *     resourceId,
 *     version
 *   )
 *
 *   return <SnapshotViewer snapshot={data} isLoading={isLoading} />
 * }
 * ```
 */
export function useVersionSnapshot(
  resourceType: TrackedModel | undefined,
  resourceId: string | undefined,
  version: number | undefined,
  enabled: boolean = true,
  options?: UseVersionSnapshotOptions
) {
  const { queryOptions } = options ?? {};

  return useQuery<VersionSnapshot, Error>({
    queryKey: ['change-version-snapshot', resourceType, resourceId, version],
    queryFn: () => fetchVersionSnapshot(resourceType!, resourceId!, version!),
    enabled: enabled && !!resourceType && !!resourceId && version !== undefined,
    staleTime: 60 * 1000, // 1 分鐘 - 快照不會變
    gcTime: 10 * 60 * 1000, // 10 分鐘
    ...queryOptions,
  });
}

/**
 * 版本比較查詢 Hook
 *
 * @param resourceType - 資源類型
 * @param resourceId - 資源 ID
 * @param fromVersion - 起始版本號
 * @param toVersion - 目標版本號
 * @param enabled - 是否啟用查詢
 * @param options - Hook 選項
 * @returns React Query 結果
 *
 * @example
 * ```tsx
 * function CompareDialog({ resourceType, resourceId, from, to, open }: Props) {
 *   const { data, isLoading, error } = useHistoryCompare(
 *     resourceType,
 *     resourceId,
 *     from,
 *     to,
 *     open
 *   )
 *
 *   return (
 *     <HistoryVersionCompareDialog
 *       compareData={data}
 *       isLoading={isLoading}
 *       error={error}
 *     />
 *   )
 * }
 * ```
 */
export function useHistoryCompare(
  resourceType: TrackedModel | undefined,
  resourceId: string | undefined,
  fromVersion: number | undefined,
  toVersion: number | undefined,
  enabled: boolean = true,
  options?: UseHistoryCompareOptions
) {
  const { queryOptions } = options ?? {};

  return useQuery<VersionCompareResult, Error>({
    queryKey: [
      'change-history-compare',
      resourceType,
      resourceId,
      fromVersion,
      toVersion,
    ],
    queryFn: () =>
      fetchHistoryCompare(resourceType!, resourceId!, fromVersion!, toVersion!),
    enabled:
      enabled &&
      !!resourceType &&
      !!resourceId &&
      fromVersion !== undefined &&
      toVersion !== undefined,
    staleTime: 10 * 1000, // 10 秒
    gcTime: 60 * 1000, // 1 分鐘
    ...queryOptions,
  });
}

// ============================================================
// Query Key Factory
// ============================================================

/**
 * Query Key 工廠函數
 * @description 用於外部快取操作
 */
export const changeHistoryKeys = {
  all: ['change-history'] as const,
  list: (resourceType: TrackedModel, resourceId: string) =>
    [...changeHistoryKeys.all, resourceType, resourceId] as const,
  timeline: (resourceType: TrackedModel, resourceId: string) =>
    ['change-timeline', resourceType, resourceId] as const,
  snapshot: (resourceType: TrackedModel, resourceId: string, version: number) =>
    ['change-version-snapshot', resourceType, resourceId, version] as const,
  compare: (
    resourceType: TrackedModel,
    resourceId: string,
    fromVersion: number,
    toVersion: number
  ) =>
    [
      'change-history-compare',
      resourceType,
      resourceId,
      fromVersion,
      toVersion,
    ] as const,
};
