/**
 * @fileoverview 統一處理流程步驟配置常數
 * @description
 *   定義 UnifiedDocumentProcessor 的 11 步處理管道配置：
 *   - 每個步驟的優先級（REQUIRED / OPTIONAL）
 *   - 超時設定和重試次數
 *   - 預設 Feature Flags 配置
 *
 * @module src/constants/processing-steps
 * @since Epic 15 - Story 15.1 (處理流程重構 - 統一入口)
 * @lastModified 2026-01-03
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
  // Step 3: Azure DI 提取（必要）
  {
    step: ProcessingStep.AZURE_DI_EXTRACTION,
    priority: StepPriority.REQUIRED,
    timeout: 120000, // 2 分鐘
    retryCount: 2,
    enabled: true,
  },
  // Step 4: 發行者識別（可選）
  {
    step: ProcessingStep.ISSUER_IDENTIFICATION,
    priority: StepPriority.OPTIONAL,
    timeout: 30000,
    retryCount: 1,
    enabled: true,
  },
  // Step 5: 格式匹配（可選）
  {
    step: ProcessingStep.FORMAT_MATCHING,
    priority: StepPriority.OPTIONAL,
    timeout: 10000,
    retryCount: 1,
    enabled: true,
  },
  // Step 6: 配置獲取（可選）
  {
    step: ProcessingStep.CONFIG_FETCHING,
    priority: StepPriority.OPTIONAL,
    timeout: 5000,
    retryCount: 1,
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
  // 主開關：是否啟用統一處理器
  enableUnifiedProcessor: false, // 預設關閉，漸進式啟用

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
 */
export const PROCESSING_STEP_ORDER: ProcessingStep[] = [
  ProcessingStep.FILE_TYPE_DETECTION,
  ProcessingStep.SMART_ROUTING,
  ProcessingStep.AZURE_DI_EXTRACTION,
  ProcessingStep.ISSUER_IDENTIFICATION,
  ProcessingStep.FORMAT_MATCHING,
  ProcessingStep.CONFIG_FETCHING,
  ProcessingStep.GPT_ENHANCED_EXTRACTION,
  ProcessingStep.FIELD_MAPPING,
  ProcessingStep.TERM_RECORDING,
  ProcessingStep.CONFIDENCE_CALCULATION,
  ProcessingStep.ROUTING_DECISION,
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
