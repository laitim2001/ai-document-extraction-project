'use client'

/**
 * @fileoverview 映射規則編輯頁面
 * @description
 *   映射規則編輯頁面，提供：
 *   - 規則資訊編輯表單
 *   - 提取模式配置
 *   - 預覽功能
 *   - 變更原因記錄
 *
 * @module src/app/(dashboard)/rules/[id]/edit/page
 * @since Epic 5 - Story 5.3 (編輯 Forwarder 映射規則)
 * @lastModified 2026-01-17
 *
 * @dependencies
 *   - react - use() hook for async params
 *   - @/components/features/rules/RuleEditForm - 規則編輯表單
 */

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { RuleEditForm } from '@/components/features/rules/RuleEditForm'
import { useToast } from '@/hooks/use-toast'

// ============================================================
// Types
// ============================================================

interface PageProps {
  params: Promise<{ id: string }>
}

interface RuleData {
  id: string
  fieldName: string
  fieldLabel: string
  extractionType: string
  extractionPattern: Record<string, unknown>
  priority: number
  confidence: number
  description?: string
  forwarderId: string
}

// ============================================================
// API Functions
// ============================================================

async function fetchRule(ruleId: string): Promise<RuleData> {
  const response = await fetch(`/api/v1/rules/${ruleId}`)
  if (!response.ok) {
    throw new Error('Failed to fetch rule')
  }
  const data = await response.json()
  return data.data
}

// ============================================================
// Page Component
// ============================================================

/**
 * 映射規則編輯頁面
 * 提供規則編輯表單和預覽功能
 */
export default function RuleEditPage({ params }: PageProps) {
  const resolvedParams = use(params)
  const ruleId = resolvedParams.id
  const router = useRouter()
  const t = useTranslations('rules')
  const { toast } = useToast()

  const { data: rule, isLoading, error } = useQuery({
    queryKey: ['rule', ruleId],
    queryFn: () => fetchRule(ruleId),
  })

  const handleSuccess = () => {
    toast({
      title: t('ruleEdit.toast.submitted'),
      description: t('ruleEdit.toast.submittedDesc'),
    })
    router.push(`/rules/${ruleId}`)
  }

  const handleCancel = () => {
    router.push(`/rules/${ruleId}`)
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (error || !rule) {
    return (
      <div className="container mx-auto py-6">
        <Alert variant="destructive">
          <AlertDescription>
            {t('detail.loadFailed')}
          </AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button variant="outline" asChild>
            <Link href="/rules">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('detail.backToList')}
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href={`/rules/${ruleId}`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('detail.backToList')}
          </Link>
        </Button>
      </div>

      {/* Edit Form Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t('ruleEdit.dialog.title', { fieldLabel: rule.fieldLabel })}</CardTitle>
          <CardDescription>{t('ruleEdit.dialog.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <RuleEditForm
            rule={rule}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        </CardContent>
      </Card>
    </div>
  )
}
