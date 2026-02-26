# Tech Spec: Story 20.4 - 導入/導出與驗證 API

> **Version**: 1.0.0
> **Created**: 2026-02-04
> **Status**: Draft
> **Story Key**: STORY-20-4

---

## Overview

| 項目 | 內容 |
|------|------|
| **Story ID** | 20.4 |
| **Epic** | Epic 20 - Reference Number Master Setup |
| **Estimated Effort** | 6 Story Points |
| **Dependencies** | Story 20-3 |
| **Blocking** | Story 20-6 |

---

## Objective

建立 Reference Number 的批次導入/導出 API，以及驗證 API 供文件處理時匹配檢查。

---

## Acceptance Criteria Mapping

| AC ID | 驗收條件 | 實現方式 |
|-------|----------|----------|
| AC-20.4.1 | Import API | POST /api/v1/reference-numbers/import |
| AC-20.4.2 | Export API | GET /api/v1/reference-numbers/export |
| AC-20.4.3 | Validate API | POST /api/v1/reference-numbers/validate |
| AC-20.4.4 | Import 錯誤處理 | 詳細錯誤報告 |
| AC-20.4.5 | 驗證結果結構 | ValidateResult 類型 |

---

## Implementation Guide

### Phase 1: 類型與 Schema 擴展 (1 point)

```typescript
// src/lib/validations/reference-number.schema.ts (擴展)

// Import Schema
export const importReferenceNumbersSchema = z.object({
  exportVersion: z.string().optional(),
  items: z.array(z.object({
    code: z.string().max(50).optional(),
    number: z.string().min(1).max(100),
    type: referenceNumberTypeSchema,
    year: z.number().int().min(2000).max(2100),
    regionCode: z.string().min(2).max(20),
    description: z.string().max(500).optional(),
    validFrom: z.string().datetime().optional(),
    validUntil: z.string().datetime().optional(),
    isActive: z.boolean().default(true),
  })).min(1, '至少需要一筆資料').max(1000, '一次最多導入 1000 筆'),
  options: z.object({
    overwriteExisting: z.boolean().default(false),
    skipInvalid: z.boolean().default(false),
  }).default({}),
});

// Export Query Schema
export const exportReferenceNumbersQuerySchema = z.object({
  year: z.string().transform(Number).pipe(z.number().int()).optional(),
  regionId: z.string().cuid().optional(),
  type: referenceNumberTypeSchema.optional(),
  status: referenceNumberStatusSchema.optional(),
  isActive: z.string().transform(v => v === 'true').optional(),
});

// Validate Schema
export const validateReferenceNumbersSchema = z.object({
  numbers: z.array(z.object({
    value: z.string().min(1),
    type: referenceNumberTypeSchema.optional(),
  })).min(1).max(100, '一次最多驗證 100 筆'),
  options: z.object({
    year: z.number().int().optional(),
    regionId: z.string().cuid().optional(),
  }).optional(),
});
```

### Phase 2: 服務層擴展 (2 points)

```typescript
// src/services/reference-number.service.ts (擴展)

// ============================================================================
// Import
// ============================================================================

export async function importReferenceNumbers(
  input: z.infer<typeof importReferenceNumbersSchema>,
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

  // 預先載入所有 region 代碼
  const regions = await prisma.region.findMany({
    select: { id: true, code: true },
  });
  const regionMap = new Map(regions.map(r => [r.code.toUpperCase(), r.id]));

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    try {
      // 查找 region
      const regionId = regionMap.get(item.regionCode.toUpperCase());
      if (!regionId) {
        throw new Error(`地區代碼 ${item.regionCode} 不存在`);
      }

      // 檢查是否已存在（by code 或 唯一約束）
      let existing = null;
      if (item.code) {
        existing = await prisma.referenceNumber.findUnique({
          where: { code: item.code },
        });
      }

      if (!existing) {
        existing = await prisma.referenceNumber.findFirst({
          where: {
            number: item.number,
            type: item.type,
            year: item.year,
            regionId,
          },
        });
      }

      if (existing) {
        if (overwriteExisting) {
          await prisma.referenceNumber.update({
            where: { id: existing.id },
            data: {
              number: item.number,
              type: item.type,
              year: item.year,
              regionId,
              description: item.description,
              validFrom: item.validFrom ? new Date(item.validFrom) : null,
              validUntil: item.validUntil ? new Date(item.validUntil) : null,
              isActive: item.isActive,
            },
          });
          result.updated++;
        } else {
          result.skipped++;
        }
      } else {
        // 生成 code
        const code = item.code || await generateCode(item.year, item.regionCode);

        await prisma.referenceNumber.create({
          data: {
            code,
            number: item.number,
            type: item.type,
            year: item.year,
            regionId,
            description: item.description,
            validFrom: item.validFrom ? new Date(item.validFrom) : null,
            validUntil: item.validUntil ? new Date(item.validUntil) : null,
            isActive: item.isActive,
            createdById,
          },
        });
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

export async function exportReferenceNumbers(
  query: z.infer<typeof exportReferenceNumbersQuerySchema>
) {
  const where: Prisma.ReferenceNumberWhereInput = {};

  if (query.year) where.year = query.year;
  if (query.regionId) where.regionId = query.regionId;
  if (query.type) where.type = query.type;
  if (query.status) where.status = query.status;
  if (query.isActive !== undefined) where.isActive = query.isActive;

  const items = await prisma.referenceNumber.findMany({
    where,
    include: {
      region: { select: { code: true } },
    },
    orderBy: [
      { year: 'desc' },
      { number: 'asc' },
    ],
  });

  return {
    exportVersion: '1.0',
    exportedAt: new Date().toISOString(),
    totalCount: items.length,
    items: items.map(item => ({
      code: item.code,
      number: item.number,
      type: item.type,
      status: item.status,
      year: item.year,
      regionCode: item.region.code,
      description: item.description,
      validFrom: item.validFrom?.toISOString(),
      validUntil: item.validUntil?.toISOString(),
      matchCount: item.matchCount,
      isActive: item.isActive,
    })),
  };
}

// ============================================================================
// Validate
// ============================================================================

export async function validateReferenceNumbers(
  input: z.infer<typeof validateReferenceNumbersSchema>
) {
  const { numbers, options } = input;

  const results = await Promise.all(
    numbers.map(async ({ value, type }) => {
      const where: Prisma.ReferenceNumberWhereInput = {
        number: { equals: value, mode: 'insensitive' },
        isActive: true,
        status: 'ACTIVE',
      };

      if (type) where.type = type;
      if (options?.year) where.year = options.year;
      if (options?.regionId) where.regionId = options.regionId;

      const matches = await prisma.referenceNumber.findMany({
        where,
        include: {
          region: { select: { code: true } },
        },
        take: 5,
      });

      // 更新 matchCount
      if (matches.length > 0) {
        await prisma.referenceNumber.updateMany({
          where: { id: { in: matches.map(m => m.id) } },
          data: {
            matchCount: { increment: 1 },
            lastMatchedAt: new Date(),
          },
        });
      }

      return {
        value,
        found: matches.length > 0,
        matches: matches.map(m => ({
          id: m.id,
          number: m.number,
          type: m.type,
          year: m.year,
          regionCode: m.region.code,
          status: m.status,
        })),
      };
    })
  );

  const found = results.filter(r => r.found).length;

  return {
    results,
    summary: {
      total: numbers.length,
      found,
      notFound: numbers.length - found,
    },
  };
}
```

### Phase 3: API 端點 (2 points)

```typescript
// src/app/api/v1/reference-numbers/import/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { importReferenceNumbers } from '@/services/reference-number.service';
import { importReferenceNumbersSchema } from '@/lib/validations/reference-number.schema';
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
  const validated = importReferenceNumbersSchema.parse(body);

  const result = await importReferenceNumbers(validated, session.user.id);

  return NextResponse.json({
    success: true,
    data: result,
  });
}
```

```typescript
// src/app/api/v1/reference-numbers/export/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { exportReferenceNumbers } from '@/services/reference-number.service';
import { exportReferenceNumbersQuerySchema } from '@/lib/validations/reference-number.schema';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = exportReferenceNumbersQuerySchema.parse(Object.fromEntries(searchParams));

  const result = await exportReferenceNumbers(query);

  return NextResponse.json(result);
}
```

```typescript
// src/app/api/v1/reference-numbers/validate/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { validateReferenceNumbers } from '@/services/reference-number.service';
import { validateReferenceNumbersSchema } from '@/lib/validations/reference-number.schema';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const validated = validateReferenceNumbersSchema.parse(body);

  const result = await validateReferenceNumbers(validated);

  return NextResponse.json({
    success: true,
    data: result,
  });
}
```

### Phase 4: Hooks 擴展 (1 point)

```typescript
// src/hooks/use-reference-numbers.ts (擴展)

export function useImportReferenceNumbers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: unknown) => {
      const res = await fetch('/api/v1/reference-numbers/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to import');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useExportReferenceNumbers() {
  return useMutation({
    mutationFn: async (params: Record<string, unknown> = {}) => {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.set(key, String(value));
        }
      });

      const res = await fetch(`/api/v1/reference-numbers/export?${searchParams}`);
      if (!res.ok) throw new Error('Failed to export');
      return res.json();
    },
  });
}

export function useValidateReferenceNumbers() {
  return useMutation({
    mutationFn: async (data: unknown) => {
      const res = await fetch('/api/v1/reference-numbers/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to validate');
      return res.json();
    },
  });
}
```

---

## File Structure

```
src/app/api/v1/reference-numbers/
├── import/route.ts                   # 新增
├── export/route.ts                   # 新增
└── validate/route.ts                 # 新增
```

---

## Testing Checklist

- [ ] Import API 正確導入新記錄
- [ ] Import API overwriteExisting 選項正常
- [ ] Import API skipInvalid 選項正常
- [ ] Import API 使用 regionCode 關聯
- [ ] Export API 返回正確格式
- [ ] Export API 篩選正確
- [ ] Validate API 返回匹配結果
- [ ] Validate API 更新 matchCount
- [ ] 錯誤報告格式正確
