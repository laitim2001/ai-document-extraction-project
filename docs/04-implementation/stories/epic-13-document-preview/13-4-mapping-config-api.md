# Story 13-4: 映射配置 API

**Status:** backlog

---

## Story

**As a** 系統開發者,
**I want** 透過 REST API 管理欄位映射配置,
**So that** 前端介面和其他服務可以讀取、創建、更新、刪除映射配置。

---

## 背景說明

### 問題陳述

Story 13-3 實現了前端映射配置介面，需要後端 API 支援：
- 映射配置的 CRUD 操作
- 配置優先級解析
- 配置驗證
- 測試提取功能

### API 設計原則

遵循項目現有的 API 設計規範：
- RESTful 風格
- RFC 7807 錯誤格式
- Zod 請求驗證
- 分頁和篩選支援

---

## Acceptance Criteria

### AC1: 映射配置 CRUD API

**Given** 系統管理員有權限操作映射配置
**When** 調用映射配置 API
**Then**：
  - `GET /api/v1/field-mappings` - 列出所有配置（支援分頁、篩選）
  - `GET /api/v1/field-mappings/:id` - 獲取單個配置詳情
  - `POST /api/v1/field-mappings` - 創建新配置
  - `PATCH /api/v1/field-mappings/:id` - 更新配置
  - `DELETE /api/v1/field-mappings/:id` - 刪除配置

### AC2: 配置解析 API

**Given** 需要獲取特定上下文的有效映射
**When** 調用配置解析 API
**Then**：
  - `GET /api/v1/field-mappings/resolve` 接受 `companyId` 和 `documentFormatId` 參數
  - 返回按優先級解析後的有效映射配置
  - 包含配置來源資訊（全局/公司/格式）

### AC3: 配置驗證

**Given** 創建或更新映射配置
**When** API 處理請求
**Then**：
  - 驗證必填欄位是否有映射
  - 驗證欄位名稱有效性
  - 驗證轉換規則語法
  - 返回詳細的驗證錯誤

### AC4: 測試提取 API

**Given** 用戶想測試映射配置效果
**When** 調用測試提取 API
**Then**：
  - `POST /api/v1/field-mappings/:id/test` 接受測試文件
  - 使用指定配置執行提取
  - 返回原始提取結果和映射後結果對比

### AC5: 配置複製和導出

**Given** 用戶想複製或導出配置
**When** 調用對應 API
**Then**：
  - `POST /api/v1/field-mappings/:id/duplicate` - 複製配置
  - `GET /api/v1/field-mappings/:id/export` - 導出為 JSON
  - `POST /api/v1/field-mappings/import` - 導入 JSON 配置

---

## Tasks / Subtasks

- [ ] **Task 1: Prisma Schema 擴展** (AC: #1-5)
  - [ ] 1.1 創建 `FieldMappingConfig` 模型
  - [ ] 1.2 添加與 Company、DocumentFormat 的關聯
  - [ ] 1.3 創建索引和約束
  - [ ] 1.4 執行資料庫遷移

- [ ] **Task 2: CRUD API 端點** (AC: #1)
  - [ ] 2.1 創建 `src/app/api/v1/field-mappings/route.ts` (GET, POST)
  - [ ] 2.2 創建 `src/app/api/v1/field-mappings/[id]/route.ts` (GET, PATCH, DELETE)
  - [ ] 2.3 實現分頁和篩選邏輯
  - [ ] 2.4 創建 Zod 驗證 Schema

- [ ] **Task 3: 配置解析服務** (AC: #2)
  - [ ] 3.1 創建 `src/services/field-mapping-resolver.service.ts`
  - [ ] 3.2 實現優先級解析邏輯
  - [ ] 3.3 創建 `src/app/api/v1/field-mappings/resolve/route.ts`
  - [ ] 3.4 添加解析結果緩存

- [ ] **Task 4: 驗證服務** (AC: #3)
  - [ ] 4.1 創建 `src/services/field-mapping-validator.service.ts`
  - [ ] 4.2 實現欄位名稱驗證
  - [ ] 4.3 實現必填欄位檢查
  - [ ] 4.4 實現轉換規則驗證

- [ ] **Task 5: 測試提取 API** (AC: #4)
  - [ ] 5.1 創建 `src/app/api/v1/field-mappings/[id]/test/route.ts`
  - [ ] 5.2 整合 Azure DI 服務
  - [ ] 5.3 實現結果對比邏輯
  - [ ] 5.4 處理大文件上傳

- [ ] **Task 6: 複製和導出 API** (AC: #5)
  - [ ] 6.1 創建 `src/app/api/v1/field-mappings/[id]/duplicate/route.ts`
  - [ ] 6.2 創建 `src/app/api/v1/field-mappings/[id]/export/route.ts`
  - [ ] 6.3 創建 `src/app/api/v1/field-mappings/import/route.ts`
  - [ ] 6.4 實現導入驗證

- [ ] **Task 7: 類型定義和 Hook** (AC: #1-5)
  - [ ] 7.1 創建 `src/validations/field-mapping.ts`
  - [ ] 7.2 創建 `src/hooks/use-field-mapping-api.ts`
  - [ ] 7.3 更新 `src/services/index.ts`

- [ ] **Task 8: 驗證與測試** (AC: #1-5)
  - [ ] 8.1 TypeScript 類型檢查通過
  - [ ] 8.2 ESLint 檢查通過
  - [ ] 8.3 單元測試：驗證邏輯、解析邏輯
  - [ ] 8.4 整合測試：API 端點
  - [ ] 8.5 API 文檔更新

---

## Dev Notes

### 依賴項

- **Story 13-3**: 前端映射配置介面（消費此 API）
- **Story 13-5**: 動態欄位映射服務（使用配置解析 API）

### Prisma Schema

```prisma
// prisma/schema.prisma

model FieldMappingConfig {
  id               String   @id @default(cuid())
  name             String
  description      String?  @db.Text

  // 適用範圍（可選）
  companyId        String?  @map("company_id")
  company          Company? @relation(fields: [companyId], references: [id], onDelete: SetNull)

  documentFormatId String?  @map("document_format_id")
  documentFormat   DocumentFormat? @relation(fields: [documentFormatId], references: [id], onDelete: SetNull)

  // 映射定義 (JSON)
  mappings         Json     // FieldMapping[]

  // 狀態
  isActive         Boolean  @default(true) @map("is_active")
  priority         Int      @default(0)

  // 審計
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")
  createdById      String   @map("created_by_id")
  createdBy        User     @relation(fields: [createdById], references: [id])

  // 唯一約束：同一公司+格式只能有一個配置
  @@unique([companyId, documentFormatId], name: "unique_company_format")
  @@index([companyId])
  @@index([documentFormatId])
  @@index([isActive])
  @@map("field_mapping_configs")
}
```

### API 路由結構

```
src/app/api/v1/field-mappings/
├── route.ts                    # GET (list), POST (create)
├── resolve/
│   └── route.ts                # GET (resolve config for context)
├── import/
│   └── route.ts                # POST (import JSON)
├── [id]/
│   ├── route.ts                # GET, PATCH, DELETE
│   ├── test/
│   │   └── route.ts            # POST (test extraction)
│   ├── duplicate/
│   │   └── route.ts            # POST (duplicate)
│   └── export/
│       └── route.ts            # GET (export JSON)
```

### Zod 驗證 Schema

```typescript
// src/validations/field-mapping.ts

import { z } from 'zod';

// 轉換類型
export const TransformationTypeSchema = z.enum([
  'none',
  'toUpperCase',
  'toLowerCase',
  'formatDate',
  'formatCurrency',
  'extractNumber',
  'trim',
  'custom',
]);

// 單個欄位映射
export const FieldMappingSchema = z.object({
  id: z.string(),
  sourceField: z.string().min(1, '來源欄位不能為空'),
  targetField: z.string().min(1, '目標欄位不能為空'),
  isRequired: z.boolean().default(false),
  defaultValue: z.string().optional(),
  transformation: TransformationTypeSchema.default('none'),
  customTransformation: z.string().optional(),
});

// 創建配置請求
export const CreateFieldMappingConfigSchema = z.object({
  name: z.string().min(1, '配置名稱不能為空').max(100),
  description: z.string().max(500).optional(),
  companyId: z.string().cuid().optional().nullable(),
  documentFormatId: z.string().cuid().optional().nullable(),
  mappings: z.array(FieldMappingSchema).min(1, '至少需要一個欄位映射'),
  isActive: z.boolean().default(true),
  priority: z.number().int().min(0).max(100).default(0),
});

// 更新配置請求
export const UpdateFieldMappingConfigSchema = CreateFieldMappingConfigSchema.partial();

// 列表查詢參數
export const ListFieldMappingConfigsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  companyId: z.string().cuid().optional(),
  documentFormatId: z.string().cuid().optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().optional(),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt', 'priority']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// 解析請求參數
export const ResolveFieldMappingConfigSchema = z.object({
  companyId: z.string().cuid().optional(),
  documentFormatId: z.string().cuid().optional(),
});

// 測試提取請求
export const TestExtractionSchema = z.object({
  // 文件通過 FormData 上傳
});

// 導入配置請求
export const ImportFieldMappingConfigSchema = z.object({
  config: CreateFieldMappingConfigSchema,
  overwrite: z.boolean().default(false),
});

// 類型導出
export type FieldMapping = z.infer<typeof FieldMappingSchema>;
export type CreateFieldMappingConfigInput = z.infer<typeof CreateFieldMappingConfigSchema>;
export type UpdateFieldMappingConfigInput = z.infer<typeof UpdateFieldMappingConfigSchema>;
export type ListFieldMappingConfigsInput = z.infer<typeof ListFieldMappingConfigsSchema>;
export type ResolveFieldMappingConfigInput = z.infer<typeof ResolveFieldMappingConfigSchema>;
```

### 配置解析服務

```typescript
// src/services/field-mapping-resolver.service.ts

import { prisma } from '@/lib/prisma';
import type { FieldMappingConfig, FieldMapping } from '@/types/field-mapping-config';

interface ResolveContext {
  companyId?: string;
  documentFormatId?: string;
}

interface ResolvedConfig {
  config: FieldMappingConfig;
  source: 'specific' | 'company' | 'format' | 'global';
  priority: number;
}

/**
 * 解析特定上下文的有效映射配置
 *
 * 優先級順序（由高到低）：
 * 1. 公司 + 文件格式 特定配置
 * 2. 公司 特定配置（無格式）
 * 3. 文件格式 特定配置（無公司）
 * 4. 全局配置（無公司無格式）
 */
export async function resolveFieldMappingConfig(
  context: ResolveContext
): Promise<ResolvedConfig | null> {
  const { companyId, documentFormatId } = context;

  // 查詢所有可能適用的配置，按優先級排序
  const configs = await prisma.fieldMappingConfig.findMany({
    where: {
      isActive: true,
      OR: [
        // 精確匹配：公司 + 格式
        { companyId, documentFormatId },
        // 公司匹配：公司 + 無格式
        { companyId, documentFormatId: null },
        // 格式匹配：無公司 + 格式
        { companyId: null, documentFormatId },
        // 全局：無公司 + 無格式
        { companyId: null, documentFormatId: null },
      ],
    },
    orderBy: [
      { priority: 'desc' },
      { createdAt: 'desc' },
    ],
    include: {
      company: { select: { id: true, name: true } },
      documentFormat: { select: { id: true, name: true } },
    },
  });

  if (configs.length === 0) {
    return null;
  }

  // 按匹配精確度排序
  const sortedConfigs = configs.sort((a, b) => {
    const scoreA = getMatchScore(a, companyId, documentFormatId);
    const scoreB = getMatchScore(b, companyId, documentFormatId);
    return scoreB - scoreA;
  });

  const bestConfig = sortedConfigs[0];
  const source = getConfigSource(bestConfig, companyId, documentFormatId);

  return {
    config: bestConfig as FieldMappingConfig,
    source,
    priority: bestConfig.priority,
  };
}

function getMatchScore(
  config: { companyId: string | null; documentFormatId: string | null },
  companyId?: string,
  documentFormatId?: string
): number {
  let score = 0;

  // 精確匹配得分最高
  if (config.companyId && config.companyId === companyId) {
    score += 10;
  }
  if (config.documentFormatId && config.documentFormatId === documentFormatId) {
    score += 10;
  }

  // 有限制的配置優先於全局配置
  if (config.companyId) score += 1;
  if (config.documentFormatId) score += 1;

  return score;
}

function getConfigSource(
  config: { companyId: string | null; documentFormatId: string | null },
  companyId?: string,
  documentFormatId?: string
): 'specific' | 'company' | 'format' | 'global' {
  const hasCompanyMatch = config.companyId && config.companyId === companyId;
  const hasFormatMatch = config.documentFormatId && config.documentFormatId === documentFormatId;

  if (hasCompanyMatch && hasFormatMatch) return 'specific';
  if (hasCompanyMatch) return 'company';
  if (hasFormatMatch) return 'format';
  return 'global';
}

/**
 * 合併多個配置（用於繼承場景）
 */
export function mergeConfigs(
  configs: FieldMappingConfig[]
): FieldMapping[] {
  const mergedMappings = new Map<string, FieldMapping>();

  // 按優先級從低到高處理，高優先級覆蓋低優先級
  for (const config of configs.reverse()) {
    const mappings = config.mappings as FieldMapping[];
    for (const mapping of mappings) {
      mergedMappings.set(mapping.targetField, mapping);
    }
  }

  return Array.from(mergedMappings.values());
}
```

### 驗證服務

```typescript
// src/services/field-mapping-validator.service.ts

import {
  AZURE_DI_INVOICE_FIELDS,
  AZURE_DI_LINE_ITEM_FIELDS,
} from '@/lib/field-mapping/azure-di-fields';
import {
  SYSTEM_INVOICE_FIELDS,
  SYSTEM_LINE_ITEM_FIELDS,
} from '@/lib/field-mapping/system-fields';
import type { FieldMapping } from '@/types/field-mapping-config';

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

interface ValidationError {
  field: string;
  code: string;
  message: string;
}

interface ValidationWarning {
  field: string;
  code: string;
  message: string;
}

const validSourceFields = new Set([
  ...AZURE_DI_INVOICE_FIELDS.map(f => f.name),
  ...AZURE_DI_LINE_ITEM_FIELDS.map(f => f.name),
]);

const validTargetFields = new Set([
  ...SYSTEM_INVOICE_FIELDS.map(f => f.name),
  ...SYSTEM_LINE_ITEM_FIELDS.map(f => f.name),
]);

const requiredTargetFields = new Set(
  [...SYSTEM_INVOICE_FIELDS, ...SYSTEM_LINE_ITEM_FIELDS]
    .filter(f => f.isRequired)
    .map(f => f.name)
);

export function validateMappingConfig(
  mappings: FieldMapping[]
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  const mappedTargets = new Set<string>();
  const mappedSources = new Set<string>();

  for (const mapping of mappings) {
    // 檢查來源欄位有效性
    if (!validSourceFields.has(mapping.sourceField)) {
      errors.push({
        field: mapping.sourceField,
        code: 'INVALID_SOURCE_FIELD',
        message: `無效的來源欄位: ${mapping.sourceField}`,
      });
    }

    // 檢查目標欄位有效性
    if (!validTargetFields.has(mapping.targetField)) {
      errors.push({
        field: mapping.targetField,
        code: 'INVALID_TARGET_FIELD',
        message: `無效的目標欄位: ${mapping.targetField}`,
      });
    }

    // 檢查重複映射
    if (mappedTargets.has(mapping.targetField)) {
      errors.push({
        field: mapping.targetField,
        code: 'DUPLICATE_TARGET',
        message: `目標欄位 ${mapping.targetField} 已被映射`,
      });
    }
    mappedTargets.add(mapping.targetField);

    // 檢查來源重複使用（警告）
    if (mappedSources.has(mapping.sourceField)) {
      warnings.push({
        field: mapping.sourceField,
        code: 'DUPLICATE_SOURCE',
        message: `來源欄位 ${mapping.sourceField} 被多次使用`,
      });
    }
    mappedSources.add(mapping.sourceField);

    // 驗證自定義轉換
    if (mapping.transformation === 'custom' && !mapping.customTransformation) {
      errors.push({
        field: mapping.sourceField,
        code: 'MISSING_CUSTOM_TRANSFORMATION',
        message: `欄位 ${mapping.sourceField} 使用自定義轉換但未提供表達式`,
      });
    }
  }

  // 檢查必填欄位是否都有映射
  for (const requiredField of requiredTargetFields) {
    if (!mappedTargets.has(requiredField)) {
      warnings.push({
        field: requiredField,
        code: 'MISSING_REQUIRED_FIELD',
        message: `必填欄位 ${requiredField} 尚未映射`,
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
```

### API 實現範例

```typescript
// src/app/api/v1/field-mappings/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import {
  CreateFieldMappingConfigSchema,
  ListFieldMappingConfigsSchema,
} from '@/validations/field-mapping';
import { validateMappingConfig } from '@/services/field-mapping-validator.service';
import { createApiError, createApiResponse } from '@/lib/api-utils';

/**
 * @route GET /api/v1/field-mappings
 * @description 列出所有映射配置
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return createApiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const params = ListFieldMappingConfigsSchema.parse(
      Object.fromEntries(searchParams)
    );

    const where = {
      ...(params.companyId && { companyId: params.companyId }),
      ...(params.documentFormatId && { documentFormatId: params.documentFormatId }),
      ...(params.isActive !== undefined && { isActive: params.isActive }),
      ...(params.search && {
        OR: [
          { name: { contains: params.search, mode: 'insensitive' } },
          { description: { contains: params.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [configs, total] = await Promise.all([
      prisma.fieldMappingConfig.findMany({
        where,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        orderBy: { [params.sortBy]: params.sortOrder },
        include: {
          company: { select: { id: true, name: true } },
          documentFormat: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
        },
      }),
      prisma.fieldMappingConfig.count({ where }),
    ]);

    return createApiResponse({
      data: configs,
      meta: {
        pagination: {
          page: params.page,
          limit: params.limit,
          total,
          totalPages: Math.ceil(total / params.limit),
        },
      },
    });
  } catch (error) {
    console.error('GET /api/v1/field-mappings error:', error);
    return createApiError('Internal Server Error', 500);
  }
}

/**
 * @route POST /api/v1/field-mappings
 * @description 創建新映射配置
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return createApiError('Unauthorized', 401);
    }

    const body = await request.json();
    const data = CreateFieldMappingConfigSchema.parse(body);

    // 驗證映射配置
    const validation = validateMappingConfig(data.mappings);
    if (!validation.isValid) {
      return createApiError('Validation Error', 400, {
        errors: validation.errors,
        warnings: validation.warnings,
      });
    }

    // 檢查唯一性約束
    if (data.companyId || data.documentFormatId) {
      const existing = await prisma.fieldMappingConfig.findFirst({
        where: {
          companyId: data.companyId || null,
          documentFormatId: data.documentFormatId || null,
        },
      });

      if (existing) {
        return createApiError('Conflict', 409, {
          message: '該公司/格式組合已存在配置',
          existingId: existing.id,
        });
      }
    }

    const config = await prisma.fieldMappingConfig.create({
      data: {
        ...data,
        createdById: user.id,
      },
      include: {
        company: { select: { id: true, name: true } },
        documentFormat: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    return createApiResponse({ data: config }, 201);
  } catch (error) {
    console.error('POST /api/v1/field-mappings error:', error);
    return createApiError('Internal Server Error', 500);
  }
}
```

### React Query Hook

```typescript
// src/hooks/use-field-mapping-api.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type {
  FieldMappingConfig,
  CreateFieldMappingConfigInput,
  UpdateFieldMappingConfigInput,
  ListFieldMappingConfigsInput,
} from '@/types/field-mapping-config';

const QUERY_KEY = 'field-mappings';

export function useFieldMappingConfigs(params?: ListFieldMappingConfigsInput) {
  return useQuery({
    queryKey: [QUERY_KEY, params],
    queryFn: () => apiClient.get<FieldMappingConfig[]>('/field-mappings', { params }),
  });
}

export function useFieldMappingConfig(id: string) {
  return useQuery({
    queryKey: [QUERY_KEY, id],
    queryFn: () => apiClient.get<FieldMappingConfig>(`/field-mappings/${id}`),
    enabled: !!id,
  });
}

export function useResolveFieldMapping(companyId?: string, documentFormatId?: string) {
  return useQuery({
    queryKey: [QUERY_KEY, 'resolve', companyId, documentFormatId],
    queryFn: () =>
      apiClient.get<FieldMappingConfig>('/field-mappings/resolve', {
        params: { companyId, documentFormatId },
      }),
    enabled: !!(companyId || documentFormatId),
  });
}

export function useCreateFieldMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateFieldMappingConfigInput) =>
      apiClient.post<FieldMappingConfig>('/field-mappings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useUpdateFieldMapping(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateFieldMappingConfigInput) =>
      apiClient.patch<FieldMappingConfig>(`/field-mappings/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useDeleteFieldMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/field-mappings/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useDuplicateFieldMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post<FieldMappingConfig>(`/field-mappings/${id}/duplicate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useTestExtraction(id: string) {
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiClient.post(`/field-mappings/${id}/test`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
  });
}
```

### 技術考量

1. **效能優化**
   - 配置解析結果緩存（Redis，TTL 5 分鐘）
   - 索引優化（companyId, documentFormatId）
   - 分頁查詢避免大數據量

2. **安全性**
   - 權限控制（管理員角色）
   - 輸入驗證（Zod）
   - SQL 注入防護（Prisma）

3. **可擴展性**
   - 支援新增欄位類型
   - 支援新增轉換規則
   - API 版本控制

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 13-4 |
| Story Key | 13-4-mapping-config-api |
| Epic | Epic 13: 欄位映射配置介面 |
| Dependencies | - |
| Estimated Points | 5 |

---

*Story created: 2026-01-02*
*Status: backlog*
