/**
 * @fileoverview 文件追溯 React Query Hooks
 * @description
 *   提供文件追溯功能的 React Query hooks：
 *   - useDocumentSource: 獲取文件來源
 *   - useDocumentTrace: 獲取完整追溯鏈
 *   - useGenerateReport: 生成追溯報告
 *
 * @module src/hooks/useTraceability
 * @since Epic 8 - Story 8.4 (原始文件追溯)
 * @lastModified 2025-12-20
 *
 * @features
 *   - 文件來源查詢
 *   - 追溯鏈查詢
 *   - 報告生成 mutation
 *   - 快取管理
 *
 * @dependencies
 *   - @tanstack/react-query - 數據獲取
 *   - @/types/traceability - 類型定義
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  DocumentSource,
  DocumentTraceChain,
  TraceabilityReport,
  DocumentSourceResponse,
  TraceChainResponse,
  GenerateReportResponse
} from '@/types/traceability'

// ============================================================
// Query Keys
// ============================================================

/**
 * 追溯功能的 Query Key 工廠
 */
export const traceabilityKeys = {
  all: ['traceability'] as const,
  sources: () => [...traceabilityKeys.all, 'source'] as const,
  source: (documentId: string) => [...traceabilityKeys.sources(), documentId] as const,
  traces: () => [...traceabilityKeys.all, 'trace'] as const,
  trace: (documentId: string) => [...traceabilityKeys.traces(), documentId] as const,
  reports: () => [...traceabilityKeys.all, 'report'] as const,
  report: (documentId: string) => [...traceabilityKeys.reports(), documentId] as const
}

// ============================================================
// API Functions
// ============================================================

/**
 * 獲取文件來源
 */
async function fetchDocumentSource(documentId: string): Promise<DocumentSource> {
  const response = await fetch(`/api/documents/${documentId}/source`)
  const data: DocumentSourceResponse = await response.json()

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to fetch document source')
  }

  return data.data!
}

/**
 * 獲取完整追溯鏈
 */
async function fetchDocumentTrace(documentId: string): Promise<DocumentTraceChain> {
  const response = await fetch(`/api/documents/${documentId}/trace`)
  const data: TraceChainResponse = await response.json()

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to fetch document trace')
  }

  return data.data!
}

/**
 * 生成追溯報告
 */
async function generateTraceabilityReport(
  documentId: string
): Promise<TraceabilityReport> {
  const response = await fetch(`/api/documents/${documentId}/trace/report`, {
    method: 'POST'
  })
  const data: GenerateReportResponse = await response.json()

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to generate report')
  }

  return data.data!
}

// ============================================================
// Hooks
// ============================================================

/**
 * 獲取文件來源 Hook
 *
 * @description
 *   獲取文件的原始來源資訊，包含預簽名 URL。
 *
 * @param documentId - 文件 ID
 * @param options - React Query 選項
 * @returns 文件來源查詢結果
 *
 * @example
 * ```typescript
 * const { data: source, isLoading, error } = useDocumentSource('doc-123');
 * if (source) {
 *   console.log(`File URL: ${source.url}`);
 * }
 * ```
 */
export function useDocumentSource(
  documentId: string,
  options?: {
    enabled?: boolean
    staleTime?: number
    refetchOnWindowFocus?: boolean
  }
) {
  return useQuery({
    queryKey: traceabilityKeys.source(documentId),
    queryFn: () => fetchDocumentSource(documentId),
    enabled: options?.enabled !== false && !!documentId,
    staleTime: options?.staleTime ?? 5 * 60 * 1000, // 5 分鐘
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? false
  })
}

/**
 * 獲取完整追溯鏈 Hook
 *
 * @description
 *   獲取文件的完整處理歷程，包含所有修正和核准記錄。
 *
 * @param documentId - 文件 ID
 * @param options - React Query 選項
 * @returns 追溯鏈查詢結果
 *
 * @example
 * ```typescript
 * const { data: trace, isLoading } = useDocumentTrace('doc-123');
 * if (trace) {
 *   console.log(`Corrections: ${trace.corrections.length}`);
 * }
 * ```
 */
export function useDocumentTrace(
  documentId: string,
  options?: {
    enabled?: boolean
    staleTime?: number
    refetchOnWindowFocus?: boolean
  }
) {
  return useQuery({
    queryKey: traceabilityKeys.trace(documentId),
    queryFn: () => fetchDocumentTrace(documentId),
    enabled: options?.enabled !== false && !!documentId,
    staleTime: options?.staleTime ?? 5 * 60 * 1000, // 5 分鐘
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? false
  })
}

/**
 * 生成追溯報告 Hook
 *
 * @description
 *   生成包含完整追溯鏈的報告。
 *   報告會自動儲存到資料庫中。
 *
 * @returns Mutation 結果，包含 mutate 函數
 *
 * @example
 * ```typescript
 * const { mutate, isPending, data } = useGenerateReport();
 *
 * // 生成報告
 * mutate('doc-123', {
 *   onSuccess: (report) => {
 *     console.log(`Report ID: ${report.reportId}`);
 *   }
 * });
 * ```
 */
export function useGenerateReport() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: generateTraceabilityReport,
    onSuccess: (_, documentId) => {
      // 使報告相關的快取失效
      queryClient.invalidateQueries({
        queryKey: traceabilityKeys.report(documentId)
      })
    }
  })
}

/**
 * 預取文件追溯資料
 *
 * @description
 *   用於在用戶即將查看追溯資料前預先載入數據。
 *
 * @param documentId - 文件 ID
 *
 * @example
 * ```typescript
 * // 在滑鼠懸停時預取
 * <div onMouseEnter={() => prefetchDocumentTrace('doc-123')}>
 *   查看追溯
 * </div>
 * ```
 */
export function usePrefetchDocumentTrace() {
  const queryClient = useQueryClient()

  return (documentId: string) => {
    queryClient.prefetchQuery({
      queryKey: traceabilityKeys.trace(documentId),
      queryFn: () => fetchDocumentTrace(documentId),
      staleTime: 5 * 60 * 1000
    })
  }
}

/**
 * 使追溯快取失效
 *
 * @description
 *   用於在文件更新後清除相關快取。
 *
 * @example
 * ```typescript
 * const invalidate = useInvalidateTraceability();
 *
 * // 文件更新後
 * await updateDocument(documentId);
 * invalidate(documentId);
 * ```
 */
export function useInvalidateTraceability() {
  const queryClient = useQueryClient()

  return (documentId?: string) => {
    if (documentId) {
      queryClient.invalidateQueries({
        queryKey: traceabilityKeys.source(documentId)
      })
      queryClient.invalidateQueries({
        queryKey: traceabilityKeys.trace(documentId)
      })
    } else {
      queryClient.invalidateQueries({
        queryKey: traceabilityKeys.all
      })
    }
  }
}
