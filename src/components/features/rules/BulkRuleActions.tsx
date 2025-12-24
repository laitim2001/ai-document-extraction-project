/**
 * @fileoverview Bulk Rule Actions Component
 * @description
 *   Provides bulk operations for selected rules:
 *   - Bulk create rules from term analysis
 *   - Bulk update rule status/priority
 *   - Bulk delete (soft delete)
 *   - Undo last bulk operation
 *   - Export to CSV
 *
 * @module src/components/features/rules/BulkRuleActions
 * @since Epic 0 - Story 0.5
 * @lastModified 2025-12-24
 *
 * @dependencies
 *   - @/hooks/use-toast - Toast notifications
 *   - lucide-react - Icons
 */

'use client';

import * as React from 'react';
import {
  Plus,
  Trash2,
  Download,
  Undo2,
  CheckCircle,
  XCircle,
  Loader2,
  MoreHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import type { AggregatedTerm, TermClassification } from '@/hooks/use-term-analysis';

// ============================================================================
// Types
// ============================================================================

interface BulkRuleActionsProps {
  /** Selected terms for bulk operations */
  selectedTerms: AggregatedTerm[];
  /** AI classifications for terms */
  classifications?: Record<string, TermClassification>;
  /** Callback when bulk operation completes */
  onOperationComplete?: () => void;
  /** Whether actions are disabled */
  disabled?: boolean;
}

interface BulkOperation {
  id: string;
  operationType: string;
  affectedCount: number;
  createdAt: string;
  canUndo: boolean;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Bulk Rule Actions Component
 *
 * @description
 *   Action bar for bulk rule operations from term analysis.
 *   Supports create, update, delete, undo, and export.
 */
export function BulkRuleActions({
  selectedTerms,
  classifications = {},
  onOperationComplete,
  disabled = false,
}: BulkRuleActionsProps) {
  const { toast } = useToast();

  // --- State ---
  const [isCreating, setIsCreating] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [lastOperation, setLastOperation] = React.useState<BulkOperation | null>(null);
  const [isUndoing, setIsUndoing] = React.useState(false);

  const hasSelection = selectedTerms.length > 0;
  const selectionCount = selectedTerms.length;

  // --- Handlers ---

  /**
   * Handle bulk create rules
   */
  const handleBulkCreate = React.useCallback(async () => {
    if (!hasSelection) return;

    setIsCreating(true);

    try {
      // Prepare rules from selected terms
      const rules = selectedTerms.map((term) => {
        const classification = classifications[term.term];
        return {
          sourcePattern: term.term,
          targetCategory: classification?.category || 'OTHER',
          forwarderId: null, // Universal rules by default
          confidence: classification?.confidence
            ? classification.confidence / 100
            : 0.8,
          priority: 50,
        };
      });

      const response = await fetch('/api/rules/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create rules');
      }

      const result = await response.json();

      setLastOperation({
        id: result.data.bulkOperationId,
        operationType: 'BULK_CREATE',
        affectedCount: result.data.created,
        createdAt: new Date().toISOString(),
        canUndo: true,
      });

      toast({
        title: '批量建立成功',
        description: `已建立 ${result.data.created} 條規則`,
      });

      onOperationComplete?.();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '建立失敗',
        description: error instanceof Error ? error.message : '未知錯誤',
      });
    } finally {
      setIsCreating(false);
    }
  }, [selectedTerms, classifications, hasSelection, toast, onOperationComplete]);

  /**
   * Handle bulk delete (soft delete)
   */
  const handleBulkDelete = React.useCallback(async () => {
    setShowDeleteConfirm(false);
    setIsDeleting(true);

    try {
      // For term analysis, we're creating new rules, so delete would be for existing rules
      // This is a placeholder - in practice, you'd pass rule IDs
      const ruleIds = selectedTerms.map((t) => t.term); // Placeholder

      const response = await fetch('/api/rules/bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleIds, hardDelete: false }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to delete rules');
      }

      const result = await response.json();

      setLastOperation({
        id: result.data.bulkOperationId,
        operationType: 'BULK_SOFT_DELETE',
        affectedCount: result.data.deleted,
        createdAt: new Date().toISOString(),
        canUndo: result.data.canUndo,
      });

      toast({
        title: '批量刪除成功',
        description: `已刪除 ${result.data.deleted} 條規則`,
      });

      onOperationComplete?.();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '刪除失敗',
        description: error instanceof Error ? error.message : '未知錯誤',
      });
    } finally {
      setIsDeleting(false);
    }
  }, [selectedTerms, toast, onOperationComplete]);

  /**
   * Handle undo last operation
   */
  const handleUndo = React.useCallback(async () => {
    if (!lastOperation) return;

    setIsUndoing(true);

    try {
      const response = await fetch('/api/rules/bulk/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bulkOperationId: lastOperation.id }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to undo operation');
      }

      const result = await response.json();

      toast({
        title: '撤銷成功',
        description: result.data.message,
      });

      setLastOperation(null);
      onOperationComplete?.();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '撤銷失敗',
        description: error instanceof Error ? error.message : '未知錯誤',
      });
    } finally {
      setIsUndoing(false);
    }
  }, [lastOperation, toast, onOperationComplete]);

  /**
   * Handle CSV export
   */
  const handleExportCSV = React.useCallback(() => {
    if (!hasSelection) return;

    setIsExporting(true);

    try {
      // Build CSV content
      const headers = ['Term', 'Frequency', 'Companies', 'Suggested Category', 'Confidence'];
      const rows = selectedTerms.map((term) => {
        const classification = classifications[term.term];
        return [
          `"${term.term.replace(/"/g, '""')}"`,
          term.frequency.toString(),
          term.companyDistribution.length.toString(),
          classification?.category || '',
          classification?.confidence ? `${classification.confidence}%` : '',
        ].join(',');
      });

      const csvContent = [headers.join(','), ...rows].join('\n');

      // Create and trigger download
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `term-analysis-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: '匯出成功',
        description: `已匯出 ${selectedTerms.length} 條術語`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '匯出失敗',
        description: error instanceof Error ? error.message : '未知錯誤',
      });
    } finally {
      setIsExporting(false);
    }
  }, [selectedTerms, classifications, hasSelection, toast]);

  // --- Render ---

  return (
    <div className="flex items-center gap-2">
      {/* Selection indicator */}
      {hasSelection && (
        <Badge variant="secondary" className="mr-2">
          已選 {selectionCount} 項
        </Badge>
      )}

      {/* Create Rules Button */}
      <Button
        onClick={handleBulkCreate}
        disabled={disabled || !hasSelection || isCreating}
        size="sm"
      >
        {isCreating ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Plus className="h-4 w-4 mr-2" />
        )}
        批量建立規則
      </Button>

      {/* Export CSV Button */}
      <Button
        onClick={handleExportCSV}
        disabled={disabled || !hasSelection || isExporting}
        size="sm"
        variant="outline"
      >
        {isExporting ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Download className="h-4 w-4 mr-2" />
        )}
        匯出 CSV
      </Button>

      {/* Undo Button */}
      {lastOperation && lastOperation.canUndo && (
        <Button
          onClick={handleUndo}
          disabled={disabled || isUndoing}
          size="sm"
          variant="ghost"
        >
          {isUndoing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Undo2 className="h-4 w-4 mr-2" />
          )}
          撤銷
        </Button>
      )}

      {/* More Actions Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled || !hasSelection}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => {
              // Mark all selected as high confidence
              toast({
                title: '功能開發中',
                description: '批量設定高信心度功能即將推出',
              });
            }}
          >
            <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
            設為高信心度
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              toast({
                title: '功能開發中',
                description: '批量設定低信心度功能即將推出',
              });
            }}
          >
            <XCircle className="h-4 w-4 mr-2 text-red-500" />
            設為低信心度
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            批量刪除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除</AlertDialogTitle>
            <AlertDialogDescription>
              您確定要刪除選取的 {selectionCount} 條規則嗎？
              此操作可以撤銷。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
