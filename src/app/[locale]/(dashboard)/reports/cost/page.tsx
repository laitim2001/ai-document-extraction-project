/**
 * @fileoverview 城市成本報表頁面
 * @description
 *   城市級別成本報表頁面：
 *   - 各城市成本明細（AI + 人工）
 *   - 成本趨勢指標
 *   - 異常警示與分析
 *   - 篩選與排序功能
 *
 * @module src/app/(dashboard)/reports/cost
 * @since Epic 7 - Story 7.9 (城市成本報表)
 * @lastModified 2025-12-19
 *
 * @features
 *   - AC1: 成本報表頁面入口
 *   - AC2: 成本明細內容
 *   - AC3: 成本趨勢分析
 *   - AC4: 異常警示
 *   - AC5: 權限控制
 */

import { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { DashboardFilterProvider } from '@/contexts/DashboardFilterContext'
import { CityCostReportContent } from '@/components/reports/CityCostReportContent'
import { Skeleton } from '@/components/ui/skeleton'

// ============================================================
// Metadata
// ============================================================

export const metadata: Metadata = {
  title: '城市成本報表 | AI 文件處理系統',
  description: '城市級別成本追蹤與分析報表',
}

// ============================================================
// Loading Skeleton
// ============================================================

function CityCostReportSkeleton() {
  return (
    <div className="space-y-6">
      {/* 摘要卡片骨架 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>

      {/* 表格骨架 */}
      <Skeleton className="h-[500px]" />
    </div>
  )
}

// ============================================================
// Page Component
// ============================================================

/**
 * 城市成本報表頁面
 */
export default async function CityCostReportPage() {
  const session = await auth()

  // 未登入
  if (!session?.user) {
    redirect('/auth/login')
  }

  return (
    <DashboardFilterProvider syncUrl={true}>
      <div className="container mx-auto py-6 space-y-6">
        {/* 頁面標題 */}
        <div>
          <h1 className="text-2xl font-bold">城市成本報表</h1>
          <p className="text-muted-foreground">
            查看各城市的成本明細、趨勢分析與異常警示
          </p>
        </div>

        {/* 報表內容 */}
        <Suspense fallback={<CityCostReportSkeleton />}>
          <CityCostReportContent />
        </Suspense>
      </div>
    </DashboardFilterProvider>
  )
}
