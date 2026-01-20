'use client';

/**
 * @fileoverview 來源欄位選擇器組件
 * @description
 *   提供來源欄位選擇功能：
 *   - 支援單選和多選模式
 *   - 分類顯示欄位
 *   - 搜尋過濾功能
 *   - 顯示欄位範例值
 *
 * @module src/components/features/mapping-config/SourceFieldSelector
 * @since Epic 13 - Story 13.3
 * @lastModified 2026-01-02
 *
 * @features
 *   - 單選/多選模式
 *   - 欄位分類群組
 *   - 即時搜尋過濾
 *   - 範例值預覽
 *
 * @dependencies
 *   - @/components/ui/* - UI 組件
 *   - @/types/field-mapping - 類型定義
 */

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Check, Search, X, Plus, ChevronDown, ChevronRight } from 'lucide-react';
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
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { SourceFieldDefinition } from '@/types/field-mapping';
import { cn } from '@/lib/utils';

// ============================================================
// Types
// ============================================================

/**
 * SourceFieldSelector 組件屬性
 */
export interface SourceFieldSelectorProps {
  /** 可用的來源欄位列表 */
  availableFields: SourceFieldDefinition[];
  /** 已選擇的欄位 ID 列表 */
  selectedFields: string[];
  /** 欄位選擇變更回調 */
  onChange: (selectedFields: string[]) => void;
  /** 是否允許多選 */
  multiple?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 佔位符文字 */
  placeholder?: string;
  /** 自訂類名 */
  className?: string;
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 按分類分組欄位
 */
function groupFieldsByCategory(
  fields: SourceFieldDefinition[],
  defaultCategory: string
): Record<string, SourceFieldDefinition[]> {
  return fields.reduce(
    (acc, field) => {
      const category = field.category || defaultCategory;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(field);
      return acc;
    },
    {} as Record<string, SourceFieldDefinition[]>
  );
}

/**
 * 過濾欄位
 */
function filterFields(
  fields: SourceFieldDefinition[],
  searchTerm: string
): SourceFieldDefinition[] {
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
 * 來源欄位選擇器
 *
 * @description
 *   提供來源欄位選擇功能，支援單選和多選模式。
 *   欄位按分類顯示，支援搜尋過濾。
 *
 * @example
 * ```tsx
 * <SourceFieldSelector
 *   availableFields={extractedFields}
 *   selectedFields={rule.sourceFields}
 *   onChange={(fields) => setSourceFields(fields)}
 *   multiple={transformType === 'CONCAT'}
 * />
 * ```
 */
export function SourceFieldSelector({
  availableFields,
  selectedFields,
  onChange,
  multiple = false,
  disabled = false,
  placeholder,
  className,
}: SourceFieldSelectorProps) {
  // --- i18n ---
  const t = useTranslations('documentPreview');
  const resolvedPlaceholder = placeholder ?? t('sourceFieldSelector.placeholder');

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
    () => groupFieldsByCategory(filteredFields, t('sourceFieldSelector.otherCategory')),
    [filteredFields, t]
  );

  const selectedFieldObjects = React.useMemo(
    () =>
      selectedFields
        .map((id) => availableFields.find((f) => f.id === id))
        .filter(Boolean) as SourceFieldDefinition[],
    [selectedFields, availableFields]
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
      if (multiple) {
        // 多選模式
        if (selectedFields.includes(fieldId)) {
          onChange(selectedFields.filter((id) => id !== fieldId));
        } else {
          onChange([...selectedFields, fieldId]);
        }
      } else {
        // 單選模式
        onChange([fieldId]);
        setOpen(false);
      }
    },
    [multiple, selectedFields, onChange]
  );

  const handleRemove = React.useCallback(
    (fieldId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(selectedFields.filter((id) => id !== fieldId));
    },
    [selectedFields, onChange]
  );

  const handleClear = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange([]);
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
            selectedFields.length === 0 && 'text-muted-foreground',
            className
          )}
        >
          <div className="flex flex-1 flex-wrap items-center gap-1 overflow-hidden">
            {selectedFieldObjects.length === 0 ? (
              <span>{resolvedPlaceholder}</span>
            ) : multiple ? (
              selectedFieldObjects.map((field) => (
                <Badge
                  key={field.id}
                  variant="secondary"
                  className="mr-1 flex items-center gap-1"
                >
                  <span className="max-w-[100px] truncate">
                    {field.displayName}
                  </span>
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={(e) => handleRemove(field.id, e)}
                  />
                </Badge>
              ))
            ) : (
              <span className="truncate">
                {selectedFieldObjects[0]?.displayName}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {selectedFields.length > 0 && (
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
              placeholder={t('sourceFieldSelector.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 border-0 focus-visible:ring-0"
            />
          </div>

          <CommandList className="max-h-[300px]">
            <CommandEmpty>{t('sourceFieldSelector.noResults')}</CommandEmpty>

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
                        const isSelected = selectedFields.includes(field.id);
                        return (
                          <CommandItem
                            key={field.id}
                            value={field.id}
                            onSelect={() => handleSelect(field.id)}
                            className="flex items-start gap-2 py-2"
                          >
                            <div
                              className={cn(
                                'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border',
                                isSelected
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'border-muted-foreground'
                              )}
                            >
                              {isSelected && <Check className="h-3 w-3" />}
                            </div>
                            <div className="flex flex-1 flex-col gap-0.5">
                              <div className="flex items-center justify-between">
                                <span className="font-medium">
                                  {field.displayName}
                                </span>
                                <code className="text-xs text-muted-foreground">
                                  {field.fieldName}
                                </code>
                              </div>
                              {field.description && (
                                <span className="text-xs text-muted-foreground">
                                  {field.description}
                                </span>
                              )}
                              {field.sampleValue && (
                                <span className="text-xs italic text-muted-foreground">
                                  {t('sourceFieldSelector.sampleValue', { value: field.sampleValue })}
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

          {multiple && selectedFields.length > 0 && (
            <div className="border-t p-2">
              <div className="text-xs text-muted-foreground">
                {t('sourceFieldSelector.selectedCount', { count: selectedFields.length })}
              </div>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
