'use client';

/**
 * @fileoverview Dashboard Filters Wrapper Component
 * @description
 *   儀表板篩選器包裝組件，整合：
 *   - 日期範圍篩選器
 *   - 貨代商篩選器
 *   - 重置按鈕
 *   - 響應式布局
 *
 * @module src/components/dashboard/DashboardFilters
 * @since Epic 7 - Story 7.3 (Forwarder Filter)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @/contexts/DashboardFilterContext - Filter context
 *   - @/components/dashboard/ForwarderMultiSelect - Forwarder 選擇器
 *   - @/components/dashboard/ControlledDateRangePicker - 受控日期範圍選擇器
 *
 * @related
 *   - src/app/(dashboard)/page.tsx - Dashboard 頁面
 */

import * as React from 'react';
import { RotateCcw, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useDashboardFilter } from '@/contexts/DashboardFilterContext';
import { ForwarderMultiSelect } from './ForwarderMultiSelect';
import { ControlledDateRangePicker } from './ControlledDateRangePicker';
import type { ForwarderOption } from '@/types/forwarder-filter';

// ============================================================
// Types
// ============================================================

interface DashboardFiltersProps {
  /** 貨代商選項（從 API 載入） */
  forwarders: ForwarderOption[];
  /** 貨代商載入狀態 */
  isForwardersLoading?: boolean;
  /** 是否顯示比較模式切換 */
  showComparisonToggle?: boolean;
  /** 自訂 className */
  className?: string;
  /** 佈局方向 */
  layout?: 'horizontal' | 'vertical';
}

// ============================================================
// Component
// ============================================================

/**
 * DashboardFilters Component
 * @description 儀表板篩選器包裝組件
 */
export function DashboardFilters({
  forwarders,
  isForwardersLoading = false,
  showComparisonToggle = false,
  className,
  layout = 'horizontal',
}: DashboardFiltersProps) {
  const {
    selectedForwarderIds,
    setSelectedForwarders,
    forwarderMode,
    setForwarderMode,
    hasActiveFilters,
    resetAllFilters,
    dateRange,
    preset,
    setPreset,
    setCustomRange,
  } = useDashboardFilter();

  // 處理貨代商選擇變更
  const handleForwarderChange = React.useCallback(
    (ids: string[]) => {
      setSelectedForwarders(ids);
    },
    [setSelectedForwarders]
  );

  // 處理比較模式切換
  const handleComparisonToggle = React.useCallback(() => {
    if (forwarderMode === 'comparison') {
      setForwarderMode('multiple');
    } else {
      setForwarderMode('comparison');
      // 限制選擇數量
      if (selectedForwarderIds.length > 5) {
        setSelectedForwarders(selectedForwarderIds.slice(0, 5));
      }
    }
  }, [forwarderMode, setForwarderMode, selectedForwarderIds, setSelectedForwarders]);

  const isHorizontal = layout === 'horizontal';

  return (
    <Card className={cn('', className)}>
      <CardContent className="p-4">
        <div
          className={cn(
            'flex gap-4',
            isHorizontal ? 'flex-wrap items-center' : 'flex-col'
          )}
        >
          {/* 篩選器標籤 */}
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Filter className="h-4 w-4" />
            <span>篩選條件</span>
          </div>

          {isHorizontal && <Separator orientation="vertical" className="h-6" />}

          {/* 日期範圍篩選器 */}
          <div className={cn('flex-1', !isHorizontal && 'w-full')}>
            <label className="text-xs text-muted-foreground mb-1 block">
              日期範圍
            </label>
            <ControlledDateRangePicker
              dateRange={dateRange}
              preset={preset}
              onPresetChange={setPreset}
              onCustomRangeChange={setCustomRange}
            />
          </div>

          {isHorizontal && <Separator orientation="vertical" className="h-6" />}

          {/* 貨代商篩選器 */}
          <div className={cn('flex-1 min-w-[200px]', !isHorizontal && 'w-full')}>
            <label className="text-xs text-muted-foreground mb-1 block">
              貨代商
            </label>
            <ForwarderMultiSelect
              options={forwarders}
              selectedIds={selectedForwarderIds}
              onSelectionChange={handleForwarderChange}
              mode={forwarderMode}
              isLoading={isForwardersLoading}
              placeholder="全部貨代商"
            />
          </div>

          {/* 比較模式切換 */}
          {showComparisonToggle && (
            <>
              {isHorizontal && <Separator orientation="vertical" className="h-6" />}
              <Button
                variant={forwarderMode === 'comparison' ? 'default' : 'outline'}
                size="sm"
                onClick={handleComparisonToggle}
                className="whitespace-nowrap"
              >
                {forwarderMode === 'comparison' ? '比較模式' : '開啟比較'}
              </Button>
            </>
          )}

          {/* 重置按鈕 */}
          {hasActiveFilters && (
            <>
              {isHorizontal && <Separator orientation="vertical" className="h-6" />}
              <Button
                variant="ghost"
                size="sm"
                onClick={resetAllFilters}
                className="text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                重置
              </Button>
            </>
          )}
        </div>

        {/* 已選擇提示 */}
        {selectedForwarderIds.length > 0 && (
          <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
            已選擇 {selectedForwarderIds.length} 個貨代商
            {forwarderMode === 'comparison' && (
              <span className="ml-2 text-primary">（比較模式）</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Compact Version
// ============================================================

interface DashboardFiltersCompactProps {
  /** 貨代商選項（從 API 載入） */
  forwarders: ForwarderOption[];
  /** 貨代商載入狀態 */
  isForwardersLoading?: boolean;
  /** 自訂 className */
  className?: string;
}

/**
 * DashboardFiltersCompact Component
 * @description 精簡版儀表板篩選器（用於小型空間）
 */
export function DashboardFiltersCompact({
  forwarders,
  isForwardersLoading = false,
  className,
}: DashboardFiltersCompactProps) {
  const {
    selectedForwarderIds,
    setSelectedForwarders,
    forwarderMode,
    hasActiveFilters,
    resetAllFilters,
    dateRange,
    preset,
    setPreset,
    setCustomRange,
  } = useDashboardFilter();

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <ControlledDateRangePicker
        dateRange={dateRange}
        preset={preset}
        onPresetChange={setPreset}
        onCustomRangeChange={setCustomRange}
        compact
      />

      <ForwarderMultiSelect
        options={forwarders}
        selectedIds={selectedForwarderIds}
        onSelectionChange={setSelectedForwarders}
        mode={forwarderMode}
        isLoading={isForwardersLoading}
        placeholder="貨代商"
        className="w-[180px]"
      />

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="icon"
          onClick={resetAllFilters}
          className="h-8 w-8"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
