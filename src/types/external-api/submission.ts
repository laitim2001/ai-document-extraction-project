/**
 * @fileoverview 外部 API 發票提交請求類型定義
 * @description
 *   定義外部系統提交發票的請求類型，支援三種提交方式：
 *   - 文件直接上傳 (multipart/form-data)
 *   - Base64 編碼內容
 *   - URL 引用
 *
 * @module src/types/external-api/submission
 * @author Development Team
 * @since Epic 11 - Story 11.1 (API 發票提交端點)
 * @lastModified 2025-12-20
 *
 * @features
 *   - 三種提交方式類型定義
 *   - 請求參數類型定義
 *   - 優先級類型定義
 *
 * @related
 *   - src/types/external-api/response.ts - 回應類型
 *   - src/types/external-api/validation.ts - 驗證 Schema
 *   - src/services/invoice-submission.service.ts - 提交服務
 */

// ============================================================
// 常數定義
// ============================================================

/**
 * 支援的 MIME 類型
 */
export const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/tiff',
] as const;

/**
 * 支援的 MIME 類型聯合類型
 */
export type SupportedMimeType = (typeof SUPPORTED_MIME_TYPES)[number];

/**
 * 文件大小限制 (50MB)
 */
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

/**
 * URL 獲取超時時間 (30 秒)
 */
export const URL_FETCH_TIMEOUT = 30000;

// ============================================================
// 提交內容類型
// ============================================================

/**
 * 文件直接上傳內容
 * @description 用於 multipart/form-data 上傳方式
 */
export interface FileUploadContent {
  /** 文件緩衝區 */
  buffer: Buffer;
  /** 原始文件名稱 */
  originalName: string;
  /** MIME 類型 */
  mimeType: string;
  /** 文件大小（位元組） */
  size: number;
}

/**
 * Base64 編碼內容
 * @description 用於 JSON 請求體中嵌入文件內容
 */
export interface Base64Content {
  /** Base64 編碼的文件內容 */
  content: string;
  /** 文件名稱 */
  fileName: string;
  /** MIME 類型 */
  mimeType: string;
}

/**
 * URL 引用內容
 * @description 用於從外部 URL 獲取文件
 */
export interface UrlReferenceContent {
  /** 外部 URL */
  url: string;
  /** 可選的文件名稱覆蓋 */
  fileName?: string;
}

// ============================================================
// 優先級類型
// ============================================================

/**
 * 任務優先級
 */
export type TaskPriority = 'NORMAL' | 'HIGH';

/**
 * 任務優先級常數
 */
export const TASK_PRIORITIES = {
  NORMAL: 'NORMAL' as const,
  HIGH: 'HIGH' as const,
};

// ============================================================
// 提交請求類型
// ============================================================

/**
 * 發票提交請求 - 支援三種提交方式
 * @description
 *   外部系統提交發票的請求格式。
 *   file、base64Content、urlReference 三者必須且只能提供其中一種。
 */
export interface SubmitInvoiceRequest {
  // 文件內容（三選一，必填其中一種）
  /** 文件直接上傳內容 */
  file?: FileUploadContent;
  /** Base64 編碼內容 */
  base64Content?: Base64Content;
  /** URL 引用內容 */
  urlReference?: UrlReferenceContent;

  // 必填參數
  /** 城市代碼（必填） */
  cityCode: string;

  // 可選參數
  /** 任務優先級（預設：NORMAL） */
  priority?: TaskPriority;
  /** Webhook 回調 URL */
  callbackUrl?: string;
  /** 自訂元數據 */
  metadata?: Record<string, unknown>;
}

/**
 * 提交方式類型
 */
export type SubmissionType = 'FILE_UPLOAD' | 'BASE64' | 'URL_REFERENCE';

/**
 * 提交方式常數
 */
export const SUBMISSION_TYPES = {
  FILE_UPLOAD: 'FILE_UPLOAD' as const,
  BASE64: 'BASE64' as const,
  URL_REFERENCE: 'URL_REFERENCE' as const,
};

// ============================================================
// 內部處理類型
// ============================================================

/**
 * 處理後的文件數據
 * @description 從不同提交方式統一處理後的文件格式
 */
export interface ProcessedFileData {
  /** 文件緩衝區 */
  buffer: Buffer;
  /** 文件名稱 */
  fileName: string;
  /** MIME 類型 */
  mimeType: string;
  /** 提交方式 */
  submissionType: SubmissionType;
}

/**
 * 客戶端資訊
 * @description 用於審計和追蹤
 */
export interface ClientInfo {
  /** 客戶端 IP 地址 */
  ip: string;
  /** 用戶代理字串 */
  userAgent?: string;
}
