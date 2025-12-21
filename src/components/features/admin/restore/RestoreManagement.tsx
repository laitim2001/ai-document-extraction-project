'use client'

/**
 * @fileoverview 數據恢復管理主組件
 * @description
 *   提供完整的數據恢復管理介面，包含：
 *   - 恢復統計摘要
 *   - 恢復記錄列表
 *   - 啟動恢復操作
 *   - 恢復詳情與進度追蹤
 *
 * @module src/components/features/admin/restore/RestoreManagement
 * @since Epic 12 - Story 12-6 (數據恢復功能)
 * @lastModified 2025-12-21
 *
 * @features
 *   - 恢復記錄瀏覽與篩選
 *   - 恢復操作即時狀態監控
 *   - 恢復日誌即時查看
 *   - 取消/回滾操作
 *
 * @dependencies
 *   - RestoreList - 恢復記錄列表
 *   - RestoreDialog - 啟動恢復對話框
 *   - RestoreDetailDialog - 恢復詳情對話框
 */

import { useState, useCallback } from 'react'
import { Plus, RefreshCw, Database, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { RestoreList } from './RestoreList'
import { RestoreDialog } from './RestoreDialog'
import { RestoreDetailDialog } from './RestoreDetailDialog'
import { useRestoreStats } from '@/hooks/use-restore'
import type { RestoreListItem } from '@/types/restore'

// ============================================================
// Types
// ============================================================

interface RestoreStatsCardProps {
  title: string
  value: number | string
  description: string
  icon: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'destructive'
  isLoading?: boolean
}

// ============================================================
// Sub Components
// ============================================================

function RestoreStatsCard({
  title,
  value,
  description,
  icon,
  variant = 'default',
  isLoading = false,
}: RestoreStatsCardProps) {
  const variantStyles = {
    default: 'bg-primary/10 text-primary',
    success: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    warning: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
    destructive: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={`p-2 rounded-md ${variantStyles[variant]}`}>{icon}</div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-8 w-16 bg-muted animate-pulse rounded" />
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================
// Main Component
// ============================================================

/**
 * 數據恢復管理主組件
 */
export function RestoreManagement() {
  // --- State ---
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [selectedRestore, setSelectedRestore] = useState<RestoreListItem | null>(null)

  // --- Hooks ---
  const { data: statsData, isLoading: statsLoading, refetch: refetchStats } = useRestoreStats()

  // --- Computed ---
  const stats = statsData?.data

  // --- Handlers ---
  const handleRefresh = useCallback(() => {
    refetchStats()
  }, [refetchStats])

  const handleViewDetails = useCallback((restore: RestoreListItem) => {
    setSelectedRestore(restore)
    setDetailDialogOpen(true)
  }, [])

  const handleDetailDialogClose = useCallback((open: boolean) => {
    setDetailDialogOpen(open)
    if (!open) {
      setSelectedRestore(null)
    }
  }, [])

  const formatDuration = (seconds: number | null | undefined): string => {
    if (!seconds) return '-'
    if (seconds < 60) return `${seconds} 秒`
    if (seconds < 3600) return `${Math.round(seconds / 60)} 分鐘`
    return `${Math.round(seconds / 3600)} 小時`
  }

  return (
    <div className="space-y-6">
      {/* 標題列 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">數據恢復</h2>
          <p className="text-muted-foreground mt-1">從備份恢復系統數據</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            重新整理
          </Button>
          <Button size="sm" onClick={() => setRestoreDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            開始恢復
          </Button>
        </div>
      </div>

      {/* 統計卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <RestoreStatsCard
          title="總恢復次數"
          value={stats?.totalRestores ?? 0}
          description="系統恢復操作次數"
          icon={<Database className="h-4 w-4" />}
          isLoading={statsLoading}
        />
        <RestoreStatsCard
          title="成功恢復"
          value={stats?.successfulRestores ?? 0}
          description="成功完成的恢復"
          icon={<CheckCircle2 className="h-4 w-4" />}
          variant="success"
          isLoading={statsLoading}
        />
        <RestoreStatsCard
          title="失敗恢復"
          value={stats?.failedRestores ?? 0}
          description="需要注意的失敗記錄"
          icon={<XCircle className="h-4 w-4" />}
          variant="destructive"
          isLoading={statsLoading}
        />
        <RestoreStatsCard
          title="平均恢復時間"
          value={formatDuration(stats?.averageRestoreTime)}
          description="恢復操作平均耗時"
          icon={<Clock className="h-4 w-4" />}
          isLoading={statsLoading}
        />
      </div>

      {/* 恢復記錄列表 */}
      <Card>
        <CardHeader>
          <CardTitle>恢復記錄</CardTitle>
          <CardDescription>查看所有恢復操作記錄</CardDescription>
        </CardHeader>
        <CardContent>
          <RestoreList onViewDetails={handleViewDetails} />
        </CardContent>
      </Card>

      {/* 啟動恢復對話框 */}
      <RestoreDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen} />

      {/* 恢復詳情對話框 */}
      <RestoreDetailDialog
        open={detailDialogOpen}
        onOpenChange={handleDetailDialogClose}
        restoreId={selectedRestore?.id ?? null}
      />
    </div>
  )
}

export default RestoreManagement
