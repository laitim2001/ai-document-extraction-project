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
  const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
    REGEX: 'default',
    POSITION: 'secondary',
    KEYWORD: 'outline',
  }

  const labels: Record<string, string> = {
    REGEX: '正則表達式',
    POSITION: '位置提取',
    KEYWORD: '關鍵字匹配',
  }

  return (
    <Badge variant={variants[type] ?? 'default'}>
      {labels[type] ?? type}
    </Badge>
  )
}

/**
 * 來源標籤
 */
function SourceBadge({ source }: { source: 'AUTO' | 'MANUAL' }) {
  return (
    <Badge variant={source === 'AUTO' ? 'secondary' : 'outline'}>
      {source === 'AUTO' ? '自動學習' : '手動建立'}
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
  return (
    <div className={cn('space-y-4', className)}>
      <InfoItem
        icon={Building2}
        label="Forwarder"
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
        label="欄位名稱"
        value={suggestion.fieldName}
      />

      <InfoItem
        icon={Tag}
        label="提取類型"
        value={<ExtractionTypeBadge type={suggestion.extractionType} />}
      />

      <InfoItem
        icon={Regex}
        label="提取模式"
        value={
          <code className="text-sm bg-muted px-2 py-1 rounded font-mono break-all">
            {suggestion.suggestedPattern}
          </code>
        }
      />

      <InfoItem
        icon={Percent}
        label="信心度"
        value={<ConfidenceIndicator confidence={suggestion.confidence} />}
      />

      <InfoItem
        icon={Tag}
        label="來源"
        value={<SourceBadge source={suggestion.source} />}
      />

      {suggestion.sampleCount && (
        <InfoItem
          icon={FileText}
          label="樣本數量"
          value={`${suggestion.sampleCount} 個文件`}
        />
      )}

      <InfoItem
        icon={Calendar}
        label="建立時間"
        value={new Date(suggestion.createdAt).toLocaleString('zh-TW')}
      />

      {suggestion.createdBy && (
        <InfoItem
          icon={User}
          label="建立者"
          value={suggestion.createdBy.name}
        />
      )}
    </div>
  )
}
