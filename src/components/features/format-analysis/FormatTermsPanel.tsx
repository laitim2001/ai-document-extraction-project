/**
 * @fileoverview Format Terms Panel Component
 * @description
 *   Displays terms associated with a specific document format.
 *   Features:
 *   - Term frequency display
 *   - Example occurrences
 *   - Category suggestions
 *   - Confidence indicators
 *
 * @module src/components/features/format-analysis/FormatTermsPanel
 * @since Epic 0 - Story 0.9
 * @lastModified 2025-12-26
 *
 * @related
 *   - src/types/document-format.ts - 類型定義
 *   - src/components/features/format-analysis/CompanyFormatTree.tsx - 格式樹
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  Tag,
  Hash,
  FileText,
  CheckCircle,
  AlertCircle,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import type {
  FormatTermNode,
  TermNode,
} from '@/types/document-format';

// ============================================================================
// Types
// ============================================================================

interface FormatTermsPanelProps {
  /** Selected format data */
  format: FormatTermNode | null;
  /** Company name for context */
  companyName?: string;
  /** Loading state */
  isLoading?: boolean;
  /** Create rule handler */
  onCreateRule?: (term: TermNode) => void;
}

// ============================================================================
// Constants
// ============================================================================

// ============================================================================
// Helper Components
// ============================================================================

/**
 * Confidence indicator with tooltip
 */
function ConfidenceIndicator({
  confidence,
  showValue = true,
}: {
  confidence?: number;
  showValue?: boolean;
}) {
  const t = useTranslations('formats');

  if (confidence === undefined) {
    return <span className="text-muted-foreground text-xs">-</span>;
  }

  let Icon = AlertCircle;
  let colorClass = 'text-yellow-500';
  let label = t('formatAnalysis.termsPanel.confidence.medium');

  if (confidence >= 90) {
    Icon = CheckCircle;
    colorClass = 'text-green-500';
    label = t('formatAnalysis.termsPanel.confidence.high');
  } else if (confidence < 70) {
    Icon = XCircle;
    colorClass = 'text-red-500';
    label = t('formatAnalysis.termsPanel.confidence.low');
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn('inline-flex items-center gap-1', colorClass)}>
            <Icon className="h-3.5 w-3.5" />
            {showValue && <span className="text-xs">{confidence}%</span>}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{t('formatAnalysis.termsPanel.confidence.tooltip', { label, value: confidence })}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Term row with expandable examples
 */
function TermRow({
  term,
  onCreateRule,
}: {
  term: TermNode;
  onCreateRule?: (term: TermNode) => void;
}) {
  const t = useTranslations('formats');
  const [showExamples, setShowExamples] = React.useState(false);
  const hasExamples = term.examples && term.examples.length > 0;

  return (
    <>
      <TableRow className="group">
        <TableCell className="font-medium">
          <div className="flex items-center gap-2">
            <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="truncate max-w-[200px]">{term.normalizedTerm}</span>
          </div>
        </TableCell>

        <TableCell>
          <Badge variant="secondary" className="text-xs">
            <Hash className="h-3 w-3 mr-0.5" />
            {term.frequency}
          </Badge>
        </TableCell>

        <TableCell>
          {term.suggestedCategory ? (
            <Badge variant="outline" className="text-xs">
              {term.suggestedCategory}
            </Badge>
          ) : (
            <span className="text-muted-foreground text-xs">-</span>
          )}
        </TableCell>

        <TableCell>
          <ConfidenceIndicator confidence={term.confidence} />
        </TableCell>

        <TableCell>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {hasExamples && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setShowExamples(!showExamples)}
              >
                {showExamples ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
                <span className="ml-1">{term.examples?.length}</span>
              </Button>
            )}
            {onCreateRule && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => onCreateRule(term)}
              >
                {t('formatAnalysis.termsPanel.createRule')}
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>

      {/* Expandable examples row */}
      {showExamples && hasExamples && (
        <TableRow className="bg-muted/30">
          <TableCell colSpan={5} className="py-2">
            <div className="pl-6 space-y-1">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                {t('formatAnalysis.termsPanel.examplesTitle')}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {term.examples?.slice(0, 5).map((example, idx) => (
                  <code
                    key={idx}
                    className="text-xs bg-background px-2 py-1 rounded border"
                  >
                    {example}
                  </code>
                ))}
                {term.examples && term.examples.length > 5 && (
                  <span className="text-xs text-muted-foreground">
                    {t('formatAnalysis.termsPanel.moreExamples', {
                      count: term.examples.length - 5,
                    })}
                  </span>
                )}
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * @component FormatTermsPanel
 * @description Panel showing terms for a selected document format
 */
export function FormatTermsPanel({
  format,
  companyName,
  isLoading = false,
  onCreateRule,
}: FormatTermsPanelProps) {
  const t = useTranslations('formats');

  // Sort terms by frequency
  const sortedTerms = React.useMemo(() => {
    if (!format?.terms) return [];
    return [...format.terms].sort((a, b) => b.frequency - a.frequency);
  }, [format?.terms]);

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!format) {
    return (
      <Card className="h-full">
        <CardContent className="flex flex-col items-center justify-center h-full text-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">
            {t('formatAnalysis.termsPanel.emptySelectionTitle')}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            {t('formatAnalysis.termsPanel.emptySelectionDescription')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t(`documentTypes.${format.documentType}`)}
            </CardTitle>
            <CardDescription className="mt-1">
              {companyName && <span className="font-medium">{companyName}</span>}
              {companyName && ' · '}
              {t(`documentSubtypes.${format.documentSubtype}`)}
              {format.formatName && ` · ${format.formatName}`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">
              <FileText className="h-3 w-3 mr-1" />
              {t('formatAnalysis.termsPanel.filesBadge', { count: format.fileCount })}
            </Badge>
            <Badge variant="secondary">
              <Tag className="h-3 w-3 mr-1" />
              {t('formatAnalysis.termsPanel.termsBadge', { count: format.termCount })}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 pt-0 overflow-hidden">
        {sortedTerms.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <Tag className="h-8 w-8 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              {t('formatAnalysis.termsPanel.noTerms')}
            </p>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[35%]">{t('formatAnalysis.termsPanel.table.term')}</TableHead>
                  <TableHead className="w-[15%]">{t('formatAnalysis.termsPanel.table.frequency')}</TableHead>
                  <TableHead className="w-[20%]">{t('formatAnalysis.termsPanel.table.category')}</TableHead>
                  <TableHead className="w-[15%]">{t('formatAnalysis.termsPanel.table.confidence')}</TableHead>
                  <TableHead className="w-[15%]">{t('formatAnalysis.termsPanel.table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedTerms.map((term, idx) => (
                  <TermRow
                    key={`${term.normalizedTerm}-${idx}`}
                    term={term}
                    onCreateRule={onCreateRule}
                  />
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
