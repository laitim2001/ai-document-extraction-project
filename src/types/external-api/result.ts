/**
 * @fileoverview 外部 API 結果擷取類型定義
 * @description
 *   定義外部 API 處理結果擷取的類型，包括：
 *   - 輸出格式定義
 *   - 提取欄位結構
 *   - 結果回應格式
 *   - 文件下載資訊
 *   - 錯誤類型定義
 *
 * @module src/types/external-api/result
 * @author Development Team
 * @since Epic 11 - Story 11.3 (API 處理結果擷取端點)
 * @lastModified 2025-12-21
 *
 * @features
 *   - 多格式輸出支援（JSON、CSV、XML）
 *   - 提取結果結構化類型
 *   - 批量結果查詢類型
 *   - 文件下載回應類型
 *
 * @related
 *   - src/types/external-api/status.ts - 狀態類型
 *   - src/services/result-retrieval.service.ts - 結果擷取服務
 *   - src/app/api/v1/invoices/[taskId]/result/route.ts - API 路由
 */

// ============================================================
// 輸出格式定義
// ============================================================

/**
 * 支援的輸出格式
 */
export type OutputFormat = 'json' | 'csv' | 'xml';

/**
 * 輸出格式常數
 */
export const OUTPUT_FORMATS: Record<string, OutputFormat> = {
  JSON: 'json',
  CSV: 'csv',
  XML: 'xml',
} as const;

/**
 * 預設輸出格式
 */
export const DEFAULT_OUTPUT_FORMAT: OutputFormat = 'json';

// ============================================================
// 提取欄位類型
// ============================================================

/**
 * 提取欄位結構
 * @description 單一欄位的提取結果
 */
export interface ExtractionField {
  /** 欄位名稱（標準化） */
  fieldName: string;
  /** 原始欄位名稱（文件中的原始術語） */
  originalLabel: string;
  /** 提取的值 */
  value: string | number | null;
  /** 信心度分數（0-1） */
  confidence: number;
  /** 資料類型 */
  dataType: 'string' | 'number' | 'date' | 'currency' | 'percentage';
  /** 驗證狀態 */
  validationStatus: 'valid' | 'warning' | 'error';
  /** 驗證訊息（如有問題） */
  validationMessage?: string;
  /** 在文件中的位置（可選） */
  boundingBox?: {
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// ============================================================
// Forwarder 資訊
// ============================================================

/**
 * Forwarder 資訊
 * @description 處理此發票的 Forwarder 基本資訊
 */
export interface ForwarderInfo {
  /** Forwarder ID */
  id: string;
  /** Forwarder 名稱 */
  name: string;
  /** Forwarder 代碼 */
  code: string;
}

// ============================================================
// 結果元數據
// ============================================================

/**
 * 結果元數據
 * @description 處理結果的元數據資訊
 */
export interface ResultMetadata {
  /** 總頁數 */
  pageCount: number;
  /** 處理時間（毫秒） */
  processingTimeMs: number;
  /** 識別的 Forwarder */
  forwarder: ForwarderInfo | null;
  /** 文件語言 */
  documentLanguage: string;
  /** OCR 引擎版本 */
  ocrEngineVersion: string;
  /** AI 模型版本 */
  aiModelVersion: string;
}

// ============================================================
// 主要結果回應
// ============================================================

/**
 * 任務結果回應（JSON 格式）
 * @description 完整的處理結果回應結構
 */
export interface TaskResultResponse {
  /** 任務 ID */
  taskId: string;
  /** 處理狀態（應為 completed） */
  status: 'completed';
  /** 整體信心度分數（0-1） */
  confidenceScore: number;
  /** 提取的欄位列表 */
  fields: ExtractionField[];
  /** 處理元數據 */
  metadata: ResultMetadata;
  /** 完成時間（ISO 8601） */
  completedAt: string;
  /** 結果過期時間（ISO 8601） */
  expiresAt: string;
}

// ============================================================
// 欄位值查詢回應
// ============================================================

/**
 * 單一欄位值查詢回應
 * @description 查詢單一欄位值的回應結構
 */
export interface FieldValueResponse {
  /** 任務 ID */
  taskId: string;
  /** 欄位名稱 */
  fieldName: string;
  /** 欄位值 */
  value: string | number | null;
  /** 信心度分數 */
  confidence: number;
  /** 資料類型 */
  dataType: ExtractionField['dataType'];
  /** 驗證狀態 */
  validationStatus: ExtractionField['validationStatus'];
}

// ============================================================
// 文件下載回應
// ============================================================

/**
 * 文件下載資訊回應
 * @description 原始文件下載資訊
 */
export interface DocumentDownloadResponse {
  /** 任務 ID */
  taskId: string;
  /** 下載 URL（含 SAS Token，有效期 1 小時） */
  downloadUrl: string;
  /** 原始檔案名稱 */
  fileName: string;
  /** 檔案大小（bytes） */
  fileSize: number;
  /** MIME 類型 */
  mimeType: string;
  /** URL 過期時間（ISO 8601） */
  urlExpiresAt: string;
}

// ============================================================
// 批量結果查詢
// ============================================================

/**
 * 批量結果查詢請求
 */
export interface BatchResultsRequest {
  /** 任務 ID 列表（最多 50 個） */
  taskIds: string[];
  /** 輸出格式（預設 json） */
  format?: OutputFormat;
}

/**
 * 批量結果項目
 */
export interface BatchResultItem {
  /** 任務 ID */
  taskId: string;
  /** 是否成功 */
  success: boolean;
  /** 結果（如成功） */
  result?: TaskResultResponse;
  /** 錯誤（如失敗） */
  error?: {
    code: ResultErrorCode;
    message: string;
  };
}

/**
 * 批量結果回應
 */
export interface BatchResultsResponse {
  /** 結果列表 */
  results: BatchResultItem[];
  /** 未找到的任務 ID */
  notFound: string[];
}

// ============================================================
// 結果錯誤類型
// ============================================================

/**
 * 結果相關錯誤代碼
 */
export type ResultErrorCode =
  | 'TASK_NOT_FOUND'
  | 'TASK_NOT_COMPLETED'
  | 'RESULT_EXPIRED'
  | 'FIELD_NOT_FOUND'
  | 'DOCUMENT_NOT_FOUND'
  | 'INVALID_FORMAT'
  | 'BATCH_SIZE_EXCEEDED';

/**
 * 結果錯誤代碼常數
 */
export const RESULT_ERROR_CODES = {
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',
  TASK_NOT_COMPLETED: 'TASK_NOT_COMPLETED',
  RESULT_EXPIRED: 'RESULT_EXPIRED',
  FIELD_NOT_FOUND: 'FIELD_NOT_FOUND',
  DOCUMENT_NOT_FOUND: 'DOCUMENT_NOT_FOUND',
  INVALID_FORMAT: 'INVALID_FORMAT',
  BATCH_SIZE_EXCEEDED: 'BATCH_SIZE_EXCEEDED',
} as const;

/**
 * 錯誤代碼對應的 HTTP 狀態碼
 */
export const RESULT_ERROR_HTTP_STATUS: Record<ResultErrorCode, number> = {
  TASK_NOT_FOUND: 404,
  TASK_NOT_COMPLETED: 409,
  RESULT_EXPIRED: 410,
  FIELD_NOT_FOUND: 404,
  DOCUMENT_NOT_FOUND: 404,
  INVALID_FORMAT: 400,
  BATCH_SIZE_EXCEEDED: 400,
};

/**
 * 錯誤代碼對應的預設訊息
 */
export const RESULT_ERROR_MESSAGES: Record<ResultErrorCode, string> = {
  TASK_NOT_FOUND: 'Task not found',
  TASK_NOT_COMPLETED: 'Task processing is not completed yet',
  RESULT_EXPIRED: 'Result has expired and is no longer available',
  FIELD_NOT_FOUND: 'Field not found in extraction results',
  DOCUMENT_NOT_FOUND: 'Original document not found',
  INVALID_FORMAT: 'Invalid output format specified',
  BATCH_SIZE_EXCEEDED: 'Batch size exceeds maximum limit of 50 tasks',
};

// ============================================================
// 常數定義
// ============================================================

/**
 * 批量查詢最大任務數
 */
export const MAX_BATCH_RESULTS_SIZE = 50;

/**
 * 下載 URL 有效期（小時）
 */
export const DOWNLOAD_URL_EXPIRY_HOURS = 1;

/**
 * 結果保留期（天）
 */
export const RESULT_RETENTION_DAYS = 30;

// ============================================================
// 輔助類型
// ============================================================

/**
 * 結果查詢選項
 */
export interface ResultQueryOptions {
  /** 輸出格式 */
  format?: OutputFormat;
  /** 是否包含邊界框資訊 */
  includeBoundingBox?: boolean;
}

/**
 * CSV 輸出行
 */
export interface CsvRow {
  fieldName: string;
  originalLabel: string;
  value: string;
  confidence: string;
  dataType: string;
  validationStatus: string;
}

/**
 * 結果格式化器介面
 */
export interface ResultFormatter {
  /** 格式化結果為字串 */
  format(result: TaskResultResponse): string;
  /** 內容類型 */
  contentType: string;
}

// ============================================================
// 類型守衛
// ============================================================

/**
 * 檢查是否為有效的輸出格式
 */
export function isValidOutputFormat(format: unknown): format is OutputFormat {
  return typeof format === 'string' && ['json', 'csv', 'xml'].includes(format);
}

/**
 * 檢查是否為有效的結果錯誤代碼
 */
export function isResultErrorCode(code: unknown): code is ResultErrorCode {
  return (
    typeof code === 'string' &&
    Object.values(RESULT_ERROR_CODES).includes(code as ResultErrorCode)
  );
}
