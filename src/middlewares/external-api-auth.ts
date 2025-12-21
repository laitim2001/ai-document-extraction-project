/**
 * @fileoverview 外部 API 認證中間件
 * @description
 *   處理外部 API 請求的認證和授權，包括：
 *   - Bearer Token 驗證
 *   - API Key 狀態檢查
 *   - IP 白名單驗證
 *   - 操作權限驗證
 *   - 使用統計更新
 *   - 失敗嘗試記錄
 *
 * @module src/middleware/external-api-auth
 * @author Development Team
 * @since Epic 11 - Story 11.1 (API 發票提交端點)
 * @lastModified 2025-12-20
 *
 * @features
 *   - SHA-256 API Key 驗證
 *   - IP 白名單限制
 *   - 操作權限檢查
 *   - 認證失敗記錄
 *   - 使用量追蹤
 *
 * @dependencies
 *   - @prisma/client - 資料庫操作
 *   - crypto - 雜湊計算
 *
 * @related
 *   - src/services/rate-limit.service.ts - 速率限制服務
 *   - src/app/api/v1/invoices/route.ts - API 路由
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createHash } from 'crypto';
import { ExternalApiKey } from '@prisma/client';

// ============================================================
// 類型定義
// ============================================================

/**
 * 外部 API 認證結果
 */
export interface ExternalApiAuthResult {
  /** 是否授權通過 */
  authorized: boolean;
  /** API Key 實體（授權通過時） */
  apiKey?: ExternalApiKey;
  /** HTTP 狀態碼 */
  statusCode: number;
  /** 錯誤代碼 */
  errorCode?: string;
  /** 錯誤訊息 */
  errorMessage?: string;
}

/**
 * 客戶端資訊
 */
export interface ClientInfo {
  /** 客戶端 IP */
  ip: string;
  /** User Agent */
  userAgent?: string;
}

// ============================================================
// 主要認證函數
// ============================================================

/**
 * 外部 API 認證中間件
 * @description
 *   驗證外部 API 請求的認證資訊，包括：
 *   1. 從 Authorization header 提取 Bearer token
 *   2. 使用 SHA-256 雜湊查找 API Key
 *   3. 檢查 API Key 狀態（啟用、未過期）
 *   4. 驗證 IP 限制
 *   5. 檢查操作權限
 *
 * @param request Next.js 請求對象
 * @param requiredOperations 所需操作權限列表
 * @returns 認證結果
 *
 * @example
 * ```typescript
 * const authResult = await externalApiAuthMiddleware(request, ['submit']);
 * if (!authResult.authorized) {
 *   return NextResponse.json({ error: authResult.errorCode }, { status: authResult.statusCode });
 * }
 * const apiKey = authResult.apiKey!;
 * ```
 */
export async function externalApiAuthMiddleware(
  request: NextRequest,
  requiredOperations?: string[]
): Promise<ExternalApiAuthResult> {
  // 1. 從 Header 獲取 API Key
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      authorized: false,
      statusCode: 401,
      errorCode: 'MISSING_API_KEY',
      errorMessage: 'API key is required. Use Authorization: Bearer {api_key}',
    };
  }

  const rawKey = authHeader.slice(7);

  // 2. 基本格式驗證
  if (!rawKey || rawKey.length < 20) {
    await recordFailedAttempt(request, rawKey?.substring(0, 8) || 'unknown');
    return {
      authorized: false,
      statusCode: 401,
      errorCode: 'INVALID_API_KEY',
      errorMessage: 'Invalid API key format',
    };
  }

  // 3. 計算 SHA-256 雜湊
  const hashedKey = createHash('sha256').update(rawKey).digest('hex');

  // 4. 查找 API Key
  const apiKey = await prisma.externalApiKey.findUnique({
    where: { keyHash: hashedKey },
  });

  if (!apiKey) {
    await recordFailedAttempt(request, rawKey.substring(0, 8));
    return {
      authorized: false,
      statusCode: 401,
      errorCode: 'INVALID_API_KEY',
      errorMessage: 'Invalid API key',
    };
  }

  // 5. 檢查是否啟用
  if (!apiKey.isActive) {
    return {
      authorized: false,
      statusCode: 403,
      errorCode: 'API_KEY_DISABLED',
      errorMessage: 'API key is disabled',
    };
  }

  // 6. 檢查是否過期
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return {
      authorized: false,
      statusCode: 403,
      errorCode: 'EXPIRED_API_KEY',
      errorMessage: 'API key has expired',
    };
  }

  // 7. 檢查 IP 限制
  if (apiKey.allowedIps && (apiKey.allowedIps as string[]).length > 0) {
    const clientIp = getClientIpFromRequest(request);
    const allowedIps = apiKey.allowedIps as string[];

    if (!allowedIps.includes(clientIp) && !allowedIps.includes('*')) {
      return {
        authorized: false,
        statusCode: 403,
        errorCode: 'IP_NOT_ALLOWED',
        errorMessage: 'Request from unauthorized IP address',
      };
    }
  }

  // 8. 檢查操作權限
  if (requiredOperations && requiredOperations.length > 0) {
    const allowedOps = apiKey.allowedOperations as string[];
    const hasPermission =
      allowedOps.includes('*') || requiredOperations.every((op) => allowedOps.includes(op));

    if (!hasPermission) {
      return {
        authorized: false,
        statusCode: 403,
        errorCode: 'INSUFFICIENT_PERMISSIONS',
        errorMessage: `API key does not have required permissions: ${requiredOperations.join(', ')}`,
        apiKey,
      };
    }
  }

  // 9. 更新使用統計（異步，不阻塞）
  updateUsageStats(apiKey.id).catch(console.error);

  return {
    authorized: true,
    apiKey,
    statusCode: 200,
  };
}

// ============================================================
// 輔助函數
// ============================================================

/**
 * 從請求中獲取客戶端 IP
 * @param request Next.js 請求對象
 * @returns 客戶端 IP 地址
 */
export function getClientIpFromRequest(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

/**
 * 從請求中獲取客戶端資訊
 * @param request Next.js 請求對象
 * @returns 客戶端資訊對象
 */
export function getClientInfo(request: NextRequest): ClientInfo {
  return {
    ip: getClientIpFromRequest(request),
    userAgent: request.headers.get('user-agent') || undefined,
  };
}

/**
 * 記錄失敗的認證嘗試
 * @description 記錄失敗的 API 認證嘗試，用於安全審計和防暴力破解
 * @param request Next.js 請求對象
 * @param keyPrefix API Key 前綴（僅保存前 8 位用於追蹤）
 */
async function recordFailedAttempt(request: NextRequest, keyPrefix: string): Promise<void> {
  try {
    await prisma.apiAuthAttempt.create({
      data: {
        keyPrefix,
        ip: getClientIpFromRequest(request),
        userAgent: request.headers.get('user-agent'),
        success: false,
      },
    });
  } catch (error) {
    console.error('Failed to record auth attempt:', error);
  }
}

/**
 * 更新 API Key 使用統計
 * @description 異步更新最後使用時間和使用計數
 * @param apiKeyId API Key ID
 */
async function updateUsageStats(apiKeyId: string): Promise<void> {
  await prisma.externalApiKey.update({
    where: { id: apiKeyId },
    data: {
      lastUsedAt: new Date(),
      usageCount: { increment: 1 },
    },
  });
}

/**
 * 生成追蹤 ID
 * @description 生成唯一的追蹤 ID 用於請求追蹤和日誌關聯
 * @returns 追蹤 ID 字串
 */
export function generateTraceId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 9);
  return `api_${timestamp}_${random}`;
}

/**
 * 驗證 API Key 格式
 * @param key API Key 字串
 * @returns 是否為有效格式
 */
export function isValidApiKeyFormat(key: string): boolean {
  // API Key 應至少 32 位，包含字母數字和特殊字符
  return key.length >= 32 && /^[A-Za-z0-9_-]+$/.test(key);
}
