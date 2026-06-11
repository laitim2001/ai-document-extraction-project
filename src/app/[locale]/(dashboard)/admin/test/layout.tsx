/**
 * @fileoverview Admin 測試工具子樹授權 Layout
 * @description
 *   為 admin/test/* 測試工具頁面提供 server 端授權 gate（FIX-073）。
 *   作為 server component layout，先於子頁面（含 'use client' 頁面）render 執行，
 *   確保未具 ADMIN_MANAGE 權限者無法載入任何測試工具頁。
 *
 *   保護頁面：
 *   - admin/test/extraction-v2（'use client'）
 *   - admin/test/extraction-compare（'use client'）
 *   - admin/test/template-matching（server component）
 *
 *   gate 一律沿用既有 hasPermission(session.user, PERMISSIONS.ADMIN_MANAGE)，
 *   未新造重複 helper；未授權沿用既有 dashboard?error=access_denied 機制（無新增 UI 字串）。
 *
 * @module src/app/[locale]/(dashboard)/admin/test/layout
 * @author Development Team
 * @since FIX-073（頁面層授權 gate）
 * @lastModified 2026-06-11
 */

import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { hasPermission } from '@/lib/auth/city-permission'
import { PERMISSIONS } from '@/types/permissions'

/**
 * Admin 測試工具子樹 Layout — 基線授權 gate
 *
 * @description
 *   1. 未登入 → redirect 至登入頁
 *   2. 無 ADMIN_MANAGE 權限 → redirect 至 dashboard（access_denied）
 *   3. 通過 → render 子頁面
 */
export default async function AdminTestLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  const session = await auth()

  if (!session?.user) {
    redirect(`/${locale}/auth/login`)
  }

  if (!hasPermission(session.user, PERMISSIONS.ADMIN_MANAGE)) {
    redirect(`/${locale}/dashboard?error=access_denied`)
  }

  return <>{children}</>
}
