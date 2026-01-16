/**
 * @fileoverview 三層術語聚合服務
 * @description
 *   實現 Company → DocumentFormat → Terms 三層聚合結構。
 *   取代原有的扁平聚合邏輯，提供更精細的術語分組。
 *
 *   三層結構：
 *   - 第一層：公司 (Company) - 發行文件的公司
 *   - 第二層：格式 (DocumentFormat) - 文件類型+子類型
 *   - 第三層：術語 (Terms) - 具體費用項目
 *
 * @module src/services/hierarchical-term-aggregation
 * @since Epic 0 - Story 0.9
 * @lastModified 2026-01-05
 *
 * @features
 *   - 三層術語聚合結構
 *   - 按公司、格式分組統計
 *   - 術語頻率排序
 *   - 可選的 AI 術語分類
 *   - FIX-005: 地址類術語過濾
 *   - FIX-006: 支援僅有 documentIssuerId 的文件（fallback 到 Company → Terms 結構）
 *   - FIX-027: 支援沒有 documentIssuerId 的文件（fallback 到虛擬「未識別公司」）
 *   - FIX-027: 新增 gptExtraction.invoiceData.lineItems 路徑支援
 *
 * @dependencies
 *   - prisma - 資料庫操作
 *   - term-aggregation.service - 術語正規化
 *
 * @related
 *   - src/services/document-format.service.ts - 格式識別服務
 *   - src/services/batch-term-aggregation.service.ts - 原有聚合服務
 *   - src/types/document-format.ts - 類型定義
 */

import { prisma } from '@/lib/prisma';
import type {
  HierarchicalTermAggregation,
  CompanyTermNode,
  FormatTermNode,
  TermNode,
  AggregationSummary,
  DocumentType,
  DocumentSubtype,
  HierarchicalAIValidationStats,
} from '@/types/document-format';
import { normalizeForAggregation, isAddressLikeTerm } from './term-aggregation.service';
import { aiTermValidator } from './ai-term-validator.service';

// ============================================================================
// Types
// ============================================================================

/**
 * 聚合選項
 */
export interface HierarchicalAggregationOptions {
  /** 是否包含 AI 術語分類（預設 false，未實現） */
  includeClassification?: boolean;
  /** 最小術語頻率（預設 1） */
  minTermFrequency?: number;
  /** 每個格式最大術語數（預設 500） */
  maxTermsPerFormat?: number;
  /** 是否啟用 AI 術語驗證（預設 false）- Story 0-10 */
  aiValidationEnabled?: boolean;
}

/**
 * 內部術語數據結構
 */
interface InternalTermData {
  count: number;
  examples: string[];
}

/**
 * 提取結果 JSON 結構
 * FIX: 新增 gptExtraction 路徑支援
 */
interface ExtractionResultJson {
  lineItems?: Array<{ description?: string | null }>;
  items?: Array<{ description?: string | null }>;
  invoiceData?: { lineItems?: Array<{ description?: string | null }> };
  extractedData?: { lineItems?: Array<{ description?: string | null }> };
  gptExtraction?: {
    invoiceData?: { lineItems?: Array<{ description?: string | null }> };
  };
}

// ============================================================================
// 主要服務函數
// ============================================================================

/**
 * 執行三層術語聚合
 *
 * @description
 *   從指定批次的所有已處理文件中提取術語，
 *   按 Company → DocumentFormat → Terms 三層結構組織。
 *
 * @param batchId - 批次 ID
 * @param options - 聚合選項
 * @returns 三層聚合結果
 *
 * @example
 * ```typescript
 * const result = await aggregateTermsHierarchically('batch-123', {
 *   minTermFrequency: 2,
 *   maxTermsPerFormat: 100,
 * });
 *
 * // 結果結構：
 * // {
 * //   companies: [
 * //     {
 * //       companyId: 'company-1',
 * //       companyName: 'DHL Express',
 * //       formats: [
 * //         {
 * //           formatId: 'format-1',
 * //           documentType: 'INVOICE',
 * //           documentSubtype: 'OCEAN_FREIGHT',
 * //           terms: [
 * //             { term: 'OCEAN FREIGHT', frequency: 45 },
 * //             { term: 'THC', frequency: 32 }
 * //           ]
 * //         }
 * //       ]
 * //     }
 * //   ],
 * //   summary: { totalCompanies: 5, totalFormats: 12, totalUniqueTerms: 156 }
 * // }
 * ```
 */
export async function aggregateTermsHierarchically(
  batchId: string,
  options: HierarchicalAggregationOptions = {}
): Promise<HierarchicalTermAggregation> {
  const {
    includeClassification = false,
    minTermFrequency = 1,
    maxTermsPerFormat = 500,
    aiValidationEnabled = false,
  } = options;

  // Story 0-10: AI 驗證統計追蹤
  let aiValidationStats: HierarchicalAIValidationStats | undefined;

  // FIX-006: 嘗試獲取有 documentFormatId 的文件，如果沒有則 fallback 到只有 documentIssuerId 的文件
  // FIX-027: 添加第三層 fallback，支援沒有 documentIssuerId 的文件
  // 1. 先嘗試獲取完整三層結構的文件
  let files = await prisma.historicalFile.findMany({
    where: {
      batchId,
      status: 'COMPLETED',
      documentIssuerId: { not: null },
      documentFormatId: { not: null },
    },
    include: {
      documentIssuer: true,
      documentFormat: true,
    },
  });

  // FIX-006: 如果沒有文件有 documentFormatId，則 fallback 到只需要 documentIssuerId
  const useFallbackMode = files.length === 0;
  let useUnidentifiedFallback = false;

  if (useFallbackMode) {
    console.log(
      `[HierarchicalAggregation] No files with documentFormatId found, trying fallback mode (Company → Terms)`
    );
    files = await prisma.historicalFile.findMany({
      where: {
        batchId,
        status: 'COMPLETED',
        documentIssuerId: { not: null },
      },
      include: {
        documentIssuer: true,
        documentFormat: true, // 會是 null，但需要保持類型一致
      },
    });
  }

  // FIX-027: 如果連 documentIssuerId 都沒有，則 fallback 到所有 COMPLETED 文件
  if (files.length === 0) {
    console.log(
      `[HierarchicalAggregation] No files with documentIssuerId found, using unidentified fallback mode`
    );
    useUnidentifiedFallback = true;
    files = await prisma.historicalFile.findMany({
      where: {
        batchId,
        status: 'COMPLETED',
      },
      include: {
        documentIssuer: true,
        documentFormat: true,
      },
    });
  }

  // 2. 建立三層結構的 Map
  type CompanyMapValue = {
    company: NonNullable<(typeof files)[0]['documentIssuer']>;
    formats: Map<
      string,
      {
        format: NonNullable<(typeof files)[0]['documentFormat']>;
        terms: Map<string, InternalTermData>;
      }
    >;
  };

  const companyMap = new Map<string, CompanyMapValue>();

  // FIX-006: 用於 fallback 模式的預設格式 ID 前綴
  const DEFAULT_FORMAT_PREFIX = 'default-format-';
  // FIX-027: 用於未識別公司的虛擬 ID
  const UNIDENTIFIED_COMPANY_ID = 'unidentified-company';
  const UNIDENTIFIED_COMPANY_NAME = '未識別公司';

  // 3. 遍歷文件，組織數據
  for (const file of files) {
    // FIX-027: 如果沒有 documentIssuerId，使用虛擬公司 ID
    const issuerId = file.documentIssuerId || UNIDENTIFIED_COMPANY_ID;
    // FIX-006: 如果沒有 documentFormatId，使用預設格式 ID（基於公司 ID）
    const formatId = file.documentFormatId || `${DEFAULT_FORMAT_PREFIX}${issuerId}`;

    // 確保公司節點存在
    if (!companyMap.has(issuerId)) {
      // FIX-027: 如果是未識別公司，創建虛擬公司物件
      const companyData = file.documentIssuer || {
        id: UNIDENTIFIED_COMPANY_ID,
        name: UNIDENTIFIED_COMPANY_NAME,
        nameVariants: [],
      };
      companyMap.set(issuerId, {
        company: companyData as NonNullable<(typeof files)[0]['documentIssuer']>,
        formats: new Map(),
      });
    }

    const companyNode = companyMap.get(issuerId)!;

    // 確保格式節點存在
    if (!companyNode.formats.has(formatId)) {
      // FIX-006: 如果是 fallback 模式，創建虛擬格式物件
      const formatData = file.documentFormat || {
        id: formatId,
        documentType: 'INVOICE',
        documentSubtype: 'GENERAL',
        name: 'Default Format',
        fileCount: 0,
      };

      companyNode.formats.set(formatId, {
        format: formatData as NonNullable<(typeof files)[0]['documentFormat']>,
        terms: new Map(),
      });
    }

    const formatNode = companyNode.formats.get(formatId)!;

    // 提取並聚合術語
    const extractionResult = file.extractionResult as ExtractionResultJson | null;
    const lineItems = extractTermsFromResult(extractionResult);

    for (const description of lineItems) {
      if (!description) continue;

      const normalizedTerm = normalizeForAggregation(description);
      if (!normalizedTerm || normalizedTerm.length < 2) continue;
      // FIX-005: 過濾地址類術語
      if (isAddressLikeTerm(normalizedTerm)) continue;

      const existing = formatNode.terms.get(normalizedTerm);
      if (existing) {
        existing.count++;
        if (existing.examples.length < 3) {
          existing.examples.push(description);
        }
      } else {
        formatNode.terms.set(normalizedTerm, {
          count: 1,
          examples: [description],
        });
      }
    }
  }

  // 3.5 Story 0-10: AI 術語驗證（如果啟用）
  if (aiValidationEnabled) {
    // 收集所有唯一術語
    const allUniqueTerms = new Set<string>();
    for (const companyData of companyMap.values()) {
      for (const formatData of companyData.formats.values()) {
        for (const term of formatData.terms.keys()) {
          allUniqueTerms.add(term);
        }
      }
    }

    const termsBeforeValidation = allUniqueTerms.size;
    const validationStartTime = Date.now();

    try {
      console.log(
        `[HierarchicalAggregation] Starting AI validation for ${termsBeforeValidation} unique terms...`
      );

      // 執行 AI 驗證
      const allTermsArray = Array.from(allUniqueTerms);
      const validTermsSet = new Set(
        await aiTermValidator.filterValidTerms(allTermsArray, batchId)
      );

      // 從三層結構中移除無效術語
      for (const companyData of companyMap.values()) {
        for (const formatData of companyData.formats.values()) {
          for (const term of formatData.terms.keys()) {
            if (!validTermsSet.has(term)) {
              formatData.terms.delete(term);
            }
          }
        }
      }

      const validationEndTime = Date.now();
      const termsAfterValidation = validTermsSet.size;
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
        `[HierarchicalAggregation] AI validation completed: ` +
          `${termsBeforeValidation} → ${termsAfterValidation} terms ` +
          `(${aiValidationStats.filteredTermsCount} filtered, $${validationCost.toFixed(4)})`
      );
    } catch (error) {
      console.error('[HierarchicalAggregation] AI validation failed:', error);
      // 驗證失敗時繼續使用原有術語（fallback 到 isAddressLikeTerm 已在提取時應用）
    }
  }

  // 4. 轉換為輸出結構
  const companies: CompanyTermNode[] = [];
  let totalFormats = 0;
  let totalUniqueTerms = 0;
  let totalTermOccurrences = 0;

  for (const [companyId, companyData] of companyMap) {
    const formats: FormatTermNode[] = [];

    for (const [formatId, formatData] of companyData.formats) {
      // 過濾和排序術語
      const terms: TermNode[] = [];

      for (const [term, data] of formatData.terms) {
        if (data.count < minTermFrequency) continue;

        const termNode: TermNode = {
          term,
          normalizedTerm: term,
          frequency: data.count,
          examples: data.examples,
        };

        // 可選：使用 AI 分類術語（暫未實現）
        if (includeClassification) {
          // TODO: 實現 AI 術語分類
          // 目前跳過，保留擴展點
          console.warn(
            `[HierarchicalAggregation] AI classification not yet implemented for term: ${term}`
          );
        }

        terms.push(termNode);
        totalTermOccurrences += data.count;
      }

      // 按頻率排序並限制數量
      terms.sort((a, b) => b.frequency - a.frequency);
      const limitedTerms = terms.slice(0, maxTermsPerFormat);

      totalUniqueTerms += limitedTerms.length;

      formats.push({
        formatId,
        documentType: formatData.format.documentType as DocumentType,
        documentSubtype: formatData.format.documentSubtype as DocumentSubtype,
        formatName: formatData.format.name || 'Unknown Format',
        fileCount: formatData.format.fileCount,
        terms: limitedTerms,
        termCount: limitedTerms.length,
      });
    }

    totalFormats += formats.length;

    // 計算公司的文件數
    const companyFileCount = files.filter((f) => f.documentIssuerId === companyId).length;

    companies.push({
      companyId,
      companyName: companyData.company.name,
      companyNameVariants: companyData.company.nameVariants || [],
      fileCount: companyFileCount,
      formats,
    });
  }

  // 按文件數量排序公司
  companies.sort((a, b) => b.fileCount - a.fileCount);

  const summary: AggregationSummary = {
    totalCompanies: companies.length,
    totalFormats,
    totalUniqueTerms,
    totalTermOccurrences,
  };

  // FIX-006 & FIX-027: 記錄聚合模式
  if (useUnidentifiedFallback) {
    console.log(
      `[HierarchicalAggregation] Unidentified fallback mode completed: ` +
        `${companies.length} companies, ${totalUniqueTerms} unique terms, ${totalTermOccurrences} occurrences`
    );
  } else if (useFallbackMode) {
    console.log(
      `[HierarchicalAggregation] Fallback mode completed: ` +
        `${companies.length} companies, ${totalUniqueTerms} unique terms, ${totalTermOccurrences} occurrences`
    );
  }

  return {
    companies,
    summary,
    aiValidation: aiValidationStats,
  };
}

/**
 * 獲取特定公司的術語聚合
 *
 * @description
 *   獲取單一公司下所有格式的術語聚合，
 *   用於公司詳情頁面展示。
 *
 * @param companyId - 公司 ID
 * @returns 公司術語節點，如果公司不存在則返回 null
 */
export async function getCompanyTermAggregation(
  companyId: string
): Promise<CompanyTermNode | null> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
  });

  if (!company) return null;

  const formats = await prisma.documentFormat.findMany({
    where: { companyId },
    include: {
      files: {
        where: { status: 'COMPLETED' },
        select: { extractionResult: true },
      },
    },
  });

  const formatNodes: FormatTermNode[] = [];

  for (const format of formats) {
    const termMap = new Map<string, number>();

    for (const file of format.files) {
      const result = file.extractionResult as ExtractionResultJson | null;
      const descriptions = extractTermsFromResult(result);

      for (const description of descriptions) {
        if (!description) continue;
        const normalized = normalizeForAggregation(description);
        // FIX-005: 過濾地址類術語
        if (normalized && normalized.length >= 2 && !isAddressLikeTerm(normalized)) {
          termMap.set(normalized, (termMap.get(normalized) || 0) + 1);
        }
      }
    }

    const terms: TermNode[] = Array.from(termMap.entries())
      .map(([term, frequency]) => ({
        term,
        normalizedTerm: term,
        frequency,
      }))
      .sort((a, b) => b.frequency - a.frequency);

    formatNodes.push({
      formatId: format.id,
      documentType: format.documentType as DocumentType,
      documentSubtype: format.documentSubtype as DocumentSubtype,
      formatName: format.name || 'Unknown',
      fileCount: format.fileCount,
      terms,
      termCount: terms.length,
    });
  }

  return {
    companyId,
    companyName: company.name,
    companyNameVariants: company.nameVariants || [],
    fileCount: formats.reduce((sum, f) => sum + f.fileCount, 0),
    formats: formatNodes,
  };
}

/**
 * 獲取特定格式的術語聚合
 *
 * @description
 *   獲取單一格式下的所有術語，
 *   用於格式詳情頁面展示。
 *
 * @param formatId - 格式 ID
 * @returns 格式術語節點，如果格式不存在則返回 null
 */
export async function getFormatTermAggregation(
  formatId: string
): Promise<FormatTermNode | null> {
  const format = await prisma.documentFormat.findUnique({
    where: { id: formatId },
    include: {
      files: {
        where: { status: 'COMPLETED' },
        select: { extractionResult: true },
      },
    },
  });

  if (!format) return null;

  const termMap = new Map<string, { count: number; examples: string[] }>();

  for (const file of format.files) {
    const result = file.extractionResult as ExtractionResultJson | null;
    const descriptions = extractTermsFromResult(result);

    for (const description of descriptions) {
      if (!description) continue;
      const normalized = normalizeForAggregation(description);
      if (!normalized || normalized.length < 2) continue;
      // FIX-005: 過濾地址類術語
      if (isAddressLikeTerm(normalized)) continue;

      const existing = termMap.get(normalized);
      if (existing) {
        existing.count++;
        if (existing.examples.length < 3) {
          existing.examples.push(description);
        }
      } else {
        termMap.set(normalized, { count: 1, examples: [description] });
      }
    }
  }

  const terms: TermNode[] = Array.from(termMap.entries())
    .map(([term, data]) => ({
      term,
      normalizedTerm: term,
      frequency: data.count,
      examples: data.examples,
    }))
    .sort((a, b) => b.frequency - a.frequency);

  return {
    formatId: format.id,
    documentType: format.documentType as DocumentType,
    documentSubtype: format.documentSubtype as DocumentSubtype,
    formatName: format.name || 'Unknown',
    fileCount: format.fileCount,
    terms,
    termCount: terms.length,
  };
}

/**
 * 獲取全局術語統計
 *
 * @description
 *   獲取整個系統的術語統計摘要，
 *   用於儀表板展示。
 *
 * @returns 全局聚合統計
 */
export async function getGlobalTermStats(): Promise<AggregationSummary> {
  const [companyCount, formatCount] = await Promise.all([
    prisma.company.count(),
    prisma.documentFormat.count(),
  ]);

  // 計算唯一術語數（從所有格式的 commonTerms 聚合）
  const formats = await prisma.documentFormat.findMany({
    select: { commonTerms: true, fileCount: true },
  });

  const allTerms = new Set<string>();
  let totalOccurrences = 0;

  for (const format of formats) {
    for (const term of format.commonTerms) {
      allTerms.add(term);
    }
    totalOccurrences += format.fileCount; // 粗估
  }

  return {
    totalCompanies: companyCount,
    totalFormats: formatCount,
    totalUniqueTerms: allTerms.size,
    totalTermOccurrences: totalOccurrences,
  };
}

// ============================================================================
// 輔助函數
// ============================================================================

/**
 * 從提取結果中提取術語描述
 *
 * @param result - JSON 提取結果
 * @returns 描述列表
 *
 * FIX: 新增 gptExtraction.invoiceData.lineItems 路徑支援
 * 舊的 Unified Processor 會將 GPT Vision 結果放在 gptExtraction 內
 */
function extractTermsFromResult(result: ExtractionResultJson | null): string[] {
  if (!result) return [];

  const descriptions: string[] = [];

  // 嘗試從不同格式中提取
  // FIX: 新增 gptExtraction.invoiceData.lineItems 路徑
  const items =
    result.lineItems ??
    result.items ??
    result.invoiceData?.lineItems ??
    result.extractedData?.lineItems ??
    result.gptExtraction?.invoiceData?.lineItems ??
    [];

  for (const item of items) {
    if (item.description) {
      descriptions.push(item.description);
    }
  }

  return descriptions;
}

/**
 * 比較兩個公司的術語重疊度
 *
 * @description
 *   計算兩個公司之間的術語 Jaccard 相似度，
 *   用於識別可能的公司合併或關聯。
 *
 * @param companyId1 - 第一個公司 ID
 * @param companyId2 - 第二個公司 ID
 * @returns 重疊度（0-1）
 */
export async function compareCompanyTermOverlap(
  companyId1: string,
  companyId2: string
): Promise<number> {
  const [formats1, formats2] = await Promise.all([
    prisma.documentFormat.findMany({
      where: { companyId: companyId1 },
      select: { commonTerms: true },
    }),
    prisma.documentFormat.findMany({
      where: { companyId: companyId2 },
      select: { commonTerms: true },
    }),
  ]);

  const terms1 = new Set(formats1.flatMap((f) => f.commonTerms));
  const terms2 = new Set(formats2.flatMap((f) => f.commonTerms));

  if (terms1.size === 0 && terms2.size === 0) return 0;

  // 計算 Jaccard 相似度
  const intersection = new Set([...terms1].filter((t) => terms2.has(t)));
  const union = new Set([...terms1, ...terms2]);

  return intersection.size / union.size;
}
