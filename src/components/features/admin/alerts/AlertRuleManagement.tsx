'use client';

/**
 * @fileoverview 警報規則管理組件
 * @description
 *   整合警報規則的列表、創建、編輯和刪除功能。
 *
 * @module src/components/features/admin/alerts/AlertRuleManagement
 * @since Epic 12 - Story 12-3 (錯誤警報設定)
 */

import * as React from 'react';
import { useTranslations } from 'next-intl';
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
import { AlertRuleTable } from './AlertRuleTable';
import { CreateAlertRuleDialog } from './CreateAlertRuleDialog';
import {
  useAlertRules,
  useToggleAlertRule,
  useDeleteAlertRule,
} from '@/hooks/useAlertRules';
import type { AlertRuleResponse, AlertRuleListParams } from '@/types/alerts';

// ============================================================
// Types
// ============================================================

interface AlertRuleManagementProps {
  /** 額外的 CSS 類名 */
  className?: string;
}

// ============================================================
// Component
// ============================================================

export function AlertRuleManagement({ className }: AlertRuleManagementProps) {
  const t = useTranslations('admin.alerts');
  const tCommon = useTranslations('common');

  // --- State ---
  const [params, setParams] = React.useState<AlertRuleListParams>({
    page: 1,
    limit: 20,
  });
  const [search, setSearch] = React.useState('');
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [ruleToDelete, setRuleToDelete] = React.useState<string | null>(null);
  const [_selectedRule, setSelectedRule] = React.useState<AlertRuleResponse | null>(null);

  // --- Queries & Mutations ---
  const { data, isLoading, refetch } = useAlertRules(params);
  const toggleMutation = useToggleAlertRule();
  const deleteMutation = useDeleteAlertRule();

  // --- Handlers ---
  const handleSearch = () => {
    setParams((prev) => ({ ...prev, search, page: 1 }));
  };

  const handleFilterChange = (key: string, value: string | undefined) => {
    setParams((prev) => ({
      ...prev,
      [key]: value === 'all' ? undefined : value,
      page: 1,
    }));
  };

  const handleToggle = async (id: string) => {
    try {
      await toggleMutation.mutateAsync(id);
    } catch (error) {
      console.error('Toggle error:', error);
    }
  };

  const handleEdit = (rule: AlertRuleResponse) => {
    setSelectedRule(rule);
    // TODO: 實現編輯對話框（將在後續 Story 中實現）
  };

  const handleDeleteClick = (id: string) => {
    setRuleToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (ruleToDelete) {
      try {
        await deleteMutation.mutateAsync(ruleToDelete);
        setDeleteDialogOpen(false);
        setRuleToDelete(null);
      } catch (error) {
        console.error('Delete error:', error);
      }
    }
  };

  const handleCreateSuccess = () => {
    refetch();
  };

  // --- Render ---
  return (
    <div className={className}>
      {/* 工具列 */}
      <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('rules.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-8 w-[200px]"
            />
          </div>
          <Button variant="outline" size="icon" onClick={handleSearch}>
            <Search className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={params.severity || 'all'}
            onValueChange={(v) => handleFilterChange('severity', v)}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder={t('rules.severityPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('rules.filterAll')}</SelectItem>
              <SelectItem value="INFO">{t('severity.INFO')}</SelectItem>
              <SelectItem value="WARNING">{t('severity.WARNING')}</SelectItem>
              <SelectItem value="CRITICAL">{t('severity.CRITICAL')}</SelectItem>
              <SelectItem value="EMERGENCY">{t('severity.EMERGENCY')}</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={params.isActive === undefined ? 'all' : params.isActive ? 'true' : 'false'}
            onValueChange={(v) =>
              handleFilterChange('isActive', v === 'all' ? undefined : v === 'true' ? 'true' : 'false')
            }
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder={t('rules.statusPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('rules.filterAll')}</SelectItem>
              <SelectItem value="true">{t('rules.statusEnabled')}</SelectItem>
              <SelectItem value="false">{t('rules.statusDisabled')}</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>

          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t('rules.create')}
          </Button>
        </div>
      </div>

      {/* 規則表格 */}
      <AlertRuleTable
        rules={data?.data || []}
        isLoading={isLoading}
        onToggle={handleToggle}
        onEdit={handleEdit}
        onDelete={handleDeleteClick}
      />

      {/* 分頁 */}
      {data?.meta?.pagination && data.meta.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            {t('rules.paginationTotal', { total: data.meta.pagination.total })}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={params.page === 1}
              onClick={() => setParams((prev) => ({ ...prev, page: (prev.page || 1) - 1 }))}
            >
              {tCommon('pagination.previous')}
            </Button>
            <span className="text-sm">
              {tCommon('pagination.pageOf', { page: params.page ?? 1, total: data.meta.pagination.totalPages })}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={params.page === data.meta.pagination.totalPages}
              onClick={() => setParams((prev) => ({ ...prev, page: (prev.page || 1) + 1 }))}
            >
              {tCommon('pagination.next')}
            </Button>
          </div>
        </div>
      )}

      {/* 創建對話框 */}
      <CreateAlertRuleDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={handleCreateSuccess}
      />

      {/* 刪除確認對話框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('rules.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('rules.deleteDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? tCommon('actions.deleting') : tCommon('actions.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
