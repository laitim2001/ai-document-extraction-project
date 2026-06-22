'use client'

/**
 * @fileoverview 歸檔記錄列表組件
 * @description
 *   顯示資料歸檔記錄，支援還原操作。
 *
 * @module src/components/features/retention/ArchiveRecordList
 * @author Development Team
 * @since Epic 8 - Story 8.6 (Long-term Data Retention)
 * @lastModified 2026-06-22 (CHANGE-087 Phase 2: 遷移共用 DataTable)
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useArchiveRecords, useRestoreFromArchive } from '@/hooks/useRetention'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DataTable,
  type DataTableColumn,
} from '@/components/features/common/DataTable'
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
import { STORAGE_TIER_CONFIG } from '@/types/retention'
import type { ArchiveRecordWithRelations } from '@/types/retention'
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

function formatRestoreTime(
  tier: StorageTier,
  t: ReturnType<typeof useTranslations>
): string {
  const config = STORAGE_TIER_CONFIG[tier as keyof typeof STORAGE_TIER_CONFIG]
  const ms = config.accessLatency
  if (ms === 0) return t('archive.restoreTime.instant')
  if (ms < 60000) return t('archive.restoreTime.seconds', { seconds: Math.round(ms / 1000) })
  if (ms < 3600000) return t('archive.restoreTime.minutes', { minutes: Math.round(ms / 60000) })
  return t('archive.restoreTime.hours', { hours: Math.round(ms / 3600000) })
}

// ============================================================
// Component
// ============================================================

export function ArchiveRecordList({ className }: ArchiveRecordListProps) {
  const t = useTranslations('dataRetention')
  const { toast } = useToast()
  const [page, setPage] = React.useState(1)
  const [restoreDialogOpen, setRestoreDialogOpen] = React.useState(false)
  const [selectedRecordId, setSelectedRecordId] = React.useState<string | null>(null)
  const [restoreReason, setRestoreReason] = React.useState('')

  const { data, isLoading, error } = useArchiveRecords({ page, limit: 10 })
  const restoreFromArchive = useRestoreFromArchive({
    onSuccess: (result) => {
      toast({
        title: t('archive.restoreToast.successTitle'),
        description: t('archive.restoreToast.successDescription', {
          waitTime: formatRestoreTime(result.status as unknown as StorageTier, t),
        }),
      })
      setRestoreDialogOpen(false)
      setRestoreReason('')
    },
    onError: (error) => {
      toast({
        title: t('archive.restoreToast.errorTitle'),
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const handleRestoreClick = React.useCallback((recordId: string) => {
    setSelectedRecordId(recordId)
    setRestoreDialogOpen(true)
  }, [])

  const handleConfirmRestore = () => {
    if (selectedRecordId && restoreReason.trim()) {
      restoreFromArchive.mutate({
        archiveRecordId: selectedRecordId,
        reason: restoreReason,
      })
    }
  }

  // --- Column 定義 ---
  const columns = React.useMemo<DataTableColumn<ArchiveRecordWithRelations>[]>(
    () => [
      {
        id: 'dataType',
        header: t('archive.columns.dataType'),
        cell: (record) => (
          <Badge variant="outline">{t(`dataType.${record.dataType}`)}</Badge>
        ),
      },
      {
        id: 'storageTier',
        header: t('archive.columns.storageTier'),
        cell: (record) => (
          <Badge className={cn('border', getTierColor(record.storageTier))}>
            {t(`tier.${record.storageTier}`)}
          </Badge>
        ),
      },
      {
        id: 'recordCount',
        header: t('archive.columns.recordCount'),
        cell: (record) => record.recordCount.toLocaleString(),
      },
      {
        id: 'size',
        header: t('archive.columns.size'),
        cell: (record) => (
          <div className="text-sm">
            <p>{formatBytes(Number(record.compressedSizeBytes))}</p>
            <p className="text-muted-foreground text-xs">
              {t('archive.originalSize', { size: formatBytes(Number(record.originalSizeBytes)) })}
            </p>
          </div>
        ),
      },
      {
        id: 'status',
        header: t('archive.columns.status'),
        cell: (record) => (
          <Badge variant={getStatusVariant(record.status)}>
            {t(`archiveStatus.${record.status}`)}
          </Badge>
        ),
      },
      {
        id: 'archivedAt',
        header: t('archive.columns.archivedAt'),
        cellClassName: 'text-sm',
        cell: (record) =>
          record.archivedAt ? formatDate(record.archivedAt) : '-',
      },
      {
        id: 'actions',
        header: '',
        headerClassName: 'w-[100px]',
        cell: (record) => (
          <>
            {record.status === 'ARCHIVED' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRestoreClick(record.id)}
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                {t('archive.restore')}
              </Button>
            )}
            {record.status === 'RESTORING' && (
              <div className="flex items-center text-sm text-muted-foreground">
                <Clock className="h-4 w-4 mr-1 animate-pulse" />
                {t('archive.restoring')}
              </div>
            )}
          </>
        ),
      },
    ],
    [handleRestoreClick, t]
  )

  if (isLoading) {
    return <ArchiveListSkeleton />
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <AlertCircle className="h-8 w-8 text-destructive mb-2" />
        <p className="text-muted-foreground">{t('archive.loadError')}</p>
      </div>
    )
  }

  const records = data?.data || []
  const pagination = data?.meta

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">{t('archive.listTitle')}</h3>
      </div>

      <div className="rounded-md border">
        <DataTable
          data={records}
          columns={columns}
          getRowId={(record) => record.id}
          page={page}
          pageSize={pagination?.limit ?? 10}
          emptyState={
            <>
              <Archive className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-muted-foreground">{t('archive.empty')}</p>
            </>
          }
        />
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
            {t('common.previousPage')}
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
            {t('common.nextPage')}
          </Button>
        </div>
      )}

      {/* Restore Dialog */}
      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('archive.restoreDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('archive.restoreDialog.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">{t('archive.restoreDialog.reasonLabel')}</Label>
              <Textarea
                id="reason"
                placeholder={t('archive.restoreDialog.reasonPlaceholder')}
                value={restoreReason}
                onChange={(e) => setRestoreReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleConfirmRestore}
              disabled={!restoreReason.trim() || restoreFromArchive.isPending}
            >
              {restoreFromArchive.isPending
                ? t('archive.restoreDialog.submitting')
                : t('archive.restoreDialog.confirm')}
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
