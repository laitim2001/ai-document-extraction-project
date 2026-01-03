/**
 * @fileoverview Step 3: Azure DI 提取
 * @description
 *   使用 Azure Document Intelligence 提取結構化數據：
 *   - 調用 Azure DI prebuilt-invoice 模型
 *   - 提取發票欄位和行項目
 *   - 記錄提取信心度
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
  UnifiedProcessingMethod,
  LineItemData,
} from '@/types/unified-processor';
import { BaseStepHandler } from '../interfaces/step-handler.interface';

// 導入現有服務（將在後續整合）
// import { extractWithAzureDI } from '@/services/azure-di.service';

/**
 * Azure DI 提取步驟
 */
export class AzureDiExtractionStep extends BaseStepHandler {
  readonly step = ProcessingStep.AZURE_DI_EXTRACTION;
  readonly priority = StepPriority.REQUIRED;

  constructor(config: StepConfig) {
    super(config);
  }

  /**
   * 檢查是否應該執行
   * @description 只有 DUAL_PROCESSING 和 AZURE_DI_ONLY 需要執行此步驟
   */
  shouldExecute(
    context: UnifiedProcessingContext,
    flags: UnifiedProcessorFlags
  ): boolean {
    if (!super.shouldExecute(context, flags)) {
      return false;
    }

    // GPT_VISION_ONLY 模式不需要 Azure DI
    return context.processingMethod !== UnifiedProcessingMethod.GPT_VISION_ONLY;
  }

  /**
   * 執行 Azure DI 提取
   */
  protected async doExecute(
    context: UnifiedProcessingContext,
    _flags: UnifiedProcessorFlags
  ): Promise<StepResult> {
    const startTime = Date.now();

    try {
      const { fileBuffer, mimeType } = context.input;

      // 調用 Azure DI 服務
      // TODO: 整合現有的 azure-di.service.ts
      const extractionResult = await this.callAzureDI(fileBuffer, mimeType);

      // 更新上下文
      context.extractedData = {
        ...context.extractedData,
        invoiceData: extractionResult.invoiceData,
        lineItems: extractionResult.lineItems,
        rawAzureResponse: extractionResult.rawResponse,
      };

      return this.createSuccessResult(
        {
          fieldsExtracted: Object.keys(extractionResult.invoiceData || {}).length,
          lineItemsCount: extractionResult.lineItems?.length ?? 0,
          confidence: extractionResult.avgConfidence,
        },
        startTime
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return this.createFailedResult(startTime, err);
    }
  }

  /**
   * 調用 Azure Document Intelligence
   * @description 暫時實現，後續整合現有服務
   */
  private async callAzureDI(
    fileBuffer: Buffer,
    mimeType: string
  ): Promise<{
    invoiceData: Record<string, unknown>;
    lineItems: LineItemData[];
    rawResponse: unknown;
    avgConfidence: number;
  }> {
    // TODO: 整合現有的 azure-di.service.ts
    // 目前返回空結果，待後續 Story 15.2 整合

    // 模擬 API 調用延遲
    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      invoiceData: {},
      lineItems: [],
      rawResponse: {},
      avgConfidence: 0,
    };
  }
}
