/**
 * @fileoverview City 權限檢查中間件
 * @description
 *   提供基於城市的權限控制功能，支援 City Manager 角色的城市範圍限制。
 *
 *   權限層級：
 *   - USER_MANAGE: 全域管理權限，可管理所有城市的用戶
 *   - USER_MANAGE_CITY: 城市級管理權限，只能管理所屬城市的用戶
 *
 *   使用場景：
 *   - City Manager 查看用戶列表時，自動過濾為所屬城市
 *   - City Manager 創建/編輯用戶時，驗證目標城市權限
 *   - 跨城市操作時返回 403 錯誤
 *
 * @module src/lib/auth/city-permission
 * @author Development Team
 * @since Epic 1 - Story 1.8 (City Manager User Management)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @/types/permissions - 權限常量
 *
 * @related
 *   - src/app/api/admin/users/route.ts - 用戶 API
 *   - src/services/user.service.ts - 用戶服務層
 */

import { PERMISSIONS, type Permission } from '@/types/permissions'

// ============================================================
// Types
// ============================================================

/**
 * Session 中的角色資訊
 */
interface SessionRole {
  id: string
  name: string
  permissions: string[]
  cityId?: string | null
}

/**
 * 用戶 Session 資訊
 */
interface SessionUser {
  id: string
  roles?: SessionRole[]
}

/**
 * 城市權限檢查結果
 */
export interface CityPermissionResult {
  /** 是否有權限 */
  hasPermission: boolean
  /** 權限範圍：'global' (全域), 'city' (城市級), 'none' (無權限) */
  scope: 'global' | 'city' | 'none'
  /** City Manager 所屬的城市 ID (僅當 scope 為 'city' 時有值) */
  cityId?: string
  /** 錯誤訊息 (當無權限時) */
  errorMessage?: string
}

// ============================================================
// Permission Check Functions
// ============================================================

/**
 * 檢查用戶管理權限
 *
 * @description
 *   檢查當前用戶是否有管理用戶的權限。
 *   權限優先順序：
 *   1. USER_MANAGE (全域) > 可管理所有用戶
 *   2. USER_MANAGE_CITY (城市級) > 只能管理所屬城市的用戶
 *
 * @param user - Session 用戶資訊
 * @returns 城市權限檢查結果
 *
 * @example
 *   const result = checkCityManagePermission(session.user)
 *   if (!result.hasPermission) {
 *     return NextResponse.json({ error: result.errorMessage }, { status: 403 })
 *   }
 *   if (result.scope === 'city') {
 *     // 限制為特定城市
 *     filters.cityId = result.cityId
 *   }
 */
export function checkCityManagePermission(
  user: SessionUser | undefined | null
): CityPermissionResult {
  if (!user?.roles) {
    return {
      hasPermission: false,
      scope: 'none',
      errorMessage: '未授權的存取',
    }
  }

  // 檢查是否有全域管理權限
  const hasGlobalPermission = user.roles.some((role) =>
    role.permissions.includes(PERMISSIONS.USER_MANAGE)
  )

  if (hasGlobalPermission) {
    return {
      hasPermission: true,
      scope: 'global',
    }
  }

  // 檢查是否有城市級管理權限
  const cityManagerRole = user.roles.find(
    (role) =>
      role.permissions.includes(PERMISSIONS.USER_MANAGE_CITY) && role.cityId
  )

  if (cityManagerRole && cityManagerRole.cityId) {
    return {
      hasPermission: true,
      scope: 'city',
      cityId: cityManagerRole.cityId,
    }
  }

  return {
    hasPermission: false,
    scope: 'none',
    errorMessage: '您沒有用戶管理權限',
  }
}

/**
 * 檢查用戶創建權限
 *
 * @description
 *   檢查當前用戶是否有創建新用戶的權限。
 *   City Manager 只能在所屬城市創建用戶。
 *
 * @param user - Session 用戶資訊
 * @param targetCityId - 目標城市 ID (用戶要創建在哪個城市)
 * @returns 城市權限檢查結果
 *
 * @example
 *   const result = checkCityCreatePermission(session.user, body.cityId)
 *   if (!result.hasPermission) {
 *     return NextResponse.json({ error: result.errorMessage }, { status: 403 })
 *   }
 */
export function checkCityCreatePermission(
  user: SessionUser | undefined | null,
  targetCityId?: string | null
): CityPermissionResult {
  const basePermission = checkCityManagePermission(user)

  if (!basePermission.hasPermission) {
    return basePermission
  }

  // 全域權限可以在任何城市創建用戶
  if (basePermission.scope === 'global') {
    return basePermission
  }

  // 城市級權限需要檢查目標城市
  if (basePermission.scope === 'city') {
    // 如果沒有指定城市，使用 City Manager 的城市
    if (!targetCityId) {
      return basePermission
    }

    // 檢查目標城市是否與 City Manager 的城市相同
    if (targetCityId !== basePermission.cityId) {
      return {
        hasPermission: false,
        scope: 'none',
        errorMessage: '您只能在所屬城市創建用戶',
      }
    }

    return basePermission
  }

  return {
    hasPermission: false,
    scope: 'none',
    errorMessage: '您沒有用戶創建權限',
  }
}

/**
 * 檢查用戶編輯權限
 *
 * @description
 *   檢查當前用戶是否有編輯特定用戶的權限。
 *   City Manager 只能編輯所屬城市的用戶。
 *
 * @param user - Session 用戶資訊
 * @param targetUserCityId - 目標用戶的城市 ID
 * @returns 城市權限檢查結果
 *
 * @example
 *   const result = checkCityEditPermission(session.user, targetUser.cityId)
 *   if (!result.hasPermission) {
 *     return NextResponse.json({ error: result.errorMessage }, { status: 403 })
 *   }
 */
export function checkCityEditPermission(
  user: SessionUser | undefined | null,
  targetUserCityId?: string | null
): CityPermissionResult {
  const basePermission = checkCityManagePermission(user)

  if (!basePermission.hasPermission) {
    return basePermission
  }

  // 全域權限可以編輯任何城市的用戶
  if (basePermission.scope === 'global') {
    return basePermission
  }

  // 城市級權限需要檢查目標用戶的城市
  if (basePermission.scope === 'city') {
    // 目標用戶沒有城市，不屬於任何 City Manager
    if (!targetUserCityId) {
      return {
        hasPermission: false,
        scope: 'none',
        errorMessage: '此用戶不屬於您管理的城市',
      }
    }

    // 檢查目標用戶的城市是否與 City Manager 的城市相同
    if (targetUserCityId !== basePermission.cityId) {
      return {
        hasPermission: false,
        scope: 'none',
        errorMessage: '您只能編輯所屬城市的用戶',
      }
    }

    return basePermission
  }

  return {
    hasPermission: false,
    scope: 'none',
    errorMessage: '您沒有用戶編輯權限',
  }
}

// ============================================================
// Filter Helpers
// ============================================================

/**
 * 獲取城市過濾條件
 *
 * @description
 *   根據用戶權限返回適當的城市過濾條件。
 *   全域權限不需要過濾，城市級權限返回所屬城市 ID。
 *
 * @param user - Session 用戶資訊
 * @returns 城市 ID (城市級) 或 undefined (全域)
 *
 * @example
 *   const cityFilter = getCityFilter(session.user)
 *   const users = await getUsers({
 *     ...params,
 *     cityId: cityFilter ?? params.cityId,
 *   })
 */
export function getCityFilter(
  user: SessionUser | undefined | null
): string | undefined {
  const permission = checkCityManagePermission(user)

  if (permission.scope === 'city' && permission.cityId) {
    return permission.cityId
  }

  return undefined
}

/**
 * 檢查是否有檢視權限
 *
 * @description
 *   檢查用戶是否有檢視用戶列表的權限。
 *   需要 USER_VIEW 或 USER_MANAGE 或 USER_MANAGE_CITY 權限之一。
 *
 * @param user - Session 用戶資訊
 * @returns 是否有檢視權限
 */
export function hasViewPermission(
  user: SessionUser | undefined | null
): boolean {
  if (!user?.roles) {
    return false
  }

  return user.roles.some(
    (role) =>
      role.permissions.includes(PERMISSIONS.USER_VIEW) ||
      role.permissions.includes(PERMISSIONS.USER_MANAGE) ||
      role.permissions.includes(PERMISSIONS.USER_MANAGE_CITY)
  )
}

/**
 * 獲取用戶的管理城市列表
 *
 * @description
 *   獲取用戶可以管理的城市 ID 列表。
 *   全域權限返回 null（表示全部），城市級權限返回城市 ID 列表。
 *
 * @param user - Session 用戶資訊
 * @returns 城市 ID 列表 或 null (全域)
 */
export function getManagedCityIds(
  user: SessionUser | undefined | null
): string[] | null {
  if (!user?.roles) {
    return []
  }

  // 檢查是否有全域管理權限
  const hasGlobalPermission = user.roles.some((role) =>
    role.permissions.includes(PERMISSIONS.USER_MANAGE)
  )

  if (hasGlobalPermission) {
    return null // null 表示全域權限
  }

  // 收集所有 City Manager 角色的城市 ID
  const cityIds = user.roles
    .filter(
      (role) =>
        role.permissions.includes(PERMISSIONS.USER_MANAGE_CITY) && role.cityId
    )
    .map((role) => role.cityId!)

  return [...new Set(cityIds)] // 去重
}

// ============================================================
// Generic Permission Check
// ============================================================

/**
 * 檢查用戶是否擁有特定權限
 *
 * @description
 *   通用權限檢查函數，檢查用戶的所有角色中是否包含指定權限。
 *
 * @param user - Session 用戶資訊
 * @param permission - 要檢查的權限
 * @returns 是否有該權限
 *
 * @example
 *   if (!hasPermission(session.user, PERMISSIONS.INVOICE_CREATE)) {
 *     return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
 *   }
 */
export function hasPermission(
  user: SessionUser | undefined | null,
  permission: Permission
): boolean {
  if (!user?.roles) {
    return false
  }

  return user.roles.some((role) => role.permissions.includes(permission))
}
