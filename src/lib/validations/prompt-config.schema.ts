/**
 * @fileoverview Prompt 配置驗證 Schema
 * @description
 *   使用 Zod 定義 Prompt 配置相關的驗證 Schema。
 *   用於前端表單驗證和後端 API 輸入驗證。
 *
 *   驗證規則：
 *   - Name: 必填、1-100 字元
 *   - PromptType: 必須為有效的 enum 值
 *   - Scope: 必須為有效的 enum 值
 *   - SystemPrompt: 必填、不可為空
 *   - UserPromptTemplate: 必填、不可為空
 *   - Version: 更新時必填（樂觀鎖）
 *
 * @module src/lib/validations/prompt-config.schema
 * @since Epic 14 - Story 14.1
 * @lastModified 2026-01-02
 *
 * @dependencies
 *   - zod - Schema 驗證庫
 *   - @prisma/client - Prisma enum 類型
 *
 * @related
 *   - src/types/prompt-config.ts - 類型定義
 *   - src/app/api/v1/prompt-configs/ - API 端點
 */

import { z } from 'zod';

// ============================================================================
// Constants
// ============================================================================

/** Prompt 名稱最小長度 */
const PROMPT_NAME_MIN_LENGTH = 1;

/** Prompt 名稱最大長度 */
const PROMPT_NAME_MAX_LENGTH = 100;

/** 描述最大長度 */
const DESCRIPTION_MAX_LENGTH = 1000;

/** 變數名稱最大長度 */
const VARIABLE_NAME_MAX_LENGTH = 50;

/** 變數顯示名稱最大長度 */
const VARIABLE_DISPLAY_NAME_MAX_LENGTH = 100;

// ============================================================================
// Enum Schemas
// ============================================================================

/**
 * Prompt 類型 Schema
 */
export const promptTypeSchema = z.enum(
  ['ISSUER_IDENTIFICATION', 'TERM_CLASSIFICATION', 'FIELD_EXTRACTION', 'VALIDATION'],
  {
    message: '無效的 Prompt 類型',
  }
);

/**
 * Prompt 範圍 Schema
 */
export const promptScopeSchema = z.enum(['GLOBAL', 'COMPANY', 'FORMAT'], {
  message: '無效的 Prompt 範圍',
});

/**
 * 合併策略 Schema
 */
export const mergeStrategySchema = z.enum(['OVERRIDE', 'APPEND', 'PREPEND'], {
  message: '無效的合併策略',
});

/**
 * 變數類型 Schema
 */
export const variableTypeSchema = z.enum(
  ['STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'ARRAY', 'OBJECT'],
  {
    message: '無效的變數類型',
  }
);

// ============================================================================
// Variable Definition Schema
// ============================================================================

/**
 * Prompt 變數定義 Schema
 */
export const promptVariableDefinitionSchema = z.object({
  /** 變數名稱（用於 {{variableName}} 插值） */
  name: z
    .string()
    .min(1, '變數名稱不能為空')
    .max(VARIABLE_NAME_MAX_LENGTH, `變數名稱不能超過 ${VARIABLE_NAME_MAX_LENGTH} 字元`)
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, '變數名稱必須以字母或底線開頭，只能包含字母、數字和底線'),

  /** 顯示名稱 */
  displayName: z
    .string()
    .min(1, '顯示名稱不能為空')
    .max(
      VARIABLE_DISPLAY_NAME_MAX_LENGTH,
      `顯示名稱不能超過 ${VARIABLE_DISPLAY_NAME_MAX_LENGTH} 字元`
    ),

  /** 描述 */
  description: z.string().max(DESCRIPTION_MAX_LENGTH).optional().nullable(),

  /** 變數類型 */
  variableType: variableTypeSchema,

  /** 預設值 */
  defaultValue: z.string().optional().nullable(),

  /** 資料來源 */
  dataSource: z.string().max(100).optional().nullable(),

  /** 是否必填 */
  isRequired: z.boolean().default(false),
});

/** Prompt 變數定義類型 */
export type PromptVariableDefinitionInput = z.infer<typeof promptVariableDefinitionSchema>;

// ============================================================================
// Create Prompt Config Schema
// ============================================================================

/**
 * 建立 Prompt 配置 Schema
 */
export const createPromptConfigSchema = z
  .object({
    /** Prompt 類型 */
    promptType: promptTypeSchema,

    /** 範圍（預設 GLOBAL） */
    scope: promptScopeSchema.default('GLOBAL'),

    /** 配置名稱 */
    name: z
      .string()
      .min(PROMPT_NAME_MIN_LENGTH, '配置名稱不能為空')
      .max(PROMPT_NAME_MAX_LENGTH, `配置名稱不能超過 ${PROMPT_NAME_MAX_LENGTH} 字元`),

    /** 描述 */
    description: z
      .string()
      .max(DESCRIPTION_MAX_LENGTH, `描述不能超過 ${DESCRIPTION_MAX_LENGTH} 字元`)
      .optional()
      .nullable(),

    /** 公司 ID（COMPANY 或 FORMAT 範圍時必填） */
    companyId: z.preprocess(
      (val) => (val === '' || val === undefined ? null : val),
      z.string().cuid('無效的公司 ID').nullable()
    ),

    /** 文件格式 ID（FORMAT 範圍時必填） */
    documentFormatId: z.preprocess(
      (val) => (val === '' || val === undefined ? null : val),
      z.string().cuid('無效的文件格式 ID').nullable()
    ),

    /** 系統提示詞 */
    systemPrompt: z.string().min(1, '系統提示詞不能為空'),

    /** 用戶提示詞模板 */
    userPromptTemplate: z.string().min(1, '用戶提示詞模板不能為空'),

    /** 合併策略（預設 OVERRIDE） */
    mergeStrategy: mergeStrategySchema.default('OVERRIDE'),

    /** 變數定義（預設空陣列） */
    variables: z.array(promptVariableDefinitionSchema).default([]),

    /** 是否啟用（預設 true） */
    isActive: z.boolean().default(true),
  })
  .refine(
    (data) => {
      // COMPANY 範圍必須有 companyId
      if (data.scope === 'COMPANY' && !data.companyId) {
        return false;
      }
      return true;
    },
    {
      message: 'COMPANY 範圍必須指定公司',
      path: ['companyId'],
    }
  )
  .refine(
    (data) => {
      // FORMAT 範圍必須有 companyId 和 documentFormatId
      if (data.scope === 'FORMAT') {
        if (!data.companyId || !data.documentFormatId) {
          return false;
        }
      }
      return true;
    },
    {
      message: 'FORMAT 範圍必須指定公司和文件格式',
      path: ['documentFormatId'],
    }
  )
  .refine(
    (data) => {
      // GLOBAL 範圍不應有 companyId 或 documentFormatId
      if (data.scope === 'GLOBAL') {
        if (data.companyId || data.documentFormatId) {
          return false;
        }
      }
      return true;
    },
    {
      message: 'GLOBAL 範圍不應指定公司或文件格式',
      path: ['scope'],
    }
  );

/** 建立 Prompt 配置輸入類型 */
export type CreatePromptConfigInput = z.infer<typeof createPromptConfigSchema>;

// ============================================================================
// Update Prompt Config Schema
// ============================================================================

/**
 * 更新 Prompt 配置 Schema
 */
export const updatePromptConfigSchema = z.object({
  /** 配置名稱 */
  name: z
    .string()
    .min(PROMPT_NAME_MIN_LENGTH, '配置名稱不能為空')
    .max(PROMPT_NAME_MAX_LENGTH, `配置名稱不能超過 ${PROMPT_NAME_MAX_LENGTH} 字元`)
    .optional(),

  /** 描述 */
  description: z
    .string()
    .max(DESCRIPTION_MAX_LENGTH, `描述不能超過 ${DESCRIPTION_MAX_LENGTH} 字元`)
    .optional()
    .nullable(),

  /** 系統提示詞 */
  systemPrompt: z.string().min(1, '系統提示詞不能為空').optional(),

  /** 用戶提示詞模板 */
  userPromptTemplate: z.string().min(1, '用戶提示詞模板不能為空').optional(),

  /** 合併策略 */
  mergeStrategy: mergeStrategySchema.optional(),

  /** 變數定義 */
  variables: z.array(promptVariableDefinitionSchema).optional(),

  /** 是否啟用 */
  isActive: z.boolean().optional(),

  /** 版本號（樂觀鎖必填） */
  version: z
    .number()
    .int('版本號必須是整數')
    .positive('版本號必須是正數'),
});

/** 更新 Prompt 配置輸入類型 */
export type UpdatePromptConfigInput = z.infer<typeof updatePromptConfigSchema>;

// ============================================================================
// ID Parameter Schema
// ============================================================================

/**
 * Prompt 配置 ID 參數 Schema
 */
export const promptConfigIdParamSchema = z.object({
  id: z.string().cuid('無效的 Prompt 配置 ID'),
});

/** Prompt 配置 ID 參數類型 */
export type PromptConfigIdParam = z.infer<typeof promptConfigIdParamSchema>;

// ============================================================================
// Query Parameters Schema
// ============================================================================

/**
 * 查詢 Prompt 配置參數 Schema
 */
export const getPromptConfigsQuerySchema = z.object({
  /** 篩選 Prompt 類型 */
  promptType: promptTypeSchema.optional(),

  /** 篩選範圍 */
  scope: promptScopeSchema.optional(),

  /** 篩選公司 */
  companyId: z.preprocess(
    (val) => (val === '' || val === undefined ? undefined : val),
    z.string().cuid().optional()
  ),

  /** 篩選文件格式 */
  documentFormatId: z.preprocess(
    (val) => (val === '' || val === undefined ? undefined : val),
    z.string().cuid().optional()
  ),

  /** 篩選啟用狀態 */
  isActive: z
    .string()
    .transform((val) => val === 'true')
    .optional(),

  /** 搜尋關鍵字（名稱或描述） */
  search: z.string().max(100).optional(),

  /** 頁碼（從 1 開始） */
  page: z
    .string()
    .default('1')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),

  /** 每頁數量 */
  limit: z
    .string()
    .default('20')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(1).max(100)),

  /** 排序欄位 */
  sortBy: z.enum(['name', 'createdAt', 'updatedAt']).default('createdAt'),

  /** 排序方向 */
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/** 查詢 Prompt 配置參數類型 */
export type GetPromptConfigsQuery = z.infer<typeof getPromptConfigsQuerySchema>;

// ============================================================================
// Resolve Prompt Schema (for Story 14.2+)
// ============================================================================

/**
 * 解析 Prompt 請求 Schema
 */
export const resolvePromptSchema = z.object({
  /** Prompt 類型 */
  promptType: promptTypeSchema,

  /** 公司 ID（可選） */
  companyId: z.string().cuid().optional(),

  /** 文件格式 ID（可選） */
  documentFormatId: z.string().cuid().optional(),
});

/** 解析 Prompt 請求類型 */
export type ResolvePromptInput = z.infer<typeof resolvePromptSchema>;

// ============================================================================
// Prompt Variable CRUD Schemas
// ============================================================================

/**
 * 建立 Prompt 變數 Schema
 */
export const createPromptVariableSchema = z.object({
  /** 變數名稱 */
  name: z
    .string()
    .min(1, '變數名稱不能為空')
    .max(VARIABLE_NAME_MAX_LENGTH, `變數名稱不能超過 ${VARIABLE_NAME_MAX_LENGTH} 字元`)
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, '變數名稱必須以字母或底線開頭，只能包含字母、數字和底線'),

  /** 顯示名稱 */
  displayName: z
    .string()
    .min(1, '顯示名稱不能為空')
    .max(VARIABLE_DISPLAY_NAME_MAX_LENGTH, `顯示名稱不能超過 ${VARIABLE_DISPLAY_NAME_MAX_LENGTH} 字元`),

  /** 描述 */
  description: z.string().max(DESCRIPTION_MAX_LENGTH).optional().nullable(),

  /** 變數類型 */
  variableType: variableTypeSchema,

  /** 預設值 */
  defaultValue: z.string().optional().nullable(),

  /** 資料來源 */
  dataSource: z.string().max(100).optional().nullable(),

  /** 是否必填 */
  isRequired: z.boolean().default(false),
});

/** 建立 Prompt 變數輸入類型 */
export type CreatePromptVariableInput = z.infer<typeof createPromptVariableSchema>;

/**
 * 更新 Prompt 變數 Schema
 */
export const updatePromptVariableSchema = z.object({
  /** 顯示名稱 */
  displayName: z
    .string()
    .min(1, '顯示名稱不能為空')
    .max(VARIABLE_DISPLAY_NAME_MAX_LENGTH, `顯示名稱不能超過 ${VARIABLE_DISPLAY_NAME_MAX_LENGTH} 字元`)
    .optional(),

  /** 描述 */
  description: z.string().max(DESCRIPTION_MAX_LENGTH).optional().nullable(),

  /** 變數類型 */
  variableType: variableTypeSchema.optional(),

  /** 預設值 */
  defaultValue: z.string().optional().nullable(),

  /** 資料來源 */
  dataSource: z.string().max(100).optional().nullable(),

  /** 是否必填 */
  isRequired: z.boolean().optional(),
});

/** 更新 Prompt 變數輸入類型 */
export type UpdatePromptVariableInput = z.infer<typeof updatePromptVariableSchema>;

/**
 * Prompt 變數 ID 參數 Schema
 */
export const promptVariableIdParamSchema = z.object({
  id: z.string().cuid('無效的 Prompt 變數 ID'),
});

/** Prompt 變數 ID 參數類型 */
export type PromptVariableIdParam = z.infer<typeof promptVariableIdParamSchema>;
