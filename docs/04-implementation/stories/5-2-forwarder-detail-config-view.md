# Story 5.2: Forwarder 詳細配置查看

**Status:** ready-for-dev

---

## Story

**As a** Super User,
**I want** 查看單個 Forwarder 的詳細配置,
**So that** 我可以了解該 Forwarder 的所有設定。

---

## Acceptance Criteria

### AC1: 基本資訊顯示

**Given** 在 Forwarder 列表頁面
**When** 點擊某個 Forwarder
**Then** 顯示詳細配置頁面
**And** 包含基本資訊：名稱、代碼、描述、狀態、Logo、聯絡資訊

### AC2: 關聯規則顯示

**Given** Forwarder 詳情頁面
**When** 查看「映射規則」區塊
**Then** 顯示該 Forwarder 關聯的所有映射規則
**And** 可按欄位名稱、狀態篩選
**And** 顯示每條規則的基本資訊和應用統計

### AC3: 處理統計顯示

**Given** Forwarder 詳情頁面
**When** 查看「處理統計」區塊
**Then** 顯示該 Forwarder 的處理統計
**And** 包含：總處理數、成功率、平均信心度、最近 30 天趨勢

### AC4: 最近發票範例

**Given** Forwarder 詳情頁面
**When** 查看「最近發票」區塊
**Then** 顯示最近處理的發票範例（最多 10 筆）
**And** 可點擊查看詳情

---

## Tasks / Subtasks

- [ ] **Task 1: Forwarder 詳情頁面** (AC: #1)
  - [ ] 1.1 創建 `src/app/(dashboard)/forwarders/[id]/page.tsx`
  - [ ] 1.2 設計頁面佈局（標籤頁或區塊）
  - [ ] 1.3 實現麵包屑導航
  - [ ] 1.4 加入編輯和操作按鈕

- [ ] **Task 2: 基本資訊區塊** (AC: #1)
  - [ ] 2.1 創建 `ForwarderInfo.tsx` 組件
  - [ ] 2.2 顯示 Logo（支援預設圖片）
  - [ ] 2.3 顯示名稱和代碼
  - [ ] 2.4 顯示描述（支援 Markdown）
  - [ ] 2.5 顯示狀態 Badge
  - [ ] 2.6 顯示聯絡資訊
  - [ ] 2.7 顯示創建和更新時間

- [ ] **Task 3: 關聯規則區塊** (AC: #2)
  - [ ] 3.1 創建 `ForwarderRules.tsx` 組件
  - [ ] 3.2 顯示規則表格
  - [ ] 3.3 欄位名稱篩選
  - [ ] 3.4 狀態篩選（ACTIVE/DRAFT/DEPRECATED）
  - [ ] 3.5 顯示規則應用統計
  - [ ] 3.6 快速操作（查看、編輯、停用）

- [ ] **Task 4: 處理統計區塊** (AC: #3)
  - [ ] 4.1 創建 `ForwarderStats.tsx` 組件
  - [ ] 4.2 顯示總處理數量
  - [ ] 4.3 顯示成功率（圓環圖）
  - [ ] 4.4 顯示平均信心度
  - [ ] 4.5 顯示 30 天趨勢圖（折線圖）
  - [ ] 4.6 顯示欄位級別統計

- [ ] **Task 5: 最近發票區塊** (AC: #4)
  - [ ] 5.1 創建 `RecentDocuments.tsx` 組件
  - [ ] 5.2 顯示發票列表（縮圖、檔名、時間）
  - [ ] 5.3 顯示處理狀態
  - [ ] 5.4 點擊跳轉詳情頁
  - [ ] 5.5 查看更多連結

- [ ] **Task 6: Forwarder 詳情 API** (AC: #1-4)
  - [ ] 6.1 創建 GET `/api/forwarders/[id]`
  - [ ] 6.2 返回基本資訊
  - [ ] 6.3 關聯查詢規則列表
  - [ ] 6.4 計算處理統計
  - [ ] 6.5 查詢最近發票

- [ ] **Task 7: 統計數據 API** (AC: #3)
  - [ ] 7.1 創建 GET `/api/forwarders/[id]/stats`
  - [ ] 7.2 計算處理統計
  - [ ] 7.3 計算趨勢數據
  - [ ] 7.4 支援時間範圍參數

- [ ] **Task 8: 數據視覺化** (AC: #3)
  - [ ] 8.1 整合 Recharts 圖表庫
  - [ ] 8.2 實現成功率圓環圖
  - [ ] 8.3 實現趨勢折線圖
  - [ ] 8.4 實現響應式圖表

- [ ] **Task 9: 驗證與測試** (AC: #1-4)
  - [ ] 9.1 測試基本資訊顯示
  - [ ] 9.2 測試規則列表
  - [ ] 9.3 測試統計圖表
  - [ ] 9.4 測試發票連結
  - [ ] 9.5 測試權限控制

---

## Dev Notes

### 依賴項

- **Story 5.1**: Forwarder 列表頁面

### Architecture Compliance

```typescript
// GET /api/forwarders/[id]
interface ForwarderDetailResponse {
  success: true
  data: {
    // 基本資訊
    id: string
    name: string
    code: string
    description: string | null
    status: ForwarderStatus
    logoUrl: string | null
    contactEmail: string | null
    defaultConfidence: number
    createdAt: string
    updatedAt: string
    createdBy: {
      id: string
      name: string
    }

    // 關聯規則摘要
    rules: {
      total: number
      active: number
      draft: number
      deprecated: number
      items: {
        id: string
        fieldName: string
        extractionType: ExtractionType
        status: RuleStatus
        version: number
        successRate: number
        applicationCount: number
        updatedAt: string
      }[]
    }

    // 處理統計摘要
    stats: {
      totalProcessed: number
      last30Days: number
      successRate: number
      averageConfidence: number
    }

    // 最近發票
    recentDocuments: {
      id: string
      fileName: string
      status: DocumentStatus
      confidence: number
      createdAt: string
      thumbnailUrl: string | null
    }[]
  }
}

// GET /api/forwarders/[id]/stats
interface ForwarderStatsParams {
  period?: '7d' | '30d' | '90d' | '1y'  // 默認 30d
}

interface ForwarderStatsResponse {
  success: true
  data: {
    overview: {
      totalProcessed: number
      successfulExtractions: number
      failedExtractions: number
      successRate: number
      averageConfidence: number
      averageProcessingTime: number  // 毫秒
    }
    trend: {
      date: string
      processed: number
      successful: number
      averageConfidence: number
    }[]
    fieldStats: {
      fieldName: string
      totalExtractions: number
      successRate: number
      averageConfidence: number
      correctionRate: number
    }[]
    confidenceDistribution: {
      range: string  // e.g., "90-100%", "80-90%"
      count: number
      percentage: number
    }[]
  }
}
```

```typescript
// src/app/(dashboard)/forwarders/[id]/page.tsx
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { hasPermission, PERMISSIONS } from '@/lib/permissions'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ForwarderInfo } from '@/components/forwarders/ForwarderInfo'
import { ForwarderRules } from '@/components/forwarders/ForwarderRules'
import { ForwarderStats } from '@/components/forwarders/ForwarderStats'
import { RecentDocuments } from '@/components/forwarders/RecentDocuments'
import { ForwarderActions } from '@/components/forwarders/ForwarderActions'
import { Skeleton } from '@/components/ui/skeleton'

interface Props {
  params: { id: string }
}

export default async function ForwarderDetailPage({ params }: Props) {
  const session = await auth()

  if (!hasPermission(session, PERMISSIONS.FORWARDER_VIEW)) {
    redirect('/unauthorized')
  }

  const forwarder = await getForwarder(params.id)

  if (!forwarder) {
    notFound()
  }

  const canEdit = hasPermission(session, PERMISSIONS.FORWARDER_MANAGE)

  return (
    <div className="space-y-6">
      {/* 頁面標題和操作 */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          {forwarder.logoUrl && (
            <img
              src={forwarder.logoUrl}
              alt={forwarder.name}
              className="h-16 w-16 rounded-lg object-contain"
            />
          )}
          <div>
            <h1 className="text-2xl font-bold">{forwarder.name}</h1>
            <p className="text-muted-foreground">
              <code className="rounded bg-muted px-2 py-1 text-sm">
                {forwarder.code}
              </code>
            </p>
          </div>
        </div>
        {canEdit && <ForwarderActions forwarder={forwarder} />}
      </div>

      {/* 標籤頁內容 */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">總覽</TabsTrigger>
          <TabsTrigger value="rules">映射規則</TabsTrigger>
          <TabsTrigger value="stats">處理統計</TabsTrigger>
          <TabsTrigger value="documents">最近發票</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <ForwarderInfo forwarder={forwarder} />
          <div className="grid grid-cols-2 gap-6">
            <Suspense fallback={<Skeleton className="h-[300px]" />}>
              <ForwarderStats forwarderId={params.id} compact />
            </Suspense>
            <Suspense fallback={<Skeleton className="h-[300px]" />}>
              <RecentDocuments forwarderId={params.id} limit={5} />
            </Suspense>
          </div>
        </TabsContent>

        <TabsContent value="rules">
          <Suspense fallback={<Skeleton className="h-[400px]" />}>
            <ForwarderRules forwarderId={params.id} />
          </Suspense>
        </TabsContent>

        <TabsContent value="stats">
          <Suspense fallback={<Skeleton className="h-[500px]" />}>
            <ForwarderStats forwarderId={params.id} />
          </Suspense>
        </TabsContent>

        <TabsContent value="documents">
          <Suspense fallback={<Skeleton className="h-[400px]" />}>
            <RecentDocuments forwarderId={params.id} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

```typescript
// src/components/forwarders/ForwarderStats.tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

interface Props {
  forwarderId: string
  compact?: boolean
}

export function ForwarderStats({ forwarderId, compact = false }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['forwarder-stats', forwarderId],
    queryFn: () => fetchForwarderStats(forwarderId),
  })

  if (isLoading) return <StatsSkeleton />

  const { overview, trend, fieldStats, confidenceDistribution } = data

  return (
    <div className="space-y-6">
      {/* 概覽卡片 */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          title="總處理數"
          value={overview.totalProcessed.toLocaleString()}
          description="全部時間"
        />
        <StatCard
          title="成功率"
          value={`${(overview.successRate * 100).toFixed(1)}%`}
          description="提取成功比例"
          trend={overview.successRate > 0.9 ? 'up' : 'down'}
        />
        <StatCard
          title="平均信心度"
          value={`${(overview.averageConfidence * 100).toFixed(1)}%`}
          description="AI 提取信心度"
        />
        <StatCard
          title="平均處理時間"
          value={`${(overview.averageProcessingTime / 1000).toFixed(1)}s`}
          description="每份文件"
        />
      </div>

      {!compact && (
        <>
          {/* 趨勢圖 */}
          <Card>
            <CardHeader>
              <CardTitle>處理趨勢（最近 30 天）</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="processed"
                    stroke="#8884d8"
                    name="處理數量"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="averageConfidence"
                    stroke="#82ca9d"
                    name="平均信心度"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* 欄位統計 */}
          <Card>
            <CardHeader>
              <CardTitle>欄位提取統計</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldStatsTable data={fieldStats} />
            </CardContent>
          </Card>

          {/* 信心度分布 */}
          <Card>
            <CardHeader>
              <CardTitle>信心度分布</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={confidenceDistribution}
                    dataKey="count"
                    nameKey="range"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label
                  >
                    {confidenceDistribution.map((entry, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

const COLORS = ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444']
```

### References

- [Source: docs/03-epics/sections/epic-5-forwarder-config-management.md#story-52]
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR26]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 5.2 |
| Story Key | 5-2-forwarder-detail-config-view |
| Epic | Epic 5: Forwarder 配置管理 |
| FR Coverage | FR26 |
| Dependencies | Story 5.1 |

---

*Story created: 2025-12-16*
*Status: ready-for-dev*
