# Tech Spec: Story 16.7 - 數據模版管理

> **Version**: 1.0.0
> **Created**: 2026-01-13
> **Status**: Draft
> **Story Key**: STORY-16-7

---

## Overview

| 項目 | 內容 |
|------|------|
| **Story ID** | 16.7 |
| **Epic** | Epic 16 - 文件格式管理 |
| **Estimated Effort** | 8 Story Points |
| **Dependencies** | Story 13-4（FieldMappingConfig） |
| **Blocking** | Story 16-6（動態欄位映射需要模版支援） |

---

## Objective

新增 `DataTemplate` 模型，定義目標欄位結構（如 ERP 匯入格式、報表格式），讓 `FieldMappingConfig` 可以關聯到特定模版。

### 問題背景

目前 `FieldMappingConfig` 的目標欄位是靜態定義的 22 個固定欄位，沒有「數據模版」的概念。這限制了系統的靈活性，無法支援不同的輸出格式需求。

---

## Acceptance Criteria Mapping

| AC ID | 驗收條件 | 實現方式 |
|-------|----------|----------|
| AC-16.7.1 | DataTemplate 模型 | Prisma Schema 新增 |
| AC-16.7.2 | 模版 CRUD API | /api/v1/data-templates |
| AC-16.7.3 | 模版管理 UI | /admin/data-templates |
| AC-16.7.4 | 欄位定義編輯 | DataTemplateFieldEditor |
| AC-16.7.5 | 關聯到 FieldMappingConfig | 下拉選擇模版 |
| AC-16.7.6 | 預設模版 | 系統內建 ERP 格式模版 |
| AC-16.7.7 | 範圍支援 | GLOBAL/COMPANY 範圍 |

---

## Implementation Guide

### Phase 1: Prisma Schema (1.5 points)

#### 1.1 新增 DataTemplate 模型

```prisma
// prisma/schema.prisma

/**
 * 數據模版 - 定義目標欄位結構
 * @since Epic 16 - Story 16.7
 */
model DataTemplate {
  id              String    @id @default(cuid())

  // 基本資訊
  name            String
  description     String?

  // 範圍
  scope           ConfigScope @default(GLOBAL)
  companyId       String?   @map("company_id")
  company         Company?  @relation(fields: [companyId], references: [id])

  // 欄位定義 (JSON)
  // 結構: DataTemplateField[]
  fields          Json

  // 狀態
  isActive        Boolean   @default(true) @map("is_active")
  isSystem        Boolean   @default(false) @map("is_system")

  // 關聯
  fieldMappingConfigs FieldMappingConfig[]

  // 時間戳
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")
  createdBy       String?   @map("created_by")

  @@map("data_templates")
}

// 更新 FieldMappingConfig 模型
model FieldMappingConfig {
  // ... 現有欄位

  // 新增：關聯模版
  dataTemplateId  String?   @map("data_template_id")
  dataTemplate    DataTemplate? @relation(fields: [dataTemplateId], references: [id])
}
```

#### 1.2 遷移命令

```bash
npx prisma migrate dev --name add_data_template_model
```

### Phase 2: 類型定義 (1 point)

#### 2.1 新增 data-template.ts

```typescript
// src/types/data-template.ts

/**
 * @fileoverview 數據模版類型定義
 * @description
 *   定義 DataTemplate 模型的 TypeScript 類型，包括：
 *   - 模版欄位定義
 *   - 模版詳情和摘要
 *   - API 響應類型
 *
 * @module src/types/data-template
 * @since Epic 16 - Story 16.7
 * @lastModified 2026-01-13
 */

// ============================================================================
// Field Types
// ============================================================================

/**
 * 欄位資料類型
 */
export type DataTemplateFieldType =
  | 'string'
  | 'number'
  | 'date'
  | 'currency'
  | 'boolean'
  | 'array';

/**
 * 欄位驗證規則
 */
export interface FieldValidation {
  /** 正則表達式 */
  pattern?: string;
  /** 最小值（數字） */
  min?: number;
  /** 最大值（數字） */
  max?: number;
  /** 最大長度（字串） */
  maxLength?: number;
  /** 最小長度（字串） */
  minLength?: number;
  /** 允許的值列表 */
  allowedValues?: string[];
}

/**
 * 模版欄位定義
 */
export interface DataTemplateField {
  /** 欄位名稱（唯一識別符） */
  name: string;
  /** 顯示標籤 */
  label: string;
  /** 資料類型 */
  dataType: DataTemplateFieldType;
  /** 是否必填 */
  isRequired: boolean;
  /** 預設值 */
  defaultValue?: string | number | boolean | null;
  /** 驗證規則 */
  validation?: FieldValidation;
  /** 說明 */
  description?: string;
  /** 排序順序 */
  order: number;
}

// ============================================================================
// Model Types
// ============================================================================

/**
 * 配置範圍
 */
export type DataTemplateScope = 'GLOBAL' | 'COMPANY';

/**
 * 數據模版
 */
export interface DataTemplate {
  id: string;
  name: string;
  description?: string | null;
  scope: DataTemplateScope;
  companyId?: string | null;
  fields: DataTemplateField[];
  isActive: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
}

/**
 * 數據模版摘要（用於列表）
 */
export interface DataTemplateSummary {
  id: string;
  name: string;
  description?: string | null;
  scope: DataTemplateScope;
  companyId?: string | null;
  companyName?: string | null;
  fieldCount: number;
  isActive: boolean;
  isSystem: boolean;
  updatedAt: string;
  usageCount: number;
}

// ============================================================================
// API Types
// ============================================================================

/**
 * 創建模版輸入
 */
export interface CreateDataTemplateInput {
  name: string;
  description?: string;
  scope: DataTemplateScope;
  companyId?: string;
  fields: DataTemplateField[];
}

/**
 * 更新模版輸入
 */
export interface UpdateDataTemplateInput {
  name?: string;
  description?: string | null;
  fields?: DataTemplateField[];
  isActive?: boolean;
}

/**
 * 模版列表篩選
 */
export interface DataTemplateFilters {
  scope?: DataTemplateScope;
  companyId?: string;
  isActive?: boolean;
  isSystem?: boolean;
  search?: string;
}

/**
 * 模版列表響應
 */
export interface DataTemplateListResponse {
  templates: DataTemplateSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================================================
// Constants
// ============================================================================

/**
 * 範圍顯示名稱
 */
export const SCOPE_LABELS: Record<DataTemplateScope, string> = {
  GLOBAL: '全局',
  COMPANY: '公司',
};

/**
 * 欄位類型顯示名稱
 */
export const FIELD_TYPE_LABELS: Record<DataTemplateFieldType, string> = {
  string: '文字',
  number: '數字',
  date: '日期',
  currency: '金額',
  boolean: '布林值',
  array: '陣列',
};

/**
 * 欄位類型選項
 */
export const FIELD_TYPE_OPTIONS: Array<{ value: DataTemplateFieldType; label: string }> =
  Object.entries(FIELD_TYPE_LABELS).map(([value, label]) => ({
    value: value as DataTemplateFieldType,
    label,
  }));
```

### Phase 3: Zod 驗證 Schema (0.5 points)

#### 3.1 新增驗證 Schema

```typescript
// src/validations/data-template.ts

/**
 * @fileoverview 數據模版驗證 Schema
 * @module src/validations/data-template
 * @since Epic 16 - Story 16.7
 */

import { z } from 'zod';

/**
 * 欄位驗證規則 Schema
 */
export const fieldValidationSchema = z.object({
  pattern: z.string().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  maxLength: z.number().int().positive().optional(),
  minLength: z.number().int().nonnegative().optional(),
  allowedValues: z.array(z.string()).optional(),
}).optional();

/**
 * 模版欄位 Schema
 */
export const dataTemplateFieldSchema = z.object({
  name: z.string()
    .min(1, '欄位名稱不能為空')
    .max(100, '欄位名稱過長')
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, '欄位名稱只能包含字母、數字和底線'),
  label: z.string()
    .min(1, '顯示標籤不能為空')
    .max(200, '顯示標籤過長'),
  dataType: z.enum(['string', 'number', 'date', 'currency', 'boolean', 'array']),
  isRequired: z.boolean().default(false),
  defaultValue: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
  validation: fieldValidationSchema,
  description: z.string().max(500).optional(),
  order: z.number().int().nonnegative(),
});

/**
 * 創建模版 Schema
 */
export const createDataTemplateSchema = z.object({
  name: z.string()
    .min(1, '模版名稱不能為空')
    .max(200, '模版名稱過長'),
  description: z.string().max(1000).optional(),
  scope: z.enum(['GLOBAL', 'COMPANY']).default('GLOBAL'),
  companyId: z.string().cuid().optional().nullable(),
  fields: z.array(dataTemplateFieldSchema)
    .min(1, '至少需要一個欄位')
    .max(100, '欄位數量不能超過 100 個'),
}).refine(
  (data) => {
    // COMPANY 範圍需要 companyId
    if (data.scope === 'COMPANY' && !data.companyId) {
      return false;
    }
    return true;
  },
  { message: '公司範圍需要選擇公司', path: ['companyId'] }
);

/**
 * 更新模版 Schema
 */
export const updateDataTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  fields: z.array(dataTemplateFieldSchema).min(1).max(100).optional(),
  isActive: z.boolean().optional(),
});

// Types
export type CreateDataTemplateInput = z.infer<typeof createDataTemplateSchema>;
export type UpdateDataTemplateInput = z.infer<typeof updateDataTemplateSchema>;
export type DataTemplateFieldInput = z.infer<typeof dataTemplateFieldSchema>;
```

### Phase 4: 服務層 (1 point)

#### 4.1 新增 data-template.service.ts

```typescript
// src/services/data-template.service.ts

/**
 * @fileoverview 數據模版服務
 * @module src/services/data-template
 * @since Epic 16 - Story 16.7
 */

import { prisma } from '@/lib/prisma';
import type {
  DataTemplate,
  DataTemplateSummary,
  DataTemplateFilters,
  CreateDataTemplateInput,
  UpdateDataTemplateInput,
  DataTemplateField,
} from '@/types/data-template';

export class DataTemplateService {
  /**
   * 列出模版
   */
  async list(
    filters: DataTemplateFilters,
    page: number = 1,
    limit: number = 20
  ): Promise<{ templates: DataTemplateSummary[]; total: number }> {
    const where: Record<string, unknown> = {};

    if (filters.scope) {
      where.scope = filters.scope;
    }
    if (filters.companyId) {
      where.companyId = filters.companyId;
    }
    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }
    if (filters.isSystem !== undefined) {
      where.isSystem = filters.isSystem;
    }
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [templates, total] = await Promise.all([
      prisma.dataTemplate.findMany({
        where,
        include: {
          company: { select: { name: true } },
          _count: { select: { fieldMappingConfigs: true } },
        },
        orderBy: [{ isSystem: 'desc' }, { updatedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.dataTemplate.count({ where }),
    ]);

    return {
      templates: templates.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        scope: t.scope as 'GLOBAL' | 'COMPANY',
        companyId: t.companyId,
        companyName: t.company?.name,
        fieldCount: (t.fields as DataTemplateField[]).length,
        isActive: t.isActive,
        isSystem: t.isSystem,
        updatedAt: t.updatedAt.toISOString(),
        usageCount: t._count.fieldMappingConfigs,
      })),
      total,
    };
  }

  /**
   * 取得模版詳情
   */
  async getById(id: string): Promise<DataTemplate | null> {
    const template = await prisma.dataTemplate.findUnique({
      where: { id },
      include: {
        company: { select: { name: true } },
      },
    });

    if (!template) {
      return null;
    }

    return {
      id: template.id,
      name: template.name,
      description: template.description,
      scope: template.scope as 'GLOBAL' | 'COMPANY',
      companyId: template.companyId,
      fields: template.fields as DataTemplateField[],
      isActive: template.isActive,
      isSystem: template.isSystem,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
      createdBy: template.createdBy,
    };
  }

  /**
   * 創建模版
   */
  async create(input: CreateDataTemplateInput): Promise<DataTemplate> {
    const template = await prisma.dataTemplate.create({
      data: {
        name: input.name,
        description: input.description,
        scope: input.scope,
        companyId: input.companyId,
        fields: input.fields,
        isSystem: false,
      },
    });

    return this.getById(template.id) as Promise<DataTemplate>;
  }

  /**
   * 更新模版
   */
  async update(id: string, input: UpdateDataTemplateInput): Promise<DataTemplate> {
    // 檢查是否為系統模版
    const existing = await prisma.dataTemplate.findUnique({
      where: { id },
      select: { isSystem: true },
    });

    if (existing?.isSystem) {
      throw new Error('系統模版不可修改');
    }

    await prisma.dataTemplate.update({
      where: { id },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.fields && { fields: input.fields }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
    });

    return this.getById(id) as Promise<DataTemplate>;
  }

  /**
   * 刪除模版（軟刪除）
   */
  async delete(id: string): Promise<void> {
    // 檢查是否為系統模版
    const existing = await prisma.dataTemplate.findUnique({
      where: { id },
      select: { isSystem: true, _count: { select: { fieldMappingConfigs: true } } },
    });

    if (existing?.isSystem) {
      throw new Error('系統模版不可刪除');
    }

    if (existing?._count.fieldMappingConfigs > 0) {
      throw new Error('此模版正被映射配置使用中，無法刪除');
    }

    await prisma.dataTemplate.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * 取得可用模版列表（用於下拉選單）
   */
  async getAvailable(companyId?: string): Promise<Array<{ id: string; name: string }>> {
    const templates = await prisma.dataTemplate.findMany({
      where: {
        isActive: true,
        OR: [
          { scope: 'GLOBAL' },
          ...(companyId ? [{ companyId }] : []),
        ],
      },
      select: { id: true, name: true, scope: true },
      orderBy: [{ scope: 'asc' }, { name: 'asc' }],
    });

    return templates.map((t) => ({
      id: t.id,
      name: `${t.name}${t.scope === 'GLOBAL' ? ' (全局)' : ''}`,
    }));
  }
}

export const dataTemplateService = new DataTemplateService();
```

### Phase 5: API 端點 (1.5 points)

#### 5.1 列表和創建 API

```typescript
// src/app/api/v1/data-templates/route.ts

/**
 * @fileoverview 數據模版列表和創建 API
 * @module src/app/api/v1/data-templates
 * @since Epic 16 - Story 16.7
 */

import { NextRequest, NextResponse } from 'next/server';
import { dataTemplateService } from '@/services/data-template.service';
import { createApiResponse, createApiError } from '@/lib/api/response';
import { createDataTemplateSchema } from '@/validations/data-template';
import type { DataTemplateFilters } from '@/types/data-template';

/**
 * GET /api/v1/data-templates
 * 列出數據模版
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const filters: DataTemplateFilters = {
      scope: searchParams.get('scope') as 'GLOBAL' | 'COMPANY' | undefined,
      companyId: searchParams.get('companyId') || undefined,
      isActive: searchParams.has('isActive')
        ? searchParams.get('isActive') === 'true'
        : undefined,
      isSystem: searchParams.has('isSystem')
        ? searchParams.get('isSystem') === 'true'
        : undefined,
      search: searchParams.get('search') || undefined,
    };

    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const { templates, total } = await dataTemplateService.list(filters, page, limit);

    return NextResponse.json(
      createApiResponse({
        templates,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      })
    );
  } catch (error) {
    console.error('[GET /api/v1/data-templates] Error:', error);
    return NextResponse.json(
      createApiError({
        type: 'INTERNAL_ERROR',
        title: 'Internal server error',
        status: 500,
      }),
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/data-templates
 * 創建數據模版
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 驗證
    const result = createDataTemplateSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        createApiError({
          type: 'VALIDATION_ERROR',
          title: 'Validation failed',
          status: 400,
          errors: result.error.flatten().fieldErrors,
        }),
        { status: 400 }
      );
    }

    const template = await dataTemplateService.create(result.data);

    return NextResponse.json(createApiResponse(template), { status: 201 });
  } catch (error) {
    console.error('[POST /api/v1/data-templates] Error:', error);
    return NextResponse.json(
      createApiError({
        type: 'INTERNAL_ERROR',
        title: error instanceof Error ? error.message : 'Internal server error',
        status: 500,
      }),
      { status: 500 }
    );
  }
}
```

#### 5.2 詳情、更新、刪除 API

```typescript
// src/app/api/v1/data-templates/[id]/route.ts

/**
 * @fileoverview 數據模版詳情、更新、刪除 API
 * @module src/app/api/v1/data-templates/[id]
 * @since Epic 16 - Story 16.7
 */

import { NextRequest, NextResponse } from 'next/server';
import { dataTemplateService } from '@/services/data-template.service';
import { createApiResponse, createApiError } from '@/lib/api/response';
import { updateDataTemplateSchema } from '@/validations/data-template';

/**
 * GET /api/v1/data-templates/:id
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const template = await dataTemplateService.getById(id);

    if (!template) {
      return NextResponse.json(
        createApiError({
          type: 'NOT_FOUND',
          title: 'Template not found',
          status: 404,
        }),
        { status: 404 }
      );
    }

    return NextResponse.json(createApiResponse(template));
  } catch (error) {
    console.error('[GET /api/v1/data-templates/:id] Error:', error);
    return NextResponse.json(
      createApiError({
        type: 'INTERNAL_ERROR',
        title: 'Internal server error',
        status: 500,
      }),
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v1/data-templates/:id
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // 驗證
    const result = updateDataTemplateSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        createApiError({
          type: 'VALIDATION_ERROR',
          title: 'Validation failed',
          status: 400,
          errors: result.error.flatten().fieldErrors,
        }),
        { status: 400 }
      );
    }

    const template = await dataTemplateService.update(id, result.data);

    return NextResponse.json(createApiResponse(template));
  } catch (error) {
    console.error('[PATCH /api/v1/data-templates/:id] Error:', error);
    return NextResponse.json(
      createApiError({
        type: 'INTERNAL_ERROR',
        title: error instanceof Error ? error.message : 'Internal server error',
        status: 500,
      }),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/data-templates/:id
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await dataTemplateService.delete(id);

    return NextResponse.json(
      createApiResponse({ success: true }),
      { status: 200 }
    );
  } catch (error) {
    console.error('[DELETE /api/v1/data-templates/:id] Error:', error);
    return NextResponse.json(
      createApiError({
        type: 'INTERNAL_ERROR',
        title: error instanceof Error ? error.message : 'Internal server error',
        status: 500,
      }),
      { status: 500 }
    );
  }
}
```

### Phase 6: Seed Data (0.5 points)

#### 6.1 預設模版

```typescript
// prisma/seed/data-templates.ts

/**
 * @fileoverview 數據模版 Seed Data
 * @description 創建系統預設模版
 */

import { PrismaClient } from '@prisma/client';

export async function seedDataTemplates(prisma: PrismaClient) {
  console.log('Seeding data templates...');

  const templates = [
    {
      name: 'ERP 標準匯入格式',
      description: '適用於大多數 ERP 系統的標準發票匯入格式',
      scope: 'GLOBAL',
      isSystem: true,
      fields: [
        { name: 'invoice_number', label: '發票號碼', dataType: 'string', isRequired: true, order: 1 },
        { name: 'invoice_date', label: '發票日期', dataType: 'date', isRequired: true, order: 2 },
        { name: 'vendor_code', label: '供應商代碼', dataType: 'string', isRequired: true, order: 3 },
        { name: 'vendor_name', label: '供應商名稱', dataType: 'string', isRequired: false, order: 4 },
        { name: 'currency', label: '幣別', dataType: 'string', isRequired: true, order: 5 },
        { name: 'subtotal', label: '小計', dataType: 'currency', isRequired: false, order: 6 },
        { name: 'tax_amount', label: '稅額', dataType: 'currency', isRequired: false, order: 7 },
        { name: 'total_amount', label: '總金額', dataType: 'currency', isRequired: true, order: 8 },
        { name: 'due_date', label: '付款到期日', dataType: 'date', isRequired: false, order: 9 },
        { name: 'po_number', label: '採購單號', dataType: 'string', isRequired: false, order: 10 },
        { name: 'tracking_number', label: '追蹤號碼', dataType: 'string', isRequired: false, order: 11 },
        { name: 'description', label: '說明', dataType: 'string', isRequired: false, order: 12 },
      ],
    },
    {
      name: '費用報表格式',
      description: '用於管理報表匯出的精簡格式',
      scope: 'GLOBAL',
      isSystem: true,
      fields: [
        { name: 'invoice_number', label: '發票號碼', dataType: 'string', isRequired: true, order: 1 },
        { name: 'invoice_date', label: '發票日期', dataType: 'date', isRequired: true, order: 2 },
        { name: 'vendor_name', label: '供應商', dataType: 'string', isRequired: true, order: 3 },
        { name: 'category', label: '費用類別', dataType: 'string', isRequired: false, order: 4 },
        { name: 'currency', label: '幣別', dataType: 'string', isRequired: true, order: 5 },
        { name: 'amount', label: '金額', dataType: 'currency', isRequired: true, order: 6 },
        { name: 'department', label: '部門', dataType: 'string', isRequired: false, order: 7 },
        { name: 'cost_center', label: '成本中心', dataType: 'string', isRequired: false, order: 8 },
      ],
    },
    {
      name: '物流追蹤格式',
      description: '專為物流發票設計的追蹤格式',
      scope: 'GLOBAL',
      isSystem: true,
      fields: [
        { name: 'tracking_number', label: '追蹤號碼', dataType: 'string', isRequired: true, order: 1 },
        { name: 'invoice_number', label: '發票號碼', dataType: 'string', isRequired: true, order: 2 },
        { name: 'ship_date', label: '發貨日期', dataType: 'date', isRequired: false, order: 3 },
        { name: 'delivery_date', label: '交付日期', dataType: 'date', isRequired: false, order: 4 },
        { name: 'origin', label: '起運地', dataType: 'string', isRequired: false, order: 5 },
        { name: 'destination', label: '目的地', dataType: 'string', isRequired: false, order: 6 },
        { name: 'carrier', label: '承運商', dataType: 'string', isRequired: true, order: 7 },
        { name: 'service_type', label: '服務類型', dataType: 'string', isRequired: false, order: 8 },
        { name: 'weight', label: '重量', dataType: 'number', isRequired: false, order: 9 },
        { name: 'freight_charge', label: '運費', dataType: 'currency', isRequired: true, order: 10 },
        { name: 'total_amount', label: '總金額', dataType: 'currency', isRequired: true, order: 11 },
      ],
    },
  ];

  for (const template of templates) {
    await prisma.dataTemplate.upsert({
      where: {
        id: template.name.toLowerCase().replace(/\s+/g, '-'),
      },
      update: {
        fields: template.fields,
        updatedAt: new Date(),
      },
      create: {
        id: template.name.toLowerCase().replace(/\s+/g, '-'),
        ...template,
      },
    });
  }

  console.log(`Seeded ${templates.length} data templates`);
}
```

### Phase 7: UI 組件 (2 points)

詳細 UI 組件實現請參考獨立的 UI 設計文檔，主要包含：

- `DataTemplateList.tsx` - 模版列表頁面
- `DataTemplateForm.tsx` - 創建/編輯表單
- `DataTemplateFieldEditor.tsx` - 欄位定義編輯器（支援拖拽排序）

---

## File Structure

```
prisma/
├── schema.prisma                    # 更新：新增 DataTemplate
├── migrations/                      # 新增遷移
└── seed/
    └── data-templates.ts            # 新增

src/
├── types/
│   └── data-template.ts             # 新增
├── validations/
│   └── data-template.ts             # 新增
├── services/
│   └── data-template.service.ts     # 新增
├── app/api/v1/data-templates/
│   ├── route.ts                     # 新增
│   └── [id]/route.ts                # 新增
├── app/(dashboard)/admin/data-templates/
│   ├── page.tsx                     # 新增
│   ├── new/page.tsx                 # 新增
│   └── [id]/page.tsx                # 新增
└── components/features/data-template/
    ├── DataTemplateList.tsx         # 新增
    ├── DataTemplateForm.tsx         # 新增
    └── DataTemplateFieldEditor.tsx  # 新增
```

---

## Testing Checklist

### 資料庫測試
- [ ] Prisma 遷移成功
- [ ] DataTemplate 模型 CRUD 正常
- [ ] FieldMappingConfig 關聯正常

### API 測試
- [ ] GET /api/v1/data-templates 列表正常
- [ ] POST /api/v1/data-templates 創建正常
- [ ] GET /api/v1/data-templates/:id 詳情正常
- [ ] PATCH /api/v1/data-templates/:id 更新正常
- [ ] DELETE /api/v1/data-templates/:id 刪除正常
- [ ] 系統模版不可修改/刪除

### UI 測試
- [ ] 列表頁面正確顯示
- [ ] 創建表單驗證正確
- [ ] 欄位編輯器拖拽正常
- [ ] 編輯頁面正確載入數據

### Seed 測試
- [ ] 預設模版正確創建
- [ ] 模版欄位結構正確

---

## Migration Notes

### 資料庫遷移

```bash
# 1. 創建遷移
npx prisma migrate dev --name add_data_template_model

# 2. 執行 Seed
npx prisma db seed
```

### 影響範圍

- `FieldMappingConfig` 新增可選的 `dataTemplateId` 欄位
- 現有 FieldMappingConfig 的 `dataTemplateId` 為 null（向後兼容）
