'use client'

/**
 * @fileoverview 用戶城市存取 Hook
 * @description
 *   提供客戶端城市訪問權限檢查功能：
 *   - 獲取用戶授權城市列表
 *   - 檢查特定城市訪問權限
 *   - 判斷用戶角色（全球管理員、區域管理）
 *   - 支援城市切換功能判斷
 *
 *   ## 使用場景
 *   - 前端城市過濾顯示
 *   - 城市相關 UI 組件渲染
 *   - 城市訪問權限前置檢查
 *
 * @module src/hooks/useUserCity
 * @author Development Team
 * @since Epic 6 - Story 6.2 (City User Data Access Control)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - next-auth/react - NextAuth React 客戶端
 *
 * @related
 *   - src/components/layout/CityIndicator.tsx - 城市指示器組件
 *   - src/components/auth/CityRestricted.tsx - 城市限制包裝器
 *   - src/middleware/city-filter.ts - API 城市過濾中間件
 *
 * @example
 *   const { cityCodes, canAccessCity, isGlobalAdmin } = useUserCity()
 *
 *   if (canAccessCity('HKG')) {
 *     // 顯示香港相關內容
 *   }
 */

import { useSession } from 'next-auth/react'
import { useMemo, useCallback } from 'react'

// ===========================================
// Types
// ===========================================

/**
 * useUserCity Hook 返回類型
 */
export interface UseUserCityReturn {
  /** 授權城市代碼列表 */
  cityCodes: string[]
  /** 用戶主要城市代碼 */
  primaryCityCode: string | null
  /** 是否為全球管理員 */
  isGlobalAdmin: boolean
  /** 是否為區域管理員 */
  isRegionalManager: boolean
  /** 是否為單一城市訪問 */
  isSingleCity: boolean
  /** 是否可切換城市 */
  canSwitchCities: boolean
  /** 檢查是否可訪問特定城市 */
  canAccessCity: (cityCode: string) => boolean
  /** 城市數據是否正在載入 */
  isLoading: boolean
}

// ===========================================
// useUserCity Hook
// ===========================================

/**
 * 用戶城市存取 Hook
 *
 * @description
 *   提供城市訪問權限的前端檢查功能。
 *   封裝 NextAuth session 中的城市相關資訊，
 *   提供便利的權限檢查方法。
 *
 * @returns 城市訪問狀態和權限檢查方法
 *
 * @example
 *   function CityContent() {
 *     const {
 *       cityCodes,
 *       isGlobalAdmin,
 *       canAccessCity,
 *       isLoading
 *     } = useUserCity()
 *
 *     if (isLoading) return <Loading />
 *
 *     if (isGlobalAdmin) {
 *       return <AllCitiesContent />
 *     }
 *
 *     return <CitySpecificContent cities={cityCodes} />
 *   }
 */
export function useUserCity(): UseUserCityReturn {
  const { data: session, status } = useSession()

  /**
   * 檢查是否可訪問特定城市
   */
  const canAccessCity = useCallback(
    (cityCode: string): boolean => {
      // 全球管理員可訪問所有城市
      if (session?.user?.isGlobalAdmin) {
        return true
      }
      // 檢查城市是否在授權列表中
      return session?.user?.cityCodes?.includes(cityCode) ?? false
    },
    [session?.user?.isGlobalAdmin, session?.user?.cityCodes]
  )

  return useMemo(() => {
    const cityCodes = session?.user?.cityCodes || []
    const primaryCityCode = session?.user?.primaryCityCode || null
    const isGlobalAdmin = session?.user?.isGlobalAdmin || false
    const isRegionalManager = session?.user?.isRegionalManager || false

    return {
      cityCodes,
      primaryCityCode,
      isGlobalAdmin,
      isRegionalManager,
      isSingleCity: cityCodes.length === 1 && !isGlobalAdmin && !isRegionalManager,
      canSwitchCities: isGlobalAdmin || isRegionalManager || cityCodes.length > 1,
      canAccessCity,
      isLoading: status === 'loading',
    }
  }, [session, status, canAccessCity])
}

// ===========================================
// Utility Hook: useIsCityRestricted
// ===========================================

/**
 * 檢查當前用戶是否被城市限制
 *
 * @description
 *   用於快速判斷是否應該隱藏/禁用某些城市相關內容。
 *   返回 true 表示用戶無權訪問指定城市。
 *
 * @param requiredCities - 需要訪問的城市代碼列表
 * @param allowGlobalAdmin - 是否允許全球管理員繞過（預設 true）
 * @returns 是否被限制（true = 無權訪問）
 *
 * @example
 *   const isRestricted = useIsCityRestricted(['HKG', 'SIN'])
 *
 *   if (isRestricted) {
 *     return <NoAccess />
 *   }
 */
export function useIsCityRestricted(
  requiredCities?: string[],
  allowGlobalAdmin: boolean = true
): boolean {
  const { canAccessCity, isGlobalAdmin } = useUserCity()

  return useMemo(() => {
    // 全球管理員繞過檢查
    if (allowGlobalAdmin && isGlobalAdmin) {
      return false
    }

    // 無特定城市要求，不限制
    if (!requiredCities || requiredCities.length === 0) {
      return false
    }

    // 檢查是否有任一城市的訪問權限
    return !requiredCities.some((city) => canAccessCity(city))
  }, [requiredCities, allowGlobalAdmin, isGlobalAdmin, canAccessCity])
}
