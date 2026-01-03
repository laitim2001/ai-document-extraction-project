/**
 * @fileoverview 動態配置類型定義
 * @description
 *   定義動態配置獲取相關的所有類型：
 *   - 配置來源和層級枚舉
 *   - 統一動態配置介面
 *   - 配置獲取請求和結果介面
 *   - 欄位映射和 Prompt 配置介面
 *
 * @module src/types/dynamic-config
 * @since Epic 15 - Story 15.3
 * @lastModified 2026-01-03
 *
 * @related
 *   - src/services/prompt-resolver.service.ts - Prompt 解析服務
 *   - src/services/mapping/field-mapping-engine.ts - 欄位映射引擎
 *   - src/services/unified-processor/adapters/config-fetcher-adapter.ts - 使用此類型
 *   - src/services/unified-processor/steps/config-fetching.step.ts - 使用此類型
 */

import type { PromptType, PromptScope, MergeStrategy } from '@prisma/client';

// ============================================================================
// 枚舉定義
// ============================================================================

/**
 * 配置來源
 * @description 標識配置從何處獲取
 */
export enum ConfigSource {
  /** 格式層級配置（最高優先級） */
  FORMAT = 'FORMAT',
  /** 公司層級配置 */
  COMPANY = 'COMPANY',
  /** 全域配置 */
  GLOBAL = 'GLOBAL',
  /** 預設配置（代碼內建） */
  DEFAULT = 'DEFAULT',
}

/**
 * 配置解析策略
 * @description 當多層配置存在時的合併策略
 */
export enum ConfigResolutionStrategy {
  /** 覆蓋 - 高優先級完全覆蓋低優先級 */
  OVERRIDE = 'OVERRIDE',
  /** 合併 - 逐層合併，高優先級優先 */
  MERGE = 'MERGE',
  /** 附加 - 低優先級內容附加到高優先級後 */
  APPEND = 'APPEND',
  /** 前置 - 低優先級內容前置到高優先級前 */
  PREPEND = 'PREPEND',
}

// ============================================================================
// 配置上下文介面
// ============================================================================

/**
 * 動態配置上下文
 * @description 用於獲取配置的上下文資訊
 */
export interface DynamicConfigContext {
  /** 公司 ID */
  companyId?: string | null;
  /** 文件格式 ID */
  documentFormatId?: string | null;
  /** 文件類型 */
  documentType?: string;
  /** 文件子類型 */
  documentSubtype?: string;
  /** 額外的上下文變數 */
  contextVariables?: Record<string, unknown>;
}

// ============================================================================
// 統一動態配置介面
// ============================================================================

/**
 * 統一動態配置
 * @description 包含所有動態配置的統一結構
 */
export interface UnifiedDynamicConfig {
  /** Prompt 配置（如果有） */
  promptConfig: ResolvedPromptConfig | null;
  /** 欄位映射配置（如果有） */
  fieldMappingConfig: ResolvedFieldMappingConfig | null;
  /** 配置解析元數據 */
  metadata: ConfigResolutionMetadata;
}

/**
 * 配置解析元數據
 */
export interface ConfigResolutionMetadata {
  /** 解析時間（毫秒） */
  resolutionTimeMs: number;
  /** 是否使用了快取 */
  cached: boolean;
  /** 快取命中類型 */
  cacheHitType?: 'full' | 'partial' | 'miss';
  /** 查詢的配置數量 */
  queriedConfigs: number;
  /** 應用的配置層級 */
  appliedLayers: AppliedConfigLayer[];
}

/**
 * 應用的配置層級
 */
export interface AppliedConfigLayer {
  /** 配置來源 */
  source: ConfigSource;
  /** 配置 ID */
  configId: string;
  /** 配置名稱 */
  configName: string;
  /** 合併策略 */
  mergeStrategy?: string;
}

// ============================================================================
// Prompt 配置介面
// ============================================================================

/**
 * 解析後的 Prompt 配置
 * @description 經過三層解析後的 Prompt 配置
 */
export interface ResolvedPromptConfig {
  /** 系統 Prompt */
  systemPrompt: string;
  /** 使用者 Prompt 模板 */
  userPromptTemplate: string;
  /** 應用的層級 */
  appliedLayers: PromptAppliedLayer[];
  /** 已替換的變數 */
  replacedVariables: ConfigReplacedVariable[];
  /** Prompt 類型 */
  promptType: PromptType;
}

/**
 * Prompt 應用層級
 */
export interface PromptAppliedLayer {
  /** 層級範圍 */
  scope: PromptScope;
  /** 配置 ID */
  configId: string;
  /** 配置名稱 */
  configName: string;
  /** 合併策略 */
  mergeStrategy: MergeStrategy;
}

/**
 * 配置替換變數
 * @description 用於動態配置的變數替換記錄
 * @note 與 prompt-resolution.ts 中的 ReplacedVariable 不同，此類型用於動態配置
 */
export interface ConfigReplacedVariable {
  /** 變數名稱 */
  name: string;
  /** 替換後的值 */
  value: string;
  /** 變數來源 */
  source: 'static' | 'dynamic' | 'context';
}

// ============================================================================
// 欄位映射配置介面
// ============================================================================

/**
 * 解析後的欄位映射配置
 * @description 經過三層解析後的欄位映射配置
 */
export interface ResolvedFieldMappingConfig {
  /** 配置 ID */
  configId: string;
  /** 配置名稱 */
  configName: string;
  /** 映射規則列表 */
  rules: FieldMappingRule[];
  /** 應用的來源 */
  source: ConfigSource;
  /** 有效規則數量 */
  effectiveRulesCount: number;
}

/**
 * 欄位映射規則
 */
export interface FieldMappingRule {
  /** 規則 ID */
  id: string;
  /** 來源欄位列表 */
  sourceFields: string[];
  /** 目標欄位 */
  targetField: string;
  /** 轉換類型 */
  transformType: FieldTransformType;
  /** 轉換參數 */
  transformParams?: Record<string, unknown>;
  /** 規則優先級 */
  priority: number;
  /** 是否啟用 */
  isActive: boolean;
}

/**
 * 欄位轉換類型
 */
export type FieldTransformType =
  | 'DIRECT'        // 直接映射
  | 'CONCATENATE'   // 串接多個欄位
  | 'SPLIT'         // 分割欄位
  | 'FORMAT'        // 格式化
  | 'CALCULATE'     // 計算
  | 'LOOKUP'        // 查表
  | 'CUSTOM';       // 自定義

// ============================================================================
// 配置獲取請求介面
// ============================================================================

/**
 * 配置獲取請求
 * @description 向配置獲取適配器發送的請求
 */
export interface ConfigFetchRequest {
  /** 配置上下文 */
  context: DynamicConfigContext;
  /** 獲取選項 */
  options?: ConfigFetchOptions;
}

/**
 * 配置獲取選項
 */
export interface ConfigFetchOptions {
  /** 是否啟用 Prompt 配置獲取 */
  fetchPromptConfig: boolean;
  /** 是否啟用欄位映射配置獲取 */
  fetchMappingConfig: boolean;
  /** Prompt 類型（用於 Prompt 配置） */
  promptType?: PromptType;
  /** 是否跳過快取 */
  skipCache: boolean;
  /** 快取 TTL（毫秒） */
  cacheTtlMs: number;
}

/**
 * 預設配置獲取選項
 */
export const DEFAULT_CONFIG_FETCH_OPTIONS: Required<ConfigFetchOptions> = {
  fetchPromptConfig: true,
  fetchMappingConfig: true,
  promptType: 'INVOICE_EXTRACTION' as PromptType,
  skipCache: false,
  cacheTtlMs: 5 * 60 * 1000, // 5 分鐘
};

// ============================================================================
// 配置獲取結果介面
// ============================================================================

/**
 * 配置獲取結果
 * @description 配置獲取適配器的輸出結果
 */
export interface ConfigFetchResult {
  /** 是否成功 */
  success: boolean;
  /** 統一動態配置 */
  config: UnifiedDynamicConfig | null;
  /** 處理時間（毫秒） */
  processingTimeMs: number;
  /** 錯誤訊息（如果失敗） */
  error?: string;
  /** 警告訊息列表 */
  warnings?: string[];
}

// ============================================================================
// 快取相關介面
// ============================================================================

/**
 * 配置快取條目
 */
export interface ConfigCacheEntry<T> {
  /** 快取的配置 */
  config: T;
  /** 建立時間戳 */
  createdAt: number;
  /** 過期時間戳 */
  expiresAt: number;
  /** 快取鍵 */
  cacheKey: string;
}

/**
 * 快取統計
 */
export interface ConfigCacheStats {
  /** 命中次數 */
  hits: number;
  /** 未命中次數 */
  misses: number;
  /** 當前條目數量 */
  entries: number;
  /** 平均命中率 */
  hitRate: number;
}

// ============================================================================
// 輔助函數
// ============================================================================

/**
 * 建構配置快取鍵
 * @param context - 配置上下文
 * @param configType - 配置類型
 * @returns 快取鍵
 */
export function buildConfigCacheKey(
  context: DynamicConfigContext,
  configType: 'prompt' | 'mapping'
): string {
  const parts = [
    configType,
    context.companyId ?? 'null',
    context.documentFormatId ?? 'null',
    context.documentType ?? 'null',
  ];
  return parts.join(':');
}

/**
 * 將配置來源轉換為優先級
 * @description 數字越大優先級越高
 */
export function getSourcePriority(source: ConfigSource): number {
  const priorityMap: Record<ConfigSource, number> = {
    [ConfigSource.DEFAULT]: 0,
    [ConfigSource.GLOBAL]: 1,
    [ConfigSource.COMPANY]: 2,
    [ConfigSource.FORMAT]: 3,
  };
  return priorityMap[source];
}

/**
 * 創建空的動態配置
 * @param processingTimeMs - 處理時間
 * @returns 空的統一動態配置
 */
export function createEmptyDynamicConfig(
  processingTimeMs: number
): UnifiedDynamicConfig {
  return {
    promptConfig: null,
    fieldMappingConfig: null,
    metadata: {
      resolutionTimeMs: processingTimeMs,
      cached: false,
      cacheHitType: 'miss',
      queriedConfigs: 0,
      appliedLayers: [],
    },
  };
}
