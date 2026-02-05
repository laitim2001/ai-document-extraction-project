/**
 * @fileoverview Region 驗證 Schema
 * @description
 *   使用 Zod 定義 Region 相關的驗證 Schema。
 *   用於前端表單驗證和後端 API 輸入驗證。
 *
 *   驗證規則：
 *   - Code: 必填、2-20 字元、大寫英文、數字和底線
 *   - Name: 必填、1-100 字元
 *   - Description: 可選、最大 500 字元
 *   - SortOrder: 可選、0-9999 整數
 *
 * @module src/lib/validations/region.schema
 * @author Development Team
 * @since Epic 20 - Story 20.2 (Region Management API & UI)
 * @lastModified 2026-02-05
 *
 * @dependencies
 *   - zod - Schema 驗證庫
 *
 * @related
 *   - src/services/region.service.ts - Region 服務
 *   - src/app/api/v1/regions/route.ts - Region API
 *   - src/components/features/region/RegionSelect.tsx - Region 選擇組件
 */

import { z } from 'zod'

// ============================================================
// Constants
// ============================================================

/** Region 代碼最小長度 */
const REGION_CODE_MIN_LENGTH = 2

/** Region 代碼最大長度 */
const REGION_CODE_MAX_LENGTH = 20

/** Region 名稱最小長度 */
const REGION_NAME_MIN_LENGTH = 1

/** Region 名稱最大長度 */
const REGION_NAME_MAX_LENGTH = 100

/** Region 描述最大長度 */
const REGION_DESCRIPTION_MAX_LENGTH = 500

/** Region 排序最小值 */
const REGION_SORT_ORDER_MIN = 0

/** Region 排序最大值 */
const REGION_SORT_ORDER_MAX = 9999

// ============================================================
// Create Region Schema
// ============================================================

/**
 * 建立 Region Schema
 *
 * @description
 *   用於驗證新增 Region 的輸入資料。
 *   建立的 Region 預設 isDefault = false。
 */
export const createRegionSchema = z.object({
  /** Region 代碼（大寫英文、數字、底線） */
  code: z
    .string()
    .min(REGION_CODE_MIN_LENGTH, `Code 至少需要 ${REGION_CODE_MIN_LENGTH} 個字元`)
    .max(REGION_CODE_MAX_LENGTH, `Code 最多 ${REGION_CODE_MAX_LENGTH} 個字元`)
    .regex(/^[A-Z0-9_]+$/, 'Code 只能包含大寫英文、數字和底線'),

  /** Region 名稱 */
  name: z
    .string()
    .min(REGION_NAME_MIN_LENGTH, '名稱不能為空')
    .max(REGION_NAME_MAX_LENGTH, `名稱最多 ${REGION_NAME_MAX_LENGTH} 個字元`),

  /** Region 描述（可選） */
  description: z
    .string()
    .max(REGION_DESCRIPTION_MAX_LENGTH, `描述最多 ${REGION_DESCRIPTION_MAX_LENGTH} 個字元`)
    .optional()
    .nullable(),

  /** 排序順序（可選） */
  sortOrder: z
    .number()
    .int('排序必須是整數')
    .min(REGION_SORT_ORDER_MIN, `排序最小值為 ${REGION_SORT_ORDER_MIN}`)
    .max(REGION_SORT_ORDER_MAX, `排序最大值為 ${REGION_SORT_ORDER_MAX}`)
    .optional(),
})

/** 建立 Region 輸入類型 */
export type CreateRegionInput = z.infer<typeof createRegionSchema>

// ============================================================
// Update Region Schema
// ============================================================

/**
 * 更新 Region Schema
 *
 * @description
 *   用於驗證更新 Region 的輸入資料。
 *   所有欄位都是可選的，只更新提供的欄位。
 *   注意：不允許更新 code（唯一識別）
 */
export const updateRegionSchema = z.object({
  /** Region 名稱（可選） */
  name: z
    .string()
    .min(REGION_NAME_MIN_LENGTH, '名稱不能為空')
    .max(REGION_NAME_MAX_LENGTH, `名稱最多 ${REGION_NAME_MAX_LENGTH} 個字元`)
    .optional(),

  /** Region 描述（可選） */
  description: z
    .string()
    .max(REGION_DESCRIPTION_MAX_LENGTH, `描述最多 ${REGION_DESCRIPTION_MAX_LENGTH} 個字元`)
    .optional()
    .nullable(),

  /** 是否啟用（可選） */
  isActive: z.boolean().optional(),

  /** 排序順序（可選） */
  sortOrder: z
    .number()
    .int('排序必須是整數')
    .min(REGION_SORT_ORDER_MIN, `排序最小值為 ${REGION_SORT_ORDER_MIN}`)
    .max(REGION_SORT_ORDER_MAX, `排序最大值為 ${REGION_SORT_ORDER_MAX}`)
    .optional(),
})

/** 更新 Region 輸入類型 */
export type UpdateRegionInput = z.infer<typeof updateRegionSchema>

// ============================================================
// Query Schema
// ============================================================

/**
 * 獲取 Region 列表查詢 Schema
 *
 * @description
 *   用於驗證獲取 Region 列表的查詢參數。
 */
export const getRegionsQuerySchema = z.object({
  /** 是否只返回啟用的 Region */
  isActive: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
})

/** 獲取 Region 列表查詢類型 */
export type GetRegionsQuery = z.infer<typeof getRegionsQuerySchema>

// ============================================================
// ID Param Schema
// ============================================================

/**
 * Region ID 參數 Schema
 *
 * @description
 *   用於驗證 URL 參數中的 Region ID。
 */
export const regionIdParamSchema = z.object({
  id: z.string().uuid('無效的 Region ID'),
})

/** Region ID 參數類型 */
export type RegionIdParam = z.infer<typeof regionIdParamSchema>

// ============================================================
// Code Check Schema
// ============================================================

/**
 * Region 代碼檢查 Schema
 *
 * @description
 *   用於驗證 Region 代碼是否已存在的查詢。
 */
export const checkRegionCodeSchema = z.object({
  /** Region 代碼 */
  code: z
    .string()
    .min(1, '請輸入代碼')
    .transform((val) => val.trim().toUpperCase()),

  /** 排除的 Region ID（編輯時使用） */
  excludeId: z.string().uuid().optional(),
})

/** Region 代碼檢查輸入類型 */
export type CheckRegionCodeInput = z.infer<typeof checkRegionCodeSchema>
