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
 * @lastModified 2026-06-22 (CHANGE-087 Phase 2: 遷移共用 DataTable)
 *
 * @dependencies
 *   - @/hooks/useRetention - 刪除請求管理 Hooks
 *   - @/components/features/common/DataTable - 共用表格封裝（序號欄）
 *   - @/components/ui - UI 組件
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
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
import {
  AlertCircle,
  CheckCircle2,
  XCircle,
  Trash2,
  Clock,
  AlertTriangle,
} from 'lucide-react'
import type { DeletionRequestWithRelations } from '@/types/retention'
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

// ============================================================
// Component
// ============================================================

export function DeletionRequestList({ className }: DeletionRequestListProps) {
  const t = useTranslations('dataRetention')
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
        title: t('deletion.approveToast.successTitle'),
        description: t('deletion.approveToast.successDescription'),
      })
      setApproveDialogOpen(false)
    },
    onError: (error) => {
      toast({
        title: t('deletion.approveToast.errorTitle'),
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const rejectRequest = useApproveDeletionRequest({
    onSuccess: () => {
      toast({
        title: t('deletion.rejectToast.successTitle'),
        description: t('deletion.rejectToast.successDescription'),
      })
      setRejectDialogOpen(false)
      setRejectionReason('')
    },
    onError: (error) => {
      toast({
        title: t('deletion.rejectToast.errorTitle'),
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const handleApproveClick = React.useCallback((requestId: string) => {
    setSelectedRequestId(requestId)
    setApproveDialogOpen(true)
  }, [])

  const handleRejectClick = React.useCallback((requestId: string) => {
    setSelectedRequestId(requestId)
    setRejectDialogOpen(true)
  }, [])

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

  // --- Column 定義 ---
  const columns = React.useMemo<DataTableColumn<DeletionRequestWithRelations>[]>(
    () => [
      {
        id: 'dataType',
        header: t('deletion.columns.dataType'),
        cell: (request) => (
          <Badge variant="outline">{t(`dataType.${request.dataType}`)}</Badge>
        ),
      },
      {
        id: 'dateRange',
        header: t('deletion.columns.dateRange'),
        cellClassName: 'text-sm',
        cell: (request) => (
          <div>
            <p>{formatDate(request.dateRangeStart)}</p>
            <p className="text-muted-foreground">{t('deletion.dateRangeTo')}</p>
            <p>{formatDate(request.dateRangeEnd)}</p>
          </div>
        ),
      },
      {
        id: 'reason',
        header: t('deletion.columns.reason'),
        cell: (request) => (
          <p className="text-sm max-w-[200px] truncate">{request.reason}</p>
        ),
      },
      {
        id: 'requestedBy',
        header: t('deletion.columns.requestedBy'),
        cellClassName: 'text-sm',
        cell: (request) => request.requestedBy?.name || t('common.unknown'),
      },
      {
        id: 'status',
        header: t('deletion.columns.status'),
        cell: (request) => {
          const StatusIcon = getStatusIcon(request.status)
          return (
            <Badge variant={getStatusVariant(request.status)}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {t(`deletionStatus.${request.status}`)}
            </Badge>
          )
        },
      },
      {
        id: 'createdAt',
        header: t('deletion.columns.createdAt'),
        cellClassName: 'text-sm',
        cell: (request) => formatDate(request.createdAt),
      },
      {
        id: 'actions',
        header: '',
        headerClassName: 'w-[150px]',
        cell: (request) => (
          <>
            {request.status === 'PENDING' && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleApproveClick(request.id)}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  {t('deletion.approve')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRejectClick(request.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  {t('deletion.reject')}
                </Button>
              </div>
            )}
            {request.status === 'REJECTED' && request.rejectionReason && (
              <p className="text-xs text-muted-foreground max-w-[150px] truncate">
                {request.rejectionReason}
              </p>
            )}
          </>
        ),
      },
    ],
    [handleApproveClick, handleRejectClick, t]
  )

  if (isLoading) {
    return <DeletionListSkeleton />
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <AlertCircle className="h-8 w-8 text-destructive mb-2" />
        <p className="text-muted-foreground">{t('deletion.loadError')}</p>
      </div>
    )
  }

  const requests = data?.data || []
  const pagination = data?.meta

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">{t('deletion.listTitle')}</h3>
      </div>

      <div className="rounded-md border">
        <DataTable
          data={requests}
          columns={columns}
          getRowId={(request) => request.id}
          page={page}
          pageSize={pagination?.limit ?? 10}
          emptyState={
            <>
              <Trash2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-muted-foreground">{t('deletion.empty')}</p>
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

      {/* Approve Confirmation Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deletion.approveDialog.title')}</DialogTitle>
            <DialogDescription>
              <div className="flex items-start gap-2 mt-2 p-3 bg-destructive/10 rounded-md">
                <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">{t('deletion.approveDialog.irreversible')}</p>
                  <p className="text-sm mt-1">
                    {t('deletion.approveDialog.warning')}
                  </p>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmApprove}
              disabled={approveRequest.isPending}
            >
              {approveRequest.isPending
                ? t('deletion.approveDialog.submitting')
                : t('deletion.approveDialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deletion.rejectDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('deletion.rejectDialog.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">{t('deletion.rejectDialog.reasonLabel')}</Label>
              <Textarea
                id="rejection-reason"
                placeholder={t('deletion.rejectDialog.reasonPlaceholder')}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleConfirmReject}
              disabled={!rejectionReason.trim() || rejectRequest.isPending}
            >
              {rejectRequest.isPending
                ? t('deletion.rejectDialog.submitting')
                : t('deletion.rejectDialog.confirm')}
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
