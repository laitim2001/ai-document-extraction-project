/**
 * @fileoverview 審核詳情資料 Hook
 * @description
 *   使用 React Query 獲取審核詳情資料，包含：
 *   - 文件基本資訊
 *   - Forwarder 資訊
 *   - 提取結果欄位
 *   - 處理隊列狀態
 *
 * @module src/hooks/useReviewDetail
 * @since Epic 3 - Story 3.2 (並排 PDF 審核介面)
 * @lastModified 2025-12-18
 */

import { useQuery } from '@tanstack/react-query'
import type {
  ReviewDetailData,
  ReviewDetailResponse,
  ReviewDetailErrorResponse,
} from '@/types/review'

// ============================================================
// Types
// ============================================================

type ReviewDetailResult = ReviewDetailResponse | ReviewDetailErrorResponse

// ============================================================
// API Function
// ============================================================

/**
 * 獲取審核詳情資料
 *
 * @param documentId - 文件 ID
 * @returns ReviewDetailData（已展開的資料）
 * @throws 當 API 回傳錯誤時拋出
 */
async function fetchReviewDetail(documentId: string): Promise<ReviewDetailData> {
  const response = await fetch(`/api/review/${documentId}`)
  const result: ReviewDetailResult = await response.json()

  if (!result.success) {
    throw new Error(
      (result as ReviewDetailErrorResponse).error?.detail || 'Failed to fetch review detail'
    )
  }

  // 直接返回展開的資料，方便使用
  return (result as ReviewDetailResponse).data
}

// ============================================================
// Hook
// ============================================================

/**
 * 審核詳情 Hook
 *
 * @param documentId - 文件 ID
 * @returns React Query 查詢結果
 *
 * @example
 * ```tsx
 * function ReviewDetailPage({ id }: { id: string }) {
 *   const { data, isLoading, error } = useReviewDetail(id)
 *
 *   if (isLoading) return <Skeleton />
 *   if (error) return <ErrorMessage error={error} />
 *   if (!data) return null
 *
 *   return <ReviewPanel data={data} />
 * }
 * ```
 */
export function useReviewDetail(documentId: string) {
  return useQuery({
    queryKey: ['reviewDetail', documentId],
    queryFn: () => fetchReviewDetail(documentId),
    enabled: !!documentId,
    staleTime: 5 * 60 * 1000, // 5 分鐘
    refetchOnWindowFocus: false,
    retry: 1,
  })
}
