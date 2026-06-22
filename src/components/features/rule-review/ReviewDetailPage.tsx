'use client'

/**
 * @fileoverview 規則審核詳情頁面組件
 * @description
 *   提供規則建議審核的主要界面，包含：
 *   - 規則詳情顯示（AC1）
 *   - 影響分析摘要（AC1）
 *   - 樣本案例表格（AC1）
 *   - 批准功能（AC2）
 *   - 拒絕功能（AC3）
 *
 * @module src/components/features/rule-review/ReviewDetailPage
 * @since Epic 4 - Story 4.6 (審核學習規則)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @/hooks/useSuggestionDetail - 建議詳情 Hook
 *   - @/hooks/useImpactAnalysis - 影響分析 Hook
 *   - @/hooks/useRuleApprove - 批准 Hook
 *   - @/hooks/useRuleReject - 拒絕 Hook
 *   - @/components/ui/* - shadcn UI 組件
 */

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSuggestionDetail } from '@/hooks/useSuggestionDetail'
import { useImpactAnalysis } from '@/hooks/useImpactAnalysis'
import { useRuleApprove } from '@/hooks/useRuleApprove'
import { useRuleReject } from '@/hooks/useRuleReject'
import { SuggestionInfo } from './SuggestionInfo'
import { ImpactSummaryCard } from './ImpactSummaryCard'
import { SampleCasesTable } from './SampleCasesTable'
import { ApproveDialog } from './ApproveDialog'
import { RejectDialog } from './RejectDialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft,
  Check,
  X,
  AlertCircle,
  ExternalLink,
  FileText,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import type { RejectionReason } from '@/types/review'

// ============================================================
// Types
// ============================================================

interface ReviewDetailPageProps {
  /** 規則建議 ID */
  suggestionId: string
}

// ============================================================
// Sub Components
// ============================================================

/**
 * 載入骨架
 */
function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-1/3" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
      <Skeleton className="h-48" />
    </div>
  )
}

/**
 * 錯誤狀態
 */
function ErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  const t = useTranslations('rules')

  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <AlertCircle className="h-12 w-12 text-destructive mb-4" />
      <h3 className="text-lg font-medium mb-2">
        {t('ruleReview.detail.loadFailed')}
      </h3>
      <p className="text-muted-foreground mb-4">{message}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw className="h-4 w-4 mr-2" />
          {t('ruleReview.detail.retry')}
        </Button>
      )}
    </div>
  )
}

/**
 * 狀態徽章
 */
function StatusBadge({ status }: { status: string }) {
  const t = useTranslations('rules')

  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    PENDING: 'secondary',
    APPROVED: 'default',
    REJECTED: 'destructive',
    IMPLEMENTED: 'outline',
  }

  const statusKey = `ruleReview.status.${status}`

  return (
    <Badge variant={variants[status] ?? 'default'}>
      {t.has(statusKey) ? t(statusKey) : status}
    </Badge>
  )
}

// ============================================================
// Component
// ============================================================

/**
 * 規則審核詳情頁面組件
 *
 * @description
 *   提供完整的規則建議審核界面：
 *   - AC1: 顯示規則詳情、影響分析、樣本案例
 *   - AC2: 批准功能（可選填備註和生效日期）
 *   - AC3: 拒絕功能（必選原因、必填說明）
 *
 * @example
 * ```tsx
 * <ReviewDetailPage suggestionId={params.id} />
 * ```
 */
export function ReviewDetailPage({ suggestionId }: ReviewDetailPageProps) {
  const t = useTranslations('rules')
  const router = useRouter()
  const [showApproveDialog, setShowApproveDialog] = useState(false)
  const [showRejectDialog, setShowRejectDialog] = useState(false)

  // 獲取建議詳情
  const {
    data: suggestion,
    isLoading: loadingSuggestion,
    error: suggestionError,
    refetch: refetchSuggestion,
  } = useSuggestionDetail(suggestionId)

  // 獲取影響分析
  const { data: impactData, isLoading: loadingImpact } = useImpactAnalysis(
    suggestionId,
    { enabled: !!suggestion }
  )

  // 批准和拒絕 mutations
  const approve = useRuleApprove(suggestionId)
  const reject = useRuleReject(suggestionId)

  // 處理批准
  const handleApprove = async (data: { notes?: string; effectiveDate?: string }) => {
    try {
      await approve.mutateAsync(data)
      toast.success(t('ruleReview.detail.approveSuccess'))
      setShowApproveDialog(false)
      router.push('/rules/review')
    } catch (error) {
      toast.error(
        t('ruleReview.detail.approveError', {
          message: (error as Error).message,
        })
      )
    }
  }

  // 處理拒絕
  const handleReject = async (data: { reason: RejectionReason; reasonDetail: string }) => {
    try {
      await reject.mutateAsync(data)
      toast.success(t('ruleReview.detail.rejectSuccess'))
      setShowRejectDialog(false)
      router.push('/rules/review')
    } catch (error) {
      toast.error(
        t('ruleReview.detail.rejectError', {
          message: (error as Error).message,
        })
      )
    }
  }

  // 處理文件點擊
  const handleDocumentClick = (documentId: string) => {
    router.push(`/documents/${documentId}`)
  }

  // 載入中
  if (loadingSuggestion) {
    return <LoadingSkeleton />
  }

  // 錯誤
  if (suggestionError) {
    return (
      <ErrorState
        message={suggestionError.message}
        onRetry={() => refetchSuggestion()}
      />
    )
  }

  // 無數據
  if (!suggestion) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium">
          {t('ruleReview.detail.notFound')}
        </h3>
        <p className="text-muted-foreground mt-1">
          {t('ruleReview.detail.notFoundDesc')}
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push('/rules/review')}
        >
          {t('ruleReview.detail.backToList')}
        </Button>
      </div>
    )
  }

  // 檢查是否為待審核狀態
  const isPending = suggestion.status === 'PENDING'

  // 轉換樣本案例格式
  const sampleCases = suggestion.sampleCases.map((sample) => ({
    documentId: sample.documentId,
    documentName: sample.documentName,
    originalValue: sample.correctedValue, // 人工確認的值
    extractedValue: sample.extractedValue ?? '', // 規則提取的值
    isMatch: sample.matchesExpected ?? false,
  }))

  return (
    <div className="space-y-6">
      {/* 標頭 */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/rules/review')}
            className="mb-2 -ml-2"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t('ruleReview.detail.backToList')}
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">
              {t('ruleReview.detail.reviewTitle')}
            </h1>
            <StatusBadge status={suggestion.status} />
          </div>
          <p className="text-muted-foreground">
            {suggestion.forwarder.name} - {suggestion.fieldName}
          </p>
        </div>
      </div>

      {/* 非待審核狀態提示 */}
      {!isPending && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {t('ruleReview.detail.notReviewable', {
              status: t.has(`ruleReview.status.${suggestion.status}`)
                ? t(`ruleReview.status.${suggestion.status}`)
                : suggestion.status,
            })}
            {suggestion.reviewNotes && (
              <span className="block mt-1 text-sm">
                {t('ruleReview.detail.reviewNotesLabel', {
                  notes: suggestion.reviewNotes,
                })}
              </span>
            )}
            {suggestion.rejectionReason && (
              <span className="block mt-1 text-sm">
                {t('ruleReview.detail.rejectionReasonLabel', {
                  reason: suggestion.rejectionReason,
                })}
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* 主要內容 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 規則詳情 */}
        <Card>
          <CardHeader>
            <CardTitle>{t('ruleReview.detail.ruleDetails')}</CardTitle>
          </CardHeader>
          <CardContent>
            <SuggestionInfo
              suggestion={{
                id: suggestion.id,
                fieldName: suggestion.fieldName,
                extractionType: suggestion.extractionType,
                suggestedPattern: suggestion.suggestedPattern,
                confidence: suggestion.confidence,
                source: suggestion.source as 'AUTO' | 'MANUAL',
                status: suggestion.status,
                sampleCount: suggestion.sampleCases.length,
                createdAt: suggestion.createdAt,
                forwarder: suggestion.forwarder,
                createdBy: suggestion.suggestedBy,
              }}
            />
          </CardContent>
        </Card>

        {/* 影響分析 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t('ruleReview.detail.impactAnalysis')}</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/rules/suggestions/${suggestionId}/impact`}>
                <ExternalLink className="h-4 w-4 mr-1" />
                {t('ruleReview.detail.detailedAnalysis')}
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loadingImpact ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
                <Skeleton className="h-8" />
              </div>
            ) : impactData ? (
              <ImpactSummaryCard statistics={impactData.statistics} />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>{t('ruleReview.detail.impactLoadFailed')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 樣本案例 */}
      <Card>
        <CardHeader>
          <CardTitle>{t('ruleReview.detail.sampleCases')}</CardTitle>
        </CardHeader>
        <CardContent>
          <SampleCasesTable
            cases={sampleCases}
            onCaseClick={handleDocumentClick}
          />
        </CardContent>
      </Card>

      {/* 審核操作 */}
      {isPending && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-end gap-4">
              <Button
                variant="outline"
                onClick={() => setShowRejectDialog(true)}
                disabled={reject.isPending}
              >
                <X className="h-4 w-4 mr-2" />
                {t('ruleReview.detail.reject')}
              </Button>
              <Button
                onClick={() => setShowApproveDialog(true)}
                disabled={approve.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                <Check className="h-4 w-4 mr-2" />
                {t('ruleReview.detail.approve')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 批准對話框 */}
      <ApproveDialog
        open={showApproveDialog}
        onOpenChange={setShowApproveDialog}
        onConfirm={handleApprove}
        isLoading={approve.isPending}
      />

      {/* 拒絕對話框 */}
      <RejectDialog
        open={showRejectDialog}
        onOpenChange={setShowRejectDialog}
        onConfirm={handleReject}
        isLoading={reject.isPending}
      />
    </div>
  )
}
