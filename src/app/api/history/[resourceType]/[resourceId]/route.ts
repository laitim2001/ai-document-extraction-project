/**
 * @fileoverview 變更歷史 API 端點
 * @description
 *   提供資源變更歷史的查詢功能。
 *   需要認證才能存取。
 *
 *   端點：
 *   - GET /api/history/[resourceType]/[resourceId] - 獲取資源的變更歷史
 *
 *   查詢參數：
 *   - limit: 返回數量（預設 20，最大 100）
 *   - offset: 偏移量（預設 0）
 *   - format: 返回格式 ('full' | 'timeline'，預設 'full')
 *
 * @module src/app/api/history/[resourceType]/[resourceId]/route
 * @author Development Team
 * @since Epic 8 - Story 8.2 (數據變更追蹤)
 * @lastModified 2025-12-22
 * @refactor REFACTOR-001 (Forwarder → Company)
 *
 * @features
 *   - 分頁歷史查詢
 *   - 時間線格式支援
 *   - 版本快照獲取
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/services/change-tracking.service - 變更追蹤服務
 *   - @/types/change-tracking - 類型定義
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { changeTrackingService } from '@/services/change-tracking.service';
import { isTrackedModel, type TrackedModel } from '@/types/change-tracking';
import { z } from 'zod';

// ============================================================
// Validation Schemas
// ============================================================

const QueryParamsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  format: z.enum(['full', 'timeline']).default('full'),
  version: z.coerce.number().int().min(1).optional(),
});

// ============================================================
// Route Handlers
// ============================================================

/**
 * GET /api/history/[resourceType]/[resourceId]
 * 獲取資源的變更歷史
 *
 * @description
 *   返回指定資源的變更歷史記錄，支援分頁和時間線格式。
 *   如果指定 version 參數，則返回特定版本的快照。
 *
 * @param request - HTTP 請求
 * @param context - 路由參數
 * @returns 變更歷史或版本快照
 *
 * @example
 *   GET /api/history/mappingRule/rule-123
 *   GET /api/history/user/user-456?limit=10&offset=0
 *   GET /api/history/company/company-789?format=timeline
 *   GET /api/history/role/role-001?version=3
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ resourceType: string; resourceId: string }> }
) {
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

    // 2. 解析路由參數
    const params = await context.params;
    const { resourceType, resourceId } = params;

    // 3. 驗證資源類型
    if (!isTrackedModel(resourceType)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: `Invalid resource type: ${resourceType}`,
          },
        },
        { status: 400 }
      );
    }

    // 4. 解析查詢參數
    const { searchParams } = new URL(request.url);
    const queryParams = {
      limit: searchParams.get('limit') ?? undefined,
      offset: searchParams.get('offset') ?? undefined,
      format: searchParams.get('format') ?? undefined,
      version: searchParams.get('version') ?? undefined,
    };

    const validationResult = QueryParamsSchema.safeParse(queryParams);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: 'Invalid query parameters',
            errors: validationResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const { limit, offset, format, version } = validationResult.data;

    // 5. 如果指定了版本號，返回該版本的快照
    if (version !== undefined) {
      const snapshot = await changeTrackingService.getVersionSnapshot(
        resourceType as TrackedModel,
        resourceId,
        version
      );

      if (!snapshot) {
        return NextResponse.json(
          {
            success: false,
            error: {
              type: 'https://api.example.com/errors/not-found',
              title: 'Not Found',
              status: 404,
              detail: `Version ${version} not found for ${resourceType}/${resourceId}`,
            },
          },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: snapshot,
      });
    }

    // 6. 根據格式返回歷史記錄
    if (format === 'timeline') {
      const timeline = await changeTrackingService.getTimeline(
        resourceType as TrackedModel,
        resourceId,
        limit
      );

      return NextResponse.json({
        success: true,
        data: timeline,
        meta: {
          resourceType,
          resourceId,
          format: 'timeline',
        },
      });
    }

    // 7. 返回完整歷史記錄
    const result = await changeTrackingService.getHistory({
      resourceType: resourceType as TrackedModel,
      resourceId,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      data: result.data,
      meta: {
        resourceType,
        resourceId,
        pagination: result.pagination,
      },
    });
  } catch (error) {
    console.error('Get change history error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'https://api.example.com/errors/internal-server-error',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Failed to fetch change history',
        },
      },
      { status: 500 }
    );
  }
}
