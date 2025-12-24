/**
 * @fileoverview 規則升級建議 API 端點
 * @description
 *   提供規則升級建議管理功能：
 *   - GET /api/rules/suggestions - 獲取建議列表
 *   - POST /api/rules/suggestions - 手動創建建議
 *
 * @module src/app/api/rules/suggestions/route
 * @since Epic 4 - Story 4.4 (規則升級建議生成)
 * @lastModified 2025-12-22
 * @refactor REFACTOR-001 (Forwarder → Company)
 *
 * @features
 *   - 建議列表查詢（支援分頁、篩選、排序）
 *   - 手動創建建議
 *   - 摘要統計
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
import type { SuggestionStatus, SuggestionSource, Prisma } from '@prisma/client'

// ============================================================
// Helper Functions
// ============================================================

/**
 * 檢查用戶是否有規則查看權限
 *
 * @note 支援 wildcard ('*') 權限，開發模式下用戶擁有所有權限
 */
function hasRuleViewPermission(roles: { permissions: string[] }[] | undefined): boolean {
  if (!roles) return false
  return roles.some((r) =>
    r.permissions.includes('*') || r.permissions.includes(PERMISSIONS.RULE_VIEW)
  )
}

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
 * 創建建議請求驗證 Schema
 */
const createSuggestionSchema = z.object({
  companyId: z.string().min(1, 'Company ID is required'),
  fieldName: z.string().min(1, 'Field name is required'),
  extractionType: z.enum(['REGEX', 'POSITION', 'KEYWORD', 'AI_PROMPT', 'TEMPLATE']),
  suggestedPattern: z.string().min(1, 'Suggested pattern is required'),
  explanation: z.string().optional(),
})

// ============================================================
// GET /api/rules/suggestions
// ============================================================

/**
 * GET /api/rules/suggestions
 * 獲取規則升級建議列表
 *
 * @description
 *   查詢參數：
 *   - companyId: Company ID 篩選
 *   - fieldName: 欄位名稱搜索（模糊匹配）
 *   - status: 狀態篩選 (PENDING | APPROVED | REJECTED | IMPLEMENTED)
 *   - source: 來源篩選 (AUTO_LEARNING | MANUAL | IMPORT)
 *   - page: 頁碼（從 1 開始，預設 1）
 *   - pageSize: 每頁數量（預設 20，最大 100）
 *   - sortBy: 排序欄位 (createdAt | correctionCount | confidence | priority)
 *   - sortOrder: 排序順序 (asc | desc)
 *
 * @returns 建議列表、分頁資訊和摘要統計
 */
export async function GET(request: NextRequest) {
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

    // 解析查詢參數
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId') || undefined
    const fieldName = searchParams.get('fieldName') || undefined
    const status = searchParams.get('status') as SuggestionStatus | null
    const source = searchParams.get('source') as SuggestionSource | null
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10))
    )
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc'

    // 構建查詢條件
    const where: Prisma.RuleSuggestionWhereInput = {}

    if (companyId) {
      where.companyId = companyId
    }

    if (fieldName) {
      where.fieldName = { contains: fieldName, mode: 'insensitive' }
    }

    if (status) {
      where.status = status
    }

    if (source) {
      where.source = source
    }

    // 構建排序條件
    const orderBy: Prisma.RuleSuggestionOrderByWithRelationInput = {}
    if (sortBy === 'correctionCount') {
      orderBy.correctionCount = sortOrder
    } else if (sortBy === 'confidence') {
      orderBy.confidence = sortOrder
    } else if (sortBy === 'priority') {
      orderBy.priority = sortOrder
    } else {
      orderBy.createdAt = sortOrder
    }

    // 並行查詢：建議列表、總數、摘要
    const [suggestions, total, summary] = await Promise.all([
      // 建議列表
      prisma.ruleSuggestion.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy,
        include: {
          company: {
            select: { id: true, name: true, code: true },
          },
          suggester: {
            select: { id: true, name: true },
          },
        },
      }),

      // 總數
      prisma.ruleSuggestion.count({ where }),

      // 摘要統計
      prisma.ruleSuggestion.groupBy({
        by: ['status', 'source'],
        _count: { id: true },
      }),
    ])

    // 檢查每個建議是否有現有規則
    const suggestionWithRules = await Promise.all(
      suggestions.map(async (s) => {
        const existingRule = await prisma.mappingRule.findFirst({
          where: {
            companyId: s.companyId,
            fieldName: s.fieldName,
            status: 'ACTIVE',
          },
          select: { id: true },
        })

        return {
          id: s.id,
          company: s.company, // REFACTOR-001: 原 forwarder
          fieldName: s.fieldName,
          extractionType: s.extractionType,
          source: s.source,
          correctionCount: s.correctionCount,
          status: s.status,
          confidence: s.confidence,
          priority: s.priority,
          suggestedBy: s.suggester,
          createdAt: s.createdAt.toISOString(),
          hasExistingRule: !!existingRule,
        }
      })
    )

    // 處理摘要統計
    const statusCounts = summary.reduce(
      (acc, s) => {
        acc[s.status] = (acc[s.status] || 0) + s._count.id
        return acc
      },
      {} as Record<string, number>
    )

    const sourceCounts = summary.reduce(
      (acc, s) => {
        acc[s.source] = (acc[s.source] || 0) + s._count.id
        return acc
      },
      {} as Record<string, number>
    )

    return NextResponse.json({
      success: true,
      data: {
        suggestions: suggestionWithRules,
        pagination: {
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        },
        summary: {
          totalSuggestions: total,
          pendingSuggestions: statusCounts['PENDING'] || 0,
          autoLearningSuggestions: sourceCounts['AUTO_LEARNING'] || 0,
          manualSuggestions: sourceCounts['MANUAL'] || 0,
        },
      },
    })
  } catch (error) {
    console.error('Get suggestions error:', error)

    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'internal_error',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Failed to fetch suggestions',
        },
      },
      { status: 500 }
    )
  }
}

// ============================================================
// POST /api/rules/suggestions
// ============================================================

/**
 * POST /api/rules/suggestions
 * 手動創建規則建議
 *
 * @description
 *   允許 Super User 手動創建規則建議。
 *   - 需要 RULE_MANAGE 權限
 *   - 建議狀態設為 PENDING
 *   - 來源設為 MANUAL
 *
 * @body CreateSuggestionRequest
 *   - companyId: Company ID
 *   - fieldName: 欄位名稱
 *   - extractionType: 提取類型
 *   - suggestedPattern: 建議的規則模式
 *   - explanation: 說明（可選）
 *
 * @returns 創建結果
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

    // 解析並驗證請求體
    const body = await request.json()
    const validation = createSuggestionSchema.safeParse(body)

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

    const { companyId, fieldName, extractionType, suggestedPattern } = validation.data

    // 驗證 Company 是否存在 (REFACTOR-001)
    const company = await prisma.company.findUnique({
      where: { id: companyId },
    })

    if (!company) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'not_found',
            title: 'Not Found',
            status: 404,
            detail: `Company ${companyId} not found`,
          },
        },
        { status: 404 }
      )
    }

    // 獲取現有規則
    const existingRule = await prisma.mappingRule.findFirst({
      where: {
        companyId,
        fieldName,
        status: 'ACTIVE',
      },
      select: {
        extractionPattern: true,
      },
    })

    // 從 extractionPattern (Json) 中提取 pattern 字串
    const currentPatternString = existingRule?.extractionPattern
      ? JSON.stringify(existingRule.extractionPattern)
      : null

    // 創建建議
    const suggestion = await prisma.ruleSuggestion.create({
      data: {
        companyId, // REFACTOR-001: 原 forwarderId
        fieldName,
        extractionType,
        currentPattern: currentPatternString,
        suggestedPattern,
        confidence: 1, // 手動建議默認信心度為 1
        source: 'MANUAL',
        status: 'PENDING',
        priority: 50, // 手動建議默認優先級
        suggestedBy: session.user.id,
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          id: suggestion.id,
          status: suggestion.status,
          createdAt: suggestion.createdAt.toISOString(),
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create suggestion error:', error)

    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'internal_error',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Failed to create suggestion',
        },
      },
      { status: 500 }
    )
  }
}
