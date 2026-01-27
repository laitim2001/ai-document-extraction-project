'use client';

/**
 * @fileoverview 實例統計概覽組件
 * @description
 *   顯示模版實例的統計數據，包括：
 *   - 總行數
 *   - 有效行數
 *   - 錯誤行數
 *   - 狀態徽章
 *
 * @module src/components/features/template-instance/InstanceStatsOverview
 * @since Epic 19 - Story 19.5
 * @lastModified 2026-01-22
 */

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { FileStack, CheckCircle, AlertCircle, Activity } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getInstanceStatusConfig } from './status-config';
import type { TemplateInstance } from '@/types/template-instance';

// ============================================================================
// Types
// ============================================================================

interface InstanceStatsOverviewProps {
  instance: TemplateInstance;
  className?: string;
}

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: number | React.ReactNode;
  valueClassName?: string;
}

// ============================================================================
// Sub Components
// ============================================================================

function StatCard({ icon: Icon, label, value, valueClassName }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="rounded-full bg-muted p-2">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <div className={`text-2xl font-bold ${valueClassName ?? ''}`}>{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * 實例統計概覽組件
 */
export function InstanceStatsOverview({ instance, className }: InstanceStatsOverviewProps) {
  const t = useTranslations('templateInstance');
  const statusConfig = getInstanceStatusConfig(instance.status);

  return (
    <div className={`grid gap-4 md:grid-cols-2 lg:grid-cols-4 ${className ?? ''}`}>
      <StatCard
        icon={FileStack}
        label={t('detail.stats.totalRows')}
        value={instance.rowCount}
      />
      <StatCard
        icon={CheckCircle}
        label={t('detail.stats.validRows')}
        value={instance.validRowCount}
        valueClassName="text-green-600"
      />
      <StatCard
        icon={AlertCircle}
        label={t('detail.stats.errorRows')}
        value={instance.errorRowCount}
        valueClassName={instance.errorRowCount > 0 ? 'text-red-500' : ''}
      />
      <StatCard
        icon={Activity}
        label={t('detail.stats.status')}
        value={
          <Badge variant={statusConfig.badgeVariant} className="mt-1">
            <span className="mr-1">{statusConfig.icon}</span>
            {t(`status.${instance.status}`)}
          </Badge>
        }
      />
    </div>
  );
}
