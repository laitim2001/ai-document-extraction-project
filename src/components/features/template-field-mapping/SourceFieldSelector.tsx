/**
 * @fileoverview 源欄位選擇器組件
 * @description
 *   用於選擇標準欄位作為映射的源欄位
 *   支援分類篩選和搜尋
 *
 * @module src/components/features/template-field-mapping
 * @since Epic 19 - Story 19.4
 * @lastModified 2026-01-22
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Check, ChevronsUpDown, Search } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

import {
  STANDARD_FIELDS,
  FIELD_CATEGORIES,
  getStandardFieldsGroupedByCategory,
  getSortedCategories,
  type StandardField,
  type FieldCategory,
} from '@/constants/standard-fields';

// ============================================================================
// Types
// ============================================================================

interface SourceFieldSelectorProps {
  value: string;
  onChange: (value: string) => void;
  usedFields?: string[];
  disabled?: boolean;
  className?: string;
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * @component SourceFieldSelector
 * @description 標準欄位選擇器，用於選擇映射的源欄位
 */
export function SourceFieldSelector({
  value,
  onChange,
  usedFields = [],
  disabled = false,
  className,
}: SourceFieldSelectorProps) {
  const t = useTranslations('templateFieldMapping');
  const tFields = useTranslations('standardFields');
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  // Get grouped fields
  const groupedFields = React.useMemo(() => getStandardFieldsGroupedByCategory(), []);
  const categories = React.useMemo(() => getSortedCategories(), []);

  // Filter fields by search
  const filteredGroups = React.useMemo(() => {
    if (!search) {
      return groupedFields;
    }

    const lowerSearch = search.toLowerCase();
    const filtered: Record<FieldCategory, StandardField[]> = {
      basic: [],
      vendor: [],
      logistics: [],
      shipment: [],
      charges: [],
      amount: [],
      customs: [],
      other: [],
    };

    for (const [category, fields] of Object.entries(groupedFields)) {
      filtered[category as FieldCategory] = fields.filter(
        (field) =>
          field.name.toLowerCase().includes(lowerSearch) ||
          (field.description?.toLowerCase().includes(lowerSearch) ?? false)
      );
    }

    return filtered;
  }, [groupedFields, search]);

  // Get selected field info
  const selectedField = React.useMemo(
    () => STANDARD_FIELDS.find((f) => f.name === value),
    [value]
  );

  const handleSelect = React.useCallback(
    (fieldName: string) => {
      onChange(fieldName);
      setOpen(false);
      setSearch('');
    },
    [onChange]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between', className)}
        >
          {selectedField ? (
            <span className="truncate">
              {selectedField.description || selectedField.name}
            </span>
          ) : (
            <span className="text-muted-foreground">
              {t('sourceField.placeholder')}
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <div className="border-b p-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('sourceField.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <ScrollArea className="h-[300px]">
          <div className="p-2">
            {categories.map(({ key: category, labelKey }) => {
              const fields = filteredGroups[category];
              if (fields.length === 0) return null;

              return (
                <div key={category} className="mb-4">
                  <div className="mb-2 px-2 text-xs font-medium text-muted-foreground uppercase">
                    {tFields(`categories.${category}`)}
                  </div>
                  <div className="space-y-1">
                    {fields.map((field) => {
                      const isUsed = usedFields.includes(field.name);
                      const isSelected = value === field.name;

                      return (
                        <button
                          key={field.name}
                          type="button"
                          onClick={() => handleSelect(field.name)}
                          disabled={isUsed && !isSelected}
                          className={cn(
                            'flex w-full items-center justify-between rounded-md px-2 py-2 text-sm transition-colors',
                            'hover:bg-accent hover:text-accent-foreground',
                            isSelected && 'bg-accent text-accent-foreground',
                            isUsed && !isSelected && 'opacity-50 cursor-not-allowed'
                          )}
                        >
                          <div className="flex flex-col items-start">
                            <span className="font-medium">
                              {field.description || field.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {field.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {isUsed && !isSelected && (
                              <Badge variant="secondary" className="text-xs">
                                {t('sourceField.alreadyUsed')}
                              </Badge>
                            )}
                            {isSelected && <Check className="h-4 w-4" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {Object.values(filteredGroups).every((g) => g.length === 0) && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {t('sourceField.noResults')}
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

/**
 * @component SourceFieldDisplay
 * @description 顯示已選擇的源欄位（唯讀）
 */
export function SourceFieldDisplay({ value }: { value: string }) {
  const field = React.useMemo(
    () => STANDARD_FIELDS.find((f) => f.name === value),
    [value]
  );

  if (!field) {
    return <span className="text-muted-foreground">{value}</span>;
  }

  return (
    <div className="flex flex-col">
      <span className="font-medium">{field.description || field.name}</span>
      <span className="text-xs text-muted-foreground">{field.name}</span>
    </div>
  );
}
