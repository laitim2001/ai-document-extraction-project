'use client'

/**
 * @fileoverview Region 選擇組件
 * @description
 *   提供 Region 下拉選擇功能，支援：
 *   - 單選模式
 *   - 搜尋過濾（Combobox 模式）
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
 *   - 搜尋過濾（Popover + Command combobox）
 *   - 支援 disabled 狀態
 *   - 載入中顯示 loading 狀態
 *   - i18n 支援
 *
 * @dependencies
 *   - next-intl - 國際化
 *   - @/hooks/use-regions - Region 查詢 Hook
 *   - @/components/ui/popover - Popover 組件
 *   - @/components/ui/command - Command 組件
 *   - @/components/ui/button - Button 組件
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
import { ChevronsUpDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { useRegions } from '@/hooks/use-regions'

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
 * Region 選擇組件（Combobox 搜尋模式）
 *
 * @description
 *   提供 Region 下拉選擇功能，用於表單或篩選器中選擇地區。
 *   使用 Popover + Command 實現搜尋過濾功能。
 *
 * @param props - 組件屬性
 * @returns React 元素
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
  const [open, setOpen] = React.useState(false)

  // 查詢 Region 列表
  const { data: regions, isLoading } = useRegions({
    isActive: !includeInactive ? true : undefined,
  })

  // 找到當前選中的 Region 名稱
  const selectedRegion = React.useMemo(
    () => regions?.find((r) => r.id === value),
    [regions, value]
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || isLoading}
          className={cn('w-full justify-between font-normal', className)}
        >
          {isLoading
            ? t('select.loading')
            : selectedRegion
              ? `${selectedRegion.name} (${selectedRegion.code})`
              : placeholder || t('select.placeholder')
          }
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={t('select.searchPlaceholder')} />
          <CommandList>
            <CommandEmpty>{t('select.empty')}</CommandEmpty>
            <CommandGroup>
              {regions?.map((region) => (
                <CommandItem
                  key={region.id}
                  value={`${region.name} ${region.code}`}
                  onSelect={() => {
                    onChange(region.id)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === region.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {region.name} ({region.code})
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
