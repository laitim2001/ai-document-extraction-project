/**
 * @fileoverview 審計日誌 API 中間件
 * @description
 *   提供 withAuditLog 高階函數，用於自動記錄 API 操作的審計日誌。
 *   支援：
 *   - 自動提取用戶資訊、IP 地址、User Agent
 *   - 自動記錄操作結果（成功/失敗）
 *   - 可自定義資源 ID、名稱、描述等提取邏輯
 *
 * @module src/middleware/audit-log.middleware
 * @since Epic 8 - Story 8.1 (用戶操作日誌記錄)
 * @lastModified 2025-12-20
 *
 * @features
 *   - 高階函數包裝 API handler
 *   - 自動提取請求資訊
 *   - 支援自定義資源提取器
 *   - 非阻塞式日誌記錄
 *
 * @dependencies
 *   - @/lib/auth - 認證函數
 *   - @/services/audit-log.service - 審計日誌服務
 *   - @/types/audit - 審計類型定義
 *
 * @related
 *   - src/services/audit-log.service.ts - 審計日誌服務
 *   - src/types/audit.ts - 類型定義
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { auditLogService } from '@/services/audit-log.service';
import { AuditAction, AuditLogEntry, AuditChanges } from '@/types/audit';
import { v4 as uuidv4 } from 'uuid';

// ============================================================
// Types
// ============================================================

/**
 * 審計日誌配置
 */
export interface AuditConfig {
  /** 操作類型 */
  action: AuditAction;
  /** 資源類型 */
  resourceType: string;
  /** 從請求中提取資源 ID 的函數 */
  getResourceId?: (req: NextRequest, result?: unknown) => string | undefined;
  /** 從請求中提取資源名稱的函數 */
  getResourceName?: (req: NextRequest, result?: unknown) => string | undefined;
  /** 生成操作描述的函數 */
  getDescription?: (req: NextRequest, result?: unknown) => string | undefined;
  /** 從請求中提取城市代碼的函數 */
  getCityCode?: (req: NextRequest, result?: unknown) => string | undefined;
  /** 提取變更數據的函數（用於 UPDATE/DELETE 操作） */
  getChanges?: (
    req: NextRequest,
    result?: unknown
  ) => AuditChanges | undefined;
  /** 額外的元數據 */
  getMetadata?: (
    req: NextRequest,
    result?: unknown
  ) => Record<string, unknown> | undefined;
  /** 是否跳過特定條件的日誌記錄 */
  shouldSkip?: (req: NextRequest, result?: unknown) => boolean;
}

/**
 * API Handler 類型
 */
export type ApiHandler = (req: NextRequest) => Promise<NextResponse>;

/**
 * 帶有參數的 API Handler 類型
 */
export type ApiHandlerWithParams<TParams = Record<string, string>> = (
  req: NextRequest,
  context: { params: TParams }
) => Promise<NextResponse>;

// ============================================================
// Helper Functions
// ============================================================

/**
 * 從請求中提取 IP 地址
 */
function extractIpAddress(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown'
  );
}

/**
 * 從請求中提取 User Agent
 */
function extractUserAgent(request: NextRequest): string | undefined {
  return request.headers.get('user-agent') || undefined;
}

/**
 * 安全地解析 JSON 響應
 */
async function safeParseJsonResponse(
  response: NextResponse
): Promise<unknown | undefined> {
  if (!response.headers.get('content-type')?.includes('application/json')) {
    return undefined;
  }

  try {
    const cloned = response.clone();
    return await cloned.json();
  } catch {
    return undefined;
  }
}

// ============================================================
// Middleware
// ============================================================

/**
 * 審計日誌中間件（高階函數）
 *
 * @description
 * 包裝 API handler，自動記錄操作的審計日誌。
 *
 * @param config - 審計配置
 * @param handler - 原始 API handler
 * @returns 包裝後的 API handler
 *
 * @example
 * ```typescript
 * // src/app/api/documents/[id]/route.ts
 * export const GET = withAuditLog(
 *   {
 *     action: 'READ',
 *     resourceType: 'document',
 *     getResourceId: (req) => req.url.split('/').pop(),
 *     getCityCode: (_, result) => (result as any)?.data?.cityCode
 *   },
 *   async (req) => {
 *     // handler 邏輯
 *     return NextResponse.json({ success: true, data: document });
 *   }
 * );
 * ```
 */
export function withAuditLog(
  config: AuditConfig,
  handler: ApiHandler
): ApiHandler {
  return async (request: NextRequest): Promise<NextResponse> => {
    const session = await auth();
    const requestId = uuidv4();
    const startTime = Date.now();

    const ipAddress = extractIpAddress(request);
    const userAgent = extractUserAgent(request);

    let response: NextResponse;
    let status: 'SUCCESS' | 'FAILURE' = 'SUCCESS';
    let errorMessage: string | undefined;
    let result: unknown;

    try {
      // 執行原始 handler
      response = await handler(request);

      // 嘗試解析響應
      result = await safeParseJsonResponse(response);

      // 判斷操作是否成功
      if (!response.ok) {
        status = 'FAILURE';
        const resultObj = result as { error?: string } | undefined;
        errorMessage = resultObj?.error || `HTTP ${response.status}`;
      }
    } catch (error) {
      status = 'FAILURE';
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    } finally {
      // 檢查是否應跳過日誌記錄
      if (config.shouldSkip?.(request, result)) {
        // 跳過日誌記錄
      } else if (session?.user) {
        // 構建審計日誌條目
        const entry: AuditLogEntry = {
          userId: session.user.id as string,
          userName: session.user.name || session.user.email || 'Unknown',
          userEmail: session.user.email || undefined,
          action: config.action,
          resourceType: config.resourceType,
          resourceId: config.getResourceId?.(request, result),
          resourceName: config.getResourceName?.(request, result),
          description: config.getDescription?.(request, result),
          changes: config.getChanges?.(request, result),
          ipAddress,
          userAgent,
          requestId,
          sessionId: session.user.id as string,
          status,
          errorMessage,
          cityCode:
            config.getCityCode?.(request, result) ||
            (session.user as { primaryCityCode?: string }).primaryCityCode,
          metadata: {
            duration: Date.now() - startTime,
            method: request.method,
            path: new URL(request.url).pathname,
            ...config.getMetadata?.(request, result),
          },
        };

        // 非阻塞式記錄日誌
        auditLogService.log(entry).catch((error) => {
          console.error('Failed to log audit entry:', error);
        });
      }
    }

    return response!;
  };
}

/**
 * 審計日誌中間件（帶參數版本）
 *
 * @description
 * 用於 Next.js 動態路由的審計日誌中間件。
 *
 * @example
 * ```typescript
 * // src/app/api/documents/[id]/route.ts
 * export const DELETE = withAuditLogParams<{ id: string }>(
 *   {
 *     action: 'DELETE',
 *     resourceType: 'document',
 *     getResourceId: (_, __, params) => params.id
 *   },
 *   async (req, { params }) => {
 *     const { id } = await params;
 *     // 刪除邏輯
 *     return NextResponse.json({ success: true });
 *   }
 * );
 * ```
 */
export function withAuditLogParams<TParams = Record<string, string>>(
  config: AuditConfig & {
    getResourceId?: (
      req: NextRequest,
      result?: unknown,
      params?: TParams
    ) => string | undefined;
    getResourceName?: (
      req: NextRequest,
      result?: unknown,
      params?: TParams
    ) => string | undefined;
  },
  handler: ApiHandlerWithParams<TParams>
): ApiHandlerWithParams<TParams> {
  return async (
    request: NextRequest,
    context: { params: TParams }
  ): Promise<NextResponse> => {
    const session = await auth();
    const requestId = uuidv4();
    const startTime = Date.now();
    const params = await Promise.resolve(context.params);

    const ipAddress = extractIpAddress(request);
    const userAgent = extractUserAgent(request);

    let response: NextResponse;
    let status: 'SUCCESS' | 'FAILURE' = 'SUCCESS';
    let errorMessage: string | undefined;
    let result: unknown;

    try {
      response = await handler(request, context);
      result = await safeParseJsonResponse(response);

      if (!response.ok) {
        status = 'FAILURE';
        const resultObj = result as { error?: string } | undefined;
        errorMessage = resultObj?.error || `HTTP ${response.status}`;
      }
    } catch (error) {
      status = 'FAILURE';
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    } finally {
      if (config.shouldSkip?.(request, result)) {
        // 跳過日誌記錄
      } else if (session?.user) {
        const entry: AuditLogEntry = {
          userId: session.user.id as string,
          userName: session.user.name || session.user.email || 'Unknown',
          userEmail: session.user.email || undefined,
          action: config.action,
          resourceType: config.resourceType,
          resourceId: config.getResourceId?.(request, result, params),
          resourceName: config.getResourceName?.(request, result, params),
          description: config.getDescription?.(request, result),
          changes: config.getChanges?.(request, result),
          ipAddress,
          userAgent,
          requestId,
          sessionId: session.user.id as string,
          status,
          errorMessage,
          cityCode:
            config.getCityCode?.(request, result) ||
            (session.user as { primaryCityCode?: string }).primaryCityCode,
          metadata: {
            duration: Date.now() - startTime,
            method: request.method,
            path: new URL(request.url).pathname,
            params,
            ...config.getMetadata?.(request, result),
          },
        };

        auditLogService.log(entry).catch((error) => {
          console.error('Failed to log audit entry:', error);
        });
      }
    }

    return response!;
  };
}

/**
 * 手動記錄審計日誌
 *
 * @description
 * 用於需要在 handler 內部手動記錄日誌的場景。
 *
 * @example
 * ```typescript
 * async function handler(req: NextRequest) {
 *   const session = await auth();
 *
 *   // 執行操作
 *   const document = await createDocument(data);
 *
 *   // 手動記錄日誌
 *   await logAuditEntry(req, session, {
 *     action: 'CREATE',
 *     resourceType: 'document',
 *     resourceId: document.id,
 *     resourceName: document.fileName,
 *     cityCode: document.cityCode
 *   });
 *
 *   return NextResponse.json({ success: true, data: document });
 * }
 * ```
 */
export async function logAuditEntry(
  request: NextRequest,
  session: { user: { id: string; name?: string | null; email?: string | null } } | null,
  options: {
    action: AuditAction;
    resourceType: string;
    resourceId?: string;
    resourceName?: string;
    description?: string;
    changes?: AuditChanges;
    cityCode?: string;
    status?: 'SUCCESS' | 'FAILURE' | 'PARTIAL';
    errorMessage?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  if (!session?.user) {
    return;
  }

  const entry: AuditLogEntry = {
    userId: session.user.id,
    userName: session.user.name || session.user.email || 'Unknown',
    userEmail: session.user.email || undefined,
    action: options.action,
    resourceType: options.resourceType,
    resourceId: options.resourceId,
    resourceName: options.resourceName,
    description: options.description,
    changes: options.changes,
    ipAddress: extractIpAddress(request),
    userAgent: extractUserAgent(request),
    requestId: uuidv4(),
    sessionId: session.user.id,
    status: options.status || 'SUCCESS',
    errorMessage: options.errorMessage,
    cityCode: options.cityCode,
    metadata: {
      method: request.method,
      path: new URL(request.url).pathname,
      ...options.metadata,
    },
  };

  await auditLogService.log(entry);
}
