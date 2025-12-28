'use client'

/**
 * @fileoverview 歷史數據文件列表組件
 * @description
 *   顯示批次內的文件列表，支援：
 *   - 文件狀態和類型顯示
 *   - 手動類型修正（AC3）
 *   - 批量選擇和操作
 *   - 篩選和排序
 *
 * @module src/components/features/historical-data/HistoricalFileList
 * @since Epic 0 - Story 0.1
 * @lastModified 2025-12-28
 */

import * as React from 'react'
import { useState, useCallback } from 'react'
import {
  FileText,
  FileImage,
  FileQuestion,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  Trash2,
  RefreshCw,
  ChevronDown,
  Eye,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
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

// ============================================================
// Types
// ============================================================

type DetectedFileType = 'NATIVE_PDF' | 'SCANNED_PDF' | 'IMAGE'
type HistoricalFileStatus = 'PENDING' | 'DETECTING' | 'DETECTED' | 'PROCESSING' | 'COMPLETED' | 'FAILED'

interface HistoricalFile {
  id: string
  fileName: string
  originalName: string
  fileSize: number
  mimeType: string
  detectedType: DetectedFileType | null
  status: HistoricalFileStatus
  metadata: Record<string, unknown> | null
  errorMessage: string | null
  createdAt: string
  detectedAt: string | null
  processedAt: string | null
}

interface HistoricalFileListProps {
  /** 批次 ID */
  batchId: string
  /** 文件列表 */
  files: HistoricalFile[]
  /** 是否正在載入 */
  isLoading?: boolean
  /** 刪除文件回調 */
  onDeleteFile?: (fileId: string) => Promise<void>
  /** 刪除多個文件回調 */
  onDeleteFiles?: (fileIds: string[]) => Promise<void>
  /** 修改文件類型回調 */
  onUpdateFileType?: (fileId: string, type: DetectedFileType) => Promise<void>
  /** 批量修改文件類型回調 */
  onBulkUpdateType?: (fileIds: string[], type: DetectedFileType) => Promise<void>
  /** 重新檢測回調 */
  onRetryDetection?: (fileId: string) => Promise<void>
  /** 刷新列表回調 */
  onRefresh?: () => void
  /** 額外的 CSS 類名 */
  className?: string
}

// ============================================================
// Constants
// ============================================================

const FILE_TYPE_CONFIG: Record<DetectedFileType, { label: string; icon: React.ElementType; color: string }> = {
  NATIVE_PDF: { label: '原生 PDF', icon: FileText, color: 'text-blue-500' },
  SCANNED_PDF: { label: '掃描 PDF', icon: FileImage, color: 'text-orange-500' },
  IMAGE: { label: '圖片', icon: FileImage, color: 'text-green-500' },
}

const STATUS_CONFIG: Record<HistoricalFileStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  PENDING: { label: '待處理', variant: 'secondary' },
  DETECTING: { label: '檢測中', variant: 'outline' },
  DETECTED: { label: '已檢測', variant: 'default' },
  PROCESSING: { label: '處理中', variant: 'outline' },
  COMPLETED: { label: '已完成', variant: 'default' },
  FAILED: { label: '失敗', variant: 'destructive' },
}

// ============================================================
// Helper Functions
// ============================================================

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

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
 * 歷史數據文件列表組件
 *
 * @description
 *   顯示批次內的文件，支援選擇、篩選和操作
 */
export function HistoricalFileList({
  batchId: _batchId,
  files,
  isLoading = false,
  onDeleteFile,
  onDeleteFiles,
  onUpdateFileType,
  onBulkUpdateType,
  onRetryDetection,
  onRefresh,
  className,
}: HistoricalFileListProps) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [filterType, setFilterType] = useState<DetectedFileType | 'ALL'>('ALL')
  const [filterStatus, setFilterStatus] = useState<HistoricalFileStatus | 'ALL'>('ALL')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [fileToDelete, setFileToDelete] = useState<string | null>(null)
  const [isOperating, setIsOperating] = useState(false)

  // --- Filtered Files ---

  const filteredFiles = files.filter((file) => {
    if (filterType !== 'ALL' && file.detectedType !== filterType) return false
    if (filterStatus !== 'ALL' && file.status !== filterStatus) return false
    return true
  })

  // --- Selection Handlers ---

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelectedIds(new Set(filteredFiles.map((f) => f.id)))
      } else {
        setSelectedIds(new Set())
      }
    },
    [filteredFiles]
  )

  const handleSelectFile = useCallback((fileId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(fileId)
      } else {
        next.delete(fileId)
      }
      return next
    })
  }, [])

  // --- Delete Handlers ---

  const handleDeleteClick = useCallback((fileId: string) => {
    setFileToDelete(fileId)
    setDeleteDialogOpen(true)
  }, [])

  const handleDeleteConfirm = useCallback(async () => {
    if (!fileToDelete || !onDeleteFile) return

    setIsOperating(true)
    try {
      await onDeleteFile(fileToDelete)
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(fileToDelete)
        return next
      })
    } finally {
      setIsOperating(false)
      setDeleteDialogOpen(false)
      setFileToDelete(null)
    }
  }, [fileToDelete, onDeleteFile])

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0 || !onDeleteFiles) return

    setIsOperating(true)
    try {
      await onDeleteFiles(Array.from(selectedIds))
      setSelectedIds(new Set())
    } finally {
      setIsOperating(false)
    }
  }, [selectedIds, onDeleteFiles])

  // --- Type Update Handler ---

  const handleTypeChange = useCallback(
    async (fileId: string, type: DetectedFileType) => {
      if (!onUpdateFileType) return

      setIsOperating(true)
      try {
        await onUpdateFileType(fileId, type)
      } finally {
        setIsOperating(false)
      }
    },
    [onUpdateFileType]
  )

  const handleBulkTypeChange = useCallback(
    async (type: DetectedFileType) => {
      if (selectedIds.size === 0 || !onBulkUpdateType) return

      setIsOperating(true)
      try {
        await onBulkUpdateType(Array.from(selectedIds), type)
        setSelectedIds(new Set())
      } finally {
        setIsOperating(false)
      }
    },
    [selectedIds, onBulkUpdateType]
  )

  // --- Retry Handler ---

  const handleRetry = useCallback(
    async (fileId: string) => {
      if (!onRetryDetection) return

      setIsOperating(true)
      try {
        await onRetryDetection(fileId)
      } finally {
        setIsOperating(false)
      }
    },
    [onRetryDetection]
  )

  // --- Computed ---

  const allSelected = filteredFiles.length > 0 && selectedIds.size === filteredFiles.length
  const someSelected = selectedIds.size > 0 && selectedIds.size < filteredFiles.length

  // --- Render ---

  return (
    <div className={cn('space-y-4', className)}>
      {/* 工具列 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* 篩選器 */}
        <div className="flex items-center gap-2">
          <Select
            value={filterType}
            onValueChange={(value) => setFilterType(value as DetectedFileType | 'ALL')}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="文件類型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">全部類型</SelectItem>
              <SelectItem value="NATIVE_PDF">原生 PDF</SelectItem>
              <SelectItem value="SCANNED_PDF">掃描 PDF</SelectItem>
              <SelectItem value="IMAGE">圖片</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filterStatus}
            onValueChange={(value) => setFilterStatus(value as HistoricalFileStatus | 'ALL')}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="狀態" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">全部狀態</SelectItem>
              <SelectItem value="PENDING">待處理</SelectItem>
              <SelectItem value="DETECTING">檢測中</SelectItem>
              <SelectItem value="DETECTED">已檢測</SelectItem>
              <SelectItem value="PROCESSING">處理中</SelectItem>
              <SelectItem value="COMPLETED">已完成</SelectItem>
              <SelectItem value="FAILED">失敗</SelectItem>
            </SelectContent>
          </Select>

          {onRefresh && (
            <Button variant="outline" size="icon" onClick={onRefresh} disabled={isLoading}>
              <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            </Button>
          )}
        </div>

        {/* 批量操作 */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">已選擇 {selectedIds.size} 個文件</span>

            {onBulkUpdateType && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={isOperating}>
                    修改類型
                    <ChevronDown className="ml-1 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleBulkTypeChange('NATIVE_PDF')}>
                    原生 PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkTypeChange('SCANNED_PDF')}>
                    掃描 PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkTypeChange('IMAGE')}>
                    圖片
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {onDeleteFiles && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                disabled={isOperating}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                刪除選中
              </Button>
            )}
          </div>
        )}
      </div>

      {/* 文件列表表格 */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                  aria-label="全選"
                  {...(someSelected ? { 'data-state': 'indeterminate' } : {})}
                />
              </TableHead>
              <TableHead>文件名稱</TableHead>
              <TableHead className="w-[120px]">類型</TableHead>
              <TableHead className="w-[100px]">大小</TableHead>
              <TableHead className="w-[100px]">狀態</TableHead>
              <TableHead className="w-[160px]">檢測時間</TableHead>
              <TableHead className="w-[100px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filteredFiles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  沒有符合條件的文件
                </TableCell>
              </TableRow>
            ) : (
              filteredFiles.map((file) => {
                const typeConfig = file.detectedType ? FILE_TYPE_CONFIG[file.detectedType] : null
                const statusConfig = STATUS_CONFIG[file.status]
                const TypeIcon = typeConfig?.icon || FileQuestion

                return (
                  <TableRow key={file.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(file.id)}
                        onCheckedChange={(checked) => handleSelectFile(file.id, !!checked)}
                        aria-label={`選擇 ${file.originalName}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <TypeIcon
                          className={cn('h-5 w-5 flex-shrink-0', typeConfig?.color || 'text-muted-foreground')}
                        />
                        <div className="min-w-0">
                          <p className="truncate font-medium" title={file.originalName}>
                            {file.originalName}
                          </p>
                          {file.errorMessage && (
                            <p className="text-xs text-destructive truncate" title={file.errorMessage}>
                              {file.errorMessage}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {onUpdateFileType && file.status !== 'PROCESSING' ? (
                        <Select
                          value={file.detectedType || ''}
                          onValueChange={(value) => handleTypeChange(file.id, value as DetectedFileType)}
                          disabled={isOperating}
                        >
                          <SelectTrigger className="w-[110px] h-8">
                            <SelectValue placeholder="選擇類型" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="NATIVE_PDF">原生 PDF</SelectItem>
                            <SelectItem value="SCANNED_PDF">掃描 PDF</SelectItem>
                            <SelectItem value="IMAGE">圖片</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className={typeConfig?.color}>{typeConfig?.label || '未知'}</span>
                      )}
                    </TableCell>
                    <TableCell>{formatFileSize(file.fileSize)}</TableCell>
                    <TableCell>
                      <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(file.detectedAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {/* 查看詳情 - 僅 COMPLETED 狀態可用 */}
                        {file.status === 'COMPLETED' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => router.push(`/admin/historical-data/files/${file.id}`)}
                            title="查看詳情"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        {file.status === 'FAILED' && onRetryDetection && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleRetry(file.id)}
                            disabled={isOperating}
                            title="重試檢測"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
                        {onDeleteFile && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteClick(file.id)}
                            disabled={isOperating || file.status === 'PROCESSING'}
                            title="刪除文件"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* 統計資訊 */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          共 {files.length} 個文件
          {filteredFiles.length !== files.length && `（顯示 ${filteredFiles.length} 個）`}
        </span>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            {files.filter((f) => f.status === 'COMPLETED').length} 已完成
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4 text-yellow-500" />
            {files.filter((f) => ['PENDING', 'DETECTING', 'DETECTED'].includes(f.status)).length} 待處理
          </span>
          <span className="flex items-center gap-1">
            <AlertCircle className="h-4 w-4 text-destructive" />
            {files.filter((f) => f.status === 'FAILED').length} 失敗
          </span>
        </div>
      </div>

      {/* 刪除確認對話框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除這個文件嗎？此操作無法撤銷。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isOperating}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isOperating}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isOperating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
