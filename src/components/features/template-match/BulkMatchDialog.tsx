'use client';

/**
 * @fileoverview 批量匹配對話框組件
 * @description
 *   提供對話框介面讓用戶批量將多個文件匹配到同一模版實例
 *   顯示處理進度和結果統計
 *
 * @module src/components/features/template-match/BulkMatchDialog
 * @since Epic 19 - Story 19.7
 * @lastModified 2026-01-23
 */

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { FileText, Loader2, CheckCircle, XCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';

// ============================================================================
// Types
// ============================================================================

interface DataTemplate {
  id: string;
  name: string;
}

interface TemplateInstance {
  id: string;
  name: string;
  dataTemplateId: string;
  status: string;
}

interface MatchResult {
  totalDocuments: number;
  successCount: number;
  errorCount: number;
}

interface BulkMatchDialogProps {
  /** 選中的文件 ID 列表（最多 500 個） */
  documentIds: string[];
  /** 對話框是否開啟 */
  open: boolean;
  /** 關閉對話框回調 */
  onClose: () => void;
  /** 匹配成功回調 */
  onSuccess?: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const MAX_DOCUMENTS = 500;

// ============================================================================
// Component
// ============================================================================

/**
 * 批量匹配對話框
 */
export function BulkMatchDialog({
  documentIds,
  open,
  onClose,
  onSuccess,
}: BulkMatchDialogProps) {
  const t = useTranslations('templateInstance');
  const tCommon = useTranslations('common');

  // --- State ---
  const [templates, setTemplates] = React.useState<DataTemplate[]>([]);
  const [instances, setInstances] = React.useState<TemplateInstance[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<string>('');
  const [selectedInstanceId, setSelectedInstanceId] = React.useState<string>('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [result, setResult] = React.useState<MatchResult | null>(null);

  // --- Validation ---
  const documentCount = documentIds.length;
  const isOverLimit = documentCount > MAX_DOCUMENTS;

  // --- Load Templates ---
  React.useEffect(() => {
    if (!open) return;

    const loadTemplates = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/v1/data-templates/available');
        if (response.ok) {
          const data = await response.json();
          setTemplates(data.data || []);
        }
      } catch (error) {
        console.error('Failed to load templates', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTemplates();
  }, [open]);

  // --- Load Instances when Template Selected ---
  React.useEffect(() => {
    if (!selectedTemplateId) {
      setInstances([]);
      setSelectedInstanceId('');
      return;
    }

    const loadInstances = async () => {
      try {
        const response = await fetch(
          `/api/v1/template-instances?dataTemplateId=${selectedTemplateId}&status=DRAFT,ACTIVE`
        );
        if (response.ok) {
          const data = await response.json();
          setInstances(data.data?.items || []);
        }
      } catch (error) {
        console.error('Failed to load instances', error);
      }
    };

    loadInstances();
  }, [selectedTemplateId]);

  // --- Handlers ---
  const handleSubmit = async () => {
    if (!selectedInstanceId || isOverLimit) {
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setResult(null);

    try {
      const response = await fetch('/api/v1/documents/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentIds,
          templateInstanceId: selectedInstanceId,
          options: {
            batchSize: 50,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Batch match failed');
      }

      const data = await response.json();
      const matchResult: MatchResult = {
        totalDocuments: data.data?.totalDocuments || documentCount,
        successCount: data.data?.successCount || 0,
        errorCount: data.data?.errorCount || 0,
      };

      setResult(matchResult);
      setProgress(100);

      if (matchResult.successCount > 0) {
        toast.success(
          t('bulkMatch.results.success', { count: matchResult.successCount })
        );
        onSuccess?.();
      }
    } catch {
      toast.error('Batch match failed');
      setResult({
        totalDocuments: documentCount,
        successCount: 0,
        errorCount: documentCount,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (isProcessing) return;
    setSelectedTemplateId('');
    setSelectedInstanceId('');
    setProgress(0);
    setResult(null);
    onClose();
  };

  // --- Render ---
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t('bulkMatch.title')}
          </DialogTitle>
          <DialogDescription>{t('bulkMatch.description')}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Document Count & Limit Warning */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {t('match.selectedDocuments', { count: documentCount })}
            </span>
            {isOverLimit && (
              <span className="text-destructive">
                {t('bulkMatch.maxDocuments', { max: MAX_DOCUMENTS })}
              </span>
            )}
          </div>

          {/* Template Selection */}
          <div className="grid gap-2">
            <Label htmlFor="template">{t('match.selectTemplate')}</Label>
            <Select
              value={selectedTemplateId}
              onValueChange={setSelectedTemplateId}
              disabled={isLoading || isProcessing}
            >
              <SelectTrigger id="template">
                <SelectValue placeholder={t('match.selectTemplate')} />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Instance Selection */}
          {selectedTemplateId && (
            <div className="grid gap-2">
              <Label htmlFor="instance">{t('match.selectInstance')}</Label>
              <Select
                value={selectedInstanceId}
                onValueChange={setSelectedInstanceId}
                disabled={isProcessing}
              >
                <SelectTrigger id="instance">
                  <SelectValue placeholder={t('match.selectInstance')} />
                </SelectTrigger>
                <SelectContent>
                  {instances.map((instance) => (
                    <SelectItem key={instance.id} value={instance.id}>
                      {instance.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="__new__">
                    + {t('match.createNewInstance')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Progress Bar */}
          {isProcessing && (
            <div className="grid gap-2">
              <Progress value={progress} className="h-2" />
              <p className="text-sm text-muted-foreground">
                {t('bulkMatch.progress', {
                  current: Math.round((progress / 100) * documentCount),
                  total: documentCount,
                })}
              </p>
            </div>
          )}

          {/* Results */}
          {result && (
            <Alert variant={result.errorCount > 0 ? 'destructive' : 'default'}>
              {result.errorCount > 0 ? (
                <XCircle className="h-4 w-4" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              <AlertTitle>{t('bulkMatch.results.title')}</AlertTitle>
              <AlertDescription>
                <div className="mt-2 space-y-1">
                  <p className="text-green-600 dark:text-green-400">
                    {t('bulkMatch.results.success', { count: result.successCount })}
                  </p>
                  {result.errorCount > 0 && (
                    <p className="text-destructive">
                      {t('bulkMatch.results.errors', { count: result.errorCount })}
                    </p>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isProcessing}
          >
            {result ? tCommon('actions.close') : tCommon('actions.cancel')}
          </Button>
          {!result && (
            <Button
              onClick={handleSubmit}
              disabled={!selectedInstanceId || isProcessing || isOverLimit}
            >
              {isProcessing && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isProcessing ? t('match.matching') : t('match.matchButton')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
