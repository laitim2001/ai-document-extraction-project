# Story 8.3: 處理記錄查詢

**Status:** done

**Completed:** 2025-12-20

---

## Story

**As a** 審計人員,
**I want** 查詢指定期間的處理記錄,
**So that** 我可以進行審計和合規檢查。

---

## Acceptance Criteria

### AC1: 查詢表單

**Given** 審計人員已登入
**When** 導航至「審計查詢」頁面
**Then** 顯示查詢表單，包含：
- 時間範圍（必填）
- 城市（可選）
- Forwarder（可選）
- 處理狀態（可選）
- 操作人（可選）

### AC2: 查詢結果

**Given** 執行查詢
**When** 提交查詢條件
**Then** 返回符合條件的處理記錄列表
**And** 支援分頁（每頁 50 筆）
**And** 顯示總筆數

### AC3: 結果內篩選

**Given** 查詢結果
**When** 需要進一步篩選
**Then** 支援在結果內搜尋
**And** 支援按欄位排序

### AC4: 大量結果處理

**Given** 大量查詢結果
**When** 結果超過 10,000 筆
**Then** 系統提示縮小查詢範圍
**And** 或使用匯出功能

### AC5: 權限控制

**Given** 不同角色用戶
**When** 訪問審計查詢頁面
**Then** 僅 AUDITOR 和 GLOBAL_ADMIN 可以訪問
**And** 數據根據城市權限過濾

---

## Tasks / Subtasks

- [x] **Task 1: 審計查詢 API** (AC: #1, #2, #4)
  - [x] 1.1 創建 `POST /api/audit/query` 端點
  - [x] 1.2 實現多條件查詢邏輯
  - [x] 1.3 支援分頁參數
  - [x] 1.4 實現結果計數和限制

- [x] **Task 2: 查詢優化** (AC: #2, #4)
  - [x] 2.1 設計查詢索引
  - [x] 2.2 實現查詢計劃優化
  - [x] 2.3 添加查詢超時處理
  - [x] 2.4 實現結果快取

- [x] **Task 3: 審計查詢頁面** (AC: #1, #5)
  - [x] 3.1 創建 `/audit/query` 頁面路由
  - [x] 3.2 實現權限檢查
  - [x] 3.3 創建查詢表單組件
  - [x] 3.4 整合城市和 Forwarder 選擇器

- [x] **Task 4: 查詢結果表格** (AC: #2, #3)
  - [x] 4.1 創建 `AuditResultTable` 組件
  - [x] 4.2 實現分頁控制
  - [x] 4.3 實現欄位排序
  - [x] 4.4 實現結果內搜尋

- [x] **Task 5: 大量結果處理** (AC: #4)
  - [x] 5.1 實現結果計數預檢
  - [x] 5.2 創建警告對話框
  - [x] 5.3 提供匯出替代選項
  - [x] 5.4 實現漸進式載入

- [x] **Task 6: 權限整合** (AC: #5)
  - [x] 6.1 定義 AUDITOR 角色權限
  - [x] 6.2 實現城市數據過濾
  - [x] 6.3 添加頁面訪問控制
  - [x] 6.4 記錄查詢操作日誌

- [x] **Task 7: 測試** (AC: #1-5)
  - [x] 7.1 測試查詢功能
  - [x] 7.2 測試分頁和排序
  - [x] 7.3 測試大量數據處理
  - [x] 7.4 測試權限控制

---

## Dev Notes

### 依賴項

- **Story 8.1**: 用戶操作日誌記錄（數據來源）
- **Story 6.2**: 城市用戶數據訪問控制

### Architecture Compliance

```typescript
// src/types/audit-query.ts
export interface AuditQueryParams {
  // 必填
  startDate: string
  endDate: string

  // 可選篩選
  cityCodes?: string[]
  forwarderIds?: string[]
  statuses?: string[]
  operatorIds?: string[]
  resourceTypes?: string[]
  actions?: string[]

  // 搜尋
  searchTerm?: string

  // 分頁
  page?: number
  pageSize?: number

  // 排序
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface AuditQueryResult {
  records: ProcessingRecord[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  queryTime: number  // 毫秒
  isTruncated: boolean  // 是否因超過限制而截斷
}

export interface ProcessingRecord {
  id: string
  documentId: string
  invoiceNumber?: string
  forwarderCode: string
  forwarderName: string
  cityCode: string
  cityName: string
  status: string
  processingType: 'AUTO' | 'MANUAL'
  processedBy?: string
  processedByName?: string
  processedAt?: string
  createdAt: string
  aiCost?: number
  reviewDuration?: number  // 秒
  corrections?: number  // 修正次數
  escalated: boolean
}

export const MAX_QUERY_RESULTS = 10000
export const DEFAULT_PAGE_SIZE = 50
```

```typescript
// src/services/audit-query.service.ts
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { CityFilter } from '@/middleware/city-filter'
import {
  AuditQueryParams,
  AuditQueryResult,
  ProcessingRecord,
  MAX_QUERY_RESULTS,
  DEFAULT_PAGE_SIZE
} from '@/types/audit-query'

export class AuditQueryService {
  private readonly QUERY_TIMEOUT = 30000 // 30 秒
  private readonly CACHE_TTL = 60 * 5 // 5 分鐘

  async executeQuery(
    params: AuditQueryParams,
    cityFilter: CityFilter
  ): Promise<AuditQueryResult> {
    const startTime = Date.now()

    // 構建查詢條件
    const where = this.buildWhereClause(params, cityFilter)

    // 先計算總數
    const total = await this.getResultCount(where)

    // 檢查是否超過限制
    if (total > MAX_QUERY_RESULTS) {
      return {
        records: [],
        total,
        page: 1,
        pageSize: params.pageSize || DEFAULT_PAGE_SIZE,
        totalPages: Math.ceil(total / (params.pageSize || DEFAULT_PAGE_SIZE)),
        queryTime: Date.now() - startTime,
        isTruncated: true
      }
    }

    // 分頁參數
    const page = params.page || 1
    const pageSize = params.pageSize || DEFAULT_PAGE_SIZE
    const skip = (page - 1) * pageSize

    // 排序
    const orderBy = this.buildOrderBy(params.sortBy, params.sortOrder)

    // 執行查詢
    const documents = await prisma.document.findMany({
      where,
      orderBy,
      skip,
      take: pageSize,
      include: {
        forwarder: {
          select: { code: true, name: true }
        },
        city: {
          select: { code: true, name: true }
        },
        processedByUser: {
          select: { id: true, name: true }
        },
        corrections: {
          select: { id: true }
        },
        apiUsageLogs: {
          select: { estimatedCost: true }
        }
      }
    })

    // 轉換結果
    const records = documents.map(doc => this.toProcessingRecord(doc))

    return {
      records,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      queryTime: Date.now() - startTime,
      isTruncated: false
    }
  }

  async getResultCountPreview(
    params: AuditQueryParams,
    cityFilter: CityFilter
  ): Promise<{ count: number; exceedsLimit: boolean }> {
    const where = this.buildWhereClause(params, cityFilter)
    const count = await this.getResultCount(where)

    return {
      count,
      exceedsLimit: count > MAX_QUERY_RESULTS
    }
  }

  private async getResultCount(where: any): Promise<number> {
    return prisma.document.count({ where })
  }

  private buildWhereClause(
    params: AuditQueryParams,
    cityFilter: CityFilter
  ): any {
    const where: any = {
      // 時間範圍（必填）
      createdAt: {
        gte: new Date(params.startDate),
        lte: new Date(params.endDate)
      }
    }

    // 城市過濾（權限 + 用戶選擇）
    if (!cityFilter.isGlobalAdmin) {
      where.cityCode = { in: cityFilter.cityCodes }
    }

    if (params.cityCodes?.length) {
      // 進一步篩選用戶選擇的城市
      if (cityFilter.isGlobalAdmin) {
        where.cityCode = { in: params.cityCodes }
      } else {
        // 取交集
        const allowedCities = params.cityCodes.filter(c =>
          cityFilter.cityCodes.includes(c)
        )
        where.cityCode = { in: allowedCities }
      }
    }

    // Forwarder 篩選
    if (params.forwarderIds?.length) {
      where.forwarderId = { in: params.forwarderIds }
    }

    // 狀態篩選
    if (params.statuses?.length) {
      where.status = { in: params.statuses }
    }

    // 操作人篩選
    if (params.operatorIds?.length) {
      where.processedBy = { in: params.operatorIds }
    }

    // 全文搜尋
    if (params.searchTerm) {
      where.OR = [
        { invoiceNumber: { contains: params.searchTerm, mode: 'insensitive' } },
        { id: { contains: params.searchTerm, mode: 'insensitive' } },
        { forwarder: { code: { contains: params.searchTerm, mode: 'insensitive' } } },
        { forwarder: { name: { contains: params.searchTerm, mode: 'insensitive' } } }
      ]
    }

    return where
  }

  private buildOrderBy(
    sortBy?: string,
    sortOrder?: 'asc' | 'desc'
  ): any {
    const order = sortOrder || 'desc'

    switch (sortBy) {
      case 'invoiceNumber':
        return { invoiceNumber: order }
      case 'forwarder':
        return { forwarder: { code: order } }
      case 'city':
        return { cityCode: order }
      case 'status':
        return { status: order }
      case 'processedAt':
        return { processedAt: order }
      case 'createdAt':
      default:
        return { createdAt: order }
    }
  }

  private toProcessingRecord(doc: any): ProcessingRecord {
    const totalAiCost = doc.apiUsageLogs?.reduce(
      (sum: number, log: any) => sum + (log.estimatedCost || 0),
      0
    ) || 0

    const reviewDuration = doc.reviewedAt && doc.processedAt
      ? Math.round(
          (new Date(doc.reviewedAt).getTime() - new Date(doc.processedAt).getTime()) / 1000
        )
      : undefined

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
    }
  }
}

export const auditQueryService = new AuditQueryService()
```

```typescript
// src/app/api/audit/query/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { withCityFilter } from '@/middleware/city-filter'
import { withAuditLog } from '@/middleware/audit-log.middleware'
import { auditQueryService } from '@/services/audit-query.service'
import { AuditQueryParams } from '@/types/audit-query'

async function queryHandler(request: NextRequest) {
  return withCityFilter(request, async (req, cityFilter) => {
    try {
      const session = await auth()

      // 權限檢查
      const hasAuditAccess = session?.user?.roles?.some(r =>
        ['AUDITOR', 'GLOBAL_ADMIN'].includes(r.name)
      )

      if (!hasAuditAccess) {
        return NextResponse.json(
          { success: false, error: 'Audit access required' },
          { status: 403 }
        )
      }

      const params: AuditQueryParams = await req.json()

      // 驗證必填欄位
      if (!params.startDate || !params.endDate) {
        return NextResponse.json(
          { success: false, error: 'startDate and endDate are required' },
          { status: 400 }
        )
      }

      const result = await auditQueryService.executeQuery(params, cityFilter)

      return NextResponse.json({
        success: true,
        data: result
      })
    } catch (error) {
      console.error('Audit query error:', error)
      return NextResponse.json(
        { success: false, error: 'Query failed' },
        { status: 500 }
      )
    }
  })
}

export const POST = withAuditLog(
  {
    action: 'READ',
    resourceType: 'auditQuery',
    getDescription: () => 'Executed audit query'
  },
  queryHandler
)
```

```typescript
// src/components/audit/AuditQueryForm.tsx
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { CalendarIcon, Search, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import { AuditQueryParams, MAX_QUERY_RESULTS } from '@/types/audit-query'

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
})

interface AuditQueryFormProps {
  onQuery: (params: AuditQueryParams) => void
  onPreviewCount: (params: AuditQueryParams) => Promise<{ count: number; exceedsLimit: boolean }>
  loading?: boolean
}

export function AuditQueryForm({
  onQuery,
  onPreviewCount,
  loading = false
}: AuditQueryFormProps) {
  const [countPreview, setCountPreview] = useState<{
    count: number
    exceedsLimit: boolean
  } | null>(null)

  const form = useForm<z.infer<typeof queryFormSchema>>({
    resolver: zodResolver(queryFormSchema),
    defaultValues: {
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 預設過去 7 天
      endDate: new Date()
    }
  })

  const handleSubmit = async (values: z.infer<typeof queryFormSchema>) => {
    const params: AuditQueryParams = {
      startDate: values.startDate.toISOString(),
      endDate: values.endDate.toISOString(),
      cityCodes: values.cityCodes,
      forwarderIds: values.forwarderIds,
      statuses: values.statuses,
      operatorIds: values.operatorIds
    }

    // 先預覽數量
    const preview = await onPreviewCount(params)
    setCountPreview(preview)

    if (!preview.exceedsLimit) {
      onQuery(params)
    }
  }

  const handleForceQuery = () => {
    const values = form.getValues()
    const params: AuditQueryParams = {
      startDate: values.startDate.toISOString(),
      endDate: values.endDate.toISOString(),
      cityCodes: values.cityCodes,
      forwarderIds: values.forwarderIds,
      statuses: values.statuses,
      operatorIds: values.operatorIds
    }
    onQuery(params)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 開始日期 */}
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>開始日期 *</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full pl-3 text-left font-normal',
                          !field.value && 'text-muted-foreground'
                        )}
                      >
                        {field.value ? (
                          format(field.value, 'yyyy-MM-dd')
                        ) : (
                          <span>選擇日期</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) => date > new Date()}
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* 結束日期 */}
          <FormField
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>結束日期 *</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full pl-3 text-left font-normal',
                          !field.value && 'text-muted-foreground'
                        )}
                      >
                        {field.value ? (
                          format(field.value, 'yyyy-MM-dd')
                        ) : (
                          <span>選擇日期</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) => date > new Date()}
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* 狀態篩選 */}
          <FormField
            control={form.control}
            name="statuses"
            render={({ field }) => (
              <FormItem>
                <FormLabel>處理狀態</FormLabel>
                <Select
                  onValueChange={(value) => field.onChange(value ? [value] : [])}
                  value={field.value?.[0] || ''}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="全部狀態" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="">全部狀態</SelectItem>
                    <SelectItem value="PENDING">待處理</SelectItem>
                    <SelectItem value="PROCESSING">處理中</SelectItem>
                    <SelectItem value="PENDING_REVIEW">待審核</SelectItem>
                    <SelectItem value="APPROVED">已核准</SelectItem>
                    <SelectItem value="COMPLETED">已完成</SelectItem>
                    <SelectItem value="FAILED">失敗</SelectItem>
                    <SelectItem value="ESCALATED">已升級</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />

          {/* 查詢按鈕 */}
          <div className="flex items-end">
            <Button type="submit" disabled={loading} className="w-full">
              <Search className="mr-2 h-4 w-4" />
              查詢
            </Button>
          </div>
        </div>

        {/* 超過限制警告 */}
        {countPreview?.exceedsLimit && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>結果過多</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <span>
                查詢結果共 {countPreview.count.toLocaleString()} 筆，
                超過顯示上限 {MAX_QUERY_RESULTS.toLocaleString()} 筆。
                請縮小查詢範圍或使用匯出功能。
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleForceQuery}
              >
                仍要查詢（僅顯示部分）
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </form>
    </Form>
  )
}
```

### 效能考量

- **查詢優化**: 使用複合索引支援多條件查詢
- **結果限制**: 超過 10,000 筆時提示用戶
- **分頁載入**: 使用游標分頁避免深度分頁問題
- **查詢超時**: 設置 30 秒查詢超時

### 安全考量

- **權限控制**: 僅 AUDITOR 和 GLOBAL_ADMIN 可訪問
- **數據隔離**: 自動應用城市過濾
- **審計記錄**: 記錄所有查詢操作

### References

- [Source: docs/03-epics/sections/epic-8-audit-trail-compliance.md#story-83]
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR50]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 8.3 |
| Story Key | 8-3-processing-record-query |
| Epic | Epic 8: 審計追溯與合規 |
| FR Coverage | FR50 |
| Dependencies | Story 8.1, Story 6.2 |

---

*Story created: 2025-12-16*
*Completed: 2025-12-20*

---

## Implementation Notes

### Files Created/Modified

**Types:**
- `src/types/audit-query.ts` - AuditQueryParams, AuditQueryResult, ProcessingRecord, CountPreview types with Zod schemas

**Services:**
- `src/services/audit-query.service.ts` - AuditQueryService with executeQuery and getResultCountPreview methods

**API Routes:**
- `src/app/api/audit/query/route.ts` - POST endpoint for audit queries with city filtering
- `src/app/api/audit/query/count/route.ts` - POST endpoint for result count preview

**Components:**
- `src/components/audit/AuditQueryForm.tsx` - Query form with date range, status filters, count preview
- `src/components/audit/AuditResultTable.tsx` - TanStack Table with pagination, sorting, search
- `src/components/audit/index.ts` - Component exports

**Hooks:**
- `src/hooks/useAuditQuery.ts` - useAuditQuery and useAuditQueryCount React Query hooks

**Pages:**
- `src/app/(dashboard)/audit/query/page.tsx` - Server component with permission check
- `src/app/(dashboard)/audit/query/client.tsx` - Client wrapper component

### Key Features
- Multi-condition filtering (date range required, city/forwarder/status/operator optional)
- Result pagination (50 per page)
- In-result search and column sorting
- Large result handling (>10,000 records shows warning)
- City-based data filtering via withCityFilter middleware
- Role permission control (AUDITOR and GLOBAL_ADMIN only)

### Dependencies Added
- `@tanstack/react-table` - For sortable, filterable result tables
