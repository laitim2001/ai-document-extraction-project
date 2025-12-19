'use client';

/**
 * @fileoverview 日期範圍選擇器組件
 * @description
 *   提供日期範圍選擇功能：
 *   - 雙日曆選擇模式
 *   - 支援鍵盤導航
 *   - 顯示當前選擇範圍
 *   - 驗證日期範圍
 *
 * @module src/components/dashboard/DateRangePicker
 * @since Epic 7 - Story 7.2 (時間範圍篩選器)
 *
 * @dependencies
 *   - @/components/ui/calendar - 日曆組件
 *   - @/components/ui/popover - 彈出層組件
 *   - @/components/ui/button - 按鈕組件
 *   - @/contexts/DateRangeContext - 日期範圍 Context
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
import { useDateRange } from '@/contexts/DateRangeContext';
import {
  formatDateRangeDisplay,
  validateDateRange,
  getRangeDays,
} from '@/lib/date-range-utils';
import { MAX_RANGE_DAYS, PRESET_LABELS } from '@/types/date-range';

// ============================================================
// Props
// ============================================================

interface DateRangePickerProps {
  /** 額外的 CSS 類名 */
  className?: string;
  /** 是否禁用 */
  disabled?: boolean;
}

// ============================================================
// Component
// ============================================================

/**
 * DateRangePicker
 * @description 日期範圍選擇器，支援雙日曆選擇和驗證
 */
export function DateRangePicker({
  className,
  disabled = false,
}: DateRangePickerProps) {
  const { dateRange, setDateRange, isLoading } = useDateRange();
  const [isOpen, setIsOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // 轉換為 DayPicker 格式
  const selectedRange: DayPickerDateRange = React.useMemo(
    () => ({
      from: dateRange.startDate,
      to: dateRange.endDate,
    }),
    [dateRange]
  );

  // 處理日期選擇
  const handleSelect = React.useCallback(
    (range: DayPickerDateRange | undefined) => {
      setError(null);

      if (!range?.from) {
        return;
      }

      // 如果只選了起始日期
      if (!range.to) {
        setDateRange({
          startDate: range.from,
          endDate: range.from,
          preset: 'custom',
        });
        return;
      }

      // 驗證日期範圍
      const validation = validateDateRange(range.from, range.to);
      if (!validation.isValid) {
        setError(validation.error || '日期範圍無效');
        return;
      }

      setDateRange({
        startDate: range.from,
        endDate: range.to,
        preset: 'custom',
      });

      // 選擇完成後關閉彈出層
      setIsOpen(false);
    },
    [setDateRange]
  );

  // 顯示文字
  const displayText = React.useMemo(() => {
    if (isLoading) {
      return '載入中...';
    }

    if (dateRange.preset && dateRange.preset !== 'custom') {
      return PRESET_LABELS[dateRange.preset];
    }

    return formatDateRangeDisplay(dateRange);
  }, [dateRange, isLoading]);

  // 計算天數
  const rangeDays = getRangeDays(dateRange.startDate, dateRange.endDate);

  // 禁用未來日期
  const disabledDays = React.useMemo(() => {
    const today = new Date();
    return { after: today };
  }, []);

  return (
    <div className={cn('grid gap-2', className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date-range-picker"
            variant="outline"
            disabled={disabled || isLoading}
            className={cn(
              'w-[280px] justify-start text-left font-normal',
              !dateRange && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            <span>{displayText}</span>
            {dateRange.preset === 'custom' && (
              <span className="ml-auto text-xs text-muted-foreground">
                {rangeDays} 天
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
            onSelect={handleSelect}
            numberOfMonths={2}
            disabled={disabledDays}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
