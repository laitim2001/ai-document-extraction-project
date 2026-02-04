# Tech Spec: Story 21.5 - Import/Export API

> **Version**: 1.0.0
> **Created**: 2026-02-04
> **Status**: Draft
> **Story Key**: STORY-21-5

---

## Overview

| 項目 | 內容 |
|------|------|
| **Story ID** | 21.5 |
| **Epic** | Epic 21 - Exchange Rate Management |
| **Estimated Effort** | 2 Story Points |
| **Dependencies** | Story 21-3 |
| **Blocking** | Story 21-8 |

---

## Objective

建立匯率的批次導入和導出 API，支援 JSON 格式。

---

## Acceptance Criteria Mapping

| AC ID | 驗收條件 | 實現方式 |
|-------|----------|----------|
| AC-21.5.1 | Export API | GET /api/v1/exchange-rates/export |
| AC-21.5.2 | Import API | POST /api/v1/exchange-rates/import |
| AC-21.5.3 | Import 錯誤處理 | skipInvalid 選項 |
| AC-21.5.4 | Import 反向匯率 | createInverse 選項 |

---

## Implementation Guide

### Phase 1: Schema 擴展 (0.5 points)

```typescript
// src/lib/validations/exchange-rate.schema.ts (擴展)

export const importExchangeRatesSchema = z.object({
  exportVersion: z.string().optional(),
  items: z.array(z.object({
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
    isActive: z.boolean().default(true),
    createInverse: z.boolean().default(false),
  })).min(1, '至少需要一筆資料').max(500, '一次最多導入 500 筆'),
  options: z.object({
    overwriteExisting: z.boolean().default(false),
    skipInvalid: z.boolean().default(false),
  }).default({}),
});

export const exportExchangeRatesQuerySchema = z.object({
  year: z.string().transform(Number).pipe(z.number().int()).optional(),
  isActive: z.string().transform(v => v === 'true').optional(),
});
```

### Phase 2: 服務層擴展 (0.5 points)

```typescript
// src/services/exchange-rate.service.ts (擴展)

// ============================================================================
// Import
// ============================================================================

export async function importExchangeRates(
  input: z.infer<typeof importExchangeRatesSchema>,
  createdById: string
) {
  const { items, options } = input;
  const { overwriteExisting, skipInvalid } = options;

  const result = {
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: [] as Array<{ index: number; error: string }>,
  };

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    try {
      // 驗證貨幣代碼不同
      if (item.fromCurrency === item.toCurrency) {
        throw new Error('來源和目標貨幣不能相同');
      }

      // 檢查是否已存在
      const existing = await prisma.exchangeRate.findUnique({
        where: {
          fromCurrency_toCurrency_effectiveYear: {
            fromCurrency: item.fromCurrency,
            toCurrency: item.toCurrency,
            effectiveYear: item.effectiveYear,
          },
        },
      });

      if (existing) {
        if (overwriteExisting) {
          await prisma.exchangeRate.update({
            where: { id: existing.id },
            data: {
              rate: item.rate,
              effectiveFrom: item.effectiveFrom ? new Date(item.effectiveFrom) : null,
              effectiveTo: item.effectiveTo ? new Date(item.effectiveTo) : null,
              description: item.description,
              isActive: item.isActive,
            },
          });
          result.updated++;
        } else {
          result.skipped++;
        }
      } else {
        // 建立新記錄
        if (item.createInverse) {
          await prisma.$transaction(async (tx) => {
            const original = await tx.exchangeRate.create({
              data: {
                fromCurrency: item.fromCurrency,
                toCurrency: item.toCurrency,
                rate: item.rate,
                effectiveYear: item.effectiveYear,
                effectiveFrom: item.effectiveFrom ? new Date(item.effectiveFrom) : null,
                effectiveTo: item.effectiveTo ? new Date(item.effectiveTo) : null,
                description: item.description,
                isActive: item.isActive,
                source: 'IMPORTED',
                createdById,
              },
            });

            const inverseRate = 1 / Number(item.rate);
            await tx.exchangeRate.create({
              data: {
                fromCurrency: item.toCurrency,
                toCurrency: item.fromCurrency,
                rate: inverseRate,
                effectiveYear: item.effectiveYear,
                effectiveFrom: item.effectiveFrom ? new Date(item.effectiveFrom) : null,
                effectiveTo: item.effectiveTo ? new Date(item.effectiveTo) : null,
                description: item.description ? `[反向] ${item.description}` : '[自動建立的反向匯率]',
                isActive: item.isActive,
                source: 'AUTO_INVERSE',
                inverseOfId: original.id,
                createdById,
              },
            });
          });
        } else {
          await prisma.exchangeRate.create({
            data: {
              fromCurrency: item.fromCurrency,
              toCurrency: item.toCurrency,
              rate: item.rate,
              effectiveYear: item.effectiveYear,
              effectiveFrom: item.effectiveFrom ? new Date(item.effectiveFrom) : null,
              effectiveTo: item.effectiveTo ? new Date(item.effectiveTo) : null,
              description: item.description,
              isActive: item.isActive,
              source: 'IMPORTED',
              createdById,
            },
          });
        }
        result.imported++;
      }
    } catch (error) {
      if (skipInvalid) {
        result.errors.push({
          index: i,
          error: error instanceof Error ? error.message : '未知錯誤',
        });
        result.skipped++;
      } else {
        throw error;
      }
    }
  }

  return result;
}

// ============================================================================
// Export
// ============================================================================

export async function exportExchangeRates(
  query: z.infer<typeof exportExchangeRatesQuerySchema>
) {
  const where: Prisma.ExchangeRateWhereInput = {};

  if (query.year) where.effectiveYear = query.year;
  if (query.isActive !== undefined) where.isActive = query.isActive;

  const items = await prisma.exchangeRate.findMany({
    where,
    orderBy: [
      { effectiveYear: 'desc' },
      { fromCurrency: 'asc' },
      { toCurrency: 'asc' },
    ],
  });

  return {
    exportVersion: '1.0',
    exportedAt: new Date().toISOString(),
    totalCount: items.length,
    items: items.map(item => ({
      fromCurrency: item.fromCurrency,
      toCurrency: item.toCurrency,
      rate: item.rate.toString(),
      effectiveYear: item.effectiveYear,
      effectiveFrom: item.effectiveFrom?.toISOString(),
      effectiveTo: item.effectiveTo?.toISOString(),
      source: item.source,
      isActive: item.isActive,
      description: item.description,
    })),
  };
}
```

### Phase 3: API 端點 (1 point)

```typescript
// src/app/api/v1/exchange-rates/export/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { exportExchangeRates } from '@/services/exchange-rate.service';
import { exportExchangeRatesQuerySchema } from '@/lib/validations/exchange-rate.schema';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = exportExchangeRatesQuerySchema.parse(Object.fromEntries(searchParams));

  const result = await exportExchangeRates(query);

  return NextResponse.json(result);
}
```

```typescript
// src/app/api/v1/exchange-rates/import/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { importExchangeRates } from '@/services/exchange-rate.service';
import { importExchangeRatesSchema } from '@/lib/validations/exchange-rate.schema';
import { getServerSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({
      type: 'https://api.example.com/errors/unauthorized',
      title: 'Unauthorized',
      status: 401,
      detail: '請先登入',
    }, { status: 401 });
  }

  const body = await request.json();
  const validated = importExchangeRatesSchema.parse(body);

  const result = await importExchangeRates(validated, session.user.id);

  return NextResponse.json({
    success: true,
    data: result,
  });
}
```

---

## File Structure

```
src/app/api/v1/exchange-rates/
├── export/route.ts                  # 新增
└── import/route.ts                  # 新增
```

---

## Testing Checklist

- [ ] Export API 返回正確 JSON 格式
- [ ] Export API 篩選正確（year, isActive）
- [ ] Import API 正確導入新記錄
- [ ] Import API overwriteExisting 選項正常
- [ ] Import API skipInvalid 選項正常
- [ ] Import API createInverse 選項正常
- [ ] Import 錯誤報告格式正確
- [ ] 唯一約束衝突正確處理
