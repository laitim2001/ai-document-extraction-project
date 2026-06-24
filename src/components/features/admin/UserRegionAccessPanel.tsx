'use client'

/**
 * @fileoverview 用戶區域存取權限管理面板
 * @description
 *   在用戶編輯對話框中管理單一用戶的「區域資料存取權限」（UserRegionAccess）。
 *   授予整個區域 → 連帶取得該區域所有城市的資料存取權限（service 處理）。
 *   支援授予 / 撤銷。變更後該用戶需重新登入才生效。
 *
 * @module src/components/features/admin/UserRegionAccessPanel
 * @author Development Team
 * @since CHANGE-090 - 城市/區域存取權限管理 UI/API
 */

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Globe2, X } from 'lucide-react'

import { useRegions } from '@/hooks/use-regions'
import {
  useUserRegionAccess,
  useGrantRegionAccess,
  useRevokeRegionAccess,
} from '@/hooks/use-user-region-access'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface UserRegionAccessPanelProps {
  /** 目標用戶 ID */
  userId: string
}

export function UserRegionAccessPanel({ userId }: UserRegionAccessPanelProps) {
  const t = useTranslations('admin')
  const { toast } = useToast()
  const [selectedRegion, setSelectedRegion] = useState('')

  const { data: accesses, isLoading } = useUserRegionAccess(userId)
  const { data: regions, isLoading: isLoadingRegions } = useRegions({ isActive: true })
  const grant = useGrantRegionAccess()
  const revoke = useRevokeRegionAccess()

  const grantedCodes = new Set((accesses ?? []).map((a) => a.code))
  const availableRegions = (regions ?? []).filter((r) => !grantedCodes.has(r.code))

  const handleGrant = () => {
    if (!selectedRegion) return
    grant.mutate(
      { userId, input: { regionCode: selectedRegion } },
      {
        onSuccess: () => {
          toast({ title: t('users.regionAccess.toast.granted') })
          setSelectedRegion('')
        },
        onError: (e) =>
          toast({
            variant: 'destructive',
            title: t('users.regionAccess.toast.error'),
            description: e.message,
          }),
      }
    )
  }

  const handleRevoke = (regionCode: string) => {
    revoke.mutate(
      { userId, regionCode },
      {
        onSuccess: () => toast({ title: t('users.regionAccess.toast.revoked') }),
        onError: (e) =>
          toast({
            variant: 'destructive',
            title: t('users.regionAccess.toast.error'),
            description: e.message,
          }),
      }
    )
  }

  const isMutating = grant.isPending || revoke.isPending

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-medium">{t('users.regionAccess.title')}</h4>
        <p className="text-xs text-muted-foreground">{t('users.regionAccess.description')}</p>
        <p className="text-xs text-amber-600">{t('users.regionAccess.reloginHint')}</p>
      </div>

      {/* 已授予列表 */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('users.regionAccess.loading')}
        </div>
      ) : (accesses?.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground">{t('users.regionAccess.empty')}</p>
      ) : (
        <ul className="space-y-1">
          {accesses?.map((access) => (
            <li
              key={access.code}
              className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
            >
              <span className="flex items-center gap-2">
                <Globe2 className="h-4 w-4 text-muted-foreground" />
                {access.name} ({access.code})
                <Badge variant="secondary">
                  {t('users.regionAccess.cityCount', { count: access.cityCount })}
                </Badge>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={isMutating}
                onClick={() => handleRevoke(access.code)}
                aria-label={t('users.regionAccess.remove')}
              >
                <X className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {/* 授予新區域 */}
      <div className="flex items-center gap-2">
        <Select
          value={selectedRegion}
          onValueChange={setSelectedRegion}
          disabled={isLoadingRegions}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder={t('users.regionAccess.selectRegion')} />
          </SelectTrigger>
          <SelectContent>
            {availableRegions.map((region) => (
              <SelectItem key={region.id} value={region.code}>
                {region.name} ({region.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" onClick={handleGrant} disabled={!selectedRegion || isMutating}>
          {grant.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('users.regionAccess.grant')}
        </Button>
      </div>
    </div>
  )
}
