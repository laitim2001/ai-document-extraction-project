/**
 * @fileoverview 外部 API 查詢參數驗證 Schema
 * @description
 *   使用 Zod 定義任務狀態查詢的驗證規則，包括：
 *   - 列表查詢參數驗證
 *   - 批量狀態查詢驗證
 *   - 分頁參數驗證
 *
 * @module src/types/external-api/query
 * @author Development Team
 * @since Epic 11 - Story 11.2 (API 處理狀態查詢端點)
 * @lastModified 2025-12-21
 *
 * @features
 *   - Zod 運行時驗證
 *   - 查詢參數預設值
 *   - 日期範圍驗證
 *
 * @related
 *   - src/types/external-api/status.ts - 狀態類型
 *   - src/app/api/v1/invoices/route.ts - 列表查詢 API
 *   - src/app/api/v1/invoices/batch-status/route.ts - 批量查詢 API
 */

import { z } from 'zod';
import { TASK_STATUS, type TaskStatus } from './status';

// ============================================================
// 查詢參數常數
// ============================================================

/**
 * 預設每頁大小
 */
export const DEFAULT_PAGE_SIZE = 20;

/**
 * 最大每頁大小
 */
export const MAX_PAGE_SIZE = 100;

/**
 * 批量查詢最大任務數
 */
export const MAX_BATCH_SIZE = 100;

/**
 * 可查詢的狀態列表
 */
export const QUERYABLE_STATUSES = [
  'queued',
  'processing',
  'completed',
  'failed',
  'review_required',
] as const;

export type QueryableStatus = (typeof QUERYABLE_STATUSES)[number];

// ============================================================
// 列表查詢 Schema
// ============================================================

/**
 * 任務列表查詢參數 Schema
 * @description 用於 GET /api/v1/invoices 的查詢參數驗證
 */
export const listQuerySchema = z.object({
  /** 按狀態篩選 */
  status: z
    .enum(QUERYABLE_STATUSES)
    .optional()
    .describe('Filter by task status'),

  /** 城市代碼篩選 */
  cityCode: z
    .string()
    .max(10, 'City code too long')
    .regex(/^[A-Z]{2,5}$/, 'Invalid city code format')
    .optional()
    .describe('Filter by city code'),

  /** 開始日期（ISO 8601） */
  startDate: z
    .string()
    .refine(
      (val) => !val || !isNaN(Date.parse(val)),
      { message: 'Invalid start date format. Use ISO 8601 format.' }
    )
    .optional()
    .describe('Filter tasks created after this date'),

  /** 結束日期（ISO 8601） */
  endDate: z
    .string()
    .refine(
      (val) => !val || !isNaN(Date.parse(val)),
      { message: 'Invalid end date format. Use ISO 8601 format.' }
    )
    .optional()
    .describe('Filter tasks created before this date'),

  /** 頁碼（從 1 開始） */
  page: z
    .coerce
    .number()
    .int('Page must be an integer')
    .min(1, 'Page must be at least 1')
    .default(1)
    .describe('Page number (1-based)'),

  /** 每頁大小 */
  pageSize: z
    .coerce
    .number()
    .int('Page size must be an integer')
    .min(1, 'Page size must be at least 1')
    .max(MAX_PAGE_SIZE, `Page size cannot exceed ${MAX_PAGE_SIZE}`)
    .default(DEFAULT_PAGE_SIZE)
    .describe('Number of items per page'),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
  },
  {
    message: 'Start date must be before or equal to end date',
    path: ['startDate'],
  }
);

/**
 * 列表查詢參數類型
 */
export type ListQueryParams = z.infer<typeof listQuerySchema>;

// ============================================================
// 批量狀態查詢 Schema
// ============================================================

/**
 * 批量狀態查詢請求 Schema
 * @description 用於 POST /api/v1/invoices/batch-status 的請求驗證
 */
export const batchStatusSchema = z.object({
  /** 任務 ID 列表 */
  taskIds: z
    .array(
      z.string().min(1, 'Task ID cannot be empty')
    )
    .min(1, 'At least one task ID is required')
    .max(MAX_BATCH_SIZE, `Cannot query more than ${MAX_BATCH_SIZE} tasks at once`)
    .refine(
      (ids) => new Set(ids).size === ids.length,
      { message: 'Duplicate task IDs are not allowed' }
    )
    .describe('List of task IDs to query'),
});

/**
 * 批量狀態查詢請求類型
 */
export type BatchStatusQuery = z.infer<typeof batchStatusSchema>;

// ============================================================
// 單一任務查詢 Schema
// ============================================================

/**
 * 任務 ID 參數 Schema
 * @description 用於 GET /api/v1/invoices/{taskId}/status 的路徑參數驗證
 */
export const taskIdSchema = z.object({
  taskId: z
    .string()
    .min(1, 'Task ID is required')
    .max(64, 'Task ID too long')
    .describe('The unique task identifier'),
});

/**
 * 任務 ID 參數類型
 */
export type TaskIdParams = z.infer<typeof taskIdSchema>;

// ============================================================
// 驗證輔助函數
// ============================================================

/**
 * 驗證列表查詢參數
 * @param params URL 查詢參數
 * @returns 驗證結果
 */
export function validateListQuery(params: Record<string, string | undefined>) {
  return listQuerySchema.safeParse(params);
}

/**
 * 驗證批量狀態查詢
 * @param body 請求體
 * @returns 驗證結果
 */
export function validateBatchStatus(body: unknown) {
  return batchStatusSchema.safeParse(body);
}

/**
 * 驗證任務 ID
 * @param taskId 任務 ID
 * @returns 驗證結果
 */
export function validateTaskId(taskId: string) {
  return taskIdSchema.safeParse({ taskId });
}

/**
 * 將查詢參數轉換為物件
 * @param searchParams URL 查詢參數
 * @returns 查詢參數物件
 */
export function parseSearchParams(searchParams: URLSearchParams): Record<string, string | undefined> {
  const params: Record<string, string | undefined> = {};

  for (const [key, value] of searchParams.entries()) {
    params[key] = value;
  }

  return params;
}

/**
 * 判斷狀態是否有效
 * @param status 狀態字串
 * @returns 是否為有效狀態
 */
export function isValidStatus(status: string): status is TaskStatus {
  return Object.values(TASK_STATUS).includes(status as TaskStatus);
}

/**
 * 判斷狀態是否可查詢
 * @param status 狀態字串
 * @returns 是否為可查詢狀態
 */
export function isQueryableStatus(status: string): status is QueryableStatus {
  return QUERYABLE_STATUSES.includes(status as QueryableStatus);
}
