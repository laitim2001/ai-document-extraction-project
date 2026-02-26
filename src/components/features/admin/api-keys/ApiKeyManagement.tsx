'use client';

/**
 * @fileoverview API Key 管理主組件
 * @description
 *   API Key 管理的主要容器組件，整合：
 *   - 搜尋和篩選
 *   - 列表顯示
 *   - 創建、編輯、刪除操作
 *
 * @module src/components/features/admin/api-keys/ApiKeyManagement
 * @author Development Team
 * @since Epic 11 - Story 11.5 (API 存取控制與認證)
 * @lastModified 2025-12-21
 *
 * @dependencies
 *   - react-query - 數據獲取
 *   - @/components/ui/* - UI 組件
 */

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Plus, Search, RefreshCw } from 'lucide-react';
import { ApiKeyTable } from './ApiKeyTable';
import { CreateApiKeyDialog } from './CreateApiKeyDialog';
import type { ApiKeyResponse } from '@/types/external-api/auth';

// ============================================================
// Types
// ============================================================

interface ApiKeyListResponse {
  success: boolean;
  data: ApiKeyResponse[];
  meta: {
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

interface ApiKeyManagementProps {
  /** 可用城市列表 */
  availableCities?: { code: string; name: string }[];
}

// ============================================================
// Hooks
// ============================================================

function useApiKeys(params: {
  page: number;
  limit: number;
  search: string;
  isActive: string;
}) {
  return useQuery<ApiKeyListResponse>({
    queryKey: ['api-keys', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams({
        page: params.page.toString(),
        limit: params.limit.toString(),
        ...(params.search && { search: params.search }),
        ...(params.isActive !== 'all' && { isActive: params.isActive }),
      });

      const response = await fetch(`/api/admin/api-keys?${searchParams}`);
      if (!response.ok) {
        throw new Error('Failed to fetch API keys');
      }
      return response.json();
    },
  });
}

function useDeleteApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (keyId: string) => {
      const response = await fetch(`/api/admin/api-keys/${keyId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete API key');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });
}

function useRotateApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (keyId: string) => {
      const response = await fetch(`/api/admin/api-keys/${keyId}/rotate`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to rotate API key');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });
}

// ============================================================
// Component
// ============================================================

/**
 * API Key 管理主組件
 *
 * @component ApiKeyManagement
 * @description 提供完整的 API Key 管理界面
 */
export function ApiKeyManagement({ availableCities = [] }: ApiKeyManagementProps) {
  const t = useTranslations('admin');

  // --- State ---
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState('');
  const [isActive, setIsActive] = React.useState('all');
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [rotateDialogOpen, setRotateDialogOpen] = React.useState(false);
  const [selectedKeyId, setSelectedKeyId] = React.useState<string | null>(null);
  const [rotatedKey, setRotatedKey] = React.useState<string | null>(null);

  // --- Queries & Mutations ---
  const queryClient = useQueryClient();
  const { data, isLoading, refetch } = useApiKeys({
    page,
    limit: 20,
    search,
    isActive,
  });
  const deleteApiKey = useDeleteApiKey();
  const rotateApiKey = useRotateApiKey();

  // --- Handlers ---
  const handleSearch = React.useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPage(1);
    refetch();
  }, [refetch]);

  const handleDelete = (keyId: string) => {
    setSelectedKeyId(keyId);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (selectedKeyId) {
      await deleteApiKey.mutateAsync(selectedKeyId);
      setDeleteDialogOpen(false);
      setSelectedKeyId(null);
    }
  };

  const handleRotate = (keyId: string) => {
    setSelectedKeyId(keyId);
    setRotateDialogOpen(true);
  };

  const handleConfirmRotate = async () => {
    if (selectedKeyId) {
      const result = await rotateApiKey.mutateAsync(selectedKeyId);
      setRotatedKey(result.data.rawKey);
    }
  };

  const handleCloseRotateDialog = () => {
    setRotateDialogOpen(false);
    setSelectedKeyId(null);
    setRotatedKey(null);
  };

  const handleViewStats = (keyId: string) => {
    // 可以導航到統計頁面或開啟統計對話框
    window.open(`/admin/api-keys/${keyId}/stats`, '_blank');
  };

  const handleCreateSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['api-keys'] });
  };

  // --- Render ---
  return (
    <div className="space-y-6">
      {/* 標題和操作 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t('apiKeys.title')}</h2>
          <p className="text-muted-foreground">
            {t('apiKeys.description')}
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('apiKeys.actions.create')}
        </Button>
      </div>

      {/* 搜尋和篩選 */}
      <div className="flex items-center gap-4">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('apiKeys.search.placeholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button type="submit" variant="secondary">
            {t('apiKeys.search.button')}
          </Button>
        </form>

        <Select value={isActive} onValueChange={setIsActive}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder={t('apiKeys.filters.status.placeholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('apiKeys.filters.status.all')}</SelectItem>
            <SelectItem value="true">{t('apiKeys.filters.status.active')}</SelectItem>
            <SelectItem value="false">{t('apiKeys.filters.status.inactive')}</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" size="icon" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* 表格 */}
      <ApiKeyTable
        apiKeys={data?.data ?? []}
        isLoading={isLoading}
        onEdit={(_keyId) => {
          // TODO: 實現編輯功能 - 需要 EditApiKeyDialog 組件
        }}
        onRotate={handleRotate}
        onDelete={handleDelete}
        onViewStats={handleViewStats}
      />

      {/* 分頁 */}
      {data?.meta?.pagination && data.meta.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t('apiKeys.pagination.total', { total: data.meta.pagination.total })}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              {t('apiKeys.pagination.previous')}
            </Button>
            <span className="text-sm">
              {t('apiKeys.pagination.pageInfo', { page, totalPages: data.meta.pagination.totalPages })}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page === data.meta.pagination.totalPages}
              onClick={() => setPage(page + 1)}
            >
              {t('apiKeys.pagination.next')}
            </Button>
          </div>
        </div>
      )}

      {/* 創建對話框 */}
      <CreateApiKeyDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={handleCreateSuccess}
        availableCities={availableCities}
      />

      {/* 刪除確認對話框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('apiKeys.deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('apiKeys.deleteDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('apiKeys.deleteDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteApiKey.isPending ? t('apiKeys.deleteDialog.deleting') : t('apiKeys.deleteDialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 輪替確認對話框 */}
      <AlertDialog open={rotateDialogOpen} onOpenChange={handleCloseRotateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {rotatedKey ? t('apiKeys.rotateDialog.successTitle') : t('apiKeys.rotateDialog.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {rotatedKey ? (
                <div className="space-y-4">
                  <p>{t('apiKeys.rotateDialog.successDescription')}</p>
                  <div className="p-3 bg-muted rounded-lg">
                    <code className="break-all text-sm">{rotatedKey}</code>
                  </div>
                </div>
              ) : (
                t('apiKeys.rotateDialog.description')
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {rotatedKey ? (
              <AlertDialogAction onClick={handleCloseRotateDialog}>
                {t('apiKeys.rotateDialog.saved')}
              </AlertDialogAction>
            ) : (
              <>
                <AlertDialogCancel>{t('apiKeys.rotateDialog.cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmRotate}>
                  {rotateApiKey.isPending ? t('apiKeys.rotateDialog.rotating') : t('apiKeys.rotateDialog.confirm')}
                </AlertDialogAction>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
