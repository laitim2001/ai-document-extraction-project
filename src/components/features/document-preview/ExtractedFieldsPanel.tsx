/**
 * @fileoverview 欄位提取結果面板
 * @description
 *   展示所有提取欄位的主面板，支援：
 *   - 搜尋、過濾、排序功能
 *   - 按類別分組顯示
 *   - 與 PDF 預覽雙向聯動
 *   - 欄位 inline 編輯
 *
 * @module src/components/features/document-preview
 * @since Epic 13 - Story 13.2 (欄位提取結果面板)
 * @lastModified 2026-01-02
 *
 * @features
 *   - 搜尋欄位名稱和值
 *   - 按信心度/來源過濾
 *   - 按名稱/信心度/類別排序
 *   - 類別分組顯示
 *   - 統計資訊顯示
 */

'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { FieldCard } from './FieldCard'
import { FieldFilters } from './FieldFilters'
import type {
  ExtractedField,
  FieldCategory,
  FieldFilterState,
} from '@/types/extracted-field'
import { DEFAULT_CATEGORIES, DEFAULT_FILTER_STATE } from '@/types/extracted-field'

// ============================================================
// Types
// ============================================================

export interface ExtractedFieldsPanelProps {
  /** 欄位列表 */
  fields: ExtractedField[]
  /** 欄位類別定義 */
  categories?: FieldCategory[]
  /** 選中的欄位 ID */
  selectedFieldId: string | null
  /** 欄位選中回調 */
  onFieldSelect: (fieldId: string) => void
  /** 欄位編輯回調 */
  onFieldEdit: (fieldId: string, newValue: string) => void
  /** 自定義 CSS 類名 */
  className?: string
  /** 是否顯示過濾器 */
  showFilters?: boolean
  /** 是否顯示統計資訊 */
  showStats?: boolean
}

interface FieldGroup {
  category: FieldCategory | null
  fields: ExtractedField[]
}

// ============================================================
// Component
// ============================================================

/**
 * @component ExtractedFieldsPanel
 * @description 欄位提取結果面板組件
 */
export function ExtractedFieldsPanel({
  fields,
  categories = DEFAULT_CATEGORIES,
  selectedFieldId,
  onFieldSelect,
  onFieldEdit,
  className,
  showFilters = true,
  showStats = true,
}: ExtractedFieldsPanelProps) {
  const [filters, setFilters] = React.useState<FieldFilterState>(DEFAULT_FILTER_STATE)

  // --- Memoized Computations ---

  // 過濾欄位
  const filteredFields = React.useMemo(() => {
    let result = [...fields]

    // 搜尋過濾
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      result = result.filter(
        (f) =>
          f.displayName.toLowerCase().includes(searchLower) ||
          String(f.value ?? '').toLowerCase().includes(searchLower) ||
          f.fieldName.toLowerCase().includes(searchLower)
      )
    }

    // 信心度過濾
    if (filters.confidenceLevel !== 'ALL') {
      result = result.filter((f) => f.confidenceLevel === filters.confidenceLevel)
    }

    // 來源過濾
    if (filters.source !== 'ALL') {
      result = result.filter((f) => f.source === filters.source)
    }

    // 僅顯示已編輯
    if (filters.showEditedOnly) {
      result = result.filter((f) => f.isEdited)
    }

    // 排序
    result.sort((a, b) => {
      let comparison = 0
      switch (filters.sortBy) {
        case 'name':
          comparison = a.displayName.localeCompare(b.displayName, 'zh-TW')
          break
        case 'confidence':
          comparison = b.confidence - a.confidence
          break
        case 'category': {
          const catA = categories.find((c) => c.name === a.category)?.order ?? 99
          const catB = categories.find((c) => c.name === b.category)?.order ?? 99
          comparison = catA - catB
          // 同類別內按名稱排序
          if (comparison === 0) {
            comparison = a.displayName.localeCompare(b.displayName, 'zh-TW')
          }
          break
        }
      }
      return filters.sortOrder === 'asc' ? comparison : -comparison
    })

    return result
  }, [fields, filters, categories])

  // 按類別分組
  const groupedFields = React.useMemo((): FieldGroup[] => {
    if (filters.sortBy !== 'category') {
      return [{ category: null, fields: filteredFields }]
    }

    const groups = new Map<string, ExtractedField[]>()

    filteredFields.forEach((field) => {
      const catName = field.category ?? 'other'
      if (!groups.has(catName)) {
        groups.set(catName, [])
      }
      groups.get(catName)!.push(field)
    })

    return categories
      .filter((cat) => groups.has(cat.name))
      .map((cat) => ({
        category: cat,
        fields: groups.get(cat.name)!,
      }))
  }, [filteredFields, categories, filters.sortBy])

  // 統計資訊
  const stats = React.useMemo(() => {
    const editedCount = fields.filter((f) => f.isEdited).length
    const lowConfidenceCount = fields.filter((f) => f.confidenceLevel === 'LOW').length
    const avgConfidence =
      fields.length > 0
        ? Math.round(
            (fields.reduce((sum, f) => sum + f.confidence, 0) / fields.length) * 100
          )
        : 0

    return {
      total: fields.length,
      filtered: filteredFields.length,
      edited: editedCount,
      lowConfidence: lowConfidenceCount,
      avgConfidence,
    }
  }, [fields, filteredFields])

  // --- Render ---

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* 過濾器 */}
      {showFilters && <FieldFilters filters={filters} onChange={setFilters} />}

      {/* 統計資訊 */}
      {showStats && (
        <div className="flex items-center justify-between border-b bg-gray-50 px-4 py-2 text-sm text-gray-600">
          <div>
            顯示 {stats.filtered} / {stats.total} 個欄位
            {filters.showEditedOnly && (
              <span className="ml-2 text-orange-600">（僅顯示已修改）</span>
            )}
          </div>
          <div className="flex items-center gap-4">
            {stats.edited > 0 && (
              <span className="text-orange-600">{stats.edited} 個已修改</span>
            )}
            {stats.lowConfidence > 0 && (
              <span className="text-red-600">{stats.lowConfidence} 個低信心度</span>
            )}
            <span>平均信心度: {stats.avgConfidence}%</span>
          </div>
        </div>
      )}

      {/* 欄位列表 */}
      <div className="flex-1 overflow-auto p-4">
        {groupedFields.map(({ category, fields: groupFields }) => (
          <div key={category?.id ?? 'all'} className="mb-6 last:mb-0">
            {category && (
              <h3 className="mb-3 flex items-center font-semibold text-gray-900">
                <span>{category.displayName}</span>
                <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-xs font-normal text-gray-500">
                  {groupFields.length}
                </span>
              </h3>
            )}
            <div className="space-y-3">
              {groupFields.map((field) => (
                <FieldCard
                  key={field.id}
                  field={field}
                  isSelected={field.id === selectedFieldId}
                  onSelect={onFieldSelect}
                  onEdit={onFieldEdit}
                />
              ))}
            </div>
          </div>
        ))}

        {/* 空狀態 */}
        {filteredFields.length === 0 && (
          <div className="flex h-32 flex-col items-center justify-center text-gray-500">
            <p>沒有符合條件的欄位</p>
            {filters.search && (
              <button
                className="mt-2 text-sm text-blue-600 hover:underline"
                onClick={() => setFilters({ ...filters, search: '' })}
              >
                清除搜尋
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

ExtractedFieldsPanel.displayName = 'ExtractedFieldsPanel'
