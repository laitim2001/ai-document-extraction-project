'use client'

/**
 * @fileoverview 處理確認對話框組件
 * @description
 *   在批量處理開始前顯示成本估算和處理明細，
 *   讓用戶確認是否開始處理。
 *
 * @module src/components/features/historical-data/ProcessingConfirmDialog
 * @since Epic 0 - Story 0.2
 * @lastModified 2025-12-23
 *
 * @features
 *   - 顯示文件分類統計（Azure DI / GPT Vision）
 *   - 顯示成本估算明細
 *   - 確認/取消按鈕
 *
 * @dependencies
 *   - Dialog UI 組件
 *   - cost-estimation.service
 *
 * @related
 *   - src/services/cost-estimation.service.ts - 成本估算服務
 *   - src/services/processing-router.service.ts - 處理路由服務
 */

import * as React from 'react'
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
}: {
  icon: React.ElementType
  title: string
  description: string
  fileCount: number
  pages: number
  costPerPage: number
  totalCost: number
  variant?: 'default' | 'ai'
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
            {fileCount} 個文件
          </Badge>
        </div>

        <Separator className="my-3" />

        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">預估頁數</p>
            <p className="font-medium">{pages} 頁</p>
          </div>
          <div>
            <p className="text-muted-foreground">每頁成本</p>
            <p className="font-medium">${costPerPage.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">預估成本</p>
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
}: {
  estimation: BatchCostEstimation
}) {
  return (
    <Card className="bg-muted/50 border-2">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">總預估成本</span>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-primary">
              ${estimation.totalCost.toFixed(2)}
            </p>
            <p className="text-sm text-muted-foreground">
              {estimation.totalFiles} 個文件 / {estimation.totalPages} 頁
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
  // 如果沒有估算資料，顯示空狀態
  if (!costEstimation) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>處理確認</DialogTitle>
            <DialogDescription>
              正在計算處理成本...
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
            <DialogTitle>無文件處理</DialogTitle>
            <DialogDescription>
              沒有符合條件的文件需要處理
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              請確保已上傳文件並完成元數據檢測。
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              關閉
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
          <DialogTitle>確認開始處理</DialogTitle>
          <DialogDescription>
            {batchName ? (
              <>批次「{batchName}」即將開始 AI 處理</>
            ) : (
              <>以下文件即將開始 AI 處理，請確認成本估算</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Azure DI 處理 */}
          <ProcessingMethodCard
            icon={FileText}
            title="Azure Document Intelligence"
            description="原生 PDF 文字提取（成本較低）"
            fileCount={costEstimation.azureDI.fileCount}
            pages={costEstimation.azureDI.estimatedPages}
            costPerPage={costEstimation.azureDI.costPerPage}
            totalCost={costEstimation.azureDI.estimatedCost}
            variant="default"
          />

          {/* GPT Vision 處理 */}
          <ProcessingMethodCard
            icon={FileImage}
            title="GPT-4o Vision"
            description="掃描 PDF 和圖片 OCR（精確度更高）"
            fileCount={costEstimation.gptVision.fileCount}
            pages={costEstimation.gptVision.estimatedPages}
            costPerPage={costEstimation.gptVision.costPerPage}
            totalCost={costEstimation.gptVision.estimatedCost}
            variant="ai"
          />

          {/* 總成本 */}
          <CostSummary estimation={costEstimation} />

          {/* 注意事項 */}
          <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>
              實際成本可能因文件頁數而有所不同。
              處理過程中請勿關閉頁面。
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
            取消
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                處理中...
              </>
            ) : (
              <>開始處理 ({costEstimation.totalFiles} 個文件)</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
