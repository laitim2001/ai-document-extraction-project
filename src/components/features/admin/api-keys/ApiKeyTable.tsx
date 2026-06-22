'use client';

/**
 * @fileoverview API Key 資料表格組件
 * @description
 *   顯示 API Key 列表的資料表格，包含：
 *   - Key 名稱和前綴
 *   - 權限設定
 *   - 使用統計
 *   - 狀態和操作
 *
 * @module src/components/features/admin/api-keys/ApiKeyTable
 * @author Development Team
 * @since Epic 11 - Story 11.5 (API 存取控制與認證)
 * @lastModified 2026-06-21 (CHANGE-087 Phase 2: 遷移共用 DataTable)
 *
 * @dependencies
 *   - date-fns - 日期格式化
 *   - @/components/features/common/DataTable - 共用表格封裝（序號欄）
 *   - @/components/ui/* - UI 組件
 *
 * @related
 *   - src/app/api/admin/api-keys/route.ts - API 路由
 */

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { formatDistanceToNow } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import {
  DataTable,
  type DataTableColumn,
} from '@/components/features/common/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Key, RefreshCw, Trash2, Settings, BarChart2 } from 'lucide-react';
import type { ApiKeyResponse } from '@/types/external-api/auth';

// ============================================================
// Types
// ============================================================

interface ApiKeyTableProps {
  /** API Key 列表 */
  apiKeys: ApiKeyResponse[];
  /** 編輯 Key 回調 */
  onEdit?: (keyId: string) => void;
  /** 輪替 Key 回調 */
  onRotate?: (keyId: string) => void;
  /** 刪除 Key 回調 */
  onDelete?: (keyId: string) => void;
  /** 查看統計回調 */
  onViewStats?: (keyId: string) => void;
  /** 是否載入中 */
  isLoading?: boolean;
}

// ============================================================
// Helpers
// ============================================================

/**
 * 獲取狀態徽章樣式
 */
function getStatusVariant(isActive: boolean): 'default' | 'secondary' {
  return isActive ? 'default' : 'secondary';
}

/**
 * 格式化使用量
 */
function formatUsageCount(count: bigint): string {
  const num = Number(count);
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

/**
 * 格式化操作列表
 */
function formatOperations(operations: string[], allLabel: string): string {
  if (operations.includes('*')) return allLabel;
  return operations.join(', ');
}

/**
 * 格式化城市列表
 */
function formatCities(cities: string[], allLabel: string): string {
  if (cities.includes('*')) return allLabel;
  if (cities.length > 3) {
    return `${cities.slice(0, 3).join(', ')} +${cities.length - 3}`;
  }
  return cities.join(', ');
}

// ============================================================
// Component
// ============================================================

/**
 * API Key 資料表格組件
 *
 * @component ApiKeyTable
 * @description 顯示 API Key 列表，支援排序、操作等功能
 */
export function ApiKeyTable({
  apiKeys,
  onEdit,
  onRotate,
  onDelete,
  onViewStats,
  isLoading = false,
}: ApiKeyTableProps) {
  const t = useTranslations('admin.apiKeys.table');

  // --- Column 定義 ---
  const columns = React.useMemo<DataTableColumn<ApiKeyResponse>[]>(() => {
    return [
      // 名稱
      {
        id: 'name',
        header: t('name'),
        headerClassName: 'w-[200px]',
        cell: (apiKey) => (
          <div className="flex flex-col">
            <span className="font-medium">{apiKey.name}</span>
            {apiKey.description && (
              <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                {apiKey.description}
              </span>
            )}
          </div>
        ),
      },
      // Key 前綴
      {
        id: 'keyPrefix',
        header: t('keyPrefix'),
        headerClassName: 'w-[120px]',
        cell: (apiKey) => (
          <code className="bg-muted px-2 py-1 rounded text-xs">
            {apiKey.keyPrefix}...
          </code>
        ),
      },
      // 權限
      {
        id: 'permissions',
        header: t('permissions'),
        cell: (apiKey) => (
          <div className="flex flex-col gap-1">
            <span className="text-xs">
              {t('cities')}: {formatCities(apiKey.allowedCities, t('allCities'))}
            </span>
            <span className="text-xs text-muted-foreground">
              {t('operations')}: {formatOperations(apiKey.allowedOperations, t('allOperations'))}
            </span>
          </div>
        ),
      },
      // 速率限制
      {
        id: 'rateLimit',
        header: t('rateLimit'),
        headerClassName: 'w-[100px]',
        cell: (apiKey) => (
          <span className="text-sm">{apiKey.rateLimit}/min</span>
        ),
      },
      // 使用量
      {
        id: 'usage',
        header: t('usage'),
        headerClassName: 'w-[100px]',
        cell: (apiKey) => (
          <span className="text-sm font-mono">
            {formatUsageCount(apiKey.usageCount)}
          </span>
        ),
      },
      // 最後使用
      {
        id: 'lastUsed',
        header: t('lastUsed'),
        headerClassName: 'w-[120px]',
        cell: (apiKey) =>
          apiKey.lastUsedAt ? (
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(apiKey.lastUsedAt), {
                addSuffix: true,
                locale: zhTW,
              })}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">{t('neverUsed')}</span>
          ),
      },
      // 狀態
      {
        id: 'status',
        header: t('status'),
        headerClassName: 'w-[80px]',
        cell: (apiKey) => (
          <Badge variant={getStatusVariant(apiKey.isActive)}>
            {apiKey.isActive ? t('active') : t('inactive')}
          </Badge>
        ),
      },
      // 操作
      {
        id: 'actions',
        header: null,
        headerClassName: 'w-[60px]',
        cell: (apiKey) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">{t('actionsMenu')}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit?.(apiKey.id)}>
                <Settings className="mr-2 h-4 w-4" />
                {t('editSettings')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onViewStats?.(apiKey.id)}>
                <BarChart2 className="mr-2 h-4 w-4" />
                {t('viewStats')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onRotate?.(apiKey.id)}>
                <RefreshCw className="mr-2 h-4 w-4" />
                {t('rotateKey')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => onDelete?.(apiKey.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t('delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ];
  }, [onEdit, onViewStats, onRotate, onDelete, t]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (apiKeys.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Key className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">{t('emptyTitle')}</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {t('emptyHint')}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <DataTable
        data={apiKeys}
        columns={columns}
        getRowId={(apiKey) => apiKey.id}
      />
    </div>
  );
}
