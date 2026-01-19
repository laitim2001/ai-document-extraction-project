/**
 * @fileoverview 郵件驗證 API 端點
 * @description
 *   處理電子郵件驗證請求，包含：
 *   - 驗證 Token 有效性
 *   - 處理過期 Token
 *   - 處理無效/已使用 Token
 *   - 更新用戶 emailVerified 狀態
 *
 * @module src/app/api/auth/verify-email
 * @author Development Team
 * @since Epic 18 - Story 18.4 (Email Verification)
 * @lastModified 2026-01-19
 *
 * @dependencies
 *   - @/lib/prisma - Prisma 客戶端
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/auth/verify-email
 *
 * @description
 *   處理郵件驗證連結。
 *
 *   處理流程：
 *   1. 提取 Token 和 locale 參數
 *   2. 查詢 Token 對應的用戶
 *   3. 檢查 Token 是否有效/過期
 *   4. 更新 emailVerified 並刪除 Token
 *   5. 重導向至對應結果頁面
 *
 * @returns {Promise<NextResponse>} 重導向至驗證結果頁面
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  const locale = request.nextUrl.searchParams.get('locale') || 'en'

  // 無 Token 參數
  if (!token) {
    return NextResponse.redirect(
      new URL(`/${locale}/auth/verify-email?status=invalid`, request.url)
    )
  }

  try {
    // 查詢 Token 對應的用戶（包含有效期檢查）
    const user = await prisma.user.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerificationExpires: { gt: new Date() },
      },
    })

    if (!user) {
      // 檢查是否為過期 Token（Token 存在但已過期）
      const expiredUser = await prisma.user.findFirst({
        where: { emailVerificationToken: token },
      })

      if (expiredUser) {
        // Token 存在但已過期
        return NextResponse.redirect(
          new URL(
            `/${locale}/auth/verify-email?status=expired&email=${encodeURIComponent(expiredUser.email)}`,
            request.url
          )
        )
      }

      // Token 不存在或已被使用
      return NextResponse.redirect(
        new URL(`/${locale}/auth/verify-email?status=invalid`, request.url)
      )
    }

    // 檢查用戶是否已驗證
    if (user.emailVerified) {
      return NextResponse.redirect(
        new URL(`/${locale}/auth/verify-email?status=already_verified`, request.url)
      )
    }

    // 更新驗證狀態並刪除 Token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    })

    // 驗證成功，重導向至登入頁面
    return NextResponse.redirect(
      new URL(`/${locale}/auth/login?verified=true`, request.url)
    )
  } catch (error) {
    console.error('Email verification error:', error)
    return NextResponse.redirect(
      new URL(`/${locale}/auth/verify-email?status=error`, request.url)
    )
  }
}
