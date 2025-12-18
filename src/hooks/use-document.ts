'use client'

/**
 * @fileoverview Single Document React Query Hook
 * @description
 *   提供單個文件詳情的 React Query 封裝：
 *   - 獲取文件完整資訊
 *   - 動態輪詢（處理中時 3s）
 *   - 條件啟用
 *
 * @module src/hooks/use-document
 * @author Development Team
 * @since Epic 2 - Story 2.7 (Processing Status Tracking & Display)
 * @lastModified 2025-12-18
 *
 * @features
 *   - 動態 refetch interval
 *   - 條件查詢
 *   - 類型安全的 API 響應
 *
 * @dependencies
 *   - @tanstack/react-query - React Query
 *   - @/lib/document-status - 狀態配置
 *
 * @related
 *   - src/app/api/documents/[id]/route.ts - Document Detail API
 */

import { useQuery } from '@tanstack/react-query'
import { getStatusConfig } from '@/lib/document-status'
import { documentsQueryKeys } from './use-documents'
import type { DocumentStatus } from '@prisma/client'

// ============================================================
// Types
// ============================================================

/**
 * useDocument 參數
 */
export interface UseDocumentParams {
  /** 文件 ID */
  id: string
  /** 是否啟用查詢 */
  enabled?: boolean
}

/**
 * 文件詳情響應
 */
export interface DocumentDetailResponse {
  success: boolean
  data: {
    id: string
    fileName: string
    fileType: string
    fileExtension: string
    fileSize: number
    filePath: string
    blobName: string
    status: DocumentStatus
    errorMessage: string | null
    processingPath: string | null
    routingDecision: unknown
    cityCode: string | null
    createdAt: string
    updatedAt: string
    uploader: {
      id: string
      name: string | null
      email: string
    } | null
    forwarder: {
      id: string
      name: string
      code: string
    } | null
    ocrResult: unknown | null
    processingQueue: unknown | null
  }
}

// ============================================================
// Hook
// ============================================================

/**
 * 單個文件詳情 React Query Hook
 *
 * @description
 *   提供單個文件詳情查詢功能，包含：
 *   - 自動輪詢（處理中時 3s）
 *   - 條件啟用
 *   - 錯誤處理
 *
 * @param params - 查詢參數
 * @returns Query 結果
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useDocument({
 *   id: 'xxx-xxx-xxx',
 *   enabled: !!documentId,
 * })
 * ```
 */
export function useDocument({ id, enabled = true }: UseDocumentParams) {
  return useQuery<DocumentDetailResponse>({
    queryKey: documentsQueryKeys.detail(id),
    queryFn: async () => {
      const response = await fetch(`/api/documents/${id}`)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch document')
      }

      return response.json()
    },
    enabled,
    // 動態 refetch interval（處理中時更頻繁）
    refetchInterval: (query) => {
      const status = query.state.data?.data?.status
      if (!status) return false

      const config = getStatusConfig(status)
      return config.isProcessing ? 3000 : false
    },
  })
}
