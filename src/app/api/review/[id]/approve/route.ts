/**
 * @fileoverview 審核確認 API 端點
 * @description
 *   提供文件審核確認功能：
 *   - 更新文件狀態為 APPROVED
 *   - 更新處理隊列狀態為 COMPLETED
 *   - 建立 ReviewRecord 審核記錄
 *   - 記錄審計日誌（合規要求）
 *
 *   端點：
 *   - POST /api/review/[id]/approve - 確認審核結果
 *
 * @module src/app/api/review/[id]/approve/route
 * @author Development Team
 * @since Epic 3 - Story 3.4 (確認提取結果)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/lib/prisma - Prisma 客戶端
 *   - @/lib/audit - 審計日誌工具
 *   - zod - 輸入驗證
 *
 * @related
 *   - src/hooks/useApproveReview.ts - React Query Hook
 *   - src/app/(dashboard)/review/[id]/page.tsx - 審核詳情頁面
 *   - src/types/review.ts - 類型定義
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logDocumentApproved, logReviewCompleted } from '@/lib/audit'
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
 * 確認審核請求 Schema
 */
const ApproveRequestSchema = z.object({
  /** 確認的欄位名稱列表 */
  confirmedFields: z.array(z.string()).optional().default([]),
  /** 審核備註 */
  notes: z.string().max(1000).optional(),
  /** 審核開始時間（用於計算審核時長） */
  reviewStartedAt: z.string().datetime().optional(),
})

// ============================================================
// POST /api/review/[id]/approve
// ============================================================

/**
 * POST /api/review/[id]/approve
 * 確認審核結果（核准文件）
 *
 * @description
 *   使用 Prisma 交易確保原子性操作：
 *   1. 更新文件狀態為 APPROVED
 *   2. 更新處理隊列狀態為 COMPLETED
 *   3. 建立 ReviewRecord 審核記錄
 *   4. 記錄審計日誌
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
    let body: z.infer<typeof ApproveRequestSchema>
    try {
      const rawBody = await request.json()
      body = ApproveRequestSchema.parse(rawBody)
    } catch {
      // 允許空請求體
      body = { confirmedFields: [] }
    }

    const { confirmedFields, notes, reviewStartedAt } = body

    // 獲取文件和處理隊列
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        processingQueue: true,
        extractionResult: {
          select: {
            totalFields: true,
          },
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
          instance: `/api/review/${documentId}/approve`,
        },
        { status: 404 }
      )
    }

    // 檢查文件狀態是否可以核准
    const allowedStatuses = ['PENDING_REVIEW', 'IN_REVIEW']
    if (!allowedStatuses.includes(document.status)) {
      return NextResponse.json(
        {
          type: 'invalid_state',
          title: 'Invalid Document State',
          status: 400,
          detail: `Document cannot be approved in current state: ${document.status}`,
          instance: `/api/review/${documentId}/approve`,
        },
        { status: 400 }
      )
    }

    // 計算審核時長
    let reviewDuration: number | undefined
    if (reviewStartedAt) {
      const startTime = new Date(reviewStartedAt)
      const endTime = new Date()
      reviewDuration = Math.round((endTime.getTime() - startTime.getTime()) / 1000)
    }

    // 確定處理路徑
    const processingPath = document.processingQueue?.processingPath || 'FULL_REVIEW'

    // 執行交易：更新文件、隊列、建立審核記錄
    const result = await prisma.$transaction(async (tx) => {
      // 1. 更新文件狀態
      const updatedDocument = await tx.document.update({
        where: { id: documentId },
        data: { status: 'APPROVED' },
      })

      // 2. 更新處理隊列狀態
      let updatedQueue = null
      if (document.processingQueue) {
        updatedQueue = await tx.processingQueue.update({
          where: { id: document.processingQueue.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            fieldsReviewed: document.extractionResult?.totalFields || 0,
            fieldsModified: 0, // APPROVED 表示無修改
            reviewNotes: notes,
          },
        })
      }

      // 3. 建立審核記錄
      const reviewRecord = await tx.reviewRecord.create({
        data: {
          documentId,
          reviewerId: userId,
          action: 'APPROVED',
          processingPath: processingPath as 'AUTO_APPROVE' | 'QUICK_REVIEW' | 'FULL_REVIEW' | 'MANUAL_REQUIRED',
          confirmedFields: confirmedFields,
          // modifiedFields 省略表示 undefined，Prisma 會處理為 null
          notes: notes || undefined,
          reviewDuration: reviewDuration || undefined,
          startedAt: reviewStartedAt ? new Date(reviewStartedAt) : undefined,
          completedAt: new Date(),
        },
      })

      return {
        document: updatedDocument,
        queue: updatedQueue,
        reviewRecord,
      }
    })

    // 獲取客戶端 IP（用於審計日誌）
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      'unknown'

    // 記錄審計日誌（非阻斷式）
    await Promise.all([
      logDocumentApproved(userId, documentId, {
        processingPath,
        fieldsConfirmed: confirmedFields.length,
        reviewDuration,
      }, ipAddress),
      logReviewCompleted(userId, documentId, {
        action: 'APPROVED',
        duration: reviewDuration,
        fieldsReviewed: document.extractionResult?.totalFields || 0,
        fieldsModified: 0,
      }, ipAddress),
    ])

    // 返回成功響應
    return NextResponse.json({
      success: true,
      data: {
        documentId: result.document.id,
        status: result.document.status,
        reviewedBy: userId,
        reviewedAt: result.reviewRecord.completedAt.toISOString(),
        reviewRecordId: result.reviewRecord.id,
      },
    })
  } catch (error) {
    console.error('Approve review error:', error)

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
        detail: 'Failed to approve document',
      },
      { status: 500 }
    )
  }
}
