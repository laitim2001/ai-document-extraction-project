/**
 * @fileoverview 數據模版卡片組件
 * @description
 *   顯示單個數據模版的摘要資訊，支援編輯和刪除操作
 *
 * @module src/components/features/data-template/DataTemplateCard
 * @since Epic 16 - Story 16.7
 * @lastModified 2026-01-13
 */

'use client';

import * as React from 'react';
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  FileCode,
  Globe,
  Building2,
  Lock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { DataTemplateSummary } from '@/types/data-template';

// ============================================================================
// Types
// ============================================================================

export interface DataTemplateCardProps {
  /** 模版資料 */
  template: DataTemplateSummary;
  /** 編輯回調 */
  onEdit?: (id: string) => void;
  /** 刪除回調 */
  onDelete?: (id: string, name: string) => void;
  /** 額外的 className */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function DataTemplateCard({
  template,
  onEdit,
  onDelete,
  className,
}: DataTemplateCardProps) {
  // --- Derived State ---
  const isSystem = template.isSystem;
  const isInUse = template.usageCount > 0;
  const canDelete = !isSystem && !isInUse;

  // --- Render ---
  return (
    <Card
      className={cn(
        'relative transition-colors hover:border-primary/50',
        !template.isActive && 'opacity-60',
        className
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileCode className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <CardTitle className="text-base font-medium truncate">
              {template.name}
            </CardTitle>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* 範圍 Badge */}
            {template.scope === 'GLOBAL' ? (
              <Badge variant="secondary" className="gap-1">
                <Globe className="h-3 w-3" />
                全局
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1">
                <Building2 className="h-3 w-3" />
                {template.companyName || '公司'}
              </Badge>
            )}

            {/* 系統模版 Badge */}
            {isSystem && (
              <Badge variant="default" className="gap-1">
                <Lock className="h-3 w-3" />
                系統
              </Badge>
            )}

            {/* 狀態 Badge */}
            {!template.isActive && (
              <Badge variant="destructive">停用</Badge>
            )}

            {/* 操作選單 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => onEdit?.(template.id)}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  {isSystem ? '查看詳情' : '編輯'}
                </DropdownMenuItem>
                {canDelete && (
                  <DropdownMenuItem
                    onClick={() => onDelete?.(template.id, template.name)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    刪除
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* 說明 */}
        {template.description && (
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
            {template.description}
          </p>
        )}

        {/* 統計資訊 */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">{template.fieldCount}</span>{' '}
            個欄位
          </span>
          <span>
            <span className="font-medium text-foreground">{template.usageCount}</span>{' '}
            個配置使用
          </span>
        </div>

        {/* 更新時間 */}
        <div className="mt-2 text-xs text-muted-foreground">
          更新於 {new Date(template.updatedAt).toLocaleDateString('zh-TW')}
        </div>
      </CardContent>
    </Card>
  );
}
