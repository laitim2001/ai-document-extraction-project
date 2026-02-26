'use client'

/**
 * @fileoverview 儲存使用量卡片
 * @description
 *   顯示備份儲存空間使用狀況，包含：
 *   - 總使用量/上限
 *   - 各類別使用量
 *   - 使用量進度條
 *
 * @module src/components/features/admin/backup/StorageUsageCard
 * @since Epic 12 - Story 12-5 (數據備份管理)
 * @lastModified 2025-12-21
 */

import { useTranslations } from 'next-intl'
import { Database, File, Settings, HardDrive, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { formatFileSize } from '@/types/backup'

// ============================================================
// Types
// ============================================================

interface StorageBreakdown {
  database: number
  files: number
  config: number
  fullSystem: number
}

interface StorageUsageCardProps {
  totalUsed: number
  totalLimit: number
  breakdown: StorageBreakdown
  isLoading?: boolean
}

// ============================================================
// Component
// ============================================================

/**
 * 儲存使用量卡片
 */
export function StorageUsageCard({
  totalUsed,
  totalLimit,
  breakdown,
  isLoading,
}: StorageUsageCardProps) {
  // --- i18n ---
  const t = useTranslations('admin')

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            {t('backup.storage.title')}
          </CardTitle>
          <CardDescription>{t('backup.storage.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    )
  }

  const usagePercent = totalLimit > 0 ? (totalUsed / totalLimit) * 100 : 0
  const isWarning = usagePercent >= 80
  const isCritical = usagePercent >= 95

  const categories = [
    {
      key: 'database',
      value: breakdown.database,
      icon: Database,
      color: 'bg-blue-500',
    },
    {
      key: 'files',
      value: breakdown.files,
      icon: File,
      color: 'bg-green-500',
    },
    {
      key: 'config',
      value: breakdown.config,
      icon: Settings,
      color: 'bg-orange-500',
    },
    {
      key: 'fullSystem',
      value: breakdown.fullSystem,
      icon: HardDrive,
      color: 'bg-purple-500',
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-5 w-5" />
          {t('backup.storage.title')}
        </CardTitle>
        <CardDescription>{t('backup.storage.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 警告提示 */}
        {isCritical && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {t('backup.storage.criticalAlert')}
            </AlertDescription>
          </Alert>
        )}
        {isWarning && !isCritical && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {t('backup.storage.warningAlert')}
            </AlertDescription>
          </Alert>
        )}

        {/* 總使用量 */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>{t('backup.storage.totalUsage')}</span>
            <span className={isCritical ? 'text-red-600 font-medium' : ''}>
              {formatFileSize(totalUsed)} / {formatFileSize(totalLimit)}
            </span>
          </div>
          <Progress
            value={usagePercent}
            className={`h-3 ${isCritical ? '[&>div]:bg-red-500' : isWarning ? '[&>div]:bg-yellow-500' : ''}`}
          />
          <p className="text-xs text-muted-foreground text-right">
            {t('backup.storage.percentUsed', { percent: usagePercent.toFixed(1) })}
          </p>
        </div>

        {/* 分類使用量 */}
        <div className="grid gap-3 sm:grid-cols-2">
          {categories.map((category) => {
            const Icon = category.icon
            const percent = totalUsed > 0 ? (category.value / totalUsed) * 100 : 0

            return (
              <div key={category.key} className="flex items-center gap-3 rounded-lg border p-3">
                <div className={`rounded-full p-2 ${category.color.replace('bg-', 'bg-opacity-20 ')}`}>
                  <Icon className={`h-4 w-4 ${category.color.replace('bg-', 'text-')}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{t(`backup.storage.categories.${category.key}`)}</span>
                    <span className="text-muted-foreground">{formatFileSize(category.value)}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full ${category.color}`}
                      style={{ width: `${Math.min(percent, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
