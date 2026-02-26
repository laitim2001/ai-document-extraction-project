'use client'

/**
 * @fileoverview 通知設定表單
 * @description
 *   提供通知偏好設定的表單介面：
 *   - 啟用/停用 Email 通知（Switch）
 *   - 警報閾值等級（Select: info / warning / error / critical）
 *   - 摘要頻率（Select: realtime / hourly / daily / weekly）
 *   - 收件者清單（僅顯示資訊文字，功能待實作）
 *
 *   使用 React Hook Form + Zod 進行表單驗證，
 *   透過 useSystemSettings / useUpdateSystemSettings 與 API 互動。
 *
 * @module src/components/features/admin/settings/NotificationSettingsForm
 * @since CHANGE-050 - System Settings Hub
 * @lastModified 2026-02-26
 *
 * @dependencies
 *   - react-hook-form + @hookform/resolvers/zod - 表單管理
 *   - next-intl - 國際化
 *   - @/hooks/use-system-settings - 系統設定 CRUD hooks
 *   - @/hooks/use-toast - Toast 通知
 */

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { useToast } from '@/hooks/use-toast'
import {
  useSystemSettings,
  useUpdateSystemSettings,
} from '@/hooks/use-system-settings'

// ============================================================
// Constants
// ============================================================

const THRESHOLD_OPTIONS = ['info', 'warning', 'error', 'critical'] as const

const FREQUENCY_OPTIONS = ['realtime', 'hourly', 'daily', 'weekly'] as const

// ============================================================
// Form Schema
// ============================================================

const notificationSettingsSchema = z.object({
  emailEnabled: z.boolean(),
  alertThreshold: z.enum(['info', 'warning', 'error', 'critical']),
  digestFrequency: z.enum(['realtime', 'hourly', 'daily', 'weekly']),
})

type NotificationSettingsValues = z.infer<typeof notificationSettingsSchema>

// ============================================================
// Component
// ============================================================

/**
 * 通知設定表單
 *
 * @description
 *   載入 'notifications' 類別的系統設定，提供表單介面供管理員編輯。
 *   儲存時透過 useUpdateSystemSettings 批量更新設定值。
 */
export function NotificationSettingsForm() {
  const t = useTranslations('systemSettings')
  const { toast } = useToast()

  // --- Data Hooks ---
  const { data, isLoading } = useSystemSettings('notifications')
  const updateMutation = useUpdateSystemSettings()

  // --- Form ---
  const form = useForm<NotificationSettingsValues>({
    resolver: zodResolver(notificationSettingsSchema),
    defaultValues: {
      emailEnabled: false,
      alertThreshold: 'warning',
      digestFrequency: 'daily',
    },
  })

  // Populate form when data loads
  useEffect(() => {
    if (data?.settings) {
      const settingsMap: Record<string, unknown> = {}
      for (const s of data.settings) {
        settingsMap[s.key] = s.value
      }
      form.reset({
        emailEnabled: (settingsMap['notification.emailEnabled'] as boolean) ?? false,
        alertThreshold:
          (settingsMap['notification.alertThreshold'] as NotificationSettingsValues['alertThreshold']) ?? 'warning',
        digestFrequency:
          (settingsMap['notification.digestFrequency'] as NotificationSettingsValues['digestFrequency']) ?? 'daily',
      })
    }
  }, [data, form])

  // --- Handlers ---
  const onSubmit = async (values: NotificationSettingsValues) => {
    try {
      await updateMutation.mutateAsync({
        settings: [
          { key: 'notification.emailEnabled', value: values.emailEnabled, category: 'notifications' },
          { key: 'notification.alertThreshold', value: values.alertThreshold, category: 'notifications' },
          { key: 'notification.digestFrequency', value: values.digestFrequency, category: 'notifications' },
        ],
      })
      toast({
        title: t('notifications.saveSuccess'),
      })
    } catch {
      toast({
        title: t('notifications.saveError'),
        variant: 'destructive',
      })
    }
  }

  // --- Loading state ---
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // --- Render ---
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Email Enabled */}
        <FormField
          control={form.control}
          name="emailEnabled"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">
                  {t('notifications.emailEnabled')}
                </FormLabel>
                <FormDescription>
                  {t('notifications.emailEnabledDescription')}
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Alert Threshold */}
        <FormField
          control={form.control}
          name="alertThreshold"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('notifications.alertThreshold')}</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {THRESHOLD_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {t(`notifications.thresholds.${option}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                {t('notifications.alertThresholdDescription')}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Digest Frequency */}
        <FormField
          control={form.control}
          name="digestFrequency"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('notifications.digestFrequency')}</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {t(`notifications.frequencies.${option}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                {t('notifications.digestFrequencyDescription')}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Recipients (info text only) */}
        <div className="rounded-lg border p-4">
          <p className="text-sm font-medium">
            {t('notifications.recipients')}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {t('notifications.recipientsDescription')}
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => form.reset()}
            disabled={updateMutation.isPending}
          >
            {t('actions.cancel')}
          </Button>
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {t('actions.save')}
          </Button>
        </div>
      </form>
    </Form>
  )
}
