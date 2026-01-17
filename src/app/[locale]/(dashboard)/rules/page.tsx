'use client'

/**
 * @fileoverview 映射規則列表頁面
 * @description
 *   映射規則管理頁面，採用與公司列表和發票列表一致的樣式。
 *   提供：
 *   - 規則列表顯示（支援多維度篩選）
 *   - 狀態統計摘要卡片
 *   - 分頁功能
 *   - 點擊進入詳情查看
 *
 * @module src/app/(dashboard)/rules/page
 * @since Epic 4 - Story 4.1 (映射規則列表與查看)
 * @lastModified 2026-01-17
 *
 * @dependencies
 *   - @/components/features/rules/RuleList - 規則列表組件
 */

import { Suspense } from 'react'
import { useTranslations } from 'next-intl'
import { RuleList } from '@/components/features/rules/RuleList'
import { RuleListSkeleton } from '@/components/features/rules/RuleListSkeleton'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'

// ============================================================
// Page Component
// ============================================================

/**
 * 映射規則列表頁面
 * 顯示所有映射規則，支援篩選、排序和分頁
 */
export default function RulesPage() {
  const t = useTranslations('rules')

  return (
    <div className="space-y-6 p-6">
      {/* 頁面標題 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('page.title')}</h1>
          <p className="text-gray-500">
            {t('page.description')}
          </p>
        </div>
        <Button asChild>
          <Link href="/rules/new">
            <Plus className="h-4 w-4 mr-2" />
            {t('page.addRule')}
          </Link>
        </Button>
      </div>

      {/* 規則列表（使用 Suspense 包裝） */}
      <Suspense fallback={<RuleListSkeleton />}>
        <RuleList />
      </Suspense>
    </div>
  )
}
