'use client'

/**
 * @fileoverview 用戶查詢與操作 Hook
 * @description
 *   提供客戶端用戶管理功能，包含查詢、創建等操作。
 *   使用 React Query 進行資料緩存和狀態管理。
 *
 *   主要功能：
 *   - 分頁用戶列表查詢
 *   - 關鍵字搜尋（名稱、電子郵件）
 *   - 角色、城市、狀態篩選
 *   - 平滑分頁切換（保留前一頁數據）
 *   - 創建新用戶（Story 1.4）
 *
 * @module src/hooks/use-users
 * @author Development Team
 * @since Epic 1 - Story 1.3 (User List & Search)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @tanstack/react-query - 資料查詢和緩存
 *
 * @example
 *   // 查詢用戶列表
 *   const { data, isLoading } = useUsers({
 *     page: 1,
 *     pageSize: 20,
 *     search: 'john',
 *   })
 *
 *   // 創建新用戶
 *   const { mutate: createUser, isPending } = useCreateUser()
 *   createUser({ email: 'user@example.com', name: 'John', roleIds: ['role-id'] })
 */

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import type { UserStatus } from '@prisma/client'
import type { CreateUserInput, UpdateUserInput } from '@/lib/validations/user.schema'

// ============================================================
// Types
// ============================================================

/**
 * useUsers Hook 參數
 */
export interface UseUsersParams {
  /** 頁碼（從 1 開始）*/
  page: number
  /** 每頁數量 */
  pageSize?: number
  /** 搜尋關鍵字 */
  search?: string
  /** 角色 ID 篩選 */
  roleId?: string
  /** 城市 ID 篩選 */
  cityId?: string
  /** 狀態篩選 */
  status?: UserStatus
  /** 排序欄位 */
  sortBy?: string
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc'
}

/**
 * 用戶列表項目
 */
export interface UserListItem {
  /** 用戶 ID */
  id: string
  /** 電子郵件 */
  email: string
  /** 用戶名稱 */
  name: string | null
  /** 用戶頭像 */
  image: string | null
  /** 用戶狀態 */
  status: UserStatus
  /** 創建時間 */
  createdAt: string
  /** 最後登入時間 */
  lastLoginAt: string | null
  /** 用戶角色（含城市資訊） */
  roles: {
    role: {
      id: string
      name: string
    }
    cityId: string | null
    city?: {
      id: string
      name: string
      code: string
    } | null
  }[]
}

/**
 * 分頁資訊
 */
export interface UsersMeta {
  /** 總數量 */
  total: number
  /** 當前頁碼 */
  page: number
  /** 每頁數量 */
  pageSize: number
  /** 總頁數 */
  totalPages: number
}

/**
 * 用戶 API 響應
 */
interface UsersApiResponse {
  success: boolean
  data?: UserListItem[]
  meta?: UsersMeta
  error?: {
    title: string
    status: number
    detail?: string
  }
}

// ============================================================
// Fetch Function
// ============================================================

/**
 * 從 API 獲取用戶列表
 * @param params - 查詢參數
 * @returns API 響應
 */
async function fetchUsers(params: UseUsersParams): Promise<UsersApiResponse> {
  const searchParams = new URLSearchParams()

  // 構建查詢參數
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '' && value !== null) {
      searchParams.set(key, String(value))
    }
  })

  const response = await fetch(`/api/admin/users?${searchParams}`)
  const json: UsersApiResponse = await response.json()

  if (!response.ok) {
    throw new Error(json.error?.detail || 'Failed to fetch users')
  }

  return json
}

// ============================================================
// Hook
// ============================================================

/**
 * 用戶列表查詢 Hook
 * 使用 React Query 管理用戶列表的獲取、緩存和狀態
 *
 * @description
 *   特性：
 *   - keepPreviousData: 分頁切換時保留前一頁數據，提供平滑體驗
 *   - staleTime: 30 秒內數據視為新鮮，不重新請求
 *   - queryKey 包含所有參數，確保參數變化時重新請求
 *
 * @param params - 查詢參數
 * @returns React Query 查詢結果
 *
 * @example
 *   // 基本用法
 *   const { data, isLoading, error } = useUsers({ page: 1 })
 *
 *   // 帶搜尋和篩選
 *   const { data } = useUsers({
 *     page: 1,
 *     pageSize: 20,
 *     search: 'john',
 *     status: 'ACTIVE',
 *   })
 *
 *   // 存取數據
 *   const users = data?.data ?? []
 *   const meta = data?.meta
 */
export function useUsers(params: UseUsersParams) {
  return useQuery({
    queryKey: ['users', params],
    queryFn: () => fetchUsers(params),
    staleTime: 30 * 1000, // 30 秒
    placeholderData: keepPreviousData, // 分頁切換時保留前一頁數據
  })
}

// ============================================================
// Create User Mutation (Story 1.4)
// ============================================================

/**
 * 創建用戶 API 響應
 */
interface CreateUserApiResponse {
  success: boolean
  data?: UserListItem
  error?: {
    type: string
    title: string
    status: number
    detail: string
    errors?: { field: string; message: string }[]
  }
}

/**
 * 創建用戶 API 呼叫
 * @param input - 創建用戶輸入
 * @returns API 響應
 */
async function createUserRequest(input: CreateUserInput): Promise<CreateUserApiResponse> {
  const response = await fetch('/api/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  const json: CreateUserApiResponse = await response.json()

  if (!response.ok) {
    throw new Error(json.error?.detail || '創建用戶失敗')
  }

  return json
}

/**
 * 創建用戶 Mutation Hook
 *
 * @description
 *   使用 React Query 的 useMutation 管理創建用戶操作。
 *   成功後自動刷新用戶列表。
 *
 * @returns React Query Mutation 結果
 *
 * @since Story 1.4
 *
 * @example
 *   const { mutate: createUser, isPending, error } = useCreateUser()
 *
 *   const handleSubmit = (data: CreateUserInput) => {
 *     createUser(data, {
 *       onSuccess: () => toast({ title: 'User created' }),
 *       onError: (error) => toast({ title: 'Error', description: error.message }),
 *     })
 *   }
 */
export function useCreateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createUserRequest,
    onSuccess: () => {
      // 成功後刷新用戶列表
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

// ============================================================
// Get Single User (Story 1.5)
// ============================================================

/**
 * 單一用戶詳情類型（包含角色和城市）
 */
export interface UserDetail {
  /** 用戶 ID */
  id: string
  /** 電子郵件 */
  email: string
  /** 用戶名稱 */
  name: string | null
  /** 用戶頭像 */
  image: string | null
  /** 用戶狀態 */
  status: UserStatus
  /** 創建時間 */
  createdAt: string
  /** 更新時間 */
  updatedAt: string
  /** 最後登入時間 */
  lastLoginAt: string | null
  /** 用戶角色（詳細資訊） */
  roles: {
    id: string
    roleId: string
    cityId: string | null
    role: {
      id: string
      name: string
      description: string | null
    }
    city: {
      id: string
      name: string
      code: string
    } | null
  }[]
}

/**
 * 單一用戶 API 響應
 */
interface UserApiResponse {
  success: boolean
  data?: UserDetail
  error?: {
    type: string
    title: string
    status: number
    detail: string
  }
}

/**
 * 獲取單一用戶詳情
 * @param userId - 用戶 ID
 * @returns API 響應
 */
async function fetchUser(userId: string): Promise<UserApiResponse> {
  const response = await fetch(`/api/admin/users/${userId}`)
  const json: UserApiResponse = await response.json()

  if (!response.ok) {
    throw new Error(json.error?.detail || 'Failed to fetch user')
  }

  return json
}

/**
 * 單一用戶查詢 Hook
 *
 * @description
 *   使用 React Query 獲取單一用戶詳情。
 *   支援 enabled 參數控制是否執行查詢。
 *
 * @param userId - 用戶 ID
 * @param options - 查詢選項
 * @returns React Query 查詢結果
 *
 * @since Story 1.5
 *
 * @example
 *   const { data, isLoading } = useUser('user-id')
 *   const user = data?.data
 */
export function useUser(userId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
    enabled: options?.enabled ?? !!userId,
    staleTime: 30 * 1000, // 30 秒
  })
}

// ============================================================
// Update User Mutation (Story 1.5)
// ============================================================

/**
 * 更新用戶 API 響應
 */
interface UpdateUserApiResponse {
  success: boolean
  data?: UserDetail
  error?: {
    type: string
    title: string
    status: number
    detail: string
    errors?: { field: string; message: string }[]
  }
}

/**
 * 更新用戶輸入（包含用戶 ID）
 */
interface UpdateUserRequestInput {
  userId: string
  data: UpdateUserInput
}

/**
 * 更新用戶 API 呼叫
 * @param input - 更新用戶輸入
 * @returns API 響應
 */
async function updateUserRequest(input: UpdateUserRequestInput): Promise<UpdateUserApiResponse> {
  const response = await fetch(`/api/admin/users/${input.userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input.data),
  })

  const json: UpdateUserApiResponse = await response.json()

  if (!response.ok) {
    throw new Error(json.error?.detail || '更新用戶失敗')
  }

  return json
}

/**
 * 更新用戶 Mutation Hook
 *
 * @description
 *   使用 React Query 的 useMutation 管理更新用戶操作。
 *   成功後自動刷新用戶列表和單一用戶詳情。
 *
 * @returns React Query Mutation 結果
 *
 * @since Story 1.5
 *
 * @example
 *   const { mutate: updateUser, isPending, error } = useUpdateUser()
 *
 *   const handleSubmit = (data: UpdateUserInput) => {
 *     updateUser(
 *       { userId: 'user-id', data },
 *       {
 *         onSuccess: () => toast({ title: 'User updated' }),
 *         onError: (error) => toast({ title: 'Error', description: error.message }),
 *       }
 *     )
 *   }
 */
export function useUpdateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateUserRequest,
    onSuccess: (_data, variables) => {
      // 成功後刷新用戶列表和單一用戶詳情
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['user', variables.userId] })
    },
  })
}

// ============================================================
// Update User Status Mutation (Story 1.6)
// ============================================================

/**
 * 更新用戶狀態 API 響應
 */
interface UpdateUserStatusApiResponse {
  success: boolean
  data?: {
    id: string
    status: UserStatus
  }
  error?: {
    type: string
    title: string
    status: number
    detail: string
  }
}

/**
 * 更新用戶狀態輸入
 */
interface UpdateUserStatusInput {
  /** 目標用戶 ID */
  userId: string
  /** 新狀態 */
  status: UserStatus
}

/**
 * 更新用戶狀態 API 呼叫
 * @param input - 更新用戶狀態輸入
 * @returns API 響應
 */
async function updateUserStatusRequest(
  input: UpdateUserStatusInput
): Promise<UpdateUserStatusApiResponse> {
  const response = await fetch(`/api/admin/users/${input.userId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: input.status }),
  })

  const json: UpdateUserStatusApiResponse = await response.json()

  if (!response.ok) {
    throw new Error(json.error?.detail || '更新用戶狀態失敗')
  }

  return json
}

/**
 * 更新用戶狀態 Mutation Hook
 *
 * @description
 *   使用 React Query 的 useMutation 管理用戶狀態更新操作。
 *   支援啟用/停用用戶帳戶。
 *   成功後自動刷新用戶列表和單一用戶詳情。
 *
 * @returns React Query Mutation 結果
 *
 * @since Story 1.6
 *
 * @example
 *   const { mutate: updateStatus, isPending } = useUpdateUserStatus()
 *
 *   // 停用用戶
 *   updateStatus(
 *     { userId: 'user-id', status: 'INACTIVE' },
 *     {
 *       onSuccess: () => toast({ title: '用戶已停用' }),
 *       onError: (error) => toast({ title: '錯誤', description: error.message }),
 *     }
 *   )
 *
 *   // 啟用用戶
 *   updateStatus(
 *     { userId: 'user-id', status: 'ACTIVE' },
 *     {
 *       onSuccess: () => toast({ title: '用戶已啟用' }),
 *     }
 *   )
 */
export function useUpdateUserStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateUserStatusRequest,
    onSuccess: (_data, variables) => {
      // 成功後刷新用戶列表和單一用戶詳情
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['user', variables.userId] })
    },
  })
}
