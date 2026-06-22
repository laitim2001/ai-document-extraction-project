'use client';

/**
 * @fileoverview SharePoint 配置列表元件
 * @description
 *   顯示 SharePoint 配置的列表，支援：
 *   - 配置狀態顯示（啟用/停用）
 *   - 連線測試狀態
 *   - 編輯和刪除操作
 *
 * @module src/components/features/sharepoint/SharePointConfigList
 * @author Development Team
 * @since Epic 9 - Story 9.2 (SharePoint 連線配置)
 * @lastModified 2026-06-21 (CHANGE-087 Phase 2: 遷移共用 DataTable)
 */

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
  TestTube,
  CheckCircle2,
  XCircle,
  Globe,
  Building2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DataTable,
  type DataTableColumn,
} from '@/components/features/common/DataTable';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import type { SharePointConfigListItem } from '@/types/sharepoint';

// ============================================================
// Types
// ============================================================

interface SharePointConfigListProps {
  configs: SharePointConfigListItem[];
  isLoading?: boolean;
  onEdit: (config: SharePointConfigListItem) => void;
  onDelete: (configId: string) => Promise<void>;
  onToggleActive: (configId: string, isActive: boolean) => Promise<void>;
  onTestConnection: (configId: string) => Promise<void>;
  testingConfigId?: string;
}

// ============================================================
// Component
// ============================================================

/**
 * SharePoint 配置列表
 */
export function SharePointConfigList({
  configs,
  isLoading,
  onEdit,
  onDelete,
  onToggleActive,
  onTestConnection,
  testingConfigId,
}: SharePointConfigListProps) {
  const t = useTranslations('integrations');
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [togglingId, setTogglingId] = React.useState<string | null>(null);

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await onDelete(deletingId);
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleActive = React.useCallback(
    async (configId: string, isActive: boolean) => {
      setTogglingId(configId);
      try {
        await onToggleActive(configId, isActive);
      } finally {
        setTogglingId(null);
      }
    },
    [onToggleActive]
  );

  // --- Column 定義 ---

  const columns = React.useMemo<DataTableColumn<SharePointConfigListItem>[]>(
    () => [
      // 名稱
      {
        id: 'name',
        header: t('sharepoint.list.columns.name'),
        cell: (config) => (
          <>
            <div className="font-medium">{config.name}</div>
            {config.description && (
              <div className="text-sm text-muted-foreground">
                {config.description}
              </div>
            )}
          </>
        ),
      },
      // 站點 URL
      {
        id: 'siteUrl',
        header: t('sharepoint.list.columns.siteUrl'),
        cell: (config) => (
          <div className="max-w-[200px] truncate">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help">{config.siteUrl}</span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{config.siteUrl}</p>
                <p className="text-muted-foreground">
                  {t('sharepoint.list.libraryTooltip', { path: config.libraryPath })}
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
        ),
      },
      // 城市/類型
      {
        id: 'cityType',
        header: t('sharepoint.list.columns.cityType'),
        cell: (config) =>
          config.isGlobal ? (
            <Badge variant="secondary">
              <Globe className="mr-1 h-3 w-3" />
              {t('sharepoint.list.global')}
            </Badge>
          ) : config.city ? (
            <Badge variant="outline">
              <Building2 className="mr-1 h-3 w-3" />
              {config.city.name}
            </Badge>
          ) : (
            <span className="text-muted-foreground">-</span>
          ),
      },
      // 連線狀態
      {
        id: 'connectionStatus',
        header: t('sharepoint.list.columns.connectionStatus'),
        cell: (config) => (
          <ConnectionStatus
            lastTestedAt={config.lastTestedAt}
            lastTestResult={config.lastTestResult}
            isTesting={testingConfigId === config.id}
          />
        ),
      },
      // 啟用
      {
        id: 'active',
        header: t('sharepoint.list.columns.active'),
        cell: (config) => (
          <Switch
            checked={config.isActive}
            onCheckedChange={(checked) =>
              handleToggleActive(config.id, checked)
            }
            disabled={togglingId === config.id}
          />
        ),
      },
      // 操作
      {
        id: 'actions',
        headerClassName: 'w-[100px]',
        header: t('sharepoint.list.columns.actions'),
        cell: (config) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">{t('sharepoint.list.actionsMenu')}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => onTestConnection(config.id)}
                disabled={testingConfigId === config.id}
              >
                {testingConfigId === config.id ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <TestTube className="mr-2 h-4 w-4" />
                )}
                {t('sharepoint.list.testConnection')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(config)}>
                <Pencil className="mr-2 h-4 w-4" />
                {t('sharepoint.list.edit')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setDeletingId(config.id)}
                className="text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t('sharepoint.list.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [t, testingConfigId, togglingId, handleToggleActive, onTestConnection, onEdit]
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (configs.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{t('sharepoint.list.empty.title')}</p>
          <p className="text-sm text-muted-foreground">
            {t('sharepoint.list.empty.hint')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <CardTitle>{t('sharepoint.list.cardTitle')}</CardTitle>
          <CardDescription>
            {t('sharepoint.list.cardDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            data={configs}
            columns={columns}
            getRowId={(config) => config.id}
          />
        </CardContent>
      </Card>

      {/* 刪除確認對話框 */}
      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('sharepoint.list.deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('sharepoint.list.deleteDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('sharepoint.list.deleteDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              {t('sharepoint.list.deleteDialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}

// ============================================================
// Helper Components
// ============================================================

interface ConnectionStatusProps {
  lastTestedAt: Date | null;
  lastTestResult: boolean | null;
  isTesting: boolean;
}

function ConnectionStatus({
  lastTestedAt,
  lastTestResult,
  isTesting,
}: ConnectionStatusProps) {
  const t = useTranslations('integrations');

  if (isTesting) {
    return (
      <div className="flex items-center text-muted-foreground">
        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
        {t('sharepoint.list.connectionStatus.testing')}
      </div>
    );
  }

  if (lastTestResult === null) {
    return <span className="text-muted-foreground">{t('sharepoint.list.connectionStatus.untested')}</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center cursor-help">
          {lastTestResult ? (
            <>
              <CheckCircle2 className="mr-1 h-4 w-4 text-green-600" />
              <span className="text-green-600">{t('sharepoint.list.connectionStatus.normal')}</span>
            </>
          ) : (
            <>
              <XCircle className="mr-1 h-4 w-4 text-red-600" />
              <span className="text-red-600">{t('sharepoint.list.connectionStatus.failed')}</span>
            </>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>
          {t('sharepoint.list.connectionStatus.lastTestedAt', {
            time: lastTestedAt
              ? new Date(lastTestedAt).toLocaleString('zh-TW')
              : t('sharepoint.list.connectionStatus.unknown'),
          })}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
