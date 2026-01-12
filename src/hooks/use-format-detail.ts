/**
 * @fileoverview 格式詳情 Hook
 * @description
 *   提供獲取單一格式詳情的功能。
 *   用於 Story 16-2 格式詳情頁面。
 *
 * @module src/hooks/use-format-detail
 * @since Epic 16 - Story 16.2
 * @lastModified 2026-01-12
 *
 * @dependencies
 *   - @tanstack/react-query - 數據獲取和緩存
 *   - @/types/document-format - 類型定義
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { DocumentFormatDetail } from '@/types/document-format';

// ============================================================================
// Types
// ============================================================================

/**
 * 格式更新輸入
 */
export interface UpdateFormatInput {
  name?: string;
  features?: {
    hasLineItems?: boolean;
    hasHeaderLogo?: boolean;
    currency?: string;
    language?: string;
    typicalFields?: string[];
    layoutPattern?: string;
  };
}

/**
 * useFormatDetail Hook 返回值
 */
export interface UseFormatDetailResult {
  /** 格式詳情 */
  format: DocumentFormatDetail | null;
  /** 是否載入中 */
  isLoading: boolean;
  /** 錯誤資訊 */
  error: Error | null;
  /** 重新獲取數據 */
  refetch: () => void;
  /** 是否正在重新獲取 */
  isFetching: boolean;
  /** 更新格式 */
  updateFormat: (data: UpdateFormatInput) => Promise<DocumentFormatDetail>;
  /** 是否正在更新 */
  isUpdating: boolean;
}

// ============================================================================
// API 函數
// ============================================================================

/**
 * 獲取格式詳情 API
 */
async function fetchFormatDetail(formatId: string): Promise<DocumentFormatDetail> {
  const response = await fetch(`/api/v1/formats/${formatId}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.detail || `獲取格式詳情失敗 (${response.status})`);
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error?.detail || '獲取格式詳情失敗');
  }

  return result.data as DocumentFormatDetail;
}

/**
 * 更新格式 API
 */
async function updateFormatApi(
  formatId: string,
  data: UpdateFormatInput
): Promise<DocumentFormatDetail> {
  const response = await fetch(`/api/v1/formats/${formatId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.detail || `更新格式失敗 (${response.status})`);
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error?.detail || '更新格式失敗');
  }

  return result.data as DocumentFormatDetail;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * 獲取格式詳情的 Hook
 *
 * @description
 *   使用 React Query 獲取並緩存格式詳情。
 *   支援更新格式資訊。
 *
 * @param formatId - 格式 ID
 * @returns 格式詳情數據和操作
 *
 * @example
 * ```tsx
 * const { format, isLoading, updateFormat } = useFormatDetail('format-123');
 *
 * const handleSave = async () => {
 *   await updateFormat({ name: '新名稱' });
 * };
 * ```
 */
export function useFormatDetail(formatId: string): UseFormatDetailResult {
  const queryClient = useQueryClient();

  // 查詢格式詳情
  const query = useQuery({
    queryKey: ['format', formatId],
    queryFn: () => fetchFormatDetail(formatId),
    enabled: !!formatId,
    staleTime: 5 * 60 * 1000, // 5 分鐘
    gcTime: 10 * 60 * 1000, // 10 分鐘
  });

  // 更新格式
  const mutation = useMutation({
    mutationFn: (data: UpdateFormatInput) => updateFormatApi(formatId, data),
    onSuccess: (data) => {
      // 更新快取
      queryClient.setQueryData(['format', formatId], data);
      // 使列表快取失效
      queryClient.invalidateQueries({ queryKey: ['formats'] });
    },
  });

  return {
    format: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
    isFetching: query.isFetching,
    updateFormat: mutation.mutateAsync,
    isUpdating: mutation.isPending,
  };
}
