/**
 * @fileoverview Locale 首頁
 * @description
 *   語言路由的首頁，重定向到登入頁面或儀表板。
 *   實際的重定向邏輯由 middleware.ts 處理。
 *
 * @module src/app/[locale]/page
 * @author Development Team
 * @since Epic 17 - Story 17.1 (i18n Infrastructure Setup)
 * @lastModified 2026-01-16
 */

import { redirect } from 'next/navigation'

interface LocaleHomePageProps {
  params: Promise<{ locale: string }>
}

export default async function LocaleHomePage({ params }: LocaleHomePageProps) {
  const { locale } = await params
  // Middleware 會根據認證狀態重定向
  // 這裡作為備用，重定向到登入頁面
  redirect(`/${locale}/auth/login`)
}
