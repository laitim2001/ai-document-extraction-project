'use client'

/**
 * @fileoverview 用戶城市存取權限 Hook
 * @description
 *   提供 admin 用戶管理面板對單一用戶「城市資料存取權限」（UserCityAccess）的
 *   查詢與變更（授予 / 撤銷 / 設主要城市）。對應 CHANGE-090 的城市存取 API。
 *
 *   使用 React Query 進行資料緩存與 invalidation；Toast 由組件層處理。
 *
 * @module src/hooks/use-user-city-access
 * @author Development Team
 * @since CHANGE-090 - 城市/區域存取權限管理 UI/API
 * @lastModified 2026-06-24
 *
 * @dependencies
 *   - @tanstack/react-query - 資料查詢與緩存
 *
 * @related
 *   - src/app/api/admin/users/[id]/city-access/route.ts - 城市存取 API
 *   - src/components/features/admin/UserCityAccessPanel.tsx - 城市權限面板
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// ============================================================
// Types
// ============================================================

/** 城市存取等級 */
export type AccessLevel = 'FULL' | 'READ_ONLY'

/** 用戶城市存取權限（對應 service CityAccessInfo，Date 經 JSON 序列化為 string） */
export interface UserCityAccess {
  cityCode: string
  cityName: string
  accessLevel: AccessLevel
  isPrimary: boolean
  expiresAt: string | null
}

/** 授予城市存取權限輸入 */
export interface GrantCityAccessInput {
  cityCode: string
  isPrimary?: boolean
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

const baseUrl = (userId: string) => `/api/admin/users/${userId}/city-access`

async function fetchUserCityAccess(userId: string): Promise<UserCityAccess[]> {
  const response = await fetch(baseUrl(userId))
  const json: ApiResponse<UserCityAccess[]> = await response.json()

  if (!response.ok || !json.success || !json.data) {
    throw new Error(json.error?.detail || 'Failed to fetch city access')
  }
  return json.data
}

async function grantCityAccess(
  userId: string,
  input: GrantCityAccessInput
): Promise<UserCityAccess[]> {
  const response = await fetch(baseUrl(userId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const json: ApiResponse<UserCityAccess[]> = await response.json()

  if (!response.ok || !json.success || !json.data) {
    throw new Error(json.error?.detail || 'Failed to grant city access')
  }
  return json.data
}

async function revokeCityAccess(
  userId: string,
  cityCode: string
): Promise<UserCityAccess[]> {
  const response = await fetch(`${baseUrl(userId)}/${encodeURIComponent(cityCode)}`, {
    method: 'DELETE',
  })
  const json: ApiResponse<UserCityAccess[]> = await response.json()

  if (!response.ok || !json.success || !json.data) {
    throw new Error(json.error?.detail || 'Failed to revoke city access')
  }
  return json.data
}

async function setPrimaryCity(
  userId: string,
  cityCode: string
): Promise<UserCityAccess[]> {
  const response = await fetch(`${baseUrl(userId)}/${encodeURIComponent(cityCode)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isPrimary: true }),
  })
  const json: ApiResponse<UserCityAccess[]> = await response.json()

  if (!response.ok || !json.success || !json.data) {
    throw new Error(json.error?.detail || 'Failed to set primary city')
  }
  return json.data
}

// ============================================================
// Hooks
// ============================================================

const cityAccessKey = (userId: string) => ['user-city-access', userId] as const

/** 查詢用戶城市存取權限 */
export function useUserCityAccess(userId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: cityAccessKey(userId ?? ''),
    queryFn: () => fetchUserCityAccess(userId!),
    enabled: enabled && !!userId,
    staleTime: 60 * 1000,
  })
}

/** 授予城市存取權限 */
export function useGrantCityAccess() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, input }: { userId: string; input: GrantCityAccessInput }) =>
      grantCityAccess(userId, input),
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: cityAccessKey(userId) })
    },
  })
}

/** 撤銷城市存取權限 */
export function useRevokeCityAccess() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, cityCode }: { userId: string; cityCode: string }) =>
      revokeCityAccess(userId, cityCode),
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: cityAccessKey(userId) })
    },
  })
}

/** 設定主要城市 */
export function useSetPrimaryCity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, cityCode }: { userId: string; cityCode: string }) =>
      setPrimaryCity(userId, cityCode),
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: cityAccessKey(userId) })
    },
  })
}
