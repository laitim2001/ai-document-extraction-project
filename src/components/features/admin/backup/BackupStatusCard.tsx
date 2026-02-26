'use client'

/**
 * @fileoverview 備份狀態摘要卡片
 * @description
 *   顯示備份系統的整體狀態摘要，包含：
 *   - 各狀態備份數量
 *   - 最後備份時間
 *   - 排程狀態
 *
 * @module src/components/features/admin/backup/BackupStatusCard
 * @since Epic 12 - Story 12-5 (數據備份管理)
 * @lastModified 2025-12-21
 */

import { useTranslations } from 'next-intl'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import {
  CheckCircle2,
  Clock,
  XCircle,
  PlayCircle,
  HardDrive,
  Calendar,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

// ============================================================
// Types
// ============================================================

interface BackupStatusCardProps {
  totalBackups: number
  completedBackups: number
  failedBackups: number
  runningBackups: number
  lastBackupTime: Date | null
  nextScheduledBackup: Date | null
  isLoading?: boolean
}

// ============================================================
// Component
// ============================================================

/**
 * 備份狀態摘要卡片
 */
export function BackupStatusCard({
  totalBackups,
  completedBackups,
  failedBackups,
  runningBackups,
  lastBackupTime,
  nextScheduledBackup,
  isLoading,
}: BackupStatusCardProps) {
  // --- i18n ---
  const t = useTranslations('admin')

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            {t('backup.statusCard.title')}
          </CardTitle>
          <CardDescription>{t('backup.statusCard.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  const stats = [
    {
      label: t('backup.statusCard.stats.completed'),
      value: completedBackups,
      icon: CheckCircle2,
      color: 'text-green-600',
      bg: 'bg-green-100',
    },
    {
      label: t('backup.statusCard.stats.running'),
      value: runningBackups,
      icon: PlayCircle,
      color: 'text-blue-600',
      bg: 'bg-blue-100',
    },
    {
      label: t('backup.statusCard.stats.failed'),
      value: failedBackups,
      icon: XCircle,
      color: 'text-red-600',
      bg: 'bg-red-100',
    },
    {
      label: t('backup.statusCard.stats.total'),
      value: totalBackups,
      icon: HardDrive,
      color: 'text-gray-600',
      bg: 'bg-gray-100',
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-5 w-5" />
          {t('backup.statusCard.title')}
        </CardTitle>
        <CardDescription>{t('backup.statusCard.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 狀態統計 */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon
            return (
              <div
                key={stat.label}
                className={`flex items-center gap-3 rounded-lg p-4 ${stat.bg}`}
              >
                <Icon className={`h-8 w-8 ${stat.color}`} />
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* 時間資訊 */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-lg border p-4">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{t('backup.statusCard.lastBackup')}</p>
              <p className="text-sm text-muted-foreground">
                {lastBackupTime
                  ? format(new Date(lastBackupTime), 'yyyy/MM/dd HH:mm', { locale: zhTW })
                  : t('backup.statusCard.noBackup')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg border p-4">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{t('backup.statusCard.nextScheduled')}</p>
              <p className="text-sm text-muted-foreground">
                {nextScheduledBackup
                  ? format(new Date(nextScheduledBackup), 'yyyy/MM/dd HH:mm', { locale: zhTW })
                  : t('backup.statusCard.noSchedule')}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
