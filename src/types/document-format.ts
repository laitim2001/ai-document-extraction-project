/**
 * @fileoverview 文件格式識別相關類型定義
 * @description
 *   提供 Story 0.9 文件格式識別與三層術語聚合所需的所有類型定義：
 *   - DocumentType 和 DocumentSubtype 枚舉
 *   - GPT Vision 提取結果類型
 *   - 格式匹配結果類型
 *   - 三層聚合結構類型
 *   - API 響應類型
 *
 * @module src/types/document-format
 * @since Epic 0 - Story 0.9
 * @lastModified 2025-12-26
 */

// ============================================================================
// 文件類型 Enums
// ============================================================================

/**
 * 文件類型 - 對應 Prisma DocumentType enum
 */
export type DocumentType =
  | 'INVOICE'              // 標準發票
  | 'DEBIT_NOTE'           // 借項通知單
  | 'CREDIT_NOTE'          // 貸項通知單
  | 'STATEMENT'            // 對帳單
  | 'QUOTATION'            // 報價單
  | 'BILL_OF_LADING'       // 提單
  | 'CUSTOMS_DECLARATION'  // 報關單
  | 'OTHER';               // 其他

/**
 * 文件子類型（業務領域） - 對應 Prisma DocumentSubtype enum
 */
export type DocumentSubtype =
  | 'OCEAN_FREIGHT'        // 海運
  | 'AIR_FREIGHT'          // 空運
  | 'LAND_TRANSPORT'       // 陸運
  | 'CUSTOMS_CLEARANCE'    // 報關
  | 'WAREHOUSING'          // 倉儲
  | 'GENERAL';             // 一般/混合

// ============================================================================
// 文件類型常量映射
// ============================================================================

/**
 * 文件類型顯示名稱（英文）
 */
export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  INVOICE: 'Invoice',
  DEBIT_NOTE: 'Debit Note',
  CREDIT_NOTE: 'Credit Note',
  STATEMENT: 'Statement',
  QUOTATION: 'Quotation',
  BILL_OF_LADING: 'Bill of Lading',
  CUSTOMS_DECLARATION: 'Customs Declaration',
  OTHER: 'Other',
};

/**
 * 文件類型顯示名稱（中文）
 */
export const DOCUMENT_TYPE_LABELS_ZH: Record<DocumentType, string> = {
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
 * 文件子類型顯示名稱（英文）
 */
export const DOCUMENT_SUBTYPE_LABELS: Record<DocumentSubtype, string> = {
  OCEAN_FREIGHT: 'Ocean Freight',
  AIR_FREIGHT: 'Air Freight',
  LAND_TRANSPORT: 'Land Transport',
  CUSTOMS_CLEARANCE: 'Customs Clearance',
  WAREHOUSING: 'Warehousing',
  GENERAL: 'General',
};

/**
 * 文件子類型顯示名稱（中文）
 */
export const DOCUMENT_SUBTYPE_LABELS_ZH: Record<DocumentSubtype, string> = {
  OCEAN_FREIGHT: '海運',
  AIR_FREIGHT: '空運',
  LAND_TRANSPORT: '陸運',
  CUSTOMS_CLEARANCE: '報關',
  WAREHOUSING: '倉儲',
  GENERAL: '一般',
};

/**
 * 所有文件類型列表
 */
export const ALL_DOCUMENT_TYPES: DocumentType[] = [
  'INVOICE',
  'DEBIT_NOTE',
  'CREDIT_NOTE',
  'STATEMENT',
  'QUOTATION',
  'BILL_OF_LADING',
  'CUSTOMS_DECLARATION',
  'OTHER',
];

/**
 * 所有文件子類型列表
 */
export const ALL_DOCUMENT_SUBTYPES: DocumentSubtype[] = [
  'OCEAN_FREIGHT',
  'AIR_FREIGHT',
  'LAND_TRANSPORT',
  'CUSTOMS_CLEARANCE',
  'WAREHOUSING',
  'GENERAL',
];

// ============================================================================
// GPT Vision 提取結果
// ============================================================================

/**
 * GPT Vision 文件格式提取結果
 */
export interface DocumentFormatExtractionResult {
  documentType: DocumentType;
  documentSubtype: DocumentSubtype;
  formatConfidence: number;  // 0-100
  formatFeatures: DocumentFormatFeatures;
}

/**
 * 文件格式特徵
 */
export interface DocumentFormatFeatures {
  /** 是否包含明細項目 */
  hasLineItems: boolean;
  /** 是否有公司 Logo */
  hasHeaderLogo: boolean;
  /** 檢測到的貨幣代碼 */
  currency?: string;
  /** 主要語言 */
  language?: string;
  /** 常見欄位名稱 */
  typicalFields?: string[];
  /** 版面佈局描述 */
  layoutPattern?: string;
}

// ============================================================================
// 格式匹配結果
// ============================================================================

/**
 * 文件格式識別結果
 */
export interface DocumentFormatResult {
  /** 格式 ID */
  formatId: string;
  /** 文件類型 */
  documentType: DocumentType;
  /** 文件子類型 */
  documentSubtype: DocumentSubtype;
  /** 格式名稱 */
  formatName: string;
  /** 識別信心度 */
  confidence: number;
  /** 是否為新建格式 */
  isNewFormat: boolean;
  /** 所屬公司 ID */
  companyId: string;
}

/**
 * 批量處理中的格式識別結果
 */
export interface FormatIdentificationResult {
  /** 文件 ID */
  fileId: string;
  /** 格式 ID */
  formatId: string;
  /** 文件類型 */
  documentType: DocumentType;
  /** 文件子類型 */
  documentSubtype: DocumentSubtype;
  /** 識別信心度 */
  confidence: number;
  /** 是否為新建格式 */
  isNewFormat: boolean;
}

// ============================================================================
// 三層聚合結構
// ============================================================================

/**
 * 三層術語聚合結果（頂層）
 * 結構：公司 → 文件格式 → 術語
 */
export interface HierarchicalTermAggregation {
  /** 公司節點列表 */
  companies: CompanyTermNode[];
  /** 聚合摘要 */
  summary: AggregationSummary;
  /** AI 術語驗證統計（Story 0-10，可選） */
  aiValidation?: HierarchicalAIValidationStats;
}

/**
 * AI 術語驗證統計 (Story 0-10)
 */
export interface HierarchicalAIValidationStats {
  /** 驗證前術語數 */
  termsBeforeValidation: number;
  /** 驗證後術語數 */
  termsAfterValidation: number;
  /** 被過濾的術語數 */
  filteredTermsCount: number;
  /** 驗證成本（USD） */
  validationCost: number;
  /** 驗證耗時（毫秒） */
  validationTimeMs: number;
}

/**
 * 聚合摘要統計
 */
export interface AggregationSummary {
  /** 公司總數 */
  totalCompanies: number;
  /** 格式總數 */
  totalFormats: number;
  /** 唯一術語總數 */
  totalUniqueTerms: number;
  /** 術語出現總次數 */
  totalTermOccurrences: number;
}

/**
 * 公司術語節點（第一層）
 */
export interface CompanyTermNode {
  /** 公司 ID */
  companyId: string;
  /** 公司名稱 */
  companyName: string;
  /** 公司名稱變體 */
  companyNameVariants: string[];
  /** 文件數量 */
  fileCount: number;
  /** 格式節點列表 */
  formats: FormatTermNode[];
}

/**
 * 格式術語節點（第二層）
 */
export interface FormatTermNode {
  /** 格式 ID */
  formatId: string;
  /** 文件類型 */
  documentType: DocumentType;
  /** 文件子類型 */
  documentSubtype: DocumentSubtype;
  /** 格式名稱 */
  formatName: string;
  /** 文件數量 */
  fileCount: number;
  /** 術語節點列表 */
  terms: TermNode[];
  /** 術語數量 */
  termCount: number;
}

/**
 * 術語節點（第三層）
 */
export interface TermNode {
  /** 原始術語 */
  term: string;
  /** 正規化術語 */
  normalizedTerm: string;
  /** 出現頻率 */
  frequency: number;
  /** 建議分類 */
  suggestedCategory?: string;
  /** 分類信心度 */
  confidence?: number;
  /** 原始文字範例 */
  examples?: string[];
}

// ============================================================================
// 配置類型
// ============================================================================

/**
 * 格式識別配置
 */
export interface FormatIdentificationConfig {
  /** 是否啟用格式識別 */
  enabled: boolean;
  /** 信心度閾值 (0-100)，預設 70 */
  confidenceThreshold: number;
  /** 是否自動創建新格式，預設 true */
  autoCreateFormat: boolean;
  /** 是否學習格式特徵，預設 true */
  learnFeatures: boolean;
}

/**
 * 預設格式識別配置
 */
export const DEFAULT_FORMAT_IDENTIFICATION_CONFIG: FormatIdentificationConfig = {
  enabled: true,
  confidenceThreshold: 70,
  autoCreateFormat: true,
  learnFeatures: true,
};

// ============================================================================
// API 響應類型
// ============================================================================

/**
 * 格式列表 API 響應
 */
export interface FormatListResponse {
  formats: DocumentFormatSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * 文件格式摘要
 */
export interface DocumentFormatSummary {
  /** 格式 ID */
  id: string;
  /** 公司 ID */
  companyId: string;
  /** 公司名稱 */
  companyName: string;
  /** 文件類型 */
  documentType: DocumentType;
  /** 文件子類型 */
  documentSubtype: DocumentSubtype;
  /** 格式名稱 */
  name: string | null;
  /** 文件數量 */
  fileCount: number;
  /** 常見術語 */
  commonTerms: string[];
  /** 創建時間 */
  createdAt: string;
  /** 更新時間 */
  updatedAt: string;
}

/**
 * 格式列表項目（含配置狀態）
 * @description 用於 Story 16-1 格式列表 Tab 顯示
 * @since Epic 16 - Story 16.1
 */
export interface DocumentFormatListItem extends DocumentFormatSummary {
  /** 是否有專屬 Prompt 配置 */
  hasPromptConfig?: boolean;
  /** 是否有專屬映射配置 */
  hasMappingConfig?: boolean;
}

/**
 * 格式列表篩選狀態
 * @since Epic 16 - Story 16.1
 */
export interface FormatFiltersState {
  /** 文件類型篩選 */
  documentType: DocumentType | null;
  /** 文件子類型篩選 */
  documentSubtype: DocumentSubtype | null;
  /** 排序欄位 */
  sortBy: 'fileCount' | 'updatedAt';
  /** 排序方向 */
  sortOrder: 'asc' | 'desc';
}

/**
 * 文件類型選項（用於下拉選單）
 */
export const DOCUMENT_TYPE_OPTIONS: Array<{ value: DocumentType; label: string }> =
  ALL_DOCUMENT_TYPES.map((type) => ({
    value: type,
    label: DOCUMENT_TYPE_LABELS_ZH[type],
  }));

/**
 * 文件子類型選項（用於下拉選單）
 */
export const DOCUMENT_SUBTYPE_OPTIONS: Array<{ value: DocumentSubtype; label: string }> =
  ALL_DOCUMENT_SUBTYPES.map((subtype) => ({
    value: subtype,
    label: DOCUMENT_SUBTYPE_LABELS_ZH[subtype],
  }));

/**
 * 三層聚合 API 響應
 */
export interface HierarchicalAggregationResponse {
  success: boolean;
  data: HierarchicalTermAggregation;
}

/**
 * 公司格式樹 API 響應
 */
export interface CompanyFormatTreeResponse {
  success: boolean;
  data: CompanyTermNode[];
  summary: AggregationSummary;
}

// ============================================================================
// 服務輸入類型
// ============================================================================

/**
 * 格式識別服務輸入
 */
export interface FormatIdentificationInput {
  /** 文件 ID */
  fileId: string;
  /** 公司 ID（發行者） */
  companyId: string;
  /** 文件圖片 Base64 或 URL */
  imageData: string;
  /** 批次配置 */
  config?: Partial<FormatIdentificationConfig>;
}

/**
 * 格式創建或更新輸入
 */
export interface FormatUpsertInput {
  /** 公司 ID */
  companyId: string;
  /** 文件類型 */
  documentType: DocumentType;
  /** 文件子類型 */
  documentSubtype: DocumentSubtype;
  /** 格式名稱（可選） */
  name?: string;
  /** 格式特徵 */
  features?: DocumentFormatFeatures;
  /** 常見術語 */
  commonTerms?: string[];
}

// ============================================================================
// 類型守衛
// ============================================================================

/**
 * 檢查是否為有效的 DocumentType
 */
export function isValidDocumentType(value: string): value is DocumentType {
  return ALL_DOCUMENT_TYPES.includes(value as DocumentType);
}

/**
 * 檢查是否為有效的 DocumentSubtype
 */
export function isValidDocumentSubtype(value: string): value is DocumentSubtype {
  return ALL_DOCUMENT_SUBTYPES.includes(value as DocumentSubtype);
}

/**
 * 獲取格式的完整顯示名稱
 */
export function getFormatDisplayName(
  documentType: DocumentType,
  documentSubtype: DocumentSubtype,
  locale: 'en' | 'zh' = 'en'
): string {
  if (locale === 'zh') {
    return `${DOCUMENT_SUBTYPE_LABELS_ZH[documentSubtype]} ${DOCUMENT_TYPE_LABELS_ZH[documentType]}`;
  }
  return `${DOCUMENT_SUBTYPE_LABELS[documentSubtype]} ${DOCUMENT_TYPE_LABELS[documentType]}`;
}
