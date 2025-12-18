'use client'

/**
 * @fileoverview 升級案例列表骨架屏組件
 * @description
 *   在升級案例列表載入時顯示的骨架屏：
 *   - 模擬表格結構
 *   - 提供視覺回饋
 *
 * @module src/components/features/escalation/EscalationListSkeleton
 * @since Epic 3 - Story 3.8 (Super User 處理升級案例)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @/components/ui/skeleton - shadcn Skeleton 組件
 */

import { Skeleton } from '@/components/ui/skeleton'

// ============================================================
// Component
// ============================================================

/**
 * 升級案例列表骨架屏
 *
 * @example
 * ```tsx
 * {isLoading ? <EscalationListSkeleton /> : <EscalationListTable items={data} />}
 * ```
 */
export function EscalationListSkeleton() {
  return (
    <div className="rounded-md border">
      {/* 表頭 */}
      <div className="border-b bg-muted/50 p-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-4 w-[200px]" />
          <Skeleton className="h-4 w-[100px]" />
          <Skeleton className="h-4 w-[120px]" />
          <Skeleton className="h-4 w-[80px]" />
          <Skeleton className="h-4 w-[100px]" />
          <Skeleton className="h-4 w-[100px]" />
          <Skeleton className="h-4 w-[60px] ml-auto" />
        </div>
      </div>

      {/* 表格行 */}
      <div className="divide-y">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="p-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-4 w-[200px]" />
              <Skeleton className="h-4 w-[100px]" />
              <Skeleton className="h-6 w-[120px] rounded-full" />
              <Skeleton className="h-6 w-[80px] rounded-full" />
              <Skeleton className="h-4 w-[100px]" />
              <Skeleton className="h-4 w-[100px]" />
              <Skeleton className="h-8 w-[60px] ml-auto" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
