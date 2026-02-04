# Tech Spec: Story 20.3 - Reference Number CRUD API

> **Version**: 1.0.0
> **Created**: 2026-02-04
> **Status**: Draft
> **Story Key**: STORY-20-3

---

## Overview

| 項目 | 內容 |
|------|------|
| **Story ID** | 20.3 |
| **Epic** | Epic 20 - Reference Number Master Setup |
| **Estimated Effort** | 6 Story Points |
| **Dependencies** | Story 20-1 |
| **Blocking** | Story 20-4, 20-5 |

---

## Objective

建立 Reference Number 的完整 CRUD API，支援分頁、篩選、排序功能。

---

## Acceptance Criteria Mapping

| AC ID | 驗收條件 | 實現方式 |
|-------|----------|----------|
| AC-20.3.1 | 列表查詢 API | GET /api/v1/reference-numbers |
| AC-20.3.2 | 單一查詢 API | GET /api/v1/reference-numbers/:id |
| AC-20.3.3 | 建立 API | POST /api/v1/reference-numbers |
| AC-20.3.4 | 更新 API | PATCH /api/v1/reference-numbers/:id |
| AC-20.3.5 | 刪除 API | DELETE /api/v1/reference-numbers/:id |
| AC-20.3.6 | Zod 驗證 | Validation Schema |

---

## Implementation Guide

### Phase 1: Zod 驗證 (1 point)

```typescript
// src/lib/validations/reference-number.schema.ts

import { z } from 'zod';

// 枚舉驗證
export const referenceNumberTypeSchema = z.enum([
  'SHIPMENT',
  'DELIVERY',
  'BOOKING',
  'CONTAINER',
  'HAWB',
  'MAWB',
  'BL',
  'CUSTOMS',
  'OTHER',
]);

export const referenceNumberStatusSchema = z.enum([
  'ACTIVE',
  'EXPIRED',
  'CANCELLED',
]);

// 建立驗證
export const createReferenceNumberSchema = z.object({
  code: z
    .string()
    .max(50)
    .regex(/^[A-Z0-9_-]+$/i, 'Code 只能包含英數字、底線和連字號')
    .optional(),
  number: z
    .string()
    .min(1, '號碼不能為空')
    .max(100, '號碼最多 100 字元'),
  type: referenceNumberTypeSchema,
  year: z
    .number()
    .int()
    .min(2000)
    .max(2100),
  regionId: z.string().cuid('無效的地區 ID'),
  description: z.string().max(500).optional(),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
}).refine(
  (data) => {
    if (data.validFrom && data.validUntil) {
      return new Date(data.validFrom) <= new Date(data.validUntil);
    }
    return true;
  },
  { message: '有效起始日不能大於結束日', path: ['validUntil'] }
);

// 更新驗證
export const updateReferenceNumberSchema = z.object({
  number: z.string().min(1).max(100).optional(),
  type: referenceNumberTypeSchema.optional(),
  status: referenceNumberStatusSchema.optional(),
  year: z.number().int().min(2000).max(2100).optional(),
  regionId: z.string().cuid().optional(),
  description: z.string().max(500).optional().nullable(),
  validFrom: z.string().datetime().optional().nullable(),
  validUntil: z.string().datetime().optional().nullable(),
  isActive: z.boolean().optional(),
});

// 查詢驗證
export const getReferenceNumbersQuerySchema = z.object({
  page: z.string().default('1').transform(Number).pipe(z.number().int().positive()),
  limit: z.string().default('20').transform(Number).pipe(z.number().int().min(1).max(100)),
  year: z.string().transform(Number).pipe(z.number().int()).optional(),
  regionId: z.string().cuid().optional(),
  type: referenceNumberTypeSchema.optional(),
  status: referenceNumberStatusSchema.optional(),
  isActive: z.string().transform(v => v === 'true').optional(),
  search: z.string().max(100).optional(),
  sortBy: z.enum(['number', 'year', 'createdAt', 'updatedAt', 'matchCount']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateReferenceNumberInput = z.infer<typeof createReferenceNumberSchema>;
export type UpdateReferenceNumberInput = z.infer<typeof updateReferenceNumberSchema>;
export type GetReferenceNumbersQuery = z.infer<typeof getReferenceNumbersQuerySchema>;
```

### Phase 2: 服務層 (2 points)

```typescript
// src/services/reference-number.service.ts

import { prisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';
import type { Prisma } from '@prisma/client';
import type {
  CreateReferenceNumberInput,
  UpdateReferenceNumberInput,
  GetReferenceNumbersQuery,
} from '@/lib/validations/reference-number.schema';

// Code 生成函數
async function generateCode(year: number, regionCode: string): Promise<string> {
  const random = nanoid(6).toUpperCase();
  const code = `REF-${year}-${regionCode}-${random}`;

  // 確保唯一性
  const existing = await prisma.referenceNumber.findUnique({ where: { code } });
  if (existing) {
    return generateCode(year, regionCode);
  }

  return code;
}

// 列表查詢
export async function getReferenceNumbers(query: GetReferenceNumbersQuery) {
  const {
    page,
    limit,
    year,
    regionId,
    type,
    status,
    isActive,
    search,
    sortBy,
    sortOrder,
  } = query;

  const where: Prisma.ReferenceNumberWhereInput = {};

  if (year) where.year = year;
  if (regionId) where.regionId = regionId;
  if (type) where.type = type;
  if (status) where.status = status;
  if (isActive !== undefined) where.isActive = isActive;
  if (search) {
    where.number = { contains: search, mode: 'insensitive' };
  }

  const [items, total] = await Promise.all([
    prisma.referenceNumber.findMany({
      where,
      include: {
        region: { select: { id: true, code: true, name: true } },
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.referenceNumber.count({ where }),
  ]);

  return {
    items: items.map(item => ({
      ...item,
      regionCode: item.region.code,
      regionName: item.region.name,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      validFrom: item.validFrom?.toISOString() ?? null,
      validUntil: item.validUntil?.toISOString() ?? null,
      lastMatchedAt: item.lastMatchedAt?.toISOString() ?? null,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// 單一查詢
export async function getReferenceNumberById(id: string) {
  const item = await prisma.referenceNumber.findUnique({
    where: { id },
    include: {
      region: { select: { id: true, code: true, name: true } },
    },
  });

  if (!item) return null;

  return {
    ...item,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    validFrom: item.validFrom?.toISOString() ?? null,
    validUntil: item.validUntil?.toISOString() ?? null,
    lastMatchedAt: item.lastMatchedAt?.toISOString() ?? null,
  };
}

// 建立
export async function createReferenceNumber(
  input: CreateReferenceNumberInput,
  createdById: string
) {
  // 取得 region code
  const region = await prisma.region.findUnique({
    where: { id: input.regionId },
    select: { code: true },
  });

  if (!region) {
    throw new Error('地區不存在');
  }

  // 生成 code
  const code = input.code || await generateCode(input.year, region.code);

  return prisma.referenceNumber.create({
    data: {
      code,
      number: input.number,
      type: input.type,
      year: input.year,
      regionId: input.regionId,
      description: input.description,
      validFrom: input.validFrom ? new Date(input.validFrom) : null,
      validUntil: input.validUntil ? new Date(input.validUntil) : null,
      createdById,
    },
    include: {
      region: { select: { id: true, code: true, name: true } },
    },
  });
}

// 更新
export async function updateReferenceNumber(
  id: string,
  input: UpdateReferenceNumberInput
) {
  return prisma.referenceNumber.update({
    where: { id },
    data: {
      ...(input.number && { number: input.number }),
      ...(input.type && { type: input.type }),
      ...(input.status && { status: input.status }),
      ...(input.year && { year: input.year }),
      ...(input.regionId && { regionId: input.regionId }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.validFrom !== undefined && {
        validFrom: input.validFrom ? new Date(input.validFrom) : null,
      }),
      ...(input.validUntil !== undefined && {
        validUntil: input.validUntil ? new Date(input.validUntil) : null,
      }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
    include: {
      region: { select: { id: true, code: true, name: true } },
    },
  });
}

// 刪除（軟刪除）
export async function deleteReferenceNumber(id: string) {
  await prisma.referenceNumber.update({
    where: { id },
    data: { isActive: false },
  });
}
```

### Phase 3: API 端點 (2 points)

```typescript
// src/app/api/v1/reference-numbers/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getReferenceNumbers, createReferenceNumber } from '@/services/reference-number.service';
import {
  createReferenceNumberSchema,
  getReferenceNumbersQuerySchema,
} from '@/lib/validations/reference-number.schema';
import { getServerSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = getReferenceNumbersQuerySchema.parse(Object.fromEntries(searchParams));

  const result = await getReferenceNumbers(query);

  return NextResponse.json({
    success: true,
    data: result.items,
    meta: {
      pagination: result.pagination,
    },
  });
}

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
  const validated = createReferenceNumberSchema.parse(body);

  const item = await createReferenceNumber(validated, session.user.id);

  return NextResponse.json({
    success: true,
    data: item,
  }, { status: 201 });
}
```

### Phase 4: Hooks (1 point)

```typescript
// src/hooks/use-reference-numbers.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { GetReferenceNumbersQuery } from '@/lib/validations/reference-number.schema';

const QUERY_KEY = 'reference-numbers';

export function useReferenceNumbers(params: Partial<GetReferenceNumbersQuery> = {}) {
  return useQuery({
    queryKey: [QUERY_KEY, params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.set(key, String(value));
        }
      });

      const res = await fetch(`/api/v1/reference-numbers?${searchParams}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });
}

export function useReferenceNumber(id: string) {
  return useQuery({
    queryKey: [QUERY_KEY, id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/reference-numbers/${id}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    enabled: !!id,
  });
}

export function useCreateReferenceNumber() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: unknown) => {
      const res = await fetch('/api/v1/reference-numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useUpdateReferenceNumber() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: unknown }) => {
      const res = await fetch(`/api/v1/reference-numbers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useDeleteReferenceNumber() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/reference-numbers/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}
```

---

## File Structure

```
src/
├── lib/validations/
│   └── reference-number.schema.ts    # 新增
├── services/
│   └── reference-number.service.ts   # 新增
├── hooks/
│   └── use-reference-numbers.ts      # 新增
└── app/api/v1/reference-numbers/
    ├── route.ts                      # 新增
    └── [id]/route.ts                 # 新增
```

---

## Testing Checklist

- [ ] GET /api/v1/reference-numbers 分頁正確
- [ ] GET /api/v1/reference-numbers 篩選正確
- [ ] GET /api/v1/reference-numbers 排序正確
- [ ] GET /api/v1/reference-numbers/:id 返回詳情
- [ ] POST /api/v1/reference-numbers 建立成功
- [ ] POST 自動生成 code
- [ ] PATCH /api/v1/reference-numbers/:id 更新成功
- [ ] DELETE /api/v1/reference-numbers/:id 軟刪除
- [ ] 唯一約束驗證
- [ ] Zod 驗證錯誤格式
