/**
 * @fileoverview 步驟處理器介面定義
 * @description
 *   定義統一處理流程中每個步驟必須實現的介面：
 *   - IStepHandler: 核心處理器介面
 *   - BaseStepHandler: 抽象基類提供共用功能
 *
 * @module src/services/unified-processor/interfaces
 * @since Epic 15 - Story 15.1 (處理流程重構 - 統一入口)
 * @lastModified 2026-01-03
 *
 * @features
 *   - 統一的步驟處理器介面
 *   - 超時控制和重試邏輯
 *   - 步驟結果標準化
 *
 * @related
 *   - src/types/unified-processor.ts - 類型定義
 *   - src/constants/processing-steps.ts - 步驟配置
 */

import {
  ProcessingStep,
  StepPriority,
  StepConfig,
  StepResult,
  UnifiedProcessingContext,
  UnifiedProcessorFlags,
} from '@/types/unified-processor';

// ============================================================================
// Step Handler Interface
// ============================================================================

/**
 * 步驟處理器介面
 * @description 所有處理步驟必須實現此介面
 */
export interface IStepHandler {
  /** 步驟類型 */
  readonly step: ProcessingStep;

  /** 步驟優先級 */
  readonly priority: StepPriority;

  /**
   * 執行步驟處理
   * @param context - 處理上下文
   * @param flags - Feature Flags
   * @returns 步驟執行結果
   */
  execute(
    context: UnifiedProcessingContext,
    flags: UnifiedProcessorFlags
  ): Promise<StepResult>;

  /**
   * 檢查此步驟是否應該執行
   * @param context - 處理上下文
   * @param flags - Feature Flags
   * @returns 是否應該執行
   */
  shouldExecute(
    context: UnifiedProcessingContext,
    flags: UnifiedProcessorFlags
  ): boolean;

  /**
   * 取得步驟配置
   * @returns 步驟配置
   */
  getConfig(): StepConfig;
}

// ============================================================================
// Abstract Base Step Handler
// ============================================================================

/**
 * 步驟處理器抽象基類
 * @description 提供共用功能實現，子類只需實現核心處理邏輯
 */
export abstract class BaseStepHandler implements IStepHandler {
  abstract readonly step: ProcessingStep;
  abstract readonly priority: StepPriority;

  protected readonly config: StepConfig;

  constructor(config: StepConfig) {
    this.config = config;
  }

  /**
   * 執行步驟（模板方法）
   * @description 包裝核心邏輯，提供超時控制和錯誤處理
   */
  async execute(
    context: UnifiedProcessingContext,
    flags: UnifiedProcessorFlags
  ): Promise<StepResult> {
    const startTime = Date.now();

    // 檢查是否應該跳過
    if (!this.shouldExecute(context, flags)) {
      return this.createSkippedResult(startTime);
    }

    // 執行處理（帶重試）
    let lastError: Error | undefined;
    let attempt = 0;
    const maxAttempts = this.config.retryCount + 1;

    while (attempt < maxAttempts) {
      try {
        const result = await this.executeWithTimeout(context, flags);
        return {
          ...result,
          durationMs: Date.now() - startTime,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        attempt++;

        if (attempt < maxAttempts) {
          // 指數退避重試
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await this.sleep(delay);
        }
      }
    }

    // 所有重試都失敗
    return this.createFailedResult(startTime, lastError!);
  }

  /**
   * 帶超時的執行
   */
  private async executeWithTimeout(
    context: UnifiedProcessingContext,
    flags: UnifiedProcessorFlags
  ): Promise<StepResult> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Step ${this.step} timed out after ${this.config.timeout}ms`));
      }, this.config.timeout);
    });

    const executionPromise = this.doExecute(context, flags);

    return Promise.race([executionPromise, timeoutPromise]);
  }

  /**
   * 核心處理邏輯（由子類實現）
   * @param context - 處理上下文
   * @param flags - Feature Flags
   * @returns 步驟執行結果
   */
  protected abstract doExecute(
    context: UnifiedProcessingContext,
    flags: UnifiedProcessorFlags
  ): Promise<StepResult>;

  /**
   * 檢查步驟是否應該執行
   * @description 預設實現，子類可覆寫
   */
  shouldExecute(
    context: UnifiedProcessingContext,
    flags: UnifiedProcessorFlags
  ): boolean {
    // 檢查步驟是否啟用
    if (!this.config.enabled) {
      return false;
    }

    // 檢查是否已經失敗（對於可選步驟，前面的必要步驟失敗則跳過）
    if (context.status === 'FAILED') {
      return false;
    }

    return true;
  }

  /**
   * 取得步驟配置
   */
  getConfig(): StepConfig {
    return { ...this.config };
  }

  /**
   * 創建跳過結果
   */
  protected createSkippedResult(startTime: number): StepResult {
    return {
      step: this.step,
      success: true,
      skipped: true,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * 創建成功結果
   */
  protected createSuccessResult(
    data: Record<string, unknown>,
    startTime: number
  ): StepResult {
    return {
      step: this.step,
      success: true,
      data,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * 創建失敗結果
   */
  protected createFailedResult(startTime: number, error: Error): StepResult {
    return {
      step: this.step,
      success: false,
      error: error.message,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * 休眠輔助函數
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Step Handler Factory Interface
// ============================================================================

/**
 * 步驟處理器工廠介面
 */
export interface IStepHandlerFactory {
  /**
   * 創建步驟處理器
   * @param step - 步驟類型
   * @returns 步驟處理器實例
   */
  createHandler(step: ProcessingStep): IStepHandler;

  /**
   * 創建所有步驟處理器
   * @returns 按順序排列的步驟處理器列表
   */
  createAllHandlers(): IStepHandler[];
}
