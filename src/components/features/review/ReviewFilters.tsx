/**
 * @fileoverview 審核隊列篩選組件
 * @description
 *   提供審核列表的篩選功能：
 *   - Forwarder 下拉選單
 *   - 處理路徑下拉選單
 *   - 信心度範圍（數字輸入）
 *   - 清除篩選按鈕
 *
 * @module src/components/features/review/ReviewFilters
 * @since Epic 3 - Story 3.1
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @/components/ui/select - shadcn Select 組件
 *   - @/components/ui/input - shadcn Input 組件
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
import { Input } from '@/components/ui/input'
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
  const [minConfidence, setMinConfidence] = useState<string>(
    filters.minConfidence?.toString() || ''
  )
  const [maxConfidence, setMaxConfidence] = useState<string>(
    filters.maxConfidence?.toString() || ''
  )

  // 檢查是否有篩選條件
  const hasFilters =
    filters.forwarderId ||
    filters.processingPath ||
    filters.minConfidence !== undefined ||
    filters.maxConfidence !== undefined

  // 清除所有篩選
  const clearFilters = useCallback(() => {
    onFiltersChange({})
    setMinConfidence('')
    setMaxConfidence('')
  }, [onFiltersChange])

  // 處理 Forwarder 變更
  const handleForwarderChange = useCallback(
    (value: string) => {
      onFiltersChange({
        ...filters,
        forwarderId: value === 'all' ? undefined : value,
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

  // 處理信心度範圍變更（輸入完成後觸發）
  const handleConfidenceBlur = useCallback(() => {
    const min = minConfidence ? parseInt(minConfidence, 10) : undefined
    const max = maxConfidence ? parseInt(maxConfidence, 10) : undefined

    // 驗證範圍
    const validMin =
      min !== undefined ? Math.max(0, Math.min(100, min)) : undefined
    const validMax =
      max !== undefined ? Math.max(0, Math.min(100, max)) : undefined

    onFiltersChange({
      ...filters,
      minConfidence: validMin,
      maxConfidence: validMax,
    })
  }, [filters, minConfidence, maxConfidence, onFiltersChange])

  return (
    <div className="flex flex-wrap items-center gap-4 p-4 bg-muted/30 rounded-lg">
      {/* Forwarder 篩選 */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          Forwarder:
        </span>
        <Select
          value={filters.forwarderId || 'all'}
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

      {/* 信心度範圍篩選 */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          信心度:
        </span>
        <div className="flex items-center gap-1">
          <Input
            type="number"
            min={0}
            max={100}
            placeholder="0"
            value={minConfidence}
            onChange={(e) => setMinConfidence(e.target.value)}
            onBlur={handleConfidenceBlur}
            className="w-16 h-9"
          />
          <span className="text-muted-foreground">-</span>
          <Input
            type="number"
            min={0}
            max={100}
            placeholder="100"
            value={maxConfidence}
            onChange={(e) => setMaxConfidence(e.target.value)}
            onBlur={handleConfidenceBlur}
            className="w-16 h-9"
          />
          <span className="text-sm text-muted-foreground">%</span>
        </div>
      </div>

      {/* 清除篩選 */}
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X className="h-4 w-4 mr-1" />
          清除篩選
        </Button>
      )}
    </div>
  )
}
