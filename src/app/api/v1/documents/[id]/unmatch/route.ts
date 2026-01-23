/**
 * @fileoverview 取消文件匹配 API
 * @description
 *   POST /api/v1/documents/:id/unmatch
 *   取消文件與模版實例的關聯
 *
 * @module src/app/api/v1/documents/[id]/unmatch
 * @since Epic 19 - Story 19.7
 * @lastModified 2026-01-23
 *
 * @features
 *   - 取消單一文件匹配
 *   - 清除 Document.templateInstanceId
 *   - 返回之前的匹配資訊
 *
 * @dependencies
 *   - auto-template-matching.service.ts - 自動匹配服務
 */

import { NextRequest, NextResponse } from 'next/server';
import { autoTemplateMatchingService } from '@/services/auto-template-matching.service';

// ============================================================================
// Types
// ============================================================================

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ============================================================================
// POST - Unmatch Document from Template
// ============================================================================

/**
 * 取消文件匹配
 *
 * @description
 *   移除文件與模版實例的關聯
 *   清除 Document.templateInstanceId 和 templateMatchedAt
 *   不會刪除 TemplateInstanceRow 中的數據
 *
 * @param request - HTTP 請求
 * @param params - 路由參數（包含文件 ID）
 * @returns 取消匹配結果
 *
 * @example
 * POST /api/v1/documents/doc123/unmatch
 * {}
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: documentId } = await params;

    // 執行取消匹配
    const result = await autoTemplateMatchingService.unmatch({
      documentId,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/not-found',
            title: 'Not Found',
            status: 404,
            detail: result.error || '文件不存在',
            instance: `/api/v1/documents/${documentId}/unmatch`,
          },
        },
        { status: 404 }
      );
    }

    // 返回結果
    return NextResponse.json({
      success: true,
      data: {
        documentId,
        previousInstanceId: result.previousInstanceId,
        message: result.previousInstanceId
          ? '已取消匹配'
          : '文件原本就未匹配到任何模版',
      },
    });
  } catch (error) {
    // 通用錯誤處理
    console.error('[Unmatch Document Error]', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'https://api.example.com/errors/internal',
          title: 'Internal Server Error',
          status: 500,
          detail: error instanceof Error ? error.message : 'An unexpected error occurred',
          instance: `/api/v1/documents/${(await params).id}/unmatch`,
        },
      },
      { status: 500 }
    );
  }
}
