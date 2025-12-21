'use client'

/**
 * @fileoverview 備份管理主組件
 * @description
 *   提供完整的備份管理介面，包含：
 *   - 備份狀態摘要
 *   - 儲存使用量監控
 *   - 備份記錄列表
 *   - 備份排程管理
 *   - 手動備份操作
 *
 * @module src/components/features/admin/backup/BackupManagement
 * @since Epic 12 - Story 12-5 (數據備份管理)
 * @lastModified 2025-12-21
 *
 * @features
 *   - 備份狀態即時監控
 *   - 儲存空間使用量追蹤
 *   - 備份記錄篩選與操作
 *   - 排程 CRUD 操作
 *   - 手動備份建立
 *
 * @dependencies
 *   - BackupStatusCard - 狀態摘要卡片
 *   - StorageUsageCard - 儲存使用量卡片
 *   - BackupList - 備份列表
 *   - BackupScheduleList - 排程列表
 *   - CreateBackupDialog - 建立備份對話框
 *   - ScheduleDialog - 排程對話框
 */

import { useState, useCallback } from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { BackupStatusCard } from './BackupStatusCard'
import { StorageUsageCard } from './StorageUsageCard'
import { BackupList } from './BackupList'
import { BackupScheduleList } from './BackupScheduleList'
import { CreateBackupDialog } from './CreateBackupDialog'
import { ScheduleDialog } from './ScheduleDialog'
import { useBackupSummary, useStorageUsage } from '@/hooks/use-backup'
import { useBackupSchedules } from '@/hooks/use-backup-schedule'
import type { BackupScheduleListItem } from '@/types/backup'

// ============================================================
// Component
// ============================================================

/**
 * 備份管理主組件
 */
export function BackupManagement() {
  // --- State ---
  const [activeTab, setActiveTab] = useState('overview')
  const [createBackupOpen, setCreateBackupOpen] = useState(false)
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<BackupScheduleListItem | null>(null)

  // --- Hooks ---
  const { data: summaryData, isLoading: summaryLoading, refetch: refetchSummary } = useBackupSummary()
  const { data: storageData, isLoading: storageLoading, refetch: refetchStorage } = useStorageUsage()
  const { data: schedulesData } = useBackupSchedules({ limit: 1 })

  // --- Computed ---
  const summary = summaryData?.data
  const storage = storageData?.data
  const nextScheduledBackup = schedulesData?.data.schedules[0]?.nextRunAt || null

  // --- Handlers ---
  const handleRefresh = useCallback(() => {
    refetchSummary()
    refetchStorage()
  }, [refetchSummary, refetchStorage])

  const handleEditSchedule = useCallback((schedule: BackupScheduleListItem) => {
    setEditingSchedule(schedule)
    setScheduleDialogOpen(true)
  }, [])

  const handleAddSchedule = useCallback(() => {
    setEditingSchedule(null)
    setScheduleDialogOpen(true)
  }, [])

  const handleScheduleDialogClose = useCallback((open: boolean) => {
    setScheduleDialogOpen(open)
    if (!open) {
      setEditingSchedule(null)
    }
  }, [])

  return (
    <div className="space-y-6">
      {/* 標題列 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">備份管理</h2>
          <p className="text-muted-foreground mt-1">管理系統備份與排程</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            重新整理
          </Button>
          <Button size="sm" onClick={() => setCreateBackupOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            手動備份
          </Button>
        </div>
      </div>

      {/* 標籤頁 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">總覽</TabsTrigger>
          <TabsTrigger value="backups">備份記錄</TabsTrigger>
          <TabsTrigger value="schedules">排程管理</TabsTrigger>
        </TabsList>

        {/* 總覽標籤 */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          {/* 狀態與儲存卡片 */}
          <div className="grid gap-6 lg:grid-cols-2">
            <BackupStatusCard
              totalBackups={summary?.recentBackups?.total ?? 0}
              completedBackups={summary?.recentBackups?.successful ?? 0}
              failedBackups={summary?.recentBackups?.failed ?? 0}
              runningBackups={summary?.recentBackups?.pending ?? 0}
              lastBackupTime={summary?.lastBackup?.completedAt ? new Date(summary.lastBackup.completedAt) : null}
              nextScheduledBackup={nextScheduledBackup ? new Date(nextScheduledBackup) : null}
              isLoading={summaryLoading}
            />

            <StorageUsageCard
              totalUsed={Number(storage?.summary?.usedBytes ?? 0)}
              totalLimit={Number(storage?.summary?.totalBytes ?? 100 * 1024 * 1024 * 1024)} // 100GB default
              breakdown={{
                database: Number(storage?.summary?.bySource?.database ?? 0),
                files: Number(storage?.summary?.bySource?.files ?? 0),
                config: Number(storage?.summary?.bySource?.config ?? 0),
                fullSystem: 0, // Not in current type, default to 0
              }}
              isLoading={storageLoading}
            />
          </div>

          {/* 最近備份 */}
          <BackupList />
        </TabsContent>

        {/* 備份記錄標籤 */}
        <TabsContent value="backups" className="mt-6">
          <BackupList />
        </TabsContent>

        {/* 排程管理標籤 */}
        <TabsContent value="schedules" className="mt-6">
          <BackupScheduleList onEdit={handleEditSchedule} onAdd={handleAddSchedule} />
        </TabsContent>
      </Tabs>

      {/* 建立備份對話框 */}
      <CreateBackupDialog open={createBackupOpen} onOpenChange={setCreateBackupOpen} />

      {/* 排程對話框 */}
      <ScheduleDialog
        open={scheduleDialogOpen}
        onOpenChange={handleScheduleDialogClose}
        schedule={editingSchedule}
      />
    </div>
  )
}

export default BackupManagement
