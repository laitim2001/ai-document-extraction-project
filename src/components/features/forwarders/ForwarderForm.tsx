'use client'

/**
 * @fileoverview Forwarder 表單組件
 * @description
 *   提供 Forwarder 創建和編輯的表單。
 *   支援即時代碼驗證、Logo 上傳和表單驗證。
 *
 * @module src/components/features/forwarders/ForwarderForm
 * @author Development Team
 * @since Epic 5 - Story 5.5 (新增/停用貨代商配置)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 創建/編輯模式
 *   - 即時代碼唯一性驗證（debounce）
 *   - Logo 上傳和預覽
 *   - Zod 表單驗證
 *   - 提交狀態管理
 *
 * @dependencies
 *   - react-hook-form - 表單管理
 *   - @hookform/resolvers/zod - Zod 驗證
 *   - use-debounce - Debounce Hook
 *   - @/types/forwarder - 類型和驗證 Schema
 */

import * as React from 'react'
import { useCallback, useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useDebouncedCallback } from 'use-debounce'
import { useRouter } from 'next/navigation'
import { Loader2, Check, X, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import { LogoUploader } from './LogoUploader'
import {
  CreateForwarderSchema,
  CreateForwarderFormData,
  FORWARDER_FORM_LABELS,
} from '@/types/forwarder'

// ============================================================
// Types
// ============================================================

interface ForwarderFormProps {
  /** 編輯模式的初始數據 */
  initialData?: {
    id: string
    name: string
    code: string
    description?: string | null
    contactEmail?: string | null
    defaultConfidence?: number
    logoUrl?: string | null
  }
  /** 表單標題 */
  title?: string
  /** 表單描述 */
  description?: string
  /** 提交按鈕文字 */
  submitLabel?: string
  /** 自定義 className */
  className?: string
}

interface CodeCheckState {
  status: 'idle' | 'checking' | 'available' | 'taken' | 'error'
  message?: string
}

// ============================================================
// Component
// ============================================================

/**
 * @component ForwarderForm
 * @description
 *   Forwarder 創建/編輯表單。
 *   提供完整的表單驗證、即時代碼檢查和 Logo 上傳功能。
 */
export function ForwarderForm({
  initialData,
  title = '新增貨代商',
  description = '填寫貨代商基本資訊',
  submitLabel = '創建貨代商',
  className,
}: ForwarderFormProps) {
  const router = useRouter()
  const isEditMode = !!initialData?.id

  // --- State ---
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [removeLogo, setRemoveLogo] = useState(false)
  const [codeCheck, setCodeCheck] = useState<CodeCheckState>({ status: 'idle' })

  // --- Form ---
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateForwarderFormData>({
    resolver: zodResolver(CreateForwarderSchema),
    defaultValues: {
      name: initialData?.name || '',
      code: initialData?.code || '',
      description: initialData?.description || '',
      contactEmail: initialData?.contactEmail || '',
      defaultConfidence: initialData?.defaultConfidence || 0.8,
    },
  })

  const watchedCode = watch('code')
  const watchedConfidence = watch('defaultConfidence')

  // --- Code Check ---
  const checkCodeAvailability = useDebouncedCallback(async (code: string) => {
    // 如果是編輯模式且代碼未變更，跳過檢查
    if (isEditMode && code === initialData?.code) {
      setCodeCheck({ status: 'idle' })
      return
    }

    // 驗證代碼格式
    if (!code || code.length < 2) {
      setCodeCheck({ status: 'idle' })
      return
    }

    if (!/^[A-Z0-9_]+$/.test(code)) {
      setCodeCheck({
        status: 'error',
        message: '只能使用大寫字母、數字和底線',
      })
      return
    }

    setCodeCheck({ status: 'checking' })

    try {
      const response = await fetch(`/api/companies/check-code?code=${encodeURIComponent(code)}`)
      const data = await response.json()

      if (data.success && data.data.available) {
        setCodeCheck({
          status: 'available',
          message: '此代碼可以使用',
        })
      } else {
        setCodeCheck({
          status: 'taken',
          message: '此代碼已被使用',
        })
      }
    } catch {
      setCodeCheck({
        status: 'error',
        message: '檢查失敗，請稍後重試',
      })
    }
  }, 300)

  // 監聽代碼變更
  useEffect(() => {
    if (watchedCode) {
      checkCodeAvailability(watchedCode)
    }
  }, [watchedCode, checkCodeAvailability])

  // --- Handlers ---
  const handleLogoChange = useCallback((file: File | null) => {
    setLogoFile(file)
    if (file) {
      setRemoveLogo(false)
    }
  }, [])

  const handleRemoveLogo = useCallback(() => {
    setRemoveLogo(true)
    setLogoFile(null)
  }, [])

  const onSubmit = async (data: CreateForwarderFormData) => {
    // 檢查代碼是否可用（創建模式）
    if (!isEditMode && codeCheck.status === 'taken') {
      setSubmitError('請選擇一個可用的代碼')
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const formData = new FormData()
      formData.append('name', data.name)
      formData.append('code', data.code)
      formData.append('defaultConfidence', data.defaultConfidence.toString())

      if (data.description) {
        formData.append('description', data.description)
      }
      if (data.contactEmail) {
        formData.append('contactEmail', data.contactEmail)
      }
      if (logoFile) {
        formData.append('logo', logoFile)
      }
      if (removeLogo) {
        formData.append('removeLogo', 'true')
      }

      const url = isEditMode ? `/api/companies/${initialData.id}` : '/api/companies'
      const method = isEditMode ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        body: formData,
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error?.detail || '操作失敗')
      }

      // 成功後跳轉
      router.push('/companies')
      router.refresh()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '操作失敗，請稍後重試')
    } finally {
      setIsSubmitting(false)
    }
  }

  // --- Render Helpers ---
  const renderCodeStatus = () => {
    switch (codeCheck.status) {
      case 'checking':
        return (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            檢查中...
          </span>
        )
      case 'available':
        return (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <Check className="h-3 w-3" />
            {codeCheck.message}
          </span>
        )
      case 'taken':
        return (
          <span className="flex items-center gap-1 text-xs text-destructive">
            <X className="h-3 w-3" />
            {codeCheck.message}
          </span>
        )
      case 'error':
        return (
          <span className="flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="h-3 w-3" />
            {codeCheck.message}
          </span>
        )
      default:
        return null
    }
  }

  // --- Render ---
  return (
    <Card className={cn('w-full max-w-2xl', className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* 錯誤提示 */}
          {submitError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}

          {/* 基本資訊區 */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* 名稱 */}
            <div className="space-y-2">
              <Label htmlFor="name">{FORWARDER_FORM_LABELS.name.label}</Label>
              <Input
                id="name"
                placeholder={FORWARDER_FORM_LABELS.name.placeholder}
                {...register('name')}
                disabled={isSubmitting}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            {/* 代碼 */}
            <div className="space-y-2">
              <Label htmlFor="code">{FORWARDER_FORM_LABELS.code.label}</Label>
              <Input
                id="code"
                placeholder={FORWARDER_FORM_LABELS.code.placeholder}
                {...register('code', {
                  onChange: (e) => {
                    // 自動轉大寫
                    e.target.value = e.target.value.toUpperCase()
                  },
                })}
                disabled={isSubmitting || isEditMode}
                className="uppercase"
              />
              {errors.code ? (
                <p className="text-xs text-destructive">{errors.code.message}</p>
              ) : (
                <div className="h-4">{renderCodeStatus()}</div>
              )}
              <p className="text-xs text-muted-foreground">
                {FORWARDER_FORM_LABELS.code.description}
              </p>
            </div>
          </div>

          {/* 描述 */}
          <div className="space-y-2">
            <Label htmlFor="description">{FORWARDER_FORM_LABELS.description.label}</Label>
            <Textarea
              id="description"
              placeholder={FORWARDER_FORM_LABELS.description.placeholder}
              rows={3}
              {...register('description')}
              disabled={isSubmitting}
            />
            {errors.description && (
              <p className="text-xs text-destructive">{errors.description.message}</p>
            )}
          </div>

          {/* 聯絡信箱 */}
          <div className="space-y-2">
            <Label htmlFor="contactEmail">{FORWARDER_FORM_LABELS.contactEmail.label}</Label>
            <Input
              id="contactEmail"
              type="email"
              placeholder={FORWARDER_FORM_LABELS.contactEmail.placeholder}
              {...register('contactEmail')}
              disabled={isSubmitting}
            />
            {errors.contactEmail && (
              <p className="text-xs text-destructive">{errors.contactEmail.message}</p>
            )}
          </div>

          {/* 預設信心度 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>{FORWARDER_FORM_LABELS.defaultConfidence.label}</Label>
              <span className="text-sm font-medium">
                {Math.round((watchedConfidence || 0.8) * 100)}%
              </span>
            </div>
            <Slider
              value={[watchedConfidence || 0.8]}
              min={0}
              max={1}
              step={0.05}
              onValueChange={(value) => setValue('defaultConfidence', value[0])}
              disabled={isSubmitting}
              className="py-2"
            />
            <p className="text-xs text-muted-foreground">
              {FORWARDER_FORM_LABELS.defaultConfidence.description}
            </p>
          </div>

          {/* Logo 上傳 */}
          <div className="space-y-2">
            <Label>{FORWARDER_FORM_LABELS.logo.label}</Label>
            <LogoUploader
              currentLogoUrl={removeLogo ? null : initialData?.logoUrl}
              onLogoChange={handleLogoChange}
              onRemoveLogo={handleRemoveLogo}
              disabled={isSubmitting}
            />
          </div>

          {/* 操作按鈕 */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isSubmitting}
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || (!isEditMode && codeCheck.status === 'taken')}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {submitLabel}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
