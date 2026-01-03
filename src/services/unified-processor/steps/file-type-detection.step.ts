/**
 * @fileoverview Step 1: 文件類型檢測
 * @description
 *   檢測上傳文件的類型（Native PDF / Scanned PDF / Image）
 *   - 使用 file-type 庫檢測 MIME 類型
 *   - 對 PDF 進行文字層檢測以區分 Native 和 Scanned
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
} from '@/types/unified-processor';
import { BaseStepHandler } from '../interfaces/step-handler.interface';

/**
 * 文件類型檢測步驟
 */
export class FileTypeDetectionStep extends BaseStepHandler {
  readonly step = ProcessingStep.FILE_TYPE_DETECTION;
  readonly priority = StepPriority.REQUIRED;

  constructor(config: StepConfig) {
    super(config);
  }

  /**
   * 執行文件類型檢測
   */
  protected async doExecute(
    context: UnifiedProcessingContext,
    _flags: UnifiedProcessorFlags
  ): Promise<StepResult> {
    const startTime = Date.now();

    try {
      const { mimeType, fileBuffer } = context.input;

      // 根據 MIME 類型判斷
      let fileType: UnifiedFileType;

      if (mimeType === 'application/pdf') {
        // PDF 需要進一步檢測是否有文字層
        const hasTextLayer = await this.detectPdfTextLayer(fileBuffer);
        fileType = hasTextLayer ? UnifiedFileType.NATIVE_PDF : UnifiedFileType.SCANNED_PDF;
      } else if (mimeType.startsWith('image/')) {
        fileType = UnifiedFileType.IMAGE;
      } else {
        throw new Error(`Unsupported file type: ${mimeType}`);
      }

      // 更新上下文
      context.fileType = fileType;

      return this.createSuccessResult(
        {
          fileType,
          mimeType,
          hasTextLayer: fileType === UnifiedFileType.NATIVE_PDF,
        },
        startTime
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return this.createFailedResult(startTime, err);
    }
  }

  /**
   * 檢測 PDF 是否有文字層
   * @description
   *   簡化檢測：檢查 PDF 內容中是否包含文字流標記
   *   實際實現應使用 pdf-parse 或類似庫
   */
  private async detectPdfTextLayer(fileBuffer: Buffer): Promise<boolean> {
    try {
      // 將 Buffer 轉為字串（部分內容）檢查 PDF 結構
      const pdfContent = fileBuffer.toString('binary', 0, Math.min(fileBuffer.length, 50000));

      // 檢查是否包含文字流標記
      // Native PDF 通常包含 /Font 和 /Text 或 BT...ET 文字塊
      const hasFont = pdfContent.includes('/Font');
      const hasTextBlock = pdfContent.includes('BT') && pdfContent.includes('ET');
      const hasTextObject = pdfContent.includes('/Type /Page') && hasFont;

      // 如果有字型定義和文字塊，視為 Native PDF
      return hasFont && (hasTextBlock || hasTextObject);
    } catch {
      // 無法檢測時預設為 Scanned
      return false;
    }
  }
}
