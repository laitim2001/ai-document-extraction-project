/**
 * @fileoverview Azure AD SSO 登入頁面
 * @description
 *   提供企業 SSO 登入入口，使用 Microsoft Entra ID (Azure AD) 進行認證。
 *   開發模式下支援 Credentials 登入。
 *
 *   功能特點：
 *   - Microsoft 企業帳號登入按鈕
 *   - 開發模式 Credentials 登入表單
 *   - 自動重定向已登入用戶
 *   - 保留原始請求路徑（callbackUrl）
 *
 * @module src/app/(auth)/auth/login/page
 * @author Development Team
 * @since Epic 1 - Story 1.1 (Azure AD SSO Login)
 * @lastModified 2025-12-21
 *
 * @features
 *   - Azure AD SSO 登入
 *   - 開發模式 Credentials 登入
 *   - 回調 URL 支援
 *   - 錯誤訊息顯示
 *   - 響應式設計
 *
 * @related
 *   - src/lib/auth.ts - NextAuth 配置
 *   - src/lib/auth.config.ts - Edge 認證配置
 *   - src/app/(auth)/auth/error/page.tsx - 錯誤頁面
 */

import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { auth, signIn } from '@/lib/auth'
import { DevLoginForm } from '@/components/features/auth/DevLoginForm'

/**
 * 檢查 Azure AD 是否已正確配置
 */
function isAzureADConfigured(): boolean {
  const clientId = process.env.AZURE_AD_CLIENT_ID
  const clientSecret = process.env.AZURE_AD_CLIENT_SECRET
  const tenantId = process.env.AZURE_AD_TENANT_ID

  if (!clientId || !clientSecret || !tenantId) return false
  if (clientId.startsWith('your-') || clientId === 'placeholder') return false
  if (clientSecret.startsWith('your-') || clientSecret === 'placeholder') return false
  if (tenantId.startsWith('your-') || tenantId === 'placeholder') return false

  return true
}

interface LoginPageProps {
  searchParams: Promise<{
    callbackUrl?: string
    error?: string
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const t = await getTranslations('auth')
  const session = await auth()
  const { callbackUrl, error } = await searchParams

  // 已登入用戶重定向至儀表板或回調 URL
  if (session) {
    redirect(callbackUrl ?? '/dashboard')
  }

  const errorMessage = error ? t(`errors.${error}`) ?? t('errors.Default') : null
  const azureConfigured = isAzureADConfigured()
  const isDevelopment = process.env.NODE_ENV === 'development'

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
          {t('login.description')}
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
        {/* Azure AD 登入（生產環境或 Azure AD 已配置） */}
        {azureConfigured && (
          <>
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
                {t('login.microsoftLogin')}
              </button>
            </form>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300 dark:border-gray-600" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                    {t('login.enterpriseOnly')}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* 開發模式登入（Azure AD 未配置時顯示） */}
        {(isDevelopment || !azureConfigured) && !azureConfigured && (
          <DevLoginForm callbackUrl={callbackUrl} />
        )}
      </div>

      {/* 頁腳資訊 */}
      <p className="text-center text-xs text-gray-500 dark:text-gray-400 whitespace-pre-line">
        {azureConfigured ? t('login.productionFooter') : t('login.devMode.footer')}
      </p>
    </>
  )
}
