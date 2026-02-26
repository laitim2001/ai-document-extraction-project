'use client';

/**
 * @fileoverview 目標欄位選擇器組件
 * @description
 *   提供目標欄位（系統欄位）選擇功能：
 *   - 單選模式
 *   - 分類顯示欄位
 *   - 搜尋過濾功能
 *   - 顯示必填標記和資料類型
 *
 * @module src/components/features/mapping-config/TargetFieldSelector
 * @since Epic 13 - Story 13.3
 * @lastModified 2026-01-02
 *
 * @features
 *   - 單選模式
 *   - 欄位分類群組
 *   - 即時搜尋過濾
 *   - 必填標記顯示
 *   - 資料類型顯示
 *
 * @dependencies
 *   - @/components/ui/* - UI 組件
 *   - @/types/field-mapping - 類型定義
 */

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Check, Search, X, ChevronDown, ChevronRight, Asterisk } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { TargetFieldDefinition } from '@/types/field-mapping';
import { cn } from '@/lib/utils';

// ============================================================
// Types
// ============================================================

/**
 * TargetFieldSelector 組件屬性
 */
export interface TargetFieldSelectorProps {
  /** 可用的目標欄位列表 */
  availableFields: TargetFieldDefinition[];
  /** 已選擇的欄位 ID（單選） */
  selectedField: string | null;
  /** 欄位選擇變更回調 */
  onChange: (selectedField: string | null) => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 佔位符文字 */
  placeholder?: string;
  /** 自訂類名 */
  className?: string;
}

// ============================================================
// Constants
// ============================================================

/**
 * 資料類型徽章顏色
 */
const DATA_TYPE_VARIANTS: Record<TargetFieldDefinition['dataType'], 'default' | 'secondary' | 'outline'> = {
  string: 'outline',
  number: 'secondary',
  date: 'default',
  boolean: 'outline',
};

// ============================================================
// Helper Functions
// ============================================================

/**
 * 按分類分組欄位
 */
function groupFieldsByCategory(
  fields: TargetFieldDefinition[],
  defaultCategory: string
): Record<string, TargetFieldDefinition[]> {
  return fields.reduce(
    (acc, field) => {
      const category = field.category || defaultCategory;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(field);
      return acc;
    },
    {} as Record<string, TargetFieldDefinition[]>
  );
}

/**
 * 過濾欄位
 */
function filterFields(
  fields: TargetFieldDefinition[],
  searchTerm: string
): TargetFieldDefinition[] {
  if (!searchTerm.trim()) return fields;

  const lowerSearch = searchTerm.toLowerCase();
  return fields.filter(
    (field) =>
      field.fieldName.toLowerCase().includes(lowerSearch) ||
      field.displayName.toLowerCase().includes(lowerSearch) ||
      field.category.toLowerCase().includes(lowerSearch) ||
      (field.description?.toLowerCase().includes(lowerSearch) ?? false)
  );
}

// ============================================================
// Component
// ============================================================

/**
 * 目標欄位選擇器
 *
 * @description
 *   提供目標欄位選擇功能，僅支援單選模式。
 *   欄位按分類顯示，支援搜尋過濾，並顯示必填標記和資料類型。
 *
 * @example
 * ```tsx
 * <TargetFieldSelector
 *   availableFields={systemFields}
 *   selectedField={rule.targetField}
 *   onChange={(field) => setTargetField(field)}
 * />
 * ```
 */
export function TargetFieldSelector({
  availableFields,
  selectedField,
  onChange,
  disabled = false,
  placeholder,
  className,
}: TargetFieldSelectorProps) {
  // --- i18n ---
  const t = useTranslations('documentPreview');
  const resolvedPlaceholder = placeholder ?? t('targetFieldSelector.placeholder');

  // --- State ---
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [expandedCategories, setExpandedCategories] = React.useState<Set<string>>(
    new Set()
  );

  // --- Derived State ---
  const filteredFields = React.useMemo(
    () => filterFields(availableFields, searchTerm),
    [availableFields, searchTerm]
  );

  const groupedFields = React.useMemo(
    () => groupFieldsByCategory(filteredFields, t('targetFieldSelector.otherCategory')),
    [filteredFields, t]
  );

  const selectedFieldObject = React.useMemo(
    () => availableFields.find((f) => f.id === selectedField) ?? null,
    [selectedField, availableFields]
  );

  // --- Initialize expanded categories ---
  React.useEffect(() => {
    if (Object.keys(groupedFields).length > 0 && expandedCategories.size === 0) {
      setExpandedCategories(new Set(Object.keys(groupedFields)));
    }
  }, [groupedFields, expandedCategories.size]);

  // --- Handlers ---
  const handleSelect = React.useCallback(
    (fieldId: string) => {
      onChange(fieldId);
      setOpen(false);
    },
    [onChange]
  );

  const handleClear = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(null);
    },
    [onChange]
  );

  const toggleCategory = React.useCallback((category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  // --- Render ---
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between',
            !selectedFieldObject && 'text-muted-foreground',
            className
          )}
        >
          <div className="flex flex-1 items-center gap-2 overflow-hidden">
            {selectedFieldObject ? (
              <>
                <span className="truncate">{selectedFieldObject.displayName}</span>
                {selectedFieldObject.required && (
                  <Asterisk className="h-3 w-3 text-destructive" />
                )}
                <Badge
                  variant={DATA_TYPE_VARIANTS[selectedFieldObject.dataType]}
                  className="text-xs"
                >
                  {t(`targetFieldSelector.dataTypes.${selectedFieldObject.dataType}`)}
                </Badge>
              </>
            ) : (
              <span>{resolvedPlaceholder}</span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {selectedField && (
              <X
                className="h-4 w-4 shrink-0 opacity-50 hover:opacity-100"
                onClick={handleClear}
              />
            )}
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Input
              placeholder={t('targetFieldSelector.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 border-0 focus-visible:ring-0"
            />
          </div>

          <CommandList className="max-h-[300px]">
            <CommandEmpty>{t('targetFieldSelector.noResults')}</CommandEmpty>

            {Object.entries(groupedFields).map(([category, fields], index) => (
              <React.Fragment key={category}>
                {index > 0 && <CommandSeparator />}
                <Collapsible
                  open={expandedCategories.has(category)}
                  onOpenChange={() => toggleCategory(category)}
                >
                  <CollapsibleTrigger asChild>
                    <div className="flex cursor-pointer items-center justify-between px-2 py-2 text-sm font-medium text-muted-foreground hover:bg-muted">
                      <span>{category}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {fields.length}
                        </Badge>
                        {expandedCategories.has(category) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CommandGroup>
                      {fields.map((field) => {
                        const isSelected = selectedField === field.id;
                        return (
                          <CommandItem
                            key={field.id}
                            value={field.id}
                            onSelect={() => handleSelect(field.id)}
                            className="flex items-start gap-2 py-2"
                          >
                            <div
                              className={cn(
                                'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                                isSelected
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'border-muted-foreground'
                              )}
                            >
                              {isSelected && <Check className="h-3 w-3" />}
                            </div>
                            <div className="flex flex-1 flex-col gap-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  {field.displayName}
                                </span>
                                {field.required && (
                                  <Asterisk className="h-3 w-3 text-destructive" />
                                )}
                                <Badge
                                  variant={DATA_TYPE_VARIANTS[field.dataType]}
                                  className="text-xs"
                                >
                                  {t(`targetFieldSelector.dataTypes.${field.dataType}`)}
                                </Badge>
                              </div>
                              <div className="flex items-center justify-between">
                                <code className="text-xs text-muted-foreground">
                                  {field.fieldName}
                                </code>
                              </div>
                              {field.description && (
                                <span className="text-xs text-muted-foreground">
                                  {field.description}
                                </span>
                              )}
                            </div>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CollapsibleContent>
                </Collapsible>
              </React.Fragment>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
