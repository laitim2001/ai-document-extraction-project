'use client'

/**
 * @fileoverview 城市多選組件
 * @description
 *   提供可重用的城市多選功能，支援：
 *   - 從 API 獲取可訪問城市
 *   - 按區域分組顯示
 *   - 最小/最大選擇限制
 *   - 搜尋過濾
 *   - 選擇/取消全選
 *
 *   設計用於被其他組件包裝使用，如 CityFilter、CityComparison 等。
 *
 * @module src/components/filters/CityMultiSelect
 * @author Development Team
 * @since Epic 6 - Story 6.3 (Regional Manager Cross-City Access)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 多選城市支援
 *   - 區域分組顯示
 *   - 搜尋過濾
 *   - 選擇限制
 *   - Popover UI
 *
 * @dependencies
 *   - @tanstack/react-query - 數據查詢
 *   - @/hooks/useUserCity - 用戶城市權限
 *   - @/components/ui/* - shadcn/ui 組件
 *
 * @related
 *   - src/components/filters/CityFilter.tsx - URL 同步城市篩選
 *   - src/components/analytics/CityComparison.tsx - 城市對比分析
 *   - src/app/api/cities/accessible/route.ts - 可訪問城市 API
 */

import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useUserCity } from '@/hooks/useUserCity'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  MapPin,
  ChevronDown,
  X,
  Search,
  CheckSquare,
  Square,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================================
// Types
// ============================================================

/**
 * 城市資訊
 */
interface City {
  code: string
  name: string
  region: {
    code: string
    name: string
  }
}

/**
 * 城市按區域分組
 */
interface CityGroup {
  region: {
    code: string
    name: string
  }
  cities: City[]
}

/**
 * CityMultiSelect 組件屬性
 */
interface CityMultiSelectProps {
  /** 當前選中的城市代碼 */
  value: string[]
  /** 選擇改變回調 */
  onChange: (cities: string[]) => void
  /** 最小選擇數量 */
  minSelection?: number
  /** 最大選擇數量 */
  maxSelection?: number
  /** 佔位文字 */
  placeholder?: string
  /** 是否禁用 */
  disabled?: boolean
  /** 自定義類名 */
  className?: string
  /** Popover 對齊方式 */
  align?: 'start' | 'center' | 'end'
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 將城市列表按區域分組
 */
function groupCitiesByRegion(cities: City[]): CityGroup[] {
  const groups: Record<string, CityGroup> = {}

  for (const city of cities) {
    const regionCode = city.region.code
    if (!groups[regionCode]) {
      groups[regionCode] = {
        region: city.region,
        cities: [],
      }
    }
    groups[regionCode].cities.push(city)
  }

  // 按區域代碼排序
  return Object.values(groups).sort((a, b) =>
    a.region.code.localeCompare(b.region.code)
  )
}

// ============================================================
// Component
// ============================================================

/**
 * 城市多選組件
 *
 * @description
 *   提供可重用的城市多選 UI，支援搜尋、分組、選擇限制等功能。
 *   從 API 獲取用戶可訪問的城市列表。
 *
 * @example
 *   // 基本用法
 *   <CityMultiSelect
 *     value={selectedCities}
 *     onChange={setSelectedCities}
 *   />
 *
 *   // 限制選擇數量（用於對比分析）
 *   <CityMultiSelect
 *     value={selectedCities}
 *     onChange={setSelectedCities}
 *     minSelection={2}
 *     maxSelection={5}
 *   />
 */
export function CityMultiSelect({
  value,
  onChange,
  minSelection = 0,
  maxSelection,
  placeholder = '選擇城市...',
  disabled = false,
  className,
  align = 'start',
}: CityMultiSelectProps) {
  // --- Hooks ---
  const { isSingleCity, isLoading: userLoading } = useUserCity()

  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // --- Data Fetching ---
  const {
    data: cities = [],
    isLoading: citiesLoading,
    error,
  } = useQuery({
    queryKey: ['accessible-cities'],
    queryFn: async () => {
      const response = await fetch('/api/cities/accessible')
      if (!response.ok) {
        throw new Error('Failed to fetch cities')
      }
      const data = await response.json()
      return data.data as City[]
    },
    staleTime: 5 * 60 * 1000, // 5 分鐘
  })

  // --- Computed Values ---
  const isLoading = userLoading || citiesLoading

  // 過濾搜尋結果
  const filteredCities = useMemo(() => {
    if (!searchQuery.trim()) return cities

    const query = searchQuery.toLowerCase()
    return cities.filter(
      (city) =>
        city.code.toLowerCase().includes(query) ||
        city.name.toLowerCase().includes(query) ||
        city.region.name.toLowerCase().includes(query)
    )
  }, [cities, searchQuery])

  // 按區域分組
  const groupedCities = useMemo(
    () => groupCitiesByRegion(filteredCities),
    [filteredCities]
  )

  // 計算是否可以選擇更多
  const canSelectMore = !maxSelection || value.length < maxSelection

  // 計算是否可以取消選擇
  const canDeselect = value.length > minSelection

  // --- Handlers ---

  /**
   * 切換單個城市選擇
   */
  const toggleCity = useCallback(
    (cityCode: string) => {
      if (value.includes(cityCode)) {
        // 取消選擇
        if (canDeselect) {
          onChange(value.filter((c) => c !== cityCode))
        }
      } else {
        // 選擇
        if (canSelectMore) {
          onChange([...value, cityCode])
        }
      }
    },
    [value, onChange, canSelectMore, canDeselect]
  )

  /**
   * 切換區域全選
   */
  const toggleRegion = useCallback(
    (regionCode: string) => {
      const group = groupedCities.find((g) => g.region.code === regionCode)
      if (!group) return

      const regionCityCodes = group.cities.map((c) => c.code)
      const allSelected = regionCityCodes.every((c) => value.includes(c))

      if (allSelected) {
        // 取消選擇區域內所有城市
        const newValue = value.filter((c) => !regionCityCodes.includes(c))
        if (newValue.length >= minSelection) {
          onChange(newValue)
        }
      } else {
        // 選擇區域內所有城市
        const newCities = regionCityCodes.filter((c) => !value.includes(c))
        const wouldHave = value.length + newCities.length

        if (!maxSelection || wouldHave <= maxSelection) {
          onChange([...value, ...newCities])
        } else {
          // 只添加到最大限制
          const canAdd = maxSelection - value.length
          onChange([...value, ...newCities.slice(0, canAdd)])
        }
      }
    },
    [groupedCities, value, onChange, minSelection, maxSelection]
  )

  /**
   * 全選
   */
  const selectAll = useCallback(() => {
    const allCodes = cities.map((c) => c.code)
    if (maxSelection && allCodes.length > maxSelection) {
      onChange(allCodes.slice(0, maxSelection))
    } else {
      onChange(allCodes)
    }
  }, [cities, maxSelection, onChange])

  /**
   * 清除選擇
   */
  const clearSelection = useCallback(() => {
    if (minSelection > 0) {
      // 保留最小數量
      onChange(value.slice(0, minSelection))
    } else {
      onChange([])
    }
  }, [minSelection, value, onChange])

  // --- Display Text ---
  const displayText = useMemo(() => {
    if (value.length === 0) return placeholder
    if (value.length === 1) {
      const city = cities.find((c) => c.code === value[0])
      return city?.name || value[0]
    }
    if (value.length === cities.length) return '所有城市'
    return `${value.length} 個城市`
  }, [value, cities, placeholder])

  // --- Render ---

  // 單一城市用戶不需要多選
  if (isSingleCity) {
    return null
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || isLoading}
          className={cn('justify-between gap-2 min-w-[180px]', className)}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              載入中...
            </span>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0" />
                <span className="truncate">{displayText}</span>
              </div>
              {value.length > 0 && value.length < cities.length && (
                <Badge variant="secondary" className="ml-1 h-5 px-1">
                  {value.length}
                </Badge>
              )}
              <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align={align}>
        {/* 搜尋框 */}
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜尋城市..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        {/* 快捷操作 */}
        <div className="p-2 border-b flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={selectAll}
            className="flex-1 text-xs"
            disabled={!canSelectMore && value.length !== cities.length}
          >
            <CheckSquare className="h-3 w-3 mr-1" />
            全選
            {maxSelection && <span className="ml-1 text-muted-foreground">(最多 {maxSelection})</span>}
          </Button>
          {value.length > minSelection && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSelection}
              className="flex-1 text-xs"
            >
              <Square className="h-3 w-3 mr-1" />
              清除
            </Button>
          )}
        </div>

        {/* 城市列表 */}
        <ScrollArea className="h-[300px]">
          {error ? (
            <div className="p-4 text-center text-destructive">
              載入失敗
            </div>
          ) : groupedCities.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              {searchQuery ? '找不到城市' : '無可用城市'}
            </div>
          ) : (
            <div className="p-2">
              {groupedCities.map((group) => {
                const regionCityCodes = group.cities.map((c) => c.code)
                const allSelected = regionCityCodes.every((c) =>
                  value.includes(c)
                )
                const someSelected = regionCityCodes.some((c) =>
                  value.includes(c)
                )

                return (
                  <div key={group.region.code} className="mb-3">
                    {/* 區域標題 */}
                    <div
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                      onClick={() => toggleRegion(group.region.code)}
                    >
                      <Checkbox
                        checked={allSelected}
                        className={cn(
                          !allSelected && someSelected && 'opacity-50'
                        )}
                      />
                      <span className="text-sm font-medium text-muted-foreground">
                        {group.region.name}
                      </span>
                      <Badge variant="outline" className="ml-auto text-xs">
                        {group.cities.length}
                      </Badge>
                    </div>

                    {/* 區域內城市 */}
                    <div className="ml-4 space-y-0.5">
                      {group.cities.map((city) => {
                        const isSelected = value.includes(city.code)
                        const isDisabled =
                          (!isSelected && !canSelectMore) ||
                          (isSelected && !canDeselect)

                        return (
                          <div
                            key={city.code}
                            className={cn(
                              'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer',
                              isDisabled
                                ? 'opacity-50 cursor-not-allowed'
                                : 'hover:bg-muted'
                            )}
                            onClick={() => !isDisabled && toggleCity(city.code)}
                          >
                            <Checkbox
                              checked={isSelected}
                              disabled={isDisabled}
                            />
                            <span className="text-sm flex-1">{city.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {city.code}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>

        {/* 已選擇標籤 */}
        {value.length > 0 && (
          <div className="p-2 border-t">
            <div className="flex flex-wrap gap-1">
              {value.slice(0, 5).map((code) => {
                const city = cities.find((c) => c.code === code)
                return (
                  <Badge
                    key={code}
                    variant="secondary"
                    className={cn(
                      'text-xs',
                      canDeselect &&
                        'cursor-pointer hover:bg-destructive hover:text-destructive-foreground'
                    )}
                    onClick={() => canDeselect && toggleCity(code)}
                  >
                    {city?.name || code}
                    {canDeselect && <X className="h-3 w-3 ml-1" />}
                  </Badge>
                )
              })}
              {value.length > 5 && (
                <Badge variant="outline" className="text-xs">
                  +{value.length - 5}
                </Badge>
              )}
            </div>
            {minSelection > 0 && value.length === minSelection && (
              <p className="text-xs text-muted-foreground mt-1">
                最少需選擇 {minSelection} 個城市
              </p>
            )}
            {maxSelection && value.length === maxSelection && (
              <p className="text-xs text-muted-foreground mt-1">
                已達最大選擇數量 ({maxSelection})
              </p>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
