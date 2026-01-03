/**
 * @fileoverview Step 8: 欄位映射
 * @description
 *   執行三層欄位映射：
 *   - Tier 1: Universal Mapping（通用層）
 *   - Tier 2: Company-Specific Override（公司特定覆蓋層）
 *   - Tier 3: LLM Classification（AI 智能分類）
 *
 * @module src/services/unified-processor/steps
 * @since Epic 15 - Story 15.1 (整合 Story 13.5)
 * @lastModified 2026-01-03
 */

import {
  ProcessingStep,
  StepPriority,
  StepConfig,
  StepResult,
  UnifiedProcessingContext,
  UnifiedProcessorFlags,
  MappedFieldValue,
  UnmappedField,
} from '@/types/unified-processor';
import { BaseStepHandler } from '../interfaces/step-handler.interface';

// 導入現有服務
// import { applyFieldMapping } from '@/services/dynamic-field-mapping.service';

/**
 * 欄位映射步驟
 */
export class FieldMappingStep extends BaseStepHandler {
  readonly step = ProcessingStep.FIELD_MAPPING;
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

    // 需要有提取數據才能進行映射
    const hasExtractedData = Boolean(
      context.extractedData?.invoiceData ||
      context.extractedData?.gptExtraction
    );

    return hasExtractedData;
  }

  /**
   * 執行欄位映射
   */
  protected async doExecute(
    context: UnifiedProcessingContext,
    _flags: UnifiedProcessorFlags
  ): Promise<StepResult> {
    const startTime = Date.now();

    try {
      // 準備輸入數據
      const rawData = {
        ...context.extractedData?.invoiceData,
        ...context.extractedData?.gptExtraction,
      };

      // 執行三層映射
      const mappingResult = await this.applyThreeTierMapping(
        rawData,
        context.mappingConfig,
        context.companyId
      );

      // 更新上下文
      context.mappedFields = mappingResult.mappedFields;
      context.unmappedFields = mappingResult.unmappedFields;

      return this.createSuccessResult(
        {
          mappedCount: mappingResult.mappedFields.length,
          unmappedCount: mappingResult.unmappedFields.length,
          tier1Matches: mappingResult.stats.tier1,
          tier2Matches: mappingResult.stats.tier2,
          tier3Matches: mappingResult.stats.tier3,
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
   * 執行三層欄位映射
   * @description 暫時實現，後續整合 dynamic-field-mapping.service.ts
   */
  private async applyThreeTierMapping(
    rawData: Record<string, unknown>,
    mappingConfig: UnifiedProcessingContext['mappingConfig'],
    companyId?: string
  ): Promise<{
    mappedFields: MappedFieldValue[];
    unmappedFields: UnmappedField[];
    stats: {
      tier1: number;
      tier2: number;
      tier3: number;
    };
  }> {
    // TODO: 整合現有的 dynamic-field-mapping.service.ts
    await new Promise((resolve) => setTimeout(resolve, 50));

    // 將原始數據轉換為 MappedFieldValue 格式
    // 使用現有的 MappedFieldValue 結構（from src/types/field-mapping.ts）
    const mappedFields: MappedFieldValue[] = Object.entries(rawData).map(
      ([key, value]) => ({
        targetField: key,
        value: typeof value === 'string' || typeof value === 'number' ? value : null,
        sourceFields: [key],
        originalValues: [typeof value === 'string' || typeof value === 'number' ? value : null],
        transformType: 'DIRECT' as const,
        success: true,
      })
    );

    return {
      mappedFields,
      unmappedFields: [],
      stats: {
        tier1: mappedFields.length,
        tier2: 0,
        tier3: 0,
      },
    };
  }
}
