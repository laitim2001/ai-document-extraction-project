'use client'

/**
 * @fileoverview 存儲指標卡片組件
 * @description
 *   顯示資料保留系統的存儲使用狀況和成本分析。
 *   包含各層級存儲使用量、壓縮效率和成本節省統計。
 *
 * @module src/components/features/retention/StorageMetricsCard
 * @author Development Team
 * @since Epic 8 - Story 8.6 (Long-term Data Retention)
 * @lastModified 2025-12-20
 *
 * @dependencies
 *   - @/hooks/useRetention - 存儲指標 Hook
 *   - @/components/ui - UI 組件
 *
 * @related
 *   - src/app/(dashboard)/admin/retention/page.tsx - 資料保留管理頁面
 */

import { useTranslations } from 'next-intl'
import { useStorageMetrics } from '@/hooks/useRetention'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Database,
  HardDrive,
  Archive,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import { STORAGE_TIER_CONFIG } from '@/types/retention'
import type { StorageTier } from '@prisma/client'
import { cn } from '@/lib/utils'

// ============================================================
// Types
// ============================================================

interface StorageMetricsCardProps {
  className?: string
}

// ============================================================
// Helpers
// ============================================================

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`
}

// ============================================================
// Component
// ============================================================

/**
 * 存儲指標卡片組件
 *
 * @description
 *   顯示存儲使用狀況、壓縮效率和成本統計。
 */
export function StorageMetricsCard({ className }: StorageMetricsCardProps) {
  const t = useTranslations('dataRetention')
  const { data: metrics, isLoading, error } = useStorageMetrics()

  if (isLoading) {
    return <StorageMetricsSkeleton />
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-10">
          <div className="text-center text-muted-foreground">
            <AlertCircle className="mx-auto h-8 w-8 mb-2" />
            <p>{t('storage.loadError')}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!metrics) {
    return null
  }

  const totalCost = Object.values(metrics.byTier).reduce(
    (sum, tier) => sum + tier.estimatedCost,
    0
  )

  return (
    <div className={cn('grid gap-4 md:grid-cols-2 lg:grid-cols-4', className)}>
      {/* 總存儲量 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('storage.totalStorage')}</CardTitle>
          <Database className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatBytes(metrics.totalSizeBytes)}</div>
          <p className="text-xs text-muted-foreground">
            {t('storage.estimatedMonthlyCost', { cost: formatCost(totalCost) })}
          </p>
        </CardContent>
      </Card>

      {/* 壓縮節省 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('storage.compressionSaved')}</CardTitle>
          <TrendingDown className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {metrics.compressionStats.savedPercentage.toFixed(1)}%
          </div>
          <p className="text-xs text-muted-foreground">
            {t('storage.savedAmount', { size: formatBytes(metrics.compressionStats.savedBytes) })}
          </p>
        </CardContent>
      </Card>

      {/* 歸檔統計 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('storage.archiveStatus')}</CardTitle>
          <Archive className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.archiveStats.totalArchived}</div>
          <div className="flex gap-2 mt-1">
            {metrics.archiveStats.pendingArchive > 0 && (
              <Badge variant="outline" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                {t('storage.pendingCount', { count: metrics.archiveStats.pendingArchive })}
              </Badge>
            )}
            {metrics.archiveStats.failedArchive > 0 && (
              <Badge variant="destructive" className="text-xs">
                <AlertCircle className="h-3 w-3 mr-1" />
                {t('storage.failedCount', { count: metrics.archiveStats.failedArchive })}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 還原統計 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('storage.restoreStatus')}</CardTitle>
          <HardDrive className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.restoreStats.completedRestores}</div>
          <div className="flex gap-2 mt-1">
            {metrics.restoreStats.pendingRestores > 0 && (
              <Badge variant="outline" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                {t('storage.processingCount', { count: metrics.restoreStats.pendingRestores })}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {t('storage.averageMinutes', { minutes: Math.round(metrics.restoreStats.averageRestoreTime / 60) })}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 存儲層級分佈 */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-sm font-medium">{t('storage.tierDistribution')}</CardTitle>
          <CardDescription>{t('storage.tierDistributionDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(Object.keys(STORAGE_TIER_CONFIG) as StorageTier[]).map((tier) => {
            const tierData = metrics.byTier[tier]
            const percentage =
              metrics.totalSizeBytes > 0
                ? (tierData.sizeBytes / metrics.totalSizeBytes) * 100
                : 0

            return (
              <div key={tier} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        'h-3 w-3 rounded-full',
                        tier === 'HOT' && 'bg-red-500',
                        tier === 'COOL' && 'bg-blue-500',
                        tier === 'COLD' && 'bg-cyan-500',
                        tier === 'ARCHIVE' && 'bg-gray-500'
                      )}
                    />
                    <span className="text-sm font-medium">{t(`tier.${tier}`)}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatBytes(tierData.sizeBytes)} ({t('storage.recordCount', { count: tierData.recordCount })})
                  </div>
                </div>
                <Progress value={percentage} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{t('storage.costPerMonth', { cost: formatCost(tierData.estimatedCost) })}</span>
                  <span>{t(`tierConfig.${tier}`)}</span>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* 資料類型分佈 */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-sm font-medium">{t('storage.dataTypeDistribution')}</CardTitle>
          <CardDescription>{t('storage.dataTypeDistributionDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(metrics.byDataType).map(([dataType, data]) => {
              if (!data) return null
              const percentage =
                metrics.totalSizeBytes > 0
                  ? (data.sizeBytes / metrics.totalSizeBytes) * 100
                  : 0

              return (
                <div key={dataType} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">
                      {t.has(`dataType.${dataType}`) ? t(`dataType.${dataType}`) : dataType}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <Progress value={percentage} className="w-24 h-2" />
                    <span className="text-sm text-muted-foreground w-24 text-right">
                      {formatBytes(data.sizeBytes)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* 刪除統計 */}
      <Card className="md:col-span-2 lg:col-span-4">
        <CardHeader>
          <CardTitle className="text-sm font-medium">{t('storage.deletionActivity')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-8">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-sm font-medium">{t('storage.pendingApproval')}</p>
                <p className="text-2xl font-bold">{metrics.deletionStats.pendingDeletions}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium">{t('storage.completed')}</p>
                <p className="text-2xl font-bold">{metrics.deletionStats.completedDeletions}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{t('storage.totalDeletedRecords')}</p>
                <p className="text-2xl font-bold">
                  {metrics.deletionStats.totalDeletedRecords.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// Skeleton
// ============================================================

function StorageMetricsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-3 w-24" />
          </CardContent>
        </Card>
      ))}
      <Card className="md:col-span-2">
        <CardHeader>
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
      <Card className="md:col-span-2">
        <CardHeader>
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
