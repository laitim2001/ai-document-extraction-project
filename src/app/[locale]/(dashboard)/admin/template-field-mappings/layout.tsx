/**
 * @fileoverview Admin 模板欄位映射子樹授權 Layout
 * @description
 *   為 admin/template-field-mappings/* 頁面提供 server 端授權 gate（FIX-073）。
 *   作為 server component layout，先於子頁面 render 執行，確保未具 ADMIN_MANAGE
 *   權限者無法載入；尤其 [id]/page.tsx 在 render 過程中直接以 Prisma 查 DB，
 *   本 layout 的 gate 必然先於該查詢執行，授權前不會洩漏任何管理資料。
 *
 *   保護頁面：
 *   - admin/template-field-mappings（列表）
 *   - admin/template-field-mappings/[id]（server 直查 DB）
 *   - admin/template-field-mappings/new
 *
 *   gate 一律沿用既有 hasPermission(session.user, PERMISSIONS.ADMIN_MANAGE)，
 *   未新造重複 helper；未授權沿用既有 dashboard?error=access_denied 機制（無新增 UI 字串）。
 *
 * @module src/app/[locale]/(dashboard)/admin/template-field-mappings/layout
 * @author Development Team
 * @since FIX-073（頁面層授權 gate）
 * @lastModified 2026-06-11
 */

import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { hasPermission } from '@/lib/auth/city-permission'
import { PERMISSIONS } from '@/types/permissions'

/**
 * Admin 模板欄位映射子樹 Layout — 基線授權 gate
 *
 * @description
 *   1. 未登入 → redirect 至登入頁
 *   2. 無 ADMIN_MANAGE 權限 → redirect 至 dashboard（access_denied）
 *   3. 通過 → render 子頁面（授權後才執行子頁的 DB 查詢）
 */
export default async function AdminTemplateFieldMappingsLayout({
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
