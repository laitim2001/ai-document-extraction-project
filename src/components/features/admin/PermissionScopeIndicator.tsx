'use client'

/**
 * @fileoverview 權限範圍指示器組件
 * @description
 *   顯示當前用戶的權限範圍指示，讓用戶清楚知道自己的管理範圍。
 *
 *   顯示模式：
 *   - System Admin：「管理範圍：所有城市」
 *   - City Manager：「管理範圍：{城市名稱}」
 *   - 無權限：不顯示或顯示「無管理權限」
 *
 *   功能特點：
 *   - 自動檢測用戶權限
 *   - 動態載入城市名稱
 *   - 支援多種顯示樣式（badge, inline, card）
 *   - 響應式設計
 *
 * @module src/components/features/admin/PermissionScopeIndicator
 * @author Development Team
 * @since Epic 1 - Story 1.8 (City Manager User Management)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @/hooks/use-auth - 認證 Hook
 *   - @/hooks/use-cities - 城市查詢 Hook
 *
 * @related
 *   - src/components/features/admin/CitySelector.tsx - 城市選擇器
 *   - src/lib/auth/city-permission.ts - 城市權限中間件
 */

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Globe, MapPin, Lock, Building2, Loader2 } from 'lucide-react'

import { useAuth } from '@/hooks/use-auth'
import { useCities } from '@/hooks/use-cities'
import { PERMISSIONS } from '@/types/permissions'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// ============================================================
// Types
// ============================================================

/**
 * 權限範圍類型
 */
type PermissionScope = 'global' | 'city' | 'none'

/**
 * 顯示變體
 */
type DisplayVariant = 'badge' | 'inline' | 'card' | 'minimal'

interface PermissionScopeIndicatorProps {
  /** 顯示變體 */
  variant?: DisplayVariant
  /** 是否顯示圖示 */
  showIcon?: boolean
  /** 自定義類名 */
  className?: string
  /** 當沒有權限時是否隱藏 */
  hideWhenNoPermission?: boolean
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

/**
 * 獲取權限範圍圖示
 */
function getScopeIcon(scope: PermissionScope) {
  switch (scope) {
    case 'global':
      return Globe
    case 'city':
      return MapPin
    case 'none':
      return Lock
  }
}

/**
 * 獲取權限範圍 Badge 樣式
 */
function getScopeBadgeVariant(scope: PermissionScope): 'default' | 'secondary' | 'outline' {
  switch (scope) {
    case 'global':
      return 'default'
    case 'city':
      return 'secondary'
    case 'none':
      return 'outline'
  }
}

// ============================================================
// Component
// ============================================================

/**
 * 權限範圍指示器組件
 *
 * @description
 *   根據用戶權限自動顯示管理範圍資訊。
 *   - System Admin：顯示「所有城市」
 *   - City Manager：顯示所屬城市名稱
 *   - 無權限：顯示「無管理權限」或隱藏
 *
 * @example
 *   // Badge 樣式
 *   <PermissionScopeIndicator variant="badge" />
 *
 *   // 內聯樣式
 *   <PermissionScopeIndicator variant="inline" />
 *
 *   // 卡片樣式
 *   <PermissionScopeIndicator variant="card" />
 *
 *   // 最小化樣式
 *   <PermissionScopeIndicator variant="minimal" showIcon={false} />
 */
export function PermissionScopeIndicator({
  variant = 'badge',
  showIcon = true,
  className,
  hideWhenNoPermission = false,
}: PermissionScopeIndicatorProps) {
  // --- i18n ---
  const t = useTranslations('admin')

  // --- Hooks ---
  const { user, hasPermission, isLoading: isAuthLoading } = useAuth()
  const { data: cities, isLoading: isCitiesLoading } = useCities()

  // --- Computed Values ---

  // 判斷權限範圍
  const scope = useMemo<PermissionScope>(() => {
    if (hasPermission(PERMISSIONS.USER_MANAGE)) {
      return 'global'
    }
    if (hasPermission(PERMISSIONS.USER_MANAGE_CITY)) {
      return 'city'
    }
    return 'none'
  }, [hasPermission])

  // 獲取城市 ID
  const userCityId = getUserManagedCityId(user)

  // 獲取城市名稱
  const cityName = useMemo(() => {
    if (!userCityId || !cities) return null
    const city = cities.find((c) => c.id === userCityId)
    return city?.name ?? null
  }, [userCityId, cities])

  // 獲取顯示文字
  const displayText = useMemo(() => {
    switch (scope) {
      case 'global':
        return t('permissionScope.global')
      case 'city':
        return cityName || t('permissionScope.city')
      case 'none':
        return t('permissionScope.none')
    }
  }, [scope, cityName, t])

  const isLoading = isAuthLoading || (scope === 'city' && isCitiesLoading)
  const Icon = getScopeIcon(scope)

  // --- Render: Loading ---
  if (isLoading) {
    return (
      <span className={cn('inline-flex items-center gap-1 text-sm text-muted-foreground', className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>{t('permissionScope.loading')}</span>
      </span>
    )
  }

  // --- Render: Hide when no permission ---
  if (scope === 'none' && hideWhenNoPermission) {
    return null
  }

  // --- Render: Badge Variant ---
  if (variant === 'badge') {
    return (
      <Badge
        variant={getScopeBadgeVariant(scope)}
        className={cn('gap-1', className)}
      >
        {showIcon && <Icon className="h-3 w-3" />}
        <span>{displayText}</span>
      </Badge>
    )
  }

  // --- Render: Inline Variant ---
  if (variant === 'inline') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 text-sm text-muted-foreground',
          className
        )}
      >
        {showIcon && <Icon className="h-4 w-4" />}
        <span>{t('permissionScope.label')}</span>
        <span className="font-medium text-foreground">{displayText}</span>
      </span>
    )
  }

  // --- Render: Card Variant ---
  if (variant === 'card') {
    return (
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-3',
          className
        )}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{t('permissionScope.title')}</div>
          <div className="font-medium">{displayText}</div>
        </div>
      </div>
    )
  }

  // --- Render: Minimal Variant ---
  return (
    <span className={cn('text-sm text-muted-foreground', className)}>
      {showIcon && <Icon className="mr-1 inline h-3 w-3" />}
      {displayText}
    </span>
  )
}

// ============================================================
// Sub-components
// ============================================================

/**
 * 權限範圍標題組件
 * 用於頁面標題或區塊標題
 */
export function PermissionScopeTitle({
  title,
  className,
}: {
  title: string
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <PermissionScopeIndicator variant="inline" hideWhenNoPermission />
    </div>
  )
}

/**
 * 權限範圍警告組件
 * 用於提示 City Manager 只能看到部分資料
 */
export function CityManagerScopeNotice({
  className,
}: {
  className?: string
}) {
  const t = useTranslations('admin')
  const { hasPermission } = useAuth()

  // 只對 City Manager 顯示
  const isGlobal = hasPermission(PERMISSIONS.USER_MANAGE)
  const isCityScoped = hasPermission(PERMISSIONS.USER_MANAGE_CITY) && !isGlobal

  if (!isCityScoped) {
    return null
  }

  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200',
        className
      )}
    >
      <Building2 className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <span className="font-medium">{t('permissionScope.cityManager.mode')}</span>
        {t('permissionScope.cityManager.description')}
      </div>
    </div>
  )
}
