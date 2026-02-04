# Tech Spec: Story 21.7 - 管理頁面：表單

> **Version**: 1.0.0
> **Created**: 2026-02-04
> **Status**: Draft
> **Story Key**: STORY-21-7

---

## Overview

| 項目 | 內容 |
|------|------|
| **Story ID** | 21.7 |
| **Epic** | Epic 21 - Exchange Rate Management |
| **Estimated Effort** | 4 Story Points |
| **Dependencies** | Story 21-6 |
| **Blocking** | Story 21-8 |

---

## Objective

建立匯率新增/編輯表單，包含貨幣選擇器和反向匯率自動建立選項。

---

## Acceptance Criteria Mapping

| AC ID | 驗收條件 | 實現方式 |
|-------|----------|----------|
| AC-21.7.1 | 新增頁面 | /admin/exchange-rates/new |
| AC-21.7.2 | 編輯頁面 | /admin/exchange-rates/[id] |
| AC-21.7.3 | 貨幣選擇 | CurrencySelect 整合 |
| AC-21.7.4 | 反向匯率選項 | createInverse + 預覽 |
| AC-21.7.5 | 表單驗證 | React Hook Form + Zod |
| AC-21.7.6 | 成功處理 | Toast + 導向 |

---

## Implementation Guide

### Phase 1: i18n 擴展 (0.5 points)

```json
// messages/en/exchangeRate.json (擴展)
{
  "form": {
    "title": {
      "create": "Add Exchange Rate",
      "edit": "Edit Exchange Rate"
    },
    "fromCurrency": "From Currency",
    "toCurrency": "To Currency",
    "rate": "Exchange Rate",
    "effectiveYear": "Effective Year",
    "effectiveFrom": "Effective From (Optional)",
    "effectiveTo": "Effective To (Optional)",
    "description": "Description (Optional)",
    "createInverse": "Create inverse rate automatically",
    "inversePreview": "Inverse rate preview",
    "submit": "Save",
    "cancel": "Cancel"
  },
  "validation": {
    "sameCurrency": "From and to currency cannot be the same",
    "invalidRate": "Please enter a valid exchange rate",
    "requiredCurrency": "Please select a currency",
    "requiredRate": "Exchange rate is required",
    "requiredYear": "Effective year is required"
  }
}
```

```json
// messages/zh-TW/exchangeRate.json (擴展)
{
  "form": {
    "title": {
      "create": "新增匯率",
      "edit": "編輯匯率"
    },
    "fromCurrency": "來源貨幣",
    "toCurrency": "目標貨幣",
    "rate": "匯率",
    "effectiveYear": "生效年份",
    "effectiveFrom": "生效日期（選填）",
    "effectiveTo": "結束日期（選填）",
    "description": "說明（選填）",
    "createInverse": "同時建立反向匯率",
    "inversePreview": "反向匯率預覽",
    "submit": "儲存",
    "cancel": "取消"
  },
  "validation": {
    "sameCurrency": "來源和目標貨幣不能相同",
    "invalidRate": "請輸入有效的匯率",
    "requiredCurrency": "請選擇貨幣",
    "requiredRate": "匯率為必填",
    "requiredYear": "生效年份為必填"
  }
}
```

### Phase 2: ExchangeRateForm 組件 (2 points)

```typescript
// src/components/features/exchange-rate/ExchangeRateForm.tsx

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CurrencySelect } from './CurrencySelect';
import { useCreateExchangeRate, useUpdateExchangeRate } from '@/hooks/use-exchange-rates';
import { useToast } from '@/hooks/use-toast';
import type { ExchangeRateWithRelations } from '@/types/exchange-rate';

const formSchema = z.object({
  fromCurrency: z.string().length(3, 'Please select a currency'),
  toCurrency: z.string().length(3, 'Please select a currency'),
  rate: z.string().min(1, 'Rate is required').transform(Number).pipe(z.number().positive()),
  effectiveYear: z.number().int().min(2000).max(2100),
  effectiveFrom: z.string().optional(),
  effectiveTo: z.string().optional(),
  description: z.string().max(500).optional(),
  createInverse: z.boolean().default(false),
}).refine(
  (data) => data.fromCurrency !== data.toCurrency,
  { message: 'From and to currency cannot be the same', path: ['toCurrency'] }
);

type FormValues = z.input<typeof formSchema>;

interface ExchangeRateFormProps {
  initialData?: ExchangeRateWithRelations;
  onSuccess?: () => void;
}

const YEARS = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + 1 - i);

export function ExchangeRateForm({ initialData, onSuccess }: ExchangeRateFormProps) {
  const router = useRouter();
  const t = useTranslations('exchangeRate');
  const { toast } = useToast();

  const isEditing = !!initialData;

  const createMutation = useCreateExchangeRate();
  const updateMutation = useUpdateExchangeRate();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fromCurrency: initialData?.fromCurrency || '',
      toCurrency: initialData?.toCurrency || '',
      rate: initialData?.rate?.toString() || '',
      effectiveYear: initialData?.effectiveYear || new Date().getFullYear(),
      effectiveFrom: initialData?.effectiveFrom?.split('T')[0] || '',
      effectiveTo: initialData?.effectiveTo?.split('T')[0] || '',
      description: initialData?.description || '',
      createInverse: false,
    },
  });

  const watchRate = form.watch('rate');
  const watchCreateInverse = form.watch('createInverse');
  const watchFromCurrency = form.watch('fromCurrency');
  const watchToCurrency = form.watch('toCurrency');

  // 計算反向匯率
  const inverseRate = React.useMemo(() => {
    const rateNum = Number(watchRate);
    if (!rateNum || rateNum <= 0) return '';
    return (1 / rateNum).toFixed(8);
  }, [watchRate]);

  const onSubmit = async (values: FormValues) => {
    try {
      if (isEditing) {
        await updateMutation.mutateAsync({
          id: initialData.id,
          data: {
            rate: values.rate,
            effectiveFrom: values.effectiveFrom || null,
            effectiveTo: values.effectiveTo || null,
            description: values.description || null,
          },
        });
        toast({
          title: t('messages.updated'),
        });
      } else {
        await createMutation.mutateAsync(values);
        toast({
          title: t('messages.created'),
        });
      }

      if (onSuccess) {
        onSuccess();
      } else {
        router.push('/admin/exchange-rates');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    }
  };

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
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <ArrowRight className="h-6 w-6 mb-2 text-muted-foreground" />

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
                  placeholder="0.00000000"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                1 {watchFromCurrency || '???'} = {watchRate || '?'} {watchToCurrency || '???'}
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
        <div className="grid grid-cols-2 gap-4">
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
                <Textarea {...field} />
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
              <FormItem className="flex items-start space-x-3 space-y-0 rounded-lg border p-4">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="cursor-pointer">
                    {t('form.createInverse')}
                  </FormLabel>
                  {watchCreateInverse && inverseRate && (
                    <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                      <RefreshCw className="h-4 w-4" />
                      <span>
                        {t('form.inversePreview')}: 1 {watchToCurrency} = {inverseRate} {watchFromCurrency}
                      </span>
                    </div>
                  )}
                </div>
              </FormItem>
            )}
          />
        )}

        {/* 按鈕 */}
        <div className="flex gap-4">
          <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
            {t('form.submit')}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            {t('form.cancel')}
          </Button>
        </div>
      </form>
    </Form>
  );
}
```

### Phase 3: 新增頁面 (0.75 points)

```typescript
// src/app/[locale]/(dashboard)/admin/exchange-rates/new/page.tsx

import { getTranslations } from 'next-intl/server';
import { ExchangeRateForm } from '@/components/features/exchange-rate';

export default async function NewExchangeRatePage() {
  const t = await getTranslations('exchangeRate');

  return (
    <div className="container max-w-2xl py-6">
      <h1 className="text-2xl font-bold mb-6">{t('form.title.create')}</h1>
      <ExchangeRateForm />
    </div>
  );
}
```

### Phase 4: 編輯頁面 (0.75 points)

```typescript
// src/app/[locale]/(dashboard)/admin/exchange-rates/[id]/page.tsx

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useExchangeRate } from '@/hooks/use-exchange-rates';
import { ExchangeRateForm } from '@/components/features/exchange-rate';

interface EditExchangeRatePageProps {
  params: { id: string };
}

export default function EditExchangeRatePage({ params }: EditExchangeRatePageProps) {
  const t = useTranslations('exchangeRate');
  const { data, isLoading, error } = useExchangeRate(params.id);

  if (isLoading) {
    return (
      <div className="container max-w-2xl py-6">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  if (error || !data?.data) {
    return (
      <div className="container max-w-2xl py-6">
        <div className="text-destructive">Error loading exchange rate</div>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-6">
      <h1 className="text-2xl font-bold mb-6">{t('form.title.edit')}</h1>
      <ExchangeRateForm initialData={data.data} />
    </div>
  );
}
```

---

## File Structure

```
src/
├── app/[locale]/(dashboard)/admin/exchange-rates/
│   ├── new/page.tsx                         # 新增
│   └── [id]/page.tsx                        # 新增
└── components/features/exchange-rate/
    └── ExchangeRateForm.tsx                 # 新增
```

---

## Testing Checklist

- [ ] 新增頁面正確顯示空白表單
- [ ] 編輯頁面正確載入現有資料
- [ ] 貨幣選擇器正常運作
- [ ] 同一貨幣驗證正確
- [ ] 反向匯率預覽正確計算
- [ ] 表單驗證正確顯示錯誤
- [ ] 提交成功顯示 Toast
- [ ] 提交後正確導向列表頁
- [ ] i18n 翻譯正確
