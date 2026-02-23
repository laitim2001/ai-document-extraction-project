'use client';

/**
 * @fileoverview 欄位覆蓋率分析面板
 * @description
 *   顯示 FieldDefinitionSet 的提取回饋覆蓋率數據：
 *   - 整體覆蓋率進度條
 *   - 健康欄位列表（高覆蓋率）
 *   - 缺失欄位列表（低覆蓋率，附建議）
 *   - 意外欄位列表（未定義但出現的欄位）
 *
 * @module src/components/features/field-definition-set/FieldCoverageSummary
 * @since CHANGE-042 Phase 3
 * @lastModified 2026-02-23
 *
 * @dependencies
 *   - next-intl - 國際化
 *   - @/hooks/use-field-definition-sets - useFieldCoverage
 */

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Loader2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useFieldCoverage,
  type FieldCoverageItem,
  type UnexpectedFieldItem,
} from '@/hooks/use-field-definition-sets';

// ============================================================
// Types
// ============================================================

interface FieldCoverageSummaryProps {
  fieldDefinitionSetId: string;
}

// ============================================================
// Helper
// ============================================================

function getStatusIcon(status: FieldCoverageItem['status']) {
  switch (status) {
    case 'healthy':
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    case 'critical':
      return <XCircle className="h-4 w-4 text-red-600" />;
    default:
      return <HelpCircle className="h-4 w-4 text-muted-foreground" />;
  }
}

function getStatusColor(status: FieldCoverageItem['status']) {
  switch (status) {
    case 'healthy':
      return 'text-green-600';
    case 'warning':
      return 'text-yellow-600';
    case 'critical':
      return 'text-red-600';
    default:
      return 'text-muted-foreground';
  }
}

// ============================================================
// Component
// ============================================================

export function FieldCoverageSummary({
  fieldDefinitionSetId,
}: FieldCoverageSummaryProps) {
  const t = useTranslations('fieldDefinitionSet');
  const { data, isLoading } = useFieldCoverage(fieldDefinitionSetId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!data || data.totalExtractions === 0) {
    return (
      <div className="border rounded-md p-6 text-center text-muted-foreground">
        <HelpCircle className="h-8 w-8 mx-auto mb-2" />
        <p className="text-sm">{t('coverage.noData')}</p>
      </div>
    );
  }

  const healthyFields = data.fields.filter((f) => f.status === 'healthy');
  const warningFields = data.fields.filter((f) => f.status === 'warning');
  const criticalFields = data.fields.filter((f) => f.status === 'critical');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold">{t('coverage.title')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('coverage.description')}
        </p>
      </div>

      {/* Overall stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border rounded-md p-4">
          <div className="text-sm text-muted-foreground">
            {t('coverage.overallRate')}
          </div>
          <div className="text-2xl font-bold mt-1">
            {Math.round(data.overallCoverageRate * 100)}%
          </div>
          <Progress
            value={data.overallCoverageRate * 100}
            className="mt-2 h-2"
          />
        </div>
        <div className="border rounded-md p-4">
          <div className="text-sm text-muted-foreground">
            {t('coverage.totalExtractions')}
          </div>
          <div className="text-2xl font-bold mt-1 tabular-nums">
            {data.totalExtractions}
          </div>
        </div>
      </div>

      {/* Healthy fields */}
      {healthyFields.length > 0 && (
        <FieldSection
          title={t('coverage.healthy')}
          description={t('coverage.healthyDescription')}
          fields={healthyFields}
          t={t}
        />
      )}

      {/* Warning + critical fields */}
      {(warningFields.length > 0 || criticalFields.length > 0) && (
        <FieldSection
          title={t('coverage.missing')}
          description={t('coverage.missingDescription')}
          fields={[...criticalFields, ...warningFields]}
          t={t}
          showSuggestion
        />
      )}

      {/* Unexpected fields */}
      {data.unexpectedFields.length > 0 && (
        <div className="space-y-2">
          <div>
            <h4 className="text-sm font-semibold">
              {t('coverage.unexpected')}
            </h4>
            <p className="text-xs text-muted-foreground">
              {t('coverage.unexpectedDescription')}
            </p>
          </div>
          <div className="border rounded-md divide-y">
            {data.unexpectedFields.map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between px-3 py-2"
              >
                <span className="text-sm font-mono">{item.key}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {item.occurrenceCount}x
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    ({Math.round(item.percentage * 100)}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-blue-600">
            {t('coverage.suggestion.addField')}
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Sub-component
// ============================================================

function FieldSection({
  title,
  description,
  fields,
  t,
  showSuggestion = false,
}: {
  title: string;
  description: string;
  fields: FieldCoverageItem[];
  t: ReturnType<typeof useTranslations<'fieldDefinitionSet'>>;
  showSuggestion?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div>
        <h4 className="text-sm font-semibold">{title}</h4>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="border rounded-md divide-y">
        {fields.map((field) => (
          <div key={field.key} className="px-3 py-2 space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getStatusIcon(field.status)}
                <span className="text-sm font-medium">{field.label}</span>
                <span className="text-xs text-muted-foreground font-mono">
                  {field.key}
                </span>
              </div>
              <span
                className={`text-sm font-medium tabular-nums ${getStatusColor(
                  field.status
                )}`}
              >
                {Math.round(field.coverageRate * 100)}%
              </span>
            </div>
            <Progress
              value={field.coverageRate * 100}
              className="h-1.5"
            />
            {showSuggestion && field.status === 'critical' && (
              <p className="text-xs text-orange-600">
                {t('coverage.suggestion.removeField')}
              </p>
            )}
            {showSuggestion && field.status === 'warning' && (
              <p className="text-xs text-yellow-600">
                {t('coverage.suggestion.makeOptional')}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
