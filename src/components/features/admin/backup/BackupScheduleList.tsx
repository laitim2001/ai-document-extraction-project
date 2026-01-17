'use client'

/**
 * @fileoverview 備份排程列表組件
 * @description
 *   顯示備份排程列表，包含：
 *   - 排程名稱、頻率、下次執行時間
 *   - 啟用/停用開關
 *   - 編輯/刪除/手動執行操作
 *
 * @module src/components/features/admin/backup/BackupScheduleList
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
  PlayCircle,
  MoreHorizontal,
  Clock,
  Calendar,
  Edit,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
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
import {
  useBackupSchedules,
  useDeleteSchedule,
  useToggleSchedule,
  useRunSchedule,
} from '@/hooks/use-backup-schedule'
import { getSourceInfo, getTypeInfo } from '@/types/backup'
import type { BackupScheduleListParams, BackupScheduleListItem, BackupSource, BackupType } from '@/types/backup'

// ============================================================
// Types
// ============================================================

interface BackupScheduleListProps {
  onEdit?: (schedule: BackupScheduleListItem) => void
  onAdd?: () => void
}

// ============================================================
// Component
// ============================================================

/**
 * 備份排程列表組件
 */
export function BackupScheduleList({ onEdit, onAdd }: BackupScheduleListProps) {
  // --- i18n ---
  const t = useTranslations('admin')

  // --- State ---
  const [params, setParams] = useState<BackupScheduleListParams>({
    page: 1,
    limit: 10,
    sortBy: 'nextRunAt',
    sortOrder: 'asc',
  })
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [runId, setRunId] = useState<string | null>(null)

  // --- Hooks ---
  const { data, isLoading, error } = useBackupSchedules(params)
  const deleteMutation = useDeleteSchedule()
  const toggleMutation = useToggleSchedule()
  const runMutation = useRunSchedule()

  // --- Handlers ---
  const handlePageChange = useCallback((page: number) => {
    setParams((prev) => ({ ...prev, page }))
  }, [])

  const handleToggle = useCallback(
    async (id: string) => {
      try {
        const result = await toggleMutation.mutateAsync(id)
        toast.success(result.data.message)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('backup.schedule.toast.toggleError'))
      }
    },
    [toggleMutation, t]
  )

  const handleRun = useCallback(async () => {
    if (!runId) return
    try {
      await runMutation.mutateAsync(runId)
      toast.success(t('backup.schedule.toast.runStarted'))
      setRunId(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('backup.schedule.toast.runError'))
    }
  }, [runId, runMutation, t])

  const handleDelete = useCallback(async () => {
    if (!deleteId) return
    try {
      await deleteMutation.mutateAsync(deleteId)
      toast.success(t('backup.schedule.toast.deleted'))
      setDeleteId(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('backup.schedule.toast.deleteError'))
    }
  }, [deleteId, deleteMutation, t])

  if (error) {
    return (
      <Card>
        <CardContent className="py-10">
          <p className="text-center text-destructive">
            {t('backup.schedule.loadError', { error: error instanceof Error ? error.message : 'Unknown error' })}
          </p>
        </CardContent>
      </Card>
    )
  }

  const schedules = data?.data.schedules ?? []
  const pagination = data?.data.pagination

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{t('backup.schedule.title')}</CardTitle>
          <CardDescription>{t('backup.schedule.description')}</CardDescription>
        </div>
        {onAdd && (
          <Button onClick={onAdd} size="sm">
            <Calendar className="mr-2 h-4 w-4" />
            {t('backup.schedule.addSchedule')}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 表格 */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('backup.schedule.table.scheduleName')}</TableHead>
                <TableHead>{t('backup.schedule.table.backupSource')}</TableHead>
                <TableHead>{t('backup.schedule.table.backupType')}</TableHead>
                <TableHead>{t('backup.schedule.table.frequency')}</TableHead>
                <TableHead>{t('backup.schedule.table.nextRun')}</TableHead>
                <TableHead>{t('backup.schedule.table.status')}</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : schedules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    {t('backup.schedule.emptyState')}
                  </TableCell>
                </TableRow>
              ) : (
                schedules.map((schedule) => {
                  const sourceInfo = getSourceInfo(schedule.backupSource as BackupSource)
                  const typeInfo = getTypeInfo(schedule.backupType as BackupType)

                  return (
                    <TableRow key={schedule.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{schedule.name}</p>
                          {schedule.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {schedule.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{sourceInfo.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{typeInfo.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <code className="text-xs bg-muted px-1 py-0.5 rounded">
                            {schedule.cronExpression}
                          </code>
                        </div>
                      </TableCell>
                      <TableCell>
                        {schedule.nextRunAt ? (
                          format(new Date(schedule.nextRunAt), 'MM/dd HH:mm', { locale: zhTW })
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={schedule.isEnabled}
                            onCheckedChange={() => handleToggle(schedule.id)}
                            disabled={toggleMutation.isPending}
                          />
                          <span className="text-sm">
                            {schedule.isEnabled ? t('backup.schedule.status.enabled') : t('backup.schedule.status.disabled')}
                          </span>
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
                            <DropdownMenuItem
                              onClick={() => setRunId(schedule.id)}
                              disabled={!schedule.isEnabled}
                            >
                              <PlayCircle className="mr-2 h-4 w-4" />
                              {t('backup.schedule.actions.runNow')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onEdit?.(schedule)}>
                              <Edit className="mr-2 h-4 w-4" />
                              {t('backup.schedule.actions.edit')}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeleteId(schedule.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {t('backup.schedule.actions.delete')}
                            </DropdownMenuItem>
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
              {t('backup.schedule.pagination.total', {
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

      {/* 執行確認對話框 */}
      <AlertDialog open={!!runId} onOpenChange={(open) => !open && setRunId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('backup.schedule.runDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('backup.schedule.runDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={runMutation.isPending}>{t('backup.schedule.runDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleRun} disabled={runMutation.isPending}>
              {runMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('backup.schedule.runDialog.running')}
                </>
              ) : (
                t('backup.schedule.runDialog.confirm')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 刪除確認對話框 */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('backup.schedule.deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('backup.schedule.deleteDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>{t('backup.schedule.deleteDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('backup.schedule.deleteDialog.deleting')}
                </>
              ) : (
                t('backup.schedule.deleteDialog.confirm')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
