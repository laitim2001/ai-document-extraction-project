'use client'

/**
 * @fileoverview Reference Number 表單組件
 * @description
 *   新增/編輯 Reference Number 的共用表單，支援：
 *   - React Hook Form + Zod 驗證
 *   - Popover + Calendar 日期選擇（無獨立 DatePicker）
 *   - RegionSelect 地區選擇
 *   - 編輯模式顯示唯讀欄位（code, matchCount）
 *
 * @module src/components/features/reference-number/ReferenceNumberForm
 * @since Epic 20 - Story 20.6 (Management Page - Form & Import)
 * @lastModified 2026-02-05
 *
 * @dependencies
 *   - next-intl - 國際化
 *   - react-hook-form + zod - 表單驗證
 *   - @/components/ui/* - 基礎 UI 組件
 *   - @/components/features/region/RegionSelect - 地區選擇
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { CalendarIcon, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { RegionSelect } from '@/components/features/region/RegionSelect'
import { Link } from '@/i18n/routing'
import { cn } from '@/lib/utils'

// ============================================================
// Constants
// ============================================================

const REFERENCE_NUMBER_TYPES = [
  'SHIPMENT',
  'DELIVERY',
  'BOOKING',
  'CONTAINER',
  'HAWB',
  'MAWB',
  'BL',
  'CUSTOMS',
  'OTHER',
] as const

// ============================================================
// Schema
// ============================================================

const formSchema = z.object({
  number: z.string().min(1).max(100),
  type: z.enum(REFERENCE_NUMBER_TYPES),
  year: z.number().int().min(2000).max(2100),
  regionId: z.string().min(1),
  description: z.string().max(500).optional().or(z.literal('')),
  validFrom: z.date().optional().nullable(),
  validUntil: z.date().optional().nullable(),
})

export type ReferenceNumberFormValues = z.infer<typeof formSchema>

// ============================================================
// Types
// ============================================================

interface ReferenceNumberFormProps {
  /** 預設值（編輯時傳入） */
  defaultValues?: Partial<ReferenceNumberFormValues>
  /** 表單提交回調 */
  onSubmit: (values: ReferenceNumberFormValues) => Promise<void>
  /** 是否為編輯模式 */
  isEditing?: boolean
  /** 唯讀：識別碼（編輯時顯示） */
  code?: string
  /** 唯讀：匹配次數（編輯時顯示） */
  matchCount?: number
}

// ============================================================
// Component
// ============================================================

export function ReferenceNumberForm({
  defaultValues,
  onSubmit,
  isEditing = false,
  code,
  matchCount,
}: ReferenceNumberFormProps) {
  const t = useTranslations('referenceNumber')
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const form = useForm<ReferenceNumberFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      number: '',
      type: 'SHIPMENT',
      year: new Date().getFullYear(),
      regionId: '',
      description: '',
      validFrom: null,
      validUntil: null,
      ...defaultValues,
    },
  })

  const handleSubmit = async (values: ReferenceNumberFormValues) => {
    setIsSubmitting(true)
    try {
      await onSubmit(values)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* 唯讀資訊（編輯時顯示） */}
        {isEditing && (
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {t('form.code')}
              </p>
              <p className="font-mono">{code}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {t('form.matchCount')}
              </p>
              <p>{matchCount ?? 0}</p>
            </div>
          </div>
        )}

        {/* 號碼 */}
        <FormField
          control={form.control}
          name="number"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('form.number')} *</FormLabel>
              <FormControl>
                <Input {...field} placeholder={t('form.numberPlaceholder')} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 類型和年份 */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('form.type')} *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {REFERENCE_NUMBER_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {t(`types.${type}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="year"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('form.year')} *</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    value={field.value}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* 地區 */}
        <FormField
          control={form.control}
          name="regionId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('form.region')} *</FormLabel>
              <FormControl>
                <RegionSelect
                  value={field.value}
                  onChange={field.onChange}
                  placeholder={t('form.regionPlaceholder')}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 有效期 */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="validFrom"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>{t('form.validFrom')}</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full pl-3 text-left font-normal',
                          !field.value && 'text-muted-foreground'
                        )}
                      >
                        {field.value
                          ? format(field.value, 'yyyy-MM-dd', { locale: zhTW })
                          : t('form.selectDate')}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value ?? undefined}
                      onSelect={(date) => field.onChange(date ?? null)}
                    />
                    {field.value && (
                      <div className="px-3 pb-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full"
                          onClick={() => field.onChange(null)}
                        >
                          {t('form.clearDate')}
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="validUntil"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>{t('form.validUntil')}</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full pl-3 text-left font-normal',
                          !field.value && 'text-muted-foreground'
                        )}
                      >
                        {field.value
                          ? format(field.value, 'yyyy-MM-dd', { locale: zhTW })
                          : t('form.selectDate')}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value ?? undefined}
                      onSelect={(date) => field.onChange(date ?? null)}
                    />
                    {field.value && (
                      <div className="px-3 pb-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full"
                          onClick={() => field.onChange(null)}
                        >
                          {t('form.clearDate')}
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* 說明 */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('form.description')}</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  placeholder={t('form.descriptionPlaceholder')}
                  rows={3}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 提交按鈕 */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" asChild>
            <Link href="/admin/reference-numbers">
              {t('form.cancel')}
            </Link>
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? t('form.update') : t('form.create')}
          </Button>
        </div>
      </form>
    </Form>
  )
}
