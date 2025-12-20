/**
 * @fileoverview 審計查詢頁面
 * @description
 *   提供審計人員查詢處理記錄的介面：
 *   - 權限檢查（AUDITOR / GLOBAL_ADMIN）
 *   - 多條件篩選查詢
 *   - 分頁結果顯示
 *
 * @module src/app/(dashboard)/audit/query/page
 * @since Epic 8 - Story 8.3 (處理記錄查詢)
 * @lastModified 2025-12-20
 *
 * @features
 *   - AC5: 權限控制（AUDITOR/GLOBAL_ADMIN）
 *
 * @dependencies
 *   - @/lib/auth - 認證功能
 */

import { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AuditQueryClient } from './client'

// ============================================================
// Metadata
// ============================================================

export const metadata: Metadata = {
  title: '審計查詢 | AI 發票提取系統',
  description: '查詢指定期間的處理記錄，支援多條件篩選和分頁'
}

// ============================================================
// Page Component
// ============================================================

/**
 * 審計查詢頁面
 *
 * @description
 *   Server Component，負責權限檢查和頁面渲染。
 *   僅 AUDITOR 和 GLOBAL_ADMIN 角色可訪問。
 */
export default async function AuditQueryPage() {
  // 獲取認證會話
  const session = await auth()

  // 權限檢查
  const hasAuditAccess = session?.user?.roles?.some(r =>
    ['AUDITOR', 'GLOBAL_ADMIN'].includes(r.name)
  )

  if (!hasAuditAccess) {
    redirect('/dashboard')
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 頁面標題 */}
      <div>
        <h1 className="text-2xl font-bold">審計查詢</h1>
        <p className="text-muted-foreground">
          查詢指定期間的處理記錄，支援多條件篩選
        </p>
      </div>

      {/* 查詢界面 */}
      <AuditQueryClient />
    </div>
  )
}
