/**
 * @fileoverview Step 9: 術語記錄
 * @description
 *   記錄新發現的術語到三層聚合結構：
 *   - Company > DocumentFormat > Terms
 *   - 用於未來的映射學習和規則建議
 *
 * @module src/services/unified-processor/steps
 * @since Epic 15 - Story 15.1 (整合 Story 0.7)
 * @lastModified 2026-01-03
 */

import {
  ProcessingStep,
  StepPriority,
  StepConfig,
  StepResult,
  UnifiedProcessingContext,
  UnifiedProcessorFlags,
  RecordedTerm,
} from '@/types/unified-processor';
import { BaseStepHandler } from '../interfaces/step-handler.interface';

// 導入現有服務
// import { recordTerms } from '@/services/hierarchical-term-aggregation.service';

/**
 * 術語記錄步驟
 */
export class TermRecordingStep extends BaseStepHandler {
  readonly step = ProcessingStep.TERM_RECORDING;
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

    // 需要有 companyId 和 documentFormatId 才能記錄術語
    if (!context.companyId || !context.documentFormatId) {
      return false;
    }

    // 需要有未映射的欄位
    if (!context.unmappedFields || context.unmappedFields.length === 0) {
      return false;
    }

    return flags.enableTermRecording;
  }

  /**
   * 執行術語記錄
   */
  protected async doExecute(
    context: UnifiedProcessingContext,
    _flags: UnifiedProcessorFlags
  ): Promise<StepResult> {
    const startTime = Date.now();

    try {
      // 收集需要記錄的術語
      const termsToRecord = this.collectTerms(context);

      if (termsToRecord.length === 0) {
        return this.createSuccessResult(
          {
            recordedCount: 0,
            skippedCount: 0,
          },
          startTime
        );
      }

      // 記錄術語
      const recordResult = await this.recordTermsToHierarchy(
        context.companyId!,
        context.documentFormatId!,
        termsToRecord
      );

      // 更新上下文
      context.recordedTerms = recordResult.recorded;

      return this.createSuccessResult(
        {
          recordedCount: recordResult.recorded.length,
          skippedCount: recordResult.skipped,
          newTerms: recordResult.newTerms,
          existingTerms: recordResult.existingTerms,
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
   * 收集需要記錄的術語
   */
  private collectTerms(context: UnifiedProcessingContext): Array<{
    term: string;
    value: unknown;
    source: string;
  }> {
    const terms: Array<{ term: string; value: unknown; source: string }> = [];

    // 從未映射欄位收集
    if (context.unmappedFields) {
      for (const field of context.unmappedFields) {
        terms.push({
          term: field.fieldName,
          value: field.originalValue,
          source: 'unmapped',
        });
      }
    }

    // 從提取數據的行項目收集
    const lineItems = context.extractedData?.lineItems as unknown[];
    if (Array.isArray(lineItems)) {
      for (const item of lineItems) {
        if (typeof item === 'object' && item !== null) {
          const itemObj = item as Record<string, unknown>;
          if (itemObj.description && typeof itemObj.description === 'string') {
            terms.push({
              term: itemObj.description,
              value: itemObj.amount,
              source: 'lineItem',
            });
          }
        }
      }
    }

    return terms;
  }

  /**
   * 記錄術語到階層結構
   * @description 暫時實現，後續整合 hierarchical-term-aggregation.service.ts
   */
  private async recordTermsToHierarchy(
    companyId: string,
    documentFormatId: string,
    terms: Array<{ term: string; value: unknown; source: string }>
  ): Promise<{
    recorded: RecordedTerm[];
    skipped: number;
    newTerms: number;
    existingTerms: number;
  }> {
    // TODO: 整合現有的 hierarchical-term-aggregation.service.ts
    await new Promise((resolve) => setTimeout(resolve, 50));

    return {
      recorded: [],
      skipped: 0,
      newTerms: 0,
      existingTerms: 0,
    };
  }
}
