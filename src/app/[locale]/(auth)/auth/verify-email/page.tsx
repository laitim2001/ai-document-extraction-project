'use client'

/**
 * @fileoverview 郵件驗證結果頁面
 * @description
 *   顯示郵件驗證的各種結果狀態，並提供重新發送功能。
 *
 *   狀態類型：
 *   - success: 驗證成功（由 API 直接重導向至登入頁面）
 *   - expired: Token 已過期
 *   - invalid: Token 無效
 *   - already_verified: 郵件已驗證
 *   - error: 系統錯誤
 *   - (無狀態): 顯示重新發送表單
 *
 * @module src/app/[locale]/(auth)/auth/verify-email/page
 * @author Development Team
 * @since Epic 18 - Story 18.4 (Email Verification)
 * @lastModified 2026-01-19
 *
 * @dependencies
 *   - next-intl - 翻譯
 *   - @/components/ui/* - UI 組件
 *   - @/i18n/routing - 國際化路由
 */

import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { CheckCircle, XCircle, Clock, Mail, AlertCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Link } from '@/i18n/routing'

// ============================================================
// Types
// ============================================================

type VerificationStatus =
  | 'expired'
  | 'invalid'
  | 'already_verified'
  | 'error'
  | null

type ResendStatus = 'idle' | 'success' | 'error' | 'rate_limited' | 'already_verified'

// ============================================================
// Component
// ============================================================

/**
 * 郵件驗證結果頁面
 *
 * @description
 *   根據 URL 參數顯示不同的驗證結果，並提供重新發送驗證郵件的功能。
 */
export default function VerifyEmailPage() {
  const t = useTranslations('auth')
  const searchParams = useSearchParams()

  // 從 URL 參數獲取狀態和郵件
  const status = searchParams.get('status') as VerificationStatus
  const emailParam = searchParams.get('email')

  // 本地狀態
  const [email, setEmail] = React.useState(emailParam || '')
  const [isLoading, setIsLoading] = React.useState(false)
  const [resendStatus, setResendStatus] = React.useState<ResendStatus>('idle')

  /**
   * 處理重新發送驗證郵件
   */
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
        setResendStatus('rate_limited')
        return
      }

      if (!response.ok) {
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

  /**
   * 根據狀態渲染不同的圖標和標題
   */
  const renderStatusContent = () => {
    switch (status) {
      case 'expired':
        return (
          <>
            <div className="flex justify-center mb-4">
              <Clock className="h-16 w-16 text-yellow-500" />
            </div>
            <CardTitle className="text-center text-xl">
              {t('verifyEmail.expired')}
            </CardTitle>
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
            <CardTitle className="text-center text-xl">
              {t('verifyEmail.invalid')}
            </CardTitle>
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
            <CardTitle className="text-center text-xl">
              {t('verifyEmail.alreadyVerified')}
            </CardTitle>
            <p className="text-center text-muted-foreground mt-2">
              {t('verifyEmail.alreadyVerifiedDescription')}
            </p>
          </>
        )

      case 'error':
        return (
          <>
            <div className="flex justify-center mb-4">
              <AlertCircle className="h-16 w-16 text-destructive" />
            </div>
            <CardTitle className="text-center text-xl">
              {t('verifyEmail.error')}
            </CardTitle>
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
            <CardTitle className="text-center text-xl">
              {t('verifyEmail.title')}
            </CardTitle>
            <p className="text-center text-muted-foreground mt-2">
              {t('verifyEmail.description')}
            </p>
          </>
        )
    }
  }

  /**
   * 渲染重新發送狀態提示
   */
  const renderResendAlert = () => {
    switch (resendStatus) {
      case 'success':
        return (
          <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              {t('verifyEmail.resendSuccess')}
            </AlertDescription>
          </Alert>
        )

      case 'error':
        return (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{t('verifyEmail.resendError')}</AlertDescription>
          </Alert>
        )

      case 'rate_limited':
        return (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{t('verifyEmail.rateLimited')}</AlertDescription>
          </Alert>
        )

      case 'already_verified':
        return (
          <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              {t('verifyEmail.alreadyVerified')}
            </AlertDescription>
          </Alert>
        )

      default:
        return null
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>{renderStatusContent()}</CardHeader>
      <CardContent className="space-y-4">
        {/* 重新發送功能（非 already_verified 狀態時顯示） */}
        {status !== 'already_verified' && (
          <div className="space-y-4">
            {renderResendAlert()}

            <div className="space-y-2">
              <Label htmlFor="email">{t('verifyEmail.emailLabel')}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t('verifyEmail.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <Button
              onClick={handleResend}
              className="w-full"
              disabled={isLoading || !email}
            >
              {isLoading ? t('verifyEmail.sending') : t('verifyEmail.resend')}
            </Button>
          </div>
        )}

        {/* already_verified 狀態時顯示登入按鈕 */}
        {status === 'already_verified' && (
          <Link href="/auth/login">
            <Button className="w-full">{t('verifyEmail.login')}</Button>
          </Link>
        )}

        {/* 返回登入連結 */}
        <div className="text-center">
          <Link href="/auth/login">
            <Button variant="link">{t('verifyEmail.backToLogin')}</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
