# Story 6.4: 全局管理者完整訪問

**Status:** ready-for-dev

---

## Story

**As a** 全局管理者,
**I want** 訪問所有城市的數據,
**So that** 我可以進行全球層級的管理和監控。

---

## Acceptance Criteria

### AC1: 全球數據訪問

**Given** 全局管理者已登入
**When** 查詢業務數據
**Then** 系統返回所有城市的數據
**And** 可以按城市、區域篩選
**And** 不受 RLS 策略限制

### AC2: 全球儀表板

**Given** 全局管理者查看儀表板
**When** 頁面載入
**Then** 顯示全球匯總統計
**And** 可以切換查看單一城市或區域
**And** 顯示城市/區域對比分析

### AC3: 全局配置管理

**Given** 全局管理者進行系統配置
**When** 修改全局設定
**Then** 變更適用於所有城市
**And** 記錄變更審計日誌
**And** 支援配置版本管理

### AC4: 區域層級視圖

**Given** 全局管理者查看數據
**When** 選擇區域視圖
**Then** 按區域匯總顯示數據
**And** 可展開查看區域內各城市
**And** 顯示區域層級 KPI

---

## Tasks / Subtasks

- [ ] **Task 1: 全局管理者角色** (AC: #1)
  - [ ] 1.1 創建 GLOBAL_ADMIN 角色
  - [ ] 1.2 定義超級權限集
  - [ ] 1.3 RLS bypass 配置
  - [ ] 1.4 角色分配流程

- [ ] **Task 2: RLS Bypass 機制** (AC: #1)
  - [ ] 2.1 在 session 設置 is_global_admin
  - [ ] 2.2 修改 RLS 策略支援 bypass
  - [ ] 2.3 確保 bypass 安全性
  - [ ] 2.4 審計 bypass 使用

- [ ] **Task 3: 全球儀表板頁面** (AC: #2)
  - [ ] 3.1 創建 `src/app/(dashboard)/global/page.tsx`
  - [ ] 3.2 全球匯總統計卡片
  - [ ] 3.3 區域/城市選擇器
  - [ ] 3.4 動態數據載入

- [ ] **Task 4: 全球統計 API** (AC: #2)
  - [ ] 4.1 創建 GET `/api/analytics/global`
  - [ ] 4.2 計算全球匯總指標
  - [ ] 4.3 支援區域/城市篩選
  - [ ] 4.4 返回對比分析數據

- [ ] **Task 5: 區域層級視圖** (AC: #4)
  - [ ] 5.1 創建 `RegionView.tsx` 組件
  - [ ] 5.2 區域列表和統計
  - [ ] 5.3 可展開的城市列表
  - [ ] 5.4 區域 KPI 計算

- [ ] **Task 6: 全局配置頁面** (AC: #3)
  - [ ] 6.1 創建 `src/app/(dashboard)/admin/config/page.tsx`
  - [ ] 6.2 系統參數配置界面
  - [ ] 6.3 配置預覽和確認
  - [ ] 6.4 配置生效機制

- [ ] **Task 7: 配置版本管理** (AC: #3)
  - [ ] 7.1 創建 SystemConfig 模型
  - [ ] 7.2 版本歷史記錄
  - [ ] 7.3 配置對比功能
  - [ ] 7.4 配置回滾功能

- [ ] **Task 8: 全局配置 API** (AC: #3)
  - [ ] 8.1 創建 GET/PUT `/api/admin/config`
  - [ ] 8.2 權限驗證（僅全局管理者）
  - [ ] 8.3 配置驗證邏輯
  - [ ] 8.4 審計日誌記錄

- [ ] **Task 9: 全球地圖視圖** (AC: #2)
  - [ ] 9.1 整合地圖組件
  - [ ] 9.2 顯示城市分布
  - [ ] 9.3 城市指標熱力圖
  - [ ] 9.4 點擊城市查看詳情

- [ ] **Task 10: 驗證與測試** (AC: #1-4)
  - [ ] 10.1 測試全球數據訪問
  - [ ] 10.2 測試 RLS bypass
  - [ ] 10.3 測試全局配置
  - [ ] 10.4 測試區域視圖
  - [ ] 10.5 安全性測試

---

## Dev Notes

### 依賴項

- **Story 6.3**: 區域經理跨城市訪問
- **Story 1.2**: 角色權限基礎

### Architecture Compliance

```prisma
// 系統配置模型
model SystemConfig {
  id          String   @id @default(uuid())
  key         String   @unique
  value       Json
  description String?
  category    ConfigCategory
  scope       ConfigScope @default(GLOBAL)
  cityCode    String?  @map("city_code")  // scope=CITY 時使用
  version     Int      @default(1)
  isActive    Boolean  @default(true) @map("is_active")
  updatedBy   String   @map("updated_by")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  city        City?    @relation(fields: [cityCode], references: [code])
  updater     User     @relation(fields: [updatedBy], references: [id])
  history     ConfigHistory[]

  @@index([key])
  @@index([category])
  @@index([scope])
  @@map("system_configs")
}

model ConfigHistory {
  id          String   @id @default(uuid())
  configId    String   @map("config_id")
  version     Int
  value       Json
  changedBy   String   @map("changed_by")
  changeReason String? @map("change_reason")
  createdAt   DateTime @default(now()) @map("created_at")

  config      SystemConfig @relation(fields: [configId], references: [id])
  changer     User         @relation(fields: [changedBy], references: [id])

  @@index([configId])
  @@map("config_history")
}

enum ConfigCategory {
  PROCESSING    // 處理相關
  NOTIFICATION  // 通知相關
  SECURITY      // 安全相關
  DISPLAY       // 顯示相關
  INTEGRATION   // 整合相關
}

enum ConfigScope {
  GLOBAL        // 全局配置
  REGION        // 區域配置
  CITY          // 城市配置
}
```

```typescript
// GET /api/analytics/global
interface GlobalAnalyticsParams {
  period?: '7d' | '30d' | '90d' | '1y'
  groupBy?: 'city' | 'region'
  metrics?: string[]
}

interface GlobalAnalyticsResponse {
  success: true
  data: {
    period: { start: string; end: string }

    // 全球匯總
    global: {
      totalDocuments: number
      totalProcessed: number
      averageSuccessRate: number
      averageConfidence: number
      totalCorrectionRate: number
      totalEscalationRate: number
      activeCities: number
      activeUsers: number
    }

    // 區域分布
    regions: {
      regionCode: string
      regionName: string
      cities: number
      documents: number
      successRate: number
      confidence: number
      trend: 'up' | 'down' | 'stable'
      trendValue: number
    }[]

    // 城市排名
    cityRankings: {
      byVolume: { cityCode: string; cityName: string; value: number }[]
      bySuccessRate: { cityCode: string; cityName: string; value: number }[]
      byEfficiency: { cityCode: string; cityName: string; value: number }[]
    }

    // 趨勢數據
    trend: {
      date: string
      documents: number
      successRate: number
    }[]

    // 城市熱力圖數據
    heatmap: {
      cityCode: string
      latitude: number
      longitude: number
      intensity: number
      metrics: {
        documents: number
        successRate: number
      }
    }[]
  }
}
```

```typescript
// src/app/(dashboard)/global/page.tsx
import { Suspense } from 'react'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { hasPermission, PERMISSIONS } from '@/lib/permissions'
import { GlobalStats } from '@/components/global/GlobalStats'
import { RegionView } from '@/components/global/RegionView'
import { CityRankings } from '@/components/global/CityRankings'
import { GlobalMap } from '@/components/global/GlobalMap'
import { GlobalTrend } from '@/components/global/GlobalTrend'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'

export default async function GlobalDashboardPage() {
  const session = await auth()

  // 僅全局管理者可訪問
  if (!session?.user?.isGlobalAdmin) {
    redirect('/unauthorized')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">全球總覽</h1>
        <p className="text-muted-foreground">
          監控所有區域和城市的運營狀況
        </p>
      </div>

      {/* 全球統計卡片 */}
      <Suspense fallback={<Skeleton className="h-32" />}>
        <GlobalStats />
      </Suspense>

      <Tabs defaultValue="regions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="regions">區域視圖</TabsTrigger>
          <TabsTrigger value="map">地圖視圖</TabsTrigger>
          <TabsTrigger value="rankings">城市排名</TabsTrigger>
          <TabsTrigger value="trend">趨勢分析</TabsTrigger>
        </TabsList>

        <TabsContent value="regions">
          <Suspense fallback={<Skeleton className="h-[500px]" />}>
            <RegionView />
          </Suspense>
        </TabsContent>

        <TabsContent value="map">
          <Suspense fallback={<Skeleton className="h-[500px]" />}>
            <GlobalMap />
          </Suspense>
        </TabsContent>

        <TabsContent value="rankings">
          <Suspense fallback={<Skeleton className="h-[400px]" />}>
            <CityRankings />
          </Suspense>
        </TabsContent>

        <TabsContent value="trend">
          <Suspense fallback={<Skeleton className="h-[400px]" />}>
            <GlobalTrend />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

```typescript
// src/components/global/RegionView.tsx
'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react'

export function RegionView() {
  const { data, isLoading } = useQuery({
    queryKey: ['global-analytics'],
    queryFn: () => fetchGlobalAnalytics(),
  })

  const [expandedRegions, setExpandedRegions] = useState<string[]>([])

  const toggleRegion = (regionCode: string) => {
    setExpandedRegions(prev =>
      prev.includes(regionCode)
        ? prev.filter(r => r !== regionCode)
        : [...prev, regionCode]
    )
  }

  if (isLoading) return <RegionViewSkeleton />

  return (
    <div className="space-y-4">
      {data?.regions.map((region) => (
        <Card key={region.regionCode}>
          <Collapsible
            open={expandedRegions.includes(region.regionCode)}
            onOpenChange={() => toggleRegion(region.regionCode)}
          >
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {expandedRegions.includes(region.regionCode) ? (
                      <ChevronDown className="h-5 w-5" />
                    ) : (
                      <ChevronRight className="h-5 w-5" />
                    )}
                    <div>
                      <CardTitle className="text-lg">{region.regionName}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {region.cities} 個城市
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">處理量</p>
                      <p className="text-lg font-semibold">
                        {region.documents.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">成功率</p>
                      <p className="text-lg font-semibold">
                        {(region.successRate * 100).toFixed(1)}%
                      </p>
                    </div>
                    <TrendBadge trend={region.trend} value={region.trendValue} />
                  </div>
                </div>
              </CardHeader>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <CardContent>
                <RegionCitiesTable regionCode={region.regionCode} />
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      ))}
    </div>
  )
}

function TrendBadge({ trend, value }: { trend: string; value: number }) {
  const Icon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  const color = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-600'

  return (
    <Badge variant="outline" className={`gap-1 ${color}`}>
      <Icon className="h-3 w-3" />
      {value > 0 ? '+' : ''}{value.toFixed(1)}%
    </Badge>
  )
}

function RegionCitiesTable({ regionCode }: { regionCode: string }) {
  const { data } = useQuery({
    queryKey: ['region-cities', regionCode],
    queryFn: () => fetchRegionCities(regionCode),
  })

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>城市</TableHead>
          <TableHead className="text-right">處理量</TableHead>
          <TableHead className="text-right">成功率</TableHead>
          <TableHead className="text-right">平均信心度</TableHead>
          <TableHead className="text-right">修正率</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data?.cities.map((city) => (
          <TableRow key={city.code}>
            <TableCell className="font-medium">{city.name}</TableCell>
            <TableCell className="text-right">{city.documents.toLocaleString()}</TableCell>
            <TableCell className="text-right">{(city.successRate * 100).toFixed(1)}%</TableCell>
            <TableCell className="text-right">{(city.confidence * 100).toFixed(1)}%</TableCell>
            <TableCell className="text-right">{(city.correctionRate * 100).toFixed(1)}%</TableCell>
            <TableCell>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/global/cities/${city.code}`}>詳情</Link>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

```typescript
// src/app/(dashboard)/admin/config/page.tsx
'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Save, History, RotateCcw } from 'lucide-react'

const CONFIG_CATEGORIES = [
  { value: 'PROCESSING', label: '處理設定' },
  { value: 'NOTIFICATION', label: '通知設定' },
  { value: 'SECURITY', label: '安全設定' },
  { value: 'DISPLAY', label: '顯示設定' },
  { value: 'INTEGRATION', label: '整合設定' },
]

export default function SystemConfigPage() {
  const [selectedCategory, setSelectedCategory] = useState('PROCESSING')
  const [editingConfig, setEditingConfig] = useState<SystemConfig | null>(null)
  const [showHistory, setShowHistory] = useState<string | null>(null)

  const queryClient = useQueryClient()

  const { data: configs, isLoading } = useQuery({
    queryKey: ['system-configs', selectedCategory],
    queryFn: () => fetchSystemConfigs(selectedCategory),
  })

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; value: any; reason?: string }) =>
      updateSystemConfig(data.id, data.value, data.reason),
    onSuccess: () => {
      toast.success('配置已更新')
      queryClient.invalidateQueries({ queryKey: ['system-configs'] })
      setEditingConfig(null)
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">系統配置</h1>
          <p className="text-muted-foreground">
            管理全局系統參數（變更將影響所有城市）
          </p>
        </div>
      </div>

      <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
        <TabsList>
          {CONFIG_CATEGORIES.map((cat) => (
            <TabsTrigger key={cat.value} value={cat.value}>
              {cat.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={selectedCategory} className="mt-4">
          <div className="space-y-4">
            {configs?.map((config) => (
              <Card key={config.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{config.key}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {config.description}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowHistory(config.id)}
                      >
                        <History className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingConfig(config)}
                      >
                        編輯
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ConfigValueDisplay value={config.value} />
                  <p className="text-xs text-muted-foreground mt-2">
                    版本 {config.version} | 最後更新: {formatDate(config.updatedAt)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* 編輯對話框 */}
      <Dialog open={!!editingConfig} onOpenChange={() => setEditingConfig(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>編輯配置: {editingConfig?.key}</DialogTitle>
          </DialogHeader>
          {editingConfig && (
            <ConfigEditForm
              config={editingConfig}
              onSubmit={(value, reason) =>
                updateMutation.mutate({ id: editingConfig.id, value, reason })
              }
              isSubmitting={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* 歷史記錄對話框 */}
      <Dialog open={!!showHistory} onOpenChange={() => setShowHistory(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>配置歷史記錄</DialogTitle>
          </DialogHeader>
          {showHistory && <ConfigHistoryList configId={showHistory} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

### 安全考量

- **最小權限原則**: 全局管理者角色嚴格限制分配
- **審計追蹤**: 所有全局操作都記錄審計日誌
- **配置驗證**: 全局配置變更需要二次確認
- **回滾機制**: 支援配置版本回滾

### References

- [Source: docs/03-epics/sections/epic-6-multi-city-data-isolation.md#story-64]
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR46]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 6.4 |
| Story Key | 6-4-global-admin-full-access |
| Epic | Epic 6: 多城市數據隔離 |
| FR Coverage | FR46 |
| Dependencies | Story 6.3, Story 1.2 |

---

*Story created: 2025-12-16*
*Status: ready-for-dev*
