# Tech Spec: Story 18.1 - Template Field Mapping 數據模型與服務

> **Version**: 1.0.0
> **Created**: 2026-01-22
> **Status**: Draft
> **Story Key**: STORY-18-1

---

## Overview

| 項目 | 內容 |
|------|------|
| **Story ID** | 18.1 |
| **Epic** | Epic 18 - 數據模版匹配與輸出 |
| **Estimated Effort** | 8 Story Points |
| **Dependencies** | Story 16-7（DataTemplate） |
| **Blocking** | Story 18-2, 18-3, 18-4 |

---

## Objective

建立第二層映射系統（TemplateFieldMapping），將標準化欄位映射到 DataTemplate 中定義的模版欄位。

### 雙層映射架構

```
第一層（FieldMappingConfig - 已實現）：
  原始術語 → 標準欄位名
  例：oceanFrt → sea_freight

第二層（TemplateFieldMapping - 本 Story）：
  標準欄位名 → 模版欄位名
  例：sea_freight → shipping_cost
```

---

## Acceptance Criteria Mapping

| AC ID | 驗收條件 | 實現方式 |
|-------|----------|----------|
| AC-18.1.1 | TemplateFieldMapping 模型 | Prisma Schema |
| AC-18.1.2 | 三層優先級支援 | resolveMapping 方法 |
| AC-18.1.3 | 映射規則結構 | JSON Schema 定義 |
| AC-18.1.4 | CRUD API | REST API 端點 |
| AC-18.1.5 | 配置解析服務 | TemplateFieldMappingService |
| AC-18.1.6 | 預設映射配置 | Seed Data |

---

## Implementation Guide

### Phase 1: Prisma Schema (2 points)

#### 1.1 新增 TemplateFieldMapping 模型

```prisma
// prisma/schema.prisma

/**
 * 模版欄位映射範圍
 * @since Epic 18 - Story 18.1
 */
enum TemplateFieldMappingScope {
  GLOBAL    // 全局預設
  COMPANY   // 公司級別
  FORMAT    // 文件格式級別
}

/**
 * 欄位轉換類型
 * @since Epic 18 - Story 18.1
 */
enum FieldTransformType {
  DIRECT    // 直接映射（1:1）
  FORMULA   // 公式計算
  LOOKUP    // 查表映射
}

/**
 * 模版欄位映射配置
 * 定義標準欄位到數據模版欄位的映射規則
 *
 * @description
 *   - 支援三層優先級：FORMAT > COMPANY > GLOBAL
 *   - 每個 DataTemplate 可有多個映射配置
 *   - 映射規則支援直接映射、公式計算、查表映射
 *
 * @since Epic 18 - Story 18.1
 */
model TemplateFieldMapping {
  id                String    @id @default(cuid())

  // ================================
  // 關聯到數據模版
  // ================================
  dataTemplateId    String    @map("data_template_id")
  dataTemplate      DataTemplate @relation(fields: [dataTemplateId], references: [id], onDelete: Cascade)

  // ================================
  // 範圍和優先級
  // ================================
  scope             TemplateFieldMappingScope @default(GLOBAL)

  // COMPANY 範圍時必填
  companyId         String?   @map("company_id")
  company           Company?  @relation(fields: [companyId], references: [id], onDelete: SetNull)

  // FORMAT 範圍時必填
  documentFormatId  String?   @map("document_format_id")
  documentFormat    DocumentFormat? @relation(fields: [documentFormatId], references: [id], onDelete: SetNull)

  // ================================
  // 配置內容
  // ================================
  name              String    // 配置名稱
  description       String?   // 說明

  /**
   * 映射規則陣列 (JSON)
   * @type TemplateFieldMappingRule[]
   * @see TemplateFieldMappingRule 介面定義
   */
  mappings          Json      @default("[]")

  // ================================
  // 狀態和排序
  // ================================
  priority          Int       @default(0)   // 同範圍內的優先級
  isActive          Boolean   @default(true) @map("is_active")

  // ================================
  // 時間戳
  // ================================
  createdAt         DateTime  @default(now()) @map("created_at")
  updatedAt         DateTime  @updatedAt @map("updated_at")
  createdBy         String?   @map("created_by")

  // ================================
  // 索引和約束
  // ================================
  // 確保同一模版+範圍+公司/格式的組合唯一
  @@unique([dataTemplateId, scope, companyId, documentFormatId], name: "unique_template_mapping")
  @@index([dataTemplateId])
  @@index([scope])
  @@index([companyId])
  @@index([documentFormatId])
  @@index([isActive])
  @@map("template_field_mappings")
}
```

#### 1.2 更新關聯模型

```prisma
// 更新 DataTemplate 模型
model DataTemplate {
  // ... 現有欄位

  // 新增：反向關聯
  templateFieldMappings TemplateFieldMapping[]
}

// 更新 Company 模型
model Company {
  // ... 現有欄位

  // 新增：反向關聯
  templateFieldMappings TemplateFieldMapping[]
}

// 更新 DocumentFormat 模型
model DocumentFormat {
  // ... 現有欄位

  // 新增：反向關聯
  templateFieldMappings TemplateFieldMapping[]
}
```

### Phase 2: 類型定義 (1.5 points)

#### 2.1 新增 template-field-mapping.ts

```typescript
// src/types/template-field-mapping.ts

/**
 * @fileoverview 模版欄位映射類型定義
 * @description
 *   定義第二層映射（標準欄位 → 模版欄位）的 TypeScript 類型
 *
 * @module src/types/template-field-mapping
 * @since Epic 18 - Story 18.1
 * @lastModified 2026-01-22
 */

// ============================================================================
// Enums
// ============================================================================

/**
 * 映射範圍
 */
export type TemplateFieldMappingScope = 'GLOBAL' | 'COMPANY' | 'FORMAT';

/**
 * 轉換類型
 */
export type FieldTransformType = 'DIRECT' | 'FORMULA' | 'LOOKUP';

// ============================================================================
// Mapping Rule Types
// ============================================================================

/**
 * FORMULA 轉換參數
 */
export interface FormulaTransformParams {
  /**
   * 公式表達式
   * 支援變數佔位符 {field_name}
   * 支援基本運算符 + - * / ( )
   * @example "{sea_freight} + {terminal_handling}"
   */
  formula: string;
}

/**
 * LOOKUP 轉換參數
 */
export interface LookupTransformParams {
  /**
   * 查表映射
   * key: 源值, value: 目標值
   */
  lookupTable: Record<string, unknown>;
  /**
   * 查表失敗時的預設值
   */
  defaultValue?: unknown;
}

/**
 * 轉換參數（聯合類型）
 */
export type TransformParams = FormulaTransformParams | LookupTransformParams | null;

/**
 * 單一映射規則
 */
export interface TemplateFieldMappingRule {
  /**
   * 規則 ID（用於編輯）
   */
  id: string;
  /**
   * 源欄位名（標準欄位）
   */
  sourceField: string;
  /**
   * 目標欄位名（模版欄位）
   */
  targetField: string;
  /**
   * 轉換類型
   */
  transformType: FieldTransformType;
  /**
   * 轉換參數
   */
  transformParams?: TransformParams;
  /**
   * 目標欄位是否必填（從 DataTemplate 繼承）
   */
  isRequired: boolean;
  /**
   * 處理順序
   */
  order: number;
  /**
   * 說明
   */
  description?: string;
}

// ============================================================================
// Model Types
// ============================================================================

/**
 * 模版欄位映射配置
 */
export interface TemplateFieldMapping {
  id: string;
  dataTemplateId: string;
  scope: TemplateFieldMappingScope;
  companyId?: string | null;
  documentFormatId?: string | null;
  name: string;
  description?: string | null;
  mappings: TemplateFieldMappingRule[];
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
}

/**
 * 映射配置摘要（用於列表）
 */
export interface TemplateFieldMappingSummary {
  id: string;
  dataTemplateId: string;
  dataTemplateName: string;
  scope: TemplateFieldMappingScope;
  companyId?: string | null;
  companyName?: string | null;
  documentFormatId?: string | null;
  documentFormatName?: string | null;
  name: string;
  ruleCount: number;
  priority: number;
  isActive: boolean;
  updatedAt: string;
}

// ============================================================================
// Resolved Types
// ============================================================================

/**
 * 解析後的映射配置
 * 合併多層配置後的結果
 */
export interface ResolvedMappingConfig {
  dataTemplateId: string;
  /**
   * 配置來源追蹤
   */
  resolvedFrom: Array<{
    id: string;
    scope: TemplateFieldMappingScope;
    name: string;
  }>;
  /**
   * 合併後的映射規則
   */
  mappings: TemplateFieldMappingRule[];
}

// ============================================================================
// API Types
// ============================================================================

/**
 * 創建映射配置輸入
 */
export interface CreateTemplateFieldMappingInput {
  dataTemplateId: string;
  scope: TemplateFieldMappingScope;
  companyId?: string;
  documentFormatId?: string;
  name: string;
  description?: string;
  mappings: Omit<TemplateFieldMappingRule, 'id'>[];
  priority?: number;
}

/**
 * 更新映射配置輸入
 */
export interface UpdateTemplateFieldMappingInput {
  name?: string;
  description?: string | null;
  mappings?: Omit<TemplateFieldMappingRule, 'id'>[];
  priority?: number;
  isActive?: boolean;
}

/**
 * 列表篩選
 */
export interface TemplateFieldMappingFilters {
  dataTemplateId?: string;
  scope?: TemplateFieldMappingScope;
  companyId?: string;
  documentFormatId?: string;
  isActive?: boolean;
  search?: string;
}

/**
 * 解析請求參數
 */
export interface ResolveMappingParams {
  dataTemplateId: string;
  companyId?: string;
  documentFormatId?: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * 範圍顯示名稱
 */
export const SCOPE_LABELS: Record<TemplateFieldMappingScope, string> = {
  GLOBAL: '全局',
  COMPANY: '公司',
  FORMAT: '格式',
};

/**
 * 範圍優先級（數字越大優先級越高）
 */
export const SCOPE_PRIORITY: Record<TemplateFieldMappingScope, number> = {
  GLOBAL: 1,
  COMPANY: 2,
  FORMAT: 3,
};

/**
 * 轉換類型顯示名稱
 */
export const TRANSFORM_TYPE_LABELS: Record<FieldTransformType, string> = {
  DIRECT: '直接映射',
  FORMULA: '公式計算',
  LOOKUP: '查表映射',
};
```

### Phase 3: Zod 驗證 (1 point)

```typescript
// src/validations/template-field-mapping.ts

/**
 * @fileoverview 模版欄位映射驗證 Schema
 * @module src/validations/template-field-mapping
 * @since Epic 18 - Story 18.1
 */

import { z } from 'zod';

/**
 * FORMULA 轉換參數驗證
 */
export const formulaTransformParamsSchema = z.object({
  formula: z.string()
    .min(1, '公式不能為空')
    .max(500, '公式過長')
    .regex(/^[a-zA-Z0-9_\s\+\-\*\/\.\(\)\{\}]+$/, '公式包含無效字符'),
});

/**
 * LOOKUP 轉換參數驗證
 */
export const lookupTransformParamsSchema = z.object({
  lookupTable: z.record(z.unknown()),
  defaultValue: z.unknown().optional(),
});

/**
 * 映射規則驗證
 */
export const templateFieldMappingRuleSchema = z.object({
  sourceField: z.string()
    .min(1, '源欄位不能為空')
    .max(100, '源欄位名稱過長'),
  targetField: z.string()
    .min(1, '目標欄位不能為空')
    .max(100, '目標欄位名稱過長'),
  transformType: z.enum(['DIRECT', 'FORMULA', 'LOOKUP']),
  transformParams: z.union([
    formulaTransformParamsSchema,
    lookupTransformParamsSchema,
    z.null(),
  ]).optional(),
  isRequired: z.boolean().default(false),
  order: z.number().int().nonnegative(),
  description: z.string().max(500).optional(),
}).refine(
  (data) => {
    // FORMULA 類型必須有 formula 參數
    if (data.transformType === 'FORMULA') {
      return data.transformParams && 'formula' in data.transformParams;
    }
    // LOOKUP 類型必須有 lookupTable 參數
    if (data.transformType === 'LOOKUP') {
      return data.transformParams && 'lookupTable' in data.transformParams;
    }
    return true;
  },
  { message: '轉換參數與類型不匹配' }
);

/**
 * 創建映射配置驗證
 */
export const createTemplateFieldMappingSchema = z.object({
  dataTemplateId: z.string().cuid('無效的模版 ID'),
  scope: z.enum(['GLOBAL', 'COMPANY', 'FORMAT']).default('GLOBAL'),
  companyId: z.string().cuid().optional().nullable(),
  documentFormatId: z.string().cuid().optional().nullable(),
  name: z.string()
    .min(1, '名稱不能為空')
    .max(200, '名稱過長'),
  description: z.string().max(1000).optional(),
  mappings: z.array(templateFieldMappingRuleSchema)
    .min(1, '至少需要一條映射規則')
    .max(100, '映射規則過多'),
  priority: z.number().int().min(0).max(1000).default(0),
}).refine(
  (data) => {
    // COMPANY 範圍需要 companyId
    if (data.scope === 'COMPANY' && !data.companyId) {
      return false;
    }
    // FORMAT 範圍需要 documentFormatId
    if (data.scope === 'FORMAT' && !data.documentFormatId) {
      return false;
    }
    return true;
  },
  { message: '範圍與關聯 ID 不匹配', path: ['scope'] }
);

/**
 * 更新映射配置驗證
 */
export const updateTemplateFieldMappingSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  mappings: z.array(templateFieldMappingRuleSchema).min(1).max(100).optional(),
  priority: z.number().int().min(0).max(1000).optional(),
  isActive: z.boolean().optional(),
});

// Types
export type CreateTemplateFieldMappingInput = z.infer<typeof createTemplateFieldMappingSchema>;
export type UpdateTemplateFieldMappingInput = z.infer<typeof updateTemplateFieldMappingSchema>;
export type TemplateFieldMappingRuleInput = z.infer<typeof templateFieldMappingRuleSchema>;
```

### Phase 4: 服務層 (2 points)

```typescript
// src/services/template-field-mapping.service.ts

/**
 * @fileoverview 模版欄位映射服務
 * @description
 *   提供第二層映射配置的 CRUD 操作和三層優先級解析
 *
 * @module src/services/template-field-mapping
 * @since Epic 18 - Story 18.1
 * @lastModified 2026-01-22
 *
 * @features
 *   - CRUD 操作
 *   - 三層優先級配置解析
 *   - 映射規則合併
 *   - 快取機制
 */

import { prisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';
import type {
  TemplateFieldMapping,
  TemplateFieldMappingSummary,
  TemplateFieldMappingFilters,
  TemplateFieldMappingRule,
  ResolvedMappingConfig,
  ResolveMappingParams,
  CreateTemplateFieldMappingInput,
  UpdateTemplateFieldMappingInput,
  TemplateFieldMappingScope,
  SCOPE_PRIORITY,
} from '@/types/template-field-mapping';

// 快取 TTL（毫秒）
const CACHE_TTL = 5 * 60 * 1000; // 5 分鐘

// 快取存儲
const resolveCache = new Map<string, { data: ResolvedMappingConfig; timestamp: number }>();

export class TemplateFieldMappingService {
  // ============================================================================
  // CRUD 操作
  // ============================================================================

  /**
   * 列出映射配置
   */
  async list(
    filters: TemplateFieldMappingFilters,
    page: number = 1,
    limit: number = 20
  ): Promise<{ mappings: TemplateFieldMappingSummary[]; total: number }> {
    const where: Record<string, unknown> = {};

    if (filters.dataTemplateId) {
      where.dataTemplateId = filters.dataTemplateId;
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
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [mappings, total] = await Promise.all([
      prisma.templateFieldMapping.findMany({
        where,
        include: {
          dataTemplate: { select: { name: true } },
          company: { select: { name: true } },
          documentFormat: { select: { name: true } },
        },
        orderBy: [
          { scope: 'asc' },
          { priority: 'desc' },
          { updatedAt: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.templateFieldMapping.count({ where }),
    ]);

    return {
      mappings: mappings.map((m) => ({
        id: m.id,
        dataTemplateId: m.dataTemplateId,
        dataTemplateName: m.dataTemplate.name,
        scope: m.scope as TemplateFieldMappingScope,
        companyId: m.companyId,
        companyName: m.company?.name,
        documentFormatId: m.documentFormatId,
        documentFormatName: m.documentFormat?.name,
        name: m.name,
        ruleCount: (m.mappings as TemplateFieldMappingRule[]).length,
        priority: m.priority,
        isActive: m.isActive,
        updatedAt: m.updatedAt.toISOString(),
      })),
      total,
    };
  }

  /**
   * 取得單一配置
   */
  async getById(id: string): Promise<TemplateFieldMapping | null> {
    const mapping = await prisma.templateFieldMapping.findUnique({
      where: { id },
      include: {
        dataTemplate: { select: { name: true } },
        company: { select: { name: true } },
        documentFormat: { select: { name: true } },
      },
    });

    if (!mapping) {
      return null;
    }

    return this.mapToDto(mapping);
  }

  /**
   * 創建映射配置
   */
  async create(input: CreateTemplateFieldMappingInput, createdBy?: string): Promise<TemplateFieldMapping> {
    // 為每條規則生成 ID
    const mappingsWithIds = input.mappings.map((rule, index) => ({
      ...rule,
      id: nanoid(),
      order: rule.order ?? index,
    }));

    const mapping = await prisma.templateFieldMapping.create({
      data: {
        dataTemplateId: input.dataTemplateId,
        scope: input.scope,
        companyId: input.companyId || null,
        documentFormatId: input.documentFormatId || null,
        name: input.name,
        description: input.description,
        mappings: mappingsWithIds,
        priority: input.priority ?? 0,
        createdBy,
      },
      include: {
        dataTemplate: { select: { name: true } },
        company: { select: { name: true } },
        documentFormat: { select: { name: true } },
      },
    });

    // 清除相關快取
    this.invalidateCache(input.dataTemplateId);

    return this.mapToDto(mapping);
  }

  /**
   * 更新映射配置
   */
  async update(id: string, input: UpdateTemplateFieldMappingInput): Promise<TemplateFieldMapping> {
    const existing = await prisma.templateFieldMapping.findUnique({
      where: { id },
      select: { dataTemplateId: true },
    });

    if (!existing) {
      throw new Error('映射配置不存在');
    }

    // 如果更新 mappings，為新規則生成 ID
    let mappingsData: TemplateFieldMappingRule[] | undefined;
    if (input.mappings) {
      mappingsData = input.mappings.map((rule, index) => ({
        ...rule,
        id: nanoid(),
        order: rule.order ?? index,
      }));
    }

    const mapping = await prisma.templateFieldMapping.update({
      where: { id },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(mappingsData && { mappings: mappingsData }),
        ...(input.priority !== undefined && { priority: input.priority }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
      include: {
        dataTemplate: { select: { name: true } },
        company: { select: { name: true } },
        documentFormat: { select: { name: true } },
      },
    });

    // 清除相關快取
    this.invalidateCache(existing.dataTemplateId);

    return this.mapToDto(mapping);
  }

  /**
   * 刪除映射配置（軟刪除）
   */
  async delete(id: string): Promise<void> {
    const existing = await prisma.templateFieldMapping.findUnique({
      where: { id },
      select: { dataTemplateId: true },
    });

    if (!existing) {
      throw new Error('映射配置不存在');
    }

    await prisma.templateFieldMapping.update({
      where: { id },
      data: { isActive: false },
    });

    // 清除相關快取
    this.invalidateCache(existing.dataTemplateId);
  }

  // ============================================================================
  // 三層優先級解析
  // ============================================================================

  /**
   * 解析映射配置
   * 按 FORMAT → COMPANY → GLOBAL 優先級合併映射規則
   */
  async resolveMapping(params: ResolveMappingParams): Promise<ResolvedMappingConfig> {
    const { dataTemplateId, companyId, documentFormatId } = params;

    // 檢查快取
    const cacheKey = `${dataTemplateId}:${companyId || ''}:${documentFormatId || ''}`;
    const cached = resolveCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    // 查詢所有相關配置
    const configs = await prisma.templateFieldMapping.findMany({
      where: {
        dataTemplateId,
        isActive: true,
        OR: [
          { scope: 'GLOBAL' },
          ...(companyId ? [{ scope: 'COMPANY', companyId }] : []),
          ...(documentFormatId ? [{ scope: 'FORMAT', documentFormatId }] : []),
        ],
      },
      orderBy: [
        { scope: 'desc' }, // FORMAT > COMPANY > GLOBAL
        { priority: 'desc' },
      ],
    });

    // 按優先級排序（高 → 低）
    const sortedConfigs = configs.sort((a, b) => {
      const scopePriorityA = SCOPE_PRIORITY[a.scope as TemplateFieldMappingScope];
      const scopePriorityB = SCOPE_PRIORITY[b.scope as TemplateFieldMappingScope];
      if (scopePriorityA !== scopePriorityB) {
        return scopePriorityB - scopePriorityA;
      }
      return b.priority - a.priority;
    });

    // 合併映射規則（高優先級覆蓋低優先級）
    const mergedMappings = this.mergeMappings(sortedConfigs);

    const result: ResolvedMappingConfig = {
      dataTemplateId,
      resolvedFrom: sortedConfigs.map((c) => ({
        id: c.id,
        scope: c.scope as TemplateFieldMappingScope,
        name: c.name,
      })),
      mappings: mergedMappings,
    };

    // 存入快取
    resolveCache.set(cacheKey, { data: result, timestamp: Date.now() });

    return result;
  }

  /**
   * 合併映射規則
   * 同一 targetField 只保留最高優先級的規則
   */
  private mergeMappings(configs: Array<{ mappings: unknown }>): TemplateFieldMappingRule[] {
    const targetFieldMap = new Map<string, TemplateFieldMappingRule>();

    // 從低優先級到高優先級遍歷，高優先級覆蓋低優先級
    for (const config of [...configs].reverse()) {
      const rules = config.mappings as TemplateFieldMappingRule[];
      for (const rule of rules) {
        targetFieldMap.set(rule.targetField, rule);
      }
    }

    // 按 order 排序返回
    return Array.from(targetFieldMap.values()).sort((a, b) => a.order - b.order);
  }

  // ============================================================================
  // 快取管理
  // ============================================================================

  /**
   * 清除指定模版的快取
   */
  private invalidateCache(dataTemplateId: string): void {
    for (const key of resolveCache.keys()) {
      if (key.startsWith(dataTemplateId)) {
        resolveCache.delete(key);
      }
    }
  }

  /**
   * 清除所有快取
   */
  clearAllCache(): void {
    resolveCache.clear();
  }

  // ============================================================================
  // 輔助方法
  // ============================================================================

  private mapToDto(mapping: any): TemplateFieldMapping {
    return {
      id: mapping.id,
      dataTemplateId: mapping.dataTemplateId,
      scope: mapping.scope as TemplateFieldMappingScope,
      companyId: mapping.companyId,
      documentFormatId: mapping.documentFormatId,
      name: mapping.name,
      description: mapping.description,
      mappings: mapping.mappings as TemplateFieldMappingRule[],
      priority: mapping.priority,
      isActive: mapping.isActive,
      createdAt: mapping.createdAt.toISOString(),
      updatedAt: mapping.updatedAt.toISOString(),
      createdBy: mapping.createdBy,
    };
  }
}

export const templateFieldMappingService = new TemplateFieldMappingService();
```

### Phase 5: API 端點 (1.5 points)

詳細的 API 實現請參考 Story 文件中的 API 設計部分。

主要端點：
- `GET /api/v1/template-field-mappings` - 列表
- `POST /api/v1/template-field-mappings` - 創建
- `GET /api/v1/template-field-mappings/:id` - 詳情
- `PATCH /api/v1/template-field-mappings/:id` - 更新
- `DELETE /api/v1/template-field-mappings/:id` - 刪除
- `POST /api/v1/template-field-mappings/resolve` - 解析配置

---

## File Structure

```
prisma/
├── schema.prisma                              # 更新
└── seed/
    └── template-field-mappings.ts             # 新增

src/
├── types/
│   └── template-field-mapping.ts              # 新增
├── validations/
│   └── template-field-mapping.ts              # 新增
├── services/
│   └── template-field-mapping.service.ts      # 新增
└── app/api/v1/template-field-mappings/
    ├── route.ts                               # 新增
    ├── [id]/route.ts                          # 新增
    └── resolve/route.ts                       # 新增
```

---

## Testing Checklist

### 資料庫測試
- [ ] Prisma 遷移成功
- [ ] TemplateFieldMapping CRUD 正常
- [ ] 唯一約束正確執行

### 服務層測試
- [ ] list 篩選功能正常
- [ ] create 驗證正常
- [ ] update 正確更新
- [ ] delete 軟刪除正常
- [ ] resolveMapping 三層優先級正確

### API 測試
- [ ] 所有端點正確響應
- [ ] 驗證錯誤返回正確格式
- [ ] 權限控制正常

---

## Migration Notes

```bash
# 1. 創建遷移
npx prisma migrate dev --name add_template_field_mapping

# 2. 生成 Prisma Client
npx prisma generate

# 3. 執行 Seed（可選）
npx prisma db seed
```
