/**
 * @fileoverview 批量術語聚合服務
 * @description
 *   提供批量處理後的術語聚合功能：
 *   - 按公司分組統計術語
 *   - 識別通用術語（出現在多個公司）
 *   - 支持相似術語聚類
 *   - 可選的 AI 自動分類
 *
 * @module src/services/batch-term-aggregation
 * @since Epic 0 - Story 0.7 (批量處理術語聚合整合)
 * @lastModified 2025-12-30
 *
 * @features
 *   - 批量處理後自動觸發術語聚合
 *   - 按公司分組的術語統計
 *   - 通用術語識別（出現在 2+ 公司）
 *   - 聚合結果持久化
 *   - FIX-005: 地址類術語過濾
 *
 * @dependencies
 *   - @prisma/client - 資料庫存取
 *   - src/lib/prisma - Prisma 客戶端實例
 *   - src/services/term-aggregation.service - 基礎術語聚合功能
 *
 * @related
 *   - src/services/batch-processor.service.ts - 批量處理服務（觸發聚合）
 *   - src/types/batch-term-aggregation.ts - 類型定義
 *   - prisma/schema.prisma - TermAggregationResult 模型
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import {
  normalizeForAggregation,
  calculateSimilarity,
  extractTermsFromResult,
  isAddressLikeTerm,
} from './term-aggregation.service';
import { aiTermValidator } from './ai-term-validator.service';
import type {
  BatchTermAggregationResult,
  BatchTermAggregationStats,
  CompanyTermAggregation,
  CompanyTerm,
  UniversalTerm,
  TermCompanyDistribution,
  TermAggregationConfig,
  TermAggregationResponse,
  TermDistributionSummary,
  UNIVERSAL_TERM_MIN_COMPANIES,
} from '@/types/batch-term-aggregation';

// ============================================================================
// Constants
// ============================================================================

/** 通用術語判定閾值（出現在至少 N 個公司） */
const UNIVERSAL_TERM_THRESHOLD = 2;

/** 預設相似度閾值 */
const DEFAULT_SIMILARITY_THRESHOLD = 0.85;

/** 最大返回術語數 */
const MAX_TERMS_LIMIT = 1000;

/** 頂部術語數量（用於摘要） */
const TOP_TERMS_COUNT = 20;

// ============================================================================
// Types
// ============================================================================

/**
 * 內部術語映射結構
 */
interface TermCompanyData {
  companyName: string;
  frequency: number;
}

/**
 * 提取結果 JSON 結構
 */
interface ExtractionResultJson {
  lineItems?: Array<{
    description?: string | null;
    name?: string | null;
    chargeType?: string | null;
    amount?: number | null;
  }>;
  items?: Array<{
    description?: string | null;
    name?: string | null;
    amount?: { amount?: number | null } | null;
  }>;
  invoiceData?: {
    lineItems?: Array<{
      description?: string | null;
      name?: string | null;
      chargeType?: string | null;
      amount?: number | null;
    }>;
  };
  extractedData?: {
    lineItems?: Array<{
      description?: string | null;
      chargeType?: string | null;
    }>;
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 從提取結果中提取術語
 * @param extractionResult - JSON 提取結果
 * @returns 術語列表
 */
function extractTermsFromExtractionResult(
  extractionResult: Prisma.JsonValue
): string[] {
  if (!extractionResult || typeof extractionResult !== 'object') {
    return [];
  }

  const terms: string[] = [];
  const result = extractionResult as ExtractionResultJson;

  // 嘗試從不同格式中提取
  // Azure DI 和 GPT Vision 都返回 invoiceData.lineItems 格式
  const items =
    result.lineItems ??
    result.items ??
    result.invoiceData?.lineItems ??
    result.extractedData?.lineItems ??
    [];

  for (const item of items) {
    // 提取 description
    const description =
      'description' in item ? item.description : null;
    if (description) {
      const normalized = normalizeForAggregation(description);
      // FIX-005: 過濾地址類術語
      if (normalized.length >= 2 && !isAddressLikeTerm(normalized)) {
        terms.push(normalized);
      }
    }

    // 提取 name（如果有）
    if ('name' in item && item.name) {
      const normalized = normalizeForAggregation(item.name as string);
      // FIX-005: 過濾地址類術語
      if (normalized.length >= 2 && !isAddressLikeTerm(normalized)) {
        terms.push(normalized);
      }
    }

    // 提取 chargeType（如果有）
    if ('chargeType' in item && item.chargeType) {
      const normalized = normalizeForAggregation(item.chargeType as string);
      // FIX-005: 過濾地址類術語
      if (normalized.length >= 2 && !isAddressLikeTerm(normalized)) {
        terms.push(normalized);
      }
    }
  }

  return terms;
}

/**
 * 合併相似術語
 * @param termMap - 術語映射
 * @param threshold - 相似度閾值
 */
function mergeSimilarTerms(
  termMap: Map<string, Map<string, TermCompanyData>>,
  threshold: number
): void {
  if (threshold >= 1) return;

  const terms = Array.from(termMap.keys());
  const mergeMap = new Map<string, string>(); // 原始術語 -> 合併目標

  for (let i = 0; i < terms.length; i++) {
    const term1 = terms[i];
    if (mergeMap.has(term1)) continue; // 已被合併

    for (let j = i + 1; j < terms.length; j++) {
      const term2 = terms[j];
      if (mergeMap.has(term2)) continue; // 已被合併

      const similarity = calculateSimilarity(term1, term2);
      if (similarity >= threshold) {
        // 將較短的合併到較長的，或頻率較高的
        const freq1 = Array.from(termMap.get(term1)!.values())
          .reduce((sum, d) => sum + d.frequency, 0);
        const freq2 = Array.from(termMap.get(term2)!.values())
          .reduce((sum, d) => sum + d.frequency, 0);

        if (freq1 >= freq2) {
          mergeMap.set(term2, term1);
        } else {
          mergeMap.set(term1, term2);
        }
      }
    }
  }

  // 執行合併
  for (const [source, target] of mergeMap) {
    const sourceData = termMap.get(source);
    const targetData = termMap.get(target);

    if (sourceData && targetData) {
      for (const [companyId, data] of sourceData) {
        if (targetData.has(companyId)) {
          targetData.get(companyId)!.frequency += data.frequency;
        } else {
          targetData.set(companyId, data);
        }
      }
      termMap.delete(source);
    }
  }
}

// ============================================================================
// Main Service Functions
// ============================================================================

/**
 * 執行批量術語聚合
 *
 * @description
 *   從指定批次的所有已完成文件中提取術語，
 *   按公司分組統計，識別通用術語，並返回完整的聚合結果。
 *   可選擇使用 AI 驗證過濾非費用術語。
 *
 * @param batchId - 批次 ID
 * @param config - 聚合配置
 * @returns 批量術語聚合結果
 *
 * @example
 * ```typescript
 * const result = await aggregateTermsForBatch('batch-123', {
 *   similarityThreshold: 0.85,
 *   autoClassify: false,
 *   aiValidationEnabled: true,
 * });
 * ```
 */
export async function aggregateTermsForBatch(
  batchId: string,
  config: Omit<TermAggregationConfig, 'enabled'> = {
    similarityThreshold: DEFAULT_SIMILARITY_THRESHOLD,
    autoClassify: false,
    aiValidationEnabled: false,
  }
): Promise<BatchTermAggregationResult> {
  // 1. 獲取所有處理完成的文件及其公司關聯
  const files = await prisma.historicalFile.findMany({
    where: {
      batchId,
      status: 'COMPLETED',
      extractionResult: { not: Prisma.JsonNull },
    },
    select: {
      id: true,
      extractionResult: true,
      identifiedCompanyId: true,
      identifiedCompany: {
        select: { id: true, name: true },
      },
    },
  });

  // 2. 建立術語 → 公司 → 頻率 的映射
  const termCompanyMap = new Map<string, Map<string, TermCompanyData>>();
  let totalOccurrences = 0;
  const allUniqueTermsBeforeValidation = new Set<string>();

  for (const file of files) {
    if (!file.extractionResult) continue;

    const companyId = file.identifiedCompanyId ?? 'UNKNOWN';
    const companyName = file.identifiedCompany?.name ?? '未識別';

    // 提取術語
    const terms = extractTermsFromExtractionResult(file.extractionResult);

    for (const term of terms) {
      if (!term) continue;

      totalOccurrences++;
      allUniqueTermsBeforeValidation.add(term);

      if (!termCompanyMap.has(term)) {
        termCompanyMap.set(term, new Map());
      }

      const companyMap = termCompanyMap.get(term)!;
      if (!companyMap.has(companyId)) {
        companyMap.set(companyId, { companyName, frequency: 0 });
      }
      companyMap.get(companyId)!.frequency++;
    }
  }

  // 2.5 AI 術語驗證（如果啟用）
  let aiValidationStats: BatchTermAggregationStats['aiValidation'] | undefined;

  if (config.aiValidationEnabled) {
    const termsBeforeValidation = allUniqueTermsBeforeValidation.size;
    const validationStartTime = Date.now();

    try {
      // 獲取所有唯一術語
      const allTerms = Array.from(allUniqueTermsBeforeValidation);

      // 使用 AI 驗證過濾無效術語
      const validTermsSet = new Set(
        await aiTermValidator.filterValidTerms(allTerms, batchId)
      );

      // 從 termCompanyMap 中移除無效術語
      for (const term of termCompanyMap.keys()) {
        if (!validTermsSet.has(term)) {
          // 從總出現次數中減去該術語的出現次數
          const companyMap = termCompanyMap.get(term)!;
          for (const data of companyMap.values()) {
            totalOccurrences -= data.frequency;
          }
          termCompanyMap.delete(term);
        }
      }

      const validationEndTime = Date.now();
      const termsAfterValidation = termCompanyMap.size;

      // 獲取成本資訊
      const costRecords = aiTermValidator.getCostRecords({ batchId });
      const validationCost = costRecords.reduce((sum, r) => sum + r.estimatedCost, 0);

      aiValidationStats = {
        termsBeforeValidation,
        termsAfterValidation,
        filteredTermsCount: termsBeforeValidation - termsAfterValidation,
        validationCost,
        validationTimeMs: validationEndTime - validationStartTime,
      };

      console.log(
        `[BatchTermAggregation] AI validation completed: ` +
        `${termsBeforeValidation} → ${termsAfterValidation} terms ` +
        `(${aiValidationStats.filteredTermsCount} filtered, $${validationCost.toFixed(4)})`
      );
    } catch (error) {
      console.error('[BatchTermAggregation] AI validation failed:', error);
      // 驗證失敗時繼續使用原有術語（fallback 到 isAddressLikeTerm 已在提取時應用）
    }
  }

  // 3. 相似術語合併（如果閾值 < 1）
  if (config.similarityThreshold < 1) {
    mergeSimilarTerms(termCompanyMap, config.similarityThreshold);
  }

  // 4. 分類：通用術語 vs 公司特定術語
  const universalTerms: UniversalTerm[] = [];
  const companyTermsMap = new Map<string, CompanyTermAggregation>();

  for (const [term, companyMap] of termCompanyMap) {
    const totalFrequency = Array.from(companyMap.values())
      .reduce((sum, c) => sum + c.frequency, 0);

    // 通用術語：出現在 2+ 公司
    if (companyMap.size >= UNIVERSAL_TERM_THRESHOLD) {
      const companies: TermCompanyDistribution[] = Array.from(companyMap.entries())
        .map(([companyId, data]) => ({
          companyId,
          companyName: data.companyName,
          frequency: data.frequency,
        }))
        .sort((a, b) => b.frequency - a.frequency);

      universalTerms.push({
        term,
        totalFrequency,
        companyCount: companyMap.size,
        companies,
      });
    }

    // 添加到公司特定統計
    for (const [companyId, data] of companyMap) {
      if (!companyTermsMap.has(companyId)) {
        companyTermsMap.set(companyId, {
          companyId,
          companyName: data.companyName,
          uniqueTermCount: 0,
          totalOccurrences: 0,
          terms: [],
        });
      }

      const companyAgg = companyTermsMap.get(companyId)!;
      companyAgg.uniqueTermCount++;
      companyAgg.totalOccurrences += data.frequency;
      companyAgg.terms.push({
        term,
        frequency: data.frequency,
        isUniversal: companyMap.size >= UNIVERSAL_TERM_THRESHOLD,
      });
    }
  }

  // 5. 排序
  universalTerms.sort((a, b) => b.totalFrequency - a.totalFrequency);

  const companyTerms = Array.from(companyTermsMap.values())
    .sort((a, b) => b.totalOccurrences - a.totalOccurrences);

  for (const company of companyTerms) {
    company.terms.sort((a, b) => b.frequency - a.frequency);
    // 限制每個公司的術語數量
    if (company.terms.length > MAX_TERMS_LIMIT) {
      company.terms = company.terms.slice(0, MAX_TERMS_LIMIT);
    }
  }

  // 6. 計算統計
  const stats: BatchTermAggregationStats = {
    totalUniqueTerms: termCompanyMap.size,
    totalOccurrences,
    universalTermsCount: universalTerms.length,
    companySpecificCount: termCompanyMap.size - universalTerms.length,
    classifiedTermsCount: 0, // AI 分類暫未實現
    companiesWithTerms: companyTermsMap.size,
    aiValidation: aiValidationStats, // AI 術語驗證統計（Story 0-10）
  };

  return {
    batchId,
    stats,
    universalTerms: universalTerms.slice(0, MAX_TERMS_LIMIT),
    companyTerms,
    aggregatedAt: new Date(),
  };
}

/**
 * 儲存聚合結果到資料庫
 *
 * @param batchId - 批次 ID
 * @param result - 聚合結果
 */
export async function saveAggregationResult(
  batchId: string,
  result: BatchTermAggregationResult
): Promise<void> {
  await prisma.termAggregationResult.upsert({
    where: { batchId },
    create: {
      batchId,
      totalUniqueTerms: result.stats.totalUniqueTerms,
      totalOccurrences: result.stats.totalOccurrences,
      universalTermsCount: result.stats.universalTermsCount,
      companySpecificCount: result.stats.companySpecificCount,
      classifiedTermsCount: result.stats.classifiedTermsCount,
      resultData: result as unknown as Prisma.JsonObject,
    },
    update: {
      totalUniqueTerms: result.stats.totalUniqueTerms,
      totalOccurrences: result.stats.totalOccurrences,
      universalTermsCount: result.stats.universalTermsCount,
      companySpecificCount: result.stats.companySpecificCount,
      classifiedTermsCount: result.stats.classifiedTermsCount,
      resultData: result as unknown as Prisma.JsonObject,
      aggregatedAt: new Date(),
    },
  });

  // 更新批次的聚合完成時間
  await prisma.historicalBatch.update({
    where: { id: batchId },
    data: {
      aggregationCompletedAt: new Date(),
    },
  });
}

/**
 * 獲取聚合結果
 *
 * @param batchId - 批次 ID
 * @returns 聚合結果，如果不存在則返回 null
 */
export async function getAggregationResult(
  batchId: string
): Promise<BatchTermAggregationResult | null> {
  const result = await prisma.termAggregationResult.findUnique({
    where: { batchId },
  });

  if (!result) {
    return null;
  }

  return result.resultData as unknown as BatchTermAggregationResult;
}

/**
 * 獲取聚合結果摘要（用於 API 響應）
 *
 * @param batchId - 批次 ID
 * @returns 術語聚合響應
 */
export async function getAggregationSummary(
  batchId: string
): Promise<TermAggregationResponse> {
  // 獲取批次狀態
  const batch = await prisma.historicalBatch.findUnique({
    where: { id: batchId },
    select: {
      id: true,
      status: true,
      aggregationStartedAt: true,
      aggregationCompletedAt: true,
    },
  });

  if (!batch) {
    return {
      batchId,
      status: 'failed',
      error: '批次不存在',
    };
  }

  // 根據批次狀態判斷聚合狀態
  let status: 'pending' | 'aggregating' | 'completed' | 'failed';
  switch (batch.status) {
    case 'AGGREGATING':
      status = 'aggregating';
      break;
    case 'AGGREGATED':
    case 'COMPLETED':
      status = 'completed';
      break;
    default:
      status = 'pending';
  }

  // 如果聚合完成，獲取結果
  if (status === 'completed') {
    const result = await prisma.termAggregationResult.findUnique({
      where: { batchId },
    });

    if (result) {
      const fullResult = result.resultData as unknown as BatchTermAggregationResult;

      // 建立分佈摘要
      const summary: TermDistributionSummary = {
        topTerms: fullResult.universalTerms
          .slice(0, TOP_TERMS_COUNT)
          .map((t) => ({ term: t.term, frequency: t.totalFrequency })),
        categoryBreakdown: [], // AI 分類暫未實現
        companyBreakdown: fullResult.companyTerms
          .slice(0, TOP_TERMS_COUNT)
          .map((c) => ({ companyName: c.companyName, termCount: c.uniqueTermCount })),
      };

      return {
        batchId,
        status: 'completed',
        stats: {
          totalUniqueTerms: result.totalUniqueTerms,
          totalOccurrences: result.totalOccurrences,
          universalTermsCount: result.universalTermsCount,
          companySpecificCount: result.companySpecificCount,
          classifiedTermsCount: result.classifiedTermsCount,
          companiesWithTerms: fullResult.companyTerms.length,
        },
        summary,
        aggregatedAt: result.aggregatedAt,
      };
    }
  }

  return {
    batchId,
    status,
  };
}

/**
 * 手動觸發術語聚合
 *
 * @param batchId - 批次 ID
 * @param config - 可選的配置覆蓋
 * @returns 聚合結果
 */
export async function triggerTermAggregation(
  batchId: string,
  config?: Partial<TermAggregationConfig>
): Promise<BatchTermAggregationResult> {
  // 獲取批次配置
  const batch = await prisma.historicalBatch.findUnique({
    where: { id: batchId },
    select: {
      id: true,
      status: true,
      enableTermAggregation: true,
      termSimilarityThreshold: true,
      autoClassifyTerms: true,
    },
  });

  if (!batch) {
    throw new Error(`批次 ${batchId} 不存在`);
  }

  // 更新狀態為聚合中
  await prisma.historicalBatch.update({
    where: { id: batchId },
    data: {
      status: 'AGGREGATING',
      aggregationStartedAt: new Date(),
    },
  });

  try {
    // 合併配置
    const mergedConfig: Omit<TermAggregationConfig, 'enabled'> = {
      similarityThreshold: config?.similarityThreshold ?? batch.termSimilarityThreshold,
      autoClassify: config?.autoClassify ?? batch.autoClassifyTerms,
    };

    // 執行聚合
    const result = await aggregateTermsForBatch(batchId, mergedConfig);

    // 儲存結果
    await saveAggregationResult(batchId, result);

    // FIX-003: 更新狀態為 COMPLETED（統一終態）
    // 術語聚合是否完成由 aggregationCompletedAt 欄位判斷
    await prisma.historicalBatch.update({
      where: { id: batchId },
      data: {
        status: 'COMPLETED',
        aggregationCompletedAt: new Date(),
      },
    });

    return result;
  } catch (error) {
    // 聚合失敗，記錄錯誤並恢復狀態
    console.error(`Term aggregation failed for batch ${batchId}:`, error);

    await prisma.historicalBatch.update({
      where: { id: batchId },
      data: {
        status: 'COMPLETED',
        errorMessage: `術語聚合失敗: ${error instanceof Error ? error.message : String(error)}`,
      },
    });

    throw error;
  }
}

/**
 * 檢查批次是否已有聚合結果
 *
 * @param batchId - 批次 ID
 * @returns 是否已聚合
 */
export async function hasAggregationResult(batchId: string): Promise<boolean> {
  const count = await prisma.termAggregationResult.count({
    where: { batchId },
  });
  return count > 0;
}

/**
 * 刪除聚合結果
 *
 * @param batchId - 批次 ID
 * @returns 是否有刪除記錄
 */
export async function deleteAggregationResult(batchId: string): Promise<boolean> {
  const result = await prisma.termAggregationResult.deleteMany({
    where: { batchId },
  });
  return result.count > 0;
}
