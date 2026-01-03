/**
 * @fileoverview Step 5: 格式匹配
 * @description
 *   匹配或創建文件格式（Document Format）：
 *   - 根據發行者和文件特徵匹配現有格式
 *   - 支援多種匹配方法：精確、相似度、AI 推斷
 *   - 自動創建新格式（如果 autoCreateFormat 啟用）
 *
 * @module src/services/unified-processor/steps
 * @since Epic 15 - Story 15.3 (整合 Story 0.9)
 * @lastModified 2026-01-03
 *
 * @related
 *   - src/services/unified-processor/adapters/format-matcher-adapter.ts - 格式匹配適配器
 *   - src/types/format-matching.ts - 類型定義
 *   - src/services/document-format.service.ts - 底層格式服務
 */

import {
  ProcessingStep,
  StepPriority,
  StepConfig,
  StepResult,
  UnifiedProcessingContext,
  UnifiedProcessorFlags,
} from '@/types/unified-processor';
import { BaseStepHandler } from '../interfaces/step-handler.interface';
import { formatMatcherAdapter } from '../adapters/format-matcher-adapter';
import type {
  FormatMatchResult,
  FormatMatchMethod,
} from '@/types/format-matching';

/**
 * 格式匹配步驟輸出數據
 * @note 包含 index signature 以支援 Record<string, unknown>
 */
interface FormatMatchingStepOutput {
  /** 匹配到的格式 ID */
  formatId: string;
  /** 格式名稱 */
  formatName: string;
  /** 是否為新創建的格式 */
  isNewFormat: boolean;
  /** 匹配信心度 (0-100) */
  matchConfidence: number;
  /** 匹配方法 */
  matchMethod: FormatMatchMethod;
  /** 是否有多個候選格式 */
  hasMultipleCandidates: boolean;
  /** 候選格式數量 */
  candidateCount: number;
  /** Index signature for Record<string, unknown> compatibility */
  [key: string]: unknown;
}

/**
 * 格式匹配步驟
 * @description
 *   使用 FormatMatcherAdapter 整合現有的 document-format.service.ts
 *   支援多種匹配策略和自動創建格式功能
 */
export class FormatMatchingStep extends BaseStepHandler {
  readonly step = ProcessingStep.FORMAT_MATCHING;
  readonly priority = StepPriority.OPTIONAL;

  constructor(config: StepConfig) {
    super(config);
  }

  /**
   * 檢查是否應該執行
   * @description 需要 companyId 才能匹配格式
   */
  shouldExecute(
    context: UnifiedProcessingContext,
    flags: UnifiedProcessorFlags
  ): boolean {
    if (!super.shouldExecute(context, flags)) {
      return false;
    }

    // 需要 companyId 才能匹配格式
    if (!context.companyId) {
      context.warnings.push({
        step: this.step,
        message: 'Skipping FORMAT_MATCHING: companyId not available',
        timestamp: new Date().toISOString(),
      });
      return false;
    }

    // 需要提取數據才能匹配
    if (!context.extractedData) {
      context.warnings.push({
        step: this.step,
        message: 'Skipping FORMAT_MATCHING: extractedData not available',
        timestamp: new Date().toISOString(),
      });
      return false;
    }

    return flags.enableFormatMatching;
  }

  /**
   * 執行格式匹配
   * @description
   *   1. 使用 FormatMatcherAdapter 進行匹配
   *   2. 根據提取數據和公司 ID 查找匹配格式
   *   3. 如啟用 autoCreateFormat，可自動創建新格式
   */
  protected async doExecute(
    context: UnifiedProcessingContext,
    flags: UnifiedProcessorFlags
  ): Promise<StepResult> {
    const startTime = Date.now();

    try {
      // 驗證前置條件
      if (!context.companyId) {
        throw new Error('Company ID not available. Run ISSUER_IDENTIFICATION step first.');
      }

      if (!context.extractedData) {
        throw new Error('Extracted data not available. Run DATA_EXTRACTION step first.');
      }

      // 使用適配器進行格式匹配
      const matchResult = await formatMatcherAdapter.matchFromExtraction(
        context.companyId,
        context.extractedData,
        {
          autoCreate: flags.autoCreateFormat,
          minConfidence: this.getSimilarityThreshold(flags),
          maxCandidates: 5,
          enableSimilarityMatch: true,
          similarityThreshold: this.getSimilarityThreshold(flags) / 100,
        }
      );

      // 處理匹配結果
      if (!matchResult.success) {
        throw new Error(matchResult.error ?? 'Format matching failed');
      }

      // 更新上下文
      this.updateContext(context, matchResult);

      // 記錄匹配詳情
      const outputData = this.buildOutputData(matchResult);

      // 如果信心度較低，添加警告
      if (matchResult.confidence < 70 && !matchResult.isNewFormat) {
        context.warnings.push({
          step: this.step,
          message: `Low confidence format match (${matchResult.confidence}%). Consider manual verification.`,
          timestamp: new Date().toISOString(),
        });
      }

      return this.createSuccessResult(outputData, startTime);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      // 添加警告但不阻塞處理
      context.warnings.push({
        step: this.step,
        message: err.message,
        timestamp: new Date().toISOString(),
      });

      return this.createFailedResult(startTime, err);
    }
  }

  /**
   * 更新上下文
   */
  private updateContext(
    context: UnifiedProcessingContext,
    matchResult: FormatMatchResult
  ): void {
    context.documentFormatId = matchResult.formatId ?? undefined;
    context.documentFormatName = matchResult.formatName ?? undefined;
    context.isNewFormat = matchResult.isNewFormat;
  }

  /**
   * 構建輸出數據
   */
  private buildOutputData(matchResult: FormatMatchResult): FormatMatchingStepOutput {
    const candidates = matchResult.candidates ?? [];
    return {
      formatId: matchResult.formatId ?? '',
      formatName: matchResult.formatName ?? 'Unknown Format',
      isNewFormat: matchResult.isNewFormat,
      matchConfidence: matchResult.confidence,
      matchMethod: matchResult.matchMethod,
      hasMultipleCandidates: candidates.length > 1,
      candidateCount: candidates.length,
    };
  }

  /**
   * 獲取相似度閾值
   * @description 根據 flags 決定匹配嚴格程度
   */
  private getSimilarityThreshold(flags: UnifiedProcessorFlags): number {
    // 默認使用 70% 相似度閾值
    // 可以根據 flags 調整（如果有相關配置）
    return 70;
  }
}
