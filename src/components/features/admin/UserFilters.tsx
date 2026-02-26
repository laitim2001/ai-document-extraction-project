'use client'

/**
 * @fileoverview 用戶篩選器組件
 * @description
 *   提供角色、城市、狀態的篩選功能。
 *   支援清除所有篩選條件。
 *
 * @module src/components/features/admin/UserFilters
 * @author Development Team
 * @since Epic 1 - Story 1.3 (User List & Search)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @/hooks/use-roles - 角色查詢
 *   - @/hooks/use-cities - 城市查詢
 */

import { useTranslations } from 'next-intl'
import { useRoles } from '@/hooks/use-roles'
import { useCities } from '@/hooks/use-cities'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import type { UserStatus } from '@prisma/client'

interface UserFiltersProps {
  /** 當前選中的角色 ID */
  roleId?: string
  /** 當前選中的城市 ID */
  cityId?: string
  /** 當前選中的狀態 */
  status?: UserStatus
  /** 篩選條件變更回調 */
  onChange: (params: {
    roleId?: string
    cityId?: string
    status?: UserStatus
  }) => void
}

/**
 * 用戶篩選器組件
 *
 * @description
 *   提供三個下拉選單用於篩選用戶：
 *   - 角色篩選
 *   - 城市篩選
 *   - 狀態篩選（ACTIVE/INACTIVE）
 *
 *   當有任何篩選條件時，顯示「清除」按鈕。
 *
 * @example
 *   <UserFilters
 *     roleId={params.roleId}
 *     cityId={params.cityId}
 *     status={params.status}
 *     onChange={updateParams}
 *   />
 */
export function UserFilters({
  roleId,
  cityId,
  status,
  onChange,
}: UserFiltersProps) {
  const t = useTranslations('admin')
  const { data: roles } = useRoles()
  const { data: cities } = useCities()

  const hasFilters = roleId || cityId || status

  const clearFilters = () => {
    onChange({ roleId: undefined, cityId: undefined, status: undefined })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* 角色篩選 */}
      <Select
        value={roleId || 'all'}
        onValueChange={(value) =>
          onChange({ roleId: value === 'all' ? undefined : value })
        }
      >
        <SelectTrigger className="w-[150px]" aria-label="Filter by role">
          <SelectValue placeholder={t('users.filters.role.placeholder')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('users.filters.role.all')}</SelectItem>
          {roles?.map((role) => (
            <SelectItem key={role.id} value={role.id}>
              {role.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 城市篩選 */}
      <Select
        value={cityId || 'all'}
        onValueChange={(value) =>
          onChange({ cityId: value === 'all' ? undefined : value })
        }
      >
        <SelectTrigger className="w-[150px]" aria-label="Filter by city">
          <SelectValue placeholder={t('users.filters.city.placeholder')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('users.filters.city.all')}</SelectItem>
          {cities?.map((city) => (
            <SelectItem key={city.id} value={city.id}>
              {city.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 狀態篩選 */}
      <Select
        value={status || 'all'}
        onValueChange={(value) =>
          onChange({
            status: value === 'all' ? undefined : (value as UserStatus),
          })
        }
      >
        <SelectTrigger className="w-[120px]" aria-label="Filter by status">
          <SelectValue placeholder={t('users.filters.status.placeholder')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('users.filters.status.all')}</SelectItem>
          <SelectItem value="ACTIVE">{t('users.status.active')}</SelectItem>
          <SelectItem value="INACTIVE">{t('users.status.inactive')}</SelectItem>
        </SelectContent>
      </Select>

      {/* 清除篩選按鈕 */}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          aria-label="Clear all filters"
        >
          <X className="mr-1 h-4 w-4" />
          {t('users.filters.clear')}
        </Button>
      )}
    </div>
  )
}
