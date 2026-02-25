'use client';

/**
 * @fileoverview 單欄位條目編輯器
 * @description
 *   用於編輯 FieldDefinitionEntry 的單欄位屬性：
 *   - label、required 切換
 *   - aliases（以逗號分隔）
 *   - extractionHints（AI 提示）
 *   - 可摺疊的詳細編輯區
 *
 * @module src/components/features/field-definition-set/FieldEntryEditor
 * @since CHANGE-042 Phase 3
 * @lastModified 2026-02-23
 *
 * @dependencies
 *   - next-intl - 國際化
 *   - @/components/ui/* - shadcn/ui 組件
 */

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { FieldDefinitionEntry, FieldDefinitionFieldType } from '@/types/extraction-v3.types';

// ============================================================
// Types
// ============================================================

interface FieldEntryEditorProps {
  entry: FieldDefinitionEntry;
  onChange: (updated: FieldDefinitionEntry) => void;
  onRemove: () => void;
}

// ============================================================
// Component
// ============================================================

export function FieldEntryEditor({
  entry,
  onChange,
  onRemove,
}: FieldEntryEditorProps) {
  const t = useTranslations('fieldDefinitionSet');
  const [expanded, setExpanded] = React.useState(false);

  const handleChange = React.useCallback(
    (patch: Partial<FieldDefinitionEntry>) => {
      onChange({ ...entry, ...patch });
    },
    [entry, onChange]
  );

  return (
    <div className="border rounded-md p-3 space-y-2">
      {/* Header row */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{entry.label}</span>
            <span className="text-xs text-muted-foreground font-mono">
              {entry.key}
            </span>
            <Badge variant="outline" className="text-xs">
              {t(`dataType.${entry.dataType}` as Parameters<typeof t>[0])}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {t(`category.${entry.category}` as Parameters<typeof t>[0])}
            </Badge>
            {entry.fieldType === 'lineItem' && (
              <Badge variant="default" className="text-xs">
                {t('form.fieldEntry.fieldTypeLineItem')}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <label className="text-xs text-muted-foreground">
            {t('form.fieldEntry.required')}
          </label>
          <Switch
            checked={entry.required}
            onCheckedChange={(checked) => handleChange({ required: checked })}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="pl-8 space-y-3">
          {/* Label */}
          <div className="space-y-1">
            <label className="text-xs font-medium">
              {t('form.fieldEntry.label')}
            </label>
            <Input
              value={entry.label}
              onChange={(e) => handleChange({ label: e.target.value })}
              className="h-8 text-sm"
            />
          </div>

          {/* Field Type (CHANGE-045) */}
          <div className="space-y-1">
            <label className="text-xs font-medium">
              {t('form.fieldEntry.fieldType')}
            </label>
            <Select
              value={entry.fieldType ?? 'standard'}
              onValueChange={(v) =>
                handleChange({ fieldType: v as FieldDefinitionFieldType })
              }
            >
              <SelectTrigger className="h-8 text-sm w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">
                  {t('form.fieldEntry.fieldTypeStandard')}
                </SelectItem>
                <SelectItem value="lineItem">
                  {t('form.fieldEntry.fieldTypeLineItem')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Aliases */}
          <div className="space-y-1">
            <label className="text-xs font-medium">
              {t('form.fieldEntry.aliases')}
            </label>
            <Input
              value={entry.aliases?.join(', ') ?? ''}
              onChange={(e) =>
                handleChange({
                  aliases: e.target.value
                    ? e.target.value.split(',').map((s) => s.trim())
                    : [],
                })
              }
              placeholder={t('form.fieldEntry.aliasesPlaceholder')}
              className="h-8 text-sm"
            />
          </div>

          {/* Extraction Hints */}
          <div className="space-y-1">
            <label className="text-xs font-medium">
              {t('form.fieldEntry.extractionHints')}
            </label>
            <Textarea
              value={entry.extractionHints ?? ''}
              onChange={(e) =>
                handleChange({
                  extractionHints: e.target.value || undefined,
                })
              }
              placeholder={t('form.fieldEntry.extractionHintsPlaceholder')}
              rows={2}
              className="text-sm resize-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}
