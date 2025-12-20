/**
 * @fileoverview n8n 文件提交 API
 * @description
 *   處理來自 n8n 工作流的文件提交請求。
 *
 *   ## 端點
 *   POST /api/n8n/documents
 *
 *   ## 認證
 *   需要有效的 n8n API Key，且具備 documents:write 權限。
 *   支援以下認證方式：
 *   - Authorization: Bearer <api_key>
 *   - X-API-Key: <api_key>
 *
 *   ## 請求格式
 *   ```json
 *   {
 *     "fileName": "invoice.pdf",
 *     "fileContent": "base64-encoded-content",
 *     "mimeType": "application/pdf",
 *     "fileSize": 1024000,
 *     "cityCode": "TW",
 *     "forwarderCode": "FWD001",
 *     "workflowId": "workflow-123",
 *     "callbackUrl": "https://n8n.example.com/webhook/callback"
 *   }
 *   ```
 *
 * @module src/app/api/n8n/documents/route
 * @author Development Team
 * @since Epic 10 - Story 10.1
 * @lastModified 2025-12-20
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { n8nDocumentService } from '@/services/n8n';
import {
  n8nApiMiddleware,
  createErrorResponse,
} from '@/lib/middleware/n8n-api.middleware';

// ============================================================
// Validation Schema
// ============================================================

/**
 * 文件提交請求驗證 Schema
 */
const submitDocumentSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileContent: z.string().min(1), // Base64
  mimeType: z.string().min(1),
  fileSize: z.number().positive().max(50 * 1024 * 1024), // 50MB max
  workflowId: z.string().optional(),
  workflowName: z.string().optional(),
  workflowExecutionId: z.string().optional(),
  triggerSource: z.enum(['sharepoint', 'outlook', 'manual', 'api']).optional(),
  cityCode: z.string().min(1),
  forwarderCode: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  callbackUrl: z.string().url().optional(),
  correlationId: z.string().optional(),
});

// ============================================================
// Route Handler
// ============================================================

/**
 * POST /api/n8n/documents
 *
 * @description 提交文件至系統處理
 */
export async function POST(request: NextRequest) {
  // 驗證 API Key
  const authResult = await n8nApiMiddleware(request, 'documents:write');

  if (!authResult.authorized) {
    return NextResponse.json(createErrorResponse(authResult), {
      status: authResult.statusCode,
    });
  }

  try {
    const body = await request.json();
    const validatedData = submitDocumentSchema.parse(body);

    // 驗證城市權限
    if (validatedData.cityCode !== authResult.apiKey!.cityCode) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CITY_MISMATCH',
            message: 'API key is not authorized for this city',
          },
          traceId: authResult.traceId,
          timestamp: new Date().toISOString(),
        },
        { status: 403 }
      );
    }

    const result = await n8nDocumentService.submitDocument(
      validatedData,
      authResult.apiKey!.id,
      authResult.traceId
    );

    return NextResponse.json(result, {
      status: result.success ? 201 : 400,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: error.issues,
          },
          traceId: authResult.traceId,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    console.error('Document submission error:', error);
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
