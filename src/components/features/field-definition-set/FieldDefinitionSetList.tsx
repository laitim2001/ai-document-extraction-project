'use client';

/**
 * @fileoverview FieldDefinitionSet 列表組件
 * @description
 *   顯示 FieldDefinitionSet 資料表格，支援：
 *   - 排序（點擊欄位標題切換升序/降序）
 *   - 分頁導航
 *   - 操作選單（編輯、切換狀態、刪除）
 *   - Scope Badge、Status Badge
 *
 * @module src/components/features/field-definition-set/FieldDefinitionSetList
 * @since CHANGE-042 Phase 3
 * @lastModified 2026-06-21 (CHANGE-087 Phase 2: 遷移共用 DataTable)
 *
 * @dependencies
 *   - next-intl - 國際化
 *   - @/components/features/common/DataTable - 共用表格封裝（序號欄）
 *   - @/hooks/use-field-definition-sets - React Query hooks
 *   - ./ScopeBadge - Scope 徽章
 */

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  DataTable,
  type DataTableColumn,
} from '@/components/features/common/DataTable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  ToggleLeft,
  ArrowUpDown,
} from 'lucide-react';
import { Link } from '@/i18n/routing';
import { useToast } from '@/hooks/use-toast';
import {
  useDeleteFieldDefinitionSet,
  useToggleFieldDefinitionSet,
  type FieldDefinitionSetItem,
} from '@/hooks/use-field-definition-sets';
import { ScopeBadge } from './ScopeBadge';

// ============================================================
// Types
// ============================================================

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface FieldDefinitionSetListProps {
  data: FieldDefinitionSetItem[];
  pagination?: PaginationInfo;
  isLoading: boolean;
  currentSortBy?: string;
  currentSortOrder?: 'asc' | 'desc';
  onPageChange: (page: number) => void;
  onSortChange: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
}

// ============================================================
// Component
// ============================================================

export function FieldDefinitionSetList({
  data,
  pagination,
  isLoading,
  currentSortBy = 'createdAt',
  currentSortOrder = 'desc',
  onPageChange,
  onSortChange,
}: FieldDefinitionSetListProps) {
  const t = useTranslations('fieldDefinitionSet');
  const tCommon = useTranslations('common');
  const { toast } = useToast();
  const [deleteId, setDeleteId] = React.useState<string | null>(null);

  const deleteMutation = useDeleteFieldDefinitionSet();
  const toggleMutation = useToggleFieldDefinitionSet();

  const handleSort = React.useCallback(
    (column: string) => {
      const isSameColumn = currentSortBy === column;
      const newOrder =
        isSameColumn && currentSortOrder === 'asc' ? 'desc' : 'asc';
      onSortChange(column, newOrder);
    },
    [currentSortBy, currentSortOrder, onSortChange]
  );

  const handleDelete = React.useCallback(
    async (id: string) => {
      try {
        await deleteMutation.mutateAsync(id);
        toast({ title: t('messages.deleted') });
      } catch {
        toast({ variant: 'destructive', title: t('messages.deleteFailed') });
      }
      setDeleteId(null);
    },
    [deleteMutation, toast, t]
  );

  const handleToggle = React.useCallback(
    async (id: string) => {
      try {
        await toggleMutation.mutateAsync(id);
        toast({ title: t('messages.toggled') });
      } catch {
        toast({ variant: 'destructive', title: t('messages.toggleFailed') });
      }
    },
    [toggleMutation, toast, t]
  );

  const SortableHeader = React.useCallback(
    ({ column, children }: { column: string; children: React.ReactNode }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8"
        onClick={() => handleSort(column)}
      >
        {children}
        <ArrowUpDown className="ml-2 h-3 w-3" />
      </Button>
    ),
    [handleSort]
  );

  // --- Column 定義 ---

  const columns = React.useMemo<DataTableColumn<FieldDefinitionSetItem>[]>(
    () => [
      // Name - 可排序 + 跳轉編輯
      {
        id: 'name',
        headerClassName: 'w-[200px]',
        header: <SortableHeader column="name">{t('list.name')}</SortableHeader>,
        cellClassName: 'font-medium',
        cell: (item) => (
          <Link
            href={`/admin/field-definition-sets/${item.id}`}
            className="hover:underline"
          >
            {item.name}
          </Link>
        ),
      },
      // Scope
      {
        id: 'scope',
        headerClassName: 'w-24',
        header: t('list.scope'),
        cell: (item) => <ScopeBadge scope={item.scope} />,
      },
      // Company
      {
        id: 'company',
        headerClassName: 'w-[150px]',
        header: t('list.company'),
        cellClassName: 'text-sm text-muted-foreground',
        cell: (item) => item.companyName ?? '-',
      },
      // Format
      {
        id: 'format',
        headerClassName: 'w-[150px]',
        header: t('list.format'),
        cellClassName: 'text-sm text-muted-foreground',
        cell: (item) => item.documentFormatName ?? '-',
      },
      // Fields Count - 可排序
      {
        id: 'fieldsCount',
        headerClassName: 'w-20 text-center',
        header: (
          <SortableHeader column="fieldsCount">
            {t('list.fieldsCount')}
          </SortableHeader>
        ),
        cellClassName: 'text-center tabular-nums',
        cell: (item) => item.fieldsCount,
      },
      // Version
      {
        id: 'version',
        headerClassName: 'w-20 text-center',
        header: t('list.version'),
        cellClassName: 'text-center tabular-nums',
        cell: (item) => `v${item.version}`,
      },
      // Status
      {
        id: 'status',
        headerClassName: 'w-24',
        header: t('list.status'),
        cell: (item) => (
          <Badge variant={item.isActive ? 'default' : 'secondary'}>
            {item.isActive ? t('filters.active') : t('filters.inactive')}
          </Badge>
        ),
      },
      // Actions
      {
        id: 'actions',
        headerClassName: 'w-20',
        header: t('list.actions'),
        cell: (item) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/admin/field-definition-sets/${item.id}`}>
                  <Pencil className="h-4 w-4 mr-2" />
                  {t('actions.edit')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleToggle(item.id)}>
                <ToggleLeft className="h-4 w-4 mr-2" />
                {t('actions.toggle')}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setDeleteId(item.id)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t('actions.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [t, SortableHeader, handleToggle]
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <DataTable
          data={data}
          columns={columns}
          getRowId={(item) => item.id}
          page={pagination?.page}
          pageSize={pagination?.limit}
          emptyState={t('list.empty')}
        />
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <div className="text-sm text-muted-foreground">
            {t('pagination.showing', {
              from: (pagination.page - 1) * pagination.limit + 1,
              to: Math.min(
                pagination.page * pagination.limit,
                pagination.total
              ),
              total: pagination.total,
            })}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === 1}
              onClick={() => onPageChange(pagination.page - 1)}
            >
              {t('pagination.previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === pagination.totalPages}
              onClick={() => onPageChange(pagination.page + 1)}
            >
              {t('pagination.next')}
            </Button>
          </div>
        </div>
      )}

      {/* Delete confirm dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('actions.delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('messages.confirmDelete')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('actions.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
