/**
 * @fileoverview Extraction V3 類型定義 - 純 GPT-5.2 Vision 架構
 * @description
 *   定義 Extraction V3 統一提取服務的所有類型：
 *   - 7 步處理管線類型（FILE_PREPARATION → ROUTING_DECISION）
 *   - 統一 GPT 提取結果類型
 *   - 動態 Prompt 組裝配置
 *   - 簡化版 5 維度信心度計算
 *   - Feature Flags 和配置類型
 *
 * @module src/types/extraction-v3.types
 * @since CHANGE-021 - Unified Processor V3 Refactoring
 * @lastModified 2026-01-30
 *
 * @features
 *   - ProcessingStepV3: 7 步處理管線枚舉
 *   - UnifiedExtractionResult: GPT Vision 統一提取結果
 *   - DynamicPromptConfig: 動態 Prompt 組裝配置
 *   - SimplifiedConfidenceWeights: 5 維度信心度權重
 *   - ExtractionV3Flags: V3 Feature Flags
 *
 * @related
 *   - src/services/extraction-v3/ - V3 提取服務
 *   - src/constants/processing-steps-v3.ts - V3 步驟常數
 *   - src/types/unified-processor.ts - V2 類型（向下兼容）
 */

import type { ConfidenceLevelEnum } from './confidence';
import { RoutingDecision } from './confidence';
import { UnifiedRoutingDecision, UnifiedFileType } from './unified-processor';

// Re-export for convenience
export { UnifiedFileType, UnifiedRoutingDecision, RoutingDecision };
export type { ConfidenceLevelEnum };

// ============================================================================
// V3 Processing Step Enum (7 步處理管線)
// ============================================================================

/**
 * V3 處理步驟枚舉
 * @description 定義 V3 統一處理器的 7 個處理步驟（從 V2 的 11 步簡化）
 * @since CHANGE-021
 */
export enum ProcessingStepV3 {
  /** 步驟 1: 文件準備（類型檢測 + PDF 轉換 + Base64 編碼） */
  FILE_PREPARATION = 'FILE_PREPARATION',
  /** 步驟 2: 動態 Prompt 組裝（公司識別規則 + 格式識別規則 + 欄位定義 + 術語映射） */
  DYNAMIC_PROMPT_ASSEMBLY = 'DYNAMIC_PROMPT_ASSEMBLY',
  /** 步驟 3: 統一 GPT 提取（單次 GPT-5.2 Vision 調用完成所有提取） */
  UNIFIED_GPT_EXTRACTION = 'UNIFIED_GPT_EXTRACTION',
  /** 步驟 4: 結果驗證（JSON Schema 驗證 + 公司/格式 ID 解析） */
  RESULT_VALIDATION = 'RESULT_VALIDATION',
  /** 步驟 5: 術語記錄（記錄新發現的術語） */
  TERM_RECORDING = 'TERM_RECORDING',
  /** 步驟 6: 信心度計算（簡化版 5 維度） */
  CONFIDENCE_CALCULATION = 'CONFIDENCE_CALCULATION',
  /** 步驟 7: 路由決策（AUTO_APPROVE / QUICK_REVIEW / FULL_REVIEW） */
  ROUTING_DECISION = 'ROUTING_DECISION',
}

/**
 * V3 步驟優先級
 * @description 區分必要步驟和可選步驟的錯誤處理行為
 * @since CHANGE-021
 */
export enum StepPriorityV3 {
  /** 必要步驟 - 失敗則中斷整個處理流程 */
  REQUIRED = 'REQUIRED',
  /** 可選步驟 - 失敗則記錄警告並繼續 */
  OPTIONAL = 'OPTIONAL',
}

// ============================================================================
// Field Value Types
// ============================================================================

/**
 * 欄位值結構
 * @description 單一欄位的提取結果
 * @since CHANGE-021
 */
export interface FieldValue {
  /** 欄位值（可為字串、數字或 null） */
  value: string | number | null;
  /** 信心度 (0-100) */
  confidence: number;
  /** 在文件中的位置描述（可選） */
  source?: string;
}

/**
 * 欄位定義
 * @description 用於 Prompt 組裝的欄位規範
 * @since CHANGE-021
 */
export interface FieldDefinition {
  /** 欄位鍵名 */
  key: string;
  /** 顯示名稱 */
  displayName: string;
  /** 資料類型 */
  type: 'string' | 'number' | 'date' | 'currency';
  /** 是否必填 */
  required: boolean;
  /** 驗證規則（可選） */
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
  };
  /** 提取提示（提供給 GPT） */
  extractionHints?: string[];
}

// ============================================================================
// Unified Extraction Result Types
// ============================================================================

/**
 * 發行方識別結果
 * @description GPT Vision 識別的發行方信息
 * @since CHANGE-021
 */
export interface IssuerIdentificationResultV3 {
  /** 公司名稱 */
  companyName: string;
  /** 公司 ID（如果匹配到已知公司） */
  companyId?: string;
  /** 識別方法 */
  identificationMethod: 'LOGO' | 'HEADER' | 'ADDRESS' | 'TAX_ID' | 'UNKNOWN';
  /** 信心度 (0-100) */
  confidence: number;
  /** 是否為新公司 */
  isNewCompany: boolean;
}

/**
 * 格式識別結果
 * @description GPT Vision 識別的文件格式信息
 * @since CHANGE-021
 */
export interface FormatIdentificationResultV3 {
  /** 格式名稱 */
  formatName: string;
  /** 格式 ID（如果匹配到已知格式） */
  formatId?: string;
  /** 信心度 (0-100) */
  confidence: number;
  /** 是否為新格式 */
  isNewFormat: boolean;
}

/**
 * 標準欄位集合（8 個核心欄位）
 * @since CHANGE-021
 */
export interface StandardFieldsV3 {
  /** 發票編號 */
  invoiceNumber: FieldValue;
  /** 發票日期 */
  invoiceDate: FieldValue;
  /** 到期日（可選） */
  dueDate?: FieldValue;
  /** 供應商名稱 */
  vendorName: FieldValue;
  /** 客戶名稱（可選） */
  customerName?: FieldValue;
  /** 總金額 */
  totalAmount: FieldValue;
  /** 小計（可選） */
  subtotal?: FieldValue;
  /** 幣別 */
  currency: FieldValue;
}

/**
 * 行項目
 * @description 含術語預分類的行項目
 * @since CHANGE-021
 */
export interface LineItemV3 {
  /** 描述 */
  description: string;
  /** 術語分類結果（已分類的標準術語） */
  classifiedAs?: string;
  /** 數量（可選） */
  quantity?: number;
  /** 單價（可選） */
  unitPrice?: number;
  /** 金額 */
  amount: number;
  /** 信心度 (0-100) */
  confidence: number;
  /** 是否需要人工分類 */
  needsClassification?: boolean;
}

/**
 * 額外費用項目
 * @description 含術語預分類的額外費用
 * @since CHANGE-021
 */
export interface ExtraChargeV3 {
  /** 描述 */
  description: string;
  /** 術語分類結果 */
  classifiedAs?: string;
  /** 金額 */
  amount: number;
  /** 幣別（可選） */
  currency?: string;
  /** 信心度 (0-100) */
  confidence: number;
  /** 是否需要人工分類 */
  needsClassification?: boolean;
}

/**
 * 處理元數據
 * @since CHANGE-021
 */
export interface ExtractionMetadataV3 {
  /** 使用的模型 */
  modelUsed: string;
  /** 處理時間（毫秒） */
  processingTimeMs: number;
  /** Token 消耗 */
  tokensUsed: {
    input: number;
    output: number;
    total: number;
  };
  /** 頁數 */
  pageCount: number;
  /** 警告訊息（可選） */
  warnings?: string[];
}

/**
 * GPT-5.2 Vision 統一提取結果
 * @description 單次 GPT 調用的完整輸出結構
 * @since CHANGE-021
 */
export interface UnifiedExtractionResult {
  /** 發行方識別結果 */
  issuerIdentification: IssuerIdentificationResultV3;
  /** 格式識別結果 */
  formatIdentification: FormatIdentificationResultV3;
  /** 標準欄位 (8 個核心欄位) */
  standardFields: StandardFieldsV3;
  /** 自定義欄位（公司/格式特定） */
  customFields?: Record<string, FieldValue>;
  /** 行項目（含術語預分類） */
  lineItems: LineItemV3[];
  /** 額外費用（含術語預分類） */
  extraCharges?: ExtraChargeV3[];
  /** 整體信心度（GPT 自評，0-100） */
  overallConfidence: number;
  /** 處理元數據 */
  metadata: ExtractionMetadataV3;
}

// ============================================================================
// Validated Extraction Result
// ============================================================================

/**
 * 驗證結果詳情
 * @since CHANGE-021
 */
export interface ValidationResultV3 {
  /** 是否有效 */
  isValid: boolean;
  /** 錯誤列表 */
  errors: string[];
  /** 警告列表 */
  warnings: string[];
  /** 缺失的必填欄位 */
  missingRequiredFields: string[];
}

/**
 * JIT 創建標記
 * @since CHANGE-021
 */
export interface JitCreatedV3 {
  /** 是否 JIT 創建了公司 */
  company?: boolean;
  /** 是否 JIT 創建了格式 */
  format?: boolean;
}

/**
 * 驗證後的提取結果
 * @description 經過 RESULT_VALIDATION 步驟後的完整結果
 * @since CHANGE-021
 */
export interface ValidatedExtractionResult extends UnifiedExtractionResult {
  /** 解析後的公司 ID（資料庫 Company ID） */
  resolvedCompanyId: string;
  /** 解析後的格式 ID（資料庫 DocumentFormat ID，可選） */
  resolvedFormatId?: string;
  /** 驗證結果 */
  validation: ValidationResultV3;
  /** JIT 創建標記 */
  jitCreated?: JitCreatedV3;
}

// ============================================================================
// Dynamic Prompt Config Types
// ============================================================================

/**
 * 已知公司信息（用於 Prompt 組裝）
 * @since CHANGE-021
 */
export interface KnownCompanyForPrompt {
  /** 公司 ID */
  id: string;
  /** 公司名稱 */
  name: string;
  /** 別名列表 */
  aliases: string[];
  /** 識別特徵（Logo 特徵、信頭關鍵字等） */
  identifiers: string[];
}

/**
 * 公司識別規則配置
 * @since CHANGE-021
 */
export interface IssuerIdentificationRulesConfig {
  /** 已知公司列表 */
  knownCompanies: KnownCompanyForPrompt[];
  /** 識別方法優先級 */
  identificationMethods: ('LOGO' | 'HEADER' | 'ADDRESS' | 'TAX_ID')[];
}

/**
 * 格式模式定義（用於 Prompt 組裝）
 * @since CHANGE-021
 */
export interface FormatPatternForPrompt {
  /** 格式 ID */
  formatId: string;
  /** 格式名稱 */
  formatName: string;
  /** 模式特徵 */
  patterns: string[];
  /** 關鍵字 */
  keywords: string[];
}

/**
 * 格式識別規則配置
 * @since CHANGE-021
 */
export interface FormatIdentificationRulesConfig {
  /** 格式模式列表 */
  formatPatterns: FormatPatternForPrompt[];
}

/**
 * 欄位提取規則配置
 * @since CHANGE-021
 */
export interface FieldExtractionRulesConfig {
  /** 標準欄位定義（8 個核心欄位） */
  standardFields: FieldDefinition[];
  /** 自定義欄位定義（公司/格式特定） */
  customFields: FieldDefinition[];
  /** 額外費用配置 */
  extraChargesConfig: {
    enabled: boolean;
    categories: string[];
  };
}

/**
 * 術語分類規則配置
 * @since CHANGE-021
 */
export interface TermClassificationRulesConfig {
  /** Tier 1: 通用映射 */
  universalMappings: Record<string, string>;
  /** Tier 2: 公司特定映射 */
  companyMappings: Record<string, string>;
  /** 回退行為 */
  fallbackBehavior: 'MARK_UNCLASSIFIED' | 'USE_ORIGINAL';
}

/**
 * 動態 Prompt 組裝配置
 * @description 從資料庫讀取並組裝為 GPT Prompt 的完整配置
 * @since CHANGE-021
 */
export interface DynamicPromptConfig {
  /** Section 1: 公司識別規則 */
  issuerIdentificationRules: IssuerIdentificationRulesConfig;
  /** Section 2: 格式識別規則 */
  formatIdentificationRules: FormatIdentificationRulesConfig;
  /** Section 3: 欄位提取規則 */
  fieldExtractionRules: FieldExtractionRulesConfig;
  /** Section 4: 術語分類規則 */
  termClassificationRules: TermClassificationRulesConfig;
  /** Section 5: 輸出 JSON Schema（運行時生成） */
  outputSchema?: Record<string, unknown>;
}

/**
 * 組裝後的 Prompt
 * @since CHANGE-021
 */
export interface AssembledPrompt {
  /** System Prompt */
  systemPrompt: string;
  /** User Prompt */
  userPrompt: string;
  /** 輸出 JSON Schema */
  outputSchema: Record<string, unknown>;
  /** 元數據 */
  metadata: {
    companiesCount: number;
    formatsCount: number;
    universalMappingsCount: number;
    companyMappingsCount: number;
    estimatedTokens: number;
  };
}

// ============================================================================
// Simplified Confidence Types (5 維度)
// ============================================================================

/**
 * V3 信心度計算維度（簡化為 5 維度）
 * @description 從 V2 的 7 維度簡化，移除 CONFIG_MATCH 和 TERM_MATCHING
 * @since CHANGE-021
 */
export enum ConfidenceDimensionV3 {
  /** GPT 整體提取信心度 (30%) */
  EXTRACTION = 'EXTRACTION',
  /** 發行商識別準確度 (20%) */
  ISSUER_IDENTIFICATION = 'ISSUER_IDENTIFICATION',
  /** 文件格式匹配程度 (15%) */
  FORMAT_MATCHING = 'FORMAT_MATCHING',
  /** 欄位完整性 (20%) */
  FIELD_COMPLETENESS = 'FIELD_COMPLETENESS',
  /** 歷史準確率 (15%) */
  HISTORICAL_ACCURACY = 'HISTORICAL_ACCURACY',
}

/**
 * V3 信心度權重配置
 * @since CHANGE-021
 */
export type ConfidenceWeightsV3 = Record<ConfidenceDimensionV3, number>;

/**
 * 預設 V3 信心度權重
 * @since CHANGE-021
 */
export const DEFAULT_CONFIDENCE_WEIGHTS_V3: ConfidenceWeightsV3 = {
  [ConfidenceDimensionV3.EXTRACTION]: 0.30,
  [ConfidenceDimensionV3.ISSUER_IDENTIFICATION]: 0.20,
  [ConfidenceDimensionV3.FORMAT_MATCHING]: 0.15,
  [ConfidenceDimensionV3.FIELD_COMPLETENESS]: 0.20,
  [ConfidenceDimensionV3.HISTORICAL_ACCURACY]: 0.15,
};

/**
 * V3 信心度計算輸入
 * @since CHANGE-021
 */
export interface SimplifiedConfidenceInput {
  /** GPT 回報的整體信心度 (0-100) */
  extractionConfidence: number;
  /** 發行方識別信心度 (0-100) */
  issuerConfidence: number;
  /** 格式識別信心度 (0-100) */
  formatConfidence: number;
  /** 欄位完整性數據 */
  fieldCompleteness: {
    requiredFieldsCount: number;
    filledRequiredFieldsCount: number;
  };
  /** 歷史準確率（可選，默認 80） */
  historicalAccuracy?: number;
}

/**
 * V3 維度分數詳情
 * @since CHANGE-021
 */
export interface DimensionScoreV3 {
  /** 維度類型 */
  dimension: ConfidenceDimensionV3;
  /** 原始分數 (0-100) */
  rawScore: number;
  /** 加權後分數 */
  weightedScore: number;
  /** 權重 */
  weight: number;
}

/**
 * V3 信心度計算結果
 * @since CHANGE-021
 */
export interface ConfidenceResultV3 {
  /** 總信心度分數 (0-100) */
  overallScore: number;
  /** 信心度等級 */
  level: ConfidenceLevelEnum;
  /** 各維度分數詳情 */
  dimensions: DimensionScoreV3[];
  /** 計算時間戳 */
  calculatedAt: Date;
}

// ============================================================================
// Routing Decision Types
// ============================================================================

/**
 * V3 路由決策詳情
 * @description 包含決策類型、分數和原因的完整路由決策資訊
 * @since CHANGE-021
 */
export interface RoutingDecisionDetailV3 {
  /** 決策類型 */
  decision: 'AUTO_APPROVE' | 'QUICK_REVIEW' | 'FULL_REVIEW';
  /** 信心度分數 (0-100) */
  score: number;
  /** 決策閾值 */
  threshold: number;
  /** 決策原因列表 */
  reasons: string[];
}

// ============================================================================
// Processing Input/Output Types
// ============================================================================

/**
 * V3 處理輸入
 * @description 調用 ExtractionV3Service.processFile() 的輸入參數
 * @since CHANGE-021
 */
export interface ExtractionV3Input {
  /** 文件 ID */
  fileId: string;
  /** 文件 Buffer */
  fileBuffer: Buffer;
  /** 文件名稱 */
  fileName: string;
  /** MIME 類型 */
  mimeType: string;
  /** 城市代碼 */
  cityCode: string;
  /** 選項 */
  options?: {
    /** 自動創建公司（默認 true） */
    autoCreateCompany?: boolean;
    /** 自動創建格式（默認 true） */
    autoCreateFormat?: boolean;
    /** 已知公司 ID（跳過識別） */
    existingCompanyId?: string;
    /** 已知格式 ID（跳過識別） */
    existingFormatId?: string;
  };
}

/**
 * V3 步驟執行結果
 * @since CHANGE-021
 */
export interface StepResultV3<T = unknown> {
  /** 步驟類型 */
  step: ProcessingStepV3;
  /** 是否成功 */
  success: boolean;
  /** 步驟產出資料 */
  data?: T;
  /** 錯誤訊息（如失敗） */
  error?: string;
  /** 執行時間（毫秒） */
  durationMs: number;
  /** 是否被跳過 */
  skipped?: boolean;
}

/**
 * V3 處理輸出
 * @description ExtractionV3Service.processFile() 的返回結果
 * @since CHANGE-021
 */
export interface ExtractionV3Output {
  /** 是否成功 */
  success: boolean;
  /** 提取結果（成功時填充） */
  result?: ValidatedExtractionResult;
  /** 信心度結果 */
  confidenceResult?: ConfidenceResultV3;
  /** 路由決策詳情 */
  routingDecision?: RoutingDecisionDetailV3;
  /** 錯誤訊息（失敗時填充） */
  error?: string;
  /** 時間統計 */
  timing: {
    totalMs: number;
    stepTimings: Partial<Record<ProcessingStepV3, number>>;
  };
  /** 步驟結果列表 */
  stepResults: StepResultV3[];
  /** 警告列表 */
  warnings: string[];
}

// ============================================================================
// Processing Context Types
// ============================================================================

/**
 * V3 處理上下文
 * @description 整個 V3 處理流程共享的上下文
 * @since CHANGE-021
 */
export interface ProcessingContextV3 {
  /** 輸入資料 */
  input: ExtractionV3Input;
  /** 處理狀態 */
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  /** 當前步驟 */
  currentStep: ProcessingStepV3;
  /** 開始時間（毫秒時間戳） */
  startTime: number;

  // ========== Step 1: FILE_PREPARATION 結果 ==========
  /** 文件類型 */
  fileType?: UnifiedFileType;
  /** Base64 圖片陣列 */
  imageBase64Array?: string[];
  /** 頁數 */
  pageCount?: number;

  // ========== Step 2: DYNAMIC_PROMPT_ASSEMBLY 結果 ==========
  /** 組裝後的 Prompt */
  assembledPrompt?: AssembledPrompt;
  /** 動態配置（用於後續步驟） */
  promptConfig?: DynamicPromptConfig;

  // ========== Step 3: UNIFIED_GPT_EXTRACTION 結果 ==========
  /** GPT 原始提取結果 */
  extractionResult?: UnifiedExtractionResult;

  // ========== Step 4: RESULT_VALIDATION 結果 ==========
  /** 驗證後的提取結果 */
  validatedResult?: ValidatedExtractionResult;
  /** 解析後的公司 ID */
  companyId?: string;
  /** 公司名稱 */
  companyName?: string;
  /** 是否為新公司 */
  isNewCompany?: boolean;
  /** 解析後的格式 ID */
  documentFormatId?: string;
  /** 格式名稱 */
  documentFormatName?: string;
  /** 是否為新格式 */
  isNewFormat?: boolean;

  // ========== Step 5: TERM_RECORDING 結果 ==========
  /** 術語記錄統計 */
  termRecordingStats?: {
    totalDetected: number;
    newTermsCount: number;
    matchedTermsCount: number;
  };

  // ========== Step 6: CONFIDENCE_CALCULATION 結果 ==========
  /** 信心度結果 */
  confidenceResult?: ConfidenceResultV3;
  /** 整體信心度 (0-1) */
  overallConfidence?: number;

  // ========== Step 7: ROUTING_DECISION 結果 ==========
  /** 路由決策詳情 */
  routingDecision?: RoutingDecisionDetailV3;

  // ========== 元資料 ==========
  /** 步驟結果列表 */
  stepResults: StepResultV3[];
  /** 警告列表 */
  warnings: string[];
}

// ============================================================================
// Feature Flags Types
// ============================================================================

/**
 * V3 Feature Flags
 * @description 控制 V3 提取服務的功能開關
 * @since CHANGE-021
 */
export interface ExtractionV3Flags {
  /** 使用 V3 架構（主開關） */
  useExtractionV3: boolean;
  /** V3 灰度發布百分比 (0-100) */
  extractionV3Percentage: number;
  /** 錯誤時回退到 V2 */
  fallbackToV2OnError: boolean;
  /** GPT 失敗時使用 Azure DI 備選 */
  enableAzureDIFallback: boolean;

  // 調試選項
  /** 記錄組裝的 Prompt */
  logPromptAssembly: boolean;
  /** 記錄 GPT 原始響應 */
  logGptResponse: boolean;
}

/**
 * 預設 V3 Feature Flags
 * @since CHANGE-021
 */
export const DEFAULT_EXTRACTION_V3_FLAGS: ExtractionV3Flags = {
  useExtractionV3: false, // 初始關閉
  extractionV3Percentage: 0, // 0% 流量
  fallbackToV2OnError: true, // 啟用回退
  enableAzureDIFallback: true, // 啟用 Azure DI 備選
  logPromptAssembly: false,
  logGptResponse: false,
};

// ============================================================================
// Step Configuration Types
// ============================================================================

/**
 * V3 步驟配置
 * @since CHANGE-021
 */
export interface StepConfigV3 {
  /** 步驟類型 */
  step: ProcessingStepV3;
  /** 步驟優先級 */
  priority: StepPriorityV3;
  /** 超時時間（毫秒） */
  timeout: number;
  /** 重試次數 */
  retryCount: number;
  /** 是否啟用 */
  enabled: boolean;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * 檢查是否為有效的 V3 處理步驟
 */
export function isProcessingStepV3(value: unknown): value is ProcessingStepV3 {
  return (
    typeof value === 'string' &&
    Object.values(ProcessingStepV3).includes(value as ProcessingStepV3)
  );
}

/**
 * 檢查是否為有效的 V3 維度
 */
export function isConfidenceDimensionV3(
  value: unknown
): value is ConfidenceDimensionV3 {
  return (
    typeof value === 'string' &&
    Object.values(ConfidenceDimensionV3).includes(value as ConfidenceDimensionV3)
  );
}

/**
 * 檢查是否為有效的統一提取結果
 */
export function isUnifiedExtractionResult(
  value: unknown
): value is UnifiedExtractionResult {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    'issuerIdentification' in obj &&
    'formatIdentification' in obj &&
    'standardFields' in obj &&
    'lineItems' in obj &&
    'overallConfidence' in obj &&
    'metadata' in obj
  );
}
