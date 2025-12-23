/**
 * @fileoverview 審核面板主組件
 * @description
 *   顯示文件提取結果的審核面板（已整合 Story 3.3 功能）：
 *   - 文件基本資訊（標題、Forwarder、信心度）
 *   - 低信心度篩選開關 (AC3)
 *   - 分組顯示提取欄位
 *   - 審核操作按鈕
 *
 * @module src/components/features/review/ReviewPanel
 * @since Epic 3 - Story 3.2 (並排 PDF 審核介面)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @/lib/confidence - 信心度工具函數
 *   - ../LowConfidenceFilter - 低信心度篩選組件
 */

'use client'

import { useMemo, useState } from 'react'
import type { ExtractedField, FieldGroupData, ReviewDetailData } from '@/types/review'
import { useReviewStore } from '@/stores/reviewStore'
import { FieldGroup } from './FieldGroup'
import { ReviewActions } from './ReviewActions'
import { ConfidenceBadge } from '../ConfidenceBadge'
import { ProcessingPathBadge } from '../ProcessingPathBadge'
import { LowConfidenceFilter } from '../LowConfidenceFilter'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { getConfidenceLevel } from '@/lib/confidence'

// ============================================================
// Constants
// ============================================================

/**
 * 欄位分組配置
 */
const FIELD_GROUPS: { key: string; displayName: string }[] = [
  { key: 'header', displayName: '發票基本資訊' },
  { key: 'shipper', displayName: '發貨人資訊' },
  { key: 'consignee', displayName: '收貨人資訊' },
  { key: 'shipment', displayName: '運輸資訊' },
  { key: 'charges', displayName: '費用明細' },
  { key: 'totals', displayName: '金額合計' },
  { key: 'other', displayName: '其他資訊' },
]

// ============================================================
// Types
// ============================================================

interface ReviewPanelProps {
  /** 審核詳情資料 */
  data: ReviewDetailData
  /** 確認無誤回調 */
  onApprove: () => void
  /** 儲存修正回調 */
  onSaveCorrections: () => void
  /** 升級案例回調 */
  onEscalate: () => void
  /** 是否正在提交 */
  isSubmitting?: boolean
}

// ============================================================
// Component
// ============================================================

/**
 * 審核面板組件
 *
 * @description
 *   整合 Story 3.3 的信心度篩選功能：
 *   - 可切換只顯示低信心度欄位
 *   - 顯示低信心度欄位數量統計
 *
 * @example
 * ```tsx
 * <ReviewPanel
 *   data={reviewData}
 *   onApprove={handleApprove}
 *   onSaveCorrections={handleSave}
 *   onEscalate={handleEscalate}
 * />
 * ```
 */
export function ReviewPanel({
  data,
  onApprove,
  onSaveCorrections,
  onEscalate,
  isSubmitting,
}: ReviewPanelProps) {
  const { selectedFieldId, setSelectedField, hasPendingChanges } = useReviewStore()

  // --- 低信心度篩選狀態 (AC3) ---
  const [showLowConfidenceOnly, setShowLowConfidenceOnly] = useState(false)

  // --- 計算低信心度欄位數量 ---
  const lowConfidenceCount = useMemo(
    () =>
      data.extraction.fields.filter(
        (f) => getConfidenceLevel(f.confidence) === 'low'
      ).length,
    [data.extraction.fields]
  )

  // --- 篩選後的欄位 ---
  const filteredFields = useMemo(() => {
    if (!showLowConfidenceOnly) return data.extraction.fields

    return data.extraction.fields.filter(
      (f) => getConfidenceLevel(f.confidence) === 'low'
    )
  }, [data.extraction.fields, showLowConfidenceOnly])

  // --- 將欄位按組分類 ---
  const groupedFields = useMemo(() => {
    const groups: FieldGroupData[] = []
    const fieldsByGroup = new Map<string, ExtractedField[]>()

    // 分組
    filteredFields.forEach((field) => {
      const group = field.fieldGroup || 'other'
      if (!fieldsByGroup.has(group)) {
        fieldsByGroup.set(group, [])
      }
      fieldsByGroup.get(group)!.push(field)
    })

    // 按配置順序排列
    FIELD_GROUPS.forEach(({ key, displayName }) => {
      const fields = fieldsByGroup.get(key)
      if (fields && fields.length > 0) {
        groups.push({
          groupName: key,
          displayName,
          fields,
          isExpanded: true,
        })
      }
    })

    return groups
  }, [filteredFields])

  // --- 處理欄位選擇 ---
  const handleFieldSelect = (field: ExtractedField) => {
    setSelectedField(
      field.id === selectedFieldId ? null : field.id,
      field.sourcePosition
    )
  }

  // --- Render ---
  return (
    <div className="flex flex-col h-full" data-testid="review-panel">
      {/* 頭部資訊 */}
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2
            className="font-semibold truncate flex-1"
            title={data.document.fileName}
          >
            {data.document.fileName}
          </h2>
          {data.processingQueue && (
            <ProcessingPathBadge path={data.processingQueue.processingPath} />
          )}
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
          <span>Forwarder: {data.company?.name || '未識別'}</span>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center gap-2">
            <span>整體信心度:</span>
            <ConfidenceBadge score={data.extraction.overallConfidence} />
          </div>
        </div>

        {/* 低信心度篩選 (AC3) - 只有當存在低信心度欄位時顯示 */}
        {lowConfidenceCount > 0 && (
          <LowConfidenceFilter
            enabled={showLowConfidenceOnly}
            onToggle={setShowLowConfidenceOnly}
            lowConfidenceCount={lowConfidenceCount}
            totalCount={data.extraction.fields.length}
          />
        )}
      </div>

      {/* 欄位列表 */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {groupedFields.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {showLowConfidenceOnly ? '沒有低信心度欄位' : '沒有提取欄位'}
            </p>
          ) : (
            groupedFields.map((group) => (
              <FieldGroup
                key={group.groupName}
                group={group}
                selectedFieldId={selectedFieldId}
                onFieldSelect={handleFieldSelect}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* 操作按鈕 */}
      <ReviewActions
        onApprove={onApprove}
        onSaveCorrections={onSaveCorrections}
        onEscalate={onEscalate}
        hasPendingChanges={hasPendingChanges()}
        isSubmitting={isSubmitting}
        processingPath={data.processingQueue?.processingPath}
        fieldCount={data.extraction.fields.length}
      />
    </div>
  )
}
