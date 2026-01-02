# Tech Spec: Story 14.1 - Prompt 配置模型與 API

## 概覽

| 項目 | 內容 |
|------|------|
| **Story ID** | 14.1 |
| **Story 名稱** | Prompt 配置模型與 API |
| **Epic** | Epic 14 - Prompt 配置與動態生成 |
| **優先級** | High |
| **估計點數** | 8 |
| **依賴** | Epic 0 (Company, DocumentFormat 模型) |

---

## 目標

建立 Prompt 配置的資料模型和 REST API，支援為不同 Company 和 DocumentFormat 設定專屬的 GPT Prompt，實現三層配置機制（Global → Company → Format）。

---

## Acceptance Criteria 對應

| AC | 描述 | 實現方式 |
|----|------|----------|
| AC1 | GET API 篩選配置 | /api/v1/prompt-configs with filters |
| AC2 | POST API 建立配置 | 驗證唯一性約束 |
| AC3 | PATCH API 更新配置 | 樂觀鎖 + 版本控制 |
| AC4 | 配置驗證服務 | Zod schema + 業務規則驗證 |

---

## 實現指南

### Phase 1: Prisma Schema 定義

**檔案**: `prisma/schema.prisma` (新增)

```prisma
// ============================================================================
// Prompt 配置模型
// ============================================================================

/// Prompt 類型枚舉
enum PromptType {
  ISSUER_IDENTIFICATION    // 發行者識別
  TERM_CLASSIFICATION      // 術語分類
  FIELD_EXTRACTION         // 欄位提取
  VALIDATION               // 結果驗證

  @@map("prompt_type")
}

/// Prompt 配置層級
enum PromptScope {
  GLOBAL
  COMPANY
  FORMAT

  @@map("prompt_scope")
}

/// Prompt 合併策略
enum MergeStrategy {
  OVERRIDE    // 完全覆蓋
  APPEND      // 附加到後面
  PREPEND     // 附加到前面

  @@map("merge_strategy")
}

/// Prompt 配置主表
model PromptConfig {
  id                String       @id @default(cuid())

  // 配置識別
  promptType        PromptType   @map("prompt_type")
  scope             PromptScope
  name              String       @db.VarChar(100)
  description       String?      @db.Text

  // 層級關聯（可選）
  companyId         String?      @map("company_id")
  company           Company?     @relation(fields: [companyId], references: [id])
  documentFormatId  String?      @map("document_format_id")
  documentFormat    DocumentFormat? @relation(fields: [documentFormatId], references: [id])

  // Prompt 內容
  systemPrompt      String       @map("system_prompt") @db.Text
  userPromptTemplate String      @map("user_prompt_template") @db.Text

  // 合併策略
  mergeStrategy     MergeStrategy @default(OVERRIDE) @map("merge_strategy")

  // 變數定義（JSON）
  variables         Json?        @default("[]")

  // 狀態和版本
  isActive          Boolean      @default(true) @map("is_active")
  version           Int          @default(1)

  // 審計欄位
  createdAt         DateTime     @default(now()) @map("created_at")
  updatedAt         DateTime     @updatedAt @map("updated_at")
  createdBy         String?      @map("created_by")
  updatedBy         String?      @map("updated_by")

  // 唯一約束：同一類型、層級、公司、格式只能有一個配置
  @@unique([promptType, scope, companyId, documentFormatId], name: "unique_prompt_config")
  @@index([promptType])
  @@index([companyId])
  @@index([documentFormatId])
  @@index([isActive])
  @@map("prompt_configs")
}

/// Prompt 變數定義
model PromptVariable {
  id              String       @id @default(cuid())

  // 變數基本資訊
  name            String       @db.VarChar(50)   // e.g., "companyName"
  displayName     String       @map("display_name") @db.VarChar(100)
  description     String?      @db.Text

  // 變數類型
  variableType    String       @map("variable_type") @db.VarChar(20) // STATIC, DYNAMIC, CONTEXT

  // 預設值（用於 STATIC 類型）
  defaultValue    String?      @map("default_value") @db.Text

  // 動態值來源（用於 DYNAMIC 類型）
  dataSource      String?      @map("data_source") @db.VarChar(100) // e.g., "knownTerms", "recentExtractions"

  // 必填標記
  isRequired      Boolean      @default(false) @map("is_required")

  createdAt       DateTime     @default(now()) @map("created_at")
  updatedAt       DateTime     @updatedAt @map("updated_at")

  @@unique([name])
  @@map("prompt_variables")
}
```

---

### Phase 2: 類型定義

**檔案**: `src/types/prompt-config.ts`

```typescript
/**
 * @fileoverview Prompt 配置類型定義
 * @module src/types/prompt-config
 * @since Epic 14 - Story 14.1
 */

// ============================================================================
// 枚舉類型
// ============================================================================

export type PromptType =
  | 'ISSUER_IDENTIFICATION'
  | 'TERM_CLASSIFICATION'
  | 'FIELD_EXTRACTION'
  | 'VALIDATION';

export type PromptScope = 'GLOBAL' | 'COMPANY' | 'FORMAT';

export type MergeStrategy = 'OVERRIDE' | 'APPEND' | 'PREPEND';

export type VariableType = 'STATIC' | 'DYNAMIC' | 'CONTEXT';

// ============================================================================
// 變數定義
// ============================================================================

export interface PromptVariableDefinition {
  name: string;
  displayName: string;
  description?: string;
  variableType: VariableType;
  defaultValue?: string;
  dataSource?: string;
  isRequired: boolean;
}

// ============================================================================
// Prompt 配置
// ============================================================================

export interface PromptConfig {
  id: string;
  promptType: PromptType;
  scope: PromptScope;
  name: string;
  description?: string | null;
  companyId?: string | null;
  documentFormatId?: string | null;
  systemPrompt: string;
  userPromptTemplate: string;
  mergeStrategy: MergeStrategy;
  variables: PromptVariableDefinition[];
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
  updatedBy?: string | null;
}

// ============================================================================
// API 請求/響應類型
// ============================================================================

export interface CreatePromptConfigRequest {
  promptType: PromptType;
  scope: PromptScope;
  name: string;
  description?: string;
  companyId?: string;
  documentFormatId?: string;
  systemPrompt: string;
  userPromptTemplate: string;
  mergeStrategy?: MergeStrategy;
  variables?: PromptVariableDefinition[];
}

export interface UpdatePromptConfigRequest {
  name?: string;
  description?: string;
  systemPrompt?: string;
  userPromptTemplate?: string;
  mergeStrategy?: MergeStrategy;
  variables?: PromptVariableDefinition[];
  isActive?: boolean;
  version: number; // 樂觀鎖
}

export interface PromptConfigFilters {
  promptType?: PromptType;
  scope?: PromptScope;
  companyId?: string;
  documentFormatId?: string;
  isActive?: boolean;
}

export interface PromptConfigListResponse {
  data: PromptConfig[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
```

---

### Phase 3: Zod 驗證 Schema

**檔案**: `src/validations/prompt-config.ts`

```typescript
/**
 * @fileoverview Prompt 配置 Zod 驗證 Schema
 * @module src/validations/prompt-config
 * @since Epic 14 - Story 14.1
 */

import { z } from 'zod';

// ============================================================================
// 枚舉驗證
// ============================================================================

export const promptTypeSchema = z.enum([
  'ISSUER_IDENTIFICATION',
  'TERM_CLASSIFICATION',
  'FIELD_EXTRACTION',
  'VALIDATION',
]);

export const promptScopeSchema = z.enum(['GLOBAL', 'COMPANY', 'FORMAT']);

export const mergeStrategySchema = z.enum(['OVERRIDE', 'APPEND', 'PREPEND']);

export const variableTypeSchema = z.enum(['STATIC', 'DYNAMIC', 'CONTEXT']);

// ============================================================================
// 變數定義 Schema
// ============================================================================

export const promptVariableDefinitionSchema = z.object({
  name: z.string().min(1).max(50).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
  displayName: z.string().min(1).max(100),
  description: z.string().optional(),
  variableType: variableTypeSchema,
  defaultValue: z.string().optional(),
  dataSource: z.string().max(100).optional(),
  isRequired: z.boolean().default(false),
});

// ============================================================================
// 建立配置 Schema
// ============================================================================

export const createPromptConfigSchema = z
  .object({
    promptType: promptTypeSchema,
    scope: promptScopeSchema,
    name: z.string().min(1).max(100),
    description: z.string().optional(),
    companyId: z.string().cuid().optional(),
    documentFormatId: z.string().cuid().optional(),
    systemPrompt: z.string().min(10).max(10000),
    userPromptTemplate: z.string().min(10).max(50000),
    mergeStrategy: mergeStrategySchema.default('OVERRIDE'),
    variables: z.array(promptVariableDefinitionSchema).default([]),
  })
  .superRefine((data, ctx) => {
    // 層級與關聯欄位驗證
    if (data.scope === 'GLOBAL') {
      if (data.companyId || data.documentFormatId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'GLOBAL scope should not have companyId or documentFormatId',
          path: ['scope'],
        });
      }
    }

    if (data.scope === 'COMPANY') {
      if (!data.companyId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'COMPANY scope requires companyId',
          path: ['companyId'],
        });
      }
      if (data.documentFormatId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'COMPANY scope should not have documentFormatId',
          path: ['documentFormatId'],
        });
      }
    }

    if (data.scope === 'FORMAT') {
      if (!data.documentFormatId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'FORMAT scope requires documentFormatId',
          path: ['documentFormatId'],
        });
      }
    }
  });

// ============================================================================
// 更新配置 Schema
// ============================================================================

export const updatePromptConfigSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  systemPrompt: z.string().min(10).max(10000).optional(),
  userPromptTemplate: z.string().min(10).max(50000).optional(),
  mergeStrategy: mergeStrategySchema.optional(),
  variables: z.array(promptVariableDefinitionSchema).optional(),
  isActive: z.boolean().optional(),
  version: z.number().int().positive(), // 必填，用於樂觀鎖
});

// ============================================================================
// 查詢參數 Schema
// ============================================================================

export const promptConfigFiltersSchema = z.object({
  promptType: promptTypeSchema.optional(),
  scope: promptScopeSchema.optional(),
  companyId: z.string().cuid().optional(),
  documentFormatId: z.string().cuid().optional(),
  isActive: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  page: z
    .string()
    .transform((v) => parseInt(v, 10))
    .default('1'),
  limit: z
    .string()
    .transform((v) => parseInt(v, 10))
    .default('20'),
});

export type CreatePromptConfigInput = z.infer<typeof createPromptConfigSchema>;
export type UpdatePromptConfigInput = z.infer<typeof updatePromptConfigSchema>;
export type PromptConfigFiltersInput = z.infer<typeof promptConfigFiltersSchema>;
```

---

### Phase 4: API 路由實現

**檔案**: `src/app/api/v1/prompt-configs/route.ts`

```typescript
/**
 * @fileoverview Prompt 配置列表 API
 * @module src/app/api/v1/prompt-configs
 * @since Epic 14 - Story 14.1
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  createPromptConfigSchema,
  promptConfigFiltersSchema,
} from '@/validations/prompt-config';
import { handleApiError, createApiResponse } from '@/lib/api-utils';

/**
 * GET /api/v1/prompt-configs
 * 獲取 Prompt 配置列表
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params = Object.fromEntries(searchParams.entries());
    const filters = promptConfigFiltersSchema.parse(params);

    const where: Record<string, unknown> = {};

    if (filters.promptType) {
      where.promptType = filters.promptType;
    }
    if (filters.scope) {
      where.scope = filters.scope;
    }
    if (filters.companyId) {
      where.companyId = filters.companyId;
    }
    if (filters.documentFormatId) {
      where.documentFormatId = filters.documentFormatId;
    }
    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    const [configs, total] = await Promise.all([
      prisma.promptConfig.findMany({
        where,
        include: {
          company: { select: { id: true, name: true } },
          documentFormat: { select: { id: true, name: true } },
        },
        orderBy: [{ promptType: 'asc' }, { scope: 'asc' }, { createdAt: 'desc' }],
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      prisma.promptConfig.count({ where }),
    ]);

    return createApiResponse({
      data: configs,
      meta: {
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(total / filters.limit),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/v1/prompt-configs
 * 建立新的 Prompt 配置
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = createPromptConfigSchema.parse(body);

    // 檢查唯一性約束
    const existing = await prisma.promptConfig.findFirst({
      where: {
        promptType: data.promptType,
        scope: data.scope,
        companyId: data.companyId ?? null,
        documentFormatId: data.documentFormatId ?? null,
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/conflict',
          title: 'Conflict',
          status: 409,
          detail: 'A prompt config with this type, scope, and associations already exists',
          instance: request.url,
        },
        { status: 409 }
      );
    }

    // 驗證關聯實體存在
    if (data.companyId) {
      const company = await prisma.company.findUnique({
        where: { id: data.companyId },
      });
      if (!company) {
        return NextResponse.json(
          {
            type: 'https://api.example.com/errors/not-found',
            title: 'Not Found',
            status: 404,
            detail: 'Company not found',
            instance: request.url,
          },
          { status: 404 }
        );
      }
    }

    if (data.documentFormatId) {
      const format = await prisma.documentFormat.findUnique({
        where: { id: data.documentFormatId },
      });
      if (!format) {
        return NextResponse.json(
          {
            type: 'https://api.example.com/errors/not-found',
            title: 'Not Found',
            status: 404,
            detail: 'DocumentFormat not found',
            instance: request.url,
          },
          { status: 404 }
        );
      }
    }

    const config = await prisma.promptConfig.create({
      data: {
        promptType: data.promptType,
        scope: data.scope,
        name: data.name,
        description: data.description,
        companyId: data.companyId,
        documentFormatId: data.documentFormatId,
        systemPrompt: data.systemPrompt,
        userPromptTemplate: data.userPromptTemplate,
        mergeStrategy: data.mergeStrategy,
        variables: data.variables,
      },
      include: {
        company: { select: { id: true, name: true } },
        documentFormat: { select: { id: true, name: true } },
      },
    });

    return createApiResponse({ data: config }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
```

**檔案**: `src/app/api/v1/prompt-configs/[id]/route.ts`

```typescript
/**
 * @fileoverview Prompt 配置單項 API
 * @module src/app/api/v1/prompt-configs/[id]
 * @since Epic 14 - Story 14.1
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updatePromptConfigSchema } from '@/validations/prompt-config';
import { handleApiError, createApiResponse } from '@/lib/api-utils';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/prompt-configs/:id
 * 獲取單個 Prompt 配置
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const config = await prisma.promptConfig.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true } },
        documentFormat: { select: { id: true, name: true } },
      },
    });

    if (!config) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: 'Prompt config not found',
          instance: request.url,
        },
        { status: 404 }
      );
    }

    return createApiResponse({ data: config });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/v1/prompt-configs/:id
 * 更新 Prompt 配置
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data = updatePromptConfigSchema.parse(body);

    // 檢查配置是否存在
    const existing = await prisma.promptConfig.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: 'Prompt config not found',
          instance: request.url,
        },
        { status: 404 }
      );
    }

    // 樂觀鎖檢查
    if (existing.version !== data.version) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/conflict',
          title: 'Conflict',
          status: 409,
          detail: 'The config has been modified by another user. Please refresh and try again.',
          instance: request.url,
          currentVersion: existing.version,
        },
        { status: 409 }
      );
    }

    const { version, ...updateData } = data;

    const updated = await prisma.promptConfig.update({
      where: { id },
      data: {
        ...updateData,
        version: { increment: 1 },
      },
      include: {
        company: { select: { id: true, name: true } },
        documentFormat: { select: { id: true, name: true } },
      },
    });

    return createApiResponse({ data: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/v1/prompt-configs/:id
 * 刪除 Prompt 配置
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const existing = await prisma.promptConfig.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: 'Prompt config not found',
          instance: request.url,
        },
        { status: 404 }
      );
    }

    // 不允許刪除 GLOBAL 配置（只能停用）
    if (existing.scope === 'GLOBAL') {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/forbidden',
          title: 'Forbidden',
          status: 403,
          detail: 'Cannot delete GLOBAL configs. Use PATCH to deactivate instead.',
          instance: request.url,
        },
        { status: 403 }
      );
    }

    await prisma.promptConfig.delete({
      where: { id },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
```

---

## 項目結構

```
src/
├── app/
│   └── api/
│       └── v1/
│           └── prompt-configs/
│               ├── route.ts              # GET (list), POST (create)
│               └── [id]/
│                   └── route.ts          # GET, PATCH, DELETE
├── types/
│   └── prompt-config.ts                  # 類型定義
├── validations/
│   └── prompt-config.ts                  # Zod 驗證 Schema
└── tests/
    └── api/
        └── prompt-configs.test.ts        # API 測試

prisma/
└── schema.prisma                         # 新增 PromptConfig 模型
```

---

## API 端點摘要

| 方法 | 端點 | 描述 |
|------|------|------|
| GET | `/api/v1/prompt-configs` | 獲取配置列表（支援篩選和分頁） |
| POST | `/api/v1/prompt-configs` | 建立新配置 |
| GET | `/api/v1/prompt-configs/:id` | 獲取單個配置 |
| PATCH | `/api/v1/prompt-configs/:id` | 更新配置（需要版本號） |
| DELETE | `/api/v1/prompt-configs/:id` | 刪除配置（不允許刪除 GLOBAL） |

---

## 驗證清單

### 功能驗證
- [ ] CRUD 操作正常運作
- [ ] 唯一性約束正確執行
- [ ] 層級與關聯欄位驗證正確
- [ ] 樂觀鎖機制正常運作
- [ ] GLOBAL 配置不可刪除

### 資料驗證
- [ ] Zod 驗證攔截無效輸入
- [ ] 關聯實體存在性檢查
- [ ] 變數定義格式正確

### 測試覆蓋
- [ ] 單元測試覆蓋驗證邏輯
- [ ] 整合測試覆蓋 API 端點
- [ ] 邊界條件測試

---

## 依賴關係

### 內部依賴
- Epic 0: Company, DocumentFormat 模型

### 外部依賴
- `@prisma/client`: 資料庫操作
- `zod`: 驗證

---

## 風險與緩解

| 風險 | 影響 | 緩解策略 |
|------|------|----------|
| Prompt 內容過大 | 資料庫效能 | 限制 systemPrompt (10KB), userPromptTemplate (50KB) |
| 配置衝突 | 資料一致性 | 唯一約束 + 樂觀鎖 |
| 刪除正在使用的配置 | 處理失敗 | 軟刪除（isActive=false）+ 防護檢查 |

---

*Tech Spec 建立日期: 2026-01-02*
*版本: 1.0.0*
