'use client'

/**
 * @fileoverview 文件處理進度 React Query Hooks
 * @description
 *   提供文件處理進度追蹤的 React Query 封裝：
 *   - 即時進度輪詢（處理中時 3s）
 *   - 完整處理時間軸
 *   - 處理中文件列表
 *   - 處理統計
 *
 * @module src/hooks/use-document-progress
 * @author Development Team
 * @since Epic 10 - Story 10.6 (文件處理進度追蹤)
 * @lastModified 2025-12-20
 *
 * @features
 *   - 動態輪詢 (處理中時自動輪詢)
 *   - 條件查詢
 *   - 類型安全的 API 響應
 *
 * @dependencies
 *   - @tanstack/react-query - React Query
 *   - @/types/document-progress - 進度類型定義
 *
 * @related
 *   - src/app/api/documents/[id]/progress/route.ts - Progress API
 *   - src/services/document-progress.service.ts - Progress Service
 */

import { useQuery } from '@tanstack/react-query'
import type {
  ProcessingTimeline,
  ProcessingProgress,
  ProcessingDocument,
  ProcessingStatistics,
} from '@/types/document-progress'

// ============================================================
// Query Keys
// ============================================================

/**
 * 文件進度查詢鍵
 */
export const documentProgressQueryKeys = {
  all: ['documentProgress'] as const,
  progress: (documentId: string) => [...documentProgressQueryKeys.all, 'progress', documentId] as const,
  timeline: (documentId: string) => [...documentProgressQueryKeys.all, 'timeline', documentId] as const,
  processing: (cityCode?: string, sourceType?: string) =>
    [...documentProgressQueryKeys.all, 'processing', { cityCode, sourceType }] as const,
  statistics: (cityCode: string, period: string) =>
    [...documentProgressQueryKeys.all, 'statistics', cityCode, period] as const,
}

// ============================================================
// API Response Types
// ============================================================

interface ProgressApiResponse {
  success: boolean
  data: ProcessingProgress | null
}

interface TimelineApiResponse {
  success: boolean
  data: ProcessingTimeline | null
}

interface ProcessingDocumentsApiResponse {
  success: boolean
  data: ProcessingDocument[]
  meta?: {
    count: number
    limit: number
  }
}

interface StatisticsApiResponse {
  success: boolean
  data: ProcessingStatistics
}

// ============================================================
// Fetchers
// ============================================================

async function fetchProgress(documentId: string): Promise<ProcessingProgress | null> {
  const response = await fetch(`/api/documents/${documentId}/progress`)
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || 'Failed to fetch progress')
  }
  const json: ProgressApiResponse = await response.json()
  return json.data
}

async function fetchTimeline(documentId: string): Promise<ProcessingTimeline | null> {
  const response = await fetch(`/api/documents/${documentId}/progress?full=true`)
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || 'Failed to fetch timeline')
  }
  const json: TimelineApiResponse = await response.json()
  return json.data
}

async function fetchProcessingDocuments(params: {
  cityCode?: string
  limit?: number
  sourceType?: string
}): Promise<ProcessingDocument[]> {
  const searchParams = new URLSearchParams()
  if (params.cityCode) searchParams.set('cityCode', params.cityCode)
  if (params.limit) searchParams.set('limit', String(params.limit))
  if (params.sourceType) searchParams.set('sourceType', params.sourceType)

  const queryString = searchParams.toString()
  const url = `/api/documents/processing${queryString ? `?${queryString}` : ''}`

  const response = await fetch(url)
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || 'Failed to fetch processing documents')
  }
  const json: ProcessingDocumentsApiResponse = await response.json()
  return json.data
}

async function fetchStatistics(
  cityCode: string,
  period: 'day' | 'week' | 'month'
): Promise<ProcessingStatistics> {
  const response = await fetch(
    `/api/documents/processing/stats?cityCode=${cityCode}&period=${period}`
  )
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || 'Failed to fetch statistics')
  }
  const json: StatisticsApiResponse = await response.json()
  return json.data
}

// ============================================================
// Hooks
// ============================================================

/**
 * useDocumentProgress 參數
 */
export interface UseDocumentProgressParams {
  /** 文件 ID */
  documentId: string
  /** 輪詢間隔 (毫秒)，預設 3000 */
  refreshInterval?: number
  /** 是否啟用查詢 */
  enabled?: boolean
}

/**
 * 文件進度 Hook
 *
 * @description
 *   提供即時進度查詢功能，包含：
 *   - 自動輪詢（處理中時 3s）
 *   - 完成或失敗時停止輪詢
 *   - 條件啟用
 *
 * @param params - 查詢參數
 * @returns Query 結果
 *
 * @example
 * ```tsx
 * const { progress, isLoading, isPolling, refetch } = useDocumentProgress({
 *   documentId: 'doc-123',
 *   refreshInterval: 3000,
 *   enabled: true,
 * })
 *
 * if (progress?.isComplete) {
 *   console.log('文件處理完成!')
 * }
 * ```
 */
export function useDocumentProgress({
  documentId,
  refreshInterval = 3000,
  enabled = true,
}: UseDocumentProgressParams) {
  const query = useQuery({
    queryKey: documentProgressQueryKeys.progress(documentId),
    queryFn: () => fetchProgress(documentId),
    enabled,
    refetchInterval: (query) => {
      const data = query.state.data
      // 只有在處理中（進度 < 100 且未失敗）時才輪詢
      if (data && data.progress < 100 && !data.hasFailed) {
        return refreshInterval
      }
      return false
    },
    refetchOnWindowFocus: true,
  })

  const isPolling = enabled && query.data && query.data.progress < 100 && !query.data.hasFailed

  return {
    progress: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    isPolling: !!isPolling,
  }
}

/**
 * useDocumentTimeline 參數
 */
export interface UseDocumentTimelineParams {
  /** 文件 ID */
  documentId: string
  /** 是否啟用查詢 */
  enabled?: boolean
}

/**
 * 文件時間軸 Hook
 *
 * @description
 *   提供完整處理時間軸查詢功能，包含：
 *   - 所有處理階段詳情
 *   - 處理時長和預估完成時間
 *   - 來源資訊
 *
 * @param params - 查詢參數
 * @returns Query 結果
 *
 * @example
 * ```tsx
 * const { timeline, isLoading, refetch } = useDocumentTimeline({
 *   documentId: 'doc-123',
 *   enabled: true,
 * })
 *
 * timeline?.stages.forEach(stage => {
 *   console.log(`${stage.stageName}: ${stage.status}`)
 * })
 * ```
 */
export function useDocumentTimeline({
  documentId,
  enabled = true,
}: UseDocumentTimelineParams) {
  const query = useQuery({
    queryKey: documentProgressQueryKeys.timeline(documentId),
    queryFn: () => fetchTimeline(documentId),
    enabled,
    refetchOnWindowFocus: true,
  })

  return {
    timeline: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}

/**
 * useProcessingDocuments 參數
 */
export interface UseProcessingDocumentsParams {
  /** 城市代碼 */
  cityCode?: string
  /** 返回數量限制 */
  limit?: number
  /** 來源類型篩選 */
  sourceType?: string
  /** 輪詢間隔 (毫秒)，預設 10000 */
  refreshInterval?: number
  /** 是否啟用查詢 */
  enabled?: boolean
}

/**
 * 處理中文件列表 Hook
 *
 * @description
 *   提供處理中文件列表查詢功能，包含：
 *   - 城市篩選
 *   - 來源類型篩選
 *   - 自動輪詢（預設 10s）
 *
 * @param params - 查詢參數
 * @returns Query 結果
 *
 * @example
 * ```tsx
 * const { documents, isLoading, refetch } = useProcessingDocuments({
 *   cityCode: 'HKG',
 *   limit: 20,
 *   refreshInterval: 10000,
 * })
 *
 * documents?.forEach(doc => {
 *   console.log(`${doc.fileName}: ${doc.progress}%`)
 * })
 * ```
 */
export function useProcessingDocuments({
  cityCode,
  limit = 20,
  sourceType,
  refreshInterval = 10000,
  enabled = true,
}: UseProcessingDocumentsParams = {}) {
  const query = useQuery({
    queryKey: documentProgressQueryKeys.processing(cityCode, sourceType),
    queryFn: () => fetchProcessingDocuments({ cityCode, limit, sourceType }),
    enabled,
    refetchInterval: enabled ? refreshInterval : false,
    refetchOnWindowFocus: true,
  })

  return {
    documents: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}

/**
 * useProcessingStatistics 參數
 */
export interface UseProcessingStatisticsParams {
  /** 城市代碼 */
  cityCode: string
  /** 統計週期 */
  period?: 'day' | 'week' | 'month'
  /** 是否啟用查詢 */
  enabled?: boolean
}

/**
 * 處理統計 Hook
 *
 * @description
 *   提供處理統計查詢功能，包含：
 *   - 數量統計
 *   - 時間統計
 *   - 階段統計
 *   - 來源分布
 *
 * @param params - 查詢參數
 * @returns Query 結果
 *
 * @example
 * ```tsx
 * const { statistics, isLoading } = useProcessingStatistics({
 *   cityCode: 'HKG',
 *   period: 'day',
 * })
 *
 * if (statistics) {
 *   console.log(`完成率: ${(statistics.completedCount / statistics.totalProcessed * 100).toFixed(1)}%`)
 * }
 * ```
 */
export function useProcessingStatistics({
  cityCode,
  period = 'day',
  enabled = true,
}: UseProcessingStatisticsParams) {
  const query = useQuery({
    queryKey: documentProgressQueryKeys.statistics(cityCode, period),
    queryFn: () => fetchStatistics(cityCode, period),
    enabled: enabled && !!cityCode,
    refetchOnWindowFocus: false,
    refetchInterval: 60000, // 每分鐘刷新一次
  })

  return {
    statistics: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}
