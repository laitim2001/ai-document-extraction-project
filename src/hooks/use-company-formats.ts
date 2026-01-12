/**
 * @fileoverview 公司格式列表 Hook
 * @description
 *   提供獲取公司文件格式列表的功能，支援篩選和排序。
 *   用於 Story 16-1 格式列表 Tab。
 *
 * @module src/hooks/use-company-formats
 * @since Epic 16 - Story 16.1
 * @lastModified 2026-01-12
 *
 * @dependencies
 *   - @tanstack/react-query - 數據獲取和緩存
 *   - @/types/document-format - 類型定義
 */

import { useQuery } from '@tanstack/react-query';
import type {
  DocumentFormatListItem,
  DocumentType,
  DocumentSubtype,
  FormatListResponse,
} from '@/types/document-format';

// ============================================================================
// Types
// ============================================================================

/**
 * useCompanyFormats Hook 參數
 */
export interface UseCompanyFormatsParams {
  /** 公司 ID（必要） */
  companyId: string;
  /** 文件類型篩選 */
  documentType?: DocumentType | null;
  /** 文件子類型篩選 */
  documentSubtype?: DocumentSubtype | null;
  /** 排序欄位 */
  sortBy?: 'fileCount' | 'updatedAt';
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc';
  /** 頁碼 */
  page?: number;
  /** 每頁數量 */
  limit?: number;
  /** 是否啟用查詢 */
  enabled?: boolean;
}

/**
 * useCompanyFormats Hook 返回值
 */
export interface UseCompanyFormatsResult {
  /** 格式列表 */
  formats: DocumentFormatListItem[];
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
 * 獲取公司格式列表 API
 */
async function fetchCompanyFormats(
  params: UseCompanyFormatsParams
): Promise<FormatListResponse> {
  const searchParams = new URLSearchParams();

  // 必要參數
  searchParams.set('companyId', params.companyId);

  // 可選篩選參數
  if (params.documentType) {
    searchParams.set('documentType', params.documentType);
  }
  if (params.documentSubtype) {
    searchParams.set('documentSubtype', params.documentSubtype);
  }

  // 排序參數
  searchParams.set('sortBy', params.sortBy || 'fileCount');
  searchParams.set('sortOrder', params.sortOrder || 'desc');

  // 分頁參數
  searchParams.set('page', String(params.page || 1));
  searchParams.set('limit', String(params.limit || 20));

  const response = await fetch(`/api/v1/formats?${searchParams.toString()}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `獲取格式列表失敗 (${response.status})`);
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || '獲取格式列表失敗');
  }

  return result.data as FormatListResponse;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * 獲取公司格式列表的 Hook
 *
 * @description
 *   使用 React Query 獲取並緩存公司的文件格式列表。
 *   支援篩選、排序和分頁功能。
 *
 * @param params - Hook 參數
 * @returns 格式列表數據和狀態
 *
 * @example
 * ```tsx
 * const { formats, isLoading, pagination } = useCompanyFormats({
 *   companyId: 'company-123',
 *   sortBy: 'fileCount',
 *   sortOrder: 'desc',
 * });
 * ```
 */
export function useCompanyFormats(
  params: UseCompanyFormatsParams
): UseCompanyFormatsResult {
  const { companyId, enabled = true, ...queryParams } = params;

  const query = useQuery({
    queryKey: ['formats', 'company', companyId, queryParams],
    queryFn: () => fetchCompanyFormats({ companyId, ...queryParams }),
    enabled: enabled && !!companyId,
    staleTime: 5 * 60 * 1000, // 5 分鐘
    gcTime: 10 * 60 * 1000, // 10 分鐘
  });

  return {
    formats: query.data?.formats ?? [],
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
