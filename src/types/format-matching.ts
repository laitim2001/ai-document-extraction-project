/**
 * @fileoverview 格式匹配類型定義
 * @description
 *   定義格式匹配相關的所有類型：
 *   - 匹配方法和狀態枚舉
 *   - 文件特徵介面
 *   - 匹配請求和結果介面
 *   - 適配器轉換輔助函數
 *
 * @module src/types/format-matching
 * @since Epic 15 - Story 15.3
 * @lastModified 2026-01-03
 *
 * @related
 *   - src/services/document-format.service.ts - 被適配的現有服務
 *   - src/services/unified-processor/adapters/format-matcher-adapter.ts - 使用此類型
 *   - src/services/unified-processor/steps/format-matching.step.ts - 使用此類型
 */

// ============================================================================
// 枚舉定義
// ============================================================================

/**
 * 格式匹配方法
 * @description 表示如何匹配到文件格式
 */
export enum FormatMatchMethod {
  /** 精確匹配（companyId + documentType + documentSubtype） */
  EXACT = 'EXACT',
  /** 相似度匹配 */
  SIMILARITY = 'SIMILARITY',
  /** AI 推斷匹配 */
  AI_INFERENCE = 'AI_INFERENCE',
  /** 自動創建新格式 */
  AUTO_CREATED = 'AUTO_CREATED',
  /** 未找到匹配 */
  NOT_FOUND = 'NOT_FOUND',
}

/**
 * 格式狀態
 * @description 文件格式的當前狀態
 */
export enum FormatStatus {
  /** 活躍使用中 */
  ACTIVE = 'ACTIVE',
  /** 已停用 */
  INACTIVE = 'INACTIVE',
  /** 待審核 */
  PENDING_REVIEW = 'PENDING_REVIEW',
  /** 已合併到其他格式 */
  MERGED = 'MERGED',
}

// ============================================================================
// 文件特徵介面
// ============================================================================

/**
 * 文件特徵
 * @description 用於格式匹配的文件特徵描述
 */
export interface DocumentCharacteristics {
  /** 頁數 */
  pageCount: number;
  /** 是否包含表格 */
  hasTables: boolean;
  /** 是否包含 Logo */
  hasLogo: boolean;
  /** 版面類型 */
  layoutType: 'PORTRAIT' | 'LANDSCAPE' | 'MIXED';
  /** 文件類型 */
  documentType: string;
  /** 文件子類型（可選） */
  documentSubtype?: string;
  /** 額外的格式特徵 */
  formatFeatures?: FormatFeature[];
}

/**
 * 格式特徵
 * @description 文件格式的特定特徵
 */
export interface FormatFeature {
  /** 特徵名稱 */
  name: string;
  /** 特徵值 */
  value: string | number | boolean;
  /** 信心度（0-100） */
  confidence?: number;
}

// ============================================================================
// 匹配請求介面
// ============================================================================

/**
 * 格式匹配請求
 * @description 向格式匹配適配器發送的請求
 */
export interface FormatMatchRequest {
  /** 公司 ID（必須，由 IssuerIdentification 步驟提供） */
  companyId: string;
  /** 文件特徵 */
  characteristics: DocumentCharacteristics;
  /** 匹配選項 */
  options?: FormatMatchOptions;
}

/**
 * 格式匹配選項
 */
export interface FormatMatchOptions {
  /** 是否允許自動創建新格式 */
  autoCreate: boolean;
  /** 最小匹配信心度（0-100） */
  minConfidence: number;
  /** 最大搜尋結果數量 */
  maxCandidates: number;
  /** 是否啟用相似度匹配 */
  enableSimilarityMatch: boolean;
  /** 相似度閾值（0-1） */
  similarityThreshold: number;
}

/**
 * 預設匹配選項
 */
export const DEFAULT_FORMAT_MATCH_OPTIONS: Required<FormatMatchOptions> = {
  autoCreate: true,
  minConfidence: 70,
  maxCandidates: 5,
  enableSimilarityMatch: true,
  similarityThreshold: 0.8,
};

// ============================================================================
// 匹配結果介面
// ============================================================================

/**
 * 格式匹配結果
 * @description 格式匹配適配器的輸出結果
 */
export interface FormatMatchResult {
  /** 是否成功匹配 */
  success: boolean;
  /** 匹配到的格式 ID */
  formatId: string | null;
  /** 格式名稱 */
  formatName: string | null;
  /** 匹配方法 */
  matchMethod: FormatMatchMethod;
  /** 匹配信心度（0-100） */
  confidence: number;
  /** 格式狀態 */
  formatStatus: FormatStatus | null;
  /** 是否為新創建的格式 */
  isNewFormat: boolean;
  /** 候選格式列表（相似度匹配時使用） */
  candidates?: FormatCandidate[];
  /** 處理時間（毫秒） */
  processingTimeMs: number;
  /** 錯誤訊息（如果失敗） */
  error?: string;
  /** 元數據 */
  metadata?: FormatMatchMetadata;
}

/**
 * 格式候選
 * @description 相似度匹配時的候選格式
 */
export interface FormatCandidate {
  /** 格式 ID */
  formatId: string;
  /** 格式名稱 */
  formatName: string;
  /** 相似度分數（0-100） */
  similarityScore: number;
  /** 匹配的特徵 */
  matchedFeatures: string[];
}

/**
 * 匹配元數據
 */
export interface FormatMatchMetadata {
  /** 搜索的候選數量 */
  candidatesSearched: number;
  /** 使用的匹配策略 */
  strategyUsed: FormatMatchMethod;
  /** 是否使用了快取 */
  cached: boolean;
  /** 快取鍵（如果使用了快取） */
  cacheKey?: string;
}

// ============================================================================
// 適配器請求/響應轉換
// ============================================================================

/**
 * Legacy 格式處理結果
 * @description document-format.service.ts 的返回類型（用於類型轉換）
 */
export interface LegacyFormatResult {
  /** 格式 ID */
  id: string;
  /** 格式名稱 */
  name: string;
  /** 公司 ID */
  companyId: string;
  /** 文件類型 */
  documentType: string;
  /** 文件子類型 */
  documentSubtype: string | null;
  /** 是否為新創建 */
  isNew: boolean;
  /** 處理次數 */
  processedCount: number;
  /** 格式狀態 */
  status: string;
  /** 格式特徵 */
  features?: Record<string, unknown>;
}

/**
 * 轉換 Legacy 結果為統一格式
 * @param legacyResult - Legacy 服務返回的結果
 * @param processingTimeMs - 處理時間
 * @returns 統一的格式匹配結果
 */
export function convertLegacyFormatResult(
  legacyResult: LegacyFormatResult | null,
  processingTimeMs: number
): FormatMatchResult {
  if (!legacyResult) {
    return {
      success: false,
      formatId: null,
      formatName: null,
      matchMethod: FormatMatchMethod.NOT_FOUND,
      confidence: 0,
      formatStatus: null,
      isNewFormat: false,
      processingTimeMs,
      error: 'No format found or created',
    };
  }

  return {
    success: true,
    formatId: legacyResult.id,
    formatName: legacyResult.name,
    matchMethod: legacyResult.isNew
      ? FormatMatchMethod.AUTO_CREATED
      : FormatMatchMethod.EXACT,
    confidence: legacyResult.isNew ? 100 : 95,
    formatStatus: convertLegacyStatus(legacyResult.status),
    isNewFormat: legacyResult.isNew,
    processingTimeMs,
    metadata: {
      candidatesSearched: 1,
      strategyUsed: legacyResult.isNew
        ? FormatMatchMethod.AUTO_CREATED
        : FormatMatchMethod.EXACT,
      cached: false,
    },
  };
}

/**
 * 轉換 Legacy 狀態
 */
function convertLegacyStatus(status: string): FormatStatus {
  const statusMap: Record<string, FormatStatus> = {
    ACTIVE: FormatStatus.ACTIVE,
    INACTIVE: FormatStatus.INACTIVE,
    PENDING: FormatStatus.PENDING_REVIEW,
    MERGED: FormatStatus.MERGED,
  };
  return statusMap[status.toUpperCase()] ?? FormatStatus.ACTIVE;
}

// ============================================================================
// 提取結果轉換輔助
// ============================================================================

/**
 * 從提取結果建構文件特徵
 * @param extractedData - 統一處理上下文中的提取數據
 * @returns 文件特徵
 */
export function buildDocumentCharacteristics(
  extractedData: {
    invoiceData?: Record<string, unknown>;
    metadata?: {
      pageCount?: number;
      hasTables?: boolean;
      logoDetected?: boolean;
      orientation?: string;
    };
    documentType?: string;
    documentSubtype?: string;
  } | null
): DocumentCharacteristics {
  const metadata = extractedData?.metadata ?? {};

  return {
    pageCount: metadata.pageCount ?? 1,
    hasTables: metadata.hasTables ?? false,
    hasLogo: metadata.logoDetected ?? false,
    layoutType: convertOrientation(metadata.orientation),
    documentType: extractedData?.documentType ?? 'UNKNOWN',
    documentSubtype: extractedData?.documentSubtype,
  };
}

/**
 * 轉換方向到版面類型
 */
function convertOrientation(
  orientation?: string
): 'PORTRAIT' | 'LANDSCAPE' | 'MIXED' {
  if (!orientation) return 'PORTRAIT';
  const upper = orientation.toUpperCase();
  if (upper.includes('LANDSCAPE')) return 'LANDSCAPE';
  if (upper.includes('MIXED')) return 'MIXED';
  return 'PORTRAIT';
}
