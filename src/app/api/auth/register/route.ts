/**
 * @fileoverview 用戶註冊 API 端點
 * @description
 *   處理用戶註冊請求，包含：
 *   - 驗證輸入資料
 *   - 檢查電子郵件唯一性
 *   - 密碼加密存儲
 *   - 指派預設角色
 *   - 發送驗證郵件
 *
 * @module src/app/api/auth/register
 * @author Development Team
 * @since Epic 18 - Story 18.1
 * @lastModified 2026-01-19
 *
 * @dependencies
 *   - @/lib/prisma - Prisma 客戶端
 *   - @/lib/password - 密碼工具
 *   - @/lib/token - Token 工具
 *   - @/lib/email - 郵件服務
 *   - @/validations/auth - 驗證 Schema
 *   - @/services/role.service - 角色服務
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, validatePasswordStrength } from '@/lib/password'
import { generateToken, getTokenExpiry } from '@/lib/token'
import { sendVerificationEmail } from '@/lib/email'
import { registerSchema } from '@/validations/auth'
import { getRoleByName } from '@/services/role.service'
import { DEFAULT_ROLE } from '@/types/role-permissions'
import { z } from 'zod'

/**
 * POST /api/auth/register
 *
 * @description
 *   處理用戶註冊請求。
 *
 *   處理流程：
 *   1. 驗證請求資料
 *   2. 額外密碼強度檢查
 *   3. 檢查電子郵件是否已存在
 *   4. 加密密碼
 *   5. 產生驗證 Token
 *   6. 建立用戶
 *   7. 指派預設角色
 *   8. 發送驗證郵件
 *
 * @returns {Promise<NextResponse>}
 *   - 201: 註冊成功
 *   - 400: 驗證失敗
 *   - 409: 電子郵件已被使用
 *   - 500: 伺服器錯誤
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // 驗證請求資料
    const validatedData = registerSchema.parse(body)

    // 額外密碼強度檢查
    const passwordCheck = validatePasswordStrength(validatedData.password)
    if (!passwordCheck.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Password Requirements Not Met',
            status: 400,
            detail: 'Password does not meet security requirements',
            errors: passwordCheck.errors,
          },
        },
        { status: 400 }
      )
    }

    // 檢查電子郵件是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email.toLowerCase() },
    })

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/conflict',
            title: 'Email Already Registered',
            status: 409,
            detail: 'This email address is already registered',
          },
        },
        { status: 409 }
      )
    }

    // 加密密碼
    const hashedPassword = await hashPassword(validatedData.password)

    // 產生驗證 Token（64 字元的十六進制字串）
    const verificationToken = generateToken(32)
    const verificationExpires = getTokenExpiry(24) // 24 小時

    // 建立用戶
    const user = await prisma.user.create({
      data: {
        name: validatedData.name,
        email: validatedData.email.toLowerCase(),
        password: hashedPassword,
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
        status: 'ACTIVE',
      },
    })

    // 指派預設角色
    const defaultRole = await getRoleByName(DEFAULT_ROLE)
    if (defaultRole) {
      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: defaultRole.id,
        },
      })
    }

    // 發送驗證郵件（異步，不阻塞回應）
    sendVerificationEmail(user.email, user.name, verificationToken).catch(
      (emailError) => {
        console.error('Failed to send verification email:', emailError)
        // 不阻止註冊流程
      }
    )

    return NextResponse.json(
      {
        success: true,
        message:
          'Registration successful. Please check your email to verify your account.',
        data: {
          userId: user.id,
          email: user.email,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    // Zod 驗證錯誤
    if (error instanceof z.ZodError) {
      const fieldErrors: Record<string, string[]> = {}
      for (const issue of error.issues) {
        const path = issue.path.join('.')
        if (!fieldErrors[path]) {
          fieldErrors[path] = []
        }
        fieldErrors[path].push(issue.message)
      }

      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: 'One or more fields failed validation',
            errors: fieldErrors,
          },
        },
        { status: 400 }
      )
    }

    // 其他錯誤
    console.error('Registration error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'https://api.example.com/errors/internal',
          title: 'Registration Failed',
          status: 500,
          detail: 'An unexpected error occurred during registration',
        },
      },
      { status: 500 }
    )
  }
}
