# Story 18-2: Local Account Login - Technical Specification

**Version:** 1.0
**Created:** 2026-01-19
**Status:** Ready for Development
**Story Key:** 18-2-local-account-login

---

## Overview

| Field | Value |
|-------|-------|
| Story ID | 18.2 |
| Epic | Epic 18: 本地帳號認證系統 |
| Estimated Effort | 1 天 |
| Dependencies | Story 18-1 (用戶註冊) |
| Blocking | Story 18-3, Story 18-4 |

---

## Objective

修改現有的 NextAuth Credentials Provider，從開發模式模擬升級為真正的帳號密碼驗證，並確保 Session 結構與 Azure AD 登入完全一致。

---

## Acceptance Criteria Mapping

| AC | Description | Technical Implementation |
|----|-------------|-------------------------|
| AC1 | 登入頁面整合 | 雙重登入選項 UI |
| AC2 | 本地帳號登入流程 | Credentials Provider + bcrypt |
| AC3 | 登入失敗處理 | 錯誤訊息 + 登入嘗試記錄 |
| AC4 | 郵件未驗證處理 | emailVerified 檢查 |
| AC5 | 帳號狀態檢查 | status 欄位驗證 |
| AC6 | Session 統一性 | JWT callback 修改 |

---

## Implementation Guide

### Phase 1: Modify auth.config.ts (30 min)

更新 Credentials Provider：

```typescript
// src/lib/auth.config.ts

import Credentials from 'next-auth/providers/credentials'
import { verifyPassword } from '@/lib/password'
import { prisma } from '@/lib/prisma'

// 在 buildProviders 函數中
Credentials({
  id: 'credentials',
  name: 'Email Login',
  credentials: {
    email: { label: 'Email', type: 'email' },
    password: { label: 'Password', type: 'password' },
  },
  async authorize(credentials) {
    if (!credentials?.email || !credentials?.password) {
      return null
    }

    const email = (credentials.email as string).toLowerCase()
    const password = credentials.password as string

    // 查詢用戶
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        password: true,
        status: true,
        emailVerified: true,
      },
    })

    // 用戶不存在或無密碼（Azure AD 用戶）
    if (!user || !user.password) {
      return null
    }

    // 驗證密碼
    const isValidPassword = await verifyPassword(password, user.password)
    if (!isValidPassword) {
      return null
    }

    // 檢查帳號狀態
    if (user.status !== 'ACTIVE') {
      throw new Error(
        user.status === 'SUSPENDED' ? 'AccountSuspended' : 'AccountDisabled'
      )
    }

    // 檢查郵件驗證（可根據業務需求調整）
    if (!user.emailVerified) {
      throw new Error('EmailNotVerified')
    }

    // 返回用戶資訊
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
    }
  },
})
```

### Phase 2: Update Login Page UI (40 min)

修改登入頁面，加入本地帳號登入表單：

```typescript
// src/app/[locale]/(auth)/auth/login/page.tsx

'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Link } from '@/i18n/routing'
import { loginSchema, type LoginInput } from '@/validations/auth'

export default function LoginPage() {
  const t = useTranslations('auth')
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'
  const registered = searchParams.get('registered')

  const [isLoading, setIsLoading] = useState(false)
  const [isAzureLoading, setIsAzureLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  })

  // Azure AD 登入
  const handleAzureLogin = async () => {
    setIsAzureLoading(true)
    await signIn('azure-ad', { callbackUrl })
  }

  // 本地帳號登入
  const handleLocalLogin = async (data: LoginInput) => {
    setIsLoading(true)
    setError(null)

    const result = await signIn('credentials', {
      email: data.email,
      password: data.password,
      redirect: false,
    })

    if (result?.error) {
      setError(getErrorMessage(result.error))
      setIsLoading(false)
      return
    }

    router.push(callbackUrl)
    router.refresh()
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{t('login.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 成功註冊提示 */}
        {registered && (
          <Alert>
            <AlertDescription>{t('login.registeredSuccess')}</AlertDescription>
          </Alert>
        )}

        {/* 錯誤提示 */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Azure AD 登入 */}
        <Button
          onClick={handleAzureLogin}
          disabled={isAzureLoading || isLoading}
          className="w-full"
          variant="outline"
        >
          {t('login.azureAd')}
        </Button>

        {/* 分隔線 */}
        <div className="relative">
          <Separator />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground">
            {t('login.or')}
          </span>
        </div>

        {/* 本地帳號登入表單 */}
        <form onSubmit={handleSubmit(handleLocalLogin)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t('login.email')}</Label>
            <Input
              id="email"
              type="email"
              {...register('email')}
              disabled={isLoading}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t('login.password')}</Label>
            <Input
              id="password"
              type="password"
              {...register('password')}
              disabled={isLoading}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>

          <div className="text-right">
            <Link href="/auth/forgot-password" className="text-sm text-primary hover:underline">
              {t('login.forgotPassword')}
            </Link>
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? t('login.signingIn') : t('login.submit')}
          </Button>
        </form>

        {/* 註冊連結 */}
        <p className="text-center text-sm text-muted-foreground">
          {t('login.noAccount')}{' '}
          <Link href="/auth/register" className="text-primary hover:underline">
            {t('login.register')}
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}

function getErrorMessage(error: string): string {
  const messages: Record<string, string> = {
    AccountSuspended: '此帳號已被暫停',
    AccountDisabled: '此帳號已停用',
    EmailNotVerified: '請先驗證您的電子郵件',
    CredentialsSignin: '電子郵件或密碼錯誤',
  }
  return messages[error] || '登入失敗，請重試'
}
```

### Phase 3: Update auth.ts JWT Callback (20 min)

確保本地帳號登入的 Session 結構與 Azure AD 一致：

```typescript
// src/lib/auth.ts - jwt callback 修改

async jwt({ token, account, user }) {
  // 首次登入時設置基本資訊
  if (user) {
    token.sub = user.id
    token.email = user.email
    token.name = user.name
  }

  // 標記登入方式（可選）
  if (account) {
    token.provider = account.provider
    if (account.provider === 'azure-ad') {
      token.azureAdId = account.providerAccountId
    }
  }

  // 無論是 Azure AD 還是本地帳號，都從資料庫載入完整資訊
  if (token.sub) {
    const dbUser = await prisma.user.findUnique({
      where: { id: token.sub },
      select: {
        status: true,
        isGlobalAdmin: true,
        isRegionalManager: true,
        preferredLocale: true,
      },
    })

    if (dbUser) {
      token.status = dbUser.status
      token.isGlobalAdmin = dbUser.isGlobalAdmin
      token.isRegionalManager = dbUser.isRegionalManager
      token.preferredLocale = dbUser.preferredLocale
    }

    // 載入角色
    token.roles = await getUserRoles(token.sub)

    // 載入城市權限
    token.cityCodes = await CityAccessService.getUserCityCodes(token.sub)
    token.primaryCityCode = await CityAccessService.getPrimaryCityCode(token.sub)
  }

  return token
}
```

---

## Verification Checklist

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Page Display | Navigate to /auth/login | Shows dual login options | [ ] |
| Azure AD Login | Click Azure AD button | Redirects to Azure | [ ] |
| Local Login Success | Enter valid credentials | Redirects to dashboard | [ ] |
| Local Login Fail | Enter wrong password | Shows error message | [ ] |
| Unverified Email | Login with unverified account | Shows verification prompt | [ ] |
| Suspended Account | Login with suspended account | Shows suspended message | [ ] |
| Session Structure | Check session after login | Contains all user data | [ ] |

---

## File List (Expected Output)

| File Path | Description |
|-----------|-------------|
| `src/lib/auth.config.ts` | Updated Credentials Provider |
| `src/lib/auth.ts` | Updated JWT callback |
| `src/app/[locale]/(auth)/auth/login/page.tsx` | Updated login page |
| `messages/*/auth.json` | Updated translations |

---

*Generated by: Claude AI Assistant*
