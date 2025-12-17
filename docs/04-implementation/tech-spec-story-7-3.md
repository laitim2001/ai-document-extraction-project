# Tech Spec: Story 7.3 - Forwarder Filter

## Story Reference
- **Story ID**: 7.3
- **Story Title**: Forwarder 篩選
- **Epic**: Epic 7 - 報表儀表板與成本追蹤
- **Status**: Tech Spec Complete

---

## 1. Technical Overview

### 1.1 Purpose
實現 Forwarder 篩選功能，允許用戶在儀表板中選擇單一或多個 Forwarder 進行數據分析，支援搜尋、多選、對比視圖，並確保篩選狀態與 URL 同步以實現持久化。

### 1.2 Scope
- Forwarder 清單 API 端點設計
- ForwarderMultiSelect 多選組件實現
- DashboardFilterContext 統一篩選狀態管理
- Forwarder 對比視圖組件
- URL 參數同步和持久化
- 虛擬滾動優化（大量 Forwarder）

### 1.3 Dependencies
- **Story 7.1**: 處理統計儀表板
- **Story 7.2**: 時間範圍篩選
- **Story 5.1**: Forwarder 列表（數據來源）
- shadcn/ui (Command, Popover 組件)
- Recharts (對比圖表)

---

## 2. Type Definitions

### 2.1 Forwarder Filter Types

```typescript
// src/types/forwarder-filter.ts

/**
 * Forwarder 選項結構
 */
export interface ForwarderOption {
  /** Forwarder ID */
  id: string
  /** Forwarder 代碼 */
  code: string
  /** Forwarder 名稱 */
  name: string
  /** 顯示名稱（"code - name" 格式） */
  displayName: string
}

/**
 * Forwarder 列表 API 響應
 */
export interface ForwarderListResponse {
  success: boolean
  data?: ForwarderOption[]
  error?: string
}

/**
 * Forwarder 列表查詢參數
 */
export interface ForwarderListParams {
  /** 搜尋關鍵字 */
  search?: string
  /** 返回數量限制 */
  limit?: number
  /** 是否包含非活躍 Forwarder */
  includeInactive?: boolean
}

/**
 * Forwarder 對比數據
 */
export interface ForwarderComparisonData {
  /** Forwarder ID */
  forwarderId: string
  /** Forwarder 代碼 */
  forwarderCode: string
  /** Forwarder 名稱 */
  forwarderName: string
  /** 處理量 */
  processingVolume: number
  /** 成功率 */
  successRate: number
  /** 自動化率 */
  automationRate: number
  /** 平均處理時間（秒） */
  avgProcessingTime: number
}

/**
 * Forwarder 對比 API 響應
 */
export interface ForwarderComparisonResponse {
  success: boolean
  data?: ForwarderComparisonData[]
  error?: string
}
```

### 2.2 Dashboard Filter Types

```typescript
// src/types/dashboard-filter.ts
import { DateRange, PresetRange } from './date-range'

/**
 * 儀表板篩選參數（用於 API 請求）
 */
export interface DashboardFilterParams {
  /** 開始日期 (ISO 格式) */
  startDate: string
  /** 結束日期 (ISO 格式) */
  endDate: string
  /** Forwarder ID 列表 */
  forwarderIds?: string[]
  /** 城市代碼列表 */
  cityCodes?: string[]
}

/**
 * 儀表板篩選狀態
 */
export interface DashboardFilterState {
  /** 日期範圍 */
  dateRange: DateRange
  /** 已選擇的 Forwarder IDs */
  selectedForwarders: string[]
  /** 篩選參數（用於 API） */
  filterParams: DashboardFilterParams
}

/**
 * 儀表板篩選操作
 */
export interface DashboardFilterActions {
  /** 設置日期範圍 */
  setDateRange: (range: DateRange) => void
  /** 設置預設日期範圍 */
  setDatePreset: (preset: PresetRange) => void
  /** 設置選中的 Forwarders */
  setSelectedForwarders: (ids: string[]) => void
  /** 切換單個 Forwarder 選中狀態 */
  toggleForwarder: (id: string) => void
  /** 清除所有 Forwarder 選擇 */
  clearForwarders: () => void
  /** 全選 Forwarders */
  selectAllForwarders: (ids: string[]) => void
  /** 重置所有篩選 */
  resetFilters: () => void
}

/**
 * DashboardFilterContext 完整類型
 */
export type DashboardFilterContextValue = DashboardFilterState & DashboardFilterActions
```

---

## 3. API Endpoints

### 3.1 Forwarder List API

```typescript
// src/app/api/forwarders/list/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withCityFilter, CityFilter } from '@/middleware/city-filter'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { ForwarderListResponse, ForwarderOption } from '@/types/forwarder-filter'

const CACHE_TTL = 300  // 5 分鐘
const CACHE_PREFIX = 'forwarders:list'

/**
 * 建構快取鍵
 */
function buildCacheKey(
  cityFilter: CityFilter,
  search: string,
  limit: number
): string {
  const cityPart = cityFilter.isGlobalAdmin
    ? 'all'
    : cityFilter.cityCodes.sort().join(',')
  const searchPart = search || 'none'
  return `${CACHE_PREFIX}:${cityPart}:${searchPart}:${limit}`
}

/**
 * GET /api/forwarders/list
 * 獲取 Forwarder 列表
 */
export async function GET(request: NextRequest) {
  return withCityFilter(request, async (req, cityFilter) => {
    try {
      const { searchParams } = new URL(req.url)
      const search = searchParams.get('search') || ''
      const limit = Math.min(
        parseInt(searchParams.get('limit') || '100'),
        500  // 最大限制
      )
      const includeInactive = searchParams.get('includeInactive') === 'true'

      // 建構快取鍵
      const cacheKey = buildCacheKey(cityFilter, search, limit)

      // 嘗試從快取獲取
      try {
        const cached = await redis.get(cacheKey)
        if (cached) {
          return NextResponse.json<ForwarderListResponse>({
            success: true,
            data: JSON.parse(cached)
          })
        }
      } catch (cacheError) {
        console.warn('Cache read failed:', cacheError)
      }

      // 構建查詢條件
      const whereClause: Record<string, unknown> = {
        ...(includeInactive ? {} : { isActive: true }),
        ...(search && {
          OR: [
            { code: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } }
          ]
        })
      }

      // 非全局管理員：只返回有該城市文件的 Forwarder
      if (!cityFilter.isGlobalAdmin) {
        whereClause.documents = {
          some: {
            cityCode: { in: cityFilter.cityCodes }
          }
        }
      }

      // 查詢數據庫
      const forwarders = await prisma.forwarder.findMany({
        where: whereClause,
        select: {
          id: true,
          code: true,
          name: true
        },
        orderBy: { code: 'asc' },
        take: limit
      })

      // 轉換為選項格式
      const options: ForwarderOption[] = forwarders.map(f => ({
        id: f.id,
        code: f.code,
        name: f.name,
        displayName: `${f.code} - ${f.name}`
      }))

      // 寫入快取
      try {
        await redis.set(cacheKey, JSON.stringify(options), 'EX', CACHE_TTL)
      } catch (cacheError) {
        console.warn('Cache write failed:', cacheError)
      }

      return NextResponse.json<ForwarderListResponse>({
        success: true,
        data: options
      })
    } catch (error) {
      console.error('Forwarder list error:', error)
      return NextResponse.json<ForwarderListResponse>(
        { success: false, error: 'Failed to fetch forwarders' },
        { status: 500 }
      )
    }
  })
}
```

### 3.2 Forwarder Comparison API

```typescript
// src/app/api/dashboard/forwarder-comparison/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withCityFilter, CityFilter } from '@/middleware/city-filter'
import { prisma } from '@/lib/prisma'
import { ForwarderComparisonResponse, ForwarderComparisonData } from '@/types/forwarder-filter'
import { parseISO, isValid } from 'date-fns'

/**
 * GET /api/dashboard/forwarder-comparison
 * 獲取 Forwarder 對比數據
 */
export async function GET(request: NextRequest) {
  return withCityFilter(request, async (req, cityFilter) => {
    try {
      const { searchParams } = new URL(req.url)

      // 解析參數
      const forwarderIds = searchParams.get('forwarderIds')?.split(',').filter(Boolean)
      const startDateStr = searchParams.get('startDate')
      const endDateStr = searchParams.get('endDate')

      // 驗證必要參數
      if (!forwarderIds || forwarderIds.length === 0) {
        return NextResponse.json<ForwarderComparisonResponse>(
          { success: false, error: 'At least one forwarderId is required' },
          { status: 400 }
        )
      }

      if (forwarderIds.length > 10) {
        return NextResponse.json<ForwarderComparisonResponse>(
          { success: false, error: 'Maximum 10 forwarders can be compared' },
          { status: 400 }
        )
      }

      // 解析日期
      const startDate = startDateStr ? parseISO(startDateStr) : undefined
      const endDate = endDateStr ? parseISO(endDateStr) : undefined

      if ((startDateStr && !isValid(startDate)) || (endDateStr && !isValid(endDate))) {
        return NextResponse.json<ForwarderComparisonResponse>(
          { success: false, error: 'Invalid date format' },
          { status: 400 }
        )
      }

      // 構建城市過濾條件
      const cityWhereClause = cityFilter.isGlobalAdmin
        ? {}
        : { cityCode: { in: cityFilter.cityCodes } }

      // 查詢每個 Forwarder 的統計數據
      const comparisonData: ForwarderComparisonData[] = await Promise.all(
        forwarderIds.map(async (forwarderId) => {
          // 獲取 Forwarder 信息
          const forwarder = await prisma.forwarder.findUnique({
            where: { id: forwarderId },
            select: { code: true, name: true }
          })

          if (!forwarder) {
            return null
          }

          // 構建文檔查詢條件
          const documentWhere = {
            forwarderId,
            ...cityWhereClause,
            ...(startDate && endDate && {
              processedAt: {
                gte: startDate,
                lte: endDate
              }
            })
          }

          // 並行查詢統計數據
          const [
            totalCount,
            successCount,
            autoApprovedCount,
            avgTimeResult
          ] = await Promise.all([
            prisma.document.count({
              where: documentWhere
            }),
            prisma.document.count({
              where: {
                ...documentWhere,
                status: { in: ['COMPLETED', 'APPROVED'] }
              }
            }),
            prisma.document.count({
              where: {
                ...documentWhere,
                status: 'APPROVED',
                autoApproved: true
              }
            }),
            prisma.document.aggregate({
              where: {
                ...documentWhere,
                status: { in: ['COMPLETED', 'APPROVED'] },
                processingDuration: { not: null }
              },
              _avg: {
                processingDuration: true
              }
            })
          ])

          return {
            forwarderId,
            forwarderCode: forwarder.code,
            forwarderName: forwarder.name,
            processingVolume: totalCount,
            successRate: totalCount > 0
              ? Math.round((successCount / totalCount) * 1000) / 10
              : 0,
            automationRate: successCount > 0
              ? Math.round((autoApprovedCount / successCount) * 1000) / 10
              : 0,
            avgProcessingTime: avgTimeResult._avg.processingDuration || 0
          }
        })
      )

      // 過濾掉不存在的 Forwarder
      const validData = comparisonData.filter(
        (d): d is ForwarderComparisonData => d !== null
      )

      return NextResponse.json<ForwarderComparisonResponse>({
        success: true,
        data: validData
      })
    } catch (error) {
      console.error('Forwarder comparison error:', error)
      return NextResponse.json<ForwarderComparisonResponse>(
        { success: false, error: 'Failed to fetch comparison data' },
        { status: 500 }
      )
    }
  })
}
```

---

## 4. Context Implementation

### 4.1 Dashboard Filter Context

```typescript
// src/contexts/DashboardFilterContext.tsx
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
import {
  DashboardFilterContextValue,
  DashboardFilterParams
} from '@/types/dashboard-filter'
import {
  calculatePresetRange,
  serializeDateRange,
  parseDateRange,
  isSameDateRange
} from '@/lib/date-range-utils'

const DashboardFilterContext = createContext<DashboardFilterContextValue | undefined>(undefined)

/**
 * URL 參數鍵名
 */
const URL_PARAMS = {
  RANGE: 'range',
  FORWARDERS: 'forwarders'
} as const

interface DashboardFilterProviderProps {
  children: ReactNode
  /** 初始日期範圍預設 */
  initialDatePreset?: PresetRange
  /** 是否同步 URL */
  syncWithUrl?: boolean
}

/**
 * 儀表板篩選 Provider
 */
export function DashboardFilterProvider({
  children,
  initialDatePreset = DEFAULT_PRESET,
  syncWithUrl = true
}: DashboardFilterProviderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // 日期範圍狀態
  const [dateRange, setDateRangeState] = useState<DateRange>(() => {
    if (syncWithUrl) {
      const urlRange = searchParams.get(URL_PARAMS.RANGE)
      if (urlRange) {
        return parseDateRange(urlRange)
      }
    }
    return calculatePresetRange(initialDatePreset)
  })

  // Forwarder 篩選狀態
  const [selectedForwarders, setSelectedForwardersState] = useState<string[]>(() => {
    if (syncWithUrl) {
      const urlForwarders = searchParams.get(URL_PARAMS.FORWARDERS)
      if (urlForwarders) {
        return urlForwarders.split(',').filter(Boolean)
      }
    }
    return []
  })

  // URL 同步函數
  const updateURL = useCallback(
    (newDateRange: DateRange, newForwarders: string[]) => {
      if (!syncWithUrl) return

      const params = new URLSearchParams()
      params.set(URL_PARAMS.RANGE, serializeDateRange(newDateRange))

      if (newForwarders.length > 0) {
        params.set(URL_PARAMS.FORWARDERS, newForwarders.join(','))
      }

      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [router, pathname, syncWithUrl]
  )

  // 設置日期範圍
  const setDateRange = useCallback(
    (range: DateRange) => {
      if (isSameDateRange(dateRange, range)) {
        return
      }
      setDateRangeState(range)
      updateURL(range, selectedForwarders)
    },
    [dateRange, selectedForwarders, updateURL]
  )

  // 設置預設日期範圍
  const setDatePreset = useCallback(
    (preset: PresetRange) => {
      const newRange = calculatePresetRange(preset)
      setDateRange(newRange)
    },
    [setDateRange]
  )

  // 設置選中的 Forwarders
  const setSelectedForwarders = useCallback(
    (ids: string[]) => {
      setSelectedForwardersState(ids)
      updateURL(dateRange, ids)
    },
    [dateRange, updateURL]
  )

  // 切換單個 Forwarder
  const toggleForwarder = useCallback(
    (id: string) => {
      const newSelection = selectedForwarders.includes(id)
        ? selectedForwarders.filter(f => f !== id)
        : [...selectedForwarders, id]
      setSelectedForwarders(newSelection)
    },
    [selectedForwarders, setSelectedForwarders]
  )

  // 清除所有 Forwarder 選擇
  const clearForwarders = useCallback(() => {
    setSelectedForwarders([])
  }, [setSelectedForwarders])

  // 全選 Forwarders
  const selectAllForwarders = useCallback(
    (ids: string[]) => {
      setSelectedForwarders(ids)
    },
    [setSelectedForwarders]
  )

  // 重置所有篩選
  const resetFilters = useCallback(() => {
    setDateRangeState(calculatePresetRange(initialDatePreset))
    setSelectedForwardersState([])
    if (syncWithUrl) {
      router.replace(pathname, { scroll: false })
    }
  }, [initialDatePreset, syncWithUrl, router, pathname])

  // 監聽 URL 變更（瀏覽器前進/後退）
  useEffect(() => {
    if (!syncWithUrl) return

    const urlRange = searchParams.get(URL_PARAMS.RANGE)
    const urlForwarders = searchParams.get(URL_PARAMS.FORWARDERS)

    if (urlRange) {
      const parsed = parseDateRange(urlRange)
      if (!isSameDateRange(dateRange, parsed)) {
        setDateRangeState(parsed)
      }
    }

    const newForwarders = urlForwarders
      ? urlForwarders.split(',').filter(Boolean)
      : []
    const currentStr = selectedForwarders.sort().join(',')
    const newStr = newForwarders.sort().join(',')
    if (currentStr !== newStr) {
      setSelectedForwardersState(newForwarders)
    }
  }, [searchParams, syncWithUrl])

  // 計算篩選參數
  const filterParams: DashboardFilterParams = useMemo(() => ({
    startDate: dateRange.startDate.toISOString(),
    endDate: dateRange.endDate.toISOString(),
    ...(selectedForwarders.length > 0 && { forwarderIds: selectedForwarders })
  }), [dateRange, selectedForwarders])

  // Context 值
  const value: DashboardFilterContextValue = useMemo(
    () => ({
      dateRange,
      selectedForwarders,
      filterParams,
      setDateRange,
      setDatePreset,
      setSelectedForwarders,
      toggleForwarder,
      clearForwarders,
      selectAllForwarders,
      resetFilters
    }),
    [
      dateRange,
      selectedForwarders,
      filterParams,
      setDateRange,
      setDatePreset,
      setSelectedForwarders,
      toggleForwarder,
      clearForwarders,
      selectAllForwarders,
      resetFilters
    ]
  )

  return (
    <DashboardFilterContext.Provider value={value}>
      {children}
    </DashboardFilterContext.Provider>
  )
}

/**
 * 使用儀表板篩選 Hook
 */
export function useDashboardFilter(): DashboardFilterContextValue {
  const context = useContext(DashboardFilterContext)
  if (!context) {
    throw new Error('useDashboardFilter must be used within DashboardFilterProvider')
  }
  return context
}

/**
 * 僅獲取 Forwarder 篩選狀態的 Hook
 */
export function useForwarderFilter() {
  const {
    selectedForwarders,
    setSelectedForwarders,
    toggleForwarder,
    clearForwarders,
    selectAllForwarders
  } = useDashboardFilter()

  return {
    selectedForwarders,
    setSelectedForwarders,
    toggleForwarder,
    clearForwarders,
    selectAllForwarders
  }
}
```

---

## 5. Frontend Components

### 5.1 ForwarderMultiSelect Component

```typescript
// src/components/dashboard/ForwarderMultiSelect.tsx
'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, ChevronsUpDown, Search, X, Loader2 } from 'lucide-react'
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
  CommandSeparator,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useDashboardFilter } from '@/contexts/DashboardFilterContext'
import { ForwarderOption, ForwarderListResponse } from '@/types/forwarder-filter'
import { useDebounce } from '@/hooks/useDebounce'

/**
 * 獲取 Forwarder 列表
 */
async function fetchForwarders(search?: string): Promise<ForwarderOption[]> {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  params.set('limit', '200')

  const response = await fetch(`/api/forwarders/list?${params}`)
  if (!response.ok) {
    throw new Error('Failed to fetch forwarders')
  }

  const result: ForwarderListResponse = await response.json()
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Unknown error')
  }

  return result.data
}

interface ForwarderMultiSelectProps {
  /** 自定義 className */
  className?: string
  /** 是否禁用 */
  disabled?: boolean
  /** 佔位文字 */
  placeholder?: string
}

/**
 * Forwarder 多選組件
 */
export function ForwarderMultiSelect({
  className,
  disabled = false,
  placeholder = '所有 Forwarder'
}: ForwarderMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)

  const {
    selectedForwarders,
    toggleForwarder,
    clearForwarders,
    selectAllForwarders
  } = useDashboardFilter()

  // 查詢 Forwarder 列表
  const {
    data: forwarders = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['forwarders-list', debouncedSearch],
    queryFn: () => fetchForwarders(debouncedSearch),
    staleTime: 5 * 60 * 1000,  // 5 分鐘
    enabled: open  // 只在打開時查詢
  })

  // 本地搜尋過濾（即時響應）
  const filteredOptions = useMemo(() => {
    if (!search || search === debouncedSearch) {
      return forwarders
    }
    const searchLower = search.toLowerCase()
    return forwarders.filter(
      f =>
        f.code.toLowerCase().includes(searchLower) ||
        f.name.toLowerCase().includes(searchLower)
    )
  }, [forwarders, search, debouncedSearch])

  // 已選擇的 Forwarder 詳情
  const selectedDetails = useMemo(() => {
    return forwarders.filter(f => selectedForwarders.includes(f.id))
  }, [forwarders, selectedForwarders])

  // 顯示文字
  const displayText = useMemo(() => {
    if (selectedForwarders.length === 0) {
      return placeholder
    }
    if (selectedForwarders.length === 1) {
      return selectedDetails[0]?.displayName || '1 個已選'
    }
    return `${selectedForwarders.length} 個已選`
  }, [selectedForwarders, selectedDetails, placeholder])

  // 全選處理
  const handleSelectAll = useCallback(() => {
    const allIds = filteredOptions.map(f => f.id)
    selectAllForwarders(allIds)
  }, [filteredOptions, selectAllForwarders])

  // 清除搜尋
  const handleClearSearch = useCallback(() => {
    setSearch('')
  }, [])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="選擇 Forwarder"
          disabled={disabled}
          className={cn('w-[250px] justify-between', className)}
        >
          <span className="truncate">{displayText}</span>
          <div className="flex items-center gap-1 ml-2 shrink-0">
            {selectedForwarders.length > 0 && (
              <Badge variant="secondary" className="px-1.5 text-xs">
                {selectedForwarders.length}
              </Badge>
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[320px] p-0" align="start">
        <Command shouldFilter={false}>
          {/* 搜尋輸入 */}
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              type="text"
              placeholder="搜尋 Forwarder..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
            />
            {search && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={handleClearSearch}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* 列表內容 */}
          <CommandList>
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">載入中...</span>
              </div>
            ) : error ? (
              <div className="py-6 text-center text-sm text-destructive">
                載入失敗，請重試
              </div>
            ) : filteredOptions.length === 0 ? (
              <CommandEmpty>找不到符合的 Forwarder</CommandEmpty>
            ) : (
              <>
                {/* 操作按鈕 */}
                <CommandGroup>
                  {selectedForwarders.length > 0 && (
                    <CommandItem
                      onSelect={clearForwarders}
                      className="text-muted-foreground"
                    >
                      <X className="mr-2 h-4 w-4" />
                      清除所有選擇
                    </CommandItem>
                  )}
                  {selectedForwarders.length < filteredOptions.length && (
                    <CommandItem
                      onSelect={handleSelectAll}
                      className="text-muted-foreground"
                    >
                      <Check className="mr-2 h-4 w-4" />
                      全選目前列表 ({filteredOptions.length})
                    </CommandItem>
                  )}
                </CommandGroup>

                <CommandSeparator />

                {/* Forwarder 選項列表 */}
                <CommandGroup heading="Forwarder 列表">
                  <ScrollArea className="h-[300px]">
                    {filteredOptions.map((forwarder) => {
                      const isSelected = selectedForwarders.includes(forwarder.id)
                      return (
                        <CommandItem
                          key={forwarder.id}
                          value={forwarder.id}
                          onSelect={() => toggleForwarder(forwarder.id)}
                          className="flex items-center gap-2"
                        >
                          <div
                            className={cn(
                              'flex h-4 w-4 items-center justify-center rounded-sm border',
                              isSelected
                                ? 'bg-primary border-primary text-primary-foreground'
                                : 'border-input'
                            )}
                          >
                            {isSelected && <Check className="h-3 w-3" />}
                          </div>
                          <div className="flex flex-col flex-1 min-w-0">
                            <span className="font-medium truncate">
                              {forwarder.code}
                            </span>
                            <span className="text-xs text-muted-foreground truncate">
                              {forwarder.name}
                            </span>
                          </div>
                        </CommandItem>
                      )
                    })}
                  </ScrollArea>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
```

### 5.2 ForwarderComparisonChart Component

```typescript
// src/components/dashboard/ForwarderComparisonChart.tsx
'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, BarChart3 } from 'lucide-react'
import { useDashboardFilter } from '@/contexts/DashboardFilterContext'
import { ForwarderComparisonData, ForwarderComparisonResponse } from '@/types/forwarder-filter'

/**
 * 獲取對比數據
 */
async function fetchComparisonData(
  forwarderIds: string[],
  startDate: string,
  endDate: string
): Promise<ForwarderComparisonData[]> {
  const params = new URLSearchParams({
    forwarderIds: forwarderIds.join(','),
    startDate,
    endDate
  })

  const response = await fetch(`/api/dashboard/forwarder-comparison?${params}`)
  if (!response.ok) {
    throw new Error('Failed to fetch comparison data')
  }

  const result: ForwarderComparisonResponse = await response.json()
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Unknown error')
  }

  return result.data
}

/**
 * 圖表顏色配置
 */
const CHART_COLORS = {
  volume: '#3b82f6',
  successRate: '#10b981',
  automationRate: '#f59e0b',
  processingTime: '#8b5cf6'
}

/**
 * 自定義工具提示
 */
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null

  return (
    <div className="bg-popover border rounded-lg shadow-lg p-3">
      <p className="font-medium mb-2">{label}</p>
      {payload.map((entry: any, index: number) => (
        <p key={index} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {entry.value.toLocaleString()}
          {entry.name.includes('率') ? '%' : entry.name.includes('時間') ? '秒' : ''}
        </p>
      ))}
    </div>
  )
}

/**
 * Forwarder 對比圖表組件
 */
export function ForwarderComparisonChart() {
  const { selectedForwarders, filterParams } = useDashboardFilter()

  // 查詢對比數據
  const { data, isLoading, error } = useQuery({
    queryKey: [
      'forwarder-comparison',
      selectedForwarders,
      filterParams.startDate,
      filterParams.endDate
    ],
    queryFn: () => fetchComparisonData(
      selectedForwarders,
      filterParams.startDate,
      filterParams.endDate
    ),
    enabled: selectedForwarders.length >= 2,
    staleTime: 60 * 1000
  })

  // 轉換圖表數據
  const chartData = useMemo(() => {
    if (!data) return []
    return data.map(d => ({
      name: d.forwarderCode,
      fullName: `${d.forwarderCode} - ${d.forwarderName}`,
      處理量: d.processingVolume,
      成功率: d.successRate,
      自動化率: d.automationRate,
      平均處理時間: Math.round(d.avgProcessingTime)
    }))
  }, [data])

  // 不顯示條件
  if (selectedForwarders.length < 2) {
    return null
  }

  // 載入狀態
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    )
  }

  // 錯誤狀態
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Forwarder 對比分析</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              載入對比數據失敗，請重試
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          <CardTitle>Forwarder 對比分析</CardTitle>
        </div>
        <CardDescription>
          比較 {selectedForwarders.length} 個 Forwarder 的處理表現
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="volume" className="space-y-4">
          <TabsList>
            <TabsTrigger value="volume">處理量</TabsTrigger>
            <TabsTrigger value="rates">成功率 / 自動化率</TabsTrigger>
            <TabsTrigger value="time">處理時間</TabsTrigger>
          </TabsList>

          {/* 處理量對比 */}
          <TabsContent value="volume">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  tick={{ fontSize: 12 }}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="處理量"
                  fill={CHART_COLORS.volume}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </TabsContent>

          {/* 成功率和自動化率對比 */}
          <TabsContent value="rates">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar
                  dataKey="成功率"
                  fill={CHART_COLORS.successRate}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="自動化率"
                  fill={CHART_COLORS.automationRate}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </TabsContent>

          {/* 處理時間對比 */}
          <TabsContent value="time">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  tickFormatter={(v) => `${v}s`}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="平均處理時間"
                  fill={CHART_COLORS.processingTime}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
```

### 5.3 DashboardFilters Component

```typescript
// src/components/dashboard/DashboardFilters.tsx
'use client'

import { Button } from '@/components/ui/button'
import { RotateCcw } from 'lucide-react'
import { DateRangePicker } from './DateRangePicker'
import { ForwarderMultiSelect } from './ForwarderMultiSelect'
import { useDashboardFilter } from '@/contexts/DashboardFilterContext'

interface DashboardFiltersProps {
  /** 是否顯示重置按鈕 */
  showReset?: boolean
  /** 自定義 className */
  className?: string
}

/**
 * 儀表板篩選組件
 * 整合日期範圍和 Forwarder 篩選
 */
export function DashboardFilters({
  showReset = true,
  className
}: DashboardFiltersProps) {
  const { selectedForwarders, dateRange, resetFilters } = useDashboardFilter()

  const hasFilters = selectedForwarders.length > 0 || dateRange.preset === 'custom'

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-3">
        <DateRangePicker />
        <ForwarderMultiSelect />

        {showReset && hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="text-muted-foreground"
          >
            <RotateCcw className="mr-1 h-4 w-4" />
            重置篩選
          </Button>
        )}
      </div>
    </div>
  )
}
```

---

## 6. Hooks

### 6.1 useDebounce Hook

```typescript
// src/hooks/useDebounce.ts
import { useState, useEffect } from 'react'

/**
 * 防抖 Hook
 * @param value 要防抖的值
 * @param delay 延遲時間（毫秒）
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}
```

### 6.2 useForwarderList Hook

```typescript
// src/hooks/useForwarderList.ts
import { useQuery } from '@tanstack/react-query'
import { ForwarderOption, ForwarderListResponse } from '@/types/forwarder-filter'

interface UseForwarderListOptions {
  /** 搜尋關鍵字 */
  search?: string
  /** 返回數量限制 */
  limit?: number
  /** 是否啟用 */
  enabled?: boolean
}

/**
 * Forwarder 列表查詢 Hook
 */
export function useForwarderList(options: UseForwarderListOptions = {}) {
  const { search, limit = 100, enabled = true } = options

  return useQuery<ForwarderOption[], Error>({
    queryKey: ['forwarders-list', search, limit],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      params.set('limit', limit.toString())

      const response = await fetch(`/api/forwarders/list?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch forwarders')
      }

      const result: ForwarderListResponse = await response.json()
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Unknown error')
      }

      return result.data
    },
    staleTime: 5 * 60 * 1000,
    enabled
  })
}
```

---

## 7. Testing Strategy

### 7.1 API Tests

```typescript
// __tests__/api/forwarders/list.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '@/app/api/forwarders/list/route'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'

vi.mock('@/lib/prisma')
vi.mock('@/lib/redis')
vi.mock('@/middleware/city-filter', () => ({
  withCityFilter: vi.fn((req, handler) =>
    handler(req, { isGlobalAdmin: false, cityCodes: ['HKG'] })
  )
}))

describe('GET /api/forwarders/list', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return forwarder list', async () => {
    vi.mocked(redis.get).mockResolvedValue(null)
    vi.mocked(prisma.forwarder.findMany).mockResolvedValue([
      { id: '1', code: 'FWD001', name: 'Forwarder 1' },
      { id: '2', code: 'FWD002', name: 'Forwarder 2' }
    ])

    const request = new NextRequest('http://localhost/api/forwarders/list')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data).toHaveLength(2)
  })

  it('should filter by search term', async () => {
    vi.mocked(redis.get).mockResolvedValue(null)
    vi.mocked(prisma.forwarder.findMany).mockResolvedValue([
      { id: '1', code: 'FWD001', name: 'Test Forwarder' }
    ])

    const request = new NextRequest(
      'http://localhost/api/forwarders/list?search=test'
    )
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data).toHaveLength(1)
    expect(prisma.forwarder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ code: expect.anything() }),
            expect.objectContaining({ name: expect.anything() })
          ])
        })
      })
    )
  })

  it('should return cached data if available', async () => {
    const cachedData = [
      { id: '1', code: 'FWD001', name: 'Cached', displayName: 'FWD001 - Cached' }
    ]
    vi.mocked(redis.get).mockResolvedValue(JSON.stringify(cachedData))

    const request = new NextRequest('http://localhost/api/forwarders/list')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data).toEqual(cachedData)
    expect(prisma.forwarder.findMany).not.toHaveBeenCalled()
  })
})
```

### 7.2 Component Tests

```typescript
// __tests__/components/dashboard/ForwarderMultiSelect.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ForwarderMultiSelect } from '@/components/dashboard/ForwarderMultiSelect'
import { DashboardFilterProvider } from '@/contexts/DashboardFilterContext'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mocks
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/dashboard'
}))

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({
    success: true,
    data: [
      { id: '1', code: 'FWD001', name: 'Forwarder 1', displayName: 'FWD001 - Forwarder 1' },
      { id: '2', code: 'FWD002', name: 'Forwarder 2', displayName: 'FWD002 - Forwarder 2' }
    ]
  })
})

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardFilterProvider syncWithUrl={false}>
        {ui}
      </DashboardFilterProvider>
    </QueryClientProvider>
  )
}

describe('ForwarderMultiSelect', () => {
  it('should render with placeholder', () => {
    renderWithProviders(<ForwarderMultiSelect />)
    expect(screen.getByText('所有 Forwarder')).toBeInTheDocument()
  })

  it('should open dropdown and show options', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ForwarderMultiSelect />)

    await user.click(screen.getByRole('combobox'))

    await waitFor(() => {
      expect(screen.getByText('FWD001')).toBeInTheDocument()
      expect(screen.getByText('FWD002')).toBeInTheDocument()
    })
  })

  it('should select and deselect forwarders', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ForwarderMultiSelect />)

    await user.click(screen.getByRole('combobox'))

    await waitFor(() => {
      expect(screen.getByText('FWD001')).toBeInTheDocument()
    })

    // Select first forwarder
    await user.click(screen.getByText('FWD001'))

    // Check badge appears
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('should filter by search input', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ForwarderMultiSelect />)

    await user.click(screen.getByRole('combobox'))
    await user.type(screen.getByPlaceholderText('搜尋 Forwarder...'), 'FWD001')

    await waitFor(() => {
      expect(screen.getByText('FWD001')).toBeInTheDocument()
    })
  })
})
```

### 7.3 Context Tests

```typescript
// __tests__/contexts/DashboardFilterContext.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { DashboardFilterProvider, useDashboardFilter } from '@/contexts/DashboardFilterContext'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/dashboard'
}))

describe('DashboardFilterContext', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <DashboardFilterProvider syncWithUrl={false}>{children}</DashboardFilterProvider>
  )

  it('should provide initial state', () => {
    const { result } = renderHook(() => useDashboardFilter(), { wrapper })

    expect(result.current.selectedForwarders).toEqual([])
    expect(result.current.dateRange.preset).toBe('thisMonth')
  })

  it('should toggle forwarder selection', () => {
    const { result } = renderHook(() => useDashboardFilter(), { wrapper })

    act(() => {
      result.current.toggleForwarder('fwd-1')
    })
    expect(result.current.selectedForwarders).toContain('fwd-1')

    act(() => {
      result.current.toggleForwarder('fwd-1')
    })
    expect(result.current.selectedForwarders).not.toContain('fwd-1')
  })

  it('should clear all forwarders', () => {
    const { result } = renderHook(() => useDashboardFilter(), { wrapper })

    act(() => {
      result.current.setSelectedForwarders(['fwd-1', 'fwd-2', 'fwd-3'])
    })
    expect(result.current.selectedForwarders).toHaveLength(3)

    act(() => {
      result.current.clearForwarders()
    })
    expect(result.current.selectedForwarders).toHaveLength(0)
  })

  it('should generate correct filter params', () => {
    const { result } = renderHook(() => useDashboardFilter(), { wrapper })

    act(() => {
      result.current.setSelectedForwarders(['fwd-1', 'fwd-2'])
    })

    expect(result.current.filterParams.forwarderIds).toEqual(['fwd-1', 'fwd-2'])
    expect(result.current.filterParams.startDate).toBeDefined()
    expect(result.current.filterParams.endDate).toBeDefined()
  })
})
```

---

## 8. Performance Considerations

### 8.1 Optimization Strategies

1. **虛擬滾動**: 使用 ScrollArea 配合按需載入處理大量 Forwarder
2. **防抖搜尋**: 搜尋輸入 300ms 防抖，減少 API 請求
3. **按需載入**: 只在打開下拉時載入完整列表
4. **快取策略**: Forwarder 列表快取 5 分鐘
5. **本地過濾**: 搜尋時先本地過濾已載入數據，再發送 API 請求

### 8.2 Query Key Strategy

```typescript
// 確保查詢鍵穩定，避免不必要的重新請求
queryKey: ['forwarders-list', debouncedSearch]
queryKey: ['forwarder-comparison', selectedForwarders.sort().join(','), startDate, endDate]
```

---

## 9. Accessibility

1. **ARIA 屬性**: combobox 角色和 aria-expanded 狀態
2. **鍵盤導航**: 支援 Tab、Enter、Escape 鍵操作
3. **焦點管理**: 打開下拉時聚焦到搜尋輸入
4. **螢幕閱讀器**: 適當的標籤和說明文字
5. **色彩對比**: 圖表顏色符合 WCAG 標準

---

## 10. Acceptance Criteria Verification

| AC | Description | Implementation | Verification |
|----|-------------|----------------|--------------|
| AC1 | Forwarder 多選清單 + 搜尋 | ForwarderMultiSelect + API | 組件測試 |
| AC2 | 單一 Forwarder 篩選 | toggleForwarder + filterParams | 整合測試 |
| AC3 | 多 Forwarder 對比 | ForwarderComparisonChart | 圖表測試 |
| AC4 | 篩選器持久化 + URL | DashboardFilterContext | Context 測試 |

---

## 11. References

- [Recharts Documentation](https://recharts.org/)
- [shadcn/ui Command](https://ui.shadcn.com/docs/components/command)
- [React Query - Dependent Queries](https://tanstack.com/query/latest/docs/framework/react/guides/dependent-queries)
- Story 7.3 Requirements Document
