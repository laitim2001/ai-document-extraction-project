'use client'

/**
 * @fileoverview RegionView 區域視圖組件
 * @description
 *   顯示區域績效的可展開視圖：
 *   - 區域層級統計
 *   - 可展開顯示城市詳情
 *   - 處理量圖表
 *   - 趨勢指示
 *
 * @module src/components/features/global/RegionView
 * @author Development Team
 * @since Epic 6 - Story 6.4 (Global Admin Full Access)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 區域統計卡片
 *   - 可折疊城市列表
 *   - 處理量圖表
 *   - 趨勢指示器
 *
 * @dependencies
 *   - @tanstack/react-query - 數據獲取
 *   - recharts - 圖表
 *   - lucide-react - 圖標
 *
 * @related
 *   - src/app/(dashboard)/global/page.tsx - 全局儀表板頁面
 *   - src/app/api/analytics/global/route.ts - 全局分析 API
 *   - src/app/api/analytics/region/[code]/cities/route.ts - 區域城市 API
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  ExternalLink,
} from 'lucide-react'
import Link from 'next/link'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

// ============================================================
// Types
// ============================================================

interface RegionStats {
  regionCode: string
  regionName: string
  cities: number
  documents: number
  successRate: number
  confidence: number
  trend: 'up' | 'down' | 'stable'
  trendValue: number
}

interface CityStats {
  code: string
  name: string
  documents: number
  successRate: number
  confidence: number
  correctionRate: number
}

// ============================================================
// Component
// ============================================================

/**
 * @component RegionView
 * @description 顯示區域績效的可展開視圖組件
 */
export function RegionView() {
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d')
  const [expandedRegions, setExpandedRegions] = useState<string[]>([])

  const { data, isLoading } = useQuery({
    queryKey: ['global-analytics', period],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/global?period=${period}`)
      if (!response.ok) throw new Error('Failed to fetch')
      return response.json()
    },
  })

  const toggleRegion = (regionCode: string) => {
    setExpandedRegions((prev) =>
      prev.includes(regionCode)
        ? prev.filter((r) => r !== regionCode)
        : [...prev, regionCode]
    )
  }

  if (isLoading) {
    return <RegionViewSkeleton />
  }

  const regions: RegionStats[] = data?.data?.regions || []

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">區域績效</h3>
        <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">7 天</SelectItem>
            <SelectItem value="30d">30 天</SelectItem>
            <SelectItem value="90d">90 天</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Region Summary Chart */}
      {regions.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={regions}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="regionName" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="documents" fill="#8884d8" name="處理數量" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Region Cards */}
      <div className="space-y-3">
        {regions.map((region) => (
          <Card key={region.regionCode}>
            <Collapsible
              open={expandedRegions.includes(region.regionCode)}
              onOpenChange={() => toggleRegion(region.regionCode)}
            >
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {expandedRegions.includes(region.regionCode) ? (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      )}
                      <div>
                        <h4 className="text-lg font-semibold">
                          {region.regionName}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {region.cities} 個活躍城市
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
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">信心度</p>
                        <p className="text-lg font-semibold">
                          {(region.confidence * 100).toFixed(1)}%
                        </p>
                      </div>
                      <TrendBadge
                        trend={region.trend}
                        value={region.trendValue}
                      />
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <CardContent className="pt-0">
                  <RegionCitiesTable regionCode={region.regionCode} />
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        ))}

        {regions.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            目前沒有區域數據
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * 趨勢徽章組件
 */
function TrendBadge({ trend, value }: { trend: string; value: number }) {
  const Icon =
    trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  const colorClass =
    trend === 'up'
      ? 'text-green-600 border-green-200 bg-green-50'
      : trend === 'down'
        ? 'text-red-600 border-red-200 bg-red-50'
        : 'text-gray-600 border-gray-200 bg-gray-50'

  return (
    <Badge variant="outline" className={`gap-1 ${colorClass}`}>
      <Icon className="h-3 w-3" />
      {value > 0 ? '+' : ''}
      {value.toFixed(1)}%
    </Badge>
  )
}

/**
 * 區域城市表格組件
 */
function RegionCitiesTable({ regionCode }: { regionCode: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['region-cities', regionCode],
    queryFn: async () => {
      const response = await fetch(
        `/api/analytics/region/${regionCode}/cities`
      )
      if (!response.ok) throw new Error('Failed to fetch')
      return response.json()
    },
  })

  if (isLoading) {
    return <div className="h-32 animate-pulse bg-muted rounded" />
  }

  const cities: CityStats[] = data?.data?.cities || []

  if (cities.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        此區域沒有城市數據
      </div>
    )
  }

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
        {cities.map((city) => (
          <TableRow key={city.code}>
            <TableCell className="font-medium">
              {city.name}
              <span className="text-muted-foreground ml-2 text-xs">
                ({city.code})
              </span>
            </TableCell>
            <TableCell className="text-right">
              {city.documents.toLocaleString()}
            </TableCell>
            <TableCell className="text-right">
              {(city.successRate * 100).toFixed(1)}%
            </TableCell>
            <TableCell className="text-right">
              {(city.confidence * 100).toFixed(1)}%
            </TableCell>
            <TableCell className="text-right">
              {(city.correctionRate * 100).toFixed(1)}%
            </TableCell>
            <TableCell>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/global/cities/${city.code}`}>
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

/**
 * 載入骨架組件
 */
function RegionViewSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-10 w-32" />
      </div>
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-5 w-5" />
                  <div>
                    <Skeleton className="h-6 w-32 mb-1" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <Skeleton key={j} className="h-12 w-16" />
                  ))}
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  )
}
