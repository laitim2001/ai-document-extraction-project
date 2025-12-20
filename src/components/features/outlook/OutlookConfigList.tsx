'use client';

/**
 * @fileoverview Outlook 配置列表元件
 * @description
 *   顯示 Outlook 配置的列表，支援：
 *   - 配置狀態顯示（啟用/停用）
 *   - 連線測試狀態
 *   - 編輯、刪除和過濾規則管理
 *
 * @module src/components/features/outlook/OutlookConfigList
 * @author Development Team
 * @since Epic 9 - Story 9.4 (Outlook 連線設定)
 * @lastModified 2025-12-20
 */

import * as React from 'react';
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
  Mail,
  Filter,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import type { OutlookConfigApiResponse } from '@/types/outlook-config.types';

// ============================================================
// Types
// ============================================================

interface OutlookConfigListProps {
  configs: OutlookConfigApiResponse[];
  isLoading?: boolean;
  onEdit: (config: OutlookConfigApiResponse) => void;
  onDelete: (configId: string) => Promise<void>;
  onToggleActive: (configId: string, isActive: boolean) => Promise<void>;
  onTestConnection: (configId: string) => Promise<void>;
  onManageRules: (config: OutlookConfigApiResponse) => void;
  testingConfigId?: string;
}

// ============================================================
// Component
// ============================================================

/**
 * Outlook 配置列表
 */
export function OutlookConfigList({
  configs,
  isLoading,
  onEdit,
  onDelete,
  onToggleActive,
  onTestConnection,
  onManageRules,
  testingConfigId,
}: OutlookConfigListProps) {
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

  const handleToggleActive = async (configId: string, isActive: boolean) => {
    setTogglingId(configId);
    try {
      await onToggleActive(configId, isActive);
    } finally {
      setTogglingId(null);
    }
  };

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
          <Mail className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">尚未設定任何 Outlook 配置</p>
          <p className="text-sm text-muted-foreground">
            點擊「新增配置」來建立您的第一個 Outlook 連線
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <CardTitle>Outlook 配置</CardTitle>
          <CardDescription>
            管理系統的 Outlook 信箱連線設定
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名稱</TableHead>
                <TableHead>信箱</TableHead>
                <TableHead>城市/類型</TableHead>
                <TableHead>過濾規則</TableHead>
                <TableHead>連線狀態</TableHead>
                <TableHead>啟用</TableHead>
                <TableHead className="w-[100px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {configs.map((config) => (
                <TableRow key={config.id}>
                  <TableCell>
                    <div className="font-medium">{config.name}</div>
                    {config.description && (
                      <div className="text-sm text-muted-foreground">
                        {config.description}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[200px]">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help truncate block">
                            {config.mailboxAddress}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>信箱: {config.mailboxAddress}</p>
                          <p className="text-muted-foreground">
                            資料夾: {config.mailFolders?.join(', ') || 'inbox'}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                  <TableCell>
                    {config.isGlobal ? (
                      <Badge variant="secondary">
                        <Globe className="mr-1 h-3 w-3" />
                        全域
                      </Badge>
                    ) : config.city ? (
                      <Badge variant="outline">
                        <Building2 className="mr-1 h-3 w-3" />
                        {config.city.name}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <RulesCount count={config.filterRules?.length ?? 0} />
                  </TableCell>
                  <TableCell>
                    <ConnectionStatus
                      lastTestedAt={config.lastTestedAt}
                      lastTestResult={config.lastTestResult}
                      isTesting={testingConfigId === config.id}
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={config.isActive}
                      onCheckedChange={(checked) =>
                        handleToggleActive(config.id, checked)
                      }
                      disabled={togglingId === config.id}
                    />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">操作選單</span>
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
                          測試連線
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onManageRules(config)}>
                          <Filter className="mr-2 h-4 w-4" />
                          管理過濾規則
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onEdit(config)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          編輯
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeletingId(config.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          刪除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 刪除確認對話框 */}
      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確定要刪除此配置？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作無法復原。刪除後，系統將無法使用此 Outlook 配置獲取郵件。
              相關的過濾規則也會一併刪除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              刪除
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
  lastTestedAt: Date | string | null;
  lastTestResult: boolean | null;
  isTesting: boolean;
}

function ConnectionStatus({
  lastTestedAt,
  lastTestResult,
  isTesting,
}: ConnectionStatusProps) {
  if (isTesting) {
    return (
      <div className="flex items-center text-muted-foreground">
        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
        測試中...
      </div>
    );
  }

  if (lastTestResult === null) {
    return <span className="text-muted-foreground">未測試</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center cursor-help">
          {lastTestResult ? (
            <>
              <CheckCircle2 className="mr-1 h-4 w-4 text-green-600" />
              <span className="text-green-600">正常</span>
            </>
          ) : (
            <>
              <XCircle className="mr-1 h-4 w-4 text-red-600" />
              <span className="text-red-600">失敗</span>
            </>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>
          最後測試時間:{' '}
          {lastTestedAt
            ? new Date(lastTestedAt).toLocaleString('zh-TW')
            : '未知'}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

interface RulesCountProps {
  count: number;
}

function RulesCount({ count }: RulesCountProps) {
  if (count === 0) {
    return <span className="text-muted-foreground">無規則</span>;
  }

  return (
    <Badge variant="outline">
      <Filter className="mr-1 h-3 w-3" />
      {count} 條規則
    </Badge>
  );
}
