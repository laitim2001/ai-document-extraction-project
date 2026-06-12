/**
 * @fileoverview 信心度詳情 Tooltip 組件
 * @description
 *   顯示信心度計算詳情的 Tooltip 組件（AC2）：
 *   - 信心度等級和分數
 *   - 等級描述說明
 *   - 計算因素分解（帶進度條）
 *
 * @module src/components/features/review/ConfidenceTooltip
 * @since Epic 3 - Story 3.3 (信心度顏色編碼顯示)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @/components/ui/tooltip - shadcn Tooltip 組件
 *   - @/components/ui/progress - shadcn Progress 組件
 *   - @/lib/confidence - 信心度工具函數
 *   - ./ConfidenceIndicator - 形狀指示器
 */

'use client'

import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Progress } from '@/components/ui/progress'
import type { ConfidenceFactors } from '@/types/confidence'
import {
  getConfidenceLevel,
  formatConfidenceFactors,
} from '@/lib/confidence'
import { ConfidenceIndicator } from './ConfidenceIndicator'

// ============================================================
// Types
// ============================================================

interface ConfidenceTooltipProps {
  /** 信心度分數 (0-100) */
  score: number
  /** 信心度計算因素（可選） */
  factors?: ConfidenceFactors
  /** 觸發元素 */
  children: ReactNode
  /** Tooltip 延遲時間（毫秒） */
  delayDuration?: number
}

// ============================================================
// Component
// ============================================================

/**
 * 信心度詳情 Tooltip
 *
 * @description
 *   包裝子元素，懸停時顯示信心度詳情：
 *   - 頭部：等級圖標 + 標籤 + 分數
 *   - 中部：等級描述說明
 *   - 下部：因素分解進度條（如有）
 *
 * @example
 * ```tsx
 * <ConfidenceTooltip score={85} factors={factors}>
 *   <ConfidenceBadge score={85} />
 * </ConfidenceTooltip>
 *
 * // 無因素資料時
 * <ConfidenceTooltip score={65}>
 *   <span>65%</span>
 * </ConfidenceTooltip>
 * ```
 */
export function ConfidenceTooltip({
  score,
  factors,
  children,
  delayDuration = 300,
}: ConfidenceTooltipProps) {
  const t = useTranslations('review')
  const level = getConfidenceLevel(score)

  return (
    <TooltipProvider>
      <Tooltip delayDuration={delayDuration}>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side="top" className="w-[280px] p-4">
          {/* 頭部：等級 + 分數 */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ConfidenceIndicator level={level} size="lg" />
              <span className="font-semibold">{t(`confidence.${level}`)}</span>
            </div>
            <span className="text-2xl font-bold">{score}%</span>
          </div>

          {/* 描述 */}
          <p className="text-sm text-muted-foreground mb-3">
            {t(`confidenceDetail.description.${level}`)}
          </p>

          {/* 因素分解（如有） */}
          {factors && (
            <div className="space-y-2 pt-3 border-t">
              <p className="text-xs font-medium text-muted-foreground">
                {t('confidenceDetail.factorsTitle')}
              </p>
              {formatConfidenceFactors(factors).map((factor) => (
                <div key={factor.key} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>{t(`confidenceDetail.factors.${factor.key}`)}</span>
                    <span className="text-muted-foreground">
                      {factor.value}% ({factor.weight})
                    </span>
                  </div>
                  <Progress value={factor.value} className="h-1" />
                </div>
              ))}
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
