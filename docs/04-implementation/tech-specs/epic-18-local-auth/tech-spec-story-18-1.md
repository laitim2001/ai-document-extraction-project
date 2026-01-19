# Story 18-1: User Registration - Technical Specification

**Version:** 1.0
**Created:** 2026-01-19
**Status:** Ready for Development
**Story Key:** 18-1-user-registration

---

## Overview

| Field | Value |
|-------|-------|
| Story ID | 18.1 |
| Epic | Epic 18: 本地帳號認證系統 |
| Estimated Effort | 1.5 天 |
| Dependencies | Prisma ORM, shadcn/ui, next-intl |
| Blocking | Story 18-2 (本地帳號登入) |

---

## Objective

實現用戶註冊功能，允許用戶透過電子郵件和密碼建立本地帳號。包含密碼加密存儲、郵件驗證 Token 產生、以及驗證郵件發送。

---

## Acceptance Criteria Mapping

| AC | Description | Technical Implementation |
|----|-------------|-------------------------|
| AC1 | 註冊表單顯示 | React Hook Form + shadcn/ui |
| AC2 | 表單驗證 | Zod Schema + 即時驗證 |
| AC3 | 註冊成功 | API 端點 + bcrypt + 郵件服務 |
| AC4 | 電子郵件重複檢查 | Prisma unique 查詢 |
| AC5 | 密碼安全要求 | 密碼強度驗證函數 |

---

## Prerequisites

### 環境變數配置

```bash
# .env.local 新增
# Email Service
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_USER="your-email@example.com"
SMTP_PASSWORD="your-smtp-password"
SMTP_FROM="noreply@example.com"

# Security
BCRYPT_SALT_ROUNDS="12"
```

### 依賴套件安裝

```bash
npm install bcryptjs nodemailer
npm install -D @types/bcryptjs @types/nodemailer
```

---

## Implementation Guide

### Phase 1: Database Schema Update (10 min)

更新 `prisma/schema.prisma`：

```prisma
model User {
  // 現有欄位保持不變
  id                String     @id @default(cuid())
  email             String     @unique
  emailVerified     DateTime?  @map("email_verified")
  name              String?
  image             String?
  password          String?    // 已存在，確保啟用
  azureAdId         String?    @unique @map("azure_ad_id")
  status            UserStatus @default(ACTIVE)
  isGlobalAdmin     Boolean    @default(false) @map("is_global_admin")
  isRegionalManager Boolean    @default(false) @map("is_regional_manager")
  createdAt         DateTime   @default(now()) @map("created_at")
  updatedAt         DateTime   @updatedAt @map("updated_at")
  lastLoginAt       DateTime?  @map("last_login_at")
  preferredLocale   String?    @map("preferred_locale")

  // 新增郵件驗證欄位
  emailVerificationToken   String?   @unique @map("email_verification_token")
  emailVerificationExpires DateTime? @map("email_verification_expires")

  // 新增密碼重設欄位（為 Story 18-3 預留）
  passwordResetToken   String?   @unique @map("password_reset_token")
  passwordResetExpires DateTime? @map("password_reset_expires")

  // Relations
  accounts        Account[]
  sessions        Session[]
  roles           UserRole[]
  cityAccess      UserCityAccess[]
  processedTasks  ProcessingTask[]   @relation("ProcessedBy")
  reviewedTasks   ProcessingTask[]   @relation("ReviewedBy")
  auditLogs       AuditLog[]
  corrections     CorrectionRecord[] @relation("CorrectedBy")

  @@map("users")
}
```

執行遷移：

```bash
npx prisma migrate dev --name add_email_verification_fields
```

---

### Phase 2: Password Utilities (15 min)

建立 `src/lib/password.ts`：

```typescript
/**
 * @fileoverview 密碼工具函數
 * @module src/lib/password
 * @since Epic 18 - Story 18.1
 */

import bcrypt from 'bcryptjs'

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10)

/**
 * 密碼強度驗證結果
 */
export interface PasswordStrengthResult {
  isValid: boolean
  score: number // 0-4
  errors: string[]
  suggestions: string[]
}

/**
 * 密碼要求配置
 */
export const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecialChar: false, // 可選
}

/**
 * 驗證密碼強度
 */
export function validatePasswordStrength(password: string): PasswordStrengthResult {
  const errors: string[] = []
  const suggestions: string[] = []
  let score = 0

  // 長度檢查
  if (password.length < PASSWORD_REQUIREMENTS.minLength) {
    errors.push(`Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters`)
  } else {
    score++
    if (password.length >= 12) score++
  }

  // 小寫字母檢查
  if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  } else {
    score++
  }

  // 大寫字母檢查
  if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  } else {
    score++
  }

  // 數字檢查
  if (PASSWORD_REQUIREMENTS.requireNumber && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number')
  } else {
    score++
  }

  // 特殊字元檢查（可選）
  if (PASSWORD_REQUIREMENTS.requireSpecialChar && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character')
  }

  // 建議
  if (password.length < 12) {
    suggestions.push('Consider using a longer password for better security')
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    suggestions.push('Adding special characters would increase password strength')
  }

  return {
    isValid: errors.length === 0,
    score: Math.min(score, 4),
    errors,
    suggestions,
  }
}

/**
 * 加密密碼
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

/**
 * 驗證密碼
 */
export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}
```

---

### Phase 3: Token Utilities (10 min)

建立 `src/lib/token.ts`：

```typescript
/**
 * @fileoverview Token 產生工具
 * @module src/lib/token
 * @since Epic 18 - Story 18.1
 */

import { randomBytes } from 'crypto'

/**
 * 產生安全的隨機 Token
 * @param length Token 長度（位元組數，實際輸出為 hex 字串，長度為 length * 2）
 */
export function generateToken(length: number = 32): string {
  return randomBytes(length).toString('hex')
}

/**
 * 產生 URL 安全的 Token
 */
export function generateUrlSafeToken(length: number = 32): string {
  return randomBytes(length)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

/**
 * 計算 Token 過期時間
 * @param hours 小時數
 */
export function getTokenExpiry(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000)
}
```

---

### Phase 4: Email Service (20 min)

建立 `src/lib/email.ts`：

```typescript
/**
 * @fileoverview 郵件服務
 * @module src/lib/email
 * @since Epic 18 - Story 18.1
 */

import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'

// 郵件傳輸器（單例）
let transporter: Transporter | null = null

/**
 * 取得郵件傳輸器
 */
function getTransporter(): Transporter {
  if (transporter) return transporter

  // 開發環境使用 Ethereal 測試郵件
  if (process.env.NODE_ENV === 'development' && !process.env.SMTP_HOST) {
    console.log('[Email] Using Ethereal test account for development')
    // 使用 console.log 替代實際發送
    transporter = nodemailer.createTransport({
      jsonTransport: true, // 輸出 JSON 而非實際發送
    })
    return transporter
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  })

  return transporter
}

/**
 * 郵件發送選項
 */
interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

/**
 * 發送郵件
 */
export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const transport = getTransporter()

  const mailOptions = {
    from: process.env.SMTP_FROM || 'noreply@example.com',
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
  }

  if (process.env.NODE_ENV === 'development' && !process.env.SMTP_HOST) {
    console.log('[Email] Development mode - Email would be sent:', {
      to: options.to,
      subject: options.subject,
    })
    return
  }

  await transport.sendMail(mailOptions)
}

/**
 * 發送驗證郵件
 */
export async function sendVerificationEmail(
  email: string,
  name: string | null,
  token: string
): Promise<void> {
  const verifyUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/auth/verify-email?token=${token}`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
    .button { display: inline-block; background: #3B82F6; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
    .button:hover { background: #2563EB; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
    .warning { background: #FEF3C7; border: 1px solid #F59E0B; border-radius: 6px; padding: 12px; margin-top: 20px; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>AI Document Extraction</h1>
    </div>
    <div class="content">
      <h2>歡迎加入，${name || 'User'}！</h2>
      <p>感謝您註冊 AI Document Extraction 系統。</p>
      <p>請點擊以下按鈕驗證您的電子郵件地址：</p>
      <div style="text-align: center;">
        <a href="${verifyUrl}" class="button">驗證電子郵件</a>
      </div>
      <p style="color: #6b7280; font-size: 14px;">
        或者複製以下連結到瀏覽器：<br>
        <code style="background: #f3f4f6; padding: 4px 8px; border-radius: 4px; font-size: 12px; word-break: break-all;">${verifyUrl}</code>
      </p>
      <div class="warning">
        <strong>⚠️ 注意：</strong>此連結將在 24 小時後失效。
      </div>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 30px;">
        如果您沒有註冊此帳號，請忽略此郵件。
      </p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} AI Document Extraction. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `

  const text = `
歡迎加入，${name || 'User'}！

感謝您註冊 AI Document Extraction 系統。

請點擊以下連結驗證您的電子郵件地址：
${verifyUrl}

此連結將在 24 小時後失效。

如果您沒有註冊此帳號，請忽略此郵件。
  `

  await sendEmail({
    to: email,
    subject: '[AI Document Extraction] 請驗證您的電子郵件',
    html,
    text,
  })
}
```

---

### Phase 5: Validation Schema (10 min)

建立 `src/validations/auth.ts`：

```typescript
/**
 * @fileoverview 認證相關驗證 Schema
 * @module src/validations/auth
 * @since Epic 18 - Story 18.1
 */

import { z } from 'zod'
import { PASSWORD_REQUIREMENTS } from '@/lib/password'

/**
 * 註冊請求 Schema
 */
export const registerSchema = z
  .object({
    name: z
      .string()
      .min(2, 'Name must be at least 2 characters')
      .max(100, 'Name must be less than 100 characters'),
    email: z
      .string()
      .email('Please enter a valid email address')
      .max(255, 'Email must be less than 255 characters'),
    password: z
      .string()
      .min(PASSWORD_REQUIREMENTS.minLength, `Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters`)
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export type RegisterInput = z.infer<typeof registerSchema>

/**
 * 登入請求 Schema
 */
export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

export type LoginInput = z.infer<typeof loginSchema>
```

---

### Phase 6: Registration API (30 min)

建立 `src/app/api/auth/register/route.ts`：

```typescript
/**
 * @fileoverview 用戶註冊 API 端點
 * @module src/app/api/auth/register
 * @since Epic 18 - Story 18.1
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, validatePasswordStrength } from '@/lib/password'
import { generateToken, getTokenExpiry } from '@/lib/token'
import { sendVerificationEmail } from '@/lib/email'
import { registerSchema } from '@/validations/auth'
import { DEFAULT_ROLE } from '@/types/role-permissions'
import { getRoleByName } from '@/services/role.service'
import { z } from 'zod'

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
          type: 'https://api.example.com/errors/validation',
          title: 'Password Requirements Not Met',
          status: 400,
          detail: 'Password does not meet security requirements',
          errors: passwordCheck.errors,
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
          type: 'https://api.example.com/errors/conflict',
          title: 'Email Already Registered',
          status: 409,
          detail: 'This email address is already registered',
        },
        { status: 409 }
      )
    }

    // 加密密碼
    const hashedPassword = await hashPassword(validatedData.password)

    // 產生驗證 Token
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

    // 發送驗證郵件
    try {
      await sendVerificationEmail(user.email, user.name, verificationToken)
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError)
      // 不阻止註冊，但記錄錯誤
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Registration successful. Please check your email to verify your account.',
        data: {
          userId: user.id,
          email: user.email,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'One or more fields failed validation',
          errors: error.errors.reduce(
            (acc, err) => ({
              ...acc,
              [err.path.join('.')]: [err.message],
            }),
            {}
          ),
        },
        { status: 400 }
      )
    }

    console.error('Registration error:', error)
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Registration Failed',
        status: 500,
        detail: 'An unexpected error occurred during registration',
      },
      { status: 500 }
    )
  }
}
```

---

### Phase 7: Registration Page UI (40 min)

建立 `src/app/[locale]/(auth)/auth/register/page.tsx`：

```typescript
/**
 * @fileoverview 用戶註冊頁面
 * @module src/app/[locale]/(auth)/auth/register
 * @since Epic 18 - Story 18.1
 */

import { getTranslations } from 'next-intl/server'
import { RegisterForm } from '@/components/features/auth/RegisterForm'

interface RegisterPageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: RegisterPageProps) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'auth' })

  return {
    title: t('register.title'),
    description: t('register.description'),
  }
}

export default async function RegisterPage({ params }: RegisterPageProps) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'auth' })

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <RegisterForm />
    </div>
  )
}
```

建立 `src/components/features/auth/RegisterForm.tsx`：

```typescript
/**
 * @fileoverview 用戶註冊表單組件
 * @module src/components/features/auth/RegisterForm
 * @since Epic 18 - Story 18.1
 */

'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Eye, EyeOff, Check, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Link } from '@/i18n/routing'
import { registerSchema, type RegisterInput } from '@/validations/auth'
import { PASSWORD_REQUIREMENTS } from '@/lib/password'

export function RegisterForm() {
  const t = useTranslations('auth')
  const router = useRouter()
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [showPassword, setShowPassword] = React.useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    mode: 'onChange',
  })

  const password = watch('password', '')

  // 密碼強度指示
  const passwordChecks = React.useMemo(() => {
    return {
      minLength: password.length >= PASSWORD_REQUIREMENTS.minLength,
      hasLowercase: /[a-z]/.test(password),
      hasUppercase: /[A-Z]/.test(password),
      hasNumber: /[0-9]/.test(password),
    }
  }, [password])

  const onSubmit = async (data: RegisterInput) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.detail || t('register.error.failed'))
        return
      }

      // 成功後重導向至登入頁面
      router.push('/auth/login?registered=true')
    } catch (err) {
      setError(t('register.error.network'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader className="text-center space-y-2">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <svg
            className="h-8 w-8 text-primary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
            />
          </svg>
        </div>
        <CardTitle className="text-2xl font-bold">{t('register.title')}</CardTitle>
        <CardDescription>{t('register.description')}</CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">{t('register.name')}</Label>
            <Input
              id="name"
              type="text"
              placeholder={t('register.namePlaceholder')}
              {...register('name')}
              disabled={isLoading}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">{t('register.email')}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t('register.emailPlaceholder')}
              {...register('email')}
              disabled={isLoading}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password">{t('register.password')}</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder={t('register.passwordPlaceholder')}
                {...register('password')}
                disabled={isLoading}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}

            {/* Password Strength Indicator */}
            {password && (
              <div className="space-y-1 text-xs">
                <PasswordCheck
                  passed={passwordChecks.minLength}
                  label={t('register.passwordRequirements.minLength', { count: PASSWORD_REQUIREMENTS.minLength })}
                />
                <PasswordCheck
                  passed={passwordChecks.hasLowercase}
                  label={t('register.passwordRequirements.lowercase')}
                />
                <PasswordCheck
                  passed={passwordChecks.hasUppercase}
                  label={t('register.passwordRequirements.uppercase')}
                />
                <PasswordCheck
                  passed={passwordChecks.hasNumber}
                  label={t('register.passwordRequirements.number')}
                />
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t('register.confirmPassword')}</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder={t('register.confirmPasswordPlaceholder')}
                {...register('confirmPassword')}
                disabled={isLoading}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('register.submitting')}
              </>
            ) : (
              t('register.submit')
            )}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            {t('register.hasAccount')}{' '}
            <Link href="/auth/login" className="text-primary hover:underline">
              {t('register.login')}
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}

function PasswordCheck({ passed, label }: { passed: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2 ${passed ? 'text-green-600' : 'text-muted-foreground'}`}>
      {passed ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      <span>{label}</span>
    </div>
  )
}
```

---

### Phase 8: Translation Files (15 min)

更新 `messages/en/auth.json`：

```json
{
  "register": {
    "title": "Create Account",
    "description": "Enter your details to create a new account",
    "name": "Full Name",
    "namePlaceholder": "John Doe",
    "email": "Email Address",
    "emailPlaceholder": "you@example.com",
    "password": "Password",
    "passwordPlaceholder": "Create a strong password",
    "confirmPassword": "Confirm Password",
    "confirmPasswordPlaceholder": "Repeat your password",
    "submit": "Create Account",
    "submitting": "Creating account...",
    "hasAccount": "Already have an account?",
    "login": "Sign in",
    "passwordRequirements": {
      "minLength": "At least {count} characters",
      "lowercase": "One lowercase letter",
      "uppercase": "One uppercase letter",
      "number": "One number"
    },
    "error": {
      "failed": "Registration failed. Please try again.",
      "network": "Network error. Please check your connection."
    },
    "success": {
      "title": "Registration Successful",
      "message": "Please check your email to verify your account."
    }
  }
}
```

更新 `messages/zh-TW/auth.json`：

```json
{
  "register": {
    "title": "建立帳號",
    "description": "輸入您的資料以建立新帳號",
    "name": "姓名",
    "namePlaceholder": "王小明",
    "email": "電子郵件",
    "emailPlaceholder": "you@example.com",
    "password": "密碼",
    "passwordPlaceholder": "建立一個安全的密碼",
    "confirmPassword": "確認密碼",
    "confirmPasswordPlaceholder": "再次輸入密碼",
    "submit": "建立帳號",
    "submitting": "建立中...",
    "hasAccount": "已經有帳號了？",
    "login": "登入",
    "passwordRequirements": {
      "minLength": "至少 {count} 個字元",
      "lowercase": "一個小寫字母",
      "uppercase": "一個大寫字母",
      "number": "一個數字"
    },
    "error": {
      "failed": "註冊失敗，請重試。",
      "network": "網路錯誤，請檢查您的連線。"
    },
    "success": {
      "title": "註冊成功",
      "message": "請檢查您的電子郵件以驗證帳號。"
    }
  }
}
```

更新 `messages/zh-CN/auth.json`：

```json
{
  "register": {
    "title": "创建账号",
    "description": "输入您的资料以创建新账号",
    "name": "姓名",
    "namePlaceholder": "王小明",
    "email": "电子邮件",
    "emailPlaceholder": "you@example.com",
    "password": "密码",
    "passwordPlaceholder": "创建一个安全的密码",
    "confirmPassword": "确认密码",
    "confirmPasswordPlaceholder": "再次输入密码",
    "submit": "创建账号",
    "submitting": "创建中...",
    "hasAccount": "已经有账号了？",
    "login": "登录",
    "passwordRequirements": {
      "minLength": "至少 {count} 个字符",
      "lowercase": "一个小写字母",
      "uppercase": "一个大写字母",
      "number": "一个数字"
    },
    "error": {
      "failed": "注册失败，请重试。",
      "network": "网络错误，请检查您的连接。"
    },
    "success": {
      "title": "注册成功",
      "message": "请检查您的电子邮件以验证账号。"
    }
  }
}
```

---

## Verification Checklist

### Registration Flow

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Page Display | Navigate to /auth/register | Shows registration form | [ ] |
| Form Validation | Enter invalid data | Shows validation errors | [ ] |
| Password Strength | Enter weak password | Shows strength indicator | [ ] |
| Successful Registration | Submit valid data | Creates user, sends email | [ ] |
| Duplicate Email | Register with existing email | Shows error message | [ ] |
| Password Encryption | Check database | Password is bcrypt hash | [ ] |
| Verification Email | Check inbox | Receives verification email | [ ] |
| Default Role | Check user roles | Has Data Processor role | [ ] |

---

## File List (Expected Output)

| File Path | Description |
|-----------|-------------|
| `prisma/schema.prisma` | Updated with verification fields |
| `src/lib/password.ts` | Password utilities |
| `src/lib/token.ts` | Token generation utilities |
| `src/lib/email.ts` | Email service |
| `src/validations/auth.ts` | Validation schemas |
| `src/app/api/auth/register/route.ts` | Registration API |
| `src/app/[locale]/(auth)/auth/register/page.tsx` | Registration page |
| `src/components/features/auth/RegisterForm.tsx` | Registration form component |
| `messages/en/auth.json` | English translations |
| `messages/zh-TW/auth.json` | Traditional Chinese translations |
| `messages/zh-CN/auth.json` | Simplified Chinese translations |
| `.env.example` | Updated with email configuration |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Email not sending | Check SMTP configuration in .env |
| Password validation fails | Verify password meets all requirements |
| Database error | Run `npx prisma migrate dev` |
| Unique constraint error | Email already exists, show appropriate message |

---

## Next Steps

After completing Story 18-1:
1. Proceed to **Story 18-2** (本地帳號登入)
2. Test complete registration flow
3. Verify email service integration

---

*Generated by: Claude AI Assistant*
*Version: 1.0*
