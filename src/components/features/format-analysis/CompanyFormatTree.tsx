/**
 * @fileoverview Company Format Tree Component
 * @description
 *   Displays hierarchical structure of Company → DocumentFormat → Terms.
 *   Supports:
 *   - Expandable company nodes showing formats
 *   - Format type/subtype badges
 *   - Term counts and file counts per format
 *   - Selection for detailed view
 *
 * @module src/components/features/format-analysis/CompanyFormatTree
 * @since Epic 0 - Story 0.9
 * @lastModified 2025-12-26
 *
 * @related
 *   - src/types/document-format.ts - 類型定義
 *   - src/services/hierarchical-term-aggregation.service.ts - 三層聚合服務
 *   - src/components/features/format-analysis/FormatTermsPanel.tsx - 術語面板
 */

'use client';

import * as React from 'react';
import {
  ChevronRight,
  ChevronDown,
  Building2,
  FileText,
  Tag,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import type {
  CompanyTermNode,
  FormatTermNode,
  DocumentType,
  DocumentSubtype,
} from '@/types/document-format';

// ============================================================================
// Types
// ============================================================================

interface CompanyFormatTreeProps {
  /** Company nodes with format and term data */
  companies: CompanyTermNode[];
  /** Selected format ID */
  selectedFormatId?: string;
  /** Format selection handler */
  onFormatSelect: (formatId: string, format: FormatTermNode) => void;
  /** Loading state */
  isLoading?: boolean;
  /** Compact mode for sidebar display */
  compact?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const DOCUMENT_TYPE_COLORS: Record<DocumentType, string> = {
  INVOICE: 'bg-blue-100 text-blue-800',
  DEBIT_NOTE: 'bg-orange-100 text-orange-800',
  CREDIT_NOTE: 'bg-green-100 text-green-800',
  STATEMENT: 'bg-purple-100 text-purple-800',
  QUOTATION: 'bg-yellow-100 text-yellow-800',
  BILL_OF_LADING: 'bg-cyan-100 text-cyan-800',
  CUSTOMS_DECLARATION: 'bg-pink-100 text-pink-800',
  OTHER: 'bg-gray-100 text-gray-800',
};

const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  INVOICE: 'Invoice',
  DEBIT_NOTE: 'Debit Note',
  CREDIT_NOTE: 'Credit Note',
  STATEMENT: 'Statement',
  QUOTATION: 'Quotation',
  BILL_OF_LADING: 'B/L',
  CUSTOMS_DECLARATION: 'Customs',
  OTHER: 'Other',
};

const DOCUMENT_SUBTYPE_LABELS: Record<DocumentSubtype, string> = {
  OCEAN_FREIGHT: 'Ocean',
  AIR_FREIGHT: 'Air',
  LAND_TRANSPORT: 'Land',
  CUSTOMS_CLEARANCE: 'Customs',
  WAREHOUSING: 'Warehouse',
  GENERAL: 'General',
};

// ============================================================================
// Helper Components
// ============================================================================

/**
 * Format node component
 */
function FormatNode({
  format,
  isSelected,
  onSelect,
  compact,
}: {
  format: FormatTermNode;
  isSelected: boolean;
  onSelect: () => void;
  compact?: boolean;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-2 text-left rounded-md transition-colors',
        'hover:bg-muted/50',
        isSelected && 'bg-primary/10 border-l-2 border-primary',
        compact ? 'text-xs' : 'text-sm'
      )}
    >
      <FileText className={cn('shrink-0', compact ? 'h-3 w-3' : 'h-4 w-4', 'text-muted-foreground')} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge
            variant="outline"
            className={cn(
              'text-[10px] px-1.5 py-0',
              DOCUMENT_TYPE_COLORS[format.documentType]
            )}
          >
            {DOCUMENT_TYPE_LABELS[format.documentType]}
          </Badge>
          <span className="text-[10px] text-muted-foreground">
            {DOCUMENT_SUBTYPE_LABELS[format.documentSubtype]}
          </span>
        </div>

        {format.formatName && !compact && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {format.formatName}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 text-muted-foreground shrink-0">
        <span className="flex items-center gap-0.5 text-[10px]">
          <FileText className="h-3 w-3" />
          {format.fileCount}
        </span>
        <span className="flex items-center gap-0.5 text-[10px]">
          <Tag className="h-3 w-3" />
          {format.termCount}
        </span>
      </div>
    </button>
  );
}

/**
 * Company node component with collapsible formats
 */
function CompanyNode({
  company,
  selectedFormatId,
  onFormatSelect,
  defaultOpen = false,
  compact,
}: {
  company: CompanyTermNode;
  selectedFormatId?: string;
  onFormatSelect: (formatId: string, format: FormatTermNode) => void;
  defaultOpen?: boolean;
  compact?: boolean;
}) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);
  const hasSelectedFormat = company.formats.some(f => f.formatId === selectedFormatId);

  // Auto-expand if contains selected format
  React.useEffect(() => {
    if (hasSelectedFormat && !isOpen) {
      setIsOpen(true);
    }
  }, [hasSelectedFormat, isOpen]);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button
          className={cn(
            'w-full flex items-center gap-2 px-2 py-2 text-left rounded-md transition-colors',
            'hover:bg-muted',
            hasSelectedFormat && 'bg-muted/50',
            compact ? 'text-xs' : 'text-sm'
          )}
        >
          {isOpen ? (
            <ChevronDown className={cn(compact ? 'h-3 w-3' : 'h-4 w-4', 'shrink-0')} />
          ) : (
            <ChevronRight className={cn(compact ? 'h-3 w-3' : 'h-4 w-4', 'shrink-0')} />
          )}

          <Building2 className={cn(compact ? 'h-3 w-3' : 'h-4 w-4', 'shrink-0 text-muted-foreground')} />

          <div className="flex-1 min-w-0">
            <span className="font-medium truncate">{company.companyName}</span>
          </div>

          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
            {company.formats.length} formats
          </Badge>
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="ml-4 pl-2 border-l border-muted space-y-0.5 mt-1">
          {company.formats.map(format => (
            <FormatNode
              key={format.formatId}
              format={format}
              isSelected={format.formatId === selectedFormatId}
              onSelect={() => onFormatSelect(format.formatId, format)}
              compact={compact}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * @component CompanyFormatTree
 * @description Hierarchical tree view of Company → Format structure
 */
export function CompanyFormatTree({
  companies,
  selectedFormatId,
  onFormatSelect,
  isLoading = false,
  compact = false,
}: CompanyFormatTreeProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Building2 className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <p className="text-sm text-muted-foreground">No companies found</p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Process some documents to see format analysis
        </p>
      </div>
    );
  }

  // Calculate totals for summary
  const totalFormats = companies.reduce((sum, c) => sum + c.formats.length, 0);
  const totalTerms = companies.reduce(
    (sum, c) => sum + c.formats.reduce((fSum, f) => fSum + f.termCount, 0),
    0
  );

  return (
    <div className="flex flex-col h-full">
      {/* Summary Header */}
      <div className="px-3 py-2 border-b bg-muted/30">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{companies.length} Companies</span>
          <span>{totalFormats} Formats</span>
          <span>{totalTerms} Terms</span>
        </div>
      </div>

      {/* Tree Content */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {companies.map(company => (
            <CompanyNode
              key={company.companyId}
              company={company}
              selectedFormatId={selectedFormatId}
              onFormatSelect={onFormatSelect}
              defaultOpen={companies.length === 1}
              compact={compact}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
