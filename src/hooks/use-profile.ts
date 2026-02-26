/**
 * @fileoverview 用戶個人資料 React Query Hooks
 * @description
 *   提供當前登入用戶的個人資料管理功能，包含：
 *   - useProfile: 取得當前用戶完整資料
 *   - useUpdateProfile: 更新顯示名稱
 *   - useChangePassword: 修改密碼
 *
 * @module src/hooks/use-profile
 * @author Development Team
 * @since CHANGE-049 - User Profile Page
 * @lastModified 2026-02-26
 *
 * @related
 *   - src/app/api/v1/users/me/route.ts - GET/PATCH API
 *   - src/app/api/v1/users/me/password/route.ts - POST 密碼修改 API
 *   - src/app/[locale]/(dashboard)/profile/ - Profile 頁面
 */

'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// ============================================================
// Types
// ============================================================

/** 角色資訊 */
interface ProfileRole {
  id: string
  name: string
  description: string | null
  cityId: string | null
  cityName: string | null
  cityCode: string | null
}

/** 城市資訊 */
interface ProfileCity {
  id: string
  name: string
  code: string
}

/** 用戶完整資料 */
export interface UserProfile {
  id: string
  email: string
  name: string | null
  image: string | null
  provider: 'azure-ad' | 'local'
  status: string
  roles: ProfileRole[]
  cities: ProfileCity[]
  permissions: string[]
  locale: string
  createdAt: string
  lastLoginAt: string | null
}

/** 更新資料輸入 */
interface UpdateProfileInput {
  name: string
}

/** 密碼修改輸入 */
interface ChangePasswordInput {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

/** API 成功響應 */
interface ApiResponse<T> {
  success: boolean
  data: T
  error?: {
    type: string
    title: string
    status: number
    detail: string
    errors?: Record<string, string[]>
  }
}

// ============================================================
// Query Keys
// ============================================================

const profileKeys = {
  all: ['profile'] as const,
  me: () => [...profileKeys.all, 'me'] as const,
}

// ============================================================
// API Functions
// ============================================================

async function fetchProfile(): Promise<UserProfile> {
  const response = await fetch('/api/v1/users/me')
  const result: ApiResponse<UserProfile> = await response.json()

  if (!response.ok || !result.success) {
    throw new Error(result.error?.detail || 'Failed to fetch profile')
  }

  return result.data
}

async function updateProfile(
  input: UpdateProfileInput
): Promise<{ id: string; name: string; email: string }> {
  const response = await fetch('/api/v1/users/me', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const result: ApiResponse<{ id: string; name: string; email: string }> =
    await response.json()

  if (!response.ok || !result.success) {
    throw new Error(result.error?.detail || 'Failed to update profile')
  }

  return result.data
}

async function changePassword(
  input: ChangePasswordInput
): Promise<{ message: string }> {
  const response = await fetch('/api/v1/users/me/password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const result: ApiResponse<{ message: string }> = await response.json()

  if (!response.ok || !result.success) {
    throw new Error(result.error?.detail || 'Failed to change password')
  }

  return result.data
}

// ============================================================
// Hooks
// ============================================================

/**
 * 取得當前登入用戶的完整資料
 *
 * @returns React Query 結果，包含用戶資料、載入狀態、錯誤
 *
 * @example
 * ```tsx
 * const { data: profile, isLoading } = useProfile()
 * if (profile) {
 *   console.log(profile.email, profile.roles)
 * }
 * ```
 */
export function useProfile() {
  return useQuery({
    queryKey: profileKeys.me(),
    queryFn: fetchProfile,
    staleTime: 5 * 60 * 1000, // 5 分鐘
  })
}

/**
 * 更新當前用戶的顯示名稱
 *
 * @returns React Query mutation，成功後自動刷新 profile 快取
 *
 * @example
 * ```tsx
 * const { mutate: updateName, isPending } = useUpdateProfile()
 * updateName({ name: 'New Name' })
 * ```
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.me() })
    },
  })
}

/**
 * 修改當前用戶的密碼（僅限本地帳號）
 *
 * @returns React Query mutation
 *
 * @example
 * ```tsx
 * const { mutate: changePass, isPending } = useChangePassword()
 * changePass({
 *   currentPassword: 'old',
 *   newPassword: 'new',
 *   confirmPassword: 'new',
 * })
 * ```
 */
export function useChangePassword() {
  return useMutation({
    mutationFn: changePassword,
  })
}
