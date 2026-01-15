/**
 * @fileoverview 發行者識別類型定義
 * @description
 *   定義發行者識別適配器所需的類型：
 *   - 識別方法枚舉
 *   - 公司狀態枚舉
 *   - 識別請求和結果介面
 *   - 與現有 document-issuer 類型的橋接
 *
 * @module src/types/issuer-identification
 * @since Epic 15 - Story 15.2
 * @lastModified 2026-01-03
 *
 * @related
 *   - src/types/document-issuer.ts - 現有發行者類型
 *   - src/services/document-issuer.service.ts - 現有發行者服務
 *   - src/services/unified-processor/adapters/issuer-identifier-adapter.ts - 適配器
 */

import type {
  IssuerIdentificationMethod as LegacyMethod,
  DocumentIssuerResult as LegacyResult,
} from './document-issuer';

// ============================================================================
// 枚舉類型
// ============================================================================

/**
 * 發行者識別方法
 * @description 統一處理流程中支援的識別方法
 */
export enum IdentificationMethod {
  /** 從文件 Logo 識別 */
  LOGO = 'LOGO',
  /** 從文件標題/信頭識別 */
  HEADER = 'HEADER',
  /** 文字內容匹配 */
  TEXT_MATCH = 'TEXT_MATCH',
  /** AI 推斷識別 */
  AI_INFERENCE = 'AI_INFERENCE',
}

/**
 * 公司狀態
 * @description 公司在系統中的驗證狀態
 */
export enum CompanyStatus {
  /** 已驗證的公司 */
  VERIFIED = 'VERIFIED',
  /** 待驗證 */
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  /** 系統自動創建 */
  AUTO_CREATED = 'AUTO_CREATED',
  /** 已停用 */
  INACTIVE = 'INACTIVE',
}

/**
 * 匹配類型
 * @description 公司名稱匹配的方式
 */
export enum MatchType {
  /** 完全匹配 */
  EXACT = 'EXACT',
  /** 變體匹配（如縮寫） */
  VARIANT = 'VARIANT',
  /** 模糊匹配 */
  FUZZY = 'FUZZY',
  /** 新公司 */
  NEW = 'NEW',
}

// ============================================================================
// 請求類型
// ============================================================================

/**
 * 發行者識別請求
 * @description 從提取結果中識別發行者的請求
 */
export interface IssuerIdentificationRequest {
  /** 文件 ID */
  fileId: string;
  /** 批次 ID（可選） */
  batchId?: string;
  /** AI 提取結果 */
  extractionResult: ExtractionResultForIssuer;
  /** 識別選項 */
  options?: IssuerIdentificationOptions;
}

/**
 * 用於發行者識別的提取結果
 * @description 從 AI 提取結果中提取發行者識別所需的欄位
 */
export interface ExtractionResultForIssuer {
  /** 發票資料 */
  invoiceData?: {
    /** 供應商名稱 */
    vendorName?: string;
    /** 供應商地址 */
    vendorAddress?: string;
    /** 供應商稅號 */
    vendorTaxId?: string;
    /** 其他欄位 */
    [key: string]: unknown;
  };
  /** 發行者識別資訊（GPT Vision 識別結果） */
  issuerIdentification?: {
    /** 識別的名稱 */
    name?: string;
    /** 識別方法 */
    method?: string;
    /** 信心度 */
    confidence?: number;
    /** 原始文字 */
    rawText?: string;
  };
  /** 文件元資料 */
  metadata?: {
    /** 文件類型 */
    documentType?: string;
    /** Logo 偵測結果 */
    logoDetected?: boolean;
    /** 其他元資料 */
    [key: string]: unknown;
  };
}

/**
 * 發行者識別選項
 * @description 控制識別行為的選項
 */
export interface IssuerIdentificationOptions {
  /** 找不到時是否自動創建公司 */
  autoCreateCompany?: boolean;
  /** 資料來源標識 */
  source?: string;
  /** 模糊匹配閾值（0-1） */
  fuzzyThreshold?: number;
  /** 最低信心度閾值（0-1） */
  minConfidenceThreshold?: number;
  /** 創建者 ID（用於自動創建公司） */
  createdById?: string;
  /** 是否跳過公司匹配（僅識別） */
  skipCompanyMatching?: boolean;
}

// ============================================================================
// 結果類型
// ============================================================================

/**
 * 發行者識別結果
 * @description 識別流程的完整結果
 */
export interface IssuerIdentificationResult {
  /** 識別是否成功 */
  success: boolean;
  /** 識別的發行者名稱 */
  issuerName: string | null;
  /** 使用的識別方法 */
  identificationMethod: IdentificationMethod | null;
  /** 識別信心度（0-1） */
  confidence: number;
  /** 匹配到的公司 ID */
  matchedCompanyId: string | null;
  /** 公司狀態 */
  companyStatus: CompanyStatus | null;
  /** 是否為新創建的公司 */
  isNewCompany: boolean;
  /** 匹配類型 */
  matchType: MatchType | null;
  /** 匹配分數 */
  matchScore: number | null;
  /** 原始識別文字 */
  rawText?: string;
  /** 錯誤訊息（如果失敗） */
  error?: string;
  /** 處理時間（毫秒） */
  processingTimeMs?: number;
}

/**
 * 公司匹配結果
 * @description 公司匹配的詳細結果
 */
export interface CompanyMatchResult {
  /** 是否找到匹配 */
  matched: boolean;
  /** 匹配的公司 ID */
  companyId: string | null;
  /** 公司名稱 */
  companyName: string | null;
  /** 公司狀態 */
  status: CompanyStatus | null;
  /** 匹配類型 */
  matchType: MatchType | null;
  /** 匹配分數（0-1） */
  matchScore: number | null;
  /** 是否為新創建 */
  isNewlyCreated: boolean;
}

// ============================================================================
// 類型轉換輔助
// ============================================================================

/**
 * 將 Legacy 識別方法轉換為統一方法
 * @param legacyMethod - 現有服務的識別方法
 * @returns 統一處理流程的識別方法
 */
export function convertLegacyMethod(
  legacyMethod: LegacyMethod | string | undefined
): IdentificationMethod | null {
  if (!legacyMethod) return null;

  const methodMap: Record<string, IdentificationMethod> = {
    LOGO: IdentificationMethod.LOGO,
    HEADER: IdentificationMethod.HEADER,
    LETTERHEAD: IdentificationMethod.HEADER, // 映射到 HEADER
    FOOTER: IdentificationMethod.TEXT_MATCH, // 映射到 TEXT_MATCH
    AI_INFERENCE: IdentificationMethod.AI_INFERENCE,
    TEXT_MATCH: IdentificationMethod.TEXT_MATCH,
  };

  return methodMap[legacyMethod] ?? null;
}

/**
 * 將 Legacy 匹配類型轉換為統一類型
 * @param legacyMatchType - 現有服務的匹配類型
 * @returns 統一處理流程的匹配類型
 */
export function convertLegacyMatchType(
  legacyMatchType: string | undefined
): MatchType | null {
  if (!legacyMatchType) return null;

  const typeMap: Record<string, MatchType> = {
    EXACT: MatchType.EXACT,
    VARIANT: MatchType.VARIANT,
    FUZZY: MatchType.FUZZY,
    NEW: MatchType.NEW,
  };

  return typeMap[legacyMatchType] ?? null;
}

/**
 * 將 Legacy 結果轉換為統一結果
 * @param legacyResult - 現有服務的識別結果
 * @param processingTimeMs - 處理時間
 * @returns 統一處理流程的識別結果
 */
export function convertLegacyResult(
  legacyResult: LegacyResult | null,
  processingTimeMs?: number
): IssuerIdentificationResult {
  if (!legacyResult) {
    return {
      success: false,
      issuerName: null,
      identificationMethod: null,
      confidence: 0,
      matchedCompanyId: null,
      companyStatus: null,
      isNewCompany: false,
      matchType: null,
      matchScore: null,
      processingTimeMs,
    };
  }

  // 判斷公司狀態
  let companyStatus: CompanyStatus | null = null;
  if (legacyResult.companyId) {
    companyStatus = legacyResult.isNewCompany
      ? CompanyStatus.AUTO_CREATED
      : CompanyStatus.VERIFIED;
  }

  return {
    success: true,
    issuerName: legacyResult.name,
    identificationMethod: convertLegacyMethod(legacyResult.identificationMethod),
    confidence: legacyResult.confidence,
    matchedCompanyId: legacyResult.companyId ?? null,
    companyStatus,
    isNewCompany: legacyResult.isNewCompany ?? false,
    matchType: convertLegacyMatchType(legacyResult.matchType),
    matchScore: legacyResult.matchScore ?? null,
    rawText: legacyResult.rawText,
    processingTimeMs,
  };
}

// ============================================================================
// 類型守衛
// ============================================================================

/**
 * 檢查是否為有效的識別方法
 */
export function isValidIdentificationMethod(
  value: unknown
): value is IdentificationMethod {
  return (
    typeof value === 'string' &&
    Object.values(IdentificationMethod).includes(value as IdentificationMethod)
  );
}

/**
 * 檢查是否為有效的公司狀態
 */
export function isValidCompanyStatus(value: unknown): value is CompanyStatus {
  return (
    typeof value === 'string' &&
    Object.values(CompanyStatus).includes(value as CompanyStatus)
  );
}

/**
 * 檢查識別結果是否成功且有公司匹配
 */
export function hasCompanyMatch(
  result: IssuerIdentificationResult
): result is IssuerIdentificationResult & {
  matchedCompanyId: string;
  companyStatus: CompanyStatus;
} {
  return result.success && result.matchedCompanyId !== null;
}

// ============================================================================
// 預設值
// ============================================================================

/**
 * 預設識別選項
 */
export const DEFAULT_IDENTIFICATION_OPTIONS: Required<IssuerIdentificationOptions> = {
  autoCreateCompany: false,
  source: 'unified-processor',
  fuzzyThreshold: 0.8,
  minConfidenceThreshold: 0.5,
  createdById: 'dev-user-1', // FIX-028: 使用有效的系統用戶 ID
  skipCompanyMatching: false,
};
