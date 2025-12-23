/**
 * @fileoverview Forwarder List API 端點（下拉選單用）
 * @description
 *   提供簡化的 Forwarder 列表用於下拉選單：
 *   - 只返回 id, code, name, displayName
 *   - 支援快取（5 分鐘 TTL）
 *   - 只返回啟用的 Forwarder
 *
 *   端點：
 *   - GET /api/forwarders/list - 獲取簡化的 Forwarder 列表
 *
 * @module src/app/api/forwarders/list/route
 * @since Epic 7 - Story 7.3 (Forwarder Filter)
 * @lastModified 2025-12-22 (REFACTOR-001)
 *
 * @features
 *   - 簡化響應（只返回下拉選單需要的欄位）
 *   - HTTP 快取標頭（5 分鐘）
 *   - 按 displayName 排序
 *   - REFACTOR-001: 使用 Company 模型，篩選 type=FORWARDER
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/lib/prisma - Prisma 客戶端
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/auth/city-permission';
import { PERMISSIONS } from '@/types/permissions';
import { CompanyType, CompanyStatus } from '@prisma/client';
import type { ForwarderListResponse } from '@/types/forwarder-filter';

/**
 * 快取 TTL（秒）
 */
const CACHE_TTL_SECONDS = 300; // 5 分鐘

/**
 * GET /api/forwarders/list
 * 獲取簡化的 Forwarder 列表（用於下拉選單）
 *
 * @description
 *   返回所有啟用的 Forwarder 的簡化列表。
 *   結果會被快取 5 分鐘以減少資料庫查詢。
 *   需要 FORWARDER_VIEW 權限。
 *
 * @param request - HTTP 請求
 * @returns Forwarder 列表
 *
 * @example
 *   GET /api/forwarders/list
 *
 *   Response:
 *   {
 *     "success": true,
 *     "data": [
 *       {
 *         "id": "xxx",
 *         "code": "DHL",
 *         "name": "DHL Express",
 *         "displayName": "DHL Express"
 *       }
 *     ],
 *     "meta": {
 *       "total": 15,
 *       "cached": true,
 *       "cachedAt": "2025-12-19T10:00:00Z"
 *     }
 *   }
 */
export async function GET(_request: NextRequest) {
  try {
    // 1. 驗證認證狀態
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/unauthorized',
            title: 'Unauthorized',
            status: 401,
            detail: 'Authentication required',
          },
        },
        { status: 401 }
      );
    }

    // 2. 驗證權限
    const canView = hasPermission(session.user, PERMISSIONS.FORWARDER_VIEW);
    if (!canView) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/forbidden',
            title: 'Forbidden',
            status: 403,
            detail: 'You do not have permission to view forwarders',
          },
        },
        { status: 403 }
      );
    }

    // 3. 查詢啟用的 Forwarder（只選擇需要的欄位）
    // REFACTOR-001: 使用 Company 模型，篩選 type=FORWARDER
    const forwarders = await prisma.company.findMany({
      where: {
        type: CompanyType.FORWARDER,
        status: CompanyStatus.ACTIVE,
      },
      select: {
        id: true,
        code: true,
        name: true,
        displayName: true,
      },
      orderBy: {
        displayName: 'asc',
      },
    });

    // 4. 準備響應
    const response: ForwarderListResponse = {
      success: true,
      data: forwarders,
      meta: {
        total: forwarders.length,
        cached: false,
        cachedAt: new Date().toISOString(),
      },
    };

    // 5. 返回響應並設定快取標頭
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}, stale-while-revalidate=${CACHE_TTL_SECONDS * 2}`,
        'CDN-Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`,
        'Vercel-CDN-Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`,
      },
    });
  } catch (error) {
    console.error('Get forwarder list error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'https://api.example.com/errors/internal-server-error',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Failed to fetch forwarder list',
        },
      },
      { status: 500 }
    );
  }
}
