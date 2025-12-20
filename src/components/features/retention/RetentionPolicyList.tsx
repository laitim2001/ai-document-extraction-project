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
 * @lastModified 2025-12-20
 *
 * @dependencies
 *   - @/hooks/useRetention - 策略管理 Hooks
 *   - @/components/ui - UI 組件
 */

import * as React from 'react'
import { useRetentionPolicies, useDeleteRetentionPolicy } from '@/hooks/useRetention'
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
import { DATA_TYPE_LABELS } from '@/types/retention'
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
  const { toast } = useToast()
  const [page, setPage] = React.useState(1)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [selectedPolicyId, setSelectedPolicyId] = React.useState<string | null>(null)

  const { data, isLoading, error } = useRetentionPolicies({ page, limit: 10 })
  const deletePolicy = useDeleteRetentionPolicy({
    onSuccess: () => {
      toast({
        title: '刪除成功',
        description: '保留策略已刪除',
      })
      setDeleteDialogOpen(false)
    },
    onError: (error) => {
      toast({
        title: '刪除失敗',
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

  if (isLoading) {
    return <PolicyListSkeleton />
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <AlertCircle className="h-8 w-8 text-destructive mb-2" />
        <p className="text-muted-foreground">無法載入保留策略</p>
      </div>
    )
  }

  const policies = data?.data || []
  const pagination = data?.meta

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">保留策略</h3>
        {onCreateClick && (
          <Button onClick={onCreateClick} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            新增策略
          </Button>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>策略名稱</TableHead>
              <TableHead>資料類型</TableHead>
              <TableHead>保留天數</TableHead>
              <TableHead>保護設定</TableHead>
              <TableHead>狀態</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {policies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10">
                  <p className="text-muted-foreground">尚無保留策略</p>
                </TableCell>
              </TableRow>
            ) : (
              policies.map((policy) => (
                <TableRow key={policy.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{policy.policyName}</p>
                      {policy.description && (
                        <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                          {policy.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {DATA_TYPE_LABELS[policy.dataType]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm space-y-0.5">
                      <p>熱: {policy.hotStorageDays} 天</p>
                      <p>溫: {policy.warmStorageDays} 天</p>
                      <p>冷: {policy.coldStorageDays} 天</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {policy.deletionProtection && (
                        <Badge variant="secondary" className="w-fit">
                          <Shield className="h-3 w-3 mr-1" />
                          刪除保護
                        </Badge>
                      )}
                      {policy.requireApproval && (
                        <Badge variant="secondary" className="w-fit">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          需審批
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={policy.isActive ? 'default' : 'secondary'}>
                      {policy.isActive ? '啟用' : '停用'}
                    </Badge>
                  </TableCell>
                  <TableCell>
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
                            編輯
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => handleDeleteClick(policy.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          刪除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除策略？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作無法復原。刪除策略後，相關的歸檔配置將無法使用。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePolicy.isPending ? '刪除中...' : '確認刪除'}
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
