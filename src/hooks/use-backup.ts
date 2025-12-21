/**
 * @fileoverview 備份管理 React Query Hooks
 * @description
 *   提供備份管理功能的 React Query hooks，包括：
 *   - 備份列表查詢
 *   - 備份詳情查詢
 *   - 備份狀態摘要
 *   - 儲存使用量查詢
 *   - 建立/取消/刪除備份
 *
 * @module src/hooks/use-backup
 * @since Epic 12 - Story 12-5 (數據備份管理)
 * @lastModified 2025-12-21
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  BackupListParams,
  CreateBackupRequest,
  BackupListResponse,
  BackupDetailResponse,
  CreateBackupResponse,
  BackupStatusSummaryResponse,
  StorageUsageResponse,
  StorageTrendParams,
} from '@/types/backup'

// ============================================================
// Query Keys
// ============================================================

export const backupKeys = {
  all: ['backups'] as const,
  lists: () => [...backupKeys.all, 'list'] as const,
  list: (params: BackupListParams) => [...backupKeys.lists(), params] as const,
  details: () => [...backupKeys.all, 'detail'] as const,
  detail: (id: string) => [...backupKeys.details(), id] as const,
  summary: () => [...backupKeys.all, 'summary'] as const,
  storage: (params?: StorageTrendParams) => [...backupKeys.all, 'storage', params] as const,
}

// ============================================================
// API Functions
// ============================================================

async function fetchBackups(params: BackupListParams): Promise<BackupListResponse> {
  const searchParams = new URLSearchParams()

  if (params.page) searchParams.set('page', String(params.page))
  if (params.limit) searchParams.set('limit', String(params.limit))
  if (params.status) searchParams.set('status', params.status)
  if (params.source) searchParams.set('source', params.source)
  if (params.type) searchParams.set('type', params.type)
  if (params.trigger) searchParams.set('trigger', params.trigger)
  if (params.scheduleId) searchParams.set('scheduleId', params.scheduleId)
  if (params.startDate) searchParams.set('startDate', params.startDate)
  if (params.endDate) searchParams.set('endDate', params.endDate)
  if (params.sortBy) searchParams.set('sortBy', params.sortBy)
  if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder)

  const response = await fetch(`/api/admin/backups?${searchParams.toString()}`)

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch backups')
  }

  return response.json()
}

async function fetchBackupById(id: string): Promise<BackupDetailResponse> {
  const response = await fetch(`/api/admin/backups/${id}`)

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch backup')
  }

  return response.json()
}

async function fetchBackupSummary(): Promise<BackupStatusSummaryResponse> {
  const response = await fetch('/api/admin/backups/summary')

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch backup summary')
  }

  return response.json()
}

async function fetchStorageUsage(params?: StorageTrendParams): Promise<StorageUsageResponse> {
  const searchParams = new URLSearchParams()

  if (params?.days) searchParams.set('days', String(params.days))
  if (params?.groupBy) searchParams.set('groupBy', params.groupBy)

  const response = await fetch(`/api/admin/backups/storage?${searchParams.toString()}`)

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch storage usage')
  }

  return response.json()
}

async function createBackup(request: CreateBackupRequest): Promise<CreateBackupResponse> {
  const response = await fetch('/api/admin/backups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create backup')
  }

  return response.json()
}

async function cancelBackup(id: string): Promise<{ success: boolean }> {
  const response = await fetch(`/api/admin/backups/${id}/cancel`, {
    method: 'POST',
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to cancel backup')
  }

  return response.json()
}

async function deleteBackup(id: string): Promise<{ success: boolean }> {
  const response = await fetch(`/api/admin/backups/${id}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to delete backup')
  }

  return response.json()
}

// ============================================================
// Query Hooks
// ============================================================

/**
 * 取得備份列表
 */
export function useBackups(params: BackupListParams = {}) {
  return useQuery({
    queryKey: backupKeys.list(params),
    queryFn: () => fetchBackups(params),
  })
}

/**
 * 取得備份詳情
 */
export function useBackup(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: backupKeys.detail(id),
    queryFn: () => fetchBackupById(id),
    enabled: options?.enabled ?? !!id,
  })
}

/**
 * 取得備份狀態摘要
 */
export function useBackupSummary() {
  return useQuery({
    queryKey: backupKeys.summary(),
    queryFn: fetchBackupSummary,
  })
}

/**
 * 取得儲存使用量
 */
export function useStorageUsage(params?: StorageTrendParams) {
  return useQuery({
    queryKey: backupKeys.storage(params),
    queryFn: () => fetchStorageUsage(params),
  })
}

// ============================================================
// Mutation Hooks
// ============================================================

/**
 * 建立備份
 */
export function useCreateBackup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createBackup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: backupKeys.lists() })
      queryClient.invalidateQueries({ queryKey: backupKeys.summary() })
    },
  })
}

/**
 * 取消備份
 */
export function useCancelBackup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: cancelBackup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: backupKeys.lists() })
      queryClient.invalidateQueries({ queryKey: backupKeys.summary() })
    },
  })
}

/**
 * 刪除備份
 */
export function useDeleteBackup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteBackup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: backupKeys.lists() })
      queryClient.invalidateQueries({ queryKey: backupKeys.summary() })
      queryClient.invalidateQueries({ queryKey: backupKeys.storage() })
    },
  })
}
