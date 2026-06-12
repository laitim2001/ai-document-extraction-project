/**
 * @fileoverview 審核詳情頁面
 * @description
 *   並排 PDF 對照審核介面，提供：
 *   - 左側：PDF 原始文件檢視器
 *   - 右側：提取欄位審核面板
 *   - 欄位與 PDF 來源位置聯動
 *   - 響應式佈局（桌面並排 / 行動版 Tab 切換）
 *   - 審核確認對話框（Story 3.4）
 *   - 升級複雜案例對話框（Story 3.7）
 *
 * @module src/app/(dashboard)/review/[id]/page
 * @since Epic 3 - Story 3.2 (並排 PDF 審核介面)
 * @lastModified 2025-12-23
 *
 * @dependencies
 *   - @/hooks/useReviewDetail - 審核詳情資料獲取
 *   - @/hooks/useApproveReview - 審核確認 Hook (Story 3.4)
 *   - @/hooks/useEscalateReview - 升級案例 Hook (Story 3.7)
 *   - @/stores/reviewStore - 審核狀態管理
 *   - @/components/features/review - 審核相關組件
 */

'use client'

import { useCallback, useEffect, use, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Link, useRouter } from '@/i18n/routing'
import { useReviewDetail } from '@/hooks/useReviewDetail'
import { useApproveReview } from '@/hooks/useApproveReview'
import { useEscalateReview } from '@/hooks/useEscalateReview'
import { useReviewStore } from '@/stores/reviewStore'
import {
  DynamicPdfViewer,
  ReviewPanel,
  ReviewDetailLayout,
  ApprovalConfirmDialog,
  EscalationDialog,
} from '@/components/features/review'
import type { EscalateRequest } from '@/types/escalation'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ArrowLeft, AlertTriangle, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

// ============================================================
// Types
// ============================================================

interface ReviewDetailPageProps {
  params: Promise<{ id: string }>
}

// ============================================================
// Loading Component
// ============================================================

function ReviewDetailSkeleton() {
  return (
    <div className="h-[calc(100vh-120px)] flex gap-4">
      {/* PDF 側骨架 */}
      <div className="flex-1">
        <Skeleton className="h-full w-full" />
      </div>
      {/* 審核面板骨架 */}
      <div className="w-[400px] space-y-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    </div>
  )
}

// ============================================================
// Error Component
// ============================================================

interface ErrorStateProps {
  error: Error
  onRetry: () => void
}

function ErrorState({ error, onRetry }: ErrorStateProps) {
  const t = useTranslations('review')
  return (
    <div className="h-[calc(100vh-120px)] flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold">{t('detail.loadFailed')}</h2>
        <p className="text-muted-foreground max-w-md">
          {error.message || t('detail.loadFailedDesc')}
        </p>
        <Button onClick={onRetry} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          {t('detail.reload')}
        </Button>
      </div>
    </div>
  )
}

// ============================================================
// Unsaved Changes Dialog
// ============================================================

interface UnsavedChangesDialogProps {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
}

function UnsavedChangesDialog({
  isOpen,
  onConfirm,
  onCancel,
}: UnsavedChangesDialogProps) {
  const t = useTranslations('review')
  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('dialog.unsavedChanges')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('dialog.unsavedChangesDesc')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            {t('dialog.continueEditing')}
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {t('dialog.discardChanges')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ============================================================
// Main Page Component
// ============================================================

/**
 * 審核詳情頁面
 *
 * @description
 *   提供並排 PDF 對照審核介面，支援：
 *   - PDF 檢視與縮放
 *   - 提取欄位瀏覽與選擇
 *   - 欄位與 PDF 來源位置聯動
 *   - 確認無誤 / 儲存修正 / 升級案例操作
 */
export default function ReviewDetailPage({ params }: ReviewDetailPageProps) {
  const router = useRouter()
  const t = useTranslations('review')
  const resolvedParams = use(params)
  const documentId = resolvedParams.id

  // --- State ---
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [showApprovalDialog, setShowApprovalDialog] = useState(false)
  const [showEscalateDialog, setShowEscalateDialog] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(
    null
  )

  // 追蹤審核開始時間（用於計算審核時長）
  const reviewStartedAtRef = useRef<string>(new Date().toISOString())

  // --- Hooks ---
  const { data, isLoading, error, refetch } = useReviewDetail(documentId)
  const { hasPendingChanges, resetStore } = useReviewStore()

  // 審核確認 Hook (Story 3.4)
  const { mutate: approveDocument, isPending: isApproving } = useApproveReview({
    onSuccess: () => {
      toast.success(t('toast.reviewConfirmed'), {
        description: t('toast.documentApproved'),
      })
      resetStore()
      router.push('/review')
    },
    onError: (err) => {
      toast.error(t('toast.confirmFailed'), {
        description: err.message,
      })
    },
  })

  // 升級案例 Hook (Story 3.7)
  const { mutate: escalateDocument, isPending: isEscalating } =
    useEscalateReview({
      onSuccess: () => {
        toast.success(t('toast.caseEscalated'), {
          description: t('toast.escalationNotified'),
        })
        setShowEscalateDialog(false)
        resetStore()
        router.push('/review')
      },
      onError: (err) => {
        toast.error(t('toast.escalationFailed'), {
          description: err.message,
        })
      },
    })

  // --- Effects ---
  // 重置 store 狀態（進入頁面時）
  useEffect(() => {
    resetStore()
  }, [documentId, resetStore])

  // 瀏覽器離開頁面提示
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasPendingChanges()) {
        e.preventDefault()
        e.returnValue = ''
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasPendingChanges])

  // --- Handlers ---
  /**
   * 處理返回導航（檢查未儲存修改）
   */
  const handleBack = useCallback(() => {
    if (hasPendingChanges()) {
      setPendingNavigation('/review')
      setShowUnsavedDialog(true)
    } else {
      router.push('/review')
    }
  }, [hasPendingChanges, router])

  /**
   * 確認離開（放棄未儲存修改）
   */
  const handleConfirmLeave = useCallback(() => {
    setShowUnsavedDialog(false)
    resetStore()
    if (pendingNavigation) {
      router.push(pendingNavigation)
    }
  }, [pendingNavigation, resetStore, router])

  /**
   * 取消離開
   */
  const handleCancelLeave = useCallback(() => {
    setShowUnsavedDialog(false)
    setPendingNavigation(null)
  }, [])

  /**
   * 確認無誤按鈕點擊（顯示確認對話框）
   */
  const handleApprove = useCallback(() => {
    setShowApprovalDialog(true)
  }, [])

  /**
   * 確認審核通過（對話框確認後）
   *
   * @description
   *   Story 3.4 AC2: 確認處理
   *   - 更新 Document 狀態為 APPROVED
   *   - 建立 ReviewRecord 記錄
   *   - 記錄審計日誌
   */
  const handleConfirmApproval = useCallback(
    (notes?: string) => {
      if (!data) return

      // 收集所有欄位 ID 作為已確認欄位
      const confirmedFields = data.extraction.fields.map((f) => f.id)

      approveDocument({
        documentId,
        data: {
          confirmedFields,
          notes,
          reviewStartedAt: reviewStartedAtRef.current,
        },
      })
    },
    [data, documentId, approveDocument]
  )

  /**
   * 儲存修正
   */
  const handleSaveCorrections = useCallback(async () => {
    const pendingChanges = useReviewStore.getState().pendingChanges

    if (pendingChanges.size === 0) {
      toast.info(t('toast.noChanges'))
      return
    }

    setIsSubmitting(true)
    try {
      const corrections = Array.from(pendingChanges.entries()).map(
        ([fieldId, value]) => ({
          fieldId,
          correctedValue: value,
        })
      )

      const response = await fetch(`/api/review/${documentId}/corrections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ corrections }),
      })

      if (!response.ok) {
        throw new Error(t('toast.saveFailed'))
      }

      toast.success(t('toast.correctionsSaved'), {
        description: t('toast.correctionsSavedDesc', {
          count: corrections.length,
        }),
      })

      resetStore()
      refetch()
    } catch (err) {
      toast.error(t('toast.saveFailedRetry'), {
        description: err instanceof Error ? err.message : t('toast.tryAgainLater'),
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [documentId, refetch, resetStore, t])

  /**
   * 升級案例按鈕點擊（顯示升級對話框）
   */
  const handleEscalate = useCallback(() => {
    setShowEscalateDialog(true)
  }, [])

  /**
   * 確認升級案例（對話框確認後）
   *
   * @description
   *   Story 3.7 AC2: 升級處理
   *   - 更新 Document 狀態為 ESCALATED
   *   - 建立 Escalation 記錄
   *   - 通知 Super User
   *   - 記錄審計日誌
   */
  const handleConfirmEscalate = useCallback(
    (escalateData: EscalateRequest) => {
      escalateDocument({
        documentId,
        data: escalateData,
      })
    },
    [documentId, escalateDocument]
  )

  // --- Render ---

  // 載入中
  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" disabled>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Skeleton className="h-8 w-48" />
        </div>
        <ReviewDetailSkeleton />
      </div>
    )
  }

  // 錯誤狀態
  if (error) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">{t('page.reviewDetails')}</h1>
        </div>
        <ErrorState error={error as Error} onRetry={() => refetch()} />
      </div>
    )
  }

  // 資料不存在
  if (!data) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/review">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">{t('page.documentNotFound')}</h1>
        </div>
        <p className="text-muted-foreground">{t('page.documentNotFoundDesc')}</p>
      </div>
    )
  }

  // 正常渲染
  return (
    <div className="container mx-auto py-6 space-y-4">
      {/* 頁面標題列 */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBack}
          title={t('page.backToList')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-semibold truncate">
          {t('page.review', { fileName: data.document.fileName })}
        </h1>
      </div>

      {/* 主要內容區域 */}
      <div className="h-[calc(100vh-160px)]">
        <ReviewDetailLayout
          pdfViewer={
            <DynamicPdfViewer
              url={`/api/documents/${documentId}/blob`}
              pageCount={data.document.pageCount || 1}
            />
          }
          reviewPanel={
            <ReviewPanel
              data={data}
              onApprove={handleApprove}
              onSaveCorrections={handleSaveCorrections}
              onEscalate={handleEscalate}
              isSubmitting={isSubmitting || isApproving || isEscalating}
            />
          }
        />
      </div>

      {/* 未儲存修改對話框 */}
      <UnsavedChangesDialog
        isOpen={showUnsavedDialog}
        onConfirm={handleConfirmLeave}
        onCancel={handleCancelLeave}
      />

      {/* 審核確認對話框 (Story 3.4) */}
      <ApprovalConfirmDialog
        open={showApprovalDialog}
        onOpenChange={setShowApprovalDialog}
        onConfirm={handleConfirmApproval}
        fieldCount={data?.extraction.fields.length || 0}
        isSubmitting={isApproving}
        processingPath={data?.processingQueue?.processingPath}
      />

      {/* 升級案例對話框 (Story 3.7) */}
      <EscalationDialog
        open={showEscalateDialog}
        onOpenChange={setShowEscalateDialog}
        onConfirm={handleConfirmEscalate}
        documentName={data?.document.fileName || ''}
        isSubmitting={isEscalating}
      />
    </div>
  )
}
