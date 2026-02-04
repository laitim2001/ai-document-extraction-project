# Tech Spec: Story 20.6 - 管理頁面 - 表單與導入

> **Version**: 1.0.0
> **Created**: 2026-02-04
> **Status**: Draft
> **Story Key**: STORY-20-6

---

## Overview

| 項目 | 內容 |
|------|------|
| **Story ID** | 20.6 |
| **Epic** | Epic 20 - Reference Number Master Setup |
| **Estimated Effort** | 6 Story Points |
| **Dependencies** | Story 20-4, 20-5 |
| **Blocking** | 無 |

---

## Objective

建立 Reference Number 的新增/編輯表單和批次導入對話框。

---

## Acceptance Criteria Mapping

| AC ID | 驗收條件 | 實現方式 |
|-------|----------|----------|
| AC-20.6.1 | 新增頁面 | /admin/reference-numbers/new |
| AC-20.6.2 | 編輯頁面 | /admin/reference-numbers/[id] |
| AC-20.6.3 | 表單驗證 | React Hook Form + Zod |
| AC-20.6.4 | 導入對話框 | ReferenceNumberImportDialog |
| AC-20.6.5 | 導入結果 | 統計和錯誤展示 |
| AC-20.6.6 | 導出功能 | ReferenceNumberExportButton |

---

## Implementation Guide

### Phase 1: 表單組件 (2 points)

```typescript
// src/components/features/reference-number/ReferenceNumberForm.tsx

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RegionSelect } from '@/components/features/region/RegionSelect';
import { DatePicker } from '@/components/ui/date-picker';
import { Loader2 } from 'lucide-react';
import type { ReferenceNumberType } from '@/types/reference-number';

const formSchema = z.object({
  number: z.string().min(1, '號碼不能為空').max(100),
  type: z.enum([
    'SHIPMENT',
    'DELIVERY',
    'BOOKING',
    'CONTAINER',
    'HAWB',
    'MAWB',
    'BL',
    'CUSTOMS',
    'OTHER',
  ]),
  year: z.number().int().min(2000).max(2100),
  regionId: z.string().min(1, '請選擇地區'),
  description: z.string().max(500).optional(),
  validFrom: z.date().optional().nullable(),
  validUntil: z.date().optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

interface ReferenceNumberFormProps {
  defaultValues?: Partial<FormValues>;
  onSubmit: (values: FormValues) => Promise<void>;
  isEditing?: boolean;
  code?: string;
  matchCount?: number;
}

export function ReferenceNumberForm({
  defaultValues,
  onSubmit,
  isEditing,
  code,
  matchCount,
}: ReferenceNumberFormProps) {
  const t = useTranslations('referenceNumber');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<FormValues>({
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
  });

  const handleSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* 唯讀資訊（編輯時顯示） */}
        {isEditing && (
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                {t('form.code')}
              </label>
              <p className="font-mono">{code}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                {t('form.matchCount')}
              </label>
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
                    {['SHIPMENT', 'DELIVERY', 'BOOKING', 'CONTAINER', 'HAWB', 'MAWB', 'BL', 'CUSTOMS', 'OTHER'].map(
                      (type) => (
                        <SelectItem key={type} value={type}>
                          {t(`types.${type}`)}
                        </SelectItem>
                      )
                    )}
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
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value))}
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
              <FormItem>
                <FormLabel>{t('form.validFrom')}</FormLabel>
                <FormControl>
                  <DatePicker
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={t('form.selectDate')}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="validUntil"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('form.validUntil')}</FormLabel>
                <FormControl>
                  <DatePicker
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={t('form.selectDate')}
                  />
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
          <Button type="button" variant="outline">
            {t('form.cancel')}
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? t('form.update') : t('form.create')}
          </Button>
        </div>
      </form>
    </Form>
  );
}
```

### Phase 2: 新增/編輯頁面 (1.5 points)

```typescript
// src/app/[locale]/(dashboard)/admin/reference-numbers/new/page.tsx

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { ReferenceNumberForm } from '@/components/features/reference-number/ReferenceNumberForm';
import { useCreateReferenceNumber } from '@/hooks/use-reference-numbers';
import { toast } from 'sonner';

export default function NewReferenceNumberPage() {
  const t = useTranslations('referenceNumber');
  const router = useRouter();
  const createMutation = useCreateReferenceNumber();

  const handleSubmit = async (values: unknown) => {
    try {
      await createMutation.mutateAsync(values);
      toast.success(t('messages.created'));
      router.push('/admin/reference-numbers');
    } catch (error) {
      toast.error(t('messages.createFailed'));
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('new.title')}</h1>
        <p className="text-muted-foreground">{t('new.description')}</p>
      </div>

      <ReferenceNumberForm onSubmit={handleSubmit} />
    </div>
  );
}
```

```typescript
// src/app/[locale]/(dashboard)/admin/reference-numbers/[id]/page.tsx

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { ReferenceNumberForm } from '@/components/features/reference-number/ReferenceNumberForm';
import { useReferenceNumber, useUpdateReferenceNumber } from '@/hooks/use-reference-numbers';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

interface EditPageProps {
  params: { id: string };
}

export default function EditReferenceNumberPage({ params }: EditPageProps) {
  const t = useTranslations('referenceNumber');
  const router = useRouter();
  const { data, isLoading } = useReferenceNumber(params.id);
  const updateMutation = useUpdateReferenceNumber();

  const handleSubmit = async (values: unknown) => {
    try {
      await updateMutation.mutateAsync({ id: params.id, data: values });
      toast.success(t('messages.updated'));
      router.push('/admin/reference-numbers');
    } catch (error) {
      toast.error(t('messages.updateFailed'));
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!data?.data) {
    return <div>{t('notFound')}</div>;
  }

  const item = data.data;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('edit.title')}</h1>
        <p className="text-muted-foreground">{t('edit.description')}</p>
      </div>

      <ReferenceNumberForm
        defaultValues={{
          number: item.number,
          type: item.type,
          year: item.year,
          regionId: item.regionId,
          description: item.description || '',
          validFrom: item.validFrom ? new Date(item.validFrom) : null,
          validUntil: item.validUntil ? new Date(item.validUntil) : null,
        }}
        onSubmit={handleSubmit}
        isEditing
        code={item.code}
        matchCount={item.matchCount}
      />
    </div>
  );
}
```

### Phase 3: 導入對話框 (2 points)

```typescript
// src/components/features/reference-number/ReferenceNumberImportDialog.tsx

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileJson, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { useImportReferenceNumbers } from '@/hooks/use-reference-numbers';

interface ReferenceNumberImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ReferenceNumberImportDialog({
  open,
  onOpenChange,
  onSuccess,
}: ReferenceNumberImportDialogProps) {
  const t = useTranslations('referenceNumber.import');
  const [file, setFile] = React.useState<File | null>(null);
  const [data, setData] = React.useState<any>(null);
  const [overwriteExisting, setOverwriteExisting] = React.useState(false);
  const [skipInvalid, setSkipInvalid] = React.useState(true);
  const [result, setResult] = React.useState<any>(null);

  const importMutation = useImportReferenceNumbers();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setResult(null);

    try {
      const text = await selectedFile.text();
      const parsed = JSON.parse(text);
      setData(parsed);
    } catch (error) {
      setData(null);
    }
  };

  const handleImport = async () => {
    if (!data) return;

    try {
      const response = await importMutation.mutateAsync({
        ...data,
        options: { overwriteExisting, skipInvalid },
      });
      setResult(response.data);
    } catch (error) {
      // handle error
    }
  };

  const handleClose = () => {
    if (result && result.imported > 0) {
      onSuccess();
    }
    setFile(null);
    setData(null);
    setResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 文件上傳 */}
          {!result && (
            <>
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileChange}
                  className="hidden"
                  id="import-file"
                />
                <label htmlFor="import-file" className="cursor-pointer">
                  {file ? (
                    <div className="flex items-center justify-center gap-2">
                      <FileJson className="h-8 w-8 text-blue-500" />
                      <div className="text-left">
                        <p className="font-medium">{file.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {data?.items?.length || 0} {t('items')}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                      <p>{t('dropzone')}</p>
                    </div>
                  )}
                </label>
              </div>

              {/* 選項 */}
              {data && (
                <div className="space-y-3">
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={overwriteExisting}
                      onCheckedChange={(v) => setOverwriteExisting(!!v)}
                    />
                    <span className="text-sm">{t('overwriteExisting')}</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={skipInvalid}
                      onCheckedChange={(v) => setSkipInvalid(!!v)}
                    />
                    <span className="text-sm">{t('skipInvalid')}</span>
                  </label>
                </div>
              )}
            </>
          )}

          {/* 結果 */}
          {result && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1">
                  <li>{t('result.imported', { count: result.imported })}</li>
                  <li>{t('result.updated', { count: result.updated })}</li>
                  <li>{t('result.skipped', { count: result.skipped })}</li>
                  {result.errors.length > 0 && (
                    <li className="text-destructive">
                      {t('result.errors', { count: result.errors.length })}
                    </li>
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* 錯誤詳情 */}
          {result?.errors?.length > 0 && (
            <div className="max-h-40 overflow-auto text-sm">
              {result.errors.map((err: any, i: number) => (
                <div key={i} className="flex gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>Row {err.index + 1}: {err.error}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 按鈕 */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose}>
            {result ? t('close') : t('cancel')}
          </Button>
          {!result && (
            <Button
              onClick={handleImport}
              disabled={!data || importMutation.isPending}
            >
              {importMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {t('import')}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### Phase 4: i18n 擴展 (0.5 points)

```json
// messages/zh-TW/referenceNumber.json (擴展)
{
  "form": {
    "code": "識別碼",
    "number": "號碼",
    "numberPlaceholder": "輸入號碼...",
    "type": "類型",
    "year": "年份",
    "region": "地區",
    "regionPlaceholder": "選擇地區...",
    "validFrom": "有效起始日",
    "validUntil": "有效結束日",
    "selectDate": "選擇日期",
    "description": "說明",
    "descriptionPlaceholder": "輸入說明...",
    "matchCount": "匹配次數",
    "cancel": "取消",
    "create": "建立",
    "update": "更新"
  },
  "new": {
    "title": "新增參考號碼",
    "description": "建立新的參考號碼記錄"
  },
  "edit": {
    "title": "編輯參考號碼",
    "description": "修改參考號碼資訊"
  },
  "import": {
    "title": "導入參考號碼",
    "description": "從 JSON 文件批次導入參考號碼",
    "dropzone": "點擊或拖放 JSON 文件",
    "items": "筆資料",
    "overwriteExisting": "覆蓋已存在的記錄",
    "skipInvalid": "跳過無效記錄",
    "import": "開始導入",
    "cancel": "取消",
    "close": "關閉",
    "result": {
      "imported": "導入：{count} 筆",
      "updated": "更新：{count} 筆",
      "skipped": "跳過：{count} 筆",
      "errors": "錯誤：{count} 筆"
    }
  },
  "messages": {
    "created": "建立成功",
    "createFailed": "建立失敗",
    "updated": "更新成功",
    "updateFailed": "更新失敗"
  },
  "notFound": "找不到此記錄"
}
```

---

## File Structure

```
src/app/[locale]/(dashboard)/admin/reference-numbers/
├── new/
│   └── page.tsx                      # 新增
└── [id]/
    └── page.tsx                      # 新增

src/components/features/reference-number/
├── ReferenceNumberForm.tsx           # 新增
├── ReferenceNumberImportDialog.tsx   # 新增
└── ReferenceNumberExportButton.tsx   # 新增
```

---

## Testing Checklist

- [ ] 新增表單驗證正常
- [ ] 新增提交成功後跳轉
- [ ] 編輯頁載入現有資料
- [ ] 編輯顯示唯讀欄位
- [ ] 導入對話框文件上傳
- [ ] 導入預覽項目數量
- [ ] 導入選項正常
- [ ] 導入結果統計
- [ ] 導入錯誤展示
- [ ] i18n 翻譯正確
