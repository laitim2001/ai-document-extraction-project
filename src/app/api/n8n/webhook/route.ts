/**
 * @fileoverview n8n Webhook 接收 API
 * @description
 *   接收來自 n8n 工作流的 Webhook 事件通知。
 *
 *   ## 端點
 *   POST /api/n8n/webhook
 *
 *   ## 認證
 *   需要有效的 n8n API Key，且具備 webhook:receive 權限。
 *
 *   ## 支援的事件類型
 *   - workflow.started：工作流啟動
 *   - workflow.completed：工作流完成
 *   - workflow.failed：工作流失敗
 *   - workflow.progress：工作流進度更新
 *   - document.status_changed：文件狀態變更
 *
 *   ## 請求格式
 *   ```json
 *   {
 *     "event": "workflow.completed",
 *     "workflowExecutionId": "exec-123",
 *     "documentId": "doc-456",
 *     "data": {
 *       "status": "success",
 *       "result": { ... }
 *     },
 *     "timestamp": "2025-01-01T00:00:00.000Z"
 *   }
 *   ```
 *
 * @module src/app/api/n8n/webhook/route
 * @author Development Team
 * @since Epic 10 - Story 10.1
 * @lastModified 2025-12-20
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  n8nApiMiddleware,
  createErrorResponse,
} from '@/lib/middleware/n8n-api.middleware';
import { WorkflowTriggerType, DocumentStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';

// ============================================================
// Validation Schema
// ============================================================

/**
 * Webhook 事件請求驗證 Schema
 */
const webhookEventSchema = z.object({
  event: z.enum([
    'workflow.started',
    'workflow.completed',
    'workflow.failed',
    'workflow.progress',
    'document.status_changed',
  ]),
  workflowExecutionId: z.string().optional(),
  documentId: z.string().optional(),
  data: z.record(z.string(), z.unknown()),
  timestamp: z.string().datetime(),
});

type WebhookEventData = z.infer<typeof webhookEventSchema>;

// ============================================================
// Route Handler
// ============================================================

/**
 * POST /api/n8n/webhook
 *
 * @description 接收 n8n Webhook 事件
 */
export async function POST(request: NextRequest) {
  const authResult = await n8nApiMiddleware(request, 'webhook:receive');

  if (!authResult.authorized) {
    return NextResponse.json(createErrorResponse(authResult), {
      status: authResult.statusCode,
    });
  }

  try {
    const body = await request.json();
    const validatedData = webhookEventSchema.parse(body);

    // 記錄接收的 Webhook 事件
    await prisma.n8nIncomingWebhook.create({
      data: {
        apiKeyId: authResult.apiKey!.id,
        eventType: validatedData.event,
        workflowExecutionId: validatedData.workflowExecutionId ?? null,
        documentId: validatedData.documentId ?? null,
        payload: validatedData.data as Prisma.JsonObject,
        headers: Object.fromEntries(request.headers.entries()) as Prisma.JsonObject,
        traceId: authResult.traceId,
        ipAddress: request.headers.get('x-forwarded-for') ?? 'unknown',
        receivedAt: new Date(validatedData.timestamp),
      },
    });

    // 根據事件類型處理
    await processWebhookEvent(validatedData);

    return NextResponse.json({
      success: true,
      message: 'Webhook received and processed',
      traceId: authResult.traceId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid webhook payload',
            details: error.issues,
          },
          traceId: authResult.traceId,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    console.error('Webhook processing error:', error);
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

// ============================================================
// Event Handlers
// ============================================================

/**
 * 處理 Webhook 事件
 *
 * @param data - 驗證後的事件數據
 */
async function processWebhookEvent(data: WebhookEventData): Promise<void> {
  switch (data.event) {
    case 'workflow.started':
      await handleWorkflowStarted(data);
      break;
    case 'workflow.completed':
      await handleWorkflowCompleted(data);
      break;
    case 'workflow.failed':
      await handleWorkflowFailed(data);
      break;
    case 'workflow.progress':
      await handleWorkflowProgress(data);
      break;
    case 'document.status_changed':
      await handleDocumentStatusChanged(data);
      break;
  }
}

/**
 * 處理工作流啟動事件
 */
async function handleWorkflowStarted(data: WebhookEventData): Promise<void> {
  if (data.workflowExecutionId) {
    const eventData = data.data as Record<string, unknown>;
    await prisma.workflowExecution.upsert({
      where: { n8nExecutionId: data.workflowExecutionId },
      update: {
        status: 'RUNNING',
        startedAt: new Date(data.timestamp),
        currentStep: eventData.currentStep as string | undefined,
      },
      create: {
        n8nExecutionId: data.workflowExecutionId,
        workflowId: (eventData.workflowId as string) ?? 'unknown',
        workflowName: (eventData.workflowName as string) ?? 'Unknown Workflow',
        status: 'RUNNING',
        startedAt: new Date(data.timestamp),
        triggerType: parseTriggerType(eventData.triggerType as string | undefined),
        cityCode: (eventData.cityCode as string) ?? 'DEFAULT',
      },
    });
  }
}

/**
 * 處理工作流完成事件
 */
async function handleWorkflowCompleted(data: WebhookEventData): Promise<void> {
  if (data.workflowExecutionId) {
    await prisma.workflowExecution.updateMany({
      where: { n8nExecutionId: data.workflowExecutionId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(data.timestamp),
        progress: 100,
        result: data.data as Prisma.JsonObject,
      },
    });
  }
}

/**
 * 處理工作流失敗事件
 */
async function handleWorkflowFailed(data: WebhookEventData): Promise<void> {
  if (data.workflowExecutionId) {
    await prisma.workflowExecution.updateMany({
      where: { n8nExecutionId: data.workflowExecutionId },
      data: {
        status: 'FAILED',
        completedAt: new Date(data.timestamp),
        errorDetails: data.data as Prisma.JsonObject,
      },
    });
  }
}

/**
 * 處理工作流進度事件
 */
async function handleWorkflowProgress(data: WebhookEventData): Promise<void> {
  if (data.workflowExecutionId) {
    const eventData = data.data as Record<string, unknown>;
    await prisma.workflowExecution.updateMany({
      where: { n8nExecutionId: data.workflowExecutionId },
      data: {
        progress: (eventData.progress as number) ?? 0,
        currentStep: eventData.currentStep as string | undefined,
      },
    });
  }
}

/**
 * 處理文件狀態變更事件
 */
async function handleDocumentStatusChanged(data: WebhookEventData): Promise<void> {
  const eventData = data.data as Record<string, unknown>;
  if (data.documentId && eventData.status) {
    const parsedStatus = parseDocumentStatus(eventData.status as string);
    if (parsedStatus) {
      await prisma.document.updateMany({
        where: { id: data.documentId },
        data: {
          status: parsedStatus,
        },
      });
    }
  }
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 解析觸發類型字串為枚舉值
 */
function parseTriggerType(value: string | undefined): WorkflowTriggerType {
  const validTypes: Record<string, WorkflowTriggerType> = {
    WEBHOOK: WorkflowTriggerType.WEBHOOK,
    SCHEDULE: WorkflowTriggerType.SCHEDULE,
    MANUAL: WorkflowTriggerType.MANUAL,
    API: WorkflowTriggerType.API,
    EVENT: WorkflowTriggerType.EVENT,
  };

  const upperValue = value?.toUpperCase() ?? 'WEBHOOK';
  return validTypes[upperValue] ?? WorkflowTriggerType.WEBHOOK;
}

/**
 * 解析文件狀態字串為枚舉值
 */
function parseDocumentStatus(value: string): DocumentStatus | null {
  const validStatuses: Record<string, DocumentStatus> = {
    UPLOADING: DocumentStatus.UPLOADING,
    UPLOADED: DocumentStatus.UPLOADED,
    OCR_PROCESSING: DocumentStatus.OCR_PROCESSING,
    OCR_COMPLETED: DocumentStatus.OCR_COMPLETED,
    OCR_FAILED: DocumentStatus.OCR_FAILED,
    MAPPING_PROCESSING: DocumentStatus.MAPPING_PROCESSING,
    MAPPING_COMPLETED: DocumentStatus.MAPPING_COMPLETED,
    PENDING_REVIEW: DocumentStatus.PENDING_REVIEW,
    IN_REVIEW: DocumentStatus.IN_REVIEW,
    APPROVED: DocumentStatus.APPROVED,
    ESCALATED: DocumentStatus.ESCALATED,
    COMPLETED: DocumentStatus.COMPLETED,
    FAILED: DocumentStatus.FAILED,
  };

  const upperValue = value?.toUpperCase();
  return validStatuses[upperValue] ?? null;
}
