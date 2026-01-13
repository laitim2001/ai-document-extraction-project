# Tech Spec: Story 16.2 - 格式詳情與編輯

> **Version**: 1.0.0
> **Created**: 2026-01-12
> **Status**: Draft
> **Story Key**: STORY-16-2

---

## Overview

| 項目 | 內容 |
|------|------|
| **Story ID** | 16.2 |
| **Epic** | Epic 16 - 文件格式管理 |
| **Estimated Effort** | 5 Story Points |
| **Dependencies** | Story 16-1（格式列表 Tab） |
| **Blocking** | Story 16-3（識別規則配置）, Story 16-4（專屬配置關聯） |

---

## Objective

建立格式詳情頁面（`/companies/[id]/formats/[formatId]`），支援查看和編輯格式基本信息、常見術語、關聯文件。

---

## Acceptance Criteria Mapping

| AC ID | 驗收條件 | 實現方式 |
|-------|----------|----------|
| AC-16.2.1 | 格式詳情頁面 | Next.js 動態路由頁面 |
| AC-16.2.2 | 基本資訊顯示 | FormatBasicInfo 組件 |
| AC-16.2.3 | 編輯功能 | FormatForm 組件 + PATCH API |
| AC-16.2.4 | 常見術語列表 | FormatTermsTable 組件 |
| AC-16.2.5 | 文件列表 | FormatFilesTable 組件 |

---

## Implementation Guide

### Phase 1: API 端點 (1.5 points)

#### 1.1 GET /api/v1/formats/[id]

```typescript
// src/app/api/v1/formats/[id]/route.ts

/**
 * @fileoverview 格式詳情 API
 * @module src/app/api/v1/formats/[id]
 * @since Epic 16 - Story 16.2
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createApiResponse, createApiError } from '@/lib/api/response';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const format = await prisma.documentFormat.findUnique({
      where: { id: params.id },
      include: {
        company: {
          select: { id: true, name: true, code: true },
        },
        _count: {
          select: { files: true },
        },
      },
    });

    if (!format) {
      return NextResponse.json(
        createApiError({
          type: 'NOT_FOUND',
          title: 'Format not found',
          status: 404,
          detail: `Format with id ${params.id} not found`,
        }),
        { status: 404 }
      );
    }

    return NextResponse.json(
      createApiResponse({
        ...format,
        fileCount: format._count.files,
      })
    );
  } catch (error) {
    return NextResponse.json(
      createApiError(error),
      { status: 500 }
    );
  }
}
```

#### 1.2 PATCH /api/v1/formats/[id]

```typescript
// src/app/api/v1/formats/[id]/route.ts (continued)

import { z } from 'zod';

const updateFormatSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  features: z.object({
    hasLineItems: z.boolean().optional(),
    hasHeaderLogo: z.boolean().optional(),
    currency: z.string().optional(),
    language: z.string().optional(),
    typicalFields: z.array(z.string()).optional(),
    layoutPattern: z.string().optional(),
  }).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const validated = updateFormatSchema.parse(body);

    const format = await prisma.documentFormat.update({
      where: { id: params.id },
      data: validated,
      include: {
        company: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    return NextResponse.json(createApiResponse(format));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        createApiError({
          type: 'VALIDATION_ERROR',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid request body',
          errors: error.errors,
        }),
        { status: 400 }
      );
    }
    return NextResponse.json(
      createApiError(error),
      { status: 500 }
    );
  }
}
```

### Phase 2: 詳情頁面 (1 point)

#### 2.1 頁面路由

```typescript
// src/app/(dashboard)/companies/[id]/formats/[formatId]/page.tsx

/**
 * @fileoverview 格式詳情頁面
 * @module src/app/(dashboard)/companies/[id]/formats/[formatId]
 * @since Epic 16 - Story 16.2
 */

import { FormatDetailView } from '@/components/features/formats/FormatDetailView';

interface PageProps {
  params: {
    id: string;
    formatId: string;
  };
}

export default function FormatDetailPage({ params }: PageProps) {
  return (
    <FormatDetailView
      companyId={params.id}
      formatId={params.formatId}
    />
  );
}
```

### Phase 3: 詳情視圖組件 (1.5 points)

#### 3.1 FormatDetailView

```typescript
// src/components/features/formats/FormatDetailView.tsx

/**
 * @fileoverview 格式詳情視圖
 * @module src/components/features/formats
 * @since Epic 16 - Story 16.2
 */

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Edit } from 'lucide-react';
import { useFormatDetail } from '@/hooks/use-format-detail';
import { FormatBasicInfo } from './FormatBasicInfo';
import { FormatTermsTable } from './FormatTermsTable';
import { FormatFilesTable } from './FormatFilesTable';
import { FormatForm } from './FormatForm';

export interface FormatDetailViewProps {
  companyId: string;
  formatId: string;
}

export function FormatDetailView({ companyId, formatId }: FormatDetailViewProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = React.useState(false);
  const { format, isLoading, error, refetch } = useFormatDetail(formatId);

  if (isLoading) {
    return <FormatDetailSkeleton />;
  }

  if (error || !format) {
    return <FormatDetailError error={error} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {format.name || `${format.documentType} - ${format.documentSubtype}`}
            </h1>
            <p className="text-sm text-muted-foreground">
              {format.company.name}
            </p>
          </div>
        </div>
        <Button onClick={() => setIsEditing(true)}>
          <Edit className="h-4 w-4 mr-2" />
          編輯
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="basic">
        <TabsList>
          <TabsTrigger value="basic">基本資訊</TabsTrigger>
          <TabsTrigger value="terms">常見術語</TabsTrigger>
          <TabsTrigger value="files">文件列表</TabsTrigger>
          {/* Story 16-3: <TabsTrigger value="rules">識別規則</TabsTrigger> */}
          {/* Story 16-4: <TabsTrigger value="configs">專屬配置</TabsTrigger> */}
        </TabsList>

        <TabsContent value="basic">
          <FormatBasicInfo format={format} />
        </TabsContent>

        <TabsContent value="terms">
          <FormatTermsTable terms={format.commonTerms} />
        </TabsContent>

        <TabsContent value="files">
          <FormatFilesTable formatId={formatId} />
        </TabsContent>
      </Tabs>

      {/* 編輯 Dialog */}
      {isEditing && (
        <FormatForm
          format={format}
          open={isEditing}
          onClose={() => setIsEditing(false)}
          onSuccess={() => {
            setIsEditing(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}
```

#### 3.2 FormatBasicInfo

```typescript
// src/components/features/formats/FormatBasicInfo.tsx

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/utils';
import type { DocumentFormatDetail } from '@/types/document-format';

export interface FormatBasicInfoProps {
  format: DocumentFormatDetail;
}

export function FormatBasicInfo({ format }: FormatBasicInfoProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">格式資訊</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <InfoRow label="格式名稱" value={format.name || '-'} />
          <InfoRow label="文件類型" value={format.documentType} />
          <InfoRow label="文件子類型" value={format.documentSubtype} />
          <InfoRow label="文件數量" value={format.fileCount.toString()} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">格式特徵</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {format.features && (
            <>
              <InfoRow
                label="包含明細項目"
                value={format.features.hasLineItems ? '是' : '否'}
              />
              <InfoRow
                label="包含公司 Logo"
                value={format.features.hasHeaderLogo ? '是' : '否'}
              />
              <InfoRow label="貨幣" value={format.features.currency || '-'} />
              <InfoRow label="語言" value={format.features.language || '-'} />
            </>
          )}
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">時間資訊</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-8">
          <InfoRow label="創建時間" value={formatDateTime(format.createdAt)} />
          <InfoRow label="更新時間" value={formatDateTime(format.updatedAt)} />
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
```

### Phase 4: 編輯表單 (1 point)

#### 4.1 FormatForm

```typescript
// src/components/features/formats/FormatForm.tsx

'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  name: z.string().min(1, '請輸入格式名稱').max(200),
});

export interface FormatFormProps {
  format: DocumentFormatDetail;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function FormatForm({ format, open, onClose, onSuccess }: FormatFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: format.name || '',
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/v1/formats/${format.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        throw new Error('更新失敗');
      }

      toast({
        title: '更新成功',
        description: '格式資訊已更新',
      });
      onSuccess();
    } catch (error) {
      toast({
        title: '更新失敗',
        description: error instanceof Error ? error.message : '請稍後再試',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>編輯格式</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>格式名稱</FormLabel>
                  <FormControl>
                    <Input placeholder="輸入格式名稱" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                取消
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? '保存中...' : '保存'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

---

## File Structure

```
src/
├── app/
│   ├── (dashboard)/companies/[id]/formats/[formatId]/
│   │   └── page.tsx
│   └── api/v1/formats/[id]/
│       └── route.ts
├── components/features/formats/
│   ├── FormatDetailView.tsx
│   ├── FormatBasicInfo.tsx
│   ├── FormatForm.tsx
│   ├── FormatTermsTable.tsx
│   └── FormatFilesTable.tsx
└── hooks/
    └── use-format-detail.ts
```

---

## Testing Checklist

- [ ] TypeScript 類型檢查通過
- [ ] ESLint 檢查通過
- [ ] GET API 返回正確數據
- [ ] PATCH API 正確更新
- [ ] 詳情頁面正確顯示
- [ ] 編輯功能正常運作
- [ ] 術語表格正常顯示
