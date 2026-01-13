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
 * @lastModified 2026-01-13
 *
 * @updated Epic 16 - Story 16.6
 *   - 整合 DynamicMappingService
 *   - 完成 applyThreeTierMapping 方法實作
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
import { dynamicMappingService } from '@/services/mapping';
import type { ExtractedFieldValue, MappingContext } from '@/types/field-mapping';

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
        context.companyId,
        context.documentFormatId
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
   * @description 整合 DynamicMappingService 執行三層配置優先級映射
   * @param rawData 原始提取數據
   * @param mappingConfig 映射配置（來自 context）
   * @param companyId 公司 ID
   * @param documentFormatId 文件格式 ID
   * @returns 映射結果
   */
  private async applyThreeTierMapping(
    rawData: Record<string, unknown>,
    mappingConfig: UnifiedProcessingContext['mappingConfig'],
    companyId?: string,
    documentFormatId?: string
  ): Promise<{
    mappedFields: MappedFieldValue[];
    unmappedFields: UnmappedField[];
    stats: {
      tier1: number;
      tier2: number;
      tier3: number;
    };
  }> {
    // 1. 將原始數據轉換為 ExtractedFieldValue 格式
    const extractedFields: ExtractedFieldValue[] = this.convertToExtractedFields(rawData);

    // 2. 如果沒有提取的欄位，返回空結果
    if (extractedFields.length === 0) {
      return {
        mappedFields: [],
        unmappedFields: [],
        stats: { tier1: 0, tier2: 0, tier3: 0 },
      };
    }

    // 3. 準備映射上下文
    const mappingContext: MappingContext = {
      companyId,
      documentFormatId,
      enableCache: true,
    };

    // 4. 調用 DynamicMappingService 執行映射
    const result = await dynamicMappingService.mapFields(extractedFields, mappingContext);

    // 5. 轉換未映射欄位為 UnmappedField 格式
    const unmappedFields: UnmappedField[] = result.unmappedFields.map((fieldName) => ({
      fieldName,
      originalValue: rawData[fieldName],
      reason: '未找到匹配的映射規則',
    }));

    // 6. 計算統計（根據 appliedConfig 的 scope 分類）
    const stats = this.calculateMappingStats(result.mappedFields);

    return {
      mappedFields: result.mappedFields,
      unmappedFields,
      stats,
    };
  }

  /**
   * 將原始數據轉換為 ExtractedFieldValue 格式
   * @description 將 GPT/Azure DI 提取的 Record 轉換為 ExtractedFieldValue[]
   */
  private convertToExtractedFields(
    rawData: Record<string, unknown>
  ): ExtractedFieldValue[] {
    const fields: ExtractedFieldValue[] = [];

    for (const [key, value] of Object.entries(rawData)) {
      // 跳過 null/undefined
      if (value === null || value === undefined) {
        continue;
      }

      // 跳過系統內部欄位
      if (key.startsWith('_') || key === 'confidence' || key === 'rawResponse') {
        continue;
      }

      // 跳過複雜物件（lineItems 等）
      if (typeof value === 'object' && !Array.isArray(value)) {
        continue;
      }

      // 轉換為 ExtractedFieldValue
      fields.push({
        fieldName: key,
        value: typeof value === 'string' || typeof value === 'number' ? value : null,
        source: 'AI',
      });
    }

    return fields;
  }

  /**
   * 計算映射統計
   * @description 根據 appliedConfig 的 scope 統計各層級的映射數量
   */
  private calculateMappingStats(
    mappedFields: MappedFieldValue[]
  ): { tier1: number; tier2: number; tier3: number } {
    const stats = { tier1: 0, tier2: 0, tier3: 0 };

    for (const field of mappedFields) {
      if (!field.success || !field.appliedConfig) {
        continue;
      }

      switch (field.appliedConfig.scope) {
        case 'GLOBAL':
          stats.tier1++;
          break;
        case 'COMPANY':
          stats.tier2++;
          break;
        case 'FORMAT':
          stats.tier3++;
          break;
        default:
          stats.tier1++; // 預設計入 tier1
      }
    }

    return stats;
  }
}
