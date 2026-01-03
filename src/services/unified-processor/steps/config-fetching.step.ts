/**
 * @fileoverview Step 6: 配置獲取
 * @description
 *   獲取處理所需的配置：
 *   - Prompt 配置（三層解析：Global → Company → Format）
 *   - 欄位映射配置
 *
 * @module src/services/unified-processor/steps
 * @since Epic 15 - Story 15.1 (整合 Story 14.3, 13.5)
 * @lastModified 2026-01-03
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

// 導入現有服務
// import { resolvePrompt } from '@/services/prompt-resolver.service';
// import { getFieldMappingConfig } from '@/services/field-mapping-config.service';

/**
 * 配置獲取步驟
 */
export class ConfigFetchingStep extends BaseStepHandler {
  readonly step = ProcessingStep.CONFIG_FETCHING;
  readonly priority = StepPriority.OPTIONAL;

  constructor(config: StepConfig) {
    super(config);
  }

  /**
   * 檢查是否應該執行
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
   */
  protected async doExecute(
    context: UnifiedProcessingContext,
    _flags: UnifiedProcessorFlags
  ): Promise<StepResult> {
    const startTime = Date.now();

    try {
      // 並行獲取 Prompt 配置和欄位映射配置
      const [promptConfig, mappingConfig] = await Promise.all([
        this.fetchPromptConfig(context),
        this.fetchMappingConfig(context),
      ]);

      // 更新上下文
      context.resolvedPrompt = promptConfig;
      context.mappingConfig = mappingConfig;

      return this.createSuccessResult(
        {
          hasPromptConfig: !!promptConfig,
          hasMappingConfig: !!mappingConfig,
          promptLayers: promptConfig?.appliedLayers?.length ?? 0,
          mappingRulesCount: mappingConfig?.rules?.length ?? 0,
        },
        startTime
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      context.warnings.push({
        step: this.step,
        message: err.message,
        timestamp: new Date().toISOString(),
      });
      return this.createFailedResult(startTime, err);
    }
  }

  /**
   * 獲取 Prompt 配置
   * @description 暫時實現，後續整合 prompt-resolver.service.ts
   */
  private async fetchPromptConfig(
    context: UnifiedProcessingContext
  ): Promise<UnifiedProcessingContext['resolvedPrompt']> {
    // TODO: 整合現有的 prompt-resolver.service.ts
    await new Promise((resolve) => setTimeout(resolve, 30));

    return undefined;
  }

  /**
   * 獲取欄位映射配置
   * @description 暫時實現，後續整合 field-mapping-config.service.ts
   */
  private async fetchMappingConfig(
    context: UnifiedProcessingContext
  ): Promise<UnifiedProcessingContext['mappingConfig']> {
    // TODO: 整合現有的 field-mapping-config.service.ts
    await new Promise((resolve) => setTimeout(resolve, 30));

    return undefined;
  }
}
