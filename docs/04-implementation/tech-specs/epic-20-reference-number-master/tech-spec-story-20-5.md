# Tech Spec: Story 20.5 - 管理頁面 - 列表與篩選

> **Version**: 1.0.0
> **Created**: 2026-02-04
> **Status**: Draft
> **Story Key**: STORY-20-5

---

## Overview

| 項目 | 內容 |
|------|------|
| **Story ID** | 20.5 |
| **Epic** | Epic 20 - Reference Number Master Setup |
| **Estimated Effort** | 6 Story Points |
| **Dependencies** | Story 20-2, 20-3 |
| **Blocking** | Story 20-6 |

---

## Objective

建立 Reference Number 管理頁面的列表和篩選功能。

---

## Acceptance Criteria Mapping

| AC ID | 驗收條件 | 實現方式 |
|-------|----------|----------|
| AC-20.5.1 | 列表頁面 | /admin/reference-numbers/page.tsx |
| AC-20.5.2 | 篩選功能 | ReferenceNumberFilters 組件 |
| AC-20.5.3 | 排序功能 | DataTable sortable columns |
| AC-20.5.4 | URL 同步 | useSearchParams hook |
| AC-20.5.5 | 操作按鈕 | Edit, Delete, Copy |
| AC-20.5.6 | i18n 支援 | referenceNumber.json |

---

## Implementation Guide

### Phase 1: 頁面結構 (2 points)

```typescript
// src/app/[locale]/(dashboard)/admin/reference-numbers/page.tsx

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Plus, Upload, Download } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { ReferenceNumberList } from '@/components/features/reference-number/ReferenceNumberList';
import { ReferenceNumberFilters } from '@/components/features/reference-number/ReferenceNumberFilters';
import { useReferenceNumbers } from '@/hooks/use-reference-numbers';

export default function ReferenceNumbersPage() {
  const t = useTranslations('referenceNumber');
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // 從 URL 解析篩選條件
  const filters = {
    page: Number(searchParams.get('page')) || 1,
    limit: Number(searchParams.get('limit')) || 20,
    year: searchParams.get('year') ? Number(searchParams.get('year')) : undefined,
    regionId: searchParams.get('regionId') || undefined,
    type: searchParams.get('type') || undefined,
    status: searchParams.get('status') || undefined,
    search: searchParams.get('search') || undefined,
    sortBy: searchParams.get('sortBy') || 'createdAt',
    sortOrder: searchParams.get('sortOrder') || 'desc',
  };

  const { data, isLoading } = useReferenceNumbers(filters);

  // 更新 URL 參數
  const updateFilters = (newFilters: Partial<typeof filters>) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.set(key, String(value));
      } else {
        params.delete(key);
      }
    });
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      {/* 頁面標題 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-2" />
            {t('actions.import')}
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            {t('actions.export')}
          </Button>
          <Button asChild>
            <Link href="/admin/reference-numbers/new">
              <Plus className="h-4 w-4 mr-2" />
              {t('actions.add')}
            </Link>
          </Button>
        </div>
      </div>

      {/* 篩選器 */}
      <ReferenceNumberFilters
        filters={filters}
        onFiltersChange={updateFilters}
      />

      {/* 列表 */}
      <ReferenceNumberList
        data={data?.data || []}
        pagination={data?.meta?.pagination}
        isLoading={isLoading}
        onPageChange={(page) => updateFilters({ page })}
        onSortChange={(sortBy, sortOrder) => updateFilters({ sortBy, sortOrder })}
      />
    </div>
  );
}
```

### Phase 2: 篩選器組件 (1.5 points)

```typescript
// src/components/features/reference-number/ReferenceNumberFilters.tsx

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RegionSelect } from '@/components/features/region/RegionSelect';
import { Search, X } from 'lucide-react';

interface ReferenceNumberFiltersProps {
  filters: {
    year?: number;
    regionId?: string;
    type?: string;
    status?: string;
    search?: string;
  };
  onFiltersChange: (filters: Partial<typeof filters>) => void;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 10 }, (_, i) => CURRENT_YEAR - i);

export function ReferenceNumberFilters({
  filters,
  onFiltersChange,
}: ReferenceNumberFiltersProps) {
  const t = useTranslations('referenceNumber');
  const [searchValue, setSearchValue] = React.useState(filters.search || '');

  const handleSearch = () => {
    onFiltersChange({ search: searchValue, page: 1 });
  };

  const handleClear = () => {
    setSearchValue('');
    onFiltersChange({
      year: undefined,
      regionId: undefined,
      type: undefined,
      status: undefined,
      search: undefined,
      page: 1,
    });
  };

  return (
    <div className="flex flex-wrap items-end gap-4">
      {/* 搜尋 */}
      <div className="flex items-center gap-2">
        <Input
          placeholder={t('filters.searchPlaceholder')}
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="w-64"
        />
        <Button variant="outline" size="icon" onClick={handleSearch}>
          <Search className="h-4 w-4" />
        </Button>
      </div>

      {/* 年份 */}
      <Select
        value={filters.year?.toString() || ''}
        onValueChange={(value) => onFiltersChange({ year: value ? Number(value) : undefined, page: 1 })}
      >
        <SelectTrigger className="w-32">
          <SelectValue placeholder={t('filters.year')} />
        </SelectTrigger>
        <SelectContent>
          {YEARS.map((year) => (
            <SelectItem key={year} value={year.toString()}>
              {year}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 地區 */}
      <div className="w-48">
        <RegionSelect
          value={filters.regionId}
          onChange={(value) => onFiltersChange({ regionId: value || undefined, page: 1 })}
          placeholder={t('filters.region')}
        />
      </div>

      {/* 類型 */}
      <Select
        value={filters.type || ''}
        onValueChange={(value) => onFiltersChange({ type: value || undefined, page: 1 })}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder={t('filters.type')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="SHIPMENT">{t('types.SHIPMENT')}</SelectItem>
          <SelectItem value="DELIVERY">{t('types.DELIVERY')}</SelectItem>
          <SelectItem value="BOOKING">{t('types.BOOKING')}</SelectItem>
          <SelectItem value="CONTAINER">{t('types.CONTAINER')}</SelectItem>
          <SelectItem value="HAWB">{t('types.HAWB')}</SelectItem>
          <SelectItem value="MAWB">{t('types.MAWB')}</SelectItem>
          <SelectItem value="BL">{t('types.BL')}</SelectItem>
          <SelectItem value="CUSTOMS">{t('types.CUSTOMS')}</SelectItem>
          <SelectItem value="OTHER">{t('types.OTHER')}</SelectItem>
        </SelectContent>
      </Select>

      {/* 狀態 */}
      <Select
        value={filters.status || ''}
        onValueChange={(value) => onFiltersChange({ status: value || undefined, page: 1 })}
      >
        <SelectTrigger className="w-32">
          <SelectValue placeholder={t('filters.status')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ACTIVE">{t('statuses.ACTIVE')}</SelectItem>
          <SelectItem value="EXPIRED">{t('statuses.EXPIRED')}</SelectItem>
          <SelectItem value="CANCELLED">{t('statuses.CANCELLED')}</SelectItem>
        </SelectContent>
      </Select>

      {/* 清除 */}
      <Button variant="ghost" size="sm" onClick={handleClear}>
        <X className="h-4 w-4 mr-1" />
        {t('filters.clear')}
      </Button>
    </div>
  );
}
```

### Phase 3: 列表組件 (2 points)

```typescript
// src/components/features/reference-number/ReferenceNumberList.tsx

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Edit, Trash, Copy, ArrowUpDown } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { formatDate } from '@/lib/i18n-date';
import { ReferenceNumberDeleteDialog } from './ReferenceNumberDeleteDialog';
import type { ReferenceNumberListItem } from '@/types/reference-number';

interface ReferenceNumberListProps {
  data: ReferenceNumberListItem[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  isLoading: boolean;
  onPageChange: (page: number) => void;
  onSortChange: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
}

export function ReferenceNumberList({
  data,
  pagination,
  isLoading,
  onPageChange,
  onSortChange,
}: ReferenceNumberListProps) {
  const t = useTranslations('referenceNumber');
  const [deleteId, setDeleteId] = React.useState<string | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // TODO: show toast
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800';
      case 'EXPIRED':
        return 'bg-gray-100 text-gray-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return <div className="py-8 text-center">{t('loading')}</div>;
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-48">{t('columns.number')}</TableHead>
              <TableHead className="w-32">{t('columns.type')}</TableHead>
              <TableHead className="w-24">{t('columns.year')}</TableHead>
              <TableHead className="w-32">{t('columns.region')}</TableHead>
              <TableHead className="w-28">{t('columns.status')}</TableHead>
              <TableHead className="w-28">{t('columns.matchCount')}</TableHead>
              <TableHead className="w-36">{t('columns.updatedAt')}</TableHead>
              <TableHead className="w-20">{t('columns.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  {t('noData')}
                </TableCell>
              </TableRow>
            ) : (
              data.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono">{item.number}</TableCell>
                  <TableCell>{t(`types.${item.type}`)}</TableCell>
                  <TableCell>{item.year}</TableCell>
                  <TableCell>{item.regionCode}</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(item.status)}>
                      {t(`statuses.${item.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell>{item.matchCount}</TableCell>
                  <TableCell>{formatDate(item.updatedAt)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/reference-numbers/${item.id}`}>
                            <Edit className="h-4 w-4 mr-2" />
                            {t('actions.edit')}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => copyToClipboard(item.number)}>
                          <Copy className="h-4 w-4 mr-2" />
                          {t('actions.copy')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteId(item.id)}
                        >
                          <Trash className="h-4 w-4 mr-2" />
                          {t('actions.delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 分頁 */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {t('pagination.showing', {
              from: (pagination.page - 1) * pagination.limit + 1,
              to: Math.min(pagination.page * pagination.limit, pagination.total),
              total: pagination.total,
            })}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === 1}
              onClick={() => onPageChange(pagination.page - 1)}
            >
              {t('pagination.previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === pagination.totalPages}
              onClick={() => onPageChange(pagination.page + 1)}
            >
              {t('pagination.next')}
            </Button>
          </div>
        </div>
      )}

      {/* 刪除確認 */}
      <ReferenceNumberDeleteDialog
        id={deleteId}
        onClose={() => setDeleteId(null)}
      />
    </>
  );
}
```

### Phase 4: i18n (0.5 points)

```json
// messages/zh-TW/referenceNumber.json
{
  "title": "參考號碼管理",
  "description": "管理 Shipment/Delivery Number 等參考號碼",
  "loading": "載入中...",
  "noData": "暫無資料",
  "columns": {
    "number": "號碼",
    "type": "類型",
    "year": "年份",
    "region": "地區",
    "status": "狀態",
    "matchCount": "匹配次數",
    "updatedAt": "更新時間",
    "actions": "操作"
  },
  "types": {
    "SHIPMENT": "運輸單號",
    "DELIVERY": "交貨單號",
    "BOOKING": "訂艙號",
    "CONTAINER": "櫃號",
    "HAWB": "分提單",
    "MAWB": "主提單",
    "BL": "提單",
    "CUSTOMS": "報關單",
    "OTHER": "其他"
  },
  "statuses": {
    "ACTIVE": "有效",
    "EXPIRED": "已過期",
    "CANCELLED": "已取消"
  },
  "filters": {
    "searchPlaceholder": "搜尋號碼...",
    "year": "選擇年份",
    "region": "選擇地區",
    "type": "選擇類型",
    "status": "選擇狀態",
    "clear": "清除篩選"
  },
  "actions": {
    "add": "新增",
    "import": "導入",
    "export": "導出",
    "edit": "編輯",
    "copy": "複製號碼",
    "delete": "刪除"
  },
  "pagination": {
    "showing": "顯示 {from} - {to} 筆，共 {total} 筆",
    "previous": "上一頁",
    "next": "下一頁"
  }
}
```

---

## File Structure

```
src/app/[locale]/(dashboard)/admin/reference-numbers/
├── page.tsx                          # 新增

src/components/features/reference-number/
├── index.ts                          # 新增
├── ReferenceNumberList.tsx           # 新增
├── ReferenceNumberFilters.tsx        # 新增
├── ReferenceNumberDeleteDialog.tsx   # 新增
├── ReferenceNumberTypeBadge.tsx      # 新增
└── ReferenceNumberStatusBadge.tsx    # 新增

messages/
├── en/referenceNumber.json           # 新增
├── zh-TW/referenceNumber.json        # 新增
└── zh-CN/referenceNumber.json        # 新增
```

---

## Testing Checklist

- [ ] 列表頁正確顯示資料
- [ ] 篩選功能正常
- [ ] 分頁功能正常
- [ ] URL 參數同步
- [ ] 編輯連結正確
- [ ] 刪除功能正常
- [ ] 複製號碼功能正常
- [ ] i18n 翻譯正確
