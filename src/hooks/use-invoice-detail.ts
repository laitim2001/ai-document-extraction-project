/**
 * @fileoverview 發票詳情數據獲取 Hook
 * @description
 *   提供發票詳情頁面所需的數據獲取功能：
 *   - 文件基本資訊
 *   - 提取欄位
 *   - 處理追蹤
 *   - 自動輪詢（處理中狀態）
 *
 * @module src/hooks/use-invoice-detail
 * @author Development Team
 * @since Epic 13 - Story 13-8 (Invoice Detail Page)
 * @lastModified 2026-01-18
 *
 * @features
 *   - React Query 數據管理
 *   - 處理中狀態自動輪詢
 *   - 樂觀更新支援
 *   - 錯誤處理
 *
 * @dependencies
 *   - @tanstack/react-query - 數據管理
 *   - @/types/document - 文件類型
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { DocumentSourceType } from '@prisma/client'
import type { ExtractedField } from '@/types/extracted-field'
import type { DocumentStatusKey } from '@/lib/document-status'

// ============================================================
// Types
// ============================================================

interface ProcessingStep {
  step: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  startedAt?: string | Date | null
  completedAt?: string | Date | null
  error?: string | null
  duration?: number | null
}

interface DocumentDetail {
  id: string
  fileName: string
  originalFileName: string
  mimeType: string
  fileSize: number
  blobUrl: string | null
  status: DocumentStatusKey | string
  overallConfidence: number | null
  processingPath: string | null
  sourceType: DocumentSourceType | null
  createdAt: string
  updatedAt: string
  processingStartedAt: string | null
  processingCompletedAt: string | null
  errorMessage: string | null
  uploadedBy: {
    id: string
    name: string | null
    email: string | null
  } | null
  company: {
    id: string
    name: string
    code: string
  } | null
  city: {
    id: string
    name: string
    code: string
  } | null
  extractedFields: ExtractedField[] | null
  processingSteps: ProcessingStep[] | null
}

interface DocumentDetailResponse {
  success: boolean
  data: DocumentDetail
}

interface UseInvoiceDetailResult {
  /** 文件詳情數據 */
  document: DocumentDetail | null
  /** 是否正在載入 */
  isLoading: boolean
  /** 是否正在重新獲取 */
  isRefetching: boolean
  /** 是否有錯誤 */
  isError: boolean
  /** 錯誤對象 */
  error: Error | null
  /** 手動刷新函數 */
  refetch: () => void
}

// ============================================================
// Constants
// ============================================================

/** 處理中狀態的輪詢間隔（毫秒） */
const PROCESSING_POLL_INTERVAL = 3000

/** 處理中的狀態列表 */
const PROCESSING_STATUSES = [
  'UPLOADING',
  'OCR_PROCESSING',
  'MAPPING_PROCESSING',
  'PENDING_REVIEW',
  'IN_REVIEW',
]

// ============================================================
// Hook
// ============================================================

/**
 * 發票詳情數據獲取 Hook
 *
 * @description
 *   獲取單一發票的完整詳情，包含文件資訊、提取欄位和處理步驟。
 *   處理中狀態會自動輪詢更新。
 *
 * @param documentId - 文件 ID
 * @returns UseInvoiceDetailResult
 *
 * @example
 * ```tsx
 * const { document, isLoading, error, refetch } = useInvoiceDetail(id)
 *
 * if (isLoading) return <Loading />
 * if (error) return <Error />
 *
 * return <InvoiceDetail document={document} />
 * ```
 */
export function useInvoiceDetail(documentId: string): UseInvoiceDetailResult {
  const {
    data,
    isLoading,
    isRefetching,
    isError,
    error,
    refetch,
  } = useQuery<DocumentDetailResponse, Error>({
    queryKey: ['document-detail', documentId],
    queryFn: async () => {
      const response = await fetch(`/api/documents/${documentId}?include=extractedFields,processingSteps,uploadedBy,company,city`)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `Failed to fetch document: ${response.status}`)
      }

      return response.json()
    },
    enabled: !!documentId,
    staleTime: 30000, // 30 秒內視為新鮮數據
    gcTime: 5 * 60 * 1000, // 5 分鐘後垃圾回收

    // 處理中狀態自動輪詢
    refetchInterval: (query) => {
      const status = query.state.data?.data?.status
      if (status && PROCESSING_STATUSES.includes(status)) {
        return PROCESSING_POLL_INTERVAL
      }
      return false
    },
  })

  return {
    document: data?.data || null,
    isLoading,
    isRefetching,
    isError,
    error: error || null,
    refetch: () => {
      refetch()
    },
  }
}

/**
 * 使發票詳情緩存失效
 *
 * @description
 *   用於在操作後強制刷新緩存
 *
 * @param documentId - 文件 ID
 */
export function useInvalidateInvoiceDetail() {
  const client = useQueryClient()

  return (documentId: string) => {
    client.invalidateQueries({
      queryKey: ['document-detail', documentId],
    })
    // 同時使列表緩存失效
    client.invalidateQueries({
      queryKey: ['documents'],
    })
  }
}
