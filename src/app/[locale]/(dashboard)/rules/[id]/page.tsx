'use client'

/**
 * @fileoverview 映射規則詳情頁面
 * @description
 *   映射規則詳情查看頁面，提供：
 *   - 規則完整資訊顯示
 *   - 提取模式詳情
 *   - 應用統計和趨勢
 *   - 最近應用記錄
 *   - 版本歷史和編輯入口
 *
 * @module src/app/(dashboard)/rules/[id]/page
 * @since Epic 4 - Story 4.1 (映射規則列表與查看)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - react - use() hook for async params
 *   - @/components/features/rules/RuleDetailView - 規則詳情視圖組件
 */

import { use } from 'react'
import { RuleDetailView, RuleDetailSkeleton } from '@/components/features/rules/RuleDetailView'
import { Suspense } from 'react'

// ============================================================
// Types
// ============================================================

interface PageProps {
  params: Promise<{ id: string }>
}

// ============================================================
// Page Component
// ============================================================

/**
 * 映射規則詳情頁面
 * 顯示規則完整資訊、提取模式和應用記錄
 */
export default function RuleDetailPage({ params }: PageProps) {
  const resolvedParams = use(params)
  const ruleId = resolvedParams.id

  return (
    <div className="container mx-auto py-6">
      <Suspense fallback={<RuleDetailSkeleton />}>
        <RuleDetailView ruleId={ruleId} />
      </Suspense>
    </div>
  )
}
