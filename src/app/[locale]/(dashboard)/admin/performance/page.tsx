/**
 * @fileoverview Performance Monitoring Page
 * @description
 *   系統效能監控頁面，顯示：
 *   - 效能概覽（API/DB/AI/System）
 *   - 時間序列圖表
 *   - 最慢端點分析
 *
 * @module src/app/(dashboard)/admin/performance/page
 * @since Epic 12 - Story 12-2
 * @lastModified 2025-12-21
 */

import { Suspense } from 'react';
import { Metadata } from 'next';
import { PerformanceDashboard } from '@/components/admin/performance';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Page metadata
 */
export const metadata: Metadata = {
  title: '效能監控 | 系統管理',
  description: '監控系統效能指標和資源使用情況',
};

/**
 * Loading skeleton for the dashboard
 */
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex justify-between items-center">
        <Skeleton className="h-8 w-32" />
        <div className="flex gap-3">
          <Skeleton className="h-10 w-[150px]" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>

      {/* Cards skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>

      {/* Charts skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>

      {/* Table skeleton */}
      <Skeleton className="h-96 w-full" />
    </div>
  );
}

/**
 * Performance monitoring page
 */
export default function PerformancePage() {
  return (
    <div className="container mx-auto py-6">
      <Suspense fallback={<DashboardSkeleton />}>
        <PerformanceDashboard />
      </Suspense>
    </div>
  );
}
