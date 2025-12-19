'use client';

/**
 * @fileoverview Controlled Date Range Picker
 * @description
 *   受控版日期範圍選擇器，接受外部 props：
 *   - 支援預設範圍選擇
 *   - 支援自訂日期範圍
 *   - 用於 DashboardFilters 組件
 *
 * @module src/components/dashboard/ControlledDateRangePicker
 * @since Epic 7 - Story 7.3 (Forwarder Filter)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @/components/ui/calendar - 日曆組件
 *   - @/components/ui/popover - 彈出層組件
 *   - @/components/ui/button - 按鈕組件
 *   - @/components/ui/select - 選擇器組件
 */

import * as React from 'react';
import { CalendarIcon } from 'lucide-react';
import { type DateRange as DayPickerDateRange } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  formatDateRangeDisplay,
  validateDateRange,
  getRangeDays,
} from '@/lib/date-range-utils';
import {
  type PresetRange,
  type DateRange,
  MAX_RANGE_DAYS,
  PRESET_LABELS,
  QUICK_SELECT_PRESETS,
} from '@/types/date-range';

// ============================================================
// Types
// ============================================================

interface ControlledDateRangePickerProps {
  /** 當前日期範圍 */
  dateRange: DateRange;
  /** 當前預設範圍 */
  preset: PresetRange;
  /** 預設範圍變更回調 */
  onPresetChange: (preset: PresetRange) => void;
  /** 自訂日期範圍變更回調 */
  onCustomRangeChange: (from: Date, to: Date) => void;
  /** 額外的 CSS 類名 */
  className?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否為緊湊模式 */
  compact?: boolean;
}

// ============================================================
// Component
// ============================================================

/**
 * ControlledDateRangePicker
 * @description 受控版日期範圍選擇器
 */
export function ControlledDateRangePicker({
  dateRange,
  preset,
  onPresetChange,
  onCustomRangeChange,
  className,
  disabled = false,
  compact = false,
}: ControlledDateRangePickerProps) {
  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // 轉換為 DayPicker 格式
  const selectedRange: DayPickerDateRange = React.useMemo(
    () => ({
      from: dateRange.startDate,
      to: dateRange.endDate,
    }),
    [dateRange]
  );

  // 處理預設範圍選擇
  const handlePresetChange = React.useCallback(
    (value: string) => {
      if (value === 'custom') {
        setIsCalendarOpen(true);
      } else {
        onPresetChange(value as PresetRange);
      }
    },
    [onPresetChange]
  );

  // 處理自訂日期選擇
  const handleCalendarSelect = React.useCallback(
    (range: DayPickerDateRange | undefined) => {
      setError(null);

      if (!range?.from) {
        return;
      }

      // 如果只選了起始日期
      if (!range.to) {
        return;
      }

      // 驗證日期範圍
      const validation = validateDateRange(range.from, range.to);
      if (!validation.isValid) {
        setError(validation.error || '日期範圍無效');
        return;
      }

      onCustomRangeChange(range.from, range.to);
      setIsCalendarOpen(false);
    },
    [onCustomRangeChange]
  );

  // 顯示文字
  const displayText = React.useMemo(() => {
    if (preset !== 'custom') {
      return PRESET_LABELS[preset];
    }
    return formatDateRangeDisplay(dateRange);
  }, [dateRange, preset]);

  // 計算天數
  const rangeDays = getRangeDays(dateRange.startDate, dateRange.endDate);

  // 禁用未來日期
  const disabledDays = React.useMemo(() => {
    const today = new Date();
    return { after: today };
  }, []);

  // 預設選項
  const presetOptions = React.useMemo(() => {
    return [
      ...QUICK_SELECT_PRESETS.map((p) => ({
        value: p,
        label: PRESET_LABELS[p],
      })),
      { value: 'custom', label: '自訂範圍' },
    ];
  }, []);

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* 預設範圍選擇器 */}
      <Select
        value={preset}
        onValueChange={handlePresetChange}
        disabled={disabled}
      >
        <SelectTrigger className={cn(compact ? 'w-[130px]' : 'w-[160px]')}>
          <SelectValue placeholder="選擇時間範圍" />
        </SelectTrigger>
        <SelectContent>
          {presetOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 日曆選擇器（自訂範圍時顯示） */}
      <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size={compact ? 'sm' : 'default'}
            disabled={disabled}
            className={cn(
              'justify-start text-left font-normal',
              preset !== 'custom' && 'hidden',
              compact ? 'w-[200px]' : 'w-[240px]'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            <span className="truncate">{displayText}</span>
            {preset === 'custom' && (
              <span className="ml-auto text-xs text-muted-foreground">
                {rangeDays}天
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">選擇日期範圍</span>
              <span className="text-xs text-muted-foreground">
                最多 {MAX_RANGE_DAYS} 天
              </span>
            </div>
            {error && (
              <div className="mb-2 text-sm text-destructive">{error}</div>
            )}
          </div>
          <Calendar
            mode="range"
            defaultMonth={dateRange.startDate}
            selected={selectedRange}
            onSelect={handleCalendarSelect}
            numberOfMonths={2}
            disabled={disabledDays}
          />
        </PopoverContent>
      </Popover>

      {/* 非自訂模式時顯示日期範圍摘要 */}
      {preset !== 'custom' && !compact && (
        <span className="text-xs text-muted-foreground">
          {formatDateRangeDisplay(dateRange)}
        </span>
      )}
    </div>
  );
}
