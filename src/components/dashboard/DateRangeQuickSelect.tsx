'use client';

/**
 * @fileoverview 日期範圍快速選擇組件
 * @description
 *   提供預設時間範圍的快速選擇按鈕：
 *   - 今天、昨天、本週、上週
 *   - 本月、上月、本季、上季
 *   - 今年、去年
 *   - 支援鍵盤導航
 *
 * @module src/components/dashboard/DateRangeQuickSelect
 * @since Epic 7 - Story 7.2 (時間範圍篩選器)
 *
 * @dependencies
 *   - @/components/ui/button - 按鈕組件
 *   - @/contexts/DateRangeContext - 日期範圍 Context
 */

import * as React from 'react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useDateRange } from '@/contexts/DateRangeContext';
import {
  type PresetRange,
  PRESET_LABELS,
  QUICK_SELECT_PRESETS,
} from '@/types/date-range';

// ============================================================
// Props
// ============================================================

interface DateRangeQuickSelectProps {
  /** 額外的 CSS 類名 */
  className?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 顯示模式：horizontal（水平）或 vertical（垂直） */
  orientation?: 'horizontal' | 'vertical';
  /** 只顯示特定的預設選項 */
  presets?: PresetRange[];
  /** 尺寸 */
  size?: 'sm' | 'default' | 'lg';
}

// ============================================================
// Component
// ============================================================

/**
 * DateRangeQuickSelect
 * @description 日期範圍快速選擇按鈕組
 */
export function DateRangeQuickSelect({
  className,
  disabled = false,
  orientation = 'horizontal',
  presets = QUICK_SELECT_PRESETS,
  size = 'sm',
}: DateRangeQuickSelectProps) {
  const { dateRange, setPreset, isLoading } = useDateRange();

  // 處理預設範圍選擇
  const handlePresetClick = React.useCallback(
    (preset: PresetRange) => {
      setPreset(preset);
    },
    [setPreset]
  );

  // 處理鍵盤事件
  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent, preset: PresetRange) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handlePresetClick(preset);
      }
    },
    [handlePresetClick]
  );

  return (
    <div
      role="group"
      aria-label="快速選擇時間範圍"
      className={cn(
        'flex gap-2',
        orientation === 'vertical' ? 'flex-col' : 'flex-wrap',
        className
      )}
    >
      {presets.map((preset) => {
        const isSelected = dateRange.preset === preset;

        return (
          <Button
            key={preset}
            variant={isSelected ? 'default' : 'outline'}
            size={size}
            disabled={disabled || isLoading}
            onClick={() => handlePresetClick(preset)}
            onKeyDown={(e) => handleKeyDown(e, preset)}
            aria-pressed={isSelected}
            className={cn(
              'transition-colors',
              isSelected && 'ring-2 ring-ring ring-offset-2'
            )}
          >
            {PRESET_LABELS[preset]}
          </Button>
        );
      })}
    </div>
  );
}

// ============================================================
// 預設分組組件
// ============================================================

/**
 * DateRangeQuickSelectGroup
 * @description 分組顯示的快速選擇組件
 */
export function DateRangeQuickSelectGroup({
  className,
  disabled = false,
}: {
  className?: string;
  disabled?: boolean;
}) {
  const dayPresets: PresetRange[] = ['today', 'yesterday'];
  const weekPresets: PresetRange[] = ['thisWeek', 'lastWeek'];
  const monthPresets: PresetRange[] = ['thisMonth', 'lastMonth'];
  const quarterPresets: PresetRange[] = ['thisQuarter', 'lastQuarter'];
  const yearPresets: PresetRange[] = ['thisYear', 'lastYear'];

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-muted-foreground w-12">日：</span>
        <DateRangeQuickSelect presets={dayPresets} disabled={disabled} />
      </div>
      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-muted-foreground w-12">週：</span>
        <DateRangeQuickSelect presets={weekPresets} disabled={disabled} />
      </div>
      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-muted-foreground w-12">月：</span>
        <DateRangeQuickSelect presets={monthPresets} disabled={disabled} />
      </div>
      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-muted-foreground w-12">季：</span>
        <DateRangeQuickSelect presets={quarterPresets} disabled={disabled} />
      </div>
      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-muted-foreground w-12">年：</span>
        <DateRangeQuickSelect presets={yearPresets} disabled={disabled} />
      </div>
    </div>
  );
}

// ============================================================
// 緊湊版組件
// ============================================================

/**
 * DateRangeQuickSelectCompact
 * @description 緊湊版的快速選擇組件，只顯示常用選項
 */
export function DateRangeQuickSelectCompact({
  className,
  disabled = false,
}: {
  className?: string;
  disabled?: boolean;
}) {
  const commonPresets: PresetRange[] = [
    'today',
    'thisWeek',
    'thisMonth',
    'thisQuarter',
    'thisYear',
  ];

  return (
    <DateRangeQuickSelect
      presets={commonPresets}
      disabled={disabled}
      className={className}
    />
  );
}
