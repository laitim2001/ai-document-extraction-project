/**
 * @fileoverview Alert Configuration Page
 * @description
 *   系統警報設定頁面，提供：
 *   - 警報規則管理（創建、編輯、刪除、啟用/停用）
 *   - 警報歷史記錄查看
 *   - 警報確認與解決操作
 *
 * @module src/app/(dashboard)/admin/alerts/page
 * @since Epic 12 - Story 12-3 (錯誤警報設定)
 * @lastModified 2025-12-21
 */

import { Suspense } from 'react';
import { Metadata } from 'next';
import { AlertDashboard } from '@/components/features/admin/alerts/AlertDashboard';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Page metadata
 */
export const metadata: Metadata = {
  title: '警報設定 | 系統管理',
  description: '設定系統警報規則和查看警報歷史',
};

/**
 * Loading skeleton for the alert dashboard
 */
function AlertDashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex justify-between items-center">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-10 w-28" />
      </div>

      {/* Statistics cards skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>

      {/* Tabs skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />

        {/* Toolbar skeleton */}
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            <Skeleton className="h-10 w-[200px]" />
            <Skeleton className="h-10 w-[120px]" />
            <Skeleton className="h-10 w-[120px]" />
          </div>
          <Skeleton className="h-10 w-10" />
        </div>

        {/* Table skeleton */}
        <Skeleton className="h-96 w-full" />
      </div>
    </div>
  );
}

/**
 * Alert configuration page
 */
export default function AlertsPage() {
  return (
    <div className="container mx-auto py-6">
      <Suspense fallback={<AlertDashboardSkeleton />}>
        <AlertDashboard />
      </Suspense>
    </div>
  );
}
