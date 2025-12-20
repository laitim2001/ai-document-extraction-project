/**
 * @fileoverview n8n 整合相關類型定義
 * @description
 *   定義 n8n 工作流整合所需的所有類型，包含：
 *   - API Key 管理類型
 *   - 文件提交與狀態類型
 *   - Webhook 事件類型
 *   - 錯誤響應類型
 *   - Webhook 配置管理類型 (Story 10.2)
 *
 * @module src/types/n8n
 * @since Epic 10 - Story 10.1
 * @lastModified 2025-12-20
 *
 * @features
 *   - n8n API Key 管理
 *   - 文件提交與狀態追蹤
 *   - Webhook 雙向通信
 *   - Webhook 配置管理
 */

import { DocumentStatus } from '@prisma/client';

// ============================================================
// API Key Types
// ============================================================

/**
 * n8n API 權限類型
 */
export type N8nPermission =
  | 'documents:read'
  | 'documents:write'
  | 'webhook:receive'
  | 'workflow:trigger'
  | 'status:read'
  | '*';

/**
 * n8n API Key 資訊
 */
export interface N8nApiKeyInfo {
  id: string;
  keyPrefix: string;
  name: string;
  cityCode: string;
  cityName: string;
  permissions: N8nPermission[];
  isActive: boolean;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  usageCount: number;
  rateLimit: number;
  createdAt: Date;
  createdBy: string;
}

/**
 * 建立 API Key 輸入
 */
export interface CreateApiKeyInput {
  name: string;
  cityCode: string;
  permissions: N8nPermission[];
  expiresAt?: Date;
  rateLimit?: number;
  createdBy: string;
}

/**
 * 建立 API Key 結果
 */
export interface CreateApiKeyResult {
  apiKey: N8nApiKeyInfo;
  rawKey: string; // 只在創建時返回一次
}

/**
 * API Key 驗證錯誤碼
 */
export type ApiKeyValidationErrorCode =
  | 'INVALID_KEY'
  | 'DISABLED'
  | 'EXPIRED'
  | 'RATE_LIMITED';

/**
 * 驗證 API Key 結果
 */
export interface ValidateApiKeyResult {
  valid: boolean;
  apiKey?: N8nApiKeyInfo;
  error?: string;
  errorCode?: ApiKeyValidationErrorCode;
}

// ============================================================
// Document Types
// ============================================================

/**
 * 文件觸發來源類型
 */
export type DocumentTriggerSource = 'sharepoint' | 'outlook' | 'manual' | 'api';

/**
 * n8n 文件提交請求
 */
export interface N8nDocumentSubmitRequest {
  // 文件資訊
  fileName: string;
  fileContent: string; // Base64 encoded
  mimeType: string;
  fileSize: number;

  // 來源資訊
  workflowId?: string;
  workflowName?: string;
  workflowExecutionId?: string;
  triggerSource?: DocumentTriggerSource;

  // 業務資訊
  cityCode: string;
  forwarderCode?: string;
  metadata?: Record<string, unknown>;

  // 回調設定
  callbackUrl?: string;
  correlationId?: string;
}

/**
 * n8n 文件提交響應
 */
export interface N8nDocumentResponse {
  success: boolean;
  documentId?: string;
  status?: string;
  message?: string;
  traceId: string;
  timestamp: string;
}

/**
 * n8n 文件狀態響應
 */
export interface N8nDocumentStatusResponse {
  documentId: string;
  status: DocumentStatus;
  processingStage?: string;
  progress: number;
  estimatedCompletionTime?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * n8n 文件結果響應
 */
export interface N8nDocumentResultResponse {
  documentId: string;
  status: DocumentStatus;
  extractedData?: Record<string, unknown>;
  confidenceScore?: number;
  forwarderCode?: string | null;
  forwarderName?: string | null;
  reviewStatus?: string | null;
  processingDuration?: number | null;
  completedAt?: Date | null;
}

// ============================================================
// Webhook Types
// ============================================================

/**
 * n8n 事件類型
 */
export type N8nEventType =
  | 'DOCUMENT_RECEIVED'
  | 'DOCUMENT_PROCESSING'
  | 'DOCUMENT_COMPLETED'
  | 'DOCUMENT_FAILED'
  | 'DOCUMENT_REVIEW_NEEDED'
  | 'WORKFLOW_STARTED'
  | 'WORKFLOW_COMPLETED'
  | 'WORKFLOW_FAILED';

/**
 * Webhook 發送狀態
 */
export type WebhookDeliveryStatus =
  | 'PENDING'
  | 'SENDING'
  | 'SUCCESS'
  | 'FAILED'
  | 'RETRYING'
  | 'EXHAUSTED';

/**
 * Webhook 載荷結構
 */
export interface WebhookPayload<T = Record<string, unknown>> {
  event: N8nEventType;
  timestamp: string;
  data: T;
  metadata: {
    traceId: string;
    retryCount: number;
    cityCode: string;
  };
}

/**
 * 發送事件輸入
 */
export interface SendEventInput {
  eventType: N8nEventType;
  documentId?: string;
  workflowExecutionId?: string;
  webhookUrl: string;
  cityCode: string;
  payload: Record<string, unknown>;
}

/**
 * Webhook 發送結果
 */
export interface WebhookDeliveryResult {
  success: boolean;
  eventId: string;
  status: WebhookDeliveryStatus;
  responseCode?: number;
  responseTime?: number;
  error?: string;
  retryScheduled?: Date;
}

/**
 * 入站 Webhook 事件類型
 */
export type IncomingWebhookEventType =
  | 'workflow.started'
  | 'workflow.completed'
  | 'workflow.failed'
  | 'workflow.progress'
  | 'document.status_changed';

/**
 * 入站 Webhook 事件
 */
export interface IncomingWebhookEvent {
  event: IncomingWebhookEventType;
  workflowExecutionId?: string;
  documentId?: string;
  data: Record<string, unknown>;
  timestamp: string;
}

// ============================================================
// Error Types
// ============================================================

/**
 * n8n API 錯誤碼
 */
export type N8nErrorCode =
  | 'MISSING_API_KEY'
  | 'INVALID_API_KEY'
  | 'EXPIRED_API_KEY'
  | 'DISABLED_API_KEY'
  | 'RATE_LIMITED'
  | 'INSUFFICIENT_PERMISSIONS'
  | 'CITY_MISMATCH'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR'
  | 'WEBHOOK_DELIVERY_FAILED';

/**
 * n8n API 錯誤響應
 */
export interface N8nApiError {
  success: false;
  error: {
    code: N8nErrorCode;
    message: string;
    details?: unknown;
  };
  traceId: string;
  timestamp: string;
}

/**
 * n8n API 成功響應
 */
export interface N8nApiSuccess<T = unknown> {
  success: true;
  data: T;
  traceId: string;
  timestamp: string;
}

/**
 * n8n API 響應（聯合類型）
 */
export type N8nApiResponse<T = unknown> = N8nApiSuccess<T> | N8nApiError;

// ============================================================
// Middleware Types
// ============================================================

/**
 * n8n API 認證上下文
 */
export interface N8nApiContext {
  authorized: boolean;
  apiKey?: N8nApiKeyInfo;
  traceId: string;
  statusCode: number;
  errorCode?: N8nErrorCode;
  errorMessage?: string;
}

// ============================================================
// Webhook Statistics Types
// ============================================================

/**
 * Webhook 發送統計
 */
export interface WebhookDeliveryStats {
  total: number;
  success: number;
  failed: number;
  pending: number;
  successRate: number;
  avgResponseTime: number;
}

// ============================================================
// API Key List Types
// ============================================================

/**
 * API Key 列表選項
 */
export interface ListApiKeysOptions {
  cityCode?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

/**
 * API Key 列表結果
 */
export interface ListApiKeysResult {
  items: N8nApiKeyInfo[];
  total: number;
}

// ============================================================
// Webhook Configuration Types (Story 10.2)
// ============================================================

/**
 * Webhook 測試結果類型
 */
export type WebhookTestResult = 'SUCCESS' | 'FAILED' | 'TIMEOUT' | 'ERROR';

/**
 * 配置變更類型
 */
export type ConfigChangeType =
  | 'CREATED'
  | 'UPDATED'
  | 'ACTIVATED'
  | 'DEACTIVATED'
  | 'DELETED';

/**
 * 重試策略配置
 */
export interface RetryStrategy {
  maxAttempts: number;
  delays: number[]; // 毫秒，例如 [1000, 5000, 30000]
}

/**
 * 預設重試策略
 */
export const DEFAULT_RETRY_STRATEGY: RetryStrategy = {
  maxAttempts: 3,
  delays: [1000, 5000, 30000],
};

/**
 * Webhook 配置 DTO
 */
export interface WebhookConfigDto {
  id: string;
  name: string;
  description: string | null;
  baseUrl: string;
  endpointPath: string;
  cityCode: string | null;
  cityName: string | null;
  retryStrategy: RetryStrategy;
  timeoutMs: number;
  subscribedEvents: N8nEventType[];
  isActive: boolean;
  lastTestAt: Date | null;
  lastTestResult: WebhookTestResult | null;
  lastTestError: string | null;
  createdBy: string;
  createdByName: string | null;
  createdAt: Date;
  updatedBy: string | null;
  updatedByName: string | null;
  updatedAt: Date;
}

/**
 * Webhook 配置列表項目（簡化版）
 */
export interface WebhookConfigListItem {
  id: string;
  name: string;
  baseUrl: string;
  endpointPath: string;
  cityCode: string | null;
  cityName: string | null;
  isActive: boolean;
  lastTestAt: Date | null;
  lastTestResult: WebhookTestResult | null;
  createdAt: Date;
}

/**
 * 創建 Webhook 配置輸入
 */
export interface CreateWebhookConfigInput {
  name: string;
  description?: string;
  baseUrl: string;
  endpointPath: string;
  authToken: string;
  cityCode?: string;
  retryStrategy?: RetryStrategy;
  timeoutMs?: number;
  subscribedEvents?: N8nEventType[];
}

/**
 * 更新 Webhook 配置輸入
 */
export interface UpdateWebhookConfigInput {
  name?: string;
  description?: string | null;
  baseUrl?: string;
  endpointPath?: string;
  authToken?: string;
  cityCode?: string | null;
  retryStrategy?: RetryStrategy;
  timeoutMs?: number;
  subscribedEvents?: N8nEventType[];
  isActive?: boolean;
}

/**
 * 連接測試請求
 */
export interface TestConnectionRequest {
  configId?: string; // 使用現有配置測試
  // 或者使用臨時配置測試
  baseUrl?: string;
  endpointPath?: string;
  authToken?: string;
  timeoutMs?: number;
}

/**
 * 連接測試結果
 */
export interface TestConnectionResult {
  success: boolean;
  result: WebhookTestResult;
  responseTime?: number;
  statusCode?: number;
  message?: string;
  error?: string;
  testedAt: Date;
}

/**
 * Webhook 配置歷史 DTO
 */
export interface WebhookConfigHistoryDto {
  id: string;
  configId: string;
  changeType: ConfigChangeType;
  previousValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  changedFields: string[];
  changedBy: string;
  changedByName: string | null;
  changedAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
}

/**
 * Webhook 配置列表選項
 */
export interface ListWebhookConfigsOptions {
  cityCode?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
  orderBy?: 'createdAt' | 'name' | 'lastTestAt';
  order?: 'asc' | 'desc';
}

/**
 * Webhook 配置列表結果
 */
export interface ListWebhookConfigsResult {
  items: WebhookConfigListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * 配置歷史列表選項
 */
export interface ListConfigHistoryOptions {
  configId: string;
  changeType?: ConfigChangeType;
  page?: number;
  pageSize?: number;
}

/**
 * 配置歷史列表結果
 */
export interface ListConfigHistoryResult {
  items: WebhookConfigHistoryDto[];
  total: number;
  page: number;
  pageSize: number;
}
