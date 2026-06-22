'use client'

/**
 * @fileoverview 規則建議資訊組件
 * @description
 *   顯示規則建議的詳細資訊，包含：
 *   - Forwarder 資訊
 *   - 欄位名稱和類型
 *   - 提取模式
 *   - 信心度和來源
 *
 * @module src/components/features/rule-review/SuggestionInfo
 * @since Epic 4 - Story 4.6 (審核學習規則)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @/components/ui/badge - shadcn Badge 組件
 *   - lucide-react - 圖標
 */

import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import {
  Building2,
  FileText,
  Regex,
  Percent,
  Tag,
  Calendar,
  User,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================================
// Types
// ============================================================

interface SuggestionInfoProps {
  /** 建議詳情 */
  suggestion: {
    id: string
    fieldName: string
    extractionType: string
    suggestedPattern: string
    confidence: number
    source: 'AUTO' | 'MANUAL'
    status: string
    sampleCount?: number
    createdAt: string
    forwarder: {
      id: string
      name: string
      code: string
    }
    createdBy?: {
      name: string
    } | null
  }
  /** 額外的 className */
  className?: string
}

// ============================================================
// Sub Components
// ============================================================

/**
 * 資訊項目
 */
function InfoItem({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: React.ElementType
  label: string
  value: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className="font-medium">{value}</div>
      </div>
    </div>
  )
}

/**
 * 提取類型標籤
 */
function ExtractionTypeBadge({ type }: { type: string }) {
  const t = useTranslations('rules')

  const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
    REGEX: 'default',
    POSITION: 'secondary',
    KEYWORD: 'outline',
  }

  const typeKey = `ruleReview.suggestionInfo.extractionTypes.${type}`

  return (
    <Badge variant={variants[type] ?? 'default'}>
      {t.has(typeKey) ? t(typeKey) : type}
    </Badge>
  )
}

/**
 * 來源標籤
 */
function SourceBadge({ source }: { source: 'AUTO' | 'MANUAL' }) {
  const t = useTranslations('rules')

  return (
    <Badge variant={source === 'AUTO' ? 'secondary' : 'outline'}>
      {t(`ruleReview.suggestionInfo.sources.${source}`)}
    </Badge>
  )
}

/**
 * 信心度指示器
 */
function ConfidenceIndicator({ confidence }: { confidence: number }) {
  const percentage = Math.round(confidence * 100)
  const color =
    percentage >= 90
      ? 'text-green-600'
      : percentage >= 70
        ? 'text-yellow-600'
        : 'text-red-600'

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden max-w-[100px]">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            percentage >= 90
              ? 'bg-green-500'
              : percentage >= 70
                ? 'bg-yellow-500'
                : 'bg-red-500'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className={cn('font-medium', color)}>{percentage}%</span>
    </div>
  )
}

// ============================================================
// Component
// ============================================================

/**
 * 規則建議資訊組件
 *
 * @description
 *   在審核頁面中顯示規則建議的完整資訊
 *
 * @example
 * ```tsx
 * <SuggestionInfo suggestion={suggestion} />
 * ```
 */
export function SuggestionInfo({ suggestion, className }: SuggestionInfoProps) {
  const t = useTranslations('rules')

  return (
    <div className={cn('space-y-4', className)}>
      <InfoItem
        icon={Building2}
        label={t('ruleReview.suggestionInfo.forwarder')}
        value={
          <div className="flex items-center gap-2">
            <span>{suggestion.forwarder.name}</span>
            <Badge variant="outline" className="text-xs">
              {suggestion.forwarder.code}
            </Badge>
          </div>
        }
      />

      <InfoItem
        icon={FileText}
        label={t('ruleReview.suggestionInfo.fieldName')}
        value={suggestion.fieldName}
      />

      <InfoItem
        icon={Tag}
        label={t('ruleReview.suggestionInfo.extractionType')}
        value={<ExtractionTypeBadge type={suggestion.extractionType} />}
      />

      <InfoItem
        icon={Regex}
        label={t('ruleReview.suggestionInfo.extractionPattern')}
        value={
          <code className="text-sm bg-muted px-2 py-1 rounded font-mono break-all">
            {suggestion.suggestedPattern}
          </code>
        }
      />

      <InfoItem
        icon={Percent}
        label={t('ruleReview.suggestionInfo.confidence')}
        value={<ConfidenceIndicator confidence={suggestion.confidence} />}
      />

      <InfoItem
        icon={Tag}
        label={t('ruleReview.suggestionInfo.source')}
        value={<SourceBadge source={suggestion.source} />}
      />

      {suggestion.sampleCount && (
        <InfoItem
          icon={FileText}
          label={t('ruleReview.suggestionInfo.sampleCount')}
          value={t('ruleReview.suggestionInfo.sampleCountValue', {
            count: suggestion.sampleCount,
          })}
        />
      )}

      <InfoItem
        icon={Calendar}
        label={t('ruleReview.suggestionInfo.createdAt')}
        value={new Date(suggestion.createdAt).toLocaleString('zh-TW')}
      />

      {suggestion.createdBy && (
        <InfoItem
          icon={User}
          label={t('ruleReview.suggestionInfo.createdBy')}
          value={suggestion.createdBy.name}
        />
      )}
    </div>
  )
}
