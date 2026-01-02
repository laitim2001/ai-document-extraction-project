/**
 * @fileoverview 提取欄位類型定義
 * @description
 *   定義文件欄位提取結果的資料結構，包含：
 *   - 欄位來源類型 (Azure DI, GPT Vision, 手動, 映射)
 *   - 信心度等級 (高/中/低)
 *   - 欄位類別 (發票/供應商/客戶/明細/金額)
 *
 * @module src/types
 * @since Epic 13 - Story 13.2 (欄位提取結果面板)
 * @lastModified 2026-01-02
 */

// ============================================================
// Field Source Types
// ============================================================

/**
 * 欄位提取來源
 */
export type FieldSource = 'AZURE_DI' | 'GPT_VISION' | 'MANUAL' | 'MAPPING';

/**
 * 來源顯示標籤
 */
export const FIELD_SOURCE_LABELS: Record<FieldSource, string> = {
  AZURE_DI: 'Azure DI',
  GPT_VISION: 'GPT Vision',
  MANUAL: '手動輸入',
  MAPPING: '映射規則',
};

// ============================================================
// Confidence Level Types
// ============================================================

/**
 * 信心度等級
 */
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * 信心度閾值配置
 */
export const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.9, // ≥ 90%
  MEDIUM: 0.7, // ≥ 70%
} as const;

/**
 * 根據信心度數值取得等級
 * @param confidence - 信心度 (0-1)
 * @returns 信心度等級
 */
export function getConfidenceLevelFromScore(confidence: number): ConfidenceLevel {
  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) return 'HIGH';
  if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) return 'MEDIUM';
  return 'LOW';
}

// ============================================================
// Field Category Types
// ============================================================

/**
 * 欄位類別定義
 */
export interface FieldCategory {
  id: string;
  name: string;
  displayName: string;
  order: number;
}

/**
 * 預設欄位類別
 */
export const DEFAULT_CATEGORIES: FieldCategory[] = [
  { id: 'invoice', name: 'invoice', displayName: '發票資訊', order: 1 },
  { id: 'vendor', name: 'vendor', displayName: '供應商資訊', order: 2 },
  { id: 'customer', name: 'customer', displayName: '客戶資訊', order: 3 },
  { id: 'lineItems', name: 'lineItems', displayName: '明細項目', order: 4 },
  { id: 'amounts', name: 'amounts', displayName: '金額資訊', order: 5 },
  { id: 'other', name: 'other', displayName: '其他', order: 99 },
];

// ============================================================
// Extracted Field Types
// ============================================================

/**
 * 欄位邊界框（用於 PDF 高亮聯動）
 */
export interface FieldBoundingBox {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 提取欄位資料結構
 */
export interface ExtractedField {
  /** 欄位唯一識別碼 */
  id: string;
  /** 欄位名稱（英文鍵值） */
  fieldName: string;
  /** 顯示名稱（中文） */
  displayName: string;
  /** 提取值 */
  value: string | number | null;
  /** 原始提取值（未處理） */
  rawValue: string | null;
  /** 信心度 (0-1) */
  confidence: number;
  /** 信心度等級 */
  confidenceLevel: ConfidenceLevel;
  /** 提取來源 */
  source: FieldSource;
  /** 邊界框（用於 PDF 高亮） */
  boundingBox?: FieldBoundingBox;
  /** 是否已手動編輯 */
  isEdited: boolean;
  /** 編輯前的原始值 */
  originalValue?: string | number | null;
  /** 欄位類別 */
  category?: string;
  /** 驗證錯誤列表 */
  validationErrors?: string[];
}

// ============================================================
// Filter State Types
// ============================================================

/**
 * 過濾狀態
 */
export interface FieldFilterState {
  /** 搜尋關鍵字 */
  search: string;
  /** 信心度過濾 */
  confidenceLevel: 'ALL' | ConfidenceLevel;
  /** 來源過濾 */
  source: 'ALL' | FieldSource;
  /** 僅顯示已編輯 */
  showEditedOnly: boolean;
  /** 排序欄位 */
  sortBy: 'name' | 'confidence' | 'category';
  /** 排序方向 */
  sortOrder: 'asc' | 'desc';
}

/**
 * 預設過濾狀態
 */
export const DEFAULT_FILTER_STATE: FieldFilterState = {
  search: '',
  confidenceLevel: 'ALL',
  source: 'ALL',
  showEditedOnly: false,
  sortBy: 'category',
  sortOrder: 'asc',
};

// ============================================================
// API Response Types
// ============================================================

/**
 * 提取結果元資料
 */
export interface ExtractionMetadata {
  processedAt: string;
  source: 'AZURE_DI' | 'GPT_VISION' | 'HYBRID';
  totalFields: number;
  avgConfidence: number;
}

/**
 * 提取結果 API 響應
 */
export interface ExtractionResult {
  fileId: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  fields: ExtractedField[];
  metadata: ExtractionMetadata;
}
