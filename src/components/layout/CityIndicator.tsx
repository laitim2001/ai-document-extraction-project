'use client'

/**
 * @fileoverview 城市指示器組件
 * @description
 *   在頁面頭部顯示用戶當前城市訪問狀態：
 *   - 全球管理員顯示全球圖標
 *   - 區域管理員顯示管理城市數量
 *   - 單一城市用戶顯示城市名稱
 *   - 多城市用戶顯示城市列表
 *
 *   ## 視覺設計
 *   - 使用 Badge 組件顯示緊湊資訊
 *   - Tooltip 提供詳細城市列表
 *   - 不同角色使用不同圖標區分
 *
 * @module src/components/layout/CityIndicator
 * @author Development Team
 * @since Epic 6 - Story 6.2 (City User Data Access Control)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @/hooks/useUserCity - 城市訪問 Hook
 *   - @tanstack/react-query - 數據獲取
 *   - @/components/ui/* - UI 基礎組件
 *   - lucide-react - 圖標
 *
 * @related
 *   - src/hooks/useUserCity.ts - 城市訪問 Hook
 *   - src/app/api/cities/[code]/route.ts - 城市資訊 API
 */

import { useUserCity } from '@/hooks/useUserCity'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { MapPin, Globe, Building2 } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'

// ===========================================
// Types
// ===========================================

/**
 * 城市資訊數據
 */
interface CityData {
  /** 城市代碼 */
  code: string
  /** 城市名稱 */
  name: string
  /** 所屬區域 */
  region: {
    code: string
    name: string
  }
}

// ===========================================
// API Functions
// ===========================================

/**
 * 獲取城市詳細資訊
 *
 * @param cityCode - 城市代碼
 * @returns 城市資訊或 null
 */
async function fetchCityInfo(cityCode: string): Promise<CityData | null> {
  try {
    const response = await fetch(`/api/cities/${cityCode}`)
    if (!response.ok) return null
    const result = await response.json()
    return result.data
  } catch {
    return null
  }
}

// ===========================================
// CityIndicator Component
// ===========================================

/**
 * 城市指示器組件
 *
 * @description
 *   根據用戶角色和城市訪問權限顯示不同的指示器：
 *   - 全球管理員：顯示「全球管理員」標籤
 *   - 區域管理員：顯示管理城市數量
 *   - 單一城市：顯示城市名稱
 *   - 多城市：顯示城市數量和列表
 *
 * @example
 *   // 在頁面頭部使用
 *   <header>
 *     <CityIndicator />
 *   </header>
 */
export function CityIndicator() {
  const {
    primaryCityCode,
    cityCodes,
    isSingleCity,
    isGlobalAdmin,
    isRegionalManager,
    isLoading,
  } = useUserCity()

  // 獲取主要城市的詳細資訊
  const { data: cityInfo, isLoading: isCityLoading } = useQuery({
    queryKey: ['city-info', primaryCityCode],
    queryFn: () => fetchCityInfo(primaryCityCode!),
    enabled: !!primaryCityCode && !isGlobalAdmin,
    staleTime: 5 * 60 * 1000, // 5 分鐘快取
  })

  // 載入中狀態
  if (isLoading || isCityLoading) {
    return (
      <Badge variant="outline" className="animate-pulse gap-1">
        <MapPin className="h-3 w-3" />
        <Skeleton className="h-3 w-12" />
      </Badge>
    )
  }

  // 全球管理員
  if (isGlobalAdmin) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="gap-1 cursor-help">
              <Globe className="h-3 w-3" />
              全球管理員
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>您擁有所有城市的完整訪問權限</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // 區域管理員
  if (isRegionalManager) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="gap-1 cursor-help">
              <Building2 className="h-3 w-3" />
              區域管理
              {cityCodes.length > 0 && (
                <span className="ml-1 text-xs bg-primary/10 px-1 rounded">
                  {cityCodes.length}
                </span>
              )}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>您可訪問 {cityCodes.length} 個城市</p>
            <p className="text-xs text-muted-foreground mt-1">
              {cityCodes.join(', ')}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // 單一城市用戶
  if (isSingleCity && cityInfo) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="gap-1 cursor-help">
              <MapPin className="h-3 w-3" />
              {cityInfo.name}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {cityInfo.name} ({cityInfo.code})
            </p>
            <p className="text-xs text-muted-foreground">{cityInfo.region.name}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // 多城市用戶（非區域管理員）
  if (cityCodes.length > 1) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="gap-1 cursor-help">
              <MapPin className="h-3 w-3" />
              {cityCodes.length} 個城市
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>您可訪問以下城市:</p>
            <p className="text-xs text-muted-foreground mt-1">
              {cityCodes.join(', ')}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // 單一城市但無城市資訊（fallback）
  if (isSingleCity && primaryCityCode) {
    return (
      <Badge variant="outline" className="gap-1">
        <MapPin className="h-3 w-3" />
        {primaryCityCode}
      </Badge>
    )
  }

  // 無城市配置
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="destructive" className="gap-1 cursor-help">
            <MapPin className="h-3 w-3" />
            未配置城市
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>您尚未被分配任何城市訪問權限</p>
          <p className="text-xs text-muted-foreground">請聯繫管理員配置</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ===========================================
// Exports
// ===========================================

export default CityIndicator
