/**
 * @fileoverview 案例升級 API 端點
 * @description
 *   提供文件升級功能，用於將複雜案例升級給 Super User：
 *   - 更新文件狀態為 ESCALATED
 *   - 創建 Escalation 記錄
 *   - 更新處理隊列狀態
 *   - 通知 Super User
 *   - 記錄審計日誌
 *
 *   端點：
 *   - POST /api/review/[id]/escalate - 升級案例
 *
 * @module src/app/api/review/[id]/escalate/route
 * @since Epic 3 - Story 3.7 (升級複雜案例)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/lib/prisma - Prisma 客戶端
 *   - @/lib/audit - 審計日誌工具
 *   - @/services/notification.service - 通知服務
 *   - zod - 輸入驗證
 *
 * @related
 *   - src/hooks/useEscalateReview.ts - React Query Hook
 *   - src/components/features/review/EscalationDialog.tsx - 升級對話框
 *   - src/types/escalation.ts - 類型定義
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logDocumentEscalated, logReviewCompleted } from '@/lib/audit'
import { notifySuperUsers, NOTIFICATION_TYPES } from '@/services/notification.service'
import { REASONS_REQUIRING_DETAIL } from '@/types/escalation'
import { z } from 'zod'

// ============================================================
// Types
// ============================================================

interface RouteParams {
  params: Promise<{ id: string }>
}

// ============================================================
// Validation Schema
// ============================================================

/**
 * 升級請求 Schema
 */
const EscalateRequestSchema = z.object({
  /** 升級原因 */
  reason: z.enum([
    'UNKNOWN_FORWARDER',
    'RULE_NOT_APPLICABLE',
    'POOR_QUALITY',
    'OTHER',
  ]),
  /** 升級原因詳情 */
  reasonDetail: z.string().max(1000).optional(),
})

// ============================================================
// POST /api/review/[id]/escalate
// ============================================================

/**
 * POST /api/review/[id]/escalate
 * 升級案例給 Super User 處理
 *
 * @description
 *   使用 Prisma 交易確保原子性操作：
 *   1. 創建 Escalation 記錄
 *   2. 更新文件狀態為 ESCALATED
 *   3. 更新處理隊列狀態為 COMPLETED
 *   4. 通知 Super User
 *   5. 記錄審計日誌
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // 認證檢查
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          type: 'unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: 'Authentication required',
        },
        { status: 401 }
      )
    }

    const { id: documentId } = await params
    const userId = session.user.id

    // 解析並驗證請求體
    const rawBody = await request.json()
    const validation = EscalateRequestSchema.safeParse(rawBody)

    if (!validation.success) {
      return NextResponse.json(
        {
          type: 'validation_error',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid request body',
          instance: `/api/review/${documentId}/escalate`,
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const { reason, reasonDetail } = validation.data

    // 檢查需要詳情的原因是否提供了詳情
    if (REASONS_REQUIRING_DETAIL.includes(reason) && !reasonDetail?.trim()) {
      return NextResponse.json(
        {
          type: 'validation_error',
          title: 'Validation Error',
          status: 400,
          detail: `Reason detail is required for escalation reason: ${reason}`,
          instance: `/api/review/${documentId}/escalate`,
        },
        { status: 400 }
      )
    }

    // 獲取文件和相關資料
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        processingQueue: true,
        escalation: true,
        forwarder: { select: { name: true } },
        extractionResult: {
          select: { totalFields: true },
        },
      },
    })

    if (!document) {
      return NextResponse.json(
        {
          type: 'not_found',
          title: 'Not Found',
          status: 404,
          detail: `Document with ID ${documentId} not found`,
          instance: `/api/review/${documentId}/escalate`,
        },
        { status: 404 }
      )
    }

    // 檢查是否已升級
    if (document.escalation) {
      return NextResponse.json(
        {
          type: 'conflict',
          title: 'Conflict',
          status: 409,
          detail: 'Document has already been escalated',
          instance: `/api/review/${documentId}/escalate`,
        },
        { status: 409 }
      )
    }

    // 檢查文件狀態是否可以升級
    const allowedStatuses = ['PENDING_REVIEW', 'IN_REVIEW']
    if (!allowedStatuses.includes(document.status)) {
      return NextResponse.json(
        {
          type: 'invalid_state',
          title: 'Invalid Document State',
          status: 400,
          detail: `Document cannot be escalated in current state: ${document.status}`,
          instance: `/api/review/${documentId}/escalate`,
        },
        { status: 400 }
      )
    }

    // 執行交易：創建升級記錄、更新文件和隊列
    const result = await prisma.$transaction(async (tx) => {
      // 1. 創建升級記錄
      const escalation = await tx.escalation.create({
        data: {
          documentId,
          escalatedBy: userId,
          reason,
          reasonDetail: reasonDetail || null,
        },
      })

      // 2. 更新文件狀態
      const updatedDocument = await tx.document.update({
        where: { id: documentId },
        data: { status: 'ESCALATED' },
      })

      // 3. 更新處理隊列狀態（標記為完成，因為已升級處理）
      let updatedQueue = null
      if (document.processingQueue) {
        updatedQueue = await tx.processingQueue.update({
          where: { id: document.processingQueue.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            reviewNotes: `Escalated: ${reason}`,
            fieldsReviewed: document.extractionResult?.totalFields || 0,
          },
        })
      }

      return {
        escalation,
        document: updatedDocument,
        queue: updatedQueue,
      }
    })

    // 獲取升級原因的顯示標籤
    const reasonLabels: Record<string, string> = {
      UNKNOWN_FORWARDER: '無法識別 Forwarder',
      RULE_NOT_APPLICABLE: '映射規則不適用',
      POOR_QUALITY: '文件品質問題',
      OTHER: '其他',
    }

    // 4. 通知 Super User
    await notifySuperUsers({
      type: NOTIFICATION_TYPES.ESCALATION,
      title: '新的升級案例',
      message: `${document.fileName} 需要處理 - ${reasonLabels[reason]}`,
      data: {
        escalationId: result.escalation.id,
        documentId,
        reason,
        forwarderName: document.forwarder?.name || '未識別',
      },
    })

    // 獲取客戶端 IP（用於審計日誌）
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      'unknown'

    // 5. 記錄審計日誌（非阻斷式）
    await Promise.all([
      logDocumentEscalated(userId, documentId, reason, ipAddress),
      logReviewCompleted(
        userId,
        documentId,
        {
          action: 'ESCALATED',
          fieldsReviewed: document.extractionResult?.totalFields || 0,
        },
        ipAddress
      ),
    ])

    // 返回成功響應
    return NextResponse.json({
      success: true,
      data: {
        escalationId: result.escalation.id,
        documentId: result.document.id,
        status: result.escalation.status,
        escalatedAt: result.escalation.createdAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('Escalate review error:', error)

    // Zod 驗證錯誤
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          type: 'validation_error',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid request body',
          errors: error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        type: 'internal_error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to escalate document',
      },
      { status: 500 }
    )
  }
}
