/**
 * @fileoverview API Key 單一資源 API 路由
 * @description
 *   提供單一 API Key 的 CRUD 操作：
 *   - GET: 獲取 API Key 詳情
 *   - PATCH: 更新 API Key
 *   - DELETE: 刪除 API Key（軟刪除）
 *
 * @module src/app/api/admin/api-keys/[keyId]/route
 * @author Development Team
 * @since Epic 11 - Story 11.5 (API 存取控制與認證)
 * @lastModified 2025-12-21
 *
 * @features
 *   - 獲取詳情
 *   - 更新設定
 *   - 軟刪除
 *
 * @dependencies
 *   - @/services/api-key.service - API Key 服務
 *   - @/lib/auth/session - Session 驗證
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { apiKeyService } from '@/services/api-key.service';
import { UpdateApiKeySchema } from '@/types/external-api/auth';
import { ZodError } from 'zod';

// ============================================================
// 路由參數類型
// ============================================================

interface RouteParams {
  params: Promise<{
    keyId: string;
  }>;
}

// ============================================================
// GET - 獲取 API Key 詳情
// ============================================================

/**
 * GET /api/admin/api-keys/:keyId
 *
 * @description 獲取單一 API Key 的詳細資訊
 *
 * @param keyId - API Key ID
 * @returns API Key 詳情
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { keyId } = await params;

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

    // 2. 檢查權限
    const isAdmin =
      session.user.isGlobalAdmin ||
      session.user.roles?.some((r) => r.name === 'ADMIN' || r.name === 'GLOBAL_ADMIN');
    if (!isAdmin) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/forbidden',
          title: 'Forbidden',
          status: 403,
          detail: 'Insufficient permissions to view API keys',
          instance: request.nextUrl.pathname,
        },
        { status: 403 }
      );
    }

    // 3. 獲取 API Key
    const apiKey = await apiKeyService.getById(keyId);

    if (!apiKey) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: 'API key not found',
          instance: request.nextUrl.pathname,
        },
        { status: 404 }
      );
    }

    // 4. 返回結果
    return NextResponse.json({
      success: true,
      data: apiKey,
    });
  } catch (error) {
    console.error('GET /api/admin/api-keys/:keyId error:', error);

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
// PATCH - 更新 API Key
// ============================================================

/**
 * PATCH /api/admin/api-keys/:keyId
 *
 * @description 更新 API Key 設定
 *
 * @param keyId - API Key ID
 * @body 更新欄位（name, description, allowedCities, etc.）
 * @returns 更新後的 API Key
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { keyId } = await params;

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

    // 2. 檢查權限
    const isAdmin =
      session.user.isGlobalAdmin ||
      session.user.roles?.some((r) => r.name === 'ADMIN' || r.name === 'GLOBAL_ADMIN');
    if (!isAdmin) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/forbidden',
          title: 'Forbidden',
          status: 403,
          detail: 'Insufficient permissions to update API keys',
          instance: request.nextUrl.pathname,
        },
        { status: 403 }
      );
    }

    // 3. 解析和驗證請求體
    const body = await request.json();
    const data = UpdateApiKeySchema.parse(body);

    // 4. 更新 API Key
    const updated = await apiKeyService.update(keyId, data);

    if (!updated) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: 'API key not found',
          instance: request.nextUrl.pathname,
        },
        { status: 404 }
      );
    }

    // 5. 返回結果
    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('PATCH /api/admin/api-keys/:keyId error:', error);

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

// ============================================================
// DELETE - 刪除 API Key
// ============================================================

/**
 * DELETE /api/admin/api-keys/:keyId
 *
 * @description 刪除 API Key（軟刪除）
 *
 * @param keyId - API Key ID
 * @returns 刪除結果
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { keyId } = await params;

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

    // 2. 檢查權限
    const isAdmin =
      session.user.isGlobalAdmin ||
      session.user.roles?.some((r) => r.name === 'ADMIN' || r.name === 'GLOBAL_ADMIN');
    if (!isAdmin) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/forbidden',
          title: 'Forbidden',
          status: 403,
          detail: 'Insufficient permissions to delete API keys',
          instance: request.nextUrl.pathname,
        },
        { status: 403 }
      );
    }

    // 3. 刪除 API Key
    const deleted = await apiKeyService.delete(keyId);

    if (!deleted) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: 'API key not found',
          instance: request.nextUrl.pathname,
        },
        { status: 404 }
      );
    }

    // 4. 返回結果
    return NextResponse.json({
      success: true,
      message: 'API key deleted successfully',
    });
  } catch (error) {
    console.error('DELETE /api/admin/api-keys/:keyId error:', error);

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
