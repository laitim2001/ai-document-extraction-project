/**
 * @fileoverview 通知服務
 * @description
 *   提供系統通知功能，包括：
 *   - 創建通知記錄
 *   - 通知特定權限的用戶
 *   - 通知 Super User（規則管理權限）
 *
 * @module src/services/notification.service
 * @since Epic 3 - Story 3.6 (修正類型標記)
 * @lastModified 2025-12-18
 *
 * @features
 *   - AC4: 通知 Super User 規則建議
 *   - 支援多種通知類型
 *   - 可擴展的通知渠道（未來支援 Email、WebSocket 等）
 *
 * @dependencies
 *   - @/lib/prisma - 資料庫客戶端
 *   - @/types/permissions - 權限常量
 */

import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/types/permissions'

// ============================================================
// Types
// ============================================================

/**
 * 通知數據介面
 */
export interface NotificationData {
  /** 通知類型 */
  type: string
  /** 通知標題 */
  title: string
  /** 通知訊息 */
  message: string
  /** 附加數據 */
  data?: Record<string, unknown>
}

/**
 * 通知結果介面
 */
export interface NotificationResult {
  /** 創建的通知數量 */
  notificationCount: number
  /** 接收者郵件列表 */
  recipients: string[]
}

// ============================================================
// Notification Types
// ============================================================

/**
 * 通知類型常量
 */
export const NOTIFICATION_TYPES = {
  /** 規則建議通知 */
  RULE_SUGGESTION: 'RULE_SUGGESTION',
  /** 案件升級通知 */
  ESCALATION: 'ESCALATION',
  /** 系統警告通知 */
  SYSTEM_ALERT: 'SYSTEM_ALERT',
  /** 任務分配通知 */
  TASK_ASSIGNED: 'TASK_ASSIGNED',
} as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES]

// ============================================================
// Functions
// ============================================================

/**
 * 通知 Super User
 *
 * @description
 *   發送通知給所有具有規則管理權限的用戶。
 *   用於規則建議、升級案件等需要 Super User 處理的情況。
 *
 * @param notification - 通知數據
 * @returns 通知結果
 *
 * @example
 * ```typescript
 * await notifySuperUsers({
 *   type: 'RULE_SUGGESTION',
 *   title: '新的規則建議',
 *   message: 'DHL 的 invoiceNumber 欄位有新的映射建議',
 *   data: { suggestionId: 'sug-123', forwarderId: 'fwd-1' }
 * })
 * ```
 */
export async function notifySuperUsers(
  notification: NotificationData
): Promise<NotificationResult> {
  // 查找所有具有規則管理權限的活躍用戶
  const superUsers = await prisma.user.findMany({
    where: {
      roles: {
        some: {
          role: {
            permissions: {
              has: PERMISSIONS.RULE_MANAGE,
            },
          },
        },
      },
      status: 'ACTIVE',
    },
    select: { id: true, email: true },
  })

  if (superUsers.length === 0) {
    return {
      notificationCount: 0,
      recipients: [],
    }
  }

  // 創建通知記錄
  const notifications = await prisma.notification.createMany({
    data: superUsers.map((user) => ({
      userId: user.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data ? JSON.stringify(notification.data) : null,
    })),
  })

  // TODO: 未來可以添加：
  // - Email 通知
  // - WebSocket 即時推送
  // - Microsoft Teams 通知

  return {
    notificationCount: notifications.count,
    recipients: superUsers.map((u) => u.email),
  }
}

/**
 * 通知特定用戶
 *
 * @description
 *   發送通知給指定的用戶列表。
 *
 * @param userIds - 用戶 ID 列表
 * @param notification - 通知數據
 * @returns 創建的通知數量
 */
export async function notifyUsers(
  userIds: string[],
  notification: NotificationData
): Promise<number> {
  if (userIds.length === 0) {
    return 0
  }

  const result = await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data ? JSON.stringify(notification.data) : null,
    })),
  })

  return result.count
}

/**
 * 獲取用戶的未讀通知
 *
 * @param userId - 用戶 ID
 * @param limit - 返回數量限制
 * @returns 未讀通知列表
 */
export async function getUnreadNotifications(
  userId: string,
  limit: number = 10
) {
  return prisma.notification.findMany({
    where: {
      userId,
      isRead: false,
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}

/**
 * 標記通知為已讀
 *
 * @param notificationId - 通知 ID
 * @param userId - 用戶 ID（用於驗證擁有權）
 * @returns 是否成功
 */
export async function markNotificationAsRead(
  notificationId: string,
  userId: string
): Promise<boolean> {
  const result = await prisma.notification.updateMany({
    where: {
      id: notificationId,
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  })

  return result.count > 0
}

/**
 * 標記所有通知為已讀
 *
 * @param userId - 用戶 ID
 * @returns 更新的通知數量
 */
export async function markAllNotificationsAsRead(
  userId: string
): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  })

  return result.count
}

/**
 * 獲取用戶的未讀通知數量
 *
 * @param userId - 用戶 ID
 * @returns 未讀通知數量
 */
export async function getUnreadNotificationCount(
  userId: string
): Promise<number> {
  return prisma.notification.count({
    where: {
      userId,
      isRead: false,
    },
  })
}
