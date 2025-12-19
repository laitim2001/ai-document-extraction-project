'use client'

/**
 * @fileoverview 城市限制包裝器組件
 * @description
 *   根據用戶城市訪問權限顯示或隱藏內容：
 *   - 自動檢查用戶是否有權訪問指定城市
 *   - 支援全球管理員繞過檢查
 *   - 可自定義無權訪問時的顯示內容
 *
 *   ## 使用場景
 *   - 城市專屬內容保護
 *   - 跨城市數據隔離
 *   - 條件性 UI 渲染
 *
 * @module src/components/auth/CityRestricted
 * @author Development Team
 * @since Epic 6 - Story 6.2 (City User Data Access Control)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @/hooks/useUserCity - 城市訪問 Hook
 *   - @/components/ui/alert - Alert 組件
 *   - lucide-react - 圖標
 *
 * @related
 *   - src/hooks/useUserCity.ts - 城市訪問 Hook
 *   - src/middleware/resource-access.ts - API 資源訪問驗證
 *
 * @example
 *   <CityRestricted requiredCities={['HKG']}>
 *     <HongKongOnlyContent />
 *   </CityRestricted>
 */

import * as React from 'react'
import { useUserCity, useIsCityRestricted } from '@/hooks/useUserCity'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ShieldAlert, Loader2 } from 'lucide-react'

// ===========================================
// Types
// ===========================================

/**
 * CityRestricted 組件屬性
 */
interface CityRestrictedProps {
  /** 需要訪問的城市代碼列表（任一匹配即可） */
  requiredCities?: string[]
  /** 是否允許全球管理員繞過限制（預設 true） */
  allowGlobalAdmin?: boolean
  /** 無權訪問時顯示的自定義內容 */
  fallback?: React.ReactNode
  /** 有權訪問時顯示的子組件 */
  children: React.ReactNode
  /** 是否在載入時顯示佔位符 */
  showLoadingState?: boolean
}

// ===========================================
// Default Fallback Component
// ===========================================

/**
 * 預設的無權訪問提示
 */
function DefaultAccessDenied() {
  return (
    <Alert variant="destructive">
      <ShieldAlert className="h-4 w-4" />
      <AlertTitle>訪問受限</AlertTitle>
      <AlertDescription>您沒有權限查看此城市的內容。</AlertDescription>
    </Alert>
  )
}

/**
 * 載入中狀態
 */
function LoadingState() {
  return (
    <div className="flex items-center justify-center p-4">
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
    </div>
  )
}

// ===========================================
// CityRestricted Component
// ===========================================

/**
 * 城市限制包裝器組件
 *
 * @description
 *   根據用戶城市訪問權限條件性渲染子組件：
 *   - 如用戶有權訪問任一指定城市，渲染子組件
 *   - 如用戶無權訪問，渲染 fallback 或預設提示
 *   - 全球管理員預設繞過所有限制
 *
 * @param props - 組件屬性
 * @returns 條件性渲染的內容
 *
 * @example
 *   // 基本用法 - 限制香港用戶查看
 *   <CityRestricted requiredCities={['HKG']}>
 *     <HongKongData />
 *   </CityRestricted>
 *
 * @example
 *   // 自定義無權訪問提示
 *   <CityRestricted
 *     requiredCities={['SIN', 'HKG']}
 *     fallback={<p>請聯繫管理員獲取訪問權限</p>}
 *   >
 *     <SensitiveContent />
 *   </CityRestricted>
 *
 * @example
 *   // 全球管理員也需限制
 *   <CityRestricted
 *     requiredCities={['NYC']}
 *     allowGlobalAdmin={false}
 *   >
 *     <StrictlyNYCContent />
 *   </CityRestricted>
 */
export function CityRestricted({
  requiredCities,
  allowGlobalAdmin = true,
  fallback,
  children,
  showLoadingState = true,
}: CityRestrictedProps) {
  const { isGlobalAdmin, canAccessCity, isLoading } = useUserCity()

  // 載入中狀態
  if (isLoading) {
    return showLoadingState ? <LoadingState /> : null
  }

  // 全球管理員繞過
  if (allowGlobalAdmin && isGlobalAdmin) {
    return <>{children}</>
  }

  // 無特定城市要求，直接渲染
  if (!requiredCities || requiredCities.length === 0) {
    return <>{children}</>
  }

  // 檢查城市訪問權限
  const hasAccess = requiredCities.some((city) => canAccessCity(city))

  if (!hasAccess) {
    return <>{fallback || <DefaultAccessDenied />}</>
  }

  return <>{children}</>
}

// ===========================================
// CityRestrictedHidden Component
// ===========================================

/**
 * 城市限制隱藏組件
 *
 * @description
 *   與 CityRestricted 類似，但無權訪問時完全不渲染（不顯示提示）。
 *   適用於需要靜默隱藏的場景。
 *
 * @example
 *   <CityRestrictedHidden requiredCities={['HKG']}>
 *     <HKGOnlyButton />
 *   </CityRestrictedHidden>
 */
export function CityRestrictedHidden({
  requiredCities,
  allowGlobalAdmin = true,
  children,
}: Omit<CityRestrictedProps, 'fallback' | 'showLoadingState'>) {
  return (
    <CityRestricted
      requiredCities={requiredCities}
      allowGlobalAdmin={allowGlobalAdmin}
      fallback={null}
      showLoadingState={false}
    >
      {children}
    </CityRestricted>
  )
}

// ===========================================
// Re-export utility hook
// ===========================================

export { useIsCityRestricted }

// ===========================================
// Default Export
// ===========================================

export default CityRestricted
