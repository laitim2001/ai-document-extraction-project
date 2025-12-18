/**
 * @fileoverview Azure AD SSO 登入頁面
 * @description
 *   提供企業 SSO 登入入口，使用 Microsoft Entra ID (Azure AD) 進行認證。
 *
 *   功能特點：
 *   - Microsoft 企業帳號登入按鈕
 *   - 自動重定向已登入用戶
 *   - 保留原始請求路徑（callbackUrl）
 *
 * @module src/app/(auth)/auth/login/page
 * @author Development Team
 * @since Epic 1 - Story 1.1 (Azure AD SSO Login)
 * @lastModified 2025-12-18
 *
 * @features
 *   - Azure AD SSO 登入
 *   - 回調 URL 支援
 *   - 錯誤訊息顯示
 *   - 響應式設計
 *
 * @related
 *   - src/lib/auth.ts - NextAuth 配置
 *   - src/app/(auth)/auth/error/page.tsx - 錯誤頁面
 */

import { redirect } from 'next/navigation'
import { auth, signIn } from '@/lib/auth'

interface LoginPageProps {
  searchParams: Promise<{
    callbackUrl?: string
    error?: string
  }>
}

/**
 * 錯誤訊息映射
 */
const ERROR_MESSAGES: Record<string, string> = {
  OAuthSignin: '無法啟動登入流程，請稍後再試。',
  OAuthCallback: '登入回調失敗，請稍後再試。',
  OAuthCreateAccount: '無法建立帳戶，請聯繫管理員。',
  Callback: '登入回調發生錯誤。',
  AccessDenied: '您的帳戶已被停用或無權限訪問此系統。',
  Configuration: '系統配置錯誤，請聯繫管理員。',
  Default: '發生未知錯誤，請稍後再試。',
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth()
  const { callbackUrl, error } = await searchParams

  // 已登入用戶重定向至儀表板或回調 URL
  if (session) {
    redirect(callbackUrl ?? '/dashboard')
  }

  const errorMessage = error ? ERROR_MESSAGES[error] ?? ERROR_MESSAGES.Default : null

  return (
    <>
      {/* Logo 和標題 */}
      <div className="text-center">
        <div className="mx-auto h-16 w-16 bg-blue-600 rounded-xl flex items-center justify-center mb-4">
          <svg
            className="h-10 w-10 text-white"
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
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
          AI Document Extraction
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          智能文件提取與分類系統
        </p>
      </div>

      {/* 錯誤訊息 */}
      {errorMessage && (
        <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                {errorMessage}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 登入表單 */}
      <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow-lg sm:rounded-lg sm:px-10">
        <form
          action={async () => {
            'use server'
            await signIn('microsoft-entra-id', {
              redirectTo: callbackUrl ?? '/dashboard',
            })
          }}
        >
          <button
            type="submit"
            className="w-full flex justify-center items-center gap-3 py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            <svg className="h-5 w-5" viewBox="0 0 21 21" fill="currentColor">
              <rect x="1" y="1" width="9" height="9" fill="#f25022" />
              <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
              <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
              <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
            </svg>
            使用 Microsoft 帳號登入
          </button>
        </form>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300 dark:border-gray-600" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                僅限企業帳號
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 頁腳資訊 */}
      <p className="text-center text-xs text-gray-500 dark:text-gray-400">
        請使用您的企業 Microsoft 帳號登入系統。
        <br />
        如有問題，請聯繫 IT 支援團隊。
      </p>
    </>
  )
}
