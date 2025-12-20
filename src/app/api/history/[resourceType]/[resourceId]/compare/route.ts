/**
 * @fileoverview 版本比較 API 端點
 * @description
 *   提供資源版本之間的比較功能。
 *   需要認證才能存取。
 *
 *   端點：
 *   - GET /api/history/[resourceType]/[resourceId]/compare - 比較兩個版本
 *
 *   查詢參數：
 *   - fromVersion: 起始版本號（必填）
 *   - toVersion: 目標版本號（必填）
 *
 * @module src/app/api/history/[resourceType]/[resourceId]/compare/route
 * @author Development Team
 * @since Epic 8 - Story 8.2 (數據變更追蹤)
 * @lastModified 2025-12-20
 *
 * @features
 *   - 版本差異計算
 *   - 欄位級別變更追蹤
 *   - 快照對比
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
  fromVersion: z.coerce.number().int().min(1),
  toVersion: z.coerce.number().int().min(1),
});

// ============================================================
// Route Handlers
// ============================================================

/**
 * GET /api/history/[resourceType]/[resourceId]/compare
 * 比較兩個版本之間的差異
 *
 * @description
 *   返回兩個版本之間的欄位級別差異，包含：
 *   - 新增的欄位
 *   - 刪除的欄位
 *   - 修改的欄位及其前後值
 *
 * @param request - HTTP 請求
 * @param context - 路由參數
 * @returns 版本比較結果
 *
 * @example
 *   GET /api/history/mappingRule/rule-123/compare?fromVersion=1&toVersion=3
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
      fromVersion: searchParams.get('fromVersion'),
      toVersion: searchParams.get('toVersion'),
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
            detail: 'Both fromVersion and toVersion are required',
            errors: validationResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const { fromVersion, toVersion } = validationResult.data;

    // 5. 驗證版本順序
    if (fromVersion === toVersion) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: 'fromVersion and toVersion must be different',
          },
        },
        { status: 400 }
      );
    }

    // 6. 執行版本比較
    const result = await changeTrackingService.compareVersions(
      resourceType as TrackedModel,
      resourceId,
      fromVersion,
      toVersion
    );

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/not-found',
            title: 'Not Found',
            status: 404,
            detail: `One or both versions not found for ${resourceType}/${resourceId}`,
          },
        },
        { status: 404 }
      );
    }

    // 7. 返回比較結果
    return NextResponse.json({
      success: true,
      data: result,
      meta: {
        resourceType,
        resourceId,
        fromVersion,
        toVersion,
        changedFieldCount: result.diffs.length,
      },
    });
  } catch (error) {
    console.error('Compare versions error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'https://api.example.com/errors/internal-server-error',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Failed to compare versions',
        },
      },
      { status: 500 }
    );
  }
}
