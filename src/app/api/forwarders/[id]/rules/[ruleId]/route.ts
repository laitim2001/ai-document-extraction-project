/**
 * @fileoverview Forwarder 規則更新 API 端點
 * @description
 *   提供單一規則的更新功能（通過變更請求流程）。
 *   需要認證和 RULE_MANAGE 權限才能存取。
 *
 *   端點：
 *   - PUT /api/forwarders/[id]/rules/[ruleId] - 更新現有規則（創建變更請求）
 *
 * @module src/app/api/forwarders/[id]/rules/[ruleId]/route
 * @author Development Team
 * @since Epic 5 - Story 5.3 (編輯 Forwarder 映射規則)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/services/rule-change.service - 規則變更服務
 *   - @/lib/auth/city-permission - 權限檢查
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { createUpdateRequest } from '@/services/rule-change.service'
import { hasPermission } from '@/lib/auth/city-permission'
import { PERMISSIONS } from '@/types/permissions'
import { ExtractionType } from '@prisma/client'

// ============================================================
// Validation Schemas
// ============================================================

/**
 * 路由參數 Schema
 */
const RouteParamsSchema = z.object({
  id: z.string().min(1, 'Forwarder ID is required'),
  ruleId: z.string().min(1, 'Rule ID is required'),
})

/**
 * 更新規則請求 Schema
 */
const UpdateRuleRequestSchema = z.object({
  extractionType: z.nativeEnum(ExtractionType).optional(),
  pattern: z.record(z.string(), z.unknown()).optional(),
  priority: z.number().int().min(1).max(100).optional(),
  confidence: z.number().min(0).max(1).optional(),
  description: z.string().max(500).optional(),
  reason: z.string().min(1, '請說明變更原因').max(1000),
})

// ============================================================
// Route Params Type
// ============================================================

interface RouteParams {
  params: Promise<{ id: string; ruleId: string }>
}

// ============================================================
// PUT /api/forwarders/[id]/rules/[ruleId]
// ============================================================

/**
 * PUT /api/forwarders/[id]/rules/[ruleId]
 * 更新現有規則（創建變更請求）
 *
 * @description
 *   更新指定規則。實際上會創建一個變更請求，
 *   需要有 RULE_APPROVE 權限的用戶審核後才會生效。
 *
 *   需要 RULE_MANAGE 權限。
 *
 * @param request - HTTP 請求
 * @param context - 路由參數（包含 id 和 ruleId）
 * @returns 變更請求資訊
 *
 * @example
 *   PUT /api/forwarders/fwd123/rules/rule456
 *   Body: {
 *     "extractionType": "REGEX",
 *     "pattern": { "expression": "Invoice:\\s*(\\d+)" },
 *     "confidence": 0.9,
 *     "reason": "提高發票號碼提取準確度"
 *   }
 *
 *   Response:
 *   {
 *     "success": true,
 *     "data": {
 *       "changeRequestId": "req123",
 *       "status": "PENDING",
 *       "message": "規則變更已提交審核"
 *     }
 *   }
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    // 1. 驗證認證狀態
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/unauthorized',
            title: 'Unauthorized',
            status: 401,
            detail: '請先登入',
          },
        },
        { status: 401 }
      )
    }

    // 2. 驗證權限
    const canManageRules = hasPermission(session.user, PERMISSIONS.RULE_MANAGE)
    if (!canManageRules) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/forbidden',
            title: 'Forbidden',
            status: 403,
            detail: '您沒有編輯規則的權限',
          },
        },
        { status: 403 }
      )
    }

    // 3. 獲取並驗證路由參數
    const resolvedParams = await params
    const paramsValidation = RouteParamsSchema.safeParse({
      id: resolvedParams.id,
      ruleId: resolvedParams.ruleId,
    })

    if (!paramsValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: '無效的路由參數',
            errors: paramsValidation.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      )
    }

    const { id: forwarderId, ruleId } = paramsValidation.data

    // 4. 解析並驗證請求內容
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: '無效的 JSON 格式',
          },
        },
        { status: 400 }
      )
    }

    const bodyValidation = UpdateRuleRequestSchema.safeParse(body)

    if (!bodyValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: '請求資料驗證失敗',
            errors: bodyValidation.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      )
    }

    const { extractionType, pattern, priority, confidence, description, reason } =
      bodyValidation.data

    // 5. 創建變更請求
    const changeRequest = await createUpdateRequest({
      ruleId,
      forwarderId,
      requesterId: session.user.id,
      updates: {
        extractionType,
        pattern,
        priority,
        confidence,
        description,
      },
      reason,
    })

    // 6. 返回成功響應
    return NextResponse.json({
      success: true,
      data: {
        changeRequestId: changeRequest.id,
        status: changeRequest.status,
        message: '規則變更已提交審核',
        rule: {
          id: ruleId,
          fieldName: changeRequest.beforeContent?.fieldName,
        },
      },
    })
  } catch (error) {
    console.error('Update rule error:', error)

    // 處理業務邏輯錯誤
    if (error instanceof Error) {
      // 已存在待審核請求
      if (error.message.includes('待審核')) {
        return NextResponse.json(
          {
            success: false,
            error: {
              type: 'https://api.example.com/errors/conflict',
              title: 'Conflict',
              status: 409,
              detail: error.message,
            },
          },
          { status: 409 }
        )
      }

      // 找不到或不屬於
      if (
        error.message.includes('找不到') ||
        error.message.includes('不屬於')
      ) {
        return NextResponse.json(
          {
            success: false,
            error: {
              type: 'https://api.example.com/errors/not-found',
              title: 'Not Found',
              status: 404,
              detail: error.message,
            },
          },
          { status: 404 }
        )
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'https://api.example.com/errors/internal-server-error',
          title: 'Internal Server Error',
          status: 500,
          detail: '更新規則時發生錯誤',
        },
      },
      { status: 500 }
    )
  }
}
