/**
 * @fileoverview Term Analysis Table Component (i18n version)
 * @description
 *   Displays aggregated terms in a data table with:
 *   - Term frequency and distribution
 *   - AI classification suggestions
 *   - Multi-select for batch operations
 *   - Sorting and filtering capabilities
 *   - Full i18n support
 *
 * @module src/components/features/term-analysis/TermTable
 * @since Epic 0 - Story 0.5
 * @lastModified 2026-06-22 (CHANGE-087 Phase 2: 遷移共用 DataTable)
 *
 * @related
 *   - src/hooks/use-term-analysis.ts - 術語分析數據 Hook
 *   - src/app/api/admin/term-analysis/route.ts - 術語聚合 API
 *   - src/components/features/term-analysis/TermFilters.tsx - 篩選控制
 *   - src/components/features/rules/BulkRuleActions.tsx - 批量規則操作
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import {
  DataTable,
  type DataTableColumn,
} from '@/components/features/common/DataTable';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { AggregatedTerm, TermClassification } from '@/hooks/use-term-analysis';
import type { StandardChargeCategory } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

interface TermTableProps {
  /** Aggregated terms to display */
  terms: AggregatedTerm[];
  /** AI classification results (keyed by term) */
  classifications?: Record<string, TermClassification>;
  /** Selected term keys */
  selectedTerms: Set<string>;
  /** Selection change handler */
  onSelectionChange: (selected: Set<string>) => void;
  /** Create rule handler */
  onCreateRule?: (term: AggregatedTerm, category?: StandardChargeCategory) => void;
  /** Loading state */
  isLoading?: boolean;
}

// ============================================================================
// Helper Types
// ============================================================================

// Translation function type - using ReturnType for proper typing with next-intl
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TranslationFunction = ReturnType<typeof import('next-intl').useTranslations<any>>;

// ============================================================================
// Helper Components (with i18n support)
// ============================================================================

/**
 * Confidence indicator component
 */
function ConfidenceIndicator({ confidence, t }: { confidence: number; t: TranslationFunction }) {
  let Icon = AlertCircle;
  let colorClass = 'text-yellow-500';

  if (confidence >= 90) {
    Icon = CheckCircle;
    colorClass = 'text-green-500';
  } else if (confidence >= 70) {
    Icon = AlertCircle;
    colorClass = 'text-yellow-500';
  } else {
    Icon = XCircle;
    colorClass = 'text-red-500';
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1">
            <Icon className={cn('h-4 w-4', colorClass)} />
            <span className="text-sm">{confidence}%</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {confidence >= 90
            ? t('table.confidence.high')
            : confidence >= 70
              ? t('table.confidence.medium')
              : t('table.confidence.low')}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Company distribution badge
 */
function CompanyBadge({
  distribution,
  t,
}: {
  distribution: AggregatedTerm['companyDistribution'];
  t: TranslationFunction;
}) {
  const totalCompanies = distribution.length;

  if (totalCompanies === 0) {
    return <span className="text-muted-foreground">-</span>;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="cursor-help">
            {t('table.companyCount', { count: totalCompanies })}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1 text-sm">
            {distribution.slice(0, 5).map((d) => (
              <div key={d.companyId}>
                {d.companyName}: {d.count}
              </div>
            ))}
            {totalCompanies > 5 && (
              <div className="text-muted-foreground">
                {t('table.moreCompanies', { count: totalCompanies - 5 })}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function TermTable({
  terms,
  classifications = {},
  selectedTerms,
  onSelectionChange,
  onCreateRule,
  isLoading = false,
}: TermTableProps) {
  const t = useTranslations('termAnalysis');

  // --- Handlers ---

  const handleSelectAll = React.useCallback(
    (checked: boolean) => {
      if (checked) {
        onSelectionChange(new Set(terms.map((t) => t.term)));
      } else {
        onSelectionChange(new Set());
      }
    },
    [terms, onSelectionChange]
  );

  const handleSelectTerm = React.useCallback(
    (term: string, checked: boolean) => {
      const newSelected = new Set(selectedTerms);
      if (checked) {
        newSelected.add(term);
      } else {
        newSelected.delete(term);
      }
      onSelectionChange(newSelected);
    },
    [selectedTerms, onSelectionChange]
  );

  const allSelected = terms.length > 0 && selectedTerms.size === terms.length;
  const someSelected = selectedTerms.size > 0 && selectedTerms.size < terms.length;

  // --- Column 定義 ---
  const columns = React.useMemo<DataTableColumn<AggregatedTerm>[]>(
    () => [
      {
        id: 'select',
        headerClassName: 'w-12',
        header: (
          <Checkbox
            checked={allSelected}
            // @ts-expect-error - indeterminate is a valid HTML attribute
            indeterminate={someSelected}
            onCheckedChange={(checked) => handleSelectAll(!!checked)}
            aria-label={t('table.selectAll')}
          />
        ),
        cell: (term) => (
          <Checkbox
            checked={selectedTerms.has(term.term)}
            onCheckedChange={(checked) =>
              handleSelectTerm(term.term, !!checked)
            }
            aria-label={t('table.selectTerm', { term: term.term })}
          />
        ),
      },
      {
        id: 'term',
        header: t('table.headers.term'),
        cell: (term) => (
          <>
            <div className="font-medium">{term.term}</div>
            {term.similarTerms.length > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-xs text-muted-foreground cursor-help">
                      {t('table.similarTerms', { count: term.similarTerms.length })}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="space-y-1">
                      {term.similarTerms.slice(0, 5).map((s) => (
                        <div key={s}>{s}</div>
                      ))}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </>
        ),
      },
      {
        id: 'frequency',
        headerClassName: 'w-24 text-right',
        header: t('table.headers.frequency'),
        cellClassName: 'text-right font-mono',
        cell: (term) => term.frequency.toLocaleString(),
      },
      {
        id: 'companies',
        headerClassName: 'w-32',
        header: t('table.headers.companies'),
        cell: (term) => (
          <CompanyBadge distribution={term.companyDistribution} t={t} />
        ),
      },
      {
        id: 'suggestedCategory',
        headerClassName: 'w-40',
        header: t('table.headers.suggestedCategory'),
        cell: (term) => {
          const classification = classifications[term.term];
          return classification ? (
            <Badge variant="secondary">
              {t(`table.categories.${classification.category}`)}
            </Badge>
          ) : (
            <span className="text-muted-foreground">-</span>
          );
        },
      },
      {
        id: 'confidence',
        headerClassName: 'w-24',
        header: t('table.headers.confidence'),
        cell: (term) => {
          const classification = classifications[term.term];
          return classification ? (
            <ConfidenceIndicator confidence={classification.confidence} t={t} />
          ) : (
            <span className="text-muted-foreground">-</span>
          );
        },
      },
      {
        id: 'actions',
        headerClassName: 'w-32',
        header: t('table.headers.actions'),
        cell: (term) => {
          const classification = classifications[term.term];
          return (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onCreateRule?.(term, classification?.category)}
            >
              {t('table.createRule')}
            </Button>
          );
        },
      },
    ],
    [
      allSelected,
      someSelected,
      handleSelectAll,
      handleSelectTerm,
      selectedTerms,
      classifications,
      onCreateRule,
      t,
    ]
  );

  // --- Render ---

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (terms.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {t('table.empty')}
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <DataTable
        data={terms}
        columns={columns}
        getRowId={(term) => term.term}
        rowProps={(term) => ({
          className: cn(selectedTerms.has(term.term) && 'bg-muted/50'),
        })}
      />
    </div>
  );
}
