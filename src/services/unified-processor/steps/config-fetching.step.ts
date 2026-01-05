/**
 * @fileoverview Step 5: 配置獲取
 * @description
 *   獲取處理所需的動態配置：
 *   - Prompt 配置（三層解析：Format → Company → Global）
 *   - 欄位映射配置（三層優先級）
 *   - 支援並行獲取以優化效能
 *
 *   CHANGE-005 調整（2026-01-05）：
 *   步驟順序從 Step 6 調整為 Step 5。
 *   現在執行順序：發行者識別(Step 3) → 格式匹配(Step 4) → 配置獲取(Step 5) → Azure DI(Step 6)
 *   此步驟在 Azure DI 提取之前執行，提供後續步驟所需的配置。
 *
 * @module src/services/unified-processor/steps
 * @since Epic 15 - Story 15.3 (整合 Story 14.3, 13.5)
 * @lastModified 2026-01-05
 *
 * @changes
 *   - 2026-01-05 (CHANGE-005): 步驟順序從 Step 6 調整為 Step 5
 *
 * @related
 *   - src/services/unified-processor/adapters/config-fetcher-adapter.ts - 配置獲取適配器
 *   - src/types/dynamic-config.ts - 類型定義
 *   - src/services/prompt-resolver.service.ts - Prompt 解析服務
 *   - src/services/mapping/config-resolver.ts - 欄位映射配置解析
 */

import {
  ProcessingStep,
  StepPriority,
  StepConfig,
  StepResult,
  UnifiedProcessingContext,
  UnifiedProcessorFlags,
} from '@/types/unified-processor';
import { BaseStepHandler } from '../interfaces/step-handler.interface';
import { configFetcherAdapter } from '../adapters/config-fetcher-adapter';
import {
  ConfigSource,
  type DynamicConfigContext,
  type ConfigFetchOptions,
  type UnifiedDynamicConfig,
} from '@/types/dynamic-config';
import { ResolutionVariableType } from '@/types/prompt-resolution';
import type { PromptType } from '@prisma/client';
import type {
  TransformType,
  TransformParams,
  ConfigScope,
} from '@/types/field-mapping';

/**
 * 配置獲取步驟輸出數據
 * @note 包含 index signature 以支援 Record<string, unknown>
 */
interface ConfigFetchingStepOutput {
  /** 是否成功獲取 Prompt 配置 */
  hasPromptConfig: boolean;
  /** 是否成功獲取欄位映射配置 */
  hasMappingConfig: boolean;
  /** 應用的 Prompt 層級數量 */
  promptLayersCount: number;
  /** 欄位映射規則數量 */
  mappingRulesCount: number;
  /** 配置來源 */
  configSources: ConfigSource[];
  /** 解析耗時（毫秒） */
  resolutionTimeMs: number;
  /** 是否使用快取 */
  cached: boolean;
  /** Index signature for Record<string, unknown> compatibility */
  [key: string]: unknown;
}

/**
 * 配置獲取步驟
 * @description
 *   使用 ConfigFetcherAdapter 整合現有的配置服務：
 *   - prompt-resolver.service.ts - Prompt 三層解析
 *   - config-resolver.ts - 欄位映射配置解析
 */
export class ConfigFetchingStep extends BaseStepHandler {
  readonly step = ProcessingStep.CONFIG_FETCHING;
  readonly priority = StepPriority.OPTIONAL;

  constructor(config: StepConfig) {
    super(config);
  }

  /**
   * 檢查是否應該執行
   * @description 根據 flags.enableDynamicConfig 決定
   */
  shouldExecute(
    context: UnifiedProcessingContext,
    flags: UnifiedProcessorFlags
  ): boolean {
    if (!super.shouldExecute(context, flags)) {
      return false;
    }

    return flags.enableDynamicConfig;
  }

  /**
   * 執行配置獲取
   * @description
   *   1. 構建配置上下文（companyId, documentFormatId, documentType）
   *   2. 使用 ConfigFetcherAdapter 並行獲取 Prompt 和 Mapping 配置
   *   3. 更新處理上下文
   */
  protected async doExecute(
    context: UnifiedProcessingContext,
    flags: UnifiedProcessorFlags
  ): Promise<StepResult> {
    const startTime = Date.now();

    try {
      // 構建配置上下文
      const configContext = this.buildConfigContext(context);

      // 構建獲取選項
      const options = this.buildFetchOptions(flags);

      // 使用適配器獲取配置
      const fetchResult = await configFetcherAdapter.fetchFromContext(
        configContext,
        options
      );

      // 處理獲取結果
      if (!fetchResult.success || !fetchResult.config) {
        // 配置獲取失敗不應阻塞處理，記錄警告並繼續
        context.warnings.push({
          step: this.step,
          message: fetchResult.error ?? 'Config fetching returned no config',
          timestamp: new Date().toISOString(),
        });

        return this.createSuccessResult(
          this.buildEmptyOutput(fetchResult.processingTimeMs),
          startTime
        );
      }

      // 更新上下文
      this.updateContext(context, fetchResult.config);

      // 構建輸出數據
      const outputData = this.buildOutputData(fetchResult.config);

      // 添加配置來源信息到日誌
      this.logConfigResolution(context, fetchResult.config);

      return this.createSuccessResult(outputData, startTime);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      // 配置獲取失敗不應阻塞處理，記錄警告
      context.warnings.push({
        step: this.step,
        message: `Config fetching error: ${err.message}`,
        timestamp: new Date().toISOString(),
      });

      // 返回成功但標記無配置
      return this.createSuccessResult(
        this.buildEmptyOutput(Date.now() - startTime),
        startTime
      );
    }
  }

  /**
   * 構建配置上下文
   */
  private buildConfigContext(
    context: UnifiedProcessingContext
  ): DynamicConfigContext {
    // 從 extractedData 中獲取 documentType
    // 轉換 null → undefined 以符合 DynamicConfigContext 類型
    const documentType =
      context.extractedData?.documentIssuer?.companyName ??
      context.extractedData?.invoiceData?.vendorName ??
      undefined;

    return {
      companyId: context.companyId ?? null,
      documentFormatId: context.documentFormatId ?? null,
      documentType,
      contextVariables: this.extractContextVariables(context),
    };
  }

  /**
   * 從處理上下文提取變數
   */
  private extractContextVariables(
    context: UnifiedProcessingContext
  ): Record<string, string> {
    const variables: Record<string, string> = {};

    // 添加可用的上下文變數
    if (context.companyName) {
      variables['companyName'] = context.companyName;
    }
    if (context.documentFormatName) {
      variables['formatName'] = context.documentFormatName;
    }
    if (context.documentFormatName) {
      variables['documentType'] = context.documentFormatName;
    }
    if (context.processingMethod) {
      variables['processingMethod'] = context.processingMethod;
    }

    return variables;
  }

  /**
   * 構建獲取選項
   */
  private buildFetchOptions(
    flags: UnifiedProcessorFlags
  ): Partial<ConfigFetchOptions> {
    // 根據 flags 決定要獲取哪些配置
    return {
      fetchPromptConfig: flags.enableDynamicConfig,
      fetchMappingConfig: flags.enableDynamicConfig,
      promptType: 'DATA_EXTRACTION' as PromptType, // 默認使用資料提取 Prompt
    };
  }

  /**
   * 更新處理上下文
   * @description
   *   將獲取的動態配置轉換並設置到處理上下文中。
   *   注意：由於類型系統差異，需要進行轉換：
   *   - ResolvedPromptConfig → ResolvedPromptResult
   *   - ResolvedFieldMappingConfig → VisualMappingConfig
   */
  private updateContext(
    context: UnifiedProcessingContext,
    config: UnifiedDynamicConfig
  ): void {
    // 設置 Prompt 配置
    // 注意：ResolvedPromptConfig 和 ResolvedPromptResult 類型不同
    // 這裡需要進行轉換，將 ConfigReplacedVariable 轉換為 ReplacedVariable
    if (config.promptConfig) {
      context.resolvedPrompt = {
        systemPrompt: config.promptConfig.systemPrompt,
        userPromptTemplate: config.promptConfig.userPromptTemplate,
        appliedLayers: config.promptConfig.appliedLayers.map((layer) => ({
          scope: layer.scope,
          configId: layer.configId,
          configName: layer.configName,
          mergeStrategy: layer.mergeStrategy,
        })),
        replacedVariables: config.promptConfig.replacedVariables.map((v) => ({
          name: v.name,
          type:
            v.source === 'static'
              ? ResolutionVariableType.STATIC
              : v.source === 'dynamic'
                ? ResolutionVariableType.DYNAMIC
                : ResolutionVariableType.CONTEXT,
          placeholder: `{{${v.name}}}`,
          value: v.value,
        })),
        metadata: {
          resolutionTimeMs: config.metadata.resolutionTimeMs,
          cached: config.metadata.cached,
          queriedConfigs: config.metadata.queriedConfigs,
          mergedConfigs: config.promptConfig.appliedLayers.length,
        },
      };
    }

    // 設置欄位映射配置
    // 注意：ResolvedFieldMappingConfig 和 VisualMappingConfig 類型不同
    // 這裡需要進行轉換，添加 VisualMappingConfig 所需的額外欄位
    if (config.fieldMappingConfig) {
      const now = new Date().toISOString();
      context.mappingConfig = {
        id: config.fieldMappingConfig.configId,
        scope: this.convertSourceToScope(config.fieldMappingConfig.source),
        name: config.fieldMappingConfig.configName,
        rules: config.fieldMappingConfig.rules.map((rule) => ({
          id: rule.id,
          configId: config.fieldMappingConfig!.configId,
          sourceFields: rule.sourceFields,
          targetField: rule.targetField,
          transformType: rule.transformType as TransformType,
          transformParams: (rule.transformParams ?? {}) as TransformParams,
          priority: rule.priority,
          isActive: rule.isActive,
          createdAt: now,
          updatedAt: now,
        })),
        isActive: true,
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
    }
  }

  /**
   * 將 ConfigSource 轉換為 ConfigScope
   */
  private convertSourceToScope(source: ConfigSource): ConfigScope {
    switch (source) {
      case ConfigSource.FORMAT:
        return 'FORMAT';
      case ConfigSource.COMPANY:
        return 'COMPANY';
      case ConfigSource.GLOBAL:
      case ConfigSource.DEFAULT:
      default:
        return 'GLOBAL';
    }
  }

  /**
   * 構建輸出數據
   */
  private buildOutputData(config: UnifiedDynamicConfig): ConfigFetchingStepOutput {
    const configSources = config.metadata.appliedLayers.map((layer) => layer.source);
    const uniqueSources = [...new Set(configSources)];

    return {
      hasPromptConfig: !!config.promptConfig,
      hasMappingConfig: !!config.fieldMappingConfig,
      promptLayersCount: config.promptConfig?.appliedLayers?.length ?? 0,
      mappingRulesCount: config.fieldMappingConfig?.rules?.length ?? 0,
      configSources: uniqueSources,
      resolutionTimeMs: config.metadata.resolutionTimeMs,
      cached: config.metadata.cached,
    };
  }

  /**
   * 構建空輸出
   */
  private buildEmptyOutput(processingTimeMs: number): ConfigFetchingStepOutput {
    return {
      hasPromptConfig: false,
      hasMappingConfig: false,
      promptLayersCount: 0,
      mappingRulesCount: 0,
      configSources: [],
      resolutionTimeMs: processingTimeMs,
      cached: false,
    };
  }

  /**
   * 記錄配置解析信息
   */
  private logConfigResolution(
    context: UnifiedProcessingContext,
    config: UnifiedDynamicConfig
  ): void {
    // 如果有應用的層級，記錄到上下文供調試
    if (config.metadata.appliedLayers.length > 0) {
      const layerInfo = config.metadata.appliedLayers
        .map((l) => `${l.source}:${l.configName ?? l.configId}`)
        .join(' → ');

      context.warnings.push({
        step: this.step,
        message: `Config resolution: ${layerInfo}`,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
