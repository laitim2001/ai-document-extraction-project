/**
 * @fileoverview Dashboard 佈局組件
 * @description
 *   儀表板區域的共用佈局，包含導航列、側邊欄和用戶資訊。
 *   此佈局僅適用於已認證用戶。
 *
 *   設計特點：
 *   - 頂部導航列顯示系統名稱和用戶資訊
 *   - 用戶頭像、名稱和角色顯示
 *   - 登出按鈕
 *
 * @module src/app/(dashboard)/layout
 * @author Development Team
 * @since Epic 1 - Story 1.1 (Azure AD SSO Login)
 * @lastModified 2025-12-18
 *
 * @features
 *   - 用戶 Session 資訊顯示
 *   - 響應式導航列
 *   - 登出功能
 *
 * @dependencies
 *   - next-auth - Session 獲取
 *
 * @related
 *   - src/lib/auth.ts - NextAuth 配置
 *   - src/app/(dashboard)/dashboard/page.tsx - 儀表板首頁
 */

import { redirect } from 'next/navigation'
import Image from 'next/image'
import { auth, signOut } from '@/lib/auth'

/**
 * 角色顯示名稱映射
 */
const ROLE_DISPLAY_NAMES: Record<string, string> = {
  'System Admin': '系統管理員',
  'Super User': '超級用戶',
  'Data Processor': '資料處理員',
  'City Manager': '城市經理',
  'Regional Manager': '區域經理',
  Auditor: '審計員',
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  // 未認證用戶重定向至登入頁面
  if (!session) {
    redirect('/auth/login')
  }

  // 取得用戶的主要角色（第一個角色）
  const primaryRole = session.user?.roles?.[0]?.name ?? 'Data Processor'
  const roleDisplayName = ROLE_DISPLAY_NAMES[primaryRole] ?? primaryRole

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* 頂部導航列 */}
      <nav className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* 左側：Logo 和系統名稱 */}
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <svg
                    className="h-5 w-5 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <span className="ml-2 text-xl font-semibold text-gray-900 dark:text-white">
                  AI Document Extraction
                </span>
              </div>
            </div>

            {/* 右側：用戶資訊和登出 */}
            <div className="flex items-center space-x-4">
              {/* 用戶資訊 */}
              <div className="flex items-center space-x-3">
                {/* 用戶頭像 */}
                {session.user?.image ? (
                  <Image
                    src={session.user.image}
                    alt={session.user.name ?? '用戶頭像'}
                    width={32}
                    height={32}
                    className="h-8 w-8 rounded-full"
                    unoptimized
                  />
                ) : (
                  <div className="h-8 w-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                      {session.user?.name?.charAt(0).toUpperCase() ?? 'U'}
                    </span>
                  </div>
                )}

                {/* 用戶名稱和角色 */}
                <div className="hidden md:block">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {session.user?.name ?? session.user?.email}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {roleDisplayName}
                  </p>
                </div>
              </div>

              {/* 登出按鈕 */}
              <form
                action={async () => {
                  'use server'
                  await signOut({ redirectTo: '/auth/login' })
                }}
              >
                <button
                  type="submit"
                  className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  <svg
                    className="h-4 w-4 mr-1.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                  登出
                </button>
              </form>
            </div>
          </div>
        </div>
      </nav>

      {/* 主要內容區域 */}
      <main className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  )
}
