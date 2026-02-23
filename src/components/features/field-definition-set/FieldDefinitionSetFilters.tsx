'use client';

/**
 * @fileoverview FieldDefinitionSet 篩選器組件
 * @description
 *   提供 FieldDefinitionSet 列表的篩選功能：
 *   - Scope 選擇（GLOBAL/COMPANY/FORMAT）
 *   - 啟用狀態篩選
 *   - 搜尋欄位
 *   - 清除所有篩選
 *
 * @module src/components/features/field-definition-set/FieldDefinitionSetFilters
 * @since CHANGE-042 Phase 3
 * @lastModified 2026-02-23
 *
 * @dependencies
 *   - next-intl - 國際化
 *   - @/components/ui/select - 下拉選擇
 *   - @/components/ui/input - 輸入框
 *   - @/components/ui/button - 按鈕
 */

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { X, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { FieldDefinitionSetFilters as FilterValues } from '@/hooks/use-field-definition-sets';

// ============================================================
// Types
// ============================================================

interface FieldDefinitionSetFiltersProps {
  filters: FilterValues;
  onFiltersChange: (filters: Partial<FilterValues> & { page?: number }) => void;
}

// ============================================================
// Constants
// ============================================================

const ALL_VALUE = '__all__';
const SCOPE_OPTIONS = ['GLOBAL', 'COMPANY', 'FORMAT'] as const;

// ============================================================
// Component
// ============================================================

export function FieldDefinitionSetFilters({
  filters,
  onFiltersChange,
}: FieldDefinitionSetFiltersProps) {
  const t = useTranslations('fieldDefinitionSet');
  const [searchInput, setSearchInput] = React.useState(filters.search ?? '');
  const debounceRef = React.useRef<ReturnType<typeof setTimeout>>();

  const handleSearchChange = React.useCallback(
    (value: string) => {
      setSearchInput(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onFiltersChange({ search: value || undefined, page: 1 });
      }, 300);
    },
    [onFiltersChange]
  );

  React.useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleClear = React.useCallback(() => {
    setSearchInput('');
    onFiltersChange({
      scope: undefined,
      isActive: undefined,
      search: undefined,
      page: 1,
    });
  }, [onFiltersChange]);

  const hasActiveFilters =
    !!filters.scope ||
    filters.isActive !== undefined ||
    !!filters.search;

  return (
    <div className="flex flex-wrap items-end gap-4">
      {/* Scope */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">{t('filters.scope')}</label>
        <Select
          value={filters.scope ?? ALL_VALUE}
          onValueChange={(value) =>
            onFiltersChange({
              scope: value === ALL_VALUE ? undefined : value,
              page: 1,
            })
          }
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder={t('filters.all')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>{t('filters.all')}</SelectItem>
            {SCOPE_OPTIONS.map((scope) => (
              <SelectItem key={scope} value={scope}>
                {t(`scopeBadge.${scope}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Status */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">{t('filters.status')}</label>
        <Select
          value={
            filters.isActive === undefined
              ? ALL_VALUE
              : filters.isActive.toString()
          }
          onValueChange={(value) =>
            onFiltersChange({
              isActive: value === ALL_VALUE ? undefined : value === 'true',
              page: 1,
            })
          }
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder={t('filters.all')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>{t('filters.all')}</SelectItem>
            <SelectItem value="true">{t('filters.active')}</SelectItem>
            <SelectItem value="false">{t('filters.inactive')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Search */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium invisible">Search</label>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('filters.searchPlaceholder')}
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 w-[250px]"
          />
        </div>
      </div>

      {/* Clear */}
      {hasActiveFilters && (
        <div className="space-y-1.5">
          <label className="text-sm font-medium invisible">Action</label>
          <Button variant="ghost" size="sm" onClick={handleClear}>
            <X className="h-4 w-4 mr-1" />
            {t('filters.clear')}
          </Button>
        </div>
      )}
    </div>
  );
}
