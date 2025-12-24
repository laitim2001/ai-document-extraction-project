/**
 * @fileoverview 規則建議生成 API 端點
 * @description
 *   從 CANDIDATE 模式生成規則升級建議：
 *   - POST /api/rules/suggestions/generate - 從模式生成建議
 *   - POST /api/rules/suggestions/generate/batch - 批量處理候選模式
 *
 * @module src/app/api/rules/suggestions/generate/route
 * @since Epic 4 - Story 4.4 (規則升級建議生成)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 從單一 CANDIDATE Pattern 生成建議
 *   - 批量處理所有候選模式
 *   - 規則推斷與影響分析
 *   - Super User 通知
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/services/rule-suggestion-generator - 建議生成服務
 *   - @/types/permissions - 權限常量
 *   - zod - 輸入驗證
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { PERMISSIONS } from '@/types/permissions'
import { ruleSuggestionGenerator } from '@/services/rule-suggestion-generator'

// ============================================================
// Helper Functions
// ============================================================

/**
 * 檢查用戶是否有規則管理權限
 *
 * @note 支援 wildcard ('*') 權限，開發模式下用戶擁有所有權限
 */
function hasRuleManagePermission(roles: { permissions: string[] }[] | undefined): boolean {
  if (!roles) return false
  return roles.some((r) =>
    r.permissions.includes('*') || r.permissions.includes(PERMISSIONS.RULE_MANAGE)
  )
}

// ============================================================
// Validation Schemas
// ============================================================

/**
 * 生成建議請求驗證 Schema
 */
const generateSuggestionSchema = z.object({
  patternId: z.string().min(1, 'Pattern ID is required'),
})

/**
 * 批量生成請求驗證 Schema
 */
const batchGenerateSchema = z.object({
  limit: z.number().min(1).max(100).optional().default(50),
})

// ============================================================
// POST /api/rules/suggestions/generate
// ============================================================

/**
 * POST /api/rules/suggestions/generate
 * 從 CANDIDATE 模式生成規則建議
 *
 * @description
 *   接受一個 patternId，從對應的 CANDIDATE 狀態修正模式
 *   生成規則升級建議。包含：
 *   - 規則推斷（自動選擇最佳提取類型）
 *   - 影響分析（計算預期改善）
 *   - 通知發送（通知 Super Users 審核）
 *
 * @body GenerateSuggestionRequest
 *   - patternId: 修正模式 ID
 *
 * @returns 生成結果，包含建議 ID 和影響分析
 */
export async function POST(request: NextRequest) {
  try {
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

    // 解析請求體
    const body = await request.json()

    // 檢查是否為批量請求
    if (body.batch === true) {
      return handleBatchGenerate(body)
    }

    // 單一模式生成
    const validation = generateSuggestionSchema.safeParse(body)

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

    const { patternId } = validation.data

    // 生成建議
    const result = await ruleSuggestionGenerator.generateFromPattern(patternId)

    return NextResponse.json(
      {
        success: true,
        data: {
          suggestionId: result.suggestionId,
          inferredRule: {
            type: result.inferredRule.type,
            pattern: result.inferredRule.pattern,
            confidence: result.inferredRule.confidence,
            explanation: result.inferredRule.explanation,
          },
          impact: {
            affectedDocuments: result.impact.affectedDocuments,
            estimatedImprovement: result.impact.estimatedImprovement,
            currentAccuracy: result.impact.currentAccuracy,
            predictedAccuracy: result.impact.predictedAccuracy,
            riskCount: result.impact.potentialRisks.length,
          },
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Generate suggestion error:', error)

    // 處理特定錯誤
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json(
          {
            success: false,
            error: {
              type: 'not_found',
              title: 'Not Found',
              status: 404,
              detail: error.message,
            },
          },
          { status: 404 }
        )
      }

      if (error.message.includes('not in CANDIDATE status')) {
        return NextResponse.json(
          {
            success: false,
            error: {
              type: 'invalid_state',
              title: 'Invalid Pattern State',
              status: 400,
              detail: error.message,
            },
          },
          { status: 400 }
        )
      }

      if (error.message.includes('already exists')) {
        return NextResponse.json(
          {
            success: false,
            error: {
              type: 'duplicate',
              title: 'Suggestion Already Exists',
              status: 409,
              detail: error.message,
            },
          },
          { status: 409 }
        )
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'internal_error',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Failed to generate suggestion',
        },
      },
      { status: 500 }
    )
  }
}

// ============================================================
// Batch Generate Handler
// ============================================================

/**
 * 處理批量生成請求
 *
 * @param body - 請求體
 * @returns 批量處理結果
 */
async function handleBatchGenerate(body: unknown): Promise<NextResponse> {
  const validation = batchGenerateSchema.safeParse(body)

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

  try {
    const result = await ruleSuggestionGenerator.processAllCandidates()

    return NextResponse.json({
      success: true,
      data: {
        processed: result.processed,
        succeeded: result.succeeded,
        failed: result.failed,
        errors: result.errors.slice(0, 10), // 只返回前 10 個錯誤
        hasMoreErrors: result.errors.length > 10,
      },
    })
  } catch (error) {
    console.error('Batch generate error:', error)

    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'internal_error',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Failed to process batch generation',
        },
      },
      { status: 500 }
    )
  }
}
