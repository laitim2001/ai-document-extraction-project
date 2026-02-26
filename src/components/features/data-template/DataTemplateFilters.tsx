/**
 * @fileoverview 數據模版篩選組件（國際化版本）
 * @description
 *   提供數據模版列表的篩選功能
 *   - i18n 國際化支援 (Epic 17)
 *
 * @module src/components/features/data-template/DataTemplateFilters
 * @since Epic 16 - Story 16.7
 * @lastModified 2026-01-20
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { DataTemplateFilters as Filters } from '@/types/data-template';

// ============================================================================
// Types
// ============================================================================

export interface DataTemplateFiltersProps {
  /** 當前篩選值 */
  filters: Filters;
  /** 篩選變更回調 */
  onFiltersChange: (filters: Filters) => void;
}

// ============================================================================
// Component
// ============================================================================

export function DataTemplateFilters({
  filters,
  onFiltersChange,
}: DataTemplateFiltersProps) {
  const t = useTranslations('dataTemplates');

  // --- Handlers ---

  const handleSearchChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onFiltersChange({ ...filters, search: e.target.value || undefined });
    },
    [filters, onFiltersChange]
  );

  const handleScopeChange = React.useCallback(
    (value: string) => {
      onFiltersChange({
        ...filters,
        scope: value === 'all' ? undefined : (value as 'GLOBAL' | 'COMPANY'),
      });
    },
    [filters, onFiltersChange]
  );

  const handleStatusChange = React.useCallback(
    (value: string) => {
      let isActive: boolean | undefined;
      if (value === 'active') isActive = true;
      else if (value === 'inactive') isActive = false;

      onFiltersChange({ ...filters, isActive });
    },
    [filters, onFiltersChange]
  );

  const handleSystemChange = React.useCallback(
    (value: string) => {
      let isSystem: boolean | undefined;
      if (value === 'system') isSystem = true;
      else if (value === 'custom') isSystem = false;

      onFiltersChange({ ...filters, isSystem });
    },
    [filters, onFiltersChange]
  );

  const handleClear = React.useCallback(() => {
    onFiltersChange({});
  }, [onFiltersChange]);

  // --- Derived State ---
  const hasFilters =
    filters.search ||
    filters.scope ||
    filters.isActive !== undefined ||
    filters.isSystem !== undefined;

  // --- Render ---
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* 搜尋 */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('filters.searchPlaceholder')}
          value={filters.search || ''}
          onChange={handleSearchChange}
          className="pl-9"
        />
      </div>

      {/* 範圍篩選 */}
      <Select
        value={filters.scope || 'all'}
        onValueChange={handleScopeChange}
      >
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder={t('filters.scope')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('filters.allScopes')}</SelectItem>
          <SelectItem value="GLOBAL">{t('filters.global')}</SelectItem>
          <SelectItem value="COMPANY">{t('filters.company')}</SelectItem>
        </SelectContent>
      </Select>

      {/* 狀態篩選 */}
      <Select
        value={
          filters.isActive === true
            ? 'active'
            : filters.isActive === false
            ? 'inactive'
            : 'all'
        }
        onValueChange={handleStatusChange}
      >
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder={t('filters.status')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('filters.allStatuses')}</SelectItem>
          <SelectItem value="active">{t('filters.active')}</SelectItem>
          <SelectItem value="inactive">{t('filters.inactive')}</SelectItem>
        </SelectContent>
      </Select>

      {/* 類型篩選 */}
      <Select
        value={
          filters.isSystem === true
            ? 'system'
            : filters.isSystem === false
            ? 'custom'
            : 'all'
        }
        onValueChange={handleSystemChange}
      >
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder={t('filters.type')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('filters.allTypes')}</SelectItem>
          <SelectItem value="system">{t('filters.systemTemplate')}</SelectItem>
          <SelectItem value="custom">{t('filters.customTemplate')}</SelectItem>
        </SelectContent>
      </Select>

      {/* 清除篩選 */}
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={handleClear}>
          <X className="h-4 w-4 mr-1" />
          {t('filters.clear')}
        </Button>
      )}
    </div>
  );
}
