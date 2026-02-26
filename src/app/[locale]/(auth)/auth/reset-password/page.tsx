'use client'

/**
 * @fileoverview 重設密碼頁面
 * @description
 *   提供密碼重設功能，用戶通過郵件連結訪問此頁面。
 *
 *   功能特點：
 *   - Token 驗證（載入時自動驗證）
 *   - 無效/過期 Token 處理
 *   - 新密碼輸入和確認
 *   - 密碼強度顯示
 *   - 成功後重導向登入頁面
 *   - i18n 多語言支援
 *
 * @module src/app/[locale]/(auth)/auth/reset-password/page
 * @author Development Team
 * @since Epic 18 - Story 18.3 (Password Reset)
 * @lastModified 2026-01-19
 *
 * @dependencies
 *   - react-hook-form - 表單狀態管理
 *   - @hookform/resolvers/zod - Zod 驗證整合
 *   - next-intl - 翻譯
 *
 * @related
 *   - src/app/api/auth/reset-password/route.ts - API 端點
 *   - src/app/api/auth/verify-reset-token/route.ts - Token 驗證 API
 */

import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Link, useRouter } from '@/i18n/routing'

// ============================================================
// Validation Schema
// ============================================================

const resetPasswordSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type ResetPasswordInput = z.infer<typeof resetPasswordSchema>

// ============================================================
// Types
// ============================================================

interface TokenValidation {
  valid: boolean
  email?: string
  message?: string
}

// ============================================================
// Component
// ============================================================

/**
 * 重設密碼頁面組件
 *
 * @component
 * @description
 *   提供密碼重設的表單介面。
 *   先驗證 Token 有效性，然後允許用戶輸入新密碼。
 */
export default function ResetPasswordPage() {
  const t = useTranslations('auth')
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [tokenStatus, setTokenStatus] = React.useState<TokenValidation | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [isVerifying, setIsVerifying] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  })

  const password = watch('password')

  // ============================================================
  // Password Strength Calculation
  // ============================================================

  const passwordStrength = React.useMemo(() => {
    if (!password) return { score: 0, label: '', color: '' }

    let score = 0
    if (password.length >= 8) score++
    if (password.length >= 12) score++
    if (/[a-z]/.test(password)) score++
    if (/[A-Z]/.test(password)) score++
    if (/[0-9]/.test(password)) score++
    if (/[^a-zA-Z0-9]/.test(password)) score++

    const labels = [
      t('resetPassword.strength.weak'),
      t('resetPassword.strength.weak'),
      t('resetPassword.strength.fair'),
      t('resetPassword.strength.good'),
      t('resetPassword.strength.strong'),
      t('resetPassword.strength.veryStrong'),
    ]
    const colors = [
      'bg-red-500',
      'bg-red-500',
      'bg-orange-500',
      'bg-yellow-500',
      'bg-green-500',
      'bg-green-600',
    ]

    return {
      score: Math.min(score, 5),
      label: labels[Math.min(score, 5)],
      color: colors[Math.min(score, 5)],
    }
  }, [password, t])

  // ============================================================
  // Token Verification
  // ============================================================

  React.useEffect(() => {
    async function verifyToken() {
      if (!token) {
        setTokenStatus({ valid: false, message: 'Token is missing' })
        setIsVerifying(false)
        return
      }

      try {
        const response = await fetch(`/api/auth/verify-reset-token?token=${token}`)
        const data = await response.json()
        setTokenStatus(data)
      } catch {
        setTokenStatus({ valid: false, message: 'Verification failed' })
      } finally {
        setIsVerifying(false)
      }
    }

    verifyToken()
  }, [token])

  // ============================================================
  // Form Submission
  // ============================================================

  const onSubmit = async (data: ResetPasswordInput) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password: data.password,
          confirmPassword: data.confirmPassword,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        setError(result.error || t('resetPassword.error.failed'))
        setIsLoading(false)
        return
      }

      // 成功，重導向到登入頁面
      router.push('/auth/login?reset=success')
    } catch {
      setError(t('resetPassword.error.network'))
      setIsLoading(false)
    }
  }

  // ============================================================
  // Loading State
  // ============================================================

  if (isVerifying) {
    return (
      <>
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-blue-600 rounded-xl flex items-center justify-center mb-4 animate-pulse">
            <svg
              className="h-10 w-10 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {t('resetPassword.verifying')}
          </h2>
        </div>
      </>
    )
  }

  // ============================================================
  // Invalid Token State
  // ============================================================

  if (!tokenStatus?.valid) {
    return (
      <>
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-red-600 rounded-xl flex items-center justify-center mb-4">
            <svg
              className="h-10 w-10 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('resetPassword.invalidToken')}
          </h2>
        </div>

        <Card className="mt-8">
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <AlertDescription>
                {t('resetPassword.tokenExpiredMessage')}
              </AlertDescription>
            </Alert>
            <div className="mt-6 space-y-3">
              <Link href="/auth/forgot-password" className="block">
                <Button className="w-full">
                  {t('resetPassword.requestNew')}
                </Button>
              </Link>
              <Link href="/auth/login" className="block">
                <Button variant="outline" className="w-full">
                  {t('resetPassword.backToLogin')}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </>
    )
  }

  // ============================================================
  // Reset Form
  // ============================================================

  return (
    <>
      {/* Logo 和標題 */}
      <div className="text-center">
        <div className="mx-auto h-16 w-16 bg-blue-600 rounded-xl flex items-center justify-center mb-4">
          <svg
            className="h-10 w-10 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          AI Document Extraction
        </h2>
        {tokenStatus.email && (
          <p className="mt-2 text-sm text-muted-foreground">
            {t('resetPassword.forAccount')}: {tokenStatus.email}
          </p>
        )}
      </div>

      {/* 表單卡片 */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>{t('resetPassword.title')}</CardTitle>
          <CardDescription>{t('resetPassword.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          {/* 錯誤訊息 */}
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* 新密碼輸入 */}
            <div className="space-y-2">
              <Label htmlFor="password">{t('resetPassword.newPassword')}</Label>
              <Input
                id="password"
                type="password"
                placeholder={t('resetPassword.newPasswordPlaceholder')}
                autoComplete="new-password"
                disabled={isLoading}
                {...register('password')}
                className={errors.password ? 'border-destructive' : ''}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}

              {/* 密碼強度指示器 */}
              {password && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div
                        key={level}
                        className={`h-1.5 flex-1 rounded-full transition-colors ${
                          level <= passwordStrength.score
                            ? passwordStrength.color
                            : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('resetPassword.strength.label')}: {passwordStrength.label}
                  </p>
                </div>
              )}
            </div>

            {/* 確認密碼輸入 */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">
                {t('resetPassword.confirmPassword')}
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder={t('resetPassword.confirmPasswordPlaceholder')}
                autoComplete="new-password"
                disabled={isLoading}
                {...register('confirmPassword')}
                className={errors.confirmPassword ? 'border-destructive' : ''}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            {/* 密碼要求提示 */}
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium">{t('resetPassword.requirements.title')}</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>{t('register.passwordRequirements.minLength', { count: 8 })}</li>
                <li>{t('register.passwordRequirements.lowercase')}</li>
                <li>{t('register.passwordRequirements.uppercase')}</li>
                <li>{t('register.passwordRequirements.number')}</li>
              </ul>
            </div>

            {/* 提交按鈕 */}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? t('resetPassword.resetting') : t('resetPassword.submit')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  )
}
