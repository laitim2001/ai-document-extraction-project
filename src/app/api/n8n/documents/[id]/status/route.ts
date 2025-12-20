/**
 * @fileoverview n8n 文件狀態查詢 API
 * @description
 *   查詢文件的處理狀態，包含進度和預估完成時間。
 *
 *   ## 端點
 *   GET /api/n8n/documents/[id]/status
 *
 *   ## 認證
 *   需要有效的 n8n API Key，且具備 documents:read 權限。
 *
 *   ## 響應格式
 *   ```json
 *   {
 *     "success": true,
 *     "data": {
 *       "documentId": "doc-123",
 *       "status": "PROCESSING",
 *       "processingStage": "OCR_PROCESSING",
 *       "progress": 30,
 *       "estimatedCompletionTime": "2025-01-01T00:05:00.000Z",
 *       "createdAt": "2025-01-01T00:00:00.000Z",
 *       "updatedAt": "2025-01-01T00:02:00.000Z"
 *     },
 *     "traceId": "n8n_xxx_xxx",
 *     "timestamp": "2025-01-01T00:02:30.000Z"
 *   }
 *   ```
 *
 * @module src/app/api/n8n/documents/[id]/status/route
 * @author Development Team
 * @since Epic 10 - Story 10.1
 * @lastModified 2025-12-20
 */

import { NextRequest, NextResponse } from 'next/server';
import { n8nDocumentService } from '@/services/n8n';
import {
  n8nApiMiddleware,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/middleware/n8n-api.middleware';

// ============================================================
// Route Handler
// ============================================================

/**
 * GET /api/n8n/documents/[id]/status
 *
 * @description 查詢文件處理狀態
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await n8nApiMiddleware(request, 'documents:read');

  if (!authResult.authorized) {
    return NextResponse.json(createErrorResponse(authResult), {
      status: authResult.statusCode,
    });
  }

  try {
    const { id } = await params;
    const status = await n8nDocumentService.getDocumentStatus(
      id,
      authResult.apiKey!.cityCode
    );

    if (!status) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Document not found',
          },
          traceId: authResult.traceId,
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    return NextResponse.json(createSuccessResponse(status, authResult.traceId));
  } catch (error) {
    console.error('Get document status error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
        traceId: authResult.traceId,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
