/**
 * @fileoverview 單一文件匹配 API
 * @description
 *   POST /api/v1/documents/:id/match
 *   將單一文件匹配到指定的模版實例
 *
 * @module src/app/api/v1/documents/[id]/match
 * @since Epic 19 - Story 19.7
 * @lastModified 2026-01-23
 *
 * @features
 *   - 單一文件匹配
 *   - 匹配結果返回
 *   - 自動更新 Document.templateInstanceId
 *
 * @dependencies
 *   - auto-template-matching.service.ts - 自動匹配服務
 *   - template-matching.ts - 驗證 Schema
 */

import { NextRequest, NextResponse } from 'next/server';
import { autoTemplateMatchingService } from '@/services/auto-template-matching.service';
import { singleMatchDocumentRequestSchema } from '@/validations/template-matching';
import { MatchingEngineError } from '@/types/template-matching-engine';

// ============================================================================
// Types
// ============================================================================

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ============================================================================
// POST - Match Single Document to Template
// ============================================================================

/**
 * 單一文件匹配到模版
 *
 * @description
 *   將指定文件匹配到指定的模版實例
 *   自動更新 Document.templateInstanceId 和 templateMatchedAt
 *
 * @param request - HTTP 請求
 * @param params - 路由參數（包含文件 ID）
 * @returns 匹配結果
 *
 * @example
 * POST /api/v1/documents/doc123/match
 * {
 *   "templateInstanceId": "inst1"
 * }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: documentId } = await params;

    // 1. 解析請求體
    const body = await request.json();

    // 2. 驗證輸入
    const validationResult = singleMatchDocumentRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: 'One or more fields failed validation',
            errors: validationResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const { templateInstanceId } = validationResult.data;

    // 3. 執行匹配
    const result = await autoTemplateMatchingService.matchSingle({
      documentId,
      templateInstanceId,
    });

    // 4. 返回結果
    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    // 處理特定錯誤
    if (error instanceof MatchingEngineError) {
      const statusMap: Record<string, number> = {
        INSTANCE_NOT_FOUND: 404,
        TEMPLATE_NOT_FOUND: 404,
        DOCUMENT_NOT_FOUND: 404,
        MAPPING_NOT_FOUND: 404,
        INVALID_INSTANCE_STATUS: 400,
        TRANSFORM_FAILED: 500,
        VALIDATION_FAILED: 400,
      };

      const status = statusMap[error.code] || 500;

      return NextResponse.json(
        {
          success: false,
          error: {
            type: `https://api.example.com/errors/${error.code.toLowerCase()}`,
            title: error.code,
            status,
            detail: error.message,
            instance: `/api/v1/documents/${(await params).id}/match`,
            ...error.details,
          },
        },
        { status }
      );
    }

    // 通用錯誤處理
    console.error('[Single Match Document Error]', error);

    const status = error instanceof Error && error.message.includes('不存在')
      ? 404
      : 500;

    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'https://api.example.com/errors/internal',
          title: status === 404 ? 'Not Found' : 'Internal Server Error',
          status,
          detail: error instanceof Error ? error.message : 'An unexpected error occurred',
          instance: `/api/v1/documents/${(await params).id}/match`,
        },
      },
      { status }
    );
  }
}
