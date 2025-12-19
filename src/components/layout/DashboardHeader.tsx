'use client'

/**
 * @fileoverview Dashboard 頭部客戶端組件
 * @description
 *   Dashboard 頭部的客戶端部分，包含需要客戶端渲染的元素：
 *   - 城市指示器（CityIndicator）
 *   - 其他需要客戶端互動的頭部元素
 *
 *   此組件被 DashboardLayout 使用，用於分離服務端和客戶端邏輯。
 *
 * @module src/components/layout/DashboardHeader
 * @author Development Team
 * @since Epic 6 - Story 6.2 (City User Data Access Control)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @/components/layout/CityIndicator - 城市指示器
 *   - @/components/ui/tooltip - Tooltip 提供者
 *
 * @related
 *   - src/app/(dashboard)/layout.tsx - Dashboard 佈局
 *   - src/hooks/useUserCity.ts - 城市訪問 Hook
 */

import { CityIndicator } from './CityIndicator'
import { TooltipProvider } from '@/components/ui/tooltip'

// ===========================================
// Types
// ===========================================

/**
 * DashboardHeader 組件屬性
 */
interface DashboardHeaderProps {
  /** 子元素（如用戶資訊、登出按鈕等） */
  children?: React.ReactNode
}

// ===========================================
// DashboardHeader Component
// ===========================================

/**
 * Dashboard 頭部客戶端組件
 *
 * @description
 *   提供需要客戶端渲染的頭部元素容器。
 *   主要用於顯示城市指示器和其他互動式元素。
 *
 * @param props - 組件屬性
 * @returns 頭部客戶端元素
 *
 * @example
 *   // 在 DashboardLayout 中使用
 *   <DashboardHeader>
 *     <UserInfo />
 *     <LogoutButton />
 *   </DashboardHeader>
 */
export function DashboardHeader({ children }: DashboardHeaderProps) {
  return (
    <TooltipProvider>
      <div className="flex items-center space-x-4">
        {/* 城市指示器 */}
        <CityIndicator />

        {/* 其他頭部元素 */}
        {children}
      </div>
    </TooltipProvider>
  )
}

// ===========================================
// Default Export
// ===========================================

export default DashboardHeader
