/**
 * @fileoverview 模版欄位映射驗證 Schema
 * @description
 *   提供 TemplateFieldMapping 相關的 Zod 驗證 Schema，包括：
 *   - 轉換參數驗證
 *   - 映射規則驗證
 *   - 創建/更新配置驗證
 *   - API 查詢參數驗證
 *
 * @module src/validations/template-field-mapping
 * @since Epic 19 - Story 19.1
 * @lastModified 2026-01-22
 *
 * @features
 *   - 轉換類型與參數關聯驗證
 *   - 範圍與關聯 ID 驗證
 *   - 欄位名稱唯一性驗證
 *
 * @dependencies
 *   - zod - 驗證庫
 *   - src/types/template-field-mapping.ts - 類型定義
 */

import { z } from 'zod';

// ============================================================================
// Transform Parameters Schemas
// ============================================================================

/**
 * FORMULA 轉換參數驗證
 * 支援 {field_name} 變數和基本運算
 */
export const formulaTransformParamsSchema = z.object({
  formula: z
    .string()
    .min(1, '公式不能為空')
    .max(500, '公式過長')
    // 允許字母、數字、底線、空格、運算符、小數點、大括號
    .regex(
      /^[a-zA-Z0-9_\s\+\-\*\/\.\(\)\{\}]+$/,
      '公式包含無效字符，只能包含欄位引用 {field} 和基本運算符'
    ),
});

/**
 * LOOKUP 轉換參數驗證
 */
export const lookupTransformParamsSchema = z.object({
  lookupTable: z.record(z.string(), z.unknown()).refine(
    (table) => Object.keys(table).length > 0,
    { message: '查表映射不能為空' }
  ),
  defaultValue: z.unknown().optional(),
});

/**
 * CONCAT 轉換參數驗證
 */
export const concatTransformParamsSchema = z.object({
  fields: z.array(z.string().min(1)).min(2, '合併至少需要兩個欄位'),
  separator: z.string().max(10).optional(),
});

/**
 * SPLIT 轉換參數驗證
 */
export const splitTransformParamsSchema = z.object({
  separator: z.string().min(1, '分隔符不能為空').max(10, '分隔符過長'),
  index: z.number().int().nonnegative('索引必須為非負整數'),
});

/**
 * CUSTOM 轉換參數驗證
 */
export const customTransformParamsSchema = z.object({
  expression: z
    .string()
    .min(1, '表達式不能為空')
    .max(1000, '表達式過長'),
});

/**
 * 轉換參數聯合 Schema
 */
export const transformParamsSchema = z.union([
  formulaTransformParamsSchema,
  lookupTransformParamsSchema,
  concatTransformParamsSchema,
  splitTransformParamsSchema,
  customTransformParamsSchema,
  z.null(),
]);

// ============================================================================
// Mapping Rule Schema
// ============================================================================

/**
 * 轉換類型 Schema
 */
export const fieldTransformTypeSchema = z.enum([
  'DIRECT',
  'FORMULA',
  'LOOKUP',
  'CONCAT',
  'SPLIT',
  'CUSTOM',
]);

/**
 * 映射規則輸入 Schema（不含 ID，用於創建/更新）
 */
export const templateFieldMappingRuleInputSchema = z.object({
  /** 源欄位名（標準欄位） */
  sourceField: z
    .string()
    .min(1, '源欄位不能為空')
    .max(100, '源欄位名稱過長'),
  /** 目標欄位名（模版欄位） */
  targetField: z
    .string()
    .min(1, '目標欄位不能為空')
    .max(100, '目標欄位名稱過長'),
  /** 轉換類型 */
  transformType: fieldTransformTypeSchema,
  /** 轉換參數 */
  transformParams: transformParamsSchema.optional().nullable(),
  /** 是否必填 */
  isRequired: z.boolean().default(false),
  /** 處理順序 */
  order: z.number().int().nonnegative('順序必須為非負整數'),
  /** 說明 */
  description: z.string().max(500, '說明過長').optional(),
}).refine(
  (data) => {
    // FORMULA 類型必須有 formula 參數
    if (data.transformType === 'FORMULA') {
      return (
        data.transformParams &&
        typeof data.transformParams === 'object' &&
        'formula' in data.transformParams
      );
    }
    // LOOKUP 類型必須有 lookupTable 參數
    if (data.transformType === 'LOOKUP') {
      return (
        data.transformParams &&
        typeof data.transformParams === 'object' &&
        'lookupTable' in data.transformParams
      );
    }
    // CONCAT 類型必須有 fields 參數
    if (data.transformType === 'CONCAT') {
      return (
        data.transformParams &&
        typeof data.transformParams === 'object' &&
        'fields' in data.transformParams
      );
    }
    // SPLIT 類型必須有 separator 和 index 參數
    if (data.transformType === 'SPLIT') {
      return (
        data.transformParams &&
        typeof data.transformParams === 'object' &&
        'separator' in data.transformParams &&
        'index' in data.transformParams
      );
    }
    // CUSTOM 類型必須有 expression 參數
    if (data.transformType === 'CUSTOM') {
      return (
        data.transformParams &&
        typeof data.transformParams === 'object' &&
        'expression' in data.transformParams
      );
    }
    // DIRECT 類型不需要參數
    return true;
  },
  { message: '轉換參數與類型不匹配' }
);

// ============================================================================
// Configuration Schemas
// ============================================================================

/**
 * 範圍 Schema
 */
export const templateFieldMappingScopeSchema = z.enum(['GLOBAL', 'COMPANY', 'FORMAT']);

/**
 * 創建映射配置 Schema
 */
export const createTemplateFieldMappingSchema = z.object({
  /** 數據模版 ID */
  dataTemplateId: z.string().cuid('無效的模版 ID'),
  /** 範圍 */
  scope: templateFieldMappingScopeSchema.default('GLOBAL'),
  /** 公司 ID（COMPANY 範圍時必填） */
  companyId: z.string().uuid('無效的公司 ID').optional().nullable(),
  /** 文件格式 ID（FORMAT 範圍時必填） */
  documentFormatId: z.string().cuid('無效的格式 ID').optional().nullable(),
  /** 配置名稱 */
  name: z
    .string()
    .min(1, '名稱不能為空')
    .max(200, '名稱不能超過 200 個字元'),
  /** 說明 */
  description: z.string().max(1000, '說明過長').optional(),
  /** 映射規則列表 */
  mappings: z
    .array(templateFieldMappingRuleInputSchema)
    .min(1, '至少需要一條映射規則')
    .max(100, '映射規則過多'),
  /** 優先級 */
  priority: z.number().int().min(0).max(1000).default(0),
}).refine(
  (data) => {
    // COMPANY 範圍需要 companyId
    if (data.scope === 'COMPANY' && !data.companyId) {
      return false;
    }
    return true;
  },
  { message: '公司範圍需要指定公司 ID', path: ['companyId'] }
).refine(
  (data) => {
    // FORMAT 範圍需要 documentFormatId
    if (data.scope === 'FORMAT' && !data.documentFormatId) {
      return false;
    }
    return true;
  },
  { message: '格式範圍需要指定文件格式 ID', path: ['documentFormatId'] }
).refine(
  (data) => {
    // 檢查目標欄位名稱唯一性
    const targetFields = data.mappings.map((m) => m.targetField);
    return new Set(targetFields).size === targetFields.length;
  },
  { message: '目標欄位名稱必須唯一', path: ['mappings'] }
);

/**
 * 更新映射配置 Schema
 */
export const updateTemplateFieldMappingSchema = z.object({
  /** 配置名稱 */
  name: z
    .string()
    .min(1, '名稱不能為空')
    .max(200, '名稱不能超過 200 個字元')
    .optional(),
  /** 說明 */
  description: z.string().max(1000, '說明過長').optional().nullable(),
  /** 映射規則列表 */
  mappings: z
    .array(templateFieldMappingRuleInputSchema)
    .min(1, '至少需要一條映射規則')
    .max(100, '映射規則過多')
    .optional(),
  /** 優先級 */
  priority: z.number().int().min(0).max(1000).optional(),
  /** 是否啟用 */
  isActive: z.boolean().optional(),
}).refine(
  (data) => {
    // 如果有更新 mappings，檢查目標欄位名稱唯一性
    if (data.mappings) {
      const targetFields = data.mappings.map((m) => m.targetField);
      return new Set(targetFields).size === targetFields.length;
    }
    return true;
  },
  { message: '目標欄位名稱必須唯一', path: ['mappings'] }
);

// ============================================================================
// Query Schemas
// ============================================================================

/**
 * 列表查詢參數 Schema
 */
export const templateFieldMappingQuerySchema = z.object({
  /** 按模版篩選 */
  dataTemplateId: z.string().cuid().optional(),
  /** 按範圍篩選 */
  scope: templateFieldMappingScopeSchema.optional(),
  /** 按公司篩選 */
  companyId: z.string().uuid().optional(),
  /** 按格式篩選 */
  documentFormatId: z.string().cuid().optional(),
  /** 按啟用狀態篩選 */
  isActive: z.coerce.boolean().optional(),
  /** 搜尋關鍵字 */
  search: z.string().max(100).optional(),
  /** 頁碼 */
  page: z.coerce.number().int().positive().default(1),
  /** 每頁數量 */
  limit: z.coerce.number().int().positive().max(100).default(20),
});

/**
 * 解析配置請求 Schema
 */
export const resolveMappingParamsSchema = z.object({
  /** 數據模版 ID */
  dataTemplateId: z.string().cuid('無效的模版 ID'),
  /** 公司 ID（可選） */
  companyId: z.string().uuid().optional(),
  /** 文件格式 ID（可選） */
  documentFormatId: z.string().cuid().optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

/** 創建映射配置輸入類型 */
export type CreateTemplateFieldMappingInput = z.infer<typeof createTemplateFieldMappingSchema>;

/** 更新映射配置輸入類型 */
export type UpdateTemplateFieldMappingInput = z.infer<typeof updateTemplateFieldMappingSchema>;

/** 映射規則輸入類型 */
export type TemplateFieldMappingRuleInput = z.infer<typeof templateFieldMappingRuleInputSchema>;

/** 列表查詢參數類型 */
export type TemplateFieldMappingQueryParams = z.infer<typeof templateFieldMappingQuerySchema>;

/** 解析配置請求參數類型 */
export type ResolveMappingParams = z.infer<typeof resolveMappingParamsSchema>;
