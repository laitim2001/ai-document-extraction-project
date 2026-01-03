/**
 * @fileoverview 配置獲取適配器
 * @description
 *   將現有的 prompt-resolver.service.ts 和 config-resolver.ts 適配到統一處理流程：
 *   - 封裝現有服務的調用
 *   - 轉換請求/結果格式
 *   - 提供統一的錯誤處理
 *   - 支援 Prompt 配置和欄位映射配置的並行獲取
 *
 * @module src/services/unified-processor/adapters
 * @since Epic 15 - Story 15.3
 * @lastModified 2026-01-03
 *
 * @related
 *   - src/services/prompt-resolver.service.ts - Prompt 解析服務
 *   - src/services/prompt-resolver.factory.ts - Prompt 服務工廠
 *   - src/services/mapping/config-resolver.ts - 欄位映射配置解析
 *   - src/types/dynamic-config.ts - 類型定義
 *   - src/services/unified-processor/steps/config-fetching.step.ts - 使用此適配器
 */

import {
  DynamicConfigContext,
  UnifiedDynamicConfig,
  ConfigFetchRequest,
  ConfigFetchResult,
  ConfigFetchOptions,
  ResolvedPromptConfig,
  ResolvedFieldMappingConfig,
  ConfigSource,
  FieldMappingRule,
  FieldTransformType,
  AppliedConfigLayer,
  DEFAULT_CONFIG_FETCH_OPTIONS,
  createEmptyDynamicConfig,
  buildConfigCacheKey,
} from '@/types/dynamic-config';

import type { PromptType, PromptScope, MergeStrategy } from '@prisma/client';

// 導入現有服務
import { prisma } from '@/lib/prisma';
import { getPromptResolver } from '@/services/prompt-resolver.factory';
import { ConfigResolver, configResolver } from '@/services/mapping/config-resolver';
import type { ResolvedPromptResult, AppliedLayer } from '@/types/prompt-resolution';
import type { ResolvedConfig, EffectiveRule } from '@/types/field-mapping';

/**
 * 配置獲取適配器
 * @description 封裝 Prompt 解析服務和欄位映射配置解析提供統一介面
 */
export class ConfigFetcherAdapter {
  /**
   * 獲取統一動態配置
   * @param request - 配置獲取請求
   * @returns 配置獲取結果
   */
  async fetchConfig(request: ConfigFetchRequest): Promise<ConfigFetchResult> {
    const startTime = Date.now();

    try {
      // 合併選項
      const options = this.mergeOptions(request.options);

      // 並行獲取 Prompt 配置和欄位映射配置
      const [promptConfig, fieldMappingConfig] = await Promise.all([
        options.fetchPromptConfig
          ? this.fetchPromptConfig(request.context, options)
          : Promise.resolve(null),
        options.fetchMappingConfig
          ? this.fetchMappingConfig(request.context)
          : Promise.resolve(null),
      ]);

      // 建立統一配置
      const processingTimeMs = Date.now() - startTime;
      const config = this.buildUnifiedConfig(
        promptConfig,
        fieldMappingConfig,
        processingTimeMs
      );

      return {
        success: true,
        config,
        processingTimeMs,
      };
    } catch (error) {
      const processingTimeMs = Date.now() - startTime;
      return this.createErrorResult(error, processingTimeMs);
    }
  }

  /**
   * 從上下文獲取配置（簡化版本）
   * @description 用於步驟處理器直接調用
   * @param context - 配置上下文
   * @param options - 獲取選項
   * @returns 配置獲取結果
   */
  async fetchFromContext(
    context: DynamicConfigContext,
    options?: Partial<ConfigFetchOptions>
  ): Promise<ConfigFetchResult> {
    return this.fetchConfig({
      context,
      options: options as ConfigFetchOptions,
    });
  }

  /**
   * 檢查是否可以獲取配置
   * @param context - 配置上下文
   * @returns 是否有足夠資訊獲取配置
   */
  canFetch(context: DynamicConfigContext): boolean {
    // 至少需要有一個上下文資訊才能獲取非預設配置
    return !!(
      context.companyId ||
      context.documentFormatId ||
      context.documentType
    );
  }

  /**
   * 取得預設配置選項
   * @returns 預設選項
   */
  getDefaultOptions(): Required<ConfigFetchOptions> {
    return { ...DEFAULT_CONFIG_FETCH_OPTIONS };
  }

  // ============================================================================
  // 私有方法
  // ============================================================================

  /**
   * 合併選項與預設值
   */
  private mergeOptions(
    options?: Partial<ConfigFetchOptions>
  ): Required<ConfigFetchOptions> {
    return {
      ...DEFAULT_CONFIG_FETCH_OPTIONS,
      ...options,
    };
  }

  /**
   * 獲取 Prompt 配置
   * @description 調用 prompt-resolver.service.ts
   */
  private async fetchPromptConfig(
    context: DynamicConfigContext,
    options: Required<ConfigFetchOptions>
  ): Promise<ResolvedPromptConfig | null> {
    try {
      const resolver = getPromptResolver(prisma);

      const result = await resolver.resolve({
        promptType: options.promptType,
        companyId: context.companyId,
        documentFormatId: context.documentFormatId,
        contextVariables: context.contextVariables as Record<string, unknown>,
      });

      return this.convertPromptResult(result, options.promptType);
    } catch (error) {
      console.error('[ConfigFetcherAdapter] Error fetching prompt config:', error);
      return null;
    }
  }

  /**
   * 獲取欄位映射配置
   * @description 調用 config-resolver.ts
   */
  private async fetchMappingConfig(
    context: DynamicConfigContext
  ): Promise<ResolvedFieldMappingConfig | null> {
    try {
      const configs = await configResolver.resolveConfigs({
        companyId: context.companyId ?? undefined,
        documentFormatId: context.documentFormatId ?? undefined,
      });

      if (configs.length === 0) {
        return null;
      }

      return this.convertMappingConfigs(configs);
    } catch (error) {
      console.error('[ConfigFetcherAdapter] Error fetching mapping config:', error);
      return null;
    }
  }

  /**
   * 轉換 Prompt 解析結果
   */
  private convertPromptResult(
    result: ResolvedPromptResult,
    promptType: PromptType
  ): ResolvedPromptConfig {
    return {
      systemPrompt: result.systemPrompt,
      userPromptTemplate: result.userPromptTemplate,
      appliedLayers: result.appliedLayers.map((layer) => ({
        scope: layer.scope,
        configId: layer.configId,
        configName: layer.configName,
        mergeStrategy: layer.mergeStrategy,
      })),
      replacedVariables: result.replacedVariables.map((v) => ({
        name: v.name,
        value: v.value,
        source: this.convertVariableSource(v.type),
      })),
      promptType,
    };
  }

  /**
   * 轉換變數來源
   */
  private convertVariableSource(
    type: string
  ): 'static' | 'dynamic' | 'context' {
    const sourceMap: Record<string, 'static' | 'dynamic' | 'context'> = {
      STATIC: 'static',
      DYNAMIC: 'dynamic',
      CONTEXT: 'context',
    };
    return sourceMap[type] ?? 'context';
  }

  /**
   * 轉換欄位映射配置
   */
  private convertMappingConfigs(
    configs: ResolvedConfig[]
  ): ResolvedFieldMappingConfig {
    // 取得最高優先級的配置（第一個）
    const primaryConfig = configs[0];

    // 合併所有配置的規則
    const mergedRules = ConfigResolver.mergeConfigs(configs);

    return {
      configId: primaryConfig.id,
      configName: primaryConfig.name,
      rules: mergedRules.map((rule) => this.convertMappingRule(rule)),
      source: this.convertConfigScope(primaryConfig.scope),
      effectiveRulesCount: mergedRules.length,
    };
  }

  /**
   * 轉換映射規則
   */
  private convertMappingRule(rule: EffectiveRule): FieldMappingRule {
    return {
      id: rule.id,
      sourceFields: rule.sourceFields,
      targetField: rule.targetField,
      transformType: rule.transformType as FieldTransformType,
      transformParams: rule.transformParams as Record<string, unknown> | undefined,
      priority: rule.priority,
      isActive: rule.isActive,
    };
  }

  /**
   * 轉換配置範圍到 ConfigSource
   */
  private convertConfigScope(scope: string): ConfigSource {
    const scopeMap: Record<string, ConfigSource> = {
      GLOBAL: ConfigSource.GLOBAL,
      COMPANY: ConfigSource.COMPANY,
      FORMAT: ConfigSource.FORMAT,
    };
    return scopeMap[scope] ?? ConfigSource.DEFAULT;
  }

  /**
   * 建立統一配置
   */
  private buildUnifiedConfig(
    promptConfig: ResolvedPromptConfig | null,
    fieldMappingConfig: ResolvedFieldMappingConfig | null,
    processingTimeMs: number
  ): UnifiedDynamicConfig {
    const appliedLayers: AppliedConfigLayer[] = [];

    // 收集 Prompt 配置的層級
    if (promptConfig) {
      for (const layer of promptConfig.appliedLayers) {
        appliedLayers.push({
          source: this.convertPromptScope(layer.scope),
          configId: layer.configId,
          configName: layer.configName,
          mergeStrategy: layer.mergeStrategy,
        });
      }
    }

    // 收集欄位映射配置的層級
    if (fieldMappingConfig) {
      appliedLayers.push({
        source: fieldMappingConfig.source,
        configId: fieldMappingConfig.configId,
        configName: fieldMappingConfig.configName,
      });
    }

    return {
      promptConfig,
      fieldMappingConfig,
      metadata: {
        resolutionTimeMs: processingTimeMs,
        cached: false,
        cacheHitType: 'miss',
        queriedConfigs: appliedLayers.length,
        appliedLayers,
      },
    };
  }

  /**
   * 轉換 PromptScope 到 ConfigSource
   */
  private convertPromptScope(scope: PromptScope): ConfigSource {
    const scopeMap: Record<PromptScope, ConfigSource> = {
      GLOBAL: ConfigSource.GLOBAL,
      COMPANY: ConfigSource.COMPANY,
      FORMAT: ConfigSource.FORMAT,
    };
    return scopeMap[scope];
  }

  /**
   * 創建錯誤結果
   */
  private createErrorResult(
    error: unknown,
    processingTimeMs: number
  ): ConfigFetchResult {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error during config fetching';

    return {
      success: false,
      config: null,
      processingTimeMs,
      error: errorMessage,
    };
  }
}

// 單例導出
export const configFetcherAdapter = new ConfigFetcherAdapter();
