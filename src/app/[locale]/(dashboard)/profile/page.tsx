/**
 * @fileoverview 個人資料頁面 (Server Component)
 * @description
 *   顯示當前登入用戶的個人資訊頁面。
 *   包含基本資訊、角色權限、語言偏好和密碼修改功能。
 *
 * @module src/app/[locale]/(dashboard)/profile/page
 * @author Development Team
 * @since CHANGE-049 - User Profile Page
 * @lastModified 2026-02-26
 *
 * @related
 *   - src/app/api/v1/users/me/route.ts - API 端點
 *   - src/hooks/use-profile.ts - Profile Hook
 */

import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { auth } from '@/lib/auth'
import { ProfileClient } from './client'

export async function generateMetadata() {
  const t = await getTranslations('profile')
  return {
    title: `${t('pageTitle')} | AI Document Extraction`,
    description: t('pageDescription'),
  }
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  // 驗證認證狀態
  const session = await auth()
  if (!session?.user) {
    redirect(`/${locale}/auth/login`)
  }

  const t = await getTranslations('profile')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('pageTitle')}
        </h1>
        <p className="text-muted-foreground">{t('pageDescription')}</p>
      </div>

      <ProfileClient />
    </div>
  )
}
