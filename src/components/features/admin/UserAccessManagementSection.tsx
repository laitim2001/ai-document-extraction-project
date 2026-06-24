'use client'

/**
 * @fileoverview 用戶資料存取權限管理區塊
 * @description
 *   彙整單一用戶的資料存取權限管理：城市存取權限、區域存取權限、globalAdmin 切換。
 *   嵌入用戶編輯對話框中，與「City Manager 管理範圍」欄位區隔，明確區分
 *   「資料存取權限」（此區塊）與「管理範圍」（cityId 欄位）兩種概念（CHANGE-090 OQ-2）。
 *
 *   globalAdmin 切換僅對「本身是 globalAdmin」的操作者顯示（與後端要求一致）。
 *
 * @module src/components/features/admin/UserAccessManagementSection
 * @author Development Team
 * @since CHANGE-090 - 城市/區域存取權限管理 UI/API
 */

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ShieldAlert } from 'lucide-react'

import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { useSetUserGlobalAdmin } from '@/hooks/use-user-region-access'
import { Switch } from '@/components/ui/switch'
import { UserCityAccessPanel } from './UserCityAccessPanel'
import { UserRegionAccessPanel } from './UserRegionAccessPanel'

interface UserAccessManagementSectionProps {
  /** 目標用戶 ID */
  userId: string
  /** 目標用戶目前的 globalAdmin 狀態（初始值） */
  userIsGlobalAdmin: boolean
}

export function UserAccessManagementSection({
  userId,
  userIsGlobalAdmin,
}: UserAccessManagementSectionProps) {
  const t = useTranslations('admin')
  const { toast } = useToast()
  const { user: currentUser } = useAuth()
  const setGlobalAdmin = useSetUserGlobalAdmin()

  const [isGlobalAdmin, setIsGlobalAdmin] = useState(userIsGlobalAdmin)

  useEffect(() => {
    setIsGlobalAdmin(userIsGlobalAdmin)
  }, [userIsGlobalAdmin])

  // 只有 globalAdmin 操作者能切換他人的 globalAdmin（與後端要求一致）
  const canManageGlobalAdmin = currentUser?.isGlobalAdmin === true

  const handleToggleGlobalAdmin = (checked: boolean) => {
    const previous = isGlobalAdmin
    setIsGlobalAdmin(checked) // 樂觀更新
    setGlobalAdmin.mutate(
      { userId, isGlobalAdmin: checked },
      {
        onSuccess: () =>
          toast({
            title: checked
              ? t('users.globalAdmin.toast.granted')
              : t('users.globalAdmin.toast.revoked'),
          }),
        onError: (e) => {
          setIsGlobalAdmin(previous) // 還原
          toast({
            variant: 'destructive',
            title: t('users.globalAdmin.toast.error'),
            description: e.message,
          })
        },
      }
    )
  }

  return (
    <div className="space-y-6">
      <UserCityAccessPanel userId={userId} />

      <div className="border-t pt-4">
        <UserRegionAccessPanel userId={userId} />
      </div>

      {canManageGlobalAdmin && (
        <div className="border-t pt-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h4 className="flex items-center gap-2 text-sm font-medium">
                <ShieldAlert className="h-4 w-4 text-destructive" />
                {t('users.globalAdmin.title')}
              </h4>
              <p className="text-xs text-muted-foreground">
                {t('users.globalAdmin.description')}
              </p>
              <p className="text-xs text-amber-600">{t('users.globalAdmin.reloginHint')}</p>
            </div>
            <Switch
              checked={isGlobalAdmin}
              onCheckedChange={handleToggleGlobalAdmin}
              disabled={setGlobalAdmin.isPending}
              aria-label={t('users.globalAdmin.title')}
            />
          </div>
        </div>
      )}
    </div>
  )
}
