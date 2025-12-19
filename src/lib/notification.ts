/**
 * @fileoverview 通知工具函數
 * @description
 *   提供便捷的通知發送函數，封裝 notification service 的功能。
 *   用於簡化單一用戶通知的發送。
 *
 * @module src/lib/notification
 * @since Epic 7 - Story 7.4 (費用明細報表匯出)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @/services/notification.service - 通知服務
 */

import { notifyUsers, NotificationData } from '@/services/notification.service'

/**
 * 單一用戶通知參數
 */
export interface SendNotificationParams extends NotificationData {
  /** 目標用戶 ID */
  userId: string
}

/**
 * 發送通知給單一用戶
 *
 * @description
 *   便捷函數，用於向單一用戶發送通知。
 *   內部使用 notifyUsers 服務函數。
 *
 * @param params - 通知參數（包含 userId 和通知內容）
 * @returns 是否發送成功
 *
 * @example
 * ```typescript
 * await sendNotification({
 *   userId: 'user-123',
 *   type: 'REPORT_READY',
 *   title: '報表生成完成',
 *   message: '您的費用明細報表已生成完成，點擊下載。',
 *   data: { jobId, downloadUrl }
 * })
 * ```
 */
export async function sendNotification(
  params: SendNotificationParams
): Promise<boolean> {
  const { userId, ...notification } = params

  try {
    const count = await notifyUsers([userId], notification)
    return count > 0
  } catch (error) {
    console.error('Failed to send notification:', error)
    return false
  }
}

/**
 * 報表相關通知類型
 */
export const REPORT_NOTIFICATION_TYPES = {
  /** 報表生成完成 */
  REPORT_READY: 'REPORT_READY',
  /** 報表生成失敗 */
  REPORT_FAILED: 'REPORT_FAILED',
} as const

export type ReportNotificationType =
  (typeof REPORT_NOTIFICATION_TYPES)[keyof typeof REPORT_NOTIFICATION_TYPES]
