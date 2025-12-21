/**
 * @fileoverview API Key 輪替路由
 * @description
 *   提供 API Key 輪替功能：
 *   - 生成新的 Key
 *   - 停用舊的 Key
 *   - 保留配置設定
 *
 * @module src/app/api/admin/api-keys/[keyId]/rotate/route
 * @author Development Team
 * @since Epic 11 - Story 11.5 (API 存取控制與認證)
 * @lastModified 2025-12-21
 *
 * @features
 *   - Key 輪替
 *   - 舊 Key 自動停用
 *
 * @dependencies
 *   - @/services/api-key.service - API Key 服務
 *   - @/lib/auth/session - Session 驗證
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { apiKeyService } from '@/services/api-key.service';

// ============================================================
// 路由參數類型
// ============================================================

interface RouteParams {
  params: Promise<{
    keyId: string;
  }>;
}

// ============================================================
// POST - 輪替 API Key
// ============================================================

/**
 * POST /api/admin/api-keys/:keyId/rotate
 *
 * @description 輪替 API Key（生成新 Key，停用舊 Key）
 *
 * @param keyId - 原始 API Key ID
 * @returns 新的 API Key（包含原始 Key，僅此次可見）
 */
export async function POST(
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
          detail: 'Insufficient permissions to rotate API keys',
          instance: request.nextUrl.pathname,
        },
        { status: 403 }
      );
    }

    // 3. 輪替 API Key
    const result = await apiKeyService.rotate(keyId);

    if (!result) {
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
      data: {
        apiKey: result.apiKey,
        rawKey: result.rawKey,
      },
      message: result.message,
    });
  } catch (error) {
    console.error('POST /api/admin/api-keys/:keyId/rotate error:', error);

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
