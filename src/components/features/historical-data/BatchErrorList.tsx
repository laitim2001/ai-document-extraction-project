'use client'

/**
 * @fileoverview 批量處理錯誤列表組件
 * @description
 *   顯示批量處理中的失敗文件：
 *   - 錯誤訊息詳情
 *   - 重試功能
 *   - 跳過功能
 *   - 批量操作
 *
 * @module src/components/features/historical-data/BatchErrorList
 * @since Epic 0 - Story 0.4
 * @lastModified 2025-12-23
 *
 * @features
 *   - 失敗文件列表
 *   - 錯誤詳情展開
 *   - 單個/批量重試
 *   - 單個/批量跳過
 *
 * @dependencies
 *   - shadcn/ui - UI 組件
 *   - lucide-react - 圖標
 *
 * @related
 *   - src/services/batch-progress.service.ts - 失敗文件查詢
 *   - src/components/features/historical-data/BatchProgressPanel.tsx - 進度面板
 */

import * as React from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  AlertCircle,
  RefreshCw,
  SkipForward,
  ChevronDown,
  ChevronRight,
  FileX,
  Loader2,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================================
// Types
// ============================================================

/**
 * 失敗文件資訊
 */
export interface FailedFileInfo {
  id: string
  fileName: string
  originalName: string
  errorMessage: string | null
  failedAt: Date | null
  retryCount: number
}

interface BatchErrorListProps {
  /** 批次 ID */
  batchId: string
  /** 失敗文件列表 */
  files: FailedFileInfo[]
  /** 總失敗數 */
  total: number
  /** 是否正在載入 */
  isLoading?: boolean
  /** 重試單個文件 */
  onRetry?: (fileId: string) => Promise<void>
  /** 跳過單個文件 */
  onSkip?: (fileId: string) => Promise<void>
  /** 批量重試 */
  onBatchRetry?: (fileIds: string[]) => Promise<void>
  /** 批量跳過 */
  onBatchSkip?: (fileIds: string[]) => Promise<void>
  /** 載入更多 */
  onLoadMore?: () => void
  /** 是否還有更多 */
  hasMore?: boolean
  /** 額外的 CSS 類名 */
  className?: string
}

// ============================================================
// Helper Components
// ============================================================

/**
 * 錯誤詳情展開面板
 */
function ErrorDetailPanel({
  file,
  onRetry,
  onSkip,
  isRetrying,
  isSkipping,
}: {
  file: FailedFileInfo
  onRetry?: () => void
  onSkip?: () => void
  isRetrying: boolean
  isSkipping: boolean
}) {
  const [isOpen, setIsOpen] = React.useState(false)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex items-center gap-2">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="p-0 h-6 w-6">
            {isOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>
        <FileX className="h-4 w-4 text-red-500" />
        <span className="text-sm font-medium truncate max-w-[200px]">
          {file.originalName}
        </span>
        <Badge variant="outline" className="text-xs">
          重試 {file.retryCount} 次
        </Badge>
      </div>

      <CollapsibleContent className="mt-2 ml-6">
        <div className="rounded-md border bg-muted/50 p-3 space-y-3">
          {/* 錯誤訊息 */}
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">
              錯誤訊息
            </div>
            <div className="text-sm bg-destructive/10 text-destructive rounded p-2 font-mono break-all">
              {file.errorMessage || '未知錯誤'}
            </div>
          </div>

          {/* 文件資訊 */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">文件 ID:</span>
              <span className="ml-1 font-mono">{file.id.slice(0, 8)}...</span>
            </div>
            <div>
              <span className="text-muted-foreground">失敗時間:</span>
              <span className="ml-1">
                {file.failedAt
                  ? new Date(file.failedAt).toLocaleString('zh-TW')
                  : '-'}
              </span>
            </div>
          </div>

          {/* 操作按鈕 */}
          <div className="flex gap-2 pt-2">
            {onRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                disabled={isRetrying || isSkipping}
              >
                {isRetrying ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1 h-3 w-3" />
                )}
                重試
              </Button>
            )}
            {onSkip && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onSkip}
                disabled={isRetrying || isSkipping}
              >
                {isSkipping ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <SkipForward className="mr-1 h-3 w-3" />
                )}
                跳過
              </Button>
            )}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// ============================================================
// Main Component
// ============================================================

export function BatchErrorList({
  batchId,
  files,
  total,
  isLoading = false,
  onRetry,
  onSkip,
  onBatchRetry,
  onBatchSkip,
  onLoadMore,
  hasMore = false,
  className,
}: BatchErrorListProps) {
  // --- State ---
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [retryingIds, setRetryingIds] = React.useState<Set<string>>(new Set())
  const [skippingIds, setSkippingIds] = React.useState<Set<string>>(new Set())
  const [isBatchRetrying, setIsBatchRetrying] = React.useState(false)
  const [isBatchSkipping, setIsBatchSkipping] = React.useState(false)

  // --- Derived State ---
  const allSelected = files.length > 0 && selectedIds.size === files.length
  const someSelected = selectedIds.size > 0 && selectedIds.size < files.length
  const hasSelection = selectedIds.size > 0

  // --- Handlers ---
  const handleSelectAll = React.useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(files.map((f) => f.id)))
    }
  }, [allSelected, files])

  const handleSelectOne = React.useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
  }, [])

  const handleRetryOne = React.useCallback(
    async (fileId: string) => {
      if (!onRetry) return

      setRetryingIds((prev) => new Set(prev).add(fileId))
      try {
        await onRetry(fileId)
      } finally {
        setRetryingIds((prev) => {
          const next = new Set(prev)
          next.delete(fileId)
          return next
        })
      }
    },
    [onRetry]
  )

  const handleSkipOne = React.useCallback(
    async (fileId: string) => {
      if (!onSkip) return

      setSkippingIds((prev) => new Set(prev).add(fileId))
      try {
        await onSkip(fileId)
      } finally {
        setSkippingIds((prev) => {
          const next = new Set(prev)
          next.delete(fileId)
          return next
        })
      }
    },
    [onSkip]
  )

  const handleBatchRetry = React.useCallback(async () => {
    if (!onBatchRetry || selectedIds.size === 0) return

    setIsBatchRetrying(true)
    try {
      await onBatchRetry(Array.from(selectedIds))
      setSelectedIds(new Set())
    } finally {
      setIsBatchRetrying(false)
    }
  }, [onBatchRetry, selectedIds])

  const handleBatchSkip = React.useCallback(async () => {
    if (!onBatchSkip || selectedIds.size === 0) return

    setIsBatchSkipping(true)
    try {
      await onBatchSkip(Array.from(selectedIds))
      setSelectedIds(new Set())
    } finally {
      setIsBatchSkipping(false)
    }
  }, [onBatchSkip, selectedIds])

  // --- Render: Empty State ---
  if (files.length === 0 && !isLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
          <p className="text-lg font-medium">沒有失敗的文件</p>
          <p className="text-sm text-muted-foreground">所有文件處理正常</p>
        </CardContent>
      </Card>
    )
  }

  // --- Render ---
  return (
    <TooltipProvider>
      <Card className={className}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                處理失敗的文件
              </CardTitle>
              <CardDescription>
                共 {total} 個文件處理失敗，顯示 {files.length} 個
              </CardDescription>
            </div>

            {/* 批量操作按鈕 */}
            {hasSelection && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{selectedIds.size} 個已選擇</Badge>
                {onBatchRetry && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBatchRetry}
                    disabled={isBatchRetrying || isBatchSkipping}
                  >
                    {isBatchRetrying ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1 h-3 w-3" />
                    )}
                    批量重試
                  </Button>
                )}
                {onBatchSkip && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBatchSkip}
                    disabled={isBatchRetrying || isBatchSkipping}
                  >
                    {isBatchSkipping ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <SkipForward className="mr-1 h-3 w-3" />
                    )}
                    批量跳過
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={allSelected}
                      ref={(el) => {
                        if (el) {
                          ;(el as HTMLButtonElement & { indeterminate: boolean }).indeterminate = someSelected
                        }
                      }}
                      onCheckedChange={handleSelectAll}
                      aria-label="全選"
                    />
                  </TableHead>
                  <TableHead>文件</TableHead>
                  <TableHead className="w-[100px] text-center">重試次數</TableHead>
                  <TableHead className="w-[150px]">失敗時間</TableHead>
                  <TableHead className="w-[120px] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file) => (
                  <TableRow
                    key={file.id}
                    className={cn(selectedIds.has(file.id) && 'bg-muted/50')}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(file.id)}
                        onCheckedChange={(checked) =>
                          handleSelectOne(file.id, checked === true)
                        }
                        aria-label={`選擇 ${file.originalName}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <FileX className="h-4 w-4 text-red-500" />
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="font-medium truncate max-w-[250px] block">
                                {file.originalName}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{file.originalName}</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="text-xs text-destructive truncate max-w-[300px]">
                              {file.errorMessage || '未知錯誤'}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-[400px]">
                            <p className="break-all">{file.errorMessage || '未知錯誤'}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={file.retryCount >= 3 ? 'destructive' : 'outline'}
                      >
                        {file.retryCount}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {file.failedAt
                        ? new Date(file.failedAt).toLocaleString('zh-TW')
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {onRetry && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleRetryOne(file.id)}
                                disabled={
                                  retryingIds.has(file.id) ||
                                  skippingIds.has(file.id)
                                }
                              >
                                {retryingIds.has(file.id) ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>重試</TooltipContent>
                          </Tooltip>
                        )}
                        {onSkip && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleSkipOne(file.id)}
                                disabled={
                                  retryingIds.has(file.id) ||
                                  skippingIds.has(file.id)
                                }
                              >
                                {skippingIds.has(file.id) ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <SkipForward className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>跳過</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* 載入更多 */}
          {(hasMore || isLoading) && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={onLoadMore}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {isLoading ? '載入中...' : '載入更多'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}
