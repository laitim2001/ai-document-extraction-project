/**
 * @fileoverview System Settings Hub 頁面 (Server Component)
 * @description
 *   系統設定中心頁面，提供所有系統設定的統一入口。
 *   透過伺服器端翻譯取得頁面標題，並渲染客戶端 SettingsClient 組件。
 *
 * @module src/app/[locale]/(dashboard)/admin/settings/page
 * @since CHANGE-050 - System Settings Hub
 * @lastModified 2026-02-26
 *
 * @related
 *   - src/app/[locale]/(dashboard)/admin/settings/client.tsx - 客戶端主組件
 *   - src/components/features/admin/settings/ - Settings 組件目錄
 */

import { getTranslations } from 'next-intl/server'
import { SettingsClient } from './client'

// ============================================================
// Page Component
// ============================================================

/**
 * @page SystemSettingsPage
 * @description 系統設定中心頁面（Server Component）
 */
export default async function SystemSettingsPage() {
  const t = await getTranslations('systemSettings')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('pageTitle')}</h1>
        <p className="text-muted-foreground">{t('pageDescription')}</p>
      </div>
      <SettingsClient />
    </div>
  )
}
