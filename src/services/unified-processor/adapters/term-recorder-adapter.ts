/**
 * @fileoverview 術語記錄適配器
 * @description
 *   將現有的術語服務適配到統一處理流程：
 *   - 整合 term-aggregation.service（正規化、地址過濾）
 *   - 整合 hierarchical-term-aggregation.service（三層聚合）
 *   - 整合 ai-term-validator.service（AI 術語驗證）
 *   - 提供統一的術語檢測與記錄介面
 *   - CHANGE-006: 支援從 gptExtraction.extraCharges 提取術語
 *
 * @module src/services/unified-processor/adapters
 * @since Epic 15 - Story 15.4 (持續術語學習)
 * @lastModified 2026-01-06
 *
 * @related
 *   - src/services/term-aggregation.service.ts - 術語正規化、相似度計算
 *   - src/services/hierarchical-term-aggregation.service.ts - 三層聚合服務
 *   - src/services/ai-term-validator.service.ts - AI 術語驗證
 *   - src/types/term-learning.ts - 類型定義
 *   - src/services/unified-processor/steps/term-recording.step.ts - 使用此適配器
 *   - claudedocs/4-changes/feature-changes/CHANGE-006-gpt-vision-dynamic-config-extraction.md
 */

import { prisma } from '@/lib/prisma';
import type { ExtractedDocumentData } from '@/types/unified-processor';

// 使用類型別名以保持代碼一致性
type ExtractedData = ExtractedDocumentData;
import {
  type DetectedTerm,
  type MatchedTerm,
  type NewTerm,
  type SynonymCandidate,
  type TermRecordRequest,
  type TermRecordResult,
  type TermDetectionStats,
  type TermRecordingConfig,
  type NewTermDetectionResult,
  TermStatus,
  TermSource,
  TermMatchMethod,
} from '@/types/term-learning';

// 導入現有術語服務
import {
  normalizeForAggregation,
  isAddressLikeTerm,
  calculateSimilarity,
} from '@/services/term-aggregation.service';

// ============================================================================
// Types
// ============================================================================

/**
 * 術語記錄適配器選項
 */
export interface TermRecorderOptions
  extends Partial<
    Pick<
      TermRecordingConfig,
      'fuzzyMatchThreshold' | 'minTermLength' | 'maxTermLength' | 'filterInvalidTerms'
    >
  > {
  /** 是否自動保存新術語 */
  autoSaveNewTerms?: boolean;
  /** 是否執行 AI 分類（暫未實現） */
  performAiClassification?: boolean;
}

/**
 * 內部術語存儲結構
 * @description 簡化的術語資料，用於匹配
 */
interface StoredTermInfo {
  id: string;
  term: string;
  normalizedTerm: string;
  occurrences: number;
  companyId: string;
  documentFormatId: string;
}

/**
 * 提取數據中的行項目結構
 */
interface LineItemData {
  description?: string | null;
  chargeType?: string | null;
  amount?: number | null;
  currency?: string | null;
}

/**
 * CHANGE-006: GPT 額外提取的欄位結構
 * @description 定義 gptExtraction 中可能包含的欄位
 */
interface GptExtractionFields {
  /** 額外費用（如 DHL 的 Analysis of Extra Charges） */
  extraCharges?: Array<{
    description?: string;
    amount?: number;
    currency?: string;
  }>;
  /** 服務類型 */
  typeOfService?: string;
  /** 其他動態欄位 */
  [key: string]: unknown;
}

// ============================================================================
// Constants
// ============================================================================

/** 默認模糊匹配閾值 */
const DEFAULT_FUZZY_THRESHOLD = 85;

/** 默認同義詞檢測閾值 */
const DEFAULT_SYNONYM_THRESHOLD = 80;

/** 最小術語長度 */
const DEFAULT_MIN_LENGTH = 2;

/** 最大術語長度 */
const DEFAULT_MAX_LENGTH = 200;

// ============================================================================
// Main Adapter Class
// ============================================================================

/**
 * 術語記錄適配器
 * @description
 *   封裝現有術語服務，提供統一的術語檢測與記錄介面。
 *   整合：
 *   - term-aggregation.service（正規化、相似度）
 *   - hierarchical-term-aggregation.service（三層結構）
 *   - ai-term-validator.service（AI 驗證）
 */
export class TermRecorderAdapter {
  /**
   * 從提取數據中檢測並記錄術語
   * @description
   *   完整的術語處理流程：
   *   1. 從 extractedData 中提取術語
   *   2. 過濾無效術語（地址、人名等）
   *   3. 與現有術語匹配
   *   4. 識別新術語
   *   5. 檢測同義詞候選
   *   6. 可選：保存新術語
   *
   * @param request - 術語記錄請求
   * @returns 術語記錄結果
   */
  async recordTerms(request: TermRecordRequest): Promise<TermRecordResult> {
    const startTime = Date.now();

    try {
      // 1. 提取術語
      const detectedTerms = request.detectedTerms;

      if (detectedTerms.length === 0) {
        return this.createEmptyResult(Date.now() - startTime);
      }

      // 2. 獲取現有術語（用於匹配）
      const existingTerms = await this.getExistingTerms(
        request.companyId,
        request.documentFormatId
      );

      // 3. 匹配術語
      const { matchedTerms, newTerms, synonymCandidates } = await this.matchTerms(
        detectedTerms,
        existingTerms,
        {
          companyId: request.companyId,
          documentFormatId: request.documentFormatId,
          source: request.source,
          fuzzyThreshold: request.fuzzyMatchThreshold ?? DEFAULT_FUZZY_THRESHOLD,
        }
      );

      // 4. 保存新術語（如果啟用）
      const createdTermIds: string[] = [];
      const updatedTermIds: string[] = [];

      if (request.autoSaveNewTerms && newTerms.length > 0) {
        const savedIds = await this.saveNewTerms(newTerms);
        createdTermIds.push(...savedIds);
      }

      // 5. 更新現有術語的出現次數
      if (matchedTerms.length > 0) {
        const updateIds = await this.updateTermOccurrences(matchedTerms);
        updatedTermIds.push(...updateIds);
      }

      // 6. 構建統計數據
      const stats = this.buildStats(detectedTerms, matchedTerms, newTerms, synonymCandidates);

      return {
        success: true,
        createdTermIds,
        updatedTermIds,
        matchedTerms,
        pendingSynonyms: synonymCandidates,
        stats,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        createdTermIds: [],
        updatedTermIds: [],
        matchedTerms: [],
        pendingSynonyms: [],
        stats: this.createEmptyStats(),
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * 從提取數據中檢測術語
   * @description
   *   從 UnifiedProcessingContext.extractedData 中提取術語，
   *   用於 TermRecordingStep 的輸入準備。
   *
   *   CHANGE-006: 新增從 gptExtraction 提取術語
   *   - extraCharges 的 description 會被記錄為術語
   *   - typeOfService 會被記錄為術語
   *   - 來源標記為 'gptExtraction'
   *
   * @param extractedData - AI 提取的數據
   * @param options - 檢測選項
   * @returns 檢測到的術語列表
   */
  detectTermsFromExtraction(
    extractedData: ExtractedData,
    options?: TermRecorderOptions
  ): DetectedTerm[] {
    const {
      minTermLength = DEFAULT_MIN_LENGTH,
      maxTermLength = DEFAULT_MAX_LENGTH,
      filterInvalidTerms = true,
    } = options ?? {};

    const detectedTerms: DetectedTerm[] = [];
    const termCountMap = new Map<string, DetectedTerm>();

    // 從 invoiceData.lineItems 提取
    const lineItems = extractedData?.invoiceData?.lineItems ?? [];
    for (let i = 0; i < lineItems.length; i++) {
      const item = lineItems[i] as LineItemData;
      this.processLineItem(item, 'lineItems', i, termCountMap, {
        minTermLength,
        maxTermLength,
        filterInvalidTerms,
      });
    }

    // 從 customFields 提取（如果存在）
    const customFields = (extractedData as Record<string, unknown>)?.customFields;
    if (customFields && typeof customFields === 'object') {
      for (const [key, value] of Object.entries(customFields)) {
        if (typeof value === 'string') {
          this.processTermString(value, `customFields.${key}`, undefined, termCountMap, {
            minTermLength,
            maxTermLength,
            filterInvalidTerms,
          });
        }
      }
    }

    // CHANGE-006: 從 gptExtraction 提取術語
    const gptExtraction = extractedData?.gptExtraction as GptExtractionFields | undefined;
    if (gptExtraction) {
      this.processGptExtraction(gptExtraction, termCountMap, {
        minTermLength,
        maxTermLength,
        filterInvalidTerms,
      });
    }

    // 轉換為數組
    for (const term of termCountMap.values()) {
      detectedTerms.push(term);
    }

    return detectedTerms;
  }

  /**
   * 從 GPT 額外提取的數據中處理術語
   * @description CHANGE-006: 處理 gptExtraction 中的 extraCharges 和 typeOfService
   */
  private processGptExtraction(
    gptExtraction: GptExtractionFields,
    termCountMap: Map<string, DetectedTerm>,
    options: { minTermLength: number; maxTermLength: number; filterInvalidTerms: boolean }
  ): void {
    // 處理 extraCharges
    if (Array.isArray(gptExtraction.extraCharges)) {
      for (let i = 0; i < gptExtraction.extraCharges.length; i++) {
        const charge = gptExtraction.extraCharges[i];
        if (charge && typeof charge.description === 'string') {
          this.processTermString(
            charge.description,
            'gptExtraction.extraCharges',
            i,
            termCountMap,
            options
          );
        }
      }
    }

    // 處理 typeOfService
    if (typeof gptExtraction.typeOfService === 'string') {
      this.processTermString(
        gptExtraction.typeOfService,
        'gptExtraction.typeOfService',
        undefined,
        termCountMap,
        options
      );
    }

    // 處理其他以 extra_ 開頭的動態欄位
    for (const [key, value] of Object.entries(gptExtraction)) {
      if (key.startsWith('extra_') && typeof value === 'string') {
        this.processTermString(
          value,
          `gptExtraction.${key}`,
          undefined,
          termCountMap,
          options
        );
      }
    }
  }

  /**
   * 執行完整的術語檢測流程
   * @description
   *   結合 detectTermsFromExtraction 和 recordTerms 的便捷方法
   *
   * @param companyId - 公司 ID
   * @param documentFormatId - 文件格式 ID
   * @param extractedData - 提取的數據
   * @param options - 配置選項
   * @returns 術語檢測結果
   */
  async detectAndRecordTerms(
    companyId: string,
    documentFormatId: string,
    extractedData: ExtractedData,
    options?: TermRecorderOptions
  ): Promise<NewTermDetectionResult> {
    const startTime = Date.now();

    try {
      // 1. 檢測術語
      const detectedTerms = this.detectTermsFromExtraction(extractedData, options);

      if (detectedTerms.length === 0) {
        return this.createEmptyDetectionResult(Date.now() - startTime);
      }

      // 2. 獲取現有術語
      const existingTerms = await this.getExistingTerms(companyId, documentFormatId);

      // 3. 匹配術語
      const { matchedTerms, newTerms, synonymCandidates } = await this.matchTerms(
        detectedTerms,
        existingTerms,
        {
          companyId,
          documentFormatId,
          source: TermSource.DAILY_AUTO,
          fuzzyThreshold: options?.fuzzyMatchThreshold ?? DEFAULT_FUZZY_THRESHOLD,
        }
      );

      // 4. 可選：保存新術語
      if (options?.autoSaveNewTerms && newTerms.length > 0) {
        await this.saveNewTerms(newTerms);
      }

      // 5. 可選：更新現有術語出現次數
      if (matchedTerms.length > 0) {
        await this.updateTermOccurrences(matchedTerms);
      }

      // 6. 構建統計數據
      const stats = this.buildStats(detectedTerms, matchedTerms, newTerms, synonymCandidates);

      return {
        success: true,
        detectedTerms,
        matchedTerms,
        newTerms,
        synonymCandidates,
        stats,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        detectedTerms: [],
        matchedTerms: [],
        newTerms: [],
        synonymCandidates: [],
        stats: this.createEmptyStats(),
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * 處理行項目
   */
  private processLineItem(
    item: LineItemData,
    sourceField: string,
    lineIndex: number,
    termCountMap: Map<string, DetectedTerm>,
    options: { minTermLength: number; maxTermLength: number; filterInvalidTerms: boolean }
  ): void {
    // 處理 description
    if (item.description) {
      this.processTermString(item.description, sourceField, lineIndex, termCountMap, options);
    }

    // 處理 chargeType
    if (item.chargeType) {
      this.processTermString(item.chargeType, sourceField, lineIndex, termCountMap, options);
    }
  }

  /**
   * 處理術語字串
   */
  private processTermString(
    raw: string,
    sourceField: string,
    lineIndex: number | undefined,
    termCountMap: Map<string, DetectedTerm>,
    options: { minTermLength: number; maxTermLength: number; filterInvalidTerms: boolean }
  ): void {
    const normalized = normalizeForAggregation(raw);

    // 驗證術語
    if (!normalized || normalized.length < options.minTermLength) return;
    if (normalized.length > options.maxTermLength) return;
    if (options.filterInvalidTerms && isAddressLikeTerm(normalized)) return;

    // 更新或創建術語記錄
    const existing = termCountMap.get(normalized);
    if (existing) {
      existing.occurrences++;
    } else {
      termCountMap.set(normalized, {
        term: raw,
        normalizedTerm: normalized,
        occurrences: 1,
        sourceField,
        lineIndex,
      });
    }
  }

  /**
   * 獲取現有術語（用於匹配）
   */
  private async getExistingTerms(
    companyId: string,
    documentFormatId: string
  ): Promise<StoredTermInfo[]> {
    // 查詢 DocumentFormat 的 commonTerms
    // 注意：目前 Prisma schema 中 DocumentFormat 只有 commonTerms 字串數組
    // 未來可能需要擴展為獨立的 FormatTerm 模型
    const format = await prisma.documentFormat.findUnique({
      where: { id: documentFormatId },
      select: {
        id: true,
        commonTerms: true,
        companyId: true,
      },
    });

    if (!format) {
      return [];
    }

    // 將 commonTerms 轉換為 StoredTermInfo 格式
    // 由於目前沒有獨立的 FormatTerm 模型，使用簡化結構
    return format.commonTerms.map((term, index) => ({
      id: `${format.id}-term-${index}`,
      term: term,
      normalizedTerm: normalizeForAggregation(term),
      occurrences: 1, // 暫無出現次數追蹤
      companyId: format.companyId,
      documentFormatId: format.id,
    }));
  }

  /**
   * 匹配術語
   */
  private async matchTerms(
    detectedTerms: DetectedTerm[],
    existingTerms: StoredTermInfo[],
    context: {
      companyId: string;
      documentFormatId: string;
      source: TermSource;
      fuzzyThreshold: number;
    }
  ): Promise<{
    matchedTerms: MatchedTerm[];
    newTerms: NewTerm[];
    synonymCandidates: SynonymCandidate[];
  }> {
    const matchedTerms: MatchedTerm[] = [];
    const newTerms: NewTerm[] = [];
    const synonymCandidates: SynonymCandidate[] = [];

    const existingNormalizedSet = new Set(existingTerms.map((t) => t.normalizedTerm));
    const fuzzyThreshold = context.fuzzyThreshold / 100; // 轉換為 0-1 範圍
    const synonymThreshold = DEFAULT_SYNONYM_THRESHOLD / 100;

    for (const detected of detectedTerms) {
      // 1. 精確匹配
      if (existingNormalizedSet.has(detected.normalizedTerm)) {
        const matched = existingTerms.find((t) => t.normalizedTerm === detected.normalizedTerm);
        if (matched) {
          matchedTerms.push({
            inputTerm: detected.term,
            matchedTerm: this.toTerm(matched),
            matchMethod: TermMatchMethod.EXACT,
            similarity: 100,
            needsConfirmation: false,
          });
          continue;
        }
      }

      // 2. 模糊匹配
      let bestMatch: { term: StoredTermInfo; similarity: number } | null = null;

      for (const existing of existingTerms) {
        const similarity = calculateSimilarity(detected.normalizedTerm, existing.normalizedTerm);

        if (similarity >= fuzzyThreshold) {
          if (!bestMatch || similarity > bestMatch.similarity) {
            bestMatch = { term: existing, similarity };
          }
        } else if (similarity >= synonymThreshold && similarity < fuzzyThreshold) {
          // 同義詞候選
          synonymCandidates.push({
            existingTerm: this.toTerm(bestMatch?.term ?? existing),
            similarity: Math.round(similarity * 100),
            method: 'levenshtein',
            reason: `相似度 ${Math.round(similarity * 100)}% 介於同義詞閾值和模糊匹配閾值之間`,
          });
        }
      }

      if (bestMatch) {
        matchedTerms.push({
          inputTerm: detected.term,
          matchedTerm: this.toTerm(bestMatch.term),
          matchMethod: TermMatchMethod.FUZZY,
          similarity: Math.round(bestMatch.similarity * 100),
          needsConfirmation: bestMatch.similarity < 0.95,
        });
      } else {
        // 新術語
        newTerms.push({
          term: detected.term,
          normalizedTerm: detected.normalizedTerm,
          companyId: context.companyId,
          documentFormatId: context.documentFormatId,
          source: context.source,
          occurrences: detected.occurrences,
        });
      }
    }

    return { matchedTerms, newTerms, synonymCandidates };
  }

  /**
   * 保存新術語
   */
  private async saveNewTerms(newTerms: NewTerm[]): Promise<string[]> {
    const savedIds: string[] = [];

    for (const newTerm of newTerms) {
      try {
        // 更新 DocumentFormat 的 commonTerms
        await prisma.documentFormat.update({
          where: { id: newTerm.documentFormatId },
          data: {
            commonTerms: {
              push: newTerm.normalizedTerm,
            },
          },
        });

        // 使用格式 ID + 術語作為虛擬 ID
        savedIds.push(`${newTerm.documentFormatId}-${newTerm.normalizedTerm}`);
      } catch (error) {
        console.error(`Failed to save term "${newTerm.term}":`, error);
      }
    }

    return savedIds;
  }

  /**
   * 更新術語出現次數
   */
  private async updateTermOccurrences(matchedTerms: MatchedTerm[]): Promise<string[]> {
    // 由於目前使用 commonTerms 字串數組，無法追蹤出現次數
    // 未來擴展 FormatTerm 模型後可實現
    // 暫時返回空數組
    return matchedTerms.map((m) => m.matchedTerm.id);
  }

  /**
   * 轉換為 Term 類型
   */
  private toTerm(stored: StoredTermInfo): import('@/types/term-learning').Term {
    const now = new Date();
    return {
      id: stored.id,
      term: stored.term,
      normalizedTerm: stored.normalizedTerm,
      companyId: stored.companyId,
      documentFormatId: stored.documentFormatId,
      status: TermStatus.SYSTEM,
      source: TermSource.HISTORICAL_INIT,
      occurrences: stored.occurrences,
      firstSeenAt: now,
      lastSeenAt: now,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * 構建統計數據
   */
  private buildStats(
    detected: DetectedTerm[],
    matched: MatchedTerm[],
    newTerms: NewTerm[],
    synonyms: SynonymCandidate[]
  ): TermDetectionStats {
    const exactMatches = matched.filter((m) => m.matchMethod === TermMatchMethod.EXACT).length;
    const fuzzyMatches = matched.filter((m) => m.matchMethod === TermMatchMethod.FUZZY).length;
    const synonymMatches = matched.filter((m) => m.matchMethod === TermMatchMethod.SYNONYM).length;
    const needsConfirmation = matched.filter((m) => m.needsConfirmation).length + synonyms.length;

    return {
      totalDetected: detected.length,
      exactMatches,
      fuzzyMatches,
      synonymMatches,
      newTerms: newTerms.length,
      needsConfirmation,
      filteredInvalid: 0, // 在 detectTermsFromExtraction 中已過濾
    };
  }

  /**
   * 創建空統計
   */
  private createEmptyStats(): TermDetectionStats {
    return {
      totalDetected: 0,
      exactMatches: 0,
      fuzzyMatches: 0,
      synonymMatches: 0,
      newTerms: 0,
      needsConfirmation: 0,
      filteredInvalid: 0,
    };
  }

  /**
   * 創建空結果
   */
  private createEmptyResult(processingTimeMs: number): TermRecordResult {
    return {
      success: true,
      createdTermIds: [],
      updatedTermIds: [],
      matchedTerms: [],
      pendingSynonyms: [],
      stats: this.createEmptyStats(),
      processingTimeMs,
    };
  }

  /**
   * 創建空檢測結果
   */
  private createEmptyDetectionResult(processingTimeMs: number): NewTermDetectionResult {
    return {
      success: true,
      detectedTerms: [],
      matchedTerms: [],
      newTerms: [],
      synonymCandidates: [],
      stats: this.createEmptyStats(),
      processingTimeMs,
    };
  }

  /**
   * 檢查是否可以執行術語記錄
   * @description
   *   CHANGE-006: 新增檢查 gptExtraction.extraCharges
   *
   * @param extractedData - 提取數據
   * @returns 是否有足夠資訊進行術語記錄
   */
  canRecord(extractedData: ExtractedData | null | undefined): boolean {
    if (!extractedData) return false;

    // 檢查是否有 lineItems
    const lineItems = extractedData?.invoiceData?.lineItems;
    if (lineItems && Array.isArray(lineItems) && lineItems.length > 0) {
      return true;
    }

    // CHANGE-006: 檢查是否有 gptExtraction.extraCharges
    const gptExtraction = extractedData?.gptExtraction as GptExtractionFields | undefined;
    if (gptExtraction?.extraCharges && Array.isArray(gptExtraction.extraCharges) && gptExtraction.extraCharges.length > 0) {
      return true;
    }

    // CHANGE-006: 檢查是否有 typeOfService
    if (gptExtraction?.typeOfService && typeof gptExtraction.typeOfService === 'string') {
      return true;
    }

    return false;
  }
}

// 單例導出
export const termRecorderAdapter = new TermRecorderAdapter();
