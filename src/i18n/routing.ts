/**
 * @fileoverview next-intl 路由配置
 * @description
 *   定義 i18n 路由行為，包括 locale 前綴策略和預設語言。
 *
 * @module src/i18n/routing
 * @author Development Team
 * @since Epic 17 - Story 17.1 (i18n Infrastructure Setup)
 * @lastModified 2026-01-16
 */

import { defineRouting } from 'next-intl/routing'
import { createNavigation } from 'next-intl/navigation'
import { locales, defaultLocale } from './config'

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'always', // 總是顯示 locale 前綴
})

// 建立 locale-aware 的導航函數
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing)
