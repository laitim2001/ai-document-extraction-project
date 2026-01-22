'use client';

/**
 * @fileoverview 模版實例篩選器組件
 * @description
 *   提供模版實例列表的篩選功能，包括：
 *   - 狀態篩選
 *   - 模版篩選
 *   - 日期範圍篩選
 *   - 搜尋功能
 *
 * @module src/components/features/template-instance/TemplateInstanceFilters
 * @since Epic 19 - Story 19.5
 * @lastModified 2026-01-22
 */

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
import { useDataTemplateOptions } from '@/hooks/use-template-instances';
import type { TemplateInstanceStatus } from '@/types/template-instance';

// ============================================================================
// Types
// ============================================================================

export interface TemplateInstanceFiltersState {
  status: TemplateInstanceStatus | null;
  dataTemplateId: string | null;
  search: string;
}

interface TemplateInstanceFiltersProps {
  value: TemplateInstanceFiltersState;
  onChange: (value: TemplateInstanceFiltersState) => void;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const ALL_STATUSES: TemplateInstanceStatus[] = [
  'DRAFT',
  'PROCESSING',
  'COMPLETED',
  'ERROR',
  'EXPORTED',
];

// ============================================================================
// Component
// ============================================================================

/**
 * 模版實例篩選器組件
 */
export function TemplateInstanceFilters({
  value,
  onChange,
  className,
}: TemplateInstanceFiltersProps) {
  const t = useTranslations('templateInstance');
  const { data: templates = [] } = useDataTemplateOptions();

  // --- Handlers ---
  const handleStatusChange = React.useCallback(
    (newStatus: string) => {
      onChange({
        ...value,
        status: newStatus === '__all__' ? null : (newStatus as TemplateInstanceStatus),
      });
    },
    [value, onChange]
  );

  const handleTemplateChange = React.useCallback(
    (newTemplateId: string) => {
      onChange({
        ...value,
        dataTemplateId: newTemplateId === '__all__' ? null : newTemplateId,
      });
    },
    [value, onChange]
  );

  const handleSearchChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({
        ...value,
        search: e.target.value,
      });
    },
    [value, onChange]
  );

  const handleClearFilters = React.useCallback(() => {
    onChange({
      status: null,
      dataTemplateId: null,
      search: '',
    });
  }, [onChange]);

  // --- Check if filters are active ---
  const hasFilters = value.status !== null || value.dataTemplateId !== null || value.search !== '';

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className ?? ''}`}>
      {/* 搜尋 */}
      <div className="relative flex-1 min-w-[200px] max-w-[300px]">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('filters.searchPlaceholder')}
          value={value.search}
          onChange={handleSearchChange}
          className="pl-8"
        />
      </div>

      {/* 狀態篩選 */}
      <Select value={value.status ?? '__all__'} onValueChange={handleStatusChange}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder={t('filters.status')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">{t('filters.allStatuses')}</SelectItem>
          {ALL_STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              {t(`status.${status}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 模版篩選 */}
      <Select value={value.dataTemplateId ?? '__all__'} onValueChange={handleTemplateChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder={t('filters.template')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">{t('filters.allTemplates')}</SelectItem>
          {templates.map((template) => (
            <SelectItem key={template.id} value={template.id}>
              {template.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 清除篩選 */}
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={handleClearFilters}>
          <X className="mr-1 h-3 w-3" />
          {t('list.clearFilters')}
        </Button>
      )}
    </div>
  );
}
