'use client'

/**
 * @fileoverview 處理確認對話框組件
 * @description
 *   在批量處理開始前顯示成本估算和處理明細，
 *   讓用戶確認是否開始處理。
 *
 * @module src/components/features/historical-data/ProcessingConfirmDialog
 * @since Epic 0 - Story 0.2
 * @lastModified 2026-01-20
 *
 * @features
 *   - 顯示文件分類統計（Azure DI / GPT Vision）
 *   - 顯示成本估算明細
 *   - 確認/取消按鈕
 *   - 多語言支援 (Epic 17)
 *
 * @dependencies
 *   - Dialog UI 組件
 *   - cost-estimation.service
 *   - next-intl
 *
 * @related
 *   - src/services/cost-estimation.service.ts - 成本估算服務
 *   - src/services/processing-router.service.ts - 處理路由服務
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, FileText, FileImage, AlertCircle, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import type { BatchCostEstimation } from '@/services/cost-estimation.service'

// ============================================================
// Types
// ============================================================

interface ProcessingConfirmDialogProps {
  /** 對話框是否開啟 */
  open: boolean
  /** 關閉對話框回調 */
  onOpenChange: (open: boolean) => void
  /** 成本估算資料 */
  costEstimation: BatchCostEstimation | null
  /** 確認處理回調 */
  onConfirm: () => void
  /** 是否正在處理 */
  isProcessing?: boolean
  /** 批次名稱（可選） */
  batchName?: string
}

// ============================================================
// Sub Components
// ============================================================

/**
 * 處理方式卡片
 */
function ProcessingMethodCard({
  icon: Icon,
  title,
  description,
  fileCount,
  pages,
  costPerPage,
  totalCost,
  variant = 'default',
  t,
}: {
  icon: React.ElementType
  title: string
  description: string
  fileCount: number
  pages: number
  costPerPage: number
  totalCost: number
  variant?: 'default' | 'ai'
  t: ReturnType<typeof useTranslations<'historicalData.processingDialog'>>
}) {
  if (fileCount === 0) return null

  return (
    <Card className={cn(
      'transition-all',
      variant === 'ai' && 'border-purple-200 bg-purple-50/50'
    )}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className={cn(
              'p-2 rounded-lg',
              variant === 'default' ? 'bg-blue-100' : 'bg-purple-100'
            )}>
              <Icon className={cn(
                'h-5 w-5',
                variant === 'default' ? 'text-blue-600' : 'text-purple-600'
              )} />
            </div>
            <div>
              <h4 className="font-medium">{title}</h4>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
          <Badge variant={variant === 'ai' ? 'secondary' : 'outline'}>
            {t('card.fileCount', { count: fileCount })}
          </Badge>
        </div>

        <Separator className="my-3" />

        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">{t('card.estimatedPages')}</p>
            <p className="font-medium">{t('card.pageCount', { count: pages })}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t('card.costPerPage')}</p>
            <p className="font-medium">${costPerPage.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t('card.estimatedCost')}</p>
            <p className="font-medium text-primary">${totalCost.toFixed(2)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * 成本摘要
 */
function CostSummary({
  estimation,
  t,
}: {
  estimation: BatchCostEstimation
  t: ReturnType<typeof useTranslations<'historicalData.processingDialog'>>
}) {
  return (
    <Card className="bg-muted/50 border-2">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">{t('summary.totalCost')}</span>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-primary">
              ${estimation.totalCost.toFixed(2)}
            </p>
            <p className="text-sm text-muted-foreground">
              {t('summary.filesAndPages', {
                files: estimation.totalFiles,
                pages: estimation.totalPages
              })}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================
// Main Component
// ============================================================

/**
 * 處理確認對話框
 *
 * @description
 *   在批量處理開始前顯示成本估算，讓用戶確認。
 *   顯示 Azure DI 和 GPT Vision 的文件分類和成本。
 */
export function ProcessingConfirmDialog({
  open,
  onOpenChange,
  costEstimation,
  onConfirm,
  isProcessing = false,
  batchName,
}: ProcessingConfirmDialogProps) {
  const t = useTranslations('historicalData.processingDialog')

  // 如果沒有估算資料，顯示空狀態
  if (!costEstimation) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t('loading.title')}</DialogTitle>
            <DialogDescription>
              {t('loading.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // 如果沒有文件需要處理
  if (costEstimation.totalFiles === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t('empty.title')}</DialogTitle>
            <DialogDescription>
              {t('empty.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {t('empty.hint')}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('actions.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{t('confirm.title')}</DialogTitle>
          <DialogDescription>
            {batchName
              ? t('confirm.descriptionWithBatch', { name: batchName })
              : t('confirm.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Azure DI 處理 */}
          <ProcessingMethodCard
            icon={FileText}
            title={t('methods.azureDI.title')}
            description={t('methods.azureDI.description')}
            fileCount={costEstimation.azureDI.fileCount}
            pages={costEstimation.azureDI.estimatedPages}
            costPerPage={costEstimation.azureDI.costPerPage}
            totalCost={costEstimation.azureDI.estimatedCost}
            variant="default"
            t={t}
          />

          {/* GPT Vision 處理 */}
          <ProcessingMethodCard
            icon={FileImage}
            title={t('methods.gptVision.title')}
            description={t('methods.gptVision.description')}
            fileCount={costEstimation.gptVision.fileCount}
            pages={costEstimation.gptVision.estimatedPages}
            costPerPage={costEstimation.gptVision.costPerPage}
            totalCost={costEstimation.gptVision.estimatedCost}
            variant="ai"
            t={t}
          />

          {/* 總成本 */}
          <CostSummary estimation={costEstimation} t={t} />

          {/* 注意事項 */}
          <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>
              {t('notes.costDisclaimer')}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            {t('actions.cancel')}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('actions.processing')}
              </>
            ) : (
              t('actions.startProcessing', { count: costEstimation.totalFiles })
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
