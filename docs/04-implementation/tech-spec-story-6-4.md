# Tech Spec: Story 6.4 - Global Admin Full Access

## Story Reference
- **Story ID**: 6.4
- **Story Title**: 全局管理者完整訪問
- **Epic**: Epic 6 - 多城市數據隔離
- **Status**: Tech Spec Complete

---

## 1. Technical Overview

### 1.1 Purpose
為全局管理者提供對所有城市數據的完整訪問權限，包含全球儀表板、區域視圖、全局配置管理和配置版本控制。

### 1.2 Scope
- 全局管理者角色與 RLS bypass
- 全球儀表板頁面
- 區域層級視圖組件
- 全局配置管理系統
- 配置版本歷史與回滾
- 全球地圖視圖（可選）

### 1.3 Dependencies
- Story 6.3: 區域經理跨城市訪問
- Story 1.2: 角色權限基礎

---

## 2. Data Models

### 2.1 System Configuration Models

```prisma
// prisma/schema.prisma

model SystemConfig {
  id          String         @id @default(uuid())
  key         String         @unique
  value       Json
  description String?
  category    ConfigCategory
  scope       ConfigScope    @default(GLOBAL)
  cityCode    String?        @map("city_code")
  version     Int            @default(1)
  isActive    Boolean        @default(true) @map("is_active")
  updatedBy   String         @map("updated_by")
  createdAt   DateTime       @default(now()) @map("created_at")
  updatedAt   DateTime       @updatedAt @map("updated_at")

  city        City?          @relation(fields: [cityCode], references: [code])
  updater     User           @relation("ConfigUpdater", fields: [updatedBy], references: [id])
  history     ConfigHistory[]

  @@index([key])
  @@index([category])
  @@index([scope])
  @@index([cityCode])
  @@map("system_configs")
}

model ConfigHistory {
  id            String   @id @default(uuid())
  configId      String   @map("config_id")
  version       Int
  previousValue Json     @map("previous_value")
  newValue      Json     @map("new_value")
  changedBy     String   @map("changed_by")
  changeReason  String?  @map("change_reason")
  createdAt     DateTime @default(now()) @map("created_at")

  config        SystemConfig @relation(fields: [configId], references: [id], onDelete: Cascade)
  changer       User         @relation("ConfigChanger", fields: [changedBy], references: [id])

  @@index([configId])
  @@index([createdAt])
  @@map("config_history")
}

enum ConfigCategory {
  PROCESSING      // 處理相關配置
  NOTIFICATION    // 通知設定
  SECURITY        // 安全設定
  DISPLAY         // 顯示設定
  INTEGRATION     // 整合設定
  AI_MODEL        // AI 模型設定
  THRESHOLD       // 閾值設定
}

enum ConfigScope {
  GLOBAL          // 全局配置
  REGION          // 區域配置
  CITY            // 城市配置
}
```

### 2.2 Database Migration

```sql
-- prisma/migrations/XXXXXX_add_system_config/migration.sql

CREATE TABLE "system_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" VARCHAR(100) NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "category" VARCHAR(50) NOT NULL,
    "scope" VARCHAR(20) NOT NULL DEFAULT 'GLOBAL',
    "city_code" VARCHAR(10),
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "system_configs_key_key" UNIQUE ("key"),
    CONSTRAINT "system_configs_city_fkey" FOREIGN KEY ("city_code")
        REFERENCES "cities"("code") ON DELETE SET NULL,
    CONSTRAINT "system_configs_updater_fkey" FOREIGN KEY ("updated_by")
        REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE INDEX "idx_system_configs_key" ON "system_configs"("key");
CREATE INDEX "idx_system_configs_category" ON "system_configs"("category");
CREATE INDEX "idx_system_configs_scope" ON "system_configs"("scope");
CREATE INDEX "idx_system_configs_city_code" ON "system_configs"("city_code");

CREATE TABLE "config_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "config_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "previous_value" JSONB NOT NULL,
    "new_value" JSONB NOT NULL,
    "changed_by" UUID NOT NULL,
    "change_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "config_history_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "config_history_config_fkey" FOREIGN KEY ("config_id")
        REFERENCES "system_configs"("id") ON DELETE CASCADE,
    CONSTRAINT "config_history_changer_fkey" FOREIGN KEY ("changed_by")
        REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE INDEX "idx_config_history_config_id" ON "config_history"("config_id");
CREATE INDEX "idx_config_history_created_at" ON "config_history"("created_at" DESC);
```

---

## 3. Global Admin Service

### 3.1 Admin Access Service

```typescript
// src/services/global-admin.ts
import { prisma, withServiceRole } from '@/lib/db-context'

export class GlobalAdminService {
  /**
   * Grant global admin role to user
   */
  static async grantGlobalAdminRole(
    userId: string,
    grantedBy: string
  ): Promise<void> {
    await withServiceRole(async (tx) => {
      // Verify granter is also global admin
      const granter = await tx.user.findUnique({
        where: { id: grantedBy },
        select: { isGlobalAdmin: true },
      })

      if (!granter?.isGlobalAdmin) {
        throw new Error('Only global admins can grant global admin role')
      }

      // Update user
      await tx.user.update({
        where: { id: userId },
        data: { isGlobalAdmin: true },
      })

      // Audit log
      await tx.auditLog.create({
        data: {
          entityType: 'User',
          entityId: userId,
          action: 'GRANT_GLOBAL_ADMIN',
          performedBy: grantedBy,
          changes: { role: 'GLOBAL_ADMIN' },
        },
      })
    })
  }

  /**
   * Revoke global admin role from user
   */
  static async revokeGlobalAdminRole(
    userId: string,
    revokedBy: string
  ): Promise<void> {
    await withServiceRole(async (tx) => {
      // Prevent revoking own role
      if (userId === revokedBy) {
        throw new Error('Cannot revoke your own global admin role')
      }

      // Count remaining global admins
      const adminCount = await tx.user.count({
        where: { isGlobalAdmin: true },
      })

      if (adminCount <= 1) {
        throw new Error('Cannot remove the last global admin')
      }

      // Update user
      await tx.user.update({
        where: { id: userId },
        data: { isGlobalAdmin: false },
      })

      // Audit log
      await tx.auditLog.create({
        data: {
          entityType: 'User',
          entityId: userId,
          action: 'REVOKE_GLOBAL_ADMIN',
          performedBy: revokedBy,
          changes: { role: 'GLOBAL_ADMIN', action: 'revoked' },
        },
      })
    })
  }

  /**
   * Check if user is global admin
   */
  static async isGlobalAdmin(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isGlobalAdmin: true },
    })

    return user?.isGlobalAdmin || false
  }
}
```

### 3.2 System Configuration Service

```typescript
// src/services/system-config.ts
import { prisma } from '@/lib/db-context'
import { ConfigCategory, ConfigScope } from '@prisma/client'

interface ConfigValue {
  [key: string]: unknown
}

export class SystemConfigService {
  /**
   * Get configuration by key
   */
  static async get<T = ConfigValue>(key: string): Promise<T | null> {
    const config = await prisma.systemConfig.findUnique({
      where: { key, isActive: true },
    })

    return config?.value as T | null
  }

  /**
   * Get all configurations by category
   */
  static async getByCategory(category: ConfigCategory): Promise<Array<{
    key: string
    value: ConfigValue
    description: string | null
    version: number
    updatedAt: Date
  }>> {
    const configs = await prisma.systemConfig.findMany({
      where: { category, isActive: true },
      orderBy: { key: 'asc' },
    })

    return configs.map(c => ({
      key: c.key,
      value: c.value as ConfigValue,
      description: c.description,
      version: c.version,
      updatedAt: c.updatedAt,
    }))
  }

  /**
   * Update configuration with version control
   */
  static async update(params: {
    key: string
    value: ConfigValue
    updatedBy: string
    changeReason?: string
  }): Promise<void> {
    const { key, value, updatedBy, changeReason } = params

    await prisma.$transaction(async (tx) => {
      // Get current config
      const current = await tx.systemConfig.findUnique({
        where: { key },
      })

      if (!current) {
        throw new Error(`Configuration not found: ${key}`)
      }

      // Save to history
      await tx.configHistory.create({
        data: {
          configId: current.id,
          version: current.version,
          previousValue: current.value,
          newValue: value,
          changedBy: updatedBy,
          changeReason,
        },
      })

      // Update config
      await tx.systemConfig.update({
        where: { key },
        data: {
          value,
          version: { increment: 1 },
          updatedBy,
        },
      })

      // Audit log
      await tx.auditLog.create({
        data: {
          entityType: 'SystemConfig',
          entityId: current.id,
          action: 'UPDATE',
          performedBy: updatedBy,
          changes: {
            key,
            previousVersion: current.version,
            newVersion: current.version + 1,
            changeReason,
          },
        },
      })
    })
  }

  /**
   * Create new configuration
   */
  static async create(params: {
    key: string
    value: ConfigValue
    description?: string
    category: ConfigCategory
    scope?: ConfigScope
    cityCode?: string
    createdBy: string
  }): Promise<void> {
    const { key, value, description, category, scope, cityCode, createdBy } = params

    await prisma.systemConfig.create({
      data: {
        key,
        value,
        description,
        category,
        scope: scope || 'GLOBAL',
        cityCode,
        updatedBy: createdBy,
      },
    })
  }

  /**
   * Get configuration history
   */
  static async getHistory(key: string): Promise<Array<{
    version: number
    previousValue: ConfigValue
    newValue: ConfigValue
    changedBy: { id: string; name: string; email: string }
    changeReason: string | null
    createdAt: Date
  }>> {
    const config = await prisma.systemConfig.findUnique({
      where: { key },
      select: { id: true },
    })

    if (!config) return []

    const history = await prisma.configHistory.findMany({
      where: { configId: config.id },
      include: {
        changer: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { version: 'desc' },
    })

    return history.map(h => ({
      version: h.version,
      previousValue: h.previousValue as ConfigValue,
      newValue: h.newValue as ConfigValue,
      changedBy: h.changer,
      changeReason: h.changeReason,
      createdAt: h.createdAt,
    }))
  }

  /**
   * Rollback configuration to a previous version
   */
  static async rollback(params: {
    key: string
    targetVersion: number
    rolledBackBy: string
    reason: string
  }): Promise<void> {
    const { key, targetVersion, rolledBackBy, reason } = params

    await prisma.$transaction(async (tx) => {
      // Get config and target history
      const config = await tx.systemConfig.findUnique({
        where: { key },
      })

      if (!config) {
        throw new Error(`Configuration not found: ${key}`)
      }

      const targetHistory = await tx.configHistory.findFirst({
        where: {
          configId: config.id,
          version: targetVersion,
        },
      })

      if (!targetHistory) {
        throw new Error(`Version ${targetVersion} not found for ${key}`)
      }

      // The value we want to restore is the previousValue of the target history
      // (what the config was BEFORE that version's change)
      const restoreValue = targetHistory.previousValue

      // Save current to history first
      await tx.configHistory.create({
        data: {
          configId: config.id,
          version: config.version,
          previousValue: config.value,
          newValue: restoreValue,
          changedBy: rolledBackBy,
          changeReason: `Rollback to version ${targetVersion}: ${reason}`,
        },
      })

      // Update config
      await tx.systemConfig.update({
        where: { key },
        data: {
          value: restoreValue,
          version: { increment: 1 },
          updatedBy: rolledBackBy,
        },
      })

      // Audit log
      await tx.auditLog.create({
        data: {
          entityType: 'SystemConfig',
          entityId: config.id,
          action: 'ROLLBACK',
          performedBy: rolledBackBy,
          changes: {
            key,
            targetVersion,
            reason,
          },
        },
      })
    })
  }
}
```

---

## 4. Global Dashboard Implementation

### 4.1 Global Analytics API

```typescript
// src/app/api/analytics/global/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db-context'
import { z } from 'zod'

const querySchema = z.object({
  period: z.enum(['7d', '30d', '90d', '1y']).default('30d'),
  groupBy: z.enum(['city', 'region']).default('region'),
})

export async function GET(request: NextRequest) {
  const session = await auth()

  // Only global admins can access global analytics
  if (!session?.user?.isGlobalAdmin) {
    return NextResponse.json(
      { type: 'FORBIDDEN', title: 'Global admin access required' },
      { status: 403 }
    )
  }

  const searchParams = Object.fromEntries(request.nextUrl.searchParams)
  const { period, groupBy } = querySchema.parse(searchParams)

  // Calculate date range
  const now = new Date()
  const periodDays = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 }
  const startDate = new Date(now)
  startDate.setDate(startDate.getDate() - periodDays[period])

  // Global summary statistics
  const [
    totalDocuments,
    processedDocuments,
    avgConfidence,
    activeCities,
    activeUsers,
    regionStats,
    cityRankings,
    dailyTrend,
  ] = await Promise.all([
    // Total documents (all cities)
    prisma.document.count({
      where: { createdAt: { gte: startDate } },
    }),

    // Processed documents
    prisma.document.count({
      where: {
        createdAt: { gte: startDate },
        status: 'COMPLETED',
      },
    }),

    // Average confidence
    prisma.document.aggregate({
      where: {
        createdAt: { gte: startDate },
        confidence: { not: null },
      },
      _avg: { confidence: true },
    }),

    // Active cities
    prisma.city.count({
      where: { status: 'ACTIVE' },
    }),

    // Active users (logged in within period)
    prisma.user.count({
      where: {
        status: 'ACTIVE',
        lastLoginAt: { gte: startDate },
      },
    }),

    // Region statistics
    getRegionStats(startDate),

    // City rankings
    getCityRankings(startDate),

    // Daily trend
    getDailyTrend(startDate),
  ])

  return NextResponse.json({
    success: true,
    data: {
      period: {
        start: startDate.toISOString(),
        end: now.toISOString(),
      },
      global: {
        totalDocuments,
        processedDocuments,
        successRate: totalDocuments > 0 ? processedDocuments / totalDocuments : 0,
        averageConfidence: avgConfidence._avg.confidence || 0,
        activeCities,
        activeUsers,
      },
      regions: regionStats,
      cityRankings,
      trend: dailyTrend,
    },
  })
}

async function getRegionStats(startDate: Date) {
  const regions = await prisma.region.findMany({
    where: { status: 'ACTIVE' },
    include: {
      cities: {
        where: { status: 'ACTIVE' },
        select: { code: true },
      },
    },
  })

  const stats = await Promise.all(
    regions.map(async (region) => {
      const cityCodes = region.cities.map(c => c.code)

      if (cityCodes.length === 0) {
        return {
          regionCode: region.code,
          regionName: region.name,
          cities: 0,
          documents: 0,
          successRate: 0,
          confidence: 0,
          trend: 'stable' as const,
          trendValue: 0,
        }
      }

      const [docCount, completedCount, avgConf, prevPeriodCount] = await Promise.all([
        prisma.document.count({
          where: {
            cityCode: { in: cityCodes },
            createdAt: { gte: startDate },
          },
        }),
        prisma.document.count({
          where: {
            cityCode: { in: cityCodes },
            createdAt: { gte: startDate },
            status: 'COMPLETED',
          },
        }),
        prisma.document.aggregate({
          where: {
            cityCode: { in: cityCodes },
            createdAt: { gte: startDate },
            confidence: { not: null },
          },
          _avg: { confidence: true },
        }),
        // Previous period for trend
        prisma.document.count({
          where: {
            cityCode: { in: cityCodes },
            createdAt: {
              gte: new Date(startDate.getTime() - (Date.now() - startDate.getTime())),
              lt: startDate,
            },
          },
        }),
      ])

      const trendValue = prevPeriodCount > 0
        ? ((docCount - prevPeriodCount) / prevPeriodCount) * 100
        : 0

      return {
        regionCode: region.code,
        regionName: region.name,
        cities: cityCodes.length,
        documents: docCount,
        successRate: docCount > 0 ? completedCount / docCount : 0,
        confidence: avgConf._avg.confidence || 0,
        trend: trendValue > 5 ? 'up' : trendValue < -5 ? 'down' : 'stable',
        trendValue,
      }
    })
  )

  return stats.sort((a, b) => b.documents - a.documents)
}

async function getCityRankings(startDate: Date) {
  // By volume
  const byVolume = await prisma.document.groupBy({
    by: ['cityCode'],
    where: { createdAt: { gte: startDate } },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 10,
  })

  // Get city names
  const cityCodes = byVolume.map(v => v.cityCode)
  const cities = await prisma.city.findMany({
    where: { code: { in: cityCodes } },
    select: { code: true, name: true },
  })
  const cityNameMap = Object.fromEntries(cities.map(c => [c.code, c.name]))

  // By success rate (min 100 documents)
  const bySuccessRate = await prisma.$queryRaw<Array<{
    city_code: string
    success_rate: number
  }>>`
    SELECT
      city_code,
      AVG(CASE WHEN status = 'COMPLETED' THEN 1.0 ELSE 0.0 END) as success_rate
    FROM documents
    WHERE created_at >= ${startDate}
    GROUP BY city_code
    HAVING COUNT(*) >= 100
    ORDER BY success_rate DESC
    LIMIT 10
  `

  // By efficiency (avg processing time, lower is better)
  const byEfficiency = await prisma.$queryRaw<Array<{
    city_code: string
    avg_time: number
  }>>`
    SELECT
      city_code,
      AVG(processing_time) as avg_time
    FROM documents
    WHERE created_at >= ${startDate}
      AND processing_time IS NOT NULL
    GROUP BY city_code
    HAVING COUNT(*) >= 100
    ORDER BY avg_time ASC
    LIMIT 10
  `

  return {
    byVolume: byVolume.map(v => ({
      cityCode: v.cityCode,
      cityName: cityNameMap[v.cityCode] || v.cityCode,
      value: v._count.id,
    })),
    bySuccessRate: bySuccessRate.map(v => ({
      cityCode: v.city_code,
      cityName: cityNameMap[v.city_code] || v.city_code,
      value: v.success_rate,
    })),
    byEfficiency: byEfficiency.map(v => ({
      cityCode: v.city_code,
      cityName: cityNameMap[v.city_code] || v.city_code,
      value: v.avg_time,
    })),
  }
}

async function getDailyTrend(startDate: Date) {
  const trend = await prisma.$queryRaw<Array<{
    date: Date
    documents: bigint
    success_rate: number
  }>>`
    SELECT
      DATE(created_at) as date,
      COUNT(*) as documents,
      AVG(CASE WHEN status = 'COMPLETED' THEN 1.0 ELSE 0.0 END) as success_rate
    FROM documents
    WHERE created_at >= ${startDate}
    GROUP BY DATE(created_at)
    ORDER BY date
  `

  return trend.map(t => ({
    date: t.date.toISOString().split('T')[0],
    documents: Number(t.documents),
    successRate: t.success_rate,
  }))
}
```

### 4.2 Global Dashboard Page

```typescript
// src/app/(dashboard)/global/page.tsx
import { Suspense } from 'react'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { GlobalStats } from '@/components/global/GlobalStats'
import { RegionView } from '@/components/global/RegionView'
import { CityRankings } from '@/components/global/CityRankings'
import { GlobalTrend } from '@/components/global/GlobalTrend'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Globe, Building2, Trophy, TrendingUp, Settings } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function GlobalDashboardPage() {
  const session = await auth()

  // Only global admins can access
  if (!session?.user?.isGlobalAdmin) {
    redirect('/dashboard')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="h-6 w-6" />
            全球總覽
          </h1>
          <p className="text-muted-foreground">
            監控所有區域和城市的運營狀況
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/config">
            <Settings className="h-4 w-4 mr-2" />
            系統配置
          </Link>
        </Button>
      </div>

      {/* Global Statistics Cards */}
      <Suspense fallback={<Skeleton className="h-32" />}>
        <GlobalStats />
      </Suspense>

      {/* Tabbed Views */}
      <Tabs defaultValue="regions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="regions" className="gap-2">
            <Building2 className="h-4 w-4" />
            區域視圖
          </TabsTrigger>
          <TabsTrigger value="rankings" className="gap-2">
            <Trophy className="h-4 w-4" />
            城市排名
          </TabsTrigger>
          <TabsTrigger value="trend" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            趨勢分析
          </TabsTrigger>
        </TabsList>

        <TabsContent value="regions">
          <Suspense fallback={<Skeleton className="h-[500px]" />}>
            <RegionView />
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

### 4.3 Region View Component

```typescript
// src/components/global/RegionView.tsx
'use client'

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
    setExpandedRegions(prev =>
      prev.includes(regionCode)
        ? prev.filter(r => r !== regionCode)
        : [...prev, regionCode]
    )
  }

  if (isLoading) {
    return <div className="animate-pulse h-[500px] bg-muted rounded" />
  }

  const regions = data?.data?.regions || []

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">區域績效</h3>
        <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
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

      {/* Region Cards */}
      <div className="space-y-3">
        {regions.map((region: any) => (
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
                        <h4 className="text-lg font-semibold">{region.regionName}</h4>
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
                      <TrendBadge trend={region.trend} value={region.trendValue} />
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
      </div>
    </div>
  )
}

function TrendBadge({ trend, value }: { trend: string; value: number }) {
  const Icon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  const colorClass = trend === 'up'
    ? 'text-green-600 border-green-200 bg-green-50'
    : trend === 'down'
    ? 'text-red-600 border-red-200 bg-red-50'
    : 'text-gray-600 border-gray-200 bg-gray-50'

  return (
    <Badge variant="outline" className={`gap-1 ${colorClass}`}>
      <Icon className="h-3 w-3" />
      {value > 0 ? '+' : ''}{value.toFixed(1)}%
    </Badge>
  )
}

function RegionCitiesTable({ regionCode }: { regionCode: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['region-cities', regionCode],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/region/${regionCode}/cities`)
      if (!response.ok) throw new Error('Failed to fetch')
      return response.json()
    },
  })

  if (isLoading) {
    return <div className="h-32 animate-pulse bg-muted rounded" />
  }

  const cities = data?.data?.cities || []

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
        {cities.map((city: any) => (
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
```

---

## 5. System Configuration Management

### 5.1 Configuration API

```typescript
// src/app/api/admin/config/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { SystemConfigService } from '@/services/system-config'
import { z } from 'zod'

// GET /api/admin/config - List configurations
export async function GET(request: NextRequest) {
  const session = await auth()

  if (!session?.user?.isGlobalAdmin) {
    return NextResponse.json(
      { type: 'FORBIDDEN', title: 'Global admin access required' },
      { status: 403 }
    )
  }

  const category = request.nextUrl.searchParams.get('category')

  if (category) {
    const configs = await SystemConfigService.getByCategory(category as any)
    return NextResponse.json({ success: true, data: configs })
  }

  // Return all categories with their configs
  const categories = ['PROCESSING', 'NOTIFICATION', 'SECURITY', 'DISPLAY', 'INTEGRATION', 'AI_MODEL', 'THRESHOLD']
  const allConfigs: Record<string, any[]> = {}

  for (const cat of categories) {
    allConfigs[cat] = await SystemConfigService.getByCategory(cat as any)
  }

  return NextResponse.json({ success: true, data: allConfigs })
}

// PUT /api/admin/config/[key] - Update configuration
const updateSchema = z.object({
  value: z.record(z.unknown()),
  changeReason: z.string().max(500).optional(),
})

export async function PUT(request: NextRequest) {
  const session = await auth()

  if (!session?.user?.isGlobalAdmin) {
    return NextResponse.json(
      { type: 'FORBIDDEN', title: 'Global admin access required' },
      { status: 403 }
    )
  }

  const key = request.nextUrl.pathname.split('/').pop()
  const body = await request.json()
  const validation = updateSchema.safeParse(body)

  if (!validation.success) {
    return NextResponse.json(
      {
        type: 'VALIDATION_ERROR',
        title: 'Invalid request data',
        errors: validation.error.flatten().fieldErrors,
      },
      { status: 400 }
    )
  }

  try {
    await SystemConfigService.update({
      key: key!,
      value: validation.data.value,
      updatedBy: session.user.id,
      changeReason: validation.data.changeReason,
    })

    return NextResponse.json({
      success: true,
      message: 'Configuration updated',
    })
  } catch (error) {
    return NextResponse.json(
      { type: 'ERROR', title: (error as Error).message },
      { status: 400 }
    )
  }
}
```

### 5.2 Configuration Management Page

```typescript
// src/app/(dashboard)/admin/config/page.tsx
'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  Settings,
  History,
  RotateCcw,
  Save,
  AlertTriangle,
  Check,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'

const CATEGORY_LABELS: Record<string, string> = {
  PROCESSING: '處理設定',
  NOTIFICATION: '通知設定',
  SECURITY: '安全設定',
  DISPLAY: '顯示設定',
  INTEGRATION: '整合設定',
  AI_MODEL: 'AI 模型',
  THRESHOLD: '閾值設定',
}

interface SystemConfig {
  key: string
  value: Record<string, unknown>
  description: string | null
  version: number
  updatedAt: string
}

export default function SystemConfigPage() {
  const [selectedCategory, setSelectedCategory] = useState('PROCESSING')
  const [editingConfig, setEditingConfig] = useState<SystemConfig | null>(null)
  const [historyConfig, setHistoryConfig] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [changeReason, setChangeReason] = useState('')

  const queryClient = useQueryClient()

  const { data: configs, isLoading } = useQuery({
    queryKey: ['system-configs', selectedCategory],
    queryFn: async () => {
      const response = await fetch(`/api/admin/config?category=${selectedCategory}`)
      if (!response.ok) throw new Error('Failed to fetch')
      return response.json()
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (params: { key: string; value: any; reason?: string }) => {
      const response = await fetch(`/api/admin/config/${params.key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          value: params.value,
          changeReason: params.reason,
        }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.title)
      }
      return response.json()
    },
    onSuccess: () => {
      toast.success('配置已更新')
      queryClient.invalidateQueries({ queryKey: ['system-configs'] })
      setEditingConfig(null)
    },
    onError: (error) => {
      toast.error(`更新失敗: ${error.message}`)
    },
  })

  const handleEdit = (config: SystemConfig) => {
    setEditingConfig(config)
    setEditValue(JSON.stringify(config.value, null, 2))
    setChangeReason('')
  }

  const handleSave = () => {
    if (!editingConfig) return

    try {
      const parsedValue = JSON.parse(editValue)
      updateMutation.mutate({
        key: editingConfig.key,
        value: parsedValue,
        reason: changeReason || undefined,
      })
    } catch {
      toast.error('無效的 JSON 格式')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6" />
            系統配置
          </h1>
          <p className="text-muted-foreground">
            管理全局系統參數（變更將影響所有城市）
          </p>
        </div>
      </div>

      {/* Warning */}
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-yellow-800">
            <AlertTriangle className="h-5 w-5" />
            <p className="text-sm">
              配置變更會立即生效並影響所有城市。請確保您了解變更的影響，並在必要時先進行測試。
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Tabs */}
      <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
        <TabsList className="flex-wrap">
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <TabsTrigger key={key} value={key}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={selectedCategory} className="mt-4">
          {isLoading ? (
            <div className="h-64 animate-pulse bg-muted rounded" />
          ) : (
            <div className="space-y-4">
              {configs?.data?.map((config: SystemConfig) => (
                <Card key={config.key}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base font-mono">
                          {config.key}
                        </CardTitle>
                        {config.description && (
                          <CardDescription>{config.description}</CardDescription>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">v{config.version}</Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setHistoryConfig(config.key)}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(config)}
                        >
                          編輯
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
                      {JSON.stringify(config.value, null, 2)}
                    </pre>
                    <p className="text-xs text-muted-foreground mt-2">
                      最後更新: {formatDistanceToNow(new Date(config.updatedAt), {
                        addSuffix: true,
                        locale: zhTW,
                      })}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={!!editingConfig} onOpenChange={() => setEditingConfig(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>編輯配置: {editingConfig?.key}</DialogTitle>
            <DialogDescription>
              {editingConfig?.description}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>配置值 (JSON)</Label>
              <Textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="font-mono text-sm h-64"
              />
            </div>

            <div>
              <Label>變更原因（選填）</Label>
              <Input
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                placeholder="說明此次變更的原因"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingConfig(null)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />
              儲存變更
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <ConfigHistoryDialog
        configKey={historyConfig}
        open={!!historyConfig}
        onOpenChange={() => setHistoryConfig(null)}
      />
    </div>
  )
}

function ConfigHistoryDialog({
  configKey,
  open,
  onOpenChange,
}: {
  configKey: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: history, isLoading } = useQuery({
    queryKey: ['config-history', configKey],
    queryFn: async () => {
      const response = await fetch(`/api/admin/config/${configKey}/history`)
      if (!response.ok) throw new Error('Failed to fetch')
      return response.json()
    },
    enabled: !!configKey,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>配置歷史: {configKey}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="h-64 animate-pulse bg-muted rounded" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>版本</TableHead>
                <TableHead>變更者</TableHead>
                <TableHead>時間</TableHead>
                <TableHead>原因</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history?.data?.map((h: any) => (
                <TableRow key={h.version}>
                  <TableCell>
                    <Badge variant="outline">v{h.version}</Badge>
                  </TableCell>
                  <TableCell>{h.changedBy.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDistanceToNow(new Date(h.createdAt), {
                      addSuffix: true,
                      locale: zhTW,
                    })}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {h.changeReason || '-'}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

---

## 6. Testing Strategy

### 6.1 Global Admin Tests

```typescript
// __tests__/services/global-admin.test.ts
import { describe, it, expect } from 'vitest'
import { GlobalAdminService } from '@/services/global-admin'

describe('GlobalAdminService', () => {
  describe('grantGlobalAdminRole', () => {
    it('should grant global admin role', async () => {
      await GlobalAdminService.grantGlobalAdminRole(
        'user-1',
        'existing-admin'
      )

      const isAdmin = await GlobalAdminService.isGlobalAdmin('user-1')
      expect(isAdmin).toBe(true)
    })

    it('should reject if granter is not global admin', async () => {
      await expect(
        GlobalAdminService.grantGlobalAdminRole('user-2', 'non-admin')
      ).rejects.toThrow('Only global admins can grant')
    })
  })

  describe('revokeGlobalAdminRole', () => {
    it('should prevent removing last admin', async () => {
      await expect(
        GlobalAdminService.revokeGlobalAdminRole('last-admin', 'other-admin')
      ).rejects.toThrow('Cannot remove the last global admin')
    })
  })
})
```

---

## 7. Acceptance Criteria Verification

| AC | Description | Implementation | Verification |
|----|-------------|----------------|--------------|
| AC1 | 全球數據訪問 | RLS bypass for isGlobalAdmin | Global admin sees all city data |
| AC2 | 全球儀表板 | GlobalDashboardPage, GlobalStats | Dashboard shows all regions/cities |
| AC3 | 全局配置管理 | SystemConfigService, ConfigPage | Configs apply to all cities |
| AC4 | 區域層級視圖 | RegionView component | Expandable region→city hierarchy |

---

## 8. Security Considerations

1. **Admin Role Protection**: Cannot remove last global admin
2. **Audit Trail**: All config changes logged with reason
3. **Version Control**: Config rollback capability
4. **Access Validation**: Double-check isGlobalAdmin on sensitive operations
5. **Change Confirmation**: UI requires confirmation for critical changes

---

## 9. References

- Story 6.4 Requirements
- Story 6.3 Tech Spec (Regional Manager)
- Architecture Document: Admin Section
