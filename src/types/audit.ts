/**
 * @fileoverview 審計日誌類型定義
 * @description
 *   定義審計日誌系統所需的所有類型、介面和常數。
 *   包含：
 *   - AuditLogEntry：審計日誌條目介面
 *   - 操作類型和狀態的 TypeScript 類型
 *   - 敏感操作定義
 *   - 輔助函數
 *
 * @module src/types/audit
 * @since Epic 8 - Story 8.1 (用戶操作日誌記錄)
 * @lastModified 2025-12-20
 *
 * @features
 *   - 完整的審計日誌類型定義
 *   - 敏感操作識別機制
 *   - 與 Prisma AuditAction enum 對應
 *
 * @dependencies
 *   - Prisma AuditAction enum
 *   - Prisma AuditStatus enum
 *
 * @related
 *   - src/services/audit-log.service.ts - 審計日誌服務
 *   - src/middleware/audit-log.middleware.ts - 審計日誌中間件
 *   - prisma/schema.prisma - AuditLog 模型定義
 */

// ============================================================
// Types
// ============================================================

/**
 * 審計操作類型
 * 對應 Prisma schema 中的 AuditAction enum
 */
export type AuditAction =
  | 'CREATE'
  | 'READ'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'EXPORT'
  | 'IMPORT'
  | 'APPROVE'
  | 'REJECT'
  | 'ESCALATE'
  | 'CONFIGURE'
  | 'GRANT'   // 授予權限（城市/區域存取權）
  | 'REVOKE'; // 撤銷權限

/**
 * 審計狀態類型
 * 對應 Prisma schema 中的 AuditStatus enum
 */
export type AuditStatus = 'SUCCESS' | 'FAILURE' | 'PARTIAL';

/**
 * 數據變更記錄
 * 用於記錄敏感操作的前後值
 */
export interface AuditChanges {
  /** 變更前的值 */
  before?: Record<string, unknown>;
  /** 變更後的值 */
  after?: Record<string, unknown>;
}

/**
 * 審計日誌條目介面
 * 用於創建新的審計日誌記錄
 */
export interface AuditLogEntry {
  /** 用戶 ID */
  userId: string;
  /** 用戶名稱 */
  userName: string;
  /** 用戶電子郵件（可選） */
  userEmail?: string;
  /** 操作類型 */
  action: AuditAction;
  /** 資源類型（如 document, user, mappingRule） */
  resourceType: string;
  /** 資源 ID（可選） */
  resourceId?: string;
  /** 資源名稱（可選） */
  resourceName?: string;
  /** 操作描述（可選） */
  description?: string;
  /** 數據變更記錄（可選，用於敏感操作） */
  changes?: AuditChanges;
  /** 額外的元數據（可選） */
  metadata?: Record<string, unknown>;
  /** IP 地址（可選） */
  ipAddress?: string;
  /** 用戶代理（可選） */
  userAgent?: string;
  /** 請求 ID（可選，用於追蹤） */
  requestId?: string;
  /** 會話 ID（可選） */
  sessionId?: string;
  /** 操作狀態（預設為 SUCCESS） */
  status?: AuditStatus;
  /** 錯誤訊息（可選，當 status 為 FAILURE 時） */
  errorMessage?: string;
  /** 城市代碼（可選，用於城市隔離） */
  cityCode?: string;
}

/**
 * 審計日誌查詢過濾器
 */
export interface AuditLogFilter {
  /** 用戶 ID 過濾 */
  userId?: string;
  /** 操作類型過濾 */
  action?: AuditAction | AuditAction[];
  /** 資源類型過濾 */
  resourceType?: string;
  /** 資源 ID 過濾 */
  resourceId?: string;
  /** 城市代碼過濾 */
  cityCode?: string;
  /** 狀態過濾 */
  status?: AuditStatus;
  /** 開始日期 */
  startDate?: Date;
  /** 結束日期 */
  endDate?: Date;
}

/**
 * 審計日誌分頁參數
 */
export interface AuditLogPaginationParams {
  /** 頁碼（從 1 開始） */
  page?: number;
  /** 每頁數量 */
  limit?: number;
  /** 排序欄位 */
  sortBy?: 'createdAt' | 'action' | 'resourceType';
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc';
}

/**
 * 審計日誌查詢結果
 */
export interface AuditLogQueryResult<T> {
  /** 日誌記錄列表 */
  data: T[];
  /** 分頁資訊 */
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================================
// Constants
// ============================================================

/**
 * 敏感操作定義
 * 用於判斷是否需要同步寫入審計日誌
 *
 * Key: 資源類型
 * Value: 需要同步寫入的操作類型列表
 */
export const SENSITIVE_OPERATIONS: Record<string, AuditAction[]> = {
  user: ['CREATE', 'UPDATE', 'DELETE'],
  role: ['CREATE', 'UPDATE', 'DELETE'],
  mappingRule: ['CREATE', 'UPDATE', 'DELETE', 'APPROVE'],
  systemConfig: ['UPDATE', 'CONFIGURE'],
  apiPricing: ['UPDATE'],
  forwarder: ['CREATE', 'UPDATE', 'DELETE'],
  userCityAccess: ['CREATE', 'UPDATE', 'DELETE', 'GRANT', 'REVOKE'],
  userRegionAccess: ['CREATE', 'UPDATE', 'DELETE', 'GRANT', 'REVOKE'],
  globalAdmin: ['GRANT', 'REVOKE'],
};

/**
 * 需要記錄變更詳情的操作
 * 這些操作會記錄 before/after 值
 */
export const CHANGE_TRACKING_ACTIONS: AuditAction[] = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'CONFIGURE',
  'GRANT',
  'REVOKE',
];

/**
 * 審計日誌批次寫入配置
 */
export const AUDIT_BATCH_CONFIG = {
  /** 批次大小：達到此數量時觸發寫入 */
  BATCH_SIZE: 100,
  /** 刷新間隔（毫秒）：定時觸發寫入 */
  FLUSH_INTERVAL: 1000,
  /** 最大重試次數 */
  MAX_RETRIES: 3,
  /** 重試延遲（毫秒） */
  RETRY_DELAY: 500,
} as const;

// ============================================================
// Helper Functions
// ============================================================

/**
 * 判斷是否為敏感操作
 *
 * @description 根據資源類型和操作類型判斷是否需要同步寫入審計日誌
 * @param resourceType - 資源類型
 * @param action - 操作類型
 * @returns 是否為敏感操作
 *
 * @example
 * ```typescript
 * isSensitiveOperation('user', 'DELETE'); // true
 * isSensitiveOperation('document', 'READ'); // false
 * ```
 */
export function isSensitiveOperation(
  resourceType: string,
  action: AuditAction | string
): boolean {
  const sensitiveActions = SENSITIVE_OPERATIONS[resourceType];
  if (!sensitiveActions) {
    return false;
  }
  return sensitiveActions.includes(action as AuditAction);
}

/**
 * 判斷是否需要記錄變更詳情
 *
 * @param action - 操作類型
 * @returns 是否需要記錄變更詳情
 */
export function shouldTrackChanges(action: AuditAction): boolean {
  return CHANGE_TRACKING_ACTIONS.includes(action);
}

/**
 * 從 Prisma 結果中提取變更資訊
 *
 * @param before - 變更前的數據
 * @param after - 變更後的數據
 * @param fieldsToTrack - 需要追蹤的欄位列表（可選，預設追蹤所有）
 * @returns 變更記錄
 */
export function extractChanges(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
  fieldsToTrack?: string[]
): AuditChanges {
  const result: AuditChanges = {};

  if (before) {
    if (fieldsToTrack) {
      result.before = Object.fromEntries(
        fieldsToTrack.map((field) => [field, before[field]])
      );
    } else {
      result.before = { ...before };
    }
  }

  if (after) {
    if (fieldsToTrack) {
      result.after = Object.fromEntries(
        fieldsToTrack.map((field) => [field, after[field]])
      );
    } else {
      result.after = { ...after };
    }
  }

  return result;
}

/**
 * 生成審計日誌描述
 *
 * @param action - 操作類型
 * @param resourceType - 資源類型
 * @param resourceName - 資源名稱（可選）
 * @returns 描述文字
 */
export function generateAuditDescription(
  action: AuditAction,
  resourceType: string,
  resourceName?: string
): string {
  const actionDescriptions: Record<AuditAction, string> = {
    CREATE: '創建',
    READ: '讀取',
    UPDATE: '更新',
    DELETE: '刪除',
    LOGIN: '登入',
    LOGOUT: '登出',
    EXPORT: '匯出',
    IMPORT: '匯入',
    APPROVE: '核准',
    REJECT: '拒絕',
    ESCALATE: '升級',
    CONFIGURE: '配置',
    GRANT: '授予',
    REVOKE: '撤銷',
  };

  const actionText = actionDescriptions[action] || action;
  const resourceText = resourceName ? `"${resourceName}"` : resourceType;

  return `${actionText} ${resourceText}`;
}
