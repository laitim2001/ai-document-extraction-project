'use client';

/**
 * @fileoverview 模版實例卡片組件
 * @description
 *   顯示單一模版實例的摘要資訊，包括：
 *   - 實例名稱和狀態
 *   - 行數統計
 *   - 操作按鈕
 *
 * @module src/components/features/template-instance/TemplateInstanceCard
 * @since Epic 19 - Story 19.5
 * @lastModified 2026-01-22
 */

import * as React from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Eye, Download, Trash2, MoreHorizontal } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getInstanceStatusConfig } from './status-config';
import { formatRelativeTime } from '@/lib/i18n-date';
import type { Locale } from '@/i18n/config';
import type { TemplateInstanceSummary } from '@/types/template-instance';

// ============================================================================
// Types
// ============================================================================

interface TemplateInstanceCardProps {
  instance: TemplateInstanceSummary;
  onDelete?: (id: string) => void;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * 模版實例卡片組件
 */
export function TemplateInstanceCard({
  instance,
  onDelete,
  className,
}: TemplateInstanceCardProps) {
  const t = useTranslations('templateInstance');
  const locale = useLocale();
  const statusConfig = getInstanceStatusConfig(instance.status);

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate" title={instance.name}>
              {instance.name}
            </CardTitle>
            <p className="text-sm text-muted-foreground truncate mt-1">
              {instance.dataTemplateName}
            </p>
          </div>
          <Badge variant={statusConfig.badgeVariant} className="ml-2 shrink-0">
            <span className="mr-1">{statusConfig.icon}</span>
            {t(`status.${instance.status}`)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pb-2">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">
            {t('card.rows', { count: instance.rowCount })}
          </span>
          {instance.validRowCount > 0 && (
            <span className="text-green-600">
              {t('card.validRows', { count: instance.validRowCount })}
            </span>
          )}
          {instance.errorRowCount > 0 && (
            <span className="text-red-500">
              {t('card.errorRows', { count: instance.errorRowCount })}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {instance.exportedAt
            ? t('card.exportedAt', {
                date: formatRelativeTime(new Date(instance.exportedAt), locale as Locale),
              })
            : t('card.updatedAt', {
                date: formatRelativeTime(new Date(instance.updatedAt), locale as Locale),
              })}
        </p>
      </CardContent>

      <CardFooter className="pt-2">
        <div className="flex items-center gap-2 w-full">
          <Button variant="outline" size="sm" asChild className="flex-1">
            <Link href={`/template-instances/${instance.id}`}>
              <Eye className="mr-2 h-4 w-4" />
              {t('card.viewDetails')}
            </Link>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">More actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/template-instances/${instance.id}`}>
                  <Eye className="mr-2 h-4 w-4" />
                  {t('card.viewDetails')}
                </Link>
              </DropdownMenuItem>
              {instance.status === 'COMPLETED' && (
                <DropdownMenuItem>
                  <Download className="mr-2 h-4 w-4" />
                  {t('card.export')}
                </DropdownMenuItem>
              )}
              {instance.status === 'DRAFT' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => onDelete?.(instance.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t('rowActions.delete')}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardFooter>
    </Card>
  );
}
