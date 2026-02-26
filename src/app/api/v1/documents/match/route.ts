/**
 * @fileoverview 文件批量匹配 API
 * @description
 *   POST /api/v1/documents/match
 *   將多個文件批量匹配到指定的模版實例
 *
 * @module src/app/api/v1/documents/match
 * @since Epic 19 - Story 19.7
 * @lastModified 2026-01-23
 *
 * @features
 *   - 批量匹配（最多 500 個文件）
 *   - 進度追蹤
 *   - 統計結果返回
 *
 * @dependencies
 *   - auto-template-matching.service.ts - 自動匹配服務
 *   - template-matching.ts - 驗證 Schema
 */

import { NextRequest, NextResponse } from 'next/server';
import { autoTemplateMatchingService } from '@/services/auto-template-matching.service';
import { batchMatchDocumentsRequestSchema } from '@/validations/template-matching';

// ============================================================================
// POST - Batch Match Documents to Template
// ============================================================================

/**
 * 批量匹配文件到模版
 *
 * @description
 *   將多個文件同時匹配到同一模版實例
 *   支援最多 500 個文件的批量處理
 *
 * @param request - HTTP 請求
 * @returns 批量匹配結果
 *
 * @example
 * POST /api/v1/documents/match
 * {
 *   "documentIds": ["doc1", "doc2", "doc3"],
 *   "templateInstanceId": "inst1",
 *   "options": {
 *     "batchSize": 50
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 解析請求體
    const body = await request.json();

    // 2. 驗證輸入
    const validationResult = batchMatchDocumentsRequestSchema.safeParse(body);

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

    const { documentIds, templateInstanceId, options } = validationResult.data;

    // 3. 執行批量匹配
    const result = await autoTemplateMatchingService.batchMatch({
      documentIds,
      templateInstanceId,
      options,
    });

    // 4. 返回結果
    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    // 通用錯誤處理
    console.error('[Batch Match Documents Error]', error);

    const status = error instanceof Error && error.message.includes('模版實例不存在')
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
          instance: '/api/v1/documents/match',
        },
      },
      { status }
    );
  }
}
