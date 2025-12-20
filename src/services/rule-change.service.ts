/**
 * @fileoverview 規則變更請求服務
 * @description
 *   提供規則變更請求的完整功能：
 *   - 創建變更請求（UPDATE、CREATE、DELETE、ACTIVATE、DEACTIVATE）
 *   - 查詢變更請求列表和詳情
 *   - 審核變更請求（批准/拒絕）
 *   - 應用已批准的變更
 *   - 通知審核者
 *
 * @module src/services/rule-change.service
 * @since Epic 5 - Story 5.3 (編輯 Forwarder 映射規則)
 * @lastModified 2025-12-19
 *
 * @features
 *   - AC1: 規則編輯入口
 *   - AC2: 規則內容編輯
 *   - AC3: 審核流程
 *   - AC4: 新規則創建
 *
 * @dependencies
 *   - @/lib/prisma - 資料庫客戶端
 *   - @/types/permissions - 權限常量
 *   - @/services/notification.service - 通知服務
 */

import { prisma } from '@/lib/prisma';
import {
  ChangeType,
  ChangeRequestStatus,
  RuleStatus,
  Prisma,
  type MappingRule,
} from '@prisma/client';
import { PERMISSIONS } from '@/types/permissions';
import type {
  RuleChangeContent,
  RuleChangeRequestItem,
  RuleChangeRequestDetail,
} from '@/types/change-request';

// ============================================================
// Types
// ============================================================

/**
 * 創建更新請求的參數
 */
export interface CreateUpdateRequestParams {
  /** 規則 ID */
  ruleId: string;
  /** Forwarder ID */
  forwarderId: string;
  /** 申請者 ID */
  requesterId: string;
  /** 更新內容 */
  updates: {
    extractionType?: string;
    pattern?: Record<string, unknown>;
    priority?: number;
    confidence?: number;
    description?: string;
  };
  /** 變更原因 */
  reason: string;
}

/**
 * 創建新規則請求的參數
 */
export interface CreateNewRuleRequestParams {
  /** Forwarder ID */
  forwarderId: string;
  /** 申請者 ID */
  requesterId: string;
  /** 規則內容 */
  content: {
    fieldName: string;
    fieldLabel: string;
    extractionType: string;
    pattern: Record<string, unknown>;
    priority?: number;
    confidence?: number;
    description?: string;
    isRequired?: boolean;
    validationPattern?: string;
    category?: string;
  };
  /** 變更原因 */
  reason: string;
}

/**
 * 變更請求列表查詢參數
 */
export interface ChangeRequestsQueryParams {
  forwarderId?: string;
  status?: ChangeRequestStatus;
  requesterId?: string;
  page?: number;
  pageSize?: number;
}

/**
 * 審核請求參數
 */
export interface ReviewRequestParams {
  /** 變更請求 ID */
  requestId: string;
  /** 審核者 ID */
  reviewerId: string;
  /** 審核動作 */
  action: 'approve' | 'reject';
  /** 審核備註 */
  notes?: string;
}

/**
 * 操作結果
 */
export interface OperationResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

// ============================================================
// Create Change Requests
// ============================================================

/**
 * 創建規則更新請求
 *
 * @description
 *   創建一個規則更新的變更請求。變更請求會進入待審核狀態，
 *   需要有 RULE_APPROVE 權限的用戶審核後才會生效。
 *
 * @param params - 請求參數
 * @returns 創建的變更請求
 * @throws Error 如果規則不存在或已有待審核的變更請求
 */
export async function createUpdateRequest(
  params: CreateUpdateRequestParams
): Promise<RuleChangeRequestItem> {
  const { ruleId, forwarderId, requesterId, updates, reason } = params;

  // 1. 檢查規則是否存在
  const existingRule = await prisma.mappingRule.findUnique({
    where: { id: ruleId },
    include: {
      forwarder: { select: { id: true, name: true, code: true } },
    },
  });

  if (!existingRule) {
    throw new Error('找不到指定的規則');
  }

  if (existingRule.forwarderId !== forwarderId) {
    throw new Error('此規則不屬於指定的 Forwarder');
  }

  // 2. 檢查是否有待審核的變更請求
  const pendingRequest = await prisma.ruleChangeRequest.findFirst({
    where: {
      ruleId,
      status: ChangeRequestStatus.PENDING,
    },
  });

  if (pendingRequest) {
    throw new Error('此規則已有待審核的變更請求');
  }

  // 3. 構建變更前後內容
  const beforeContent: RuleChangeContent = {
    fieldName: existingRule.fieldName,
    fieldLabel: existingRule.fieldLabel,
    extractionType: existingRule.extractionPattern as unknown as import('@prisma/client').ExtractionType,
    extractionPattern: existingRule.extractionPattern as Record<string, unknown>,
    priority: existingRule.priority,
    confidence: existingRule.confidence,
    description: existingRule.description,
    isRequired: existingRule.isRequired,
    validationPattern: existingRule.validationPattern,
    category: existingRule.category,
  };

  const afterContent: RuleChangeContent = {
    ...beforeContent,
    extractionType: (updates.extractionType as import('@prisma/client').ExtractionType) ?? beforeContent.extractionType,
    extractionPattern: updates.pattern ?? beforeContent.extractionPattern,
    priority: updates.priority ?? beforeContent.priority,
    confidence: updates.confidence ?? beforeContent.confidence,
    description: updates.description ?? beforeContent.description,
  };

  // 4. 創建變更請求
  const changeRequest = await prisma.ruleChangeRequest.create({
    data: {
      ruleId,
      forwarderId,
      changeType: ChangeType.UPDATE,
      beforeContent: beforeContent as unknown as import('@prisma/client').Prisma.InputJsonValue,
      afterContent: afterContent as unknown as import('@prisma/client').Prisma.InputJsonValue,
      reason,
      requestedById: requesterId,
      status: ChangeRequestStatus.PENDING,
    },
    include: {
      requester: { select: { id: true, name: true } },
      reviewer: { select: { id: true, name: true } },
    },
  });

  // 5. 創建審計日誌
  await prisma.auditLog.create({
    data: {
      userId: requesterId,
      userName: 'System',
      action: 'CREATE',
      resourceType: 'rule-change-request',
      resourceId: changeRequest.id,
      description: `Created update request for rule ${existingRule.fieldName}`,
      metadata: {
        changeType: ChangeType.UPDATE,
        ruleId,
        forwarderId,
        fieldName: existingRule.fieldName,
      },
      status: 'SUCCESS',
    },
  });

  // 6. 通知審核者
  await notifyChangeRequestReviewers({
    changeRequestId: changeRequest.id,
    changeType: ChangeType.UPDATE,
    forwarderName: existingRule.forwarder?.name ?? 'Unknown',
    fieldName: existingRule.fieldName,
    requesterName: changeRequest.requester.name ?? 'Unknown',
  });

  return formatChangeRequestItem(changeRequest, beforeContent, afterContent);
}

/**
 * 創建新規則請求
 *
 * @description
 *   創建一個新規則的變更請求。ruleId 為 null，表示這是新增操作。
 *
 * @param params - 請求參數
 * @returns 創建的變更請求
 * @throws Error 如果欄位名稱已存在或有重複的待審核請求
 */
export async function createNewRuleRequest(
  params: CreateNewRuleRequestParams
): Promise<RuleChangeRequestItem> {
  const { forwarderId, requesterId, content, reason } = params;

  // 1. 檢查 Forwarder 是否存在
  const forwarder = await prisma.forwarder.findUnique({
    where: { id: forwarderId },
    select: { id: true, name: true, code: true },
  });

  if (!forwarder) {
    throw new Error('找不到指定的 Forwarder');
  }

  // 2. 檢查欄位名稱是否已存在
  const existingRule = await prisma.mappingRule.findFirst({
    where: {
      forwarderId,
      fieldName: content.fieldName,
    },
  });

  if (existingRule) {
    throw new Error(`此 Forwarder 已存在欄位名稱為 "${content.fieldName}" 的規則`);
  }

  // 3. 檢查是否有待審核的相同欄位請求
  const pendingRequest = await prisma.ruleChangeRequest.findFirst({
    where: {
      forwarderId,
      changeType: ChangeType.CREATE,
      status: ChangeRequestStatus.PENDING,
    },
  });

  if (pendingRequest) {
    const pendingContent = pendingRequest.afterContent as Record<string, unknown>;
    if (pendingContent?.fieldName === content.fieldName) {
      throw new Error(`已有待審核的新增規則請求包含欄位名稱 "${content.fieldName}"`);
    }
  }

  // 4. 構建變更後內容
  const afterContent: RuleChangeContent = {
    fieldName: content.fieldName,
    fieldLabel: content.fieldLabel,
    extractionType: content.extractionType as import('@prisma/client').ExtractionType,
    extractionPattern: content.pattern,
    priority: content.priority ?? 50,
    confidence: content.confidence ?? 0.8,
    description: content.description ?? null,
    isRequired: content.isRequired ?? false,
    validationPattern: content.validationPattern ?? null,
    category: content.category ?? null,
  };

  // 5. 創建變更請求
  const changeRequest = await prisma.ruleChangeRequest.create({
    data: {
      ruleId: null,
      forwarderId,
      changeType: ChangeType.CREATE,
      beforeContent: Prisma.DbNull,
      afterContent: afterContent as unknown as Prisma.InputJsonValue,
      reason,
      requestedById: requesterId,
      status: ChangeRequestStatus.PENDING,
    },
    include: {
      requester: { select: { id: true, name: true } },
      reviewer: { select: { id: true, name: true } },
    },
  });

  // 6. 創建審計日誌
  await prisma.auditLog.create({
    data: {
      userId: requesterId,
      userName: 'System',
      action: 'CREATE',
      resourceType: 'rule-change-request',
      resourceId: changeRequest.id,
      description: `Created new rule request for ${content.fieldName}`,
      metadata: {
        changeType: ChangeType.CREATE,
        forwarderId,
        fieldName: content.fieldName,
      },
      status: 'SUCCESS',
    },
  });

  // 7. 通知審核者
  await notifyChangeRequestReviewers({
    changeRequestId: changeRequest.id,
    changeType: ChangeType.CREATE,
    forwarderName: forwarder.name,
    fieldName: content.fieldName,
    requesterName: changeRequest.requester.name ?? 'Unknown',
  });

  return formatChangeRequestItem(changeRequest, null, afterContent);
}

// ============================================================
// Query Change Requests
// ============================================================

/**
 * 獲取變更請求列表
 *
 * @param params - 查詢參數
 * @returns 變更請求列表和分頁資訊
 */
export async function getChangeRequests(params: ChangeRequestsQueryParams) {
  const { forwarderId, status, requesterId, page = 1, pageSize = 20 } = params;

  const where: import('@prisma/client').Prisma.RuleChangeRequestWhereInput = {};

  if (forwarderId) {
    where.forwarderId = forwarderId;
  }
  if (status) {
    where.status = status;
  }
  if (requesterId) {
    where.requestedById = requesterId;
  }

  const [requests, total] = await Promise.all([
    prisma.ruleChangeRequest.findMany({
      where,
      include: {
        requester: { select: { id: true, name: true } },
        reviewer: { select: { id: true, name: true } },
        forwarder: { select: { id: true, name: true, code: true } },
        rule: { select: { id: true, fieldName: true, fieldLabel: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.ruleChangeRequest.count({ where }),
  ]);

  // 獲取狀態統計
  const [pending, approved, rejected, cancelled] = await Promise.all([
    prisma.ruleChangeRequest.count({
      where: { ...where, status: ChangeRequestStatus.PENDING },
    }),
    prisma.ruleChangeRequest.count({
      where: { ...where, status: ChangeRequestStatus.APPROVED },
    }),
    prisma.ruleChangeRequest.count({
      where: { ...where, status: ChangeRequestStatus.REJECTED },
    }),
    prisma.ruleChangeRequest.count({
      where: { ...where, status: ChangeRequestStatus.CANCELLED },
    }),
  ]);

  return {
    requests: requests.map((req) =>
      formatChangeRequestItem(
        req,
        req.beforeContent as unknown as RuleChangeContent | null,
        req.afterContent as unknown as RuleChangeContent
      )
    ),
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
    summary: { pending, approved, rejected, cancelled },
  };
}

/**
 * 獲取單個變更請求詳情
 *
 * @param requestId - 變更請求 ID
 * @returns 變更請求詳情
 * @throws Error 如果請求不存在
 */
export async function getChangeRequest(
  requestId: string
): Promise<RuleChangeRequestDetail> {
  const request = await prisma.ruleChangeRequest.findUnique({
    where: { id: requestId },
    include: {
      requester: { select: { id: true, name: true } },
      reviewer: { select: { id: true, name: true } },
      forwarder: { select: { id: true, name: true, code: true } },
      rule: { select: { id: true, fieldName: true, fieldLabel: true, version: true } },
    },
  });

  if (!request) {
    throw new Error('找不到指定的變更請求');
  }

  const item = formatChangeRequestItem(
    request,
    request.beforeContent as unknown as RuleChangeContent | null,
    request.afterContent as unknown as RuleChangeContent
  );

  return {
    ...item,
    forwarder: request.forwarder,
    rule: request.rule,
  };
}

// ============================================================
// Review Change Requests
// ============================================================

/**
 * 審核變更請求
 *
 * @description
 *   批准或拒絕變更請求。批准後會自動應用變更到規則。
 *
 * @param params - 審核參數
 * @returns 操作結果
 * @throws Error 如果請求不存在或狀態不是待審核
 */
export async function reviewChangeRequest(
  params: ReviewRequestParams
): Promise<OperationResult> {
  const { requestId, reviewerId, action, notes } = params;

  // 1. 獲取變更請求
  const request = await prisma.ruleChangeRequest.findUnique({
    where: { id: requestId },
    include: {
      forwarder: { select: { id: true, name: true } },
      rule: true,
      requester: { select: { id: true, name: true, email: true } },
    },
  });

  if (!request) {
    throw new Error('找不到指定的變更請求');
  }

  if (request.status !== ChangeRequestStatus.PENDING) {
    throw new Error('此變更請求已被處理');
  }

  // 2. 開始事務處理
  const newStatus =
    action === 'approve'
      ? ChangeRequestStatus.APPROVED
      : ChangeRequestStatus.REJECTED;

  await prisma.$transaction(async (tx) => {
    // 2a. 更新變更請求狀態
    await tx.ruleChangeRequest.update({
      where: { id: requestId },
      data: {
        status: newStatus,
        reviewedById: reviewerId,
        reviewNotes: notes ?? null,
        reviewedAt: new Date(),
      },
    });

    // 2b. 如果批准，應用變更
    if (action === 'approve') {
      await applyChangeRequest(tx, request);
    }

    // 2c. 創建審計日誌
    await tx.auditLog.create({
      data: {
        userId: reviewerId,
        userName: 'System',
        action: action === 'approve' ? 'APPROVE' : 'REJECT',
        resourceType: 'rule-change-request',
        resourceId: requestId,
        description: `${action === 'approve' ? 'Approved' : 'Rejected'} rule change request`,
        metadata: {
          changeType: request.changeType,
          ruleId: request.ruleId,
          forwarderId: request.forwarderId,
          notes,
        },
        status: 'SUCCESS',
      },
    });
  });

  // 3. 通知申請者
  await notifyRequesterResult({
    requesterId: request.requestedById,
    requesterName: request.requester.name ?? 'Unknown',
    action,
    changeType: request.changeType,
    forwarderName: request.forwarder.name,
    fieldName: (request.afterContent as unknown as RuleChangeContent).fieldName,
    notes,
  });

  return {
    success: true,
    message: action === 'approve' ? '變更請求已批准' : '變更請求已拒絕',
    data: { requestId, status: newStatus },
  };
}

/**
 * 取消變更請求
 *
 * @description
 *   申請者可以取消自己的待審核變更請求
 *
 * @param requestId - 變更請求 ID
 * @param userId - 操作者 ID（必須是申請者）
 * @returns 操作結果
 */
export async function cancelChangeRequest(
  requestId: string,
  userId: string
): Promise<OperationResult> {
  const request = await prisma.ruleChangeRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    throw new Error('找不到指定的變更請求');
  }

  if (request.requestedById !== userId) {
    throw new Error('只有申請者可以取消變更請求');
  }

  if (request.status !== ChangeRequestStatus.PENDING) {
    throw new Error('只能取消待審核的變更請求');
  }

  await prisma.$transaction([
    prisma.ruleChangeRequest.update({
      where: { id: requestId },
      data: { status: ChangeRequestStatus.CANCELLED },
    }),
    prisma.auditLog.create({
      data: {
        userId,
        userName: 'System',
        action: 'UPDATE',
        resourceType: 'rule-change-request',
        resourceId: requestId,
        description: 'Cancelled rule change request',
        metadata: {
          changeType: request.changeType,
          ruleId: request.ruleId,
          forwarderId: request.forwarderId,
        },
        status: 'SUCCESS',
      },
    }),
  ]);

  return {
    success: true,
    message: '變更請求已取消',
    data: { requestId },
  };
}

// ============================================================
// Apply Changes (Internal)
// ============================================================

/**
 * 應用變更請求到規則
 * @internal
 */
async function applyChangeRequest(
  tx: Prisma.TransactionClient,
  request: {
    id: string;
    ruleId: string | null;
    forwarderId: string;
    changeType: ChangeType;
    beforeContent: Prisma.JsonValue;
    afterContent: Prisma.JsonValue;
    requestedById: string;
  }
): Promise<MappingRule | null> {
  const afterContent = request.afterContent as unknown as RuleChangeContent;

  switch (request.changeType) {
    case ChangeType.CREATE: {
      // 創建新規則
      return tx.mappingRule.create({
        data: {
          forwarderId: request.forwarderId,
          fieldName: afterContent.fieldName,
          fieldLabel: afterContent.fieldLabel,
          extractionPattern: afterContent.extractionPattern as Prisma.InputJsonValue,
          priority: afterContent.priority,
          confidence: afterContent.confidence,
          description: afterContent.description,
          isRequired: afterContent.isRequired,
          validationPattern: afterContent.validationPattern,
          category: afterContent.category,
          status: RuleStatus.ACTIVE,
          version: 1,
          createdBy: request.requestedById,
        },
      });
    }

    case ChangeType.UPDATE: {
      if (!request.ruleId) {
        throw new Error('更新規則時必須提供規則 ID');
      }

      // 創建版本記錄
      const existingRule = await tx.mappingRule.findUnique({
        where: { id: request.ruleId },
      });

      if (existingRule) {
        await tx.ruleVersion.create({
          data: {
            ruleId: request.ruleId,
            version: existingRule.version,
            extractionPattern: existingRule.extractionPattern as Prisma.InputJsonValue,
            confidence: existingRule.confidence,
            priority: existingRule.priority,
            changeReason: `變更請求 ${request.id} 批准前的備份`,
            createdBy: request.requestedById,
          },
        });
      }

      // 更新規則
      return tx.mappingRule.update({
        where: { id: request.ruleId },
        data: {
          extractionPattern: afterContent.extractionPattern as Prisma.InputJsonValue,
          priority: afterContent.priority,
          confidence: afterContent.confidence,
          description: afterContent.description,
          version: { increment: 1 },
          updatedAt: new Date(),
        },
      });
    }

    case ChangeType.DELETE: {
      if (!request.ruleId) {
        throw new Error('刪除規則時必須提供規則 ID');
      }
      await tx.mappingRule.update({
        where: { id: request.ruleId },
        data: { status: RuleStatus.DEPRECATED },
      });
      return null;
    }

    case ChangeType.ACTIVATE: {
      if (!request.ruleId) {
        throw new Error('啟用規則時必須提供規則 ID');
      }
      return tx.mappingRule.update({
        where: { id: request.ruleId },
        data: { isActive: true, status: RuleStatus.ACTIVE },
      });
    }

    case ChangeType.DEACTIVATE: {
      if (!request.ruleId) {
        throw new Error('停用規則時必須提供規則 ID');
      }
      return tx.mappingRule.update({
        where: { id: request.ruleId },
        data: { isActive: false },
      });
    }

    default:
      throw new Error(`未知的變更類型: ${request.changeType}`);
  }
}

// ============================================================
// Notifications
// ============================================================

/**
 * 通知審核者有新的變更請求
 * @internal
 */
async function notifyChangeRequestReviewers(params: {
  changeRequestId: string;
  changeType: ChangeType;
  forwarderName: string;
  fieldName: string;
  requesterName: string;
}): Promise<void> {
  const { changeRequestId, changeType, forwarderName, fieldName, requesterName } =
    params;

  // 查找具有審核權限的用戶
  const reviewers = await prisma.user.findMany({
    where: {
      roles: {
        some: {
          role: {
            permissions: { has: PERMISSIONS.RULE_APPROVE },
          },
        },
      },
      status: 'ACTIVE',
    },
    select: { id: true },
  });

  if (reviewers.length === 0) return;

  const changeTypeLabel = getChangeTypeLabel(changeType);

  await prisma.notification.createMany({
    data: reviewers.map((reviewer) => ({
      userId: reviewer.id,
      type: 'RULE_CHANGE_REQUEST',
      title: `規則${changeTypeLabel}請求待審核`,
      message: `${requesterName} 提交了 ${forwarderName} 的 ${fieldName} 欄位${changeTypeLabel}請求`,
      data: JSON.stringify({
        changeRequestId,
        changeType,
        forwarderName,
        fieldName,
      }),
    })),
  });
}

/**
 * 通知申請者審核結果
 * @internal
 */
async function notifyRequesterResult(params: {
  requesterId: string;
  requesterName: string;
  action: 'approve' | 'reject';
  changeType: ChangeType;
  forwarderName: string;
  fieldName: string;
  notes?: string;
}): Promise<void> {
  const { requesterId, action, changeType, forwarderName, fieldName, notes } =
    params;

  const changeTypeLabel = getChangeTypeLabel(changeType);
  const actionLabel = action === 'approve' ? '已批准' : '已拒絕';

  await prisma.notification.create({
    data: {
      userId: requesterId,
      type: action === 'approve' ? 'RULE_CHANGE_APPROVED' : 'RULE_CHANGE_REJECTED',
      title: `規則${changeTypeLabel}請求${actionLabel}`,
      message: `您提交的 ${forwarderName} ${fieldName} 欄位${changeTypeLabel}請求${actionLabel}${notes ? `：${notes}` : ''}`,
      data: JSON.stringify({
        changeType,
        forwarderName,
        fieldName,
        action,
        notes,
      }),
    },
  });
}

// ============================================================
// Helpers
// ============================================================

/**
 * 獲取變更類型標籤
 */
function getChangeTypeLabel(changeType: ChangeType): string {
  const labels: Record<ChangeType, string> = {
    [ChangeType.CREATE]: '新增',
    [ChangeType.UPDATE]: '修改',
    [ChangeType.DELETE]: '刪除',
    [ChangeType.ACTIVATE]: '啟用',
    [ChangeType.DEACTIVATE]: '停用',
  };
  return labels[changeType] ?? changeType;
}

/**
 * 格式化變更請求項目
 * @internal
 */
function formatChangeRequestItem(
  request: {
    id: string;
    ruleId: string | null;
    changeType: ChangeType;
    reason: string | null;
    status: ChangeRequestStatus;
    createdAt: Date;
    reviewedAt: Date | null;
    reviewNotes: string | null;
    requester: { id: string; name: string | null };
    reviewer: { id: string; name: string | null } | null;
  },
  beforeContent: RuleChangeContent | null,
  afterContent: RuleChangeContent
): RuleChangeRequestItem {
  return {
    id: request.id,
    ruleId: request.ruleId,
    changeType: request.changeType,
    beforeContent,
    afterContent,
    reason: request.reason,
    status: request.status,
    requester: {
      id: request.requester.id,
      name: request.requester.name ?? 'Unknown',
    },
    reviewer: request.reviewer
      ? {
          id: request.reviewer.id,
          name: request.reviewer.name ?? 'Unknown',
        }
      : null,
    reviewNotes: request.reviewNotes,
    createdAt: request.createdAt.toISOString(),
    reviewedAt: request.reviewedAt?.toISOString() ?? null,
  };
}
