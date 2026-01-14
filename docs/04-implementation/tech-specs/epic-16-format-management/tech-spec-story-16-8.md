# Tech Spec: Story 16.8 - 手動建立格式

> **Version**: 1.0.0
> **Created**: 2026-01-14
> **Status**: Draft
> **Story Key**: STORY-16-8

---

## Overview

| 項目 | 內容 |
|------|------|
| **Story ID** | 16.8 |
| **Epic** | Epic 16 - 文件格式管理 |
| **Estimated Effort** | 5 Story Points |
| **Dependencies** | Story 16-1（FormatList 組件） |
| **Blocking** | 無 |

---

## Objective

允許用戶在公司詳情頁面主動建立文件格式，而不需要等待文件上傳後自動識別。

### 問題背景

目前 `DocumentFormat` 只能在文件上傳處理時通過 `processDocumentFormat()` 自動建立。當公司沒有任何已識別的格式時，格式 Tab 只顯示「尚無已識別的格式」，用戶無法：
1. 提前建立格式
2. 預先配置識別規則
3. 設定格式專屬的映射規則

---

## Acceptance Criteria Mapping

| AC ID | 驗收條件 | 實現方式 |
|-------|----------|----------|
| AC-16.8.1 | 格式 Tab 顯示「建立格式」按鈕 | FormatList 整合 CreateFormatDialog |
| AC-16.8.2 | 可選擇文件類型和子類型 | Select 組件 + DocumentType/DocumentSubtype enum |
| AC-16.8.3 | 可輸入自定義格式名稱 | Input 組件（選填） |
| AC-16.8.4 | 可選擇自動建立配置 | Switch 組件（FieldMappingConfig / PromptConfig） |
| AC-16.8.5 | 建立成功後列表自動刷新 | React Query invalidation |
| AC-16.8.6 | 重複格式顯示友善錯誤 | 409 Conflict 處理 |
| AC-16.8.7 | API 端點 | POST /api/v1/formats |

---

## Implementation Guide

### Phase 1: Validation Schema (0.5 points)

#### 1.1 擴展 document-format.ts

```typescript
// src/validations/document-format.ts

import { z } from 'zod';
import { DocumentType, DocumentSubtype } from '@prisma/client';

/**
 * 建立文件格式 Schema
 */
export const createDocumentFormatSchema = z.object({
  companyId: z.string().cuid('無效的公司 ID'),
  documentType: z.nativeEnum(DocumentType, {
    message: '請選擇文件類型',
  }),
  documentSubtype: z.nativeEnum(DocumentSubtype, {
    message: '請選擇文件子類型',
  }),
  name: z.string().min(1).max(200).optional(),
  autoCreateConfigs: z.object({
    fieldMapping: z.boolean().default(false),
    promptConfig: z.boolean().default(false),
  }).optional(),
});

export type CreateDocumentFormatInput = z.infer<typeof createDocumentFormatSchema>;
```

---

### Phase 2: Service Layer (1.5 points)

#### 2.1 新增 createDocumentFormatManually()

```typescript
// src/services/document-format.service.ts

import { prisma } from '@/lib/prisma';
import { DocumentType, DocumentSubtype, FieldMappingScope, PromptScope, PromptType } from '@prisma/client';

interface CreateFormatManuallyInput {
  companyId: string;
  documentType: DocumentType;
  documentSubtype: DocumentSubtype;
  name?: string;
  autoCreateConfigs?: {
    fieldMapping?: boolean;
    promptConfig?: boolean;
  };
}

interface CreateFormatManuallyResult {
  format: {
    id: string;
    companyId: string;
    documentType: DocumentType;
    documentSubtype: DocumentSubtype;
    name: string | null;
    createdAt: Date;
  };
  createdConfigs?: {
    fieldMappingConfig?: { id: string; name: string };
    promptConfigs?: Array<{ id: string; name: string; promptType: PromptType }>;
  };
}

/**
 * 手動建立文件格式
 */
export async function createDocumentFormatManually(
  input: CreateFormatManuallyInput
): Promise<CreateFormatManuallyResult> {
  const { companyId, documentType, documentSubtype, name, autoCreateConfigs } = input;

  // 1. 驗證公司存在
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true },
  });

  if (!company) {
    throw new Error('COMPANY_NOT_FOUND');
  }

  // 2. 檢查格式是否已存在
  const existingFormat = await prisma.documentFormat.findUnique({
    where: {
      companyId_documentType_documentSubtype: {
        companyId,
        documentType,
        documentSubtype,
      },
    },
  });

  if (existingFormat) {
    throw new Error('FORMAT_ALREADY_EXISTS');
  }

  // 3. 生成格式名稱
  const formatName = name || generateFormatName(company.name, documentType, documentSubtype);

  // 4. 使用事務建立格式和配置
  return await prisma.$transaction(async (tx) => {
    // 建立格式
    const format = await tx.documentFormat.create({
      data: {
        companyId,
        documentType,
        documentSubtype,
        name: formatName,
        features: {},
        identificationRules: {
          logoPatterns: [],
          keywords: [],
          layoutHints: '',
          priority: 50,
        },
        commonTerms: [],
        fileCount: 0,
      },
    });

    const result: CreateFormatManuallyResult = { format };

    // 建立自動配置
    if (autoCreateConfigs?.fieldMapping) {
      const fieldMappingConfig = await tx.fieldMappingConfig.create({
        data: {
          scope: FieldMappingScope.FORMAT,
          companyId,
          documentFormatId: format.id,
          name: `${formatName} - 欄位映射`,
          description: `自動建立的 ${formatName} 格式專屬映射配置`,
          isActive: true,
          version: 1,
        },
      });

      result.createdConfigs = {
        ...result.createdConfigs,
        fieldMappingConfig: {
          id: fieldMappingConfig.id,
          name: fieldMappingConfig.name,
        },
      };
    }

    if (autoCreateConfigs?.promptConfig) {
      const promptConfig = await tx.promptConfig.create({
        data: {
          promptType: PromptType.FIELD_EXTRACTION,
          scope: PromptScope.FORMAT,
          companyId,
          documentFormatId: format.id,
          name: `${formatName} - 欄位提取`,
          description: `自動建立的 ${formatName} 格式專屬 Prompt`,
          systemPrompt: '你是一個專業的文件提取助手。',
          userPromptTemplate: '請從以下文件中提取相關欄位。',
          mergeStrategy: 'OVERRIDE',
          isActive: true,
          version: 1,
        },
      });

      result.createdConfigs = {
        ...result.createdConfigs,
        promptConfigs: [{
          id: promptConfig.id,
          name: promptConfig.name,
          promptType: promptConfig.promptType,
        }],
      };
    }

    return result;
  });
}

/**
 * 生成格式名稱
 */
function generateFormatName(
  companyName: string,
  documentType: DocumentType,
  documentSubtype: DocumentSubtype
): string {
  const typeLabels: Record<DocumentType, string> = {
    INVOICE: '發票',
    DEBIT_NOTE: '借項通知',
    CREDIT_NOTE: '貸項通知',
    STATEMENT: '對帳單',
    QUOTATION: '報價單',
    BILL_OF_LADING: '提單',
    CUSTOMS_DECLARATION: '報關單',
    OTHER: '其他',
  };

  const subtypeLabels: Record<DocumentSubtype, string> = {
    OCEAN_FREIGHT: '海運',
    AIR_FREIGHT: '空運',
    LAND_TRANSPORT: '陸運',
    CUSTOMS_CLEARANCE: '報關',
    WAREHOUSING: '倉儲',
    GENERAL: '一般',
  };

  return `${companyName} - ${subtypeLabels[documentSubtype]}${typeLabels[documentType]}`;
}
```

---

### Phase 3: API Endpoint (1 point)

#### 3.1 新增 POST handler

```typescript
// src/app/api/v1/formats/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createDocumentFormatSchema } from '@/validations/document-format';
import { createDocumentFormatManually } from '@/services/document-format.service';

/**
 * POST /api/v1/formats
 * 手動建立文件格式
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = createDocumentFormatSchema.parse(body);

    const result = await createDocumentFormatManually(input);

    return NextResponse.json({
      success: true,
      data: result,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'COMPANY_NOT_FOUND') {
        return NextResponse.json({
          success: false,
          error: {
            type: 'https://api.example.com/errors/not-found',
            title: 'Company Not Found',
            status: 404,
            detail: '指定的公司不存在',
          },
        }, { status: 404 });
      }

      if (error.message === 'FORMAT_ALREADY_EXISTS') {
        return NextResponse.json({
          success: false,
          error: {
            type: 'https://api.example.com/errors/conflict',
            title: 'Format Already Exists',
            status: 409,
            detail: '此公司已存在相同類型的格式',
          },
        }, { status: 409 });
      }
    }

    // Zod 驗證錯誤
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: '請求資料驗證失敗',
          errors: error.errors,
        },
      }, { status: 400 });
    }

    console.error('[API] Error creating format:', error);
    return NextResponse.json({
      success: false,
      error: {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: '建立格式時發生錯誤',
      },
    }, { status: 500 });
  }
}
```

---

### Phase 4: React Query Hook (0.5 points)

#### 4.1 新增 useCreateFormat

```typescript
// src/hooks/use-company-formats.ts

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import type { CreateDocumentFormatInput } from '@/validations/document-format';

export function useCreateFormat(companyId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: Omit<CreateDocumentFormatInput, 'companyId'>) => {
      const response = await fetch('/api/v1/formats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, companyId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.detail || '建立失敗');
      }

      return data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['company-formats', companyId] });
      toast({
        title: '格式已建立',
        description: `「${data.format.name}」已成功建立`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: '建立失敗',
        description: error.message,
      });
    },
  });
}
```

---

### Phase 5: UI Component (1.5 points)

#### 5.1 CreateFormatDialog 組件

```typescript
// src/components/features/formats/CreateFormatDialog.tsx

'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { DocumentType, DocumentSubtype } from '@prisma/client';
import { Plus, Loader2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Switch } from '@/components/ui/switch';
import { useCreateFormat } from '@/hooks/use-company-formats';

// Schema
const formSchema = z.object({
  documentType: z.nativeEnum(DocumentType),
  documentSubtype: z.nativeEnum(DocumentSubtype),
  name: z.string().optional(),
  autoCreateFieldMapping: z.boolean().default(false),
  autoCreatePromptConfig: z.boolean().default(false),
});

type FormData = z.infer<typeof formSchema>;

// Types
interface CreateFormatDialogProps {
  companyId: string;
  triggerVariant?: 'default' | 'outline' | 'ghost';
  className?: string;
  onSuccess?: () => void;
}

// Labels
const documentTypeLabels: Record<DocumentType, string> = {
  INVOICE: '發票',
  DEBIT_NOTE: '借項通知單',
  CREDIT_NOTE: '貸項通知單',
  STATEMENT: '對帳單',
  QUOTATION: '報價單',
  BILL_OF_LADING: '提單',
  CUSTOMS_DECLARATION: '報關單',
  OTHER: '其他',
};

const documentSubtypeLabels: Record<DocumentSubtype, string> = {
  OCEAN_FREIGHT: '海運',
  AIR_FREIGHT: '空運',
  LAND_TRANSPORT: '陸運',
  CUSTOMS_CLEARANCE: '報關',
  WAREHOUSING: '倉儲',
  GENERAL: '一般',
};

export function CreateFormatDialog({
  companyId,
  triggerVariant = 'default',
  className,
  onSuccess,
}: CreateFormatDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const { mutate: createFormat, isPending } = useCreateFormat(companyId);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      documentType: undefined,
      documentSubtype: undefined,
      name: '',
      autoCreateFieldMapping: false,
      autoCreatePromptConfig: false,
    },
  });

  const handleSubmit = (data: FormData) => {
    createFormat(
      {
        documentType: data.documentType,
        documentSubtype: data.documentSubtype,
        name: data.name || undefined,
        autoCreateConfigs: {
          fieldMapping: data.autoCreateFieldMapping,
          promptConfig: data.autoCreatePromptConfig,
        },
      },
      {
        onSuccess: () => {
          setOpen(false);
          form.reset();
          onSuccess?.();
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} className={className}>
          <Plus className="mr-2 h-4 w-4" />
          建立格式
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>建立文件格式</DialogTitle>
          <DialogDescription>
            為此公司建立新的文件格式，用於管理特定類型文件的處理配置。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <div className="grid gap-4 py-4">
            {/* 文件類型 */}
            <div className="grid gap-2">
              <Label htmlFor="documentType">文件類型 *</Label>
              <Select
                value={form.watch('documentType')}
                onValueChange={(value) => form.setValue('documentType', value as DocumentType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="請選擇" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(documentTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 文件子類型 */}
            <div className="grid gap-2">
              <Label htmlFor="documentSubtype">文件子類型 *</Label>
              <Select
                value={form.watch('documentSubtype')}
                onValueChange={(value) => form.setValue('documentSubtype', value as DocumentSubtype)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="請選擇" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(documentSubtypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 格式名稱 */}
            <div className="grid gap-2">
              <Label htmlFor="name">格式名稱（選填）</Label>
              <Input
                id="name"
                placeholder="留空時將自動生成"
                {...form.register('name')}
              />
            </div>

            {/* 進階選項 */}
            <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-start">
                  {showAdvanced ? '收起' : '展開'}進階選項
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="fieldMapping">建立欄位映射配置</Label>
                    <p className="text-xs text-muted-foreground">
                      自動建立格式專屬的欄位映射配置
                    </p>
                  </div>
                  <Switch
                    id="fieldMapping"
                    checked={form.watch('autoCreateFieldMapping')}
                    onCheckedChange={(checked) => form.setValue('autoCreateFieldMapping', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="promptConfig">建立 Prompt 配置</Label>
                    <p className="text-xs text-muted-foreground">
                      自動建立格式專屬的 AI Prompt 配置
                    </p>
                  </div>
                  <Switch
                    id="promptConfig"
                    checked={form.watch('autoCreatePromptConfig')}
                    onCheckedChange={(checked) => form.setValue('autoCreatePromptConfig', checked)}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              建立格式
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

---

### Phase 6: Integration (0.5 points)

#### 6.1 修改 FormatList.tsx

```typescript
// src/components/features/formats/FormatList.tsx

// 在 FormatListEmpty 中添加建立按鈕
function FormatListEmpty({ companyId }: { companyId: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <FileText className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium mb-2">尚無已識別的格式</h3>
      <p className="text-sm text-muted-foreground max-w-md mb-4">
        您可以手動建立格式，或在上傳文件後系統會自動識別。
      </p>
      <CreateFormatDialog companyId={companyId} />
    </div>
  );
}

// 在統計資訊旁添加建立按鈕
<div className="mb-4 flex items-center justify-between">
  <div className="text-sm text-muted-foreground">
    共 {pagination.total} 個格式
  </div>
  <CreateFormatDialog companyId={companyId} />
</div>
```

---

## Testing

### Unit Tests

```typescript
// tests/unit/services/document-format.test.ts

describe('createDocumentFormatManually', () => {
  it('should create format with valid input', async () => {
    const result = await createDocumentFormatManually({
      companyId: 'valid-company-id',
      documentType: 'INVOICE',
      documentSubtype: 'OCEAN_FREIGHT',
    });

    expect(result.format).toBeDefined();
    expect(result.format.documentType).toBe('INVOICE');
  });

  it('should throw COMPANY_NOT_FOUND for invalid company', async () => {
    await expect(createDocumentFormatManually({
      companyId: 'invalid-id',
      documentType: 'INVOICE',
      documentSubtype: 'OCEAN_FREIGHT',
    })).rejects.toThrow('COMPANY_NOT_FOUND');
  });

  it('should throw FORMAT_ALREADY_EXISTS for duplicate', async () => {
    // 建立第一個
    await createDocumentFormatManually({...});

    // 嘗試建立重複的
    await expect(createDocumentFormatManually({...}))
      .rejects.toThrow('FORMAT_ALREADY_EXISTS');
  });

  it('should create FieldMappingConfig when autoCreateConfigs.fieldMapping is true', async () => {
    const result = await createDocumentFormatManually({
      companyId: 'valid-company-id',
      documentType: 'INVOICE',
      documentSubtype: 'OCEAN_FREIGHT',
      autoCreateConfigs: { fieldMapping: true },
    });

    expect(result.createdConfigs?.fieldMappingConfig).toBeDefined();
  });
});
```

### E2E Tests

```typescript
// tests/e2e/formats.spec.ts

test('should create format from company detail page', async ({ page }) => {
  await page.goto('/companies/test-company-id');
  await page.click('text=格式');

  // 點擊建立按鈕
  await page.click('text=建立格式');

  // 填寫表單
  await page.selectOption('[name=documentType]', 'INVOICE');
  await page.selectOption('[name=documentSubtype]', 'OCEAN_FREIGHT');

  // 提交
  await page.click('button:has-text("建立格式")');

  // 驗證成功訊息
  await expect(page.locator('text=格式已建立')).toBeVisible();
});
```

---

## API Reference

### POST /api/v1/formats

**Request Body:**

```json
{
  "companyId": "cuid-string",
  "documentType": "INVOICE",
  "documentSubtype": "OCEAN_FREIGHT",
  "name": "自定義名稱（選填）",
  "autoCreateConfigs": {
    "fieldMapping": true,
    "promptConfig": false
  }
}
```

**Success Response (201):**

```json
{
  "success": true,
  "data": {
    "format": {
      "id": "format-id",
      "companyId": "company-id",
      "documentType": "INVOICE",
      "documentSubtype": "OCEAN_FREIGHT",
      "name": "Company Name - 海運發票",
      "createdAt": "2026-01-14T00:00:00.000Z"
    },
    "createdConfigs": {
      "fieldMappingConfig": {
        "id": "config-id",
        "name": "Company Name - 海運發票 - 欄位映射"
      }
    }
  }
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Validation Error | 請求資料驗證失敗 |
| 404 | Company Not Found | 指定的公司不存在 |
| 409 | Format Already Exists | 此公司已存在相同類型的格式 |
| 500 | Internal Server Error | 伺服器錯誤 |

---

**建立日期**: 2026-01-14
**最後更新**: 2026-01-14
**作者**: AI Assistant
