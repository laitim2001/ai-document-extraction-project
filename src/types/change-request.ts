/**
 * @fileoverview 規則變更請求相關類型定義
 * @description
 *   提供規則變更請求功能的 TypeScript 類型定義：
 *   - 變更請求資料模型
 *   - API 請求/響應類型
 *   - 變更類型和狀態配置
 *   - 表單驗證 Schema
 *
 * @module src/types/change-request
 * @since Epic 5 - Story 5.3 (編輯 Forwarder 映射規則)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @prisma/client - ChangeType, ChangeRequestStatus, ExtractionType enum
 *   - zod - 運行時驗證
 */

import type {
  ChangeType,
  ChangeRequestStatus,
  ExtractionType,
} from '@prisma/client';
import { z } from 'zod';

// ============================================================
// Rule Edit Types
// ============================================================

/**
 * 規則編輯請求參數
 * 用於更新現有規則
 */
export interface UpdateRuleRequest {
  /** 提取類型 */
  extractionType?: ExtractionType;
  /** 提取模式配置 (JSON) */
  pattern?: Record<string, unknown>;
  /** 優先級 (1-100) */
  priority?: number;
  /** 信心度閾值 (0-1) */
  confidence?: number;
  /** 規則描述 */
  description?: string;
  /** 變更原因說明 */
  reason?: string;
}

/**
 * 新增規則請求參數
 */
export interface CreateRuleChangeRequest {
  /** 欄位名稱 */
  fieldName: string;
  /** 欄位顯示標籤 */
  fieldLabel: string;
  /** 提取類型 */
  extractionType: ExtractionType;
  /** 提取模式配置 (JSON) */
  pattern: Record<string, unknown>;
  /** 優先級 (1-100) */
  priority?: number;
  /** 信心度閾值 (0-1) */
  confidence?: number;
  /** 規則描述 */
  description?: string;
  /** 是否為必填欄位 */
  isRequired?: boolean;
  /** 驗證正則表達式 */
  validationPattern?: string;
  /** 欄位類別 */
  category?: string;
  /** 變更原因說明 */
  reason?: string;
}

// ============================================================
// Change Request Types
// ============================================================

/**
 * 規則變更請求內容（變更前/變更後）
 */
export interface RuleChangeContent {
  /** 欄位名稱 */
  fieldName: string;
  /** 欄位顯示標籤 */
  fieldLabel: string;
  /** 提取類型 */
  extractionType: ExtractionType;
  /** 提取模式配置 */
  extractionPattern: Record<string, unknown>;
  /** 優先級 */
  priority: number;
  /** 信心度閾值 */
  confidence: number;
  /** 規則描述 */
  description?: string | null;
  /** 是否為必填 */
  isRequired: boolean;
  /** 驗證正則表達式 */
  validationPattern?: string | null;
  /** 欄位類別 */
  category?: string | null;
}

/**
 * 規則變更請求列表項
 */
export interface RuleChangeRequestItem {
  /** 請求 ID */
  id: string;
  /** 關聯的規則 ID（新增時為 null） */
  ruleId: string | null;
  /** 變更類型 */
  changeType: ChangeType;
  /** 變更前內容（新增時為 null） */
  beforeContent: RuleChangeContent | null;
  /** 變更後內容 */
  afterContent: RuleChangeContent;
  /** 變更原因 */
  reason: string | null;
  /** 請求狀態 */
  status: ChangeRequestStatus;
  /** 申請者 */
  requester: {
    id: string;
    name: string;
  };
  /** 審核者 */
  reviewer: {
    id: string;
    name: string;
  } | null;
  /** 審核備註 */
  reviewNotes: string | null;
  /** 創建時間 */
  createdAt: string;
  /** 審核時間 */
  reviewedAt: string | null;
}

/**
 * 規則變更請求詳情
 */
export interface RuleChangeRequestDetail extends RuleChangeRequestItem {
  /** 關聯的 Forwarder/Company (REFACTOR-001: 可為 null) */
  forwarder: {
    id: string;
    name: string;
    code: string;
  } | null;
  /** 關聯的規則（如果存在） */
  rule: {
    id: string;
    fieldName: string;
    fieldLabel: string;
    version: number;
  } | null;
}

// ============================================================
// API Response Types
// ============================================================

/**
 * 變更請求列表響應
 */
export interface ChangeRequestsListResponse {
  success: true;
  data: {
    requests: RuleChangeRequestItem[];
    pagination: {
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    };
    summary: {
      pending: number;
      approved: number;
      rejected: number;
      cancelled: number;
    };
  };
}

/**
 * 創建變更請求響應
 */
export interface CreateChangeRequestResponse {
  success: true;
  data: {
    /** 變更請求 ID */
    requestId: string;
    /** 狀態 */
    status: ChangeRequestStatus;
    /** 提示訊息 */
    message: string;
  };
}

/**
 * 審核變更請求請求
 */
export interface ReviewChangeRequestBody {
  /** 審核動作 */
  action: 'approve' | 'reject';
  /** 審核備註 */
  notes?: string;
}

// ============================================================
// Rule Preview Types
// ============================================================

/**
 * 規則預覽請求
 */
export interface RulePreviewRequest {
  /** 提取類型 */
  extractionType: ExtractionType;
  /** 提取模式配置 */
  pattern: Record<string, unknown>;
  /** 測試文件 ID（可選） */
  documentId?: string;
  /** 測試文件內容（Base64，可選） */
  documentContent?: string;
}

/**
 * 規則預覽結果
 */
export interface RulePreviewResult {
  /** 是否成功匹配 */
  matched: boolean;
  /** 提取的值 */
  extractedValue: string | null;
  /** 信心度 (0-1) */
  confidence: number;
  /** 匹配位置 */
  matchPositions?: {
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;
  }[];
  /** 處理時間 (ms) */
  processingTime: number;
  /** 錯誤訊息 */
  error?: string;
}

/**
 * 規則預覽響應
 */
export interface RulePreviewResponse {
  success: true;
  data: RulePreviewResult;
}

// ============================================================
// Configuration Constants
// ============================================================

/**
 * 變更類型配置
 */
export const CHANGE_TYPES: {
  value: ChangeType;
  label: string;
  description: string;
  color: 'success' | 'warning' | 'destructive' | 'info' | 'secondary';
}[] = [
  {
    value: 'CREATE',
    label: '新增',
    description: '新增規則',
    color: 'success',
  },
  {
    value: 'UPDATE',
    label: '修改',
    description: '修改規則內容',
    color: 'warning',
  },
  {
    value: 'DELETE',
    label: '刪除',
    description: '刪除規則',
    color: 'destructive',
  },
  {
    value: 'ACTIVATE',
    label: '啟用',
    description: '啟用規則',
    color: 'info',
  },
  {
    value: 'DEACTIVATE',
    label: '停用',
    description: '停用規則',
    color: 'secondary',
  },
];

/**
 * 變更請求狀態配置
 */
export const CHANGE_REQUEST_STATUSES: {
  value: ChangeRequestStatus;
  label: string;
  description: string;
  color: 'warning' | 'success' | 'destructive' | 'muted';
}[] = [
  {
    value: 'PENDING',
    label: '待審核',
    description: '等待 Super User 審核',
    color: 'warning',
  },
  {
    value: 'APPROVED',
    label: '已批准',
    description: '變更已被批准並套用',
    color: 'success',
  },
  {
    value: 'REJECTED',
    label: '已拒絕',
    description: '變更被拒絕',
    color: 'destructive',
  },
  {
    value: 'CANCELLED',
    label: '已取消',
    description: '申請者取消了變更請求',
    color: 'muted',
  },
];

/**
 * 獲取變更類型配置
 */
export function getChangeTypeConfig(changeType: ChangeType) {
  return CHANGE_TYPES.find((t) => t.value === changeType) ?? CHANGE_TYPES[0];
}

/**
 * 獲取變更請求狀態配置
 */
export function getChangeRequestStatusConfig(status: ChangeRequestStatus) {
  return (
    CHANGE_REQUEST_STATUSES.find((s) => s.value === status) ??
    CHANGE_REQUEST_STATUSES[0]
  );
}

// ============================================================
// Zod Validation Schemas
// ============================================================

/**
 * 更新規則表單驗證 Schema
 */
export const updateRuleFormSchema = z.object({
  extractionType: z
    .enum(['REGEX', 'KEYWORD', 'POSITION', 'AI_PROMPT', 'TEMPLATE'])
    .optional(),
  pattern: z.record(z.string(), z.unknown()).optional(),
  priority: z.number().int().min(1).max(100).optional(),
  confidence: z.number().min(0).max(1).optional(),
  description: z.string().max(500).optional(),
  reason: z.string().min(1, '請說明變更原因').max(1000),
});

/**
 * 創建規則表單驗證 Schema
 */
export const createRuleChangeFormSchema = z.object({
  fieldName: z.string().min(1, '請選擇欄位名稱'),
  fieldLabel: z.string().min(1, '請輸入欄位顯示名稱'),
  extractionType: z.enum(['REGEX', 'KEYWORD', 'POSITION', 'AI_PROMPT', 'TEMPLATE']),
  pattern: z.record(z.string(), z.unknown()),
  priority: z.number().int().min(1).max(100).default(50),
  confidence: z.number().min(0).max(1).default(0.8),
  description: z.string().max(500).optional(),
  isRequired: z.boolean().default(false),
  validationPattern: z.string().optional(),
  category: z.string().optional(),
  reason: z.string().min(1, '請說明新增原因').max(1000),
});

/**
 * 審核變更請求驗證 Schema
 */
export const reviewChangeRequestSchema = z.object({
  action: z.enum(['approve', 'reject']),
  notes: z.string().max(1000).optional(),
});

/**
 * 規則預覽請求驗證 Schema
 */
export const rulePreviewRequestSchema = z
  .object({
    extractionType: z.enum([
      'REGEX',
      'KEYWORD',
      'POSITION',
      'AI_PROMPT',
      'TEMPLATE',
    ]),
    pattern: z.record(z.string(), z.unknown()),
    documentId: z.string().optional(),
    documentContent: z.string().optional(),
  })
  .refine((data) => data.documentId || data.documentContent, {
    message: '請提供測試文件 ID 或文件內容',
  });

/**
 * 更新規則表單類型
 */
export type UpdateRuleFormValues = z.infer<typeof updateRuleFormSchema>;

/**
 * 創建規則表單類型
 */
export type CreateRuleChangeFormValues = z.infer<
  typeof createRuleChangeFormSchema
>;

/**
 * 審核變更請求表單類型
 */
export type ReviewChangeRequestFormValues = z.infer<
  typeof reviewChangeRequestSchema
>;
