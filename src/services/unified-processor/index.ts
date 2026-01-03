/**
 * @fileoverview 統一處理器模組導出
 * @description
 *   統一導出 unified-processor 模組的所有公開 API：
 *   - 主服務：UnifiedDocumentProcessorService
 *   - 步驟處理器介面和基類
 *   - 步驟工廠
 *   - 適配器（Legacy, IssuerIdentifier, FormatMatcher, ConfigFetcher）
 *
 * @module src/services/unified-processor
 * @since Epic 15 - Story 15.1
 * @lastModified 2026-01-03
 *
 * @exports
 *   - UnifiedDocumentProcessorService - 主服務類
 *   - getUnifiedDocumentProcessor - 取得服務單例
 *   - IStepHandler, BaseStepHandler - 步驟處理器介面
 *   - StepHandlerFactory - 步驟工廠
 *   - LegacyProcessorAdapter - Legacy 適配器
 *   - IssuerIdentifierAdapter - 發行者識別適配器 (Story 15.2)
 *   - FormatMatcherAdapter - 格式匹配適配器 (Story 15.3)
 *   - ConfigFetcherAdapter - 配置獲取適配器 (Story 15.3)
 */

// ============================================================================
// 主服務
// ============================================================================

export {
  UnifiedDocumentProcessorService,
  getUnifiedDocumentProcessor,
  resetUnifiedDocumentProcessor,
  type ProcessOptions,
} from './unified-document-processor.service';

// ============================================================================
// 介面和基類
// ============================================================================

export {
  type IStepHandler,
  BaseStepHandler,
  type IStepHandlerFactory,
} from './interfaces/step-handler.interface';

// ============================================================================
// 工廠
// ============================================================================

export {
  StepHandlerFactory,
  getStepHandlerFactory,
  resetStepHandlerFactory,
} from './factory/step-factory';

// ============================================================================
// 適配器
// ============================================================================

export {
  LegacyProcessorAdapter,
  legacyProcessorAdapter,
} from './adapters/legacy-processor.adapter';

export {
  IssuerIdentifierAdapter,
  issuerIdentifierAdapter,
} from './adapters/issuer-identifier-adapter';

export {
  FormatMatcherAdapter,
  formatMatcherAdapter,
} from './adapters/format-matcher-adapter';

export {
  ConfigFetcherAdapter,
  configFetcherAdapter,
} from './adapters/config-fetcher-adapter';

// ============================================================================
// 步驟處理器（如需直接使用）
// ============================================================================

export { FileTypeDetectionStep } from './steps/file-type-detection.step';
export { SmartRoutingStep } from './steps/smart-routing.step';
export { AzureDiExtractionStep } from './steps/azure-di-extraction.step';
export { IssuerIdentificationStep } from './steps/issuer-identification.step';
export { FormatMatchingStep } from './steps/format-matching.step';
export { ConfigFetchingStep } from './steps/config-fetching.step';
export { GptEnhancedExtractionStep } from './steps/gpt-enhanced-extraction.step';
export { FieldMappingStep } from './steps/field-mapping.step';
export { TermRecordingStep } from './steps/term-recording.step';
export { ConfidenceCalculationStep } from './steps/confidence-calculation.step';
export { RoutingDecisionStep } from './steps/routing-decision.step';
