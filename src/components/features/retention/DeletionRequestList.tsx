'use client'

/**
 * @fileoverview 刪除請求列表組件
 * @description
 *   顯示資料刪除請求，支援審批工作流。
 *   需要管理員審批才能執行實際刪除。
 *
 * @module src/components/features/retention/DeletionRequestList
 * @author Development Team
 * @since Epic 8 - Story 8.6 (Long-term Data Retention)
 * @lastModified 2025-12-20
 *
 * @dependencies
 *   - @/hooks/useRetention - 刪除請求管理 Hooks
 *   - @/components/ui - UI 組件
 */

import * as React from 'react'
import {
  useDeletionRequests,
  useApproveDeletionRequest,
} from '@/hooks/useRetention'
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
import {
  AlertCircle,
  CheckCircle2,
  XCircle,
  Trash2,
  Clock,
  AlertTriangle,
} from 'lucide-react'
import { DATA_TYPE_LABELS } from '@/types/retention'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { DeletionRequestStatus } from '@prisma/client'

// ============================================================
// Types
// ============================================================

interface DeletionRequestListProps {
  className?: string
}

// ============================================================
// Helpers
// ============================================================

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getStatusVariant(
  status: DeletionRequestStatus
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'APPROVED':
    case 'COMPLETED':
      return 'default'
    case 'PENDING':
      return 'secondary'
    case 'REJECTED':
    case 'FAILED':
      return 'destructive'
    default:
      return 'outline'
  }
}

function getStatusIcon(status: DeletionRequestStatus) {
  switch (status) {
    case 'APPROVED':
    case 'COMPLETED':
      return CheckCircle2
    case 'PENDING':
    case 'EXECUTING':
      return Clock
    case 'REJECTED':
      return XCircle
    case 'FAILED':
      return AlertTriangle
    default:
      return AlertCircle
  }
}

const STATUS_LABELS: Record<DeletionRequestStatus, string> = {
  PENDING: '待審批',
  APPROVED: '已批准',
  REJECTED: '已拒絕',
  EXECUTING: '執行中',
  COMPLETED: '已完成',
  FAILED: '失敗',
}

// ============================================================
// Component
// ============================================================

export function DeletionRequestList({ className }: DeletionRequestListProps) {
  const { toast } = useToast()
  const [page, setPage] = React.useState(1)
  const [approveDialogOpen, setApproveDialogOpen] = React.useState(false)
  const [rejectDialogOpen, setRejectDialogOpen] = React.useState(false)
  const [selectedRequestId, setSelectedRequestId] = React.useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = React.useState('')

  const { data, isLoading, error } = useDeletionRequests({ page, limit: 10 })

  const approveRequest = useApproveDeletionRequest({
    onSuccess: () => {
      toast({
        title: '刪除請求已批准',
        description: '系統將開始執行刪除作業',
      })
      setApproveDialogOpen(false)
    },
    onError: (error) => {
      toast({
        title: '批准失敗',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const rejectRequest = useApproveDeletionRequest({
    onSuccess: () => {
      toast({
        title: '刪除請求已拒絕',
        description: '已記錄拒絕原因',
      })
      setRejectDialogOpen(false)
      setRejectionReason('')
    },
    onError: (error) => {
      toast({
        title: '拒絕失敗',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const handleApproveClick = (requestId: string) => {
    setSelectedRequestId(requestId)
    setApproveDialogOpen(true)
  }

  const handleRejectClick = (requestId: string) => {
    setSelectedRequestId(requestId)
    setRejectDialogOpen(true)
  }

  const handleConfirmApprove = () => {
    if (selectedRequestId) {
      approveRequest.mutate({
        requestId: selectedRequestId,
        approve: true,
      })
    }
  }

  const handleConfirmReject = () => {
    if (selectedRequestId && rejectionReason.trim()) {
      rejectRequest.mutate({
        requestId: selectedRequestId,
        approve: false,
        rejectionReason,
      })
    }
  }

  if (isLoading) {
    return <DeletionListSkeleton />
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <AlertCircle className="h-8 w-8 text-destructive mb-2" />
        <p className="text-muted-foreground">無法載入刪除請求</p>
      </div>
    )
  }

  const requests = data?.data || []
  const pagination = data?.meta

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">刪除請求</h3>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>資料類型</TableHead>
              <TableHead>資料範圍</TableHead>
              <TableHead>請求原因</TableHead>
              <TableHead>請求者</TableHead>
              <TableHead>狀態</TableHead>
              <TableHead>請求時間</TableHead>
              <TableHead className="w-[150px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10">
                  <Trash2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-muted-foreground">尚無刪除請求</p>
                </TableCell>
              </TableRow>
            ) : (
              requests.map((request) => {
                const StatusIcon = getStatusIcon(request.status)
                return (
                  <TableRow key={request.id}>
                    <TableCell>
                      <Badge variant="outline">
                        {DATA_TYPE_LABELS[request.dataType]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>
                        <p>{formatDate(request.dateRangeStart)}</p>
                        <p className="text-muted-foreground">至</p>
                        <p>{formatDate(request.dateRangeEnd)}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm max-w-[200px] truncate">
                        {request.reason}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm">
                      {request.requestedBy?.name || '未知'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(request.status)}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {STATUS_LABELS[request.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(request.createdAt)}
                    </TableCell>
                    <TableCell>
                      {request.status === 'PENDING' && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleApproveClick(request.id)}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            批准
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRejectClick(request.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            拒絕
                          </Button>
                        </div>
                      )}
                      {request.status === 'REJECTED' && request.rejectionReason && (
                        <p className="text-xs text-muted-foreground max-w-[150px] truncate">
                          {request.rejectionReason}
                        </p>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
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

      {/* Approve Confirmation Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確認批准刪除請求</DialogTitle>
            <DialogDescription>
              <div className="flex items-start gap-2 mt-2 p-3 bg-destructive/10 rounded-md">
                <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">此操作無法復原</p>
                  <p className="text-sm mt-1">
                    批准後，系統將開始刪除指定範圍內的資料。
                    如資料已歸檔，將從冷存儲中永久刪除。
                  </p>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmApprove}
              disabled={approveRequest.isPending}
            >
              {approveRequest.isPending ? '處理中...' : '確認批准'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>拒絕刪除請求</DialogTitle>
            <DialogDescription>
              請說明拒絕此刪除請求的原因。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">拒絕原因</Label>
              <Textarea
                id="rejection-reason"
                placeholder="請輸入拒絕原因..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleConfirmReject}
              disabled={!rejectionReason.trim() || rejectRequest.isPending}
            >
              {rejectRequest.isPending ? '處理中...' : '確認拒絕'}
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

function DeletionListSkeleton() {
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
