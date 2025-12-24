/**
 * @fileoverview Term Analysis Table Component
 * @description
 *   Displays aggregated terms in a data table with:
 *   - Term frequency and distribution
 *   - AI classification suggestions
 *   - Multi-select for batch operations
 *   - Sorting and filtering capabilities
 *
 * @module src/components/features/term-analysis/TermTable
 * @since Epic 0 - Story 0.5
 * @lastModified 2025-12-24
 *
 * @related
 *   - src/hooks/use-term-analysis.ts - 術語分析數據 Hook
 *   - src/app/api/admin/term-analysis/route.ts - 術語聚合 API
 *   - src/components/features/term-analysis/TermFilters.tsx - 篩選控制
 *   - src/components/features/rules/BulkRuleActions.tsx - 批量規則操作
 */

'use client';

import * as React from 'react';
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
// Constants
// ============================================================================

const CATEGORY_LABELS: Record<StandardChargeCategory, string> = {
  OCEAN_FREIGHT: 'Ocean Freight',
  AIR_FREIGHT: 'Air Freight',
  HANDLING_FEE: 'Handling Fee',
  CUSTOMS_CLEARANCE: 'Customs Clearance',
  DOCUMENTATION_FEE: 'Documentation Fee',
  TERMINAL_HANDLING: 'Terminal Handling',
  INLAND_TRANSPORT: 'Inland Transport',
  INSURANCE: 'Insurance',
  STORAGE: 'Storage',
  FUEL_SURCHARGE: 'Fuel Surcharge',
  SECURITY_FEE: 'Security Fee',
  OTHER: 'Other',
};

// ============================================================================
// Helper Components
// ============================================================================

/**
 * Confidence indicator component
 */
function ConfidenceIndicator({ confidence }: { confidence: number }) {
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
            ? 'High confidence - Auto approve'
            : confidence >= 70
              ? 'Medium confidence - Quick review'
              : 'Low confidence - Full review'}
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
}: {
  distribution: AggregatedTerm['companyDistribution'];
}) {
  const totalCompanies = distribution.length;
  const topCompany = distribution[0];

  if (totalCompanies === 0) {
    return <span className="text-muted-foreground">-</span>;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="cursor-help">
            {totalCompanies} {totalCompanies === 1 ? 'company' : 'companies'}
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
                +{totalCompanies - 5} more...
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
        No terms found. Try adjusting your filters or process more historical data.
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
                aria-label="Select all"
              />
            </TableHead>
            <TableHead>Term</TableHead>
            <TableHead className="w-24 text-right">Frequency</TableHead>
            <TableHead className="w-32">Companies</TableHead>
            <TableHead className="w-40">Suggested Category</TableHead>
            <TableHead className="w-24">Confidence</TableHead>
            <TableHead className="w-32">Actions</TableHead>
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
                    aria-label={`Select ${term.term}`}
                  />
                </TableCell>
                <TableCell>
                  <div className="font-medium">{term.term}</div>
                  {term.similarTerms.length > 0 && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-xs text-muted-foreground cursor-help">
                            +{term.similarTerms.length} similar
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
                  <CompanyBadge distribution={term.companyDistribution} />
                </TableCell>
                <TableCell>
                  {classification ? (
                    <Badge variant="secondary">
                      {CATEGORY_LABELS[classification.category] ||
                        classification.category}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {classification ? (
                    <ConfidenceIndicator confidence={classification.confidence} />
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
                    Create Rule
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
