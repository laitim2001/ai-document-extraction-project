/**
 * @fileoverview 審計日誌工具
 * @description
 *   提供統一的審計日誌記錄功能，用於追蹤系統中的重要操作。
 *   支援 RFC 7807 錯誤格式，滿足 7 年留存合規要求。
 *
 * @module src/lib/audit
 * @since Epic 3 - Story 3.4 (確認提取結果)
 * @lastModified 2025-12-18
 *
 * @features
 *   - 統一審計日誌介面
 *   - 支援多種操作類型
 *   - 自動記錄時間戳和 IP
 *   - 結構化 JSON 詳情
 *
 * @dependencies
 *   - @/lib/prisma - Prisma 客戶端
 */

import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

// ============================================================
// Types
// ============================================================

/**
 * 審計日誌操作類型
 */
export type AuditAction =
  | 'DOCUMENT_UPLOADED'
  | 'DOCUMENT_PROCESSED'
  | 'DOCUMENT_APPROVED'
  | 'DOCUMENT_CORRECTED'
  | 'DOCUMENT_ESCALATED'
  | 'DOCUMENT_DELETED'
  | 'USER_LOGIN'
  | 'USER_LOGOUT'
  | 'MAPPING_CREATED'
  | 'MAPPING_UPDATED'
  | 'MAPPING_DELETED'
  | 'FORWARDER_CREATED'
  | 'FORWARDER_UPDATED'
  | 'FORWARDER_DELETED'
  | 'REVIEW_STARTED'
  | 'REVIEW_COMPLETED'
  | 'FIELDS_MODIFIED'
  | 'SYSTEM_ERROR';

/**
 * 審計日誌實體類型
 */
export type AuditEntityType =
  | 'Document'
  | 'User'
  | 'Forwarder'
  | 'MappingRule'
  | 'ReviewRecord'
  | 'ExtractionResult'
  | 'System';

/**
 * 審計日誌參數
 */
export interface AuditLogParams {
  /** 操作執行者 ID */
  userId?: string | null;
  /** 操作類型 */
  action: AuditAction;
  /** 實體類型 */
  entityType: AuditEntityType;
  /** 實體 ID */
  entityId?: string | null;
  /** 額外詳情（JSON 格式） */
  details?: Record<string, unknown>;
  /** 客戶端 IP 地址 */
  ipAddress?: string | null;
}

/**
 * 審計日誌記錄結果
 */
export interface AuditLogResult {
  success: boolean;
  logId?: string;
  error?: string;
}

// ============================================================
// Main Function
// ============================================================

/**
 * 記錄審計日誌
 *
 * @description 將操作記錄寫入審計日誌表，用於合規追蹤和問題調查
 * @param params - 審計日誌參數
 * @returns Promise<AuditLogResult> - 記錄結果
 *
 * @example
 * ```typescript
 * await logAudit({
 *   userId: 'user-123',
 *   action: 'DOCUMENT_APPROVED',
 *   entityType: 'Document',
 *   entityId: 'doc-456',
 *   details: { processingPath: 'QUICK_REVIEW', fieldsConfirmed: 15 },
 *   ipAddress: '192.168.1.1'
 * });
 * ```
 */
export async function logAudit(params: AuditLogParams): Promise<AuditLogResult> {
  const { userId, action, entityType, entityId, details, ipAddress } = params;

  try {
    const auditLog = await prisma.auditLog.create({
      data: {
        userId: userId ?? null,
        action,
        entityType,
        entityId: entityId ?? null,
        // 將 details 轉換為 Prisma 的 InputJsonValue 類型
        details: details as Prisma.InputJsonValue | undefined,
        ipAddress: ipAddress ?? null,
      },
    });

    return {
      success: true,
      logId: auditLog.id,
    };
  } catch (error) {
    // 審計日誌失敗不應阻斷主流程，僅記錄錯誤
    console.error('[AuditLog] Failed to create audit log:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      params: { action, entityType, entityId },
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================
// Convenience Functions
// ============================================================

/**
 * 記錄文件核准審計日誌
 *
 * @param userId - 審核者 ID
 * @param documentId - 文件 ID
 * @param details - 額外詳情
 * @param ipAddress - IP 地址
 */
export async function logDocumentApproved(
  userId: string,
  documentId: string,
  details?: Record<string, unknown>,
  ipAddress?: string
): Promise<AuditLogResult> {
  return logAudit({
    userId,
    action: 'DOCUMENT_APPROVED',
    entityType: 'Document',
    entityId: documentId,
    details: {
      timestamp: new Date().toISOString(),
      ...details,
    },
    ipAddress,
  });
}

/**
 * 記錄文件修正審計日誌
 *
 * @param userId - 審核者 ID
 * @param documentId - 文件 ID
 * @param modifiedFields - 修改的欄位
 * @param ipAddress - IP 地址
 */
export async function logDocumentCorrected(
  userId: string,
  documentId: string,
  modifiedFields: Record<string, { before: unknown; after: unknown }>,
  ipAddress?: string
): Promise<AuditLogResult> {
  return logAudit({
    userId,
    action: 'DOCUMENT_CORRECTED',
    entityType: 'Document',
    entityId: documentId,
    details: {
      timestamp: new Date().toISOString(),
      modifiedFields,
      fieldCount: Object.keys(modifiedFields).length,
    },
    ipAddress,
  });
}

/**
 * 記錄文件升級審計日誌
 *
 * @param userId - 審核者 ID
 * @param documentId - 文件 ID
 * @param reason - 升級原因
 * @param ipAddress - IP 地址
 */
export async function logDocumentEscalated(
  userId: string,
  documentId: string,
  reason?: string,
  ipAddress?: string
): Promise<AuditLogResult> {
  return logAudit({
    userId,
    action: 'DOCUMENT_ESCALATED',
    entityType: 'Document',
    entityId: documentId,
    details: {
      timestamp: new Date().toISOString(),
      reason,
    },
    ipAddress,
  });
}

/**
 * 記錄審核開始審計日誌
 *
 * @param userId - 審核者 ID
 * @param documentId - 文件 ID
 * @param processingPath - 處理路徑
 * @param ipAddress - IP 地址
 */
export async function logReviewStarted(
  userId: string,
  documentId: string,
  processingPath: string,
  ipAddress?: string
): Promise<AuditLogResult> {
  return logAudit({
    userId,
    action: 'REVIEW_STARTED',
    entityType: 'Document',
    entityId: documentId,
    details: {
      timestamp: new Date().toISOString(),
      processingPath,
    },
    ipAddress,
  });
}

/**
 * 記錄審核完成審計日誌
 *
 * @param userId - 審核者 ID
 * @param documentId - 文件 ID
 * @param result - 審核結果
 * @param ipAddress - IP 地址
 */
export async function logReviewCompleted(
  userId: string,
  documentId: string,
  result: {
    action: 'APPROVED' | 'CORRECTED' | 'ESCALATED';
    duration?: number;
    fieldsReviewed?: number;
    fieldsModified?: number;
  },
  ipAddress?: string
): Promise<AuditLogResult> {
  return logAudit({
    userId,
    action: 'REVIEW_COMPLETED',
    entityType: 'Document',
    entityId: documentId,
    details: {
      timestamp: new Date().toISOString(),
      ...result,
    },
    ipAddress,
  });
}
