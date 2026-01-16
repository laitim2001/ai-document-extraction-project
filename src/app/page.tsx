/**
 * @fileoverview 根頁面重定向
 * @description
 *   將根路徑 `/` 重定向到預設語言路徑 `/en`
 *   實際的重定向邏輯由 middleware.ts 處理
 *
 * @module src/app/page
 * @author Development Team
 * @since Epic 17 - Story 17.1 (i18n Infrastructure Setup)
 * @lastModified 2026-01-16
 */

import { redirect } from 'next/navigation'
import { defaultLocale } from '@/i18n/config'

export default function RootPage() {
  redirect(`/${defaultLocale}`)
}
