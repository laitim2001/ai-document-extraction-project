/**
 * @fileoverview Step 6: Azure DI 提取
 * @description
 *   使用 Azure Document Intelligence 提取結構化數據：
 *   - 調用 Azure DI prebuilt-invoice 模型
 *   - 提取發票欄位和行項目
 *   - 記錄提取信心度
 *
 *   CHANGE-005 調整（2026-01-05）：
 *   步驟順序從 Step 3 調整為 Step 6。
 *   現在執行順序：發行者識別(Step 3) → 格式匹配(Step 4) → 配置獲取(Step 5) → Azure DI(Step 6)
 *   此步驟可利用 Step 5 的配置進行後續欄位映射。
 *
 * @module src/services/unified-processor/steps
 * @since Epic 15 - Story 15.1
 * @lastModified 2026-01-05
 *
 * @changes
 *   - 2026-01-05 (CHANGE-005): 步驟順序從 Step 3 調整為 Step 6，整合真實 Azure DI 服務
 *
 * @related
 *   - src/services/azure-di.service.ts - Azure DI 服務實現
 *   - src/services/unified-processor/steps/config-fetching.step.ts - 前置配置步驟
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
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

// CHANGE-005: 導入真實 Azure DI 服務
import {
  processPdfWithAzureDI,
  type AzureDIExtractionResult,
} from '@/services/azure-di.service';

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
   * @description
   *   CHANGE-005: 整合真實的 azure-di.service.ts
   *   由於 processPdfWithAzureDI 需要文件路徑，需要先將 buffer 保存為臨時文件
   */
  protected async doExecute(
    context: UnifiedProcessingContext,
    _flags: UnifiedProcessorFlags
  ): Promise<StepResult> {
    const startTime = Date.now();
    let tempFilePath: string | null = null;

    try {
      const { fileBuffer, fileName } = context.input;

      // CHANGE-005: Step 1 - 將文件 Buffer 保存為臨時文件
      tempFilePath = await this.saveBufferToTempFile(fileBuffer, fileName);

      console.log(`[AzureDiExtraction] Step 6: Processing ${fileName} with Azure DI...`);

      // CHANGE-005: Step 2 - 調用真實 Azure DI 服務
      const azureResult = await processPdfWithAzureDI(tempFilePath);

      // CHANGE-005: Step 3 - 轉換結果格式
      const extractionResult = this.convertAzureResult(azureResult);

      // 更新上下文
      context.extractedData = {
        ...context.extractedData,
        invoiceData: extractionResult.invoiceData,
        lineItems: extractionResult.lineItems,
        rawAzureResponse: azureResult,
      };

      console.log(
        `[AzureDiExtraction] Step 6: Extracted ${extractionResult.fieldsCount} fields, ` +
        `${extractionResult.lineItems.length} line items, confidence: ${(azureResult.confidence * 100).toFixed(1)}%`
      );

      return this.createSuccessResult(
        {
          success: azureResult.success,
          fieldsExtracted: extractionResult.fieldsCount,
          lineItemsCount: extractionResult.lineItems.length,
          confidence: azureResult.confidence,
          pageCount: azureResult.pageCount,
        },
        startTime
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`[AzureDiExtraction] Step 6: Error - ${err.message}`);
      return this.createFailedResult(startTime, err);
    } finally {
      // CHANGE-005: 清理臨時文件
      if (tempFilePath) {
        await this.cleanupTempFile(tempFilePath);
      }
    }
  }

  /**
   * 將文件 Buffer 保存為臨時文件
   * @param buffer - 文件 Buffer
   * @param fileName - 原始文件名（用於確定擴展名）
   * @returns 臨時文件路徑
   */
  private async saveBufferToTempFile(
    buffer: Buffer,
    fileName: string
  ): Promise<string> {
    const ext = path.extname(fileName) || '.pdf';
    const tempDir = os.tmpdir();
    const tempFileName = `azure-di-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    const tempFilePath = path.join(tempDir, tempFileName);

    await fs.writeFile(tempFilePath, buffer);
    return tempFilePath;
  }

  /**
   * 清理臨時文件
   * @param filePath - 臨時文件路徑
   */
  private async cleanupTempFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch {
      // 忽略清理失敗（文件可能已被刪除）
      console.warn(`[AzureDiExtraction] Failed to cleanup temp file: ${filePath}`);
    }
  }

  /**
   * 轉換 Azure DI 服務結果為統一格式
   * @description CHANGE-005: 將 AzureDIExtractionResult 轉換為 step 需要的格式
   * @param azureResult - Azure DI 服務返回的結果
   * @returns 統一格式的提取結果
   */
  private convertAzureResult(azureResult: AzureDIExtractionResult): {
    invoiceData: Record<string, unknown>;
    lineItems: LineItemData[];
    fieldsCount: number;
  } {
    const invoiceData = azureResult.invoiceData || {};

    // 轉換 line items 到 LineItemData 格式
    const lineItems: LineItemData[] = (invoiceData.lineItems || []).map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: item.amount,
      // 可擴展更多欄位
    }));

    // 計算提取的欄位數量（排除 lineItems 本身）
    const fieldsCount = Object.keys(invoiceData).filter(
      (key) => key !== 'lineItems' && invoiceData[key as keyof typeof invoiceData] !== undefined
    ).length;

    // 建構統一的 invoiceData 格式
    const unifiedInvoiceData: Record<string, unknown> = {
      invoiceNumber: invoiceData.invoiceNumber,
      invoiceDate: invoiceData.invoiceDate,
      dueDate: invoiceData.dueDate,
      vendorName: invoiceData.vendor?.name,
      vendorAddress: invoiceData.vendor?.address,
      vendorTaxId: invoiceData.vendor?.taxId,
      buyerName: invoiceData.buyer?.name,
      buyerAddress: invoiceData.buyer?.address,
      subtotal: invoiceData.subtotal,
      taxAmount: invoiceData.taxAmount,
      totalAmount: invoiceData.totalAmount,
      currency: invoiceData.currency,
      // 保留原始 lineItems 以供參考
      lineItems: invoiceData.lineItems,
    };

    return {
      invoiceData: unifiedInvoiceData,
      lineItems,
      fieldsCount,
    };
  }
}
