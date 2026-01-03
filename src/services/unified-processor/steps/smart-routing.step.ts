/**
 * @fileoverview Step 2: 智能路由決策
 * @description
 *   根據文件類型決定處理方法：
 *   - NATIVE_PDF → DUAL_PROCESSING (GPT Classification + Azure DI)
 *   - SCANNED_PDF → GPT_VISION_ONLY
 *   - IMAGE → GPT_VISION_ONLY
 *
 * @module src/services/unified-processor/steps
 * @since Epic 15 - Story 15.1
 * @lastModified 2026-01-03
 */

import {
  ProcessingStep,
  StepPriority,
  StepConfig,
  StepResult,
  UnifiedProcessingContext,
  UnifiedProcessorFlags,
  UnifiedFileType,
  UnifiedProcessingMethod,
} from '@/types/unified-processor';
import { BaseStepHandler } from '../interfaces/step-handler.interface';

/**
 * 智能路由決策步驟
 */
export class SmartRoutingStep extends BaseStepHandler {
  readonly step = ProcessingStep.SMART_ROUTING;
  readonly priority = StepPriority.REQUIRED;

  constructor(config: StepConfig) {
    super(config);
  }

  /**
   * 執行智能路由決策
   */
  protected async doExecute(
    context: UnifiedProcessingContext,
    _flags: UnifiedProcessorFlags
  ): Promise<StepResult> {
    const startTime = Date.now();

    try {
      const { fileType } = context;

      if (!fileType) {
        throw new Error('File type not detected. Run FILE_TYPE_DETECTION step first.');
      }

      // 根據文件類型決定處理方法
      const processingMethod = this.determineProcessingMethod(fileType);

      // 更新上下文
      context.processingMethod = processingMethod;

      return this.createSuccessResult(
        {
          fileType,
          processingMethod,
          reasoning: this.getRoutingReasoning(fileType, processingMethod),
        },
        startTime
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return this.createFailedResult(startTime, err);
    }
  }

  /**
   * 決定處理方法
   */
  private determineProcessingMethod(fileType: UnifiedFileType): UnifiedProcessingMethod {
    switch (fileType) {
      case UnifiedFileType.NATIVE_PDF:
        // Native PDF: GPT 分類 + Azure DI 數據提取
        return UnifiedProcessingMethod.DUAL_PROCESSING;

      case UnifiedFileType.SCANNED_PDF:
      case UnifiedFileType.IMAGE:
        // Scanned PDF 和 Image: 純 GPT Vision
        return UnifiedProcessingMethod.GPT_VISION_ONLY;

      default:
        // 預設使用 Azure DI
        return UnifiedProcessingMethod.AZURE_DI_ONLY;
    }
  }

  /**
   * 取得路由決策理由
   */
  private getRoutingReasoning(
    fileType: UnifiedFileType,
    method: UnifiedProcessingMethod
  ): string {
    switch (method) {
      case UnifiedProcessingMethod.DUAL_PROCESSING:
        return `Native PDF detected: Using GPT Vision for classification (issuer, format) and Azure DI for structured data extraction`;

      case UnifiedProcessingMethod.GPT_VISION_ONLY:
        return `${fileType === UnifiedFileType.SCANNED_PDF ? 'Scanned PDF' : 'Image'} detected: Using GPT Vision for full extraction`;

      case UnifiedProcessingMethod.AZURE_DI_ONLY:
        return `Using Azure Document Intelligence for structured data extraction`;

      default:
        return `Unknown processing method: ${method}`;
    }
  }
}
