/**
 * @fileoverview 重設密碼 API
 * @description
 *   處理密碼重設請求，驗證 Token 並更新密碼。
 *
 *   安全考量：
 *   - 驗證 Token 有效性和過期時間
 *   - 驗證密碼強度
 *   - 使用後立即清除 Token
 *   - 發送密碼變更通知郵件
 *
 * @module src/app/api/auth/reset-password/route
 * @author Development Team
 * @since Epic 18 - Story 18.3 (Password Reset)
 * @lastModified 2026-01-19
 *
 * @dependencies
 *   - @/lib/prisma - 資料庫客戶端
 *   - @/lib/password - 密碼加密和驗證
 *   - @/lib/email - 郵件發送服務
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { hashPassword, validatePasswordStrength } from '@/lib/password'
import { sendPasswordChangedEmail } from '@/lib/email'

// ============================================================
// Validation Schema
// ============================================================

const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Token is required'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

// ============================================================
// API Route Handler
// ============================================================

/**
 * POST /api/auth/reset-password
 *
 * @description
 *   處理密碼重設請求。
 *   驗證 Token 有效性，更新密碼，清除 Token，發送通知。
 *
 * @param request - 包含 token, password, confirmPassword 的 JSON body
 * @returns 成功或錯誤訊息
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // 驗證輸入
    const validationResult = resetPasswordSchema.safeParse(body)
    if (!validationResult.success) {
      const errors = validationResult.error.flatten()
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: errors.fieldErrors,
        },
        { status: 400 }
      )
    }

    const { token, password } = validationResult.data

    // 查詢具有有效 Token 的用戶
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: { gt: new Date() },
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid or expired reset token',
        },
        { status: 400 }
      )
    }

    // 驗證密碼強度
    const passwordCheck = validatePasswordStrength(password)
    if (!passwordCheck.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Password does not meet requirements',
          details: passwordCheck.errors,
        },
        { status: 400 }
      )
    }

    // 加密新密碼
    const hashedPassword = await hashPassword(password)

    // 更新密碼並清除 Token（原子操作）
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    })

    // 發送密碼變更通知郵件
    await sendPasswordChangedEmail(user.email, user.name)

    return NextResponse.json({
      success: true,
      message: 'Password has been reset successfully.',
    })
  } catch (error) {
    console.error('[reset-password] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Password reset failed. Please try again.',
      },
      { status: 500 }
    )
  }
}
