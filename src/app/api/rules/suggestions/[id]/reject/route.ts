/**
 * @fileoverview 規則建議拒絕 API 端點
 * @description
 *   提供規則建議的拒絕功能，執行以下操作：
 *   - 驗證建議狀態為 PENDING
 *   - 更新建議狀態為 REJECTED
 *   - 記錄拒絕原因和詳細說明
 *   - 更新關聯的 CorrectionPattern 狀態為 IGNORED
 *
 * @module src/app/api/rules/suggestions/[id]/reject/route
 * @since Epic 4 - Story 4.6 (審核學習規則)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 權限檢查（RULE_APPROVE）
 *   - 拒絕原因分類
 *   - 必填詳細說明
 *   - 關聯 Pattern 狀態更新
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/lib/prisma - Prisma 客戶端
 *   - @/types/permissions - 權限常量
 *   - zod - 輸入驗證
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/types/permissions'

// ============================================================
// Validation Schemas
// ============================================================

/**
 * 拒絕請求驗證 Schema
 */
const rejectSchema = z.object({
  /** 拒絕原因分類 */
  reason: z.enum([
    'INSUFFICIENT_DATA',
    'POOR_ACCURACY',
    'HIGH_RISK',
    'DUPLICATE',
    'NOT_APPLICABLE',
    'OTHER',
  ]),
  /** 詳細說明（必填） */
  reasonDetail: z.string().min(1, 'Rejection detail is required'),
})

// ============================================================
// Helper Functions
// ============================================================

/**
 * 檢查用戶是否有規則批准權限
 *
 * @note 支援 wildcard ('*') 權限，開發模式下用戶擁有所有權限
 */
function hasRuleApprovePermission(roles: { permissions: string[] }[] | undefined): boolean {
  if (!roles) return false
  return roles.some((r) =>
    r.permissions.includes('*') || r.permissions.includes(PERMISSIONS.RULE_APPROVE)
  )
}

// ============================================================
// POST /api/rules/suggestions/[id]/reject
// ============================================================

/**
 * POST /api/rules/suggestions/[id]/reject
 * 拒絕規則建議
 *
 * @description
 *   拒絕規則建議並記錄原因：
 *   1. 驗證建議狀態為 PENDING
 *   2. 更新建議狀態為 REJECTED
 *   3. 記錄拒絕原因和詳細說明
 *   4. 更新關聯的 CorrectionPattern 狀態為 IGNORED
 *
 * @body RuleRejectRequest
 *   - reason: 拒絕原因分類（必填）
 *   - reasonDetail: 詳細說明（必填）
 *
 * @returns RuleRejectResponse
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: suggestionId } = await params

    // 1. 認證檢查
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'unauthorized',
            title: 'Unauthorized',
            status: 401,
            detail: 'Authentication required',
          },
        },
        { status: 401 }
      )
    }

    // 2. 權限檢查
    if (!hasRuleApprovePermission(session.user.roles)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'forbidden',
            title: 'Forbidden',
            status: 403,
            detail: 'RULE_APPROVE permission required',
          },
        },
        { status: 403 }
      )
    }

    // 3. 解析並驗證請求體
    const body = await request.json()
    const validation = rejectSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'validation_error',
            title: 'Validation Error',
            status: 400,
            detail: 'Invalid request body',
            errors: validation.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      )
    }

    const { reason, reasonDetail } = validation.data

    // 4. 執行事務
    await prisma.$transaction(async (tx) => {
      // 4.1 獲取建議
      const suggestion = await tx.ruleSuggestion.findUnique({
        where: { id: suggestionId },
      })

      if (!suggestion) {
        throw new Error('Suggestion not found')
      }

      if (suggestion.status !== 'PENDING') {
        throw new Error(`Suggestion is not pending (current status: ${suggestion.status})`)
      }

      // 4.2 更新建議狀態為 REJECTED
      await tx.ruleSuggestion.update({
        where: { id: suggestionId },
        data: {
          status: 'REJECTED',
          reviewedBy: session.user!.id,
          reviewedAt: new Date(),
          rejectionReason: `${reason}: ${reasonDetail}`,
        },
      })

      // 4.3 如果有關聯的 CorrectionPattern，更新其狀態為 IGNORED
      if (suggestion.patternId) {
        await tx.correctionPattern.update({
          where: { id: suggestion.patternId },
          data: {
            status: 'IGNORED',
            processedAt: new Date(),
          },
        })
      }
    })

    // 5. 返回成功響應
    return NextResponse.json({
      success: true,
      data: {
        suggestionId,
        status: 'REJECTED',
        message: 'Suggestion rejected',
      },
    })
  } catch (error) {
    console.error('Failed to reject suggestion:', error)

    const message = error instanceof Error ? error.message : 'Unknown error'
    const status = message.includes('not found')
      ? 404
      : message.includes('not pending')
        ? 400
        : 500

    return NextResponse.json(
      {
        success: false,
        error: {
          type:
            status === 404 ? 'not_found' : status === 400 ? 'bad_request' : 'internal_error',
          title:
            status === 404 ? 'Not Found' : status === 400 ? 'Bad Request' : 'Internal Server Error',
          status,
          detail: message,
        },
      },
      { status }
    )
  }
}
