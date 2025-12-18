'use client'

/**
 * @fileoverview 快速審核模式組件
 * @description
 *   專為 QUICK_REVIEW 處理路徑設計的審核介面，功能：
 *   - 僅顯示低信心度（<70%）和中信心度（70-89%）欄位
 *   - 高信心度欄位已自動確認，僅需確認需關注欄位
 *   - 提供「全部確認」快速操作
 *   - 統計資訊顯示
 *
 * @module src/components/features/review/ReviewPanel/QuickReviewMode
 * @since Epic 3 - Story 3.4 (確認提取結果)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @/lib/confidence - 信心度工具
 *   - ./FieldRow - 欄位列組件
 *   - @/components/ui - UI 組件
 */

import * as React from 'react'
import { CheckCircle, AlertTriangle, Eye, ChevronDown, ChevronUp } from 'lucide-react'
import type { ExtractedField } from '@/types/review'
import { getConfidenceLevel } from '@/lib/confidence'
import { FieldRow } from './FieldRow'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// ============================================================
// Types
// ============================================================

interface QuickReviewModeProps {
  /** 所有提取欄位 */
  fields: ExtractedField[]
  /** 當前選中的欄位 ID */
  selectedFieldId: string | null
  /** 選擇欄位回調 */
  onSelectField: (fieldId: string | null) => void
  /** 確認全部回調 */
  onConfirmAll: () => void
  /** 是否正在提交 */
  isSubmitting?: boolean
}

interface FieldStats {
  total: number
  high: number
  medium: number
  low: number
  needsReview: number
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 計算欄位統計
 */
function calculateStats(fields: ExtractedField[]): FieldStats {
  const stats: FieldStats = {
    total: fields.length,
    high: 0,
    medium: 0,
    low: 0,
    needsReview: 0,
  }

  for (const field of fields) {
    const level = getConfidenceLevel(field.confidence)
    stats[level]++
    if (level !== 'high') {
      stats.needsReview++
    }
  }

  return stats
}

/**
 * 篩選需要關注的欄位（非高信心度）
 */
function filterFieldsNeedingReview(fields: ExtractedField[]): ExtractedField[] {
  return fields.filter((field) => {
    const level = getConfidenceLevel(field.confidence)
    return level !== 'high'
  })
}

// ============================================================
// Component
// ============================================================

/**
 * 快速審核模式組件
 *
 * @description
 *   專為 QUICK_REVIEW 路徑設計，自動隱藏高信心度欄位，
 *   讓審核人員專注於需要關注的項目。
 *
 * @example
 * ```tsx
 * <QuickReviewMode
 *   fields={extractedFields}
 *   selectedFieldId={selectedId}
 *   onSelectField={setSelectedId}
 *   onConfirmAll={handleConfirmAll}
 *   isSubmitting={isApproving}
 * />
 * ```
 */
export function QuickReviewMode({
  fields,
  selectedFieldId,
  onSelectField,
  onConfirmAll,
  isSubmitting = false,
}: QuickReviewModeProps) {
  // --- State ---
  const [showAutoApproved, setShowAutoApproved] = React.useState(false)

  // --- Computed ---
  const stats = React.useMemo(() => calculateStats(fields), [fields])
  const fieldsNeedingReview = React.useMemo(
    () => filterFieldsNeedingReview(fields),
    [fields]
  )
  const autoApprovedFields = React.useMemo(
    () => fields.filter((f) => getConfidenceLevel(f.confidence) === 'high'),
    [fields]
  )

  // --- Render ---
  return (
    <div className="space-y-4">
      {/* 快速審核提示卡片 */}
      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
        <CardHeader className="py-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-300">
            <Eye className="h-4 w-4" />
            快速審核模式
          </CardTitle>
        </CardHeader>
        <CardContent className="py-2">
          <p className="text-sm text-muted-foreground">
            系統已自動確認 {stats.high} 個高信心度欄位，
            請審核以下 {stats.needsReview} 個需要關注的欄位。
          </p>
        </CardContent>
      </Card>

      {/* 統計徽章 */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="bg-red-50 border-red-200 text-red-700">
          <AlertTriangle className="h-3 w-3 mr-1" />
          低信心度: {stats.low}
        </Badge>
        <Badge variant="outline" className="bg-yellow-50 border-yellow-200 text-yellow-700">
          中信心度: {stats.medium}
        </Badge>
        <Badge variant="outline" className="bg-green-50 border-green-200 text-green-700">
          <CheckCircle className="h-3 w-3 mr-1" />
          已自動確認: {stats.high}
        </Badge>
      </div>

      {/* 需要關注的欄位 */}
      {fieldsNeedingReview.length > 0 ? (
        <div className="space-y-1 border rounded-lg overflow-hidden">
          <div className="px-3 py-2 bg-muted/50 border-b">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              需要關注的欄位 ({fieldsNeedingReview.length})
            </h3>
          </div>
          <div className="divide-y">
            {fieldsNeedingReview.map((field) => (
              <FieldRow
                key={field.id}
                field={field}
                isSelected={selectedFieldId === field.id}
                onSelect={() =>
                  onSelectField(selectedFieldId === field.id ? null : field.id)
                }
              />
            ))}
          </div>
        </div>
      ) : (
        <Card className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20">
          <CardContent className="py-4 flex items-center justify-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span className="text-green-700 dark:text-green-300">
              所有欄位皆為高信心度，可直接確認
            </span>
          </CardContent>
        </Card>
      )}

      {/* 自動確認的欄位（可展開） */}
      {autoApprovedFields.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <button
            type="button"
            className={cn(
              'w-full px-3 py-2 flex items-center justify-between',
              'bg-muted/30 hover:bg-muted/50 transition-colors',
              'text-sm text-muted-foreground'
            )}
            onClick={() => setShowAutoApproved(!showAutoApproved)}
          >
            <span className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              已自動確認的欄位 ({autoApprovedFields.length})
            </span>
            {showAutoApproved ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
          {showAutoApproved && (
            <div className="divide-y border-t">
              {autoApprovedFields.map((field) => (
                <FieldRow
                  key={field.id}
                  field={field}
                  isSelected={selectedFieldId === field.id}
                  onSelect={() =>
                    onSelectField(selectedFieldId === field.id ? null : field.id)
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 確認全部按鈕 */}
      <Button
        size="lg"
        className="w-full bg-green-600 hover:bg-green-700"
        onClick={onConfirmAll}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          '確認中...'
        ) : (
          <>
            <CheckCircle className="h-4 w-4 mr-2" />
            確認全部欄位 ({stats.total})
          </>
        )}
      </Button>
    </div>
  )
}
