/**
 * @fileoverview 角色相關類型定義
 * @description
 *   定義與角色系統相關的 TypeScript 類型。
 *   包含 Prisma 模型擴展、API 請求/響應類型、Session 類型等。
 *
 * @module src/types/role
 * @author Development Team
 * @since Epic 1 - Story 1.2 (User Database & Role Foundation)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @prisma/client - Prisma 生成的類型
 */

import type { Role as PrismaRole, UserRole as PrismaUserRole } from '@prisma/client'

/**
 * 角色（含用戶數量統計）
 * 用於角色列表顯示
 */
export interface RoleWithUserCount extends PrismaRole {
  _count?: {
    users: number
  }
}

/**
 * 用戶角色（含完整角色詳情）
 * 用於查詢用戶的角色關聯
 */
export interface UserRoleWithRole extends PrismaUserRole {
  role: PrismaRole
}

/**
 * 用戶角色（含城市資訊）
 * 用於多城市管理場景
 */
export interface UserRoleWithDetails extends PrismaUserRole {
  role: PrismaRole
  city?: {
    id: string
    name: string
    code: string
  } | null
}

/**
 * 角色分配請求
 * 用於分配角色給用戶
 */
export interface AssignRoleRequest {
  /** 用戶 ID */
  userId: string
  /** 角色名稱 */
  roleName: string
  /** 城市 ID（City Manager 等需要） */
  cityId?: string
}

/**
 * 角色移除請求
 * 用於從用戶移除角色
 */
export interface RemoveRoleRequest {
  /** 用戶 ID */
  userId: string
  /** 角色 ID */
  roleId: string
}

/**
 * Session 中的角色資料（簡化版）
 * 用於 JWT token 中儲存角色資訊
 */
export interface SessionRole {
  /** 角色 ID */
  id: string
  /** 角色名稱 */
  name: string
  /** 角色權限列表 */
  permissions: string[]
}

/**
 * 角色列表項目
 * 用於 API 響應和 UI 顯示
 */
export interface RoleListItem {
  /** 角色 ID */
  id: string
  /** 角色名稱 */
  name: string
  /** 角色描述 */
  description: string | null
  /** 權限數量 */
  permissionCount: number
  /** 用戶數量 */
  userCount: number
  /** 是否為系統預設角色 */
  isSystem: boolean
}

/**
 * 角色詳情
 * 用於角色詳情頁面
 */
export interface RoleDetails {
  /** 角色 ID */
  id: string
  /** 角色名稱 */
  name: string
  /** 角色描述 */
  description: string | null
  /** 完整權限列表 */
  permissions: string[]
  /** 是否為系統預設角色 */
  isSystem: boolean
  /** 創建時間 */
  createdAt: Date
  /** 擁有此角色的用戶數量 */
  userCount: number
}

/**
 * 角色 API 響應
 */
export interface RolesApiResponse {
  success: boolean
  data?: PrismaRole[]
  error?: {
    title: string
    status: number
    detail?: string
  }
}

/**
 * 角色分配結果
 */
export interface RoleAssignmentResult {
  success: boolean
  message: string
  userRole?: PrismaUserRole
}
