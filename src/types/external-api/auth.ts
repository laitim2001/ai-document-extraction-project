/**
 * @fileoverview 外部 API 認證類型定義
 * @description
 *   定義 API Key 認證相關的所有類型，包括：
 *   - API 操作類型
 *   - API Key 創建/更新請求
 *   - API Key 響應格式
 *   - 認證結果類型
 *   - 速率限制結果
 *   - 審計日誌類型
 *
 * @module src/types/external-api/auth
 * @author Development Team
 * @since Epic 11 - Story 11.5 (API 存取控制與認證)
 * @lastModified 2025-12-21
 *
 * @features
 *   - API Key 管理類型
 *   - 認證結果類型
 *   - 審計日誌類型
 *   - 速率限制類型
 *
 * @dependencies
 *   - zod - 驗證 Schema
 *
 * @related
 *   - src/services/api-key.service.ts - API Key 服務
 *   - src/services/api-audit-log.service.ts - 審計日誌服務
 *   - src/middleware/external-api-auth.ts - 認證中間件
 */

import { z } from 'zod';

// ============================================================
// API 操作類型
// ============================================================

/**
 * API 操作類型
 * @description 定義 API Key 可執行的操作
 */
export type ApiOperation = 'submit' | 'query' | 'result' | 'webhook';

/**
 * 所有可用的 API 操作
 */
export const API_OPERATIONS: ApiOperation[] = ['submit', 'query', 'result', 'webhook'];

// ============================================================
// API Key 請求類型
// ============================================================

/**
 * 創建 API Key 請求
 */
export interface CreateApiKeyRequest {
  /** API Key 名稱 */
  name: string;
  /** 描述（可選） */
  description?: string;
  /** 允許的城市代碼列表（'*' 表示全部） */
  allowedCities: string[];
  /** 允許的操作列表 */
  allowedOperations: ApiOperation[];
  /** 每分鐘速率限制 */
  rateLimit?: number;
  /** 過期時間 */
  expiresAt?: Date;
  /** 允許的 IP 列表（可選） */
  allowedIps?: string[];
  /** 封鎖的 IP 列表（可選） */
  blockedIps?: string[];
  /** 預設 Webhook 密鑰（可選） */
  webhookSecret?: string;
}

/**
 * 更新 API Key 請求
 */
export interface UpdateApiKeyRequest {
  /** API Key 名稱 */
  name?: string;
  /** 描述 */
  description?: string | null;
  /** 允許的城市代碼列表 */
  allowedCities?: string[];
  /** 允許的操作列表 */
  allowedOperations?: ApiOperation[];
  /** 每分鐘速率限制 */
  rateLimit?: number;
  /** 過期時間 */
  expiresAt?: Date | null;
  /** 是否啟用 */
  isActive?: boolean;
  /** 允許的 IP 列表 */
  allowedIps?: string[];
  /** 封鎖的 IP 列表 */
  blockedIps?: string[];
  /** 預設 Webhook 密鑰 */
  webhookSecret?: string | null;
}

// ============================================================
// API Key 響應類型
// ============================================================

/**
 * API Key 響應（不含敏感資訊）
 */
export interface ApiKeyResponse {
  /** API Key ID */
  id: string;
  /** 名稱 */
  name: string;
  /** 描述 */
  description: string | null;
  /** Key 前綴（用於識別） */
  keyPrefix: string;
  /** 允許的城市 */
  allowedCities: string[];
  /** 允許的操作 */
  allowedOperations: string[];
  /** 每分鐘速率限制 */
  rateLimit: number;
  /** 是否啟用 */
  isActive: boolean;
  /** 過期時間 */
  expiresAt: Date | null;
  /** 允許的 IP 列表 */
  allowedIps: string[];
  /** 封鎖的 IP 列表 */
  blockedIps: string[];
  /** 最後使用時間 */
  lastUsedAt: Date | null;
  /** 使用次數 */
  usageCount: bigint;
  /** 創建者 ID */
  createdById: string;
  /** 創建時間 */
  createdAt: Date;
  /** 更新時間 */
  updatedAt: Date;
}

/**
 * 創建 API Key 響應（包含原始 Key，僅在創建時返回一次）
 */
export interface CreateApiKeyResponse {
  /** API Key 詳情 */
  apiKey: ApiKeyResponse;
  /** 原始 API Key（僅返回一次） */
  rawKey: string;
  /** 提示訊息 */
  message: string;
}

// ============================================================
// 認證結果類型
// ============================================================

/**
 * 認證結果
 */
export interface AuthResult {
  /** 是否認證成功 */
  success: boolean;
  /** API Key ID（認證成功時） */
  apiKeyId?: string;
  /** API Key 名稱（認證成功時） */
  apiKeyName?: string;
  /** 錯誤代碼 */
  errorCode?: string;
  /** 錯誤訊息 */
  errorMessage?: string;
  /** 允許的城市 */
  allowedCities?: string[];
  /** 允許的操作 */
  allowedOperations?: string[];
}

/**
 * 速率限制結果
 */
export interface RateLimitResult {
  /** 是否允許請求 */
  allowed: boolean;
  /** 每分鐘限制數 */
  limit: number;
  /** 剩餘請求數 */
  remaining: number;
  /** 重置時間（Unix 時間戳） */
  reset: number;
  /** 需要等待的秒數（僅當 allowed=false 時） */
  retryAfter?: number;
}

// ============================================================
// 審計日誌類型
// ============================================================

/**
 * API 審計日誌條目
 */
export interface ApiAuditLogEntry {
  /** API Key ID */
  apiKeyId: string;
  /** HTTP 方法 */
  method: string;
  /** 正規化端點 */
  endpoint: string;
  /** 完整路徑 */
  path: string;
  /** 查詢參數 */
  queryParams?: Record<string, unknown>;
  /** 請求體（敏感資訊已過濾） */
  requestBody?: Record<string, unknown>;
  /** HTTP 狀態碼 */
  statusCode: number;
  /** 響應時間（毫秒） */
  responseTime: number;
  /** 錯誤代碼 */
  errorCode?: string;
  /** 錯誤訊息 */
  errorMessage?: string;
  /** 客戶端 IP */
  clientIp: string;
  /** User Agent */
  userAgent?: string;
  /** 國家代碼 */
  country?: string;
  /** 城市 */
  city?: string;
  /** 追蹤 ID */
  traceId?: string;
}

/**
 * 敏感欄位列表（需要在日誌中過濾）
 */
export const SENSITIVE_FIELDS = [
  'password',
  'secret',
  'apiKey',
  'api_key',
  'token',
  'authorization',
  'cookie',
  'session',
  'credential',
  'privateKey',
  'private_key',
] as const;

// ============================================================
// 驗證 Schema
// ============================================================

/**
 * 創建 API Key 請求 Schema
 */
export const CreateApiKeySchema = z.object({
  name: z
    .string()
    .min(3, 'Name must be at least 3 characters')
    .max(100, 'Name must be at most 100 characters'),
  description: z.string().max(500).optional(),
  allowedCities: z
    .array(z.string())
    .min(1, 'At least one city must be allowed'),
  allowedOperations: z
    .array(z.enum(['submit', 'query', 'result', 'webhook']))
    .min(1, 'At least one operation must be allowed'),
  rateLimit: z.number().int().min(1).max(10000).default(60),
  expiresAt: z
    .string()
    .datetime()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  allowedIps: z.array(z.string()).optional(),
  blockedIps: z.array(z.string()).optional(),
  webhookSecret: z.string().max(128).optional(),
});

/**
 * 更新 API Key 請求 Schema
 */
export const UpdateApiKeySchema = z.object({
  name: z.string().min(3).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  allowedCities: z.array(z.string()).min(1).optional(),
  allowedOperations: z
    .array(z.enum(['submit', 'query', 'result', 'webhook']))
    .min(1)
    .optional(),
  rateLimit: z.number().int().min(1).max(10000).optional(),
  expiresAt: z
    .string()
    .datetime()
    .optional()
    .nullable()
    .transform((val) => (val ? new Date(val) : val === null ? null : undefined)),
  isActive: z.boolean().optional(),
  allowedIps: z.array(z.string()).optional(),
  blockedIps: z.array(z.string()).optional(),
  webhookSecret: z.string().max(128).optional().nullable(),
});

/**
 * API Key 列表查詢參數 Schema
 */
export const ApiKeyListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => (val === 'true' ? true : val === 'false' ? false : undefined)),
  sortBy: z.enum(['name', 'createdAt', 'lastUsedAt', 'usageCount']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * API 審計日誌查詢參數 Schema
 */
export const ApiAuditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  apiKeyId: z.string().cuid().optional(),
  startDate: z
    .string()
    .datetime()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  endDate: z
    .string()
    .datetime()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  statusCode: z.coerce.number().int().optional(),
  endpoint: z.string().optional(),
  clientIp: z.string().optional(),
});
