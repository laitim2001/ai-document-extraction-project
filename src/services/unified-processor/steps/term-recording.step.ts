/**
 * @fileoverview Step 9: 術語記錄
 * @description
 *   持續術語學習步驟：
 *   - 從提取數據中檢測術語（invoiceData.lineItems, otherCharges）
 *   - 使用 Levenshtein 距離匹配現有術語（85% 相似度閾值）
 *   - 記錄新術語並更新現有術語頻率
 *   - 識別同義詞候選
 *
 * @module src/services/unified-processor/steps
 * @since Epic 15 - Story 15.4 (持續術語學習)
 * @lastModified 2026-01-03
 *
 * @features
 *   - 自動術語檢測與規範化
 *   - 模糊匹配（Levenshtein 距離）
 *   - 同義詞候選識別
 *   - 地址類術語過濾
 *
 * @related
 *   - src/services/unified-processor/adapters/term-recorder-adapter.ts - 術語記錄適配器
 *   - src/types/term-learning.ts - 類型定義
 *   - src/services/hierarchical-term-aggregation.service.ts - 術語聚合服務
 */

import {
  ProcessingStep,
  StepPriority,
  StepConfig,
  StepResult,
  UnifiedProcessingContext,
  UnifiedProcessorFlags,
  RecordedTerm,
} from '@/types/unified-processor';
import { BaseStepHandler } from '../interfaces/step-handler.interface';
import { termRecorderAdapter } from '../adapters/term-recorder-adapter';
import type {
  TermRecordingStepOutput,
  NewTermDetectionResult,
} from '@/types/term-learning';

/**
 * 術語記錄步驟
 * @description
 *   使用 TermRecorderAdapter 整合現有的術語服務：
 *   - hierarchical-term-aggregation.service.ts - 術語聚合
 *   - ai-term-validation.service.ts - AI 術語驗證（可選）
 *
 *   執行流程：
 *   1. 檢查前置條件（companyId, documentFormatId, extractedData）
 *   2. 從提取數據中檢測術語
 *   3. 匹配現有術語或創建新術語
 *   4. 更新上下文中的 recordedTerms
 */
export class TermRecordingStep extends BaseStepHandler {
  readonly step = ProcessingStep.TERM_RECORDING;
  readonly priority = StepPriority.OPTIONAL;

  constructor(config: StepConfig) {
    super(config);
  }

  /**
   * 檢查是否應該執行
   * @description
   *   需要滿足以下條件：
   *   1. flags.enableTermRecording 為 true
   *   2. 有 companyId 和 documentFormatId
   *   3. 有可處理的提取數據（lineItems 或 otherCharges）
   */
  shouldExecute(
    context: UnifiedProcessingContext,
    flags: UnifiedProcessorFlags
  ): boolean {
    // 調用父類檢查
    if (!super.shouldExecute(context, flags)) {
      return false;
    }

    // 檢查功能旗標
    if (!flags.enableTermRecording) {
      return false;
    }

    // 檢查必要的上下文數據
    if (!context.companyId || !context.documentFormatId) {
      return false;
    }

    // 檢查是否有可記錄的數據
    if (!termRecorderAdapter.canRecord(context.extractedData)) {
      return false;
    }

    return true;
  }

  /**
   * 執行術語記錄
   * @description
   *   1. 調用適配器的 detectAndRecordTerms 方法
   *   2. 將結果轉換為 RecordedTerm[] 格式
   *   3. 更新 context.recordedTerms
   *   4. 返回統計信息
   */
  protected async doExecute(
    context: UnifiedProcessingContext,
    _flags: UnifiedProcessorFlags
  ): Promise<StepResult> {
    const startTime = Date.now();

    try {
      // 確保必要的數據存在（shouldExecute 已檢查，但 TypeScript 需要）
      if (!context.companyId || !context.documentFormatId) {
        context.warnings.push({
          step: this.step,
          message: 'Missing companyId or documentFormatId for term recording',
          timestamp: new Date().toISOString(),
        });
        return this.createSkippedResult(startTime);
      }

      if (!context.extractedData) {
        context.warnings.push({
          step: this.step,
          message: 'No extracted data available for term recording',
          timestamp: new Date().toISOString(),
        });
        return this.createSkippedResult(startTime);
      }

      // 調用適配器進行術語檢測和記錄
      const result = await termRecorderAdapter.detectAndRecordTerms(
        context.companyId,
        context.documentFormatId,
        context.extractedData,
        {
          fuzzyMatchThreshold: 85, // 85% 相似度閾值
          autoSaveNewTerms: true,
          filterInvalidTerms: true,
        }
      );

      // 處理結果
      if (!result.success) {
        // 術語記錄失敗不應阻塞處理，記錄警告並繼續
        context.warnings.push({
          step: this.step,
          message: result.error ?? 'Term recording failed',
          timestamp: new Date().toISOString(),
        });

        return this.createSuccessResult(
          this.buildEmptyOutput(result.processingTimeMs),
          startTime
        );
      }

      // 將結果轉換為 RecordedTerm 格式並更新上下文
      context.recordedTerms = this.convertToRecordedTerms(
        result,
        context.documentFormatId
      );

      // 構建輸出數據
      const outputData = this.buildOutputData(result);

      // 記錄統計信息
      this.logTermRecordingStats(context, result);

      return this.createSuccessResult(outputData, startTime);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      // 術語記錄失敗不應阻塞處理，記錄警告
      context.warnings.push({
        step: this.step,
        message: `Term recording error: ${err.message}`,
        timestamp: new Date().toISOString(),
      });

      // 返回成功但標記無術語記錄
      return this.createSuccessResult(
        this.buildEmptyOutput(Date.now() - startTime),
        startTime
      );
    }
  }

  /**
   * 將檢測結果轉換為 RecordedTerm 格式
   * @description
   *   合併匹配的術語和新術語，轉換為統一的 RecordedTerm 格式
   */
  private convertToRecordedTerms(
    result: NewTermDetectionResult,
    documentFormatId: string
  ): RecordedTerm[] {
    const recordedTerms: RecordedTerm[] = [];

    // 添加匹配的現有術語
    for (const matched of result.matchedTerms) {
      recordedTerms.push({
        termId: matched.matchedTerm.id,
        term: matched.inputTerm,
        occurrences: 1, // 本次出現 1 次
        isNew: false,
        documentFormatId,
      });
    }

    // 添加新檢測到的術語
    for (const newTerm of result.newTerms) {
      // 新術語尚無 ID，使用格式ID+正規化術語作為虛擬 ID
      const virtualId = `${documentFormatId}-${newTerm.normalizedTerm}`;
      recordedTerms.push({
        termId: virtualId,
        term: newTerm.normalizedTerm,
        occurrences: newTerm.occurrences,
        isNew: true,
        documentFormatId,
      });
    }

    return recordedTerms;
  }

  /**
   * 構建輸出數據
   */
  private buildOutputData(result: NewTermDetectionResult): TermRecordingStepOutput {
    // 計算更新的術語數量（精確匹配 + 模糊匹配都會更新出現次數）
    const updatedTermsCount = result.stats.exactMatches + result.stats.fuzzyMatches;

    return {
      totalDetected: result.detectedTerms.length,
      newTermsCount: result.newTerms.length,
      matchedTermsCount: result.matchedTerms.length,
      updatedTermsCount,
      pendingConfirmationCount: result.stats.needsConfirmation,
      hasSynonymCandidates: result.synonymCandidates.length > 0,
      processingTimeMs: result.processingTimeMs,
    };
  }

  /**
   * 構建空輸出
   */
  private buildEmptyOutput(processingTimeMs: number): TermRecordingStepOutput {
    return {
      totalDetected: 0,
      newTermsCount: 0,
      matchedTermsCount: 0,
      updatedTermsCount: 0,
      pendingConfirmationCount: 0,
      hasSynonymCandidates: false,
      processingTimeMs,
    };
  }

  /**
   * 記錄術語記錄統計信息
   */
  private logTermRecordingStats(
    context: UnifiedProcessingContext,
    result: NewTermDetectionResult
  ): void {
    // 構建統計信息
    const statsInfo = [
      `detected: ${result.detectedTerms.length}`,
      `matched: ${result.matchedTerms.length}`,
      `new: ${result.newTerms.length}`,
      `synonyms: ${result.synonymCandidates.length}`,
    ].join(', ');

    // 如果有新術語或同義詞候選，記錄到警告（供調試）
    if (result.newTerms.length > 0 || result.synonymCandidates.length > 0) {
      context.warnings.push({
        step: this.step,
        message: `Term recording stats: ${statsInfo}`,
        timestamp: new Date().toISOString(),
      });
    }

    // 如果有同義詞候選，記錄詳細信息
    if (result.synonymCandidates.length > 0) {
      const synonymInfo = result.synonymCandidates
        .slice(0, 3) // 只記錄前 3 個
        .map((s) => `"新術語" ≈ "${s.existingTerm.term}" (${s.similarity}%)`)
        .join(', ');

      context.warnings.push({
        step: this.step,
        message: `Synonym candidates: ${synonymInfo}${result.synonymCandidates.length > 3 ? '...' : ''}`,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
