/**
 * @fileoverview 認證錯誤頁面
 * @description
 *   顯示認證過程中發生的錯誤，提供用戶友好的錯誤訊息和操作指引。
 *
 *   錯誤類型：
 *   - Configuration: 系統配置錯誤
 *   - AccessDenied: 訪問被拒絕
 *   - Verification: 驗證失敗
 *   - AccountDisabled: 帳戶已停用 (Story 1.6)
 *   - AccountSuspended: 帳戶已暫停 (Story 1.6)
 *   - Default: 未知錯誤
 *
 * @module src/app/(auth)/auth/error/page
 * @author Development Team
 * @since Epic 1 - Story 1.1 (Azure AD SSO Login)
 * @lastModified 2026-01-18
 *
 * @features
 *   - 錯誤類型識別
 *   - 用戶友好訊息
 *   - 重試和聯繫支援選項
 *   - 帳戶狀態錯誤處理 (Story 1.6)
 *   - 完整 i18n 支援 (Epic 17)
 *
 * @related
 *   - src/lib/auth.ts - NextAuth 配置
 *   - src/app/(auth)/auth/login/page.tsx - 登入頁面
 */

import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

interface ErrorPageProps {
  searchParams: Promise<{
    error?: string
  }>
}

/**
 * 錯誤類型到 action URL 的映射
 */
const ERROR_ACTION_URLS: Record<string, string> = {
  Configuration: '/',
  AccessDenied: '/auth/login',
  AccountDisabled: '/',
  AccountSuspended: '/',
  Verification: '/auth/login',
  OAuthSignin: '/auth/login',
  OAuthCallback: '/auth/login',
  Default: '/auth/login',
}

/**
 * 需要顯示聯繫支援按鈕的錯誤類型
 */
const SHOW_CONTACT_SUPPORT = [
  'Configuration',
  'AccessDenied',
  'AccountDisabled',
  'AccountSuspended',
]

export default async function ErrorPage({ searchParams }: ErrorPageProps) {
  const { error } = await searchParams
  const errorType = error && error in ERROR_ACTION_URLS ? error : 'Default'
  const t = await getTranslations('auth.errorPage')

  const actionUrl = ERROR_ACTION_URLS[errorType]
  const showContactSupport = SHOW_CONTACT_SUPPORT.includes(errorType)

  return (
    <>
      {/* 錯誤圖示 */}
      <div className="text-center">
        <div className="mx-auto h-16 w-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
          <svg
            className="h-10 w-10 text-red-600 dark:text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t(`${errorType}.title`)}
        </h2>
      </div>

      {/* 錯誤說明卡片 */}
      <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow-lg sm:rounded-lg sm:px-10">
        <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
          {t(`${errorType}.description`)}
        </p>

        {/* 技術資訊（開發模式） */}
        {process.env.NODE_ENV === 'development' && error && (
          <div className="mb-6 p-3 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-300">
            <strong>{t('errorCodeLabel')}</strong> {error}
          </div>
        )}

        {/* 操作按鈕 */}
        <div className="space-y-3">
          <Link
            href={actionUrl}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            {t(`${errorType}.action`)}
          </Link>

          {showContactSupport && (
            <a
              href="mailto:it-support@company.com"
              className="w-full flex justify-center py-3 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              {t('contactSupport')}
            </a>
          )}
        </div>
      </div>

      {/* 頁腳提示 */}
      <p className="text-center text-xs text-gray-500 dark:text-gray-400">
        {t('persistentErrorHint')}
      </p>
    </>
  )
}
