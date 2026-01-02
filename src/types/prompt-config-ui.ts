/**
 * @fileoverview Prompt 配置 UI 類型定義
 * @description
 *   定義 Prompt 配置管理介面專用的 UI 類型。
 *   包含編輯器狀態、變數定義、預覽和測試相關類型。
 *
 * @module src/types/prompt-config-ui
 * @since Epic 14 - Story 14.2
 * @lastModified 2026-01-02
 *
 * @dependencies
 *   - ./prompt-config - 基礎 Prompt 配置類型
 */

import type { PromptConfigListItem } from './prompt-config';

// ============================================================================
// UI 狀態類型
// ============================================================================

/**
 * 按 PromptType 分組的配置
 */
export interface PromptConfigGrouped {
  [key: string]: PromptConfigListItem[];
}

/**
 * Prompt 編輯器狀態
 */
export interface PromptEditorState {
  systemPrompt: string;
  userPromptTemplate: string;
  variables: VariableValue[];
  isDirty: boolean;
  isValid: boolean;
  validationErrors: string[];
}

/**
 * 變數值
 */
export interface VariableValue {
  name: string;
  value: string;
  source: 'static' | 'dynamic' | 'context';
}

// ============================================================================
// 預覽相關
// ============================================================================

/**
 * Prompt 預覽結果
 */
export interface PromptPreviewResult {
  systemPrompt: string;
  userPrompt: string;
  resolvedVariables: Record<string, string>;
}

/**
 * Prompt 測試請求
 */
export interface PromptTestRequest {
  configId: string;
  testFile: File;
  overrideSystemPrompt?: string;
  overrideUserPromptTemplate?: string;
  customVariables?: Record<string, string>;
}

/**
 * Prompt 測試結果
 */
export interface PromptTestResult {
  success: boolean;
  extractedData?: Record<string, unknown>;
  rawResponse?: string;
  executionTimeMs: number;
  tokensUsed?: {
    prompt: number;
    completion: number;
  };
  error?: string;
}

// ============================================================================
// 變數相關
// ============================================================================

/**
 * 可用變數類別
 */
export type VariableCategory = 'static' | 'dynamic' | 'context';

/**
 * 可用變數定義
 */
export interface AvailableVariable {
  name: string;
  displayName: string;
  description: string;
  category: VariableCategory;
  example?: string;
}

/**
 * 系統預設變數
 */
export const SYSTEM_VARIABLES: AvailableVariable[] = [
  // 靜態變數
  {
    name: 'companyName',
    displayName: '公司名稱',
    description: '文件發行公司的名稱',
    category: 'static',
    example: 'DHL Express',
  },
  {
    name: 'documentFormatName',
    displayName: '文件格式名稱',
    description: '文件格式的名稱',
    category: 'static',
    example: 'DHL Express Invoice',
  },
  // 動態變數
  {
    name: 'knownTerms',
    displayName: '已知術語列表',
    description: '該公司/格式已識別的術語',
    category: 'dynamic',
    example: 'Fuel Surcharge, AWB Fee, Handling Fee',
  },
  {
    name: 'recentExtractions',
    displayName: '近期提取樣本',
    description: '最近處理的相似文件提取結果',
    category: 'dynamic',
  },
  {
    name: 'standardTerms',
    displayName: '標準術語列表',
    description: '系統定義的標準術語類別',
    category: 'dynamic',
    example: 'Freight, Surcharge, Handling, Documentation',
  },
  // 上下文變數
  {
    name: 'currentDate',
    displayName: '當前日期',
    description: '處理時的日期',
    category: 'context',
    example: '2026-01-02',
  },
  {
    name: 'pageCount',
    displayName: '頁數',
    description: '文件總頁數',
    category: 'context',
    example: '3',
  },
  {
    name: 'documentText',
    displayName: '文件內容',
    description: 'OCR 提取的文件文字內容',
    category: 'context',
  },
  {
    name: 'fileName',
    displayName: '檔案名稱',
    description: '上傳的檔案名稱',
    category: 'context',
    example: 'invoice_2026_001.pdf',
  },
];

// ============================================================================
// 篩選器類型
// ============================================================================

/**
 * Prompt 配置篩選器狀態
 */
export interface PromptConfigFiltersState {
  promptType?: string;
  scope?: string;
  companyId?: string;
  documentFormatId?: string;
  isActive?: boolean;
  search?: string;
}

// ============================================================================
// 表單類型
// ============================================================================

/**
 * Prompt 配置表單值
 */
export interface PromptConfigFormValues {
  promptType: string;
  scope: string;
  name: string;
  description: string;
  companyId: string;
  documentFormatId: string;
  systemPrompt: string;
  userPromptTemplate: string;
  mergeStrategy: string;
  isActive: boolean;
}

// ============================================================================
// 工具函數
// ============================================================================

/**
 * 按 promptType 分組配置
 */
export function groupConfigsByType(
  configs: PromptConfigListItem[]
): PromptConfigGrouped {
  const groups: PromptConfigGrouped = {};
  for (const config of configs) {
    if (!groups[config.promptType]) {
      groups[config.promptType] = [];
    }
    groups[config.promptType].push(config);
  }
  return groups;
}

/**
 * 取得變數類別的顯示標籤
 */
export function getVariableCategoryLabel(category: VariableCategory): string {
  const labels: Record<VariableCategory, string> = {
    static: '靜態變數',
    dynamic: '動態變數',
    context: '上下文變數',
  };
  return labels[category];
}

/**
 * 取得變數類別的描述
 */
export function getVariableCategoryDescription(category: VariableCategory): string {
  const descriptions: Record<VariableCategory, string> = {
    static: '配置時定義的固定值',
    dynamic: '運行時從資料庫計算',
    context: '處理流程中的上下文資訊',
  };
  return descriptions[category];
}

/**
 * 按類別分組變數
 */
export function groupVariablesByCategory(
  variables: AvailableVariable[]
): Record<VariableCategory, AvailableVariable[]> {
  const groups: Record<VariableCategory, AvailableVariable[]> = {
    static: [],
    dynamic: [],
    context: [],
  };
  for (const v of variables) {
    groups[v.category].push(v);
  }
  return groups;
}
