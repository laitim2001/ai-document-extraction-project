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
 * @lastModified 2026-02-23
 *
 * @dependencies
 *   - next-intl - 國際化
 *   - @/components/ui/table - 表格基礎組件
 *   - @/hooks/use-field-definition-sets - React Query hooks
 *   - ./ScopeBadge - Scope 徽章
 */

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  const SortableHeader = ({
    column,
    children,
  }: {
    column: string;
    children: React.ReactNode;
  }) => (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8"
      onClick={() => handleSort(column)}
    >
      {children}
      <ArrowUpDown className="ml-2 h-3 w-3" />
    </Button>
  );

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">
                <SortableHeader column="name">
                  {t('list.name')}
                </SortableHeader>
              </TableHead>
              <TableHead className="w-24">{t('list.scope')}</TableHead>
              <TableHead className="w-[150px]">{t('list.company')}</TableHead>
              <TableHead className="w-[150px]">{t('list.format')}</TableHead>
              <TableHead className="w-20 text-center">
                <SortableHeader column="fieldsCount">
                  {t('list.fieldsCount')}
                </SortableHeader>
              </TableHead>
              <TableHead className="w-20 text-center">
                {t('list.version')}
              </TableHead>
              <TableHead className="w-24">{t('list.status')}</TableHead>
              <TableHead className="w-20">{t('list.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  {t('list.empty')}
                </TableCell>
              </TableRow>
            ) : (
              data.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/admin/field-definition-sets/${item.id}`}
                      className="hover:underline"
                    >
                      {item.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <ScopeBadge scope={item.scope} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {item.companyName ?? '-'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {item.documentFormatName ?? '-'}
                  </TableCell>
                  <TableCell className="text-center tabular-nums">
                    {item.fieldsCount}
                  </TableCell>
                  <TableCell className="text-center tabular-nums">
                    v{item.version}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={item.isActive ? 'default' : 'secondary'}
                    >
                      {item.isActive
                        ? t('filters.active')
                        : t('filters.inactive')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link
                            href={`/admin/field-definition-sets/${item.id}`}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            {t('actions.edit')}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleToggle(item.id)}
                        >
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
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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
