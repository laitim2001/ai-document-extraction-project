/**
 * @fileoverview 欄位分組組件
 * @description
 *   顯示一組相關欄位：
 *   - 可折疊的分組標題
 *   - 低信心度欄位標記
 *   - 欄位數量顯示
 *
 * @module src/components/features/review/ReviewPanel
 * @since Epic 3 - Story 3.2 (並排 PDF 審核介面)
 * @lastModified 2025-12-18
 */

'use client'

import { useState } from 'react'
import type { ExtractedField, FieldGroupData } from '@/types/review'
import { FieldRow } from './FieldRow'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ============================================================
// Types
// ============================================================

interface FieldGroupProps {
  /** 分組資料 */
  group: FieldGroupData
  /** 當前選中的欄位 ID */
  selectedFieldId: string | null
  /** 欄位選擇回調 */
  onFieldSelect: (field: ExtractedField) => void
}

// ============================================================
// Component
// ============================================================

/**
 * 欄位分組組件
 *
 * @example
 * ```tsx
 * <FieldGroup
 *   group={headerGroup}
 *   selectedFieldId="field-invoiceNumber"
 *   onFieldSelect={handleFieldSelect}
 * />
 * ```
 */
export function FieldGroup({
  group,
  selectedFieldId,
  onFieldSelect,
}: FieldGroupProps) {
  const [isExpanded, setIsExpanded] = useState(group.isExpanded)

  // 計算該組的最低信心度
  const minConfidence = Math.min(...group.fields.map((f) => f.confidence))
  const hasLowConfidence = minConfidence < 70

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* 組標題 */}
      <Button
        variant="ghost"
        className={cn(
          'w-full justify-between rounded-none h-10',
          hasLowConfidence && 'bg-red-50 dark:bg-red-950/20'
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <span className="font-medium">{group.displayName}</span>
          <span className="text-xs text-muted-foreground">
            ({group.fields.length})
          </span>
        </div>

        {hasLowConfidence && (
          <span className="text-xs text-red-600 dark:text-red-400">需要關注</span>
        )}
      </Button>

      {/* 欄位列表 */}
      {isExpanded && (
        <div className="divide-y">
          {group.fields.map((field) => (
            <FieldRow
              key={field.id}
              field={field}
              isSelected={field.id === selectedFieldId}
              onSelect={() => onFieldSelect(field)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
