/**
 * @fileoverview 格式關聯文件 Hook
 * @description
 *   提供獲取格式關聯文件列表的功能。
 *   用於 Story 16-2 格式詳情頁面的文件列表 Tab。
 *
 * @module src/hooks/use-format-files
 * @since Epic 16 - Story 16.2
 * @lastModified 2026-01-12
 *
 * @dependencies
 *   - @tanstack/react-query - 數據獲取和緩存
 *   - @/types/document-format - 類型定義
 */

import { useQuery } from '@tanstack/react-query';
import type { FormatLinkedFile, FormatFilesResponse } from '@/types/document-format';

// ============================================================================
// Types
// ============================================================================

/**
 * useFormatFiles Hook 參數
 */
export interface UseFormatFilesParams {
  /** 格式 ID */
  formatId: string;
  /** 頁碼 */
  page?: number;
  /** 每頁數量 */
  limit?: number;
  /** 是否啟用查詢 */
  enabled?: boolean;
}

/**
 * useFormatFiles Hook 返回值
 */
export interface UseFormatFilesResult {
  /** 文件列表 */
  files: FormatLinkedFile[];
  /** 是否載入中 */
  isLoading: boolean;
  /** 錯誤資訊 */
  error: Error | null;
  /** 分頁資訊 */
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  /** 重新獲取數據 */
  refetch: () => void;
  /** 是否正在重新獲取 */
  isFetching: boolean;
}

// ============================================================================
// API 函數
// ============================================================================

/**
 * 獲取格式關聯文件 API
 */
async function fetchFormatFiles(
  params: UseFormatFilesParams
): Promise<FormatFilesResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set('page', String(params.page || 1));
  searchParams.set('limit', String(params.limit || 20));

  const response = await fetch(
    `/api/v1/formats/${params.formatId}/files?${searchParams.toString()}`
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.detail || `獲取文件列表失敗 (${response.status})`);
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error?.detail || '獲取文件列表失敗');
  }

  return result.data as FormatFilesResponse;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * 獲取格式關聯文件的 Hook
 *
 * @description
 *   使用 React Query 獲取並緩存格式關聯的文件列表。
 *   支援分頁功能。
 *
 * @param params - Hook 參數
 * @returns 文件列表數據和狀態
 *
 * @example
 * ```tsx
 * const { files, pagination, isLoading } = useFormatFiles({
 *   formatId: 'format-123',
 *   page: 1,
 *   limit: 10,
 * });
 * ```
 */
export function useFormatFiles(params: UseFormatFilesParams): UseFormatFilesResult {
  const { formatId, enabled = true, ...queryParams } = params;

  const query = useQuery({
    queryKey: ['format', formatId, 'files', queryParams],
    queryFn: () => fetchFormatFiles({ formatId, ...queryParams }),
    enabled: enabled && !!formatId,
    staleTime: 5 * 60 * 1000, // 5 分鐘
    gcTime: 10 * 60 * 1000, // 10 分鐘
  });

  return {
    files: query.data?.files ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
    pagination: query.data?.pagination ?? {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    },
    refetch: query.refetch,
    isFetching: query.isFetching,
  };
}
