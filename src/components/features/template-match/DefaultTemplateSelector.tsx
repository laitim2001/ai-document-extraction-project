'use client';

/**
 * @fileoverview 預設模版選擇器組件
 * @description
 *   允許用戶為公司或文件格式設定預設的數據模版
 *   用於自動匹配功能
 *
 * @module src/components/features/template-match/DefaultTemplateSelector
 * @since Epic 19 - Story 19.7
 * @lastModified 2026-01-23
 */

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// ============================================================================
// Types
// ============================================================================

interface DataTemplate {
  id: string;
  name: string;
}

interface DefaultTemplateSelectorProps {
  /** 當前選中的模版 ID */
  value?: string | null;
  /** 值變更回調 */
  onChange: (templateId: string | null) => void;
  /** 是否顯示儲存按鈕 */
  showSaveButton?: boolean;
  /** 儲存回調 */
  onSave?: (templateId: string | null) => Promise<void>;
  /** 標籤文字 */
  label?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 自定義類名 */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * 預設模版選擇器
 */
export function DefaultTemplateSelector({
  value,
  onChange,
  showSaveButton = false,
  onSave,
  label,
  disabled = false,
  className,
}: DefaultTemplateSelectorProps) {
  const t = useTranslations('templateInstance.defaultTemplate');

  // --- State ---
  const [templates, setTemplates] = React.useState<DataTemplate[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);

  // --- Load Templates ---
  React.useEffect(() => {
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
  }, []);

  // --- Handlers ---
  const handleChange = (newValue: string) => {
    const templateId = newValue === '__none__' ? null : newValue;
    onChange(templateId);
  };

  const handleSave = async () => {
    if (!onSave) return;

    setIsSaving(true);
    try {
      await onSave(value || null);
      toast.success('Default template saved');
    } catch {
      toast.error('Failed to save default template');
    } finally {
      setIsSaving(false);
    }
  };

  // --- Render ---
  return (
    <div className={className}>
      <div className="grid gap-2">
        {label && <Label>{label || t('title')}</Label>}
        <div className="flex gap-2">
          <Select
            value={value || '__none__'}
            onValueChange={handleChange}
            disabled={isLoading || disabled}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder={t('selectPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">{t('none')}</SelectItem>
              {templates.map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {showSaveButton && onSave && (
            <Button
              onClick={handleSave}
              disabled={isSaving || isLoading}
              size="default"
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSaving ? t('saving') : t('saveButton')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
