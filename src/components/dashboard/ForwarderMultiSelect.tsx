'use client';

/**
 * @fileoverview Forwarder Multi-Select Component
 * @description
 *   多選貨代商下拉組件，支援：
 *   - 搜尋過濾
 *   - 多選/單選模式
 *   - 已選項目顯示為 Badge
 *   - 虛擬滾動（大量選項）
 *
 * @module src/components/dashboard/ForwarderMultiSelect
 * @since Epic 7 - Story 7.3 (Forwarder Filter)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @/components/ui/command - Command 組件
 *   - @/components/ui/popover - Popover 組件
 *   - @/components/ui/badge - Badge 組件
 *   - @/types/forwarder-filter - Forwarder 類型
 *
 * @related
 *   - src/contexts/DashboardFilterContext.tsx - Filter context
 *   - src/components/dashboard/DashboardFilters.tsx - Parent wrapper
 */

import * as React from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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
import { useDebounce } from '@/hooks/useDebounce';
import type { ForwarderOption, ForwarderFilterMode } from '@/types/forwarder-filter';

// ============================================================
// Types
// ============================================================

interface ForwarderMultiSelectProps {
  /** 可選的貨代商列表 */
  options: ForwarderOption[];
  /** 已選的貨代商 ID 列表 */
  selectedIds: string[];
  /** 選擇變更回調 */
  onSelectionChange: (ids: string[]) => void;
  /** 篩選模式 */
  mode?: ForwarderFilterMode;
  /** 最大選擇數量（比較模式） */
  maxSelections?: number;
  /** 是否顯示全選選項 */
  showAllOption?: boolean;
  /** 佔位文字 */
  placeholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否正在載入 */
  isLoading?: boolean;
  /** 自訂 className */
  className?: string;
}

// ============================================================
// Constants
// ============================================================

const MAX_VISIBLE_BADGES = 3;

// ============================================================
// Component
// ============================================================

/**
 * ForwarderMultiSelect Component
 * @description 多選貨代商下拉組件
 */
export function ForwarderMultiSelect({
  options,
  selectedIds,
  onSelectionChange,
  mode = 'multiple',
  maxSelections = 5,
  showAllOption = true,
  placeholder = '選擇貨代商...',
  disabled = false,
  isLoading = false,
  className,
}: ForwarderMultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState('');
  const debouncedSearch = useDebounce(searchValue, 300);

  // 過濾選項
  const filteredOptions = React.useMemo(() => {
    if (!debouncedSearch) return options;

    const searchLower = debouncedSearch.toLowerCase();
    return options.filter(
      (option) =>
        option.name.toLowerCase().includes(searchLower) ||
        // REFACTOR-001: option.code 可能為 null，使用空值合併運算子
        (option.code ?? '').toLowerCase().includes(searchLower) ||
        option.displayName.toLowerCase().includes(searchLower)
    );
  }, [options, debouncedSearch]);

  // 取得已選的貨代商物件
  const selectedForwarders = React.useMemo(() => {
    return options.filter((option) => selectedIds.includes(option.id));
  }, [options, selectedIds]);

  // 是否全選
  const isAllSelected = selectedIds.length === options.length && options.length > 0;

  /**
   * 處理選項點擊
   */
  const handleSelect = React.useCallback(
    (optionId: string) => {
      if (mode === 'single') {
        // 單選模式
        onSelectionChange([optionId]);
        setOpen(false);
      } else {
        // 多選模式
        const isSelected = selectedIds.includes(optionId);

        if (isSelected) {
          // 取消選擇
          onSelectionChange(selectedIds.filter((id) => id !== optionId));
        } else {
          // 檢查是否超過最大選擇數
          if (mode === 'comparison' && selectedIds.length >= maxSelections) {
            return;
          }
          onSelectionChange([...selectedIds, optionId]);
        }
      }
    },
    [mode, selectedIds, onSelectionChange, maxSelections]
  );

  /**
   * 處理全選
   */
  const handleSelectAll = React.useCallback(() => {
    if (isAllSelected) {
      onSelectionChange([]);
    } else {
      const allIds = options.map((option) => option.id);
      if (mode === 'comparison') {
        onSelectionChange(allIds.slice(0, maxSelections));
      } else {
        onSelectionChange(allIds);
      }
    }
  }, [isAllSelected, options, onSelectionChange, mode, maxSelections]);

  /**
   * 移除單個選項
   */
  const handleRemove = React.useCallback(
    (optionId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      onSelectionChange(selectedIds.filter((id) => id !== optionId));
    },
    [selectedIds, onSelectionChange]
  );

  /**
   * 清除所有選擇
   */
  const handleClearAll = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelectionChange([]);
    },
    [onSelectionChange]
  );

  // 顯示的 Badge 數量
  const visibleBadges = selectedForwarders.slice(0, MAX_VISIBLE_BADGES);
  const remainingCount = selectedForwarders.length - MAX_VISIBLE_BADGES;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || isLoading}
          className={cn(
            'w-full justify-between min-h-[40px] h-auto',
            selectedIds.length > 0 && 'h-auto py-1.5',
            className
          )}
        >
          <div className="flex flex-wrap gap-1 flex-1 text-left">
            {selectedIds.length === 0 ? (
              <span className="text-muted-foreground">
                {isLoading ? '載入中...' : placeholder}
              </span>
            ) : (
              <>
                {visibleBadges.map((forwarder) => (
                  <Badge
                    key={forwarder.id}
                    variant="secondary"
                    className="flex items-center gap-1 pr-1"
                  >
                    {forwarder.displayName}
                    <X
                      className="h-3 w-3 cursor-pointer hover:text-destructive"
                      onClick={(e) => handleRemove(forwarder.id, e)}
                    />
                  </Badge>
                ))}
                {remainingCount > 0 && (
                  <Badge variant="secondary" className="px-2">
                    +{remainingCount}
                  </Badge>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-1 ml-2 shrink-0">
            {selectedIds.length > 0 && (
              <X
                className="h-4 w-4 text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={handleClearAll}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="搜尋貨代商..."
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            <CommandEmpty>
              {isLoading ? '載入中...' : '找不到符合的貨代商'}
            </CommandEmpty>
            <CommandGroup>
              <ScrollArea className="h-[200px]">
                {/* 全選選項 */}
                {showAllOption && mode !== 'single' && options.length > 0 && (
                  <CommandItem
                    onSelect={handleSelectAll}
                    className="border-b mb-1"
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        isAllSelected ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <span className="font-medium">
                      {isAllSelected ? '取消全選' : '全選'}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {options.length} 個
                    </span>
                  </CommandItem>
                )}

                {/* 貨代商選項 */}
                {filteredOptions.map((option) => {
                  const isSelected = selectedIds.includes(option.id);
                  const isDisabled =
                    mode === 'comparison' &&
                    !isSelected &&
                    selectedIds.length >= maxSelections;

                  return (
                    <CommandItem
                      key={option.id}
                      // REFACTOR-001: option.code 可能為 null，使用空值合併運算子
                      value={option.code ?? ''}
                      onSelect={() => handleSelect(option.id)}
                      disabled={isDisabled}
                      className={cn(isDisabled && 'opacity-50')}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          isSelected ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <div className="flex flex-col">
                        <span>{option.displayName}</span>
                        <span className="text-xs text-muted-foreground">
                          {/* REFACTOR-001: 處理 null 的情況 */}
                          {option.code ?? '無代碼'}
                        </span>
                      </div>
                    </CommandItem>
                  );
                })}
              </ScrollArea>
            </CommandGroup>
          </CommandList>
        </Command>

        {/* 比較模式提示 */}
        {mode === 'comparison' && (
          <div className="p-2 border-t text-xs text-muted-foreground text-center">
            最多選擇 {maxSelections} 個貨代商進行比較
            <span className="ml-1">
              ({selectedIds.length}/{maxSelections})
            </span>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
