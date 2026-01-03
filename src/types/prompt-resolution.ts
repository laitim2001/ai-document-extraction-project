/**
 * @fileoverview Prompt 解析相關類型定義
 * @description
 *   定義 Prompt 解析服務的所有類型、介面。
 *   支援三層配置解析：Format > Company > Global 優先級
 *   支援三種變數類型：靜態、動態、上下文
 *
 * @module src/types/prompt-resolution
 * @since Epic 14 - Story 14.3
 * @lastModified 2026-01-03
 *
 * @features
 *   - 解析請求/響應類型
 *   - 變數替換類型
 *   - 合併上下文類型
 *   - 變數提供者介面
 *
 * @dependencies
 *   - @prisma/client - Prisma 生成的 enum
 *
 * @related
 *   - src/types/prompt-config.ts - Prompt 配置類型
 *   - src/services/prompt-resolver.service.ts - 解析服務
 */

import { PromptType, PromptScope, MergeStrategy } from '@prisma/client';

// ============================================================================
// Enums
// ============================================================================

/**
 * 解析變數類型
 * @description 區分變數值的來源
 */
export enum ResolutionVariableType {
  /** 靜態變數 - 配置時定義，直接使用 */
  STATIC = 'STATIC',
  /** 動態變數 - 運行時計算（如 knownTerms, companyName） */
  DYNAMIC = 'DYNAMIC',
  /** 上下文變數 - 來自處理流程傳入 */
  CONTEXT = 'CONTEXT',
}

// ============================================================================
// Request Types
// ============================================================================

/**
 * Prompt 解析請求
 * @description 請求解析特定類型的 Prompt 配置
 */
export interface PromptResolutionRequest {
  /** Prompt 類型（必填） */
  promptType: PromptType;
  /** 公司 ID（可選，用於查找 COMPANY 層配置） */
  companyId?: string | null;
  /** 文件格式 ID（可選，用於查找 FORMAT 層配置） */
  documentFormatId?: string | null;
  /** 上下文變數（可選，用於替換 {{variable}}） */
  contextVariables?: Record<string, unknown>;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * 解析後的 Prompt 結果
 * @description 包含最終合併的 Prompt 和解析元資料
 */
export interface ResolvedPromptResult {
  /** 最終的 System Prompt（已合併、已替換變數） */
  systemPrompt: string;
  /** 最終的 User Prompt Template（已合併、已替換變數） */
  userPromptTemplate: string;
  /** 應用的配置層級列表 */
  appliedLayers: AppliedLayer[];
  /** 替換的變數列表 */
  replacedVariables: ReplacedVariable[];
  /** 解析元資料 */
  metadata: ResolutionMetadata;
}

/**
 * 應用的配置層級
 * @description 記錄哪些配置參與了合併
 */
export interface AppliedLayer {
  /** 層級範圍（GLOBAL / COMPANY / FORMAT） */
  scope: PromptScope;
  /** 配置 ID */
  configId: string;
  /** 配置名稱 */
  configName: string;
  /** 該層使用的合併策略 */
  mergeStrategy: MergeStrategy;
}

/**
 * 已替換的變數
 * @description 記錄變數替換的詳細資訊
 */
export interface ReplacedVariable {
  /** 變數名稱 */
  name: string;
  /** 變數類型（來源） */
  type: ResolutionVariableType;
  /** 原始佔位符（如 {{companyName}}） */
  placeholder: string;
  /** 替換後的值 */
  value: string;
}

/**
 * 解析元資料
 * @description 解析過程的統計資訊
 */
export interface ResolutionMetadata {
  /** 解析時間（毫秒） */
  resolutionTimeMs: number;
  /** 是否從快取獲取 */
  cached: boolean;
  /** 快取鍵（如果有） */
  cacheKey?: string;
  /** 查詢的配置數量 */
  queriedConfigs: number;
  /** 合併的配置數量 */
  mergedConfigs: number;
}

// ============================================================================
// Variable Engine Types
// ============================================================================

/**
 * 變數上下文
 * @description 傳遞給變數提供者的上下文資訊
 */
export interface VariableContext {
  /** 公司 ID */
  companyId?: string | null;
  /** 文件格式 ID */
  documentFormatId?: string | null;
  /** 文件 ID（處理中的文件） */
  documentId?: string;
  /** 自定義上下文變數 */
  customContext?: Record<string, unknown>;
}

/**
 * 變數提供者介面
 * @description 實現此介面以提供動態變數值
 */
export interface VariableProvider {
  /**
   * 提供變數值
   * @param variableName - 變數名稱
   * @param context - 變數上下文
   * @returns 變數值，null 表示無法提供
   */
  provide(
    variableName: string,
    context: VariableContext
  ): Promise<string | null>;

  /** 支援的變數名稱列表 */
  supportedVariables: string[];
}

/**
 * 變數替換結果
 * @description 變數引擎的返回類型
 */
export interface VariableReplacementResult {
  /** 替換後的 Prompt */
  prompt: {
    systemPrompt: string;
    userPromptTemplate: string;
  };
  /** 替換的變數列表 */
  replacedVariables: ReplacedVariable[];
}

// ============================================================================
// Merge Engine Types
// ============================================================================

/**
 * 合併上下文
 * @description 合併引擎的輸入參數
 */
export interface MergeContext {
  /** 基礎 Prompt（較低層級，如 GLOBAL） */
  basePrompt: string;
  /** 覆蓋 Prompt（較高層級，如 COMPANY/FORMAT） */
  overridePrompt: string;
  /** 合併策略 */
  strategy: MergeStrategy;
  /** 分隔符（用於 APPEND/PREPEND，預設為 \n\n---\n\n） */
  separator?: string;
}

// ============================================================================
// Cache Types
// ============================================================================

/**
 * Prompt 快取條目
 * @description 快取中存儲的資料結構
 * @note 命名為 PromptCacheEntry 以避免與 dashboard.ts 中的 CacheEntry 衝突
 */
export interface PromptCacheEntry<T> {
  /** 快取資料 */
  data: T;
  /** 過期時間戳 */
  expiresAt: number;
}

/**
 * 快取統計
 * @description 快取狀態統計資訊
 */
export interface CacheStats {
  /** 快取條目數量 */
  size: number;
  /** 快取鍵列表 */
  keys: string[];
}

// ============================================================================
// Service Types
// ============================================================================

/**
 * 中間 Prompt 結構
 * @description 用於服務內部傳遞
 */
export interface IntermediatePrompt {
  systemPrompt: string;
  userPromptTemplate: string;
}

/**
 * 解析選項
 * @description 解析服務的可選配置
 */
export interface ResolutionOptions {
  /** 是否跳過快取 */
  skipCache?: boolean;
  /** 是否包含元資料 */
  includeMetadata?: boolean;
  /** 自定義 TTL（毫秒） */
  cacheTtl?: number;
}

// ============================================================================
// API Types
// ============================================================================

/**
 * Prompt 解析 API 請求 Body
 */
export interface ResolvePromptApiRequest {
  promptType: string;
  companyId?: string;
  documentFormatId?: string;
  contextVariables?: Record<string, unknown>;
}

/**
 * Prompt 解析 API 響應
 */
export interface ResolvePromptApiResponse {
  success: boolean;
  data: ResolvedPromptResult;
}

// ============================================================================
// Re-exports for convenience
// ============================================================================

export { PromptType, PromptScope, MergeStrategy };
