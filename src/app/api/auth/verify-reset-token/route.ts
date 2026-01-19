/**
 * @fileoverview Token 驗證 API
 * @description
 *   驗證密碼重設 Token 是否有效。
 *   用於重設密碼頁面在顯示表單前先驗證 Token。
 *
 * @module src/app/api/auth/verify-reset-token/route
 * @author Development Team
 * @since Epic 18 - Story 18.3 (Password Reset)
 * @lastModified 2026-01-19
 *
 * @dependencies
 *   - @/lib/prisma - 資料庫客戶端
 */

import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'

// ============================================================
// Helper Functions
// ============================================================

/**
 * 遮蔽電子郵件地址
 *
 * @description
 *   將電子郵件部分隱藏，只顯示前兩個字元和域名。
 *   例如：john.doe@example.com → jo***@example.com
 *
 * @param email - 完整電子郵件地址
 * @returns 遮蔽後的電子郵件
 */
function maskEmail(email: string): string {
  const [name, domain] = email.split('@')
  if (!name || !domain) return '***@***'

  const maskedName = name.length > 2 ? name.slice(0, 2) + '***' : '***'
  return `${maskedName}@${domain}`
}

// ============================================================
// API Route Handler
// ============================================================

/**
 * GET /api/auth/verify-reset-token?token=xxx
 *
 * @description
 *   驗證密碼重設 Token 是否有效。
 *   返回 Token 有效性和遮蔽後的郵件地址。
 *
 * @param request - 包含 token query parameter
 * @returns { valid: boolean, email?: string }
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token')

    if (!token) {
      return NextResponse.json({
        valid: false,
        message: 'Token is required',
      })
    }

    // 查詢具有有效 Token 的用戶
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: { gt: new Date() },
      },
      select: {
        email: true,
      },
    })

    if (!user) {
      return NextResponse.json({
        valid: false,
        message: 'Invalid or expired token',
      })
    }

    return NextResponse.json({
      valid: true,
      email: maskEmail(user.email),
    })
  } catch (error) {
    console.error('[verify-reset-token] Error:', error)
    return NextResponse.json({
      valid: false,
      message: 'Verification failed',
    })
  }
}
