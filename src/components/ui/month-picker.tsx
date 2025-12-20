'use client'

/**
 * @fileoverview 月份選擇器組件
 * @description
 *   提供年月選擇功能的組件，用於報告生成等需要選擇月份的場景。
 *   支援最大/最小日期限制，使用 Popover + Button 的組合形式。
 *
 * @module src/components/ui/month-picker
 * @since Epic 7 - Story 7.10 (月度成本分攤報告)
 * @lastModified 2025-12-20
 *
 * @features
 *   - 年月選擇
 *   - 最大/最小日期限制
 *   - 繁體中文顯示
 *
 * @dependencies
 *   - date-fns - 日期處理
 *   - lucide-react - 圖標
 *   - @/components/ui/popover - Popover 組件
 *   - @/components/ui/button - 按鈕組件
 */

import * as React from 'react'
import { format, setMonth, setYear } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

// ============================================================
// Types
// ============================================================

interface MonthPickerProps {
  /** 選中的日期 */
  selected?: Date
  /** 選擇回調 */
  onSelect?: (date: Date) => void
  /** 最小日期 */
  minDate?: Date
  /** 最大日期 */
  maxDate?: Date
  /** 是否禁用 */
  disabled?: boolean
  /** 自定義類名 */
  className?: string
  /** 佔位符 */
  placeholder?: string
}

// ============================================================
// Constants
// ============================================================

const MONTHS = [
  '1月', '2月', '3月', '4月', '5月', '6月',
  '7月', '8月', '9月', '10月', '11月', '12月',
]

// ============================================================
// Component
// ============================================================

/**
 * 月份選擇器組件
 *
 * @description
 *   提供年月選擇功能，常用於報告生成等場景
 *
 * @example
 * ```tsx
 * <MonthPicker
 *   selected={selectedDate}
 *   onSelect={setSelectedDate}
 *   maxDate={new Date()}
 * />
 * ```
 */
export function MonthPicker({
  selected,
  onSelect,
  minDate,
  maxDate,
  disabled = false,
  className,
  placeholder = '選擇月份',
}: MonthPickerProps) {
  const [open, setOpen] = React.useState(false)
  const [viewYear, setViewYear] = React.useState(() =>
    selected?.getFullYear() ?? new Date().getFullYear()
  )

  // 當 selected 變更時更新 viewYear
  React.useEffect(() => {
    if (selected) {
      setViewYear(selected.getFullYear())
    }
  }, [selected])

  const handleMonthSelect = (monthIndex: number) => {
    const newDate = setMonth(setYear(new Date(), viewYear), monthIndex)
    onSelect?.(newDate)
    setOpen(false)
  }

  const handlePrevYear = () => {
    setViewYear((prev) => prev - 1)
  }

  const handleNextYear = () => {
    setViewYear((prev) => prev + 1)
  }

  const isMonthDisabled = (monthIndex: number): boolean => {
    const date = setMonth(setYear(new Date(), viewYear), monthIndex)

    if (minDate && date < setMonth(setYear(new Date(), minDate.getFullYear()), minDate.getMonth())) {
      return true
    }

    if (maxDate && date > setMonth(setYear(new Date(), maxDate.getFullYear()), maxDate.getMonth())) {
      return true
    }

    return false
  }

  const canGoPrevYear = (): boolean => {
    if (!minDate) return true
    return viewYear > minDate.getFullYear()
  }

  const canGoNextYear = (): boolean => {
    if (!maxDate) return true
    return viewYear < maxDate.getFullYear()
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-start text-left font-normal',
            !selected && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selected ? (
            format(selected, 'yyyy年 M月', { locale: zhTW })
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-3" align="start">
        {/* 年份導航 */}
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={handlePrevYear}
            disabled={!canGoPrevYear()}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-medium text-sm">{viewYear}年</span>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={handleNextYear}
            disabled={!canGoNextYear()}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* 月份網格 */}
        <div className="grid grid-cols-3 gap-2">
          {MONTHS.map((month, index) => {
            const isSelected =
              selected &&
              selected.getFullYear() === viewYear &&
              selected.getMonth() === index
            const isDisabled = isMonthDisabled(index)

            return (
              <Button
                key={month}
                variant={isSelected ? 'default' : 'ghost'}
                size="sm"
                className={cn(
                  'h-9',
                  isSelected && 'bg-primary text-primary-foreground',
                  isDisabled && 'opacity-50 cursor-not-allowed'
                )}
                onClick={() => handleMonthSelect(index)}
                disabled={isDisabled}
              >
                {month}
              </Button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
