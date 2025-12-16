# Tech Spec: Story 6.3 - Regional Manager Cross-City Access

## Story Reference
- **Story ID**: 6.3
- **Story Title**: 區域經理跨城市訪問
- **Epic**: Epic 6 - 多城市數據隔離
- **Status**: Tech Spec Complete

---

## 1. Technical Overview

### 1.1 Purpose
為區域經理提供跨城市數據訪問能力，包含城市篩選、跨城市報表匯出和城市對比分析功能。

### 1.2 Scope
- 區域經理角色設置與權限
- 多城市 Session 管理
- 城市篩選組件與 URL 同步
- 多城市 API 支援
- 跨城市報表匯出
- 城市對比分析功能

### 1.3 Dependencies
- Story 6.2: 城市用戶數據訪問控制

---

## 2. Role and Permission Configuration

### 2.1 Regional Manager Role Setup

```prisma
// prisma/schema.prisma - Updates

// User-Region Assignment for Regional Managers
model UserRegionAccess {
  id          String   @id @default(uuid())
  userId      String   @map("user_id")
  regionId    String   @map("region_id")
  accessLevel AccessLevel @default(FULL)
  grantedBy   String   @map("granted_by")
  grantedAt   DateTime @default(now()) @map("granted_at")

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  region      Region   @relation(fields: [regionId], references: [id])
  grantor     User     @relation("GrantedRegionAccess", fields: [grantedBy], references: [id])

  @@unique([userId, regionId])
  @@index([userId])
  @@index([regionId])
  @@map("user_region_access")
}

model Region {
  // ... existing fields ...
  userAccesses  UserRegionAccess[]
}

model User {
  // ... existing fields ...
  regionAccesses    UserRegionAccess[] @relation()
  grantedRegionAccesses UserRegionAccess[] @relation("GrantedRegionAccess")
}
```

### 2.2 Regional Manager Service

```typescript
// src/services/regional-manager.ts
import { prisma, withServiceRole } from '@/lib/db-context'
import { CityAccessService } from '@/lib/city-access'

export class RegionalManagerService {
  /**
   * Grant regional manager role to user
   */
  static async grantRegionalManagerRole(
    userId: string,
    regionCode: string,
    grantedBy: string
  ): Promise<void> {
    await withServiceRole(async (tx) => {
      // Get region
      const region = await tx.region.findUnique({
        where: { code: regionCode },
        include: { cities: { where: { status: 'ACTIVE' } } },
      })

      if (!region) {
        throw new Error(`Region not found: ${regionCode}`)
      }

      // Update user role flag
      await tx.user.update({
        where: { id: userId },
        data: { isRegionalManager: true },
      })

      // Grant region access
      await tx.userRegionAccess.upsert({
        where: { userId_regionId: { userId, regionId: region.id } },
        create: {
          userId,
          regionId: region.id,
          grantedBy,
        },
        update: {
          grantedBy,
          grantedAt: new Date(),
        },
      })

      // Grant access to all cities in the region
      for (const city of region.cities) {
        await CityAccessService.grantAccess({
          userId,
          cityCode: city.code,
          grantedBy,
          reason: `Regional manager for ${regionCode}`,
        })
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          entityType: 'User',
          entityId: userId,
          action: 'GRANT_REGIONAL_MANAGER',
          performedBy: grantedBy,
          changes: { regionCode, citiesGranted: region.cities.map(c => c.code) },
        },
      })
    })
  }

  /**
   * Get all cities for a regional manager
   */
  static async getManagerCities(userId: string): Promise<string[]> {
    return withServiceRole(async (tx) => {
      const regionAccesses = await tx.userRegionAccess.findMany({
        where: { userId },
        include: {
          region: {
            include: {
              cities: {
                where: { status: 'ACTIVE' },
                select: { code: true },
              },
            },
          },
        },
      })

      const cityCodes = regionAccesses.flatMap(
        ra => ra.region.cities.map(c => c.code)
      )

      return [...new Set(cityCodes)]
    })
  }

  /**
   * Get manager's regions
   */
  static async getManagerRegions(userId: string): Promise<Array<{
    code: string
    name: string
    cityCount: number
  }>> {
    return withServiceRole(async (tx) => {
      const regionAccesses = await tx.userRegionAccess.findMany({
        where: { userId },
        include: {
          region: {
            include: {
              _count: {
                select: { cities: { where: { status: 'ACTIVE' } } },
              },
            },
          },
        },
      })

      return regionAccesses.map(ra => ({
        code: ra.region.code,
        name: ra.region.name,
        cityCount: ra.region._count.cities,
      }))
    })
  }
}
```

---

## 3. City Filter Component

### 3.1 Multi-Select City Filter

```typescript
// src/components/filters/CityFilter.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useUserCity } from '@/hooks/useUserCity'
import { useQuery } from '@tanstack/react-query'
import { useDebounce } from 'use-debounce'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  MapPin,
  ChevronDown,
  X,
  Search,
  CheckSquare,
  Square,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface City {
  code: string
  name: string
  region: { code: string; name: string }
}

interface CityFilterProps {
  /** Custom URL parameter name */
  paramName?: string
  /** Callback when selection changes */
  onChange?: (cityCodes: string[]) => void
  /** Custom className */
  className?: string
  /** Whether to persist selection to localStorage */
  persistSelection?: boolean
}

const STORAGE_KEY = 'city-filter-selection'

export function CityFilter({
  paramName = 'cities',
  onChange,
  className,
  persistSelection = true,
}: CityFilterProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const {
    cityCodes: userCityCodes,
    isGlobalAdmin,
    isSingleCity,
    isLoading: userLoading,
  } = useUserCity()

  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch] = useDebounce(searchQuery, 200)

  // Don't show filter for single-city users
  if (isSingleCity || userLoading) return null

  // Fetch accessible cities
  const { data: cities = [], isLoading: citiesLoading } = useQuery({
    queryKey: ['accessible-cities'],
    queryFn: async () => {
      const response = await fetch('/api/cities/accessible')
      if (!response.ok) throw new Error('Failed to fetch cities')
      const data = await response.json()
      return data.data as City[]
    },
  })

  // Get current selection from URL
  const getSelectedFromUrl = useCallback((): string[] => {
    const param = searchParams.get(paramName)
    if (!param) return []
    return param.split(',').filter(Boolean)
  }, [searchParams, paramName])

  const selectedCities = getSelectedFromUrl()
  const isAllSelected = selectedCities.length === 0

  // Filter cities by search
  const filteredCities = cities.filter(city =>
    city.code.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    city.name.toLowerCase().includes(debouncedSearch.toLowerCase())
  )

  // Group cities by region
  const groupedCities = filteredCities.reduce((acc, city) => {
    const regionCode = city.region.code
    if (!acc[regionCode]) {
      acc[regionCode] = {
        region: city.region,
        cities: [],
      }
    }
    acc[regionCode].cities.push(city)
    return acc
  }, {} as Record<string, { region: { code: string; name: string }; cities: City[] }>)

  // Update URL and trigger callback
  const updateSelection = useCallback((newSelection: string[]) => {
    const params = new URLSearchParams(searchParams)

    if (newSelection.length === 0 || newSelection.length === cities.length) {
      params.delete(paramName)
    } else {
      params.set(paramName, newSelection.join(','))
    }

    router.push(`${pathname}?${params.toString()}`, { scroll: false })

    // Persist to localStorage
    if (persistSelection) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSelection))
    }

    onChange?.(newSelection.length === 0 ? userCityCodes : newSelection)
  }, [searchParams, paramName, pathname, router, cities.length, onChange, userCityCodes, persistSelection])

  // Toggle individual city
  const toggleCity = (cityCode: string) => {
    const newSelection = selectedCities.includes(cityCode)
      ? selectedCities.filter(c => c !== cityCode)
      : [...selectedCities, cityCode]

    updateSelection(newSelection)
  }

  // Select all cities
  const selectAll = () => {
    updateSelection([])
  }

  // Clear selection (select none - not typically used, but keep one city minimum)
  const clearSelection = () => {
    if (cities.length > 0) {
      updateSelection([cities[0].code])
    }
  }

  // Select all cities in a region
  const toggleRegion = (regionCode: string) => {
    const regionCities = groupedCities[regionCode]?.cities.map(c => c.code) || []
    const allSelected = regionCities.every(c =>
      isAllSelected || selectedCities.includes(c)
    )

    if (allSelected) {
      // Deselect region cities
      const newSelection = selectedCities.filter(c => !regionCities.includes(c))
      updateSelection(newSelection.length > 0 ? newSelection : [cities[0]?.code].filter(Boolean))
    } else {
      // Select region cities
      const newSelection = [...new Set([...selectedCities, ...regionCities])]
      updateSelection(newSelection)
    }
  }

  // Load persisted selection on mount
  useEffect(() => {
    if (persistSelection && !searchParams.has(paramName)) {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        try {
          const savedSelection = JSON.parse(stored) as string[]
          // Validate saved selection against current access
          const validSelection = savedSelection.filter(c =>
            isGlobalAdmin || userCityCodes.includes(c)
          )
          if (validSelection.length > 0 && validSelection.length < cities.length) {
            updateSelection(validSelection)
          }
        } catch {
          // Invalid stored data, ignore
        }
      }
    }
  }, [cities.length])

  // Display text
  const displayText = isAllSelected
    ? '所有城市'
    : selectedCities.length === 1
    ? cities.find(c => c.code === selectedCities[0])?.name || selectedCities[0]
    : `${selectedCities.length} 個城市`

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('justify-between gap-2 min-w-[180px]', className)}
        >
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="truncate">{displayText}</span>
          </div>
          {!isAllSelected && (
            <Badge variant="secondary" className="ml-1 h-5 px-1">
              {selectedCities.length}
            </Badge>
          )}
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        {/* Search */}
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜尋城市..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        {/* Quick actions */}
        <div className="p-2 border-b flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={selectAll}
            className="flex-1 text-xs"
          >
            <CheckSquare className="h-3 w-3 mr-1" />
            全選
          </Button>
          {!isAllSelected && selectedCities.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSelection}
              className="flex-1 text-xs"
            >
              <Square className="h-3 w-3 mr-1" />
              清除
            </Button>
          )}
        </div>

        {/* City list */}
        <ScrollArea className="h-[300px]">
          {citiesLoading ? (
            <div className="p-4 text-center text-muted-foreground">
              載入中...
            </div>
          ) : Object.entries(groupedCities).length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              找不到城市
            </div>
          ) : (
            <div className="p-2">
              {Object.entries(groupedCities).map(([regionCode, group]) => {
                const allRegionSelected = group.cities.every(c =>
                  isAllSelected || selectedCities.includes(c.code)
                )
                const someRegionSelected = group.cities.some(c =>
                  isAllSelected || selectedCities.includes(c.code)
                )

                return (
                  <div key={regionCode} className="mb-3">
                    {/* Region header */}
                    <div
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                      onClick={() => toggleRegion(regionCode)}
                    >
                      <Checkbox
                        checked={allRegionSelected}
                        className={cn(
                          !allRegionSelected && someRegionSelected && 'opacity-50'
                        )}
                      />
                      <span className="text-sm font-medium text-muted-foreground">
                        {group.region.name}
                      </span>
                      <Badge variant="outline" className="ml-auto text-xs">
                        {group.cities.length}
                      </Badge>
                    </div>

                    {/* Cities in region */}
                    <div className="ml-4 space-y-0.5">
                      {group.cities.map(city => {
                        const isSelected = isAllSelected || selectedCities.includes(city.code)

                        return (
                          <div
                            key={city.code}
                            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                            onClick={() => toggleCity(city.code)}
                          >
                            <Checkbox checked={isSelected} />
                            <span className="text-sm flex-1">{city.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {city.code}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {selectedCities.length > 0 && (
          <div className="p-2 border-t">
            <div className="flex flex-wrap gap-1">
              {selectedCities.slice(0, 5).map(code => (
                <Badge
                  key={code}
                  variant="secondary"
                  className="text-xs cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => toggleCity(code)}
                >
                  {code}
                  <X className="h-3 w-3 ml-1" />
                </Badge>
              ))}
              {selectedCities.length > 5 && (
                <Badge variant="outline" className="text-xs">
                  +{selectedCities.length - 5}
                </Badge>
              )}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
```

### 3.2 City Filter Hook

```typescript
// src/hooks/useCityFilter.ts
'use client'

import { useSearchParams } from 'next/navigation'
import { useUserCity } from './useUserCity'
import { useMemo } from 'react'

interface UseCityFilterReturn {
  /** Currently selected city codes (empty means all) */
  selectedCities: string[]
  /** Whether all cities are selected */
  isAllSelected: boolean
  /** Effective city codes for API calls */
  effectiveCities: string[]
  /** Whether filter is active */
  isFiltered: boolean
}

export function useCityFilter(paramName: string = 'cities'): UseCityFilterReturn {
  const searchParams = useSearchParams()
  const { cityCodes, isGlobalAdmin } = useUserCity()

  return useMemo(() => {
    const param = searchParams.get(paramName)
    const selectedCities = param ? param.split(',').filter(Boolean) : []
    const isAllSelected = selectedCities.length === 0

    // Validate selected cities against user's access
    const validSelectedCities = isGlobalAdmin
      ? selectedCities
      : selectedCities.filter(c => cityCodes.includes(c))

    return {
      selectedCities: validSelectedCities,
      isAllSelected,
      effectiveCities: isAllSelected ? cityCodes : validSelectedCities,
      isFiltered: !isAllSelected && validSelectedCities.length > 0,
    }
  }, [searchParams, paramName, cityCodes, isGlobalAdmin])
}
```

---

## 4. City Comparison Analytics

### 4.1 Comparison API

```typescript
// src/app/api/analytics/city-comparison/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db-context'
import { z } from 'zod'

const querySchema = z.object({
  cities: z.string().transform(s => s.split(',').filter(Boolean)),
  period: z.enum(['7d', '30d', '90d', '1y']).default('30d'),
  metrics: z.string().optional().transform(s => s?.split(',') || [
    'documentsProcessed',
    'successRate',
    'avgConfidence',
    'avgProcessingTime',
    'correctionRate',
    'escalationRate',
  ]),
})

export async function GET(request: NextRequest) {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json(
      { type: 'UNAUTHORIZED', title: 'Authentication required' },
      { status: 401 }
    )
  }

  // Must have access to multiple cities
  const userCities = session.user.cityCodes || []
  if (!session.user.isGlobalAdmin && userCities.length < 2) {
    return NextResponse.json(
      { type: 'FORBIDDEN', title: 'Multi-city access required for comparison' },
      { status: 403 }
    )
  }

  const searchParams = Object.fromEntries(request.nextUrl.searchParams)
  const validation = querySchema.safeParse(searchParams)

  if (!validation.success) {
    return NextResponse.json(
      {
        type: 'VALIDATION_ERROR',
        title: 'Invalid parameters',
        errors: validation.error.flatten().fieldErrors,
      },
      { status: 400 }
    )
  }

  const { cities, period, metrics } = validation.data

  // Validate city access
  if (!session.user.isGlobalAdmin) {
    const unauthorized = cities.filter(c => !userCities.includes(c))
    if (unauthorized.length > 0) {
      return NextResponse.json(
        {
          type: 'FORBIDDEN',
          title: 'Unauthorized city access',
          detail: `No access to: ${unauthorized.join(', ')}`,
        },
        { status: 403 }
      )
    }
  }

  // Calculate date range
  const now = new Date()
  const periodDays = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 }
  const startDate = new Date(now)
  startDate.setDate(startDate.getDate() - periodDays[period])

  // Get city info
  const cityInfos = await prisma.city.findMany({
    where: { code: { in: cities } },
    select: { code: true, name: true },
  })

  const cityNameMap = Object.fromEntries(
    cityInfos.map(c => [c.code, c.name])
  )

  // Calculate metrics for each city
  const cityMetrics = await Promise.all(
    cities.map(async (cityCode) => {
      const where = {
        cityCode,
        createdAt: { gte: startDate },
      }

      const [
        totalDocs,
        completedDocs,
        avgMetrics,
        corrections,
        escalations,
        trend,
      ] = await Promise.all([
        // Total documents
        prisma.document.count({ where }),

        // Completed documents
        prisma.document.count({
          where: { ...where, status: 'COMPLETED' },
        }),

        // Average metrics
        prisma.document.aggregate({
          where,
          _avg: {
            confidence: true,
            processingTime: true,
          },
        }),

        // Corrections count
        prisma.correction.count({
          where: { document: where },
        }),

        // Escalations count
        prisma.escalation.count({
          where: { document: where },
        }),

        // Daily trend
        prisma.$queryRaw<Array<{
          date: string
          processed: bigint
          success_rate: number
        }>>`
          SELECT
            DATE(created_at) as date,
            COUNT(*) as processed,
            AVG(CASE WHEN status = 'COMPLETED' THEN 1.0 ELSE 0.0 END) as success_rate
          FROM documents
          WHERE city_code = ${cityCode}
            AND created_at >= ${startDate}
          GROUP BY DATE(created_at)
          ORDER BY date
        `,
      ])

      return {
        cityCode,
        cityName: cityNameMap[cityCode] || cityCode,
        metrics: {
          documentsProcessed: totalDocs,
          successRate: totalDocs > 0 ? completedDocs / totalDocs : 0,
          averageConfidence: avgMetrics._avg.confidence || 0,
          averageProcessingTime: avgMetrics._avg.processingTime || 0,
          correctionRate: totalDocs > 0 ? corrections / totalDocs : 0,
          escalationRate: totalDocs > 0 ? escalations / totalDocs : 0,
        },
        trend: trend.map(t => ({
          date: t.date,
          processed: Number(t.processed),
          successRate: t.success_rate,
        })),
      }
    })
  )

  // Calculate comparison statistics
  const comparison = calculateComparison(cityMetrics)

  return NextResponse.json({
    success: true,
    data: {
      period: {
        start: startDate.toISOString(),
        end: now.toISOString(),
      },
      cities: cityMetrics,
      comparison,
    },
  })
}

function calculateComparison(cityMetrics: any[]): any[] {
  const metricNames = [
    'documentsProcessed',
    'successRate',
    'averageConfidence',
    'averageProcessingTime',
    'correctionRate',
    'escalationRate',
  ]

  return metricNames.map(metric => {
    const values = cityMetrics.map(cm => ({
      cityCode: cm.cityCode,
      value: cm.metrics[metric] || 0,
    }))

    const sorted = [...values].sort((a, b) => {
      // For processing time and rates, lower is better
      if (metric === 'averageProcessingTime' || metric === 'correctionRate' || metric === 'escalationRate') {
        return a.value - b.value
      }
      return b.value - a.value
    })

    const numericValues = values.map(v => v.value)
    const avg = numericValues.reduce((a, b) => a + b, 0) / numericValues.length
    const variance = numericValues.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / numericValues.length
    const stdDev = Math.sqrt(variance)

    return {
      metric,
      best: sorted[0],
      worst: sorted[sorted.length - 1],
      average: avg,
      standardDeviation: stdDev,
    }
  })
}
```

### 4.2 City Comparison Component

```typescript
// src/components/analytics/CityComparison.tsx
'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useUserCity } from '@/hooks/useUserCity'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CityMultiSelect } from './CityMultiSelect'
import { ArrowUp, ArrowDown, Minus, Trophy, AlertTriangle } from 'lucide-react'

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00C49F', '#0088FE']

const METRIC_LABELS: Record<string, string> = {
  documentsProcessed: '處理數量',
  successRate: '成功率',
  averageConfidence: '平均信心度',
  averageProcessingTime: '平均處理時間',
  correctionRate: '修正率',
  escalationRate: '升級率',
}

interface CityComparisonProps {
  className?: string
}

export function CityComparison({ className }: CityComparisonProps) {
  const { cityCodes, isGlobalAdmin } = useUserCity()
  const [selectedCities, setSelectedCities] = useState<string[]>(
    cityCodes.slice(0, Math.min(3, cityCodes.length))
  )
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d')
  const [chartType, setChartType] = useState<'bar' | 'radar' | 'trend'>('bar')

  // Require at least 2 cities for comparison
  const canCompare = (isGlobalAdmin || cityCodes.length >= 2) && selectedCities.length >= 2

  const { data, isLoading, error } = useQuery({
    queryKey: ['city-comparison', selectedCities, period],
    queryFn: async () => {
      const params = new URLSearchParams({
        cities: selectedCities.join(','),
        period,
      })
      const response = await fetch(`/api/analytics/city-comparison?${params}`)
      if (!response.ok) throw new Error('Failed to fetch comparison data')
      return response.json()
    },
    enabled: canCompare,
  })

  if (!canCompare && cityCodes.length < 2) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            需要訪問多個城市才能進行對比分析
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle>城市對比分析</CardTitle>
              <CardDescription>比較不同城市的關鍵績效指標</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <CityMultiSelect
                value={selectedCities}
                onChange={setSelectedCities}
                maxSelection={5}
                minSelection={2}
              />
              <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">7 天</SelectItem>
                  <SelectItem value="30d">30 天</SelectItem>
                  <SelectItem value="90d">90 天</SelectItem>
                </SelectContent>
              </Select>
              <Select value={chartType} onValueChange={(v) => setChartType(v as any)}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bar">柱狀圖</SelectItem>
                  <SelectItem value="radar">雷達圖</SelectItem>
                  <SelectItem value="trend">趨勢圖</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-[400px] flex items-center justify-center">
              <p className="text-muted-foreground">載入中...</p>
            </div>
          ) : error ? (
            <div className="h-[400px] flex items-center justify-center">
              <p className="text-destructive">載入失敗</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {data?.data.comparison.slice(0, 3).map((comp: any) => (
                  <ComparisonCard key={comp.metric} comparison={comp} />
                ))}
              </div>

              {/* Chart */}
              <div className="h-[400px]">
                {chartType === 'bar' && (
                  <BarChartView data={data?.data.cities} />
                )}
                {chartType === 'radar' && (
                  <RadarChartView data={data?.data.cities} />
                )}
                {chartType === 'trend' && (
                  <TrendChartView data={data?.data.cities} />
                )}
              </div>

              {/* Detailed Table */}
              <ComparisonTable
                cities={data?.data.cities}
                comparison={data?.data.comparison}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ComparisonCard({ comparison }: { comparison: any }) {
  const isLowerBetter = ['averageProcessingTime', 'correctionRate', 'escalationRate']
    .includes(comparison.metric)

  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-sm text-muted-foreground">
          {METRIC_LABELS[comparison.metric]}
        </p>
        <div className="mt-2 space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-green-600">
              <Trophy className="h-3 w-3" />
              <span className="text-xs">最佳</span>
            </div>
            <span className="text-sm font-medium">
              {comparison.best.cityCode}: {formatMetricValue(comparison.best.value, comparison.metric)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-orange-600">
              <AlertTriangle className="h-3 w-3" />
              <span className="text-xs">待改善</span>
            </div>
            <span className="text-sm font-medium">
              {comparison.worst.cityCode}: {formatMetricValue(comparison.worst.value, comparison.metric)}
            </span>
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs">平均</span>
            <span className="text-sm">
              {formatMetricValue(comparison.average, comparison.metric)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function BarChartView({ data }: { data: any[] }) {
  const chartData = data?.map(city => ({
    name: city.cityName,
    處理數量: city.metrics.documentsProcessed,
    '成功率 (%)': (city.metrics.successRate * 100).toFixed(1),
    '信心度 (%)': (city.metrics.averageConfidence * 100).toFixed(1),
  }))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis yAxisId="left" />
        <YAxis yAxisId="right" orientation="right" />
        <Tooltip />
        <Legend />
        <Bar yAxisId="left" dataKey="處理數量" fill={COLORS[0]} />
        <Bar yAxisId="right" dataKey="成功率 (%)" fill={COLORS[1]} />
        <Bar yAxisId="right" dataKey="信心度 (%)" fill={COLORS[2]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function RadarChartView({ data }: { data: any[] }) {
  // Normalize metrics to 0-100 scale for radar chart
  const radarData = [
    { metric: '成功率', fullMark: 100 },
    { metric: '信心度', fullMark: 100 },
    { metric: '效率', fullMark: 100 },
  ]

  data?.forEach((city, index) => {
    radarData.forEach(item => {
      if (item.metric === '成功率') {
        (item as any)[city.cityCode] = (city.metrics.successRate * 100).toFixed(1)
      } else if (item.metric === '信心度') {
        (item as any)[city.cityCode] = (city.metrics.averageConfidence * 100).toFixed(1)
      } else if (item.metric === '效率') {
        // Inverse of correction rate (higher is better)
        (item as any)[city.cityCode] = ((1 - city.metrics.correctionRate) * 100).toFixed(1)
      }
    })
  })

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart data={radarData}>
        <PolarGrid />
        <PolarAngleAxis dataKey="metric" />
        <PolarRadiusAxis angle={30} domain={[0, 100]} />
        {data?.map((city, index) => (
          <Radar
            key={city.cityCode}
            name={city.cityName}
            dataKey={city.cityCode}
            stroke={COLORS[index % COLORS.length]}
            fill={COLORS[index % COLORS.length]}
            fillOpacity={0.3}
          />
        ))}
        <Legend />
      </RadarChart>
    </ResponsiveContainer>
  )
}

function TrendChartView({ data }: { data: any[] }) {
  // Merge trend data from all cities
  const allDates = new Set<string>()
  data?.forEach(city => {
    city.trend.forEach((t: any) => allDates.add(t.date))
  })

  const trendData = [...allDates].sort().map(date => {
    const point: any = { date }
    data?.forEach(city => {
      const dayData = city.trend.find((t: any) => t.date === date)
      point[city.cityCode] = dayData?.processed || 0
    })
    return point
  })

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={trendData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tickFormatter={(value) => new Date(value).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' })}
        />
        <YAxis />
        <Tooltip
          labelFormatter={(value) => new Date(value).toLocaleDateString('zh-TW')}
        />
        <Legend />
        {data?.map((city, index) => (
          <Line
            key={city.cityCode}
            type="monotone"
            dataKey={city.cityCode}
            name={city.cityName}
            stroke={COLORS[index % COLORS.length]}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

function ComparisonTable({ cities, comparison }: { cities: any[]; comparison: any[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>指標</TableHead>
          {cities?.map(city => (
            <TableHead key={city.cityCode} className="text-center">
              {city.cityName}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {comparison?.map((comp: any) => (
          <TableRow key={comp.metric}>
            <TableCell className="font-medium">
              {METRIC_LABELS[comp.metric]}
            </TableCell>
            {cities?.map(city => {
              const value = city.metrics[comp.metric]
              const isBest = comp.best.cityCode === city.cityCode
              const isWorst = comp.worst.cityCode === city.cityCode

              return (
                <TableCell
                  key={city.cityCode}
                  className={`text-center ${isBest ? 'text-green-600 font-medium' : ''} ${isWorst ? 'text-orange-600' : ''}`}
                >
                  {formatMetricValue(value, comp.metric)}
                  {isBest && <Trophy className="inline h-3 w-3 ml-1" />}
                </TableCell>
              )
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function formatMetricValue(value: number, metric: string): string {
  if (metric.includes('Rate') || metric === 'successRate' || metric === 'averageConfidence') {
    return `${(value * 100).toFixed(1)}%`
  }
  if (metric === 'averageProcessingTime') {
    return `${value.toFixed(1)}s`
  }
  return value.toLocaleString()
}
```

---

## 5. Export Functionality

### 5.1 Export API

```typescript
// src/app/api/exports/multi-city/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db-context'
import { generateExcelReport, generatePdfReport } from '@/services/export'
import { z } from 'zod'

const exportSchema = z.object({
  cityCodes: z.array(z.string()).min(1),
  format: z.enum(['xlsx', 'pdf']),
  aggregation: z.enum(['individual', 'combined']),
  includeCityBreakdown: z.boolean().default(true),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  reportType: z.enum(['summary', 'detailed', 'comparison']).default('summary'),
})

export async function POST(request: NextRequest) {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json(
      { type: 'UNAUTHORIZED', title: 'Authentication required' },
      { status: 401 }
    )
  }

  const body = await request.json()
  const validation = exportSchema.safeParse(body)

  if (!validation.success) {
    return NextResponse.json(
      {
        type: 'VALIDATION_ERROR',
        title: 'Invalid export configuration',
        errors: validation.error.flatten().fieldErrors,
      },
      { status: 400 }
    )
  }

  const {
    cityCodes,
    format,
    aggregation,
    includeCityBreakdown,
    dateFrom,
    dateTo,
    reportType,
  } = validation.data

  // Validate city access
  if (!session.user.isGlobalAdmin) {
    const unauthorized = cityCodes.filter(c => !session.user.cityCodes?.includes(c))
    if (unauthorized.length > 0) {
      return NextResponse.json(
        {
          type: 'FORBIDDEN',
          title: 'Unauthorized city access',
          detail: `No access to: ${unauthorized.join(', ')}`,
        },
        { status: 403 }
      )
    }
  }

  // Gather data for export
  const exportData = await gatherExportData({
    cityCodes,
    dateFrom: dateFrom ? new Date(dateFrom) : undefined,
    dateTo: dateTo ? new Date(dateTo) : undefined,
    includeCityBreakdown,
  })

  // Generate report based on format
  let buffer: Buffer
  let contentType: string
  let filename: string

  if (format === 'xlsx') {
    buffer = await generateExcelReport(exportData, {
      aggregation,
      reportType,
      includeCityBreakdown,
    })
    contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    filename = `report-${cityCodes.join('-')}-${Date.now()}.xlsx`
  } else {
    buffer = await generatePdfReport(exportData, {
      aggregation,
      reportType,
      includeCityBreakdown,
    })
    contentType = 'application/pdf'
    filename = `report-${cityCodes.join('-')}-${Date.now()}.pdf`
  }

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

async function gatherExportData(options: {
  cityCodes: string[]
  dateFrom?: Date
  dateTo?: Date
  includeCityBreakdown: boolean
}) {
  const { cityCodes, dateFrom, dateTo } = options

  const dateFilter = {
    ...(dateFrom && { gte: dateFrom }),
    ...(dateTo && { lte: dateTo }),
  }

  // Gather data for each city
  const cityData = await Promise.all(
    cityCodes.map(async (cityCode) => {
      const where = {
        cityCode,
        ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
      }

      const [documents, stats, city] = await Promise.all([
        prisma.document.findMany({
          where,
          include: {
            forwarder: { select: { name: true } },
            extractionResults: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1000, // Limit for performance
        }),
        prisma.document.aggregate({
          where,
          _count: { id: true },
          _avg: { confidence: true, processingTime: true },
        }),
        prisma.city.findUnique({
          where: { code: cityCode },
          include: { region: true },
        }),
      ])

      return {
        cityCode,
        cityName: city?.name || cityCode,
        regionName: city?.region.name || 'Unknown',
        documents,
        stats: {
          totalDocuments: stats._count.id,
          avgConfidence: stats._avg.confidence,
          avgProcessingTime: stats._avg.processingTime,
        },
      }
    })
  )

  return {
    generatedAt: new Date(),
    period: { from: dateFrom, to: dateTo },
    cities: cityData,
  }
}
```

### 5.2 Export Dialog Component

```typescript
// src/components/export/MultiCityExportDialog.tsx
'use client'

import { useState } from 'react'
import { useUserCity } from '@/hooks/useUserCity'
import { useMutation } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { DatePickerWithRange } from '@/components/ui/date-picker-range'
import { CityMultiSelect } from '@/components/filters/CityMultiSelect'
import { toast } from 'sonner'
import { Download, Loader2 } from 'lucide-react'
import { DateRange } from 'react-day-picker'

interface MultiCityExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface ExportConfig {
  cityCodes: string[]
  format: 'xlsx' | 'pdf'
  aggregation: 'individual' | 'combined'
  includeCityBreakdown: boolean
  reportType: 'summary' | 'detailed' | 'comparison'
  dateRange?: DateRange
}

export function MultiCityExportDialog({
  open,
  onOpenChange,
}: MultiCityExportDialogProps) {
  const { cityCodes: userCityCodes, isSingleCity } = useUserCity()

  const [config, setConfig] = useState<ExportConfig>({
    cityCodes: userCityCodes,
    format: 'xlsx',
    aggregation: 'combined',
    includeCityBreakdown: true,
    reportType: 'summary',
  })

  const exportMutation = useMutation({
    mutationFn: async (exportConfig: ExportConfig) => {
      const response = await fetch('/api/exports/multi-city', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...exportConfig,
          dateFrom: exportConfig.dateRange?.from?.toISOString(),
          dateTo: exportConfig.dateRange?.to?.toISOString(),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.title || 'Export failed')
      }

      // Download the file
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = response.headers.get('Content-Disposition')
        ?.split('filename=')[1]
        ?.replace(/"/g, '') || 'export'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    },
    onSuccess: () => {
      toast.success('報表已下載')
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(`匯出失敗: ${error.message}`)
    },
  })

  const handleExport = () => {
    if (config.cityCodes.length === 0) {
      toast.error('請選擇至少一個城市')
      return
    }
    exportMutation.mutate(config)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>匯出報表</DialogTitle>
          <DialogDescription>
            選擇匯出設定以生成報表
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* City Selection (multi-city users only) */}
          {!isSingleCity && (
            <div className="space-y-2">
              <Label>選擇城市</Label>
              <CityMultiSelect
                value={config.cityCodes}
                onChange={(cities) => setConfig({ ...config, cityCodes: cities })}
              />
            </div>
          )}

          {/* Date Range */}
          <div className="space-y-2">
            <Label>日期範圍（選填）</Label>
            <DatePickerWithRange
              value={config.dateRange}
              onChange={(range) => setConfig({ ...config, dateRange: range })}
            />
          </div>

          {/* Format Selection */}
          <div className="space-y-2">
            <Label>檔案格式</Label>
            <RadioGroup
              value={config.format}
              onValueChange={(v) => setConfig({ ...config, format: v as any })}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="xlsx" id="xlsx" />
                <Label htmlFor="xlsx" className="font-normal">Excel (.xlsx)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pdf" id="pdf" />
                <Label htmlFor="pdf" className="font-normal">PDF</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Report Type */}
          <div className="space-y-2">
            <Label>報表類型</Label>
            <RadioGroup
              value={config.reportType}
              onValueChange={(v) => setConfig({ ...config, reportType: v as any })}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="summary" id="summary" />
                <Label htmlFor="summary" className="font-normal">摘要報表</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="detailed" id="detailed" />
                <Label htmlFor="detailed" className="font-normal">詳細報表</Label>
              </div>
              {config.cityCodes.length > 1 && (
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="comparison" id="comparison" />
                  <Label htmlFor="comparison" className="font-normal">城市對比報表</Label>
                </div>
              )}
            </RadioGroup>
          </div>

          {/* Aggregation (multi-city only) */}
          {config.cityCodes.length > 1 && (
            <div className="space-y-2">
              <Label>匯總方式</Label>
              <RadioGroup
                value={config.aggregation}
                onValueChange={(v) => setConfig({ ...config, aggregation: v as any })}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="combined" id="combined" />
                  <Label htmlFor="combined" className="font-normal">合併報表</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="individual" id="individual" />
                  <Label htmlFor="individual" className="font-normal">分別匯出</Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* City Breakdown Option */}
          {config.aggregation === 'combined' && config.cityCodes.length > 1 && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="breakdown"
                checked={config.includeCityBreakdown}
                onCheckedChange={(v) =>
                  setConfig({ ...config, includeCityBreakdown: !!v })
                }
              />
              <Label htmlFor="breakdown" className="font-normal">
                包含城市維度分析
              </Label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleExport} disabled={exportMutation.isPending}>
            {exportMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                匯出中...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                匯出
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

---

## 6. Testing Strategy

### 6.1 Regional Manager Tests

```typescript
// __tests__/services/regional-manager.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { RegionalManagerService } from '@/services/regional-manager'

describe('RegionalManagerService', () => {
  describe('grantRegionalManagerRole', () => {
    it('should grant region access and all city accesses', async () => {
      await RegionalManagerService.grantRegionalManagerRole(
        'user-1',
        'APAC',
        'admin-1'
      )

      const cities = await RegionalManagerService.getManagerCities('user-1')
      expect(cities).toContain('HKG')
      expect(cities).toContain('SIN')
      expect(cities).toContain('TYO')
    })

    it('should update user isRegionalManager flag', async () => {
      await RegionalManagerService.grantRegionalManagerRole(
        'user-2',
        'EMEA',
        'admin-1'
      )

      const user = await prisma.user.findUnique({
        where: { id: 'user-2' },
      })

      expect(user?.isRegionalManager).toBe(true)
    })
  })
})
```

---

## 7. Acceptance Criteria Verification

| AC | Description | Implementation | Verification |
|----|-------------|----------------|--------------|
| AC1 | 多城市數據訪問 | RegionalManagerService, multi-city API | Regional manager sees all assigned city data |
| AC2 | 城市篩選功能 | CityFilter component, URL sync | Filter persists, shows only authorized cities |
| AC3 | 跨城市報表匯出 | Export API, MultiCityExportDialog | Excel/PDF with city breakdown |
| AC4 | 城市對比分析 | CityComparison component, comparison API | Bar/Radar/Trend charts with metrics |

---

## 8. References

- Story 6.3 Requirements
- Story 6.2 Tech Spec (City Access Control)
- Recharts Documentation
- ExcelJS Documentation
