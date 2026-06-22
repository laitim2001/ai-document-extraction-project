'use client'

/**
 * @fileoverview 恢復記錄列表組件
 * @description
 *   顯示恢復記錄列表，支援：
 *   - 狀態/類型篩選
 *   - 分頁
 *   - 取消/查看詳情操作
 *
 * @module src/components/features/admin/restore/RestoreList
 * @since Epic 12 - Story 12-6 (數據恢復功能)
 * @lastModified 2026-06-22 (CHANGE-087 Phase 2: 遷移共用 DataTable)
 */

import { useState, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { Eye, XCircle, RotateCcw, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Pagination } from '@/components/ui/pagination'
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
import { useRestoreRecords, useCancelRestore } from '@/hooks/use-restore'
import { getRestoreStatusInfo, getRestoreTypeInfo } from '@/types/restore'
import type { RestoreListItem, RestoreStatus, RestoreType } from '@/types/restore'

// ============================================================
// Types
// ============================================================

interface RestoreListProps {
  onViewDetails?: (restore: RestoreListItem) => void
}

// ============================================================
// Component
// ============================================================

/**
 * 恢復記錄列表組件
 */
export function RestoreList({ onViewDetails }: RestoreListProps) {
  const t = useTranslations('admin.restore')

  // --- State ---
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<RestoreStatus | 'all'>('all')
  const [typeFilter, setTypeFilter] = useState<RestoreType | 'all'>('all')
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const limit = 10

  // --- Hooks ---
  const { data, isLoading, refetch } = useRestoreRecords({
    page,
    limit,
    status: statusFilter === 'all' ? undefined : statusFilter,
    type: typeFilter === 'all' ? undefined : typeFilter,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  })

  const cancelMutation = useCancelRestore()

  // --- Computed ---
  const records = data?.data?.records ?? []
  const pagination = data?.data?.pagination
  const totalPages = pagination?.totalPages ?? 1

  // --- Handlers ---
  const handleCancelClick = useCallback((id: string) => {
    setSelectedId(id)
    setCancelDialogOpen(true)
  }, [])

  const handleCancelConfirm = useCallback(async () => {
    if (!selectedId) return

    try {
      await cancelMutation.mutateAsync(selectedId)
      setCancelDialogOpen(false)
      setSelectedId(null)
      refetch()
    } catch {
      // Error handled by mutation
    }
  }, [selectedId, cancelMutation, refetch])

  const renderStatusBadge = (status: RestoreStatus) => {
    const info = getRestoreStatusInfo(status)
    const variantMap: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      primary: 'default',
      warning: 'secondary',
      destructive: 'destructive',
      success: 'outline',
    }

    return (
      <Badge variant={variantMap[info.variant] || 'outline'}>
        {t.has(`statuses.${status}`) ? t(`statuses.${status}`) : info.label}
      </Badge>
    )
  }

  const renderTypeBadge = (type: RestoreType) => {
    const info = getRestoreTypeInfo(type)
    return (
      <Badge variant="outline">
        <span className="mr-1">{info.icon}</span>
        {t.has(`types.${type}`) ? t(`types.${type}`) : info.label}
      </Badge>
    )
  }

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return '-'
    const d = new Date(date)
    return formatDistanceToNow(d, { addSuffix: true, locale: zhTW })
  }

  const canCancel = (status: RestoreStatus) => {
    return ['PENDING', 'VALIDATING', 'PRE_BACKUP'].includes(status)
  }

  // --- Column 定義 ---
  const columns = useMemo<DataTableColumn<RestoreListItem>[]>(
    () => [
      {
        id: 'status',
        header: t('listView.columns.status'),
        cell: (record) => renderStatusBadge(record.status),
      },
      {
        id: 'type',
        header: t('listView.columns.type'),
        cell: (record) => renderTypeBadge(record.type),
      },
      {
        id: 'backupSource',
        header: t('listView.columns.backupSource'),
        cellClassName: 'max-w-[200px] truncate',
        cell: (record) => record.backupName || record.backupId,
      },
      {
        id: 'startedAt',
        header: t('listView.columns.startedAt'),
        cell: (record) => formatDate(record.startedAt),
      },
      {
        id: 'completedAt',
        header: t('listView.columns.completedAt'),
        cell: (record) => formatDate(record.completedAt),
      },
      {
        id: 'progress',
        header: t('listView.columns.progress'),
        cell: (record) =>
          record.progress !== null && record.progress !== undefined ? (
            <div className="flex items-center gap-2">
              <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${record.progress}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">
                {record.progress}%
              </span>
            </div>
          ) : (
            '-'
          ),
      },
      {
        id: 'actions',
        header: t('listView.columns.actions'),
        headerClassName: 'text-right',
        cellClassName: 'text-right',
        cell: (record) => (
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onViewDetails?.(record)}
              title={t('listView.viewDetails')}
            >
              <Eye className="h-4 w-4" />
            </Button>
            {canCancel(record.status) && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleCancelClick(record.id)}
                title={t('listView.cancelRestore')}
                disabled={cancelMutation.isPending}
              >
                <XCircle className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onViewDetails, handleCancelClick, cancelMutation.isPending, t]
  )

  return (
    <div className="space-y-4">
      {/* 篩選器 */}
      <div className="flex flex-wrap gap-4">
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value as RestoreStatus | 'all')
            setPage(1)
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('listView.statusFilter')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('listView.allStatuses')}</SelectItem>
            <SelectItem value="PENDING">{t('statuses.PENDING')}</SelectItem>
            <SelectItem value="VALIDATING">{t('statuses.VALIDATING')}</SelectItem>
            <SelectItem value="PRE_BACKUP">{t('statuses.PRE_BACKUP')}</SelectItem>
            <SelectItem value="IN_PROGRESS">{t('statuses.IN_PROGRESS')}</SelectItem>
            <SelectItem value="VERIFYING">{t('statuses.VERIFYING')}</SelectItem>
            <SelectItem value="COMPLETED">{t('statuses.COMPLETED')}</SelectItem>
            <SelectItem value="FAILED">{t('statuses.FAILED')}</SelectItem>
            <SelectItem value="CANCELLED">{t('statuses.CANCELLED')}</SelectItem>
            <SelectItem value="ROLLED_BACK">{t('statuses.ROLLED_BACK')}</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={typeFilter}
          onValueChange={(value) => {
            setTypeFilter(value as RestoreType | 'all')
            setPage(1)
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('listView.typeFilter')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('listView.allTypes')}</SelectItem>
            <SelectItem value="FULL">{t('types.FULL')}</SelectItem>
            <SelectItem value="PARTIAL">{t('types.PARTIAL')}</SelectItem>
            <SelectItem value="DRILL">{t('types.DRILL')}</SelectItem>
            <SelectItem value="POINT_IN_TIME">{t('types.POINT_IN_TIME')}</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RotateCcw className="h-4 w-4 mr-2" />
          {t('listView.refresh')}
        </Button>
      </div>

      {/* 表格 */}
      <div className="border rounded-md">
        {isLoading ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]"></TableHead>
                <TableHead>{t('listView.columns.status')}</TableHead>
                <TableHead>{t('listView.columns.type')}</TableHead>
                <TableHead>{t('listView.columns.backupSource')}</TableHead>
                <TableHead>{t('listView.columns.startedAt')}</TableHead>
                <TableHead>{t('listView.columns.completedAt')}</TableHead>
                <TableHead>{t('listView.columns.progress')}</TableHead>
                <TableHead className="text-right">{t('listView.columns.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  <p className="mt-2 text-sm text-muted-foreground">{t('listView.loading')}</p>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        ) : (
          <DataTable
            data={records}
            columns={columns}
            getRowId={(record) => record.id}
            page={page}
            pageSize={limit}
            emptyState={t('listView.empty')}
          />
        )}
      </div>

      {/* 分頁 */}
      {totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      )}

      {/* 取消確認對話框 */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('listView.cancelDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('listView.cancelDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('listView.cancelDialog.back')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelConfirm}
              disabled={cancelMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('listView.cancelDialog.cancelling')}
                </>
              ) : (
                t('listView.cancelDialog.confirm')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default RestoreList
