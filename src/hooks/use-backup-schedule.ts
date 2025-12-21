/**
 * @fileoverview 備份排程管理 React Query Hooks
 * @description
 *   提供備份排程管理功能的 React Query hooks，包括：
 *   - 排程列表查詢
 *   - 排程詳情查詢
 *   - 建立/更新/刪除排程
 *   - 啟用/停用排程
 *   - 手動執行排程
 *
 * @module src/hooks/use-backup-schedule
 * @since Epic 12 - Story 12-5 (數據備份管理)
 * @lastModified 2025-12-21
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  BackupScheduleListParams,
  CreateBackupScheduleRequest,
  UpdateBackupScheduleRequest,
  BackupScheduleListResponse,
  BackupScheduleDetailResponse,
  BackupScheduleToggleResponse,
} from '@/types/backup'
import { backupKeys } from './use-backup'

// ============================================================
// Query Keys
// ============================================================

export const backupScheduleKeys = {
  all: ['backup-schedules'] as const,
  lists: () => [...backupScheduleKeys.all, 'list'] as const,
  list: (params: BackupScheduleListParams) => [...backupScheduleKeys.lists(), params] as const,
  details: () => [...backupScheduleKeys.all, 'detail'] as const,
  detail: (id: string) => [...backupScheduleKeys.details(), id] as const,
}

// ============================================================
// API Functions
// ============================================================

async function fetchSchedules(params: BackupScheduleListParams): Promise<BackupScheduleListResponse> {
  const searchParams = new URLSearchParams()

  if (params.page) searchParams.set('page', String(params.page))
  if (params.limit) searchParams.set('limit', String(params.limit))
  if (params.isEnabled !== undefined) searchParams.set('isEnabled', String(params.isEnabled))
  if (params.backupSource) searchParams.set('backupSource', params.backupSource)
  if (params.backupType) searchParams.set('backupType', params.backupType)
  if (params.sortBy) searchParams.set('sortBy', params.sortBy)
  if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder)

  const response = await fetch(`/api/admin/backup-schedules?${searchParams.toString()}`)

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch backup schedules')
  }

  return response.json()
}

async function fetchScheduleById(id: string): Promise<BackupScheduleDetailResponse> {
  const response = await fetch(`/api/admin/backup-schedules/${id}`)

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch backup schedule')
  }

  return response.json()
}

async function createSchedule(request: CreateBackupScheduleRequest): Promise<BackupScheduleDetailResponse> {
  const response = await fetch('/api/admin/backup-schedules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create backup schedule')
  }

  return response.json()
}

async function updateSchedule({
  id,
  data,
}: {
  id: string
  data: UpdateBackupScheduleRequest
}): Promise<BackupScheduleDetailResponse> {
  const response = await fetch(`/api/admin/backup-schedules/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update backup schedule')
  }

  return response.json()
}

async function deleteSchedule(id: string): Promise<{ success: boolean }> {
  const response = await fetch(`/api/admin/backup-schedules/${id}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to delete backup schedule')
  }

  return response.json()
}

async function toggleSchedule(id: string): Promise<BackupScheduleToggleResponse> {
  const response = await fetch(`/api/admin/backup-schedules/${id}/toggle`, {
    method: 'POST',
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to toggle backup schedule')
  }

  return response.json()
}

async function runSchedule(id: string): Promise<{ success: boolean; data: { backupId: string; scheduleName: string; message: string } }> {
  const response = await fetch(`/api/admin/backup-schedules/${id}/run`, {
    method: 'POST',
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to run backup schedule')
  }

  return response.json()
}

// ============================================================
// Query Hooks
// ============================================================

/**
 * 取得備份排程列表
 */
export function useBackupSchedules(params: BackupScheduleListParams = {}) {
  return useQuery({
    queryKey: backupScheduleKeys.list(params),
    queryFn: () => fetchSchedules(params),
  })
}

/**
 * 取得備份排程詳情
 */
export function useBackupSchedule(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: backupScheduleKeys.detail(id),
    queryFn: () => fetchScheduleById(id),
    enabled: options?.enabled ?? !!id,
  })
}

// ============================================================
// Mutation Hooks
// ============================================================

/**
 * 建立備份排程
 */
export function useCreateSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createSchedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: backupScheduleKeys.lists() })
    },
  })
}

/**
 * 更新備份排程
 */
export function useUpdateSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateSchedule,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: backupScheduleKeys.lists() })
      queryClient.invalidateQueries({ queryKey: backupScheduleKeys.detail(variables.id) })
    },
  })
}

/**
 * 刪除備份排程
 */
export function useDeleteSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteSchedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: backupScheduleKeys.lists() })
    },
  })
}

/**
 * 切換備份排程啟用狀態
 */
export function useToggleSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: toggleSchedule,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: backupScheduleKeys.lists() })
      queryClient.invalidateQueries({ queryKey: backupScheduleKeys.detail(id) })
    },
  })
}

/**
 * 手動執行備份排程
 */
export function useRunSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: runSchedule,
    onSuccess: () => {
      // 同時更新備份列表和排程列表
      queryClient.invalidateQueries({ queryKey: backupKeys.lists() })
      queryClient.invalidateQueries({ queryKey: backupScheduleKeys.lists() })
    },
  })
}
