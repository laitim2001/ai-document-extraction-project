'use client'

/**
 * @fileoverview 城市篩選組件（URL 同步）
 * @description
 *   提供城市篩選功能，與 URL 參數自動同步：
 *   - 選擇自動更新 URL 參數
 *   - 頁面重載後保持選擇狀態
 *   - 支援 localStorage 持久化
 *   - 按區域分組顯示城市
 *
 *   設計用於列表頁面頂部的篩選器區域。
 *
 * @module src/components/filters/CityFilter
 * @author Development Team
 * @since Epic 6 - Story 6.3 (Regional Manager Cross-City Access)
 * @lastModified 2025-12-19
 *
 * @features
 *   - URL 參數同步
 *   - localStorage 持久化
 *   - 區域分組顯示
 *   - 搜尋過濾
 *   - 響應式 UI
 *
 * @dependencies
 *   - @/hooks/useCityFilter - 城市篩選 Hook
 *   - @/hooks/useUserCity - 用戶城市權限
 *   - @tanstack/react-query - 數據查詢
 *
 * @related
 *   - src/components/filters/CityMultiSelect.tsx - 城市多選組件
 *   - src/hooks/useCityFilter.ts - 城市篩選 Hook
 *
 * @example
 *   // 在列表頁面使用
 *   <CityFilter onChange={(cities) => refetch({ cities })} />
 */

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useUserCity } from '@/hooks/useUserCity'
import { useDebounce } from 'use-debounce'
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
// Constants
// ============================================================

/** localStorage 存儲鍵 */
const STORAGE_KEY = 'city-filter-selection'

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
 * CityFilter 組件屬性
 */
interface CityFilterProps {
  /** URL 參數名稱 */
  paramName?: string
  /** 選擇改變回調 */
  onChange?: (cityCodes: string[]) => void
  /** 是否持久化到 localStorage */
  persistSelection?: boolean
  /** 自定義類名 */
  className?: string
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

  return Object.values(groups).sort((a, b) =>
    a.region.code.localeCompare(b.region.code)
  )
}

// ============================================================
// Component
// ============================================================

/**
 * 城市篩選組件（URL 同步）
 *
 * @description
 *   提供城市篩選 UI，自動與 URL 參數同步。
 *   單一城市用戶不顯示此組件。
 *
 * @example
 *   // 基本用法 - 自動 URL 同步
 *   <CityFilter />
 *
 *   // 帶回調 - 用於即時刷新數據
 *   <CityFilter onChange={(cities) => refetch({ cities })} />
 *
 *   // 自定義 URL 參數名
 *   <CityFilter paramName="city" />
 */
export function CityFilter({
  paramName = 'cities',
  onChange,
  persistSelection = true,
  className,
}: CityFilterProps) {
  // --- Hooks ---
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const {
    cityCodes: userCityCodes,
    isGlobalAdmin,
    isSingleCity,
    isLoading: userLoading,
  } = useUserCity()

  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch] = useDebounce(searchQuery, 200)

  // --- Data Fetching ---
  const {
    data: cities = [],
    isLoading: citiesLoading,
  } = useQuery({
    queryKey: ['accessible-cities'],
    queryFn: async () => {
      const response = await fetch('/api/cities/accessible')
      if (!response.ok) throw new Error('Failed to fetch cities')
      const data = await response.json()
      return data.data as City[]
    },
    staleTime: 5 * 60 * 1000,
  })

  // --- URL 選擇狀態 ---
  const getSelectedFromUrl = useCallback((): string[] => {
    const param = searchParams.get(paramName)
    if (!param) return []
    return param.split(',').filter(Boolean)
  }, [searchParams, paramName])

  const selectedCities = getSelectedFromUrl()
  const isAllSelected = selectedCities.length === 0

  // --- 過濾搜尋結果 ---
  const filteredCities = useMemo(() => {
    if (!debouncedSearch.trim()) return cities

    const query = debouncedSearch.toLowerCase()
    return cities.filter(
      (city) =>
        city.code.toLowerCase().includes(query) ||
        city.name.toLowerCase().includes(query)
    )
  }, [cities, debouncedSearch])

  // --- 按區域分組 ---
  const groupedCities = useMemo(
    () => groupCitiesByRegion(filteredCities),
    [filteredCities]
  )

  // --- URL 更新 ---
  const updateSelection = useCallback(
    (newSelection: string[]) => {
      const params = new URLSearchParams(searchParams.toString())

      if (newSelection.length === 0 || newSelection.length === cities.length) {
        params.delete(paramName)
      } else {
        params.set(paramName, newSelection.join(','))
      }

      const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname
      router.push(newUrl, { scroll: false })

      // 持久化到 localStorage
      if (persistSelection) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newSelection))
      }

      // 觸發回調
      onChange?.(newSelection.length === 0 ? userCityCodes : newSelection)
    },
    [searchParams, paramName, pathname, router, cities.length, onChange, userCityCodes, persistSelection]
  )

  // --- 切換單個城市 ---
  const toggleCity = useCallback(
    (cityCode: string) => {
      if (isAllSelected) {
        // 從全選狀態 -> 選擇除了這個城市以外的所有城市
        const newSelection = cities
          .map((c) => c.code)
          .filter((c) => c !== cityCode)
        updateSelection(newSelection)
      } else if (selectedCities.includes(cityCode)) {
        // 取消選擇
        const newSelection = selectedCities.filter((c) => c !== cityCode)
        updateSelection(newSelection.length > 0 ? newSelection : [])
      } else {
        // 添加選擇
        updateSelection([...selectedCities, cityCode])
      }
    },
    [isAllSelected, selectedCities, cities, updateSelection]
  )

  // --- 全選 ---
  const selectAll = useCallback(() => {
    updateSelection([])
  }, [updateSelection])

  // --- 清除選擇（保留第一個城市）---
  const clearSelection = useCallback(() => {
    if (cities.length > 0) {
      updateSelection([cities[0].code])
    }
  }, [cities, updateSelection])

  // --- 切換區域全選 ---
  const toggleRegion = useCallback(
    (regionCode: string) => {
      const group = groupedCities.find((g) => g.region.code === regionCode)
      if (!group) return

      const regionCityCodes = group.cities.map((c) => c.code)
      const effectiveSelected = isAllSelected
        ? cities.map((c) => c.code)
        : selectedCities
      const allRegionSelected = regionCityCodes.every((c) =>
        effectiveSelected.includes(c)
      )

      if (allRegionSelected) {
        // 取消選擇區域
        const newSelection = effectiveSelected.filter(
          (c) => !regionCityCodes.includes(c)
        )
        updateSelection(
          newSelection.length > 0 ? newSelection : [cities[0]?.code].filter(Boolean)
        )
      } else {
        // 選擇區域
        const newSelection = [...new Set([...effectiveSelected, ...regionCityCodes])]
        updateSelection(newSelection)
      }
    },
    [groupedCities, isAllSelected, selectedCities, cities, updateSelection]
  )

  // --- 從 localStorage 恢復選擇 ---
  useEffect(() => {
    if (!persistSelection) return
    if (searchParams.has(paramName)) return

    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const savedSelection = JSON.parse(stored) as string[]
        // 驗證保存的選擇
        const validSelection = savedSelection.filter((c) =>
          isGlobalAdmin || userCityCodes.includes(c)
        )
        if (validSelection.length > 0 && validSelection.length < cities.length) {
          updateSelection(validSelection)
        }
      } catch {
        // 無效的存儲數據
      }
    }
  }, [cities.length, persistSelection, searchParams, paramName, isGlobalAdmin, userCityCodes, updateSelection])

  // --- 顯示文字 ---
  const displayText = useMemo(() => {
    if (isAllSelected) return '所有城市'
    if (selectedCities.length === 1) {
      const city = cities.find((c) => c.code === selectedCities[0])
      return city?.name || selectedCities[0]
    }
    return `${selectedCities.length} 個城市`
  }, [isAllSelected, selectedCities, cities])

  // --- 單一城市用戶不顯示 ---
  if (isSingleCity || userLoading) {
    return null
  }

  const isLoading = citiesLoading

  // --- Render ---
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('justify-between gap-2 min-w-[180px]', className)}
          disabled={isLoading}
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
              {!isAllSelected && (
                <Badge variant="secondary" className="ml-1 h-5 px-1">
                  {selectedCities.length}
                </Badge>
              )}
              <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
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
          >
            <CheckSquare className="h-3 w-3 mr-1" />
            全選
          </Button>
          {!isAllSelected && selectedCities.length > 1 && (
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
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground">
              載入中...
            </div>
          ) : groupedCities.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              找不到城市
            </div>
          ) : (
            <div className="p-2">
              {groupedCities.map((group) => {
                const regionCityCodes = group.cities.map((c) => c.code)
                const effectiveSelected = isAllSelected
                  ? cities.map((c) => c.code)
                  : selectedCities
                const allRegionSelected = regionCityCodes.every((c) =>
                  effectiveSelected.includes(c)
                )
                const someRegionSelected = regionCityCodes.some((c) =>
                  effectiveSelected.includes(c)
                )

                return (
                  <div key={group.region.code} className="mb-3">
                    {/* 區域標題 */}
                    <div
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                      onClick={() => toggleRegion(group.region.code)}
                    >
                      <Checkbox
                        checked={allRegionSelected}
                        className={cn(
                          !allRegionSelected && someRegionSelected && 'opacity-50'
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
                        const isSelected =
                          isAllSelected || selectedCities.includes(city.code)

                        return (
                          <div
                            key={city.code}
                            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                            onClick={() => toggleCity(city.code)}
                          >
                            <Checkbox checked={isSelected} />
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
        {selectedCities.length > 0 && (
          <div className="p-2 border-t">
            <div className="flex flex-wrap gap-1">
              {selectedCities.slice(0, 5).map((code) => {
                const city = cities.find((c) => c.code === code)
                return (
                  <Badge
                    key={code}
                    variant="secondary"
                    className="text-xs cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => toggleCity(code)}
                  >
                    {city?.name || code}
                    <X className="h-3 w-3 ml-1" />
                  </Badge>
                )
              })}
              {selectedCities.length > 5 && (
                <Badge variant="outline" className="text-xs">
                  +{selectedCities.length - 5}
                </Badge>
              )}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
