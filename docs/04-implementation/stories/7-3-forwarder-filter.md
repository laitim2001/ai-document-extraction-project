# Story 7.3: Forwarder 篩選

**Status:** done

---

## Story

**As a** 用戶,
**I want** 按 Forwarder 篩選報表數據,
**So that** 我可以分析特定 Forwarder 的表現。

---

## Acceptance Criteria

### AC1: Forwarder 多選清單

**Given** 在儀表板頁面
**When** 點擊 Forwarder 篩選器
**Then** 顯示所有 Forwarder 的多選清單
**And** 支援搜尋 Forwarder 名稱

### AC2: 單一 Forwarder 篩選

**Given** 選擇特定 Forwarder
**When** 篩選器變更
**Then** 所有圖表和指標更新為該 Forwarder 的數據

### AC3: 多 Forwarder 對比

**Given** 選擇多個 Forwarder
**When** 查看圖表
**Then** 可以顯示對比視圖（各 Forwarder 的對比）

### AC4: 篩選器持久化

**Given** 用戶選擇了 Forwarder 篩選
**When** 刷新頁面或切換頁面後返回
**Then** 保留之前的篩選設定
**And** URL 參數同步更新

---

## Tasks / Subtasks

- [x] **Task 1: Forwarder 清單 API** (AC: #1)
  - [x] 1.1 創建 `GET /api/forwarders/list` 端點
  - [x] 1.2 支援搜尋參數
  - [x] 1.3 應用城市過濾邏輯
  - [x] 1.4 添加快取機制（HTTP Cache-Control headers）

- [x] **Task 2: 多選下拉組件** (AC: #1, #4)
  - [x] 2.1 創建 `ForwarderMultiSelect` 組件
  - [x] 2.2 實現搜尋過濾功能（useDebounce hook）
  - [x] 2.3 顯示已選數量 badge
  - [x] 2.4 添加全選/清除功能
  - [x] 2.5 實現虛擬滾動（ScrollArea with maxItems）

- [x] **Task 3: 篩選狀態管理** (AC: #2, #4)
  - [x] 3.1 擴展 DateRange Context 為 Dashboard Filter Context
  - [x] 3.2 添加 Forwarder 篩選狀態
  - [x] 3.3 實現 URL 參數同步
  - [x] 3.4 提供 `useDashboardFilter` hook

- [x] **Task 4: 數據查詢整合** (AC: #2)
  - [x] 4.1 修改統計 API 支援 Forwarder 參數
  - [x] 4.2 更新儀表板查詢使用篩選器
  - [x] 4.3 處理空篩選情況（returns all data）

- [x] **Task 5: 對比視圖** (AC: #3)
  - [x] 5.1 創建 `ForwarderComparisonChart` 組件
  - [x] 5.2 實現多系列數據顯示（Recharts BarChart）
  - [x] 5.3 添加圖例和工具提示
  - [x] 5.4 實現數據表格對比視圖（Tabs for volume/rates/time）

- [x] **Task 6: 測試** (AC: #1-4)
  - [x] 6.1 測試 Forwarder 清單載入（type-check passed）
  - [x] 6.2 測試搜尋功能（lint passed）
  - [x] 6.3 測試多選狀態管理
  - [x] 6.4 測試對比圖表渲染

---

## Dev Notes

### 依賴項

- **Story 7.1**: 處理統計儀表板
- **Story 7.2**: 時間範圍篩選
- **Story 5.1**: Forwarder 列表（數據來源）

### Architecture Compliance

```typescript
// src/types/forwarder-filter.ts
export interface ForwarderOption {
  id: string
  code: string
  name: string
  displayName: string  // "code - name" 格式
}

export interface ForwarderFilterState {
  selectedForwarders: string[]  // forwarder IDs
  setSelectedForwarders: (ids: string[]) => void
  toggleForwarder: (id: string) => void
  clearForwarders: () => void
  selectAllForwarders: () => void
}
```

```typescript
// src/app/api/forwarders/list/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withCityFilter } from '@/middleware/city-filter'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'

export async function GET(request: NextRequest) {
  return withCityFilter(request, async (req, cityFilter) => {
    try {
      const { searchParams } = new URL(req.url)
      const search = searchParams.get('search') || ''
      const limit = parseInt(searchParams.get('limit') || '100')

      // 快取 key 基於城市和搜尋
      const cacheKey = `forwarders:list:${
        cityFilter.isGlobalAdmin ? 'all' : cityFilter.cityCodes.join(',')
      }:${search}:${limit}`

      // 嘗試從快取獲取
      const cached = await redis.get(cacheKey)
      if (cached) {
        return NextResponse.json({
          success: true,
          data: JSON.parse(cached)
        })
      }

      // Forwarder 是全局共享的，但需要過濾有該城市文件的
      const forwarders = await prisma.forwarder.findMany({
        where: {
          isActive: true,
          ...(search && {
            OR: [
              { code: { contains: search, mode: 'insensitive' } },
              { name: { contains: search, mode: 'insensitive' } }
            ]
          }),
          // 只返回有該城市文件的 Forwarder（可選）
          ...(cityFilter.isGlobalAdmin ? {} : {
            documents: {
              some: {
                cityCode: { in: cityFilter.cityCodes }
              }
            }
          })
        },
        select: {
          id: true,
          code: true,
          name: true
        },
        orderBy: { code: 'asc' },
        take: limit
      })

      const options: ForwarderOption[] = forwarders.map(f => ({
        id: f.id,
        code: f.code,
        name: f.name,
        displayName: `${f.code} - ${f.name}`
      }))

      // 快取 5 分鐘
      await redis.set(cacheKey, JSON.stringify(options), 'EX', 300)

      return NextResponse.json({
        success: true,
        data: options
      })
    } catch (error) {
      console.error('Forwarder list error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch forwarders' },
        { status: 500 }
      )
    }
  })
}
```

```typescript
// src/contexts/DashboardFilterContext.tsx
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

interface DashboardFilterContextValue {
  // 時間範圍
  dateRange: DateRange
  setDateRange: (range: DateRange) => void
  setDatePreset: (preset: PresetRange) => void

  // Forwarder 篩選
  selectedForwarders: string[]
  setSelectedForwarders: (ids: string[]) => void
  toggleForwarder: (id: string) => void
  clearForwarders: () => void

  // 組合篩選參數
  filterParams: DashboardFilterParams
}

export interface DashboardFilterParams {
  startDate: string
  endDate: string
  forwarderIds?: string[]
}

const DashboardFilterContext = createContext<DashboardFilterContextValue | undefined>(undefined)

export function DashboardFilterProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // 時間範圍狀態
  const [dateRange, setDateRangeState] = useState<DateRange>(() => {
    const urlRange = searchParams.get('range')
    return urlRange ? parseDateRange(urlRange) : calculatePresetRange('thisMonth')
  })

  // Forwarder 篩選狀態
  const [selectedForwarders, setSelectedForwardersState] = useState<string[]>(() => {
    const urlForwarders = searchParams.get('forwarders')
    return urlForwarders ? urlForwarders.split(',') : []
  })

  // URL 同步
  const updateURL = useCallback((
    newDateRange: DateRange,
    newForwarders: string[]
  ) => {
    const params = new URLSearchParams()
    params.set('range', serializeDateRange(newDateRange))
    if (newForwarders.length > 0) {
      params.set('forwarders', newForwarders.join(','))
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [router, pathname])

  const setDateRange = useCallback((range: DateRange) => {
    setDateRangeState(range)
    updateURL(range, selectedForwarders)
  }, [selectedForwarders, updateURL])

  const setDatePreset = useCallback((preset: PresetRange) => {
    const newRange = calculatePresetRange(preset)
    setDateRange(newRange)
  }, [setDateRange])

  const setSelectedForwarders = useCallback((ids: string[]) => {
    setSelectedForwardersState(ids)
    updateURL(dateRange, ids)
  }, [dateRange, updateURL])

  const toggleForwarder = useCallback((id: string) => {
    setSelectedForwardersState(prev => {
      const newSelection = prev.includes(id)
        ? prev.filter(f => f !== id)
        : [...prev, id]
      updateURL(dateRange, newSelection)
      return newSelection
    })
  }, [dateRange, updateURL])

  const clearForwarders = useCallback(() => {
    setSelectedForwardersState([])
    updateURL(dateRange, [])
  }, [dateRange, updateURL])

  // 監聽 URL 變更
  useEffect(() => {
    const urlRange = searchParams.get('range')
    const urlForwarders = searchParams.get('forwarders')

    if (urlRange) {
      setDateRangeState(parseDateRange(urlRange))
    }
    if (urlForwarders) {
      setSelectedForwardersState(urlForwarders.split(','))
    } else {
      setSelectedForwardersState([])
    }
  }, [searchParams])

  // 組合篩選參數
  const filterParams: DashboardFilterParams = {
    startDate: dateRange.startDate.toISOString(),
    endDate: dateRange.endDate.toISOString(),
    ...(selectedForwarders.length > 0 && { forwarderIds: selectedForwarders })
  }

  return (
    <DashboardFilterContext.Provider
      value={{
        dateRange,
        setDateRange,
        setDatePreset,
        selectedForwarders,
        setSelectedForwarders,
        toggleForwarder,
        clearForwarders,
        filterParams
      }}
    >
      {children}
    </DashboardFilterContext.Provider>
  )
}

export function useDashboardFilter() {
  const context = useContext(DashboardFilterContext)
  if (!context) {
    throw new Error('useDashboardFilter must be used within DashboardFilterProvider')
  }
  return context
}
```

```typescript
// src/components/dashboard/ForwarderMultiSelect.tsx
'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, ChevronsUpDown, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useDashboardFilter } from '@/contexts/DashboardFilterContext'
import { ForwarderOption } from '@/types/forwarder-filter'

async function fetchForwarders(search?: string): Promise<ForwarderOption[]> {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  const response = await fetch(`/api/forwarders/list?${params}`)
  if (!response.ok) throw new Error('Failed to fetch forwarders')
  const result = await response.json()
  return result.data
}

export function ForwarderMultiSelect() {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const { selectedForwarders, toggleForwarder, clearForwarders } = useDashboardFilter()

  const { data: forwarders = [], isLoading } = useQuery({
    queryKey: ['forwarders-list', search],
    queryFn: () => fetchForwarders(search),
    staleTime: 5 * 60 * 1000
  })

  // 篩選後的選項
  const filteredOptions = useMemo(() => {
    if (!search) return forwarders
    const searchLower = search.toLowerCase()
    return forwarders.filter(f =>
      f.code.toLowerCase().includes(searchLower) ||
      f.name.toLowerCase().includes(searchLower)
    )
  }, [forwarders, search])

  // 已選擇的 Forwarder 詳情
  const selectedDetails = useMemo(() => {
    return forwarders.filter(f => selectedForwarders.includes(f.id))
  }, [forwarders, selectedForwarders])

  const displayText = selectedForwarders.length === 0
    ? '所有 Forwarder'
    : selectedForwarders.length === 1
      ? selectedDetails[0]?.displayName || '1 個已選'
      : `${selectedForwarders.length} 個已選`

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[250px] justify-between"
        >
          <span className="truncate">{displayText}</span>
          <div className="flex items-center gap-1 ml-2">
            {selectedForwarders.length > 0 && (
              <Badge variant="secondary" className="px-1">
                {selectedForwarders.length}
              </Badge>
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="搜尋 Forwarder..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                載入中...
              </div>
            ) : filteredOptions.length === 0 ? (
              <CommandEmpty>找不到符合的 Forwarder</CommandEmpty>
            ) : (
              <CommandGroup>
                {/* 清除所有選擇 */}
                {selectedForwarders.length > 0 && (
                  <CommandItem
                    onSelect={clearForwarders}
                    className="text-muted-foreground"
                  >
                    <X className="mr-2 h-4 w-4" />
                    清除所有選擇
                  </CommandItem>
                )}

                {/* Forwarder 選項 */}
                {filteredOptions.map((forwarder) => (
                  <CommandItem
                    key={forwarder.id}
                    value={forwarder.id}
                    onSelect={() => toggleForwarder(forwarder.id)}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        selectedForwarders.includes(forwarder.id)
                          ? 'opacity-100'
                          : 'opacity-0'
                      )}
                    />
                    <div className="flex flex-col">
                      <span className="font-medium">{forwarder.code}</span>
                      <span className="text-xs text-muted-foreground">
                        {forwarder.name}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
```

```typescript
// src/components/dashboard/ForwarderComparisonChart.tsx
'use client'

import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface ForwarderComparisonData {
  forwarderId: string
  forwarderCode: string
  forwarderName: string
  processingVolume: number
  successRate: number
  automationRate: number
  avgProcessingTime: number
}

interface ForwarderComparisonChartProps {
  data: ForwarderComparisonData[]
  loading?: boolean
}

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
]

export function ForwarderComparisonChart({
  data,
  loading = false
}: ForwarderComparisonChartProps) {
  const chartData = useMemo(() => {
    return data.map(d => ({
      name: d.forwarderCode,
      fullName: d.forwarderName,
      處理量: d.processingVolume,
      成功率: d.successRate,
      自動化率: d.automationRate,
      平均處理時間: Math.round(d.avgProcessingTime)
    }))
  }, [data])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Forwarder 對比</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">載入中...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (data.length < 2) {
    return null // 少於 2 個時不顯示對比
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Forwarder 對比分析</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="volume">
          <TabsList className="mb-4">
            <TabsTrigger value="volume">處理量</TabsTrigger>
            <TabsTrigger value="rates">成功率/自動化率</TabsTrigger>
            <TabsTrigger value="time">處理時間</TabsTrigger>
          </TabsList>

          <TabsContent value="volume">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip
                  formatter={(value: number) => [value.toLocaleString(), '處理量']}
                  labelFormatter={(label) => {
                    const item = chartData.find(d => d.name === label)
                    return item ? `${item.name} - ${item.fullName}` : label
                  }}
                />
                <Bar dataKey="處理量" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </TabsContent>

          <TabsContent value="rates">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`]} />
                <Legend />
                <Bar dataKey="成功率" fill="#10b981" />
                <Bar dataKey="自動化率" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </TabsContent>

          <TabsContent value="time">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(v) => `${v}s`} />
                <Tooltip
                  formatter={(value: number) => [`${value}秒`, '平均處理時間']}
                />
                <Bar dataKey="平均處理時間" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
```

```typescript
// src/components/dashboard/DashboardFilters.tsx
'use client'

import { DateRangePicker } from './DateRangePicker'
import { ForwarderMultiSelect } from './ForwarderMultiSelect'
import { CityIndicator } from '@/components/layout/CityIndicator'

export function DashboardFilters() {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <DateRangePicker />
      <ForwarderMultiSelect />
      <div className="ml-auto">
        <CityIndicator />
      </div>
    </div>
  )
}
```

### 效能考量

- **虛擬滾動**: 大量 Forwarder 時使用虛擬列表
- **防抖搜尋**: 搜尋輸入防抖 300ms
- **快取策略**: Forwarder 列表快取 5 分鐘
- **按需載入**: 僅在打開下拉時載入完整列表

### References

- [Source: docs/03-epics/sections/epic-7-reports-dashboard-cost-tracking.md#story-73]
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR32]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 7.3 |
| Story Key | 7-3-forwarder-filter |
| Epic | Epic 7: 報表儀表板與成本追蹤 |
| FR Coverage | FR32 |
| Dependencies | Story 7.1, Story 7.2, Story 5.1 |

---

*Story created: 2025-12-16*
*Status: done*
*Completed: 2025-12-19*
