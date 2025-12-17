# Tech Spec: Story 8-3 處理記錄查詢

## Story 資訊

| 屬性 | 值 |
|------|-----|
| Story ID | 8.3 |
| Epic | Epic 8: 審計追溯與合規 |
| 優先級 | High |
| 預估點數 | 8 |
| 狀態 | Ready for Dev |
| 依賴 | Story 8.1 (用戶操作日誌), Story 6.2 (城市數據訪問控制) |

## 1. 概述

### 1.1 目標
實現審計查詢功能，讓審計人員可以查詢指定期間的處理記錄，支援多條件篩選、分頁和大量結果處理。

### 1.2 用戶故事
**As a** 審計人員
**I want** 查詢指定期間的處理記錄
**So that** 我可以進行審計和合規檢查

### 1.3 範圍
- 審計查詢 API（多條件、分頁）
- 查詢表單 UI
- 結果表格（排序、搜尋）
- 大量結果處理機制
- 權限控制（AUDITOR / GLOBAL_ADMIN）

---

## 2. 類型定義

```typescript
// src/types/audit-query.ts

export interface AuditQueryParams {
  // 必填
  startDate: string;
  endDate: string;

  // 可選篩選
  cityCodes?: string[];
  forwarderIds?: string[];
  statuses?: string[];
  operatorIds?: string[];
  resourceTypes?: string[];
  actions?: string[];

  // 搜尋
  searchTerm?: string;

  // 分頁
  page?: number;
  pageSize?: number;

  // 排序
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AuditQueryResult {
  records: ProcessingRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  queryTime: number;
  isTruncated: boolean;
}

export interface ProcessingRecord {
  id: string;
  documentId: string;
  invoiceNumber?: string;
  forwarderCode: string;
  forwarderName: string;
  cityCode: string;
  cityName: string;
  status: string;
  processingType: 'AUTO' | 'MANUAL';
  processedBy?: string;
  processedByName?: string;
  processedAt?: string;
  createdAt: string;
  aiCost?: number;
  reviewDuration?: number;
  corrections?: number;
  escalated: boolean;
}

export const MAX_QUERY_RESULTS = 10000;
export const DEFAULT_PAGE_SIZE = 50;
```

---

## 3. 審計查詢服務

```typescript
// src/services/audit-query.service.ts

import { prisma } from '@/lib/prisma';
import { CityFilter } from '@/middleware/city-filter';
import {
  AuditQueryParams,
  AuditQueryResult,
  ProcessingRecord,
  MAX_QUERY_RESULTS,
  DEFAULT_PAGE_SIZE
} from '@/types/audit-query';

export class AuditQueryService {
  private readonly QUERY_TIMEOUT = 30000;

  async executeQuery(
    params: AuditQueryParams,
    cityFilter: CityFilter
  ): Promise<AuditQueryResult> {
    const startTime = Date.now();
    const where = this.buildWhereClause(params, cityFilter);

    // 計算總數
    const total = await prisma.document.count({ where });

    // 超過限制返回截斷結果
    if (total > MAX_QUERY_RESULTS) {
      return {
        records: [],
        total,
        page: 1,
        pageSize: params.pageSize || DEFAULT_PAGE_SIZE,
        totalPages: Math.ceil(total / (params.pageSize || DEFAULT_PAGE_SIZE)),
        queryTime: Date.now() - startTime,
        isTruncated: true
      };
    }

    const page = params.page || 1;
    const pageSize = params.pageSize || DEFAULT_PAGE_SIZE;
    const orderBy = this.buildOrderBy(params.sortBy, params.sortOrder);

    const documents = await prisma.document.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        forwarder: { select: { code: true, name: true } },
        city: { select: { code: true, name: true } },
        processedByUser: { select: { id: true, name: true } },
        corrections: { select: { id: true } },
        apiUsageLogs: { select: { estimatedCost: true } }
      }
    });

    return {
      records: documents.map(doc => this.toProcessingRecord(doc)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      queryTime: Date.now() - startTime,
      isTruncated: false
    };
  }

  async getResultCountPreview(
    params: AuditQueryParams,
    cityFilter: CityFilter
  ): Promise<{ count: number; exceedsLimit: boolean }> {
    const where = this.buildWhereClause(params, cityFilter);
    const count = await prisma.document.count({ where });
    return { count, exceedsLimit: count > MAX_QUERY_RESULTS };
  }

  private buildWhereClause(params: AuditQueryParams, cityFilter: CityFilter): any {
    const where: any = {
      createdAt: {
        gte: new Date(params.startDate),
        lte: new Date(params.endDate)
      }
    };

    // 城市權限過濾
    if (!cityFilter.isGlobalAdmin) {
      where.cityCode = { in: cityFilter.cityCodes };
    }

    if (params.cityCodes?.length) {
      if (cityFilter.isGlobalAdmin) {
        where.cityCode = { in: params.cityCodes };
      } else {
        const allowedCities = params.cityCodes.filter(c => cityFilter.cityCodes.includes(c));
        where.cityCode = { in: allowedCities };
      }
    }

    if (params.forwarderIds?.length) {
      where.forwarderId = { in: params.forwarderIds };
    }

    if (params.statuses?.length) {
      where.status = { in: params.statuses };
    }

    if (params.operatorIds?.length) {
      where.processedBy = { in: params.operatorIds };
    }

    if (params.searchTerm) {
      where.OR = [
        { invoiceNumber: { contains: params.searchTerm, mode: 'insensitive' } },
        { id: { contains: params.searchTerm, mode: 'insensitive' } },
        { forwarder: { code: { contains: params.searchTerm, mode: 'insensitive' } } }
      ];
    }

    return where;
  }

  private buildOrderBy(sortBy?: string, sortOrder?: 'asc' | 'desc'): any {
    const order = sortOrder || 'desc';
    switch (sortBy) {
      case 'invoiceNumber': return { invoiceNumber: order };
      case 'forwarder': return { forwarder: { code: order } };
      case 'status': return { status: order };
      case 'processedAt': return { processedAt: order };
      default: return { createdAt: order };
    }
  }

  private toProcessingRecord(doc: any): ProcessingRecord {
    const totalAiCost = doc.apiUsageLogs?.reduce(
      (sum: number, log: any) => sum + (log.estimatedCost || 0), 0
    ) || 0;

    const reviewDuration = doc.reviewedAt && doc.processedAt
      ? Math.round((new Date(doc.reviewedAt).getTime() - new Date(doc.processedAt).getTime()) / 1000)
      : undefined;

    return {
      id: doc.id,
      documentId: doc.id,
      invoiceNumber: doc.invoiceNumber,
      forwarderCode: doc.forwarder?.code || '',
      forwarderName: doc.forwarder?.name || '',
      cityCode: doc.cityCode,
      cityName: doc.city?.name || doc.cityCode,
      status: doc.status,
      processingType: doc.autoApproved ? 'AUTO' : 'MANUAL',
      processedBy: doc.processedBy,
      processedByName: doc.processedByUser?.name,
      processedAt: doc.processedAt?.toISOString(),
      createdAt: doc.createdAt.toISOString(),
      aiCost: totalAiCost,
      reviewDuration,
      corrections: doc.corrections?.length || 0,
      escalated: doc.status === 'ESCALATED'
    };
  }
}

export const auditQueryService = new AuditQueryService();
```

---

## 4. API 端點

```typescript
// src/app/api/audit/query/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { withCityFilter } from '@/middleware/city-filter';
import { withAuditLog } from '@/middleware/audit-log.middleware';
import { auditQueryService } from '@/services/audit-query.service';
import { AuditQueryParams } from '@/types/audit-query';

async function queryHandler(request: NextRequest) {
  return withCityFilter(request, async (req, cityFilter) => {
    const session = await auth();

    // 權限檢查
    const hasAuditAccess = session?.user?.roles?.some(r =>
      ['AUDITOR', 'GLOBAL_ADMIN'].includes(r.name)
    );

    if (!hasAuditAccess) {
      return NextResponse.json(
        { success: false, error: 'Audit access required' },
        { status: 403 }
      );
    }

    const params: AuditQueryParams = await req.json();

    if (!params.startDate || !params.endDate) {
      return NextResponse.json(
        { success: false, error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    const result = await auditQueryService.executeQuery(params, cityFilter);
    return NextResponse.json({ success: true, data: result });
  });
}

export const POST = withAuditLog(
  {
    action: 'READ',
    resourceType: 'auditQuery',
    getDescription: () => 'Executed audit query'
  },
  queryHandler
);
```

### 4.1 結果計數預覽

```typescript
// src/app/api/audit/query/count/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { withCityFilter } from '@/middleware/city-filter';
import { auditQueryService } from '@/services/audit-query.service';

export async function POST(request: NextRequest) {
  return withCityFilter(request, async (req, cityFilter) => {
    const session = await auth();

    const hasAuditAccess = session?.user?.roles?.some(r =>
      ['AUDITOR', 'GLOBAL_ADMIN'].includes(r.name)
    );

    if (!hasAuditAccess) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const params = await req.json();
    const preview = await auditQueryService.getResultCountPreview(params, cityFilter);

    return NextResponse.json({ success: true, data: preview });
  });
}
```

---

## 5. 審計查詢頁面

```typescript
// src/app/(dashboard)/audit/query/page.tsx

import { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AuditQueryClient } from './client';

export const metadata: Metadata = {
  title: '審計查詢 | AI 發票提取系統'
};

export default async function AuditQueryPage() {
  const session = await auth();

  const hasAuditAccess = session?.user?.roles?.some(r =>
    ['AUDITOR', 'GLOBAL_ADMIN'].includes(r.name)
  );

  if (!hasAuditAccess) {
    redirect('/dashboard');
  }

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">審計查詢</h1>
      <AuditQueryClient />
    </div>
  );
}
```

---

## 6. 查詢表單組件

```typescript
// src/components/audit/AuditQueryForm.tsx

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, subDays } from 'date-fns';
import { CalendarIcon, Search, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { AuditQueryParams, MAX_QUERY_RESULTS } from '@/types/audit-query';

const queryFormSchema = z.object({
  startDate: z.date({ required_error: '請選擇開始日期' }),
  endDate: z.date({ required_error: '請選擇結束日期' }),
  cityCodes: z.array(z.string()).optional(),
  forwarderIds: z.array(z.string()).optional(),
  statuses: z.array(z.string()).optional(),
  operatorIds: z.array(z.string()).optional()
}).refine(data => data.endDate >= data.startDate, {
  message: '結束日期必須晚於開始日期',
  path: ['endDate']
});

interface AuditQueryFormProps {
  onQuery: (params: AuditQueryParams) => void;
  onPreviewCount: (params: AuditQueryParams) => Promise<{ count: number; exceedsLimit: boolean }>;
  loading?: boolean;
}

export function AuditQueryForm({ onQuery, onPreviewCount, loading = false }: AuditQueryFormProps) {
  const [countPreview, setCountPreview] = useState<{ count: number; exceedsLimit: boolean } | null>(null);

  const form = useForm<z.infer<typeof queryFormSchema>>({
    resolver: zodResolver(queryFormSchema),
    defaultValues: {
      startDate: subDays(new Date(), 7),
      endDate: new Date()
    }
  });

  const handleSubmit = async (values: z.infer<typeof queryFormSchema>) => {
    const params: AuditQueryParams = {
      startDate: values.startDate.toISOString(),
      endDate: values.endDate.toISOString(),
      cityCodes: values.cityCodes,
      forwarderIds: values.forwarderIds,
      statuses: values.statuses,
      operatorIds: values.operatorIds
    };

    const preview = await onPreviewCount(params);
    setCountPreview(preview);

    if (!preview.exceedsLimit) {
      onQuery(params);
    }
  };

  const statusOptions = [
    { value: 'PENDING', label: '待處理' },
    { value: 'PROCESSING', label: '處理中' },
    { value: 'PENDING_REVIEW', label: '待審核' },
    { value: 'APPROVED', label: '已核准' },
    { value: 'COMPLETED', label: '已完成' },
    { value: 'FAILED', label: '失敗' },
    { value: 'ESCALATED', label: '已升級' }
  ];

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>開始日期 *</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button variant="outline" className={cn('w-full pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}>
                        {field.value ? format(field.value, 'yyyy-MM-dd') : '選擇日期'}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date > new Date()} />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>結束日期 *</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button variant="outline" className={cn('w-full pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}>
                        {field.value ? format(field.value, 'yyyy-MM-dd') : '選擇日期'}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date > new Date()} />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="statuses"
            render={({ field }) => (
              <FormItem>
                <FormLabel>處理狀態</FormLabel>
                <Select onValueChange={(value) => field.onChange(value ? [value] : [])} value={field.value?.[0] || ''}>
                  <FormControl><SelectTrigger><SelectValue placeholder="全部狀態" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="">全部狀態</SelectItem>
                    {statusOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />

          <div className="flex items-end">
            <Button type="submit" disabled={loading} className="w-full">
              <Search className="mr-2 h-4 w-4" />查詢
            </Button>
          </div>
        </div>

        {countPreview?.exceedsLimit && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>結果過多</AlertTitle>
            <AlertDescription>
              查詢結果共 {countPreview.count.toLocaleString()} 筆，超過上限 {MAX_QUERY_RESULTS.toLocaleString()} 筆。請縮小查詢範圍或使用匯出功能。
            </AlertDescription>
          </Alert>
        )}
      </form>
    </Form>
  );
}
```

---

## 7. 查詢結果表格

```typescript
// src/components/audit/AuditResultTable.tsx

'use client';

import { useState } from 'react';
import { useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel, getPaginationRowModel, ColumnDef, flexRender } from '@tanstack/react-table';
import { ArrowUpDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ProcessingRecord } from '@/types/audit-query';
import { format } from 'date-fns';

interface AuditResultTableProps {
  data: ProcessingRecord[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

const statusBadgeVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'outline',
  PROCESSING: 'secondary',
  PENDING_REVIEW: 'secondary',
  APPROVED: 'default',
  COMPLETED: 'default',
  FAILED: 'destructive',
  ESCALATED: 'destructive'
};

export function AuditResultTable({ data, total, page, pageSize, onPageChange }: AuditResultTableProps) {
  const [globalFilter, setGlobalFilter] = useState('');

  const columns: ColumnDef<ProcessingRecord>[] = [
    { accessorKey: 'invoiceNumber', header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting()}>發票號碼 <ArrowUpDown className="ml-2 h-4 w-4" /></Button>
    )},
    { accessorKey: 'forwarderName', header: 'Forwarder' },
    { accessorKey: 'cityName', header: '城市' },
    { accessorKey: 'status', header: '狀態', cell: ({ row }) => (
      <Badge variant={statusBadgeVariant[row.original.status] || 'outline'}>{row.original.status}</Badge>
    )},
    { accessorKey: 'processingType', header: '處理類型', cell: ({ row }) => row.original.processingType === 'AUTO' ? '自動' : '人工' },
    { accessorKey: 'processedByName', header: '處理人' },
    { accessorKey: 'createdAt', header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting()}>建立時間 <ArrowUpDown className="ml-2 h-4 w-4" /></Button>
    ), cell: ({ row }) => format(new Date(row.original.createdAt), 'yyyy-MM-dd HH:mm') },
    { accessorKey: 'aiCost', header: 'AI 成本', cell: ({ row }) => row.original.aiCost ? `$${row.original.aiCost.toFixed(4)}` : '-' }
  ];

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter
  });

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="在結果中搜尋..." value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} className="w-64" />
        </div>
        <div className="text-sm text-muted-foreground">共 {total.toLocaleString()} 筆記錄</div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <TableHead key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map(row => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={columns.length} className="h-24 text-center">沒有結果</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">第 {page} / {totalPages} 頁</div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>上一頁</Button>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>下一頁</Button>
        </div>
      </div>
    </div>
  );
}
```

---

## 8. 測試規格

```typescript
// src/services/__tests__/audit-query.service.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditQueryService } from '../audit-query.service';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma');

describe('AuditQueryService', () => {
  let service: AuditQueryService;
  const mockCityFilter = { isGlobalAdmin: false, cityCodes: ['HKG', 'SZX'] };

  beforeEach(() => {
    service = new AuditQueryService();
    vi.clearAllMocks();
  });

  describe('executeQuery', () => {
    it('should return truncated result when exceeds limit', async () => {
      vi.mocked(prisma.document.count).mockResolvedValue(15000);

      const result = await service.executeQuery(
        { startDate: '2024-01-01', endDate: '2024-12-31' },
        mockCityFilter
      );

      expect(result.isTruncated).toBe(true);
      expect(result.records).toHaveLength(0);
      expect(result.total).toBe(15000);
    });

    it('should apply city filter for non-global admin', async () => {
      vi.mocked(prisma.document.count).mockResolvedValue(100);
      vi.mocked(prisma.document.findMany).mockResolvedValue([]);

      await service.executeQuery(
        { startDate: '2024-01-01', endDate: '2024-12-31' },
        mockCityFilter
      );

      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            cityCode: { in: ['HKG', 'SZX'] }
          })
        })
      );
    });
  });

  describe('getResultCountPreview', () => {
    it('should return exceedsLimit true for large results', async () => {
      vi.mocked(prisma.document.count).mockResolvedValue(20000);

      const preview = await service.getResultCountPreview(
        { startDate: '2024-01-01', endDate: '2024-12-31' },
        mockCityFilter
      );

      expect(preview.exceedsLimit).toBe(true);
    });
  });
});
```

---

## 9. 驗收標準對照

| AC | 描述 | 實現方式 |
|----|------|----------|
| AC1 | 查詢表單 | AuditQueryForm 組件 + 時間範圍/城市/狀態篩選 |
| AC2 | 查詢結果 | AuditResultTable + 分頁 (每頁 50 筆) |
| AC3 | 結果內篩選 | TanStack Table globalFilter + 排序 |
| AC4 | 大量結果處理 | getResultCountPreview + isTruncated 警告 |
| AC5 | 權限控制 | AUDITOR/GLOBAL_ADMIN 角色檢查 + 城市過濾 |

---

## 10. 效能與安全考量

### 效能
- 複合索引: `(cityCode, createdAt)`, `(status, createdAt)`
- 結果限制: 超過 10,000 筆時提示縮小範圍
- 查詢超時: 30 秒

### 安全
- 權限控制: 僅 AUDITOR 和 GLOBAL_ADMIN 可訪問
- 數據隔離: 自動應用城市過濾
- 審計記錄: 記錄所有查詢操作

---

## 11. 相關文件

- [Story 8-1: 用戶操作日誌記錄](./tech-spec-story-8-1.md)
- [Story 8-2: 數據變更追蹤](./tech-spec-story-8-2.md)
- [Story 8-5: 稽核報告匯出](./tech-spec-story-8-5.md)
