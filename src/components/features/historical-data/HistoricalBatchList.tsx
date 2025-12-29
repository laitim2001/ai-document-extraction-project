'use client'

/**
 * @fileoverview 歷史數據批次列表組件
 * @description
 *   顯示批次列表，支援：
 *   - 批次狀態顯示
 *   - 進度追蹤
 *   - 批次操作（查看詳情、刪除、匯出術語報告）
 *
 * @module src/components/features/historical-data/HistoricalBatchList
 * @since Epic 0 - Story 0.1
 * @lastModified 2025-12-27
 *
 * @features
 *   - CHANGE-002: 階層式術語報告匯出按鈕
 */

import * as React from 'react'
import { useState, useCallback } from 'react'
import {
  FolderOpen,
  Trash2,
  ChevronRight,
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  PauseCircle,
  Layers,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
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
import { HierarchicalTermsExportButton } from './HierarchicalTermsExportButton'

// ============================================================
// Types
// ============================================================

type HistoricalBatchStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

interface HistoricalBatch {
  id: string
  name: string
  description: string | null
  status: HistoricalBatchStatus
  totalFiles: number
  processedFiles: number
  failedFiles: number
  createdAt: string
  updatedAt: string
  startedAt: string | null
  completedAt: string | null
  creator: {
    id: string
    name: string | null
    email: string
  }
}

interface HistoricalBatchListProps {
  /** 批次列表 */
  batches: HistoricalBatch[]
  /** 是否正在載入 */
  isLoading?: boolean
  /** 選擇批次回調 */
  onSelectBatch?: (batchId: string) => void
  /** 刪除批次回調 */
  onDeleteBatch?: (batchId: string) => Promise<void>
  /** 開始處理回調 */
  onStartProcessing?: (batchId: string) => Promise<void>
  /** 額外的 CSS 類名 */
  className?: string
}

// ============================================================
// Constants
// ============================================================

const STATUS_CONFIG: Record<
  HistoricalBatchStatus,
  {
    label: string
    icon: React.ElementType
    variant: 'default' | 'secondary' | 'destructive' | 'outline'
    color: string
  }
> = {
  PENDING: { label: '待處理', icon: Clock, variant: 'secondary', color: 'text-yellow-500' },
  PROCESSING: { label: '處理中', icon: Loader2, variant: 'outline', color: 'text-blue-500' },
  PAUSED: { label: '已暫停', icon: PauseCircle, variant: 'secondary', color: 'text-orange-500' },
  AGGREGATING: { label: '聚合中', icon: Layers, variant: 'outline', color: 'text-purple-500' },
  AGGREGATED: { label: '聚合完成', icon: Layers, variant: 'default', color: 'text-indigo-500' },
  COMPLETED: { label: '已完成', icon: CheckCircle2, variant: 'default', color: 'text-green-500' },
  FAILED: { label: '失敗', icon: XCircle, variant: 'destructive', color: 'text-red-500' },
  CANCELLED: { label: '已取消', icon: AlertTriangle, variant: 'secondary', color: 'text-gray-500' },
}

// ============================================================
// Helper Functions
// ============================================================

function formatDate(dateString: string | null): string {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ============================================================
// Component
// ============================================================

/**
 * 歷史數據批次列表組件
 */
export function HistoricalBatchList({
  batches,
  isLoading = false,
  onSelectBatch,
  onDeleteBatch,
  onStartProcessing,
  className,
}: HistoricalBatchListProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [batchToDelete, setBatchToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // --- Delete Handlers ---

  const handleDeleteClick = useCallback((e: React.MouseEvent, batchId: string) => {
    e.stopPropagation()
    setBatchToDelete(batchId)
    setDeleteDialogOpen(true)
  }, [])

  const handleDeleteConfirm = useCallback(async () => {
    if (!batchToDelete || !onDeleteBatch) return

    setIsDeleting(true)
    try {
      await onDeleteBatch(batchToDelete)
    } finally {
      setIsDeleting(false)
      setDeleteDialogOpen(false)
      setBatchToDelete(null)
    }
  }, [batchToDelete, onDeleteBatch])

  // --- Start Processing Handler ---

  const handleStartProcessing = useCallback(
    async (e: React.MouseEvent, batchId: string) => {
      e.stopPropagation()
      if (!onStartProcessing) return
      await onStartProcessing(batchId)
    },
    [onStartProcessing]
  )

  // --- Render ---

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (batches.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-muted-foreground">尚無批次</p>
          <p className="text-sm text-muted-foreground">建立新批次以開始上傳文件</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      {batches.map((batch) => {
        const statusConfig = STATUS_CONFIG[batch.status]
        const StatusIcon = statusConfig.icon
        const progress = batch.totalFiles > 0 ? Math.round((batch.processedFiles / batch.totalFiles) * 100) : 0
        const canStart = batch.status === 'PENDING' && batch.totalFiles > 0
        const canDelete = batch.status !== 'PROCESSING'

        return (
          <Card
            key={batch.id}
            className={cn(
              'cursor-pointer transition-colors hover:bg-muted/50',
              onSelectBatch && 'cursor-pointer'
            )}
            onClick={() => onSelectBatch?.(batch.id)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg truncate">{batch.name}</CardTitle>
                  {batch.description && (
                    <CardDescription className="mt-1 truncate">{batch.description}</CardDescription>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Badge variant={statusConfig.variant} className="flex items-center gap-1">
                    <StatusIcon
                      className={cn(
                        'h-3 w-3',
                        batch.status === 'PROCESSING' && 'animate-spin'
                      )}
                    />
                    {statusConfig.label}
                  </Badge>
                  {onSelectBatch && (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* 進度條 */}
              {batch.status === 'PROCESSING' && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1 text-sm">
                    <span>處理進度</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} />
                </div>
              )}

              {/* 統計資訊 */}
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">總文件數</p>
                  <p className="font-medium">{batch.totalFiles}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">已處理</p>
                  <p className="font-medium text-green-600">{batch.processedFiles}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">失敗</p>
                  <p className="font-medium text-red-600">{batch.failedFiles}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">建立時間</p>
                  <p className="font-medium">{formatDate(batch.createdAt)}</p>
                </div>
              </div>

              {/* 操作按鈕 */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  建立者：{batch.creator.name || batch.creator.email}
                </div>
                <div className="flex items-center gap-2">
                  {canStart && onStartProcessing && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={(e) => handleStartProcessing(e, batch.id)}
                    >
                      <Play className="h-4 w-4 mr-1" />
                      開始處理
                    </Button>
                  )}
                  <HierarchicalTermsExportButton
                    batchId={batch.id}
                    batchName={batch.name}
                    batchStatus={batch.status}
                    size="sm"
                    variant="outline"
                    showLabel={false}
                  />
                  {canDelete && onDeleteBatch && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={(e) => handleDeleteClick(e, batch.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}

      {/* 刪除確認對話框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除批次</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除這個批次嗎？批次內的所有文件也會被刪除。此操作無法撤銷。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
