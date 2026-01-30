/**
 * @fileoverview Extraction V3 服務導出
 * @description
 *   統一導出 V3 提取服務的所有組件：
 *   - 主服務（ExtractionV3Service）
 *   - PDF 轉換工具（PdfConverter）
 *   - Prompt 組裝服務（PromptAssemblyService）
 *   - GPT 提取服務（UnifiedGptExtractionService）
 *   - 結果驗證服務（ResultValidationService）
 *   - 信心度計算服務（ConfidenceV3Service）
 *
 * @module src/services/extraction-v3
 * @since CHANGE-021 - Unified Processor V3 Refactoring
 * @lastModified 2026-01-30
 *
 * @example
 * ```typescript
 * import {
 *   ExtractionV3Service,
 *   processFileV3,
 *   checkExtractionV3Health,
 * } from '@/services/extraction-v3';
 *
 * const result = await processFileV3({
 *   fileId: 'file_123',
 *   fileBuffer: buffer,
 *   fileName: 'invoice.pdf',
 *   mimeType: 'application/pdf',
 *   cityCode: 'HKG',
 * });
 * ```
 */

// ============================================================================
// Main Service
// ============================================================================

export {
  ExtractionV3Service,
  processFileV3,
  checkExtractionV3Health,
  type ExtractionV3Config,
} from './extraction-v3.service';

// ============================================================================
// PDF Converter
// ============================================================================

export {
  PdfConverter,
  convertPdfToBase64Images,
  convertImageToBase64,
  convertToBase64,
  DEFAULT_PDF_CONVERSION_CONFIG,
  SUPPORTED_PDF_MIME_TYPES,
  SUPPORTED_IMAGE_MIME_TYPES,
  type PdfConversionConfig,
  type PdfConversionResult,
} from './utils/pdf-converter';

// ============================================================================
// Prompt Builder
// ============================================================================

export {
  buildFullSystemPrompt,
  buildUserPrompt,
  buildIssuerIdentificationSection,
  buildFormatIdentificationSection,
  buildFieldExtractionSection,
  buildTermClassificationSection,
  buildOutputSchemaSection,
  generateJsonSchema,
  getDefaultStandardFields,
  estimateTokens,
  combineSections,
  getBaseSystemPrompt,
  STANDARD_FIELD_KEYS,
  type PromptSection,
} from './utils/prompt-builder';

// ============================================================================
// Prompt Assembly Service
// ============================================================================

export {
  PromptAssemblyService,
  assemblePrompt,
  loadDynamicConfig,
  clearPromptCache,
  type PromptAssemblyOptions,
  type PromptAssemblyResult,
} from './prompt-assembly.service';

// ============================================================================
// GPT Extraction Service
// ============================================================================

export {
  UnifiedGptExtractionService,
  extractWithGpt,
  estimateExtractionCost,
  checkGptServiceHealth,
  type GptExtractionConfig,
  type GptExtractionServiceResult,
} from './unified-gpt-extraction.service';

// ============================================================================
// Result Validation Service
// ============================================================================

export {
  ResultValidationService,
  validateExtractionResult,
  isValidDateFormat,
  isValidCurrencyAmount,
  type ValidationOptions,
  type ValidationServiceResult,
} from './result-validation.service';

// ============================================================================
// Confidence V3 Service
// ============================================================================

export {
  ConfidenceV3Service,
  calculateConfidenceV3,
  quickCalculateConfidenceV3,
  getRoutingDecisionV3,
  ROUTING_THRESHOLDS_V3,
  type ConfidenceCalculationOptionsV3,
  type ConfidenceServiceResultV3,
  type RoutingDecisionV3,
} from './confidence-v3.service';

// ============================================================================
// Re-export Types
// ============================================================================

export type {
  // Processing Types
  ProcessingStepV3,
  StepPriorityV3,
  StepConfigV3,
  ExtractionV3Input,
  ExtractionV3Output,
  ProcessingContextV3,
  StepResultV3,
  RoutingDecisionDetailV3,

  // Extraction Result Types
  UnifiedExtractionResult,
  ValidatedExtractionResult,
  StandardFieldsV3,
  LineItemV3,
  ExtraChargeV3,
  FieldValue,
  FieldDefinition,

  // Identification Types
  IssuerIdentificationResultV3,
  FormatIdentificationResultV3,

  // Prompt Config Types
  DynamicPromptConfig,
  AssembledPrompt,
  KnownCompanyForPrompt,
  FormatPatternForPrompt,

  // Confidence Types
  ConfidenceResultV3,
  DimensionScoreV3,
  SimplifiedConfidenceInput,
  ConfidenceWeightsV3,
  ConfidenceDimensionV3,

  // Validation Types
  ValidationResultV3,
  JitCreatedV3,

  // Feature Flags
  ExtractionV3Flags,
} from '@/types/extraction-v3.types';

// ============================================================================
// Re-export Constants
// ============================================================================

export {
  PROCESSING_STEP_ORDER_V3,
  STEP_PRIORITY_V3,
  STEP_TIMEOUT_V3,
  STEP_RETRY_COUNT_V3,
  DEFAULT_STEP_CONFIGS_V3,
  STEP_DISPLAY_NAMES_V3,
  STEP_DISPLAY_NAMES_V3_EN,
  STEP_DESCRIPTIONS_V3,
  getStepConfigV3,
  isRequiredStepV3,
  getRequiredStepsV3,
  getOptionalStepsV3,
  getStepDisplayNameV3,
  getStepDescriptionV3,
  getTotalTimeoutV3,
  getStepNumberV3,
  V2_TO_V3_STEP_MAPPING,
} from '@/constants/processing-steps-v3';

export {
  DEFAULT_CONFIDENCE_WEIGHTS_V3,
  DEFAULT_EXTRACTION_V3_FLAGS,
} from '@/types/extraction-v3.types';
