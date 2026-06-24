'use client'

/**
 * @fileoverview 用戶區域存取權限與 globalAdmin 切換 Hook
 * @description
 *   提供 admin 用戶管理面板對單一用戶的：
 *   - 「區域資料存取權限」（UserRegionAccess）查詢與變更（授予 / 撤銷）
 *   - globalAdmin 狀態切換（User.isGlobalAdmin）
 *
 *   對應 CHANGE-090 的區域存取 API 與 globalAdmin 切換 API。
 *   使用 React Query 進行緩存與 invalidation；Toast 由組件層處理。
 *
 * @module src/hooks/use-user-region-access
 * @author Development Team
 * @since CHANGE-090 - 城市/區域存取權限管理 UI/API
 * @lastModified 2026-06-24
 *
 * @dependencies
 *   - @tanstack/react-query - 資料查詢與緩存
 *
 * @related
 *   - src/app/api/admin/users/[id]/region-access/route.ts - 區域存取 API
 *   - src/app/api/admin/users/[id]/global-admin/route.ts - globalAdmin 切換 API
 *   - src/components/features/admin/UserRegionAccessPanel.tsx - 區域權限面板
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { AccessLevel } from './use-user-city-access'

// ============================================================
// Types
// ============================================================

/** 用戶區域存取權限（對應 service RegionInfo） */
export interface UserRegionAccess {
  code: string
  name: string
  cityCount: number
}

/** 授予區域存取權限輸入 */
export interface GrantRegionAccessInput {
  regionCode: string
  accessLevel?: AccessLevel
  expiresAt?: string | null
  reason?: string
}

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: { title: string; status: number; detail?: string }
}

// ============================================================
// API Functions
// ============================================================

const regionBaseUrl = (userId: string) => `/api/admin/users/${userId}/region-access`

async function fetchUserRegionAccess(userId: string): Promise<UserRegionAccess[]> {
  const response = await fetch(regionBaseUrl(userId))
  const json: ApiResponse<UserRegionAccess[]> = await response.json()

  if (!response.ok || !json.success || !json.data) {
    throw new Error(json.error?.detail || 'Failed to fetch region access')
  }
  return json.data
}

async function grantRegionAccess(
  userId: string,
  input: GrantRegionAccessInput
): Promise<UserRegionAccess[]> {
  const response = await fetch(regionBaseUrl(userId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const json: ApiResponse<UserRegionAccess[]> = await response.json()

  if (!response.ok || !json.success || !json.data) {
    throw new Error(json.error?.detail || 'Failed to grant region access')
  }
  return json.data
}

async function revokeRegionAccess(
  userId: string,
  regionCode: string
): Promise<UserRegionAccess[]> {
  const response = await fetch(
    `${regionBaseUrl(userId)}/${encodeURIComponent(regionCode)}`,
    { method: 'DELETE' }
  )
  const json: ApiResponse<UserRegionAccess[]> = await response.json()

  if (!response.ok || !json.success || !json.data) {
    throw new Error(json.error?.detail || 'Failed to revoke region access')
  }
  return json.data
}

async function setGlobalAdmin(userId: string, isGlobalAdmin: boolean): Promise<void> {
  const response = await fetch(`/api/admin/users/${userId}/global-admin`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isGlobalAdmin }),
  })
  const json: ApiResponse<unknown> = await response.json()

  if (!response.ok || !json.success) {
    throw new Error(json.error?.detail || 'Failed to change global admin status')
  }
}

// ============================================================
// Hooks
// ============================================================

const regionAccessKey = (userId: string) => ['user-region-access', userId] as const

/** 查詢用戶區域存取權限 */
export function useUserRegionAccess(userId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: regionAccessKey(userId ?? ''),
    queryFn: () => fetchUserRegionAccess(userId!),
    enabled: enabled && !!userId,
    staleTime: 60 * 1000,
  })
}

/** 授予區域存取權限 */
export function useGrantRegionAccess() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, input }: { userId: string; input: GrantRegionAccessInput }) =>
      grantRegionAccess(userId, input),
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: regionAccessKey(userId) })
      // 區域授予連帶城市權限，一併刷新城市面板
      queryClient.invalidateQueries({ queryKey: ['user-city-access', userId] })
    },
  })
}

/** 撤銷區域存取權限 */
export function useRevokeRegionAccess() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, regionCode }: { userId: string; regionCode: string }) =>
      revokeRegionAccess(userId, regionCode),
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: regionAccessKey(userId) })
      queryClient.invalidateQueries({ queryKey: ['user-city-access', userId] })
    },
  })
}

/** 切換用戶 globalAdmin 狀態 */
export function useSetUserGlobalAdmin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, isGlobalAdmin }: { userId: string; isGlobalAdmin: boolean }) =>
      setGlobalAdmin(userId, isGlobalAdmin),
    onSuccess: () => {
      // globalAdmin 影響用戶列表顯示，刷新用戶查詢
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}
