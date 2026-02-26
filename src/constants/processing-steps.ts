/**
 * @fileoverview 統一處理流程步驟配置常數
 * @description
 *   定義 UnifiedDocumentProcessor 的 11 步處理管道配置：
 *   - 每個步驟的優先級（REQUIRED / OPTIONAL）
 *   - 超時設定和重試次數
 *   - 預設 Feature Flags 配置
 *
 *   CHANGE-005 調整（2026-01-05）：
 *   將 ISSUER_IDENTIFICATION 移至 AZURE_DI_EXTRACTION 之前，
 *   實現「先識別公司 → 再依配置動態提取」的流程。
 *
 * @module src/constants/processing-steps
 * @since Epic 15 - Story 15.1 (處理流程重構 - 統一入口)
 * @lastModified 2026-01-05
 *
 * @features
 *   - 11 步處理管道配置
 *   - 必要步驟 vs 可選步驟區分
 *   - 漸進式部署 Feature Flags
 *
 * @related
 *   - src/types/unified-processor.ts - 類型定義
 *   - src/services/unified-processor/unified-document-processor.service.ts - 主服務
 */

import {
  ProcessingStep,
  StepPriority,
  StepConfig,
  UnifiedProcessorFlags,
} from '@/types/unified-processor';

// ============================================================================
// 步驟配置常數
// ============================================================================

/**
 * 預設步驟配置
 * @description
 *   定義 11 步處理管道的預設配置：
 *   - REQUIRED 步驟：失敗時中斷整個流程
 *   - OPTIONAL 步驟：失敗時記錄警告並繼續
 */
export const DEFAULT_STEP_CONFIGS: StepConfig[] = [
  // Step 1: 文件類型檢測（必要）
  {
    step: ProcessingStep.FILE_TYPE_DETECTION,
    priority: StepPriority.REQUIRED,
    timeout: 5000,
    retryCount: 0,
    enabled: true,
  },
  // Step 2: 智能路由決策（必要）
  {
    step: ProcessingStep.SMART_ROUTING,
    priority: StepPriority.REQUIRED,
    timeout: 3000,
    retryCount: 0,
    enabled: true,
  },
  // Step 3: 發行者識別（可選）- CHANGE-005: 移至 Step 3
  // 使用 GPT Vision classifyDocument 進行輕量級分類
  {
    step: ProcessingStep.ISSUER_IDENTIFICATION,
    priority: StepPriority.OPTIONAL,
    timeout: 30000,
    retryCount: 1,
    enabled: true,
  },
  // Step 4: 格式匹配（可選）- CHANGE-005: 移至 Step 4
  {
    step: ProcessingStep.FORMAT_MATCHING,
    priority: StepPriority.OPTIONAL,
    timeout: 10000,
    retryCount: 1,
    enabled: true,
  },
  // Step 5: 配置獲取（可選）- CHANGE-005: 移至 Step 5
  // 獲取欄位映射和 Prompt 配置，含 QueryFields
  {
    step: ProcessingStep.CONFIG_FETCHING,
    priority: StepPriority.OPTIONAL,
    timeout: 5000,
    retryCount: 1,
    enabled: true,
  },
  // Step 6: Azure DI 提取（必要）- CHANGE-005: 移至 Step 6
  // 依據 Step 5 獲取的 QueryFields 配置進行動態欄位提取
  {
    step: ProcessingStep.AZURE_DI_EXTRACTION,
    priority: StepPriority.REQUIRED,
    timeout: 120000, // 2 分鐘
    retryCount: 2,
    enabled: true,
  },
  // Step 7: GPT 增強提取（可選）
  {
    step: ProcessingStep.GPT_ENHANCED_EXTRACTION,
    priority: StepPriority.OPTIONAL,
    timeout: 60000, // 1 分鐘
    retryCount: 1,
    enabled: true,
  },
  // Step 8: 欄位映射（可選）
  {
    step: ProcessingStep.FIELD_MAPPING,
    priority: StepPriority.OPTIONAL,
    timeout: 10000,
    retryCount: 0,
    enabled: true,
  },
  // Step 9: 術語記錄（可選）
  {
    step: ProcessingStep.TERM_RECORDING,
    priority: StepPriority.OPTIONAL,
    timeout: 5000,
    retryCount: 0,
    enabled: true,
  },
  // Step 10: 信心度計算（必要）
  {
    step: ProcessingStep.CONFIDENCE_CALCULATION,
    priority: StepPriority.REQUIRED,
    timeout: 3000,
    retryCount: 0,
    enabled: true,
  },
  // Step 11: 路由決策（必要）
  {
    step: ProcessingStep.ROUTING_DECISION,
    priority: StepPriority.REQUIRED,
    timeout: 2000,
    retryCount: 0,
    enabled: true,
  },
];

// ============================================================================
// Feature Flags 預設配置
// ============================================================================

/**
 * 預設處理器 Feature Flags
 * @description
 *   控制統一處理器的漸進式啟用：
 *   - Phase 1: enableUnifiedProcessor = false（使用 Legacy）
 *   - Phase 2: 逐步啟用各個 feature flags
 *   - Phase 3: enableUnifiedProcessor = true（完全啟用）
 */
export const DEFAULT_PROCESSOR_FLAGS: UnifiedProcessorFlags = {
  // 主開關：是否啟用統一處理器（可透過環境變數控制）
  enableUnifiedProcessor: process.env.ENABLE_UNIFIED_PROCESSOR === 'true',

  // Story 0.8: 發行者識別
  enableIssuerIdentification: true,

  // Story 0.9: 格式匹配
  enableFormatMatching: true,

  // Story 14.3: 動態配置
  enableDynamicConfig: true,

  // Story 0.7: 術語記錄
  enableTermRecording: true,

  // Story 15.x: 增強信心度計算
  enableEnhancedConfidence: true,

  // 自動創建公司（JIT Company Creation）
  autoCreateCompany: true,

  // 自動創建格式（JIT Format Creation）
  autoCreateFormat: true,
};

// ============================================================================
// 步驟顯示名稱
// ============================================================================

/**
 * 步驟顯示名稱（繁體中文）
 */
export const STEP_DISPLAY_NAMES: Record<ProcessingStep, string> = {
  [ProcessingStep.FILE_TYPE_DETECTION]: '文件類型檢測',
  [ProcessingStep.SMART_ROUTING]: '智能路由決策',
  [ProcessingStep.AZURE_DI_EXTRACTION]: 'Azure DI 提取',
  [ProcessingStep.ISSUER_IDENTIFICATION]: '發行者識別',
  [ProcessingStep.FORMAT_MATCHING]: '格式匹配',
  [ProcessingStep.CONFIG_FETCHING]: '配置獲取',
  [ProcessingStep.GPT_ENHANCED_EXTRACTION]: 'GPT 增強提取',
  [ProcessingStep.FIELD_MAPPING]: '欄位映射',
  [ProcessingStep.TERM_RECORDING]: '術語記錄',
  [ProcessingStep.CONFIDENCE_CALCULATION]: '信心度計算',
  [ProcessingStep.ROUTING_DECISION]: '路由決策',
};

/**
 * 步驟描述
 */
export const STEP_DESCRIPTIONS: Record<ProcessingStep, string> = {
  [ProcessingStep.FILE_TYPE_DETECTION]:
    '檢測文件類型（Native PDF / Scanned PDF / Image）',
  [ProcessingStep.SMART_ROUTING]: '根據文件類型決定處理方法',
  [ProcessingStep.AZURE_DI_EXTRACTION]:
    '使用 Azure Document Intelligence 提取結構化數據',
  [ProcessingStep.ISSUER_IDENTIFICATION]:
    '識別文件發行者（Header / Logo / OCR）',
  [ProcessingStep.FORMAT_MATCHING]: '匹配或創建文件格式',
  [ProcessingStep.CONFIG_FETCHING]: '獲取 Prompt 和欄位映射配置',
  [ProcessingStep.GPT_ENHANCED_EXTRACTION]:
    '使用 GPT Vision 增強提取效果',
  [ProcessingStep.FIELD_MAPPING]: '執行三層欄位映射',
  [ProcessingStep.TERM_RECORDING]: '記錄新發現的術語',
  [ProcessingStep.CONFIDENCE_CALCULATION]: '計算綜合信心度分數',
  [ProcessingStep.ROUTING_DECISION]: '決定審核路由',
};

// ============================================================================
// 步驟順序
// ============================================================================

/**
 * 處理步驟順序
 * @description 按照處理流程的正確順序排列
 *
 * CHANGE-005 調整：將 ISSUER_IDENTIFICATION 移至 AZURE_DI_EXTRACTION 之前
 * 新順序：
 *   1. FILE_TYPE_DETECTION - 文件類型檢測
 *   2. SMART_ROUTING - 智能路由決策
 *   3. ISSUER_IDENTIFICATION - 發行者識別（使用 GPT Vision classifyDocument）
 *   4. FORMAT_MATCHING - 格式匹配
 *   5. CONFIG_FETCHING - 配置獲取（含 QueryFields）
 *   6. AZURE_DI_EXTRACTION - Azure DI 提取（依據配置動態提取）
 *   7. GPT_ENHANCED_EXTRACTION - GPT 增強提取
 *   8. FIELD_MAPPING - 欄位映射
 *   9. TERM_RECORDING - 術語記錄
 *   10. CONFIDENCE_CALCULATION - 信心度計算
 *   11. ROUTING_DECISION - 路由決策
 */
export const PROCESSING_STEP_ORDER: ProcessingStep[] = [
  ProcessingStep.FILE_TYPE_DETECTION,      // Step 1
  ProcessingStep.SMART_ROUTING,            // Step 2
  ProcessingStep.ISSUER_IDENTIFICATION,    // Step 3 (moved from Step 4)
  ProcessingStep.FORMAT_MATCHING,          // Step 4 (moved from Step 5)
  ProcessingStep.CONFIG_FETCHING,          // Step 5 (moved from Step 6)
  ProcessingStep.AZURE_DI_EXTRACTION,      // Step 6 (moved from Step 3)
  ProcessingStep.GPT_ENHANCED_EXTRACTION,  // Step 7
  ProcessingStep.FIELD_MAPPING,            // Step 8
  ProcessingStep.TERM_RECORDING,           // Step 9
  ProcessingStep.CONFIDENCE_CALCULATION,   // Step 10
  ProcessingStep.ROUTING_DECISION,         // Step 11
];

// ============================================================================
// 輔助函數
// ============================================================================

/**
 * 取得指定步驟的配置
 * @param step - 處理步驟
 * @returns 步驟配置，如果找不到則返回 undefined
 */
export function getStepConfig(step: ProcessingStep): StepConfig | undefined {
  return DEFAULT_STEP_CONFIGS.find((config) => config.step === step);
}

/**
 * 檢查步驟是否為必要步驟
 * @param step - 處理步驟
 * @returns 是否為必要步驟
 */
export function isRequiredStep(step: ProcessingStep): boolean {
  const config = getStepConfig(step);
  return config?.priority === StepPriority.REQUIRED;
}

/**
 * 取得所有必要步驟
 * @returns 必要步驟列表
 */
export function getRequiredSteps(): ProcessingStep[] {
  return DEFAULT_STEP_CONFIGS
    .filter((config) => config.priority === StepPriority.REQUIRED)
    .map((config) => config.step);
}

/**
 * 取得所有可選步驟
 * @returns 可選步驟列表
 */
export function getOptionalSteps(): ProcessingStep[] {
  return DEFAULT_STEP_CONFIGS
    .filter((config) => config.priority === StepPriority.OPTIONAL)
    .map((config) => config.step);
}

/**
 * 取得步驟顯示名稱
 * @param step - 處理步驟
 * @returns 步驟顯示名稱
 */
export function getStepDisplayName(step: ProcessingStep): string {
  return STEP_DISPLAY_NAMES[step] ?? step;
}

/**
 * 取得步驟描述
 * @param step - 處理步驟
 * @returns 步驟描述
 */
export function getStepDescription(step: ProcessingStep): string {
  return STEP_DESCRIPTIONS[step] ?? '';
}
