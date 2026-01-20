/**
 * @fileoverview 歷史數據管理 Hooks
 * @description
 *   提供歷史數據批次和文件的管理功能：
 *   - 批次列表查詢
 *   - 批次詳情查詢
 *   - 文件操作（刪除、更新類型）
 *   - 批次操作（建立、刪除、開始處理）
 *
 * @module src/hooks/use-historical-data
 * @since Epic 0 - Story 0.1
 * @lastModified 2025-12-23
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// ============================================================
// Types
// ============================================================

export type HistoricalBatchStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
export type DetectedFileType = 'NATIVE_PDF' | 'SCANNED_PDF' | 'IMAGE'
export type HistoricalFileStatus = 'PENDING' | 'DETECTING' | 'DETECTED' | 'PROCESSING' | 'COMPLETED' | 'FAILED'

export interface HistoricalBatch {
  id: string
  name: string
  description: string | null
  status: HistoricalBatchStatus
  totalFiles: number
  processedFiles: number
  failedFiles: number
  errorMessage: string | null
  createdAt: string
  updatedAt: string
  startedAt: string | null
  completedAt: string | null
  creator: {
    id: string
    name: string | null
    email: string
  }
}

export interface HistoricalFile {
  id: string
  fileName: string
  originalName: string
  fileSize: number
  mimeType: string
  detectedType: DetectedFileType | null
  status: HistoricalFileStatus
  metadata: Record<string, unknown> | null
  errorMessage: string | null
  createdAt: string
  detectedAt: string | null
  processedAt: string | null
}

export interface BatchDetail extends HistoricalBatch {
  files: HistoricalFile[]
  statistics: {
    statusCounts: Record<string, number>
    typeCounts: Record<string, number>
    totalSize: number
  }
}

interface BatchListFilters {
  page?: number
  limit?: number
  status?: HistoricalBatchStatus
  search?: string
}

interface FileListFilters {
  batchId: string
  page?: number
  limit?: number
  status?: HistoricalFileStatus
  detectedType?: DetectedFileType
  search?: string
}

// ============================================================
// API Functions
// ============================================================

async function fetchBatches(filters: BatchListFilters) {
  const params = new URLSearchParams()
  if (filters.page) params.set('page', String(filters.page))
  if (filters.limit) params.set('limit', String(filters.limit))
  if (filters.status) params.set('status', filters.status)
  if (filters.search) params.set('search', filters.search)

  const response = await fetch(`/api/admin/historical-data/batches?${params}`)
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || '載入批次列表失敗')
  }
  return response.json()
}

async function fetchBatchDetail(batchId: string) {
  const response = await fetch(`/api/admin/historical-data/batches/${batchId}`)
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || '載入批次詳情失敗')
  }
  return response.json()
}

async function fetchBatchFiles(filters: FileListFilters) {
  const params = new URLSearchParams()
  params.set('batchId', filters.batchId)
  if (filters.page) params.set('page', String(filters.page))
  if (filters.limit) params.set('limit', String(filters.limit))
  if (filters.status) params.set('status', filters.status)
  if (filters.detectedType) params.set('detectedType', filters.detectedType)
  if (filters.search) params.set('search', filters.search)

  const response = await fetch(`/api/admin/historical-data/files?${params}`)
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || '載入文件列表失敗')
  }
  return response.json()
}

/**
 * 建立批次參數
 * Story 0.6: 新增公司識別配置
 */
interface CreateBatchParams {
  name: string
  description?: string
  // Story 0.6: 公司識別配置
  enableCompanyIdentification?: boolean
  fuzzyMatchThreshold?: number
  autoMergeSimilar?: boolean
}

async function createBatch(data: CreateBatchParams) {
  const response = await fetch('/api/admin/historical-data/batches', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || '建立批次失敗')
  }
  return response.json()
}

async function updateBatch(batchId: string, data: { name?: string; description?: string; status?: HistoricalBatchStatus }) {
  const response = await fetch(`/api/admin/historical-data/batches/${batchId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || '更新批次失敗')
  }
  return response.json()
}

async function deleteBatch(batchId: string) {
  const response = await fetch(`/api/admin/historical-data/batches/${batchId}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || '刪除批次失敗')
  }
  return response.json()
}

async function deleteFile(fileId: string) {
  const response = await fetch(`/api/admin/historical-data/files/${fileId}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || '刪除文件失敗')
  }
  return response.json()
}

async function updateFileType(fileId: string, detectedType: DetectedFileType) {
  const response = await fetch(`/api/admin/historical-data/files/${fileId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ detectedType }),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || '更新文件類型失敗')
  }
  return response.json()
}

// ============================================================
// Hooks
// ============================================================

/**
 * 歷史數據批次列表 Hook
 *
 * @description
 *   FIX-019: 新增自動輪詢功能
 *   - 當有批次處於 PROCESSING 或 AGGREGATING 狀態時，每 3 秒自動刷新
 *   - 確保處理進度能即時顯示在前端
 *
 * @param filters 篩選條件
 * @param options 額外選項
 * @param options.enablePolling 是否啟用輪詢（預設: true）
 * @param options.pollingInterval 輪詢間隔毫秒（預設: 3000）
 */
export function useHistoricalBatches(
  filters: BatchListFilters = {},
  options: { enablePolling?: boolean; pollingInterval?: number } = {}
) {
  const { enablePolling = true, pollingInterval = 3000 } = options

  return useQuery({
    queryKey: ['historical-batches', filters],
    queryFn: () => fetchBatches(filters),
    staleTime: 5 * 1000, // 5 秒（縮短以便更快反映更新）
    // FIX-019: 動態輪詢 - 使用函數形式根據當前數據決定是否繼續輪詢
    refetchInterval: enablePolling
      ? (query) => {
          // 檢查是否有正在處理的批次
          const hasProcessingBatch = query.state.data?.data?.some(
            (batch: HistoricalBatch) =>
              batch.status === 'PROCESSING' || batch.status === 'AGGREGATING'
          )
          // 有處理中的批次時啟用輪詢，否則停止
          return hasProcessingBatch ? pollingInterval : false
        }
      : false,
  })
}

/**
 * 批次詳情 Hook
 */
export function useHistoricalBatchDetail(batchId: string | null) {
  return useQuery({
    queryKey: ['historical-batch', batchId],
    queryFn: () => fetchBatchDetail(batchId!),
    enabled: !!batchId,
    staleTime: 30 * 1000,
  })
}

/**
 * 批次文件列表 Hook
 */
export function useHistoricalFiles(filters: FileListFilters) {
  return useQuery({
    queryKey: ['historical-files', filters],
    queryFn: () => fetchBatchFiles(filters),
    enabled: !!filters.batchId,
    staleTime: 30 * 1000,
  })
}

/**
 * 建立批次 Mutation
 */
export function useCreateBatch() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createBatch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['historical-batches'] })
    },
  })
}

/**
 * 更新批次 Mutation
 */
export function useUpdateBatch() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ batchId, data }: { batchId: string; data: { name?: string; description?: string; status?: HistoricalBatchStatus } }) =>
      updateBatch(batchId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['historical-batches'] })
      queryClient.invalidateQueries({ queryKey: ['historical-batch', variables.batchId] })
    },
  })
}

/**
 * 刪除批次 Mutation
 */
export function useDeleteBatch() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteBatch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['historical-batches'] })
    },
  })
}

/**
 * 刪除文件 Mutation
 */
export function useDeleteFile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteFile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['historical-files'] })
      queryClient.invalidateQueries({ queryKey: ['historical-batch'] })
    },
  })
}

/**
 * 更新文件類型 Mutation
 */
export function useUpdateFileType() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ fileId, detectedType }: { fileId: string; detectedType: DetectedFileType }) =>
      updateFileType(fileId, detectedType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['historical-files'] })
      queryClient.invalidateQueries({ queryKey: ['historical-batch'] })
    },
  })
}

// ============================================================
// Bulk Operations API Functions
// ============================================================

async function bulkDeleteFiles(fileIds: string[]) {
  const response = await fetch('/api/admin/historical-data/files/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'delete', fileIds }),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || '批量刪除失敗')
  }
  return response.json()
}

async function bulkUpdateFileType(fileIds: string[], detectedType: DetectedFileType) {
  const response = await fetch('/api/admin/historical-data/files/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'updateType', fileIds, detectedType }),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || '批量更新類型失敗')
  }
  return response.json()
}

async function startBatchProcessing(batchId: string) {
  const response = await fetch(`/api/admin/historical-data/batches/${batchId}/process`, {
    method: 'POST',
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || '開始處理失敗')
  }
  return response.json()
}

// ============================================================
// Bulk Operations Hooks
// ============================================================

/**
 * 批量刪除文件 Mutation
 */
export function useBulkDeleteFiles() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: bulkDeleteFiles,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['historical-files'] })
      queryClient.invalidateQueries({ queryKey: ['historical-batch'] })
      queryClient.invalidateQueries({ queryKey: ['historical-batches'] })
    },
  })
}

/**
 * 批量更新文件類型 Mutation
 */
export function useBulkUpdateFileType() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ fileIds, detectedType }: { fileIds: string[]; detectedType: DetectedFileType }) =>
      bulkUpdateFileType(fileIds, detectedType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['historical-files'] })
      queryClient.invalidateQueries({ queryKey: ['historical-batch'] })
    },
  })
}

/**
 * 開始批次處理 Mutation
 */
export function useStartBatchProcessing() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: startBatchProcessing,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['historical-batch'] })
      queryClient.invalidateQueries({ queryKey: ['historical-batches'] })
    },
  })
}
