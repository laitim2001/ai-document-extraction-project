'use client'

/**
 * @fileoverview Region 選擇組件
 * @description
 *   提供 Region 下拉選擇功能，支援：
 *   - 單選模式
 *   - 搜尋過濾
 *   - 載入狀態顯示
 *   - 可選顯示停用的 Region
 *
 * @module src/components/features/region/RegionSelect
 * @author Development Team
 * @since Epic 20 - Story 20.2 (Region Management API & UI)
 * @lastModified 2026-02-05
 *
 * @features
 *   - 單選模式（value/onChange）
 *   - 支援 disabled 狀態
 *   - 載入中顯示 loading 狀態
 *   - i18n 支援
 *
 * @dependencies
 *   - next-intl - 國際化
 *   - @/hooks/use-regions - Region 查詢 Hook
 *   - @/components/ui/select - 基礎 Select 組件
 *
 * @example
 *   <RegionSelect
 *     value={selectedRegionId}
 *     onChange={(value) => setSelectedRegionId(value)}
 *     placeholder="選擇地區"
 *   />
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useRegions } from '@/hooks/use-regions'
import { cn } from '@/lib/utils'

// ============================================================
// 類型定義
// ============================================================

/**
 * RegionSelect 組件 Props
 */
interface RegionSelectProps {
  /** 當前選中的 Region ID */
  value?: string
  /** 選擇變更回調 */
  onChange: (value: string) => void
  /** 佔位符文字 */
  placeholder?: string
  /** 是否禁用 */
  disabled?: boolean
  /** 是否包含停用的 Region */
  includeInactive?: boolean
  /** 額外的 CSS 類名 */
  className?: string
}

// ============================================================
// 組件實現
// ============================================================

/**
 * Region 選擇組件
 *
 * @description
 *   提供 Region 下拉選擇功能，用於表單或篩選器中選擇地區。
 *
 * @param props - 組件屬性
 * @returns React 元素
 *
 * @example
 *   // 基本用法
 *   <RegionSelect
 *     value={regionId}
 *     onChange={setRegionId}
 *   />
 *
 *   // 包含停用的 Region
 *   <RegionSelect
 *     value={regionId}
 *     onChange={setRegionId}
 *     includeInactive
 *   />
 */
export function RegionSelect({
  value,
  onChange,
  placeholder,
  disabled,
  includeInactive = false,
  className,
}: RegionSelectProps) {
  const t = useTranslations('region')

  // 查詢 Region 列表
  const { data: regions, isLoading } = useRegions({
    isActive: !includeInactive ? true : undefined,
  })

  return (
    <Select
      value={value}
      onValueChange={onChange}
      disabled={disabled || isLoading}
    >
      <SelectTrigger className={cn('w-full', className)}>
        <SelectValue placeholder={placeholder || t('select.placeholder')} />
      </SelectTrigger>
      <SelectContent>
        {isLoading ? (
          <SelectItem value="loading" disabled>
            {t('select.loading')}
          </SelectItem>
        ) : regions && regions.length > 0 ? (
          regions.map((region) => (
            <SelectItem key={region.id} value={region.id}>
              {region.name} ({region.code})
            </SelectItem>
          ))
        ) : (
          <SelectItem value="empty" disabled>
            {t('select.empty')}
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  )
}
