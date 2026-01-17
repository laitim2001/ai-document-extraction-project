/**
 * @fileoverview 語言切換組件
 * @description
 *   提供語言切換下拉選單，支援即時切換和偏好持久化。
 *   整合 next-intl 路由和 useLocalePreference hook。
 *
 * @module src/components/features/locale/LocaleSwitcher
 * @author Development Team
 * @since Epic 17 - Story 17.5 (Language Preference Settings)
 * @lastModified 2026-01-17
 *
 * @features
 *   - 語言下拉選單
 *   - 即時語言切換
 *   - 偏好設定持久化
 *   - 支援圖標或標籤顯示模式
 *
 * @related
 *   - src/i18n/config.ts - 語言配置
 *   - src/hooks/use-locale-preference.ts - 偏好管理 Hook
 */

'use client'

import * as React from 'react'
import { useLocale } from 'next-intl'
import { useRouter, usePathname } from 'next/navigation'
import { Globe, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { locales, localeNames, type Locale } from '@/i18n/config'
import { useLocalePreference } from '@/hooks/use-locale-preference'
import { cn } from '@/lib/utils'

// ============================================================
// Types
// ============================================================

interface LocaleSwitcherProps {
  /** 是否顯示完整語言名稱（預設只顯示圖標） */
  showLabel?: boolean
  /** 按鈕變體 */
  variant?: 'default' | 'outline' | 'ghost'
  /** 按鈕尺寸 */
  size?: 'default' | 'sm' | 'lg' | 'icon'
  /** 自定義類名 */
  className?: string
}

// ============================================================
// Component
// ============================================================

/**
 * @component LocaleSwitcher
 * @description 語言切換組件，提供下拉選單進行語言切換
 *
 * @example
 * ```tsx
 * // 僅圖標模式（預設）
 * <LocaleSwitcher />
 *
 * // 顯示語言名稱
 * <LocaleSwitcher showLabel />
 *
 * // 自定義樣式
 * <LocaleSwitcher variant="outline" className="my-custom-class" />
 * ```
 */
export function LocaleSwitcher({
  showLabel = false,
  variant = 'ghost',
  size = 'icon',
  className,
}: LocaleSwitcherProps) {
  const locale = useLocale() as Locale
  const router = useRouter()
  const pathname = usePathname()
  const { setLocalePreference, isLoading } = useLocalePreference()
  const [isPending, startTransition] = React.useTransition()

  const isChanging = isLoading || isPending

  /**
   * 處理語言切換
   */
  const handleLocaleChange = async (newLocale: Locale) => {
    if (newLocale === locale || isChanging) return

    // 1. 保存偏好設定
    await setLocalePreference(newLocale)

    // 2. 導航到新語言路徑
    startTransition(() => {
      // 從當前路徑中替換 locale
      const segments = pathname.split('/')
      // 檢查第一個段是否為 locale
      if (segments[1] && locales.includes(segments[1] as Locale)) {
        segments[1] = newLocale
      } else {
        // 如果沒有 locale 段，插入新的
        segments.splice(1, 0, newLocale)
      }
      const newPath = segments.join('/') || '/'

      router.push(newPath)
      router.refresh()
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={showLabel ? 'default' : size}
          className={cn('gap-2', className)}
          disabled={isChanging}
        >
          {isChanging ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Globe className="h-4 w-4" />
          )}
          {showLabel && <span>{localeNames[locale]}</span>}
          <span className="sr-only">切換語言</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {locales.map((loc) => (
          <DropdownMenuItem
            key={loc}
            onClick={() => handleLocaleChange(loc)}
            disabled={isChanging}
            className={cn(
              'flex items-center justify-between cursor-pointer',
              locale === loc && 'bg-accent'
            )}
          >
            <span>{localeNames[loc]}</span>
            {locale === loc && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
