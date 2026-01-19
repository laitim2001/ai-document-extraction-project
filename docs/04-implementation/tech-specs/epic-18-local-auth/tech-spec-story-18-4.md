# Story 18-4: Email Verification - Technical Specification

**Version:** 1.0
**Created:** 2026-01-19
**Status:** Ready for Development
**Story Key:** 18-4-email-verification

---

## Overview

| Field | Value |
|-------|-------|
| Story ID | 18.4 |
| Epic | Epic 18: 本地帳號認證系統 |
| Estimated Effort | 1 天 |
| Dependencies | Story 18-1 (用戶註冊) |
| Blocking | 無 |

---

## Objective

實現電子郵件驗證系統，確保用戶電子郵件的有效性，包含驗證連結、過期處理、重新發送功能及速率限制。

---

## Implementation Guide

### Phase 1: Verify Email API (25 min)

建立 `src/app/api/auth/verify-email/route.ts`：

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  const locale = request.nextUrl.searchParams.get('locale') || 'en'

  if (!token) {
    return redirect(`/${locale}/auth/verify-email?status=invalid`)
  }

  try {
    // 查詢 Token
    const user = await prisma.user.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerificationExpires: { gt: new Date() },
      },
    })

    if (!user) {
      // 檢查是否已過期
      const expiredUser = await prisma.user.findFirst({
        where: { emailVerificationToken: token },
      })

      if (expiredUser) {
        return redirect(`/${locale}/auth/verify-email?status=expired&email=${encodeURIComponent(expiredUser.email)}`)
      }

      return redirect(`/${locale}/auth/verify-email?status=invalid`)
    }

    // 已驗證的用戶
    if (user.emailVerified) {
      return redirect(`/${locale}/auth/verify-email?status=already_verified`)
    }

    // 更新驗證狀態
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    })

    return redirect(`/${locale}/auth/login?verified=true`)
  } catch (error) {
    console.error('Email verification error:', error)
    return redirect(`/${locale}/auth/verify-email?status=error`)
  }
}
```

### Phase 2: Resend Verification API (25 min)

建立 `src/app/api/auth/resend-verification/route.ts`：

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateToken, getTokenExpiry } from '@/lib/token'
import { sendVerificationEmail } from '@/lib/email'
import { z } from 'zod'

const resendSchema = z.object({
  email: z.string().email(),
})

// 簡單的速率限制（生產環境應使用 Redis）
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT = 5 // 每小時最多 5 次
const RATE_LIMIT_WINDOW = 60 * 60 * 1000 // 1 小時

function checkRateLimit(email: string): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(email)

  if (!record || now > record.resetTime) {
    rateLimitMap.set(email, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return true
  }

  if (record.count >= RATE_LIMIT) {
    return false
  }

  record.count++
  return true
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = resendSchema.parse(body)

    const normalizedEmail = email.toLowerCase()

    // 檢查速率限制
    if (!checkRateLimit(normalizedEmail)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    // 查詢用戶
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    // 無論用戶是否存在，都返回相同訊息（安全考量）
    if (!user) {
      return NextResponse.json({
        success: true,
        message: 'If an account exists with this email, a verification link has been sent.',
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

    // 只有本地帳號可以重發驗證郵件
    if (!user.password) {
      return NextResponse.json({
        success: true,
        message: 'If an account exists with this email, a verification link has been sent.',
      })
    }

    // 產生新 Token
    const token = generateToken(64)
    const expires = getTokenExpiry(24) // 24 小時

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: token,
        emailVerificationExpires: expires,
      },
    })

    // 發送驗證郵件
    await sendVerificationEmail(user.email, user.name, token)

    return NextResponse.json({
      success: true,
      message: 'Verification email has been sent. Please check your inbox.',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      )
    }

    console.error('Resend verification error:', error)
    return NextResponse.json(
      { error: 'Failed to send verification email' },
      { status: 500 }
    )
  }
}
```

### Phase 3: Email Template (15 min)

更新 `src/lib/email.ts` 加入驗證郵件：

```typescript
export async function sendVerificationEmail(
  email: string,
  name: string | null,
  token: string
): Promise<void> {
  const verifyUrl = `${process.env.NEXTAUTH_URL}/api/auth/verify-email?token=${token}`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
    .header { background: #3B82F6; color: white; padding: 20px; text-align: center; }
    .content { padding: 30px; }
    .button {
      display: inline-block;
      background: #3B82F6;
      color: white;
      padding: 12px 30px;
      text-decoration: none;
      border-radius: 6px;
      margin: 20px 0;
    }
    .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
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
      <a href="${verifyUrl}" class="button">驗證電子郵件</a>
      <p style="color: #666; font-size: 14px;">
        此連結將在 24 小時後失效。
      </p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      <p style="color: #999; font-size: 12px;">
        如果您沒有註冊此帳號，請忽略此郵件。
      </p>
    </div>
    <div class="footer">
      <p>&copy; 2026 AI Document Extraction. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `

  await sendEmail({
    to: email,
    subject: '[AI Document Extraction] 請驗證您的電子郵件',
    html,
  })
}
```

### Phase 4: Verify Email Result Page (30 min)

建立 `src/app/[locale]/(auth)/auth/verify-email/page.tsx`：

```typescript
'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Link } from '@/i18n/routing'
import { CheckCircle, XCircle, Clock, Mail } from 'lucide-react'

export default function VerifyEmailPage() {
  const t = useTranslations('auth')
  const searchParams = useSearchParams()
  const status = searchParams.get('status')
  const emailParam = searchParams.get('email')

  const [email, setEmail] = useState(emailParam || '')
  const [isLoading, setIsLoading] = useState(false)
  const [resendStatus, setResendStatus] = useState<'idle' | 'success' | 'error' | 'already_verified'>('idle')

  const handleResend = async () => {
    if (!email) return

    setIsLoading(true)
    setResendStatus('idle')

    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const result = await response.json()

      if (response.status === 429) {
        setResendStatus('error')
        return
      }

      if (result.alreadyVerified) {
        setResendStatus('already_verified')
      } else {
        setResendStatus('success')
      }
    } catch {
      setResendStatus('error')
    } finally {
      setIsLoading(false)
    }
  }

  // 根據狀態顯示不同內容
  const renderContent = () => {
    switch (status) {
      case 'expired':
        return (
          <>
            <div className="flex justify-center mb-4">
              <Clock className="h-16 w-16 text-yellow-500" />
            </div>
            <CardTitle className="text-center">{t('verifyEmail.expired')}</CardTitle>
            <p className="text-center text-muted-foreground mt-2">
              {t('verifyEmail.expiredDescription')}
            </p>
          </>
        )

      case 'invalid':
        return (
          <>
            <div className="flex justify-center mb-4">
              <XCircle className="h-16 w-16 text-destructive" />
            </div>
            <CardTitle className="text-center">{t('verifyEmail.invalid')}</CardTitle>
            <p className="text-center text-muted-foreground mt-2">
              {t('verifyEmail.invalidDescription')}
            </p>
          </>
        )

      case 'already_verified':
        return (
          <>
            <div className="flex justify-center mb-4">
              <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
            <CardTitle className="text-center">{t('verifyEmail.alreadyVerified')}</CardTitle>
            <p className="text-center text-muted-foreground mt-2">
              {t('verifyEmail.alreadyVerifiedDescription')}
            </p>
            <Link href="/auth/login">
              <Button className="w-full mt-4">{t('verifyEmail.login')}</Button>
            </Link>
          </>
        )

      case 'error':
        return (
          <>
            <div className="flex justify-center mb-4">
              <XCircle className="h-16 w-16 text-destructive" />
            </div>
            <CardTitle className="text-center">{t('verifyEmail.error')}</CardTitle>
            <p className="text-center text-muted-foreground mt-2">
              {t('verifyEmail.errorDescription')}
            </p>
          </>
        )

      default:
        return (
          <>
            <div className="flex justify-center mb-4">
              <Mail className="h-16 w-16 text-primary" />
            </div>
            <CardTitle className="text-center">{t('verifyEmail.title')}</CardTitle>
            <p className="text-center text-muted-foreground mt-2">
              {t('verifyEmail.description')}
            </p>
          </>
        )
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>{renderContent()}</CardHeader>
      <CardContent>
        {/* 重新發送功能 */}
        {(status === 'expired' || status === 'invalid' || !status) && (
          <div className="space-y-4">
            {resendStatus === 'success' && (
              <Alert>
                <AlertDescription>{t('verifyEmail.resendSuccess')}</AlertDescription>
              </Alert>
            )}
            {resendStatus === 'error' && (
              <Alert variant="destructive">
                <AlertDescription>{t('verifyEmail.resendError')}</AlertDescription>
              </Alert>
            )}
            {resendStatus === 'already_verified' && (
              <Alert>
                <AlertDescription>{t('verifyEmail.alreadyVerified')}</AlertDescription>
              </Alert>
            )}

            <Input
              type="email"
              placeholder={t('verifyEmail.emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
            />
            <Button
              onClick={handleResend}
              className="w-full"
              disabled={isLoading || !email}
            >
              {isLoading ? t('verifyEmail.sending') : t('verifyEmail.resend')}
            </Button>
          </div>
        )}

        <div className="mt-4 text-center">
          <Link href="/auth/login">
            <Button variant="link">{t('verifyEmail.backToLogin')}</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
```

### Phase 5: Integration with Registration (10 min)

確保註冊成功後發送驗證郵件（已在 Story 18-1 的 register API 中整合）：

```typescript
// src/app/api/auth/register/route.ts 中已包含：
// 1. 產生驗證 Token
// 2. 發送驗證郵件
// 3. 返回成功訊息提醒用戶檢查信箱
```

### Phase 6: Update Login Page Integration (10 min)

在登入頁面處理未驗證用戶的情況：

```typescript
// src/app/[locale]/(auth)/auth/login/page.tsx

// 在錯誤處理中加入：
function getErrorMessage(error: string): string {
  const messages: Record<string, string> = {
    // ... 其他錯誤
    EmailNotVerified: '請先驗證您的電子郵件',
  }
  return messages[error] || '登入失敗，請重試'
}

// 顯示重新發送驗證郵件的連結（當錯誤為 EmailNotVerified 時）
{error === 'EmailNotVerified' && (
  <Link href="/auth/verify-email" className="text-sm text-primary hover:underline">
    重新發送驗證郵件
  </Link>
)}
```

### Phase 7: Translations (15 min)

更新 `messages/*/auth.json` 加入郵件驗證翻譯：

```json
{
  "verifyEmail": {
    "title": "驗證您的電子郵件",
    "description": "請輸入您的電子郵件地址以重新發送驗證連結。",
    "expired": "驗證連結已過期",
    "expiredDescription": "此驗證連結已超過 24 小時有效期。請重新發送驗證郵件。",
    "invalid": "驗證連結無效",
    "invalidDescription": "此驗證連結無效或已被使用。請重新發送驗證郵件。",
    "alreadyVerified": "電子郵件已驗證",
    "alreadyVerifiedDescription": "您的電子郵件已經驗證，可以直接登入。",
    "error": "驗證失敗",
    "errorDescription": "驗證過程中發生錯誤，請稍後再試。",
    "emailPlaceholder": "輸入您的電子郵件",
    "resend": "重新發送驗證郵件",
    "sending": "發送中...",
    "resendSuccess": "驗證郵件已發送，請檢查您的信箱。",
    "resendError": "請求過於頻繁，請稍後再試。",
    "backToLogin": "返回登入",
    "login": "前往登入"
  }
}
```

---

## Verification Checklist

| Test Case | Expected Result | Status |
|-----------|-----------------|--------|
| Click valid verification link | Updates emailVerified, redirects to login | [ ] |
| Click expired link | Shows expired message with resend option | [ ] |
| Click invalid link | Shows invalid message with resend option | [ ] |
| Resend verification email | Sends new email, invalidates old token | [ ] |
| Already verified user | Shows already verified message | [ ] |
| Rate limit exceeded | Shows rate limit error (5/hour) | [ ] |
| Non-existent email resend | Shows same success message (security) | [ ] |

---

## File List

| File Path | Description |
|-----------|-------------|
| `src/app/api/auth/verify-email/route.ts` | Verification endpoint |
| `src/app/api/auth/resend-verification/route.ts` | Resend verification API |
| `src/app/[locale]/(auth)/auth/verify-email/page.tsx` | Verification result page |
| `src/lib/email.ts` | Updated with verification email |
| `messages/*/auth.json` | Updated translations |

---

## Security Considerations

1. **Token 單次使用**：驗證後立即刪除 Token
2. **Token 長度**：64 字元隨機 Token 確保安全
3. **過期機制**：24 小時有效期
4. **速率限制**：每小時最多 5 次重發請求
5. **資訊隱藏**：無論郵件是否存在，返回相同訊息

---

*Generated by: Claude AI Assistant*
