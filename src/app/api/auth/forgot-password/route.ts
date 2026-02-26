/**
 * @fileoverview 忘記密碼 API
 * @description
 *   處理忘記密碼請求，產生重設 Token 並發送郵件。
 *
 *   安全考量：
 *   - 無論郵件是否註冊，都返回相同的成功訊息
 *   - 只有本地帳號（有密碼的用戶）可以重設密碼
 *   - Token 有效期為 1 小時
 *
 * @module src/app/api/auth/forgot-password/route
 * @author Development Team
 * @since Epic 18 - Story 18.3 (Password Reset)
 * @lastModified 2026-01-19
 *
 * @dependencies
 *   - @/lib/prisma - 資料庫客戶端
 *   - @/lib/token - Token 產生工具
 *   - @/lib/email - 郵件發送服務
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { generateToken, getTokenExpiry } from '@/lib/token'
import { sendPasswordResetEmail } from '@/lib/email'

// ============================================================
// Validation Schema
// ============================================================

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
})

// ============================================================
// API Route Handler
// ============================================================

/**
 * POST /api/auth/forgot-password
 *
 * @description
 *   處理忘記密碼請求。
 *   查詢用戶但不洩漏是否存在（安全考量）。
 *   只有本地帳號可以重設密碼。
 *
 * @param request - 包含 email 的 JSON body
 * @returns 成功訊息（無論郵件是否註冊）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // 驗證輸入
    const validationResult = forgotPasswordSchema.safeParse(body)
    if (!validationResult.success) {
      // 不洩漏詳細錯誤，返回通用成功訊息
      return NextResponse.json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.',
      })
    }

    const { email } = validationResult.data

    // 查詢用戶（不洩漏是否存在）
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        name: true,
        password: true, // 只有本地帳號有密碼
      },
    })

    // 如果用戶存在且是本地帳號（有密碼）
    if (user && user.password) {
      // 產生重設 Token（32 bytes = 64 字元 hex）
      const token = generateToken(32)
      const expires = getTokenExpiry(1) // 1 小時後過期

      // 更新用戶的重設 Token
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: token,
          passwordResetExpires: expires,
        },
      })

      // 發送密碼重設郵件
      await sendPasswordResetEmail(user.email, user.name, token)
    }

    // 無論用戶是否存在，都返回相同訊息（安全考量）
    return NextResponse.json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent.',
    })
  } catch (error) {
    console.error('[forgot-password] Error:', error)

    // 即使發生錯誤，也不洩漏詳細資訊
    return NextResponse.json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent.',
    })
  }
}
