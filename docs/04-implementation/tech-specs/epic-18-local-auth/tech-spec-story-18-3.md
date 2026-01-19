# Story 18-3: Password Reset - Technical Specification

**Version:** 1.0
**Created:** 2026-01-19
**Status:** Ready for Development
**Story Key:** 18-3-password-reset

---

## Overview

| Field | Value |
|-------|-------|
| Story ID | 18.3 |
| Epic | Epic 18: 本地帳號認證系統 |
| Estimated Effort | 1 天 |
| Dependencies | Story 18-1, Story 18-2 |
| Blocking | 無 |

---

## Objective

實現忘記密碼和密碼重設功能，包含安全的 Token 機制、速率限制、以及郵件通知。

---

## Implementation Guide

### Phase 1: Forgot Password API (20 min)

建立 `src/app/api/auth/forgot-password/route.ts`：

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateToken, getTokenExpiry } from '@/lib/token'
import { sendPasswordResetEmail } from '@/lib/email'
import { z } from 'zod'

const forgotPasswordSchema = z.object({
  email: z.string().email(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = forgotPasswordSchema.parse(body)

    // 查詢用戶（不洩漏是否存在）
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    // 無論用戶是否存在，都返回相同訊息
    if (user && user.password) {
      // 只有本地帳號可以重設密碼
      const token = generateToken(32)
      const expires = getTokenExpiry(1) // 1 小時

      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: token,
          passwordResetExpires: expires,
        },
      })

      await sendPasswordResetEmail(user.email, user.name, token)
    }

    return NextResponse.json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent.',
    })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json(
      { error: 'Request failed' },
      { status: 500 }
    )
  }
}
```

### Phase 2: Reset Password API (20 min)

建立 `src/app/api/auth/reset-password/route.ts`：

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, validatePasswordStrength } from '@/lib/password'
import { sendPasswordChangedEmail } from '@/lib/email'
import { z } from 'zod'

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, password } = resetPasswordSchema.parse(body)

    // 驗證 Token
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: { gt: new Date() },
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      )
    }

    // 驗證密碼強度
    const passwordCheck = validatePasswordStrength(password)
    if (!passwordCheck.isValid) {
      return NextResponse.json(
        { error: 'Password does not meet requirements', details: passwordCheck.errors },
        { status: 400 }
      )
    }

    // 更新密碼並清除 Token
    const hashedPassword = await hashPassword(password)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    })

    // 發送密碼變更通知
    await sendPasswordChangedEmail(user.email, user.name)

    return NextResponse.json({
      success: true,
      message: 'Password has been reset successfully.',
    })
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json(
      { error: 'Password reset failed' },
      { status: 500 }
    )
  }
}
```

### Phase 3: Verify Reset Token API (10 min)

建立 `src/app/api/auth/verify-reset-token/route.ts`：

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.json({ valid: false })
  }

  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: token,
      passwordResetExpires: { gt: new Date() },
    },
    select: { email: true },
  })

  return NextResponse.json({
    valid: !!user,
    email: user?.email ? maskEmail(user.email) : undefined,
  })
}

function maskEmail(email: string): string {
  const [name, domain] = email.split('@')
  const maskedName = name.slice(0, 2) + '***'
  return `${maskedName}@${domain}`
}
```

### Phase 4: Email Templates (15 min)

更新 `src/lib/email.ts` 加入密碼重設郵件：

```typescript
export async function sendPasswordResetEmail(
  email: string,
  name: string | null,
  token: string
): Promise<void> {
  const resetUrl = `${process.env.NEXTAUTH_URL}/auth/reset-password?token=${token}`

  const html = `
<!DOCTYPE html>
<html>
<body>
  <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
    <h1 style="color: #3B82F6;">重設您的密碼</h1>
    <p>親愛的 ${name || 'User'}，</p>
    <p>我們收到了重設您帳號密碼的請求。</p>
    <p>請點擊以下按鈕重設密碼（有效期 1 小時）：</p>
    <a href="${resetUrl}" style="display: inline-block; background: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
      重設密碼
    </a>
    <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
      如果您沒有請求重設密碼，請忽略此郵件。您的密碼不會被更改。
    </p>
  </div>
</body>
</html>
  `

  await sendEmail({
    to: email,
    subject: '[AI Document Extraction] 重設您的密碼',
    html,
  })
}

export async function sendPasswordChangedEmail(
  email: string,
  name: string | null
): Promise<void> {
  const html = `
<!DOCTYPE html>
<html>
<body>
  <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
    <h1 style="color: #3B82F6;">密碼已變更</h1>
    <p>親愛的 ${name || 'User'}，</p>
    <p>您的帳號密碼已成功變更。</p>
    <p>如果這不是您本人的操作，請立即聯繫系統管理員。</p>
  </div>
</body>
</html>
  `

  await sendEmail({
    to: email,
    subject: '[AI Document Extraction] 您的密碼已變更',
    html,
  })
}
```

### Phase 5: Forgot Password Page (25 min)

建立 `src/app/[locale]/(auth)/auth/forgot-password/page.tsx`：

```typescript
'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Link } from '@/i18n/routing'

export default function ForgotPasswordPage() {
  const t = useTranslations('auth')
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const { register, handleSubmit } = useForm<{ email: string }>()

  const onSubmit = async (data: { email: string }) => {
    setIsLoading(true)
    await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    setIsLoading(false)
    setIsSubmitted(true)
  }

  if (isSubmitted) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <Alert>
            <AlertDescription>
              {t('forgotPassword.success')}
            </AlertDescription>
          </Alert>
          <Link href="/auth/login">
            <Button variant="link" className="mt-4">
              {t('forgotPassword.backToLogin')}
            </Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{t('forgotPassword.title')}</CardTitle>
        <CardDescription>{t('forgotPassword.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            type="email"
            placeholder={t('forgotPassword.emailPlaceholder')}
            {...register('email', { required: true })}
            disabled={isLoading}
          />
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? t('forgotPassword.sending') : t('forgotPassword.submit')}
          </Button>
        </form>
        <Link href="/auth/login">
          <Button variant="link" className="mt-4">
            {t('forgotPassword.backToLogin')}
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}
```

### Phase 6: Reset Password Page (25 min)

建立 `src/app/[locale]/(auth)/auth/reset-password/page.tsx`：

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Link } from '@/i18n/routing'
import { z } from 'zod'

const resetSchema = z.object({
  password: z.string().min(8),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export default function ResetPasswordPage() {
  const t = useTranslations('auth')
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [isValidToken, setIsValidToken] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(resetSchema),
  })

  useEffect(() => {
    if (token) {
      fetch(`/api/auth/verify-reset-token?token=${token}`)
        .then(res => res.json())
        .then(data => setIsValidToken(data.valid))
    }
  }, [token])

  const onSubmit = async (data: { password: string }) => {
    setIsLoading(true)
    setError(null)

    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, ...data }),
    })

    const result = await response.json()

    if (!response.ok) {
      setError(result.error)
      setIsLoading(false)
      return
    }

    router.push('/auth/login?reset=true')
  }

  if (isValidToken === false) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertDescription>{t('resetPassword.invalidToken')}</AlertDescription>
          </Alert>
          <Link href="/auth/forgot-password">
            <Button className="mt-4 w-full">{t('resetPassword.requestNew')}</Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{t('resetPassword.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            type="password"
            placeholder={t('resetPassword.newPassword')}
            {...register('password')}
            disabled={isLoading}
          />
          {errors.password && (
            <p className="text-sm text-destructive">{errors.password.message}</p>
          )}
          <Input
            type="password"
            placeholder={t('resetPassword.confirmPassword')}
            {...register('confirmPassword')}
            disabled={isLoading}
          />
          {errors.confirmPassword && (
            <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
          )}
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? t('resetPassword.resetting') : t('resetPassword.submit')}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
```

---

## Verification Checklist

| Test Case | Expected Result | Status |
|-----------|-----------------|--------|
| Forgot password page displays | Shows email input form | [ ] |
| Request reset for existing email | Sends email, shows success | [ ] |
| Request reset for non-existing email | Shows same success (security) | [ ] |
| Valid token shows reset form | Displays password inputs | [ ] |
| Expired token shows error | Shows invalid message | [ ] |
| Successful password reset | Updates password, redirects | [ ] |
| Password changed email sent | User receives notification | [ ] |

---

## File List

| File Path | Description |
|-----------|-------------|
| `src/app/api/auth/forgot-password/route.ts` | Forgot password API |
| `src/app/api/auth/reset-password/route.ts` | Reset password API |
| `src/app/api/auth/verify-reset-token/route.ts` | Token verification API |
| `src/app/[locale]/(auth)/auth/forgot-password/page.tsx` | Forgot password page |
| `src/app/[locale]/(auth)/auth/reset-password/page.tsx` | Reset password page |
| `src/lib/email.ts` | Updated with reset emails |
| `messages/*/auth.json` | Updated translations |

---

*Generated by: Claude AI Assistant*
