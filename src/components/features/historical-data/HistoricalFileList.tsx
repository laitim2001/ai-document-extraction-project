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
import { useTranslations } from 'next-intl'
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

const FILE_TYPE_CONFIG: Record<DetectedFileType, { labelKey: string; icon: React.ElementType; color: string }> = {
  NATIVE_PDF: { labelKey: 'nativePdf', icon: FileText, color: 'text-blue-500' },
  SCANNED_PDF: { labelKey: 'scannedPdf', icon: FileImage, color: 'text-orange-500' },
  IMAGE: { labelKey: 'image', icon: FileImage, color: 'text-green-500' },
}

const STATUS_CONFIG: Record<HistoricalFileStatus, { labelKey: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  PENDING: { labelKey: 'pending', variant: 'secondary' },
  DETECTING: { labelKey: 'detecting', variant: 'outline' },
  DETECTED: { labelKey: 'detected', variant: 'default' },
  PROCESSING: { labelKey: 'processing', variant: 'outline' },
  COMPLETED: { labelKey: 'completed', variant: 'default' },
  FAILED: { labelKey: 'failed', variant: 'destructive' },
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
  const t = useTranslations('historicalData')
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
              <SelectValue placeholder={t('fileList.filter.fileType')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t('fileList.filter.allTypes')}</SelectItem>
              <SelectItem value="NATIVE_PDF">{t('fileList.fileType.nativePdf')}</SelectItem>
              <SelectItem value="SCANNED_PDF">{t('fileList.fileType.scannedPdf')}</SelectItem>
              <SelectItem value="IMAGE">{t('fileList.fileType.image')}</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filterStatus}
            onValueChange={(value) => setFilterStatus(value as HistoricalFileStatus | 'ALL')}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder={t('fileList.filter.status')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t('fileList.filter.allStatus')}</SelectItem>
              <SelectItem value="PENDING">{t('fileList.status.pending')}</SelectItem>
              <SelectItem value="DETECTING">{t('fileList.status.detecting')}</SelectItem>
              <SelectItem value="DETECTED">{t('fileList.status.detected')}</SelectItem>
              <SelectItem value="PROCESSING">{t('fileList.status.processing')}</SelectItem>
              <SelectItem value="COMPLETED">{t('fileList.status.completed')}</SelectItem>
              <SelectItem value="FAILED">{t('fileList.status.failed')}</SelectItem>
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
            <span className="text-sm text-muted-foreground">{t('fileList.bulk.selected', { count: selectedIds.size })}</span>

            {onBulkUpdateType && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={isOperating}>
                    {t('fileList.bulk.changeType')}
                    <ChevronDown className="ml-1 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleBulkTypeChange('NATIVE_PDF')}>
                    {t('fileList.fileType.nativePdf')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkTypeChange('SCANNED_PDF')}>
                    {t('fileList.fileType.scannedPdf')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkTypeChange('IMAGE')}>
                    {t('fileList.fileType.image')}
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
                {t('fileList.bulk.deleteSelected')}
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
                  aria-label={t('fileList.table.selectAll')}
                  {...(someSelected ? { 'data-state': 'indeterminate' } : {})}
                />
              </TableHead>
              <TableHead>{t('fileList.table.fileName')}</TableHead>
              <TableHead className="w-[120px]">{t('fileList.table.type')}</TableHead>
              <TableHead className="w-[100px]">{t('fileList.table.size')}</TableHead>
              <TableHead className="w-[100px]">{t('fileList.table.status')}</TableHead>
              <TableHead className="w-[160px]">{t('fileList.table.detectedAt')}</TableHead>
              <TableHead className="w-[100px]">{t('fileList.table.actions')}</TableHead>
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
                  {t('fileList.empty')}
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
                        aria-label={t('fileList.table.selectFile', { name: file.originalName })}
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
                            <SelectValue placeholder={t('fileList.table.selectType')} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="NATIVE_PDF">{t('fileList.fileType.nativePdf')}</SelectItem>
                            <SelectItem value="SCANNED_PDF">{t('fileList.fileType.scannedPdf')}</SelectItem>
                            <SelectItem value="IMAGE">{t('fileList.fileType.image')}</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className={typeConfig?.color}>{typeConfig ? t(`fileList.fileType.${typeConfig.labelKey}`) : t('fileList.fileType.unknown')}</span>
                      )}
                    </TableCell>
                    <TableCell>{formatFileSize(file.fileSize)}</TableCell>
                    <TableCell>
                      <Badge variant={statusConfig.variant}>{t(`fileList.status.${statusConfig.labelKey}`)}</Badge>
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
                            title={t('fileList.actions.viewDetails')}
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
                            title={t('fileList.actions.retryDetection')}
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
                            title={t('fileList.actions.deleteFile')}
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
          {t('fileList.stats.total', { count: files.length })}
          {filteredFiles.length !== files.length && t('fileList.stats.filtered', { count: filteredFiles.length })}
        </span>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            {files.filter((f) => f.status === 'COMPLETED').length} {t('fileList.stats.completed')}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4 text-yellow-500" />
            {files.filter((f) => ['PENDING', 'DETECTING', 'DETECTED'].includes(f.status)).length} {t('fileList.stats.pending')}
          </span>
          <span className="flex items-center gap-1">
            <AlertCircle className="h-4 w-4 text-destructive" />
            {files.filter((f) => f.status === 'FAILED').length} {t('fileList.stats.failed')}
          </span>
        </div>
      </div>

      {/* 刪除確認對話框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('fileList.deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('fileList.deleteDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isOperating}>{t('fileList.deleteDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isOperating}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isOperating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t('fileList.deleteDialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
