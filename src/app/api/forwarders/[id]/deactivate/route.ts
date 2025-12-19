/**
 * @fileoverview Forwarder 停用 API 端點
 * @description
 *   提供 Forwarder 停用功能的 API。
 *   停用時可選擇同時停用相關規則。
 *   需要認證和 FORWARDER_MANAGE 權限才能存取。
 *
 *   端點：
 *   - POST /api/forwarders/[id]/deactivate - 停用 Forwarder
 *
 * @module src/app/api/forwarders/[id]/deactivate/route
 * @author Development Team
 * @since Epic 5 - Story 5.5 (新增/停用貨代商配置)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 停用 Forwarder（狀態改為 INACTIVE）
 *   - 可選同時停用相關規則
 *   - 返回受影響的規則數量
 *   - 審計日誌記錄
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/services/forwarder.service - Forwarder 服務
 *   - @/types/forwarder - 類型定義
 *   - @/lib/prisma - Prisma Client
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { deactivateForwarder, getForwarderById } from '@/services/forwarder.service'
import { ForwarderIdSchema, DeactivateForwarderSchema } from '@/types/forwarder'
import { hasPermission } from '@/lib/auth/city-permission'
import { PERMISSIONS } from '@/types/permissions'

/**
 * POST /api/forwarders/[id]/deactivate
 * 停用 Forwarder
 *
 * @description
 *   將 Forwarder 狀態從 ACTIVE 改為 INACTIVE。
 *   可選擇同時將相關規則標記為 DEPRECATED。
 *   需要 FORWARDER_MANAGE 權限。
 *
 * @param request - HTTP 請求
 * @param context - 路由參數（包含 id）
 * @returns 停用結果，包含受影響的規則數量
 *
 * @example
 *   POST /api/forwarders/cuid123/deactivate
 *   Content-Type: application/json
 *
 *   {
 *     "reason": "不再使用此貨代商",
 *     "deactivateRules": true
 *   }
 *
 *   Response:
 *   {
 *     "success": true,
 *     "data": {
 *       "id": "cuid123",
 *       "name": "DHL Express",
 *       "code": "DHL",
 *       "status": "INACTIVE",
 *       "deactivatedRulesCount": 25
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
    const canManage = hasPermission(session.user, PERMISSIONS.FORWARDER_MANAGE)
    if (!canManage) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/forbidden',
            title: 'Forbidden',
            status: 403,
            detail: 'You do not have permission to deactivate forwarders',
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

    const forwarderId = idValidation.data.id

    // 4. 檢查 Forwarder 是否存在
    const existingForwarder = await getForwarderById(forwarderId)
    if (!existingForwarder) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/not-found',
            title: 'Not Found',
            status: 404,
            detail: `Forwarder with ID '${forwarderId}' not found`,
            instance: `/api/forwarders/${forwarderId}/deactivate`,
          },
        },
        { status: 404 }
      )
    }

    // 5. 檢查是否已停用
    if (existingForwarder.status === 'INACTIVE') {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/conflict',
            title: 'Conflict',
            status: 409,
            detail: 'Forwarder is already inactive',
          },
        },
        { status: 409 }
      )
    }

    // 6. 解析請求體
    const body = await request.json().catch(() => ({}))
    const validationResult = DeactivateForwarderSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: 'Invalid deactivation options',
            errors: validationResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      )
    }

    const { reason, deactivateRules } = validationResult.data

    // 7. 執行停用
    const result = await deactivateForwarder(forwarderId, {
      reason,
      deactivateRules,
    })

    // 8. 創建審計日誌
    await prisma.auditLog.create({
      data: {
        action: 'FORWARDER_DEACTIVATED',
        entityType: 'Forwarder',
        entityId: forwarderId,
        userId: session.user.id,
        details: {
          forwarderName: result.name,
          forwarderCode: existingForwarder.code,
          reason,
          deactivateRules,
          rulesAffected: result.rulesAffected,
        },
      },
    })

    // 9. 返回成功響應
    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('Deactivate forwarder error:', error)

    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'https://api.example.com/errors/internal-server-error',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Failed to deactivate forwarder',
        },
      },
      { status: 500 }
    )
  }
}
