/**
 * @fileoverview 轉換配置編輯器組件
 * @description
 *   根據轉換類型顯示對應的配置編輯器
 *   支援 DIRECT、FORMULA、LOOKUP 等類型
 *
 * @module src/components/features/template-field-mapping
 * @since Epic 19 - Story 19.4
 * @lastModified 2026-01-22
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { FormulaEditor } from './FormulaEditor';
import { LookupTableEditor } from './LookupTableEditor';
import type {
  FieldTransformType,
  TransformParams,
  FormulaTransformParams,
  LookupTransformParams,
  ConcatTransformParams,
  SplitTransformParams,
  CustomTransformParams,
} from '@/types/template-field-mapping';
import { TRANSFORM_TYPE_OPTIONS } from '@/types/template-field-mapping';

// ============================================================================
// Types
// ============================================================================

interface TransformConfigEditorProps {
  transformType: FieldTransformType;
  transformParams: TransformParams;
  onTransformTypeChange: (type: FieldTransformType) => void;
  onTransformParamsChange: (params: TransformParams) => void;
  availableFields?: string[];
  disabled?: boolean;
  errors?: Record<string, string>;
  className?: string;
}

// ============================================================================
// Helper Components
// ============================================================================

/**
 * CONCAT 轉換配置
 */
function ConcatConfigEditor({
  params,
  onChange,
  disabled,
}: {
  params: ConcatTransformParams | null;
  onChange: (params: ConcatTransformParams) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('templateFieldMapping');

  const handleFieldsChange = (value: string) => {
    const fields = value
      .split(',')
      .map((f) => f.trim())
      .filter(Boolean);
    onChange({
      fields,
      separator: params?.separator ?? '',
    });
  };

  const handleSeparatorChange = (value: string) => {
    onChange({
      fields: params?.fields ?? [],
      separator: value,
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm font-medium">{t('concat.fields')}</Label>
        <Input
          value={params?.fields?.join(', ') ?? ''}
          onChange={(e) => handleFieldsChange(e.target.value)}
          placeholder={t('concat.fieldsPlaceholder')}
          disabled={disabled}
        />
        <p className="text-xs text-muted-foreground">{t('concat.fieldsHelp')}</p>
      </div>
      <div className="space-y-2">
        <Label className="text-sm font-medium">{t('concat.separator')}</Label>
        <Input
          value={params?.separator ?? ''}
          onChange={(e) => handleSeparatorChange(e.target.value)}
          placeholder={t('concat.separatorPlaceholder')}
          disabled={disabled}
          className="max-w-[200px]"
        />
      </div>
    </div>
  );
}

/**
 * SPLIT 轉換配置
 */
function SplitConfigEditor({
  params,
  onChange,
  disabled,
}: {
  params: SplitTransformParams | null;
  onChange: (params: SplitTransformParams) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('templateFieldMapping');

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm font-medium">{t('split.separator')}</Label>
        <Input
          value={params?.separator ?? ''}
          onChange={(e) =>
            onChange({
              separator: e.target.value,
              index: params?.index ?? 0,
            })
          }
          placeholder={t('split.separatorPlaceholder')}
          disabled={disabled}
          className="max-w-[200px]"
        />
      </div>
      <div className="space-y-2">
        <Label className="text-sm font-medium">{t('split.index')}</Label>
        <Input
          type="number"
          min={0}
          value={params?.index ?? 0}
          onChange={(e) =>
            onChange({
              separator: params?.separator ?? '',
              index: parseInt(e.target.value, 10) || 0,
            })
          }
          disabled={disabled}
          className="max-w-[100px]"
        />
        <p className="text-xs text-muted-foreground">{t('split.indexHelp')}</p>
      </div>
    </div>
  );
}

/**
 * CUSTOM 轉換配置
 */
function CustomConfigEditor({
  params,
  onChange,
  disabled,
}: {
  params: CustomTransformParams | null;
  onChange: (params: CustomTransformParams) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('templateFieldMapping');

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{t('custom.expression')}</Label>
      <Textarea
        value={params?.expression ?? ''}
        onChange={(e) => onChange({ expression: e.target.value })}
        placeholder={t('custom.expressionPlaceholder')}
        disabled={disabled}
        className="font-mono text-sm min-h-[80px]"
      />
      <p className="text-xs text-muted-foreground">{t('custom.expressionHelp')}</p>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * @component TransformConfigEditor
 * @description 轉換配置編輯器
 */
export function TransformConfigEditor({
  transformType,
  transformParams,
  onTransformTypeChange,
  onTransformParamsChange,
  availableFields,
  disabled = false,
  errors,
  className,
}: TransformConfigEditorProps) {
  const t = useTranslations('templateFieldMapping');

  // Handle transform type change
  const handleTypeChange = React.useCallback(
    (type: FieldTransformType) => {
      onTransformTypeChange(type);

      // Reset params based on new type
      switch (type) {
        case 'DIRECT':
          onTransformParamsChange(null);
          break;
        case 'FORMULA':
          onTransformParamsChange({ formula: '' });
          break;
        case 'LOOKUP':
          onTransformParamsChange({ lookupTable: {} });
          break;
        case 'CONCAT':
          onTransformParamsChange({ fields: [], separator: '' });
          break;
        case 'SPLIT':
          onTransformParamsChange({ separator: '', index: 0 });
          break;
        case 'CUSTOM':
          onTransformParamsChange({ expression: '' });
          break;
      }
    },
    [onTransformTypeChange, onTransformParamsChange]
  );

  // Render config editor based on type
  const renderConfigEditor = () => {
    switch (transformType) {
      case 'DIRECT':
        return (
          <p className="text-sm text-muted-foreground">
            {t('direct.description')}
          </p>
        );

      case 'FORMULA':
        return (
          <FormulaEditor
            value={(transformParams as FormulaTransformParams)?.formula ?? ''}
            onChange={(formula) => onTransformParamsChange({ formula })}
            availableFields={availableFields}
            disabled={disabled}
            error={errors?.formula}
          />
        );

      case 'LOOKUP':
        return (
          <LookupTableEditor
            value={(transformParams as LookupTransformParams)?.lookupTable ?? {}}
            onChange={(lookupTable) =>
              onTransformParamsChange({
                lookupTable,
                defaultValue: (transformParams as LookupTransformParams)?.defaultValue,
              })
            }
            defaultValue={(transformParams as LookupTransformParams)?.defaultValue}
            onDefaultValueChange={(defaultValue) =>
              onTransformParamsChange({
                lookupTable: (transformParams as LookupTransformParams)?.lookupTable ?? {},
                defaultValue,
              })
            }
            disabled={disabled}
            error={errors?.lookupTable}
          />
        );

      case 'CONCAT':
        return (
          <ConcatConfigEditor
            params={transformParams as ConcatTransformParams}
            onChange={onTransformParamsChange}
            disabled={disabled}
          />
        );

      case 'SPLIT':
        return (
          <SplitConfigEditor
            params={transformParams as SplitTransformParams}
            onChange={onTransformParamsChange}
            disabled={disabled}
          />
        );

      case 'CUSTOM':
        return (
          <CustomConfigEditor
            params={transformParams as CustomTransformParams}
            onChange={onTransformParamsChange}
            disabled={disabled}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Transform Type Selector */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">{t('transformType.label')}</Label>
        <Select
          value={transformType}
          onValueChange={(value) => handleTypeChange(value as FieldTransformType)}
          disabled={disabled}
        >
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder={t('transformType.placeholder')} />
          </SelectTrigger>
          <SelectContent>
            {TRANSFORM_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <div className="flex flex-col">
                  <span>{t(`transformType.${option.value.toLowerCase()}`)}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Config Editor */}
      <div className="rounded-md border p-4 bg-muted/30">
        {renderConfigEditor()}
      </div>
    </div>
  );
}
