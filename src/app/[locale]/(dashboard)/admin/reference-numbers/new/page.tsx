/**
 * @fileoverview Reference Number 新增頁面
 * @description
 *   提供新增 Reference Number 的表單頁面：
 *   - 整合 ReferenceNumberForm 組件
 *   - 提交後導向列表頁
 *   - Toast 通知成功/失敗
 *
 * @module src/app/(dashboard)/admin/reference-numbers/new
 * @since Epic 20 - Story 20.6 (Management Page - Form & Import)
 * @lastModified 2026-02-05
 */

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Hash } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Link, useRouter } from '@/i18n/routing'
import { useToast } from '@/hooks/use-toast'
import { useCreateReferenceNumber } from '@/hooks/use-reference-numbers'
import {
  ReferenceNumberForm,
} from '@/components/features/reference-number'
import type { ReferenceNumberFormValues } from '@/components/features/reference-number/ReferenceNumberForm'

// ============================================================
// Page Component
// ============================================================

export default function NewReferenceNumberPage() {
  const t = useTranslations('referenceNumber')
  const router = useRouter()
  const { toast } = useToast()
  const createMutation = useCreateReferenceNumber()

  const handleSubmit = async (values: ReferenceNumberFormValues) => {
    try {
      await createMutation.mutateAsync({
        number: values.number,
        type: values.type,
        year: values.year,
        regionId: values.regionId,
        description: values.description || null,
        validFrom: values.validFrom ? values.validFrom.toISOString() : null,
        validUntil: values.validUntil ? values.validUntil.toISOString() : null,
      })
      toast({ title: t('messages.created') })
      router.push('/admin/reference-numbers')
    } catch {
      toast({
        variant: 'destructive',
        title: t('messages.createFailed'),
      })
    }
  }

  return (
    <div className="container mx-auto py-6 max-w-2xl space-y-6">
      {/* 返回連結 */}
      <Button variant="ghost" size="sm" asChild>
        <Link href="/admin/reference-numbers">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('actions.backToList')}
        </Link>
      </Button>

      {/* 頁面標題 */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Hash className="h-6 w-6" />
          {t('new.title')}
        </h1>
        <p className="text-muted-foreground">{t('new.description')}</p>
      </div>

      {/* 表單 */}
      <Card>
        <CardContent className="pt-6">
          <ReferenceNumberForm onSubmit={handleSubmit} />
        </CardContent>
      </Card>
    </div>
  )
}
