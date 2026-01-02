/**
 * @fileoverview Prompt 配置類型定義
 * @description
 *   定義 Prompt 配置系統的所有類型、介面和常數。
 *   支援三層配置繼承：GLOBAL → COMPANY → FORMAT
 *
 * @module src/types/prompt-config
 * @since Epic 14 - Story 14.1
 * @lastModified 2026-01-02
 *
 * @features
 *   - Prisma enum 重新導出
 *   - DTO 類型定義
 *   - API 請求/響應類型
 *   - 變數定義類型
 *   - 工具函數
 *
 * @dependencies
 *   - @prisma/client - Prisma 生成的類型
 */

import type { Prisma } from '@prisma/client';

// ============================================================================
// Re-export Prisma Enums
// ============================================================================

export {
  PromptType,
  PromptScope,
  MergeStrategy,
} from '@prisma/client';

// ============================================================================
// Enum Constants with Display Labels
// ============================================================================

/**
 * Prompt 類型選項（含 UI 顯示標籤）
 */
export const PROMPT_TYPES = {
  ISSUER_IDENTIFICATION: {
    value: 'ISSUER_IDENTIFICATION',
    label: '發行方識別',
    description: '用於識別文件發行方（如物流公司、供應商）',
  },
  TERM_CLASSIFICATION: {
    value: 'TERM_CLASSIFICATION',
    label: '術語分類',
    description: '用於分類提取的術語到標準類別',
  },
  FIELD_EXTRACTION: {
    value: 'FIELD_EXTRACTION',
    label: '欄位提取',
    description: '用於從文件中提取特定欄位',
  },
  VALIDATION: {
    value: 'VALIDATION',
    label: '驗證',
    description: '用於驗證提取結果的準確性',
  },
} as const;

/**
 * Prompt 範圍選項（含 UI 顯示標籤）
 */
export const PROMPT_SCOPES = {
  GLOBAL: {
    value: 'GLOBAL',
    label: '全域',
    description: '適用於所有公司和文件格式',
  },
  COMPANY: {
    value: 'COMPANY',
    label: '公司',
    description: '僅適用於特定公司',
  },
  FORMAT: {
    value: 'FORMAT',
    label: '格式',
    description: '僅適用於特定文件格式',
  },
} as const;

/**
 * 合併策略選項（含 UI 顯示標籤）
 */
export const MERGE_STRATEGIES = {
  OVERRIDE: {
    value: 'OVERRIDE',
    label: '覆蓋',
    description: '完全覆蓋父層配置',
  },
  APPEND: {
    value: 'APPEND',
    label: '附加',
    description: '附加到父層配置末尾',
  },
  PREPEND: {
    value: 'PREPEND',
    label: '前置',
    description: '插入到父層配置開頭',
  },
} as const;

// ============================================================================
// Variable Types
// ============================================================================

/**
 * 變數類型常數
 */
export const VARIABLE_TYPES = {
  STRING: 'STRING',
  NUMBER: 'NUMBER',
  BOOLEAN: 'BOOLEAN',
  DATE: 'DATE',
  ARRAY: 'ARRAY',
  OBJECT: 'OBJECT',
} as const;

export type VariableType = keyof typeof VARIABLE_TYPES;

/**
 * 變數定義介面（存儲在 PromptConfig.variables JSON 欄位中）
 */
export interface PromptVariableDefinition {
  /** 變數名稱（用於 {{variableName}} 插值） */
  name: string;
  /** 顯示名稱 */
  displayName: string;
  /** 描述 */
  description?: string;
  /** 變數類型 */
  variableType: VariableType;
  /** 預設值 */
  defaultValue?: string;
  /** 資料來源（如 'document.companyName', 'context.userId'） */
  dataSource?: string;
  /** 是否必填 */
  isRequired: boolean;
}

// ============================================================================
// DTO Types
// ============================================================================

/**
 * Prompt 配置 DTO（API 傳輸用）
 */
export interface PromptConfigDTO {
  id: string;
  promptType: string;
  scope: string;
  name: string;
  description: string | null;
  companyId: string | null;
  companyName?: string;
  documentFormatId: string | null;
  documentFormatName?: string;
  systemPrompt: string;
  userPromptTemplate: string;
  mergeStrategy: string;
  variables: PromptVariableDefinition[];
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
}

/**
 * Prompt 配置列表項目（簡化版 DTO）
 */
export interface PromptConfigListItem {
  id: string;
  promptType: string;
  scope: string;
  name: string;
  description: string | null;
  companyName?: string;
  documentFormatName?: string;
  isActive: boolean;
  version: number;
  updatedAt: string;
}

/**
 * Prompt 變數 DTO
 */
export interface PromptVariableDTO {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  variableType: string;
  defaultValue: string | null;
  dataSource: string | null;
  isRequired: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// API Request Types
// ============================================================================

/**
 * 建立 Prompt 配置請求
 */
export interface CreatePromptConfigRequest {
  promptType: string;
  scope?: string;
  name: string;
  description?: string;
  companyId?: string;
  documentFormatId?: string;
  systemPrompt: string;
  userPromptTemplate: string;
  mergeStrategy?: string;
  variables?: PromptVariableDefinition[];
  isActive?: boolean;
}

/**
 * 更新 Prompt 配置請求
 */
export interface UpdatePromptConfigRequest {
  name?: string;
  description?: string;
  systemPrompt?: string;
  userPromptTemplate?: string;
  mergeStrategy?: string;
  variables?: PromptVariableDefinition[];
  isActive?: boolean;
  /** 樂觀鎖版本號 */
  version: number;
}

/**
 * 查詢 Prompt 配置參數
 */
export interface GetPromptConfigsParams {
  promptType?: string;
  scope?: string;
  companyId?: string;
  documentFormatId?: string;
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * 單一 Prompt 配置響應
 */
export interface PromptConfigResponse {
  success: boolean;
  data: PromptConfigDTO;
}

/**
 * Prompt 配置列表響應
 */
export interface PromptConfigListResponse {
  success: boolean;
  data: PromptConfigListItem[];
  meta: {
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

/**
 * 刪除 Prompt 配置響應
 */
export interface DeletePromptConfigResponse {
  success: boolean;
  message: string;
}

// ============================================================================
// Resolved Prompt Types (for Story 14.2+)
// ============================================================================

/**
 * 解析後的 Prompt（經過三層繼承合併）
 */
export interface ResolvedPrompt {
  /** 最終的系統提示詞 */
  systemPrompt: string;
  /** 最終的用戶提示詞模板 */
  userPromptTemplate: string;
  /** 合併後的變數定義 */
  variables: PromptVariableDefinition[];
  /** 應用的配置來源資訊 */
  appliedConfigs: AppliedPromptConfigInfo[];
}

/**
 * 應用的配置來源資訊
 */
export interface AppliedPromptConfigInfo {
  id: string;
  name: string;
  scope: string;
  mergeStrategy: string;
}

/**
 * Prompt 解析上下文
 */
export interface PromptResolutionContext {
  promptType: string;
  companyId?: string;
  documentFormatId?: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * 取得 Prompt 類型的顯示標籤
 */
export function getPromptTypeLabel(type: string): string {
  const typeInfo = PROMPT_TYPES[type as keyof typeof PROMPT_TYPES];
  return typeInfo?.label ?? type;
}

/**
 * 取得 Prompt 範圍的顯示標籤
 */
export function getPromptScopeLabel(scope: string): string {
  const scopeInfo = PROMPT_SCOPES[scope as keyof typeof PROMPT_SCOPES];
  return scopeInfo?.label ?? scope;
}

/**
 * 取得合併策略的顯示標籤
 */
export function getMergeStrategyLabel(strategy: string): string {
  const strategyInfo = MERGE_STRATEGIES[strategy as keyof typeof MERGE_STRATEGIES];
  return strategyInfo?.label ?? strategy;
}

/**
 * 從模板中提取變數引用
 * @param template - Prompt 模板
 * @returns 變數名稱陣列
 * @example
 * extractVariableReferences('Hello {{name}}, your ID is {{userId}}')
 * // Returns: ['name', 'userId']
 */
export function extractVariableReferences(template: string): string[] {
  const regex = /\{\{(\w+)\}\}/g;
  const matches: string[] = [];
  let match;
  while ((match = regex.exec(template)) !== null) {
    if (!matches.includes(match[1])) {
      matches.push(match[1]);
    }
  }
  return matches;
}

/**
 * 替換模板中的變數
 * @param template - Prompt 模板
 * @param values - 變數值映射
 * @returns 替換後的字串
 * @example
 * interpolateVariables('Hello {{name}}!', { name: 'World' })
 * // Returns: 'Hello World!'
 */
export function interpolateVariables(
  template: string,
  values: Record<string, string | number | boolean>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    const value = values[varName];
    return value !== undefined ? String(value) : match;
  });
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * 檢查是否為有效的 Prompt 類型
 */
export function isPromptType(value: string): boolean {
  return Object.keys(PROMPT_TYPES).includes(value);
}

/**
 * 檢查是否為有效的 Prompt 範圍
 */
export function isPromptScope(value: string): boolean {
  return Object.keys(PROMPT_SCOPES).includes(value);
}

/**
 * 檢查是否為有效的合併策略
 */
export function isMergeStrategy(value: string): boolean {
  return Object.keys(MERGE_STRATEGIES).includes(value);
}

/**
 * 檢查是否為有效的變數類型
 */
export function isVariableType(value: string): value is VariableType {
  return Object.keys(VARIABLE_TYPES).includes(value);
}

// ============================================================================
// Prisma Type Helpers
// ============================================================================

/**
 * PromptConfig 建立輸入類型
 */
export type PromptConfigCreateInput = Prisma.PromptConfigCreateInput;

/**
 * PromptConfig 更新輸入類型
 */
export type PromptConfigUpdateInput = Prisma.PromptConfigUpdateInput;

/**
 * PromptConfig 查詢條件類型
 */
export type PromptConfigWhereInput = Prisma.PromptConfigWhereInput;

/**
 * PromptConfig 包含關聯類型
 */
export type PromptConfigInclude = Prisma.PromptConfigInclude;
