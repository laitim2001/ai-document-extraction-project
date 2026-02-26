/**
 * @fileoverview 區域報表頁面
 * @description
 *   跨城市匯總報表頁面：
 *   - 僅區域經理和全局管理員可訪問
 *   - 顯示各城市處理對比
 *   - 支援城市詳情展開
 *
 * @module src/app/(dashboard)/reports/regional
 * @since Epic 7 - Story 7.5 (跨城市匯總報表)
 * @lastModified 2025-12-19
 *
 * @features
 *   - AC1: 區域報表頁面入口
 *   - AC5: 權限控制（非區域經理重導向）
 */

import { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { DashboardFilterProvider } from '@/contexts/DashboardFilterContext'
import { RegionalReportContent } from '@/components/reports/RegionalReportContent'
import { Skeleton } from '@/components/ui/skeleton'

// ============================================================
// Metadata
// ============================================================

export const metadata: Metadata = {
  title: '區域報表 | AI 文件處理系統',
  description: '跨城市匯總報表和對比分析'
}

// ============================================================
// Page Component
// ============================================================

/**
 * 區域報表頁面
 *
 * @description
 *   伺服器組件，負責：
 *   - 驗證用戶權限（僅區域經理和全局管理員）
 *   - 提供 DashboardFilterProvider
 *   - 渲染 RegionalReportContent
 */
export default async function RegionalReportPage() {
  const session = await auth()

  // 未登入
  if (!session?.user) {
    redirect('/auth/login')
  }

  // 權限檢查：必須是區域經理或全局管理員
  const isAuthorized =
    session.user.isRegionalManager === true ||
    session.user.isGlobalAdmin === true

  if (!isAuthorized) {
    redirect('/dashboard')
  }

  return (
    <DashboardFilterProvider syncUrl={true}>
      <div className="container mx-auto py-6 space-y-6">
        {/* 頁面標題 */}
        <div>
          <h1 className="text-2xl font-bold">區域報表</h1>
          <p className="text-muted-foreground">
            跨城市匯總報表和對比分析
          </p>
        </div>

        {/* 報表內容 */}
        <Suspense fallback={<RegionalReportSkeleton />}>
          <RegionalReportContent />
        </Suspense>
      </div>
    </DashboardFilterProvider>
  )
}

// ============================================================
// Loading Skeleton
// ============================================================

/**
 * 區域報表載入狀態骨架
 */
function RegionalReportSkeleton() {
  return (
    <div className="space-y-6">
      {/* 統計卡片骨架 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>

      {/* 表格骨架 */}
      <Skeleton className="h-[400px]" />
    </div>
  )
}
