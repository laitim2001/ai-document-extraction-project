/**
 * @fileoverview 安全日誌服務
 * @description
 *   提供安全事件記錄和管理功能：
 *   - 記錄未授權訪問嘗試
 *   - 記錄安全事件（登入異常、可疑活動等）
 *   - 根據重複嘗試自動提升嚴重性
 *   - 觸發安全警報通知管理員
 *
 *   ## 嚴重性等級
 *   - LOW: 單次嘗試
 *   - MEDIUM: 1-2 次重複嘗試
 *   - HIGH: 3+ 次重複嘗試
 *   - CRITICAL: 需立即處理
 *
 * @module src/services/security-log
 * @author Development Team
 * @since Epic 6 - Story 6.2 (City User Data Access Control)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @/lib/prisma - Prisma 客戶端
 *   - @prisma/client - Prisma 類型
 *
 * @related
 *   - src/middleware/resource-access.ts - 資源訪問驗證
 *   - src/middleware/city-filter.ts - 城市過濾中間件
 */

import { prisma } from '@/lib/prisma'
import { SecurityEventType, SecuritySeverity, Prisma } from '@prisma/client'

// ===========================================
// Types
// ===========================================

/**
 * 未授權訪問記錄參數
 */
interface UnauthorizedAccessParams {
  /** 用戶 ID */
  userId: string
  /** 資源類型 */
  resourceType: string
  /** 資源 ID */
  resourceId: string
  /** 資源所屬城市代碼 */
  resourceCityCode: string
  /** 用戶授權城市代碼列表 */
  userCityCodes: string[]
  /** 客戶端 IP 地址 */
  ipAddress?: string
  /** 用戶代理字串 */
  userAgent?: string
  /** 請求路徑 */
  requestPath?: string
}

/**
 * 安全事件記錄參數
 */
interface SecurityEventParams {
  /** 用戶 ID */
  userId: string
  /** 事件類型 */
  eventType: SecurityEventType
  /** 資源類型 */
  resourceType?: string
  /** 資源 ID */
  resourceId?: string
  /** 事件詳情 */
  details?: Prisma.InputJsonValue
  /** 嚴重性等級 */
  severity?: SecuritySeverity
  /** 客戶端 IP 地址 */
  ipAddress?: string
  /** 用戶代理字串 */
  userAgent?: string
  /** 請求路徑 */
  requestPath?: string
}

/**
 * 安全日誌查詢選項
 */
interface SecurityLogQueryOptions {
  /** 用戶 ID 過濾 */
  userId?: string
  /** 事件類型過濾 */
  eventType?: SecurityEventType
  /** 嚴重性過濾 */
  severity?: SecuritySeverity
  /** 是否已解決 */
  resolved?: boolean
  /** 起始時間 */
  from?: Date
  /** 結束時間 */
  to?: Date
  /** 頁碼 */
  page?: number
  /** 每頁數量 */
  limit?: number
}

/**
 * 安全日誌查詢結果
 */
interface SecurityLogQueryResult {
  logs: Array<{
    id: string
    userId: string
    eventType: SecurityEventType
    resourceType: string | null
    resourceId: string | null
    details: unknown
    severity: SecuritySeverity
    ipAddress: string | null
    userAgent: string | null
    requestPath: string | null
    resolved: boolean
    resolvedBy: string | null
    resolvedAt: Date | null
    createdAt: Date
    user: {
      id: string
      email: string
      name: string | null
    }
  }>
  total: number
}

// ===========================================
// SecurityLogService Class
// ===========================================

/**
 * 安全日誌服務類
 *
 * @description
 *   提供安全事件的記錄、查詢和管理功能。
 *   所有方法都是靜態的，無需實例化。
 */
export class SecurityLogService {
  // ===========================================
  // 記錄方法
  // ===========================================

  /**
   * 記錄未授權訪問嘗試
   *
   * @description
   *   記錄跨城市訪問違規事件：
   *   - 自動計算嚴重性（基於近期嘗試次數）
   *   - 高嚴重性事件會觸發管理員警報
   *
   * @param params - 未授權訪問參數
   *
   * @example
   *   await SecurityLogService.logUnauthorizedAccess({
   *     userId: 'user-123',
   *     resourceType: 'document',
   *     resourceId: 'doc-456',
   *     resourceCityCode: 'NYC',
   *     userCityCodes: ['HKG'],
   *   })
   */
  static async logUnauthorizedAccess(
    params: UnauthorizedAccessParams
  ): Promise<void> {
    const {
      userId,
      resourceType,
      resourceId,
      resourceCityCode,
      userCityCodes,
      ipAddress,
      userAgent,
      requestPath,
    } = params

    // 計算嚴重性（基於近期嘗試次數）
    const recentAttempts = await this.getRecentAttempts(userId, 5)
    let severity: SecuritySeverity = SecuritySeverity.LOW
    if (recentAttempts >= 3) {
      severity = SecuritySeverity.HIGH
    } else if (recentAttempts >= 1) {
      severity = SecuritySeverity.MEDIUM
    }

    await prisma.securityLog.create({
      data: {
        userId,
        eventType: SecurityEventType.CROSS_CITY_ACCESS_VIOLATION,
        resourceType,
        resourceId,
        details: {
          resourceCityCode,
          userCityCodes,
          attemptTimestamp: new Date().toISOString(),
        },
        severity,
        ipAddress,
        userAgent,
        requestPath,
      },
    })

    // 高嚴重性事件觸發警報
    if (severity === SecuritySeverity.HIGH) {
      await this.triggerSecurityAlert({
        userId,
        eventType: SecurityEventType.CROSS_CITY_ACCESS_VIOLATION,
        severity: severity.toString(),
        details: params,
      })
    }
  }

  /**
   * 記錄通用安全事件
   *
   * @param params - 安全事件參數
   *
   * @example
   *   await SecurityLogService.logEvent({
   *     userId: 'user-123',
   *     eventType: SecurityEventType.SUSPICIOUS_ACTIVITY,
   *     details: { reason: 'Multiple failed login attempts' },
   *     severity: SecuritySeverity.MEDIUM,
   *   })
   */
  static async logEvent(params: SecurityEventParams): Promise<void> {
    const {
      userId,
      eventType,
      resourceType,
      resourceId,
      details,
      severity = SecuritySeverity.LOW,
      ipAddress,
      userAgent,
      requestPath,
    } = params

    await prisma.securityLog.create({
      data: {
        userId,
        eventType,
        resourceType,
        resourceId,
        details: details ?? undefined,
        severity,
        ipAddress,
        userAgent,
        requestPath,
      },
    })
  }

  /**
   * 記錄無效城市請求
   *
   * @param userId - 用戶 ID
   * @param invalidCityCode - 無效的城市代碼
   * @param ipAddress - IP 地址
   * @param requestPath - 請求路徑
   */
  static async logInvalidCityRequest(
    userId: string,
    invalidCityCode: string,
    ipAddress?: string,
    requestPath?: string
  ): Promise<void> {
    await this.logEvent({
      userId,
      eventType: SecurityEventType.INVALID_CITY_REQUEST,
      details: {
        invalidCityCode,
        timestamp: new Date().toISOString(),
      },
      severity: SecuritySeverity.LOW,
      ipAddress,
      requestPath,
    })
  }

  // ===========================================
  // 查詢方法
  // ===========================================

  /**
   * 獲取用戶近期未授權訪問嘗試次數
   *
   * @param userId - 用戶 ID
   * @param minutes - 時間範圍（分鐘）
   * @returns 嘗試次數
   */
  static async getRecentAttempts(
    userId: string,
    minutes: number = 5
  ): Promise<number> {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000)

    const count = await prisma.securityLog.count({
      where: {
        userId,
        eventType: SecurityEventType.CROSS_CITY_ACCESS_VIOLATION,
        createdAt: { gte: cutoff },
      },
    })

    return count
  }

  /**
   * 獲取安全日誌列表
   *
   * @param options - 查詢選項
   * @returns 日誌列表和總數
   *
   * @example
   *   const { logs, total } = await SecurityLogService.getSecurityLogs({
   *     severity: SecuritySeverity.HIGH,
   *     resolved: false,
   *     page: 1,
   *     limit: 20,
   *   })
   */
  static async getSecurityLogs(
    options: SecurityLogQueryOptions
  ): Promise<SecurityLogQueryResult> {
    const {
      userId,
      eventType,
      severity,
      resolved,
      from,
      to,
      page = 1,
      limit = 20,
    } = options

    // 構建 where 條件
    const where: Prisma.SecurityLogWhereInput = {}

    if (userId) where.userId = userId
    if (eventType) where.eventType = eventType
    if (severity) where.severity = severity
    if (resolved !== undefined) where.resolved = resolved
    if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = from
      if (to) where.createdAt.lte = to
    }

    // 並行查詢日誌和總數
    const [logs, total] = await Promise.all([
      prisma.securityLog.findMany({
        where,
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.securityLog.count({ where }),
    ])

    return { logs, total }
  }

  /**
   * 獲取未解決的高嚴重性事件數量
   *
   * @returns 未解決事件數量
   */
  static async getUnresolvedHighSeverityCount(): Promise<number> {
    return prisma.securityLog.count({
      where: {
        resolved: false,
        severity: { in: [SecuritySeverity.HIGH, SecuritySeverity.CRITICAL] },
      },
    })
  }

  // ===========================================
  // 管理方法
  // ===========================================

  /**
   * 標記安全日誌為已解決
   *
   * @param logId - 日誌 ID
   * @param resolvedBy - 解決者用戶 ID
   *
   * @example
   *   await SecurityLogService.resolveLog('log-123', 'admin-456')
   */
  static async resolveLog(logId: string, resolvedBy: string): Promise<void> {
    await prisma.securityLog.update({
      where: { id: logId },
      data: {
        resolved: true,
        resolvedBy,
        resolvedAt: new Date(),
      },
    })
  }

  /**
   * 批量解決安全日誌
   *
   * @param logIds - 日誌 ID 列表
   * @param resolvedBy - 解決者用戶 ID
   * @returns 更新數量
   */
  static async resolveMany(
    logIds: string[],
    resolvedBy: string
  ): Promise<number> {
    const result = await prisma.securityLog.updateMany({
      where: { id: { in: logIds } },
      data: {
        resolved: true,
        resolvedBy,
        resolvedAt: new Date(),
      },
    })

    return result.count
  }

  // ===========================================
  // 警報方法
  // ===========================================

  /**
   * 觸發安全警報
   *
   * @description
   *   向所有全球管理員發送安全警報通知。
   *   高嚴重性事件會自動觸發此方法。
   *
   * @param params - 警報參數
   */
  private static async triggerSecurityAlert(params: {
    userId: string
    eventType: SecurityEventType
    severity: string
    details: unknown
  }): Promise<void> {
    // 獲取觸發事件的用戶資訊
    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { email: true, name: true },
    })

    // 獲取所有全球管理員
    const globalAdmins = await prisma.user.findMany({
      where: { isGlobalAdmin: true },
      select: { id: true },
    })

    // 為每個管理員創建通知
    for (const admin of globalAdmins) {
      await prisma.notification.create({
        data: {
          userId: admin.id,
          type: 'SECURITY_ALERT',
          title: '安全警報：未授權訪問嘗試',
          message: `用戶 ${user?.email || params.userId} 嘗試訪問未授權城市資源。嚴重性：${params.severity}`,
          data: JSON.stringify({
            eventType: params.eventType,
            targetUserId: params.userId,
            details: params.details,
          }),
          priority: 'HIGH',
        },
      })
    }

    // 記錄到控制台（生產環境可以對接其他警報系統）
    console.warn('[SECURITY ALERT]', {
      timestamp: new Date().toISOString(),
      ...params,
    })
  }

  // ===========================================
  // 統計方法
  // ===========================================

  /**
   * 獲取安全事件統計
   *
   * @param days - 統計天數（預設 7 天）
   * @returns 各類型事件統計
   */
  static async getEventStatistics(
    days: number = 7
  ): Promise<Record<SecurityEventType, number>> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const stats = await prisma.securityLog.groupBy({
      by: ['eventType'],
      where: { createdAt: { gte: cutoff } },
      _count: { id: true },
    })

    const result: Partial<Record<SecurityEventType, number>> = {}
    for (const stat of stats) {
      result[stat.eventType] = stat._count.id
    }

    return result as Record<SecurityEventType, number>
  }
}
