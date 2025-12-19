/**
 * @fileoverview 規則版本歷史 API 端點
 * @description
 *   提供規則版本歷史的查詢功能：
 *   - 取得指定規則的所有版本記錄
 *   - 支援分頁查詢
 *   - 返回版本詳情包含創建者信息
 *
 * @module src/app/api/rules/[id]/versions/route
 * @since Epic 4 - Story 4.7 (規則版本歷史管理)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 分頁查詢版本列表
 *   - 版本詳情包含創建者信息
 *   - 標記當前活躍版本
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/lib/prisma - Prisma 客戶端
 *   - zod - 輸入驗證
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/auth/city-permission'
import { PERMISSIONS } from '@/types/permissions'
import type { VersionDetail, VersionsResponse, ExtractionPattern } from '@/types/version'

// ============================================================
// Validation Schemas
// ============================================================

/**
 * 查詢參數驗證 Schema
 */
const querySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
})

// ============================================================
// GET /api/rules/[id]/versions
// ============================================================

/**
 * GET /api/rules/[id]/versions
 * 取得規則版本歷史列表
 *
 * @description
 *   查詢指定規則的版本歷史：
 *   1. 驗證用戶認證
 *   2. 檢查 RULE_VIEW 權限
 *   3. 驗證規則存在
 *   4. 返回分頁的版本列表
 *
 * @query limit - 返回數量限制（預設 20，最大 100）
 * @query offset - 分頁偏移（預設 0）
 *
 * @returns VersionsResponse
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ruleId } = await params

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
            instance: `/api/rules/${ruleId}/versions`,
          },
        },
        { status: 401 }
      )
    }

    // 2. 權限檢查
    if (!hasPermission(session.user, PERMISSIONS.RULE_VIEW)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'forbidden',
            title: 'Forbidden',
            status: 403,
            detail: 'RULE_VIEW permission required',
            instance: `/api/rules/${ruleId}/versions`,
          },
        },
        { status: 403 }
      )
    }

    // 3. 解析查詢參數
    const searchParams = request.nextUrl.searchParams
    const queryResult = querySchema.safeParse({
      limit: searchParams.get('limit') ?? undefined,
      offset: searchParams.get('offset') ?? undefined,
    })

    if (!queryResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'validation_error',
            title: 'Validation Error',
            status: 400,
            detail: queryResult.error.issues[0].message,
            instance: `/api/rules/${ruleId}/versions`,
          },
        },
        { status: 400 }
      )
    }

    const { limit, offset } = queryResult.data

    // 4. 取得規則
    const rule = await prisma.mappingRule.findUnique({
      where: { id: ruleId },
      select: {
        id: true,
        fieldName: true,
        fieldLabel: true,
        version: true,
      },
    })

    if (!rule) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'not_found',
            title: 'Rule Not Found',
            status: 404,
            detail: `Rule with ID ${ruleId} not found`,
            instance: `/api/rules/${ruleId}/versions`,
          },
        },
        { status: 404 }
      )
    }

    // 5. 取得版本列表和總數
    const [versions, totalCount] = await Promise.all([
      prisma.ruleVersion.findMany({
        where: { ruleId },
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { version: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.ruleVersion.count({
        where: { ruleId },
      }),
    ])

    // 6. 轉換響應格式
    const versionDetails: VersionDetail[] = versions.map((v) => ({
      id: v.id,
      version: v.version,
      extractionPattern: v.extractionPattern as unknown as ExtractionPattern,
      confidence: v.confidence,
      priority: v.priority,
      changeReason: v.changeReason,
      createdBy: {
        id: v.creator.id,
        name: v.creator.name,
        email: v.creator.email,
      },
      createdAt: v.createdAt.toISOString(),
      isActive: v.version === rule.version,
    }))

    const response: VersionsResponse = {
      ruleId: rule.id,
      ruleName: rule.fieldName,
      fieldLabel: rule.fieldLabel,
      currentVersion: rule.version,
      totalVersions: totalCount,
      versions: versionDetails,
    }

    return NextResponse.json({
      success: true,
      data: response,
    })
  } catch (error) {
    console.error('Error fetching versions:', error)

    const ruleId = (await params).id
    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'internal_error',
          title: 'Internal Server Error',
          status: 500,
          detail: 'An unexpected error occurred',
          instance: `/api/rules/${ruleId}/versions`,
        },
      },
      { status: 500 }
    )
  }
}
