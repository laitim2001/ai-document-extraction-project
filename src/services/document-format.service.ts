/**
 * @fileoverview 文件格式識別服務
 * @description
 *   處理文件格式的識別、匹配和創建。
 *   與 GPT Vision 提取結果整合，建立 DocumentFormat 記錄。
 *   支援三層術語聚合結構：Company → DocumentFormat → Terms
 *
 * @module src/services/document-format
 * @since Epic 0 - Story 0.9
 * @lastModified 2025-12-26
 *
 * @features
 *   - 文件格式識別和匹配
 *   - 自動創建新格式記錄
 *   - 格式特徵學習
 *   - 常見術語統計
 *
 * @dependencies
 *   - prisma - 資料庫操作
 *   - document-issuer.service - 發行者識別（Story 0.8）
 *
 * @related
 *   - src/services/gpt-vision.service.ts - GPT Vision 提取
 *   - src/services/hierarchical-term-aggregation.service.ts - 三層聚合
 *   - src/types/document-format.ts - 類型定義
 */

import { prisma } from '@/lib/prisma';
import type {
  DocumentType,
  DocumentSubtype,
  DocumentFormatExtractionResult,
  DocumentFormatResult,
  DocumentFormatFeatures,
  FormatIdentificationConfig,
  DocumentFormatSummary,
  FormatListResponse,
} from '@/types/document-format';
import {
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_SUBTYPE_LABELS,
  DEFAULT_FORMAT_IDENTIFICATION_CONFIG,
} from '@/types/document-format';

// ============================================================================
// 主要服務函數
// ============================================================================

/**
 * 處理文件格式識別結果
 *
 * @description
 *   處理來自 GPT Vision 的格式識別結果，嘗試匹配現有格式或創建新格式。
 *   這是與批量處理整合的主要入口點。
 *
 * @param companyId - 發行公司 ID（來自 Story 0.8）
 * @param extractionResult - GPT Vision 提取的格式資訊
 * @param config - 識別配置
 * @returns 格式匹配/創建結果，如果不符合條件則返回 null
 *
 * @example
 * ```typescript
 * const result = await processDocumentFormat(
 *   'company-id-123',
 *   {
 *     documentType: 'INVOICE',
 *     documentSubtype: 'OCEAN_FREIGHT',
 *     formatConfidence: 92,
 *     formatFeatures: { hasLineItems: true, currency: 'USD' }
 *   }
 * );
 * ```
 */
export async function processDocumentFormat(
  companyId: string,
  extractionResult: DocumentFormatExtractionResult,
  config: Partial<FormatIdentificationConfig> = {}
): Promise<DocumentFormatResult | null> {
  const mergedConfig = { ...DEFAULT_FORMAT_IDENTIFICATION_CONFIG, ...config };

  // 檢查是否啟用
  if (!mergedConfig.enabled) {
    return null;
  }

  // 檢查信心度閾值
  if (extractionResult.formatConfidence < mergedConfig.confidenceThreshold) {
    console.warn(
      `[DocumentFormat] Format confidence ${extractionResult.formatConfidence} below threshold ${mergedConfig.confidenceThreshold}`
    );
    return null;
  }

  // 嘗試匹配現有格式
  const existingFormat = await findExistingFormat(
    companyId,
    extractionResult.documentType,
    extractionResult.documentSubtype
  );

  if (existingFormat) {
    // 更新現有格式
    await updateFormatStatistics(existingFormat.id, extractionResult, mergedConfig);

    return {
      formatId: existingFormat.id,
      documentType: existingFormat.documentType as DocumentType,
      documentSubtype: existingFormat.documentSubtype as DocumentSubtype,
      formatName:
        existingFormat.name ||
        generateFormatName(
          existingFormat.documentType as DocumentType,
          existingFormat.documentSubtype as DocumentSubtype
        ),
      confidence: extractionResult.formatConfidence,
      isNewFormat: false,
      companyId,
    };
  }

  // 創建新格式
  if (mergedConfig.autoCreateFormat) {
    const newFormat = await createDocumentFormat(companyId, extractionResult);

    console.log(
      `[DocumentFormat] Created new format: ${newFormat.id} for company ${companyId}`
    );

    return {
      formatId: newFormat.id,
      documentType: newFormat.documentType as DocumentType,
      documentSubtype: newFormat.documentSubtype as DocumentSubtype,
      formatName:
        newFormat.name ||
        generateFormatName(
          newFormat.documentType as DocumentType,
          newFormat.documentSubtype as DocumentSubtype
        ),
      confidence: extractionResult.formatConfidence,
      isNewFormat: true,
      companyId,
    };
  }

  return null;
}

// ============================================================================
// 格式查詢函數
// ============================================================================

/**
 * 查找現有格式
 *
 * @param companyId - 公司 ID
 * @param documentType - 文件類型
 * @param documentSubtype - 文件子類型
 * @returns 現有格式或 null
 */
async function findExistingFormat(
  companyId: string,
  documentType: DocumentType,
  documentSubtype: DocumentSubtype
) {
  return prisma.documentFormat.findUnique({
    where: {
      companyId_documentType_documentSubtype: {
        companyId,
        documentType,
        documentSubtype,
      },
    },
  });
}

/**
 * 根據 ID 獲取格式
 *
 * @param formatId - 格式 ID
 * @returns 格式詳情或 null
 */
export async function getFormatById(formatId: string) {
  return prisma.documentFormat.findUnique({
    where: { id: formatId },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          nameVariants: true,
        },
      },
      _count: {
        select: {
          files: true,
        },
      },
    },
  });
}

/**
 * 獲取公司的所有格式
 *
 * @param companyId - 公司 ID
 * @returns 格式列表
 */
export async function getFormatsByCompany(companyId: string) {
  return prisma.documentFormat.findMany({
    where: { companyId },
    orderBy: [{ documentType: 'asc' }, { documentSubtype: 'asc' }],
  });
}

/**
 * 獲取格式列表（分頁）
 *
 * @param options - 查詢選項
 * @returns 分頁格式列表
 */
export async function getFormatList(options: {
  page?: number;
  limit?: number;
  companyId?: string;
  documentType?: DocumentType;
  documentSubtype?: DocumentSubtype;
}): Promise<FormatListResponse> {
  const { page = 1, limit = 20, companyId, documentType, documentSubtype } = options;

  const where: Record<string, unknown> = {};
  if (companyId) where.companyId = companyId;
  if (documentType) where.documentType = documentType;
  if (documentSubtype) where.documentSubtype = documentSubtype;

  const [formats, total] = await Promise.all([
    prisma.documentFormat.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    prisma.documentFormat.count({ where }),
  ]);

  const formattedFormats: DocumentFormatSummary[] = formats.map((f) => ({
    id: f.id,
    companyId: f.companyId,
    companyName: f.company.name,
    documentType: f.documentType as DocumentType,
    documentSubtype: f.documentSubtype as DocumentSubtype,
    name: f.name,
    fileCount: f.fileCount,
    commonTerms: f.commonTerms,
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
  }));

  return {
    formats: formattedFormats,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ============================================================================
// 格式創建和更新函數
// ============================================================================

/**
 * 創建新的文件格式記錄
 *
 * @param companyId - 公司 ID
 * @param extractionResult - 提取結果
 * @returns 新創建的格式
 */
async function createDocumentFormat(
  companyId: string,
  extractionResult: DocumentFormatExtractionResult
) {
  const formatName = generateFormatName(
    extractionResult.documentType,
    extractionResult.documentSubtype
  );

  return prisma.documentFormat.create({
    data: {
      companyId,
      documentType: extractionResult.documentType,
      documentSubtype: extractionResult.documentSubtype,
      name: formatName,
      features: extractionResult.formatFeatures as object,
      commonTerms: [],
      fileCount: 1,
    },
  });
}

/**
 * 更新格式統計和特徵學習
 *
 * @param formatId - 格式 ID
 * @param extractionResult - 提取結果
 * @param config - 配置
 */
async function updateFormatStatistics(
  formatId: string,
  extractionResult: DocumentFormatExtractionResult,
  config: FormatIdentificationConfig
) {
  const updateData: Record<string, unknown> = {
    fileCount: { increment: 1 },
  };

  // 如果啟用特徵學習，合併新特徵
  if (config.learnFeatures) {
    const existingFormat = await prisma.documentFormat.findUnique({
      where: { id: formatId },
      select: { features: true },
    });

    if (existingFormat?.features && extractionResult.formatFeatures) {
      const mergedFeatures = mergeFormatFeatures(
        existingFormat.features as unknown as DocumentFormatFeatures,
        extractionResult.formatFeatures
      );
      updateData.features = mergedFeatures;
    }
  }

  await prisma.documentFormat.update({
    where: { id: formatId },
    data: updateData,
  });
}

/**
 * 更新格式的常見術語
 *
 * @description
 *   合併新術語到格式的 commonTerms 列表，
 *   按頻率排序並保留前 100 個。
 *
 * @param formatId - 格式 ID
 * @param newTerms - 新術語列表
 */
export async function updateFormatCommonTerms(
  formatId: string,
  newTerms: string[]
): Promise<void> {
  const format = await prisma.documentFormat.findUnique({
    where: { id: formatId },
    select: { commonTerms: true },
  });

  if (!format) return;

  // 合併並去重，保留前 100 個最常見的術語
  const allTerms = [...format.commonTerms, ...newTerms];
  const termCounts = allTerms.reduce(
    (acc, term) => {
      acc[term] = (acc[term] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const sortedTerms = Object.entries(termCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 100)
    .map(([term]) => term);

  await prisma.documentFormat.update({
    where: { id: formatId },
    data: { commonTerms: sortedTerms },
  });
}

/**
 * 關聯文件到格式
 *
 * @param fileId - 歷史文件 ID
 * @param formatId - 格式 ID
 * @param confidence - 識別信心度
 */
export async function linkFileToFormat(
  fileId: string,
  formatId: string,
  confidence: number
): Promise<void> {
  await prisma.historicalFile.update({
    where: { id: fileId },
    data: {
      documentFormatId: formatId,
      formatConfidence: confidence,
    },
  });
}

// ============================================================================
// 輔助函數
// ============================================================================

/**
 * 合併格式特徵（學習新特徵）
 *
 * @param existing - 現有特徵
 * @param newFeatures - 新特徵
 * @returns 合併後的特徵
 */
function mergeFormatFeatures(
  existing: DocumentFormatFeatures,
  newFeatures: DocumentFormatFeatures
): DocumentFormatFeatures {
  return {
    hasLineItems: existing.hasLineItems || newFeatures.hasLineItems,
    hasHeaderLogo: existing.hasHeaderLogo || newFeatures.hasHeaderLogo,
    currency: newFeatures.currency || existing.currency,
    language: newFeatures.language || existing.language,
    typicalFields: Array.from(
      new Set([...(existing.typicalFields || []), ...(newFeatures.typicalFields || [])])
    ),
    layoutPattern: newFeatures.layoutPattern || existing.layoutPattern,
  };
}

/**
 * 生成格式名稱
 *
 * @param documentType - 文件類型
 * @param documentSubtype - 文件子類型
 * @returns 格式名稱
 */
function generateFormatName(
  documentType: DocumentType,
  documentSubtype: DocumentSubtype
): string {
  return `${DOCUMENT_SUBTYPE_LABELS[documentSubtype]} ${DOCUMENT_TYPE_LABELS[documentType]}`;
}

// ============================================================================
// 統計和分析函數
// ============================================================================

/**
 * 獲取公司的格式統計
 *
 * @param companyId - 公司 ID
 * @returns 格式統計信息
 */
export async function getCompanyFormatStats(companyId: string) {
  const formats = await prisma.documentFormat.findMany({
    where: { companyId },
    select: {
      id: true,
      documentType: true,
      documentSubtype: true,
      fileCount: true,
      commonTerms: true,
    },
  });

  const totalFiles = formats.reduce((sum, f) => sum + f.fileCount, 0);
  const allTerms = formats.flatMap((f) => f.commonTerms);
  const uniqueTerms = new Set(allTerms);

  // 按類型分組統計
  const typeStats = formats.reduce(
    (acc, f) => {
      const type = f.documentType;
      if (!acc[type]) {
        acc[type] = { count: 0, fileCount: 0 };
      }
      acc[type].count++;
      acc[type].fileCount += f.fileCount;
      return acc;
    },
    {} as Record<string, { count: number; fileCount: number }>
  );

  return {
    totalFormats: formats.length,
    totalFiles,
    uniqueTerms: uniqueTerms.size,
    typeStats,
  };
}

/**
 * 獲取全局格式統計
 *
 * @returns 全局統計信息
 */
export async function getGlobalFormatStats() {
  const [totalFormats, totalCompanies, stats] = await Promise.all([
    prisma.documentFormat.count(),
    prisma.documentFormat
      .groupBy({
        by: ['companyId'],
      })
      .then((groups) => groups.length),
    prisma.documentFormat.aggregate({
      _sum: {
        fileCount: true,
      },
    }),
  ]);

  // 按文件類型統計
  const typeDistribution = await prisma.documentFormat.groupBy({
    by: ['documentType'],
    _count: true,
    _sum: {
      fileCount: true,
    },
  });

  // 按子類型統計
  const subtypeDistribution = await prisma.documentFormat.groupBy({
    by: ['documentSubtype'],
    _count: true,
    _sum: {
      fileCount: true,
    },
  });

  return {
    totalFormats,
    totalCompanies,
    totalFiles: stats._sum.fileCount || 0,
    typeDistribution: typeDistribution.map((t) => ({
      type: t.documentType,
      formatCount: t._count,
      fileCount: t._sum.fileCount || 0,
    })),
    subtypeDistribution: subtypeDistribution.map((s) => ({
      subtype: s.documentSubtype,
      formatCount: s._count,
      fileCount: s._sum.fileCount || 0,
    })),
  };
}
