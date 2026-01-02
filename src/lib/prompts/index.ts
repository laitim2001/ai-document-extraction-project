/**
 * @fileoverview GPT Vision 提示詞模組統一導出
 * @module src/lib/prompts
 * @since Epic 0 - Story 0.9
 * @lastModified 2025-01-01
 *
 * @features
 *   - 原始提取提示詞（extraction-prompt.ts）
 *   - 優化版提取提示詞（optimized-extraction-prompt.ts）- Story 0-11
 *   - Prompt 版本管理機制
 */

// ============================================================================
// 原始提取提示詞（V1）
// ============================================================================

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

// ============================================================================
// 優化版提取提示詞（V2）- Story 0-11
// ============================================================================

export {
  // 優化版提示詞
  OPTIMIZED_EXTRACTION_PROMPT,
  LEGACY_EXTRACTION_PROMPT,
  // 版本管理
  PROMPT_VERSION,
  EXTRACTION_PROMPT_VERSIONS,
  // 獲取函數
  getActiveExtractionPrompt,
  getActivePromptVersion,
  getPromptByVersion,
  getPromptVersionList,
  isPromptVersionExists,
  // 類型
  type PromptVersion,
  type ExcludedItem,
  type OptimizedExtractionMetadata,
} from './optimized-extraction-prompt';
