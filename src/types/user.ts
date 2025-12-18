/**
 * @fileoverview 用戶相關類型定義
 * @description
 *   定義與用戶系統相關的 TypeScript 類型。
 *   包含 Prisma 模型擴展、Session 類型、API 請求/響應類型等。
 *
 * @module src/types/user
 * @author Development Team
 * @since Epic 1 - Story 1.2 (User Database & Role Foundation)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @prisma/client - Prisma 生成的類型
 *   - ./role - 角色類型定義
 */

import type { User as PrismaUser, UserStatus } from '@prisma/client'
import type { SessionRole } from './role'

// Re-export UserStatus for convenience
export type { UserStatus } from '@prisma/client'

/**
 * 用戶（含角色關聯）
 * 用於需要完整角色資訊的場景
 */
export interface UserWithRoles extends PrismaUser {
  roles: {
    role: {
      id: string
      name: string
      permissions: string[]
    }
    cityId: string | null
  }[]
}

/**
 * Session 用戶資料
 * 用於客戶端 Session 中的用戶資訊
 */
export interface SessionUser {
  /** 用戶 ID */
  id: string
  /** 電子郵件 */
  email: string
  /** 用戶名稱 */
  name: string
  /** 用戶頭像 */
  image?: string | null
  /** 用戶狀態 */
  status: UserStatus
  /** 用戶角色列表 */
  roles: SessionRole[]
}

/**
 * 用戶列表項目
 * 用於管理員用戶列表顯示
 */
export interface UserListItem {
  /** 用戶 ID */
  id: string
  /** 電子郵件 */
  email: string
  /** 用戶名稱 */
  name: string | null
  /** 用戶頭像 */
  image?: string | null
  /** 用戶狀態 */
  status: UserStatus
  /** 創建時間 */
  createdAt: Date
  /** 最後登入時間 */
  lastLoginAt: Date | null
  /** 角色名稱列表 */
  roles: string[]
}

/**
 * 用戶詳情
 * 用於用戶詳情頁面
 */
export interface UserDetails {
  /** 用戶 ID */
  id: string
  /** 電子郵件 */
  email: string
  /** 用戶名稱 */
  name: string | null
  /** 用戶頭像 */
  image?: string | null
  /** Azure AD ID */
  azureAdId: string | null
  /** 用戶狀態 */
  status: UserStatus
  /** 創建時間 */
  createdAt: Date
  /** 更新時間 */
  updatedAt: Date
  /** 最後登入時間 */
  lastLoginAt: Date | null
  /** 用戶角色（含城市資訊）*/
  roles: {
    id: string
    name: string
    cityId: string | null
    cityName: string | null
  }[]
}

/**
 * 從 Azure AD 創建用戶的資料
 */
export interface CreateUserFromAzureAD {
  /** 電子郵件 */
  email: string
  /** 用戶名稱 */
  name: string
  /** 用戶頭像 URL */
  image?: string | null
  /** Azure AD 用戶 ID */
  azureAdId: string
}

/**
 * 更新用戶資料請求
 */
export interface UpdateUserRequest {
  /** 用戶名稱 */
  name?: string
  /** 用戶頭像 */
  image?: string | null
  /** 用戶狀態 */
  status?: UserStatus
}

/**
 * 用戶狀態更新請求
 */
export interface UpdateUserStatusRequest {
  /** 用戶 ID */
  userId: string
  /** 新狀態 */
  status: UserStatus
}

/**
 * 用戶搜尋參數
 */
export interface UserSearchParams {
  /** 搜尋關鍵字（名稱或電子郵件）*/
  search?: string
  /** 角色篩選 */
  role?: string
  /** 狀態篩選 */
  status?: UserStatus
  /** 城市篩選 */
  cityId?: string
  /** 頁碼 */
  page?: number
  /** 每頁數量 */
  limit?: number
}

/**
 * 用戶列表 API 響應
 */
export interface UsersApiResponse {
  success: boolean
  data?: UserListItem[]
  meta?: {
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }
  error?: {
    title: string
    status: number
    detail?: string
  }
}

/**
 * 用戶 API 響應（單一用戶）
 */
export interface UserApiResponse {
  success: boolean
  data?: UserDetails
  error?: {
    title: string
    status: number
    detail?: string
  }
}
