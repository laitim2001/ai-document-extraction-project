/**
 * @fileoverview Dashboard 佈局組件
 * @description
 *   儀表板區域的共用佈局，包含側邊欄導航、頂部工具列和主要內容區域。
 *   此佈局僅適用於已認證用戶。
 *
 *   設計特點：
 *   - 固定側邊欄導航（桌面端 288px）
 *   - 響應式移動端 overlay 側邊欄
 *   - 頂部工具列（搜尋、通知、主題切換、用戶選單）
 *   - 主要內容區域最大寬度 1600px
 *
 * @module src/app/(dashboard)/layout
 * @author Development Team
 * @since Epic 1 - Story 1.1 (Azure AD SSO Login)
 * @lastModified 2025-12-21
 *
 * @features
 *   - 用戶 Session 驗證
 *   - 側邊欄導航（分類選單）
 *   - 頂部工具列
 *   - 響應式設計
 *   - 主題切換支援
 *
 * @dependencies
 *   - next-auth - Session 獲取
 *   - @/components/layout/DashboardLayout - 儀表板佈局組件
 *
 * @related
 *   - src/lib/auth.ts - NextAuth 配置
 *   - src/components/layout/DashboardLayout.tsx - 佈局容器
 *   - src/components/layout/Sidebar.tsx - 側邊欄組件
 *   - src/components/layout/TopBar.tsx - 頂部工具列
 *
 * @change CHANGE-001 - Dashboard Layout Redesign (2025-12-21)
 */

import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { DashboardLayout } from '@/components/layout/DashboardLayout'

export default async function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  // 未認證用戶重定向至登入頁面
  if (!session) {
    redirect('/auth/login')
  }

  return <DashboardLayout>{children}</DashboardLayout>
}
