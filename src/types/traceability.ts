/**
 * @fileoverview 追溯功能類型定義
 * @description
 *   定義文件追溯相關的類型，包含：
 *   - 文件來源資訊
 *   - 修正追溯記錄
 *   - OCR 結果
 *   - 完整追溯鏈
 *   - 追溯報告
 *
 * @module src/types/traceability
 * @since Epic 8 - Story 8.4 (原始文件追溯)
 * @lastModified 2025-12-20
 */

/**
 * 文件來源資訊
 * 描述原始文件的儲存位置和存取資訊
 */
export interface DocumentSource {
  /** 文件 ID */
  documentId: string;
  /** 原始檔案名稱 */
  fileName: string;
  /** 檔案類型 (MIME type) */
  fileType: string;
  /** 檔案大小 (bytes) */
  fileSize: number;
  /** 儲存位置層級 */
  storageLocation: 'active' | 'archive' | 'cold';
  /** 預簽名 URL */
  url: string;
  /** URL 過期時間 */
  urlExpiresAt: string;
  /** 上傳時間 */
  uploadedAt: string;
  /** 上傳者 ID */
  uploadedBy?: string;
}

// 修正類型從 review.ts 導入，避免重複定義
import { CorrectionType } from './review';
export type { CorrectionType };

/**
 * 修正追溯記錄
 * 描述單次欄位修正的完整資訊
 */
export interface CorrectionTrace {
  /** 修正記錄 ID */
  correctionId: string;
  /** 文件 ID */
  documentId: string;
  /** 欄位名稱 */
  field: string;
  /** 修正前的值 */
  originalValue: string | null;
  /** 修正後的值 */
  correctedValue: string;
  /** 修正者 ID */
  correctedBy: string;
  /** 修正者名稱 */
  correctedByName: string;
  /** 修正時間 */
  correctedAt: string;
  /** 修正類型 */
  correctionType: CorrectionType;
  /** 修正原因 (特例時必填) */
  reason?: string;
}

/**
 * OCR 處理結果
 * 描述文件 OCR 處理的結果資訊
 */
export interface OcrResult {
  /** 文件 ID */
  documentId: string;
  /** 提取的文字內容 */
  extractedText: string;
  /** 原始 OCR 結果（JSON） */
  rawResult: Record<string, unknown>;
  /** 發票結構化數據 */
  invoiceData?: Record<string, unknown>;
  /** 整體信心度 (0-1) */
  confidence: number;
  /** 處理時間 */
  processedAt: string;
}

/**
 * 欄位提取結果
 */
export interface ExtractionResultData {
  /** 提取的欄位值 */
  fields: Record<string, unknown>;
  /** 整體信心度 */
  confidence: number;
  /** 提取時間 */
  extractedAt: string;
}

/**
 * 核准記錄
 */
export interface ApprovalRecord {
  /** 核准者 ID */
  approvedBy: string;
  /** 核准者名稱 */
  approvedByName: string;
  /** 核准時間 */
  approvedAt: string;
  /** 是否為自動核准 */
  autoApproved: boolean;
}

/**
 * 變更歷史記錄
 */
export interface ChangeHistoryRecord {
  /** 版本號 */
  version: number;
  /** 變更者名稱 */
  changedBy: string;
  /** 變更時間 */
  changedAt: string;
  /** 變更類型 */
  changeType: string;
}

/**
 * 文件追溯鏈
 * 包含完整的文件處理歷程
 */
export interface DocumentTraceChain {
  /** 文件基本資訊 */
  document: {
    id: string;
    status: string;
    createdAt: string;
  };
  /** 文件來源 */
  source: DocumentSource;
  /** OCR 結果 */
  ocrResult: OcrResult;
  /** 欄位提取結果 */
  extractionResult: ExtractionResultData;
  /** 修正記錄列表 */
  corrections: CorrectionTrace[];
  /** 核准記錄列表 */
  approvals: ApprovalRecord[];
  /** 變更歷史 */
  changeHistory: ChangeHistoryRecord[];
}

/**
 * 追溯報告
 * 完整的追溯報告，包含完整性驗證
 */
export interface TraceabilityReport {
  /** 報告 ID */
  reportId: string;
  /** 生成時間 */
  generatedAt: string;
  /** 生成者名稱 */
  generatedBy: string;
  /** 文件追溯鏈 */
  document: DocumentTraceChain;
  /** 完整性驗證結果 */
  integrityVerified: boolean;
  /** 報告雜湊值 (SHA256) */
  reportHash: string;
}

/**
 * 追溯報告生成請求
 */
export interface GenerateReportRequest {
  /** 文件 ID */
  documentId: string;
}

/**
 * 追溯報告生成回應
 */
export interface GenerateReportResponse {
  success: boolean;
  data?: TraceabilityReport;
  error?: string;
}

/**
 * 文件來源查詢回應
 */
export interface DocumentSourceResponse {
  success: boolean;
  data?: DocumentSource;
  error?: string;
}

/**
 * 追溯鏈查詢回應
 */
export interface TraceChainResponse {
  success: boolean;
  data?: DocumentTraceChain;
  error?: string;
}
