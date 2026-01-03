/**
 * @fileoverview Legacy 處理器適配器
 * @description
 *   提供與現有 batch-processor 和 processing-router 的向後兼容：
 *   - 當 enableUnifiedProcessor=false 時調用 Legacy 處理器
 *   - 封裝現有服務的調用
 *   - 將 Legacy 結果轉換為 UnifiedProcessingResult
 *
 * @module src/services/unified-processor/adapters
 * @since Epic 15 - Story 15.1
 * @lastModified 2026-01-03
 *
 * @related
 *   - src/services/batch-processor.service.ts - Legacy 批次處理器
 *   - src/services/processing-router.service.ts - Legacy 路由服務
 */

import {
  ProcessFileInput,
  UnifiedProcessingResult,
  UnifiedFileType,
  UnifiedProcessingMethod,
  UnifiedRoutingDecision,
  ProcessingStep,
  UNIFIED_CONFIDENCE_THRESHOLDS,
} from '@/types/unified-processor';

// Legacy 服務導入（實際整合時取消註釋）
// import { batchProcessorService } from '@/services/batch-processor.service';
// import { processingRouterService } from '@/services/processing-router.service';

/**
 * Legacy 處理結果類型
 */
interface LegacyProcessingResult {
  success: boolean;
  fileId: string;
  extractedData?: Record<string, unknown>;
  error?: string;
  processingMethod?: string;
  confidence?: number;
}

/**
 * Legacy 處理器適配器
 * @description 封裝現有處理服務，提供統一介面
 */
export class LegacyProcessorAdapter {
  /**
   * 使用 Legacy 處理器處理文件
   * @param input - 文件輸入
   * @returns 統一處理結果
   */
  async processFile(input: ProcessFileInput): Promise<UnifiedProcessingResult> {
    const startTime = Date.now();

    try {
      // 調用 Legacy 處理器
      const legacyResult = await this.callLegacyProcessor(input);

      // 轉換為統一格式
      return this.convertToUnifiedResult(input, legacyResult, startTime);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return this.createErrorResult(input.fileId, err, startTime);
    }
  }

  /**
   * 調用 Legacy 處理器
   * @description 暫時返回空結果，待整合現有服務
   */
  private async callLegacyProcessor(
    input: ProcessFileInput
  ): Promise<LegacyProcessingResult> {
    // TODO: 整合現有的 batch-processor.service.ts 和 processing-router.service.ts
    // 暫時返回模擬結果
    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      success: true,
      fileId: input.fileId,
      extractedData: {},
      processingMethod: 'LEGACY',
      confidence: 0.5,
    };
  }

  /**
   * 將 Legacy 結果轉換為統一格式
   */
  private convertToUnifiedResult(
    input: ProcessFileInput,
    legacyResult: LegacyProcessingResult,
    startTime: number
  ): UnifiedProcessingResult {
    const totalDurationMs = Date.now() - startTime;

    if (!legacyResult.success) {
      return {
        success: false,
        fileId: input.fileId,
        status: 'FAILED',
        totalDurationMs,
        stepResults: [],
        error: legacyResult.error ?? 'Legacy processing failed',
        warnings: [],
        usedLegacyProcessor: true,
      };
    }

    // 推斷文件類型
    const fileType = this.inferFileType(input.mimeType);

    // 推斷處理方法
    const processingMethod = this.inferProcessingMethod(
      legacyResult.processingMethod
    );

    // 決定路由
    const confidence = legacyResult.confidence ?? 0.5;
    const routingDecision = this.determineRouting(confidence);

    return {
      success: true,
      fileId: input.fileId,
      status: 'COMPLETED',
      totalDurationMs,
      stepResults: [
        {
          step: ProcessingStep.FILE_TYPE_DETECTION,
          success: true,
          durationMs: 0,
          data: { fileType, source: 'legacy' },
        },
      ],
      fileType,
      processingMethod,
      extractedData: {
        invoiceData: legacyResult.extractedData,
      },
      overallConfidence: confidence,
      routingDecision,
      warnings: [],
      usedLegacyProcessor: true,
    };
  }

  /**
   * 創建錯誤結果
   */
  private createErrorResult(
    fileId: string,
    error: Error,
    startTime: number
  ): UnifiedProcessingResult {
    return {
      success: false,
      fileId,
      status: 'FAILED',
      totalDurationMs: Date.now() - startTime,
      stepResults: [],
      error: error.message,
      warnings: [],
      usedLegacyProcessor: true,
    };
  }

  /**
   * 推斷文件類型
   */
  private inferFileType(mimeType: string): UnifiedFileType {
    if (mimeType === 'application/pdf') {
      // Legacy 處理器無法區分 Native/Scanned，預設為 Native
      return UnifiedFileType.NATIVE_PDF;
    }
    if (mimeType.startsWith('image/')) {
      return UnifiedFileType.IMAGE;
    }
    return UnifiedFileType.NATIVE_PDF;
  }

  /**
   * 推斷處理方法
   */
  private inferProcessingMethod(
    legacyMethod?: string
  ): UnifiedProcessingMethod {
    switch (legacyMethod) {
      case 'DUAL_PROCESSING':
        return UnifiedProcessingMethod.DUAL_PROCESSING;
      case 'GPT_VISION':
      case 'GPT_VISION_ONLY':
        return UnifiedProcessingMethod.GPT_VISION_ONLY;
      case 'AZURE_DI':
      case 'AZURE_DI_ONLY':
      default:
        return UnifiedProcessingMethod.AZURE_DI_ONLY;
    }
  }

  /**
   * 決定審核路由
   */
  private determineRouting(confidence: number): UnifiedRoutingDecision {
    if (confidence >= UNIFIED_CONFIDENCE_THRESHOLDS.AUTO_APPROVE) {
      return UnifiedRoutingDecision.AUTO_APPROVE;
    }
    if (confidence >= UNIFIED_CONFIDENCE_THRESHOLDS.QUICK_REVIEW) {
      return UnifiedRoutingDecision.QUICK_REVIEW;
    }
    return UnifiedRoutingDecision.FULL_REVIEW;
  }
}

// 單例導出
export const legacyProcessorAdapter = new LegacyProcessorAdapter();
