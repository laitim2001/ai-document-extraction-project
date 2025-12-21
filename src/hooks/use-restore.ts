/**
 * @fileoverview 數據恢復管理 React Query Hooks
 * @description
 *   提供數據恢復功能的 React Query hooks，包括：
 *   - 恢復記錄列表查詢
 *   - 恢復記錄詳情查詢
 *   - 恢復日誌查詢
 *   - 恢復統計查詢
 *   - 備份內容預覽
 *   - 啟動/取消/回滾恢復操作
 *
 * @module src/hooks/use-restore
 * @since Epic 12 - Story 12-6 (數據恢復功能)
 * @lastModified 2025-12-21
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  RestoreListParams,
  StartRestoreRequest,
  RestoreListResponse,
  RestoreDetailResponse,
  RestoreLogsResponse,
  RestoreStatsResponse,
  BackupPreviewResponse,
  RollbackRequest,
} from '@/types/restore'
import { backupKeys } from './use-backup'

// ============================================================
// Query Keys
// ============================================================

export const restoreKeys = {
  all: ['restores'] as const,
  lists: () => [...restoreKeys.all, 'list'] as const,
  list: (params: RestoreListParams) => [...restoreKeys.lists(), params] as const,
  details: () => [...restoreKeys.all, 'detail'] as const,
  detail: (id: string) => [...restoreKeys.details(), id] as const,
  logs: (id: string) => [...restoreKeys.all, 'logs', id] as const,
  stats: () => [...restoreKeys.all, 'stats'] as const,
  backupPreview: (backupId: string) => ['backups', 'preview', backupId] as const,
}

// ============================================================
// API Functions
// ============================================================

async function fetchRestoreRecords(params: RestoreListParams): Promise<RestoreListResponse> {
  const searchParams = new URLSearchParams()

  if (params.page) searchParams.set('page', String(params.page))
  if (params.limit) searchParams.set('limit', String(params.limit))
  if (params.status) searchParams.set('status', params.status)
  if (params.type) searchParams.set('type', params.type)
  if (params.backupId) searchParams.set('backupId', params.backupId)
  if (params.startDate) searchParams.set('startDate', params.startDate)
  if (params.endDate) searchParams.set('endDate', params.endDate)
  if (params.sortBy) searchParams.set('sortBy', params.sortBy)
  if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder)

  const response = await fetch(`/api/admin/restore?${searchParams.toString()}`)

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch restore records')
  }

  return response.json()
}

async function fetchRestoreRecord(id: string): Promise<RestoreDetailResponse> {
  const response = await fetch(`/api/admin/restore/${id}`)

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch restore record')
  }

  return response.json()
}

async function fetchRestoreLogs(id: string): Promise<RestoreLogsResponse> {
  const response = await fetch(`/api/admin/restore/${id}/logs`)

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch restore logs')
  }

  return response.json()
}

async function fetchRestoreStats(): Promise<RestoreStatsResponse> {
  const response = await fetch('/api/admin/restore/stats')

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch restore stats')
  }

  return response.json()
}

async function fetchBackupPreview(backupId: string): Promise<BackupPreviewResponse> {
  const response = await fetch(`/api/admin/backups/${backupId}/preview`)

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch backup preview')
  }

  return response.json()
}

async function startRestore(request: StartRestoreRequest): Promise<RestoreDetailResponse> {
  const response = await fetch('/api/admin/restore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to start restore')
  }

  return response.json()
}

async function cancelRestore(id: string): Promise<{ success: boolean }> {
  const response = await fetch(`/api/admin/restore/${id}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to cancel restore')
  }

  return response.json()
}

async function rollbackRestore(params: { id: string; request: RollbackRequest }): Promise<RestoreDetailResponse> {
  const response = await fetch(`/api/admin/restore/${params.id}/rollback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params.request),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to rollback restore')
  }

  return response.json()
}

// ============================================================
// Query Hooks
// ============================================================

/**
 * 取得恢復記錄列表
 */
export function useRestoreRecords(params: RestoreListParams = {}) {
  return useQuery({
    queryKey: restoreKeys.list(params),
    queryFn: () => fetchRestoreRecords(params),
  })
}

/**
 * 取得恢復記錄詳情
 */
export function useRestoreRecord(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: restoreKeys.detail(id),
    queryFn: () => fetchRestoreRecord(id),
    enabled: options?.enabled ?? !!id,
  })
}

/**
 * 取得恢復日誌
 */
export function useRestoreLogs(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: restoreKeys.logs(id),
    queryFn: () => fetchRestoreLogs(id),
    enabled: options?.enabled ?? !!id,
  })
}

/**
 * 取得恢復統計
 */
export function useRestoreStats() {
  return useQuery({
    queryKey: restoreKeys.stats(),
    queryFn: fetchRestoreStats,
  })
}

/**
 * 取得備份內容預覽
 */
export function useBackupPreview(backupId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: restoreKeys.backupPreview(backupId),
    queryFn: () => fetchBackupPreview(backupId),
    enabled: options?.enabled ?? !!backupId,
  })
}

// ============================================================
// Mutation Hooks
// ============================================================

/**
 * 啟動恢復操作
 */
export function useStartRestore() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: startRestore,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: restoreKeys.lists() })
      queryClient.invalidateQueries({ queryKey: restoreKeys.stats() })
      // 恢復可能會建立預恢復備份，因此也刷新備份列表
      queryClient.invalidateQueries({ queryKey: backupKeys.lists() })
      queryClient.invalidateQueries({ queryKey: backupKeys.summary() })
    },
  })
}

/**
 * 取消恢復操作
 */
export function useCancelRestore() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: cancelRestore,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: restoreKeys.lists() })
      queryClient.invalidateQueries({ queryKey: restoreKeys.stats() })
    },
  })
}

/**
 * 回滾恢復操作
 */
export function useRollbackRestore() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: rollbackRestore,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: restoreKeys.lists() })
      queryClient.invalidateQueries({ queryKey: restoreKeys.stats() })
    },
  })
}

// ============================================================
// 輪詢 Hook（用於進度追蹤）
// ============================================================

/**
 * 取得恢復記錄詳情（帶輪詢功能）
 * 用於即時追蹤恢復進度
 */
export function useRestoreRecordPolling(
  id: string,
  options?: {
    enabled?: boolean
    /** 輪詢間隔（毫秒），預設 2000ms */
    pollingInterval?: number
    /** 是否啟用輪詢 */
    polling?: boolean
  }
) {
  const { enabled = true, pollingInterval = 2000, polling = false } = options || {}

  return useQuery({
    queryKey: restoreKeys.detail(id),
    queryFn: () => fetchRestoreRecord(id),
    enabled: enabled && !!id,
    refetchInterval: polling ? pollingInterval : false,
    refetchIntervalInBackground: false,
  })
}

/**
 * 取得恢復日誌（帶輪詢功能）
 * 用於即時追蹤恢復日誌
 */
export function useRestoreLogsPolling(
  id: string,
  options?: {
    enabled?: boolean
    /** 輪詢間隔（毫秒），預設 2000ms */
    pollingInterval?: number
    /** 是否啟用輪詢 */
    polling?: boolean
  }
) {
  const { enabled = true, pollingInterval = 2000, polling = false } = options || {}

  return useQuery({
    queryKey: restoreKeys.logs(id),
    queryFn: () => fetchRestoreLogs(id),
    enabled: enabled && !!id,
    refetchInterval: polling ? pollingInterval : false,
    refetchIntervalInBackground: false,
  })
}
