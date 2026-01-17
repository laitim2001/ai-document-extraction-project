/**
 * @fileoverview Prompt 配置篩選器組件 (i18n version)
 * @description
 *   提供 Prompt 配置列表的篩選功能。
 *   支援按類型、範圍、公司、狀態和搜尋文字篩選。
 *   Full i18n support
 *
 * @module src/components/features/prompt-config/PromptConfigFilters
 * @since Epic 14 - Story 14.2
 * @lastModified 2026-01-17
 *
 * @features
 *   - Prompt 類型篩選
 *   - 範圍篩選 (GLOBAL/COMPANY/FORMAT)
 *   - 狀態篩選 (啟用/停用)
 *   - 文字搜尋
 *   - 清除篩選
 *
 * @dependencies
 *   - @/types/prompt-config - 配置類型定義
 *   - @/components/ui/* - shadcn/ui 組件
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, X, Filter } from 'lucide-react';
import { PROMPT_TYPES, PROMPT_SCOPES } from '@/types/prompt-config';
import type { PromptConfigFiltersState } from '@/types/prompt-config-ui';

// ============================================================================
// 類型定義
// ============================================================================

interface PromptConfigFiltersProps {
  /** 當前篩選狀態 */
  filters: PromptConfigFiltersState;
  /** 篩選變更回調 */
  onFiltersChange: (filters: PromptConfigFiltersState) => void;
}

// ============================================================================
// 主組件
// ============================================================================

export function PromptConfigFilters({
  filters,
  onFiltersChange,
}: PromptConfigFiltersProps) {
  const t = useTranslations('promptConfig');

  // 計算啟用的篩選數量
  const activeFilterCount = React.useMemo(() => {
    let count = 0;
    if (filters.promptType) count++;
    if (filters.scope) count++;
    if (filters.isActive !== undefined) count++;
    if (filters.search) count++;
    return count;
  }, [filters]);

  // 更新單一篩選條件
  const updateFilter = <K extends keyof PromptConfigFiltersState>(
    key: K,
    value: PromptConfigFiltersState[K]
  ) => {
    onFiltersChange({
      ...filters,
      [key]: value,
    });
  };

  // 清除所有篩選
  const clearFilters = () => {
    onFiltersChange({});
  };

  return (
    <div className="space-y-4">
      {/* 篩選器行 */}
      <div className="flex flex-wrap items-center gap-3">
        {/* 搜尋框 */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('filters.search.placeholder')}
            value={filters.search ?? ''}
            onChange={(e) => updateFilter('search', e.target.value || undefined)}
            className="pl-9"
          />
        </div>

        {/* Prompt 類型篩選 */}
        <Select
          value={filters.promptType ?? 'all'}
          onValueChange={(value) =>
            updateFilter('promptType', value === 'all' ? undefined : value)
          }
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={t('filters.promptType.all')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.promptType.all')}</SelectItem>
            {Object.values(PROMPT_TYPES).map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {t(`types.${type.value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 範圍篩選 */}
        <Select
          value={filters.scope ?? 'all'}
          onValueChange={(value) =>
            updateFilter('scope', value === 'all' ? undefined : value)
          }
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder={t('filters.scope.all')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.scope.all')}</SelectItem>
            {Object.values(PROMPT_SCOPES).map((scope) => (
              <SelectItem key={scope.value} value={scope.value}>
                {t(`scopes.${scope.value}.label`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 狀態篩選 */}
        <Select
          value={filters.isActive === undefined ? 'all' : filters.isActive.toString()}
          onValueChange={(value) =>
            updateFilter(
              'isActive',
              value === 'all' ? undefined : value === 'true'
            )
          }
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder={t('filters.status.all')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.status.all')}</SelectItem>
            <SelectItem value="true">{t('filters.status.active')}</SelectItem>
            <SelectItem value="false">{t('filters.status.inactive')}</SelectItem>
          </SelectContent>
        </Select>

        {/* 清除篩選 */}
        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-muted-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            {t('filters.clear')}
          </Button>
        )}
      </div>

      {/* 啟用的篩選標籤 */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{t('filters.label')}</span>

          {filters.promptType && (
            <FilterBadge
              label={t(`types.${filters.promptType}`)}
              onRemove={() => updateFilter('promptType', undefined)}
            />
          )}

          {filters.scope && (
            <FilterBadge
              label={t(`scopes.${filters.scope}.label`)}
              onRemove={() => updateFilter('scope', undefined)}
            />
          )}

          {filters.isActive !== undefined && (
            <FilterBadge
              label={filters.isActive ? t('filters.status.active') : t('filters.status.inactive')}
              onRemove={() => updateFilter('isActive', undefined)}
            />
          )}

          {filters.search && (
            <FilterBadge
              label={`${t('filters.search.placeholder').replace('...', '')}: "${filters.search}"`}
              onRemove={() => updateFilter('search', undefined)}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 篩選標籤組件
// ============================================================================

interface FilterBadgeProps {
  label: string;
  onRemove: () => void;
}

function FilterBadge({ label, onRemove }: FilterBadgeProps) {
  return (
    <Badge variant="secondary" className="gap-1 pr-1">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
      >
        <X className="h-3 w-3" />
      </button>
    </Badge>
  );
}
