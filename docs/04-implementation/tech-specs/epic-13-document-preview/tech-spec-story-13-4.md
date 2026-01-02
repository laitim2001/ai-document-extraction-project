# Tech Spec: Story 13.4 - 映射配置 API

> **Version**: 1.0.0
> **Created**: 2026-01-02
> **Status**: Draft
> **Story Key**: STORY-13-4

---

## Overview

| 項目 | 內容 |
|------|------|
| **Story ID** | 13.4 |
| **Epic** | Epic 13 - 文件預覽與欄位映射 |
| **Estimated Effort** | 5 Story Points |
| **Dependencies** | 無 |
| **Blocking** | Story 13.3（配置介面）, Story 13.5（動態映射服務） |
| **FR Coverage** | 擴展 Epic 2 處理流程 |

---

## Objective

實現欄位映射配置的 REST API，支援：
- FieldMappingConfig 和 FieldMappingRule 的 CRUD 操作
- 按 Company/DocumentFormat 篩選配置
- 測試端點驗證映射效果
- 配置導入/導出功能

---

## Acceptance Criteria Mapping

| AC ID | 驗收條件 | 實現方式 |
|-------|----------|----------|
| AC-13.4.1 | GET /api/v1/field-mapping-configs 返回配置列表 | 分頁查詢 + 篩選條件 |
| AC-13.4.2 | POST 建立新配置並返回詳情 | Prisma 事務建立 |
| AC-13.4.3 | PATCH 更新配置並返回結果 | 樂觀鎖版本控制 |
| AC-13.4.4 | 支援配置測試端點 | POST /test 模擬映射 |
| AC-13.4.5 | 支援導入/導出 | JSON 格式序列化 |

---

## Implementation Guide

### Phase 1: Prisma Schema 設計 (1 point)

#### 1.1 資料模型

```prisma
// prisma/schema.prisma

/// 欄位映射配置
model FieldMappingConfig {
  id               String   @id @default(cuid())

  /// 配置範圍: GLOBAL, COMPANY, FORMAT
  scope            String   @db.VarChar(20)

  /// 關聯的公司（可選）
  companyId        String?  @map("company_id")
  company          Company? @relation(fields: [companyId], references: [id])

  /// 關聯的文件格式（可選）
  documentFormatId String?  @map("document_format_id")
  documentFormat   DocumentFormat? @relation(fields: [documentFormatId], references: [id])

  name             String   @db.VarChar(100)
  description      String?  @db.Text
  isActive         Boolean  @default(true) @map("is_active")
  version          Int      @default(1)

  /// 映射規則
  rules            FieldMappingRule[]

  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")
  createdBy        String?  @map("created_by")

  /// 唯一約束：同一範圍+公司+格式只能有一個配置
  @@unique([scope, companyId, documentFormatId])
  @@index([companyId])
  @@index([documentFormatId])
  @@map("field_mapping_configs")
}

/// 欄位映射規則
model FieldMappingRule {
  id               String   @id @default(cuid())

  configId         String   @map("config_id")
  config           FieldMappingConfig @relation(fields: [configId], references: [id], onDelete: Cascade)

  /// 來源欄位（JSON 陣列）
  sourceFields     Json     @map("source_fields")

  /// 目標欄位
  targetField      String   @map("target_field") @db.VarChar(100)

  /// 轉換類型: DIRECT, CONCAT, SPLIT, LOOKUP, CUSTOM
  transformType    String   @map("transform_type") @db.VarChar(20)

  /// 轉換參數（JSON）
  transformParams  Json?    @map("transform_params")

  /// 執行優先級（數字越小越先執行）
  priority         Int      @default(0)

  isActive         Boolean  @default(true) @map("is_active")
  description      String?  @db.VarChar(500)

  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  @@index([configId])
  @@index([targetField])
  @@map("field_mapping_rules")
}
```

### Phase 2: API 路由實現 (3 points)

#### 2.1 配置列表與查詢

```typescript
// src/app/api/v1/field-mapping-configs/route.ts

/**
 * @fileoverview 欄位映射配置 API - 列表與建立
 * @module src/app/api/v1/field-mapping-configs
 * @since Epic 13 - Story 13.4
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/middlewares/auth';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-response';

const querySchema = z.object({
  scope: z.enum(['GLOBAL', 'COMPANY', 'FORMAT']).optional(),
  companyId: z.string().cuid().optional(),
  documentFormatId: z.string().cuid().optional(),
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

const createSchema = z.object({
  scope: z.enum(['GLOBAL', 'COMPANY', 'FORMAT']),
  companyId: z.string().cuid().optional().nullable(),
  documentFormatId: z.string().cuid().optional().nullable(),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  rules: z.array(z.object({
    sourceFields: z.array(z.string()).min(1),
    targetField: z.string().min(1),
    transformType: z.enum(['DIRECT', 'CONCAT', 'SPLIT', 'LOOKUP', 'CUSTOM']),
    transformParams: z.record(z.unknown()).optional(),
    priority: z.number().int().default(0),
    isActive: z.boolean().default(true),
    description: z.string().optional(),
  })).optional(),
});

export const GET = withAuth(async (req: NextRequest) => {
  try {
    const searchParams = Object.fromEntries(req.nextUrl.searchParams);
    const query = querySchema.parse(searchParams);

    const where = {
      ...(query.scope && { scope: query.scope }),
      ...(query.companyId && { companyId: query.companyId }),
      ...(query.documentFormatId && { documentFormatId: query.documentFormatId }),
      ...(query.isActive !== undefined && { isActive: query.isActive }),
    };

    const [configs, total] = await Promise.all([
      prisma.fieldMappingConfig.findMany({
        where,
        include: {
          company: { select: { id: true, name: true } },
          documentFormat: { select: { id: true, name: true } },
          rules: { orderBy: { priority: 'asc' } },
          _count: { select: { rules: true } },
        },
        orderBy: [{ scope: 'asc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.fieldMappingConfig.count({ where }),
    ]);

    return createSuccessResponse({
      data: configs,
      meta: {
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      },
    });
  } catch (error) {
    return createErrorResponse(error);
  }
});

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const data = createSchema.parse(body);

    // 驗證唯一性
    const existing = await prisma.fieldMappingConfig.findFirst({
      where: {
        scope: data.scope,
        companyId: data.companyId ?? null,
        documentFormatId: data.documentFormatId ?? null,
      },
    });

    if (existing) {
      return createErrorResponse({
        type: 'DUPLICATE_CONFIG',
        title: '配置已存在',
        status: 409,
        detail: '相同範圍和目標的配置已存在',
      });
    }

    // 事務建立配置和規則
    const config = await prisma.$transaction(async (tx) => {
      const newConfig = await tx.fieldMappingConfig.create({
        data: {
          scope: data.scope,
          companyId: data.companyId,
          documentFormatId: data.documentFormatId,
          name: data.name,
          description: data.description,
          isActive: data.isActive,
          rules: data.rules
            ? {
                create: data.rules.map((rule, idx) => ({
                  sourceFields: rule.sourceFields,
                  targetField: rule.targetField,
                  transformType: rule.transformType,
                  transformParams: rule.transformParams ?? {},
                  priority: rule.priority ?? idx,
                  isActive: rule.isActive,
                  description: rule.description,
                })),
              }
            : undefined,
        },
        include: {
          company: { select: { id: true, name: true } },
          documentFormat: { select: { id: true, name: true } },
          rules: { orderBy: { priority: 'asc' } },
        },
      });

      return newConfig;
    });

    return createSuccessResponse({ data: config }, 201);
  } catch (error) {
    return createErrorResponse(error);
  }
});
```

#### 2.2 單一配置操作

```typescript
// src/app/api/v1/field-mapping-configs/[id]/route.ts

/**
 * @fileoverview 欄位映射配置 API - 單一資源操作
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/middlewares/auth';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-response';

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  version: z.number().int(), // 樂觀鎖
});

interface RouteParams {
  params: { id: string };
}

export const GET = withAuth(async (req: NextRequest, { params }: RouteParams) => {
  try {
    const config = await prisma.fieldMappingConfig.findUnique({
      where: { id: params.id },
      include: {
        company: { select: { id: true, name: true } },
        documentFormat: { select: { id: true, name: true } },
        rules: { orderBy: { priority: 'asc' } },
      },
    });

    if (!config) {
      return createErrorResponse({
        type: 'NOT_FOUND',
        title: '配置不存在',
        status: 404,
        detail: `找不到 ID 為 ${params.id} 的配置`,
      });
    }

    return createSuccessResponse({ data: config });
  } catch (error) {
    return createErrorResponse(error);
  }
});

export const PATCH = withAuth(async (req: NextRequest, { params }: RouteParams) => {
  try {
    const body = await req.json();
    const data = updateSchema.parse(body);

    // 樂觀鎖檢查
    const existing = await prisma.fieldMappingConfig.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return createErrorResponse({
        type: 'NOT_FOUND',
        title: '配置不存在',
        status: 404,
      });
    }

    if (existing.version !== data.version) {
      return createErrorResponse({
        type: 'CONFLICT',
        title: '版本衝突',
        status: 409,
        detail: '配置已被其他人修改，請重新載入',
      });
    }

    const config = await prisma.fieldMappingConfig.update({
      where: { id: params.id },
      data: {
        name: data.name,
        description: data.description,
        isActive: data.isActive,
        version: { increment: 1 },
      },
      include: {
        company: { select: { id: true, name: true } },
        documentFormat: { select: { id: true, name: true } },
        rules: { orderBy: { priority: 'asc' } },
      },
    });

    return createSuccessResponse({ data: config });
  } catch (error) {
    return createErrorResponse(error);
  }
});

export const DELETE = withAuth(async (req: NextRequest, { params }: RouteParams) => {
  try {
    await prisma.fieldMappingConfig.delete({
      where: { id: params.id },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return createErrorResponse(error);
  }
});
```

#### 2.3 規則 CRUD API

```typescript
// src/app/api/v1/field-mapping-configs/[id]/rules/route.ts

/**
 * @fileoverview 映射規則 API
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/middlewares/auth';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-response';

const createRuleSchema = z.object({
  sourceFields: z.array(z.string()).min(1),
  targetField: z.string().min(1),
  transformType: z.enum(['DIRECT', 'CONCAT', 'SPLIT', 'LOOKUP', 'CUSTOM']),
  transformParams: z.record(z.unknown()).optional(),
  priority: z.number().int().optional(),
  isActive: z.boolean().default(true),
  description: z.string().optional(),
});

interface RouteParams {
  params: { id: string };
}

export const POST = withAuth(async (req: NextRequest, { params }: RouteParams) => {
  try {
    const body = await req.json();
    const data = createRuleSchema.parse(body);

    // 獲取當前最大優先級
    const maxPriority = await prisma.fieldMappingRule.aggregate({
      where: { configId: params.id },
      _max: { priority: true },
    });

    const rule = await prisma.fieldMappingRule.create({
      data: {
        configId: params.id,
        sourceFields: data.sourceFields,
        targetField: data.targetField,
        transformType: data.transformType,
        transformParams: data.transformParams ?? {},
        priority: data.priority ?? (maxPriority._max.priority ?? 0) + 1,
        isActive: data.isActive,
        description: data.description,
      },
    });

    // 更新配置版本
    await prisma.fieldMappingConfig.update({
      where: { id: params.id },
      data: { version: { increment: 1 } },
    });

    return createSuccessResponse({ data: rule }, 201);
  } catch (error) {
    return createErrorResponse(error);
  }
});
```

#### 2.4 規則重排序 API

```typescript
// src/app/api/v1/field-mapping-configs/[id]/rules/reorder/route.ts

/**
 * @fileoverview 規則重排序 API
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/middlewares/auth';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-response';

const reorderSchema = z.object({
  ruleIds: z.array(z.string().cuid()),
});

interface RouteParams {
  params: { id: string };
}

export const POST = withAuth(async (req: NextRequest, { params }: RouteParams) => {
  try {
    const body = await req.json();
    const { ruleIds } = reorderSchema.parse(body);

    await prisma.$transaction(async (tx) => {
      // 批量更新優先級
      await Promise.all(
        ruleIds.map((ruleId, index) =>
          tx.fieldMappingRule.update({
            where: { id: ruleId },
            data: { priority: index },
          })
        )
      );

      // 更新配置版本
      await tx.fieldMappingConfig.update({
        where: { id: params.id },
        data: { version: { increment: 1 } },
      });
    });

    return createSuccessResponse({ data: { success: true } });
  } catch (error) {
    return createErrorResponse(error);
  }
});
```

### Phase 3: 測試與導出端點 (1 point)

#### 3.1 測試端點

```typescript
// src/app/api/v1/field-mapping-configs/[id]/test/route.ts

/**
 * @fileoverview 映射測試端點
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/middlewares/auth';
import { FieldMappingEngine } from '@/services/field-mapping-engine';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-response';

const testSchema = z.object({
  sourceData: z.record(z.unknown()),
});

interface RouteParams {
  params: { id: string };
}

export const POST = withAuth(async (req: NextRequest, { params }: RouteParams) => {
  try {
    const body = await req.json();
    const { sourceData } = testSchema.parse(body);

    const config = await prisma.fieldMappingConfig.findUnique({
      where: { id: params.id },
      include: {
        rules: {
          where: { isActive: true },
          orderBy: { priority: 'asc' },
        },
      },
    });

    if (!config) {
      return createErrorResponse({
        type: 'NOT_FOUND',
        title: '配置不存在',
        status: 404,
      });
    }

    const engine = new FieldMappingEngine(config.rules);
    const result = engine.execute(sourceData);

    return createSuccessResponse({
      data: {
        input: sourceData,
        output: result.mappedData,
        appliedRules: result.appliedRules,
        errors: result.errors,
      },
    });
  } catch (error) {
    return createErrorResponse(error);
  }
});
```

#### 3.2 導出端點

```typescript
// src/app/api/v1/field-mapping-configs/[id]/export/route.ts

/**
 * @fileoverview 配置導出端點
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/middlewares/auth';
import { createErrorResponse } from '@/lib/api-response';

interface RouteParams {
  params: { id: string };
}

export const GET = withAuth(async (req: NextRequest, { params }: RouteParams) => {
  try {
    const config = await prisma.fieldMappingConfig.findUnique({
      where: { id: params.id },
      include: {
        rules: { orderBy: { priority: 'asc' } },
      },
    });

    if (!config) {
      return createErrorResponse({
        type: 'NOT_FOUND',
        title: '配置不存在',
        status: 404,
      });
    }

    // 移除內部欄位
    const exportData = {
      name: config.name,
      scope: config.scope,
      description: config.description,
      rules: config.rules.map((rule) => ({
        sourceFields: rule.sourceFields,
        targetField: rule.targetField,
        transformType: rule.transformType,
        transformParams: rule.transformParams,
        priority: rule.priority,
        description: rule.description,
      })),
      exportedAt: new Date().toISOString(),
      version: config.version,
    };

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="mapping-config-${config.id}.json"`,
      },
    });
  } catch (error) {
    return createErrorResponse(error);
  }
});
```

---

## API Endpoints Summary

| 端點 | 方法 | 說明 |
|------|------|------|
| `/api/v1/field-mapping-configs` | GET | 查詢配置列表（支援篩選、分頁） |
| `/api/v1/field-mapping-configs` | POST | 建立新配置（含規則） |
| `/api/v1/field-mapping-configs/:id` | GET | 獲取單一配置詳情 |
| `/api/v1/field-mapping-configs/:id` | PATCH | 更新配置（樂觀鎖） |
| `/api/v1/field-mapping-configs/:id` | DELETE | 刪除配置（級聯刪除規則） |
| `/api/v1/field-mapping-configs/:id/rules` | POST | 新增規則 |
| `/api/v1/field-mapping-configs/:id/rules/:ruleId` | PATCH | 更新規則 |
| `/api/v1/field-mapping-configs/:id/rules/:ruleId` | DELETE | 刪除規則 |
| `/api/v1/field-mapping-configs/:id/rules/reorder` | POST | 重排序規則 |
| `/api/v1/field-mapping-configs/:id/test` | POST | 測試映射效果 |
| `/api/v1/field-mapping-configs/:id/export` | GET | 導出配置 JSON |
| `/api/v1/field-mapping-configs/import` | POST | 導入配置 |

---

## Project Structure

```
src/
├── app/
│   └── api/
│       └── v1/
│           └── field-mapping-configs/
│               ├── route.ts                    # 列表與建立
│               └── [id]/
│                   ├── route.ts                # 單一資源
│                   ├── rules/
│                   │   ├── route.ts            # 規則 CRUD
│                   │   ├── [ruleId]/
│                   │   │   └── route.ts        # 單一規則
│                   │   └── reorder/
│                   │       └── route.ts        # 重排序
│                   ├── test/
│                   │   └── route.ts            # 測試端點
│                   └── export/
│                       └── route.ts            # 導出
├── services/
│   └── field-mapping-engine.ts                 # 映射引擎
└── validations/
    └── field-mapping.ts                        # Zod schemas
```

---

## Verification Checklist

### API 驗證

- [ ] GET /configs 正確返回分頁列表
- [ ] GET /configs 篩選條件正常工作
- [ ] POST /configs 建立配置成功
- [ ] POST /configs 唯一性衝突返回 409
- [ ] GET /configs/:id 返回完整配置
- [ ] PATCH /configs/:id 樂觀鎖正常
- [ ] DELETE /configs/:id 級聯刪除規則
- [ ] POST /configs/:id/rules 新增規則成功
- [ ] POST /reorder 重排序成功
- [ ] POST /test 測試映射返回結果
- [ ] GET /export 下載 JSON 檔案

---

*Tech Spec 建立日期: 2026-01-02*
*狀態: Draft*
