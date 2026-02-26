'use client'

/**
 * @fileoverview Exchange Rate 表單組件
 * @description
 *   提供匯率新增/編輯功能的表單組件：
 *   - 貨幣對選擇器（CurrencySelect 整合）
 *   - 匯率輸入（支援 8 位小數精度）
 *   - 生效年份和可選的日期範圍
 *   - 反向匯率自動建立選項與預覽
 *   - React Hook Form + Zod 驗證
 *
 * @module src/components/features/exchange-rate/ExchangeRateForm
 * @since Epic 21 - Story 21.7 (Management Page - Form)
 * @lastModified 2026-02-06
 *
 * @dependencies
 *   - react-hook-form - 表單狀態管理
 *   - @hookform/resolvers/zod - Zod 整合
 *   - next-intl - 國際化
 *   - @/components/ui/* - shadcn/ui 組件
 *   - @/hooks/use-exchange-rates - API 操作 hooks
 *   - @/hooks/use-toast - 通知提示
 */

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowRight, RefreshCw, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CurrencySelect } from './CurrencySelect'
import {
  useCreateExchangeRate,
  useUpdateExchangeRate,
  type ExchangeRateDetail,
} from '@/hooks/use-exchange-rates'
import { useToast } from '@/hooks/use-toast'

// ============================================================
// Types
// ============================================================

interface ExchangeRateFormProps {
  /** 初始資料（編輯模式） */
  initialData?: ExchangeRateDetail
  /** 成功後的回調 */
  onSuccess?: () => void
  /** 取消時的回調 */
  onCancel?: () => void
}

// ============================================================
// Form Schema
// ============================================================

/**
 * 表單驗證 Schema
 */
const formSchema = z
  .object({
    fromCurrency: z.string().length(3),
    toCurrency: z.string().length(3),
    rate: z.string().min(1).refine((val) => {
      const num = Number(val)
      return !isNaN(num) && num > 0
    }),
    effectiveYear: z.number().int().min(2000).max(2100),
    effectiveFrom: z.string().optional(),
    effectiveTo: z.string().optional(),
    description: z.string().max(500).optional(),
    createInverse: z.boolean(),
  })
  .refine((data) => data.fromCurrency !== data.toCurrency, {
    path: ['toCurrency'],
  })

type FormValues = z.infer<typeof formSchema>

// ============================================================
// Constants
// ============================================================

/** 可選年份列表（當前年份 +1 到過去 9 年） */
const YEARS = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + 1 - i)

// ============================================================
// Component
// ============================================================

/**
 * Exchange Rate 表單組件
 *
 * @description
 *   用於新增和編輯匯率記錄的表單組件。
 *   - 新增模式：可選建立反向匯率
 *   - 編輯模式：貨幣對和年份不可修改
 *
 * @param props - 組件屬性
 * @returns React 元素
 *
 * @example
 *   // 新增模式
 *   <ExchangeRateForm onSuccess={() => router.push('/admin/exchange-rates')} />
 *
 *   // 編輯模式
 *   <ExchangeRateForm initialData={exchangeRate} />
 */
export function ExchangeRateForm({
  initialData,
  onSuccess,
  onCancel,
}: ExchangeRateFormProps) {
  const router = useRouter()
  const t = useTranslations('exchangeRate')
  const { toast } = useToast()

  const isEditing = !!initialData

  // --- Mutations ---
  const createMutation = useCreateExchangeRate()
  const updateMutation = useUpdateExchangeRate()

  const isPending = createMutation.isPending || updateMutation.isPending

  // --- 處理日期字段 ---
  const parseDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return ''
    // 處理 ISO 格式或已是 YYYY-MM-DD 格式
    return dateStr.includes('T') ? dateStr.split('T')[0] : dateStr
  }

  // --- Form Setup ---
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fromCurrency: initialData?.fromCurrency || '',
      toCurrency: initialData?.toCurrency || '',
      rate: initialData?.rate?.toString() || '',
      effectiveYear: initialData?.effectiveYear || new Date().getFullYear(),
      effectiveFrom: parseDate(initialData?.effectiveFrom),
      effectiveTo: parseDate(initialData?.effectiveTo),
      description: initialData?.description || '',
      createInverse: false,
    },
  })

  // --- Watch values for dynamic UI ---
  const watchRate = form.watch('rate')
  const watchCreateInverse = form.watch('createInverse')
  const watchFromCurrency = form.watch('fromCurrency')
  const watchToCurrency = form.watch('toCurrency')

  // --- 計算反向匯率 ---
  const inverseRate = React.useMemo(() => {
    const rateNum = Number(watchRate)
    if (!rateNum || rateNum <= 0) return ''
    return (1 / rateNum).toFixed(8)
  }, [watchRate])

  // --- Submit Handler ---
  const onSubmit = async (values: FormValues) => {
    try {
      if (isEditing && initialData) {
        await updateMutation.mutateAsync({
          id: initialData.id,
          input: {
            rate: values.rate,
            effectiveFrom: values.effectiveFrom || null,
            effectiveTo: values.effectiveTo || null,
            description: values.description || null,
          },
        })
        toast({
          title: t('messages.updated'),
        })
      } else {
        await createMutation.mutateAsync({
          fromCurrency: values.fromCurrency,
          toCurrency: values.toCurrency,
          rate: values.rate,
          effectiveYear: values.effectiveYear,
          effectiveFrom: values.effectiveFrom || undefined,
          effectiveTo: values.effectiveTo || undefined,
          description: values.description || undefined,
          createInverse: values.createInverse,
        })
        toast({
          title: t('messages.created'),
        })
      }

      if (onSuccess) {
        onSuccess()
      } else {
        router.push('/admin/exchange-rates')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      })
    }
  }

  // --- Cancel Handler ---
  const handleCancel = () => {
    if (onCancel) {
      onCancel()
    } else {
      router.back()
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* 貨幣對選擇 */}
        <div className="flex items-end gap-4">
          <FormField
            control={form.control}
            name="fromCurrency"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>{t('form.fromCurrency')}</FormLabel>
                <FormControl>
                  <CurrencySelect
                    value={field.value}
                    onChange={field.onChange}
                    disabled={isEditing}
                    placeholder={t('validation.requiredCurrency')}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <ArrowRight className="h-6 w-6 mb-2 text-muted-foreground flex-shrink-0" />

          <FormField
            control={form.control}
            name="toCurrency"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>{t('form.toCurrency')}</FormLabel>
                <FormControl>
                  <CurrencySelect
                    value={field.value}
                    onChange={field.onChange}
                    disabled={isEditing}
                    placeholder={t('validation.requiredCurrency')}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* 匯率 */}
        <FormField
          control={form.control}
          name="rate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('form.rate')}</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.00000001"
                  min="0"
                  placeholder="0.00000000"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                {watchFromCurrency && watchToCurrency && watchRate
                  ? t('form.rateDescription', {
                      from: watchFromCurrency,
                      rate: watchRate,
                      to: watchToCurrency,
                    })
                  : t('form.rateDescription', {
                      from: '???',
                      rate: '?',
                      to: '???',
                    })}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 生效年份 */}
        <FormField
          control={form.control}
          name="effectiveYear"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('form.effectiveYear')}</FormLabel>
              <Select
                value={field.value.toString()}
                onValueChange={(v) => field.onChange(Number(v))}
                disabled={isEditing}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {YEARS.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 精確日期（選填） */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="effectiveFrom"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('form.effectiveFrom')}</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="effectiveTo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('form.effectiveTo')}</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
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
                  placeholder=""
                  className="resize-none"
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 反向匯率選項（僅新增時） */}
        {!isEditing && (
          <FormField
            control={form.control}
            name="createInverse"
            render={({ field }) => (
              <FormItem className="flex flex-col space-y-3 rounded-lg border p-4">
                <div className="flex items-center space-x-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel className="cursor-pointer font-normal">
                    {t('form.createInverse')}
                  </FormLabel>
                </div>

                {/* 反向匯率預覽 */}
                {watchCreateInverse && inverseRate && watchFromCurrency && watchToCurrency && (
                  <div className="flex items-center gap-2 pl-6 text-sm text-muted-foreground">
                    <RefreshCw className="h-4 w-4" />
                    <span>
                      {t('form.inversePreview')}: 1 {watchToCurrency} = {inverseRate}{' '}
                      {watchFromCurrency}
                    </span>
                  </div>
                )}
              </FormItem>
            )}
          />
        )}

        {/* 按鈕 */}
        <div className="flex gap-4">
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('form.submit')}
          </Button>
          <Button type="button" variant="outline" onClick={handleCancel}>
            {t('form.cancel')}
          </Button>
        </div>
      </form>
    </Form>
  )
}
