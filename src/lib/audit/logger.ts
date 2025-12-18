/**
 * @fileoverview 審計日誌模組
 * @description
 *   提供統一的審計日誌記錄功能。
 *   用於追蹤用戶操作、系統變更等重要事件。
 *
 *   功能特點：
 *   - 記錄用戶相關變更（角色、城市、資料）
 *   - 支援通用審計日誌記錄
 *   - 非阻塞式日誌（不影響主要操作）
 *   - 查詢審計日誌
 *
 * @module src/lib/audit/logger
 * @author Development Team
 * @since Epic 1 - Story 1.5 (Modify User Role & City)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @/lib/prisma - Prisma 客戶端
 *
 * @related
 *   - src/services/user.service.ts - 用戶服務
 *   - src/app/api/admin/users/[id]/route.ts - 用戶更新 API
 */

import { prisma } from '@/lib/prisma'

// ============================================================
// Types
// ============================================================

/**
 * 審計動作類型
 */
export type AuditAction =
  | 'CREATE_USER'
  | 'UPDATE_USER'
  | 'UPDATE_ROLE'
  | 'UPDATE_CITY'
  | 'UPDATE_INFO'
  | 'UPDATE_STATUS'
  | 'DELETE_USER'
  | 'CREATE_ROLE'
  | 'UPDATE_ROLE_PERMISSIONS'
  | 'DELETE_ROLE'

/**
 * 實體類型
 */
export type EntityType = 'USER' | 'ROLE' | 'PERMISSION' | 'CITY'

/**
 * 用戶變更日誌參數
 */
interface LogUserChangeParams {
  /** 目標用戶 ID */
  userId: string
  /** 操作動作 */
  action: AuditAction
  /** 舊值 */
  oldValue: unknown
  /** 新值 */
  newValue: unknown
  /** 執行者用戶 ID */
  performedBy: string
  /** IP 位址（可選）*/
  ipAddress?: string
}

/**
 * 通用審計日誌參數
 */
interface LogParams {
  /** 實體類型 */
  entityType: EntityType
  /** 實體 ID */
  entityId: string
  /** 操作動作 */
  action: AuditAction
  /** 舊值（可選）*/
  oldValue?: unknown
  /** 新值（可選）*/
  newValue?: unknown
  /** 執行者用戶 ID */
  performedBy: string
  /** 額外元數據（可選）*/
  metadata?: Record<string, unknown>
  /** IP 位址（可選）*/
  ipAddress?: string
}

// ============================================================
// Logging Functions
// ============================================================

/**
 * 記錄用戶相關變更
 *
 * @description
 *   專門用於記錄用戶相關的變更操作。
 *   自動設置 entityType 為 'USER'。
 *
 * @param params - 變更參數
 *
 * @example
 *   await logUserChange({
 *     userId: 'user-id',
 *     action: 'UPDATE_ROLE',
 *     oldValue: ['role-1'],
 *     newValue: ['role-1', 'role-2'],
 *     performedBy: 'admin-id',
 *   })
 */
export async function logUserChange(params: LogUserChangeParams): Promise<void> {
  await logAudit({
    entityType: 'USER',
    entityId: params.userId,
    action: params.action,
    oldValue: params.oldValue,
    newValue: params.newValue,
    performedBy: params.performedBy,
    ipAddress: params.ipAddress,
  })
}

/**
 * 通用審計日誌記錄
 *
 * @description
 *   記錄任意類型的審計日誌。
 *   使用非阻塞方式，即使日誌記錄失敗也不會影響主要操作。
 *
 * @param params - 日誌參數
 *
 * @example
 *   await logAudit({
 *     entityType: 'ROLE',
 *     entityId: 'role-id',
 *     action: 'CREATE_ROLE',
 *     newValue: { name: 'New Role' },
 *     performedBy: 'admin-id',
 *   })
 */
export async function logAudit(params: LogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.performedBy,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        details: {
          oldValue: params.oldValue ?? null,
          newValue: params.newValue ?? null,
          ...(params.metadata ?? {}),
        },
        ipAddress: params.ipAddress ?? null,
      },
    })
  } catch (error) {
    // 非阻塞 - 記錄錯誤但不中斷主要操作
    console.error('Failed to create audit log:', error)
  }
}

// ============================================================
// Query Functions
// ============================================================

/**
 * 審計日誌查詢參數
 */
interface GetAuditLogsParams {
  /** 實體類型篩選 */
  entityType?: EntityType
  /** 實體 ID 篩選 */
  entityId?: string
  /** 操作動作篩選 */
  action?: AuditAction
  /** 執行者用戶 ID 篩選 */
  performedBy?: string
  /** 開始日期 */
  startDate?: Date
  /** 結束日期 */
  endDate?: Date
  /** 數量限制 */
  limit?: number
  /** 偏移量 */
  offset?: number
}

/**
 * 查詢審計日誌
 *
 * @description
 *   根據條件查詢審計日誌，支援分頁。
 *
 * @param params - 查詢參數
 * @returns 日誌列表和總數
 *
 * @example
 *   const { logs, total } = await getAuditLogs({
 *     entityType: 'USER',
 *     entityId: 'user-id',
 *     limit: 20,
 *   })
 */
export async function getAuditLogs(params: GetAuditLogsParams) {
  const {
    entityType,
    entityId,
    action,
    performedBy,
    startDate,
    endDate,
    limit = 50,
    offset = 0,
  } = params

  const where = {
    ...(entityType && { entityType }),
    ...(entityId && { entityId }),
    ...(action && { action }),
    ...(performedBy && { userId: performedBy }),
    ...(startDate || endDate
      ? {
          createdAt: {
            ...(startDate && { gte: startDate }),
            ...(endDate && { lte: endDate }),
          },
        }
      : {}),
  }

  const [logs, total] = await prisma.$transaction([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
    prisma.auditLog.count({ where }),
  ])

  return { logs, total }
}

/**
 * 獲取實體的審計歷史
 *
 * @description
 *   獲取特定實體的完整審計歷史。
 *
 * @param entityType - 實體類型
 * @param entityId - 實體 ID
 * @param limit - 數量限制
 * @returns 審計日誌列表
 */
export async function getEntityAuditHistory(
  entityType: EntityType,
  entityId: string,
  limit = 50
) {
  return prisma.auditLog.findMany({
    where: {
      entityType,
      entityId,
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  })
}
