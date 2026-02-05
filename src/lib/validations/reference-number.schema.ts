/**
 * @fileoverview Reference Number 驗證 Schema
 * @description
 *   使用 Zod 定義 Reference Number 相關的驗證 Schema。
 *   用於前端表單驗證和後端 API 輸入驗證。
 *
 *   驗證規則：
 *   - code: 可選，自動生成或手動指定，唯一
 *   - number: 必填、1-100 字元
 *   - type: 必須為有效的 ReferenceNumberType enum 值
 *   - year: 必填、2000-2100 年份
 *   - regionId: 必填、CUID 格式
 *   - 唯一約束：(number, type, year, regionId) 組合唯一
 *
 * @module src/lib/validations/reference-number.schema
 * @since Epic 20 - Story 20.3
 * @lastModified 2026-02-05
 *
 * @dependencies
 *   - zod - Schema 驗證庫
 *
 * @related
 *   - src/services/reference-number.service.ts - 服務層
 *   - src/app/api/v1/reference-numbers/ - API 端點
 */

import { z } from 'zod';

// ============================================================================
// Constants
// ============================================================================

/** 號碼最小長度 */
const NUMBER_MIN_LENGTH = 1;

/** 號碼最大長度 */
const NUMBER_MAX_LENGTH = 100;

/** Code 最大長度 */
const CODE_MAX_LENGTH = 50;

/** 描述最大長度 */
const DESCRIPTION_MAX_LENGTH = 500;

/** 搜尋關鍵字最大長度 */
const SEARCH_MAX_LENGTH = 100;

/** 年份最小值 */
const YEAR_MIN = 2000;

/** 年份最大值 */
const YEAR_MAX = 2100;

/** 每頁最小數量 */
const PAGE_SIZE_MIN = 1;

/** 每頁最大數量 */
const PAGE_SIZE_MAX = 100;

/** 每頁預設數量 */
const PAGE_SIZE_DEFAULT = 20;

// ============================================================================
// Enum Schemas
// ============================================================================

/**
 * Reference Number 類型 Schema
 */
export const referenceNumberTypeSchema = z.enum(
  [
    'SHIPMENT',
    'DELIVERY',
    'BOOKING',
    'CONTAINER',
    'HAWB',
    'MAWB',
    'BL',
    'CUSTOMS',
    'OTHER',
  ],
  {
    message: '無效的參考號碼類型',
  }
);

/**
 * Reference Number 狀態 Schema
 */
export const referenceNumberStatusSchema = z.enum(
  ['ACTIVE', 'EXPIRED', 'CANCELLED'],
  {
    message: '無效的參考號碼狀態',
  }
);

// ============================================================================
// Create Reference Number Schema
// ============================================================================

/**
 * 建立 Reference Number Schema
 */
export const createReferenceNumberSchema = z
  .object({
    /** 唯一識別碼（可選，未提供時自動生成） */
    code: z
      .string()
      .max(CODE_MAX_LENGTH, `識別碼不能超過 ${CODE_MAX_LENGTH} 字元`)
      .regex(
        /^[A-Z0-9_-]+$/i,
        '識別碼只能包含英數字、底線和連字號'
      )
      .optional(),

    /** 號碼值 */
    number: z
      .string()
      .min(NUMBER_MIN_LENGTH, '號碼不能為空')
      .max(NUMBER_MAX_LENGTH, `號碼不能超過 ${NUMBER_MAX_LENGTH} 字元`),

    /** 類型 */
    type: referenceNumberTypeSchema,

    /** 年份 */
    year: z
      .number()
      .int('年份必須是整數')
      .min(YEAR_MIN, `年份不能小於 ${YEAR_MIN}`)
      .max(YEAR_MAX, `年份不能大於 ${YEAR_MAX}`),

    /** 地區 ID */
    regionId: z.string().cuid('無效的地區 ID'),

    /** 描述 */
    description: z
      .string()
      .max(DESCRIPTION_MAX_LENGTH, `描述不能超過 ${DESCRIPTION_MAX_LENGTH} 字元`)
      .optional()
      .nullable(),

    /** 有效起始日 */
    validFrom: z.string().datetime('無效的日期時間格式').optional().nullable(),

    /** 有效結束日 */
    validUntil: z.string().datetime('無效的日期時間格式').optional().nullable(),
  })
  .refine(
    (data) => {
      // 驗證有效期範圍
      if (data.validFrom && data.validUntil) {
        return new Date(data.validFrom) <= new Date(data.validUntil);
      }
      return true;
    },
    {
      message: '有效起始日不能大於結束日',
      path: ['validUntil'],
    }
  );

/** 建立 Reference Number 輸入類型 */
export type CreateReferenceNumberInput = z.infer<typeof createReferenceNumberSchema>;

// ============================================================================
// Update Reference Number Schema
// ============================================================================

/**
 * 更新 Reference Number Schema
 */
export const updateReferenceNumberSchema = z
  .object({
    /** 號碼值 */
    number: z
      .string()
      .min(NUMBER_MIN_LENGTH, '號碼不能為空')
      .max(NUMBER_MAX_LENGTH, `號碼不能超過 ${NUMBER_MAX_LENGTH} 字元`)
      .optional(),

    /** 類型 */
    type: referenceNumberTypeSchema.optional(),

    /** 狀態 */
    status: referenceNumberStatusSchema.optional(),

    /** 年份 */
    year: z
      .number()
      .int('年份必須是整數')
      .min(YEAR_MIN, `年份不能小於 ${YEAR_MIN}`)
      .max(YEAR_MAX, `年份不能大於 ${YEAR_MAX}`)
      .optional(),

    /** 地區 ID */
    regionId: z.string().cuid('無效的地區 ID').optional(),

    /** 描述 */
    description: z
      .string()
      .max(DESCRIPTION_MAX_LENGTH, `描述不能超過 ${DESCRIPTION_MAX_LENGTH} 字元`)
      .optional()
      .nullable(),

    /** 有效起始日 */
    validFrom: z.string().datetime('無效的日期時間格式').optional().nullable(),

    /** 有效結束日 */
    validUntil: z.string().datetime('無效的日期時間格式').optional().nullable(),

    /** 是否啟用 */
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) => {
      // 驗證有效期範圍
      if (data.validFrom && data.validUntil) {
        return new Date(data.validFrom) <= new Date(data.validUntil);
      }
      return true;
    },
    {
      message: '有效起始日不能大於結束日',
      path: ['validUntil'],
    }
  );

/** 更新 Reference Number 輸入類型 */
export type UpdateReferenceNumberInput = z.infer<typeof updateReferenceNumberSchema>;

// ============================================================================
// Query Parameters Schema
// ============================================================================

/**
 * 查詢 Reference Number 參數 Schema
 */
export const getReferenceNumbersQuerySchema = z.object({
  /** 頁碼（從 1 開始） */
  page: z
    .string()
    .default('1')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),

  /** 每頁數量 */
  limit: z
    .string()
    .default(String(PAGE_SIZE_DEFAULT))
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(PAGE_SIZE_MIN).max(PAGE_SIZE_MAX)),

  /** 篩選年份 */
  year: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int())
    .optional(),

  /** 篩選地區 ID */
  regionId: z.string().cuid().optional(),

  /** 篩選類型 */
  type: referenceNumberTypeSchema.optional(),

  /** 篩選狀態 */
  status: referenceNumberStatusSchema.optional(),

  /** 篩選啟用狀態 */
  isActive: z
    .string()
    .transform((val) => val === 'true')
    .optional(),

  /** 搜尋關鍵字（模糊搜尋 number） */
  search: z
    .string()
    .max(SEARCH_MAX_LENGTH, `搜尋關鍵字不能超過 ${SEARCH_MAX_LENGTH} 字元`)
    .optional(),

  /** 排序欄位 */
  sortBy: z
    .enum(['number', 'year', 'createdAt', 'updatedAt', 'matchCount'])
    .default('createdAt'),

  /** 排序方向 */
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/** 查詢 Reference Number 參數類型 */
export type GetReferenceNumbersQuery = z.infer<typeof getReferenceNumbersQuerySchema>;

// ============================================================================
// ID Parameter Schema
// ============================================================================

/**
 * Reference Number ID 參數 Schema
 */
export const referenceNumberIdParamSchema = z.object({
  id: z.string().cuid('無效的 Reference Number ID'),
});

/** Reference Number ID 參數類型 */
export type ReferenceNumberIdParam = z.infer<typeof referenceNumberIdParamSchema>;
