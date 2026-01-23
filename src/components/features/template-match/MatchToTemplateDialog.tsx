'use client';

/**
 * @fileoverview 匹配到模版對話框組件
 * @description
 *   提供對話框介面讓用戶將文件匹配到模版實例
 *
 * @module src/components/features/template-match/MatchToTemplateDialog
 * @since Epic 19 - Story 19.7
 * @lastModified 2026-01-23
 */

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { FileText, Loader2 } from 'lucide-react';
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

interface MatchToTemplateDialogProps {
  /** 選中的文件 ID 列表 */
  documentIds: string[];
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
 * 匹配到模版對話框
 */
export function MatchToTemplateDialog({
  documentIds,
  open,
  onClose,
  onSuccess,
}: MatchToTemplateDialogProps) {
  const t = useTranslations('templateInstance.match');
  const tCommon = useTranslations('common');

  // --- State ---
  const [templates, setTemplates] = React.useState<DataTemplate[]>([]);
  const [instances, setInstances] = React.useState<TemplateInstance[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<string>('');
  const [selectedInstanceId, setSelectedInstanceId] = React.useState<string>('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

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
    if (!selectedInstanceId) {
      toast.error('Please select a template instance');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/v1/documents/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentIds,
          templateInstanceId: selectedInstanceId,
        }),
      });

      if (!response.ok) {
        throw new Error('Match failed');
      }

      const result = await response.json();
      toast.success(
        `${result.data?.successCount || documentIds.length} documents matched successfully`
      );

      onSuccess?.();
      onClose();
    } catch {
      toast.error('Failed to match documents');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedTemplateId('');
    setSelectedInstanceId('');
    onClose();
  };

  // --- Render ---
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t('title')}
          </DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Document Count */}
          <div className="text-sm text-muted-foreground">
            {t('selectedDocuments', { count: documentIds.length })}
          </div>

          {/* Template Selection */}
          <div className="grid gap-2">
            <Label htmlFor="template">{t('selectTemplate')}</Label>
            <Select
              value={selectedTemplateId}
              onValueChange={setSelectedTemplateId}
              disabled={isLoading}
            >
              <SelectTrigger id="template">
                <SelectValue placeholder={t('selectTemplate')} />
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
              <Label htmlFor="instance">{t('selectInstance')}</Label>
              <Select
                value={selectedInstanceId}
                onValueChange={setSelectedInstanceId}
              >
                <SelectTrigger id="instance">
                  <SelectValue placeholder={t('selectInstance')} />
                </SelectTrigger>
                <SelectContent>
                  {instances.map((instance) => (
                    <SelectItem key={instance.id} value={instance.id}>
                      {instance.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="__new__">
                    + {t('createNewInstance')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {tCommon('actions.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedInstanceId || isSubmitting}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? t('matching') : t('matchButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
