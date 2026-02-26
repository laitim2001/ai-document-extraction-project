'use client'

/**
 * @fileoverview 一般系統設定表單
 * @description
 *   提供基本系統偏好設定的表單介面：
 *   - 系統名稱（文字輸入）
 *   - 預設語言（下拉選擇: en / zh-TW / zh-CN）
 *   - 時區（下拉選擇: Asia/Hong_Kong, Asia/Shanghai 等）
 *   - 日期格式（下拉選擇: YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY）
 *
 *   使用 React Hook Form + Zod 進行表單驗證，
 *   透過 useSystemSettings / useUpdateSystemSettings 與 API 互動。
 *
 * @module src/components/features/admin/settings/GeneralSettingsForm
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
import { Input } from '@/components/ui/input'
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

const LOCALE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'zh-CN', label: '简体中文' },
] as const

const TIMEZONE_OPTIONS = [
  { value: 'Asia/Hong_Kong', label: 'Asia/Hong_Kong (UTC+8)' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai (UTC+8)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (UTC+9)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (UTC+8)' },
  { value: 'Asia/Taipei', label: 'Asia/Taipei (UTC+8)' },
  { value: 'UTC', label: 'UTC (UTC+0)' },
  { value: 'Europe/London', label: 'Europe/London (UTC+0/+1)' },
  { value: 'America/New_York', label: 'America/New_York (UTC-5/-4)' },
] as const

const DATE_FORMAT_OPTIONS = [
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
] as const

// ============================================================
// Form Schema
// ============================================================

const generalSettingsSchema = z.object({
  systemName: z.string().min(1).max(100),
  defaultLocale: z.enum(['en', 'zh-TW', 'zh-CN']),
  timezone: z.string().min(1),
  dateFormat: z.enum(['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY']),
})

type GeneralSettingsValues = z.infer<typeof generalSettingsSchema>

// ============================================================
// Component
// ============================================================

/**
 * 一般系統設定表單
 *
 * @description
 *   載入 'general' 類別的系統設定，提供表單介面供管理員編輯。
 *   儲存時透過 useUpdateSystemSettings 批量更新設定值。
 */
export function GeneralSettingsForm() {
  const t = useTranslations('systemSettings')
  const { toast } = useToast()

  // --- Data Hooks ---
  const { data, isLoading } = useSystemSettings('general')
  const updateMutation = useUpdateSystemSettings()

  // --- Form ---
  const form = useForm<GeneralSettingsValues>({
    resolver: zodResolver(generalSettingsSchema),
    defaultValues: {
      systemName: '',
      defaultLocale: 'en',
      timezone: 'Asia/Hong_Kong',
      dateFormat: 'YYYY-MM-DD',
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
        systemName: (settingsMap['system.name'] as string) ?? '',
        defaultLocale:
          (settingsMap['system.defaultLocale'] as 'en' | 'zh-TW' | 'zh-CN') ?? 'en',
        timezone: (settingsMap['system.timezone'] as string) ?? 'Asia/Hong_Kong',
        dateFormat:
          (settingsMap['system.dateFormat'] as 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY') ?? 'YYYY-MM-DD',
      })
    }
  }, [data, form])

  // --- Handlers ---
  const onSubmit = async (values: GeneralSettingsValues) => {
    try {
      await updateMutation.mutateAsync({
        settings: [
          { key: 'system.name', value: values.systemName, category: 'general' },
          { key: 'system.defaultLocale', value: values.defaultLocale, category: 'general' },
          { key: 'system.timezone', value: values.timezone, category: 'general' },
          { key: 'system.dateFormat', value: values.dateFormat, category: 'general' },
        ],
      })
      toast({
        title: t('general.saveSuccess'),
      })
    } catch {
      toast({
        title: t('general.saveError'),
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
        {/* System Name */}
        <FormField
          control={form.control}
          name="systemName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('general.systemName')}</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormDescription>
                {t('general.systemNameDescription')}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Default Locale */}
        <FormField
          control={form.control}
          name="defaultLocale"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('general.defaultLocale')}</FormLabel>
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
                  {LOCALE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                {t('general.defaultLocaleDescription')}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Timezone */}
        <FormField
          control={form.control}
          name="timezone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('general.timezone')}</FormLabel>
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
                  {TIMEZONE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                {t('general.timezoneDescription')}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Date Format */}
        <FormField
          control={form.control}
          name="dateFormat"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('general.dateFormat')}</FormLabel>
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
                  {DATE_FORMAT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                {t('general.dateFormatDescription')}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

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
