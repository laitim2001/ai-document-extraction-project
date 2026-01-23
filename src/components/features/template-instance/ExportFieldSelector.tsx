'use client';

/**
 * @fileoverview 導出欄位選擇器
 * @description
 *   用於選擇和排序要導出的欄位
 *   支援全選、取消全選、拖拽排序
 *
 * @module src/components/features/template-instance/ExportFieldSelector
 * @since Epic 19 - Story 19.6
 * @lastModified 2026-01-23
 *
 * @features
 *   - 欄位勾選/取消
 *   - 全選/取消全選
 *   - 欄位拖拽排序（可選）
 *   - 欄位數量統計
 *
 * @dependencies
 *   - shadcn/ui components
 */

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { GripVertical, CheckSquare, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { DataTemplateField, DataTemplateFieldType } from '@/types/data-template';

// ============================================================================
// Types
// ============================================================================

interface ExportFieldSelectorProps {
  /** 模版欄位定義 */
  fields: DataTemplateField[];
  /** 已選擇的欄位名稱列表 */
  selectedFields: string[];
  /** 欄位變更回調 */
  onChange: (fields: string[]) => void;
  /** 是否支援拖拽排序 */
  allowReorder?: boolean;
  /** 最大高度 */
  maxHeight?: number;
  /** 自定義類名 */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const FIELD_TYPE_COLORS: Record<DataTemplateFieldType, string> = {
  string: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  number: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  date: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  currency: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  boolean: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300',
  array: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300',
};

// ============================================================================
// Component
// ============================================================================

/**
 * 導出欄位選擇器
 */
export function ExportFieldSelector({
  fields,
  selectedFields,
  onChange,
  allowReorder = false,
  maxHeight = 200,
  className,
}: ExportFieldSelectorProps) {
  const t = useTranslations('templateInstance');

  // --- Computed ---
  const isAllSelected = selectedFields.length === fields.length;
  const isNoneSelected = selectedFields.length === 0;

  // Build ordered fields based on selectedFields order
  const orderedFields = React.useMemo(() => {
    if (!allowReorder) {
      return fields.sort((a, b) => a.order - b.order);
    }

    // For reordering, preserve the order of selectedFields
    const selectedSet = new Set(selectedFields);
    const selected = selectedFields
      .map((name) => fields.find((f) => f.name === name))
      .filter((f): f is DataTemplateField => f !== undefined);
    const unselected = fields
      .filter((f) => !selectedSet.has(f.name))
      .sort((a, b) => a.order - b.order);

    return [...selected, ...unselected];
  }, [fields, selectedFields, allowReorder]);

  // --- Handlers ---
  const handleToggleField = React.useCallback(
    (fieldName: string, checked: boolean) => {
      if (checked) {
        onChange([...selectedFields, fieldName]);
      } else {
        onChange(selectedFields.filter((f) => f !== fieldName));
      }
    },
    [selectedFields, onChange]
  );

  const handleSelectAll = React.useCallback(() => {
    onChange(fields.map((f) => f.name));
  }, [fields, onChange]);

  const handleDeselectAll = React.useCallback(() => {
    onChange([]);
  }, [onChange]);

  const handleResetToDefault = React.useCallback(() => {
    onChange(fields.sort((a, b) => a.order - b.order).map((f) => f.name));
  }, [fields, onChange]);

  // --- Drag and Drop handlers (basic implementation) ---
  const [draggedField, setDraggedField] = React.useState<string | null>(null);

  const handleDragStart = React.useCallback(
    (e: React.DragEvent, fieldName: string) => {
      if (!allowReorder) return;
      setDraggedField(fieldName);
      e.dataTransfer.effectAllowed = 'move';
    },
    [allowReorder]
  );

  const handleDragOver = React.useCallback(
    (e: React.DragEvent, targetFieldName: string) => {
      if (!allowReorder || !draggedField || draggedField === targetFieldName) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    },
    [allowReorder, draggedField]
  );

  const handleDrop = React.useCallback(
    (e: React.DragEvent, targetFieldName: string) => {
      if (!allowReorder || !draggedField || draggedField === targetFieldName) return;
      e.preventDefault();

      const newOrder = [...selectedFields];
      const draggedIndex = newOrder.indexOf(draggedField);
      const targetIndex = newOrder.indexOf(targetFieldName);

      if (draggedIndex === -1 || targetIndex === -1) {
        setDraggedField(null);
        return;
      }

      newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, draggedField);
      onChange(newOrder);
      setDraggedField(null);
    },
    [allowReorder, draggedField, selectedFields, onChange]
  );

  const handleDragEnd = React.useCallback(() => {
    setDraggedField(null);
  }, []);

  // --- Render ---
  return (
    <div className={cn('space-y-3', className)}>
      {/* Actions */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {t('export.fields.selected', {
            selected: selectedFields.length,
            total: fields.length,
          })}
        </span>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSelectAll}
            disabled={isAllSelected}
          >
            <CheckSquare className="mr-1 h-4 w-4" />
            {t('export.fields.selectAll')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDeselectAll}
            disabled={isNoneSelected}
          >
            <Square className="mr-1 h-4 w-4" />
            {t('export.fields.deselectAll')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetToDefault}
          >
            {t('export.fields.reset')}
          </Button>
        </div>
      </div>

      {/* Field List */}
      <ScrollArea className="rounded-md border" style={{ maxHeight }}>
        <div className="p-2 space-y-1">
          {orderedFields.map((field) => {
            const isSelected = selectedFields.includes(field.name);

            return (
              <div
                key={field.name}
                draggable={allowReorder && isSelected}
                onDragStart={(e) => handleDragStart(e, field.name)}
                onDragOver={(e) => handleDragOver(e, field.name)}
                onDrop={(e) => handleDrop(e, field.name)}
                onDragEnd={handleDragEnd}
                className={cn(
                  'flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors',
                  isSelected && 'bg-muted/30',
                  draggedField === field.name && 'opacity-50'
                )}
              >
                {/* Drag Handle */}
                {allowReorder && isSelected && (
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                )}

                {/* Checkbox */}
                <Checkbox
                  id={`field-${field.name}`}
                  checked={isSelected}
                  onCheckedChange={(checked) =>
                    handleToggleField(field.name, checked === true)
                  }
                />

                {/* Field Info */}
                <Label
                  htmlFor={`field-${field.name}`}
                  className="flex-1 cursor-pointer flex items-center gap-2"
                >
                  <span>{field.label}</span>
                  <span className="text-xs text-muted-foreground">
                    ({field.name})
                  </span>
                </Label>

                {/* Field Type Badge */}
                <Badge
                  variant="outline"
                  className={cn('text-xs', FIELD_TYPE_COLORS[field.dataType])}
                >
                  {field.dataType}
                </Badge>

                {/* Required indicator */}
                {field.isRequired && (
                  <span className="text-xs text-red-500">*</span>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Warning if no fields selected */}
      {isNoneSelected && (
        <p className="text-sm text-destructive">
          {t('export.fields.noFieldsWarning')}
        </p>
      )}
    </div>
  );
}
