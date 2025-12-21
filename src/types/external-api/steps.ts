/**
 * @fileoverview 處理步驟描述定義
 * @description
 *   定義發票處理流程中各步驟的人類可讀描述，包括：
 *   - 步驟代碼與描述映射
 *   - 步驟進度估算
 *   - 步驟分類
 *
 * @module src/types/external-api/steps
 * @author Development Team
 * @since Epic 11 - Story 11.2 (API 處理狀態查詢端點)
 * @lastModified 2025-12-21
 *
 * @features
 *   - 中英文步驟描述
 *   - 步驟進度百分比映射
 *   - 步驟分類（用於 UI 顯示）
 *
 * @related
 *   - src/types/external-api/status.ts - 狀態類型
 *   - src/services/task-status.service.ts - 狀態查詢服務
 */

// ============================================================
// 處理步驟代碼
// ============================================================

/**
 * 處理步驟代碼
 */
export const STEP_CODES = {
  // 排隊階段
  QUEUED: 'QUEUED',
  VALIDATING: 'VALIDATING',

  // OCR 階段
  OCR_STARTING: 'OCR_STARTING',
  OCR_PROCESSING: 'OCR_PROCESSING',
  OCR_COMPLETED: 'OCR_COMPLETED',

  // AI 提取階段
  AI_STARTING: 'AI_STARTING',
  AI_EXTRACTING: 'AI_EXTRACTING',
  AI_CLASSIFYING: 'AI_CLASSIFYING',
  AI_COMPLETED: 'AI_COMPLETED',

  // 映射階段
  MAPPING_STARTING: 'MAPPING_STARTING',
  MAPPING_TIER1: 'MAPPING_TIER1',
  MAPPING_TIER2: 'MAPPING_TIER2',
  MAPPING_TIER3: 'MAPPING_TIER3',
  MAPPING_COMPLETED: 'MAPPING_COMPLETED',

  // 驗證階段
  CONFIDENCE_CALCULATING: 'CONFIDENCE_CALCULATING',
  ROUTING_DECISION: 'ROUTING_DECISION',

  // 完成階段
  FINALIZING: 'FINALIZING',
  COMPLETED: 'COMPLETED',

  // 失敗/審核
  FAILED: 'FAILED',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
} as const;

export type StepCode = (typeof STEP_CODES)[keyof typeof STEP_CODES];

// ============================================================
// 步驟描述映射（英文）
// ============================================================

/**
 * 步驟描述映射
 * @description 各步驟的人類可讀英文描述
 */
export const STEP_DESCRIPTIONS: Record<StepCode, string> = {
  // 排隊階段
  QUEUED: 'Waiting in queue',
  VALIDATING: 'Validating document format',

  // OCR 階段
  OCR_STARTING: 'Starting OCR processing',
  OCR_PROCESSING: 'Extracting text with OCR',
  OCR_COMPLETED: 'OCR extraction completed',

  // AI 提取階段
  AI_STARTING: 'Starting AI extraction',
  AI_EXTRACTING: 'AI extracting invoice data',
  AI_CLASSIFYING: 'AI classifying charge types',
  AI_COMPLETED: 'AI extraction completed',

  // 映射階段
  MAPPING_STARTING: 'Starting charge type mapping',
  MAPPING_TIER1: 'Applying universal mapping rules',
  MAPPING_TIER2: 'Applying forwarder-specific rules',
  MAPPING_TIER3: 'Applying AI classification',
  MAPPING_COMPLETED: 'Charge type mapping completed',

  // 驗證階段
  CONFIDENCE_CALCULATING: 'Calculating confidence scores',
  ROUTING_DECISION: 'Determining routing decision',

  // 完成階段
  FINALIZING: 'Finalizing extraction results',
  COMPLETED: 'Processing completed',

  // 失敗/審核
  FAILED: 'Processing failed',
  REVIEW_REQUIRED: 'Pending human review',
};

// ============================================================
// 步驟描述映射（中文）
// ============================================================

/**
 * 步驟描述映射（中文）
 * @description 各步驟的人類可讀中文描述
 */
export const STEP_DESCRIPTIONS_ZH: Record<StepCode, string> = {
  // 排隊階段
  QUEUED: '等待處理中',
  VALIDATING: '驗證文件格式',

  // OCR 階段
  OCR_STARTING: '開始 OCR 處理',
  OCR_PROCESSING: '執行 OCR 文字提取',
  OCR_COMPLETED: 'OCR 提取完成',

  // AI 提取階段
  AI_STARTING: '開始 AI 提取',
  AI_EXTRACTING: 'AI 提取發票資料',
  AI_CLASSIFYING: 'AI 分類費用類型',
  AI_COMPLETED: 'AI 提取完成',

  // 映射階段
  MAPPING_STARTING: '開始費用類型映射',
  MAPPING_TIER1: '應用通用映射規則',
  MAPPING_TIER2: '應用特定 Forwarder 規則',
  MAPPING_TIER3: '應用 AI 分類結果',
  MAPPING_COMPLETED: '費用類型映射完成',

  // 驗證階段
  CONFIDENCE_CALCULATING: '計算信心分數',
  ROUTING_DECISION: '決定路由策略',

  // 完成階段
  FINALIZING: '完成處理結果',
  COMPLETED: '處理完成',

  // 失敗/審核
  FAILED: '處理失敗',
  REVIEW_REQUIRED: '需要人工審核',
};

// ============================================================
// 步驟進度映射
// ============================================================

/**
 * 步驟進度百分比映射
 * @description 各步驟對應的預估進度百分比
 */
export const STEP_PROGRESS: Record<StepCode, number> = {
  // 排隊階段 (0-5%)
  QUEUED: 0,
  VALIDATING: 5,

  // OCR 階段 (5-30%)
  OCR_STARTING: 10,
  OCR_PROCESSING: 20,
  OCR_COMPLETED: 30,

  // AI 提取階段 (30-60%)
  AI_STARTING: 35,
  AI_EXTRACTING: 45,
  AI_CLASSIFYING: 55,
  AI_COMPLETED: 60,

  // 映射階段 (60-80%)
  MAPPING_STARTING: 65,
  MAPPING_TIER1: 70,
  MAPPING_TIER2: 72,
  MAPPING_TIER3: 75,
  MAPPING_COMPLETED: 80,

  // 驗證階段 (80-95%)
  CONFIDENCE_CALCULATING: 85,
  ROUTING_DECISION: 90,

  // 完成階段 (95-100%)
  FINALIZING: 95,
  COMPLETED: 100,

  // 失敗/審核
  FAILED: 0,
  REVIEW_REQUIRED: 90,
};

// ============================================================
// 步驟分類
// ============================================================

/**
 * 步驟分類
 */
export type StepCategory = 'queue' | 'ocr' | 'ai' | 'mapping' | 'validation' | 'complete' | 'error';

/**
 * 步驟分類映射
 */
export const STEP_CATEGORIES: Record<StepCode, StepCategory> = {
  QUEUED: 'queue',
  VALIDATING: 'queue',

  OCR_STARTING: 'ocr',
  OCR_PROCESSING: 'ocr',
  OCR_COMPLETED: 'ocr',

  AI_STARTING: 'ai',
  AI_EXTRACTING: 'ai',
  AI_CLASSIFYING: 'ai',
  AI_COMPLETED: 'ai',

  MAPPING_STARTING: 'mapping',
  MAPPING_TIER1: 'mapping',
  MAPPING_TIER2: 'mapping',
  MAPPING_TIER3: 'mapping',
  MAPPING_COMPLETED: 'mapping',

  CONFIDENCE_CALCULATING: 'validation',
  ROUTING_DECISION: 'validation',

  FINALIZING: 'complete',
  COMPLETED: 'complete',

  FAILED: 'error',
  REVIEW_REQUIRED: 'error',
};

// ============================================================
// 輔助函數
// ============================================================

/**
 * 獲取步驟描述
 * @param stepCode 步驟代碼
 * @param locale 語言（'en' 或 'zh'）
 * @returns 步驟描述
 */
export function getStepDescription(stepCode: StepCode, locale: 'en' | 'zh' = 'en'): string {
  if (locale === 'zh') {
    return STEP_DESCRIPTIONS_ZH[stepCode] ?? STEP_DESCRIPTIONS[stepCode] ?? 'Unknown step';
  }
  return STEP_DESCRIPTIONS[stepCode] ?? 'Unknown step';
}

/**
 * 獲取步驟進度
 * @param stepCode 步驟代碼
 * @returns 進度百分比（0-100）
 */
export function getStepProgress(stepCode: StepCode): number {
  return STEP_PROGRESS[stepCode] ?? 0;
}

/**
 * 獲取步驟分類
 * @param stepCode 步驟代碼
 * @returns 步驟分類
 */
export function getStepCategory(stepCode: StepCode): StepCategory {
  return STEP_CATEGORIES[stepCode] ?? 'error';
}

/**
 * 檢查是否為有效的步驟代碼
 * @param code 代碼字串
 * @returns 是否為有效步驟代碼
 */
export function isValidStepCode(code: string): code is StepCode {
  return Object.values(STEP_CODES).includes(code as StepCode);
}

/**
 * 獲取階段內的所有步驟
 * @param category 步驟分類
 * @returns 該分類下的所有步驟代碼
 */
export function getStepsInCategory(category: StepCategory): StepCode[] {
  return (Object.entries(STEP_CATEGORIES) as [StepCode, StepCategory][])
    .filter(([, cat]) => cat === category)
    .map(([code]) => code);
}
