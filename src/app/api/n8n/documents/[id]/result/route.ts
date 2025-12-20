/**
 * @fileoverview n8n 文件結果查詢 API
 * @description
 *   獲取文件的處理結果，包含提取的數據和信心度。
 *
 *   ## 端點
 *   GET /api/n8n/documents/[id]/result
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
 *       "status": "COMPLETED",
 *       "extractedData": { ... },
 *       "confidenceScore": 95.5,
 *       "forwarderCode": "FWD001",
 *       "forwarderName": "Example Forwarder",
 *       "reviewStatus": "APPROVED",
 *       "processingDuration": 45000,
 *       "completedAt": "2025-01-01T00:05:00.000Z"
 *     },
 *     "traceId": "n8n_xxx_xxx",
 *     "timestamp": "2025-01-01T00:06:00.000Z"
 *   }
 *   ```
 *
 * @module src/app/api/n8n/documents/[id]/result/route
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
 * GET /api/n8n/documents/[id]/result
 *
 * @description 獲取文件處理結果
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
    const result = await n8nDocumentService.getDocumentResult(
      id,
      authResult.apiKey!.cityCode
    );

    if (!result) {
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

    return NextResponse.json(createSuccessResponse(result, authResult.traceId));
  } catch (error) {
    console.error('Get document result error:', error);
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
