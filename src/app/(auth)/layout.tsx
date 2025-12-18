/**
 * @fileoverview 認證頁面佈局組件
 * @description
 *   認證相關頁面（登入、錯誤等）的共用佈局。
 *   提供置中的卡片式佈局，適用於認證流程。
 *
 * @module src/app/(auth)/layout
 * @author Development Team
 * @since Epic 1 - Story 1.1 (Azure AD SSO Login)
 * @lastModified 2025-12-18
 *
 * @features
 *   - 響應式置中佈局
 *   - 認證頁面共用樣式
 *
 * @related
 *   - src/app/(auth)/auth/login/page.tsx - 登入頁面
 *   - src/app/(auth)/auth/error/page.tsx - 錯誤頁面
 */

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {children}
      </div>
    </div>
  )
}
