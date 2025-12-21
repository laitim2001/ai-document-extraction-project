/**
 * @fileoverview API Key 管理 API 路由
 * @description
 *   提供 API Key 的列表查詢和創建功能：
 *   - GET: 列出所有 API Keys（支援分頁、搜尋、排序）
 *   - POST: 創建新的 API Key
 *
 * @module src/app/api/admin/api-keys/route
 * @author Development Team
 * @since Epic 11 - Story 11.5 (API 存取控制與認證)
 * @lastModified 2025-12-21
 *
 * @features
 *   - 分頁查詢
 *   - 搜尋和篩選
 *   - 創建新 Key
 *
 * @dependencies
 *   - @/services/api-key.service - API Key 服務
 *   - @/lib/auth/session - Session 驗證
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { apiKeyService } from '@/services/api-key.service';
import {
  CreateApiKeySchema,
  ApiKeyListQuerySchema,
} from '@/types/external-api/auth';
import { ZodError } from 'zod';

// ============================================================
// GET - 列出 API Keys
// ============================================================

/**
 * GET /api/admin/api-keys
 *
 * @description 列出所有 API Keys（支援分頁、搜尋、排序）
 *
 * @query page - 頁碼（預設 1）
 * @query limit - 每頁數量（預設 20）
 * @query search - 搜尋關鍵字
 * @query isActive - 啟用狀態篩選
 * @query sortBy - 排序欄位（name, createdAt, lastUsedAt, usageCount）
 * @query sortOrder - 排序方向（asc, desc）
 *
 * @returns 分頁的 API Key 列表
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 驗證 Session
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: 'Authentication required',
          instance: request.nextUrl.pathname,
        },
        { status: 401 }
      );
    }

    // 2. 檢查權限（只有 GLOBAL_ADMIN 可以管理 API Keys）
    const isAdmin =
      session.user.isGlobalAdmin ||
      session.user.roles?.some((r) => r.name === 'GLOBAL_ADMIN');
    if (!isAdmin) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/forbidden',
          title: 'Forbidden',
          status: 403,
          detail: 'Insufficient permissions to manage API keys',
          instance: request.nextUrl.pathname,
        },
        { status: 403 }
      );
    }

    // 3. 解析查詢參數
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const params = ApiKeyListQuerySchema.parse(searchParams);

    // 4. 查詢 API Keys
    const result = await apiKeyService.list(params);

    // 5. 返回結果
    return NextResponse.json({
      success: true,
      data: result.data,
      meta: {
        pagination: result.pagination,
      },
    });
  } catch (error) {
    console.error('GET /api/admin/api-keys error:', error);

    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid query parameters',
          instance: request.nextUrl.pathname,
          errors: error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred',
        instance: request.nextUrl.pathname,
      },
      { status: 500 }
    );
  }
}

// ============================================================
// POST - 創建 API Key
// ============================================================

/**
 * POST /api/admin/api-keys
 *
 * @description 創建新的 API Key
 *
 * @body name - API Key 名稱
 * @body description - 描述（可選）
 * @body allowedCities - 允許的城市列表
 * @body allowedOperations - 允許的操作列表
 * @body rateLimit - 速率限制（可選，預設 60）
 * @body expiresAt - 過期時間（可選）
 * @body allowedIps - 允許的 IP 列表（可選）
 * @body blockedIps - 封鎖的 IP 列表（可選）
 * @body webhookSecret - Webhook 密鑰（可選）
 *
 * @returns 創建的 API Key（包含原始 Key，僅此次可見）
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 驗證 Session
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: 'Authentication required',
          instance: request.nextUrl.pathname,
        },
        { status: 401 }
      );
    }

    // 2. 檢查權限（只有 ADMIN 或 GLOBAL_ADMIN 可以創建 API Keys）
    const isAdmin =
      session.user.isGlobalAdmin ||
      session.user.roles?.some((r) => r.name === 'ADMIN' || r.name === 'GLOBAL_ADMIN');
    if (!isAdmin) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/forbidden',
          title: 'Forbidden',
          status: 403,
          detail: 'Insufficient permissions to create API keys',
          instance: request.nextUrl.pathname,
        },
        { status: 403 }
      );
    }

    // 3. 解析和驗證請求體
    const body = await request.json();
    const data = CreateApiKeySchema.parse(body);

    // 4. 創建 API Key
    const result = await apiKeyService.create(
      {
        name: data.name,
        description: data.description,
        allowedCities: data.allowedCities,
        allowedOperations: data.allowedOperations,
        rateLimit: data.rateLimit,
        expiresAt: data.expiresAt,
        allowedIps: data.allowedIps,
        blockedIps: data.blockedIps,
        webhookSecret: data.webhookSecret,
      },
      session.user.id
    );

    // 5. 返回結果
    return NextResponse.json(
      {
        success: true,
        data: {
          apiKey: result.apiKey,
          rawKey: result.rawKey,
        },
        message: result.message,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/admin/api-keys error:', error);

    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid request body',
          instance: request.nextUrl.pathname,
          errors: error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred',
        instance: request.nextUrl.pathname,
      },
      { status: 500 }
    );
  }
}
