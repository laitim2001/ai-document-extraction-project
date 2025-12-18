/**
 * @fileoverview 信心度分解組件
 * @description
 *   顯示信心度計算的詳細因素分解：
 *   - 各因素的原始分數
 *   - 各因素的權重
 *   - 各因素的貢獻值
 *   - 總分計算過程
 *
 * @module src/components/features/confidence/ConfidenceBreakdown
 * @since Epic 2 - Story 2.5 (Confidence Score Calculation)
 * @lastModified 2025-12-18
 */

'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import {
  FACTOR_LABELS,
  formatScore,
  CONFIDENCE_THRESHOLDS,
} from '@/lib/confidence'
import type {
  FieldConfidenceResult,
  DocumentConfidenceResult,
  ConfidenceFactors,
} from '@/types/confidence'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

// ============================================================
// Types
// ============================================================

export interface ConfidenceBreakdownProps {
  /** 欄位或文件信心度結果 */
  result: FieldConfidenceResult | DocumentConfidenceResult
  /** 顯示語言 */
  locale?: 'en' | 'zh'
  /** 是否顯示權重說明 */
  showWeights?: boolean
  /** 自定義 className */
  className?: string
}

export interface FactorRowProps {
  /** 因素名稱 */
  factor: keyof ConfidenceFactors
  /** 原始分數 */
  rawScore: number
  /** 權重 */
  weight: number
  /** 貢獻值 */
  contribution: number
  /** 顯示語言 */
  locale?: 'en' | 'zh'
  /** 是否顯示權重 */
  showWeight?: boolean
}

// ============================================================
// Sub-Components
// ============================================================

/**
 * 單一因素行
 */
function FactorRow({
  factor,
  rawScore,
  weight,
  contribution,
  locale = 'en',
  showWeight = true,
}: FactorRowProps) {
  const labels = FACTOR_LABELS[factor]
  const label = locale === 'zh' ? labels.zh : labels.en
  const weightPercent = Math.round(weight * 100)

  return (
    <div className="flex items-center justify-between py-2 border-b last:border-b-0">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{label}</span>
        {showWeight && (
          <span className="text-xs text-muted-foreground">
            ({weightPercent}%)
          </span>
        )}
      </div>
      <div className="flex items-center gap-4">
        {/* Raw Score */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-16 text-right">
                <span className="text-sm">{formatScore(rawScore)}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{locale === 'zh' ? '原始分數' : 'Raw Score'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Progress Bar */}
        <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${Math.min(100, rawScore)}%` }}
          />
        </div>

        {/* Contribution */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-16 text-right">
                <span className="text-sm font-medium text-primary">
                  +{contribution.toFixed(1)}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{locale === 'zh' ? '貢獻值' : 'Contribution'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  )
}

// ============================================================
// Main Component
// ============================================================

/**
 * 信心度分解組件
 *
 * @example
 *   <ConfidenceBreakdown result={fieldResult} locale="zh" />
 */
export function ConfidenceBreakdown({
  result,
  locale = 'en',
  showWeights = true,
  className,
}: ConfidenceBreakdownProps) {
  // 判斷是欄位結果還是文件結果
  const isFieldResult = 'factors' in result && 'breakdown' in result
  const fieldResult = isFieldResult ? (result as FieldConfidenceResult) : null

  // 如果是文件結果，顯示統計摘要
  if (!isFieldResult) {
    const docResult = result as DocumentConfidenceResult
    return (
      <DocumentConfidenceSummary result={docResult} locale={locale} className={className} />
    )
  }

  if (!fieldResult) return null

  const { breakdown, score, level } = fieldResult
  const config = CONFIDENCE_THRESHOLDS[level]
  const levelLabel = locale === 'zh' ? config.labelZh : config.label

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="text-base">
            {locale === 'zh' ? '信心度分解' : 'Confidence Breakdown'}
          </span>
          <span
            className="text-lg font-bold"
            style={{ color: config.color }}
          >
            {formatScore(score)}
          </span>
        </CardTitle>
        <p className="text-sm text-muted-foreground">{levelLabel}</p>
      </CardHeader>
      <CardContent>
        {/* Factor Rows */}
        <div className="space-y-1">
          {breakdown.map((item) => (
            <FactorRow
              key={item.factor}
              factor={item.factor}
              rawScore={item.rawScore}
              weight={item.weight}
              contribution={item.contribution}
              locale={locale}
              showWeight={showWeights}
            />
          ))}
        </div>

        {/* Total */}
        <div className="mt-4 pt-3 border-t flex items-center justify-between">
          <span className="text-sm font-medium">
            {locale === 'zh' ? '總分' : 'Total Score'}
          </span>
          <span
            className="text-lg font-bold"
            style={{ color: config.color }}
          >
            {formatScore(score)}
          </span>
        </div>

        {/* Formula */}
        {showWeights && (
          <div className="mt-3 p-2 bg-muted rounded text-xs text-muted-foreground">
            {locale === 'zh'
              ? 'score = OCR(30%) + 規則(30%) + 格式(25%) + 歷史(15%)'
              : 'score = OCR(30%) + Rule(30%) + Format(25%) + History(15%)'}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * 文件信心度摘要組件
 */
function DocumentConfidenceSummary({
  result,
  locale = 'en',
  className,
}: {
  result: DocumentConfidenceResult
  locale?: 'en' | 'zh'
  className?: string
}) {
  const { overallScore, level, stats, recommendation } = result
  const config = CONFIDENCE_THRESHOLDS[level]
  const levelLabel = locale === 'zh' ? config.labelZh : config.label

  const recommendationLabels = {
    auto_approve: locale === 'zh' ? '自動通過' : 'Auto Approve',
    quick_review: locale === 'zh' ? '快速審核' : 'Quick Review',
    full_review: locale === 'zh' ? '完整審核' : 'Full Review',
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="text-base">
            {locale === 'zh' ? '文件信心度' : 'Document Confidence'}
          </span>
          <span
            className="text-lg font-bold"
            style={{ color: config.color }}
          >
            {formatScore(overallScore)}
          </span>
        </CardTitle>
        <p className="text-sm text-muted-foreground">{levelLabel}</p>
      </CardHeader>
      <CardContent>
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <StatItem
            label={locale === 'zh' ? '高信心' : 'High'}
            value={stats.highConfidence}
            total={stats.totalFields}
            color="text-green-600"
          />
          <StatItem
            label={locale === 'zh' ? '中信心' : 'Medium'}
            value={stats.mediumConfidence}
            total={stats.totalFields}
            color="text-yellow-600"
          />
          <StatItem
            label={locale === 'zh' ? '低信心' : 'Low'}
            value={stats.lowConfidence}
            total={stats.totalFields}
            color="text-red-600"
          />
        </div>

        {/* Score Range */}
        <div className="flex items-center justify-between py-2 border-t">
          <span className="text-sm text-muted-foreground">
            {locale === 'zh' ? '分數範圍' : 'Score Range'}
          </span>
          <span className="text-sm">
            {formatScore(stats.minScore)} - {formatScore(stats.maxScore)}
          </span>
        </div>

        {/* Recommendation */}
        <div className="mt-3 p-3 rounded-lg" style={{ backgroundColor: config.bgColor }}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {locale === 'zh' ? '處理建議' : 'Recommendation'}
            </span>
            <span
              className="text-sm font-bold"
              style={{ color: config.color }}
            >
              {recommendationLabels[recommendation]}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * 統計項目
 */
function StatItem({
  label,
  value,
  total,
  color,
}: {
  label: string
  value: number
  total: number
  color: string
}) {
  return (
    <div className="text-center">
      <div className={cn('text-2xl font-bold', color)}>{value}</div>
      <div className="text-xs text-muted-foreground">
        {label} / {total}
      </div>
    </div>
  )
}
