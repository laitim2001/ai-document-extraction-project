# Tech Spec: Story 7.2 - Time Range Filter

## Story Reference
- **Story ID**: 7.2
- **Story Title**: 時間範圍篩選
- **Epic**: Epic 7 - 報表儀表板與成本追蹤
- **Status**: Tech Spec Complete

---

## 1. Technical Overview

### 1.1 Purpose
實現儀表板時間範圍篩選功能，允許用戶選擇預設時間範圍（今日、本週、本月等）或自訂日期範圍，並確保所有儀表板數據根據選定範圍同步更新，同時支援 URL 參數同步以實現書籤和分享功能。

### 1.2 Scope
- 預設時間範圍類型定義和計算
- DateRangePicker 組件實現
- URL 參數序列化和同步
- DateRangeContext 全局狀態管理
- API 時間範圍參數整合
- 日期驗證和錯誤處理
- 時區處理

### 1.3 Dependencies
- **Story 7.1**: 處理統計儀表板
- date-fns (日期處理)
- TanStack Query (數據查詢)
- shadcn/ui (Calendar, Popover 組件)

---

## 2. Type Definitions

### 2.1 Date Range Types

```typescript
// src/types/date-range.ts

/**
 * 預設時間範圍枚舉
 */
export type PresetRange =
  | 'today'
  | 'yesterday'
  | 'thisWeek'
  | 'lastWeek'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisQuarter'
  | 'lastQuarter'
  | 'thisYear'
  | 'lastYear'
  | 'custom'

/**
 * 日期範圍結構
 */
export interface DateRange {
  /** 開始日期 */
  startDate: Date
  /** 結束日期 */
  endDate: Date
  /** 預設範圍類型（custom 表示自訂範圍） */
  preset?: PresetRange
}

/**
 * 日期範圍驗證結果
 */
export interface DateRangeValidationResult {
  valid: boolean
  error?: string
}

/**
 * URL 序列化日期範圍參數
 */
export interface DateRangeUrlParams {
  range?: string  // 預設範圍名稱或 "YYYY-MM-DD_YYYY-MM-DD" 格式
}

/**
 * API 查詢的日期範圍參數
 */
export interface DateRangeApiParams {
  startDate: string  // ISO 格式
  endDate: string    // ISO 格式
}

/**
 * 預設範圍顯示標籤（繁體中文）
 */
export const PRESET_LABELS: Record<PresetRange, string> = {
  today: '今日',
  yesterday: '昨日',
  thisWeek: '本週',
  lastWeek: '上週',
  thisMonth: '本月',
  lastMonth: '上月',
  thisQuarter: '本季',
  lastQuarter: '上季',
  thisYear: '本年',
  lastYear: '去年',
  custom: '自訂範圍'
}

/**
 * 預設範圍英文標籤（用於 URL 和 API）
 */
export const PRESET_LABELS_EN: Record<PresetRange, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  thisWeek: 'This Week',
  lastWeek: 'Last Week',
  thisMonth: 'This Month',
  lastMonth: 'Last Month',
  thisQuarter: 'This Quarter',
  lastQuarter: 'Last Quarter',
  thisYear: 'This Year',
  lastYear: 'Last Year',
  custom: 'Custom Range'
}

/**
 * 最大日期範圍限制（天數）
 */
export const MAX_RANGE_DAYS = 365

/**
 * 預設的初始範圍
 */
export const DEFAULT_PRESET: PresetRange = 'thisMonth'
```

### 2.2 Context Types

```typescript
// src/types/date-range-context.ts
import { DateRange, PresetRange } from './date-range'

/**
 * DateRangeContext 值類型
 */
export interface DateRangeContextValue {
  /** 當前日期範圍 */
  range: DateRange
  /** 設置日期範圍 */
  setRange: (range: DateRange) => void
  /** 設置預設範圍 */
  setPreset: (preset: PresetRange) => void
  /** 格式化的範圍顯示文字 */
  formattedRange: string
  /** 是否正在載入 */
  isLoading: boolean
  /** 重置為預設範圍 */
  reset: () => void
}
```

---

## 3. Utility Functions

### 3.1 Date Range Utilities

```typescript
// src/lib/date-range-utils.ts
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  subDays,
  subWeeks,
  subMonths,
  subQuarters,
  subYears,
  differenceInDays,
  isAfter,
  isBefore,
  isValid,
  parseISO,
  format,
  formatISO
} from 'date-fns'
import { zhTW } from 'date-fns/locale'
import {
  PresetRange,
  DateRange,
  DateRangeValidationResult,
  DateRangeApiParams,
  MAX_RANGE_DAYS,
  DEFAULT_PRESET,
  PRESET_LABELS
} from '@/types/date-range'

/**
 * 計算預設時間範圍的具體日期
 * @param preset 預設範圍類型
 * @param referenceDate 參考日期（預設為當前時間）
 * @returns 計算後的日期範圍
 */
export function calculatePresetRange(
  preset: PresetRange,
  referenceDate: Date = new Date()
): DateRange {
  const now = referenceDate

  switch (preset) {
    case 'today':
      return {
        startDate: startOfDay(now),
        endDate: endOfDay(now),
        preset
      }

    case 'yesterday':
      const yesterday = subDays(now, 1)
      return {
        startDate: startOfDay(yesterday),
        endDate: endOfDay(yesterday),
        preset
      }

    case 'thisWeek':
      return {
        startDate: startOfWeek(now, { locale: zhTW, weekStartsOn: 1 }),
        endDate: endOfWeek(now, { locale: zhTW, weekStartsOn: 1 }),
        preset
      }

    case 'lastWeek':
      const lastWeek = subWeeks(now, 1)
      return {
        startDate: startOfWeek(lastWeek, { locale: zhTW, weekStartsOn: 1 }),
        endDate: endOfWeek(lastWeek, { locale: zhTW, weekStartsOn: 1 }),
        preset
      }

    case 'thisMonth':
      return {
        startDate: startOfMonth(now),
        endDate: endOfMonth(now),
        preset
      }

    case 'lastMonth':
      const lastMonth = subMonths(now, 1)
      return {
        startDate: startOfMonth(lastMonth),
        endDate: endOfMonth(lastMonth),
        preset
      }

    case 'thisQuarter':
      return {
        startDate: startOfQuarter(now),
        endDate: endOfQuarter(now),
        preset
      }

    case 'lastQuarter':
      const lastQuarter = subQuarters(now, 1)
      return {
        startDate: startOfQuarter(lastQuarter),
        endDate: endOfQuarter(lastQuarter),
        preset
      }

    case 'thisYear':
      return {
        startDate: startOfYear(now),
        endDate: endOfYear(now),
        preset
      }

    case 'lastYear':
      const lastYear = subYears(now, 1)
      return {
        startDate: startOfYear(lastYear),
        endDate: endOfYear(lastYear),
        preset
      }

    case 'custom':
    default:
      // 預設返回本月
      return calculatePresetRange(DEFAULT_PRESET, now)
  }
}

/**
 * 驗證日期範圍
 * @param startDate 開始日期
 * @param endDate 結束日期
 * @returns 驗證結果
 */
export function validateDateRange(
  startDate: Date | undefined,
  endDate: Date | undefined
): DateRangeValidationResult {
  // 檢查日期是否存在
  if (!startDate || !endDate) {
    return {
      valid: false,
      error: '請選擇開始和結束日期'
    }
  }

  // 檢查日期是否有效
  if (!isValid(startDate) || !isValid(endDate)) {
    return {
      valid: false,
      error: '日期格式無效'
    }
  }

  // 檢查開始日期是否在結束日期之後
  if (isAfter(startDate, endDate)) {
    return {
      valid: false,
      error: '開始日期不能晚於結束日期'
    }
  }

  // 檢查範圍是否超過最大限制
  const daysDiff = differenceInDays(endDate, startDate)
  if (daysDiff > MAX_RANGE_DAYS) {
    return {
      valid: false,
      error: `時間範圍不能超過 ${MAX_RANGE_DAYS} 天`
    }
  }

  // 檢查結束日期是否在未來
  if (isAfter(startOfDay(endDate), endOfDay(new Date()))) {
    return {
      valid: false,
      error: '結束日期不能是未來日期'
    }
  }

  return { valid: true }
}

/**
 * 格式化日期範圍顯示文字
 * @param range 日期範圍
 * @returns 格式化的文字
 */
export function formatDateRange(range: DateRange): string {
  if (range.preset && range.preset !== 'custom') {
    return PRESET_LABELS[range.preset]
  }
  const formatStr = 'yyyy/MM/dd'
  return `${format(range.startDate, formatStr)} - ${format(range.endDate, formatStr)}`
}

/**
 * 格式化日期範圍為簡短顯示
 * @param range 日期範圍
 * @returns 簡短格式文字
 */
export function formatDateRangeShort(range: DateRange): string {
  if (range.preset && range.preset !== 'custom') {
    return PRESET_LABELS[range.preset]
  }
  const formatStr = 'MM/dd'
  const startStr = format(range.startDate, formatStr)
  const endStr = format(range.endDate, formatStr)
  return startStr === endStr ? startStr : `${startStr} - ${endStr}`
}

/**
 * 序列化日期範圍為 URL 參數格式
 * @param range 日期範圍
 * @returns URL 參數字串
 */
export function serializeDateRange(range: DateRange): string {
  if (range.preset && range.preset !== 'custom') {
    return range.preset
  }
  const dateFormat = 'yyyy-MM-dd'
  return `${format(range.startDate, dateFormat)}_${format(range.endDate, dateFormat)}`
}

/**
 * 從 URL 參數字串解析日期範圍
 * @param serialized URL 參數字串
 * @returns 解析後的日期範圍
 */
export function parseDateRange(serialized: string): DateRange {
  // 檢查是否為預設範圍
  if (serialized in PRESET_LABELS) {
    return calculatePresetRange(serialized as PresetRange)
  }

  // 嘗試解析自訂範圍（格式：YYYY-MM-DD_YYYY-MM-DD）
  const parts = serialized.split('_')
  if (parts.length === 2) {
    const startDate = parseISO(parts[0])
    const endDate = parseISO(parts[1])

    if (isValid(startDate) && isValid(endDate)) {
      const validation = validateDateRange(startDate, endDate)
      if (validation.valid) {
        return {
          startDate: startOfDay(startDate),
          endDate: endOfDay(endDate),
          preset: 'custom'
        }
      }
    }
  }

  // 解析失敗，返回預設範圍
  return calculatePresetRange(DEFAULT_PRESET)
}

/**
 * 轉換日期範圍為 API 參數格式
 * @param range 日期範圍
 * @returns API 參數物件
 */
export function toApiParams(range: DateRange): DateRangeApiParams {
  return {
    startDate: formatISO(range.startDate),
    endDate: formatISO(range.endDate)
  }
}

/**
 * 檢查兩個日期範圍是否相同
 * @param a 第一個範圍
 * @param b 第二個範圍
 * @returns 是否相同
 */
export function isSameDateRange(a: DateRange, b: DateRange): boolean {
  return (
    format(a.startDate, 'yyyy-MM-dd') === format(b.startDate, 'yyyy-MM-dd') &&
    format(a.endDate, 'yyyy-MM-dd') === format(b.endDate, 'yyyy-MM-dd')
  )
}

/**
 * 獲取日期範圍的天數
 * @param range 日期範圍
 * @returns 天數
 */
export function getRangeDays(range: DateRange): number {
  return differenceInDays(range.endDate, range.startDate) + 1
}

/**
 * 檢查日期是否在範圍內
 * @param date 要檢查的日期
 * @param range 日期範圍
 * @returns 是否在範圍內
 */
export function isDateInRange(date: Date, range: DateRange): boolean {
  return !isBefore(date, range.startDate) && !isAfter(date, range.endDate)
}
```

### 3.2 URL Parameter Utilities

```typescript
// src/lib/url-params.ts
import { ReadonlyURLSearchParams } from 'next/navigation'
import { DateRange } from '@/types/date-range'
import { serializeDateRange, parseDateRange } from './date-range-utils'

/**
 * URL 參數名稱常量
 */
export const URL_PARAM_KEYS = {
  RANGE: 'range',
  CITY: 'city',
  FORWARDER: 'forwarder'
} as const

/**
 * 從 URL 搜索參數獲取日期範圍
 * @param searchParams URL 搜索參數
 * @returns 日期範圍或 null
 */
export function getDateRangeFromParams(
  searchParams: ReadonlyURLSearchParams
): DateRange | null {
  const rangeParam = searchParams.get(URL_PARAM_KEYS.RANGE)
  if (!rangeParam) {
    return null
  }
  return parseDateRange(rangeParam)
}

/**
 * 建構帶有日期範圍的 URL 搜索參數
 * @param currentParams 當前參數
 * @param range 日期範圍
 * @returns 新的參數字串
 */
export function buildUrlWithDateRange(
  currentParams: URLSearchParams,
  range: DateRange
): string {
  const params = new URLSearchParams(currentParams.toString())
  params.set(URL_PARAM_KEYS.RANGE, serializeDateRange(range))
  return params.toString()
}

/**
 * 從 URL 移除日期範圍參數
 * @param currentParams 當前參數
 * @returns 新的參數字串
 */
export function removeRangeFromParams(
  currentParams: URLSearchParams
): string {
  const params = new URLSearchParams(currentParams.toString())
  params.delete(URL_PARAM_KEYS.RANGE)
  return params.toString()
}

/**
 * 建構完整的儀表板 URL
 * @param pathname 路徑
 * @param range 日期範圍
 * @param additionalParams 額外參數
 * @returns 完整 URL
 */
export function buildDashboardUrl(
  pathname: string,
  range: DateRange,
  additionalParams?: Record<string, string>
): string {
  const params = new URLSearchParams()
  params.set(URL_PARAM_KEYS.RANGE, serializeDateRange(range))

  if (additionalParams) {
    Object.entries(additionalParams).forEach(([key, value]) => {
      if (value) params.set(key, value)
    })
  }

  const queryString = params.toString()
  return queryString ? `${pathname}?${queryString}` : pathname
}
```

---

## 4. Context Implementation

### 4.1 DateRangeContext

```typescript
// src/contexts/DateRangeContext.tsx
'use client'

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  ReactNode
} from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import {
  DateRange,
  PresetRange,
  DEFAULT_PRESET
} from '@/types/date-range'
import { DateRangeContextValue } from '@/types/date-range-context'
import {
  calculatePresetRange,
  serializeDateRange,
  parseDateRange,
  formatDateRange,
  isSameDateRange
} from '@/lib/date-range-utils'
import { URL_PARAM_KEYS, buildUrlWithDateRange } from '@/lib/url-params'

const DateRangeContext = createContext<DateRangeContextValue | undefined>(undefined)

interface DateRangeProviderProps {
  children: ReactNode
  /** 初始預設範圍 */
  initialPreset?: PresetRange
  /** 是否啟用 URL 同步 */
  syncWithUrl?: boolean
}

/**
 * 日期範圍 Provider
 * 管理全局日期範圍狀態並同步 URL 參數
 */
export function DateRangeProvider({
  children,
  initialPreset = DEFAULT_PRESET,
  syncWithUrl = true
}: DateRangeProviderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [isLoading, setIsLoading] = useState(true)

  // 從 URL 或預設值初始化狀態
  const [range, setRangeState] = useState<DateRange>(() => {
    if (syncWithUrl) {
      const urlRange = searchParams.get(URL_PARAM_KEYS.RANGE)
      if (urlRange) {
        return parseDateRange(urlRange)
      }
    }
    return calculatePresetRange(initialPreset)
  })

  // 初始化完成
  useEffect(() => {
    setIsLoading(false)
  }, [])

  // URL 同步函數
  const updateURL = useCallback(
    (newRange: DateRange) => {
      if (!syncWithUrl) return

      const currentParams = new URLSearchParams(searchParams.toString())
      const newParamsString = buildUrlWithDateRange(currentParams, newRange)

      router.replace(`${pathname}?${newParamsString}`, { scroll: false })
    },
    [router, pathname, searchParams, syncWithUrl]
  )

  // 設置日期範圍
  const setRange = useCallback(
    (newRange: DateRange) => {
      // 避免相同範圍重複更新
      if (isSameDateRange(range, newRange)) {
        return
      }

      setRangeState(newRange)
      updateURL(newRange)
    },
    [range, updateURL]
  )

  // 設置預設範圍
  const setPreset = useCallback(
    (preset: PresetRange) => {
      const newRange = calculatePresetRange(preset)
      setRange(newRange)
    },
    [setRange]
  )

  // 重置為預設範圍
  const reset = useCallback(() => {
    setPreset(initialPreset)
  }, [setPreset, initialPreset])

  // 監聽 URL 變更（瀏覽器前進/後退）
  useEffect(() => {
    if (!syncWithUrl) return

    const urlRange = searchParams.get(URL_PARAM_KEYS.RANGE)
    if (urlRange) {
      const parsed = parseDateRange(urlRange)
      if (!isSameDateRange(range, parsed)) {
        setRangeState(parsed)
      }
    }
  }, [searchParams, syncWithUrl, range])

  // 格式化顯示文字
  const formattedRange = useMemo(() => formatDateRange(range), [range])

  const value: DateRangeContextValue = useMemo(
    () => ({
      range,
      setRange,
      setPreset,
      formattedRange,
      isLoading,
      reset
    }),
    [range, setRange, setPreset, formattedRange, isLoading, reset]
  )

  return (
    <DateRangeContext.Provider value={value}>
      {children}
    </DateRangeContext.Provider>
  )
}

/**
 * 使用日期範圍的 Hook
 * @throws 如果在 DateRangeProvider 外使用
 */
export function useDateRange(): DateRangeContextValue {
  const context = useContext(DateRangeContext)
  if (!context) {
    throw new Error('useDateRange must be used within DateRangeProvider')
  }
  return context
}

/**
 * 可選的日期範圍 Hook（不拋出錯誤）
 */
export function useDateRangeOptional(): DateRangeContextValue | null {
  return useContext(DateRangeContext) ?? null
}
```

---

## 5. Frontend Components

### 5.1 DateRangePicker Component

```typescript
// src/components/dashboard/DateRangePicker.tsx
'use client'

import { useState, useCallback, useMemo } from 'react'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { Calendar as CalendarIcon, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useDateRange } from '@/contexts/DateRangeContext'
import {
  PresetRange,
  PRESET_LABELS,
  DateRange
} from '@/types/date-range'
import {
  validateDateRange,
  calculatePresetRange,
  formatDateRange
} from '@/lib/date-range-utils'

interface DateRangePickerProps {
  /** 自定義 className */
  className?: string
  /** 是否禁用 */
  disabled?: boolean
  /** 對齊方式 */
  align?: 'start' | 'center' | 'end'
}

/**
 * 日期範圍選擇器組件
 */
export function DateRangePicker({
  className,
  disabled = false,
  align = 'start'
}: DateRangePickerProps) {
  const { range, setRange, setPreset } = useDateRange()

  // 彈出框狀態
  const [open, setOpen] = useState(false)

  // 臨時日期狀態（用於自訂範圍）
  const [tempStartDate, setTempStartDate] = useState<Date | undefined>(
    range.startDate
  )
  const [tempEndDate, setTempEndDate] = useState<Date | undefined>(
    range.endDate
  )

  // 錯誤狀態
  const [error, setError] = useState<string | null>(null)

  // 模式狀態（預設 vs 自訂）
  const [mode, setMode] = useState<'preset' | 'custom'>(
    range.preset === 'custom' ? 'custom' : 'preset'
  )

  // 預設範圍選項（排除 custom）
  const presetOptions = useMemo(() => {
    return Object.entries(PRESET_LABELS)
      .filter(([key]) => key !== 'custom')
      .map(([key, label]) => ({ value: key as PresetRange, label }))
  }, [])

  // 重置臨時狀態
  const resetTempState = useCallback(() => {
    setTempStartDate(range.startDate)
    setTempEndDate(range.endDate)
    setError(null)
    setMode(range.preset === 'custom' ? 'custom' : 'preset')
  }, [range])

  // 打開彈出框時重置狀態
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        resetTempState()
      }
      setOpen(isOpen)
    },
    [resetTempState]
  )

  // 處理預設範圍選擇
  const handlePresetChange = useCallback(
    (preset: string) => {
      if (preset === 'custom') {
        setMode('custom')
        return
      }
      setPreset(preset as PresetRange)
      setError(null)
      setOpen(false)
    },
    [setPreset]
  )

  // 處理自訂範圍套用
  const handleApplyCustomRange = useCallback(() => {
    const validation = validateDateRange(tempStartDate, tempEndDate)

    if (!validation.valid) {
      setError(validation.error!)
      return
    }

    setRange({
      startDate: tempStartDate!,
      endDate: tempEndDate!,
      preset: 'custom'
    })
    setError(null)
    setOpen(false)
  }, [tempStartDate, tempEndDate, setRange])

  // 取消自訂範圍
  const handleCancelCustom = useCallback(() => {
    setMode('preset')
    setTempStartDate(range.startDate)
    setTempEndDate(range.endDate)
    setError(null)
  }, [range])

  // 顯示文字
  const displayText = formatDateRange(range)

  // 今天的日期（用於禁用未來日期）
  const today = new Date()

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-[280px] justify-start text-left font-normal',
            !range && 'text-muted-foreground',
            className
          )}
          disabled={disabled}
          aria-label="選擇日期範圍"
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          <span className="flex-1 truncate">{displayText}</span>
          <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-auto p-0" align={align}>
        <div className="p-4 space-y-4">
          {/* 快速選擇區域 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              快速選擇
            </label>
            <Select
              value={mode === 'custom' ? 'custom' : (range.preset || 'thisMonth')}
              onValueChange={handlePresetChange}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="選擇時間範圍" />
              </SelectTrigger>
              <SelectContent>
                {presetOptions.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
                <Separator className="my-1" />
                <SelectItem value="custom">
                  {PRESET_LABELS.custom}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 自訂範圍區域 */}
          {mode === 'custom' && (
            <div className="space-y-4 pt-2 border-t">
              <div className="grid grid-cols-2 gap-4">
                {/* 開始日期 */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    開始日期
                  </label>
                  <Calendar
                    mode="single"
                    selected={tempStartDate}
                    onSelect={setTempStartDate}
                    locale={zhTW}
                    disabled={(date) => date > today}
                    className="rounded-md border"
                    initialFocus
                  />
                </div>

                {/* 結束日期 */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    結束日期
                  </label>
                  <Calendar
                    mode="single"
                    selected={tempEndDate}
                    onSelect={setTempEndDate}
                    locale={zhTW}
                    disabled={(date) => date > today}
                    className="rounded-md border"
                  />
                </div>
              </div>

              {/* 錯誤訊息 */}
              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <X className="h-4 w-4" />
                  <span>{error}</span>
                </div>
              )}

              {/* 操作按鈕 */}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelCustom}
                >
                  取消
                </Button>
                <Button
                  size="sm"
                  onClick={handleApplyCustomRange}
                >
                  套用
                </Button>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

### 5.2 DateRangeQuickSelect Component

```typescript
// src/components/dashboard/DateRangeQuickSelect.tsx
'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useDateRange } from '@/contexts/DateRangeContext'
import { PresetRange, PRESET_LABELS } from '@/types/date-range'

interface QuickSelectOption {
  preset: PresetRange
  label: string
}

interface DateRangeQuickSelectProps {
  /** 要顯示的預設選項 */
  options?: PresetRange[]
  /** 自定義 className */
  className?: string
  /** 按鈕大小 */
  size?: 'default' | 'sm' | 'lg'
}

/**
 * 快速日期範圍選擇按鈕組
 */
export function DateRangeQuickSelect({
  options = ['today', 'thisWeek', 'thisMonth', 'thisQuarter', 'thisYear'],
  className,
  size = 'sm'
}: DateRangeQuickSelectProps) {
  const { range, setPreset } = useDateRange()

  const quickOptions: QuickSelectOption[] = useMemo(() => {
    return options.map(preset => ({
      preset,
      label: PRESET_LABELS[preset]
    }))
  }, [options])

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {quickOptions.map(({ preset, label }) => (
        <Button
          key={preset}
          variant={range.preset === preset ? 'default' : 'outline'}
          size={size}
          onClick={() => setPreset(preset)}
          className="transition-colors"
        >
          {label}
        </Button>
      ))}
    </div>
  )
}
```

### 5.3 Integration with Dashboard

```typescript
// src/app/(dashboard)/dashboard/page.tsx
import { Metadata } from 'next'
import { Suspense } from 'react'
import { DateRangeProvider } from '@/contexts/DateRangeContext'
import { DashboardStats } from '@/components/dashboard/DashboardStats'
import { DateRangePicker } from '@/components/dashboard/DateRangePicker'
import { DateRangeQuickSelect } from '@/components/dashboard/DateRangeQuickSelect'
import { CityIndicator } from '@/components/layout/CityIndicator'
import { Skeleton } from '@/components/ui/skeleton'

export const metadata: Metadata = {
  title: '儀表板 | AI 文件處理系統',
  description: '查看處理統計和系統狀態'
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-64" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <DateRangeProvider syncWithUrl initialPreset="thisMonth">
      <div className="container mx-auto py-6 space-y-6">
        {/* 頁面標題 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">儀表板</h1>
            <p className="text-muted-foreground">查看處理統計和系統狀態</p>
          </div>
          <CityIndicator />
        </div>

        {/* 時間範圍選擇區 */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <DateRangePicker />
          <DateRangeQuickSelect
            options={['today', 'thisWeek', 'thisMonth']}
          />
        </div>

        {/* 統計卡片區塊 */}
        <Suspense fallback={<DashboardSkeleton />}>
          <DashboardStats />
        </Suspense>
      </div>
    </DateRangeProvider>
  )
}
```

---

## 6. Hooks

### 6.1 useDashboardStatistics Hook

```typescript
// src/hooks/useDashboardStatistics.ts
import { useQuery, UseQueryOptions } from '@tanstack/react-query'
import { useDateRange } from '@/contexts/DateRangeContext'
import { format } from 'date-fns'
import { DashboardStatistics, DashboardStatisticsResponse } from '@/types/dashboard'
import { toApiParams } from '@/lib/date-range-utils'

interface UseDashboardStatisticsOptions {
  /** 是否啟用查詢 */
  enabled?: boolean
  /** 自動刷新間隔（毫秒） */
  refetchInterval?: number
}

/**
 * 儀表板統計數據查詢 Hook
 * 自動根據日期範圍更新數據
 */
export function useDashboardStatistics(
  options: UseDashboardStatisticsOptions = {}
) {
  const { range, isLoading: isRangeLoading } = useDateRange()
  const { enabled = true, refetchInterval = 5 * 60 * 1000 } = options

  const apiParams = toApiParams(range)

  return useQuery<DashboardStatistics, Error>({
    queryKey: [
      'dashboard-statistics',
      format(range.startDate, 'yyyy-MM-dd'),
      format(range.endDate, 'yyyy-MM-dd')
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: apiParams.startDate,
        endDate: apiParams.endDate
      })

      const response = await fetch(`/api/dashboard/statistics?${params}`)

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || 'Failed to fetch statistics')
      }

      const result: DashboardStatisticsResponse = await response.json()

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Invalid response')
      }

      return result.data
    },
    enabled: enabled && !isRangeLoading,
    refetchInterval,
    staleTime: 60 * 1000,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
  })
}
```

---

## 7. API Integration

### 7.1 Updated Statistics API

```typescript
// src/app/api/dashboard/statistics/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withCityFilter, CityFilter } from '@/middleware/city-filter'
import { dashboardStatisticsService } from '@/services/dashboard-statistics.service'
import { DashboardStatisticsResponse } from '@/types/dashboard'
import { parseISO, isValid, isBefore, isAfter, differenceInDays } from 'date-fns'
import { MAX_RANGE_DAYS } from '@/types/date-range'

/**
 * 驗證日期參數
 */
function validateDateParams(
  startDateStr: string | null,
  endDateStr: string | null
): { valid: boolean; error?: string; startDate?: Date; endDate?: Date } {
  if (!startDateStr || !endDateStr) {
    return { valid: true }  // 使用預設範圍
  }

  const startDate = parseISO(startDateStr)
  const endDate = parseISO(endDateStr)

  if (!isValid(startDate) || !isValid(endDate)) {
    return { valid: false, error: 'Invalid date format' }
  }

  if (isAfter(startDate, endDate)) {
    return { valid: false, error: 'Start date must be before end date' }
  }

  if (differenceInDays(endDate, startDate) > MAX_RANGE_DAYS) {
    return { valid: false, error: `Date range cannot exceed ${MAX_RANGE_DAYS} days` }
  }

  if (isAfter(endDate, new Date())) {
    return { valid: false, error: 'End date cannot be in the future' }
  }

  return { valid: true, startDate, endDate }
}

/**
 * GET /api/dashboard/statistics
 */
export async function GET(request: NextRequest) {
  return withCityFilter(request, async (req, cityFilter) => {
    try {
      const { searchParams } = new URL(req.url)

      // 解析和驗證日期參數
      const dateValidation = validateDateParams(
        searchParams.get('startDate'),
        searchParams.get('endDate')
      )

      if (!dateValidation.valid) {
        return NextResponse.json<DashboardStatisticsResponse>(
          { success: false, error: dateValidation.error },
          { status: 400 }
        )
      }

      // 解析城市參數
      const cityCodes = searchParams.get('cityCodes')?.split(',').filter(Boolean)

      // 驗證城市訪問權限
      if (cityCodes && !cityFilter.isGlobalAdmin) {
        const invalidCities = cityCodes.filter(
          code => !cityFilter.cityCodes.includes(code)
        )
        if (invalidCities.length > 0) {
          return NextResponse.json<DashboardStatisticsResponse>(
            {
              success: false,
              error: `Access denied to cities: ${invalidCities.join(', ')}`
            },
            { status: 403 }
          )
        }
      }

      // 構建查詢參數
      const params = {
        startDate: dateValidation.startDate?.toISOString(),
        endDate: dateValidation.endDate?.toISOString(),
        cityCodes
      }

      // 獲取統計數據
      const statistics = await dashboardStatisticsService.getStatistics(
        cityFilter,
        params
      )

      return NextResponse.json<DashboardStatisticsResponse>({
        success: true,
        data: statistics
      })
    } catch (error) {
      console.error('Dashboard statistics error:', error)
      return NextResponse.json<DashboardStatisticsResponse>(
        { success: false, error: 'Failed to fetch statistics' },
        { status: 500 }
      )
    }
  })
}
```

---

## 8. Testing Strategy

### 8.1 Date Range Utils Tests

```typescript
// __tests__/lib/date-range-utils.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  calculatePresetRange,
  validateDateRange,
  serializeDateRange,
  parseDateRange,
  formatDateRange,
  isSameDateRange
} from '@/lib/date-range-utils'

describe('date-range-utils', () => {
  // 固定時間以確保測試穩定
  const mockDate = new Date('2025-06-15T12:00:00Z')

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(mockDate)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('calculatePresetRange', () => {
    it('should calculate "today" range correctly', () => {
      const range = calculatePresetRange('today')

      expect(range.startDate.toISOString()).toContain('2025-06-15')
      expect(range.endDate.toISOString()).toContain('2025-06-15')
      expect(range.preset).toBe('today')
    })

    it('should calculate "thisMonth" range correctly', () => {
      const range = calculatePresetRange('thisMonth')

      expect(range.startDate.getDate()).toBe(1)
      expect(range.startDate.getMonth()).toBe(5) // June (0-indexed)
      expect(range.endDate.getDate()).toBe(30) // June has 30 days
      expect(range.preset).toBe('thisMonth')
    })

    it('should calculate "lastMonth" range correctly', () => {
      const range = calculatePresetRange('lastMonth')

      expect(range.startDate.getMonth()).toBe(4) // May
      expect(range.endDate.getMonth()).toBe(4)
      expect(range.preset).toBe('lastMonth')
    })

    it('should calculate "thisYear" range correctly', () => {
      const range = calculatePresetRange('thisYear')

      expect(range.startDate.getMonth()).toBe(0) // January
      expect(range.startDate.getDate()).toBe(1)
      expect(range.endDate.getMonth()).toBe(11) // December
      expect(range.endDate.getDate()).toBe(31)
      expect(range.preset).toBe('thisYear')
    })
  })

  describe('validateDateRange', () => {
    it('should return valid for correct date range', () => {
      const startDate = new Date('2025-01-01')
      const endDate = new Date('2025-06-01')
      const result = validateDateRange(startDate, endDate)

      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should return error when start date is after end date', () => {
      const startDate = new Date('2025-06-01')
      const endDate = new Date('2025-01-01')
      const result = validateDateRange(startDate, endDate)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('開始日期不能晚於結束日期')
    })

    it('should return error when range exceeds maximum days', () => {
      const startDate = new Date('2024-01-01')
      const endDate = new Date('2025-06-01')
      const result = validateDateRange(startDate, endDate)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('365')
    })

    it('should return error for undefined dates', () => {
      const result = validateDateRange(undefined, undefined)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('請選擇')
    })
  })

  describe('serializeDateRange', () => {
    it('should serialize preset range as preset name', () => {
      const range = calculatePresetRange('thisMonth')
      const serialized = serializeDateRange(range)

      expect(serialized).toBe('thisMonth')
    })

    it('should serialize custom range as date string', () => {
      const range = {
        startDate: new Date('2025-03-01'),
        endDate: new Date('2025-03-31'),
        preset: 'custom' as const
      }
      const serialized = serializeDateRange(range)

      expect(serialized).toBe('2025-03-01_2025-03-31')
    })
  })

  describe('parseDateRange', () => {
    it('should parse preset range name', () => {
      const range = parseDateRange('thisMonth')

      expect(range.preset).toBe('thisMonth')
    })

    it('should parse custom date range', () => {
      const range = parseDateRange('2025-03-01_2025-03-31')

      expect(range.preset).toBe('custom')
      expect(range.startDate.getMonth()).toBe(2) // March
      expect(range.endDate.getMonth()).toBe(2)
    })

    it('should return default range for invalid string', () => {
      const range = parseDateRange('invalid')

      expect(range.preset).toBe('thisMonth')
    })
  })

  describe('isSameDateRange', () => {
    it('should return true for identical ranges', () => {
      const a = calculatePresetRange('thisMonth')
      const b = calculatePresetRange('thisMonth')

      expect(isSameDateRange(a, b)).toBe(true)
    })

    it('should return false for different ranges', () => {
      const a = calculatePresetRange('thisMonth')
      const b = calculatePresetRange('lastMonth')

      expect(isSameDateRange(a, b)).toBe(false)
    })
  })
})
```

### 8.2 Component Tests

```typescript
// __tests__/components/dashboard/DateRangePicker.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DateRangePicker } from '@/components/dashboard/DateRangePicker'
import { DateRangeProvider } from '@/contexts/DateRangeContext'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/dashboard'
}))

const renderWithProvider = (ui: React.ReactElement) => {
  return render(
    <DateRangeProvider syncWithUrl={false}>
      {ui}
    </DateRangeProvider>
  )
}

describe('DateRangePicker', () => {
  it('should render with default range', () => {
    renderWithProvider(<DateRangePicker />)

    expect(screen.getByRole('button')).toBeInTheDocument()
    expect(screen.getByText(/本月/)).toBeInTheDocument()
  })

  it('should open popover on click', async () => {
    const user = userEvent.setup()
    renderWithProvider(<DateRangePicker />)

    await user.click(screen.getByRole('button'))

    expect(screen.getByText('快速選擇')).toBeInTheDocument()
  })

  it('should change to preset range when selected', async () => {
    const user = userEvent.setup()
    renderWithProvider(<DateRangePicker />)

    await user.click(screen.getByRole('button'))
    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByText('今日'))

    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveTextContent('今日')
    })
  })

  it('should show custom range UI when custom is selected', async () => {
    const user = userEvent.setup()
    renderWithProvider(<DateRangePicker />)

    await user.click(screen.getByRole('button'))
    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByText('自訂範圍'))

    expect(screen.getByText('開始日期')).toBeInTheDocument()
    expect(screen.getByText('結束日期')).toBeInTheDocument()
    expect(screen.getByText('套用')).toBeInTheDocument()
  })

  it('should show error for invalid custom range', async () => {
    const user = userEvent.setup()
    renderWithProvider(<DateRangePicker />)

    await user.click(screen.getByRole('button'))
    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByText('自訂範圍'))

    // 直接點擊套用（沒有選擇日期）
    await user.click(screen.getByText('套用'))

    expect(screen.getByText(/請選擇/)).toBeInTheDocument()
  })
})
```

### 8.3 Context Tests

```typescript
// __tests__/contexts/DateRangeContext.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { DateRangeProvider, useDateRange } from '@/contexts/DateRangeContext'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/dashboard'
}))

describe('DateRangeContext', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <DateRangeProvider syncWithUrl={false}>{children}</DateRangeProvider>
  )

  it('should provide initial range', () => {
    const { result } = renderHook(() => useDateRange(), { wrapper })

    expect(result.current.range).toBeDefined()
    expect(result.current.range.preset).toBe('thisMonth')
  })

  it('should update range via setPreset', () => {
    const { result } = renderHook(() => useDateRange(), { wrapper })

    act(() => {
      result.current.setPreset('today')
    })

    expect(result.current.range.preset).toBe('today')
  })

  it('should update range via setRange', () => {
    const { result } = renderHook(() => useDateRange(), { wrapper })

    const customRange = {
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-01-31'),
      preset: 'custom' as const
    }

    act(() => {
      result.current.setRange(customRange)
    })

    expect(result.current.range.preset).toBe('custom')
  })

  it('should provide formatted range string', () => {
    const { result } = renderHook(() => useDateRange(), { wrapper })

    expect(result.current.formattedRange).toBe('本月')

    act(() => {
      result.current.setPreset('today')
    })

    expect(result.current.formattedRange).toBe('今日')
  })

  it('should reset to default range', () => {
    const { result } = renderHook(() => useDateRange(), { wrapper })

    act(() => {
      result.current.setPreset('today')
    })

    act(() => {
      result.current.reset()
    })

    expect(result.current.range.preset).toBe('thisMonth')
  })

  it('should throw error when used outside provider', () => {
    expect(() => {
      renderHook(() => useDateRange())
    }).toThrow('useDateRange must be used within DateRangeProvider')
  })
})
```

---

## 9. Performance Considerations

### 9.1 Optimization Strategies

1. **URL 同步防抖**: 避免快速連續變更造成的頻繁 URL 更新
2. **查詢鍵穩定性**: 使用格式化日期字串作為查詢鍵
3. **記憶化計算**: 使用 useMemo 緩存格式化和計算結果
4. **避免重複更新**: isSameDateRange 檢查防止相同範圍觸發更新

### 9.2 Bundle Size Optimization

```typescript
// 僅導入需要的 date-fns 函數
import { format, parseISO } from 'date-fns'
import { zhTW } from 'date-fns/locale'
// 避免: import * as dateFns from 'date-fns'
```

---

## 10. Accessibility

1. **鍵盤導航**: 所有控件支援鍵盤操作
2. **ARIA 標籤**: 按鈕和選擇器有描述性標籤
3. **焦點管理**: 彈出框開啟時自動聚焦到第一個輸入
4. **錯誤提示**: 清晰可見的錯誤訊息

---

## 11. Acceptance Criteria Verification

| AC | Description | Implementation | Verification |
|----|-------------|----------------|--------------|
| AC1 | 預設時間範圍選項 | PRESET_LABELS + Select 組件 | 組件測試 |
| AC2 | 自訂時間範圍 | Calendar 雙日期選擇 + 1年限制 | 驗證測試 |
| AC3 | 數據同步更新 | Context + React Query + URL 同步 | 整合測試 |
| AC4 | 範圍驗證 | validateDateRange 函數 | 單元測試 |

---

## 12. References

- [date-fns Documentation](https://date-fns.org/)
- [shadcn/ui Calendar](https://ui.shadcn.com/docs/components/calendar)
- [Next.js App Router Navigation](https://nextjs.org/docs/app/building-your-application/routing/linking-and-navigating)
- Story 7.2 Requirements Document
