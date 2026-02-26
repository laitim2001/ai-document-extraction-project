'use client'

/**
 * @fileoverview CityRankings 城市排名組件
 * @description
 *   顯示城市排名榜：
 *   - 按處理量排名
 *   - 按成功率排名
 *   - 按效率排名
 *   - 可切換排名類型
 *
 * @module src/components/features/global/CityRankings
 * @author Development Team
 * @since Epic 6 - Story 6.4 (Global Admin Full Access)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 多維度排名
 *   - 排名切換
 *   - 趨勢指示
 *   - 獎牌標識
 *
 * @dependencies
 *   - @tanstack/react-query - 數據獲取
 *   - lucide-react - 圖標
 *
 * @related
 *   - src/app/(dashboard)/global/page.tsx - 全局儀表板頁面
 *   - src/app/api/analytics/global/route.ts - 全局分析 API
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Trophy,
  Medal,
  Award,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Target,
  Zap,
} from 'lucide-react'

// ============================================================
// Types
// ============================================================

interface CityRankItem {
  code: string
  name: string
  regionCode: string
  regionName: string
  value: number
  change: number
  rank: number
}

interface CityRankingsData {
  byVolume: CityRankItem[]
  bySuccessRate: CityRankItem[]
  byEfficiency: CityRankItem[]
}

interface CityRankingsProps {
  /** 時間週期 */
  period?: '7d' | '30d' | '90d' | '1y'
}

// ============================================================
// Constants
// ============================================================

const RANKING_TYPES = [
  { key: 'byVolume', labelKey: 'rankings.sortBy.volume', icon: BarChart3 },
  { key: 'bySuccessRate', labelKey: 'rankings.sortBy.successRate', icon: Target },
  { key: 'byEfficiency', labelKey: 'rankings.sortBy.efficiency', icon: Zap },
] as const

// ============================================================
// Component
// ============================================================

/**
 * @component CityRankings
 * @description 顯示城市多維度排名的組件
 */
export function CityRankings({ period = '30d' }: CityRankingsProps) {
  const t = useTranslations('global')
  const [activeTab, setActiveTab] = useState<keyof CityRankingsData>('byVolume')

  const { data, isLoading } = useQuery({
    queryKey: ['global-analytics', period],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/global?period=${period}`)
      if (!response.ok) throw new Error('Failed to fetch')
      return response.json()
    },
  })

  if (isLoading) {
    return <CityRankingsSkeleton />
  }

  const rankings: CityRankingsData = data?.data?.cityRankings || {
    byVolume: [],
    bySuccessRate: [],
    byEfficiency: [],
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          {t('rankings.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as keyof CityRankingsData)}
        >
          <TabsList className="grid w-full grid-cols-3">
            {RANKING_TYPES.map((type) => (
              <TabsTrigger
                key={type.key}
                value={type.key}
                className="flex items-center gap-2"
              >
                <type.icon className="h-4 w-4" />
                {t(type.labelKey)}
              </TabsTrigger>
            ))}
          </TabsList>

          {RANKING_TYPES.map((type) => (
            <TabsContent key={type.key} value={type.key}>
              <RankingTable
                items={rankings[type.key]}
                type={type.key}
              />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  )
}

// ============================================================
// Sub-Components
// ============================================================

/**
 * 排名表格組件
 */
function RankingTable({
  items,
  type,
}: {
  items: CityRankItem[]
  type: keyof CityRankingsData
}) {
  const t = useTranslations('global')
  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {t('rankings.noData')}
      </div>
    )
  }

  const formatValue = (value: number, type: keyof CityRankingsData) => {
    if (type === 'byVolume') {
      return value.toLocaleString()
    }
    return `${(value * 100).toFixed(1)}%`
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-16">{t('rankings.rank')}</TableHead>
          <TableHead>{t('rankings.city')}</TableHead>
          <TableHead>{t('rankings.region')}</TableHead>
          <TableHead className="text-right">
            {type === 'byVolume' ? t('rankings.sortBy.volume') : type === 'bySuccessRate' ? t('rankings.sortBy.successRate') : t('rankings.sortBy.efficiency')}
          </TableHead>
          <TableHead className="text-right">{t('rankings.change')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.code}>
            <TableCell>
              <RankBadge rank={item.rank} />
            </TableCell>
            <TableCell className="font-medium">
              {item.name}
              <span className="text-muted-foreground ml-2 text-xs">
                ({item.code})
              </span>
            </TableCell>
            <TableCell>
              <Badge variant="outline">{item.regionName}</Badge>
            </TableCell>
            <TableCell className="text-right font-semibold">
              {formatValue(item.value, type)}
            </TableCell>
            <TableCell className="text-right">
              <ChangeBadge change={item.change} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

/**
 * 排名徽章組件
 */
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-100">
        <Trophy className="h-4 w-4 text-yellow-600" />
      </div>
    )
  }
  if (rank === 2) {
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100">
        <Medal className="h-4 w-4 text-gray-500" />
      </div>
    )
  }
  if (rank === 3) {
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-100">
        <Award className="h-4 w-4 text-orange-600" />
      </div>
    )
  }
  return (
    <div className="flex items-center justify-center w-8 h-8 text-muted-foreground font-medium">
      {rank}
    </div>
  )
}

/**
 * 變化徽章組件
 */
function ChangeBadge({ change }: { change: number }) {
  const Icon = change > 0 ? TrendingUp : change < 0 ? TrendingDown : Minus
  const colorClass =
    change > 0
      ? 'text-green-600'
      : change < 0
        ? 'text-red-600'
        : 'text-gray-500'

  return (
    <div className={`flex items-center justify-end gap-1 ${colorClass}`}>
      <Icon className="h-3 w-3" />
      <span className="text-sm">
        {change > 0 ? '+' : ''}
        {change.toFixed(1)}%
      </span>
    </div>
  )
}

/**
 * 載入骨架組件
 */
function CityRankingsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-6 w-24" />
        </div>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-10 w-full mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
