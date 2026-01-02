# Story 14-1: Prompt 配置模型與 API

> **Epic**: Epic 14 - Company + DocumentFormat Prompt 配置
> **Story Points**: 5
> **Priority**: High
> **Status**: ✅ Done (2026-01-02)

---

## 📋 Story 概述

### User Story

```
作為系統管理員，
我希望能夠為不同的 Company 和 DocumentFormat 配置專屬的 GPT Prompt，
以便針對特定供應商優化文件識別和術語分類的準確率。
```

### 驗收標準 (Acceptance Criteria)

1. **AC1**: 系統支援創建、讀取、更新、刪除 Prompt 配置
2. **AC2**: Prompt 配置可關聯到特定 Company 或 DocumentFormat
3. **AC3**: 支援 4 種 Prompt 類型：發行者識別、術語分類、欄位提取、驗證
4. **AC4**: 配置支援變數定義和替換
5. **AC5**: API 響應時間 < 200ms

---

## 🏗️ 技術設計

### 資料模型

#### Prisma Schema

```prisma
// prisma/schema.prisma

/// Prompt 類型枚舉
enum PromptType {
  ISSUER_IDENTIFICATION   // 文件發行者識別
  TERM_CLASSIFICATION     // 術語分類
  FIELD_EXTRACTION        // 欄位提取增強
  VALIDATION              // 結果驗證
}

/// 合併策略枚舉
enum MergeStrategy {
  OVERRIDE    // 完全覆蓋基礎 Prompt
  APPEND      // 附加到基礎 Prompt 後面
  PREPEND     // 添加到基礎 Prompt 前面
}

/// Prompt 配置模型
/// @description 儲存 Company/Format 專屬的 GPT Prompt 配置
model PromptConfig {
  id               String         @id @default(cuid())

  /// 配置名稱（用於識別）
  name             String

  /// 配置描述
  description      String?        @db.Text

  /// Prompt 類型
  promptType       PromptType

  // === 適用範圍 ===

  /// 關聯的公司（可選）
  companyId        String?        @map("company_id")
  company          Company?       @relation(fields: [companyId], references: [id], onDelete: Cascade)

  /// 關聯的文件格式（可選）
  documentFormatId String?        @map("document_format_id")
  documentFormat   DocumentFormat? @relation(fields: [documentFormatId], references: [id], onDelete: Cascade)

  // === Prompt 內容 ===

  /// System Prompt（可選，用於覆蓋預設）
  systemPrompt     String?        @db.Text @map("system_prompt")

  /// User Prompt 模板（支援變數替換）
  userPromptTemplate String       @db.Text @map("user_prompt_template")

  // === 合併策略 ===

  /// 當存在多層配置時的合併策略
  mergeStrategy    MergeStrategy  @default(OVERRIDE)

  // === 變數定義 ===

  /// 變數定義 JSON（PromptVariable[]）
  variables        Json?          @db.JsonB

  // === 狀態 ===

  /// 是否啟用
  isActive         Boolean        @default(true) @map("is_active")

  /// 優先級（數字越大優先級越高）
  priority         Int            @default(0)

  // === 審計欄位 ===

  createdAt        DateTime       @default(now()) @map("created_at")
  updatedAt        DateTime       @updatedAt @map("updated_at")
  createdById      String         @map("created_by_id")
  createdBy        User           @relation(fields: [createdById], references: [id])

  // === 索引和約束 ===

  /// 確保同一類型、公司、格式組合唯一
  @@unique([promptType, companyId, documentFormatId])
  @@index([promptType])
  @@index([companyId])
  @@index([documentFormatId])
  @@index([isActive])
  @@map("prompt_configs")
}
```

#### TypeScript 類型定義

```typescript
// src/types/prompt-config.ts

/**
 * @fileoverview Prompt 配置相關類型定義
 * @module src/types/prompt-config
 * @since Epic 14 - Story 14.1
 */

import { z } from 'zod';

// === 枚舉類型 ===

export const PromptType = {
  ISSUER_IDENTIFICATION: 'ISSUER_IDENTIFICATION',
  TERM_CLASSIFICATION: 'TERM_CLASSIFICATION',
  FIELD_EXTRACTION: 'FIELD_EXTRACTION',
  VALIDATION: 'VALIDATION',
} as const;

export type PromptType = (typeof PromptType)[keyof typeof PromptType];

export const MergeStrategy = {
  OVERRIDE: 'OVERRIDE',
  APPEND: 'APPEND',
  PREPEND: 'PREPEND',
} as const;

export type MergeStrategy = (typeof MergeStrategy)[keyof typeof MergeStrategy];

// === 變數類型 ===

export const VariableType = {
  STATIC: 'static',      // 靜態值（配置時設定）
  DYNAMIC: 'dynamic',    // 動態值（運行時計算）
  CONTEXT: 'context',    // 上下文值（從處理上下文取得）
} as const;

export type VariableType = (typeof VariableType)[keyof typeof VariableType];

/**
 * Prompt 變數定義
 */
export interface PromptVariable {
  /** 變數名稱（用於模板替換，如 {{companyName}}） */
  name: string;

  /** 變數類型 */
  type: VariableType;

  /** 預設值（可選） */
  defaultValue?: string;

  /** 變數描述 */
  description?: string;

  /** 動態值來源（當 type 為 dynamic 時） */
  source?: string;
}

// === Prompt 配置類型 ===

/**
 * Prompt 配置基礎類型
 */
export interface PromptConfigBase {
  name: string;
  description?: string | null;
  promptType: PromptType;
  companyId?: string | null;
  documentFormatId?: string | null;
  systemPrompt?: string | null;
  userPromptTemplate: string;
  mergeStrategy: MergeStrategy;
  variables?: PromptVariable[] | null;
  isActive: boolean;
  priority: number;
}

/**
 * Prompt 配置完整類型（含 ID 和審計欄位）
 */
export interface PromptConfig extends PromptConfigBase {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  createdById: string;
}

/**
 * Prompt 配置（含關聯資料）
 */
export interface PromptConfigWithRelations extends PromptConfig {
  company?: {
    id: string;
    name: string;
    code: string;
  } | null;
  documentFormat?: {
    id: string;
    name: string;
    companyId: string;
  } | null;
  createdBy: {
    id: string;
    name: string;
  };
}

// === API 響應類型 ===

export interface PromptConfigListResponse {
  success: true;
  data: PromptConfigWithRelations[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface PromptConfigDetailResponse {
  success: true;
  data: PromptConfigWithRelations;
}
```

### Zod 驗證 Schema

```typescript
// src/validations/prompt-config.validation.ts

/**
 * @fileoverview Prompt 配置 Zod 驗證 Schema
 * @module src/validations/prompt-config.validation
 * @since Epic 14 - Story 14.1
 */

import { z } from 'zod';
import { PromptType, MergeStrategy, VariableType } from '@/types/prompt-config';

// === 變數 Schema ===

export const promptVariableSchema = z.object({
  name: z.string()
    .min(1, '變數名稱不能為空')
    .max(50, '變數名稱最多 50 字元')
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, '變數名稱必須以字母開頭，只能包含字母、數字和底線'),
  type: z.enum(['static', 'dynamic', 'context']),
  defaultValue: z.string().optional(),
  description: z.string().max(200).optional(),
  source: z.string().optional(),
});

// === 創建 Schema ===

export const createPromptConfigSchema = z.object({
  name: z.string()
    .min(1, '名稱不能為空')
    .max(100, '名稱最多 100 字元'),

  description: z.string()
    .max(500, '描述最多 500 字元')
    .optional()
    .nullable(),

  promptType: z.enum([
    'ISSUER_IDENTIFICATION',
    'TERM_CLASSIFICATION',
    'FIELD_EXTRACTION',
    'VALIDATION',
  ]),

  companyId: z.string().cuid().optional().nullable(),
  documentFormatId: z.string().cuid().optional().nullable(),

  systemPrompt: z.string()
    .max(5000, 'System Prompt 最多 5000 字元')
    .optional()
    .nullable(),

  userPromptTemplate: z.string()
    .min(10, 'User Prompt 模板至少 10 字元')
    .max(10000, 'User Prompt 模板最多 10000 字元'),

  mergeStrategy: z.enum(['OVERRIDE', 'APPEND', 'PREPEND']).default('OVERRIDE'),

  variables: z.array(promptVariableSchema).optional().nullable(),

  isActive: z.boolean().default(true),
  priority: z.number().int().min(0).max(100).default(0),
}).refine(
  (data) => {
    // 如果有 documentFormatId，必須有 companyId
    if (data.documentFormatId && !data.companyId) {
      return false;
    }
    return true;
  },
  {
    message: '指定 DocumentFormat 時必須同時指定 Company',
    path: ['documentFormatId'],
  }
);

// === 更新 Schema ===

export const updatePromptConfigSchema = createPromptConfigSchema.partial().omit({
  promptType: true,  // 不允許更改類型
});

// === 查詢參數 Schema ===

export const queryPromptConfigSchema = z.object({
  promptType: z.enum([
    'ISSUER_IDENTIFICATION',
    'TERM_CLASSIFICATION',
    'FIELD_EXTRACTION',
    'VALIDATION',
  ]).optional(),

  companyId: z.string().cuid().optional(),
  documentFormatId: z.string().cuid().optional(),

  isActive: z.enum(['true', 'false']).transform(v => v === 'true').optional(),

  search: z.string().max(100).optional(),

  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),

  sortBy: z.enum(['name', 'promptType', 'priority', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// === 類型導出 ===

export type CreatePromptConfigInput = z.infer<typeof createPromptConfigSchema>;
export type UpdatePromptConfigInput = z.infer<typeof updatePromptConfigSchema>;
export type QueryPromptConfigParams = z.infer<typeof queryPromptConfigSchema>;
```

### API 路由設計

#### 路由結構

```
src/app/api/v1/prompt-configs/
├── route.ts                     # GET (list), POST (create)
├── [id]/
│   └── route.ts                 # GET, PATCH, DELETE
├── types/
│   └── route.ts                 # GET prompt types metadata
└── resolve/
    └── route.ts                 # POST resolve prompt for context
```

#### 主要路由實現

```typescript
// src/app/api/v1/prompt-configs/route.ts

/**
 * @fileoverview Prompt 配置 API 路由
 * @module src/app/api/v1/prompt-configs
 * @since Epic 14 - Story 14.1
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  createPromptConfigSchema,
  queryPromptConfigSchema
} from '@/validations/prompt-config.validation';
import { getCurrentUser } from '@/lib/auth';
import { createApiError, createApiResponse } from '@/lib/api-utils';

/**
 * GET /api/v1/prompt-configs
 * 獲取 Prompt 配置列表
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const validatedParams = queryPromptConfigSchema.parse(searchParams);

    const {
      promptType,
      companyId,
      documentFormatId,
      isActive,
      search,
      page,
      limit,
      sortBy,
      sortOrder,
    } = validatedParams;

    // 構建查詢條件
    const where: any = {};

    if (promptType) {
      where.promptType = promptType;
    }

    if (companyId) {
      where.companyId = companyId;
    }

    if (documentFormatId) {
      where.documentFormatId = documentFormatId;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // 執行查詢
    const [configs, total] = await Promise.all([
      prisma.promptConfig.findMany({
        where,
        include: {
          company: {
            select: { id: true, name: true, code: true },
          },
          documentFormat: {
            select: { id: true, name: true, companyId: true },
          },
          createdBy: {
            select: { id: true, name: true },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.promptConfig.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: configs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return createApiError(error);
  }
}

/**
 * POST /api/v1/prompt-configs
 * 創建新的 Prompt 配置
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = createPromptConfigSchema.parse(body);

    // 檢查唯一性約束
    const existing = await prisma.promptConfig.findFirst({
      where: {
        promptType: validatedData.promptType,
        companyId: validatedData.companyId ?? null,
        documentFormatId: validatedData.documentFormatId ?? null,
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/conflict',
          title: 'Prompt Config Already Exists',
          status: 409,
          detail: '相同類型、公司、格式的配置已存在',
        },
        { status: 409 }
      );
    }

    // 驗證關聯存在
    if (validatedData.companyId) {
      const company = await prisma.company.findUnique({
        where: { id: validatedData.companyId },
      });
      if (!company) {
        return NextResponse.json(
          {
            type: 'https://api.example.com/errors/not-found',
            title: 'Company Not Found',
            status: 404,
            detail: '指定的公司不存在',
          },
          { status: 404 }
        );
      }
    }

    if (validatedData.documentFormatId) {
      const format = await prisma.documentFormat.findUnique({
        where: { id: validatedData.documentFormatId },
      });
      if (!format) {
        return NextResponse.json(
          {
            type: 'https://api.example.com/errors/not-found',
            title: 'Document Format Not Found',
            status: 404,
            detail: '指定的文件格式不存在',
          },
          { status: 404 }
        );
      }
    }

    // 創建配置
    const config = await prisma.promptConfig.create({
      data: {
        ...validatedData,
        createdById: user.id,
      },
      include: {
        company: {
          select: { id: true, name: true, code: true },
        },
        documentFormat: {
          select: { id: true, name: true, companyId: true },
        },
        createdBy: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(
      { success: true, data: config },
      { status: 201 }
    );
  } catch (error) {
    return createApiError(error);
  }
}
```

#### 單一配置路由

```typescript
// src/app/api/v1/prompt-configs/[id]/route.ts

/**
 * @fileoverview 單一 Prompt 配置 API 路由
 * @module src/app/api/v1/prompt-configs/[id]
 * @since Epic 14 - Story 14.1
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updatePromptConfigSchema } from '@/validations/prompt-config.validation';
import { getCurrentUser } from '@/lib/auth';
import { createApiError } from '@/lib/api-utils';

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/v1/prompt-configs/:id
 * 獲取單一 Prompt 配置
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const config = await prisma.promptConfig.findUnique({
      where: { id: params.id },
      include: {
        company: {
          select: { id: true, name: true, code: true },
        },
        documentFormat: {
          select: { id: true, name: true, companyId: true },
        },
        createdBy: {
          select: { id: true, name: true },
        },
      },
    });

    if (!config) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Prompt Config Not Found',
          status: 404,
          detail: '找不到指定的 Prompt 配置',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    return createApiError(error);
  }
}

/**
 * PATCH /api/v1/prompt-configs/:id
 * 更新 Prompt 配置
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = updatePromptConfigSchema.parse(body);

    // 檢查配置存在
    const existing = await prisma.promptConfig.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Prompt Config Not Found',
          status: 404,
          detail: '找不到指定的 Prompt 配置',
        },
        { status: 404 }
      );
    }

    // 更新配置
    const config = await prisma.promptConfig.update({
      where: { id: params.id },
      data: validatedData,
      include: {
        company: {
          select: { id: true, name: true, code: true },
        },
        documentFormat: {
          select: { id: true, name: true, companyId: true },
        },
        createdBy: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    return createApiError(error);
  }
}

/**
 * DELETE /api/v1/prompt-configs/:id
 * 刪除 Prompt 配置
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 檢查配置存在
    const existing = await prisma.promptConfig.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Prompt Config Not Found',
          status: 404,
          detail: '找不到指定的 Prompt 配置',
        },
        { status: 404 }
      );
    }

    // 刪除配置
    await prisma.promptConfig.delete({
      where: { id: params.id },
    });

    return NextResponse.json(
      { success: true, message: 'Prompt 配置已刪除' },
      { status: 200 }
    );
  } catch (error) {
    return createApiError(error);
  }
}
```

### 服務層實現

```typescript
// src/services/prompt-config.service.ts

/**
 * @fileoverview Prompt 配置服務
 * @description
 *   提供 Prompt 配置的業務邏輯處理
 *   包含 CRUD 操作和配置驗證
 *
 * @module src/services/prompt-config
 * @since Epic 14 - Story 14.1
 */

import { prisma } from '@/lib/prisma';
import type {
  PromptConfig,
  PromptConfigWithRelations,
  PromptType,
  PromptVariable,
} from '@/types/prompt-config';
import type {
  CreatePromptConfigInput,
  UpdatePromptConfigInput,
  QueryPromptConfigParams,
} from '@/validations/prompt-config.validation';

/**
 * Prompt 配置服務
 */
export class PromptConfigService {
  /**
   * 獲取配置列表
   */
  async list(params: QueryPromptConfigParams): Promise<{
    configs: PromptConfigWithRelations[];
    total: number;
  }> {
    const {
      promptType,
      companyId,
      documentFormatId,
      isActive,
      search,
      page,
      limit,
      sortBy,
      sortOrder,
    } = params;

    const where: any = {};

    if (promptType) where.promptType = promptType;
    if (companyId) where.companyId = companyId;
    if (documentFormatId) where.documentFormatId = documentFormatId;
    if (isActive !== undefined) where.isActive = isActive;

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [configs, total] = await Promise.all([
      prisma.promptConfig.findMany({
        where,
        include: {
          company: { select: { id: true, name: true, code: true } },
          documentFormat: { select: { id: true, name: true, companyId: true } },
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.promptConfig.count({ where }),
    ]);

    return { configs: configs as PromptConfigWithRelations[], total };
  }

  /**
   * 根據 ID 獲取配置
   */
  async getById(id: string): Promise<PromptConfigWithRelations | null> {
    const config = await prisma.promptConfig.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true, code: true } },
        documentFormat: { select: { id: true, name: true, companyId: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    return config as PromptConfigWithRelations | null;
  }

  /**
   * 創建配置
   */
  async create(
    data: CreatePromptConfigInput,
    userId: string
  ): Promise<PromptConfigWithRelations> {
    // 驗證變數定義
    if (data.variables) {
      this.validateVariables(data.variables, data.userPromptTemplate);
    }

    const config = await prisma.promptConfig.create({
      data: {
        ...data,
        createdById: userId,
      },
      include: {
        company: { select: { id: true, name: true, code: true } },
        documentFormat: { select: { id: true, name: true, companyId: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    return config as PromptConfigWithRelations;
  }

  /**
   * 更新配置
   */
  async update(
    id: string,
    data: UpdatePromptConfigInput
  ): Promise<PromptConfigWithRelations> {
    // 如果更新變數，驗證變數定義
    if (data.variables && data.userPromptTemplate) {
      this.validateVariables(data.variables, data.userPromptTemplate);
    }

    const config = await prisma.promptConfig.update({
      where: { id },
      data,
      include: {
        company: { select: { id: true, name: true, code: true } },
        documentFormat: { select: { id: true, name: true, companyId: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    return config as PromptConfigWithRelations;
  }

  /**
   * 刪除配置
   */
  async delete(id: string): Promise<void> {
    await prisma.promptConfig.delete({ where: { id } });
  }

  /**
   * 檢查配置是否存在
   */
  async exists(
    promptType: PromptType,
    companyId?: string | null,
    documentFormatId?: string | null
  ): Promise<boolean> {
    const count = await prisma.promptConfig.count({
      where: {
        promptType,
        companyId: companyId ?? null,
        documentFormatId: documentFormatId ?? null,
      },
    });

    return count > 0;
  }

  /**
   * 驗證變數定義與模板匹配
   */
  private validateVariables(
    variables: PromptVariable[],
    template: string
  ): void {
    // 提取模板中的變數（{{variableName}}）
    const templateVars = template.match(/\{\{(\w+)\}\}/g) || [];
    const templateVarNames = templateVars.map((v) =>
      v.replace(/\{\{|\}\}/g, '')
    );

    // 檢查所有模板變數都有定義
    const definedVarNames = variables.map((v) => v.name);

    for (const varName of templateVarNames) {
      if (!definedVarNames.includes(varName)) {
        throw new Error(
          `模板中使用了未定義的變數: {{${varName}}}`
        );
      }
    }

    // 檢查是否有未使用的變數定義（警告，不阻止）
    const unusedVars = definedVarNames.filter(
      (name) => !templateVarNames.includes(name)
    );

    if (unusedVars.length > 0) {
      console.warn(
        `警告: 以下變數已定義但未在模板中使用: ${unusedVars.join(', ')}`
      );
    }
  }

  /**
   * 獲取 Prompt 類型的中文描述
   */
  getPromptTypeLabel(type: PromptType): string {
    const labels: Record<PromptType, string> = {
      ISSUER_IDENTIFICATION: '發行者識別',
      TERM_CLASSIFICATION: '術語分類',
      FIELD_EXTRACTION: '欄位提取',
      VALIDATION: '結果驗證',
    };

    return labels[type] || type;
  }
}

// 導出單例
export const promptConfigService = new PromptConfigService();
```

---

## 📁 檔案結構

```
新增/修改檔案:
├── prisma/
│   └── schema.prisma                              # 新增 PromptConfig 模型
├── src/
│   ├── types/
│   │   └── prompt-config.ts                       # 類型定義
│   ├── validations/
│   │   └── prompt-config.validation.ts            # Zod Schema
│   ├── services/
│   │   └── prompt-config.service.ts               # 服務層
│   └── app/api/v1/prompt-configs/
│       ├── route.ts                               # GET, POST
│       ├── [id]/
│       │   └── route.ts                           # GET, PATCH, DELETE
│       └── types/
│           └── route.ts                           # GET prompt types
```

---

## 🧪 測試案例

### 單元測試

```typescript
// tests/unit/services/prompt-config.service.test.ts

describe('PromptConfigService', () => {
  describe('create', () => {
    it('should create a global prompt config', async () => {
      const input = {
        name: 'Global Issuer Identification',
        promptType: 'ISSUER_IDENTIFICATION' as const,
        userPromptTemplate: '識別以下發票的發行公司...',
        mergeStrategy: 'OVERRIDE' as const,
        isActive: true,
        priority: 0,
      };

      const result = await promptConfigService.create(input, 'user-1');

      expect(result.id).toBeDefined();
      expect(result.name).toBe(input.name);
      expect(result.companyId).toBeNull();
      expect(result.documentFormatId).toBeNull();
    });

    it('should create a company-specific prompt config', async () => {
      const input = {
        name: 'DHL Term Classification',
        promptType: 'TERM_CLASSIFICATION' as const,
        companyId: 'company-dhl',
        userPromptTemplate: '識別 DHL 發票中的術語...',
        mergeStrategy: 'APPEND' as const,
        isActive: true,
        priority: 10,
      };

      const result = await promptConfigService.create(input, 'user-1');

      expect(result.companyId).toBe('company-dhl');
    });

    it('should validate variable definitions', async () => {
      const input = {
        name: 'Config with Variables',
        promptType: 'TERM_CLASSIFICATION' as const,
        userPromptTemplate: '公司: {{companyName}}, 術語: {{knownTerms}}',
        variables: [
          { name: 'companyName', type: 'context' as const },
          // 缺少 knownTerms 定義
        ],
        mergeStrategy: 'OVERRIDE' as const,
        isActive: true,
        priority: 0,
      };

      await expect(
        promptConfigService.create(input, 'user-1')
      ).rejects.toThrow('模板中使用了未定義的變數: {{knownTerms}}');
    });
  });

  describe('exists', () => {
    it('should check for existing config', async () => {
      const exists = await promptConfigService.exists(
        'ISSUER_IDENTIFICATION',
        null,
        null
      );

      expect(typeof exists).toBe('boolean');
    });
  });
});
```

### API 測試

```typescript
// tests/integration/api/prompt-configs.test.ts

describe('POST /api/v1/prompt-configs', () => {
  it('should create prompt config with 201 status', async () => {
    const response = await request(app)
      .post('/api/v1/prompt-configs')
      .send({
        name: 'Test Config',
        promptType: 'TERM_CLASSIFICATION',
        userPromptTemplate: 'Test template...',
        mergeStrategy: 'OVERRIDE',
        isActive: true,
        priority: 0,
      })
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBeDefined();
  });

  it('should return 409 for duplicate config', async () => {
    // 第一次創建
    await request(app)
      .post('/api/v1/prompt-configs')
      .send({
        name: 'Global Config',
        promptType: 'ISSUER_IDENTIFICATION',
        userPromptTemplate: 'Template...',
      })
      .set('Authorization', `Bearer ${authToken}`);

    // 第二次創建相同配置
    const response = await request(app)
      .post('/api/v1/prompt-configs')
      .send({
        name: 'Another Global Config',
        promptType: 'ISSUER_IDENTIFICATION',
        userPromptTemplate: 'Another template...',
      })
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(409);
  });
});

describe('GET /api/v1/prompt-configs', () => {
  it('should return paginated list', async () => {
    const response = await request(app)
      .get('/api/v1/prompt-configs')
      .query({ page: 1, limit: 10 })
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeInstanceOf(Array);
    expect(response.body.meta).toHaveProperty('total');
    expect(response.body.meta).toHaveProperty('totalPages');
  });

  it('should filter by promptType', async () => {
    const response = await request(app)
      .get('/api/v1/prompt-configs')
      .query({ promptType: 'TERM_CLASSIFICATION' })
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    response.body.data.forEach((config: any) => {
      expect(config.promptType).toBe('TERM_CLASSIFICATION');
    });
  });
});
```

---

## 📋 實施檢查清單

### 開發階段
- [ ] 建立 Prisma Schema（PromptConfig 模型）
- [ ] 執行資料庫遷移
- [ ] 建立 TypeScript 類型定義
- [ ] 建立 Zod 驗證 Schema
- [ ] 實現 PromptConfigService
- [ ] 實現 API 路由（CRUD）
- [ ] 建立 index.ts 導出

### 測試階段
- [ ] 單元測試：服務層測試
- [ ] 整合測試：API 測試
- [ ] 邊界案例測試

### 文檔階段
- [ ] API 文檔（OpenAPI）
- [ ] 類型定義文檔

---

## 🔗 相關文檔

- **Epic 概覽**: `claudedocs/1-planning/epics/epic-14/epic-14-overview.md`
- **Story 14-2**: Prompt 配置管理介面
- **Story 14-3**: Prompt 解析與合併服務
- **Epic 0 參考**: Story 0-8 (發行者識別), Story 0-10 (術語分類)

---

*Story created: 2026-01-02*
*Last updated: 2026-01-02*
