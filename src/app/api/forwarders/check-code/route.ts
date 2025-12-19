/**
 * @fileoverview Forwarder 代碼檢查 API 端點
 * @description
 *   提供 Forwarder 代碼唯一性檢查的 API。
 *   用於表單即時驗證，避免創建重複代碼的 Forwarder。
 *   需要認證和 FORWARDER_VIEW 權限才能存取。
 *
 *   端點：
 *   - GET /api/forwarders/check-code?code=XXX - 檢查代碼是否已存在
 *
 * @module src/app/api/forwarders/check-code/route
 * @author Development Team
 * @since Epic 5 - Story 5.5 (新增/停用貨代商配置)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 代碼唯一性檢查
 *   - 即時驗證支援
 *   - Debounce 友好的快速響應
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/services/forwarder.service - Forwarder 服務
 *   - @/types/forwarder - 類型定義
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { forwarderCodeExists } from '@/services/forwarder.service'
import { CheckCodeSchema } from '@/types/forwarder'
import { hasPermission } from '@/lib/auth/city-permission'
import { PERMISSIONS } from '@/types/permissions'

/**
 * GET /api/forwarders/check-code
 * 檢查 Forwarder 代碼是否已存在
 *
 * @description
 *   用於表單即時驗證，檢查代碼是否已被使用。
 *   需要 FORWARDER_VIEW 權限。
 *
 * @param request - HTTP 請求
 * @returns 代碼是否可用
 *
 * @example
 *   GET /api/forwarders/check-code?code=DHL
 *
 *   Response (代碼已存在):
 *   {
 *     "success": true,
 *     "data": {
 *       "code": "DHL",
 *       "available": false,
 *       "message": "此代碼已被使用"
 *     }
 *   }
 *
 *   Response (代碼可用):
 *   {
 *     "success": true,
 *     "data": {
 *       "code": "NEWCODE",
 *       "available": true,
 *       "message": "此代碼可以使用"
 *     }
 *   }
 */
export async function GET(request: NextRequest) {
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
            detail: 'You do not have permission to check forwarder codes',
          },
        },
        { status: 403 }
      )
    }

    // 3. 解析查詢參數
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')

    // 4. 驗證查詢參數
    const validationResult = CheckCodeSchema.safeParse({ code })

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: 'Invalid code format',
            errors: validationResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      )
    }

    const validatedCode = validationResult.data.code

    // 5. 檢查代碼是否存在
    const exists = await forwarderCodeExists(validatedCode)

    // 6. 返回結果
    return NextResponse.json({
      success: true,
      data: {
        code: validatedCode,
        available: !exists,
        message: exists ? '此代碼已被使用' : '此代碼可以使用',
      },
    })
  } catch (error) {
    console.error('Check code error:', error)

    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'https://api.example.com/errors/internal-server-error',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Failed to check code availability',
        },
      },
      { status: 500 }
    )
  }
}
