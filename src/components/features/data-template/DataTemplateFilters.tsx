/**
 * @fileoverview 數據模版篩選組件
 * @description
 *   提供數據模版列表的篩選功能
 *
 * @module src/components/features/data-template/DataTemplateFilters
 * @since Epic 16 - Story 16.7
 * @lastModified 2026-01-13
 */

'use client';

import * as React from 'react';
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
          placeholder="搜尋模版名稱或說明..."
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
          <SelectValue placeholder="範圍" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部範圍</SelectItem>
          <SelectItem value="GLOBAL">全局</SelectItem>
          <SelectItem value="COMPANY">公司</SelectItem>
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
          <SelectValue placeholder="狀態" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部狀態</SelectItem>
          <SelectItem value="active">啟用</SelectItem>
          <SelectItem value="inactive">停用</SelectItem>
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
          <SelectValue placeholder="類型" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部類型</SelectItem>
          <SelectItem value="system">系統模版</SelectItem>
          <SelectItem value="custom">自訂模版</SelectItem>
        </SelectContent>
      </Select>

      {/* 清除篩選 */}
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={handleClear}>
          <X className="h-4 w-4 mr-1" />
          清除
        </Button>
      )}
    </div>
  );
}
