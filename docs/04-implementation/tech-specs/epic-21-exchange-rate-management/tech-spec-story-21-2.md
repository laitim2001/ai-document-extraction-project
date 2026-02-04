# Tech Spec: Story 21.2 - 核心服務層

> **Version**: 1.0.0
> **Created**: 2026-02-04
> **Status**: Draft
> **Story Key**: STORY-21-2

---

## Overview

| 項目 | 內容 |
|------|------|
| **Story ID** | 21.2 |
| **Epic** | Epic 21 - Exchange Rate Management |
| **Estimated Effort** | 4 Story Points |
| **Dependencies** | Story 21-1 |
| **Blocking** | Story 21-3, 21-4 |

---

## Objective

建立 ExchangeRate 的核心服務層，包含 CRUD 操作、轉換邏輯（含 Fallback）、自動反向匯率建立。

---

## Acceptance Criteria Mapping

| AC ID | 驗收條件 | 實現方式 |
|-------|----------|----------|
| AC-21.2.1 | CRUD 操作 | Service 方法 |
| AC-21.2.2 | 自動反向匯率 | createWithInverse |
| AC-21.2.3 | 轉換計算 | convert 方法 + Fallback |
| AC-21.2.4 | 批次查詢 | batchGetRates |
| AC-21.2.5 | 刪除關聯處理 | deleteWithInverse |
| AC-21.2.6 | Zod 驗證 | Schema 定義 |

---

## Implementation Guide

### Phase 1: Zod 驗證 Schema (1 point)

```typescript
// src/lib/validations/exchange-rate.schema.ts

import { z } from 'zod';

const currencyCodeSchema = z.string().length(3).toUpperCase();

// 建立 Schema
export const createExchangeRateSchema = z.object({
  fromCurrency: currencyCodeSchema,
  toCurrency: currencyCodeSchema,
  rate: z.union([
    z.number().positive(),
    z.string().transform(Number).pipe(z.number().positive()),
  ]),
  effectiveYear: z.number().int().min(2000).max(2100),
  effectiveFrom: z.string().datetime().optional(),
  effectiveTo: z.string().datetime().optional(),
  description: z.string().max(500).optional(),
  createInverse: z.boolean().default(false),
}).refine(
  (data) => data.fromCurrency !== data.toCurrency,
  { message: '來源和目標貨幣不能相同', path: ['toCurrency'] }
);

// 更新 Schema
export const updateExchangeRateSchema = z.object({
  rate: z.union([
    z.number().positive(),
    z.string().transform(Number).pipe(z.number().positive()),
  ]).optional(),
  effectiveFrom: z.string().datetime().optional().nullable(),
  effectiveTo: z.string().datetime().optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
});

// 查詢 Schema
export const getExchangeRatesQuerySchema = z.object({
  page: z.string().default('1').transform(Number).pipe(z.number().int().positive()),
  limit: z.string().default('20').transform(Number).pipe(z.number().int().min(1).max(100)),
  year: z.string().transform(Number).pipe(z.number().int()).optional(),
  fromCurrency: currencyCodeSchema.optional(),
  toCurrency: currencyCodeSchema.optional(),
  isActive: z.string().transform(v => v === 'true').optional(),
  source: z.enum(['MANUAL', 'IMPORTED', 'AUTO_INVERSE']).optional(),
  sortBy: z.enum(['fromCurrency', 'toCurrency', 'rate', 'effectiveYear', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// 轉換 Schema
export const convertSchema = z.object({
  fromCurrency: currencyCodeSchema,
  toCurrency: currencyCodeSchema,
  amount: z.number().positive(),
  year: z.number().int().optional(),
}).refine(
  (data) => data.fromCurrency !== data.toCurrency,
  { message: '來源和目標貨幣不能相同', path: ['toCurrency'] }
);

// 批次查詢 Schema
export const batchGetRatesSchema = z.object({
  pairs: z.array(z.object({
    fromCurrency: currencyCodeSchema,
    toCurrency: currencyCodeSchema,
  })).min(1).max(50),
  year: z.number().int().optional(),
});

export type CreateExchangeRateInput = z.infer<typeof createExchangeRateSchema>;
export type UpdateExchangeRateInput = z.infer<typeof updateExchangeRateSchema>;
export type GetExchangeRatesQuery = z.infer<typeof getExchangeRatesQuerySchema>;
export type ConvertInput = z.infer<typeof convertSchema>;
export type BatchGetRatesInput = z.infer<typeof batchGetRatesSchema>;
```

### Phase 2: 服務層 - CRUD (1.5 points)

```typescript
// src/services/exchange-rate.service.ts

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import type {
  CreateExchangeRateInput,
  UpdateExchangeRateInput,
  GetExchangeRatesQuery,
} from '@/lib/validations/exchange-rate.schema';
import type { ConvertResult, BatchRateResult } from '@/types/exchange-rate';

// ============================================================================
// List
// ============================================================================

export async function getExchangeRates(query: GetExchangeRatesQuery) {
  const {
    page,
    limit,
    year,
    fromCurrency,
    toCurrency,
    isActive,
    source,
    sortBy,
    sortOrder,
  } = query;

  const where: Prisma.ExchangeRateWhereInput = {};

  if (year) where.effectiveYear = year;
  if (fromCurrency) where.fromCurrency = fromCurrency;
  if (toCurrency) where.toCurrency = toCurrency;
  if (isActive !== undefined) where.isActive = isActive;
  if (source) where.source = source;

  const [items, total] = await Promise.all([
    prisma.exchangeRate.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.exchangeRate.count({ where }),
  ]);

  // 檢查每筆記錄是否有反向
  const itemsWithInverse = await Promise.all(
    items.map(async (item) => {
      const hasInverse = await prisma.exchangeRate.count({
        where: { inverseOfId: item.id },
      }) > 0;

      return {
        ...item,
        rate: item.rate.toNumber(),
        hasInverse,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        effectiveFrom: item.effectiveFrom?.toISOString() ?? null,
        effectiveTo: item.effectiveTo?.toISOString() ?? null,
      };
    })
  );

  return {
    items: itemsWithInverse,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ============================================================================
// Get By ID
// ============================================================================

export async function getExchangeRateById(id: string) {
  const item = await prisma.exchangeRate.findUnique({
    where: { id },
    include: {
      inverseRates: {
        select: { id: true, rate: true },
      },
    },
  });

  if (!item) return null;

  return {
    ...item,
    rate: item.rate.toNumber(),
    inverseRate: item.inverseRates[0] ? {
      id: item.inverseRates[0].id,
      rate: item.inverseRates[0].rate.toNumber(),
    } : undefined,
    hasInverse: item.inverseRates.length > 0,
  };
}

// ============================================================================
// Create (with optional inverse)
// ============================================================================

export async function createExchangeRate(
  input: CreateExchangeRateInput,
  createdById: string
) {
  const { createInverse, ...data } = input;

  if (createInverse) {
    // 使用 transaction 同時建立兩筆
    return prisma.$transaction(async (tx) => {
      // 建立原始記錄
      const original = await tx.exchangeRate.create({
        data: {
          fromCurrency: data.fromCurrency,
          toCurrency: data.toCurrency,
          rate: data.rate,
          effectiveYear: data.effectiveYear,
          effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : null,
          effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
          description: data.description,
          source: 'MANUAL',
          createdById,
        },
      });

      // 建立反向記錄
      const inverseRate = 1 / Number(data.rate);
      await tx.exchangeRate.create({
        data: {
          fromCurrency: data.toCurrency,
          toCurrency: data.fromCurrency,
          rate: inverseRate,
          effectiveYear: data.effectiveYear,
          effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : null,
          effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
          description: data.description ? `[反向] ${data.description}` : '[自動建立的反向匯率]',
          source: 'AUTO_INVERSE',
          inverseOfId: original.id,
          createdById,
        },
      });

      return original;
    });
  }

  return prisma.exchangeRate.create({
    data: {
      fromCurrency: data.fromCurrency,
      toCurrency: data.toCurrency,
      rate: data.rate,
      effectiveYear: data.effectiveYear,
      effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : null,
      effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
      description: data.description,
      source: 'MANUAL',
      createdById,
    },
  });
}

// ============================================================================
// Update
// ============================================================================

export async function updateExchangeRate(
  id: string,
  input: UpdateExchangeRateInput
) {
  return prisma.exchangeRate.update({
    where: { id },
    data: {
      ...(input.rate !== undefined && { rate: input.rate }),
      ...(input.effectiveFrom !== undefined && {
        effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : null,
      }),
      ...(input.effectiveTo !== undefined && {
        effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
      }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
  });
}

// ============================================================================
// Delete (with inverse)
// ============================================================================

export async function deleteExchangeRate(id: string) {
  return prisma.$transaction(async (tx) => {
    // 先刪除以此為來源的反向記錄
    await tx.exchangeRate.deleteMany({
      where: { inverseOfId: id },
    });

    // 刪除本身
    await tx.exchangeRate.delete({
      where: { id },
    });
  });
}

// ============================================================================
// Toggle
// ============================================================================

export async function toggleExchangeRate(id: string) {
  const item = await prisma.exchangeRate.findUnique({
    where: { id },
    select: { isActive: true },
  });

  if (!item) throw new Error('匯率記錄不存在');

  return prisma.exchangeRate.update({
    where: { id },
    data: { isActive: !item.isActive },
  });
}
```

### Phase 3: 服務層 - 轉換邏輯 (1.5 points)

```typescript
// src/services/exchange-rate.service.ts (續)

// ============================================================================
// Convert
// ============================================================================

export async function convert(
  fromCurrency: string,
  toCurrency: string,
  amount: number,
  year?: number
): Promise<ConvertResult> {
  const effectiveYear = year || new Date().getFullYear();

  // 1. 直接查詢
  const direct = await findDirectRate(fromCurrency, toCurrency, effectiveYear);
  if (direct) {
    return {
      fromCurrency,
      toCurrency,
      amount,
      convertedAmount: amount * direct.rate,
      rate: direct.rate,
      path: 'direct',
      rateId: direct.id,
      effectiveYear,
    };
  }

  // 2. 反向計算
  const inverse = await findDirectRate(toCurrency, fromCurrency, effectiveYear);
  if (inverse) {
    const rate = 1 / inverse.rate;
    return {
      fromCurrency,
      toCurrency,
      amount,
      convertedAmount: amount * rate,
      rate,
      path: 'inverse',
      rateId: inverse.id,
      effectiveYear,
    };
  }

  // 3. 交叉匯率（通過 USD）
  if (fromCurrency !== 'USD' && toCurrency !== 'USD') {
    const toUsd = await findRate(fromCurrency, 'USD', effectiveYear);
    const fromUsd = await findRate('USD', toCurrency, effectiveYear);

    if (toUsd && fromUsd) {
      const rate = toUsd.rate * fromUsd.rate;
      return {
        fromCurrency,
        toCurrency,
        amount,
        convertedAmount: amount * rate,
        rate,
        path: `cross:${fromCurrency}→USD→${toCurrency}`,
        rateIds: [toUsd.id, fromUsd.id],
        effectiveYear,
      };
    }
  }

  // 4. 找不到
  throw new Error(`找不到 ${fromCurrency} → ${toCurrency} 的匯率記錄（年份：${effectiveYear}）`);
}

// ============================================================================
// Batch Get Rates
// ============================================================================

export async function batchGetRates(
  pairs: Array<{ fromCurrency: string; toCurrency: string }>,
  year?: number
): Promise<BatchRateResult[]> {
  const effectiveYear = year || new Date().getFullYear();

  return Promise.all(
    pairs.map(async ({ fromCurrency, toCurrency }) => {
      try {
        const result = await convert(fromCurrency, toCurrency, 1, effectiveYear);
        return {
          fromCurrency,
          toCurrency,
          rate: result.rate,
          path: result.path,
          found: true,
          rateId: result.rateId,
        };
      } catch {
        return {
          fromCurrency,
          toCurrency,
          rate: 0,
          path: 'not_found',
          found: false,
        };
      }
    })
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

async function findDirectRate(
  from: string,
  to: string,
  year: number
): Promise<{ id: string; rate: number } | null> {
  const item = await prisma.exchangeRate.findFirst({
    where: {
      fromCurrency: from,
      toCurrency: to,
      effectiveYear: year,
      isActive: true,
    },
    select: { id: true, rate: true },
  });

  if (!item) return null;

  return {
    id: item.id,
    rate: item.rate.toNumber(),
  };
}

async function findRate(
  from: string,
  to: string,
  year: number
): Promise<{ id: string; rate: number } | null> {
  // 先找直接
  const direct = await findDirectRate(from, to, year);
  if (direct) return direct;

  // 再找反向
  const inverse = await findDirectRate(to, from, year);
  if (inverse) {
    return {
      id: inverse.id,
      rate: 1 / inverse.rate,
    };
  }

  return null;
}
```

---

## File Structure

```
src/
├── lib/validations/
│   └── exchange-rate.schema.ts      # 新增
└── services/
    └── exchange-rate.service.ts     # 新增
```

---

## Testing Checklist

- [ ] list 正確支援篩選和分頁
- [ ] getById 返回正確的反向記錄資訊
- [ ] create 正確建立單筆記錄
- [ ] create 含 createInverse 時正確建立兩筆
- [ ] update 只更新提供的欄位
- [ ] delete 同時刪除反向記錄
- [ ] toggle 正確切換狀態
- [ ] convert 直接匹配正確
- [ ] convert 反向計算正確
- [ ] convert 交叉匯率正確
- [ ] convert 找不到時正確拋出錯誤
- [ ] batchGetRates 批次查詢正確
