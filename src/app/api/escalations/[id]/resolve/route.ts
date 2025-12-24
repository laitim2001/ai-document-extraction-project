/**
 * @fileoverview 升級案例處理完成 API 端點
 * @description
 *   提供 Super User 處理升級案例的功能：
 *   - 核准 (APPROVED)：確認提取結果正確
 *   - 修正 (CORRECTED)：修正錯誤後核准
 *   - 拒絕 (REJECTED)：文件無法處理
 *   - 可選創建規則建議（連接 Epic 4）
 *   - 更新相關狀態和記錄
 *   - 記錄審計日誌
 *
 *   端點：
 *   - POST /api/escalations/[id]/resolve - 處理升級案例
 *
 * @module src/app/api/escalations/[id]/resolve/route
 * @since Epic 3 - Story 3.8 (Super User 處理升級案例)
 * @lastModified 2025-12-22
 * @refactor REFACTOR-001 (Forwarder → Company)
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/lib/prisma - Prisma 客戶端
 *   - @/lib/audit - 審計日誌
 *   - @/types/permissions - 權限常量
 *   - zod - 輸入驗證
 *
 * @related
 *   - src/hooks/useResolveEscalation.ts - React Query Hook
 *   - src/components/features/escalation/ResolveDialog.tsx - 處理對話框
 *   - src/types/escalation.ts - 類型定義
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logReviewCompleted } from '@/lib/audit'
import { PERMISSIONS } from '@/types/permissions'
import { z } from 'zod'
import { DocumentStatus, ReviewAction, ProcessingPath, type Correction } from '@prisma/client'
import type { ResolveDecision } from '@/types/escalation'

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
 * 修正項目 Schema
 */
const CorrectionItemSchema = z.object({
  fieldName: z.string().min(1, 'Field name is required'),
  originalValue: z.string().nullable(),
  correctedValue: z.string().min(1, 'Corrected value is required'),
  correctionType: z.enum(['NORMAL', 'EXCEPTION']),
})

/**
 * 規則建議創建 Schema
 */
const CreateRuleSchema = z.object({
  fieldName: z.string().min(1, 'Field name is required'),
  suggestedPattern: z.string().min(1, 'Pattern is required'),
  description: z.string().optional(),
})

/**
 * 處理請求 Schema
 */
const ResolveRequestSchema = z.object({
  decision: z.enum(['APPROVED', 'CORRECTED', 'REJECTED']),
  corrections: z.array(CorrectionItemSchema).optional(),
  notes: z.string().max(2000).optional(),
  createRule: CreateRuleSchema.optional(),
})

// ============================================================
// Helper Functions
// ============================================================

/**
 * 檢查用戶是否為 Super User
 *
 * @note 支援 wildcard ('*') 權限，開發模式下用戶擁有所有權限
 */
function isSuperUser(
  roles: { permissions: string[] }[] | undefined
): boolean {
  if (!roles) return false
  return roles.some((r) =>
    r.permissions.includes('*') || r.permissions.includes(PERMISSIONS.RULE_MANAGE)
  )
}

/**
 * 根據決策獲取文件狀態
 */
function getDocumentStatus(decision: ResolveDecision): DocumentStatus {
  switch (decision) {
    case 'APPROVED':
      return DocumentStatus.APPROVED
    case 'CORRECTED':
      return DocumentStatus.APPROVED
    case 'REJECTED':
      return DocumentStatus.FAILED
  }
}

// ============================================================
// POST /api/escalations/[id]/resolve
// ============================================================

/**
 * POST /api/escalations/[id]/resolve
 * 處理升級案例
 *
 * @description
 *   使用 Prisma 交易確保原子性操作：
 *   1. 更新 Escalation 狀態為 RESOLVED
 *   2. 更新 Document 狀態
 *   3. 創建修正記錄（如有）
 *   4. 創建 ReviewRecord
 *   5. 可選創建 RuleSuggestion
 *   6. 記錄審計日誌
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

    // 權限檢查：僅 Super User 可處理
    if (!isSuperUser(session.user.roles)) {
      return NextResponse.json(
        {
          type: 'forbidden',
          title: 'Forbidden',
          status: 403,
          detail: 'Super User permission required to resolve escalations',
        },
        { status: 403 }
      )
    }

    const { id: escalationId } = await params
    const userId = session.user.id

    // 解析並驗證請求體
    const rawBody = await request.json()
    const validation = ResolveRequestSchema.safeParse(rawBody)

    if (!validation.success) {
      return NextResponse.json(
        {
          type: 'validation_error',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid request body',
          instance: `/api/escalations/${escalationId}/resolve`,
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const { decision, corrections, notes, createRule } = validation.data

    // 決策為 CORRECTED 時必須提供修正項目
    if (decision === 'CORRECTED' && (!corrections || corrections.length === 0)) {
      return NextResponse.json(
        {
          type: 'validation_error',
          title: 'Validation Error',
          status: 400,
          detail: 'Corrections are required when decision is CORRECTED',
          instance: `/api/escalations/${escalationId}/resolve`,
        },
        { status: 400 }
      )
    }

    // 獲取升級案例
    const escalation = await prisma.escalation.findUnique({
      where: { id: escalationId },
      include: {
        document: {
          include: {
            company: true,
            extractionResult: {
              select: { totalFields: true },
            },
          },
        },
      },
    })

    if (!escalation) {
      return NextResponse.json(
        {
          type: 'not_found',
          title: 'Not Found',
          status: 404,
          detail: `Escalation with ID ${escalationId} not found`,
          instance: `/api/escalations/${escalationId}/resolve`,
        },
        { status: 404 }
      )
    }

    // 檢查狀態是否可處理
    if (escalation.status === 'RESOLVED' || escalation.status === 'CANCELLED') {
      return NextResponse.json(
        {
          type: 'conflict',
          title: 'Conflict',
          status: 409,
          detail: `Escalation is already ${escalation.status.toLowerCase()}`,
          instance: `/api/escalations/${escalationId}/resolve`,
        },
        { status: 409 }
      )
    }

    // 執行交易
    const result = await prisma.$transaction(async (tx) => {
      // 1. 更新 Escalation 狀態
      const updatedEscalation = await tx.escalation.update({
        where: { id: escalationId },
        data: {
          status: 'RESOLVED',
          resolution: notes || `${decision} by Super User`,
          resolvedBy: userId,
          resolvedAt: new Date(),
        },
      })

      // 2. 更新 Document 狀態
      const documentStatus = getDocumentStatus(decision)
      const updatedDocument = await tx.document.update({
        where: { id: escalation.documentId },
        data: { status: documentStatus },
      })

      // 3. 創建修正記錄（如有）
      let createdCorrections: Correction[] = []
      if (corrections && corrections.length > 0) {
        createdCorrections = await Promise.all(
          corrections.map((correction) =>
            tx.correction.create({
              data: {
                documentId: escalation.documentId,
                fieldName: correction.fieldName,
                originalValue: correction.originalValue,
                correctedValue: correction.correctedValue,
                correctionType: correction.correctionType,
                correctedBy: userId,
              },
            })
          )
        )
      }

      // 4. 創建 ReviewRecord
      const reviewAction: ReviewAction =
        decision === 'REJECTED'
          ? ReviewAction.ESCALATED
          : decision === 'CORRECTED'
            ? ReviewAction.CORRECTED
            : ReviewAction.APPROVED

      const reviewRecord = await tx.reviewRecord.create({
        data: {
          documentId: escalation.documentId,
          reviewerId: userId,
          action: reviewAction,
          processingPath: ProcessingPath.MANUAL_REQUIRED,
          confirmedFields: [], // All fields reviewed in escalation
          modifiedFields: corrections
            ? Object.fromEntries(
                corrections.map((c) => [
                  c.fieldName,
                  { before: c.originalValue, after: c.correctedValue },
                ])
              )
            : undefined,
          notes: notes || `Escalation resolved: ${decision}`,
        },
      })

      // 5. 創建 RuleSuggestion（如有且有 Company）(REFACTOR-001)
      let ruleSuggestion = null
      if (createRule && escalation.document.companyId) {
        ruleSuggestion = await tx.ruleSuggestion.create({
          data: {
            companyId: escalation.document.companyId,
            fieldName: createRule.fieldName,
            extractionType: 'KEYWORD', // 預設使用 KEYWORD 類型
            suggestedPattern: createRule.suggestedPattern,
            reviewNotes: createRule.description,
            suggestedBy: userId,
            escalationId: escalationId,
            correctionCount: 1,
          },
        })
      }

      return {
        escalation: updatedEscalation,
        document: updatedDocument,
        corrections: createdCorrections,
        reviewRecord,
        ruleSuggestion,
      }
    })

    // 獲取客戶端 IP
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      'unknown'

    // 記錄審計日誌
    await logReviewCompleted(
      userId,
      escalation.documentId,
      {
        action: decision as 'APPROVED' | 'CORRECTED',
        fieldsReviewed: escalation.document.extractionResult?.totalFields || 0,
        fieldsModified: corrections?.length || 0,
      },
      ipAddress
    )

    // 返回成功響應
    return NextResponse.json({
      success: true,
      data: {
        escalationId: result.escalation.id,
        documentId: result.document.id,
        decision,
        resolvedAt: result.escalation.resolvedAt?.toISOString(),
        ruleSuggestionId: result.ruleSuggestion?.id,
      },
    })
  } catch (error) {
    console.error('Resolve escalation error:', error)

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
        detail: 'Failed to resolve escalation',
      },
      { status: 500 }
    )
  }
}
