'use client';

/**
 * @fileoverview 模版實例詳情組件
 * @description
 *   顯示模版實例的完整詳情，包括：
 *   - 統計概覽
 *   - 數據行表格
 *   - 操作按鈕
 *
 * @module src/components/features/template-instance/TemplateInstanceDetail
 * @since Epic 19 - Story 19.5
 * @lastModified 2026-01-22
 */

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import {
  ArrowLeft,
  Download,
  Plus,
  Settings,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { InstanceStatsOverview } from './InstanceStatsOverview';
import { InstanceRowsTable } from './InstanceRowsTable';
import { useTemplateInstance } from '@/hooks/use-template-instances';

// ============================================================================
// Types
// ============================================================================

interface TemplateInstanceDetailProps {
  instanceId: string;
  className?: string;
}

// ============================================================================
// Sub Components
// ============================================================================

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-[300px]" />
          <Skeleton className="h-4 w-[200px]" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-[120px]" />
          <Skeleton className="h-10 w-[100px]" />
        </div>
      </div>

      {/* Stats skeleton */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[88px] rounded-lg" />
        ))}
      </div>

      {/* Table skeleton */}
      <Skeleton className="h-[400px] rounded-lg" />
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * 模版實例詳情組件
 */
export function TemplateInstanceDetail({ instanceId, className }: TemplateInstanceDetailProps) {
  const t = useTranslations('templateInstance');
  const tCommon = useTranslations('common');

  const { data, isLoading, error } = useTemplateInstance(instanceId);

  // Loading state
  if (isLoading) {
    return <DetailSkeleton />;
  }

  // Error state
  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-destructive mb-4">{error?.message || tCommon('errors.notFound')}</p>
        <Button variant="outline" asChild>
          <Link href="/template-instances">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('detail.backToList')}
          </Link>
        </Button>
      </div>
    );
  }

  const instance = data;
  const canExport = instance.status === 'COMPLETED';

  return (
    <div className={`space-y-6 ${className ?? ''}`}>
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Button variant="ghost" size="sm" asChild className="h-8 px-2">
              <Link href="/template-instances">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-2xl font-bold">
              {t('detail.instanceName', { name: instance.name })}
            </h1>
          </div>
          <p className="text-muted-foreground pl-10">
            {t('detail.templateName', { name: data.dataTemplate?.name || '-' })}
          </p>
        </div>

        <div className="flex items-center gap-2 pl-10 md:pl-0">
          {/* Export dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={!canExport}>
                <Download className="mr-2 h-4 w-4" />
                {t('detail.actions.export')}
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                {t('detail.actions.exportExcel')}
              </DropdownMenuItem>
              <DropdownMenuItem>
                {t('detail.actions.exportCsv')}
              </DropdownMenuItem>
              <DropdownMenuItem>
                {t('detail.actions.exportJson')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Add file button */}
          <Button variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            {t('detail.actions.addFile')}
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <InstanceStatsOverview instance={instance} />

      {/* Rows Table */}
      <InstanceRowsTable
        instanceId={instanceId}
        templateFields={data.dataTemplate?.fields ?? []}
      />
    </div>
  );
}
