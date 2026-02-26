'use client';

/**
 * @fileoverview 格式篩選控件組件
 * @description
 *   提供格式列表的篩選和排序功能。
 *   支援按文件類型、子類型篩選，以及按文件數/更新時間排序。
 *
 * @module src/components/features/formats
 * @since Epic 16 - Story 16.1
 * @lastModified 2026-01-20
 */

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, X } from 'lucide-react';
import type { FormatFiltersState, DocumentType, DocumentSubtype } from '@/types/document-format';
import {
  ALL_DOCUMENT_TYPES,
  ALL_DOCUMENT_SUBTYPES,
} from '@/types/document-format';

// ============================================================================
// Types
// ============================================================================

export interface FormatFiltersProps {
  /** 當前篩選狀態 */
  value: FormatFiltersState;
  /** 篩選狀態變更回調 */
  onChange: (value: FormatFiltersState) => void;
  /** 自定義類名 */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const SORT_OPTIONS = ['fileCount', 'updatedAt'] as const;

// ============================================================================
// Component
// ============================================================================

/**
 * 格式篩選控件組件
 *
 * @description
 *   提供篩選和排序功能：
 *   - 按文件類型篩選
 *   - 按文件子類型篩選
 *   - 按文件數/更新時間排序
 *
 * @param props - 組件屬性
 */
export function FormatFilters({ value, onChange, className }: FormatFiltersProps) {
  const t = useTranslations('formats');
  // --- Handlers ---
  const handleDocumentTypeChange = React.useCallback(
    (newValue: string) => {
      onChange({
        ...value,
        documentType: newValue === '__all__' ? null : (newValue as FormatFiltersState['documentType']),
      });
    },
    [value, onChange]
  );

  const handleDocumentSubtypeChange = React.useCallback(
    (newValue: string) => {
      onChange({
        ...value,
        documentSubtype: newValue === '__all__' ? null : (newValue as FormatFiltersState['documentSubtype']),
      });
    },
    [value, onChange]
  );

  const handleSortByChange = React.useCallback(
    (newValue: string) => {
      onChange({
        ...value,
        sortBy: newValue as FormatFiltersState['sortBy'],
      });
    },
    [value, onChange]
  );

  const handleSortOrderToggle = React.useCallback(() => {
    onChange({
      ...value,
      sortOrder: value.sortOrder === 'desc' ? 'asc' : 'desc',
    });
  }, [value, onChange]);

  const handleReset = React.useCallback(() => {
    onChange({
      documentType: null,
      documentSubtype: null,
      sortBy: 'fileCount',
      sortOrder: 'desc',
    });
  }, [onChange]);

  // --- 檢查是否有篩選條件 ---
  const hasFilters = value.documentType !== null || value.documentSubtype !== null;

  // --- Render ---
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className || ''}`}>
      {/* 文件類型篩選 */}
      <Select
        value={value.documentType || '__all__'}
        onValueChange={handleDocumentTypeChange}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder={t('filters.documentType')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">{t('filters.allTypes')}</SelectItem>
          {ALL_DOCUMENT_TYPES.map((type: DocumentType) => (
            <SelectItem key={type} value={type}>
              {t(`documentTypes.${type}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 文件子類型篩選 */}
      <Select
        value={value.documentSubtype || '__all__'}
        onValueChange={handleDocumentSubtypeChange}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder={t('filters.subtype')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">{t('filters.allSubtypes')}</SelectItem>
          {ALL_DOCUMENT_SUBTYPES.map((subtype: DocumentSubtype) => (
            <SelectItem key={subtype} value={subtype}>
              {t(`documentSubtypes.${subtype}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 排序選項 */}
      <div className="flex items-center gap-1">
        <Select value={value.sortBy} onValueChange={handleSortByChange}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder={t('filters.sortBy')} />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {t(`sort.${opt}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSortOrderToggle}
          className="h-9 w-9"
        >
          <ArrowUpDown
            className={`h-4 w-4 transition-transform ${
              value.sortOrder === 'asc' ? 'rotate-180' : ''
            }`}
          />
          <span className="sr-only">
            {value.sortOrder === 'desc' ? t('filters.sortOrderAsc') : t('filters.sortOrderDesc')}
          </span>
        </Button>
      </div>

      {/* 清除篩選按鈕 */}
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={handleReset}>
          <X className="mr-1 h-3 w-3" />
          {t('filters.clearFilters')}
        </Button>
      )}
    </div>
  );
}
