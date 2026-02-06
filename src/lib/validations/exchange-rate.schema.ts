/**
 * @fileoverview Exchange Rate 驗證 Schema
 * @description
 *   使用 Zod 定義 Exchange Rate 相關的驗證 Schema。
 *   用於前端表單驗證和後端 API 輸入驗證。
 *
 *   驗證規則：
 *   - fromCurrency / toCurrency: ISO 4217 貨幣代碼，3 字元大寫
 *   - rate: 正數，支援 number 或 string 輸入
 *   - effectiveYear: 2000-2100 年份
 *   - 唯一約束：(fromCurrency, toCurrency, effectiveYear) 組合唯一
 *   - fromCurrency !== toCurrency
 *
 * @module src/lib/validations/exchange-rate.schema
 * @since Epic 21 - Story 21.2
 * @lastModified 2026-02-05
 *
 * @dependencies
 *   - zod - Schema 驗證庫
 *
 * @related
 *   - src/services/exchange-rate.service.ts - 服務層
 *   - src/types/exchange-rate.ts - 類型定義
 */

import { z } from 'zod';

// ============================================================================
// Constants
// ============================================================================

/** 貨幣代碼長度 */
const CURRENCY_CODE_LENGTH = 3;

/** 描述最大長度 */
const DESCRIPTION_MAX_LENGTH = 500;

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

/** 批次查詢最大筆數 */
const BATCH_MAX_PAIRS = 50;

// ============================================================================
// Shared Schemas
// ============================================================================

/**
 * ISO 4217 貨幣代碼 Schema
 *
 * @description 3 字元大寫字母，自動轉換為大寫
 */
const currencyCodeSchema = z
  .string()
  .length(CURRENCY_CODE_LENGTH, { message: `貨幣代碼必須為 ${CURRENCY_CODE_LENGTH} 個字元` })
  .toUpperCase();

/**
 * 匯率值 Schema
 *
 * @description 支援 number 或 string（自動轉換），必須為正數
 */
const rateValueSchema = z.union([
  z.number().positive({ message: '匯率必須為正數' }),
  z.string().transform(Number).pipe(z.number().positive({ message: '匯率必須為正數' })),
]);

// ============================================================================
// Create Schema
// ============================================================================

/**
 * 建立匯率記錄的驗證 Schema
 *
 * @description
 *   驗證建立匯率時的輸入資料。
 *   包含 refinement: fromCurrency !== toCurrency
 */
export const createExchangeRateSchema = z
  .object({
    fromCurrency: currencyCodeSchema,
    toCurrency: currencyCodeSchema,
    rate: rateValueSchema,
    effectiveYear: z.number().int().min(YEAR_MIN).max(YEAR_MAX),
    effectiveFrom: z.string().datetime().optional(),
    effectiveTo: z.string().datetime().optional(),
    description: z.string().max(DESCRIPTION_MAX_LENGTH).optional(),
    createInverse: z.boolean().default(false),
  })
  .refine((data) => data.fromCurrency !== data.toCurrency, {
    message: '來源和目標貨幣不能相同',
    path: ['toCurrency'],
  });

// ============================================================================
// Update Schema
// ============================================================================

/**
 * 更新匯率記錄的驗證 Schema
 *
 * @description 所有欄位皆為可選，只更新提供的欄位
 */
export const updateExchangeRateSchema = z.object({
  rate: rateValueSchema.optional(),
  effectiveFrom: z.string().datetime().optional().nullable(),
  effectiveTo: z.string().datetime().optional().nullable(),
  description: z.string().max(DESCRIPTION_MAX_LENGTH).optional().nullable(),
  isActive: z.boolean().optional(),
});

// ============================================================================
// Query Schema
// ============================================================================

/**
 * 匯率列表查詢的驗證 Schema
 *
 * @description
 *   支援分頁、篩選、排序。
 *   從 query string 解析，因此基礎類型為 string，需 transform。
 */
export const getExchangeRatesQuerySchema = z.object({
  page: z
    .string()
    .default('1')
    .transform(Number)
    .pipe(z.number().int().positive()),
  limit: z
    .string()
    .default(String(PAGE_SIZE_DEFAULT))
    .transform(Number)
    .pipe(z.number().int().min(PAGE_SIZE_MIN).max(PAGE_SIZE_MAX)),
  year: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(YEAR_MIN).max(YEAR_MAX))
    .optional(),
  fromCurrency: currencyCodeSchema.optional(),
  toCurrency: currencyCodeSchema.optional(),
  isActive: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  source: z.enum(['MANUAL', 'IMPORTED', 'AUTO_INVERSE']).optional(),
  sortBy: z
    .enum(['fromCurrency', 'toCurrency', 'rate', 'effectiveYear', 'createdAt'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ============================================================================
// Convert Schema
// ============================================================================

/**
 * 匯率轉換的驗證 Schema
 *
 * @description
 *   驗證轉換請求。year 為可選，預設為當前年份。
 *   包含 refinement: fromCurrency !== toCurrency
 */
export const convertSchema = z
  .object({
    fromCurrency: currencyCodeSchema,
    toCurrency: currencyCodeSchema,
    amount: z.number().positive({ message: '金額必須為正數' }),
    year: z.number().int().min(YEAR_MIN).max(YEAR_MAX).optional(),
  })
  .refine((data) => data.fromCurrency !== data.toCurrency, {
    message: '來源和目標貨幣不能相同',
    path: ['toCurrency'],
  });

// ============================================================================
// Batch Get Rates Schema
// ============================================================================

/**
 * 批次匯率查詢的驗證 Schema
 *
 * @description 一次查詢多個貨幣對，最多 50 組
 */
export const batchGetRatesSchema = z.object({
  pairs: z
    .array(
      z.object({
        fromCurrency: currencyCodeSchema,
        toCurrency: currencyCodeSchema,
      })
    )
    .min(1, { message: '至少需要一組貨幣對' })
    .max(BATCH_MAX_PAIRS, { message: `最多 ${BATCH_MAX_PAIRS} 組貨幣對` }),
  year: z.number().int().min(YEAR_MIN).max(YEAR_MAX).optional(),
});

// ============================================================================
// Inferred Types
// ============================================================================

/** 建立匯率輸入類型 */
export type CreateExchangeRateInput = z.infer<typeof createExchangeRateSchema>;

/** 更新匯率輸入類型 */
export type UpdateExchangeRateInput = z.infer<typeof updateExchangeRateSchema>;

/** 匯率列表查詢類型 */
export type GetExchangeRatesQuery = z.infer<typeof getExchangeRatesQuerySchema>;

/** 匯率轉換輸入類型 */
export type ConvertInput = z.infer<typeof convertSchema>;

/** 批次匯率查詢輸入類型 */
export type BatchGetRatesInput = z.infer<typeof batchGetRatesSchema>;

// ============================================================================
// Import/Export Schemas (Story 21-5)
// ============================================================================

/** 每批次導入最大筆數 */
const IMPORT_MAX_ITEMS = 500;

/**
 * 匯率導出查詢的驗證 Schema
 *
 * @description
 *   支援 year 和 isActive 篩選。
 *   從 query string 解析，因此基礎類型為 string，需 transform。
 */
export const exportExchangeRatesQuerySchema = z.object({
  year: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(YEAR_MIN).max(YEAR_MAX))
    .optional(),
  isActive: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
});

/**
 * 匯率導入的單一項目 Schema
 *
 * @description
 *   支援 number 或 string 的 rate 輸入。
 *   包含 createInverse 選項用於建立反向匯率。
 */
const importExchangeRateItemSchema = z.object({
  fromCurrency: currencyCodeSchema,
  toCurrency: currencyCodeSchema,
  rate: rateValueSchema,
  effectiveYear: z.number().int().min(YEAR_MIN).max(YEAR_MAX),
  effectiveFrom: z.string().datetime().optional(),
  effectiveTo: z.string().datetime().optional(),
  description: z.string().max(DESCRIPTION_MAX_LENGTH).optional(),
  isActive: z.boolean().default(true),
  createInverse: z.boolean().default(false),
});

/**
 * 匯率批次導入的驗證 Schema
 *
 * @description
 *   驗證導入請求。支援 options 控制覆寫和跳過無效記錄行為。
 *   包含 refinement: 驗證每筆記錄的 fromCurrency !== toCurrency
 */
export const importExchangeRatesSchema = z.object({
  exportVersion: z.string().optional(),
  items: z
    .array(importExchangeRateItemSchema)
    .min(1, { message: '至少需要一筆資料' })
    .max(IMPORT_MAX_ITEMS, { message: `一次最多導入 ${IMPORT_MAX_ITEMS} 筆` }),
  options: z
    .object({
      overwriteExisting: z.boolean().default(false),
      skipInvalid: z.boolean().default(false),
    })
    .default({ overwriteExisting: false, skipInvalid: false }),
});

/** 匯率導出查詢類型 */
export type ExportExchangeRatesQuery = z.infer<typeof exportExchangeRatesQuerySchema>;

/** 匯率導入輸入類型 */
export type ImportExchangeRatesInput = z.infer<typeof importExchangeRatesSchema>;

/** 匯率導入單一項目類型 */
export type ImportExchangeRateItem = z.infer<typeof importExchangeRateItemSchema>;
