/**
 * @fileoverview Step 5: 格式匹配
 * @description
 *   匹配或創建文件格式（Document Format）：
 *   - 根據發行者和文件特徵匹配現有格式
 *   - 自動創建新格式（如果 autoCreateFormat 啟用）
 *
 * @module src/services/unified-processor/steps
 * @since Epic 15 - Story 15.1 (整合 Story 0.9)
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
// import { matchOrCreateFormat } from '@/services/document-format.service';

/**
 * 格式匹配步驟
 */
export class FormatMatchingStep extends BaseStepHandler {
  readonly step = ProcessingStep.FORMAT_MATCHING;
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

    // 需要 companyId 才能匹配格式
    if (!context.companyId) {
      return false;
    }

    return flags.enableFormatMatching;
  }

  /**
   * 執行格式匹配
   */
  protected async doExecute(
    context: UnifiedProcessingContext,
    flags: UnifiedProcessorFlags
  ): Promise<StepResult> {
    const startTime = Date.now();

    try {
      if (!context.companyId) {
        throw new Error('Company ID not available. Run ISSUER_IDENTIFICATION step first.');
      }

      // 調用格式匹配服務
      const formatResult = await this.matchOrCreateFormat(
        context.companyId,
        context.extractedData,
        flags.autoCreateFormat
      );

      // 更新上下文
      context.documentFormatId = formatResult.formatId;
      context.documentFormatName = formatResult.formatName;
      context.isNewFormat = formatResult.isNewFormat;

      return this.createSuccessResult(
        {
          formatId: formatResult.formatId,
          formatName: formatResult.formatName,
          isNewFormat: formatResult.isNewFormat,
          matchConfidence: formatResult.matchConfidence,
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
   * 匹配或創建文件格式
   * @description 暫時實現，後續整合現有服務
   */
  private async matchOrCreateFormat(
    companyId: string,
    extractedData: UnifiedProcessingContext['extractedData'],
    autoCreate: boolean
  ): Promise<{
    formatId: string;
    formatName: string;
    isNewFormat: boolean;
    matchConfidence: number;
  }> {
    // TODO: 整合現有的 document-format.service.ts
    await new Promise((resolve) => setTimeout(resolve, 50));

    return {
      formatId: '',
      formatName: 'Unknown Format',
      isNewFormat: false,
      matchConfidence: 0,
    };
  }
}
