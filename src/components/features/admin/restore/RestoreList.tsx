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
 * @lastModified 2025-12-21
 */

import { useState, useCallback } from 'react'
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
        {info.label}
      </Badge>
    )
  }

  const renderTypeBadge = (type: RestoreType) => {
    const info = getRestoreTypeInfo(type)
    return (
      <Badge variant="outline">
        <span className="mr-1">{info.icon}</span>
        {info.label}
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
            <SelectValue placeholder="狀態篩選" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有狀態</SelectItem>
            <SelectItem value="PENDING">等待執行</SelectItem>
            <SelectItem value="VALIDATING">驗證中</SelectItem>
            <SelectItem value="PRE_BACKUP">預備份中</SelectItem>
            <SelectItem value="IN_PROGRESS">執行中</SelectItem>
            <SelectItem value="VERIFYING">驗證結果中</SelectItem>
            <SelectItem value="COMPLETED">已完成</SelectItem>
            <SelectItem value="FAILED">失敗</SelectItem>
            <SelectItem value="CANCELLED">已取消</SelectItem>
            <SelectItem value="ROLLED_BACK">已回滾</SelectItem>
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
            <SelectValue placeholder="類型篩選" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有類型</SelectItem>
            <SelectItem value="FULL">完整恢復</SelectItem>
            <SelectItem value="PARTIAL">部分恢復</SelectItem>
            <SelectItem value="DRILL">恢復演練</SelectItem>
            <SelectItem value="POINT_IN_TIME">時間點恢復</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RotateCcw className="h-4 w-4 mr-2" />
          重新整理
        </Button>
      </div>

      {/* 表格 */}
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>狀態</TableHead>
              <TableHead>類型</TableHead>
              <TableHead>備份來源</TableHead>
              <TableHead>開始時間</TableHead>
              <TableHead>完成時間</TableHead>
              <TableHead>進度</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  <p className="mt-2 text-sm text-muted-foreground">載入中...</p>
                </TableCell>
              </TableRow>
            ) : records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  暫無恢復記錄
                </TableCell>
              </TableRow>
            ) : (
              records.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>{renderStatusBadge(record.status)}</TableCell>
                  <TableCell>{renderTypeBadge(record.type)}</TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {record.backupName || record.backupId}
                  </TableCell>
                  <TableCell>{formatDate(record.startedAt)}</TableCell>
                  <TableCell>{formatDate(record.completedAt)}</TableCell>
                  <TableCell>
                    {record.progress !== null && record.progress !== undefined ? (
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
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onViewDetails?.(record)}
                        title="查看詳情"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canCancel(record.status) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCancelClick(record.id)}
                          title="取消恢復"
                          disabled={cancelMutation.isPending}
                        >
                          <XCircle className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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
            <AlertDialogTitle>確認取消恢復操作？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作將取消正在等待執行的恢復任務，已完成的步驟不會受到影響。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>返回</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelConfirm}
              disabled={cancelMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  取消中...
                </>
              ) : (
                '確認取消'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default RestoreList
