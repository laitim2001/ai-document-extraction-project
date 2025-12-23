/**
 * @fileoverview 審核隊列篩選組件
 * @description
 *   提供審核列表的篩選功能：
 *   - Forwarder 下拉選單
 *   - 處理路徑下拉選單
 *   - 信心度範圍（雙滑桿 Slider）
 *   - 清除篩選按鈕
 *
 * @module src/components/features/review/ReviewFilters
 * @since Epic 3 - Story 3.1
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @/components/ui/select - shadcn Select 組件
 *   - @/components/ui/slider - shadcn Slider 組件
 *   - @/components/ui/button - shadcn Button 組件
 *   - @prisma/client - ProcessingPath 枚舉
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import type { ReviewQueueFilters as Filters } from '@/types/review'
import { ProcessingPath } from '@prisma/client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

// ============================================================
// Types
// ============================================================

interface ReviewFiltersProps {
  /** 當前篩選條件 */
  filters: Filters
  /** 篩選條件變更回調 */
  onFiltersChange: (filters: Filters) => void
}

interface ForwarderOption {
  id: string
  name: string
}

// ============================================================
// Constants
// ============================================================

/** 信心度範圍預設值 */
const DEFAULT_CONFIDENCE_RANGE: [number, number] = [0, 100]

// ============================================================
// Hooks
// ============================================================

/**
 * 獲取 Forwarder 列表 Hook
 */
function useForwarders() {
  const [forwarders, setForwarders] = useState<ForwarderOption[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/forwarders?active=true')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setForwarders(data.data)
        }
      })
      .catch((error) => {
        console.error('Failed to fetch forwarders:', error)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  return { forwarders, isLoading }
}

// ============================================================
// Component
// ============================================================

/**
 * 審核篩選組件
 * 提供 Forwarder、處理路徑、信心度範圍的篩選功能
 *
 * @example
 * ```tsx
 * <ReviewFilters
 *   filters={filters}
 *   onFiltersChange={handleFiltersChange}
 * />
 * ```
 */
export function ReviewFilters({ filters, onFiltersChange }: ReviewFiltersProps) {
  const { forwarders, isLoading: forwardersLoading } = useForwarders()

  // 計算當前信心度範圍值
  const confidenceRange: [number, number] = [
    filters.minConfidence ?? DEFAULT_CONFIDENCE_RANGE[0],
    filters.maxConfidence ?? DEFAULT_CONFIDENCE_RANGE[1],
  ]

  // 檢查是否有篩選條件
  const hasFilters =
    filters.companyId ||
    filters.processingPath ||
    filters.minConfidence !== undefined ||
    filters.maxConfidence !== undefined

  // 檢查信心度是否與預設不同
  const hasConfidenceFilter =
    confidenceRange[0] !== DEFAULT_CONFIDENCE_RANGE[0] ||
    confidenceRange[1] !== DEFAULT_CONFIDENCE_RANGE[1]

  // 清除所有篩選
  const clearFilters = useCallback(() => {
    onFiltersChange({})
  }, [onFiltersChange])

  // 處理 Forwarder 變更
  const handleForwarderChange = useCallback(
    (value: string) => {
      onFiltersChange({
        ...filters,
        companyId: value === 'all' ? undefined : value,
      })
    },
    [filters, onFiltersChange]
  )

  // 處理處理路徑變更
  const handleProcessingPathChange = useCallback(
    (value: string) => {
      onFiltersChange({
        ...filters,
        processingPath: value === 'all' ? undefined : (value as ProcessingPath),
      })
    },
    [filters, onFiltersChange]
  )

  // 處理信心度範圍變更
  const handleConfidenceChange = useCallback(
    (values: number[]) => {
      if (values.length >= 2) {
        const [min, max] = values
        onFiltersChange({
          ...filters,
          minConfidence:
            min === DEFAULT_CONFIDENCE_RANGE[0] ? undefined : min,
          maxConfidence:
            max === DEFAULT_CONFIDENCE_RANGE[1] ? undefined : max,
        })
      }
    },
    [filters, onFiltersChange]
  )

  return (
    <div className="flex flex-wrap items-center gap-4 p-4 bg-muted/30 rounded-lg">
      {/* Forwarder 篩選 */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          Forwarder:
        </span>
        <Select
          value={filters.companyId || 'all'}
          onValueChange={handleForwarderChange}
          disabled={forwardersLoading}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="全部" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            {forwarders.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 處理路徑篩選 */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          處理路徑:
        </span>
        <Select
          value={filters.processingPath || 'all'}
          onValueChange={handleProcessingPathChange}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="全部" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value={ProcessingPath.QUICK_REVIEW}>快速審核</SelectItem>
            <SelectItem value={ProcessingPath.FULL_REVIEW}>完整審核</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 信心度範圍篩選 - 雙滑桿 Slider */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          信心度:
        </span>
        <div className="flex items-center gap-3 min-w-[200px]">
          <span className="text-sm font-medium w-8 text-right">
            {confidenceRange[0]}%
          </span>
          <Slider
            value={confidenceRange}
            onValueChange={handleConfidenceChange}
            min={0}
            max={100}
            step={5}
            className="w-[120px]"
          />
          <span className="text-sm font-medium w-8">
            {confidenceRange[1]}%
          </span>
        </div>
        {hasConfidenceFilter && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() =>
              onFiltersChange({
                ...filters,
                minConfidence: undefined,
                maxConfidence: undefined,
              })
            }
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* 清除所有篩選 */}
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X className="h-4 w-4 mr-1" />
          清除篩選
        </Button>
      )}
    </div>
  )
}
