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
              placeholder="搜尋規則..."
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
              <SelectValue placeholder="嚴重程度" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="INFO">資訊</SelectItem>
              <SelectItem value="WARNING">警告</SelectItem>
              <SelectItem value="CRITICAL">嚴重</SelectItem>
              <SelectItem value="EMERGENCY">緊急</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={params.isActive === undefined ? 'all' : params.isActive ? 'true' : 'false'}
            onValueChange={(v) =>
              handleFilterChange('isActive', v === 'all' ? undefined : v === 'true' ? 'true' : 'false')
            }
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="狀態" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="true">啟用</SelectItem>
              <SelectItem value="false">停用</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>

          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            新增規則
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
            共 {data.meta.pagination.total} 條規則
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={params.page === 1}
              onClick={() => setParams((prev) => ({ ...prev, page: (prev.page || 1) - 1 }))}
            >
              上一頁
            </Button>
            <span className="text-sm">
              第 {params.page} / {data.meta.pagination.totalPages} 頁
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={params.page === data.meta.pagination.totalPages}
              onClick={() => setParams((prev) => ({ ...prev, page: (prev.page || 1) + 1 }))}
            >
              下一頁
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
            <AlertDialogTitle>確認刪除</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除此警報規則嗎？此操作無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? '刪除中...' : '刪除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
