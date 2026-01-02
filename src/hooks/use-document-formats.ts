'use client';

/**
 * @fileoverview Document Format Options React Query Hook
 * @description
 *   提供文件格式選項的 React Query 封裝，用於下拉選單：
 *   - 按公司 ID 過濾格式
 *   - 支援分頁和搜尋
 *   - 提供格式選項列表
 *
 * @module src/hooks/use-document-formats
 * @since Epic 13 - Story 13.3
 * @lastModified 2026-01-02
 *
 * @features
 *   - 按公司過濾格式
 *   - 5 分鐘自動快取
 *   - 類型安全的 API 響應
 *
 * @dependencies
 *   - @tanstack/react-query - React Query
 *
 * @related
 *   - src/app/api/v1/formats/route.ts - Formats API
 *   - src/types/document-format.ts - 類型定義
 */

import { useQuery } from '@tanstack/react-query';

// ============================================================
// Types
// ============================================================

/**
 * 文件格式選項
 */
export interface DocumentFormatOption {
  id: string;
  companyId: string;
  companyName: string;
  documentType: string;
  documentSubtype: string | null;
  name: string;
  fileCount: number;
}

/**
 * API 響應結構
 */
interface FormatsApiResponse {
  success: boolean;
  data: {
    formats: DocumentFormatOption[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

/**
 * Hook 參數
 */
export interface UseDocumentFormatsParams {
  /** 按公司 ID 過濾 */
  companyId?: string;
  /** 是否啟用查詢 */
  enabled?: boolean;
}

// ============================================================
// Query Keys
// ============================================================

export const documentFormatsQueryKeys = {
  all: ['document-formats'] as const,
  options: (companyId?: string) => ['document-formats', 'options', companyId] as const,
};

// ============================================================
// Constants
// ============================================================

/** 資料快取時間（毫秒） */
const STALE_TIME_MS = 5 * 60 * 1000; // 5 分鐘

// ============================================================
// Hook
// ============================================================

/**
 * 獲取文件格式選項（用於下拉選單）
 *
 * @description
 *   提供文件格式選項查詢功能，支援按公司過濾。
 *   適用於 ConfigSelector 組件中的格式選擇。
 *
 * @param params - 查詢參數
 * @returns Query 結果和格式選項
 *
 * @example
 * ```tsx
 * const { formats, isLoading } = useDocumentFormatOptions({
 *   companyId: selectedCompanyId,
 *   enabled: !!selectedCompanyId,
 * });
 * ```
 */
export function useDocumentFormatOptions(params: UseDocumentFormatsParams = {}) {
  const { companyId, enabled = true } = params;

  const query = useQuery<FormatsApiResponse>({
    queryKey: documentFormatsQueryKeys.options(companyId),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      searchParams.set('limit', '100');
      if (companyId) searchParams.set('companyId', companyId);

      const response = await fetch(`/api/v1/formats?${searchParams}`);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to fetch document formats');
      }

      return response.json();
    },
    staleTime: STALE_TIME_MS,
    enabled,
  });

  return {
    // Query 狀態
    ...query,

    // 資料存取
    formats: query.data?.data?.formats ?? [],

    // 轉換為選項格式
    options: (query.data?.data?.formats ?? []).map((format) => ({
      value: format.id,
      label: format.name || `${format.documentType}${format.documentSubtype ? ` - ${format.documentSubtype}` : ''}`,
      description: `${format.companyName} (${format.fileCount} files)`,
    })),
  };
}
