/**
 * @fileoverview 外部 API Webhook 通知類型定義
 * @description
 *   定義外部 API Webhook 通知服務的類型，包括：
 *   - Webhook 事件類型
 *   - Webhook 發送狀態
 *   - Webhook Payload 結構
 *   - 發送歷史和統計類型
 *   - 重試相關類型
 *
 * @module src/types/external-api/webhook
 * @author Development Team
 * @since Epic 11 - Story 11.4 (Webhook 通知服務)
 * @lastModified 2025-12-21
 *
 * @features
 *   - HMAC-SHA256 簽名驗證
 *   - 指數退避重試機制
 *   - 發送歷史查詢
 *   - 統計數據彙總
 *
 * @related
 *   - src/services/webhook.service.ts - Webhook 服務
 *   - src/app/api/v1/webhooks/route.ts - API 路由
 *   - prisma/schema.prisma - ExternalWebhookDelivery 模型
 */

// ============================================================
// 事件類型定義
// ============================================================

/**
 * Webhook 事件類型
 * @description 對應 Prisma WebhookEventType enum
 */
export type WebhookEventType =
  | 'INVOICE_PROCESSING'
  | 'INVOICE_COMPLETED'
  | 'INVOICE_FAILED'
  | 'INVOICE_REVIEW_REQUIRED';

/**
 * Webhook 事件類型常數
 */
export const WEBHOOK_EVENT_TYPES = {
  INVOICE_PROCESSING: 'INVOICE_PROCESSING',
  INVOICE_COMPLETED: 'INVOICE_COMPLETED',
  INVOICE_FAILED: 'INVOICE_FAILED',
  INVOICE_REVIEW_REQUIRED: 'INVOICE_REVIEW_REQUIRED',
} as const;

/**
 * 事件類型對應的描述
 */
export const WEBHOOK_EVENT_DESCRIPTIONS: Record<WebhookEventType, string> = {
  INVOICE_PROCESSING: 'Invoice processing started',
  INVOICE_COMPLETED: 'Invoice processing completed successfully',
  INVOICE_FAILED: 'Invoice processing failed',
  INVOICE_REVIEW_REQUIRED: 'Invoice requires manual review',
};

// ============================================================
// 發送狀態定義
// ============================================================

/**
 * Webhook 發送狀態
 * @description 對應 Prisma ExternalWebhookDeliveryStatus enum
 */
export type WebhookDeliveryStatus =
  | 'PENDING'
  | 'SENDING'
  | 'DELIVERED'
  | 'FAILED'
  | 'RETRYING';

/**
 * 發送狀態常數
 */
export const WEBHOOK_DELIVERY_STATUS = {
  PENDING: 'PENDING',
  SENDING: 'SENDING',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
  RETRYING: 'RETRYING',
} as const;

// ============================================================
// Webhook Payload 結構
// ============================================================

/**
 * Webhook 基礎 Payload
 * @description 所有 Webhook 通知的基礎結構
 */
export interface WebhookPayloadBase {
  /** 事件類型 */
  event: WebhookEventType;
  /** 任務 ID */
  taskId: string;
  /** 事件發生時間 (ISO 8601) */
  timestamp: string;
}

/**
 * 處理開始事件 Payload
 */
export interface InvoiceProcessingPayload extends WebhookPayloadBase {
  event: 'INVOICE_PROCESSING';
  data: {
    /** 原始檔案名稱 */
    fileName: string;
    /** 檔案類型 */
    mimeType: string;
    /** 檔案大小 (bytes) */
    fileSize: number;
    /** 提交時間 */
    submittedAt: string;
  };
}

/**
 * 處理完成事件 Payload
 */
export interface InvoiceCompletedPayload extends WebhookPayloadBase {
  event: 'INVOICE_COMPLETED';
  data: {
    /** 整體信心度分數 (0-1) */
    confidenceScore: number;
    /** 提取欄位數量 */
    fieldCount: number;
    /** 處理時間 (毫秒) */
    processingTimeMs: number;
    /** 完成時間 */
    completedAt: string;
    /** 結果擷取 API URL */
    resultUrl: string;
  };
}

/**
 * 處理失敗事件 Payload
 */
export interface InvoiceFailedPayload extends WebhookPayloadBase {
  event: 'INVOICE_FAILED';
  data: {
    /** 錯誤代碼 */
    errorCode: string;
    /** 錯誤訊息 */
    errorMessage: string;
    /** 失敗階段 */
    failedStep: string;
    /** 失敗時間 */
    failedAt: string;
    /** 是否可重試 */
    retryable: boolean;
  };
}

/**
 * 需要審核事件 Payload
 */
export interface InvoiceReviewRequiredPayload extends WebhookPayloadBase {
  event: 'INVOICE_REVIEW_REQUIRED';
  data: {
    /** 整體信心度分數 (0-1) */
    confidenceScore: number;
    /** 需要審核的原因 */
    reviewReason: string;
    /** 低信心度欄位數量 */
    lowConfidenceFields: number;
    /** 審核 URL */
    reviewUrl: string;
  };
}

/**
 * Webhook Payload 聯合類型
 */
export type WebhookPayload =
  | InvoiceProcessingPayload
  | InvoiceCompletedPayload
  | InvoiceFailedPayload
  | InvoiceReviewRequiredPayload;

// ============================================================
// 發送記錄類型
// ============================================================

/**
 * Webhook 發送記錄
 * @description 單筆發送記錄的完整資訊
 */
export interface WebhookDeliveryRecord {
  /** 發送記錄 ID */
  id: string;
  /** 任務 ID */
  taskId: string;
  /** 事件類型 */
  event: WebhookEventType;
  /** 目標 URL */
  targetUrl: string;
  /** 發送狀態 */
  status: WebhookDeliveryStatus;
  /** HTTP 狀態碼 */
  httpStatus: number | null;
  /** 錯誤訊息 */
  errorMessage: string | null;
  /** 嘗試次數 */
  attempts: number;
  /** 最大嘗試次數 */
  maxAttempts: number;
  /** 下次重試時間 */
  nextRetryAt: string | null;
  /** 最後嘗試時間 */
  lastAttemptAt: string | null;
  /** 建立時間 */
  createdAt: string;
  /** 完成時間 */
  completedAt: string | null;
}

/**
 * Webhook 發送歷史查詢回應
 */
export interface WebhookDeliveryHistoryResponse {
  /** 發送記錄列表 */
  deliveries: WebhookDeliveryRecord[];
  /** 分頁資訊 */
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================================
// 統計類型
// ============================================================

/**
 * Webhook 發送統計
 * @description 指定時間範圍內的發送統計
 */
export interface WebhookDeliveryStats {
  /** 總發送數 */
  total: number;
  /** 成功數 */
  delivered: number;
  /** 失敗數 */
  failed: number;
  /** 等待中 */
  pending: number;
  /** 重試中 */
  retrying: number;
  /** 成功率 (百分比) */
  successRate: number;
  /** 平均響應時間 (毫秒) */
  avgResponseTimeMs: number;
  /** 按事件類型統計 */
  byEventType: Record<WebhookEventType, {
    total: number;
    delivered: number;
    failed: number;
  }>;
  /** 統計時間範圍 */
  period: {
    from: string;
    to: string;
  };
}

// ============================================================
// 重試相關類型
// ============================================================

/**
 * 手動重試請求
 */
export interface WebhookRetryRequest {
  /** 發送記錄 ID */
  deliveryId: string;
}

/**
 * 重試回應
 */
export interface WebhookRetryResponse {
  /** 是否成功排程重試 */
  success: boolean;
  /** 發送記錄 ID */
  deliveryId: string;
  /** 當前狀態 */
  status: WebhookDeliveryStatus;
  /** 訊息 */
  message: string;
  /** 預計重試時間 */
  scheduledAt?: string;
}

/**
 * 重試配置
 */
export interface WebhookRetryConfig {
  /** 最大重試次數 */
  maxAttempts: number;
  /** 重試延遲（毫秒）：[1分鐘, 5分鐘, 30分鐘] */
  retryDelays: number[];
  /** 請求超時（毫秒） */
  timeout: number;
}

/**
 * 預設重試配置
 */
export const DEFAULT_RETRY_CONFIG: WebhookRetryConfig = {
  maxAttempts: 4, // 首次 + 3 次重試
  retryDelays: [60000, 300000, 1800000], // 1分鐘, 5分鐘, 30分鐘
  timeout: 30000, // 30 秒
};

// ============================================================
// 簽名相關類型
// ============================================================

/**
 * Webhook 簽名 Headers
 * @description 發送時附加的安全簽名 Headers
 */
export interface WebhookSignatureHeaders {
  /** 簽名值 (HMAC-SHA256) */
  'X-Webhook-Signature': string;
  /** 時間戳記 (Unix timestamp) */
  'X-Webhook-Timestamp': string;
  /** 事件類型 */
  'X-Webhook-Event': WebhookEventType;
  /** 發送 ID */
  'X-Webhook-Delivery-Id': string;
}

/**
 * 簽名驗證資訊
 */
export interface SignatureVerification {
  /** 是否有效 */
  valid: boolean;
  /** 時間戳記 */
  timestamp: number;
  /** 計算的簽名 */
  computedSignature: string;
  /** 接收的簽名 */
  receivedSignature: string;
}

// ============================================================
// 錯誤類型
// ============================================================

/**
 * Webhook 錯誤代碼
 */
export type WebhookErrorCode =
  | 'DELIVERY_NOT_FOUND'
  | 'ALREADY_DELIVERED'
  | 'MAX_RETRIES_EXCEEDED'
  | 'INVALID_SIGNATURE'
  | 'DELIVERY_IN_PROGRESS'
  | 'CONFIG_NOT_FOUND';

/**
 * Webhook 錯誤代碼常數
 */
export const WEBHOOK_ERROR_CODES = {
  DELIVERY_NOT_FOUND: 'DELIVERY_NOT_FOUND',
  ALREADY_DELIVERED: 'ALREADY_DELIVERED',
  MAX_RETRIES_EXCEEDED: 'MAX_RETRIES_EXCEEDED',
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',
  DELIVERY_IN_PROGRESS: 'DELIVERY_IN_PROGRESS',
  CONFIG_NOT_FOUND: 'CONFIG_NOT_FOUND',
} as const;

/**
 * 錯誤代碼對應的 HTTP 狀態碼
 */
export const WEBHOOK_ERROR_HTTP_STATUS: Record<WebhookErrorCode, number> = {
  DELIVERY_NOT_FOUND: 404,
  ALREADY_DELIVERED: 409,
  MAX_RETRIES_EXCEEDED: 409,
  INVALID_SIGNATURE: 401,
  DELIVERY_IN_PROGRESS: 409,
  CONFIG_NOT_FOUND: 404,
};

/**
 * 錯誤代碼對應的預設訊息
 */
export const WEBHOOK_ERROR_MESSAGES: Record<WebhookErrorCode, string> = {
  DELIVERY_NOT_FOUND: 'Webhook delivery record not found',
  ALREADY_DELIVERED: 'Webhook has already been delivered successfully',
  MAX_RETRIES_EXCEEDED: 'Maximum retry attempts exceeded',
  INVALID_SIGNATURE: 'Invalid webhook signature',
  DELIVERY_IN_PROGRESS: 'Webhook delivery is currently in progress',
  CONFIG_NOT_FOUND: 'Webhook configuration not found for this API key',
};

// ============================================================
// 查詢參數類型
// ============================================================

/**
 * Webhook 歷史查詢參數
 */
export interface WebhookHistoryQueryParams {
  /** 頁碼 (預設 1) */
  page?: number;
  /** 每頁數量 (預設 20, 最大 100) */
  limit?: number;
  /** 事件類型過濾 */
  event?: WebhookEventType;
  /** 狀態過濾 */
  status?: WebhookDeliveryStatus;
  /** 開始時間 (ISO 8601) */
  from?: string;
  /** 結束時間 (ISO 8601) */
  to?: string;
  /** 任務 ID 過濾 */
  taskId?: string;
}

/**
 * 統計查詢參數
 */
export interface WebhookStatsQueryParams {
  /** 開始時間 (ISO 8601) */
  from?: string;
  /** 結束時間 (ISO 8601) */
  to?: string;
}

// ============================================================
// 服務介面類型
// ============================================================

/**
 * Webhook 發送選項
 */
export interface WebhookSendOptions {
  /** 任務 ID */
  taskId: string;
  /** 事件類型 */
  event: WebhookEventType;
  /** Payload 資料 */
  data: Record<string, unknown>;
  /** API Key ID (用於取得 webhook 配置) */
  apiKeyId: string;
}

/**
 * Webhook 發送結果
 */
export interface WebhookSendResult {
  /** 發送記錄 ID */
  deliveryId: string;
  /** 是否成功發送 */
  sent: boolean;
  /** 狀態 */
  status: WebhookDeliveryStatus;
  /** HTTP 狀態碼 (如果已發送) */
  httpStatus?: number;
  /** 錯誤訊息 (如果失敗) */
  error?: string;
}

// ============================================================
// 類型守衛
// ============================================================

/**
 * 檢查是否為有效的 Webhook 事件類型
 */
export function isValidWebhookEventType(
  event: unknown
): event is WebhookEventType {
  return (
    typeof event === 'string' &&
    Object.values(WEBHOOK_EVENT_TYPES).includes(event as WebhookEventType)
  );
}

/**
 * 檢查是否為有效的 Webhook 發送狀態
 */
export function isValidWebhookDeliveryStatus(
  status: unknown
): status is WebhookDeliveryStatus {
  return (
    typeof status === 'string' &&
    Object.values(WEBHOOK_DELIVERY_STATUS).includes(
      status as WebhookDeliveryStatus
    )
  );
}

/**
 * 檢查是否為有效的 Webhook 錯誤代碼
 */
export function isWebhookErrorCode(code: unknown): code is WebhookErrorCode {
  return (
    typeof code === 'string' &&
    Object.values(WEBHOOK_ERROR_CODES).includes(code as WebhookErrorCode)
  );
}

// ============================================================
// 常數定義
// ============================================================

/**
 * 歷史查詢預設分頁大小
 */
export const DEFAULT_HISTORY_PAGE_SIZE = 20;

/**
 * 歷史查詢最大分頁大小
 */
export const MAX_HISTORY_PAGE_SIZE = 100;

/**
 * 統計查詢預設時間範圍（天）
 */
export const DEFAULT_STATS_RANGE_DAYS = 7;

/**
 * 時間戳記容許誤差（秒）
 * @description 用於防止重放攻擊
 */
export const TIMESTAMP_TOLERANCE_SECONDS = 300; // 5 分鐘
