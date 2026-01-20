/**
 * @fileoverview 數據模版欄位編輯器組件（國際化版本）
 * @description
 *   提供欄位定義的新增、編輯、刪除、排序功能
 *   - i18n 國際化支援 (Epic 17)
 *
 * @module src/components/features/data-template/DataTemplateFieldEditor
 * @since Epic 16 - Story 16.7
 * @lastModified 2026-01-20
 *
 * @features
 *   - 新增/編輯/刪除欄位
 *   - 拖拽排序（簡化版：使用上下按鈕）
 *   - 即時驗證
 *   - 欄位類型選擇
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  GripVertical,
  Type,
  Hash,
  Calendar,
  DollarSign,
  ToggleLeft,
  List,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type {
  DataTemplateField,
  DataTemplateFieldType,
} from '@/types/data-template';

// ============================================================================
// Types
// ============================================================================

export interface DataTemplateFieldEditorProps {
  /** 欄位列表 */
  fields: DataTemplateField[];
  /** 欄位變更回調 */
  onChange: (fields: DataTemplateField[]) => void;
  /** 是否唯讀 */
  readOnly?: boolean;
  /** 錯誤訊息 */
  error?: string;
}

// ============================================================================
// Constants
// ============================================================================

const TYPE_ICONS: Record<DataTemplateFieldType, React.ComponentType<{ className?: string }>> = {
  string: Type,
  number: Hash,
  date: Calendar,
  currency: DollarSign,
  boolean: ToggleLeft,
  array: List,
};

// ============================================================================
// Component
// ============================================================================

export function DataTemplateFieldEditor({
  fields,
  onChange,
  readOnly = false,
  error,
}: DataTemplateFieldEditorProps) {
  const t = useTranslations('dataTemplates');

  // --- Field Type Options (i18n) ---
  const fieldTypeOptions: Array<{ value: DataTemplateFieldType; label: string }> = [
    { value: 'string', label: t('fieldTypes.string') },
    { value: 'number', label: t('fieldTypes.number') },
    { value: 'date', label: t('fieldTypes.date') },
    { value: 'currency', label: t('fieldTypes.currency') },
    { value: 'boolean', label: t('fieldTypes.boolean') },
    { value: 'array', label: t('fieldTypes.array') },
  ];

  // --- Default Field ---
  const createDefaultField = React.useCallback(
    (order: number): DataTemplateField => ({
      name: `field_${order}`,
      label: t('fieldEditor.defaultFieldLabel', { number: order }),
      dataType: 'string',
      isRequired: false,
      order,
    }),
    [t]
  );

  // --- Handlers ---

  /** 新增欄位 */
  const handleAdd = React.useCallback(() => {
    const newField = createDefaultField(fields.length + 1);
    onChange([...fields, newField]);
  }, [fields, onChange, createDefaultField]);

  /** 更新欄位 */
  const handleUpdate = React.useCallback(
    (index: number, updates: Partial<DataTemplateField>) => {
      const newFields = [...fields];
      newFields[index] = { ...newFields[index], ...updates };
      onChange(newFields);
    },
    [fields, onChange]
  );

  /** 刪除欄位 */
  const handleDelete = React.useCallback(
    (index: number) => {
      const newFields = fields.filter((_, i) => i !== index);
      // 重新排序
      onChange(
        newFields.map((f, i) => ({ ...f, order: i + 1 }))
      );
    },
    [fields, onChange]
  );

  /** 上移 */
  const handleMoveUp = React.useCallback(
    (index: number) => {
      if (index === 0) return;
      const newFields = [...fields];
      [newFields[index - 1], newFields[index]] = [
        newFields[index],
        newFields[index - 1],
      ];
      onChange(
        newFields.map((f, i) => ({ ...f, order: i + 1 }))
      );
    },
    [fields, onChange]
  );

  /** 下移 */
  const handleMoveDown = React.useCallback(
    (index: number) => {
      if (index === fields.length - 1) return;
      const newFields = [...fields];
      [newFields[index], newFields[index + 1]] = [
        newFields[index + 1],
        newFields[index],
      ];
      onChange(
        newFields.map((f, i) => ({ ...f, order: i + 1 }))
      );
    },
    [fields, onChange]
  );

  // --- Render ---
  return (
    <div className="space-y-4">
      {/* 標題和新增按鈕 */}
      <div className="flex items-center justify-between">
        <Label className="text-base font-medium">{t('fieldEditor.title')}</Label>
        {!readOnly && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAdd}
          >
            <Plus className="h-4 w-4 mr-1" />
            {t('fieldEditor.addField')}
          </Button>
        )}
      </div>

      {/* 錯誤訊息 */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* 欄位列表 */}
      {fields.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground">
            {t('fieldEditor.emptyState')}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {fields.map((field, index) => (
            <FieldRow
              key={`${field.name}-${index}`}
              field={field}
              index={index}
              total={fields.length}
              readOnly={readOnly}
              fieldTypeOptions={fieldTypeOptions}
              onUpdate={(updates) => handleUpdate(index, updates)}
              onDelete={() => handleDelete(index)}
              onMoveUp={() => handleMoveUp(index)}
              onMoveDown={() => handleMoveDown(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// FieldRow Sub-Component
// ============================================================================

interface FieldRowProps {
  field: DataTemplateField;
  index: number;
  total: number;
  readOnly: boolean;
  fieldTypeOptions: Array<{ value: DataTemplateFieldType; label: string }>;
  onUpdate: (updates: Partial<DataTemplateField>) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function FieldRow({
  field,
  index,
  total,
  readOnly,
  fieldTypeOptions,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
}: FieldRowProps) {
  const t = useTranslations('dataTemplates');
  const TypeIcon = TYPE_ICONS[field.dataType];

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* 排序控制 */}
          {!readOnly && (
            <div className="flex flex-col items-center gap-1 pt-1">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={onMoveUp}
                disabled={index === 0}
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={onMoveDown}
                disabled={index === total - 1}
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* 欄位內容 */}
          <div className="flex-1 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* 欄位名稱 */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t('fieldEditor.fieldName')}</Label>
              <Input
                value={field.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                placeholder="field_name"
                disabled={readOnly}
                className={cn(
                  'font-mono text-sm',
                  readOnly && 'bg-muted'
                )}
              />
            </div>

            {/* 顯示標籤 */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t('fieldEditor.fieldLabel')}</Label>
              <Input
                value={field.label}
                onChange={(e) => onUpdate({ label: e.target.value })}
                placeholder={t('fieldEditor.fieldLabel')}
                disabled={readOnly}
                className={cn(readOnly && 'bg-muted')}
              />
            </div>

            {/* 資料類型 */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t('fieldEditor.dataType')}</Label>
              <Select
                value={field.dataType}
                onValueChange={(value) =>
                  onUpdate({ dataType: value as DataTemplateFieldType })
                }
                disabled={readOnly}
              >
                <SelectTrigger className={cn(readOnly && 'bg-muted')}>
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      <TypeIcon className="h-4 w-4" />
                      {fieldTypeOptions.find((o) => o.value === field.dataType)?.label}
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {fieldTypeOptions.map((option) => {
                    const Icon = TYPE_ICONS[option.value];
                    return (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {option.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* 必填選項 */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t('fieldEditor.options')}</Label>
              <div className="flex items-center gap-2 h-10">
                <Checkbox
                  id={`required-${index}`}
                  checked={field.isRequired}
                  onCheckedChange={(checked) =>
                    onUpdate({ isRequired: checked === true })
                  }
                  disabled={readOnly}
                />
                <Label
                  htmlFor={`required-${index}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {t('fieldEditor.required')}
                </Label>
              </div>
            </div>
          </div>

          {/* 刪除按鈕 */}
          {!readOnly && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
