/**
 * @fileoverview 數據模版管理列表頁
 * @description
 *   數據模版的管理介面入口：
 *   - 顯示所有模版（網格列表）
 *   - 支援篩選（範圍、狀態、類型、搜尋）
 *   - 提供新增、編輯、刪除功能
 *
 * @module src/app/(dashboard)/admin/data-templates
 * @since Epic 16 - Story 16.7
 * @lastModified 2026-01-13
 */

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, RefreshCw, AlertCircle, FileCode } from 'lucide-react';
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
  DataTemplateList,
  DataTemplateFilters,
} from '@/components/features/data-template';
import {
  useDataTemplates,
  useDeleteDataTemplate,
} from '@/hooks/use-data-templates';
import type { DataTemplateFilters as Filters } from '@/types/data-template';

// ============================================================================
// Page Component
// ============================================================================

export default function DataTemplatesPage() {
  const router = useRouter();
  const { toast } = useToast();

  // --- State ---
  const [filters, setFilters] = React.useState<Filters>({});
  const [page, setPage] = React.useState(1);
  const [deleteTarget, setDeleteTarget] = React.useState<{
    id: string;
    name: string;
  } | null>(null);

  // --- Queries ---
  const {
    data: templatesData,
    isLoading,
    error,
    refetch,
  } = useDataTemplates(filters, page, 20);

  const deleteMutation = useDeleteDataTemplate();

  // --- Derived State ---
  const templates = templatesData?.templates ?? [];
  const totalCount = templatesData?.pagination?.total ?? 0;

  // --- Handlers ---

  const handleCreateNew = React.useCallback(() => {
    router.push('/admin/data-templates/new');
  }, [router]);

  const handleEdit = React.useCallback(
    (id: string) => {
      router.push(`/admin/data-templates/${id}`);
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
        title: '刪除成功',
        description: `已刪除模版「${deleteTarget.name}」`,
      });
      setDeleteTarget(null);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: '刪除失敗',
        description: err instanceof Error ? err.message : '未知錯誤',
      });
    }
  }, [deleteTarget, deleteMutation, toast]);

  const handleRefresh = React.useCallback(() => {
    refetch();
  }, [refetch]);

  const handleFiltersChange = React.useCallback((newFilters: Filters) => {
    setFilters(newFilters);
    setPage(1); // 重置頁碼
  }, []);

  // --- Render ---
  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileCode className="h-6 w-6" />
            數據模版管理
          </h1>
          <p className="text-muted-foreground">
            管理目標欄位結構模版，用於欄位映射配置
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleRefresh} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            重新整理
          </Button>
          <Button onClick={handleCreateNew}>
            <Plus className="h-4 w-4 mr-2" />
            新增模版
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">篩選條件</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTemplateFilters
            filters={filters}
            onFiltersChange={handleFiltersChange}
          />
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            載入模版資料時發生錯誤：
            {error instanceof Error ? error.message : '未知錯誤'}
          </AlertDescription>
        </Alert>
      )}

      {/* Summary */}
      <div className="text-sm text-muted-foreground">
        共 {totalCount} 個模版
      </div>

      {/* Template List */}
      <DataTemplateList
        templates={templates}
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
            <AlertDialogTitle>確認刪除模版</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除模版「{deleteTarget?.name}」嗎？此操作會將模版設為停用狀態。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? '刪除中...' : '確認刪除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
