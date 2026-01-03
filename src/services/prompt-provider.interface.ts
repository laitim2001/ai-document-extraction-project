/**
 * @fileoverview Prompt Provider Interface Definition
 * @description
 *   Defines the interface for prompt providers that can supply prompts
 *   for GPT Vision processing. Supports both dynamic (database-driven)
 *   and static (hardcoded) prompt sources.
 *
 *   This interface enables the hybrid prompt provider pattern where:
 *   - Dynamic prompts are fetched from database via PromptResolver
 *   - Static prompts serve as fallback when dynamic is disabled/fails
 *
 * @module src/services/prompt-provider.interface
 * @since Epic 14 - Story 14-4 (GPT Vision 服務整合)
 * @lastModified 2026-01-03
 *
 * @features
 *   - Unified interface for prompt retrieval
 *   - Context-aware prompt selection
 *   - Source tracking for debugging/metrics
 *   - Version tracking support
 *
 * @dependencies
 *   - src/types/prompt-config.ts - PromptType enum
 *
 * @related
 *   - src/services/hybrid-prompt-provider.service.ts - Implementation
 *   - src/services/static-prompts.ts - Static prompt definitions
 *   - src/services/gpt-vision.service.ts - Consumer
 */

import { PromptType } from '@/types/prompt-config';

// ============================================================================
// Request Context Types
// ============================================================================

/**
 * Context for prompt requests
 * @description Provides all information needed to select the appropriate prompt
 */
export interface PromptRequestContext {
  /** Type of prompt requested */
  promptType: PromptType;
  /** Company ID for company-specific prompts (optional) */
  companyId?: string | null;
  /** Document format ID for format-specific prompts (optional) */
  documentFormatId?: string | null;
  /** Document ID being processed (for logging/metrics) */
  documentId?: string;
  /** Additional context variables for prompt interpolation */
  contextVariables?: Record<string, unknown>;
}

// ============================================================================
// Result Types
// ============================================================================

/**
 * Prompt source indicator
 * @description Tracks where the prompt originated from
 */
export type PromptSource = 'dynamic' | 'static' | 'fallback';

/**
 * Result from prompt provider
 * @description Contains the resolved prompts and metadata
 */
export interface PromptResult {
  /** System prompt (role/context for the AI) */
  systemPrompt: string;
  /** User prompt template (instructions/questions for the AI) */
  userPrompt: string;
  /** Source of the prompt (dynamic, static, or fallback) */
  source: PromptSource;
  /** Applied configuration layers (for dynamic prompts) */
  appliedLayers?: string[];
  /** Version information for tracking */
  version?: PromptVersionInfo;
}

/**
 * Version information for prompt tracking
 * @description Enables auditing and rollback capabilities
 */
export interface PromptVersionInfo {
  /** Unique version identifier */
  versionId: string;
  /** Version number (semantic) */
  versionNumber: number;
  /** Timestamp of this version */
  timestamp: Date;
  /** Source configuration IDs contributing to this version */
  configIds?: string[];
}

// ============================================================================
// Provider Interface
// ============================================================================

/**
 * Prompt Provider Interface
 * @description
 *   Defines the contract for any prompt provider implementation.
 *   Implementations include:
 *   - HybridPromptProvider: Switches between dynamic and static
 *   - StaticPromptProvider: Always returns static prompts
 *   - DynamicPromptProvider: Always uses database-driven prompts
 */
export interface IPromptProvider {
  /**
   * Get prompt for the given context
   *
   * @param context - Request context with type, IDs, and variables
   * @returns Promise resolving to the prompt result
   *
   * @example
   * ```typescript
   * const result = await provider.getPrompt({
   *   promptType: PromptType.ISSUER_IDENTIFICATION,
   *   companyId: 'company-123',
   *   documentFormatId: 'format-456',
   *   contextVariables: { documentType: 'invoice' }
   * });
   *
   * console.log(result.systemPrompt);
   * console.log(result.source); // 'dynamic' | 'static' | 'fallback'
   * ```
   */
  getPrompt(context: PromptRequestContext): Promise<PromptResult>;

  /**
   * Check if this provider supports the given prompt type
   *
   * @param promptType - Type of prompt to check
   * @returns True if the provider can handle this type
   */
  supportsPromptType(promptType: PromptType): boolean;

  /**
   * Get provider status information
   *
   * @returns Status info including availability and configuration
   */
  getStatus(): PromptProviderStatus;
}

/**
 * Provider status information
 * @description Used for health checks and monitoring
 */
export interface PromptProviderStatus {
  /** Name of the provider */
  name: string;
  /** Whether the provider is available */
  available: boolean;
  /** Currently active source mode */
  activeSource: PromptSource;
  /** Feature flag status */
  featureFlags: {
    dynamicEnabled: boolean;
    issuerEnabled: boolean;
    termEnabled: boolean;
    fieldEnabled: boolean;
    validationEnabled: boolean;
  };
  /** Last update timestamp */
  lastUpdated: Date;
}

// ============================================================================
// Metrics Types
// ============================================================================

/**
 * Prompt usage metrics
 * @description Tracks prompt usage for monitoring and optimization
 */
export interface PromptUsageMetrics {
  /** Total requests */
  totalRequests: number;
  /** Requests served from dynamic source */
  dynamicRequests: number;
  /** Requests served from static source */
  staticRequests: number;
  /** Requests served from fallback */
  fallbackRequests: number;
  /** Average resolution time (ms) */
  avgResolutionTimeMs: number;
  /** Error count */
  errorCount: number;
}

/**
 * Prompt request metrics
 * @description Individual request metrics for logging
 */
export interface PromptRequestMetrics {
  /** Request timestamp */
  timestamp: Date;
  /** Prompt type requested */
  promptType: PromptType;
  /** Source used */
  source: PromptSource;
  /** Resolution time in milliseconds */
  resolutionTimeMs: number;
  /** Whether request was successful */
  success: boolean;
  /** Error message if failed */
  errorMessage?: string;
  /** Context information */
  context: {
    companyId?: string | null;
    documentFormatId?: string | null;
    documentId?: string;
  };
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Prompt provider error codes
 */
export enum PromptProviderErrorCode {
  /** Prompt type not supported */
  UNSUPPORTED_TYPE = 'UNSUPPORTED_TYPE',
  /** Dynamic resolution failed */
  RESOLUTION_FAILED = 'RESOLUTION_FAILED',
  /** No prompt found for context */
  NOT_FOUND = 'NOT_FOUND',
  /** Provider not available */
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
  /** Configuration error */
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
}

/**
 * Prompt provider error
 * @description Custom error for prompt provider failures
 */
export class PromptProviderError extends Error {
  constructor(
    message: string,
    public readonly code: PromptProviderErrorCode,
    public readonly context?: PromptRequestContext,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'PromptProviderError';
  }
}

// ============================================================================
// Metrics Collector Interface
// ============================================================================

/**
 * 度量收集器介面
 * @description
 *   定義度量收集器的契約，用於追蹤 Prompt 請求的使用情況。
 *   實現者可以選擇將度量存儲到記憶體、資料庫或外部監控系統。
 */
export interface IMetricsCollector {
  /**
   * 記錄請求度量
   * @param metrics - 請求度量資料
   */
  recordRequest(metrics: PromptRequestMetrics): void;
}
