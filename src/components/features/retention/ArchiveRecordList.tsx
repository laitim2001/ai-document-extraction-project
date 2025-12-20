'use client'

/**
 * @fileoverview 歸檔記錄列表組件
 * @description
 *   顯示資料歸檔記錄，支援還原操作。
 *
 * @module src/components/features/retention/ArchiveRecordList
 * @author Development Team
 * @since Epic 8 - Story 8.6 (Long-term Data Retention)
 * @lastModified 2025-12-20
 */

import * as React from 'react'
import { useArchiveRecords, useRestoreFromArchive } from '@/hooks/useRetention'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { AlertCircle, RotateCcw, Archive, Clock } from 'lucide-react'
import {
  DATA_TYPE_LABELS,
  STORAGE_TIER_LABELS,
  ARCHIVE_STATUS_LABELS,
  STORAGE_TIER_CONFIG,
} from '@/types/retention'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { ArchiveStatus, StorageTier } from '@prisma/client'

// ============================================================
// Types
// ============================================================

interface ArchiveRecordListProps {
  className?: string
}

// ============================================================
// Helpers
// ============================================================

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getStatusVariant(status: ArchiveStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'ARCHIVED':
    case 'RESTORED':
      return 'default'
    case 'ARCHIVING':
    case 'RESTORING':
      return 'secondary'
    case 'FAILED':
      return 'destructive'
    default:
      return 'outline'
  }
}

function getTierColor(tier: StorageTier): string {
  const colors: Record<StorageTier, string> = {
    HOT: 'bg-red-100 text-red-800 border-red-200',
    COOL: 'bg-blue-100 text-blue-800 border-blue-200',
    COLD: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    ARCHIVE: 'bg-gray-100 text-gray-800 border-gray-200',
  }
  return colors[tier]
}

function formatRestoreTime(tier: StorageTier): string {
  const config = STORAGE_TIER_CONFIG[tier as keyof typeof STORAGE_TIER_CONFIG]
  const ms = config.accessLatency
  if (ms === 0) return '即時'
  if (ms < 60000) return `約 ${Math.round(ms / 1000)} 秒`
  if (ms < 3600000) return `約 ${Math.round(ms / 60000)} 分鐘`
  return `約 ${Math.round(ms / 3600000)} 小時`
}

// ============================================================
// Component
// ============================================================

export function ArchiveRecordList({ className }: ArchiveRecordListProps) {
  const { toast } = useToast()
  const [page, setPage] = React.useState(1)
  const [restoreDialogOpen, setRestoreDialogOpen] = React.useState(false)
  const [selectedRecordId, setSelectedRecordId] = React.useState<string | null>(null)
  const [restoreReason, setRestoreReason] = React.useState('')

  const { data, isLoading, error } = useArchiveRecords({ page, limit: 10 })
  const restoreFromArchive = useRestoreFromArchive({
    onSuccess: (result) => {
      toast({
        title: '還原請求已提交',
        description: `預計等待時間：${formatRestoreTime(result.status as unknown as StorageTier)}`,
      })
      setRestoreDialogOpen(false)
      setRestoreReason('')
    },
    onError: (error) => {
      toast({
        title: '還原請求失敗',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const handleRestoreClick = (recordId: string) => {
    setSelectedRecordId(recordId)
    setRestoreDialogOpen(true)
  }

  const handleConfirmRestore = () => {
    if (selectedRecordId && restoreReason.trim()) {
      restoreFromArchive.mutate({
        archiveRecordId: selectedRecordId,
        reason: restoreReason,
      })
    }
  }

  if (isLoading) {
    return <ArchiveListSkeleton />
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <AlertCircle className="h-8 w-8 text-destructive mb-2" />
        <p className="text-muted-foreground">無法載入歸檔記錄</p>
      </div>
    )
  }

  const records = data?.data || []
  const pagination = data?.meta

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">歸檔記錄</h3>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>資料類型</TableHead>
              <TableHead>存儲層級</TableHead>
              <TableHead>記錄數</TableHead>
              <TableHead>大小</TableHead>
              <TableHead>狀態</TableHead>
              <TableHead>歸檔時間</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10">
                  <Archive className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-muted-foreground">尚無歸檔記錄</p>
                </TableCell>
              </TableRow>
            ) : (
              records.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>
                    <Badge variant="outline">
                      {DATA_TYPE_LABELS[record.dataType]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={cn('border', getTierColor(record.storageTier))}>
                      {STORAGE_TIER_LABELS[record.storageTier]}
                    </Badge>
                  </TableCell>
                  <TableCell>{record.recordCount.toLocaleString()}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <p>{formatBytes(Number(record.compressedSizeBytes))}</p>
                      <p className="text-muted-foreground text-xs">
                        原始: {formatBytes(Number(record.originalSizeBytes))}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(record.status)}>
                      {ARCHIVE_STATUS_LABELS[record.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {record.archivedAt ? formatDate(record.archivedAt) : '-'}
                  </TableCell>
                  <TableCell>
                    {record.status === 'ARCHIVED' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRestoreClick(record.id)}
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        還原
                      </Button>
                    )}
                    {record.status === 'RESTORING' && (
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Clock className="h-4 w-4 mr-1 animate-pulse" />
                        還原中
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            上一頁
          </Button>
          <span className="flex items-center px-3 text-sm">
            {page} / {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={page === pagination.totalPages}
          >
            下一頁
          </Button>
        </div>
      )}

      {/* Restore Dialog */}
      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>還原歸檔資料</DialogTitle>
            <DialogDescription>
              請說明還原此歸檔資料的原因。還原時間取決於存儲層級。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">還原原因</Label>
              <Textarea
                id="reason"
                placeholder="請輸入還原原因..."
                value={restoreReason}
                onChange={(e) => setRestoreReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleConfirmRestore}
              disabled={!restoreReason.trim() || restoreFromArchive.isPending}
            >
              {restoreFromArchive.isPending ? '提交中...' : '確認還原'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================================
// Skeleton
// ============================================================

function ArchiveListSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-24" />
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {[...Array(7)].map((_, i) => (
                <TableHead key={i}>
                  <Skeleton className="h-4 w-16" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                {[...Array(7)].map((_, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
