/**
 * @fileoverview 欄位過濾器組件
 * @description
 *   提供欄位列表的過濾和排序功能：
 *   - 關鍵字搜尋
 *   - 信心度過濾 (全部/高/中/低)
 *   - 來源過濾 (Azure DI/GPT Vision/手動/映射)
 *   - 排序 (名稱/信心度/類別)
 *   - 僅顯示已修改
 *
 * @module src/components/features/document-preview
 * @since Epic 13 - Story 13.2 (欄位提取結果面板)
 * @lastModified 2026-01-02
 */

'use client'

import * as React from 'react'
import { Search, ArrowUp, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { FieldFilterState } from '@/types/extracted-field'

// ============================================================
// Types
// ============================================================

export interface FieldFiltersProps {
  /** 當前過濾狀態 */
  filters: FieldFilterState
  /** 過濾狀態變更回調 */
  onChange: (filters: FieldFilterState) => void
  /** 自定義 CSS 類名 */
  className?: string
}

// ============================================================
// Component
// ============================================================

/**
 * @component FieldFilters
 * @description 欄位過濾器組件
 */
export function FieldFilters({
  filters,
  onChange,
  className,
}: FieldFiltersProps) {
  // --- Handlers ---

  const updateFilter = <K extends keyof FieldFilterState>(
    key: K,
    value: FieldFilterState[K]
  ) => {
    onChange({ ...filters, [key]: value })
  }

  const toggleSortOrder = () => {
    updateFilter('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc')
  }

  // --- Render ---

  return (
    <div className={cn('border-b bg-white p-4', className)}>
      {/* 搜尋框 */}
      <div className="mb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="搜尋欄位名稱或值..."
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* 過濾選項 */}
      <div className="flex flex-wrap items-center gap-3">
        {/* 信心度過濾 */}
        <Select
          value={filters.confidenceLevel}
          onValueChange={(v) =>
            updateFilter(
              'confidenceLevel',
              v as FieldFilterState['confidenceLevel']
            )
          }
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="信心度" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">全部信心度</SelectItem>
            <SelectItem value="HIGH">高 (≥90%)</SelectItem>
            <SelectItem value="MEDIUM">中 (70-89%)</SelectItem>
            <SelectItem value="LOW">低 (&lt;70%)</SelectItem>
          </SelectContent>
        </Select>

        {/* 來源過濾 */}
        <Select
          value={filters.source}
          onValueChange={(v) =>
            updateFilter('source', v as FieldFilterState['source'])
          }
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="來源" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">全部來源</SelectItem>
            <SelectItem value="AZURE_DI">Azure DI</SelectItem>
            <SelectItem value="GPT_VISION">GPT Vision</SelectItem>
            <SelectItem value="MANUAL">手動輸入</SelectItem>
            <SelectItem value="MAPPING">映射規則</SelectItem>
          </SelectContent>
        </Select>

        {/* 排序 */}
        <Select
          value={filters.sortBy}
          onValueChange={(v) =>
            updateFilter('sortBy', v as FieldFilterState['sortBy'])
          }
        >
          <SelectTrigger className="w-28">
            <SelectValue placeholder="排序" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="category">類別</SelectItem>
            <SelectItem value="name">名稱</SelectItem>
            <SelectItem value="confidence">信心度</SelectItem>
          </SelectContent>
        </Select>

        {/* 排序方向 */}
        <Button
          variant="outline"
          size="icon"
          onClick={toggleSortOrder}
          title={filters.sortOrder === 'asc' ? '升序' : '降序'}
        >
          {filters.sortOrder === 'asc' ? (
            <ArrowUp className="h-4 w-4" />
          ) : (
            <ArrowDown className="h-4 w-4" />
          )}
        </Button>

        {/* 僅顯示已修改 */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="showEditedOnly"
            checked={filters.showEditedOnly}
            onCheckedChange={(checked) =>
              updateFilter('showEditedOnly', checked === true)
            }
          />
          <label
            htmlFor="showEditedOnly"
            className="cursor-pointer text-sm text-gray-700"
          >
            僅顯示已修改
          </label>
        </div>
      </div>
    </div>
  )
}

FieldFilters.displayName = 'FieldFilters'
