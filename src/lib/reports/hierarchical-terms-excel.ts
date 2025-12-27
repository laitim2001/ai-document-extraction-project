/**
 * @fileoverview 階層式術語報告 Excel 生成器
 * @description
 *   生成 Epic 0 歷史數據初始化的術語報告，包含：
 *   - 摘要工作表：批次資訊和統計摘要
 *   - 公司列表：所有識別的公司及其統計
 *   - 格式列表：文件格式及其關聯資訊
 *   - 術語列表：所有術語（按頻率排序）
 *
 * @module src/lib/reports/hierarchical-terms-excel
 * @since Epic 0 - CHANGE-002
 * @lastModified 2025-12-27
 *
 * @features
 *   - 四個工作表的 Excel 報告生成
 *   - 術語按頻率降序排列
 *   - 包含原始術語範例
 *   - 支援篩選和凍結標題行
 *
 * @dependencies
 *   - exceljs - Excel 生成庫
 *   - @/types/document-format - 類型定義
 *
 * @related
 *   - src/services/hierarchical-term-aggregation.service.ts - 數據聚合
 *   - claudedocs/4-changes/feature-changes/CHANGE-002-*.md - 設計文檔
 */

import ExcelJS from 'exceljs';
import type {
  HierarchicalTermAggregation,
  DocumentType,
  DocumentSubtype,
} from '@/types/document-format';

// ============================================================================
// Types
// ============================================================================

/**
 * 階層式術語報告數據結構
 */
export interface HierarchicalTermsReportData {
  /** 批次資訊 */
  batch: {
    id: string;
    name: string;
    startedAt: Date | null;
    completedAt: Date | null;
  };
  /** 聚合數據 */
  aggregation: HierarchicalTermAggregation;
  /** 報告產生時間 */
  generatedAt: Date;
  /** 報告產生者 */
  generatedBy: string;
}

/**
 * 匯出選項
 */
export interface HierarchicalTermsExportOptions {
  /** 最小術語頻率 (預設 1) */
  minTermFrequency?: number;
  /** 每個格式最大術語數 (預設 500) */
  maxTermsPerFormat?: number;
  /** 是否包含範例 (預設 true) */
  includeExamples?: boolean;
  /** 語言 (預設 'zh') */
  locale?: 'zh' | 'en';
}

// ============================================================================
// Constants
// ============================================================================

/**
 * 文件類型顯示名稱（中文）
 */
const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  INVOICE: '發票',
  DEBIT_NOTE: '借項通知單',
  CREDIT_NOTE: '貸項通知單',
  STATEMENT: '對帳單',
  QUOTATION: '報價單',
  BILL_OF_LADING: '提單',
  CUSTOMS_DECLARATION: '報關單',
  OTHER: '其他',
};

/**
 * 文件子類型顯示名稱（中文）
 */
const DOCUMENT_SUBTYPE_LABELS: Record<DocumentSubtype, string> = {
  OCEAN_FREIGHT: '海運',
  AIR_FREIGHT: '空運',
  LAND_TRANSPORT: '陸運',
  CUSTOMS_CLEARANCE: '報關',
  WAREHOUSING: '倉儲',
  GENERAL: '一般',
};

/**
 * Excel 樣式定義
 */
const STYLES = {
  /** 標題行背景 */
  headerFill: {
    type: 'pattern' as const,
    pattern: 'solid' as const,
    fgColor: { argb: 'FF4472C4' },
  },
  /** 標題行字體 */
  headerFont: {
    bold: true,
    color: { argb: 'FFFFFFFF' },
  },
  /** 摘要區背景 */
  summaryFill: {
    type: 'pattern' as const,
    pattern: 'solid' as const,
    fgColor: { argb: 'FFE0E0E0' },
  },
  /** 高頻術語背景 (頻率 >= 10) */
  highFrequencyFill: {
    type: 'pattern' as const,
    pattern: 'solid' as const,
    fgColor: { argb: 'FFD4EDDA' },
  },
  /** 中頻術語背景 (頻率 5-9) */
  mediumFrequencyFill: {
    type: 'pattern' as const,
    pattern: 'solid' as const,
    fgColor: { argb: 'FFF8F9FA' },
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 格式化日期為台灣格式
 */
function formatDate(date: Date | null): string {
  if (!date) return 'N/A';
  return date.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * 格式化文件類型顯示
 */
function formatDocumentType(
  documentType: DocumentType,
  documentSubtype: DocumentSubtype
): string {
  const typeLabel = DOCUMENT_TYPE_LABELS[documentType] || documentType;
  const subtypeLabel = DOCUMENT_SUBTYPE_LABELS[documentSubtype] || documentSubtype;
  return `${subtypeLabel} ${typeLabel}`;
}

/**
 * 取得頻率顏色
 */
function getFrequencyFill(frequency: number): ExcelJS.Fill | undefined {
  if (frequency >= 10) return STYLES.highFrequencyFill;
  if (frequency >= 5) return STYLES.mediumFrequencyFill;
  return undefined;
}

// ============================================================================
// Main Export Function
// ============================================================================

/**
 * 生成階層式術語報告 Excel
 *
 * @description
 *   使用 ExcelJS 生成包含四個工作表的 Excel 報告：
 *   1. 摘要工作表 - 批次資訊和統計
 *   2. 公司列表 - 所有識別的公司
 *   3. 格式列表 - 文件格式及關聯
 *   4. 術語列表 - 所有術語（按頻率排序）
 *
 * @param data - 報告數據
 * @param options - 匯出選項
 * @returns Excel Buffer
 *
 * @example
 * ```typescript
 * const buffer = await generateHierarchicalTermsExcel({
 *   batch: { id: 'batch-123', name: 'Test Batch', ... },
 *   aggregation: { companies: [...], summary: {...} },
 *   generatedAt: new Date(),
 *   generatedBy: 'admin@example.com'
 * });
 * ```
 */
export async function generateHierarchicalTermsExcel(
  data: HierarchicalTermsReportData,
  options: HierarchicalTermsExportOptions = {}
): Promise<Buffer> {
  const {
    minTermFrequency = 1,
    maxTermsPerFormat = 500,
    includeExamples = true,
  } = options;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = data.generatedBy;
  workbook.created = data.generatedAt;
  workbook.lastModifiedBy = data.generatedBy;

  // ========================================
  // 工作表 1: 摘要
  // ========================================
  const summarySheet = workbook.addWorksheet('摘要');

  summarySheet.columns = [
    { header: '項目', key: 'item', width: 25 },
    { header: '值', key: 'value', width: 50 },
  ];

  const { batch, aggregation } = data;
  const { summary } = aggregation;

  summarySheet.addRows([
    { item: '批次 ID', value: batch.id },
    { item: '批次名稱', value: batch.name },
    { item: '開始時間', value: formatDate(batch.startedAt) },
    { item: '完成時間', value: formatDate(batch.completedAt) },
    { item: '', value: '' },
    { item: '公司數量', value: summary.totalCompanies },
    { item: '格式數量', value: summary.totalFormats },
    { item: '唯一術語數', value: summary.totalUniqueTerms },
    { item: '術語出現次數', value: summary.totalTermOccurrences },
    { item: '', value: '' },
    { item: '報告產生時間', value: formatDate(data.generatedAt) },
    { item: '產生者', value: data.generatedBy },
  ]);

  // 摘要工作表樣式
  summarySheet.getRow(1).font = { bold: true };
  summarySheet.getRow(1).fill = STYLES.summaryFill;

  // ========================================
  // 工作表 2: 公司列表
  // ========================================
  const companiesSheet = workbook.addWorksheet('公司列表');

  companiesSheet.columns = [
    { header: '序號', key: 'index', width: 8 },
    { header: '公司 ID', key: 'companyId', width: 30 },
    { header: '公司名稱', key: 'companyName', width: 35 },
    { header: '名稱變體', key: 'nameVariants', width: 40 },
    { header: '文件數量', key: 'fileCount', width: 12 },
    { header: '格式數量', key: 'formatCount', width: 12 },
    { header: '術語數量', key: 'termCount', width: 12 },
  ];

  aggregation.companies.forEach((company, index) => {
    const totalTerms = company.formats.reduce((sum, f) => sum + f.termCount, 0);
    companiesSheet.addRow({
      index: index + 1,
      companyId: company.companyId,
      companyName: company.companyName,
      nameVariants: company.companyNameVariants.join(', ') || '-',
      fileCount: company.fileCount,
      formatCount: company.formats.length,
      termCount: totalTerms,
    });
  });

  // 公司列表標題行樣式
  companiesSheet.getRow(1).font = STYLES.headerFont;
  companiesSheet.getRow(1).fill = STYLES.headerFill;

  // 設置自動篩選
  if (aggregation.companies.length > 0) {
    companiesSheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: aggregation.companies.length + 1, column: 7 },
    };
  }

  // 凍結標題行
  companiesSheet.views = [{ state: 'frozen', ySplit: 1 }];

  // ========================================
  // 工作表 3: 格式列表
  // ========================================
  const formatsSheet = workbook.addWorksheet('格式列表');

  formatsSheet.columns = [
    { header: '序號', key: 'index', width: 8 },
    { header: '格式 ID', key: 'formatId', width: 30 },
    { header: '所屬公司', key: 'companyName', width: 30 },
    { header: '文件類型', key: 'documentType', width: 15 },
    { header: '文件子類型', key: 'documentSubtype', width: 15 },
    { header: '格式名稱', key: 'formatName', width: 35 },
    { header: '文件數量', key: 'fileCount', width: 12 },
    { header: '術語數量', key: 'termCount', width: 12 },
  ];

  let formatIndex = 0;
  for (const company of aggregation.companies) {
    for (const format of company.formats) {
      formatIndex++;
      formatsSheet.addRow({
        index: formatIndex,
        formatId: format.formatId,
        companyName: company.companyName,
        documentType: DOCUMENT_TYPE_LABELS[format.documentType] || format.documentType,
        documentSubtype: DOCUMENT_SUBTYPE_LABELS[format.documentSubtype] || format.documentSubtype,
        formatName: format.formatName,
        fileCount: format.fileCount,
        termCount: format.termCount,
      });
    }
  }

  // 格式列表標題行樣式
  formatsSheet.getRow(1).font = STYLES.headerFont;
  formatsSheet.getRow(1).fill = STYLES.headerFill;

  if (formatIndex > 0) {
    formatsSheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: formatIndex + 1, column: 8 },
    };
  }

  formatsSheet.views = [{ state: 'frozen', ySplit: 1 }];

  // ========================================
  // 工作表 4: 術語列表
  // ========================================
  const termsSheet = workbook.addWorksheet('術語列表');

  const termColumns: Partial<ExcelJS.Column>[] = [
    { header: '序號', key: 'index', width: 8 },
    { header: '公司名稱', key: 'companyName', width: 25 },
    { header: '格式類型', key: 'formatType', width: 25 },
    { header: '術語', key: 'term', width: 40 },
    { header: '出現頻率', key: 'frequency', width: 12 },
  ];

  if (includeExamples) {
    termColumns.push({ header: '範例', key: 'examples', width: 60 });
  }

  termColumns.push({ header: '建議分類', key: 'suggestedCategory', width: 20 });

  termsSheet.columns = termColumns;

  // 收集所有術語並按頻率排序
  interface FlattenedTerm {
    companyName: string;
    formatType: string;
    term: string;
    frequency: number;
    examples: string[];
    suggestedCategory?: string;
  }

  const allTerms: FlattenedTerm[] = [];

  for (const company of aggregation.companies) {
    for (const format of company.formats) {
      const formatType = formatDocumentType(format.documentType, format.documentSubtype);

      for (const termNode of format.terms) {
        if (termNode.frequency < minTermFrequency) continue;

        allTerms.push({
          companyName: company.companyName,
          formatType,
          term: termNode.term,
          frequency: termNode.frequency,
          examples: termNode.examples || [],
          suggestedCategory: termNode.suggestedCategory,
        });
      }
    }
  }

  // 按頻率降序排序
  allTerms.sort((a, b) => b.frequency - a.frequency);

  // 限制每個格式的術語數量（已在聚合時處理，這裡做全局限制）
  const limitedTerms = allTerms.slice(0, maxTermsPerFormat * summary.totalFormats);

  // 添加數據行
  limitedTerms.forEach((term, index) => {
    const rowData: Record<string, string | number> = {
      index: index + 1,
      companyName: term.companyName,
      formatType: term.formatType,
      term: term.term,
      frequency: term.frequency,
    };

    if (includeExamples) {
      rowData.examples = term.examples.slice(0, 3).join(' | ') || '-';
    }

    rowData.suggestedCategory = term.suggestedCategory || '';

    const row = termsSheet.addRow(rowData);

    // 根據頻率設置背景顏色
    const fill = getFrequencyFill(term.frequency);
    if (fill) {
      row.eachCell((cell) => {
        cell.fill = fill;
      });
    }
  });

  // 術語列表標題行樣式
  termsSheet.getRow(1).font = STYLES.headerFont;
  termsSheet.getRow(1).fill = STYLES.headerFill;

  if (limitedTerms.length > 0) {
    termsSheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: limitedTerms.length + 1, column: termColumns.length },
    };
  }

  termsSheet.views = [{ state: 'frozen', ySplit: 1 }];

  // ========================================
  // 生成 Buffer
  // ========================================
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * 生成報告文件名
 *
 * @param batchName - 批次名稱
 * @param date - 日期（預設為現在）
 * @returns 格式化的文件名
 */
export function generateReportFileName(batchName: string, date: Date = new Date()): string {
  const dateStr = date.toISOString().slice(0, 10); // YYYY-MM-DD
  const sanitizedName = batchName
    .replace(/[<>:"/\\|?*]/g, '_') // 移除不合法字元
    .replace(/\s+/g, '_') // 空格替換為底線
    .slice(0, 50); // 限制長度

  return `術語報告-${sanitizedName}-${dateStr}.xlsx`;
}
