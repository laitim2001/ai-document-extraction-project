/**
 * @fileoverview 映射規則編輯器組件
 * @description
 *   管理多條映射規則的編輯器
 *   支援新增、刪除、重新排序
 *
 * @module src/components/features/template-field-mapping
 * @since Epic 19 - Story 19.4
 * @lastModified 2026-01-22
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Plus, AlertCircle } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

import { MappingRuleItem } from './MappingRuleItem';
import type { TemplateField } from './TargetFieldSelector';
import type {
  TemplateFieldMappingRule,
  TemplateFieldMappingRuleInput,
} from '@/types/template-field-mapping';

// ============================================================================
// Types
// ============================================================================

interface MappingRuleEditorProps {
  rules: Partial<TemplateFieldMappingRuleInput>[];
  onChange: (rules: Partial<TemplateFieldMappingRuleInput>[]) => void;
  templateFields: TemplateField[];
  disabled?: boolean;
  error?: string;
  className?: string;
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * @component MappingRuleEditor
 * @description 映射規則編輯器
 */
export function MappingRuleEditor({
  rules,
  onChange,
  templateFields,
  disabled = false,
  error,
  className,
}: MappingRuleEditorProps) {
  const t = useTranslations('templateFieldMapping');

  // Track expanded rules
  const [expandedIndex, setExpandedIndex] = React.useState<number | null>(
    rules.length > 0 ? 0 : null
  );

  // Get used fields
  const usedSourceFields = React.useMemo(
    () => rules.map((r) => r.sourceField).filter(Boolean) as string[],
    [rules]
  );

  const usedTargetFields = React.useMemo(
    () => rules.map((r) => r.targetField).filter(Boolean) as string[],
    [rules]
  );

  // Add new rule
  const handleAddRule = React.useCallback(() => {
    const newRule: Partial<TemplateFieldMappingRuleInput> = {
      sourceField: '',
      targetField: '',
      transformType: 'DIRECT',
      transformParams: null,
      isRequired: false,
      order: rules.length,
      description: '',
    };
    const newRules = [...rules, newRule];
    onChange(newRules);
    setExpandedIndex(newRules.length - 1);
  }, [rules, onChange]);

  // Update rule
  const handleRuleChange = React.useCallback(
    (index: number, updatedRule: Partial<TemplateFieldMappingRuleInput>) => {
      const newRules = rules.map((rule, i) =>
        i === index ? updatedRule : rule
      );
      onChange(newRules);
    },
    [rules, onChange]
  );

  // Delete rule
  const handleDeleteRule = React.useCallback(
    (index: number) => {
      const newRules = rules.filter((_, i) => i !== index);
      // Update order for remaining rules
      const reorderedRules = newRules.map((rule, i) => ({
        ...rule,
        order: i,
      }));
      onChange(reorderedRules);

      // Adjust expanded index
      if (expandedIndex === index) {
        setExpandedIndex(null);
      } else if (expandedIndex !== null && expandedIndex > index) {
        setExpandedIndex(expandedIndex - 1);
      }
    },
    [rules, onChange, expandedIndex]
  );

  // Toggle expand
  const handleExpandToggle = React.useCallback(
    (index: number) => {
      setExpandedIndex(expandedIndex === index ? null : index);
    },
    [expandedIndex]
  );

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base font-medium">
            {t('mappingRules.title')}
          </Label>
          <p className="text-sm text-muted-foreground">
            {t('mappingRules.description', { count: rules.length })}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={handleAddRule}
          disabled={disabled}
        >
          <Plus className="h-4 w-4 mr-2" />
          {t('mappingRules.addRule')}
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Rules List */}
      {rules.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">{t('mappingRules.empty')}</p>
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={handleAddRule}
            disabled={disabled}
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('mappingRules.addFirstRule')}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule, index) => (
            <MappingRuleItem
              key={index}
              rule={rule}
              index={index}
              onChange={(updated) => handleRuleChange(index, updated)}
              onDelete={() => handleDeleteRule(index)}
              templateFields={templateFields}
              usedSourceFields={usedSourceFields}
              usedTargetFields={usedTargetFields}
              isExpanded={expandedIndex === index}
              onExpandToggle={() => handleExpandToggle(index)}
              disabled={disabled}
            />
          ))}
        </div>
      )}

      {/* Summary */}
      {rules.length > 0 && (
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span>
            {t('mappingRules.totalRules', { count: rules.length })}
          </span>
          <span>
            {t('mappingRules.requiredRules', {
              count: rules.filter((r) => r.isRequired).length,
            })}
          </span>
          <span>
            {t('mappingRules.unmappedTemplateFields', {
              count: templateFields.length - usedTargetFields.length,
            })}
          </span>
        </div>
      )}
    </div>
  );
}
