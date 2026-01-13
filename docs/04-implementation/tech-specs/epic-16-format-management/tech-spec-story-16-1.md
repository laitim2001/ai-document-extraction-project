# Tech Spec: Story 16.1 - 格式列表 Tab

> **Version**: 1.0.0
> **Created**: 2026-01-12
> **Status**: Draft
> **Story Key**: STORY-16-1

---

## Overview

| 項目 | 內容 |
|------|------|
| **Story ID** | 16.1 |
| **Epic** | Epic 16 - 文件格式管理 |
| **Estimated Effort** | 5 Story Points |
| **Dependencies** | DocumentFormat 模型（已存在）, /api/v1/formats API（已存在） |
| **Blocking** | Story 16-2（格式詳情與編輯） |

---

## Objective

在公司詳情頁（`/companies/[id]`）新增「格式」Tab，顯示該公司所有已識別的文件格式列表，支援篩選和排序。

---

## Acceptance Criteria Mapping

| AC ID | 驗收條件 | 實現方式 |
|-------|----------|----------|
| AC-16.1.1 | 格式 Tab 入口 | 修改 ForwarderDetailView 新增 Tab |
| AC-16.1.2 | 格式列表顯示 | FormatList + FormatCard 組件 |
| AC-16.1.3 | 空狀態處理 | 使用 shadcn/ui 的 Empty State 模式 |
| AC-16.1.4 | 篩選功能 | FormatFilters 組件 + URL 參數 |
| AC-16.1.5 | 排序功能 | 整合到 FormatFilters |
| AC-16.1.6 | 格式卡片操作 | FormatCard 組件內實現 |

---

## Implementation Guide

### Phase 1: 修改公司詳情頁 (1 point)

#### 1.1 更新 ForwarderDetailView

```typescript
// src/components/features/forwarders/ForwarderDetailView.tsx

// 新增 Tab 定義
const TABS = [
  { id: 'overview', label: '總覽' },
  { id: 'rules', label: '規則' },
  { id: 'formats', label: '格式' },  // 新增
  { id: 'stats', label: '統計' },
  { id: 'documents', label: '文件' },
];

// 在 Tab 內容區域新增
{activeTab === 'formats' && (
  <FormatList companyId={company.id} />
)}
```

### Phase 2: 建立格式列表組件 (2 points)

#### 2.1 FormatList 組件

```typescript
// src/components/features/formats/FormatList.tsx

/**
 * @fileoverview 格式列表組件
 * @module src/components/features/formats
 * @since Epic 16 - Story 16.1
 */

'use client';

import * as React from 'react';
import { FormatCard } from './FormatCard';
import { FormatFilters } from './FormatFilters';
import { useCompanyFormats } from '@/hooks/use-company-formats';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText } from 'lucide-react';

export interface FormatListProps {
  companyId: string;
}

export function FormatList({ companyId }: FormatListProps) {
  const [filters, setFilters] = React.useState<FormatFiltersState>({
    documentType: null,
    documentSubtype: null,
    sortBy: 'fileCount',
    sortOrder: 'desc',
  });

  const { formats, isLoading, error, pagination } = useCompanyFormats({
    companyId,
    ...filters,
  });

  if (isLoading) {
    return <FormatListSkeleton />;
  }

  if (error) {
    return <FormatListError error={error} />;
  }

  if (!formats.length) {
    return <FormatListEmpty />;
  }

  return (
    <div className="space-y-4">
      <FormatFilters
        value={filters}
        onChange={setFilters}
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {formats.map((format) => (
          <FormatCard key={format.id} format={format} />
        ))}
      </div>
      {/* 分頁 */}
    </div>
  );
}

function FormatListEmpty() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <FileText className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-medium">尚無已識別的格式</h3>
      <p className="text-sm text-muted-foreground mt-1">
        上傳文件後系統會自動識別格式。
      </p>
    </div>
  );
}
```

#### 2.2 FormatCard 組件

```typescript
// src/components/features/formats/FormatCard.tsx

/**
 * @fileoverview 格式卡片組件
 * @module src/components/features/formats
 * @since Epic 16 - Story 16.1
 */

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, FileText, Check, X } from 'lucide-react';
import type { DocumentFormatListItem } from '@/types/document-format';

export interface FormatCardProps {
  format: DocumentFormatListItem;
}

export function FormatCard({ format }: FormatCardProps) {
  const router = useRouter();

  const handleClick = () => {
    router.push(`/companies/${format.companyId}/formats/${format.id}`);
  };

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={handleClick}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">
          <FileText className="h-4 w-4 inline-block mr-2" />
          {format.name || `${format.documentType} - ${format.documentSubtype}`}
        </CardTitle>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>編輯</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">刪除</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-3">
          <Badge variant="outline">{format.documentType}</Badge>
          <Badge variant="secondary">{format.documentSubtype}</Badge>
        </div>
        <div className="text-sm text-muted-foreground mb-2">
          文件數: {format.fileCount} | 術語: {format.commonTerms?.length || 0} 個
        </div>
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1">
            Prompt: {format.hasPromptConfig ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <X className="h-3 w-3 text-muted-foreground" />
            )}
          </span>
          <span className="flex items-center gap-1">
            映射: {format.hasMappingConfig ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <X className="h-3 w-3 text-muted-foreground" />
            )}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
```

### Phase 3: 篩選和排序 (1 point)

#### 3.1 FormatFilters 組件

```typescript
// src/components/features/formats/FormatFilters.tsx

'use client';

import * as React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DOCUMENT_TYPE_OPTIONS, DOCUMENT_SUBTYPE_OPTIONS } from '@/types/document-format';

export interface FormatFiltersState {
  documentType: string | null;
  documentSubtype: string | null;
  sortBy: 'fileCount' | 'updatedAt';
  sortOrder: 'asc' | 'desc';
}

export interface FormatFiltersProps {
  value: FormatFiltersState;
  onChange: (value: FormatFiltersState) => void;
}

export function FormatFilters({ value, onChange }: FormatFiltersProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <Select
        value={value.documentType || '__all__'}
        onValueChange={(v) => onChange({
          ...value,
          documentType: v === '__all__' ? null : v,
        })}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="文件類型" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">全部類型</SelectItem>
          {DOCUMENT_TYPE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 子類型篩選 */}
      {/* 排序選項 */}
    </div>
  );
}
```

### Phase 4: 數據獲取 Hook (1 point)

#### 4.1 useCompanyFormats Hook

```typescript
// src/hooks/use-company-formats.ts

/**
 * @fileoverview 公司格式列表 Hook
 * @module src/hooks
 * @since Epic 16 - Story 16.1
 */

import { useQuery } from '@tanstack/react-query';
import type { DocumentFormatListItem } from '@/types/document-format';

export interface UseCompanyFormatsParams {
  companyId: string;
  documentType?: string | null;
  documentSubtype?: string | null;
  sortBy?: 'fileCount' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export function useCompanyFormats(params: UseCompanyFormatsParams) {
  const { companyId, ...queryParams } = params;

  return useQuery({
    queryKey: ['formats', 'company', companyId, queryParams],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      searchParams.set('companyId', companyId);
      if (queryParams.documentType) {
        searchParams.set('documentType', queryParams.documentType);
      }
      if (queryParams.documentSubtype) {
        searchParams.set('documentSubtype', queryParams.documentSubtype);
      }
      searchParams.set('sortBy', queryParams.sortBy || 'fileCount');
      searchParams.set('sortOrder', queryParams.sortOrder || 'desc');

      const response = await fetch(`/api/v1/formats?${searchParams}`);
      if (!response.ok) {
        throw new Error('Failed to fetch formats');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 分鐘
  });
}
```

---

## File Structure

```
src/
├── components/features/formats/
│   ├── FormatList.tsx           # 格式列表
│   ├── FormatCard.tsx           # 格式卡片
│   ├── FormatFilters.tsx        # 篩選控件
│   └── index.ts                 # 導出
├── hooks/
│   └── use-company-formats.ts   # 數據獲取 Hook
└── components/features/forwarders/
    └── ForwarderDetailView.tsx  # 需修改
```

---

## Testing Checklist

- [ ] TypeScript 類型檢查通過
- [ ] ESLint 檢查通過
- [ ] 格式 Tab 正常顯示
- [ ] 篩選功能正常
- [ ] 排序功能正常
- [ ] 空狀態正確顯示
- [ ] 點擊卡片正確跳轉

---

## Related Files

- `src/components/features/forwarders/ForwarderDetailView.tsx`
- `src/app/api/v1/formats/route.ts`
- `src/types/document-format.ts`
