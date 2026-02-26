# Story 7.2: 時間範圍篩選

**Status:** done

---

## Story

**As a** 用戶,
**I want** 按時間範圍篩選報表數據,
**So that** 我可以分析特定時期的表現。

---

## Acceptance Criteria

### AC1: 預設時間範圍選項

**Given** 在儀表板頁面
**When** 點擊時間範圍選擇器
**Then** 顯示預設選項：今日、本週、本月、本季、本年

### AC2: 自訂時間範圍

**Given** 選擇「自訂範圍」
**When** 顯示日期選擇器
**Then** 可以選擇開始日期和結束日期
**And** 最大範圍限制為 1 年

### AC3: 數據同步更新

**Given** 時間範圍變更
**When** 選擇新的時間範圍
**Then** 所有圖表和指標更新為該時間範圍的數據
**And** URL 參數同步更新（支援書籤）

### AC4: 範圍驗證

**Given** 用戶選擇自訂範圍
**When** 結束日期早於開始日期
**Then** 顯示錯誤提示
**And** 不允許提交

---

## Tasks / Subtasks

- [x] **Task 1: 時間範圍類型定義** (AC: #1, #2)
  - [x] 1.1 定義預設時間範圍枚舉
  - [x] 1.2 創建時間範圍計算工具函數
  - [x] 1.3 定義日期格式標準
  - [x] 1.4 處理時區轉換

- [x] **Task 2: 時間範圍選擇器組件** (AC: #1, #2, #4)
  - [x] 2.1 創建 `DateRangePicker` 組件
  - [x] 2.2 實現預設範圍快速選擇
  - [x] 2.3 整合日曆選擇器
  - [x] 2.4 添加範圍驗證邏輯
  - [x] 2.5 實現 1 年最大範圍限制

- [x] **Task 3: URL 參數同步** (AC: #3)
  - [x] 3.1 創建 URL 參數序列化工具
  - [x] 3.2 實現參數變更監聯
  - [x] 3.3 頁面載入時從 URL 還原狀態
  - [x] 3.4 支援書籤和分享連結

- [x] **Task 4: 全局狀態管理** (AC: #3)
  - [x] 4.1 創建時間範圍 Context
  - [x] 4.2 實現狀態持久化
  - [x] 4.3 提供 `useDateRange` hook
  - [x] 4.4 整合到儀表板數據查詢

- [x] **Task 5: API 整合** (AC: #3)
  - [x] 5.1 修改統計 API 支援時間範圍參數
  - [x] 5.2 更新所有儀表板查詢使用時間範圍
  - [x] 5.3 處理無效時間範圍錯誤

- [x] **Task 6: 測試** (AC: #1-4)
  - [x] 6.1 測試預設範圍計算
  - [x] 6.2 測試自訂範圍驗證
  - [x] 6.3 測試 URL 同步
  - [x] 6.4 測試跨時區行為

---

## Dev Notes

### 依賴項

- **Story 7.1**: 處理統計儀表板

### Architecture Compliance

```typescript
// src/types/date-range.ts
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

export interface DateRange {
  startDate: Date
  endDate: Date
  preset?: PresetRange
}

export interface DateRangeState {
  range: DateRange
  setRange: (range: DateRange) => void
  setPreset: (preset: PresetRange) => void
}

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

export const MAX_RANGE_DAYS = 365 // 最大 1 年
```

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
  parseISO,
  format
} from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { PresetRange, DateRange, MAX_RANGE_DAYS } from '@/types/date-range'

export function calculatePresetRange(preset: PresetRange): DateRange {
  const now = new Date()

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
        startDate: startOfWeek(now, { locale: zhTW }),
        endDate: endOfWeek(now, { locale: zhTW }),
        preset
      }
    case 'lastWeek':
      const lastWeek = subWeeks(now, 1)
      return {
        startDate: startOfWeek(lastWeek, { locale: zhTW }),
        endDate: endOfWeek(lastWeek, { locale: zhTW }),
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
      // 預設為本月
      return {
        startDate: startOfMonth(now),
        endDate: endOfMonth(now),
        preset: 'thisMonth'
      }
  }
}

export interface DateRangeValidationResult {
  valid: boolean
  error?: string
}

export function validateDateRange(
  startDate: Date,
  endDate: Date
): DateRangeValidationResult {
  if (isAfter(startDate, endDate)) {
    return {
      valid: false,
      error: '開始日期不能晚於結束日期'
    }
  }

  const daysDiff = differenceInDays(endDate, startDate)
  if (daysDiff > MAX_RANGE_DAYS) {
    return {
      valid: false,
      error: `時間範圍不能超過 ${MAX_RANGE_DAYS} 天`
    }
  }

  if (isAfter(endDate, new Date())) {
    return {
      valid: false,
      error: '結束日期不能是未來日期'
    }
  }

  return { valid: true }
}

export function formatDateRange(range: DateRange): string {
  const formatStr = 'yyyy/MM/dd'
  return `${format(range.startDate, formatStr)} - ${format(range.endDate, formatStr)}`
}

export function serializeDateRange(range: DateRange): string {
  if (range.preset && range.preset !== 'custom') {
    return range.preset
  }
  return `${format(range.startDate, 'yyyy-MM-dd')}_${format(range.endDate, 'yyyy-MM-dd')}`
}

export function parseDateRange(serialized: string): DateRange {
  // 檢查是否為預設範圍
  if (PRESET_LABELS[serialized as PresetRange]) {
    return calculatePresetRange(serialized as PresetRange)
  }

  // 解析自訂範圍
  const [startStr, endStr] = serialized.split('_')
  if (startStr && endStr) {
    return {
      startDate: parseISO(startStr),
      endDate: parseISO(endStr),
      preset: 'custom'
    }
  }

  // 預設返回本月
  return calculatePresetRange('thisMonth')
}
```

```typescript
// src/contexts/DateRangeContext.tsx
'use client'

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import {
  DateRange,
  PresetRange,
  calculatePresetRange,
  serializeDateRange,
  parseDateRange
} from '@/lib/date-range-utils'

interface DateRangeContextValue {
  range: DateRange
  setRange: (range: DateRange) => void
  setPreset: (preset: PresetRange) => void
  formattedRange: string
}

const DateRangeContext = createContext<DateRangeContextValue | undefined>(undefined)

export function DateRangeProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // 從 URL 初始化狀態
  const [range, setRangeState] = useState<DateRange>(() => {
    const urlRange = searchParams.get('range')
    if (urlRange) {
      return parseDateRange(urlRange)
    }
    return calculatePresetRange('thisMonth')
  })

  // URL 同步
  const updateURL = useCallback((newRange: DateRange) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('range', serializeDateRange(newRange))
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [router, pathname, searchParams])

  const setRange = useCallback((newRange: DateRange) => {
    setRangeState(newRange)
    updateURL(newRange)
  }, [updateURL])

  const setPreset = useCallback((preset: PresetRange) => {
    const newRange = calculatePresetRange(preset)
    setRange(newRange)
  }, [setRange])

  // 監聽 URL 變更（瀏覽器前進/後退）
  useEffect(() => {
    const urlRange = searchParams.get('range')
    if (urlRange) {
      const parsed = parseDateRange(urlRange)
      setRangeState(parsed)
    }
  }, [searchParams])

  const formattedRange = formatDateRange(range)

  return (
    <DateRangeContext.Provider value={{ range, setRange, setPreset, formattedRange }}>
      {children}
    </DateRangeContext.Provider>
  )
}

export function useDateRange() {
  const context = useContext(DateRangeContext)
  if (!context) {
    throw new Error('useDateRange must be used within DateRangeProvider')
  }
  return context
}
```

```typescript
// src/components/dashboard/DateRangePicker.tsx
'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react'
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
import { useDateRange } from '@/contexts/DateRangeContext'
import {
  PresetRange,
  PRESET_LABELS,
  validateDateRange,
  calculatePresetRange
} from '@/lib/date-range-utils'

export function DateRangePicker() {
  const { range, setRange, setPreset } = useDateRange()
  const [open, setOpen] = useState(false)
  const [tempStartDate, setTempStartDate] = useState<Date | undefined>(range.startDate)
  const [tempEndDate, setTempEndDate] = useState<Date | undefined>(range.endDate)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'preset' | 'custom'>(
    range.preset === 'custom' ? 'custom' : 'preset'
  )

  const handlePresetChange = (preset: PresetRange) => {
    if (preset === 'custom') {
      setMode('custom')
      return
    }
    setPreset(preset)
    setError(null)
    setOpen(false)
  }

  const handleApplyCustomRange = () => {
    if (!tempStartDate || !tempEndDate) {
      setError('請選擇開始和結束日期')
      return
    }

    const validation = validateDateRange(tempStartDate, tempEndDate)
    if (!validation.valid) {
      setError(validation.error!)
      return
    }

    setRange({
      startDate: tempStartDate,
      endDate: tempEndDate,
      preset: 'custom'
    })
    setError(null)
    setOpen(false)
  }

  const displayText = range.preset && range.preset !== 'custom'
    ? PRESET_LABELS[range.preset]
    : `${format(range.startDate, 'yyyy/MM/dd')} - ${format(range.endDate, 'yyyy/MM/dd')}`

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-[280px] justify-start text-left font-normal',
            !range && 'text-muted-foreground'
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {displayText}
          <ChevronDown className="ml-auto h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-4 space-y-4">
          {/* 預設範圍選擇 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">快速選擇</label>
            <Select
              value={range.preset || 'custom'}
              onValueChange={(value) => handlePresetChange(value as PresetRange)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PRESET_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 自訂範圍 */}
          {mode === 'custom' && (
            <div className="space-y-4 pt-4 border-t">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">開始日期</label>
                  <Calendar
                    mode="single"
                    selected={tempStartDate}
                    onSelect={setTempStartDate}
                    locale={zhTW}
                    disabled={(date) => date > new Date()}
                    initialFocus
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">結束日期</label>
                  <Calendar
                    mode="single"
                    selected={tempEndDate}
                    onSelect={setTempEndDate}
                    locale={zhTW}
                    disabled={(date) => date > new Date()}
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setMode('preset')
                    setError(null)
                  }}
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

```typescript
// src/hooks/useDashboardQuery.ts
import { useQuery } from '@tanstack/react-query'
import { useDateRange } from '@/contexts/DateRangeContext'
import { format } from 'date-fns'

export function useDashboardStatistics() {
  const { range } = useDateRange()

  return useQuery({
    queryKey: [
      'dashboard-statistics',
      format(range.startDate, 'yyyy-MM-dd'),
      format(range.endDate, 'yyyy-MM-dd')
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: range.startDate.toISOString(),
        endDate: range.endDate.toISOString()
      })
      const response = await fetch(`/api/dashboard/statistics?${params}`)
      if (!response.ok) throw new Error('Failed to fetch statistics')
      const result = await response.json()
      return result.data
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000
  })
}
```

### UI/UX 考量

- **快速選擇優先**: 常用時間範圍一鍵選擇
- **視覺回饋**: 選中範圍即時反映在按鈕文字
- **錯誤處理**: 即時驗證並顯示清晰錯誤訊息
- **書籤支援**: URL 參數同步允許分享和書籤

### References

- [Source: docs/03-epics/sections/epic-7-reports-dashboard-cost-tracking.md#story-72]
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR31]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 7.2 |
| Story Key | 7-2-time-range-filter |
| Epic | Epic 7: 報表儀表板與成本追蹤 |
| FR Coverage | FR31 |
| Dependencies | Story 7.1 |

---

*Story created: 2025-12-16*
*Status: done*
*Completed: 2025-12-19*
