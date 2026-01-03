/**
 * @fileoverview Step 10: 信心度計算（7 維度增強版）
 * @description
 *   使用 7 維度加權信心度計算系統：
 *   - EXTRACTION (25%): OCR/GPT 提取品質
 *   - ISSUER_IDENTIFICATION (15%): 發行商識別準確度
 *   - FORMAT_MATCHING (15%): 文件格式匹配程度
 *   - CONFIG_MATCH (10%): 配置來源匹配
 *   - HISTORICAL_ACCURACY (15%): 歷史準確率
 *   - FIELD_COMPLETENESS (10%): 欄位完整性
 *   - TERM_MATCHING (10%): 術語匹配程度
 *
 * @module src/services/unified-processor/steps
 * @since Epic 15 - Story 15.1
 * @lastModified 2026-01-03
 *
 * @features
 *   - 7 維度加權信心度計算
 *   - 配置來源加成機制
 *   - 詳細的維度分數明細
 *   - 與 ConfidenceCalculatorAdapter 整合
 *
 * @related
 *   - src/services/unified-processor/adapters/confidence-calculator-adapter.ts
 *   - src/types/confidence.ts
 */

import {
  ProcessingStep,
  StepPriority,
  StepConfig,
  StepResult,
  UnifiedProcessingContext,
  UnifiedProcessorFlags,
} from '@/types/unified-processor';
import {
  type ConfidenceCalculationResult,
  type ConfidenceCalculationInput,
  ConfigSource,
} from '@/types/confidence';
import { BaseStepHandler } from '../interfaces/step-handler.interface';
import {
  ConfidenceCalculatorAdapter,
  type ConfidenceCalculatorOptions,
} from '../adapters/confidence-calculator-adapter';

// ============================================================================
// Types
// ============================================================================

/**
 * 信心度計算步驟配置
 */
export interface ConfidenceCalculationStepConfig extends StepConfig {
  /** 信心度計算適配器選項 */
  calculatorOptions?: ConfidenceCalculatorOptions;
}

// ============================================================================
// Step Implementation
// ============================================================================

/**
 * 信心度計算步驟（7 維度增強版）
 * @description
 *   使用 ConfidenceCalculatorAdapter 進行 7 維度信心度計算：
 *   1. 從上下文提取各維度輸入數據
 *   2. 使用適配器計算加權信心度
 *   3. 將結果寫入上下文供後續步驟使用
 */
export class ConfidenceCalculationStep extends BaseStepHandler {
  readonly step = ProcessingStep.CONFIDENCE_CALCULATION;
  readonly priority = StepPriority.REQUIRED;

  private readonly calculator: ConfidenceCalculatorAdapter;

  constructor(config: ConfidenceCalculationStepConfig) {
    super(config);

    // 創建信心度計算適配器
    this.calculator = new ConfidenceCalculatorAdapter(config.calculatorOptions);
  }

  /**
   * 執行信心度計算
   */
  protected async doExecute(
    context: UnifiedProcessingContext,
    flags: UnifiedProcessorFlags
  ): Promise<StepResult> {
    const startTime = Date.now();

    try {
      // 建構信心度計算輸入
      const input = this.buildCalculationInput(context, flags);

      // 使用適配器計算信心度
      const result = this.calculator.calculate(input);

      // 更新上下文
      this.updateContext(context, result);

      // 記錄步驟結果
      return this.createSuccessResult(
        {
          overallScore: result.overallScore,
          level: result.level,
          dimensions: result.dimensions,
          configSourceBonus: result.configSourceBonus,
          configSource: result.configSource,
          hasWarnings: result.hasWarnings,
          warnings: result.warnings,
          // 用於向下兼容
          overallConfidence: result.overallScore / 100, // 轉換為 0-1 範圍
          breakdown: this.convertToLegacyBreakdown(result),
        },
        startTime
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return this.createFailedResult(startTime, err);
    }
  }

  /**
   * 從上下文建構信心度計算輸入
   */
  private buildCalculationInput(
    context: UnifiedProcessingContext,
    _flags: UnifiedProcessorFlags
  ): ConfidenceCalculationInput {
    const input: ConfidenceCalculationInput = {
      processedFileId: context.input?.fileId ?? context.input?.batchId ?? '',
    };

    // 1. 提取品質（來自 Azure DI 或 GPT）
    input.extractionConfidence = this.extractExtractionConfidence(context);

    // 2. 發行商識別
    input.issuerIdentification = this.extractIssuerIdentification(context);

    // 3. 格式匹配
    input.formatMatching = this.extractFormatMatching(context);

    // 4. 配置來源
    input.configInfo = this.extractConfigInfo(context);

    // 5. 歷史準確率
    input.historicalData = this.extractHistoricalData(context);

    // 6. 欄位完整性
    input.fieldCompleteness = this.extractFieldCompleteness(context);

    // 7. 術語匹配
    input.termMatching = this.extractTermMatching(context);

    return input;
  }

  /**
   * 提取 OCR/GPT 提取品質信心度
   */
  private extractExtractionConfidence(
    context: UnifiedProcessingContext
  ): number | undefined {
    // 優先使用 GPT Vision 信心度
    if (context.extractedData?.gptConfidence !== undefined) {
      return (context.extractedData.gptConfidence as number) * 100;
    }

    // 次選 Azure DI 信心度
    if (context.extractedData?.rawAzureResponse) {
      return this.extractAzureConfidence(
        context.extractedData.rawAzureResponse as Record<string, unknown>
      );
    }

    return undefined;
  }

  /**
   * 從 Azure 響應提取平均信心度
   */
  private extractAzureConfidence(
    response: Record<string, unknown>
  ): number | undefined {
    const documents = response.documents as Array<{
      fields?: Record<string, { confidence?: number }>;
    }>;

    if (!documents || documents.length === 0) {
      return undefined;
    }

    const fields = documents[0]?.fields;
    if (!fields) {
      return undefined;
    }

    const confidences: number[] = [];
    for (const field of Object.values(fields)) {
      if (typeof field.confidence === 'number') {
        confidences.push(field.confidence * 100); // 轉換為百分比
      }
    }

    if (confidences.length === 0) {
      return undefined;
    }

    return confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
  }

  /**
   * 提取發行商識別結果
   */
  private extractIssuerIdentification(
    context: UnifiedProcessingContext
  ): ConfidenceCalculationInput['issuerIdentification'] {
    const issuerData = context.extractedData?.issuerIdentification as {
      identified?: boolean;
      confidence?: number;
      method?: string;
    };

    if (!issuerData) {
      return undefined;
    }

    return {
      identified: issuerData.identified ?? false,
      confidence: (issuerData.confidence ?? 0) * 100,
      method: issuerData.method ?? 'unknown',
    };
  }

  /**
   * 提取格式匹配結果
   */
  private extractFormatMatching(
    context: UnifiedProcessingContext
  ): ConfidenceCalculationInput['formatMatching'] {
    // 從步驟結果中獲取格式匹配信息
    const formatResult = context.stepResults?.find(
      (r) => r.step === ProcessingStep.FORMAT_MATCHING
    );
    if (formatResult?.success && formatResult.data) {
      const data = formatResult.data as {
        matched?: boolean;
        confidence?: number;
        formatId?: string;
      };
      return {
        matched: data.matched ?? false,
        confidence: (data.confidence ?? 0) * 100,
        formatId: data.formatId,
      };
    }

    // 備選：從上下文的 documentFormatId 判斷
    if (context.documentFormatId) {
      return {
        matched: true,
        confidence: context.isNewFormat ? 70 : 90,
        formatId: context.documentFormatId,
      };
    }

    return undefined;
  }

  /**
   * 提取配置來源信息
   */
  private extractConfigInfo(
    context: UnifiedProcessingContext
  ): ConfidenceCalculationInput['configInfo'] {
    // 從步驟結果中獲取配置信息
    const configResult = context.stepResults?.find(
      (r) => r.step === ProcessingStep.CONFIG_FETCHING
    );
    if (configResult?.success && configResult.data) {
      const data = configResult.data as {
        source?: string;
        configId?: string;
      };
      return {
        source: this.mapToConfigSource(data.source),
        configId: data.configId,
      };
    }

    // 根據上下文推斷配置來源
    if (context.companyId && context.documentFormatId) {
      return { source: ConfigSource.COMPANY };
    }
    if (context.documentFormatId) {
      return { source: ConfigSource.FORMAT };
    }

    return { source: ConfigSource.DEFAULT };
  }

  /**
   * 映射配置來源字符串到枚舉
   */
  private mapToConfigSource(source?: string): ConfigSource {
    switch (source?.toUpperCase()) {
      case 'SPECIFIC':
        return ConfigSource.SPECIFIC;
      case 'COMPANY':
        return ConfigSource.COMPANY;
      case 'FORMAT':
        return ConfigSource.FORMAT;
      case 'GLOBAL':
        return ConfigSource.GLOBAL;
      default:
        return ConfigSource.DEFAULT;
    }
  }

  /**
   * 提取歷史準確率數據
   */
  private extractHistoricalData(
    context: UnifiedProcessingContext
  ): ConfidenceCalculationInput['historicalData'] {
    // 從術語記錄步驟獲取歷史數據
    const termResult = context.stepResults?.find(
      (r) => r.step === ProcessingStep.TERM_RECORDING
    );
    if (termResult?.success && termResult.data) {
      const data = termResult.data as {
        historicalStats?: {
          totalProcessed: number;
          successfullyMapped: number;
          averageAccuracy: number;
        };
      };
      if (data.historicalStats) {
        return data.historicalStats;
      }
    }

    // 無歷史數據
    return undefined;
  }

  /**
   * 提取欄位完整性信息
   */
  private extractFieldCompleteness(
    context: UnifiedProcessingContext
  ): ConfidenceCalculationInput['fieldCompleteness'] {
    const mappedCount = Object.keys(context.mappedFields ?? {}).length;
    const unmappedCount = context.unmappedFields?.length ?? 0;
    const totalFields = mappedCount + unmappedCount;

    // 假設必填欄位為總欄位的 60%（可配置）
    const requiredFields = Math.ceil(totalFields * 0.6);
    const filledRequiredFields = Math.min(mappedCount, requiredFields);

    return {
      totalFields,
      filledFields: mappedCount,
      requiredFields,
      filledRequiredFields,
    };
  }

  /**
   * 提取術語匹配信息
   */
  private extractTermMatching(
    context: UnifiedProcessingContext
  ): ConfidenceCalculationInput['termMatching'] {
    // 從術語記錄步驟獲取
    const termResult = context.stepResults?.find(
      (r) => r.step === ProcessingStep.TERM_RECORDING
    );
    if (termResult?.success && termResult.data) {
      const data = termResult.data as {
        termStats?: {
          totalTerms: number;
          matchedTerms: number;
          unmatchedTerms: number;
          newTerms: number;
        };
      };
      if (data.termStats) {
        return data.termStats;
      }
    }

    // 備選：從映射結果推算
    const mappedCount = context.mappedFields?.length ?? 0;
    const unmappedCount = context.unmappedFields?.length ?? 0;

    return {
      totalTerms: mappedCount + unmappedCount,
      matchedTerms: mappedCount,
      unmatchedTerms: unmappedCount,
      newTerms: context.isNewFormat ? unmappedCount : 0,
    };
  }

  /**
   * 更新處理上下文
   */
  private updateContext(
    context: UnifiedProcessingContext,
    result: ConfidenceCalculationResult
  ): void {
    // 更新整體信心度（0-1 範圍，向下兼容）
    context.overallConfidence = result.overallScore / 100;

    // 存儲詳細信心度結果
    context.confidenceBreakdown = this.convertToLegacyBreakdown(result);

    // 存儲完整計算結果供其他步驟使用（透過 stepResults 陣列）
    // 注意：實際的步驟結果由 BaseStepHandler 返回，這裡只更新上下文屬性
  }

  /**
   * 轉換為舊版 breakdown 格式（向下兼容）
   */
  private convertToLegacyBreakdown(
    result: ConfidenceCalculationResult
  ): Record<string, { score: number; weight: number; weighted: number }> {
    const breakdown: Record<
      string,
      { score: number; weight: number; weighted: number }
    > = {};

    for (const dim of result.dimensions) {
      breakdown[dim.dimension.toLowerCase()] = {
        score: dim.rawScore / 100, // 轉換為 0-1 範圍
        weight: dim.weight,
        weighted: dim.weightedScore / 100,
      };
    }

    return breakdown;
  }
}
