# Tech Spec: Story 21.3 - CRUD API 端點

> **Version**: 1.0.0
> **Created**: 2026-02-04
> **Status**: Draft
> **Story Key**: STORY-21-3

---

## Overview

| 項目 | 內容 |
|------|------|
| **Story ID** | 21.3 |
| **Epic** | Epic 21 - Exchange Rate Management |
| **Estimated Effort** | 3 Story Points |
| **Dependencies** | Story 21-2 |
| **Blocking** | Story 21-4, 21-5, 21-6 |

---

## Objective

建立 ExchangeRate 的完整 CRUD API 端點，支援分頁、篩選、排序、切換狀態功能。

---

## Acceptance Criteria Mapping

| AC ID | 驗收條件 | 實現方式 |
|-------|----------|----------|
| AC-21.3.1 | 列表查詢 API | GET /api/v1/exchange-rates |
| AC-21.3.2 | 單一查詢 API | GET /api/v1/exchange-rates/:id |
| AC-21.3.3 | 建立 API | POST /api/v1/exchange-rates |
| AC-21.3.4 | 更新 API | PATCH /api/v1/exchange-rates/:id |
| AC-21.3.5 | 刪除 API | DELETE /api/v1/exchange-rates/:id |
| AC-21.3.6 | 切換狀態 API | POST /api/v1/exchange-rates/:id/toggle |

---

## Implementation Guide

### Phase 1: 列表與建立 API (1 point)

```typescript
// src/app/api/v1/exchange-rates/route.ts

import { NextRequest, NextResponse } from 'next/server';
import {
  getExchangeRates,
  createExchangeRate,
} from '@/services/exchange-rate.service';
import {
  getExchangeRatesQuerySchema,
  createExchangeRateSchema,
} from '@/lib/validations/exchange-rate.schema';
import { getServerSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = getExchangeRatesQuerySchema.parse(Object.fromEntries(searchParams));

  const result = await getExchangeRates(query);

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
  const validated = createExchangeRateSchema.parse(body);

  const item = await createExchangeRate(validated, session.user.id);

  return NextResponse.json({
    success: true,
    data: item,
  }, { status: 201 });
}
```

### Phase 2: 單一記錄 API (1 point)

```typescript
// src/app/api/v1/exchange-rates/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import {
  getExchangeRateById,
  updateExchangeRate,
  deleteExchangeRate,
} from '@/services/exchange-rate.service';
import { updateExchangeRateSchema } from '@/lib/validations/exchange-rate.schema';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const item = await getExchangeRateById(params.id);

  if (!item) {
    return NextResponse.json({
      type: 'https://api.example.com/errors/not-found',
      title: 'Not Found',
      status: 404,
      detail: '匯率記錄不存在',
    }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    data: item,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  const validated = updateExchangeRateSchema.parse(body);

  const item = await updateExchangeRate(params.id, validated);

  return NextResponse.json({
    success: true,
    data: item,
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await deleteExchangeRate(params.id);

  return NextResponse.json({
    success: true,
  });
}
```

### Phase 3: 切換狀態 API (0.5 points)

```typescript
// src/app/api/v1/exchange-rates/[id]/toggle/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { toggleExchangeRate } from '@/services/exchange-rate.service';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const item = await toggleExchangeRate(params.id);

  return NextResponse.json({
    success: true,
    data: item,
  });
}
```

### Phase 4: React Query Hooks (0.5 points)

```typescript
// src/hooks/use-exchange-rates.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { GetExchangeRatesQuery } from '@/lib/validations/exchange-rate.schema';

const QUERY_KEY = 'exchange-rates';

export function useExchangeRates(params: Partial<GetExchangeRatesQuery> = {}) {
  return useQuery({
    queryKey: [QUERY_KEY, params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.set(key, String(value));
        }
      });

      const res = await fetch(`/api/v1/exchange-rates?${searchParams}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });
}

export function useExchangeRate(id: string) {
  return useQuery({
    queryKey: [QUERY_KEY, id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/exchange-rates/${id}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    enabled: !!id,
  });
}

export function useCreateExchangeRate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: unknown) => {
      const res = await fetch('/api/v1/exchange-rates', {
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

export function useUpdateExchangeRate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: unknown }) => {
      const res = await fetch(`/api/v1/exchange-rates/${id}`, {
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

export function useDeleteExchangeRate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/exchange-rates/${id}`, {
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

export function useToggleExchangeRate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/exchange-rates/${id}/toggle`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to toggle');
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
├── app/api/v1/exchange-rates/
│   ├── route.ts                     # 新增
│   └── [id]/
│       ├── route.ts                 # 新增
│       └── toggle/route.ts          # 新增
└── hooks/
    └── use-exchange-rates.ts        # 新增
```

---

## Testing Checklist

- [ ] GET /api/v1/exchange-rates 分頁正確
- [ ] GET /api/v1/exchange-rates 篩選正確
- [ ] GET /api/v1/exchange-rates 排序正確
- [ ] GET /api/v1/exchange-rates/:id 返回詳情
- [ ] POST /api/v1/exchange-rates 建立成功
- [ ] POST 含 createInverse 時建立兩筆
- [ ] PATCH /api/v1/exchange-rates/:id 更新成功
- [ ] DELETE /api/v1/exchange-rates/:id 刪除成功
- [ ] DELETE 同時刪除反向記錄
- [ ] POST /api/v1/exchange-rates/:id/toggle 切換成功
- [ ] 未認證時返回 401
- [ ] 記錄不存在時返回 404
