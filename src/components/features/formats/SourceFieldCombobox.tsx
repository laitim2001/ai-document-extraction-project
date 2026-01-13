'use client';

/**
 * @fileoverview 來源欄位選擇器組件
 * @description
 *   整合標準欄位（invoice-fields.ts）+ 動態提取欄位的 Combobox，
 *   支援分組顯示、關鍵字搜尋和自訂欄位輸入。
 *
 * @module src/components/features/formats
 * @since Epic 16 - Story 16.6
 * @lastModified 2026-01-13
 *
 * @features
 *   - 分組顯示欄位（基本資訊、運輸資訊、費用明細等）
 *   - 關鍵字即時搜尋
 *   - 支援自訂欄位名稱輸入
 *   - 動態載入 GPT 提取欄位
 *   - 多選模式支援
 *
 * @dependencies
 *   - @/components/ui/command - shadcn Command 組件
 *   - @/components/ui/popover - shadcn Popover 組件
 *   - @/services/mapping - 來源欄位服務
 */

import * as React from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import {
  getGroupedSourceFields,
  searchFields,
  isValidFieldName,
  createCustomFieldOption,
  CATEGORY_LABELS,
  type SourceFieldOption,
  type GroupedSourceFields,
} from '@/services/mapping';

// ============================================================================
// Types
// ============================================================================

interface SourceFieldComboboxProps {
  /** 當前選中的欄位名稱 */
  value: string | string[];
  /** 選中值變更回調 */
  onChange: (value: string | string[]) => void;
  /** 是否支援多選 */
  multiple?: boolean;
  /** 文件格式 ID（用於載入動態提取欄位） */
  formatId?: string;
  /** GPT 提取數據（可選，用於動態欄位） */
  extractedData?: Record<string, unknown>;
  /** 佔位文字 */
  placeholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 自訂樣式 */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * 來源欄位選擇器
 * @description
 *   整合標準欄位和動態提取欄位的 Combobox，
 *   支援分組顯示、搜尋和自訂欄位輸入。
 */
export function SourceFieldCombobox({
  value,
  onChange,
  multiple = false,
  formatId,
  extractedData,
  placeholder = '選擇來源欄位...',
  disabled = false,
  className,
}: SourceFieldComboboxProps) {
  // --- State ---
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [dynamicFields, setDynamicFields] = React.useState<SourceFieldOption[]>([]);
  const [isLoadingDynamic, setIsLoadingDynamic] = React.useState(false);

  // --- Computed Values ---
  const selectedValues = React.useMemo(
    () => (Array.isArray(value) ? value : value ? [value] : []),
    [value]
  );

  // 獲取分組的來源欄位
  const groupedFields = React.useMemo<GroupedSourceFields>(
    () => getGroupedSourceFields(extractedData),
    [extractedData]
  );

  // 將分組欄位轉為平面列表
  const allFields = React.useMemo<SourceFieldOption[]>(() => {
    const fields: SourceFieldOption[] = [];
    for (const category of Object.keys(groupedFields)) {
      fields.push(...groupedFields[category]);
    }
    // 加入動態載入的欄位
    fields.push(...dynamicFields);
    return fields;
  }, [groupedFields, dynamicFields]);

  // 過濾搜尋結果
  const filteredFields = React.useMemo(
    () => searchFields(searchQuery, allFields),
    [searchQuery, allFields]
  );

  // 按分組重新組織過濾後的欄位
  const filteredGroupedFields = React.useMemo(() => {
    const grouped: GroupedSourceFields = {};
    for (const field of filteredFields) {
      const category = field.category;
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(field);
    }
    return grouped;
  }, [filteredFields]);

  // --- Effects ---
  // 動態載入 GPT 提取欄位
  React.useEffect(() => {
    if (!formatId) return;

    const loadDynamicFields = async () => {
      setIsLoadingDynamic(true);
      try {
        const response = await fetch(`/api/v1/formats/${formatId}/extracted-fields`);
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data.fields) {
            // 轉換為 SourceFieldOption 格式
            const fields: SourceFieldOption[] = result.data.fields.map(
              (f: { name: string; occurrences: number }) => ({
                name: f.name,
                label: formatFieldLabel(f.name),
                category: 'extracted',
                source: 'extracted' as const,
              })
            );
            setDynamicFields(fields);
          }
        }
      } catch (error) {
        console.error('Failed to load dynamic fields:', error);
      } finally {
        setIsLoadingDynamic(false);
      }
    };

    loadDynamicFields();
  }, [formatId]);

  // --- Handlers ---
  const handleSelect = React.useCallback(
    (fieldName: string) => {
      if (multiple) {
        const newValues = selectedValues.includes(fieldName)
          ? selectedValues.filter((v) => v !== fieldName)
          : [...selectedValues, fieldName];
        onChange(newValues);
      } else {
        onChange(fieldName);
        setOpen(false);
      }
    },
    [multiple, selectedValues, onChange]
  );

  const handleAddCustomField = React.useCallback(() => {
    if (!searchQuery || !isValidFieldName(searchQuery)) {
      return;
    }
    const customField = createCustomFieldOption(searchQuery);
    if (customField) {
      handleSelect(customField.name);
      setSearchQuery('');
    }
  }, [searchQuery, handleSelect]);

  // 檢查是否可以添加自訂欄位
  const canAddCustomField = React.useMemo(() => {
    if (!searchQuery) return false;
    if (!isValidFieldName(searchQuery)) return false;
    // 檢查是否已存在
    const exists = allFields.some(
      (f) => f.name.toLowerCase() === searchQuery.toLowerCase()
    );
    return !exists;
  }, [searchQuery, allFields]);

  // --- Render ---
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('justify-between', className)}
          disabled={disabled}
        >
          {selectedValues.length === 0 ? (
            <span className="text-muted-foreground">{placeholder}</span>
          ) : multiple ? (
            <span className="flex flex-wrap gap-1">
              {selectedValues.length <= 2 ? (
                selectedValues.map((v) => (
                  <Badge key={v} variant="secondary" className="text-xs">
                    {getFieldLabel(v, allFields)}
                  </Badge>
                ))
              ) : (
                <Badge variant="secondary" className="text-xs">
                  {selectedValues.length} 個欄位
                </Badge>
              )}
            </span>
          ) : (
            <span>{getFieldLabel(selectedValues[0], allFields)}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="搜尋欄位..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            {isLoadingDynamic && (
              <div className="px-4 py-2 text-sm text-muted-foreground">
                載入動態欄位中...
              </div>
            )}
            {filteredFields.length === 0 && !canAddCustomField && (
              <CommandEmpty>找不到匹配的欄位</CommandEmpty>
            )}
            {/* 分組顯示欄位 */}
            {Object.keys(filteredGroupedFields).map((category, index) => (
              <React.Fragment key={category}>
                {index > 0 && <CommandSeparator />}
                <CommandGroup
                  heading={
                    CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] ||
                    category
                  }
                >
                  {filteredGroupedFields[category].map((field) => (
                    <CommandItem
                      key={field.name}
                      value={field.name}
                      onSelect={() => handleSelect(field.name)}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          selectedValues.includes(field.name)
                            ? 'opacity-100'
                            : 'opacity-0'
                        )}
                      />
                      <span className="flex-1">{field.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {field.name}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </React.Fragment>
            ))}
            {/* 自訂欄位輸入 */}
            {canAddCustomField && (
              <>
                <CommandSeparator />
                <CommandGroup heading="自訂欄位">
                  <CommandItem onSelect={handleAddCustomField}>
                    <Plus className="mr-2 h-4 w-4" />
                    <span>
                      新增自訂欄位: <strong>{searchQuery}</strong>
                    </span>
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 格式化欄位標籤
 */
function formatFieldLabel(fieldName: string): string {
  return fieldName
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (s) => s.toUpperCase());
}

/**
 * 獲取欄位顯示標籤
 */
function getFieldLabel(fieldName: string, fields: SourceFieldOption[]): string {
  const field = fields.find((f) => f.name === fieldName);
  return field?.label || formatFieldLabel(fieldName);
}
