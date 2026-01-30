/**
 * @fileoverview V3 處理流程步驟配置常數
 * @description
 *   定義 Extraction V3 的 7 步處理管線配置：
 *   - 每個步驟的優先級（REQUIRED / OPTIONAL）
 *   - 超時設定和重試次數
 *   - 步驟順序和執行配置
 *
 *   V3 架構（CHANGE-021）：
 *   從 V2 的 11 步簡化為 7 步，移除 Azure DI 依賴，
 *   改用單次 GPT-5.2 Vision 調用完成所有提取任務。
 *
 * @module src/constants/processing-steps-v3
 * @since CHANGE-021 - Unified Processor V3 Refactoring
 * @lastModified 2026-01-30
 *
 * @features
 *   - 7 步處理管線配置
 *   - 必要步驟 vs 可選步驟區分
 *   - 步驟顯示名稱和描述（繁體中文）
 *   - 步驟超時和重試配置
 *
 * @related
 *   - src/types/extraction-v3.types.ts - V3 類型定義
 *   - src/services/extraction-v3/ - V3 提取服務
 *   - src/constants/processing-steps.ts - V2 步驟常數
 */

import {
  ProcessingStepV3,
  StepPriorityV3,
  StepConfigV3,
} from '@/types/extraction-v3.types';

// ============================================================================
// 步驟順序
// ============================================================================

/**
 * V3 處理步驟順序
 * @description 按照處理流程的正確順序排列（7 步）
 *
 * V3 簡化架構：
 *   1. FILE_PREPARATION - 文件準備（合併 V2 的 Step 1+2）
 *   2. DYNAMIC_PROMPT_ASSEMBLY - 動態 Prompt 組裝（重構 V2 的 Step 3-5）
 *   3. UNIFIED_GPT_EXTRACTION - 統一 GPT 提取（取代 V2 的 Step 6-9）
 *   4. RESULT_VALIDATION - 結果驗證（新增）
 *   5. TERM_RECORDING - 術語記錄（保留自 V2）
 *   6. CONFIDENCE_CALCULATION - 信心度計算（簡化自 V2）
 *   7. ROUTING_DECISION - 路由決策（保留自 V2）
 */
export const PROCESSING_STEP_ORDER_V3: ProcessingStepV3[] = [
  ProcessingStepV3.FILE_PREPARATION,        // Step 1
  ProcessingStepV3.DYNAMIC_PROMPT_ASSEMBLY, // Step 2
  ProcessingStepV3.UNIFIED_GPT_EXTRACTION,  // Step 3 (核心步驟)
  ProcessingStepV3.RESULT_VALIDATION,       // Step 4
  ProcessingStepV3.TERM_RECORDING,          // Step 5
  ProcessingStepV3.CONFIDENCE_CALCULATION,  // Step 6
  ProcessingStepV3.ROUTING_DECISION,        // Step 7
];

// ============================================================================
// 步驟優先級映射
// ============================================================================

/**
 * V3 步驟優先級
 * @description 區分必要步驟（失敗中斷）和可選步驟（失敗繼續）
 */
export const STEP_PRIORITY_V3: Record<ProcessingStepV3, StepPriorityV3> = {
  [ProcessingStepV3.FILE_PREPARATION]: StepPriorityV3.REQUIRED,
  [ProcessingStepV3.DYNAMIC_PROMPT_ASSEMBLY]: StepPriorityV3.REQUIRED,
  [ProcessingStepV3.UNIFIED_GPT_EXTRACTION]: StepPriorityV3.REQUIRED,
  [ProcessingStepV3.RESULT_VALIDATION]: StepPriorityV3.REQUIRED,
  [ProcessingStepV3.TERM_RECORDING]: StepPriorityV3.OPTIONAL,
  [ProcessingStepV3.CONFIDENCE_CALCULATION]: StepPriorityV3.REQUIRED,
  [ProcessingStepV3.ROUTING_DECISION]: StepPriorityV3.REQUIRED,
};

// ============================================================================
// 步驟超時配置
// ============================================================================

/**
 * V3 步驟超時配置（毫秒）
 */
export const STEP_TIMEOUT_V3: Record<ProcessingStepV3, number> = {
  [ProcessingStepV3.FILE_PREPARATION]: 10_000,        // 10 秒
  [ProcessingStepV3.DYNAMIC_PROMPT_ASSEMBLY]: 5_000,  // 5 秒
  [ProcessingStepV3.UNIFIED_GPT_EXTRACTION]: 60_000,  // 60 秒
  [ProcessingStepV3.RESULT_VALIDATION]: 10_000,       // 10 秒
  [ProcessingStepV3.TERM_RECORDING]: 5_000,           // 5 秒
  [ProcessingStepV3.CONFIDENCE_CALCULATION]: 3_000,   // 3 秒
  [ProcessingStepV3.ROUTING_DECISION]: 2_000,         // 2 秒
};

/**
 * V3 步驟重試次數
 */
export const STEP_RETRY_COUNT_V3: Record<ProcessingStepV3, number> = {
  [ProcessingStepV3.FILE_PREPARATION]: 0,
  [ProcessingStepV3.DYNAMIC_PROMPT_ASSEMBLY]: 1,
  [ProcessingStepV3.UNIFIED_GPT_EXTRACTION]: 2,       // GPT 調用可重試 2 次
  [ProcessingStepV3.RESULT_VALIDATION]: 0,
  [ProcessingStepV3.TERM_RECORDING]: 0,
  [ProcessingStepV3.CONFIDENCE_CALCULATION]: 0,
  [ProcessingStepV3.ROUTING_DECISION]: 0,
};

// ============================================================================
// 預設步驟配置
// ============================================================================

/**
 * V3 預設步驟配置
 * @description 7 步處理管線的完整配置
 */
export const DEFAULT_STEP_CONFIGS_V3: StepConfigV3[] = [
  // Step 1: 文件準備（必要）
  {
    step: ProcessingStepV3.FILE_PREPARATION,
    priority: StepPriorityV3.REQUIRED,
    timeout: STEP_TIMEOUT_V3[ProcessingStepV3.FILE_PREPARATION],
    retryCount: STEP_RETRY_COUNT_V3[ProcessingStepV3.FILE_PREPARATION],
    enabled: true,
  },
  // Step 2: 動態 Prompt 組裝（必要）
  {
    step: ProcessingStepV3.DYNAMIC_PROMPT_ASSEMBLY,
    priority: StepPriorityV3.REQUIRED,
    timeout: STEP_TIMEOUT_V3[ProcessingStepV3.DYNAMIC_PROMPT_ASSEMBLY],
    retryCount: STEP_RETRY_COUNT_V3[ProcessingStepV3.DYNAMIC_PROMPT_ASSEMBLY],
    enabled: true,
  },
  // Step 3: 統一 GPT 提取（必要 - 核心步驟）
  {
    step: ProcessingStepV3.UNIFIED_GPT_EXTRACTION,
    priority: StepPriorityV3.REQUIRED,
    timeout: STEP_TIMEOUT_V3[ProcessingStepV3.UNIFIED_GPT_EXTRACTION],
    retryCount: STEP_RETRY_COUNT_V3[ProcessingStepV3.UNIFIED_GPT_EXTRACTION],
    enabled: true,
  },
  // Step 4: 結果驗證（必要）
  {
    step: ProcessingStepV3.RESULT_VALIDATION,
    priority: StepPriorityV3.REQUIRED,
    timeout: STEP_TIMEOUT_V3[ProcessingStepV3.RESULT_VALIDATION],
    retryCount: STEP_RETRY_COUNT_V3[ProcessingStepV3.RESULT_VALIDATION],
    enabled: true,
  },
  // Step 5: 術語記錄（可選）
  {
    step: ProcessingStepV3.TERM_RECORDING,
    priority: StepPriorityV3.OPTIONAL,
    timeout: STEP_TIMEOUT_V3[ProcessingStepV3.TERM_RECORDING],
    retryCount: STEP_RETRY_COUNT_V3[ProcessingStepV3.TERM_RECORDING],
    enabled: true,
  },
  // Step 6: 信心度計算（必要）
  {
    step: ProcessingStepV3.CONFIDENCE_CALCULATION,
    priority: StepPriorityV3.REQUIRED,
    timeout: STEP_TIMEOUT_V3[ProcessingStepV3.CONFIDENCE_CALCULATION],
    retryCount: STEP_RETRY_COUNT_V3[ProcessingStepV3.CONFIDENCE_CALCULATION],
    enabled: true,
  },
  // Step 7: 路由決策（必要）
  {
    step: ProcessingStepV3.ROUTING_DECISION,
    priority: StepPriorityV3.REQUIRED,
    timeout: STEP_TIMEOUT_V3[ProcessingStepV3.ROUTING_DECISION],
    retryCount: STEP_RETRY_COUNT_V3[ProcessingStepV3.ROUTING_DECISION],
    enabled: true,
  },
];

// ============================================================================
// 步驟顯示名稱和描述
// ============================================================================

/**
 * V3 步驟顯示名稱（繁體中文）
 */
export const STEP_DISPLAY_NAMES_V3: Record<ProcessingStepV3, string> = {
  [ProcessingStepV3.FILE_PREPARATION]: '文件準備',
  [ProcessingStepV3.DYNAMIC_PROMPT_ASSEMBLY]: 'Prompt 組裝',
  [ProcessingStepV3.UNIFIED_GPT_EXTRACTION]: 'GPT 統一提取',
  [ProcessingStepV3.RESULT_VALIDATION]: '結果驗證',
  [ProcessingStepV3.TERM_RECORDING]: '術語記錄',
  [ProcessingStepV3.CONFIDENCE_CALCULATION]: '信心度計算',
  [ProcessingStepV3.ROUTING_DECISION]: '路由決策',
};

/**
 * V3 步驟顯示名稱（英文）
 */
export const STEP_DISPLAY_NAMES_V3_EN: Record<ProcessingStepV3, string> = {
  [ProcessingStepV3.FILE_PREPARATION]: 'File Preparation',
  [ProcessingStepV3.DYNAMIC_PROMPT_ASSEMBLY]: 'Prompt Assembly',
  [ProcessingStepV3.UNIFIED_GPT_EXTRACTION]: 'GPT Unified Extraction',
  [ProcessingStepV3.RESULT_VALIDATION]: 'Result Validation',
  [ProcessingStepV3.TERM_RECORDING]: 'Term Recording',
  [ProcessingStepV3.CONFIDENCE_CALCULATION]: 'Confidence Calculation',
  [ProcessingStepV3.ROUTING_DECISION]: 'Routing Decision',
};

/**
 * V3 步驟描述（繁體中文）
 */
export const STEP_DESCRIPTIONS_V3: Record<ProcessingStepV3, string> = {
  [ProcessingStepV3.FILE_PREPARATION]:
    '檢測文件類型、PDF 轉換為圖片、Base64 編碼',
  [ProcessingStepV3.DYNAMIC_PROMPT_ASSEMBLY]:
    '組裝公司識別、格式識別、欄位提取、術語分類的完整 Prompt',
  [ProcessingStepV3.UNIFIED_GPT_EXTRACTION]:
    '單次 GPT-5.2 Vision 調用，完成發行方識別、格式識別、欄位提取、術語預分類',
  [ProcessingStepV3.RESULT_VALIDATION]:
    'JSON Schema 驗證、公司/格式 ID 解析、JIT 創建',
  [ProcessingStepV3.TERM_RECORDING]:
    '記錄新發現的術語、更新頻率、識別同義詞',
  [ProcessingStepV3.CONFIDENCE_CALCULATION]:
    '5 維度加權計算整體信心度分數',
  [ProcessingStepV3.ROUTING_DECISION]:
    '根據信心度決定審核路由（AUTO_APPROVE / QUICK_REVIEW / FULL_REVIEW）',
};

// ============================================================================
// 輔助函數
// ============================================================================

/**
 * 取得指定 V3 步驟的配置
 * @param step - 處理步驟
 * @returns 步驟配置，如果找不到則返回 undefined
 */
export function getStepConfigV3(step: ProcessingStepV3): StepConfigV3 | undefined {
  return DEFAULT_STEP_CONFIGS_V3.find((config) => config.step === step);
}

/**
 * 檢查 V3 步驟是否為必要步驟
 * @param step - 處理步驟
 * @returns 是否為必要步驟
 */
export function isRequiredStepV3(step: ProcessingStepV3): boolean {
  return STEP_PRIORITY_V3[step] === StepPriorityV3.REQUIRED;
}

/**
 * 取得所有 V3 必要步驟
 * @returns 必要步驟列表
 */
export function getRequiredStepsV3(): ProcessingStepV3[] {
  return PROCESSING_STEP_ORDER_V3.filter(
    (step) => STEP_PRIORITY_V3[step] === StepPriorityV3.REQUIRED
  );
}

/**
 * 取得所有 V3 可選步驟
 * @returns 可選步驟列表
 */
export function getOptionalStepsV3(): ProcessingStepV3[] {
  return PROCESSING_STEP_ORDER_V3.filter(
    (step) => STEP_PRIORITY_V3[step] === StepPriorityV3.OPTIONAL
  );
}

/**
 * 取得 V3 步驟顯示名稱
 * @param step - 處理步驟
 * @param locale - 語言（'zh-TW' | 'en'），預設 'zh-TW'
 * @returns 步驟顯示名稱
 */
export function getStepDisplayNameV3(
  step: ProcessingStepV3,
  locale: 'zh-TW' | 'en' = 'zh-TW'
): string {
  return locale === 'en'
    ? STEP_DISPLAY_NAMES_V3_EN[step] ?? step
    : STEP_DISPLAY_NAMES_V3[step] ?? step;
}

/**
 * 取得 V3 步驟描述
 * @param step - 處理步驟
 * @returns 步驟描述
 */
export function getStepDescriptionV3(step: ProcessingStepV3): string {
  return STEP_DESCRIPTIONS_V3[step] ?? '';
}

/**
 * 計算 V3 處理管線總超時時間
 * @returns 總超時時間（毫秒）
 */
export function getTotalTimeoutV3(): number {
  return PROCESSING_STEP_ORDER_V3.reduce(
    (total, step) => total + STEP_TIMEOUT_V3[step],
    0
  );
}

/**
 * 取得 V3 步驟的步驟編號（1-based）
 * @param step - 處理步驟
 * @returns 步驟編號，找不到則返回 -1
 */
export function getStepNumberV3(step: ProcessingStepV3): number {
  const index = PROCESSING_STEP_ORDER_V3.indexOf(step);
  return index === -1 ? -1 : index + 1;
}

// ============================================================================
// V2 vs V3 步驟映射（用於調試和遷移）
// ============================================================================

/**
 * V2 → V3 步驟映射參考
 * @description 說明 V2 的 11 步如何對應到 V3 的 7 步
 */
export const V2_TO_V3_STEP_MAPPING = {
  // V2 Step 1-2 → V3 Step 1
  FILE_TYPE_DETECTION: ProcessingStepV3.FILE_PREPARATION,
  SMART_ROUTING: ProcessingStepV3.FILE_PREPARATION,

  // V2 Step 3-5 → V3 Step 2
  ISSUER_IDENTIFICATION: ProcessingStepV3.DYNAMIC_PROMPT_ASSEMBLY,
  FORMAT_MATCHING: ProcessingStepV3.DYNAMIC_PROMPT_ASSEMBLY,
  CONFIG_FETCHING: ProcessingStepV3.DYNAMIC_PROMPT_ASSEMBLY,

  // V2 Step 6-9 → V3 Step 3
  AZURE_DI_EXTRACTION: ProcessingStepV3.UNIFIED_GPT_EXTRACTION,
  GPT_ENHANCED_EXTRACTION: ProcessingStepV3.UNIFIED_GPT_EXTRACTION,
  FIELD_MAPPING: ProcessingStepV3.UNIFIED_GPT_EXTRACTION,
  TERM_CLASSIFICATION: ProcessingStepV3.UNIFIED_GPT_EXTRACTION,

  // V2 Step 9 → V3 Step 5
  TERM_RECORDING: ProcessingStepV3.TERM_RECORDING,

  // V2 Step 10 → V3 Step 6
  CONFIDENCE_CALCULATION: ProcessingStepV3.CONFIDENCE_CALCULATION,

  // V2 Step 11 → V3 Step 7
  ROUTING_DECISION: ProcessingStepV3.ROUTING_DECISION,
} as const;
