/**
 * @fileoverview Extraction V3/V3.1 服務導出
 * @description
 *   統一導出 V3 和 V3.1 提取服務的所有組件：
 *   - V3 主服務（ExtractionV3Service）
 *   - V3.1 三階段服務（CHANGE-024）：
 *     - Stage1CompanyService - 公司識別
 *     - Stage2FormatService - 格式識別
 *     - Stage3ExtractionService - 欄位提取
 *     - StageOrchestratorService - 階段協調
 *   - PDF 轉換工具（PdfConverter）
 *   - Prompt 組裝服務（PromptAssemblyService）
 *   - GPT 提取服務（UnifiedGptExtractionService）
 *   - 結果驗證服務（ResultValidationService）
 *   - 信心度計算服務（ConfidenceV3Service）
 *
 * @module src/services/extraction-v3
 * @since CHANGE-021 - Unified Processor V3 Refactoring
 * @lastModified 2026-02-03
 *
 * @example
 * ```typescript
 * // V3 使用方式（單次 GPT 調用）
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
 *
 * // V3.1 使用方式（三階段分離）
 * import {
 *   StageOrchestratorService,
 *   Stage1CompanyService,
 *   Stage2FormatService,
 *   Stage3ExtractionService,
 * } from '@/services/extraction-v3';
 *
 * const orchestrator = new StageOrchestratorService(prisma);
 * const result = await orchestrator.execute({
 *   input: extractionInput,
 *   imageBase64Array: images,
 *   pageCount: 1,
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
// CHANGE-026: Variable Replacer (變數替換工具)
// ============================================================================

export {
  replaceVariables,
  replaceVariablesWithDetails,
  extractVariableNames,
  validateTemplateVariables,
  buildStage1VariableContext,
  buildStage2VariableContext,
  buildStage3VariableContext,
  type VariableContext,
  type ReplaceVariablesOptions,
  type ReplaceVariablesResult,
} from './utils/variable-replacer';

// ============================================================================
// CHANGE-026: Prompt Merger (Prompt 合併工具)
// ============================================================================

export {
  mergePrompts,
  mergePromptConfigs,
  selectHighestPriorityConfig,
  createMergeSummary,
  isValidMergeStrategy,
  getMergeStrategyDescription,
  estimateMergedTokens,
  type PromptConfigForMerge,
  type MergedPromptResult,
  type AppliedConfigInfo,
  type MergeOptions,
} from './utils/prompt-merger';

// ============================================================================
// Prompt Assembly Service
// ============================================================================

export {
  PromptAssemblyService,
  assemblePrompt,
  loadDynamicConfig,
  clearPromptCache,
  // CHANGE-025: Stage Prompt 載入
  loadStage1PromptConfig,
  loadStage2PromptConfig,
  loadStage3PromptConfig,
  type PromptAssemblyOptions,
  type PromptAssemblyResult,
  // CHANGE-025: Stage Prompt 配置類型
  type StagePromptConfig,
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

// ============================================================================
// CHANGE-024: V3.1 三階段服務
// ============================================================================

export {
  Stage1CompanyService,
  Stage2FormatService,
  Stage3ExtractionService,
  StageOrchestratorService,
  type Stage1Input,
  type Stage1Options,
  type Stage2Input,
  type Stage2Options,
  type Stage3Input,
  type Stage3Options,
  type OrchestratorInput,
  type OrchestratorOptions,
} from './stages';

// ============================================================================
// CHANGE-024: V3.1 Types Re-export
// ============================================================================

export type {
  // Processing Types V3.1
  ProcessingStepV3_1,
  StepResultV3_1,
  ProcessingContextV3_1,
  ExtractionV3_1Output,

  // Stage Result Types
  Stage1CompanyResult,
  Stage2FormatResult,
  Stage3ExtractionResult,
  Stage3ConfigUsed,
  StageAiDetails,

  // Identification Types
  CompanyIdentificationMethod,
  FormatConfigSource,
  PromptConfigScope,

  // Confidence Types V3.1
  ConfidenceDimensionV3_1,
  ConfidenceWeightsV3_1,
  DimensionScoreV3_1,
  ConfidenceResultV3_1,

  // CHANGE-025: Smart Routing Types
  SmartRoutingInput,
  SmartRoutingOutput,
  ConfigSourceType,
} from '@/types/extraction-v3.types';

// ============================================================================
// CHANGE-024: V3.1 Constants Re-export
// ============================================================================

export {
  PROCESSING_STEP_ORDER_V3_1,
  DEFAULT_CONFIDENCE_WEIGHTS_V3_1,
  CONFIG_SOURCE_BONUS_SCORES,
  // Type Guards
  isProcessingStepV3_1,
  isConfidenceDimensionV3_1,
  isStage1CompanyResult,
  isStage2FormatResult,
  isStage3ExtractionResult,
  detectExtractionVersion,
} from '@/types/extraction-v3.types';

// ============================================================================
// CHANGE-024: V3.1 Confidence Service
// ============================================================================

export {
  ConfidenceV3_1Service,
  calculateConfidenceV3_1,
  quickCalculateConfidenceV3_1,
  getRoutingDecisionV3_1,
  // CHANGE-025: 智能路由
  getSmartReviewTypeV3_1,
  ROUTING_THRESHOLDS_V3_1,
  type ConfidenceInputV3_1,
  type ConfidenceCalculationOptionsV3_1,
  type ConfidenceServiceResultV3_1,
  type RoutingDecisionV3_1,
} from './confidence-v3-1.service';

// ============================================================================
// CHANGE-024: GptCallerService (共用 GPT 調用)
// ============================================================================

export {
  GptCallerService,
  type GptModelType,
  type ImageDetailMode,
  type GptCallerConfig,
  type GptCallInput,
  type GptCallResult,
} from './stages/gpt-caller.service';
