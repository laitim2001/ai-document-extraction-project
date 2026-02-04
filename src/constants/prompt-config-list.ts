/**
 * @fileoverview Prompt Config 列表顯示常量
 * @description
 *   定義列表頁面的顯示控制常量，包含初始顯示數量、載入增量等。
 *   用於可折疊分組和顯示更多功能。
 *
 * @module src/constants/prompt-config-list
 * @since CHANGE-028 - Prompt Config 列表可折疊分組
 * @lastModified 2026-02-04
 */

/**
 * Prompt Config 列表顯示常量
 */
export const PROMPT_CONFIG_LIST = {
  /** 每組預設顯示的配置數量（2 行 × 3 列） */
  INITIAL_DISPLAY_COUNT: 6,

  /** 每次「顯示更多」載入的增量 */
  LOAD_MORE_INCREMENT: 6,

  /** 預設展開的分組數量上限 */
  DEFAULT_EXPANDED_LIMIT: 2,
} as const;

/**
 * Prompt Type 顯示順序
 * 用於決定分組的排序
 */
export const PROMPT_TYPE_ORDER: string[] = [
  'STAGE_1_COMPANY_IDENTIFICATION',
  'STAGE_2_FORMAT_IDENTIFICATION',
  'STAGE_3_FIELD_EXTRACTION',
  'ISSUER_IDENTIFICATION',
  'TERM_CLASSIFICATION',
  'FIELD_EXTRACTION',
  'VALIDATION',
];
