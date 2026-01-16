/**
 * @fileoverview 系統健康監控頁面
 * @description
 *   系統管理員的健康監控介面。
 *   提供系統各服務的健康狀態查看和手動健康檢查觸發功能。
 *
 *   功能特點：
 *   - 系統整體健康狀態顯示
 *   - 各服務狀態卡片網格
 *   - 24 小時可用性統計
 *   - 服務詳情和歷史圖表
 *   - 手動健康檢查觸發
 *
 *   權限要求：
 *   - SYSTEM_MONITOR 權限
 *   - 或者 ADMIN、SUPER_USER、GLOBAL_ADMIN 角色
 *
 * @module src/app/(dashboard)/admin/monitoring/health/page
 * @author Development Team
 * @since Epic 12 - Story 12.1 (System Health Monitoring Dashboard)
 * @lastModified 2025-12-21
 *
 * @features
 *   - 伺服器端權限檢查
 *   - Suspense 骨架屏載入
 *   - 即時健康狀態更新（30 秒輪詢）
 *
 * @dependencies
 *   - @/lib/auth - 認證和權限檢查
 *   - @/components/features/admin/monitoring - 監控組件
 *
 * @related
 *   - src/app/api/admin/health/route.ts - 健康狀態 API
 *   - src/services/health-check.service.ts - 健康檢查服務
 */

import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/auth/city-permission';
import { PERMISSIONS } from '@/types/permissions';
import { HealthDashboard } from '@/components/features/admin/monitoring';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardContent } from '@/components/ui/card';

export const metadata = {
  title: '系統健康監控 | AI Document Extraction',
  description: '監控系統各服務的健康狀態',
};

/**
 * 健康監控頁面骨架屏
 */
function HealthDashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* 頂部狀態欄骨架 */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Skeleton className="w-4 h-4 rounded-full" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="flex items-center gap-4">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>

      {/* 服務卡片骨架 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <Skeleton className="w-6 h-6 rounded" />
                <Skeleton className="h-5 w-24" />
              </div>
              <Skeleton className="h-6 w-16" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-40" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/**
 * 系統健康監控頁面
 *
 * @description
 *   提供系統管理員監控各服務健康狀態的介面。
 *   需要 SYSTEM_MONITOR 權限或管理員角色才能存取。
 *
 *   頁面流程：
 *   1. 伺服器端驗證認證狀態
 *   2. 檢查 SYSTEM_MONITOR 權限或管理員角色
 *   3. 渲染健康監控儀表板（帶 Suspense）
 */
export default async function HealthMonitoringPage() {
  // 驗證認證狀態
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/login');
  }

  // 檢查 SYSTEM_MONITOR 權限或管理員角色（支援 '*' 通配符）
  const hasMonitorPermission = hasPermission(session.user, PERMISSIONS.SYSTEM_MONITOR) ||
    session.user.roles?.some((role) =>
      ['GLOBAL_ADMIN', 'ADMIN', 'SUPER_USER'].includes(role.name)
    );

  // Global Admin 也可以存取
  const isGlobalAdmin = session.user.isGlobalAdmin;

  if (!hasMonitorPermission && !isGlobalAdmin) {
    redirect('/dashboard?error=access_denied');
  }

  return (
    <div className="space-y-6">
      {/* 頁面標題 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          系統健康監控
        </h1>
        <p className="text-muted-foreground">
          監控系統各服務的健康狀態和效能指標
        </p>
      </div>

      {/* 健康監控儀表板 */}
      <Suspense fallback={<HealthDashboardSkeleton />}>
        <HealthDashboard />
      </Suspense>
    </div>
  );
}
