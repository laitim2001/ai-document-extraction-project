# Story 6.3: 區域經理跨城市訪問

**Status:** ready-for-dev

---

## Story

**As a** 區域經理,
**I want** 訪問我管轄的多個城市的數據,
**So that** 我可以進行跨城市的管理和分析。

---

## Acceptance Criteria

### AC1: 多城市數據訪問

**Given** 區域經理已登入
**When** 查詢業務數據
**Then** 系統返回該經理被授權的所有城市數據
**And** 可以按城市篩選查看

### AC2: 城市篩選功能

**Given** 區域經理查看列表頁面
**When** 頁面載入
**Then** 顯示城市篩選下拉選單
**And** 預設顯示所有授權城市的數據
**And** 可選擇單一或多個城市

### AC3: 跨城市報表匯出

**Given** 區域經理匯出報表
**When** 選擇匯出選項
**Then** 可以選擇單一城市或多城市匯總
**And** 報表明確標示數據來源城市
**And** 匯總報表包含城市維度分析

### AC4: 城市對比分析

**Given** 區域經理查看分析頁面
**When** 選擇對比功能
**Then** 可同時對比多個城市的數據
**And** 顯示城市間的差異指標

---

## Tasks / Subtasks

- [ ] **Task 1: 區域經理角色設置** (AC: #1)
  - [ ] 1.1 創建 REGIONAL_MANAGER 角色
  - [ ] 1.2 定義角色權限
  - [ ] 1.3 支援多城市分配
  - [ ] 1.4 區域層級管理

- [ ] **Task 2: 多城市 Session 管理** (AC: #1)
  - [ ] 2.1 在 session 包含多城市列表
  - [ ] 2.2 設置活躍城市選擇
  - [ ] 2.3 支援城市切換
  - [ ] 2.4 記住用戶城市偏好

- [ ] **Task 3: 城市篩選組件** (AC: #2)
  - [ ] 3.1 創建 `CityFilter.tsx` 組件
  - [ ] 3.2 多選下拉選單
  - [ ] 3.3 全選/取消全選功能
  - [ ] 3.4 URL 參數同步
  - [ ] 3.5 記住篩選偏好

- [ ] **Task 4: 列表頁面整合** (AC: #2)
  - [ ] 4.1 在發票列表添加城市篩選
  - [ ] 4.2 在審核列表添加城市篩選
  - [ ] 4.3 在統計頁面添加城市篩選
  - [ ] 4.4 篩選條件持久化

- [ ] **Task 5: API 多城市支援** (AC: #1, #2)
  - [ ] 5.1 支援 cityCode[] 參數
  - [ ] 5.2 驗證用戶有權訪問請求的城市
  - [ ] 5.3 返回城市標識在結果中
  - [ ] 5.4 支援城市匯總統計

- [ ] **Task 6: 報表匯出功能** (AC: #3)
  - [ ] 6.1 創建匯出配置對話框
  - [ ] 6.2 城市選擇選項
  - [ ] 6.3 匯總方式選項
  - [ ] 6.4 報表城市標識

- [ ] **Task 7: 報表生成服務** (AC: #3)
  - [ ] 7.1 支援多城市數據聚合
  - [ ] 7.2 添加城市維度分析
  - [ ] 7.3 生成城市對比表格
  - [ ] 7.4 PDF/Excel 格式支援

- [ ] **Task 8: 城市對比組件** (AC: #4)
  - [ ] 8.1 創建 `CityComparison.tsx` 組件
  - [ ] 8.2 選擇對比城市
  - [ ] 8.3 顯示關鍵指標對比
  - [ ] 8.4 視覺化對比圖表

- [ ] **Task 9: 對比分析 API** (AC: #4)
  - [ ] 9.1 創建 GET `/api/analytics/city-comparison`
  - [ ] 9.2 計算城市間指標差異
  - [ ] 9.3 支援時間範圍選擇
  - [ ] 9.4 返回趨勢數據

- [ ] **Task 10: 驗證與測試** (AC: #1-4)
  - [ ] 10.1 測試多城市數據訪問
  - [ ] 10.2 測試城市篩選功能
  - [ ] 10.3 測試報表匯出
  - [ ] 10.4 測試城市對比
  - [ ] 10.5 測試權限邊界

---

## Dev Notes

### 依賴項

- **Story 6.2**: 城市用戶數據訪問控制

### Architecture Compliance

```typescript
// GET /api/documents (支援多城市)
interface DocumentsQueryParams {
  cityCodes?: string[]    // 可選：指定城市，空則返回所有授權城市
  status?: DocumentStatus
  forwarderId?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
}

interface DocumentsResponse {
  success: true
  data: {
    documents: {
      id: string
      fileName: string
      cityCode: string      // 包含城市標識
      cityName: string      // 城市名稱
      status: DocumentStatus
      // ... 其他欄位
    }[]
    pagination: { /* ... */ }
    cityBreakdown: {        // 城市分布統計
      cityCode: string
      cityName: string
      count: number
    }[]
  }
}
```

```typescript
// src/components/filters/CityFilter.tsx
'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useUserCity } from '@/hooks/useUserCity'
import { useQuery } from '@tanstack/react-query'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MapPin, ChevronDown, Check } from 'lucide-react'

interface City {
  code: string
  name: string
}

export function CityFilter() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { cityCodes: userCityCodes, isGlobalAdmin, isSingleCity } = useUserCity()

  // 單城市用戶不顯示篩選器
  if (isSingleCity) return null

  // 獲取用戶可訪問的城市列表
  const { data: cities } = useQuery({
    queryKey: ['accessible-cities'],
    queryFn: () => fetchAccessibleCities(),
  })

  // 從 URL 獲取當前選擇的城市
  const selectedCities = searchParams.get('cities')?.split(',').filter(Boolean) || []
  const isAllSelected = selectedCities.length === 0 || selectedCities.length === cities?.length

  const handleCityToggle = (cityCode: string) => {
    const params = new URLSearchParams(searchParams)
    let newSelection: string[]

    if (selectedCities.includes(cityCode)) {
      newSelection = selectedCities.filter(c => c !== cityCode)
    } else {
      newSelection = [...selectedCities, cityCode]
    }

    if (newSelection.length === 0 || newSelection.length === cities?.length) {
      params.delete('cities')
    } else {
      params.set('cities', newSelection.join(','))
    }

    router.push(`${pathname}?${params.toString()}`)
  }

  const handleSelectAll = () => {
    const params = new URLSearchParams(searchParams)
    params.delete('cities')
    router.push(`${pathname}?${params.toString()}`)
  }

  const handleClearAll = () => {
    // 保持至少一個城市選中
    if (cities?.length) {
      const params = new URLSearchParams(searchParams)
      params.set('cities', cities[0].code)
      router.push(`${pathname}?${params.toString()}`)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <MapPin className="h-4 w-4" />
          {isAllSelected ? (
            '所有城市'
          ) : (
            <>
              {selectedCities.length} 個城市
              <Badge variant="secondary" className="ml-1">
                {selectedCities.length}
              </Badge>
            </>
          )}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>選擇城市</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuCheckboxItem
          checked={isAllSelected}
          onCheckedChange={handleSelectAll}
        >
          <Check className={`mr-2 h-4 w-4 ${isAllSelected ? 'opacity-100' : 'opacity-0'}`} />
          所有城市
        </DropdownMenuCheckboxItem>

        <DropdownMenuSeparator />

        {cities?.map((city) => (
          <DropdownMenuCheckboxItem
            key={city.code}
            checked={isAllSelected || selectedCities.includes(city.code)}
            onCheckedChange={() => handleCityToggle(city.code)}
          >
            {city.name} ({city.code})
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

```typescript
// src/app/api/documents/route.ts - 多城市支援
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const requestedCities = searchParams.get('cities')?.split(',').filter(Boolean)

  // 驗證用戶是否有權訪問請求的城市
  let allowedCities: string[]

  if (session.user.isGlobalAdmin) {
    // 全局管理者可訪問所有城市
    allowedCities = requestedCities || await getAllCityCodes()
  } else {
    // 驗證請求的城市是否在用戶授權範圍內
    if (requestedCities) {
      const unauthorized = requestedCities.filter(
        c => !session.user.cityCodes.includes(c)
      )
      if (unauthorized.length > 0) {
        return NextResponse.json(
          { success: false, error: `Unauthorized cities: ${unauthorized.join(', ')}` },
          { status: 403 }
        )
      }
      allowedCities = requestedCities
    } else {
      allowedCities = session.user.cityCodes
    }
  }

  // 查詢數據
  const where: Prisma.DocumentWhereInput = {
    cityCode: { in: allowedCities },
    // ... 其他篩選條件
  }

  const [documents, total, cityBreakdown] = await Promise.all([
    prisma.document.findMany({
      where,
      include: {
        city: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.document.count({ where }),
    prisma.document.groupBy({
      by: ['cityCode'],
      where,
      _count: { id: true },
    }),
  ])

  // 獲取城市名稱
  const citiesMap = await getCitiesMap(allowedCities)

  return NextResponse.json({
    success: true,
    data: {
      documents: documents.map(d => ({
        ...d,
        cityName: d.city.name,
      })),
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      cityBreakdown: cityBreakdown.map(cb => ({
        cityCode: cb.cityCode,
        cityName: citiesMap[cb.cityCode],
        count: cb._count.id,
      })),
    },
  })
}
```

```typescript
// GET /api/analytics/city-comparison
interface CityComparisonParams {
  cityCodes: string[]     // 要對比的城市
  metrics: string[]       // 要對比的指標
  period: '7d' | '30d' | '90d' | '1y'
}

interface CityComparisonResponse {
  success: true
  data: {
    period: { start: string; end: string }
    cities: {
      cityCode: string
      cityName: string
      metrics: {
        documentsProcessed: number
        successRate: number
        averageConfidence: number
        averageProcessingTime: number
        correctionRate: number
        escalationRate: number
      }
      trend: {
        date: string
        processed: number
        successRate: number
      }[]
    }[]
    comparison: {
      metric: string
      best: { cityCode: string; value: number }
      worst: { cityCode: string; value: number }
      average: number
      standardDeviation: number
    }[]
  }
}
```

```typescript
// src/components/analytics/CityComparison.tsx
'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useUserCity } from '@/hooks/useUserCity'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts'
import { Badge } from '@/components/ui/badge'

export function CityComparison() {
  const { cityCodes, isGlobalAdmin } = useUserCity()
  const [selectedCities, setSelectedCities] = useState<string[]>(
    cityCodes.slice(0, 3) // 預設選擇前 3 個城市
  )
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d')

  const { data, isLoading } = useQuery({
    queryKey: ['city-comparison', selectedCities, period],
    queryFn: () => fetchCityComparison({ cityCodes: selectedCities, period }),
    enabled: selectedCities.length > 1,
  })

  if (!isGlobalAdmin && cityCodes.length < 2) {
    return null // 單城市用戶不顯示對比功能
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>城市對比分析</CardTitle>
            <div className="flex gap-4">
              <CityMultiSelect
                value={selectedCities}
                onChange={setSelectedCities}
                maxSelection={5}
              />
              <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">最近 7 天</SelectItem>
                  <SelectItem value="30d">最近 30 天</SelectItem>
                  <SelectItem value="90d">最近 90 天</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* 關鍵指標對比 */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {data?.comparison.map((comp) => (
              <Card key={comp.metric}>
                <CardContent className="pt-4">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    {getMetricLabel(comp.metric)}
                  </h4>
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-green-600">最佳</span>
                      <span>{comp.best.cityCode}: {formatMetric(comp.best.value, comp.metric)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-red-600">最差</span>
                      <span>{comp.worst.cityCode}: {formatMetric(comp.worst.value, comp.metric)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>平均</span>
                      <span>{formatMetric(comp.average, comp.metric)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* 柱狀圖對比 */}
          <div className="mb-6">
            <h4 className="text-sm font-medium mb-4">處理量對比</h4>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={data?.cities.map(c => ({
                  name: c.cityName,
                  processed: c.metrics.documentsProcessed,
                  successRate: c.metrics.successRate * 100,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" unit="%" />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="processed" fill="#8884d8" name="處理數量" />
                <Bar yAxisId="right" dataKey="successRate" fill="#82ca9d" name="成功率 %" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 趨勢對比 */}
          <div>
            <h4 className="text-sm font-medium mb-4">趨勢對比</h4>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                {data?.cities.map((city, index) => (
                  <Line
                    key={city.cityCode}
                    type="monotone"
                    data={city.trend}
                    dataKey="processed"
                    name={city.cityName}
                    stroke={COLORS[index % COLORS.length]}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00C49F']
```

```typescript
// src/components/export/ExportDialog.tsx
'use client'

import { useState } from 'react'
import { useUserCity } from '@/hooks/useUserCity'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onExport: (config: ExportConfig) => void
}

interface ExportConfig {
  format: 'pdf' | 'xlsx'
  cityCodes: string[]
  aggregation: 'individual' | 'combined'
  includeCityBreakdown: boolean
}

export function ExportDialog({ open, onOpenChange, onExport }: Props) {
  const { cityCodes, isSingleCity } = useUserCity()
  const [config, setConfig] = useState<ExportConfig>({
    format: 'xlsx',
    cityCodes: cityCodes,
    aggregation: 'combined',
    includeCityBreakdown: true,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>匯出報表</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 格式選擇 */}
          <div className="space-y-2">
            <Label>匯出格式</Label>
            <RadioGroup
              value={config.format}
              onValueChange={(v) => setConfig({ ...config, format: v as any })}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="xlsx" id="xlsx" />
                <Label htmlFor="xlsx">Excel (.xlsx)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pdf" id="pdf" />
                <Label htmlFor="pdf">PDF</Label>
              </div>
            </RadioGroup>
          </div>

          {/* 城市選擇（多城市用戶） */}
          {!isSingleCity && (
            <>
              <div className="space-y-2">
                <Label>選擇城市</Label>
                <CityCheckboxGroup
                  value={config.cityCodes}
                  onChange={(v) => setConfig({ ...config, cityCodes: v })}
                />
              </div>

              {/* 匯總方式 */}
              {config.cityCodes.length > 1 && (
                <div className="space-y-2">
                  <Label>匯總方式</Label>
                  <RadioGroup
                    value={config.aggregation}
                    onValueChange={(v) => setConfig({ ...config, aggregation: v as any })}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="combined" id="combined" />
                      <Label htmlFor="combined">合併報表</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="individual" id="individual" />
                      <Label htmlFor="individual">分別匯出每個城市</Label>
                    </div>
                  </RadioGroup>
                </div>
              )}

              {/* 包含城市分析 */}
              {config.aggregation === 'combined' && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="breakdown"
                    checked={config.includeCityBreakdown}
                    onCheckedChange={(v) =>
                      setConfig({ ...config, includeCityBreakdown: !!v })
                    }
                  />
                  <Label htmlFor="breakdown">包含城市維度分析</Label>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={() => onExport(config)}>
            匯出
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

### References

- [Source: docs/03-epics/sections/epic-6-multi-city-data-isolation.md#story-63]
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR45]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 6.3 |
| Story Key | 6-3-regional-manager-cross-city-access |
| Epic | Epic 6: 多城市數據隔離 |
| FR Coverage | FR45 |
| Dependencies | Story 6.2 |

---

*Story created: 2025-12-16*
*Status: ready-for-dev*
