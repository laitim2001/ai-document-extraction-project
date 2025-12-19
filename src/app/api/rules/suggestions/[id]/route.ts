/**
 * @fileoverview 規則建議詳情 API 端點
 * @description
 *   提供單一建議的詳情查詢和狀態更新功能：
 *   - GET /api/rules/suggestions/[id] - 獲取建議詳情
 *   - PATCH /api/rules/suggestions/[id] - 更新建議狀態
 *
 * @module src/app/api/rules/suggestions/[id]/route
 * @since Epic 4 - Story 4.4 (規則升級建議生成)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 建議詳情查詢（含樣本案例、影響分析）
 *   - 建議狀態更新（審批/拒絕）
 *   - 實施規則（將建議轉為正式規則）
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
import type { SuggestionStatus } from '@prisma/client'

// ============================================================
// Helper Functions
// ============================================================

/**
 * 檢查用戶是否有規則查看權限
 */
function hasRuleViewPermission(roles: { permissions: string[] }[] | undefined): boolean {
  if (!roles) return false
  return roles.some((r) => r.permissions.includes(PERMISSIONS.RULE_VIEW))
}

/**
 * 檢查用戶是否有規則管理權限
 */
function hasRuleManagePermission(roles: { permissions: string[] }[] | undefined): boolean {
  if (!roles) return false
  return roles.some((r) => r.permissions.includes(PERMISSIONS.RULE_MANAGE))
}

// ============================================================
// Validation Schemas
// ============================================================

/**
 * 更新建議狀態請求驗證 Schema
 */
const updateSuggestionSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'IMPLEMENTED']).optional(),
  reviewNotes: z.string().optional(),
  implementRule: z.boolean().optional(),
})

// ============================================================
// GET /api/rules/suggestions/[id]
// ============================================================

/**
 * GET /api/rules/suggestions/[id]
 * 獲取規則建議詳情
 *
 * @description
 *   返回建議的完整資訊，包括：
 *   - 基本資訊（欄位、類型、狀態）
 *   - 現有規則與建議規則對比
 *   - 樣本案例（最多 5 個）
 *   - 預期影響分析
 *   - 審核歷史
 *
 * @returns 建議詳情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // 認證檢查
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

    // 權限檢查
    if (!hasRuleViewPermission(session.user.roles)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'forbidden',
            title: 'Forbidden',
            status: 403,
            detail: 'RULE_VIEW permission required',
          },
        },
        { status: 403 }
      )
    }

    // 查詢建議詳情
    const suggestion = await prisma.ruleSuggestion.findUnique({
      where: { id },
      include: {
        forwarder: {
          select: { id: true, name: true, code: true },
        },
        suggester: {
          select: { id: true, name: true, email: true },
        },
        reviewer: {
          select: { id: true, name: true, email: true },
        },
        sampleCases: {
          include: {
            document: {
              select: { id: true, fileName: true },
            },
          },
          take: 5,
        },
        pattern: {
          select: {
            id: true,
            occurrenceCount: true,
            lastSeenAt: true,
          },
        },
      },
    })

    if (!suggestion) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'not_found',
            title: 'Not Found',
            status: 404,
            detail: `Suggestion ${id} not found`,
          },
        },
        { status: 404 }
      )
    }

    // 獲取現有規則
    const existingRule = await prisma.mappingRule.findFirst({
      where: {
        forwarderId: suggestion.forwarderId,
        fieldName: suggestion.fieldName,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        extractionPattern: true,
        confidence: true,
        updatedAt: true,
      },
    })

    // 格式化響應
    const response = {
      id: suggestion.id,
      forwarder: suggestion.forwarder,
      fieldName: suggestion.fieldName,
      extractionType: suggestion.extractionType,
      source: suggestion.source,
      status: suggestion.status,
      priority: suggestion.priority,
      confidence: suggestion.confidence,
      correctionCount: suggestion.correctionCount,

      // 規則對比
      currentRule: existingRule
        ? {
            id: existingRule.id,
            extractionPattern: existingRule.extractionPattern,
            confidence: existingRule.confidence,
            lastUpdated: existingRule.updatedAt.toISOString(),
          }
        : null,
      suggestedRule: {
        pattern: suggestion.suggestedPattern,
        extractionType: suggestion.extractionType,
        confidence: suggestion.confidence,
      },

      // 影響分析
      expectedImpact: suggestion.expectedImpact,

      // 樣本案例
      sampleCases: suggestion.sampleCases.map((sc) => ({
        documentId: sc.documentId,
        documentName: sc.document.fileName,
        originalValue: sc.originalValue,
        correctedValue: sc.correctedValue,
      })),

      // 來源模式
      sourcePattern: suggestion.pattern
        ? {
            id: suggestion.pattern.id,
            occurrenceCount: suggestion.pattern.occurrenceCount,
            lastSeenAt: suggestion.pattern.lastSeenAt?.toISOString(),
          }
        : null,

      // 人員資訊
      suggestedBy: suggestion.suggester,
      reviewedBy: suggestion.reviewer,
      reviewNotes: suggestion.reviewNotes,

      // 時間戳
      createdAt: suggestion.createdAt.toISOString(),
      reviewedAt: suggestion.reviewedAt?.toISOString() || null,
    }

    return NextResponse.json({
      success: true,
      data: response,
    })
  } catch (error) {
    console.error('Get suggestion detail error:', error)

    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'internal_error',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Failed to fetch suggestion detail',
        },
      },
      { status: 500 }
    )
  }
}

// ============================================================
// PATCH /api/rules/suggestions/[id]
// ============================================================

/**
 * PATCH /api/rules/suggestions/[id]
 * 更新建議狀態或實施規則
 *
 * @description
 *   允許 Super User 審核建議：
 *   - 更新狀態為 APPROVED / REJECTED
 *   - 實施規則（status 變為 IMPLEMENTED）
 *
 * @body UpdateSuggestionRequest
 *   - status: 新狀態（可選）
 *   - reviewNotes: 審核備註（可選）
 *   - implementRule: 是否實施規則（可選）
 *
 * @returns 更新結果
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // 認證檢查
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

    // 權限檢查
    if (!hasRuleManagePermission(session.user.roles)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'forbidden',
            title: 'Forbidden',
            status: 403,
            detail: 'RULE_MANAGE permission required',
          },
        },
        { status: 403 }
      )
    }

    // 解析並驗證請求體
    const body = await request.json()
    const validation = updateSuggestionSchema.safeParse(body)

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

    const { status, reviewNotes, implementRule } = validation.data

    // 查詢現有建議
    const suggestion = await prisma.ruleSuggestion.findUnique({
      where: { id },
    })

    if (!suggestion) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'not_found',
            title: 'Not Found',
            status: 404,
            detail: `Suggestion ${id} not found`,
          },
        },
        { status: 404 }
      )
    }

    // 驗證狀態轉換
    if (status && !isValidStatusTransition(suggestion.status, status)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'invalid_transition',
            title: 'Invalid Status Transition',
            status: 400,
            detail: `Cannot transition from ${suggestion.status} to ${status}`,
          },
        },
        { status: 400 }
      )
    }

    // 準備更新資料
    const updateData: {
      status?: SuggestionStatus
      reviewNotes?: string
      reviewedBy?: string
      reviewedAt?: Date
    } = {}

    if (status) {
      updateData.status = status
      updateData.reviewedBy = session.user.id
      updateData.reviewedAt = new Date()
    }

    if (reviewNotes !== undefined) {
      updateData.reviewNotes = reviewNotes
    }

    // 如果需要實施規則
    let createdRuleId: string | null = null
    if (implementRule && (status === 'IMPLEMENTED' || suggestion.status === 'APPROVED')) {
      // 構建 extractionPattern
      const extractionPattern = {
        method: suggestion.extractionType.toLowerCase(),
        pattern: suggestion.suggestedPattern,
      }

      // 創建或更新映射規則
      const existingRule = await prisma.mappingRule.findFirst({
        where: {
          forwarderId: suggestion.forwarderId,
          fieldName: suggestion.fieldName,
          status: 'ACTIVE',
        },
      })

      if (existingRule) {
        // 更新現有規則
        await prisma.mappingRule.update({
          where: { id: existingRule.id },
          data: {
            extractionPattern,
            confidence: suggestion.confidence,
            suggestionId: suggestion.id,
          },
        })
        createdRuleId = existingRule.id
      } else {
        // 創建新規則
        const newRule = await prisma.mappingRule.create({
          data: {
            forwarderId: suggestion.forwarderId,
            fieldName: suggestion.fieldName,
            fieldLabel: suggestion.fieldName, // 使用 fieldName 作為 label
            extractionPattern,
            confidence: suggestion.confidence,
            priority: 50,
            status: 'ACTIVE',
            createdBy: session.user.id,
            suggestionId: suggestion.id,
          },
        })
        createdRuleId = newRule.id
      }

      updateData.status = 'IMPLEMENTED'
    }

    // 更新建議
    const updatedSuggestion = await prisma.ruleSuggestion.update({
      where: { id },
      data: updateData,
    })

    // 如果狀態變為 IMPLEMENTED，更新相關的 CorrectionPattern
    if (updateData.status === 'IMPLEMENTED' && suggestion.patternId) {
      await prisma.correctionPattern.update({
        where: { id: suggestion.patternId },
        data: { status: 'PROCESSED' },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        id: updatedSuggestion.id,
        status: updatedSuggestion.status,
        reviewedAt: updatedSuggestion.reviewedAt?.toISOString() || null,
        createdRuleId,
      },
    })
  } catch (error) {
    console.error('Update suggestion error:', error)

    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'internal_error',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Failed to update suggestion',
        },
      },
      { status: 500 }
    )
  }
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 驗證狀態轉換是否有效
 *
 * @param current - 當前狀態
 * @param next - 目標狀態
 * @returns 是否為有效的狀態轉換
 */
function isValidStatusTransition(current: SuggestionStatus, next: SuggestionStatus): boolean {
  const validTransitions: Record<SuggestionStatus, SuggestionStatus[]> = {
    PENDING: ['APPROVED', 'REJECTED'],
    APPROVED: ['IMPLEMENTED', 'REJECTED'],
    REJECTED: ['PENDING'], // 允許重新考慮
    IMPLEMENTED: [], // 終態
  }

  return validTransitions[current]?.includes(next) ?? false
}
