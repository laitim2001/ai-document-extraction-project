'use client'

/**
 * @fileoverview 城市篩選 URL 同步 Hook
 * @description
 *   提供城市篩選與 URL 參數同步功能：
 *   - 從 URL 讀取已選城市
 *   - 驗證選擇的城市權限
 *   - 提供有效城市列表供 API 調用
 *   - 支援 localStorage 持久化
 *
 *   ## 使用場景
 *   - 列表頁面城市篩選
 *   - 報表頁面城市選擇
 *   - 分析頁面數據過濾
 *
 * @module src/hooks/useCityFilter
 * @author Development Team
 * @since Epic 6 - Story 6.3 (Regional Manager Cross-City Access)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - next/navigation - Next.js 導航
 *   - @/hooks/useUserCity - 用戶城市 Hook
 *
 * @related
 *   - src/components/filters/CityFilter.tsx - 城市篩選組件
 *   - src/components/filters/CityMultiSelect.tsx - 城市多選組件
 *
 * @example
 *   const { effectiveCities, isFiltered, buildCityParam } = useCityFilter()
 *
 *   // API 調用時使用有效城市
 *   const data = await fetchData({ cities: effectiveCities })
 */

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useUserCity } from './useUserCity'
import { useMemo, useCallback, useEffect, useState } from 'react'

// ===========================================
// Constants
// ===========================================

/** localStorage 存儲鍵 */
const STORAGE_KEY = 'city-filter-selection'

/** 默認 URL 參數名 */
const DEFAULT_PARAM_NAME = 'cities'

// ===========================================
// Types
// ===========================================

/**
 * useCityFilter Hook 返回類型
 */
export interface UseCityFilterReturn {
  /** 當前 URL 中選擇的城市代碼 */
  selectedCities: string[]
  /** 是否選擇全部城市（無篩選） */
  isAllSelected: boolean
  /** 有效的城市代碼列表（用於 API 調用） */
  effectiveCities: string[]
  /** 是否正在篩選（非全選狀態） */
  isFiltered: boolean
  /** 更新選擇的城市 */
  setSelectedCities: (cities: string[]) => void
  /** 選擇全部城市 */
  selectAll: () => void
  /** 清除選擇（選擇第一個城市） */
  clearSelection: () => void
  /** 切換單個城市選擇 */
  toggleCity: (cityCode: string) => void
  /** 構建城市參數字串供 API 使用 */
  buildCityParam: () => string | undefined
  /** 是否正在載入 */
  isLoading: boolean
}

/**
 * useCityFilter Hook 選項
 */
export interface UseCityFilterOptions {
  /** URL 參數名稱 */
  paramName?: string
  /** 是否持久化到 localStorage */
  persist?: boolean
  /** 選擇改變時的回調 */
  onChange?: (cities: string[]) => void
}

// ===========================================
// useCityFilter Hook
// ===========================================

/**
 * 城市篩選 URL 同步 Hook
 *
 * @description
 *   提供城市篩選功能，與 URL 參數同步：
 *   - 從 URL 讀取已選城市
 *   - 驗證選擇是否在用戶權限範圍內
 *   - 支援 localStorage 持久化
 *   - 提供便捷的操作方法
 *
 * @param options - Hook 選項
 * @returns 城市篩選狀態和操作方法
 *
 * @example
 *   function DocumentList() {
 *     const {
 *       effectiveCities,
 *       isFiltered,
 *       setSelectedCities
 *     } = useCityFilter({ paramName: 'city' })
 *
 *     const { data } = useQuery({
 *       queryKey: ['documents', effectiveCities],
 *       queryFn: () => fetchDocuments({ cities: effectiveCities })
 *     })
 *
 *     return <DocumentTable data={data} />
 *   }
 */
export function useCityFilter(options: UseCityFilterOptions = {}): UseCityFilterReturn {
  const {
    paramName = DEFAULT_PARAM_NAME,
    persist = true,
    onChange,
  } = options

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { cityCodes, isGlobalAdmin, isLoading: userLoading } = useUserCity()

  // 追蹤是否已從 localStorage 恢復
  const [restored, setRestored] = useState(false)

  /**
   * 從 URL 獲取選擇的城市
   */
  const getSelectedFromUrl = useCallback((): string[] => {
    const param = searchParams.get(paramName)
    if (!param) return []
    return param.split(',').filter(Boolean)
  }, [searchParams, paramName])

  /**
   * 驗證並過濾城市選擇
   */
  const validateSelection = useCallback(
    (cities: string[]): string[] => {
      if (isGlobalAdmin) {
        return cities
      }
      return cities.filter((c) => cityCodes.includes(c))
    },
    [isGlobalAdmin, cityCodes]
  )

  /**
   * 更新 URL 參數
   */
  const updateUrl = useCallback(
    (newSelection: string[]) => {
      const params = new URLSearchParams(searchParams.toString())

      if (newSelection.length === 0 || newSelection.length === cityCodes.length) {
        params.delete(paramName)
      } else {
        params.set(paramName, newSelection.join(','))
      }

      const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname
      router.push(newUrl, { scroll: false })
    },
    [searchParams, paramName, pathname, router, cityCodes.length]
  )

  /**
   * 計算衍生狀態
   */
  const derivedState = useMemo(() => {
    const urlSelection = getSelectedFromUrl()
    const selectedCities = validateSelection(urlSelection)
    const isAllSelected = selectedCities.length === 0

    return {
      selectedCities,
      isAllSelected,
      effectiveCities: isAllSelected ? cityCodes : selectedCities,
      isFiltered: !isAllSelected && selectedCities.length > 0,
    }
  }, [getSelectedFromUrl, validateSelection, cityCodes])

  /**
   * 設置選擇的城市
   */
  const setSelectedCities = useCallback(
    (cities: string[]) => {
      const validCities = validateSelection(cities)
      updateUrl(validCities)

      if (persist) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(validCities))
      }

      onChange?.(validCities.length === 0 ? cityCodes : validCities)
    },
    [validateSelection, updateUrl, persist, onChange, cityCodes]
  )

  /**
   * 選擇全部城市
   */
  const selectAll = useCallback(() => {
    setSelectedCities([])
  }, [setSelectedCities])

  /**
   * 清除選擇（保留第一個城市）
   */
  const clearSelection = useCallback(() => {
    if (cityCodes.length > 0) {
      setSelectedCities([cityCodes[0]])
    }
  }, [cityCodes, setSelectedCities])

  /**
   * 切換單個城市選擇
   */
  const toggleCity = useCallback(
    (cityCode: string) => {
      const { selectedCities, isAllSelected } = derivedState

      if (isAllSelected) {
        // 從全選狀態開始，選擇除了這個城市以外的所有城市
        const newSelection = cityCodes.filter((c) => c !== cityCode)
        setSelectedCities(newSelection.length > 0 ? newSelection : cityCodes)
      } else if (selectedCities.includes(cityCode)) {
        // 取消選擇
        const newSelection = selectedCities.filter((c) => c !== cityCode)
        setSelectedCities(newSelection.length > 0 ? newSelection : cityCodes)
      } else {
        // 添加選擇
        setSelectedCities([...selectedCities, cityCode])
      }
    },
    [derivedState, cityCodes, setSelectedCities]
  )

  /**
   * 構建 API 參數
   */
  const buildCityParam = useCallback((): string | undefined => {
    const { isAllSelected, effectiveCities } = derivedState
    if (isAllSelected) return undefined
    return effectiveCities.join(',')
  }, [derivedState])

  /**
   * 從 localStorage 恢復選擇
   */
  useEffect(() => {
    if (!persist || restored || userLoading) return
    if (searchParams.has(paramName)) {
      setRestored(true)
      return
    }

    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const savedSelection = JSON.parse(stored) as string[]
        const validSelection = validateSelection(savedSelection)

        if (validSelection.length > 0 && validSelection.length < cityCodes.length) {
          updateUrl(validSelection)
        }
      } catch {
        // 無效的存儲數據，忽略
      }
    }

    setRestored(true)
  }, [persist, restored, userLoading, searchParams, paramName, validateSelection, cityCodes.length, updateUrl])

  return {
    ...derivedState,
    setSelectedCities,
    selectAll,
    clearSelection,
    toggleCity,
    buildCityParam,
    isLoading: userLoading,
  }
}

// ===========================================
// Utility: useCityFilterApi
// ===========================================

/**
 * 為 API 調用準備城市篩選參數
 *
 * @description
 *   簡化版 Hook，專門用於 API 調用的城市參數處理。
 *   返回可直接傳遞給 API 的參數對象。
 *
 * @param paramName - URL 參數名
 * @returns 城市篩選 API 參數
 *
 * @example
 *   const cityParam = useCityFilterApi()
 *   const { data } = useQuery({
 *     queryKey: ['documents', cityParam],
 *     queryFn: () => api.documents.list(cityParam)
 *   })
 */
export function useCityFilterApi(paramName: string = 'cities'): {
  cities?: string[]
  cityParam?: string
} {
  const { effectiveCities, isFiltered } = useCityFilter({ paramName })

  return useMemo(
    () => ({
      cities: isFiltered ? effectiveCities : undefined,
      cityParam: isFiltered ? effectiveCities.join(',') : undefined,
    }),
    [effectiveCities, isFiltered]
  )
}
