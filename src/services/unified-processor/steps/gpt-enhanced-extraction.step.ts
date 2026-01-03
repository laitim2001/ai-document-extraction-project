/**
 * @fileoverview Step 7: GPT 增強提取
 * @description
 *   使用 GPT Vision 增強提取效果：
 *   - DUAL_PROCESSING: 分類識別（issuer, format）
 *   - GPT_VISION_ONLY: 完整數據提取
 *
 * @module src/services/unified-processor/steps
 * @since Epic 15 - Story 15.1 (整合 Story 14.4)
 * @lastModified 2026-01-03
 */

import {
  ProcessingStep,
  StepPriority,
  StepConfig,
  StepResult,
  UnifiedProcessingContext,
  UnifiedProcessorFlags,
  UnifiedProcessingMethod,
} from '@/types/unified-processor';
import { BaseStepHandler } from '../interfaces/step-handler.interface';

// 導入現有服務
// import { extractWithGptVision } from '@/services/gpt-vision.service';

/**
 * GPT 增強提取步驟
 */
export class GptEnhancedExtractionStep extends BaseStepHandler {
  readonly step = ProcessingStep.GPT_ENHANCED_EXTRACTION;
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

    // 根據處理方法決定是否執行
    // DUAL_PROCESSING 和 GPT_VISION_ONLY 都需要 GPT
    return (
      context.processingMethod === UnifiedProcessingMethod.DUAL_PROCESSING ||
      context.processingMethod === UnifiedProcessingMethod.GPT_VISION_ONLY
    );
  }

  /**
   * 執行 GPT 增強提取
   */
  protected async doExecute(
    context: UnifiedProcessingContext,
    _flags: UnifiedProcessorFlags
  ): Promise<StepResult> {
    const startTime = Date.now();

    try {
      const { processingMethod } = context;

      let gptResult: {
        extractedFields: Record<string, unknown>;
        confidence: number;
        mode: 'classification' | 'full_extraction';
      };

      if (processingMethod === UnifiedProcessingMethod.DUAL_PROCESSING) {
        // 雙重處理模式：僅分類識別
        gptResult = await this.performClassification(context);
      } else {
        // GPT Vision Only：完整提取
        gptResult = await this.performFullExtraction(context);
      }

      // 更新上下文
      context.extractedData = {
        ...context.extractedData,
        gptExtraction: gptResult.extractedFields,
        gptConfidence: gptResult.confidence,
      };

      return this.createSuccessResult(
        {
          mode: gptResult.mode,
          fieldsExtracted: Object.keys(gptResult.extractedFields).length,
          confidence: gptResult.confidence,
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
   * 執行分類識別
   * @description 僅識別 issuer 和 format，不提取完整數據
   */
  private async performClassification(
    context: UnifiedProcessingContext
  ): Promise<{
    extractedFields: Record<string, unknown>;
    confidence: number;
    mode: 'classification';
  }> {
    // TODO: 整合現有的 gpt-vision.service.ts
    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      extractedFields: {},
      confidence: 0,
      mode: 'classification',
    };
  }

  /**
   * 執行完整提取
   * @description 使用 GPT Vision 提取所有欄位
   */
  private async performFullExtraction(
    context: UnifiedProcessingContext
  ): Promise<{
    extractedFields: Record<string, unknown>;
    confidence: number;
    mode: 'full_extraction';
  }> {
    // TODO: 整合現有的 gpt-vision.service.ts
    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      extractedFields: {},
      confidence: 0,
      mode: 'full_extraction',
    };
  }
}
