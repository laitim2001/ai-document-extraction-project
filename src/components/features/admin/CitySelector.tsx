'use client'

/**
 * @fileoverview 城市選擇器組件
 * @description
 *   提供城市選擇功能，根據用戶權限範圍顯示不同的 UI：
 *   - System Admin：顯示所有城市的下拉選單（按區域分組）
 *   - City Manager：顯示所屬城市（唯讀）
 *
 *   功能特點：
 *   - 按區域分組顯示城市
 *   - 支援禁用模式（City Manager 專用）
 *   - 載入狀態指示
 *   - 清除選擇功能
 *   - 與 react-hook-form 整合
 *
 * @module src/components/features/admin/CitySelector
 * @author Development Team
 * @since Epic 1 - Story 1.8 (City Manager User Management)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @/hooks/use-cities - 城市查詢 Hook
 *   - @/hooks/use-auth - 認證 Hook
 *   - @/components/ui/select - shadcn/ui 選擇器
 *
 * @related
 *   - src/components/features/admin/AddUserDialog.tsx - 新增用戶對話框
 *   - src/components/features/admin/EditUserDialog.tsx - 編輯用戶對話框
 *   - src/lib/auth/city-permission.ts - 城市權限中間件
 */

import { useMemo } from 'react'
import { Loader2, MapPin, Lock } from 'lucide-react'

import { useCitiesGrouped, useCities } from '@/hooks/use-cities'
import { useAuth } from '@/hooks/use-auth'
import { PERMISSIONS } from '@/types/permissions'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

// ============================================================
// Types
// ============================================================

interface CitySelectorProps {
  /** 當前選中的城市 ID */
  value?: string | null
  /** 值變更回調 */
  onChange: (cityId: string | null) => void
  /** 是否顯示「不指定城市」選項 */
  allowEmpty?: boolean
  /** 空選項的顯示文字 */
  emptyLabel?: string
  /** 佔位文字 */
  placeholder?: string
  /** 是否禁用 */
  disabled?: boolean
  /** 自定義類名 */
  className?: string
  /** 觸發器的 aria-label */
  ariaLabel?: string
  /** 是否強制顯示為唯讀模式（City Manager 自動適用） */
  forceReadOnly?: boolean
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 獲取用戶管理的城市 ID
 * @param user - Session 用戶
 * @returns 城市 ID 或 null（全域權限）
 */
function getUserManagedCityId(
  user: ReturnType<typeof useAuth>['user']
): string | null {
  if (!user?.roles) return null

  // 找到第一個有 cityId 的角色
  for (const role of user.roles) {
    // @ts-expect-error - cityId is added via next-auth session callback
    if (role.cityId) {
      // @ts-expect-error - cityId is added via next-auth session callback
      return role.cityId as string
    }
  }

  return null
}

// ============================================================
// Component
// ============================================================

/**
 * 城市選擇器組件
 *
 * @description
 *   根據用戶權限範圍自動調整 UI 行為：
 *   - 擁有 USER_MANAGE 權限（System Admin）：可選擇任何城市
 *   - 擁有 USER_MANAGE_CITY 權限（City Manager）：只顯示所屬城市（唯讀）
 *
 * @example
 *   // 基本用法
 *   <CitySelector
 *     value={selectedCity}
 *     onChange={setSelectedCity}
 *   />
 *
 *   // 允許空值
 *   <CitySelector
 *     value={selectedCity}
 *     onChange={setSelectedCity}
 *     allowEmpty
 *     emptyLabel="不指定城市"
 *   />
 *
 *   // 與 react-hook-form 整合
 *   <FormField
 *     control={form.control}
 *     name="cityId"
 *     render={({ field }) => (
 *       <FormItem>
 *         <FormLabel>城市</FormLabel>
 *         <FormControl>
 *           <CitySelector
 *             value={field.value}
 *             onChange={field.onChange}
 *             allowEmpty
 *           />
 *         </FormControl>
 *       </FormItem>
 *     )}
 *   />
 */
export function CitySelector({
  value,
  onChange,
  allowEmpty = false,
  emptyLabel = '不指定城市',
  placeholder = '選擇城市...',
  disabled = false,
  className,
  ariaLabel = 'Select city',
  forceReadOnly = false,
}: CitySelectorProps) {
  // --- Hooks ---
  const { user, hasPermission } = useAuth()
  const { data: groupedCities, isLoading: isLoadingGrouped } = useCitiesGrouped()
  const { data: flatCities, isLoading: isLoadingFlat } = useCities()

  // --- Computed Values ---

  // 判斷用戶權限範圍
  const hasGlobalPermission = hasPermission(PERMISSIONS.USER_MANAGE)
  const hasCityPermission = hasPermission(PERMISSIONS.USER_MANAGE_CITY)
  const userManagedCityId = getUserManagedCityId(user)

  // City Manager：唯讀模式
  const isReadOnly = forceReadOnly || (!hasGlobalPermission && hasCityPermission && userManagedCityId !== null)

  // 獲取用戶所屬城市名稱
  const userCityName = useMemo(() => {
    if (!userManagedCityId || !flatCities) return null
    const city = flatCities.find((c) => c.id === userManagedCityId)
    return city?.name ?? null
  }, [userManagedCityId, flatCities])

  // 獲取選中城市的顯示名稱
  const selectedCityName = useMemo(() => {
    if (!value || !flatCities) return null
    const city = flatCities.find((c) => c.id === value)
    return city ? `${city.name} (${city.code})` : null
  }, [value, flatCities])

  const isLoading = isLoadingGrouped || isLoadingFlat

  // --- Handlers ---
  const handleValueChange = (newValue: string) => {
    if (newValue === '__empty__') {
      onChange(null)
    } else {
      onChange(newValue)
    }
  }

  // --- Render: Read-Only Mode (City Manager) ---
  if (isReadOnly) {
    return (
      <div
        className={cn(
          'flex h-10 w-full items-center rounded-md border border-input bg-muted px-3 py-2 text-sm',
          className
        )}
        aria-label={ariaLabel}
      >
        <Lock className="mr-2 h-4 w-4 text-muted-foreground" />
        <MapPin className="mr-1 h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">
          {isLoading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              載入中...
            </span>
          ) : (
            userCityName || '未指定城市'
          )}
        </span>
      </div>
    )
  }

  // --- Render: Select Mode (System Admin) ---
  return (
    <Select
      value={value || (allowEmpty ? '__empty__' : '')}
      onValueChange={handleValueChange}
      disabled={disabled || isLoading}
    >
      <SelectTrigger className={cn('w-full', className)} aria-label={ariaLabel}>
        <SelectValue placeholder={placeholder}>
          {isLoading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              載入中...
            </span>
          ) : value ? (
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {selectedCityName}
            </span>
          ) : allowEmpty ? (
            emptyLabel
          ) : (
            placeholder
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {/* 空選項 */}
        {allowEmpty && (
          <SelectItem value="__empty__">{emptyLabel}</SelectItem>
        )}

        {/* 按區域分組顯示 */}
        {groupedCities?.map((group) => (
          <SelectGroup key={group.region}>
            <SelectLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {group.region}
            </SelectLabel>
            {group.cities.map((city) => (
              <SelectItem key={city.id} value={city.id}>
                <span className="flex items-center gap-2">
                  <MapPin className="h-3 w-3" />
                  {city.name} ({city.code})
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}

// ============================================================
// Sub-components
// ============================================================

/**
 * 城市顯示標籤
 * 用於只讀顯示城市資訊
 */
export function CityDisplayBadge({
  cityId,
  className,
}: {
  cityId: string | null
  className?: string
}) {
  const { data: cities, isLoading } = useCities()

  const cityName = useMemo(() => {
    if (!cityId || !cities) return null
    const city = cities.find((c) => c.id === cityId)
    return city ? `${city.name} (${city.code})` : null
  }, [cityId, cities])

  if (isLoading) {
    return (
      <span className={cn('inline-flex items-center gap-1 text-sm text-muted-foreground', className)}>
        <Loader2 className="h-3 w-3 animate-spin" />
      </span>
    )
  }

  if (!cityName) {
    return (
      <span className={cn('text-sm text-muted-foreground', className)}>
        未指定城市
      </span>
    )
  }

  return (
    <span className={cn('inline-flex items-center gap-1 text-sm', className)}>
      <MapPin className="h-3 w-3" />
      {cityName}
    </span>
  )
}
