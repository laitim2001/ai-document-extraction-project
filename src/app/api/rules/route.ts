/**
 * @fileoverview 映射規則列表 API 端點
 * @description
 *   提供映射規則列表查詢功能：
 *   - 獲取所有映射規則
 *   - 支持 Forwarder、欄位名稱、狀態、類別篩選
 *   - 支持分頁和排序
 *   - 包含規則統計數據（應用次數、成功率）
 *   - 權限檢查：需要 RULE_VIEW 權限
 *
 *   端點：
 *   - GET /api/rules - 獲取規則列表
 *
 * @module src/app/api/rules/route
 * @since Epic 4 - Story 4.1 (映射規則列表與查看)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/lib/prisma - Prisma 客戶端
 *   - @/types/permissions - 權限常量
 *
 * @related
 *   - src/hooks/useRuleList.ts - React Query Hook
 *   - src/types/rule.ts - 類型定義
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/types/permissions'
import type { RuleStatus, Prisma } from '@prisma/client'
import type { ExtractionPattern, RuleListItem, RulesSummary } from '@/types/rule'

// ============================================================
// Helper Functions
// ============================================================

/**
 * 檢查用戶是否有規則查看權限
 */
function hasRuleViewPermission(
  roles: { permissions: string[] }[] | undefined
): boolean {
  if (!roles) return false
  return roles.some((r) => r.permissions.includes(PERMISSIONS.RULE_VIEW))
}

// ============================================================
// GET /api/rules
// ============================================================

/**
 * GET /api/rules
 * 獲取映射規則列表
 *
 * @description
 *   查詢參數：
 *   - forwarderId: Forwarder ID 篩選
 *   - fieldName: 欄位名稱搜索（模糊匹配）
 *   - status: 狀態篩選 (DRAFT | PENDING_REVIEW | ACTIVE | DEPRECATED)
 *   - category: 類別篩選 (basic | amount | party | logistics | reference | other)
 *   - page: 頁碼（從 1 開始，預設 1）
 *   - pageSize: 每頁數量（預設 20，最大 100）
 *   - sortBy: 排序欄位 (createdAt | updatedAt | priority | fieldName)
 *   - sortOrder: 排序順序 (asc | desc)
 *
 * @returns 規則列表、分頁資訊和摘要統計
 */
export async function GET(request: NextRequest) {
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

    // 解析查詢參數
    const { searchParams } = new URL(request.url)
    const forwarderId = searchParams.get('forwarderId') || undefined
    const fieldName = searchParams.get('fieldName') || undefined
    const status = searchParams.get('status') as RuleStatus | null
    const category = searchParams.get('category') || undefined
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10))
    )
    const sortBy = searchParams.get('sortBy') || 'updatedAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // 構建查詢條件
    const where: Prisma.MappingRuleWhereInput = {
      isActive: true, // 只顯示啟用的規則
    }

    if (forwarderId) {
      if (forwarderId === 'universal') {
        where.forwarderId = null // 通用規則
      } else {
        where.forwarderId = forwarderId
      }
    }

    if (fieldName) {
      where.OR = [
        { fieldName: { contains: fieldName, mode: 'insensitive' } },
        { fieldLabel: { contains: fieldName, mode: 'insensitive' } },
      ]
    }

    if (status) {
      where.status = status
    }

    if (category) {
      where.category = category
    }

    // 構建排序條件
    const orderBy: Prisma.MappingRuleOrderByWithRelationInput = {}
    if (sortBy === 'fieldName') {
      orderBy.fieldName = sortOrder as 'asc' | 'desc'
    } else if (sortBy === 'priority') {
      orderBy.priority = sortOrder as 'asc' | 'desc'
    } else if (sortBy === 'createdAt') {
      orderBy.createdAt = sortOrder as 'asc' | 'desc'
    } else {
      orderBy.updatedAt = sortOrder as 'asc' | 'desc'
    }

    // 並行查詢：規則列表、總數、狀態摘要
    const [rules, total, statusCounts] = await Promise.all([
      // 規則列表
      prisma.mappingRule.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy,
        include: {
          forwarder: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          creator: {
            select: {
              id: true,
              name: true,
            },
          },
          applications: {
            where: {
              isAccurate: { not: null },
            },
            select: {
              isAccurate: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 100, // 取最近 100 筆計算統計
          },
        },
      }),

      // 總數
      prisma.mappingRule.count({ where }),

      // 狀態摘要（全部規則，不受篩選影響）
      prisma.mappingRule.groupBy({
        by: ['status'],
        where: { isActive: true },
        _count: { id: true },
      }),
    ])

    // 計算通用規則數量
    const universalCount = await prisma.mappingRule.count({
      where: { isActive: true, forwarderId: null },
    })

    // 處理規則列表數據，計算統計
    const rulesWithStats: RuleListItem[] = rules.map((rule) => {
      const apps = rule.applications
      const totalApps = apps.length
      const successApps = apps.filter((a) => a.isAccurate === true).length
      const lastApp = apps[0]

      return {
        id: rule.id,
        forwarder: rule.forwarder,
        fieldName: rule.fieldName,
        fieldLabel: rule.fieldLabel,
        extractionPattern: rule.extractionPattern as unknown as ExtractionPattern,
        status: rule.status,
        version: rule.version,
        priority: rule.priority,
        isRequired: rule.isRequired,
        category: rule.category,
        createdBy: rule.creator ? {
          id: rule.creator.id,
          name: rule.creator.name ?? 'Unknown',
        } : null,
        createdAt: rule.createdAt.toISOString(),
        updatedAt: rule.updatedAt.toISOString(),
        stats: {
          applicationCount: totalApps,
          successRate: totalApps > 0 ? (successApps / totalApps) * 100 : null,
          lastAppliedAt: lastApp?.createdAt.toISOString() || null,
        },
      }
    })

    // 處理狀態摘要
    const statusMap = statusCounts.reduce(
      (acc, s) => {
        acc[s.status] = s._count.id
        return acc
      },
      {} as Record<string, number>
    )

    const summary: RulesSummary = {
      totalRules: await prisma.mappingRule.count({
        where: { isActive: true },
      }),
      activeRules: statusMap['ACTIVE'] || 0,
      draftRules: statusMap['DRAFT'] || 0,
      pendingReviewRules: statusMap['PENDING_REVIEW'] || 0,
      deprecatedRules: statusMap['DEPRECATED'] || 0,
      universalRules: universalCount,
    }

    return NextResponse.json({
      success: true,
      data: {
        rules: rulesWithStats,
        pagination: {
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        },
        summary,
      },
    })
  } catch (error) {
    console.error('Get rules error:', error)

    return NextResponse.json(
      {
        type: 'internal_error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to fetch rules',
      },
      { status: 500 }
    )
  }
}
