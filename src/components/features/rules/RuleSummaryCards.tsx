'use client'

/**
 * @fileoverview 規則摘要卡片組件
 * @description
 *   顯示映射規則的統計摘要：
 *   - 總規則數
 *   - 生效中規則數
 *   - 草稿規則數
 *   - 待審核規則數
 *   - 已棄用規則數
 *   - 通用規則數
 *
 * @module src/components/features/rules/RuleSummaryCards
 * @since Epic 4 - Story 4.1 (映射規則列表與查看)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @/components/ui/card - shadcn Card 組件
 *   - lucide-react - 圖標庫
 */

import { Card, CardContent } from '@/components/ui/card'
import {
  FileText,
  CheckCircle2,
  FileEdit,
  Clock,
  Archive,
  Globe,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RulesSummary } from '@/types/rule'

// ============================================================
// Types
// ============================================================

interface RuleSummaryCardsProps {
  /** 摘要數據 */
  summary: RulesSummary
  /** 額外的 className */
  className?: string
}

// ============================================================
// Card Configuration
// ============================================================

interface CardConfig {
  key: keyof RulesSummary
  label: string
  icon: typeof FileText
  color: string
  bgColor: string
}

const CARD_CONFIGS: CardConfig[] = [
  {
    key: 'totalRules',
    label: '總規則數',
    icon: FileText,
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-100 dark:bg-slate-800',
  },
  {
    key: 'activeRules',
    label: '生效中',
    icon: CheckCircle2,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
  },
  {
    key: 'draftRules',
    label: '草稿',
    icon: FileEdit,
    color: 'text-slate-500 dark:text-slate-400',
    bgColor: 'bg-slate-100 dark:bg-slate-800',
  },
  {
    key: 'pendingReviewRules',
    label: '待審核',
    icon: Clock,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
  },
  {
    key: 'deprecatedRules',
    label: '已棄用',
    icon: Archive,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
  },
  {
    key: 'universalRules',
    label: '通用規則',
    icon: Globe,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
  },
]

// ============================================================
// Component
// ============================================================

/**
 * 規則摘要卡片
 *
 * @example
 * ```tsx
 * <RuleSummaryCards summary={summary} />
 * ```
 */
export function RuleSummaryCards({ summary, className }: RuleSummaryCardsProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4',
        className
      )}
    >
      {CARD_CONFIGS.map((config) => {
        const Icon = config.icon
        const value = summary[config.key]

        return (
          <Card key={config.key} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex items-center justify-center rounded-lg p-2',
                    config.bgColor
                  )}
                >
                  <Icon className={cn('h-5 w-5', config.color)} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{value}</p>
                  <p className="text-xs text-muted-foreground">{config.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
