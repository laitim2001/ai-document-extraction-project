/**
 * @fileoverview GPT Vision 提示詞模組統一導出
 * @module src/lib/prompts
 * @since Epic 0 - Story 0.9
 * @lastModified 2025-12-26
 */

export {
  // 基本提示詞
  BASE_EXTRACTION_PROMPT,
  DOCUMENT_ISSUER_PROMPT,
  DOCUMENT_FORMAT_PROMPT,
  TERM_EXTRACTION_PROMPT,
  FULL_EXTRACTION_PROMPT,
  // 建構函數
  buildExtractionPrompt,
  getBatchProcessingPrompt,
  // 類型
  type BuildPromptOptions,
} from './extraction-prompt';
