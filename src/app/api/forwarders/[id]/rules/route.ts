/**
 * @fileoverview Forwarder 規則列表 API 端點
 * @description
 *   提供 Forwarder 相關規則的分頁查詢和創建 API。
 *   需要認證和相應權限才能存取。
 *
 *   端點：
 *   - GET /api/forwarders/[id]/rules - 獲取規則列表（支援分頁、篩選、排序）
 *   - POST /api/forwarders/[id]/rules - 創建新規則（變更請求）
 *
 *   GET 查詢參數：
 *   - status: 規則狀態篩選 (DRAFT/PENDING_REVIEW/ACTIVE/DEPRECATED)
 *   - search: 欄位名稱搜尋
 *   - page: 頁碼（預設 1）
 *   - limit: 每頁數量（預設 10，最大 100）
 *   - sortBy: 排序欄位 (fieldName/status/confidence/matchCount/updatedAt)
 *   - sortOrder: 排序方向 (asc/desc，預設 desc)
 *
 * @module src/app/api/forwarders/[id]/rules/route
 * @author Development Team
 * @since Epic 5 - Story 5.2 (Forwarder Detail Config View)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/services/forwarder.service - Forwarder 服務
 *   - @/services/rule-change.service - 規則變更服務
 *   - @/types/forwarder - 類型定義
 *   - @/types/change-request - 變更請求類型
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { getForwarderRulesFromQuery, forwarderExists } from '@/services/forwarder.service'
import { createNewRuleRequest } from '@/services/rule-change.service'
import { ForwarderIdSchema, RulesQuerySchema } from '@/types/forwarder'
import { hasPermission } from '@/lib/auth/city-permission'
import { PERMISSIONS } from '@/types/permissions'
import { ExtractionType } from '@prisma/client'

// ============================================================
// Validation Schemas
// ============================================================

/**
 * 創建新規則請求 Schema
 */
const CreateRuleRequestSchema = z.object({
  fieldName: z.string().min(1, '請輸入欄位名稱').max(100),
  fieldLabel: z.string().min(1, '請輸入欄位標籤').max(200),
  extractionType: z.nativeEnum(ExtractionType),
  pattern: z.record(z.string(), z.unknown()).default({}),
  priority: z.number().int().min(1).max(100).default(50),
  confidence: z.number().min(0).max(1).default(0.8),
  description: z.string().max(500).optional(),
  isRequired: z.boolean().default(false),
  validationPattern: z.string().optional(),
  category: z.string().optional(),
  reason: z.string().min(1, '請說明新增原因').max(1000),
})

/**
 * GET /api/forwarders/[id]/rules
 * 獲取 Forwarder 的規則列表
 *
 * @description
 *   獲取指定 Forwarder 的映射規則列表，支援：
 *   - 狀態篩選
 *   - 欄位名稱搜尋
 *   - 分頁
 *   - 排序
 *
 *   需要 FORWARDER_VIEW 權限。
 *
 * @param request - HTTP 請求
 * @param context - 路由參數（包含 id）
 * @returns 規則列表和分頁資訊
 *
 * @example
 *   GET /api/forwarders/cuid123/rules
 *   GET /api/forwarders/cuid123/rules?status=ACTIVE&page=1&limit=10
 *
 *   Response:
 *   {
 *     "success": true,
 *     "data": [
 *       {
 *         "id": "rule123",
 *         "fieldName": "shipperName",
 *         "status": "ACTIVE",
 *         "version": 1,
 *         "confidence": 95,
 *         "matchCount": 150,
 *         "lastMatchedAt": "2025-12-19T10:00:00Z",
 *         "updatedAt": "2025-12-15T08:00:00Z"
 *       }
 *     ],
 *     "meta": {
 *       "pagination": {
 *         "page": 1,
 *         "limit": 10,
 *         "total": 25,
 *         "totalPages": 3
 *       }
 *     }
 *   }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. 驗證認證狀態
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/unauthorized',
            title: 'Unauthorized',
            status: 401,
            detail: 'Authentication required',
          },
        },
        { status: 401 }
      )
    }

    // 2. 驗證權限
    const canView = hasPermission(session.user, PERMISSIONS.FORWARDER_VIEW)
    if (!canView) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/forbidden',
            title: 'Forbidden',
            status: 403,
            detail: 'You do not have permission to view forwarder rules',
          },
        },
        { status: 403 }
      )
    }

    // 3. 獲取並驗證路由參數
    const resolvedParams = await params
    const idValidation = ForwarderIdSchema.safeParse({ id: resolvedParams.id })

    if (!idValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: 'Invalid forwarder ID',
            errors: idValidation.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      )
    }

    // 4. 檢查 Forwarder 是否存在
    const exists = await forwarderExists(idValidation.data.id)
    if (!exists) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/not-found',
            title: 'Not Found',
            status: 404,
            detail: `Forwarder with ID '${idValidation.data.id}' not found`,
            instance: `/api/forwarders/${idValidation.data.id}/rules`,
          },
        },
        { status: 404 }
      )
    }

    // 5. 解析並驗證查詢參數
    const { searchParams } = new URL(request.url)
    const queryParams = {
      status: searchParams.get('status') || undefined,
      search: searchParams.get('search') || undefined,
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
      sortBy: searchParams.get('sortBy') || undefined,
      sortOrder: searchParams.get('sortOrder') || undefined,
    }

    const queryValidation = RulesQuerySchema.safeParse(queryParams)

    if (!queryValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: 'Invalid query parameters',
            errors: queryValidation.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      )
    }

    // 6. 獲取規則列表
    const result = await getForwarderRulesFromQuery(idValidation.data.id, queryValidation.data)

    // 7. 返回成功響應
    return NextResponse.json({
      success: true,
      data: result.data,
      meta: {
        pagination: result.pagination,
      },
    })
  } catch (error) {
    console.error('Get forwarder rules error:', error)

    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'https://api.example.com/errors/internal-server-error',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Failed to fetch forwarder rules',
        },
      },
      { status: 500 }
    )
  }
}

// ============================================================
// POST /api/forwarders/[id]/rules
// ============================================================

/**
 * POST /api/forwarders/[id]/rules
 * 創建新規則（變更請求）
 *
 * @description
 *   創建一個新規則的變更請求。變更請求會進入待審核狀態，
 *   需要有 RULE_APPROVE 權限的用戶審核後才會生效。
 *
 *   需要 RULE_MANAGE 權限。
 *
 * @param request - HTTP 請求
 * @param context - 路由參數（包含 id）
 * @returns 變更請求資訊
 *
 * @example
 *   POST /api/forwarders/cuid123/rules
 *   Body: {
 *     "fieldName": "shipperName",
 *     "fieldLabel": "發貨人名稱",
 *     "extractionType": "REGEX",
 *     "pattern": { "expression": "Shipper:\\s*(.+)" },
 *     "reason": "新增發貨人欄位提取"
 *   }
 *
 *   Response:
 *   {
 *     "success": true,
 *     "data": {
 *       "changeRequestId": "req123",
 *       "status": "PENDING",
 *       "message": "新增規則已提交審核"
 *     }
 *   }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
            detail: '您沒有新增規則的權限',
          },
        },
        { status: 403 }
      )
    }

    // 3. 獲取並驗證路由參數
    const resolvedParams = await params
    const idValidation = ForwarderIdSchema.safeParse({ id: resolvedParams.id })

    if (!idValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: '無效的 Forwarder ID 格式',
            errors: idValidation.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      )
    }

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

    const bodyValidation = CreateRuleRequestSchema.safeParse(body)

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

    const {
      fieldName,
      fieldLabel,
      extractionType,
      pattern,
      priority,
      confidence,
      description,
      isRequired,
      validationPattern,
      category,
      reason,
    } = bodyValidation.data

    // 5. 創建變更請求
    const changeRequest = await createNewRuleRequest({
      forwarderId: idValidation.data.id,
      requesterId: session.user.id,
      content: {
        fieldName,
        fieldLabel,
        extractionType,
        pattern,
        priority,
        confidence,
        description,
        isRequired,
        validationPattern,
        category,
      },
      reason,
    })

    // 6. 返回成功響應
    return NextResponse.json(
      {
        success: true,
        data: {
          changeRequestId: changeRequest.id,
          status: changeRequest.status,
          message: '新增規則已提交審核',
          fieldName: changeRequest.afterContent.fieldName,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create rule error:', error)

    // 處理業務邏輯錯誤
    if (error instanceof Error) {
      // 已存在或衝突錯誤
      if (
        error.message.includes('已存在') ||
        error.message.includes('待審核')
      ) {
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

      // 找不到錯誤
      if (error.message.includes('找不到')) {
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
          detail: '新增規則時發生錯誤',
        },
      },
      { status: 500 }
    )
  }
}
