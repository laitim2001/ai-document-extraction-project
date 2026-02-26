'use client'

/**
 * @fileoverview 資料保留設定表單
 * @description
 *   提供資料保留期限設定的表單介面：
 *   - 文件保留天數（數字輸入）
 *   - 日誌保留天數（數字輸入）
 *   - 審計日誌保留天數（數字輸入）
 *   - 暫存檔保留天數（數字輸入）
 *
 *   每個欄位旁顯示 "{count} days" 單位標籤。
 *   使用 React Hook Form + Zod 進行表單驗證，
 *   透過 useSystemSettings / useUpdateSystemSettings 與 API 互動。
 *
 * @module src/components/features/admin/settings/DataRetentionForm
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
// Form Schema
// ============================================================

const dataRetentionSchema = z.object({
  documentDays: z.number().int().min(1).max(3650),
  logDays: z.number().int().min(1).max(3650),
  auditDays: z.number().int().min(1).max(3650),
  tempFileDays: z.number().int().min(1).max(365),
})

type DataRetentionValues = z.infer<typeof dataRetentionSchema>

// ============================================================
// Constants
// ============================================================

const RETENTION_FIELDS = [
  {
    name: 'documentDays' as const,
    settingKey: 'retention.documentDays',
    labelKey: 'retention.documentDays' as const,
    descriptionKey: 'retention.documentDaysDescription' as const,
    defaultValue: 365,
  },
  {
    name: 'logDays' as const,
    settingKey: 'retention.logDays',
    labelKey: 'retention.logDays' as const,
    descriptionKey: 'retention.logDaysDescription' as const,
    defaultValue: 90,
  },
  {
    name: 'auditDays' as const,
    settingKey: 'retention.auditDays',
    labelKey: 'retention.auditDays' as const,
    descriptionKey: 'retention.auditDaysDescription' as const,
    defaultValue: 730,
  },
  {
    name: 'tempFileDays' as const,
    settingKey: 'retention.tempFileDays',
    labelKey: 'retention.tempFileDays' as const,
    descriptionKey: 'retention.tempFileDaysDescription' as const,
    defaultValue: 7,
  },
] as const

// ============================================================
// Component
// ============================================================

/**
 * 資料保留設定表單
 *
 * @description
 *   載入 'retention' 類別的系統設定，提供數字輸入欄位供管理員設定
 *   各類資料的保留天數。儲存時透過 useUpdateSystemSettings 批量更新。
 */
export function DataRetentionForm() {
  const t = useTranslations('systemSettings')
  const { toast } = useToast()

  // --- Data Hooks ---
  const { data, isLoading } = useSystemSettings('retention')
  const updateMutation = useUpdateSystemSettings()

  // --- Form ---
  const form = useForm<DataRetentionValues>({
    resolver: zodResolver(dataRetentionSchema),
    defaultValues: {
      documentDays: 365,
      logDays: 90,
      auditDays: 730,
      tempFileDays: 7,
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
        documentDays: (settingsMap['retention.documentDays'] as number) ?? 365,
        logDays: (settingsMap['retention.logDays'] as number) ?? 90,
        auditDays: (settingsMap['retention.auditDays'] as number) ?? 730,
        tempFileDays: (settingsMap['retention.tempFileDays'] as number) ?? 7,
      })
    }
  }, [data, form])

  // --- Handlers ---
  const onSubmit = async (values: DataRetentionValues) => {
    try {
      await updateMutation.mutateAsync({
        settings: RETENTION_FIELDS.map((field) => ({
          key: field.settingKey,
          value: values[field.name],
          category: 'retention',
        })),
      })
      toast({
        title: t('retention.saveSuccess'),
      })
    } catch {
      toast({
        title: t('retention.saveError'),
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
        {RETENTION_FIELDS.map((fieldConfig) => (
          <FormField
            key={fieldConfig.name}
            control={form.control}
            name={fieldConfig.name}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t(fieldConfig.labelKey)}</FormLabel>
                <div className="flex items-center gap-3">
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={fieldConfig.name === 'tempFileDays' ? 365 : 3650}
                      className="w-32"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <span className="text-sm text-muted-foreground">
                    {t('retention.days', { count: field.value })}
                  </span>
                </div>
                <FormDescription>
                  {t(fieldConfig.descriptionKey)}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        ))}

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
