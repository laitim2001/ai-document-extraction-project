'use client'

/**
 * @fileoverview 資料保留策略列表組件
 * @description
 *   顯示和管理資料保留策略。
 *   包含策略列表、創建、編輯和刪除功能。
 *
 * @module src/components/features/retention/RetentionPolicyList
 * @author Development Team
 * @since Epic 8 - Story 8.6 (Long-term Data Retention)
 * @lastModified 2026-06-22 (CHANGE-087 Phase 2: 遷移共用 DataTable)
 *
 * @dependencies
 *   - @/hooks/useRetention - 策略管理 Hooks
 *   - @/components/features/common/DataTable - 共用表格封裝（序號欄）
 *   - @/components/ui - UI 組件
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useRetentionPolicies, useDeleteRetentionPolicy } from '@/hooks/useRetention'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  MoreHorizontal,
  Plus,
  Edit,
  Trash2,
  AlertCircle,
  Shield,
  CheckCircle2,
} from 'lucide-react'
import type { RetentionPolicyWithRelations } from '@/types/retention'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

// ============================================================
// Types
// ============================================================

interface RetentionPolicyListProps {
  className?: string
  onCreateClick?: () => void
  onEditClick?: (policyId: string) => void
}

// ============================================================
// Component
// ============================================================

/**
 * 資料保留策略列表組件
 */
export function RetentionPolicyList({
  className,
  onCreateClick,
  onEditClick,
}: RetentionPolicyListProps) {
  const t = useTranslations('dataRetention')
  const { toast } = useToast()
  const [page, setPage] = React.useState(1)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [selectedPolicyId, setSelectedPolicyId] = React.useState<string | null>(null)

  const { data, isLoading, error } = useRetentionPolicies({ page, limit: 10 })
  const deletePolicy = useDeleteRetentionPolicy({
    onSuccess: () => {
      toast({
        title: t('policy.deleteToast.successTitle'),
        description: t('policy.deleteToast.successDescription'),
      })
      setDeleteDialogOpen(false)
    },
    onError: (error) => {
      toast({
        title: t('policy.deleteToast.errorTitle'),
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const handleDeleteClick = (policyId: string) => {
    setSelectedPolicyId(policyId)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = () => {
    if (selectedPolicyId) {
      deletePolicy.mutate(selectedPolicyId)
    }
  }

  // --- Column 定義 ---
  const columns = React.useMemo<DataTableColumn<RetentionPolicyWithRelations>[]>(
    () => [
      {
        id: 'policyName',
        header: t('policy.columns.policyName'),
        cell: (policy) => (
          <div>
            <p className="font-medium">{policy.policyName}</p>
            {policy.description && (
              <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                {policy.description}
              </p>
            )}
          </div>
        ),
      },
      {
        id: 'dataType',
        header: t('policy.columns.dataType'),
        cell: (policy) => (
          <Badge variant="outline">{t(`dataType.${policy.dataType}`)}</Badge>
        ),
      },
      {
        id: 'retentionDays',
        header: t('policy.columns.retentionDays'),
        cell: (policy) => (
          <div className="text-sm space-y-0.5">
            <p>{t('policy.hotDays', { days: policy.hotStorageDays })}</p>
            <p>{t('policy.warmDays', { days: policy.warmStorageDays })}</p>
            <p>{t('policy.coldDays', { days: policy.coldStorageDays })}</p>
          </div>
        ),
      },
      {
        id: 'protection',
        header: t('policy.columns.protection'),
        cell: (policy) => (
          <div className="flex flex-col gap-1">
            {policy.deletionProtection && (
              <Badge variant="secondary" className="w-fit">
                <Shield className="h-3 w-3 mr-1" />
                {t('policy.deletionProtection')}
              </Badge>
            )}
            {policy.requireApproval && (
              <Badge variant="secondary" className="w-fit">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {t('policy.requireApproval')}
              </Badge>
            )}
          </div>
        ),
      },
      {
        id: 'status',
        header: t('policy.columns.status'),
        cell: (policy) => (
          <Badge variant={policy.isActive ? 'default' : 'secondary'}>
            {policy.isActive ? t('policy.active') : t('policy.inactive')}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: '',
        headerClassName: 'w-[70px]',
        cell: (policy) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onEditClick && (
                <DropdownMenuItem onClick={() => onEditClick(policy.id)}>
                  <Edit className="h-4 w-4 mr-2" />
                  {t('policy.edit')}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => handleDeleteClick(policy.id)}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t('policy.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [onEditClick, t]
  )

  if (isLoading) {
    return <PolicyListSkeleton />
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <AlertCircle className="h-8 w-8 text-destructive mb-2" />
        <p className="text-muted-foreground">{t('policy.loadError')}</p>
      </div>
    )
  }

  const policies = data?.data || []
  const pagination = data?.meta

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">{t('policy.listTitle')}</h3>
        {onCreateClick && (
          <Button onClick={onCreateClick} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            {t('policy.create')}
          </Button>
        )}
      </div>

      <div className="rounded-md border">
        <DataTable
          data={policies}
          columns={columns}
          getRowId={(policy) => policy.id}
          page={page}
          pageSize={pagination?.limit ?? 10}
          emptyState={
            <p className="text-muted-foreground">{t('policy.empty')}</p>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('policy.deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('policy.deleteDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePolicy.isPending
                ? t('policy.deleteDialog.submitting')
                : t('policy.deleteDialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ============================================================
// Skeleton
// ============================================================

function PolicyListSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><Skeleton className="h-4 w-20" /></TableHead>
              <TableHead><Skeleton className="h-4 w-16" /></TableHead>
              <TableHead><Skeleton className="h-4 w-20" /></TableHead>
              <TableHead><Skeleton className="h-4 w-16" /></TableHead>
              <TableHead><Skeleton className="h-4 w-12" /></TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(3)].map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-10 w-full" /></TableCell>
                <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                <TableCell><Skeleton className="h-12 w-20" /></TableCell>
                <TableCell><Skeleton className="h-10 w-20" /></TableCell>
                <TableCell><Skeleton className="h-6 w-12" /></TableCell>
                <TableCell><Skeleton className="h-8 w-8" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
