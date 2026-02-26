/**
 * @fileoverview 用戶註冊表單組件
 * @description
 *   提供用戶註冊功能的表單組件，包含：
 *   - 姓名、電子郵件、密碼輸入欄位
 *   - 即時表單驗證
 *   - 密碼強度指示器
 *   - 密碼顯示/隱藏切換
 *   - 國際化支援
 *
 * @module src/components/features/auth/RegisterForm
 * @author Development Team
 * @since Epic 18 - Story 18.1
 * @lastModified 2026-01-19
 *
 * @dependencies
 *   - react-hook-form - 表單管理
 *   - @hookform/resolvers/zod - Zod 整合
 *   - next-intl - 國際化
 *   - @/validations/auth - 驗證 Schema
 *   - @/lib/password - 密碼要求
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

// ============================================================
// Types
// ============================================================

interface RegisterFormProps {
  /** 回調 URL（可選） */
  callbackUrl?: string
}

// ============================================================
// Sub-components
// ============================================================

/**
 * 密碼要求檢查項
 */
function PasswordCheck({ passed, label }: { passed: boolean; label: string }) {
  return (
    <div
      className={`flex items-center gap-2 ${passed ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}
    >
      {passed ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      <span>{label}</span>
    </div>
  )
}

// ============================================================
// Component
// ============================================================

/**
 * @component RegisterForm
 * @description 用戶註冊表單
 */
export function RegisterForm({ callbackUrl }: RegisterFormProps) {
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

  // 表單提交
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
        // 處理錯誤訊息
        if (result.error?.errors) {
          // Zod 驗證錯誤
          const firstError = Object.values(result.error.errors)[0]
          setError(Array.isArray(firstError) ? firstError[0] : String(firstError))
        } else {
          setError(result.error?.detail || t('register.error.failed'))
        }
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

          {/* 姓名 */}
          <div className="space-y-2">
            <Label htmlFor="name">{t('register.name')}</Label>
            <Input
              id="name"
              type="text"
              placeholder={t('register.namePlaceholder')}
              {...register('name')}
              disabled={isLoading}
              autoComplete="name"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* 電子郵件 */}
          <div className="space-y-2">
            <Label htmlFor="email">{t('register.email')}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t('register.emailPlaceholder')}
              {...register('email')}
              disabled={isLoading}
              autoComplete="email"
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          {/* 密碼 */}
          <div className="space-y-2">
            <Label htmlFor="password">{t('register.password')}</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder={t('register.passwordPlaceholder')}
                {...register('password')}
                disabled={isLoading}
                autoComplete="new-password"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}

            {/* 密碼強度指示器 */}
            {password && (
              <div className="space-y-1 text-xs mt-2">
                <PasswordCheck
                  passed={passwordChecks.minLength}
                  label={t('register.passwordRequirements.minLength', {
                    count: PASSWORD_REQUIREMENTS.minLength,
                  })}
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

          {/* 確認密碼 */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t('register.confirmPassword')}</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder={t('register.confirmPasswordPlaceholder')}
                {...register('confirmPassword')}
                disabled={isLoading}
                autoComplete="new-password"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">
                {errors.confirmPassword.message}
              </p>
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
