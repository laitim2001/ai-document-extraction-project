/**
 * @fileoverview 升級案例列表 API 端點
 * @description
 *   提供 Super User 查看升級案例列表的功能：
 *   - 獲取所有升級案例
 *   - 支持狀態和原因篩選
 *   - 支持分頁和排序
 *   - 權限檢查：僅 Super User 可訪問
 *
 *   端點：
 *   - GET /api/escalations - 獲取升級案例列表
 *
 * @module src/app/api/escalations/route
 * @since Epic 3 - Story 3.8 (Super User 處理升級案例)
 * @lastModified 2025-12-22
 * @refactor REFACTOR-001 (Forwarder → Company)
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/lib/prisma - Prisma 客戶端
 *   - @/types/permissions - 權限常量
 *
 * @related
 *   - src/hooks/useEscalationList.ts - React Query Hook
 *   - src/types/escalation.ts - 類型定義
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/types/permissions'
import type { EscalationStatus, EscalationReason, Prisma } from '@prisma/client'

// ============================================================
// Helper Functions
// ============================================================

/**
 * 檢查用戶是否為 Super User
 * Super User 必須擁有 RULE_MANAGE 權限
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

// ============================================================
// GET /api/escalations
// ============================================================

/**
 * GET /api/escalations
 * 獲取升級案例列表
 *
 * @description
 *   查詢參數：
 *   - status: 過濾狀態 (PENDING | IN_PROGRESS | RESOLVED | CANCELLED)
 *   - reason: 過濾原因 (UNKNOWN_COMPANY | RULE_NOT_APPLICABLE | POOR_QUALITY | OTHER)
 *   - page: 頁碼（從 1 開始）
 *   - pageSize: 每頁數量（預設 20）
 *   - sortBy: 排序欄位 (createdAt | priority)
 *   - sortOrder: 排序順序 (asc | desc)
 *
 * @returns 升級案例列表和分頁資訊
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

    // 權限檢查：僅 Super User 可訪問
    if (!isSuperUser(session.user.roles)) {
      return NextResponse.json(
        {
          type: 'forbidden',
          title: 'Forbidden',
          status: 403,
          detail: 'Super User permission required to access escalations',
        },
        { status: 403 }
      )
    }

    // 解析查詢參數
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as EscalationStatus | null
    const reason = searchParams.get('reason') as EscalationReason | null
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10))
    )
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // 構建查詢條件
    const where: Prisma.EscalationWhereInput = {}

    if (status) {
      where.status = status
    }

    if (reason) {
      where.reason = reason
    }

    // 構建排序條件
    // 注意：priority 排序會優先顯示較早的案例
    const orderBy: Prisma.EscalationOrderByWithRelationInput =
      sortBy === 'priority'
        ? { createdAt: 'asc' }
        : { [sortBy]: sortOrder as 'asc' | 'desc' }

    // 執行查詢
    const [escalations, total] = await Promise.all([
      prisma.escalation.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          document: {
            select: {
              id: true,
              fileName: true,
              company: {
                select: { name: true },
              },
            },
          },
          escalator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          assignee: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      prisma.escalation.count({ where }),
    ])

    // 格式化響應數據
    const data = escalations.map((escalation) => ({
      id: escalation.id,
      document: {
        id: escalation.document.id,
        fileName: escalation.document.fileName,
        company: escalation.document.company,
      },
      escalatedBy: {
        id: escalation.escalator.id,
        name: escalation.escalator.name,
        email: escalation.escalator.email,
      },
      reason: escalation.reason,
      reasonDetail: escalation.reasonDetail,
      status: escalation.status,
      assignedTo: escalation.assignee
        ? {
            id: escalation.assignee.id,
            name: escalation.assignee.name,
            email: escalation.assignee.email,
          }
        : null,
      createdAt: escalation.createdAt.toISOString(),
      resolvedAt: escalation.resolvedAt?.toISOString() || null,
    }))

    return NextResponse.json({
      success: true,
      data,
      meta: {
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    })
  } catch (error) {
    console.error('Get escalations error:', error)

    return NextResponse.json(
      {
        type: 'internal_error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to fetch escalations',
      },
      { status: 500 }
    )
  }
}
