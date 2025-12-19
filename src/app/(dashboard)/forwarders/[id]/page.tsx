/**
 * @fileoverview Forwarder 詳情頁面
 * @description
 *   Forwarder 詳情配置檢視頁面，顯示：
 *   - 基本資訊
 *   - 映射規則
 *   - 處理統計
 *   - 近期文件
 *
 *   使用動態路由 [id] 參數獲取特定 Forwarder 資料。
 *   需要使用者認證和 FORWARDER_VIEW 權限。
 *
 * @module src/app/(dashboard)/forwarders/[id]/page
 * @author Development Team
 * @since Epic 5 - Story 5.2 (Forwarder Detail Config View)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @/components/features/forwarders/ForwarderDetailView - 詳情組件
 *
 * @related
 *   - src/app/api/forwarders/[id]/route.ts - Detail API
 *   - src/components/features/forwarders/ForwarderDetailView.tsx - UI 組件
 */

import { ForwarderDetailView } from '@/components/features/forwarders/ForwarderDetailView'

// ============================================================
// Types
// ============================================================

interface PageProps {
  params: Promise<{
    id: string
  }>
}

// ============================================================
// Metadata
// ============================================================

export const metadata = {
  title: 'Forwarder 詳情',
  description: '查看 Forwarder 的詳細配置、規則和統計資料',
}

// ============================================================
// Page Component
// ============================================================

/**
 * Forwarder 詳情頁面
 *
 * @description
 *   動態路由頁面，根據 URL 中的 id 參數顯示對應 Forwarder 詳情
 *
 * @param props - 頁面屬性
 * @param props.params - 路由參數（包含 id）
 */
export default async function ForwarderDetailPage({ params }: PageProps) {
  const resolvedParams = await params
  const forwarderId = resolvedParams.id

  return (
    <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <ForwarderDetailView forwarderId={forwarderId} />
    </div>
  )
}
