'use client';

/**
 * @fileoverview ClassifiedAs 值選擇器組件
 * @description
 *   用於 AGGREGATE 轉換配置中選擇 classifiedAs 值的 Combobox。
 *   當提供 companyId 時，從 API 載入該公司的 classifiedAs 值列表；
 *   否則退回為簡單的 Input 輸入框。
 *   支援搜尋篩選和自訂值輸入。
 *
 * @module src/components/features/template-field-mapping
 * @since CHANGE-046
 * @lastModified 2026-02-25
 *
 * @dependencies
 *   - @/components/ui/command - shadcn Command 組件
 *   - @/components/ui/popover - shadcn Popover 組件
 */

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Check, ChevronsUpDown } from 'lucide-react';

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

// ============================================================================
// Types
// ============================================================================

interface ClassifiedAsComboboxProps {
  /** 當前選中的 classifiedAs 值 */
  value: string;
  /** 值變更回調 */
  onChange: (value: string) => void;
  /** 公司 ID（用於載入 classifiedAs 值列表） */
  companyId?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 佔位文字 */
  placeholder?: string;
  /** 自訂樣式 */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * ClassifiedAs 值選擇器
 * @description
 *   根據 companyId 動態載入公司的 classifiedAs 值列表，
 *   支援搜尋、篩選和自訂值輸入。
 *   當沒有 companyId 時退回為簡單 Input。
 */
export function ClassifiedAsCombobox({
  value,
  onChange,
  companyId,
  disabled = false,
  placeholder,
  className,
}: ClassifiedAsComboboxProps) {
  const t = useTranslations('templateFieldMapping');

  // --- State ---
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [options, setOptions] = React.useState<string[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  const effectivePlaceholder =
    placeholder ?? t('aggregate.filterClassifiedAsPlaceholder');

  // --- Effects ---
  React.useEffect(() => {
    if (!companyId) {
      setOptions([]);
      return;
    }

    let cancelled = false;

    const loadClassifiedAsValues = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/companies/${companyId}/classified-as-values`
        );
        if (response.ok && !cancelled) {
          const result = await response.json();
          if (result.success && result.data?.values && Array.isArray(result.data.values)) {
            setOptions(result.data.values);
          }
        }
      } catch (error) {
        console.error('Failed to load classifiedAs values:', error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadClassifiedAsValues();

    return () => {
      cancelled = true;
    };
  }, [companyId]);

  // --- Computed ---
  const filteredOptions = React.useMemo(() => {
    if (!searchQuery) return options;
    const query = searchQuery.toLowerCase();
    return options.filter((opt) => opt.toLowerCase().includes(query));
  }, [options, searchQuery]);

  const showAddCustom = React.useMemo(() => {
    if (!searchQuery) return false;
    return !options.some(
      (opt) => opt.toLowerCase() === searchQuery.toLowerCase()
    );
  }, [searchQuery, options]);

  // --- Fallback: simple Input when no companyId ---
  if (!companyId) {
    return (
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={effectivePlaceholder}
        disabled={disabled}
        className={className}
      />
    );
  }

  // --- Render: Popover + Command ---
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between', className)}
          disabled={disabled}
        >
          {value ? (
            <span>{value}</span>
          ) : (
            <span className="text-muted-foreground">
              {effectivePlaceholder}
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={effectivePlaceholder}
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            {isLoading ? (
              <div className="px-4 py-2 text-sm text-muted-foreground">
                {t('aggregate.loadingClassifiedAs')}
              </div>
            ) : filteredOptions.length === 0 && !showAddCustom ? (
              <CommandEmpty>
                {t('aggregate.noClassifiedAsValues')}
              </CommandEmpty>
            ) : null}
            <CommandGroup>
              {filteredOptions.map((opt) => (
                <CommandItem
                  key={opt}
                  value={opt}
                  onSelect={() => {
                    onChange(opt);
                    setOpen(false);
                    setSearchQuery('');
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === opt ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {opt}
                </CommandItem>
              ))}
              {showAddCustom && (
                <CommandItem
                  value={searchQuery}
                  onSelect={() => {
                    onChange(searchQuery);
                    setOpen(false);
                    setSearchQuery('');
                  }}
                >
                  {t('aggregate.addCustomValue', { value: searchQuery })}
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
