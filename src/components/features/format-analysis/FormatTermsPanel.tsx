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
  DocumentType,
  DocumentSubtype,
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

const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  INVOICE: 'Invoice',
  DEBIT_NOTE: 'Debit Note',
  CREDIT_NOTE: 'Credit Note',
  STATEMENT: 'Statement',
  QUOTATION: 'Quotation',
  BILL_OF_LADING: 'Bill of Lading',
  CUSTOMS_DECLARATION: 'Customs Declaration',
  OTHER: 'Other',
};

const DOCUMENT_SUBTYPE_LABELS: Record<DocumentSubtype, string> = {
  OCEAN_FREIGHT: 'Ocean Freight',
  AIR_FREIGHT: 'Air Freight',
  LAND_TRANSPORT: 'Land Transport',
  CUSTOMS_CLEARANCE: 'Customs Clearance',
  WAREHOUSING: 'Warehousing',
  GENERAL: 'General',
};

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
  if (confidence === undefined) {
    return <span className="text-muted-foreground text-xs">-</span>;
  }

  let Icon = AlertCircle;
  let colorClass = 'text-yellow-500';
  let label = 'Medium';

  if (confidence >= 90) {
    Icon = CheckCircle;
    colorClass = 'text-green-500';
    label = 'High';
  } else if (confidence < 70) {
    Icon = XCircle;
    colorClass = 'text-red-500';
    label = 'Low';
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
          <p>{label} confidence: {confidence}%</p>
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
                Create Rule
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
                Original text examples:
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
                    +{term.examples.length - 5} more
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
          <p className="text-sm text-muted-foreground">Select a format to view terms</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Click on a format in the tree to see associated terms
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
              {DOCUMENT_TYPE_LABELS[format.documentType]}
            </CardTitle>
            <CardDescription className="mt-1">
              {companyName && <span className="font-medium">{companyName}</span>}
              {companyName && ' · '}
              {DOCUMENT_SUBTYPE_LABELS[format.documentSubtype]}
              {format.formatName && ` · ${format.formatName}`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">
              <FileText className="h-3 w-3 mr-1" />
              {format.fileCount} files
            </Badge>
            <Badge variant="secondary">
              <Tag className="h-3 w-3 mr-1" />
              {format.termCount} terms
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 pt-0 overflow-hidden">
        {sortedTerms.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <Tag className="h-8 w-8 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No terms found for this format</p>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[35%]">Term</TableHead>
                  <TableHead className="w-[15%]">Frequency</TableHead>
                  <TableHead className="w-[20%]">Category</TableHead>
                  <TableHead className="w-[15%]">Confidence</TableHead>
                  <TableHead className="w-[15%]">Actions</TableHead>
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
