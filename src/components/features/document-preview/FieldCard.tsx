/**
 * @fileoverview 欄位卡片組件
 * @description
 *   顯示單個提取欄位的資訊，包含：
 *   - 欄位名稱、值、信心度、來源標籤
 *   - 信心度顏色編碼 (綠/黃/紅)
 *   - 雙擊進入編輯模式
 *   - 已編輯標記和驗證錯誤顯示
 *
 * @module src/components/features/document-preview
 * @since Epic 13 - Story 13.2 (欄位提取結果面板)
 * @lastModified 2026-01-02
 *
 * @features
 *   - 信心度顏色編碼 (HIGH:綠, MEDIUM:黃, LOW:紅)
 *   - 雙擊 inline 編輯
 *   - Enter 保存 / Escape 取消
 *   - 選中時自動滾動到可見區域
 *   - 已編輯欄位橘色邊框標記
 */

'use client'

import * as React from 'react'
import { Check, X, Pencil, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type {
  ExtractedField,
  FieldSource,
  ConfidenceLevel,
} from '@/types/extracted-field'
import { FIELD_SOURCE_LABELS } from '@/types/extracted-field'

// ============================================================
// Types
// ============================================================

export interface FieldCardProps {
  /** 欄位資料 */
  field: ExtractedField
  /** 是否選中 */
  isSelected: boolean
  /** 選中回調 */
  onSelect: (fieldId: string) => void
  /** 編輯回調 */
  onEdit: (fieldId: string, newValue: string) => void
  /** 自定義 CSS 類名 */
  className?: string
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 取得信心度等級的樣式類名
 */
function getConfidenceStyles(level: ConfidenceLevel): string {
  switch (level) {
    case 'HIGH':
      return 'bg-green-50 border-green-200 text-green-700'
    case 'MEDIUM':
      return 'bg-yellow-50 border-yellow-200 text-yellow-700'
    case 'LOW':
      return 'bg-red-50 border-red-200 text-red-700'
    default:
      return 'bg-gray-50 border-gray-200 text-gray-700'
  }
}

/**
 * 取得來源標籤的樣式
 */
function getSourceStyles(source: FieldSource): string {
  switch (source) {
    case 'AZURE_DI':
      return 'bg-blue-100 text-blue-700'
    case 'GPT_VISION':
      return 'bg-purple-100 text-purple-700'
    case 'MANUAL':
      return 'bg-orange-100 text-orange-700'
    case 'MAPPING':
      return 'bg-teal-100 text-teal-700'
    default:
      return 'bg-gray-100 text-gray-600'
  }
}

// ============================================================
// Component
// ============================================================

/**
 * @component FieldCard
 * @description 欄位卡片組件，顯示單個提取欄位的資訊
 */
export function FieldCard({
  field,
  isSelected,
  onSelect,
  onEdit,
  className,
}: FieldCardProps) {
  const [isEditing, setIsEditing] = React.useState(false)
  const [editValue, setEditValue] = React.useState(String(field.value ?? ''))
  const inputRef = React.useRef<HTMLInputElement>(null)
  const cardRef = React.useRef<HTMLDivElement>(null)

  // --- Effects ---

  // 當選中時滾動到可見區域
  React.useEffect(() => {
    if (isSelected && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [isSelected])

  // 進入編輯模式時聚焦輸入框
  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  // --- Handlers ---

  const handleDoubleClick = () => {
    setIsEditing(true)
    setEditValue(String(field.value ?? ''))
  }

  const handleSave = () => {
    onEdit(field.id, editValue)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditValue(String(field.value ?? ''))
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
    }
  }

  const handleClick = () => {
    if (!isEditing) {
      onSelect(field.id)
    }
  }

  // --- Render ---

  return (
    <div
      ref={cardRef}
      role="button"
      tabIndex={0}
      className={cn(
        'cursor-pointer rounded-lg border p-3 transition-all',
        // 選中狀態
        isSelected
          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/20'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50',
        // 已編輯標記
        field.isEdited && 'border-l-4 border-l-orange-500',
        className
      )}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !isEditing) {
          onSelect(field.id)
        }
      }}
    >
      {/* 標題列 */}
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium text-gray-900">{field.displayName}</span>
        <div className="flex items-center gap-2">
          {/* 信心度標籤 */}
          <span
            className={cn(
              'rounded-full border px-2 py-0.5 text-xs font-medium',
              getConfidenceStyles(field.confidenceLevel)
            )}
          >
            {Math.round(field.confidence * 100)}%
          </span>
          {/* 來源標籤 */}
          <span
            className={cn(
              'rounded px-2 py-0.5 text-xs',
              getSourceStyles(field.source)
            )}
          >
            {FIELD_SOURCE_LABELS[field.source]}
          </span>
        </div>
      </div>

      {/* 值區域 */}
      <div className="min-h-[2rem]">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-8"
              onClick={(e) => e.stopPropagation()}
            />
            <Button
              size="sm"
              className="h-8 w-8 p-0"
              onClick={(e) => {
                e.stopPropagation()
                handleSave()
              }}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={(e) => {
                e.stopPropagation()
                handleCancel()
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <p className="text-gray-700">
            {field.value ?? (
              <span className="italic text-gray-400">未提取</span>
            )}
          </p>
        )}
      </div>

      {/* 編輯標記 */}
      {field.isEdited && !isEditing && (
        <div className="mt-2 flex items-center gap-1 text-xs text-orange-600">
          <Pencil className="h-3 w-3" />
          <span>
            已修改
            {field.originalValue !== undefined && (
              <>（原值：{String(field.originalValue)}）</>
            )}
          </span>
        </div>
      )}

      {/* 驗證錯誤 */}
      {field.validationErrors && field.validationErrors.length > 0 && (
        <div className="mt-2 space-y-1">
          {field.validationErrors.map((error, idx) => (
            <div
              key={idx}
              className="flex items-center gap-1 text-xs text-red-600"
            >
              <AlertCircle className="h-3 w-3 flex-shrink-0" />
              <span>{error}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

FieldCard.displayName = 'FieldCard'
