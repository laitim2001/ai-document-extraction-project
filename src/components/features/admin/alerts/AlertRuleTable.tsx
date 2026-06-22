'use client';

/**
 * @fileoverview 警報規則表格組件
 * @description
 *   顯示警報規則列表，支援排序、篩選和操作。
 *
 * @module src/components/features/admin/alerts/AlertRuleTable
 * @since Epic 12 - Story 12-3 (錯誤警報設定)
 * @lastModified 2026-06-21 (CHANGE-087 Phase 2: 遷移共用 DataTable)
 */

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  DataTable,
  type DataTableColumn,
} from '@/components/features/common/DataTable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import type { AlertRuleResponse } from '@/types/alerts';

// ============================================================
// Helper Functions
// ============================================================

function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    INFO: 'bg-blue-100 text-blue-800',
    WARNING: 'bg-yellow-100 text-yellow-800',
    ERROR: 'bg-orange-100 text-orange-800',
    CRITICAL: 'bg-red-100 text-red-800',
    EMERGENCY: 'bg-purple-100 text-purple-800',
  };
  return colors[severity] || 'bg-gray-100 text-gray-800';
}

function getOperatorSymbol(operator: string): string {
  const symbols: Record<string, string> = {
    GREATER_THAN: '>',
    GREATER_THAN_EQ: '≥',
    LESS_THAN: '<',
    LESS_THAN_EQ: '≤',
    EQUALS: '=',
    NOT_EQUALS: '≠',
  };
  return symbols[operator] || operator;
}

// ============================================================
// Types
// ============================================================

interface AlertRuleTableProps {
  /** 規則列表 */
  rules: AlertRuleResponse[];
  /** 是否載入中 */
  isLoading?: boolean;
  /** 切換規則狀態 */
  onToggle: (id: string) => void;
  /** 編輯規則 */
  onEdit: (rule: AlertRuleResponse) => void;
  /** 刪除規則 */
  onDelete: (id: string) => void;
}

// ============================================================
// Component
// ============================================================

/**
 * 警報規則表格組件
 */
export function AlertRuleTable({
  rules,
  isLoading,
  onToggle,
  onEdit,
  onDelete,
}: AlertRuleTableProps) {
  const t = useTranslations('admin.alerts');
  const tCommon = useTranslations('common');

  // --- Column 定義 ---
  const columns = React.useMemo<DataTableColumn<AlertRuleResponse>[]>(() => {
    return [
      // 規則名稱
      {
        id: 'name',
        header: t('rules.table.name'),
        cell: (rule) => (
          <div>
            <p className="font-medium">{rule.name}</p>
            {rule.description && (
              <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                {rule.description}
              </p>
            )}
          </div>
        ),
      },
      // 條件類型
      {
        id: 'conditionType',
        header: t('rules.table.conditionType'),
        cell: (rule) => (
          <span className="text-sm">
            {t.has(`conditionType.${rule.conditionType}`)
              ? t(`conditionType.${rule.conditionType}`)
              : rule.conditionType}
          </span>
        ),
      },
      // 閾值
      {
        id: 'threshold',
        header: t('rules.table.threshold'),
        cell: (rule) => (
          <code className="text-sm bg-muted px-1 py-0.5 rounded">
            {rule.metric} {getOperatorSymbol(rule.operator)} {rule.threshold}
          </code>
        ),
      },
      // 嚴重程度
      {
        id: 'severity',
        header: t('rules.table.severity'),
        cell: (rule) => (
          <Badge className={getSeverityColor(rule.severity)}>
            {t.has(`severity.${rule.severity}`)
              ? t(`severity.${rule.severity}`)
              : rule.severity}
          </Badge>
        ),
      },
      // 通知頻道
      {
        id: 'channels',
        header: t('rules.table.channels'),
        cell: (rule) => (
          <div className="flex gap-1">
            {Array.isArray(rule.channels) &&
              (rule.channels as string[]).map((channel) => (
                <Badge key={channel} variant="outline" className="text-xs">
                  {channel}
                </Badge>
              ))}
          </div>
        ),
      },
      // 狀態
      {
        id: 'status',
        header: t('rules.table.status'),
        cell: (rule) => (
          <Switch
            checked={rule.isActive}
            onCheckedChange={() => onToggle(rule.id)}
          />
        ),
      },
      // 操作
      {
        id: 'actions',
        header: t('rules.table.actions'),
        headerClassName: 'w-[70px]',
        cell: (rule) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(rule)}>
                <Pencil className="mr-2 h-4 w-4" />
                {tCommon('actions.edit')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(rule.id)}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {tCommon('actions.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ];
  }, [onToggle, onEdit, onDelete, t, tCommon]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (rules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <p>{t('rules.emptyTitle')}</p>
        <p className="text-sm">{t('rules.emptyHint')}</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <DataTable data={rules} columns={columns} getRowId={(rule) => rule.id} />
    </div>
  );
}

