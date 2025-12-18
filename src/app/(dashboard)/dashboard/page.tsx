/**
 * @fileoverview Dashboard 首頁
 * @description
 *   已登入用戶的主要儀表板頁面，顯示系統概覽和快速操作入口。
 *   此為佔位頁面，後續 Epic 將擴展完整功能。
 *
 * @module src/app/(dashboard)/dashboard/page
 * @author Development Team
 * @since Epic 1 - Story 1.1 (Azure AD SSO Login)
 * @lastModified 2025-12-18
 *
 * @features
 *   - Session 資訊顯示
 *   - 系統功能概覽
 *   - 快速操作入口（佔位）
 *
 * @related
 *   - src/app/(dashboard)/layout.tsx - Dashboard 佈局
 *   - src/lib/auth.ts - NextAuth 配置
 */

import { auth } from '@/lib/auth'

/**
 * 功能卡片配置
 */
interface FeatureCard {
  title: string
  description: string
  icon: React.ReactNode
  status: 'available' | 'coming-soon'
  href?: string
}

const FEATURE_CARDS: FeatureCard[] = [
  {
    title: '文件上傳',
    description: '上傳 Freight Invoice 進行自動化處理',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
    status: 'coming-soon',
  },
  {
    title: '映射管理',
    description: '管理術語映射規則和分類配置',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    ),
    status: 'coming-soon',
  },
  {
    title: '審核工作台',
    description: '審核和修正 AI 分類結果',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    status: 'coming-soon',
  },
  {
    title: '數據分析',
    description: '查看處理統計和效能指標',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    status: 'coming-soon',
  },
]

export default async function DashboardPage() {
  const session = await auth()

  return (
    <div className="space-y-6">
      {/* 歡迎區塊 */}
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          歡迎回來，{session?.user?.name ?? '用戶'}
        </h1>
        <p className="mt-1 text-gray-600 dark:text-gray-400">
          AI 文件提取與分類系統 - 智能處理 Freight Invoice
        </p>
      </div>

      {/* 統計概覽（佔位） */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: '今日處理', value: '0', change: '待啟用' },
          { label: '待審核', value: '0', change: '待啟用' },
          { label: '本週準確率', value: '-', change: '待啟用' },
          { label: '自動化率', value: '-', change: '待啟用' },
        ].map((stat, index) => (
          <div
            key={index}
            className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-4"
          >
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {stat.label}
            </p>
            <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
              {stat.value}
            </p>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              {stat.change}
            </p>
          </div>
        ))}
      </div>

      {/* 功能入口 */}
      <div>
        <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          系統功能
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURE_CARDS.map((feature, index) => (
            <div
              key={index}
              className={`bg-white dark:bg-gray-800 shadow-sm rounded-lg p-4 border-2 ${
                feature.status === 'available'
                  ? 'border-blue-500 cursor-pointer hover:shadow-md transition-shadow'
                  : 'border-transparent opacity-60'
              }`}
            >
              <div className={`inline-flex p-2 rounded-lg ${
                feature.status === 'available'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
              }`}>
                {feature.icon}
              </div>
              <h3 className="mt-3 text-sm font-medium text-gray-900 dark:text-white">
                {feature.title}
              </h3>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {feature.description}
              </p>
              {feature.status === 'coming-soon' && (
                <span className="mt-2 inline-block px-2 py-0.5 text-xs font-medium text-yellow-800 dark:text-yellow-200 bg-yellow-100 dark:bg-yellow-900/30 rounded">
                  即將推出
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Session 調試資訊（僅開發環境） */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Session 資訊 (開發模式)
          </h3>
          <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-auto">
            {JSON.stringify(session, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
