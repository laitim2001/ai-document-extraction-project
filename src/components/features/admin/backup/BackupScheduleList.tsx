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
        toast.error(err instanceof Error ? err.message : '切換狀態失敗')
      }
    },
    [toggleMutation]
  )

  const handleRun = useCallback(async () => {
    if (!runId) return
    try {
      await runMutation.mutateAsync(runId)
      toast.success('排程備份已開始執行')
      setRunId(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '執行失敗')
    }
  }, [runId, runMutation])

  const handleDelete = useCallback(async () => {
    if (!deleteId) return
    try {
      await deleteMutation.mutateAsync(deleteId)
      toast.success('排程已刪除')
      setDeleteId(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '刪除失敗')
    }
  }, [deleteId, deleteMutation])

  if (error) {
    return (
      <Card>
        <CardContent className="py-10">
          <p className="text-center text-destructive">
            載入失敗：{error instanceof Error ? error.message : '未知錯誤'}
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
          <CardTitle>備份排程</CardTitle>
          <CardDescription>自動備份排程配置</CardDescription>
        </div>
        {onAdd && (
          <Button onClick={onAdd} size="sm">
            <Calendar className="mr-2 h-4 w-4" />
            新增排程
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 表格 */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>排程名稱</TableHead>
                <TableHead>備份來源</TableHead>
                <TableHead>備份類型</TableHead>
                <TableHead>執行頻率</TableHead>
                <TableHead>下次執行</TableHead>
                <TableHead>狀態</TableHead>
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
                    沒有備份排程
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
                            {schedule.isEnabled ? '啟用' : '停用'}
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
                              立即執行
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onEdit?.(schedule)}>
                              <Edit className="mr-2 h-4 w-4" />
                              編輯
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeleteId(schedule.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              刪除
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
              共 {pagination.total} 筆，第 {pagination.page} / {pagination.totalPages} 頁
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
            <AlertDialogTitle>確認執行排程</AlertDialogTitle>
            <AlertDialogDescription>
              確定要立即執行這個備份排程嗎？這將開始一個新的備份任務。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={runMutation.isPending}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleRun} disabled={runMutation.isPending}>
              {runMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  執行中...
                </>
              ) : (
                '確認執行'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 刪除確認對話框 */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除排程</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除這個備份排程嗎？刪除後將無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  刪除中...
                </>
              ) : (
                '確認刪除'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
