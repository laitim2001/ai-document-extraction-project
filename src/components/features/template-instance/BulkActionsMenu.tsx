'use client';

/**
 * @fileoverview 批量操作選單組件
 * @description
 *   提供批量操作功能，包括：
 *   - 批量刪除
 *   - 批量重新驗證
 *
 * @module src/components/features/template-instance/BulkActionsMenu
 * @since Epic 19 - Story 19.5
 * @lastModified 2026-01-22
 */

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Trash2, RefreshCw, ChevronDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { useBulkDeleteRows, useValidateAllRows } from '@/hooks/use-template-instances';
import { toast } from 'sonner';

// ============================================================================
// Types
// ============================================================================

interface BulkActionsMenuProps {
  instanceId: string;
  selectedIds: string[];
  onComplete?: () => void;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * 批量操作選單組件
 */
export function BulkActionsMenu({
  instanceId,
  selectedIds,
  onComplete,
  className,
}: BulkActionsMenuProps) {
  const t = useTranslations('templateInstance');
  const tCommon = useTranslations('common');

  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  const bulkDeleteMutation = useBulkDeleteRows(instanceId);
  const validateAllMutation = useValidateAllRows(instanceId);

  const count = selectedIds.length;
  const isDeleting = bulkDeleteMutation.isPending;
  const isValidating = validateAllMutation.isPending;
  const isAnyPending = isDeleting || isValidating;

  // --- Handlers ---
  const handleDelete = React.useCallback(() => {
    bulkDeleteMutation.mutate(selectedIds, {
      onSuccess: () => {
        toast.success(t('toast.bulkDeleteSuccess', { count }));
        setShowDeleteConfirm(false);
        onComplete?.();
      },
      onError: (error) => {
        toast.error(t('toast.bulkDeleteError'), {
          description: error.message,
        });
      },
    });
  }, [bulkDeleteMutation, selectedIds, count, t, onComplete]);

  const handleRevalidate = React.useCallback(() => {
    validateAllMutation.mutate(undefined, {
      onSuccess: (result) => {
        toast.success(t('toast.revalidateSuccess'), {
          description: `${result.valid} valid, ${result.invalid} invalid`,
        });
        onComplete?.();
      },
      onError: (error) => {
        toast.error(t('toast.revalidateError'), {
          description: error.message,
        });
      },
    });
  }, [validateAllMutation, t, onComplete]);

  return (
    <>
      <div className={`flex items-center gap-2 ${className ?? ''}`}>
        <span className="text-sm text-muted-foreground">
          {t('bulkActions.selected', { count })}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={isAnyPending}>
              {isAnyPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('bulkActions.title')}
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleRevalidate} disabled={isValidating}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {isValidating ? t('bulkActions.revalidating') : t('bulkActions.revalidate')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeleting}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t('bulkActions.delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('bulkActions.confirmDelete', { count })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('bulkActions.deleteWarning')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {tCommon('actions.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isDeleting ? t('bulkActions.deleting') : tCommon('actions.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
