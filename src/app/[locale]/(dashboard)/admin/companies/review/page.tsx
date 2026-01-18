/**
 * @fileoverview 待審核公司列表頁面
 * @description
 *   提供待審核公司的管理介面：
 *   - 顯示待分類的公司列表
 *   - 公司類型分類功能
 *   - 公司合併功能
 *   - 可能重複項提示
 *
 * @module src/app/(dashboard)/admin/companies/review/page
 * @since Epic 0 - Story 0.3
 * @lastModified 2025-12-23
 *
 * @features
 *   - 分頁列表展示
 *   - 類型快速分類
 *   - 批量選擇合併
 *   - 重複項提示
 *
 * @dependencies
 *   - @/hooks/use-pending-companies - 數據獲取
 *   - @/components/features/companies - UI 組件
 *
 * @related
 *   - src/app/api/admin/companies/pending/route.ts - API 端點
 */

import { Suspense } from 'react'
import { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { hasPermission } from '@/lib/auth/city-permission'
import { PERMISSIONS } from '@/types/permissions'
import { redirect } from 'next/navigation'
import { CompanyReviewContent } from './company-review-content'
import { Skeleton } from '@/components/ui/skeleton'

// ============================================================
// Metadata
// ============================================================

export const metadata: Metadata = {
  title: '待審核公司 | Admin',
  description: '管理和分類待審核的公司',
}

// ============================================================
// Loading Component
// ============================================================

function CompanyReviewSkeleton() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <div className="border-b p-4">
          <div className="flex gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-24" />
            ))}
          </div>
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border-b p-4 last:border-b-0">
            <div className="flex items-center gap-4">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-24" />
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-10 w-10" />
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Page Component
// ============================================================

export default async function CompanyReviewPage() {
  // 驗證認證和權限
  const session = await auth()

  if (!session?.user) {
    redirect('/auth/login')
  }

  const hasViewPerm = hasPermission(session.user, PERMISSIONS.FORWARDER_VIEW)
  if (!hasViewPerm) {
    redirect('/unauthorized')
  }

  const hasManagePerm = hasPermission(session.user, PERMISSIONS.FORWARDER_MANAGE)

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Suspense fallback={<CompanyReviewSkeleton />}>
        <CompanyReviewContent canManage={hasManagePerm} />
      </Suspense>
    </div>
  )
}
