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
      toast.success('備份已取消')
      setCancelId(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '取消失敗')
    }
  }, [cancelId, cancelMutation])

  const handleDelete = useCallback(async () => {
    if (!deleteId) return
    try {
      await deleteMutation.mutateAsync(deleteId)
      toast.success('備份已刪除')
      setDeleteId(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '刪除失敗')
    }
  }, [deleteId, deleteMutation])

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
            載入失敗：{error instanceof Error ? error.message : '未知錯誤'}
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
        <CardTitle>備份記錄</CardTitle>
        <CardDescription>系統備份歷史記錄</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 篩選器 */}
        <div className="flex flex-wrap gap-3">
          <Select
            value={params.status || 'all'}
            onValueChange={(v) => handleFilterChange('status', v)}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="狀態" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部狀態</SelectItem>
              <SelectItem value="COMPLETED">已完成</SelectItem>
              <SelectItem value="IN_PROGRESS">執行中</SelectItem>
              <SelectItem value="FAILED">失敗</SelectItem>
              <SelectItem value="CANCELLED">已取消</SelectItem>
              <SelectItem value="PENDING">待處理</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={params.source || 'all'}
            onValueChange={(v) => handleFilterChange('source', v)}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="來源" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部來源</SelectItem>
              <SelectItem value="DATABASE">資料庫</SelectItem>
              <SelectItem value="FILES">檔案</SelectItem>
              <SelectItem value="CONFIG">設定</SelectItem>
              <SelectItem value="FULL_SYSTEM">完整系統</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={params.type || 'all'}
            onValueChange={(v) => handleFilterChange('type', v)}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="類型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部類型</SelectItem>
              <SelectItem value="FULL">完整備份</SelectItem>
              <SelectItem value="INCREMENTAL">增量備份</SelectItem>
              <SelectItem value="DIFFERENTIAL">差異備份</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 表格 */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>備份時間</TableHead>
                <TableHead>來源</TableHead>
                <TableHead>類型</TableHead>
                <TableHead>大小</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead>操作者</TableHead>
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
                    沒有備份記錄
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
                          <span className="text-sm">{backup.createdByName || '系統'}</span>
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
                              查看詳情
                            </DropdownMenuItem>
                            {backup.status === 'COMPLETED' && (
                              <DropdownMenuItem>
                                <Download className="mr-2 h-4 w-4" />
                                下載
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {canCancel && (
                              <DropdownMenuItem
                                onClick={() => setCancelId(backup.id)}
                                className="text-orange-600"
                              >
                                <StopCircle className="mr-2 h-4 w-4" />
                                取消備份
                              </DropdownMenuItem>
                            )}
                            {canDelete && (
                              <DropdownMenuItem
                                onClick={() => setDeleteId(backup.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                刪除
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

      {/* 取消確認對話框 */}
      <AlertDialog open={!!cancelId} onOpenChange={(open) => !open && setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認取消備份</AlertDialogTitle>
            <AlertDialogDescription>
              確定要取消這個正在執行的備份嗎？此操作無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelMutation.isPending}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={cancelMutation.isPending}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {cancelMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  取消中...
                </>
              ) : (
                '確認取消'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 刪除確認對話框 */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除備份</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除這個備份嗎？刪除後將無法復原，備份檔案也會被永久移除。
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
