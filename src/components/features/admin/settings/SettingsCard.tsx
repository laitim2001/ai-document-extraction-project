'use client'

/**
 * @fileoverview Settings Hub 可重用卡片組件
 * @description
 *   用於 System Settings Hub 頁面的卡片元件，支援兩種模式：
 *   - **連結模式**: 顯示箭頭圖示，點擊導航至指定 href
 *   - **展開模式**: 點擊展開/收合，顯示子表單內容
 *
 * @module src/components/features/admin/settings/SettingsCard
 * @since CHANGE-050 - System Settings Hub
 * @lastModified 2026-02-26
 *
 * @dependencies
 *   - lucide-react - 圖示
 *   - @/components/ui/card - shadcn Card 組件
 *   - @/components/ui/badge - Badge 組件
 *   - @/i18n/routing - i18n-aware Link
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'
import { Link } from '@/i18n/routing'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// ============================================================
// Types
// ============================================================

interface SettingsCardProps {
  /** 卡片圖示 */
  icon: React.ComponentType<{ className?: string }>
  /** 卡片標題 */
  title: string
  /** 卡片說明 */
  description: string
  /** 連結模式 — 點擊導航至此 URL */
  href?: string
  /** 展開模式 — 是否展開 */
  expanded?: boolean
  /** 展開/收合切換回調 */
  onToggle?: () => void
  /** 展開後顯示的表單內容 */
  children?: React.ReactNode
}

// ============================================================
// Component
// ============================================================

/**
 * Settings Hub 卡片組件
 *
 * @description
 *   提供兩種運作模式：
 *   - 當 `href` 存在時，卡片為連結模式，點擊導航至目標頁面
 *   - 當 `onToggle` 存在時，卡片為展開模式，點擊展開/收合表單
 */
export function SettingsCard({
  icon: Icon,
  title,
  description,
  href,
  expanded,
  onToggle,
  children,
}: SettingsCardProps) {
  const t = useTranslations('systemSettings')

  // --- Link mode ---
  if (href) {
    return (
      <Link href={href} className="block group">
        <Card className="h-full transition-colors hover:border-primary/50 hover:shadow-md">
          <CardHeader className="flex flex-row items-start gap-4 space-y-0">
            <div className="rounded-lg bg-muted p-2">
              <Icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold">
                  {title}
                </CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {t('settingsCard.linkBadge')}
                </Badge>
              </div>
              <CardDescription className="text-sm">
                {description}
              </CardDescription>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </CardHeader>
        </Card>
      </Link>
    )
  }

  // --- Expandable mode ---
  return (
    <Card
      className={cn(
        'transition-colors',
        expanded && 'border-primary/50 shadow-md'
      )}
    >
      <CardHeader
        className="flex flex-row items-start gap-4 space-y-0 cursor-pointer select-none"
        onClick={onToggle}
      >
        <div className="rounded-lg bg-muted p-2">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="flex-1 space-y-1">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          <CardDescription className="text-sm">{description}</CardDescription>
        </div>
        {expanded ? (
          <ChevronUp className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        )}
      </CardHeader>
      {expanded && children && (
        <CardContent className="pt-0">
          {children}
        </CardContent>
      )}
    </Card>
  )
}
