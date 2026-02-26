# Tech Spec: Story 20.2 - Region 管理 API 與 UI

> **Version**: 1.0.0
> **Created**: 2026-02-04
> **Status**: Draft
> **Story Key**: STORY-20-2

---

## Overview

| 項目 | 內容 |
|------|------|
| **Story ID** | 20.2 |
| **Epic** | Epic 20 - Reference Number Master Setup |
| **Estimated Effort** | 4 Story Points |
| **Dependencies** | Story 20-1 |
| **Blocking** | Story 20-5 |

---

## Objective

建立 Region 的 CRUD API 和管理 UI，包含 RegionSelect 共用組件。

---

## Acceptance Criteria Mapping

| AC ID | 驗收條件 | 實現方式 |
|-------|----------|----------|
| AC-20.2.1 | Region 列表 API | GET /api/v1/regions |
| AC-20.2.2 | Region 建立 API | POST /api/v1/regions |
| AC-20.2.3 | Region 更新 API | PATCH /api/v1/regions/:id |
| AC-20.2.4 | Region 刪除 API | DELETE /api/v1/regions/:id |
| AC-20.2.5 | RegionSelect 組件 | React Component |
| AC-20.2.6 | 地區管理 UI | Settings Page Section |

---

## Implementation Guide

### Phase 1: Zod 驗證 (0.5 points)

```typescript
// src/lib/validations/region.schema.ts

import { z } from 'zod';

export const createRegionSchema = z.object({
  code: z
    .string()
    .min(2, 'Code 至少 2 字元')
    .max(20, 'Code 最多 20 字元')
    .regex(/^[A-Z0-9_]+$/, 'Code 只能包含大寫英文、數字和底線'),
  name: z
    .string()
    .min(1, '名稱不能為空')
    .max(100, '名稱最多 100 字元'),
  description: z.string().max(500).optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

export const updateRegionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

export const getRegionsQuerySchema = z.object({
  isActive: z.string().transform(v => v === 'true').optional(),
});
```

### Phase 2: 服務層 (1 point)

```typescript
// src/services/region.service.ts

import { prisma } from '@/lib/prisma';
import type { CreateRegionInput, UpdateRegionInput, Region } from '@/types/region';

export async function getRegions(isActive?: boolean): Promise<Region[]> {
  const where = isActive !== undefined ? { isActive } : {};

  return prisma.region.findMany({
    where,
    orderBy: [
      { sortOrder: 'asc' },
      { name: 'asc' },
    ],
  });
}

export async function getRegionById(id: string): Promise<Region | null> {
  return prisma.region.findUnique({
    where: { id },
  });
}

export async function createRegion(input: CreateRegionInput): Promise<Region> {
  return prisma.region.create({
    data: {
      code: input.code.toUpperCase(),
      name: input.name,
      description: input.description,
      sortOrder: input.sortOrder ?? 0,
      isDefault: false,  // 使用者建立的不是預設
    },
  });
}

export async function updateRegion(id: string, input: UpdateRegionInput): Promise<Region> {
  return prisma.region.update({
    where: { id },
    data: input,
  });
}

export async function deleteRegion(id: string): Promise<void> {
  const region = await prisma.region.findUnique({
    where: { id },
    include: {
      _count: {
        select: { referenceNumbers: true },
      },
    },
  });

  if (!region) {
    throw new Error('地區不存在');
  }

  if (region.isDefault) {
    throw new Error('無法刪除系統預設地區');
  }

  if (region._count.referenceNumbers > 0) {
    throw new Error('此地區有關聯的 Reference Number，無法刪除');
  }

  // 軟刪除
  await prisma.region.update({
    where: { id },
    data: { isActive: false },
  });
}
```

### Phase 3: API 端點 (1 point)

```typescript
// src/app/api/v1/regions/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getRegions, createRegion } from '@/services/region.service';
import { createRegionSchema, getRegionsQuerySchema } from '@/lib/validations/region.schema';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = getRegionsQuerySchema.parse(Object.fromEntries(searchParams));

  const regions = await getRegions(query.isActive);

  return NextResponse.json({
    success: true,
    data: regions,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const validated = createRegionSchema.parse(body);

  const region = await createRegion(validated);

  return NextResponse.json({
    success: true,
    data: region,
  }, { status: 201 });
}
```

```typescript
// src/app/api/v1/regions/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getRegionById, updateRegion, deleteRegion } from '@/services/region.service';
import { updateRegionSchema } from '@/lib/validations/region.schema';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const region = await getRegionById(params.id);

  if (!region) {
    return NextResponse.json({
      type: 'https://api.example.com/errors/not-found',
      title: 'Not Found',
      status: 404,
      detail: '地區不存在',
    }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    data: region,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  const validated = updateRegionSchema.parse(body);

  const region = await updateRegion(params.id, validated);

  return NextResponse.json({
    success: true,
    data: region,
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await deleteRegion(params.id);

  return NextResponse.json({
    success: true,
  });
}
```

### Phase 4: RegionSelect 組件 (1 point)

```typescript
// src/components/features/region/RegionSelect.tsx

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRegions } from '@/hooks/use-regions';

interface RegionSelectProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  includeInactive?: boolean;
  className?: string;
}

export function RegionSelect({
  value,
  onChange,
  placeholder,
  disabled,
  includeInactive = false,
  className,
}: RegionSelectProps) {
  const t = useTranslations('region');
  const { data: regions, isLoading } = useRegions({ isActive: !includeInactive });

  return (
    <Select
      value={value}
      onValueChange={onChange}
      disabled={disabled || isLoading}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder || t('select.placeholder')} />
      </SelectTrigger>
      <SelectContent>
        {regions?.map((region) => (
          <SelectItem key={region.id} value={region.id}>
            {region.name} ({region.code})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

### Phase 5: i18n (0.5 points)

```json
// messages/en/region.json
{
  "title": "Regions",
  "description": "Manage regions for reference numbers",
  "select": {
    "placeholder": "Select a region"
  },
  "form": {
    "code": "Code",
    "name": "Name",
    "description": "Description",
    "sortOrder": "Sort Order"
  },
  "actions": {
    "add": "Add Region",
    "edit": "Edit",
    "delete": "Delete"
  },
  "messages": {
    "created": "Region created successfully",
    "updated": "Region updated successfully",
    "deleted": "Region deleted successfully",
    "cannotDeleteDefault": "Cannot delete system default region",
    "cannotDeleteWithReferences": "Cannot delete region with associated reference numbers"
  }
}
```

```json
// messages/zh-TW/region.json
{
  "title": "地區管理",
  "description": "管理參考號碼的地區分類",
  "select": {
    "placeholder": "選擇地區"
  },
  "form": {
    "code": "代碼",
    "name": "名稱",
    "description": "說明",
    "sortOrder": "排序"
  },
  "actions": {
    "add": "新增地區",
    "edit": "編輯",
    "delete": "刪除"
  },
  "messages": {
    "created": "地區建立成功",
    "updated": "地區更新成功",
    "deleted": "地區刪除成功",
    "cannotDeleteDefault": "無法刪除系統預設地區",
    "cannotDeleteWithReferences": "此地區有關聯的參考號碼，無法刪除"
  }
}
```

---

## File Structure

```
src/
├── lib/validations/
│   └── region.schema.ts              # 新增
├── services/
│   └── region.service.ts             # 新增
├── components/features/region/
│   ├── index.ts                      # 新增
│   └── RegionSelect.tsx              # 新增
├── hooks/
│   └── use-regions.ts                # 新增
└── app/api/v1/regions/
    ├── route.ts                      # 新增
    └── [id]/route.ts                 # 新增

messages/
├── en/region.json                    # 新增
├── zh-TW/region.json                 # 新增
└── zh-CN/region.json                 # 新增
```

---

## Testing Checklist

- [ ] GET /api/v1/regions 返回所有地區
- [ ] POST /api/v1/regions 建立地區
- [ ] PATCH /api/v1/regions/:id 更新地區
- [ ] DELETE /api/v1/regions/:id 軟刪除
- [ ] 預設地區無法刪除
- [ ] 有關聯記錄的地區無法刪除
- [ ] RegionSelect 正確載入和選擇
- [ ] i18n 翻譯正確
