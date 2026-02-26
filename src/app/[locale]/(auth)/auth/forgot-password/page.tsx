'use client'

/**
 * @fileoverview 忘記密碼頁面
 * @description
 *   提供忘記密碼功能，用戶可輸入電子郵件請求重設連結。
 *
 *   功能特點：
 *   - 電子郵件輸入表單
 *   - 提交後顯示成功訊息（無論郵件是否註冊）
 *   - 返回登入頁面連結
 *   - i18n 多語言支援
 *
 * @module src/app/[locale]/(auth)/auth/forgot-password/page
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
 *   - src/app/api/auth/forgot-password/route.ts - API 端點
 *   - src/app/[locale]/(auth)/auth/reset-password/page.tsx - 重設密碼頁面
 */

import * as React from 'react'
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
import { Link } from '@/i18n/routing'

// ============================================================
// Validation Schema
// ============================================================

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
})

type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

// ============================================================
// Component
// ============================================================

/**
 * 忘記密碼頁面組件
 *
 * @component
 * @description
 *   提供忘記密碼的表單介面。
 *   用戶輸入電子郵件後，系統發送重設連結。
 */
export default function ForgotPasswordPage() {
  const t = useTranslations('auth')
  const [isLoading, setIsLoading] = React.useState(false)
  const [isSubmitted, setIsSubmitted] = React.useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  })

  /**
   * 處理表單提交
   */
  const onSubmit = async (data: ForgotPasswordInput) => {
    setIsLoading(true)

    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      // 無論結果如何都顯示成功（安全考量）
      setIsSubmitted(true)
    } catch {
      // 即使發生錯誤也顯示成功（不洩漏資訊）
      setIsSubmitted(true)
    } finally {
      setIsLoading(false)
    }
  }

  // 成功提交後顯示確認訊息
  if (isSubmitted) {
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
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('forgotPassword.checkEmail')}
          </h2>
        </div>

        <Card className="mt-8">
          <CardContent className="pt-6">
            <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
              <AlertDescription className="text-green-800 dark:text-green-200">
                {t('forgotPassword.success')}
              </AlertDescription>
            </Alert>
            <p className="mt-4 text-sm text-muted-foreground text-center">
              {t('forgotPassword.checkSpam')}
            </p>
            <div className="mt-6 text-center">
              <Link href="/auth/login">
                <Button variant="outline">
                  {t('forgotPassword.backToLogin')}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </>
    )
  }

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
      </div>

      {/* 表單卡片 */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>{t('forgotPassword.title')}</CardTitle>
          <CardDescription>{t('forgotPassword.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Email 輸入 */}
            <div className="space-y-2">
              <Label htmlFor="email">{t('forgotPassword.email')}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t('forgotPassword.emailPlaceholder')}
                autoComplete="email"
                disabled={isLoading}
                {...register('email')}
                className={errors.email ? 'border-destructive' : ''}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            {/* 提交按鈕 */}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? t('forgotPassword.sending') : t('forgotPassword.submit')}
            </Button>
          </form>

          {/* 返回登入連結 */}
          <div className="mt-6 text-center">
            <Link
              href="/auth/login"
              className="text-sm text-primary hover:underline"
            >
              {t('forgotPassword.backToLogin')}
            </Link>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
