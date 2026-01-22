/**
 * @fileoverview 模版實例驗證 Schema
 * @description
 *   提供 TemplateInstance 和 TemplateInstanceRow 相關的 Zod 驗證 Schema，包括：
 *   - 創建/更新實例驗證
 *   - 行數據驗證
 *   - 狀態轉換驗證
 *   - API 查詢參數驗證
 *
 * @module src/validations/template-instance
 * @since Epic 19 - Story 19.2
 * @lastModified 2026-01-22
 *
 * @features
 *   - 實例創建/更新驗證
 *   - 行數據 CRUD 驗證
 *   - 狀態轉換規則驗證
 *   - 查詢參數分頁驗證
 *
 * @dependencies
 *   - zod - 驗證庫
 *   - src/types/template-instance.ts - 類型定義
 */

import { z } from 'zod';
import type { TemplateInstanceStatus, TemplateInstanceRowStatus } from '@/types/template-instance';
import { STATUS_TRANSITIONS, DELETABLE_STATUSES } from '@/types/template-instance';

// ============================================================================
// Status Schemas
// ============================================================================

/**
 * 模版實例狀態 Schema
 */
export const templateInstanceStatusSchema = z.enum([
  'DRAFT',
  'PROCESSING',
  'COMPLETED',
  'EXPORTED',
  'ERROR',
]);

/**
 * 模版實例行狀態 Schema
 */
export const templateInstanceRowStatusSchema = z.enum([
  'PENDING',
  'VALID',
  'INVALID',
  'SKIPPED',
]);

// ============================================================================
// Instance Schemas
// ============================================================================

/**
 * 創建模版實例 Schema
 */
export const createTemplateInstanceSchema = z.object({
  /** 數據模版 ID */
  dataTemplateId: z.string().cuid('無效的模版 ID'),
  /** 實例名稱 */
  name: z
    .string()
    .min(1, '名稱不能為空')
    .max(200, '名稱不能超過 200 個字元'),
  /** 描述 */
  description: z.string().max(1000, '描述過長').optional(),
});

/**
 * 更新模版實例 Schema
 */
export const updateTemplateInstanceSchema = z.object({
  /** 實例名稱 */
  name: z
    .string()
    .min(1, '名稱不能為空')
    .max(200, '名稱不能超過 200 個字元')
    .optional(),
  /** 描述 */
  description: z.string().max(1000, '描述過長').optional().nullable(),
});

/**
 * 狀態變更 Schema
 */
export const changeStatusSchema = z.object({
  /** 新狀態 */
  status: templateInstanceStatusSchema,
  /** 錯誤訊息（當狀態為 ERROR 時） */
  errorMessage: z.string().max(500).optional(),
}).refine(
  (data) => {
    // 如果狀態為 ERROR，errorMessage 是可選的但建議提供
    return true;
  },
  { message: '狀態變更資料無效' }
);

/**
 * 標記導出 Schema
 */
export const markExportedSchema = z.object({
  /** 導出格式 */
  format: z.enum(['xlsx', 'csv', 'json'], {
    message: '無效的導出格式',
  }),
  /** 導出者 */
  exportedBy: z.string().optional(),
});

// ============================================================================
// Row Schemas
// ============================================================================

/**
 * 添加行 Schema
 */
export const addRowSchema = z.object({
  /** 行識別碼（如 shipment_no） */
  rowKey: z
    .string()
    .min(1, '行識別碼不能為空')
    .max(100, '行識別碼過長'),
  /** 來源文件 IDs */
  sourceDocumentIds: z
    .array(z.string())
    .optional()
    .default([]),
  /** 欄位值 */
  fieldValues: z.record(z.string(), z.unknown()).refine(
    (values) => Object.keys(values).length > 0,
    { message: '至少需要一個欄位值' }
  ),
});

/**
 * 更新行 Schema
 */
export const updateRowSchema = z.object({
  /** 行識別碼 */
  rowKey: z
    .string()
    .min(1, '行識別碼不能為空')
    .max(100, '行識別碼過長')
    .optional(),
  /** 來源文件 IDs */
  sourceDocumentIds: z.array(z.string()).optional(),
  /** 欄位值 */
  fieldValues: z.record(z.string(), z.unknown()).optional(),
  /** 行狀態 */
  status: templateInstanceRowStatusSchema.optional(),
});

/**
 * 批量添加行 Schema
 */
export const batchAddRowsSchema = z.object({
  rows: z
    .array(addRowSchema)
    .min(1, '至少需要一行數據')
    .max(1000, '單次最多添加 1000 行'),
});

// ============================================================================
// Query Schemas
// ============================================================================

/**
 * 實例列表查詢參數 Schema
 */
export const templateInstanceQuerySchema = z.object({
  /** 按數據模版篩選 */
  dataTemplateId: z.string().cuid().optional(),
  /** 按狀態篩選 */
  status: templateInstanceStatusSchema.optional(),
  /** 搜尋關鍵字 */
  search: z.string().max(100).optional(),
  /** 開始日期 */
  dateFrom: z.string().datetime().optional(),
  /** 結束日期 */
  dateTo: z.string().datetime().optional(),
  /** 建立者 */
  createdBy: z.string().optional(),
  /** 頁碼 */
  page: z.coerce.number().int().positive().default(1),
  /** 每頁數量 */
  limit: z.coerce.number().int().positive().max(100).default(20),
});

/**
 * 行列表查詢參數 Schema
 */
export const templateInstanceRowQuerySchema = z.object({
  /** 按行狀態篩選 */
  status: templateInstanceRowStatusSchema.optional(),
  /** 搜尋關鍵字（rowKey） */
  search: z.string().max(100).optional(),
  /** 頁碼 */
  page: z.coerce.number().int().positive().default(1),
  /** 每頁數量 */
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// ============================================================================
// Validation Helper Functions
// ============================================================================

/**
 * 驗證狀態轉換是否合法
 * @param currentStatus - 當前狀態
 * @param newStatus - 目標狀態
 * @returns 是否允許轉換
 */
export function isValidStatusTransition(
  currentStatus: TemplateInstanceStatus,
  newStatus: TemplateInstanceStatus
): boolean {
  const allowedTransitions = STATUS_TRANSITIONS[currentStatus];
  return allowedTransitions.includes(newStatus);
}

/**
 * 驗證是否可刪除
 * @param status - 當前狀態
 * @returns 是否可刪除
 */
export function canDelete(status: TemplateInstanceStatus): boolean {
  return DELETABLE_STATUSES.includes(status);
}

/**
 * 建立狀態轉換驗證 Schema
 * @param currentStatus - 當前狀態
 * @returns Zod Schema
 */
export function createStatusTransitionSchema(currentStatus: TemplateInstanceStatus) {
  const allowedStatuses = STATUS_TRANSITIONS[currentStatus];

  if (allowedStatuses.length === 0) {
    return z.never();
  }

  return z.enum(allowedStatuses as [TemplateInstanceStatus, ...TemplateInstanceStatus[]]);
}

// ============================================================================
// Type Exports
// ============================================================================

/** 創建模版實例輸入類型 */
export type CreateTemplateInstanceInput = z.infer<typeof createTemplateInstanceSchema>;

/** 更新模版實例輸入類型 */
export type UpdateTemplateInstanceInput = z.infer<typeof updateTemplateInstanceSchema>;

/** 狀態變更輸入類型 */
export type ChangeStatusInput = z.infer<typeof changeStatusSchema>;

/** 標記導出輸入類型 */
export type MarkExportedInput = z.infer<typeof markExportedSchema>;

/** 添加行輸入類型 */
export type AddRowInput = z.infer<typeof addRowSchema>;

/** 更新行輸入類型 */
export type UpdateRowInput = z.infer<typeof updateRowSchema>;

/** 批量添加行輸入類型 */
export type BatchAddRowsInput = z.infer<typeof batchAddRowsSchema>;

/** 實例查詢參數類型 */
export type TemplateInstanceQueryParams = z.infer<typeof templateInstanceQuerySchema>;

/** 行查詢參數類型 */
export type TemplateInstanceRowQueryParams = z.infer<typeof templateInstanceRowQuerySchema>;
