/**
 * @fileoverview 統一文件處理器服務
 * @description
 *   UnifiedDocumentProcessor 是 Epic 15 的核心服務，提供：
 *   - 11 步處理管道的統一入口
 *   - Feature Flag 控制的漸進式部署
 *   - 與 Legacy 處理器的向後兼容
 *   - 完整的處理過程追蹤和錯誤處理
 *
 * @module src/services/unified-processor
 * @since Epic 15 - Story 15.1 (處理流程重構 - 統一入口)
 * @lastModified 2026-01-28
 *
 * @features
 *   - 統一處理入口
 *   - 11 步處理管道
 *   - 中間狀態更新（OCR_PROCESSING / MAPPING_PROCESSING）
 *   - Feature Flag 控制
 *   - Legacy 適配器支援
 *   - 完整錯誤追蹤
 *
 * @dependencies
 *   - src/types/unified-processor.ts - 類型定義
 *   - src/constants/processing-steps.ts - 步驟配置
 *   - src/services/unified-processor/factory/step-factory.ts - 步驟工廠
 *   - src/services/unified-processor/adapters/legacy-processor.adapter.ts - Legacy 適配器
 *
 * @related
 *   - docs/04-implementation/tech-specs/epic-15-unified-processing/tech-spec-story-15-1.md
 */

import {
  ProcessFileInput,
  UnifiedProcessingContext,
  UnifiedProcessingResult,
  UnifiedProcessorFlags,
  StepResult,
  ProcessingStep,
  StepPriority,
} from '@/types/unified-processor';
import {
  DEFAULT_PROCESSOR_FLAGS,
  getStepConfig,
} from '@/constants/processing-steps';
import { getStepHandlerFactory } from './factory/step-factory';
import { legacyProcessorAdapter } from './adapters/legacy-processor.adapter';
import { IStepHandler } from './interfaces/step-handler.interface';
import { prisma } from '@/lib/prisma';

// ============================================================================
// 中間狀態映射（CHANGE-019）
// ============================================================================

/**
 * 管線步驟 → Document 狀態映射
 * 在進入這些關鍵步驟前，更新 Document 狀態以提供即時回饋
 */
const STEP_STATUS_MAP: Partial<Record<ProcessingStep, string>> = {
  [ProcessingStep.AZURE_DI_EXTRACTION]: 'OCR_PROCESSING',
  [ProcessingStep.FIELD_MAPPING]: 'MAPPING_PROCESSING',
};

/**
 * 處理選項
 */
export interface ProcessOptions {
  /** Feature Flags（覆蓋預設值） */
  flags?: Partial<UnifiedProcessorFlags>;
  /** 是否強制使用 Legacy 處理器 */
  forceLegacy?: boolean;
}

/**
 * 統一文件處理器服務
 * @description 提供統一的文件處理入口，整合 11 步處理管道
 */
export class UnifiedDocumentProcessorService {
  /** 當前使用的 Feature Flags */
  private flags: UnifiedProcessorFlags;

  /** 步驟處理器列表 */
  private stepHandlers: IStepHandler[];

  constructor(flags?: Partial<UnifiedProcessorFlags>) {
    this.flags = { ...DEFAULT_PROCESSOR_FLAGS, ...flags };
    this.stepHandlers = getStepHandlerFactory().createAllHandlers();
  }

  /**
   * 處理單個文件
   * @param input - 文件輸入
   * @param options - 處理選項
   * @returns 處理結果
   */
  async processFile(
    input: ProcessFileInput,
    options?: ProcessOptions
  ): Promise<UnifiedProcessingResult> {
    const startTime = Date.now();
    const flags = { ...this.flags, ...options?.flags };

    // 檢查是否使用 Legacy 處理器
    if (options?.forceLegacy || !flags.enableUnifiedProcessor) {
      return this.useLegacyProcessor(input);
    }

    // 創建處理上下文
    const context = this.createContext(input);

    try {
      // 執行 11 步處理管道
      const stepResults = await this.executePipeline(context, flags);

      // 構建處理結果
      return this.buildResult(context, stepResults, startTime);
    } catch (error) {
      // 處理未預期的錯誤
      const err = error instanceof Error ? error : new Error(String(error));
      return this.buildErrorResult(input.fileId, err, context, startTime);
    }
  }

  /**
   * 批量處理文件
   * @param inputs - 文件輸入列表
   * @param options - 處理選項
   * @returns 處理結果列表
   */
  async processFiles(
    inputs: ProcessFileInput[],
    options?: ProcessOptions
  ): Promise<UnifiedProcessingResult[]> {
    // 並行處理所有文件
    return Promise.all(inputs.map((input) => this.processFile(input, options)));
  }

  /**
   * 使用 Legacy 處理器
   */
  private async useLegacyProcessor(
    input: ProcessFileInput
  ): Promise<UnifiedProcessingResult> {
    return legacyProcessorAdapter.processFile(input);
  }

  /**
   * 創建處理上下文
   */
  private createContext(input: ProcessFileInput): UnifiedProcessingContext {
    return {
      input,
      status: 'PROCESSING',
      currentStep: ProcessingStep.FILE_TYPE_DETECTION,
      stepResults: [],
      extractedData: {},
      warnings: [],
      startTime: Date.now(),
    };
  }

  /**
   * 執行處理管道
   * @description 按順序執行所有步驟，處理 REQUIRED/OPTIONAL 邏輯
   */
  private async executePipeline(
    context: UnifiedProcessingContext,
    flags: UnifiedProcessorFlags
  ): Promise<StepResult[]> {
    const stepResults: StepResult[] = [];

    for (const handler of this.stepHandlers) {
      // 更新當前步驟
      context.currentStep = handler.step;

      // CHANGE-019: 在關鍵步驟前更新 Document 狀態，提供即時 UX 回饋
      const intermediateStatus = STEP_STATUS_MAP[handler.step];
      if (intermediateStatus) {
        try {
          await prisma.document.update({
            where: { id: context.input.fileId },
            data: { status: intermediateStatus as import('@prisma/client').DocumentStatus },
          });
        } catch (statusErr) {
          // 狀態更新失敗不應中斷處理管線
          console.warn(
            `[UnifiedProcessor] Failed to update status to ${intermediateStatus} for ${context.input.fileId}:`,
            statusErr
          );
        }
      }

      // 檢查是否應該跳過
      if (!handler.shouldExecute(context, flags)) {
        stepResults.push({
          step: handler.step,
          success: true,
          skipped: true,
          durationMs: 0,
        });
        continue;
      }

      // 執行步驟
      const result = await handler.execute(context, flags);
      stepResults.push(result);
      context.stepResults.push(result);

      // 處理步驟失敗
      if (!result.success && !result.skipped) {
        const stepConfig = getStepConfig(handler.step);

        if (stepConfig?.priority === StepPriority.REQUIRED) {
          // REQUIRED 步驟失敗：中斷整個流程
          context.status = 'FAILED';
          break;
        } else {
          // OPTIONAL 步驟失敗：記錄警告並繼續
          context.warnings.push({
            step: handler.step,
            message: result.error ?? 'Step failed',
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    // 如果沒有失敗，標記為完成
    if (context.status !== 'FAILED') {
      context.status = 'COMPLETED';
    }

    return stepResults;
  }

  /**
   * 構建處理結果
   */
  private buildResult(
    context: UnifiedProcessingContext,
    stepResults: StepResult[],
    startTime: number
  ): UnifiedProcessingResult {
    const totalDurationMs = Date.now() - startTime;

    if (context.status === 'FAILED') {
      // 找到失敗的步驟
      const failedStep = stepResults.find((r) => !r.success && !r.skipped);
      return {
        success: false,
        fileId: context.input.fileId,
        status: 'FAILED',
        totalDurationMs,
        stepResults,
        error: failedStep?.error ?? 'Processing failed',
        warnings: context.warnings,
        usedLegacyProcessor: false,
      };
    }

    return {
      success: true,
      fileId: context.input.fileId,
      status: 'COMPLETED',
      totalDurationMs,
      stepResults,
      fileType: context.fileType,
      processingMethod: context.processingMethod,
      extractedData: context.extractedData,
      companyId: context.companyId,
      companyName: context.companyName,
      isNewCompany: context.isNewCompany,
      documentFormatId: context.documentFormatId,
      documentFormatName: context.documentFormatName,
      isNewFormat: context.isNewFormat,
      mappedFields: context.mappedFields,
      unmappedFields: context.unmappedFields,
      recordedTerms: context.recordedTerms,
      overallConfidence: context.overallConfidence,
      confidenceBreakdown: context.confidenceBreakdown,
      routingDecision: context.routingDecision,
      warnings: context.warnings,
      usedLegacyProcessor: false,
    };
  }

  /**
   * 構建錯誤結果
   */
  private buildErrorResult(
    fileId: string,
    error: Error,
    context: UnifiedProcessingContext | null,
    startTime: number
  ): UnifiedProcessingResult {
    return {
      success: false,
      fileId,
      status: 'FAILED',
      totalDurationMs: Date.now() - startTime,
      stepResults: context?.stepResults ?? [],
      error: error.message,
      warnings: context?.warnings ?? [],
      usedLegacyProcessor: false,
    };
  }

  /**
   * 更新 Feature Flags
   */
  updateFlags(flags: Partial<UnifiedProcessorFlags>): void {
    this.flags = { ...this.flags, ...flags };
  }

  /**
   * 取得當前 Feature Flags
   */
  getFlags(): UnifiedProcessorFlags {
    return { ...this.flags };
  }

  /**
   * 檢查統一處理器是否啟用
   */
  isUnifiedProcessorEnabled(): boolean {
    return this.flags.enableUnifiedProcessor;
  }
}

// ============================================================================
// 服務單例
// ============================================================================

let serviceInstance: UnifiedDocumentProcessorService | null = null;

/**
 * 取得統一文件處理器服務單例
 */
export function getUnifiedDocumentProcessor(
  flags?: Partial<UnifiedProcessorFlags>
): UnifiedDocumentProcessorService {
  if (!serviceInstance) {
    serviceInstance = new UnifiedDocumentProcessorService(flags);
  } else if (flags) {
    serviceInstance.updateFlags(flags);
  }
  return serviceInstance;
}

/**
 * 重置服務單例（用於測試）
 */
export function resetUnifiedDocumentProcessor(): void {
  serviceInstance = null;
}

// 預設導出
export default UnifiedDocumentProcessorService;
