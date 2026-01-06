/**
 * @fileoverview Step 7: GPT 增強提取
 * @description
 *   使用 GPT Vision 增強提取效果：
 *   - DUAL_PROCESSING: 分類識別（issuer, format）
 *   - GPT_VISION_ONLY: 完整數據提取
 *   - CHANGE-006: 支援動態 Prompt 配置和額外欄位提取
 *
 * @module src/services/unified-processor/steps
 * @since Epic 15 - Story 15.1 (整合 Story 14.4)
 * @lastModified 2026-01-06
 *
 * @features
 *   - 雙重處理模式：GPT 分類 + Azure DI 提取
 *   - 完整提取模式：GPT Vision 完整提取
 *   - 動態 Prompt 支援：讀取 context.resolvedPrompt
 *   - 額外欄位提取：extraCharges, typeOfService 等
 *
 * @related
 *   - src/services/gpt-vision.service.ts - GPT Vision 服務
 *   - claudedocs/4-changes/feature-changes/CHANGE-006-gpt-vision-dynamic-config-extraction.md
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
} from '@/types/unified-processor';
import { BaseStepHandler } from '../interfaces/step-handler.interface';

// 導入 GPT Vision 服務
import {
  classifyDocument,
  processImageWithVision,
  type ProcessingOptions,
  type ClassificationResult,
  type InvoiceExtractionResult,
} from '@/services/gpt-vision.service';

/**
 * GPT 額外提取的欄位結構
 * @description CHANGE-006: 定義 GPT 可提取的額外欄位
 */
export interface GptExtraFields {
  /** 額外費用（如 DHL 的 Analysis of Extra Charges） */
  extraCharges?: Array<{
    description: string;
    amount?: number;
    currency?: string;
  }>;
  /** 服務類型 */
  typeOfService?: string;
  /** 其他動態欄位 */
  [key: string]: unknown;
}

/**
 * GPT 增強提取步驟
 * @description
 *   CHANGE-006: 實現動態 Prompt 配置和額外欄位提取
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
   * @description
   *   CHANGE-006: 使用 GPT Vision 進行文件分類
   *   - 識別 documentIssuer（發行公司）
   *   - 識別 documentFormat（文件類型）
   *   - 讀取 context.resolvedPrompt 作為自定義 Prompt
   */
  private async performClassification(
    context: UnifiedProcessingContext
  ): Promise<{
    extractedFields: Record<string, unknown>;
    confidence: number;
    mode: 'classification';
  }> {
    const { input, resolvedPrompt, companyId, documentFormatId } = context;

    // 準備臨時圖片文件
    const tempFilePath = await this.prepareImageFromBuffer(
      input.fileBuffer,
      input.fileName
    );

    try {
      // 構建處理選項
      const options: ProcessingOptions = {
        companyId,
        documentFormatId,
        documentId: input.fileId,
        // 如果有動態 Prompt 配置，則不強制使用靜態
        forceStaticPrompt: !resolvedPrompt?.userPromptTemplate,
      };

      console.log(
        `[Step 7] performClassification: fileId=${input.fileId}, hasResolvedPrompt=${!!resolvedPrompt}`
      );

      // 調用 GPT Vision 分類服務
      const result: ClassificationResult = await classifyDocument(
        tempFilePath,
        {},
        options
      );

      if (!result.success) {
        throw new Error(result.error || 'Classification failed');
      }

      // 構建提取欄位結果
      const extractedFields: Record<string, unknown> = {
        documentIssuer: result.documentIssuer,
        documentFormat: result.documentFormat,
      };

      // 計算信心度（使用 issuer 和 format 的平均信心度）
      const issuerConfidence = result.documentIssuer?.confidence || 0;
      const formatConfidence = result.documentFormat?.formatConfidence || 0;
      const avgConfidence = (issuerConfidence + formatConfidence) / 2 / 100; // 轉為 0-1

      console.log(
        `[Step 7] Classification complete: issuer=${result.documentIssuer?.name}, confidence=${avgConfidence}`
      );

      return {
        extractedFields,
        confidence: avgConfidence,
        mode: 'classification',
      };
    } finally {
      // 清理臨時文件
      await this.cleanupTempFile(tempFilePath);
    }
  }

  /**
   * 執行完整提取
   * @description
   *   CHANGE-006: 使用 GPT Vision 進行完整數據提取
   *   - 提取標準發票欄位
   *   - 根據 resolvedPrompt 配置提取額外欄位（extraCharges, typeOfService）
   *   - 提取的額外欄位將存入 gptExtraction 供 Step 9 使用
   */
  private async performFullExtraction(
    context: UnifiedProcessingContext
  ): Promise<{
    extractedFields: Record<string, unknown>;
    confidence: number;
    mode: 'full_extraction';
  }> {
    const { input, resolvedPrompt, extractedData, companyId, documentFormatId } = context;

    // 準備臨時圖片文件
    const tempFilePath = await this.prepareImageFromBuffer(
      input.fileBuffer,
      input.fileName
    );

    try {
      // 構建處理選項
      const options: ProcessingOptions = {
        companyId,
        documentFormatId,
        documentId: input.fileId,
        // 如果有動態 Prompt 配置，則不強制使用靜態
        forceStaticPrompt: !resolvedPrompt?.userPromptTemplate,
      };

      console.log(
        `[Step 7] performFullExtraction: fileId=${input.fileId}, hasResolvedPrompt=${!!resolvedPrompt}, hasRawText=${!!extractedData?.rawText}`
      );

      // 調用 GPT Vision 完整提取服務
      const result: InvoiceExtractionResult = await processImageWithVision(
        tempFilePath,
        {},
        options
      );

      if (!result.success) {
        throw new Error(result.error || 'Full extraction failed');
      }

      // 構建提取欄位結果
      const extractedFields: Record<string, unknown> = {
        // 標準欄位
        documentIssuer: result.documentIssuer,
        documentFormat: result.documentFormat,
        invoiceData: result.invoiceData,
        extractedTerms: result.extractedTerms,
        // 額外欄位（CHANGE-006）
        ...(this.extractExtraFields(result)),
      };

      console.log(
        `[Step 7] Full extraction complete: confidence=${result.confidence}, extraFields=${Object.keys(this.extractExtraFields(result)).join(',')}`
      );

      return {
        extractedFields,
        confidence: result.confidence,
        mode: 'full_extraction',
      };
    } finally {
      // 清理臨時文件
      await this.cleanupTempFile(tempFilePath);
    }
  }

  /**
   * 從 GPT 結果中提取額外欄位
   * @description CHANGE-006: 提取 extraCharges, typeOfService 等動態欄位
   */
  private extractExtraFields(result: InvoiceExtractionResult): GptExtraFields {
    const extraFields: GptExtraFields = {};

    // 從 invoiceData 或其他地方提取額外欄位
    const invoiceData = result.invoiceData as Record<string, unknown> | undefined;

    if (invoiceData) {
      // 提取 extraCharges（如 DHL 的 Analysis of Extra Charges）
      if (Array.isArray(invoiceData.extraCharges)) {
        extraFields.extraCharges = invoiceData.extraCharges.map((charge: Record<string, unknown>) => ({
          description: String(charge.description || ''),
          amount: typeof charge.amount === 'number' ? charge.amount : undefined,
          currency: typeof charge.currency === 'string' ? charge.currency : undefined,
        }));
      }

      // 提取 typeOfService
      if (typeof invoiceData.typeOfService === 'string') {
        extraFields.typeOfService = invoiceData.typeOfService;
      }

      // 提取其他動態欄位（以 extra_ 開頭的欄位）
      for (const [key, value] of Object.entries(invoiceData)) {
        if (key.startsWith('extra_') && value !== undefined) {
          extraFields[key] = value;
        }
      }
    }

    return extraFields;
  }

  /**
   * 將 Buffer 轉換為臨時圖片文件
   * @description 因為 GPT Vision 服務需要文件路徑
   */
  private async prepareImageFromBuffer(
    buffer: Buffer,
    fileName: string
  ): Promise<string> {
    // 創建臨時目錄
    const tempDir = path.join(os.tmpdir(), `gpt-step7-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    // 確定文件擴展名
    const ext = path.extname(fileName) || '.pdf';
    const tempFilePath = path.join(tempDir, `input${ext}`);

    // 寫入臨時文件
    await fs.writeFile(tempFilePath, buffer);

    console.log(`[Step 7] Created temp file: ${tempFilePath}`);
    return tempFilePath;
  }

  /**
   * 清理臨時文件
   */
  private async cleanupTempFile(filePath: string): Promise<void> {
    try {
      const tempDir = path.dirname(filePath);
      await fs.rm(tempDir, { recursive: true, force: true });
      console.log(`[Step 7] Cleaned up temp directory: ${tempDir}`);
    } catch (error) {
      console.warn(`[Step 7] Failed to cleanup temp file: ${filePath}`, error);
    }
  }
}
