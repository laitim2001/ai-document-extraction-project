'use client';

/**
 * @fileoverview 添加文件到模版實例對話框
 * @description
 *   讓用戶從已處理完成的文件中選擇，匹配到當前模版實例。
 *   使用 POST /api/v1/documents/match API 進行批量匹配。
 *
 * @module src/components/features/template-instance/AddFileDialog
 * @since FIX-040 - Add File button fix
 * @lastModified 2026-02-14
 */

import * as React from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { FileText, Loader2, Search, Check, Clock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { formatShortDate } from '@/lib/i18n-date';
import type { Locale } from '@/i18n/config';

// ============================================================================
// Types
// ============================================================================

interface DocumentItem {
  id: string;
  fileName: string;
  status: string;
  cityCode?: string | null;
  createdAt: string;
  updatedAt?: string;
}

interface AddFileDialogProps {
  /** Template Instance ID */
  instanceId: string;
  /** 對話框是否開啟 */
  open: boolean;
  /** 關閉對話框回調 */
  onClose: () => void;
  /** 匹配成功回調 */
  onSuccess?: () => void;
}

// ============================================================================
// Component
// ============================================================================

/**
 * 添加文件對話框
 */
export function AddFileDialog({
  instanceId,
  open,
  onClose,
  onSuccess,
}: AddFileDialogProps) {
  const t = useTranslations('templateInstance');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const queryClient = useQueryClient();

  // --- State ---
  const [documents, setDocuments] = React.useState<DocumentItem[]>([]);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [search, setSearch] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // --- Load unmatched documents ---
  React.useEffect(() => {
    if (!open) return;

    const loadDocuments = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          pageSize: '50',
        });
        if (search) {
          params.set('search', search);
        }

        const response = await fetch(`/api/documents?${params}`);
        if (response.ok) {
          const json = await response.json();
          // API returns { success, data: DocumentSummary[], meta, stats }
          const items = json.data ?? [];
          setDocuments(Array.isArray(items) ? items : []);
        }
      } catch (error) {
        console.error('Failed to load documents', error);
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(loadDocuments, search ? 300 : 0);
    return () => clearTimeout(debounce);
  }, [open, search]);

  // --- Handlers ---
  const handleToggle = React.useCallback((docId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  }, []);

  const handleSubmit = async () => {
    if (selectedIds.size === 0) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/v1/documents/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentIds: Array.from(selectedIds),
          templateInstanceId: instanceId,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.detail || 'Match failed');
      }

      const result = await response.json();
      const data = result.data;
      const successN = data?.successCount ?? 0;
      const errorN = data?.errorCount ?? 0;

      if (errorN > 0 && successN === 0) {
        // All failed
        const errorDetail = data?.errors?.join('; ') || '';
        toast.error(t('toast.addFileError'), {
          description: errorDetail || t('toast.addFileAllFailed', { count: errorN }),
        });
      } else if (errorN > 0 && successN > 0) {
        // Partial success
        toast.warning(
          t('toast.addFilePartial', { success: successN, error: errorN }),
          {
            description: data?.errors?.join('; ') || undefined,
          }
        );
      } else {
        // All succeeded
        toast.success(
          t('toast.addFileSuccess', { count: successN || selectedIds.size })
        );
      }

      // Invalidate both instance detail and rows queries
      await queryClient.invalidateQueries({
        queryKey: ['template-instances', 'detail', instanceId],
      });
      if (successN > 0) {
        onSuccess?.();
      }
      handleClose();
    } catch (error) {
      toast.error(t('toast.addFileError'), {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedIds(new Set());
    setSearch('');
    onClose();
  };

  // --- Render ---
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t('addFileDialog.title')}
          </DialogTitle>
          <DialogDescription>
            {t('addFileDialog.description')}
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('addFileDialog.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Sort info */}
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {t('addFileDialog.sortInfo')}
        </p>

        {/* Document List */}
        <ScrollArea className="h-[400px] rounded-md border">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="mb-2 h-8 w-8" />
              <p className="text-sm">{t('addFileDialog.noDocuments')}</p>
            </div>
          ) : (
            <div className="divide-y">
              {documents.map((doc) => (
                <label
                  key={doc.id}
                  className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors"
                >
                  <Checkbox
                    checked={selectedIds.has(doc.id)}
                    onCheckedChange={() => handleToggle(doc.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium break-all">{doc.fileName}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      {doc.cityCode && <span>{doc.cityCode}</span>}
                      {doc.cityCode && doc.createdAt && <span>·</span>}
                      {doc.createdAt && (
                        <span>{formatShortDate(new Date(doc.createdAt), locale as Locale)}</span>
                      )}
                    </div>
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    {doc.status}
                  </Badge>
                </label>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Selected count */}
        {selectedIds.size > 0 && (
          <p className="text-sm text-muted-foreground">
            {t('addFileDialog.selected', { count: selectedIds.size })}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {tCommon('actions.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={selectedIds.size === 0 || isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            {isSubmitting
              ? t('addFileDialog.adding')
              : t('addFileDialog.addButton', { count: selectedIds.size || 0 })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
