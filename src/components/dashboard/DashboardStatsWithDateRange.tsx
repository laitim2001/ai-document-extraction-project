'use client';

/**
 * @fileoverview 帶有日期範圍的儀表板統計包裝組件
 * @description
 *   包裝 DashboardStats 組件，提供：
 *   - DateRangeProvider 上下文
 *   - URL 參數同步
 *   - Suspense boundary 處理
 *
 * @module src/components/dashboard/DashboardStatsWithDateRange
 * @since Epic 7 - Story 7.2 (時間範圍篩選器)
 *
 * @dependencies
 *   - @/contexts/DateRangeContext - 日期範圍 Context
 *   - @/components/dashboard/DashboardStats - 儀表板統計組件
 */

import * as React from 'react';
import { DateRangeProvider } from '@/contexts/DateRangeContext';
import { DashboardStats } from './DashboardStats';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * 載入中骨架屏
 */
function DashboardStatsSkeleton() {
  return (
    <div className="space-y-4">
      {/* 日期範圍篩選器骨架 */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-10 w-[280px]" />
          <div className="flex gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-16" />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-8" />
        </div>
      </div>
      {/* 標題骨架 */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-4 w-16" />
      </div>
      {/* 卡片骨架 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    </div>
  );
}

/**
 * 內部組件（需要 Suspense 邊界來處理 useSearchParams）
 */
function DashboardStatsContent() {
  return (
    <DateRangeProvider syncUrl>
      <DashboardStats />
    </DateRangeProvider>
  );
}

/**
 * 帶有日期範圍的儀表板統計組件
 *
 * @description
 *   此組件包裹 DashboardStats，提供：
 *   - DateRangeProvider 用於全域日期範圍管理
 *   - URL 同步功能（書籤/分享）
 *   - Suspense 邊界處理 useSearchParams
 */
export function DashboardStatsWithDateRange() {
  return (
    <React.Suspense fallback={<DashboardStatsSkeleton />}>
      <DashboardStatsContent />
    </React.Suspense>
  );
}
