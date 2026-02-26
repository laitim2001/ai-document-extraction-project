/**
 * @fileoverview Prompt 配置管理列表頁
 * @description
 *   Prompt 配置的管理介面入口：
 *   - 按類型分組顯示所有配置
 *   - 支援篩選（類型、範圍、狀態、搜尋）
 *   - 提供新增、編輯、刪除功能
 *
 * @module src/app/(dashboard)/admin/prompt-configs
 * @since Epic 14 - Story 14.2
 * @lastModified 2026-01-02
 */

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus, RefreshCw, AlertCircle, Settings2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { useToast } from '@/hooks/use-toast';
import {
  PromptConfigList,
  PromptConfigFilters,
} from '@/components/features/prompt-config';
import {
  usePromptConfigs,
  useDeletePromptConfig,
} from '@/hooks/use-prompt-configs';
import type { PromptConfigFiltersState } from '@/types/prompt-config-ui';
import type { GetPromptConfigsParams } from '@/types/prompt-config';

// ============================================================================
// Page Component
// ============================================================================

export default function PromptConfigsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const t = useTranslations('promptConfig');

  // --- State ---
  const [filters, setFilters] = React.useState<PromptConfigFiltersState>({});
  const [deleteTarget, setDeleteTarget] = React.useState<{
    id: string;
    name: string;
  } | null>(null);

  // --- Build Query Params ---
  const queryParams: GetPromptConfigsParams = React.useMemo(() => {
    const params: GetPromptConfigsParams = {
      limit: 100,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    };

    if (filters.promptType) params.promptType = filters.promptType;
    if (filters.scope) params.scope = filters.scope;
    if (filters.isActive !== undefined) params.isActive = filters.isActive;
    if (filters.search) params.search = filters.search;

    return params;
  }, [filters]);

  // --- Queries ---
  const {
    data: configsData,
    isLoading,
    error,
    refetch,
  } = usePromptConfigs(queryParams);

  const deleteMutation = useDeletePromptConfig();

  // --- Derived State ---
  const configs = configsData?.data ?? [];
  const totalCount = configsData?.meta?.pagination?.total ?? configs.length;

  // --- Handlers ---

  const handleCreateNew = React.useCallback(() => {
    router.push('/admin/prompt-configs/new');
  }, [router]);

  const handleEdit = React.useCallback(
    (id: string) => {
      router.push(`/admin/prompt-configs/${id}`);
    },
    [router]
  );

  const handleDeleteRequest = React.useCallback(
    (id: string, name: string) => {
      setDeleteTarget({ id, name });
    },
    []
  );

  const handleDeleteConfirm = React.useCallback(async () => {
    if (!deleteTarget) return;

    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast({
        title: t('page.toast.deleteSuccess'),
        description: t('page.toast.deleteSuccessDesc', { name: deleteTarget.name }),
      });
      setDeleteTarget(null);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: t('page.toast.deleteFailed'),
        description: err instanceof Error ? err.message : t('page.unknownError'),
      });
    }
  }, [deleteTarget, deleteMutation, toast, t]);

  const handleRefresh = React.useCallback(() => {
    refetch();
  }, [refetch]);

  // --- Render ---

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Settings2 className="h-6 w-6" />
            {t('page.title')}
          </h1>
          <p className="text-muted-foreground">
            {t('page.description')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleRefresh} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('page.refresh')}
          </Button>
          <Button onClick={handleCreateNew}>
            <Plus className="h-4 w-4 mr-2" />
            {t('page.addConfig')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">{t('page.filterTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <PromptConfigFilters
            filters={filters}
            onFiltersChange={setFilters}
          />
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {t('page.loadError')}
            {error instanceof Error ? error.message : t('page.unknownError')}
          </AlertDescription>
        </Alert>
      )}

      {/* Summary */}
      <div className="text-sm text-muted-foreground">
        {t('page.totalConfigs', { count: totalCount })}
      </div>

      {/* Config List */}
      <PromptConfigList
        configs={configs}
        isLoading={isLoading}
        error={error ?? undefined}
        onEdit={handleEdit}
        onDelete={handleDeleteRequest}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('page.deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('page.deleteDialog.message', { name: deleteTarget?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('page.deleteDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? t('page.deleteDialog.deleting') : t('page.deleteDialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
