'use client'

/**
 * @fileoverview System Settings 系統設定管理 Hooks
 * @description
 *   提供客戶端系統設定管理功能，使用 React Query 進行資料緩存和狀態管理。
 *
 *   主要功能：
 *   - useSystemSettings: 設定列表查詢（支援 category 篩選）
 *   - useSystemSetting: 單一設定查詢
 *   - useUpdateSystemSettings: 批次更新設定
 *   - useResetSystemSetting: 重置設定為預設值
 *
 * @module src/hooks/use-system-settings
 * @since CHANGE-050 - System Settings Hub
 * @lastModified 2026-02-26
 *
 * @dependencies
 *   - @tanstack/react-query - 資料查詢和緩存
 *
 * @example
 *   // 查詢設定列表
 *   const { data, isLoading } = useSystemSettings('general')
 *
 *   // 批次更新設定
 *   const { mutate: updateSettings } = useUpdateSystemSettings()
 *   updateSettings({ settings: [{ key: 'system.name', value: 'New Name' }] })
 *
 *   // 重置設定
 *   const { mutate: resetSetting } = useResetSystemSetting()
 *   resetSetting('system.name')
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// ============================================================
// Query Keys
// ============================================================

/**
 * 系統設定查詢鍵
 */
export const systemSettingsQueryKeys = {
  all: ['system-settings'] as const,
  list: (category: string) => ['system-settings', category] as const,
  details: () => ['system-settings', 'detail'] as const,
  detail: (key: string) => ['system-settings', 'detail', key] as const,
}

// ============================================================
// Types
// ============================================================

/**
 * 設定列表 API 響應資料
 */
interface SystemSettingsData {
  settings: Array<{
    id: string
    key: string
    value: unknown
    category: string
    updatedBy: string | null
    updatedAt: string
    createdAt: string
  }>
  defaults: Record<string, { value: unknown; category: string }>
}

/**
 * 單一設定 API 響應資料
 */
interface SystemSettingData {
  setting: {
    id: string
    key: string
    value: unknown
    category: string
    updatedBy: string | null
    updatedAt: string
    createdAt: string
  }
  default: { value: unknown; category: string } | null
}

/**
 * 批次更新輸入
 */
interface UpdateSystemSettingsInput {
  settings: Array<{
    key: string
    value: unknown
    category?: string
  }>
}

// ============================================================
// Query Hooks
// ============================================================

/**
 * 系統設定列表查詢 Hook
 *
 * @description
 *   使用 React Query 管理設定列表的獲取和緩存。
 *   支援按 category 篩選。
 *
 * @param category - 可選的分類篩選
 * @returns React Query 查詢結果
 *
 * @example
 *   const { data, isLoading } = useSystemSettings('notifications')
 *   const settings = data?.settings ?? []
 */
export function useSystemSettings(category?: string) {
  const params = new URLSearchParams()
  if (category) params.set('category', category)

  return useQuery({
    queryKey: systemSettingsQueryKeys.list(category ?? 'all'),
    queryFn: async (): Promise<SystemSettingsData> => {
      const res = await fetch(`/api/admin/settings?${params}`)
      if (!res.ok) throw new Error('Failed to fetch system settings')
      const json = await res.json()
      return json.data
    },
    staleTime: 30 * 1000, // 30 秒
  })
}

/**
 * 單一系統設定查詢 Hook
 *
 * @description
 *   使用 React Query 獲取單一設定詳情，含預設值資訊。
 *
 * @param key - 設定鍵
 * @returns React Query 查詢結果
 *
 * @example
 *   const { data, isLoading } = useSystemSetting('system.name')
 *   const currentValue = data?.setting.value
 *   const defaultValue = data?.default?.value
 */
export function useSystemSetting(key: string) {
  const encodedKey = encodeURIComponent(key)

  return useQuery({
    queryKey: systemSettingsQueryKeys.detail(key),
    queryFn: async (): Promise<SystemSettingData> => {
      const res = await fetch(`/api/admin/settings/${encodedKey}`)
      if (!res.ok) throw new Error('Failed to fetch system setting')
      const json = await res.json()
      return json.data
    },
    enabled: !!key,
    staleTime: 30 * 1000,
  })
}

// ============================================================
// Mutation Hooks
// ============================================================

/**
 * 批次更新系統設定 Mutation Hook
 *
 * @description
 *   使用 React Query 的 useMutation 管理批次設定更新操作。
 *   成功後自動刷新設定列表。
 *
 * @returns React Query Mutation 結果
 *
 * @example
 *   const { mutate: updateSettings, isPending } = useUpdateSystemSettings()
 *
 *   updateSettings(
 *     {
 *       settings: [
 *         { key: 'system.name', value: 'My System' },
 *         { key: 'notifications.emailEnabled', value: false },
 *       ],
 *     },
 *     {
 *       onSuccess: () => toast({ title: '設定已更新' }),
 *       onError: (error) => toast({ title: '錯誤', description: error.message }),
 *     }
 *   )
 */
export function useUpdateSystemSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: UpdateSystemSettingsInput) => {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })

      if (!res.ok) {
        const errorJson = await res.json().catch(() => null)
        throw new Error(errorJson?.detail || 'Failed to update system settings')
      }

      const json = await res.json()
      return json.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: systemSettingsQueryKeys.all })
    },
  })
}

/**
 * 重置系統設定為預設值 Mutation Hook
 *
 * @description
 *   使用 React Query 的 useMutation 管理設定重置操作。
 *   從 DB 中刪除自訂值，恢復為預設值。
 *   成功後自動刷新設定列表和詳情。
 *
 * @returns React Query Mutation 結果
 *
 * @example
 *   const { mutate: resetSetting, isPending } = useResetSystemSetting()
 *
 *   resetSetting('system.name', {
 *     onSuccess: () => toast({ title: '設定已重置為預設值' }),
 *     onError: (error) => toast({ title: '錯誤', description: error.message }),
 *   })
 */
export function useResetSystemSetting() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (key: string) => {
      const encodedKey = encodeURIComponent(key)
      const res = await fetch(`/api/admin/settings/${encodedKey}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const errorJson = await res.json().catch(() => null)
        throw new Error(errorJson?.detail || 'Failed to reset system setting')
      }

      const json = await res.json()
      return json.data
    },
    onSuccess: (_data, key) => {
      queryClient.invalidateQueries({ queryKey: systemSettingsQueryKeys.all })
      queryClient.invalidateQueries({ queryKey: systemSettingsQueryKeys.detail(key) })
    },
  })
}
