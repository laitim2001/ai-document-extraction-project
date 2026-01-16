/**
 * @fileoverview AI API 成本分析頁面
 * @description
 *   AI API 使用成本詳細分析頁面：
 *   - 成本趨勢圖表（日/週/月）
 *   - 各 Provider 成本分佈
 *   - 異常檢測與警示
 *   - 每日使用明細
 *
 * @module src/app/(dashboard)/reports/ai-cost
 * @since Epic 7 - Story 7.6 (AI API 使用成本顯示)
 * @lastModified 2025-12-19
 *
 * @features
 *   - AC1: 儀表板顯示當月 AI API 使用成本
 *   - AC2: 成本趨勢圖表（日/週/月）
 *   - AC3: 各 Provider 成本分佈
 *   - AC4: 成本異常警示
 *   - AC5: 詳細使用記錄查詢
 */

import { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { DashboardFilterProvider } from '@/contexts/DashboardFilterContext'
import { AiCostReportContent } from '@/components/reports/AiCostReportContent'
import { Skeleton } from '@/components/ui/skeleton'

// ============================================================
// Metadata
// ============================================================

export const metadata: Metadata = {
  title: 'AI API 成本分析 | AI 文件處理系統',
  description: 'AI API 使用量與成本追蹤分析'
}

// ============================================================
// Loading Skeleton
// ============================================================

function AiCostReportSkeleton() {
  return (
    <div className="space-y-6">
      {/* 摘要卡片骨架 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>

      {/* 圖表骨架 */}
      <Skeleton className="h-[400px]" />

      {/* 表格骨架 */}
      <Skeleton className="h-[300px]" />
    </div>
  )
}

// ============================================================
// Page Component
// ============================================================

/**
 * AI API 成本分析頁面
 */
export default async function AiCostReportPage() {
  const session = await auth()

  // 未登入
  if (!session?.user) {
    redirect('/login')
  }

  return (
    <DashboardFilterProvider syncUrl={true}>
      <div className="container mx-auto py-6 space-y-6">
        {/* 頁面標題 */}
        <div>
          <h1 className="text-2xl font-bold">AI API 成本分析</h1>
          <p className="text-muted-foreground">
            追蹤與分析 AI 服務的使用量與成本
          </p>
        </div>

        {/* 報表內容 */}
        <Suspense fallback={<AiCostReportSkeleton />}>
          <AiCostReportContent />
        </Suspense>
      </div>
    </DashboardFilterProvider>
  )
}
