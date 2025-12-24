/**
 * @fileoverview 升級案例詳情 API 端點
 * @description
 *   提供 Super User 查看升級案例詳情的功能：
 *   - 獲取完整的升級案例資訊
 *   - 包含文件、提取結果、修正記錄
 *   - 權限檢查：僅 Super User 可訪問
 *
 *   端點：
 *   - GET /api/escalations/[id] - 獲取升級案例詳情
 *
 * @module src/app/api/escalations/[id]/route
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
 *   - src/hooks/useEscalationDetail.ts - React Query Hook
 *   - src/types/escalation.ts - 類型定義
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/types/permissions'

// ============================================================
// Types
// ============================================================

interface RouteParams {
  params: Promise<{ id: string }>
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 檢查用戶是否為 Super User
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
// GET /api/escalations/[id]
// ============================================================

/**
 * GET /api/escalations/[id]
 * 獲取升級案例詳情
 *
 * @description
 *   返回完整的升級案例資訊，包含：
 *   - 升級記錄基本資訊
 *   - 關聯的文件資訊
 *   - 文件的提取結果（欄位列表）
 *   - 已有的修正記錄
 *   - 升級發起者和處理者資訊
 *
 * @returns 升級案例詳情
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

    // 權限檢查：僅 Super User 可訪問
    if (!isSuperUser(session.user.roles)) {
      return NextResponse.json(
        {
          type: 'forbidden',
          title: 'Forbidden',
          status: 403,
          detail: 'Super User permission required to access escalation details',
        },
        { status: 403 }
      )
    }

    const { id: escalationId } = await params

    // 獲取升級案例詳情
    const escalation = await prisma.escalation.findUnique({
      where: { id: escalationId },
      include: {
        document: {
          include: {
            company: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            extractionResult: {
              select: {
                fieldMappings: true,
                totalFields: true,
              },
            },
            ocrResult: {
              select: {
                pageCount: true,
              },
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
          },
        },
        resolver: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!escalation) {
      return NextResponse.json(
        {
          type: 'not_found',
          title: 'Not Found',
          status: 404,
          detail: `Escalation with ID ${escalationId} not found`,
          instance: `/api/escalations/${escalationId}`,
        },
        { status: 404 }
      )
    }

    // 獲取修正記錄
    const corrections = await prisma.correction.findMany({
      where: { documentId: escalation.documentId },
      select: {
        id: true,
        fieldName: true,
        originalValue: true,
        correctedValue: true,
        correctionType: true,
      },
    })

    // 格式化提取結果欄位
    // fieldMappings 是 JSON 格式: { [fieldName]: { value, confidence, ... } }
    const fieldMappings = escalation.document.extractionResult?.fieldMappings as Record<
      string,
      { value: string | null; confidence: number; position?: unknown }
    > | null
    const formattedFields = fieldMappings
      ? Object.entries(fieldMappings).map(([fieldName, data], index) => ({
          id: `field-${index}`,
          name: fieldName,
          value: data?.value ?? null,
          confidence: data?.confidence ?? 0,
          sourcePosition: data?.position || undefined,
        }))
      : []

    // 格式化響應數據
    const data = {
      id: escalation.id,
      status: escalation.status,
      reason: escalation.reason,
      reasonDetail: escalation.reasonDetail,
      createdAt: escalation.createdAt.toISOString(),
      resolvedAt: escalation.resolvedAt?.toISOString() || null,
      resolution: escalation.resolution,
      escalatedBy: {
        id: escalation.escalator.id,
        name: escalation.escalator.name,
        email: escalation.escalator.email,
      },
      assignee: escalation.assignee
        ? {
            id: escalation.assignee.id,
            name: escalation.assignee.name,
          }
        : null,
      resolvedBy: escalation.resolver
        ? {
            id: escalation.resolver.id,
            name: escalation.resolver.name,
          }
        : null,
      document: {
        id: escalation.document.id,
        fileName: escalation.document.fileName,
        originalName: null, // 如有此欄位可從 document 獲取
        fileUrl: escalation.document.filePath,
        status: escalation.document.status,
        pageCount: escalation.document.ocrResult?.pageCount || 1,
        company: escalation.document.company
          ? {
              id: escalation.document.company.id,
              name: escalation.document.company.name,
              code: escalation.document.company.code,
            }
          : null,
        extractionResult: formattedFields.length > 0
          ? { fields: formattedFields }
          : null,
      },
      corrections: corrections.map((c) => ({
        id: c.id,
        fieldName: c.fieldName,
        originalValue: c.originalValue,
        correctedValue: c.correctedValue,
        correctionType: c.correctionType,
      })),
    }

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error) {
    console.error('Get escalation detail error:', error)

    return NextResponse.json(
      {
        type: 'internal_error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to fetch escalation details',
      },
      { status: 500 }
    )
  }
}
