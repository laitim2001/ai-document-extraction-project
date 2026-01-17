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
 * @lastModified 2026-01-17
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

  const allSelected = terms.length > 0 && selectedTerms.size === terms.length;
  const someSelected = selectedTerms.size > 0 && selectedTerms.size < terms.length;

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={allSelected}
                // @ts-expect-error - indeterminate is a valid HTML attribute
                indeterminate={someSelected}
                onCheckedChange={(checked) => handleSelectAll(!!checked)}
                aria-label={t('table.selectAll')}
              />
            </TableHead>
            <TableHead>{t('table.headers.term')}</TableHead>
            <TableHead className="w-24 text-right">{t('table.headers.frequency')}</TableHead>
            <TableHead className="w-32">{t('table.headers.companies')}</TableHead>
            <TableHead className="w-40">{t('table.headers.suggestedCategory')}</TableHead>
            <TableHead className="w-24">{t('table.headers.confidence')}</TableHead>
            <TableHead className="w-32">{t('table.headers.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {terms.map((term) => {
            const classification = classifications[term.term];
            const isSelected = selectedTerms.has(term.term);

            return (
              <TableRow
                key={term.term}
                className={cn(isSelected && 'bg-muted/50')}
              >
                <TableCell>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) =>
                      handleSelectTerm(term.term, !!checked)
                    }
                    aria-label={t('table.selectTerm', { term: term.term })}
                  />
                </TableCell>
                <TableCell>
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
                </TableCell>
                <TableCell className="text-right font-mono">
                  {term.frequency.toLocaleString()}
                </TableCell>
                <TableCell>
                  <CompanyBadge distribution={term.companyDistribution} t={t} />
                </TableCell>
                <TableCell>
                  {classification ? (
                    <Badge variant="secondary">
                      {t(`table.categories.${classification.category}`)}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {classification ? (
                    <ConfidenceIndicator confidence={classification.confidence} t={t} />
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      onCreateRule?.(term, classification?.category)
                    }
                  >
                    {t('table.createRule')}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
