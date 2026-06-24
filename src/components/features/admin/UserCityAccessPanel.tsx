'use client'

/**
 * @fileoverview 用戶城市存取權限管理面板
 * @description
 *   在用戶編輯對話框中管理單一用戶的「城市資料存取權限」（UserCityAccess）——
 *   即決定該用戶登入後能查看哪些城市的業務資料、解除 dashboard 等 API 的 403。
 *   支援授予 / 撤銷 / 設定主要城市。變更後該用戶需重新登入才生效。
 *
 * @module src/components/features/admin/UserCityAccessPanel
 * @author Development Team
 * @since CHANGE-090 - 城市/區域存取權限管理 UI/API
 */

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, MapPin, Star, X } from 'lucide-react'

import { useCities } from '@/hooks/use-cities'
import {
  useUserCityAccess,
  useGrantCityAccess,
  useRevokeCityAccess,
  useSetPrimaryCity,
} from '@/hooks/use-user-city-access'
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

interface UserCityAccessPanelProps {
  /** 目標用戶 ID */
  userId: string
}

export function UserCityAccessPanel({ userId }: UserCityAccessPanelProps) {
  const t = useTranslations('admin')
  const { toast } = useToast()
  const [selectedCity, setSelectedCity] = useState('')

  const { data: accesses, isLoading } = useUserCityAccess(userId)
  const { data: cities, isLoading: isLoadingCities } = useCities()
  const grant = useGrantCityAccess()
  const revoke = useRevokeCityAccess()
  const setPrimary = useSetPrimaryCity()

  const grantedCodes = new Set((accesses ?? []).map((a) => a.cityCode))
  const availableCities = (cities ?? []).filter((c) => !grantedCodes.has(c.code))

  const handleGrant = () => {
    if (!selectedCity) return
    grant.mutate(
      { userId, input: { cityCode: selectedCity } },
      {
        onSuccess: () => {
          toast({ title: t('users.cityAccess.toast.granted') })
          setSelectedCity('')
        },
        onError: (e) =>
          toast({
            variant: 'destructive',
            title: t('users.cityAccess.toast.error'),
            description: e.message,
          }),
      }
    )
  }

  const handleRevoke = (cityCode: string) => {
    revoke.mutate(
      { userId, cityCode },
      {
        onSuccess: () => toast({ title: t('users.cityAccess.toast.revoked') }),
        onError: (e) =>
          toast({
            variant: 'destructive',
            title: t('users.cityAccess.toast.error'),
            description: e.message,
          }),
      }
    )
  }

  const handleSetPrimary = (cityCode: string) => {
    setPrimary.mutate(
      { userId, cityCode },
      {
        onSuccess: () => toast({ title: t('users.cityAccess.toast.primarySet') }),
        onError: (e) =>
          toast({
            variant: 'destructive',
            title: t('users.cityAccess.toast.error'),
            description: e.message,
          }),
      }
    )
  }

  const isMutating = grant.isPending || revoke.isPending || setPrimary.isPending

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-medium">{t('users.cityAccess.title')}</h4>
        <p className="text-xs text-muted-foreground">{t('users.cityAccess.description')}</p>
        <p className="text-xs text-amber-600">{t('users.cityAccess.reloginHint')}</p>
      </div>

      {/* 已授予列表 */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('users.cityAccess.loading')}
        </div>
      ) : (accesses?.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground">{t('users.cityAccess.empty')}</p>
      ) : (
        <ul className="space-y-1">
          {accesses?.map((access) => (
            <li
              key={access.cityCode}
              className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
            >
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                {access.cityName} ({access.cityCode})
                {access.isPrimary && (
                  <Badge variant="secondary" className="gap-1">
                    <Star className="h-3 w-3" />
                    {t('users.cityAccess.primary')}
                  </Badge>
                )}
              </span>
              <span className="flex items-center gap-1">
                {!access.isPrimary && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isMutating}
                    onClick={() => handleSetPrimary(access.cityCode)}
                  >
                    {t('users.cityAccess.setPrimary')}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={isMutating}
                  onClick={() => handleRevoke(access.cityCode)}
                  aria-label={t('users.cityAccess.remove')}
                >
                  <X className="h-4 w-4" />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* 授予新城市 */}
      <div className="flex items-center gap-2">
        <Select value={selectedCity} onValueChange={setSelectedCity} disabled={isLoadingCities}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder={t('users.cityAccess.selectCity')} />
          </SelectTrigger>
          <SelectContent>
            {availableCities.map((city) => (
              <SelectItem key={city.id} value={city.code}>
                {city.name} ({city.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" onClick={handleGrant} disabled={!selectedCity || isMutating}>
          {grant.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('users.cityAccess.grant')}
        </Button>
      </div>
    </div>
  )
}
