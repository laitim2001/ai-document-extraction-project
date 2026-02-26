'use client'

/**
 * @fileoverview 備份列表組件
 * @description
 *   顯示備份記錄列表，包含：
 *   - 備份時間、類型、大小、狀態
 *   - 篩選和排序
 *   - 取消/刪除操作
 *
 * @module src/components/features/admin/backup/BackupList
 * @since Epic 12 - Story 12-5 (數據備份管理)
 * @lastModified 2025-12-21
 */

import { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import {
  Loader2,
  Trash2,
  StopCircle,
  Download,
  MoreHorizontal,
  Database,
  File,
  Settings,
  HardDrive,
  Clock,
  User,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { useBackups, useCancelBackup, useDeleteBackup } from '@/hooks/use-backup'
import { formatFileSize, getStatusInfo, getSourceInfo, getTypeInfo } from '@/types/backup'
import type { BackupListParams, BackupStatus, BackupSource, BackupType } from '@/types/backup'

// ============================================================
// Types
// ============================================================

interface BackupListProps {
  onViewDetail?: (id: string) => void
}

// ============================================================
// Component
// ============================================================

/**
 * 備份列表組件
 */
export function BackupList({ onViewDetail }: BackupListProps) {
  // --- i18n ---
  const t = useTranslations('admin')

  // --- State ---
  const [params, setParams] = useState<BackupListParams>({
    page: 1,
    limit: 10,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  })
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [cancelId, setCancelId] = useState<string | null>(null)

  // --- Hooks ---
  const { data, isLoading, error } = useBackups(params)
  const cancelMutation = useCancelBackup()
  const deleteMutation = useDeleteBackup()

  // --- Handlers ---
  const handleFilterChange = useCallback((key: keyof BackupListParams, value: string | undefined) => {
    setParams((prev) => ({
      ...prev,
      [key]: value === 'all' ? undefined : value,
      page: 1,
    }))
  }, [])

  const handlePageChange = useCallback((page: number) => {
    setParams((prev) => ({ ...prev, page }))
  }, [])

  const handleCancel = useCallback(async () => {
    if (!cancelId) return
    try {
      await cancelMutation.mutateAsync(cancelId)
      toast.success(t('backup.list.toast.cancelled'))
      setCancelId(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('backup.list.toast.cancelError'))
    }
  }, [cancelId, cancelMutation, t])

  const handleDelete = useCallback(async () => {
    if (!deleteId) return
    try {
      await deleteMutation.mutateAsync(deleteId)
      toast.success(t('backup.list.toast.deleted'))
      setDeleteId(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('backup.list.toast.deleteError'))
    }
  }, [deleteId, deleteMutation, t])

  // --- Render helpers ---
  const getSourceIcon = (source: BackupSource) => {
    switch (source) {
      case 'DATABASE':
        return <Database className="h-4 w-4" />
      case 'FILES':
        return <File className="h-4 w-4" />
      case 'CONFIG':
        return <Settings className="h-4 w-4" />
      case 'FULL_SYSTEM':
        return <HardDrive className="h-4 w-4" />
    }
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-10">
          <p className="text-center text-destructive">
            {t('backup.list.loadError', { error: error instanceof Error ? error.message : 'Unknown error' })}
          </p>
        </CardContent>
      </Card>
    )
  }

  const backups = data?.data?.backups ?? []
  const pagination = data?.data?.pagination

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('backup.list.title')}</CardTitle>
        <CardDescription>{t('backup.list.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 篩選器 */}
        <div className="flex flex-wrap gap-3">
          <Select
            value={params.status || 'all'}
            onValueChange={(v) => handleFilterChange('status', v)}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder={t('backup.list.table.status')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('backup.list.filters.status.all')}</SelectItem>
              <SelectItem value="COMPLETED">{t('backup.list.filters.status.completed')}</SelectItem>
              <SelectItem value="IN_PROGRESS">{t('backup.list.filters.status.inProgress')}</SelectItem>
              <SelectItem value="FAILED">{t('backup.list.filters.status.failed')}</SelectItem>
              <SelectItem value="CANCELLED">{t('backup.list.filters.status.cancelled')}</SelectItem>
              <SelectItem value="PENDING">{t('backup.list.filters.status.pending')}</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={params.source || 'all'}
            onValueChange={(v) => handleFilterChange('source', v)}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder={t('backup.list.table.source')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('backup.list.filters.source.all')}</SelectItem>
              <SelectItem value="DATABASE">{t('backup.list.filters.source.database')}</SelectItem>
              <SelectItem value="FILES">{t('backup.list.filters.source.files')}</SelectItem>
              <SelectItem value="CONFIG">{t('backup.list.filters.source.config')}</SelectItem>
              <SelectItem value="FULL_SYSTEM">{t('backup.list.filters.source.fullSystem')}</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={params.type || 'all'}
            onValueChange={(v) => handleFilterChange('type', v)}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder={t('backup.list.table.type')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('backup.list.filters.type.all')}</SelectItem>
              <SelectItem value="FULL">{t('backup.list.filters.type.full')}</SelectItem>
              <SelectItem value="INCREMENTAL">{t('backup.list.filters.type.incremental')}</SelectItem>
              <SelectItem value="DIFFERENTIAL">{t('backup.list.filters.type.differential')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 表格 */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('backup.list.table.backupTime')}</TableHead>
                <TableHead>{t('backup.list.table.source')}</TableHead>
                <TableHead>{t('backup.list.table.type')}</TableHead>
                <TableHead>{t('backup.list.table.size')}</TableHead>
                <TableHead>{t('backup.list.table.status')}</TableHead>
                <TableHead>{t('backup.list.table.operator')}</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : backups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    {t('backup.list.emptyState')}
                  </TableCell>
                </TableRow>
              ) : (
                backups.map((backup) => {
                  const statusInfo = getStatusInfo(backup.status as BackupStatus)
                  const sourceInfo = getSourceInfo(backup.source as BackupSource)
                  const typeInfo = getTypeInfo(backup.type as BackupType)
                  const canCancel = backup.status === 'IN_PROGRESS' || backup.status === 'PENDING'
                  const canDelete = backup.status !== 'IN_PROGRESS'

                  return (
                    <TableRow key={backup.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {backup.startedAt
                              ? format(new Date(backup.startedAt), 'yyyy/MM/dd HH:mm', {
                                  locale: zhTW,
                                })
                              : '-'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getSourceIcon(backup.source as BackupSource)}
                          <span>{sourceInfo.label}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{typeInfo.label}</Badge>
                      </TableCell>
                      <TableCell>{formatFileSize(backup.sizeBytes)}</TableCell>
                      <TableCell>
                        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{backup.createdByName || t('backup.list.table.system')}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onViewDetail?.(backup.id)}>
                              {t('backup.list.actions.viewDetails')}
                            </DropdownMenuItem>
                            {backup.status === 'COMPLETED' && (
                              <DropdownMenuItem>
                                <Download className="mr-2 h-4 w-4" />
                                {t('backup.list.actions.download')}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {canCancel && (
                              <DropdownMenuItem
                                onClick={() => setCancelId(backup.id)}
                                className="text-orange-600"
                              >
                                <StopCircle className="mr-2 h-4 w-4" />
                                {t('backup.list.actions.cancelBackup')}
                              </DropdownMenuItem>
                            )}
                            {canDelete && (
                              <DropdownMenuItem
                                onClick={() => setDeleteId(backup.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                {t('backup.list.actions.delete')}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* 分頁 */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {t('backup.list.pagination.total', {
                total: pagination.total,
                page: pagination.page,
                totalPages: pagination.totalPages,
              })}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* 取消確認對話框 */}
      <AlertDialog open={!!cancelId} onOpenChange={(open) => !open && setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('backup.list.cancelDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('backup.list.cancelDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelMutation.isPending}>
              {t('backup.list.cancelDialog.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={cancelMutation.isPending}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {cancelMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('backup.list.cancelDialog.cancelling')}
                </>
              ) : (
                t('backup.list.cancelDialog.confirm')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 刪除確認對話框 */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('backup.list.deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('backup.list.deleteDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              {t('backup.list.deleteDialog.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('backup.list.deleteDialog.deleting')}
                </>
              ) : (
                t('backup.list.deleteDialog.confirm')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
