'use client'

/**
 * @fileoverview 規則列表骨架屏組件
 * @description
 *   在規則列表載入時顯示的骨架屏，包含：
 *   - 摘要卡片骨架
 *   - 篩選區骨架
 *   - 表格骨架
 *
 * @module src/components/features/rules/RuleListSkeleton
 * @since Epic 4 - Story 4.1 (映射規則列表與查看)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @/components/ui/skeleton - shadcn Skeleton 組件
 *   - @/components/ui/card - shadcn Card 組件
 */

import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'

// ============================================================
// Component
// ============================================================

/**
 * 規則列表骨架屏
 *
 * @example
 * ```tsx
 * <Suspense fallback={<RuleListSkeleton />}>
 *   <RuleList />
 * </Suspense>
 * ```
 */
export function RuleListSkeleton() {
  return (
    <div className="space-y-6">
      {/* 摘要卡片骨架 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-6 w-12" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 篩選區骨架 */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-[180px]" />
        <Skeleton className="h-10 w-[180px]" />
        <Skeleton className="h-10 w-[140px]" />
        <Skeleton className="h-9 w-20 ml-auto" />
      </div>

      {/* 表格骨架 */}
      <div className="border rounded-lg overflow-hidden">
        {/* 表頭 */}
        <div className="bg-muted/50 p-4 flex gap-4">
          <Skeleton className="h-4 w-[160px]" />
          <Skeleton className="h-4 w-[200px]" />
          <Skeleton className="h-4 w-[130px]" />
          <Skeleton className="h-4 w-[100px]" />
          <Skeleton className="h-4 w-[80px]" />
          <Skeleton className="h-4 w-[90px]" />
          <Skeleton className="h-4 w-[100px]" />
          <Skeleton className="h-4 w-[140px]" />
        </div>

        {/* 表格行 */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="p-4 border-t flex gap-4 items-center">
            <div className="w-[160px] space-y-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
            <div className="w-[200px] space-y-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-7 w-[100px] rounded" />
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-4 w-8 mx-auto" />
            <Skeleton className="h-4 w-6" />
            <Skeleton className="h-4 w-14 ml-auto" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>

      {/* 分頁骨架 */}
      <div className="flex justify-center gap-2">
        <Skeleton className="h-10 w-10" />
        <Skeleton className="h-10 w-10" />
        <Skeleton className="h-10 w-10" />
        <Skeleton className="h-10 w-10" />
        <Skeleton className="h-10 w-10" />
      </div>
    </div>
  )
}
