/**
 * @fileoverview 混合 Prompt 提供者服務
 * @description
 *   實現動態和靜態 Prompt 的混合策略：
 *   1. 根據 Feature Flags 決定使用動態或靜態 Prompt
 *   2. 動態 Prompt 失敗時自動降級到靜態 Prompt
 *   3. 提供統一的 Prompt 獲取介面
 *
 *   Feature Flag 邏輯：
 *   - FEATURE_DYNAMIC_PROMPT=true: 主開關
 *   - 各類型單獨開關（ISSUER/TERM/FIELD/VALIDATION）
 *
 * @module src/services/hybrid-prompt-provider
 * @since Epic 14 - Story 14-4 (GPT Vision 服務整合)
 * @lastModified 2026-01-03
 *
 * @features
 *   - Feature Flag 驅動的 Prompt 選擇
 *   - 動態 Prompt 解析（PromptResolver）
 *   - 靜態 Prompt 備援
 *   - 自動降級機制
 *   - 請求度量追蹤
 *
 * @dependencies
 *   - src/config/feature-flags.ts - Feature Flag 配置
 *   - src/services/prompt-resolver.service.ts - 動態解析服務
 *   - src/services/static-prompts.ts - 靜態 Prompt 定義
 *
 * @related
 *   - src/services/prompt-provider.interface.ts - 介面定義
 *   - src/services/gpt-vision.service.ts - 使用者
 */

import { PromptType } from '@/types/prompt-config';
import type { ResolvedPromptResult } from '@/types/prompt-resolution';
import {
  shouldUseDynamicPrompt,
  getFeatureFlags,
  getFeatureFlagStatus,
} from '@/config/feature-flags';
import { PromptResolverService } from './prompt-resolver.service';
import { getStaticPrompt, hasStaticPrompt, interpolatePrompt } from './static-prompts';
import type {
  IPromptProvider,
  PromptRequestContext,
  PromptResult,
  PromptProviderStatus,
  PromptSource,
  PromptVersionInfo,
  PromptRequestMetrics,
  IMetricsCollector,
} from './prompt-provider.interface';

// ============================================================================
// Types
// ============================================================================

/**
 * HybridPromptProvider 配置選項
 */
export interface HybridPromptProviderOptions {
  /** 是否啟用度量收集 */
  enableMetrics?: boolean;
  /** 是否記錄調試資訊 */
  enableDebugLogging?: boolean;
  /** 動態解析超時（毫秒） */
  dynamicResolutionTimeoutMs?: number;
}

// ============================================================================
// Service Implementation
// ============================================================================

/**
 * 混合 Prompt 提供者
 * @description
 *   根據 Feature Flags 和可用性在動態和靜態 Prompt 之間智能切換
 */
export class HybridPromptProvider implements IPromptProvider {
  private readonly dynamicResolver: PromptResolverService | null;
  private readonly options: Required<HybridPromptProviderOptions>;
  private metricsCollector: IMetricsCollector | null = null;
  private lastUpdated: Date = new Date();

  constructor(
    dynamicResolver: PromptResolverService | null,
    options: HybridPromptProviderOptions = {}
  ) {
    this.dynamicResolver = dynamicResolver;
    this.options = {
      enableMetrics: options.enableMetrics ?? true,
      enableDebugLogging: options.enableDebugLogging ?? false,
      dynamicResolutionTimeoutMs: options.dynamicResolutionTimeoutMs ?? 5000,
    };
  }

  /**
   * 設置度量收集器
   * @param collector - 度量收集器實例
   */
  setMetricsCollector(collector: IMetricsCollector): void {
    this.metricsCollector = collector;
  }

  /**
   * 獲取指定上下文的 Prompt
   *
   * @description
   *   決策流程：
   *   1. 檢查 Feature Flag 是否啟用動態 Prompt
   *   2. 如果啟用且有動態解析器，嘗試動態解析
   *   3. 動態解析失敗或未啟用時，使用靜態 Prompt
   *
   * @param context - 請求上下文
   * @returns Prompt 結果
   */
  async getPrompt(context: PromptRequestContext): Promise<PromptResult> {
    const startTime = Date.now();
    const { promptType, companyId, documentFormatId, documentId, contextVariables } = context;

    let source: PromptSource = 'static';
    let result: PromptResult;
    let errorMessage: string | undefined;

    try {
      // 1. 檢查是否應使用動態 Prompt
      if (shouldUseDynamicPrompt(promptType) && this.dynamicResolver) {
        this.log(`[HybridPromptProvider] 使用動態 Prompt: ${promptType}`);

        try {
          // 2. 嘗試動態解析
          const dynamicResult = await this.resolveDynamicPrompt(context);
          source = 'dynamic';
          result = this.convertToPromptResult(dynamicResult, source);
        } catch (dynamicError) {
          // 3. 動態解析失敗，降級到靜態
          this.log(
            `[HybridPromptProvider] 動態解析失敗，降級到靜態: ${(dynamicError as Error).message}`
          );
          source = 'fallback';
          result = this.getStaticPromptResult(promptType, contextVariables);
          errorMessage = (dynamicError as Error).message;
        }
      } else {
        // 4. 直接使用靜態 Prompt
        this.log(`[HybridPromptProvider] 使用靜態 Prompt: ${promptType}`);
        result = this.getStaticPromptResult(promptType, contextVariables);
      }

      // 5. 記錄度量
      this.recordMetrics({
        timestamp: new Date(),
        promptType,
        source,
        resolutionTimeMs: Date.now() - startTime,
        success: true,
        context: { companyId, documentFormatId, documentId },
      });

      return result;
    } catch (error) {
      // 6. 最終錯誤處理
      errorMessage = (error as Error).message;
      this.log(`[HybridPromptProvider] 錯誤: ${errorMessage}`);

      this.recordMetrics({
        timestamp: new Date(),
        promptType,
        source: 'fallback',
        resolutionTimeMs: Date.now() - startTime,
        success: false,
        errorMessage,
        context: { companyId, documentFormatId, documentId },
      });

      // 嘗試返回靜態 Prompt 作為最後備援
      if (hasStaticPrompt(promptType)) {
        return this.getStaticPromptResult(promptType, contextVariables);
      }

      throw error;
    }
  }

  /**
   * 檢查是否支援指定的 Prompt 類型
   */
  supportsPromptType(promptType: PromptType): boolean {
    return hasStaticPrompt(promptType);
  }

  /**
   * 獲取提供者狀態
   */
  getStatus(): PromptProviderStatus {
    const flags = getFeatureFlags();
    const hasDynamicResolver = this.dynamicResolver !== null;

    let activeSource: PromptSource = 'static';
    if (flags.dynamicPromptEnabled && hasDynamicResolver) {
      activeSource = 'dynamic';
    }

    return {
      name: 'HybridPromptProvider',
      available: true,
      activeSource,
      featureFlags: {
        dynamicEnabled: flags.dynamicPromptEnabled,
        issuerEnabled: flags.dynamicIssuerPromptEnabled,
        termEnabled: flags.dynamicTermPromptEnabled,
        fieldEnabled: flags.dynamicFieldPromptEnabled,
        validationEnabled: flags.dynamicValidationPromptEnabled,
      },
      lastUpdated: this.lastUpdated,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * 解析動態 Prompt
   */
  private async resolveDynamicPrompt(
    context: PromptRequestContext
  ): Promise<ResolvedPromptResult> {
    if (!this.dynamicResolver) {
      throw new Error('Dynamic resolver not available');
    }

    const { promptType, companyId, documentFormatId, contextVariables } = context;

    // 使用超時包裝
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Dynamic resolution timeout after ${this.options.dynamicResolutionTimeoutMs}ms`));
      }, this.options.dynamicResolutionTimeoutMs);
    });

    const resolvePromise = this.dynamicResolver.resolve({
      promptType,
      companyId: companyId ?? undefined,
      documentFormatId: documentFormatId ?? undefined,
      contextVariables,
    });

    return Promise.race([resolvePromise, timeoutPromise]);
  }

  /**
   * 獲取靜態 Prompt 結果
   */
  private getStaticPromptResult(
    promptType: PromptType,
    contextVariables?: Record<string, unknown>
  ): PromptResult {
    const staticResult = getStaticPrompt(promptType);

    // 如果有上下文變數，進行替換
    if (contextVariables) {
      const stringVars: Record<string, string | number | boolean> = {};
      for (const [key, value] of Object.entries(contextVariables)) {
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          stringVars[key] = value;
        } else if (value !== null && value !== undefined) {
          stringVars[key] = JSON.stringify(value);
        }
      }

      return {
        ...staticResult,
        systemPrompt: interpolatePrompt(staticResult.systemPrompt, stringVars),
        userPrompt: interpolatePrompt(staticResult.userPrompt, stringVars),
      };
    }

    return staticResult;
  }

  /**
   * 轉換動態解析結果為 PromptResult
   */
  private convertToPromptResult(
    resolved: ResolvedPromptResult,
    source: PromptSource
  ): PromptResult {
    const versionInfo: PromptVersionInfo = {
      versionId: `dynamic-${Date.now()}`,
      versionNumber: 1,
      timestamp: new Date(),
      configIds: resolved.appliedLayers.map(layer => layer.configId),
    };

    return {
      systemPrompt: resolved.systemPrompt,
      userPrompt: resolved.userPromptTemplate,
      source,
      appliedLayers: resolved.appliedLayers.map(
        layer => `${layer.scope}:${layer.configName}`
      ),
      version: versionInfo,
    };
  }

  /**
   * 記錄請求度量
   */
  private recordMetrics(metrics: PromptRequestMetrics): void {
    if (this.options.enableMetrics && this.metricsCollector) {
      this.metricsCollector.recordRequest(metrics);
    }
  }

  /**
   * 記錄調試日誌
   */
  private log(message: string): void {
    if (this.options.enableDebugLogging) {
      console.log(message);
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * 創建 HybridPromptProvider 實例
 *
 * @description
 *   工廠函數用於創建配置完整的 HybridPromptProvider。
 *   如果提供 dynamicResolver，則支援動態 Prompt；
 *   否則只使用靜態 Prompt。
 *
 * @param dynamicResolver - 可選的動態解析器
 * @param options - 配置選項
 * @returns HybridPromptProvider 實例
 *
 * @example
 * ```typescript
 * // 僅靜態模式
 * const provider = createHybridPromptProvider(null);
 *
 * // 混合模式
 * const resolver = await createPromptResolver();
 * const provider = createHybridPromptProvider(resolver, {
 *   enableMetrics: true,
 *   enableDebugLogging: true
 * });
 * ```
 */
export function createHybridPromptProvider(
  dynamicResolver: PromptResolverService | null,
  options?: HybridPromptProviderOptions
): HybridPromptProvider {
  return new HybridPromptProvider(dynamicResolver, options);
}

/**
 * 創建僅靜態的 Prompt 提供者
 *
 * @description
 *   便捷函數，創建只使用靜態 Prompt 的提供者。
 *   適用於測試或動態功能未啟用的場景。
 *
 * @returns HybridPromptProvider 實例（僅靜態模式）
 */
export function createStaticOnlyProvider(): HybridPromptProvider {
  return new HybridPromptProvider(null, {
    enableMetrics: false,
    enableDebugLogging: false,
  });
}
