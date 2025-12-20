/**
 * @fileoverview Forwarder 啟用 API 端點
 * @description
 *   提供 Forwarder 啟用功能的 API。
 *   啟用時可選擇同時恢復之前停用的規則。
 *   需要認證和 FORWARDER_MANAGE 權限才能存取。
 *
 *   端點：
 *   - POST /api/forwarders/[id]/activate - 啟用 Forwarder
 *
 * @module src/app/api/forwarders/[id]/activate/route
 * @author Development Team
 * @since Epic 5 - Story 5.5 (新增/停用貨代商配置)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 啟用 Forwarder（狀態改為 ACTIVE）
 *   - 可選同時恢復相關規則
 *   - 返回恢復的規則數量
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
import { activateForwarder, getForwarderById } from '@/services/forwarder.service'
import { ForwarderIdSchema, ActivateForwarderSchema } from '@/types/forwarder'
import { hasPermission } from '@/lib/auth/city-permission'
import { PERMISSIONS } from '@/types/permissions'

/**
 * POST /api/forwarders/[id]/activate
 * 啟用 Forwarder
 *
 * @description
 *   將 Forwarder 狀態從 INACTIVE 或 PENDING 改為 ACTIVE。
 *   可選擇同時將 DEPRECATED 規則恢復為 ACTIVE。
 *   需要 FORWARDER_MANAGE 權限。
 *
 * @param request - HTTP 請求
 * @param context - 路由參數（包含 id）
 * @returns 啟用結果，包含恢復的規則數量
 *
 * @example
 *   POST /api/forwarders/cuid123/activate
 *   Content-Type: application/json
 *
 *   {
 *     "reactivateRules": true
 *   }
 *
 *   Response:
 *   {
 *     "success": true,
 *     "data": {
 *       "id": "cuid123",
 *       "name": "DHL Express",
 *       "code": "DHL",
 *       "status": "ACTIVE",
 *       "reactivatedRulesCount": 20
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
            detail: 'You do not have permission to activate forwarders',
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
            instance: `/api/forwarders/${forwarderId}/activate`,
          },
        },
        { status: 404 }
      )
    }

    // 5. 檢查是否已啟用
    if (existingForwarder.status === 'ACTIVE') {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/conflict',
            title: 'Conflict',
            status: 409,
            detail: 'Forwarder is already active',
          },
        },
        { status: 409 }
      )
    }

    // 6. 解析請求體
    const body = await request.json().catch(() => ({}))
    const validationResult = ActivateForwarderSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: 'Invalid activation options',
            errors: validationResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      )
    }

    const { reactivateRules } = validationResult.data

    // 7. 執行啟用
    const result = await activateForwarder(forwarderId, {
      reactivateRules,
    })

    // 8. 創建審計日誌
    await prisma.auditLog.create({
      data: {
        action: 'CONFIGURE',
        resourceType: 'forwarder',
        resourceId: forwarderId,
        resourceName: result.name,
        userId: session.user.id,
        userName: session.user.name || 'Unknown',
        description: `Activated forwarder: ${result.name}`,
        metadata: {
          forwarderName: result.name,
          forwarderCode: existingForwarder.code,
          previousStatus: existingForwarder.status,
          reactivateRules,
          rulesAffected: result.rulesAffected,
        },
        status: 'SUCCESS',
      },
    })

    // 9. 返回成功響應
    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('Activate forwarder error:', error)

    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'https://api.example.com/errors/internal-server-error',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Failed to activate forwarder',
        },
      },
      { status: 500 }
    )
  }
}
