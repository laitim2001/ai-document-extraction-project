/**
 * @fileoverview 重新發送驗證郵件 API 端點
 * @description
 *   處理重新發送驗證郵件的請求，包含：
 *   - 速率限制（每小時 5 次）
 *   - 產生新 Token 並使舊 Token 失效
 *   - 安全考量：無論郵件是否存在都返回相同訊息
 *
 * @module src/app/api/auth/resend-verification
 * @author Development Team
 * @since Epic 18 - Story 18.4 (Email Verification)
 * @lastModified 2026-01-19
 *
 * @dependencies
 *   - @/lib/prisma - Prisma 客戶端
 *   - @/lib/token - Token 工具
 *   - @/lib/email - 郵件服務
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateToken, getTokenExpiry } from '@/lib/token'
import { sendVerificationEmail } from '@/lib/email'
import { z } from 'zod'

/**
 * 重新發送驗證請求的驗證 Schema
 */
const resendSchema = z.object({
  email: z.string().email('Invalid email address'),
})

/**
 * 速率限制配置
 */
const RATE_LIMIT = 5 // 每小時最多 5 次
const RATE_LIMIT_WINDOW = 60 * 60 * 1000 // 1 小時（毫秒）

/**
 * 簡單的內存速率限制器
 *
 * @description
 *   生產環境建議使用 Redis 進行分佈式速率限制。
 *   此實現僅適用於單實例部署。
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

/**
 * 檢查速率限制
 *
 * @param email - 要檢查的電子郵件
 * @returns 是否通過速率限制（true = 允許，false = 已達限制）
 */
function checkRateLimit(email: string): boolean {
  const now = Date.now()
  const normalizedEmail = email.toLowerCase()
  const record = rateLimitMap.get(normalizedEmail)

  // 無記錄或已過期，重置計數
  if (!record || now > record.resetTime) {
    rateLimitMap.set(normalizedEmail, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    })
    return true
  }

  // 檢查是否超過限制
  if (record.count >= RATE_LIMIT) {
    return false
  }

  // 增加計數
  record.count++
  return true
}

/**
 * POST /api/auth/resend-verification
 *
 * @description
 *   處理重新發送驗證郵件的請求。
 *
 *   處理流程：
 *   1. 驗證請求資料
 *   2. 檢查速率限制
 *   3. 查詢用戶
 *   4. 檢查用戶狀態（是否已驗證、是否為本地帳號）
 *   5. 產生新 Token 並更新資料庫
 *   6. 發送驗證郵件
 *
 *   安全考量：
 *   - 無論郵件是否存在，都返回相同的成功訊息
 *   - 速率限制防止濫用
 *
 * @returns {Promise<NextResponse>}
 *   - 200: 成功（或用戶不存在，為安全考量返回相同訊息）
 *   - 400: 驗證失敗
 *   - 429: 超過速率限制
 *   - 500: 伺服器錯誤
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // 驗證請求資料
    const { email } = resendSchema.parse(body)
    const normalizedEmail = email.toLowerCase()

    // 檢查速率限制
    if (!checkRateLimit(normalizedEmail)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/rate-limit',
            title: 'Too Many Requests',
            status: 429,
            detail: 'Too many requests. Please try again later.',
          },
        },
        { status: 429 }
      )
    }

    // 查詢用戶
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    // 安全考量：無論用戶是否存在，都返回相同訊息
    if (!user) {
      return NextResponse.json({
        success: true,
        message:
          'If an account exists with this email, a verification link has been sent.',
      })
    }

    // 已驗證的用戶
    if (user.emailVerified) {
      return NextResponse.json({
        success: true,
        message: 'Your email is already verified. You can log in now.',
        alreadyVerified: true,
      })
    }

    // 只有本地帳號（有密碼）可以重發驗證郵件
    // SSO 用戶（無密碼）無需郵件驗證
    if (!user.password) {
      return NextResponse.json({
        success: true,
        message:
          'If an account exists with this email, a verification link has been sent.',
      })
    }

    // 產生新 Token（64 字元的十六進制字串）
    const token = generateToken(32)
    const expires = getTokenExpiry(24) // 24 小時

    // 更新用戶的驗證 Token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: token,
        emailVerificationExpires: expires,
      },
    })

    // 發送驗證郵件（異步，不阻塞回應）
    sendVerificationEmail(user.email, user.name, token).catch((emailError) => {
      console.error('Failed to send verification email:', emailError)
    })

    return NextResponse.json({
      success: true,
      message: 'Verification email has been sent. Please check your inbox.',
    })
  } catch (error) {
    // Zod 驗證錯誤
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: 'Invalid email address',
          },
        },
        { status: 400 }
      )
    }

    // 其他錯誤
    console.error('Resend verification error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'https://api.example.com/errors/internal',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Failed to send verification email. Please try again later.',
        },
      },
      { status: 500 }
    )
  }
}
