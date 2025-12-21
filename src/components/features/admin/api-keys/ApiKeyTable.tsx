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
 * @lastModified 2025-12-21
 *
 * @dependencies
 *   - date-fns - 日期格式化
 *   - @/components/ui/* - UI 組件
 *
 * @related
 *   - src/app/api/admin/api-keys/route.ts - API 路由
 */

import { formatDistanceToNow } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
function formatOperations(operations: string[]): string {
  if (operations.includes('*')) return '全部';
  return operations.join(', ');
}

/**
 * 格式化城市列表
 */
function formatCities(cities: string[]): string {
  if (cities.includes('*')) return '全部城市';
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
        <h3 className="text-lg font-medium">尚無 API Key</h3>
        <p className="text-sm text-muted-foreground mt-1">
          建立第一個 API Key 以開始使用外部 API
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">名稱</TableHead>
            <TableHead className="w-[120px]">Key 前綴</TableHead>
            <TableHead>權限</TableHead>
            <TableHead className="w-[100px]">速率限制</TableHead>
            <TableHead className="w-[100px]">使用量</TableHead>
            <TableHead className="w-[120px]">最後使用</TableHead>
            <TableHead className="w-[80px]">狀態</TableHead>
            <TableHead className="w-[60px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {apiKeys.map((apiKey) => (
            <TableRow key={apiKey.id}>
              {/* 名稱 */}
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{apiKey.name}</span>
                  {apiKey.description && (
                    <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                      {apiKey.description}
                    </span>
                  )}
                </div>
              </TableCell>

              {/* Key 前綴 */}
              <TableCell>
                <code className="bg-muted px-2 py-1 rounded text-xs">
                  {apiKey.keyPrefix}...
                </code>
              </TableCell>

              {/* 權限 */}
              <TableCell>
                <div className="flex flex-col gap-1">
                  <span className="text-xs">
                    城市: {formatCities(apiKey.allowedCities)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    操作: {formatOperations(apiKey.allowedOperations)}
                  </span>
                </div>
              </TableCell>

              {/* 速率限制 */}
              <TableCell>
                <span className="text-sm">{apiKey.rateLimit}/min</span>
              </TableCell>

              {/* 使用量 */}
              <TableCell>
                <span className="text-sm font-mono">
                  {formatUsageCount(apiKey.usageCount)}
                </span>
              </TableCell>

              {/* 最後使用 */}
              <TableCell>
                {apiKey.lastUsedAt ? (
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(apiKey.lastUsedAt), {
                      addSuffix: true,
                      locale: zhTW,
                    })}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">從未使用</span>
                )}
              </TableCell>

              {/* 狀態 */}
              <TableCell>
                <Badge variant={getStatusVariant(apiKey.isActive)}>
                  {apiKey.isActive ? '啟用' : '停用'}
                </Badge>
              </TableCell>

              {/* 操作 */}
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">操作選單</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit?.(apiKey.id)}>
                      <Settings className="mr-2 h-4 w-4" />
                      編輯設定
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onViewStats?.(apiKey.id)}>
                      <BarChart2 className="mr-2 h-4 w-4" />
                      查看統計
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onRotate?.(apiKey.id)}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      輪替 Key
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => onDelete?.(apiKey.id)}
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
    </div>
  );
}
