/**
 * @fileoverview 數據模版卡片組件（國際化版本）
 * @description
 *   顯示單個數據模版的摘要資訊，支援編輯和刪除操作
 *   - i18n 國際化支援 (Epic 17)
 *
 * @module src/components/features/data-template/DataTemplateCard
 * @since Epic 16 - Story 16.7
 * @lastModified 2026-01-20
 */

'use client';

import * as React from 'react';
import { useTranslations, useLocale } from 'next-intl';
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
import { formatShortDate } from '@/lib/i18n-date';
import type { DataTemplateSummary } from '@/types/data-template';
import type { Locale } from '@/i18n/config';

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
  const t = useTranslations('dataTemplates');
  const locale = useLocale() as Locale;

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
                {t('card.global')}
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1">
                <Building2 className="h-3 w-3" />
                {template.companyName || t('card.company')}
              </Badge>
            )}

            {/* 系統模版 Badge */}
            {isSystem && (
              <Badge variant="default" className="gap-1">
                <Lock className="h-3 w-3" />
                {t('card.system')}
              </Badge>
            )}

            {/* 狀態 Badge */}
            {!template.isActive && (
              <Badge variant="destructive">{t('card.inactive')}</Badge>
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
                  {isSystem ? t('card.viewDetails') : t('card.edit')}
                </DropdownMenuItem>
                {canDelete && (
                  <DropdownMenuItem
                    onClick={() => onDelete?.(template.id, template.name)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t('card.delete')}
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
            {t('card.fieldCount', { count: template.fieldCount }).replace(/^\d+\s*/, '')}
          </span>
          <span>
            <span className="font-medium text-foreground">{template.usageCount}</span>{' '}
            {t('card.usageCount', { count: template.usageCount }).replace(/^\d+\s*/, '')}
          </span>
        </div>

        {/* 更新時間 */}
        <div className="mt-2 text-xs text-muted-foreground">
          {t('card.updatedAt', { date: formatShortDate(template.updatedAt, locale) })}
        </div>
      </CardContent>
    </Card>
  );
}
