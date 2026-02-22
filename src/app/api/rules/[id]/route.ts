/**
 * @fileoverview 映射規則詳情 API 端點
 * @description
 *   提供映射規則詳情查詢功能：
 *   - 獲取單一規則的完整資訊
 *   - 包含應用統計（總次數、成功率、趨勢）
 *   - 包含最近應用記錄
 *   - 權限檢查：需要 RULE_VIEW 權限
 *
 *   端點：
 *   - GET /api/rules/[id] - 獲取規則詳情
 *   - PATCH /api/rules/[id] - 更新規則（創建變更請求）
 *
 * @module src/app/api/rules/[id]/route
 * @since Epic 4 - Story 4.1 (映射規則列表與查看)
 * @lastModified 2026-02-22
 * @refactor REFACTOR-001 (Forwarder → Company)
 * @fix FIX-042 - 新增 PATCH handler（無需 companyId 路徑參數）
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/lib/prisma - Prisma 客戶端
 *   - @/types/permissions - 權限常量
 *
 * @related
 *   - src/hooks/useRuleDetail.ts - React Query Hook
 *   - src/types/rule.ts - 類型定義
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/types/permissions'
import { hasPermission } from '@/lib/auth/city-permission'
import { createUpdateRequest } from '@/services/rule-change.service'
import { ExtractionType } from '@prisma/client'
import type {
  ExtractionPattern,
  RuleDetail,
  RuleStats,
  RecentApplication,
} from '@/types/rule'

// ============================================================
// Helper Functions
// ============================================================

/**
 * 檢查用戶是否有規則查看權限
 *
 * @note 支援 wildcard ('*') 權限，開發模式下用戶擁有所有權限
 */
function hasRuleViewPermission(
  roles: { permissions: string[] }[] | undefined
): boolean {
  if (!roles) return false
  return roles.some((r) =>
    r.permissions.includes('*') || r.permissions.includes(PERMISSIONS.RULE_VIEW)
  )
}

// ============================================================
// Route Params Type
// ============================================================

interface RouteParams {
  params: Promise<{ id: string }>
}

// ============================================================
// GET /api/rules/[id]
// ============================================================

/**
 * GET /api/rules/[id]
 * 獲取映射規則詳情
 *
 * @description
 *   返回規則的完整資訊，包括：
 *   - 基本資訊（欄位、提取模式、狀態等）
 *   - 應用統計（總次數、成功率、近 7 天趨勢）
 *   - 最近 10 筆應用記錄
 *
 * @param request - NextRequest 物件
 * @param params - 路由參數，包含規則 ID
 * @returns 規則詳情或錯誤響應
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    // 權限檢查
    if (!hasRuleViewPermission(session.user.roles)) {
      return NextResponse.json(
        {
          type: 'forbidden',
          title: 'Forbidden',
          status: 403,
          detail: 'RULE_VIEW permission required',
        },
        { status: 403 }
      )
    }

    const { id: ruleId } = await params

    // 獲取規則基本資訊
    const rule = await prisma.mappingRule.findUnique({
      where: { id: ruleId },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    })

    // 如果有 createdBy，獲取創建者資訊
    let creator: { id: string; name: string | null; email: string } | null = null
    if (rule?.createdBy) {
      const user = await prisma.user.findUnique({
        where: { id: rule.createdBy },
        select: { id: true, name: true, email: true },
      })
      creator = user
    }

    if (!rule) {
      return NextResponse.json(
        {
          type: 'not_found',
          title: 'Not Found',
          status: 404,
          detail: `Rule ${ruleId} not found`,
        },
        { status: 404 }
      )
    }

    // 計算統計資料的時間範圍
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

    // 並行查詢統計數據
    const [allAppsCount, successAppsCount, last7DaysApps, prev7DaysApps, recentApps] =
      await Promise.all([
        // 所有已驗證的應用記錄數
        prisma.ruleApplication.count({
          where: {
            ruleId,
            isAccurate: { not: null },
          },
        }),

        // 成功的應用記錄數
        prisma.ruleApplication.count({
          where: {
            ruleId,
            isAccurate: true,
          },
        }),

        // 最近 7 天的應用記錄
        prisma.ruleApplication.findMany({
          where: {
            ruleId,
            isAccurate: { not: null },
            createdAt: { gte: sevenDaysAgo },
          },
          select: { isAccurate: true },
        }),

        // 前 7 天的應用記錄（用於計算趨勢）
        prisma.ruleApplication.findMany({
          where: {
            ruleId,
            isAccurate: { not: null },
            createdAt: {
              gte: fourteenDaysAgo,
              lt: sevenDaysAgo,
            },
          },
          select: { isAccurate: true },
        }),

        // 最近 10 筆應用記錄（含文件資訊）
        prisma.ruleApplication.findMany({
          where: { ruleId },
          include: {
            document: {
              select: {
                id: true,
                fileName: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
      ])

    // 計算成功率
    const successRate =
      allAppsCount > 0 ? (successAppsCount / allAppsCount) * 100 : null

    // 計算最近 7 天成功率
    const last7DaysTotal = last7DaysApps.length
    const last7DaysSuccess = last7DaysApps.filter((a) => a.isAccurate).length
    const last7DaysSuccessRate =
      last7DaysTotal > 0 ? (last7DaysSuccess / last7DaysTotal) * 100 : null

    // 計算趨勢
    const prev7DaysTotal = prev7DaysApps.length
    const prev7DaysSuccess = prev7DaysApps.filter((a) => a.isAccurate).length
    const prev7DaysSuccessRate =
      prev7DaysTotal > 0 ? (prev7DaysSuccess / prev7DaysTotal) * 100 : null

    let trend: 'up' | 'down' | 'stable' = 'stable'
    let trendPercentage = 0

    if (last7DaysSuccessRate !== null && prev7DaysSuccessRate !== null) {
      const diff = last7DaysSuccessRate - prev7DaysSuccessRate
      if (diff > 2) {
        trend = 'up'
        trendPercentage = diff
      } else if (diff < -2) {
        trend = 'down'
        trendPercentage = Math.abs(diff)
      }
    }

    // 構建統計數據
    const stats: RuleStats = {
      totalApplications: allAppsCount,
      successfulApplications: successAppsCount,
      successRate,
      last7DaysApplications: last7DaysTotal,
      last7DaysSuccessRate,
      averageConfidence: rule.confidence * 100,
      trend,
      trendPercentage,
    }

    // 構建最近應用記錄
    const recentApplications: RecentApplication[] = recentApps.map((app) => ({
      id: app.id,
      documentId: app.document.id,
      documentName: app.document.fileName,
      extractedValue: app.extractedValue,
      isAccurate: app.isAccurate,
      appliedAt: app.createdAt.toISOString(),
    }))

    // 構建響應數據
    const ruleDetail: RuleDetail = {
      id: rule.id,
      company: rule.company, // REFACTOR-001: 原 forwarder
      fieldName: rule.fieldName,
      fieldLabel: rule.fieldLabel,
      extractionPattern: rule.extractionPattern as unknown as ExtractionPattern,
      confidence: rule.confidence,
      priority: rule.priority,
      status: rule.status,
      version: rule.version,
      description: rule.description,
      isRequired: rule.isRequired,
      validationPattern: rule.validationPattern,
      defaultValue: rule.defaultValue,
      category: rule.category,
      createdBy: creator ? {
        id: creator.id,
        name: creator.name ?? 'Unknown',
        email: creator.email,
      } : null,
      createdAt: rule.createdAt.toISOString(),
      updatedAt: rule.updatedAt.toISOString(),
      stats,
      recentApplications,
    }

    return NextResponse.json({
      success: true,
      data: ruleDetail,
    })
  } catch (error) {
    console.error('Get rule detail error:', error)

    return NextResponse.json(
      {
        type: 'internal_error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to fetch rule detail',
      },
      { status: 500 }
    )
  }
}

// ============================================================
// Validation Schemas (PATCH)
// ============================================================

/**
 * 更新規則請求 Schema
 * FIX-042: 新增 PATCH handler，無需 companyId 路徑參數
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
// PATCH /api/rules/[id]
// ============================================================

/**
 * PATCH /api/rules/[id]
 * 更新現有規則（創建變更請求）
 *
 * @description
 *   FIX-042 BUG-2: 新增此端點以支援通用規則（companyId=null）更新。
 *   從 DB 查詢規則的 companyId，無需在 URL 路徑中傳遞。
 *   實際上會創建一個變更請求，需要審核者批准後才會生效。
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    // 1. 認證檢查
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

    // 2. 權限檢查
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

    const { id: ruleId } = await params

    // 3. 查詢規則以獲取 companyId
    const rule = await prisma.mappingRule.findUnique({
      where: { id: ruleId },
      select: { id: true, companyId: true },
    })

    if (!rule) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/not-found',
            title: 'Not Found',
            status: 404,
            detail: `Rule ${ruleId} not found`,
          },
        },
        { status: 404 }
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

    // 5. 創建變更請求（companyId 從 DB 查詢，支援 null）
    const changeRequest = await createUpdateRequest({
      ruleId,
      forwarderId: rule.companyId ?? '',
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

    if (error instanceof Error) {
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
