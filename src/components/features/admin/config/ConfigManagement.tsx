'use client'

/**
 * @fileoverview 系統配置管理主組件
 * @description
 *   提供完整的系統配置管理介面，包含分類瀏覽、搜尋、編輯、
 *   歷史查看和回滾等功能。
 *
 * @module src/components/features/admin/config/ConfigManagement
 * @author Development Team
 * @since Epic 12 - Story 12-4 (系統設定管理)
 * @lastModified 2025-12-21
 *
 * @features
 *   - 分類標籤切換 (PROCESSING, INTEGRATION, SECURITY, NOTIFICATION, SYSTEM)
 *   - 配置搜尋過濾
 *   - 配置編輯對話框
 *   - 歷史記錄查看與回滾
 *   - 重置為預設值
 *   - 快取重新載入
 *
 * @dependencies
 *   - lucide-react - 圖示
 *   - sonner - Toast 通知
 *
 * @related
 *   - src/hooks/use-system-config.ts - 配置 Hooks
 *   - src/components/features/admin/config/ConfigItem.tsx - 配置項目
 *   - src/components/features/admin/config/ConfigEditDialog.tsx - 編輯對話框
 *   - src/components/features/admin/config/ConfigHistoryDialog.tsx - 歷史對話框
 */

import { useState, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { RefreshCw, Search, Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { ConfigCategory } from '@prisma/client'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ConfigItem } from './ConfigItem'
import { ConfigEditDialog } from './ConfigEditDialog'
import { ConfigHistoryDialog } from './ConfigHistoryDialog'
import {
  useConfigs,
  useConfigHistory,
  useUpdateConfig,
  useRollbackConfig,
  useResetConfig,
  useReloadConfigs,
} from '@/hooks/use-system-config'
import { CATEGORY_INFO } from '@/types/config'
import type { ConfigValue } from '@/types/config'

// ============================================================
// Types
// ============================================================

type GroupedConfigs = Record<ConfigCategory, ConfigValue[]>

// ============================================================
// Component
// ============================================================

/**
 * 系統配置管理主組件
 *
 * @description
 *   管理所有系統配置的主介面，包含：
 *   - 分類標籤導航
 *   - 配置搜尋
 *   - 配置列表顯示
 *   - 編輯、歷史、回滾功能
 */
export function ConfigManagement() {
  const t = useTranslations('admin')

  // --- State ---
  const [activeCategory, setActiveCategory] = useState<ConfigCategory>('PROCESSING')
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [editingConfig, setEditingConfig] = useState<ConfigValue | null>(null)
  const [historyConfigKey, setHistoryConfigKey] = useState<string | null>(null)
  const [historyConfigName, setHistoryConfigName] = useState<string>('')
  const [historyPage, setHistoryPage] = useState(1)
  const [confirmResetKey, setConfirmResetKey] = useState<string | null>(null)

  // --- Hooks ---
  const { data: configsData, isLoading, error, refetch } = useConfigs({
    search: debouncedSearch || undefined,
  })

  const { data: historyData, isLoading: historyLoading } = useConfigHistory(
    historyConfigKey || '',
    { limit: 10, offset: (historyPage - 1) * 10, enabled: !!historyConfigKey }
  )

  const updateConfigMutation = useUpdateConfig()
  const rollbackConfigMutation = useRollbackConfig()
  const resetConfigMutation = useResetConfig()
  const reloadConfigsMutation = useReloadConfigs()

  // --- Computed Values ---
  const configs = useMemo<GroupedConfigs>(() => {
    // API 返回的 data 是按類別分組的配置數組
    const data = configsData?.data ?? []
    const grouped: GroupedConfigs = {
      PROCESSING: [],
      INTEGRATION: [],
      SECURITY: [],
      NOTIFICATION: [],
      SYSTEM: [],
      DISPLAY: [],
      AI_MODEL: [],
      THRESHOLD: [],
    }

    for (const config of data) {
      if (grouped[config.category]) {
        grouped[config.category].push(config)
      }
    }

    return grouped
  }, [configsData])

  // --- Handlers ---

  /**
   * 處理搜尋輸入（防抖）
   */
  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value)
    // 防抖處理
    const timer = setTimeout(() => {
      setDebouncedSearch(value)
    }, 300)
    return () => clearTimeout(timer)
  }, [])

  /**
   * 儲存配置
   */
  const handleSaveConfig = useCallback(
    async (key: string, value: unknown, changeReason?: string) => {
      try {
        const result = await updateConfigMutation.mutateAsync({
          key,
          data: {
            value,
            changeReason,
          },
        })

        if (result.requiresRestart) {
          toast.warning(t('configManagement.toast.updatedRequiresRestart'), {
            duration: 5000,
          })
        } else {
          toast.success(t('configManagement.toast.updated'))
        }

        setEditingConfig(null)
      } catch (err) {
        const message = err instanceof Error ? err.message : t('configManagement.toast.updateError')
        toast.error(message)
        throw err
      }
    },
    [updateConfigMutation, t]
  )

  /**
   * 查看歷史記錄
   */
  const handleViewHistory = useCallback((config: ConfigValue) => {
    setHistoryConfigKey(config.key)
    setHistoryConfigName(config.name)
    setHistoryPage(1)
  }, [])

  /**
   * 回滾配置
   */
  const handleRollback = useCallback(
    async (historyId: string) => {
      if (!historyConfigKey) return

      try {
        await rollbackConfigMutation.mutateAsync({
          key: historyConfigKey,
          historyId,
        })
        toast.success(t('configManagement.toast.rolledBack'))
      } catch (err) {
        const message = err instanceof Error ? err.message : t('configManagement.toast.rollbackError')
        toast.error(message)
      }
    },
    [historyConfigKey, rollbackConfigMutation, t]
  )

  /**
   * 確認重置為預設值
   */
  const handleConfirmReset = useCallback(async () => {
    if (!confirmResetKey) return

    try {
      await resetConfigMutation.mutateAsync({ key: confirmResetKey })
      toast.success(t('configManagement.toast.reset'))
      setConfirmResetKey(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : t('configManagement.toast.resetError')
      toast.error(message)
    }
  }, [confirmResetKey, resetConfigMutation, t])

  /**
   * 重新載入快取
   */
  const handleReloadCache = useCallback(async () => {
    try {
      await reloadConfigsMutation.mutateAsync()
      toast.success(t('configManagement.toast.reloaded'))
    } catch (err) {
      const message = err instanceof Error ? err.message : t('configManagement.toast.reloadError')
      toast.error(message)
    }
  }, [reloadConfigsMutation, t])

  /**
   * 計算各類別的配置數量
   */
  const getCategoryCount = useCallback(
    (category: ConfigCategory): number => {
      return configs[category]?.length || 0
    },
    [configs]
  )

  /**
   * 計算已修改的配置數量
   */
  const getModifiedCount = useCallback(
    (category: ConfigCategory): number => {
      return configs[category]?.filter((c) => c.isModified).length || 0
    },
    [configs]
  )

  // --- Render ---

  // 載入中狀態
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">{t('configManagement.loading')}</span>
      </div>
    )
  }

  // 錯誤狀態
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {t('configManagement.loadError', { error: error instanceof Error ? error.message : t('configManagement.unknownError') })}
          <Button variant="link" className="ml-2 p-0 h-auto" onClick={() => refetch()}>
            {t('configManagement.retry')}
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {/* 頁面標題與操作按鈕 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('configManagement.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('configManagement.description')}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleReloadCache}
          disabled={reloadConfigsMutation.isPending}
        >
          <RefreshCw
            className={`w-4 h-4 mr-2 ${reloadConfigsMutation.isPending ? 'animate-spin' : ''}`}
          />
          {t('configManagement.reloadCache')}
        </Button>
      </div>

      {/* 搜尋欄 */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder={t('configManagement.searchPlaceholder')}
          className="pl-9"
        />
      </div>

      {/* 類別標籤 */}
      <Tabs
        value={activeCategory}
        onValueChange={(v) => setActiveCategory(v as ConfigCategory)}
      >
        <TabsList className="h-auto flex-wrap gap-1">
          {(Object.keys(CATEGORY_INFO) as ConfigCategory[]).map((category) => {
            const info = CATEGORY_INFO[category]
            const count = getCategoryCount(category)
            const modifiedCount = getModifiedCount(category)

            return (
              <TabsTrigger
                key={category}
                value={category}
                className="relative data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <span className="mr-1">{info.icon}</span>
                <span>{info.label}</span>
                <span className="ml-1 text-xs opacity-70">({count})</span>
                {modifiedCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
                  >
                    {modifiedCount}
                  </Badge>
                )}
              </TabsTrigger>
            )
          })}
        </TabsList>

        {/* 各類別內容 */}
        {(Object.keys(CATEGORY_INFO) as ConfigCategory[]).map((category) => (
          <TabsContent key={category} value={category} className="mt-6">
            <div className="bg-card rounded-lg border shadow-sm">
              {/* 類別描述 */}
              <div className="px-6 py-4 border-b bg-muted/50">
                <p className="text-sm text-muted-foreground">
                  {CATEGORY_INFO[category].description}
                </p>
              </div>

              {/* 配置列表 */}
              <div className="divide-y">
                {configs[category]?.length === 0 ? (
                  <div className="px-6 py-12 text-center text-muted-foreground">
                    {debouncedSearch ? t('configManagement.noMatch') : t('configManagement.empty')}
                  </div>
                ) : (
                  configs[category]?.map((config) => (
                    <ConfigItem
                      key={config.key}
                      config={config}
                      onEdit={() => setEditingConfig(config)}
                      onViewHistory={() => handleViewHistory(config)}
                      onResetToDefault={() => setConfirmResetKey(config.key)}
                    />
                  ))
                )}
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* 編輯對話框 */}
      {editingConfig && (
        <ConfigEditDialog
          open={!!editingConfig}
          onOpenChange={(open) => !open && setEditingConfig(null)}
          config={editingConfig}
          onSave={handleSaveConfig}
          isSaving={updateConfigMutation.isPending}
        />
      )}

      {/* 歷史對話框 */}
      {historyConfigKey && (
        <ConfigHistoryDialog
          open={!!historyConfigKey}
          onOpenChange={(open) => {
            if (!open) {
              setHistoryConfigKey(null)
              setHistoryConfigName('')
              setHistoryPage(1)
            }
          }}
          configKey={historyConfigKey}
          configName={historyConfigName}
          history={historyData?.data ?? []}
          isLoading={historyLoading}
          onRollback={handleRollback}
          isRollingBack={rollbackConfigMutation.isPending}
          pagination={
            historyData?.meta
              ? {
                  page: historyPage,
                  limit: historyData.meta.limit,
                  total: historyData.meta.total,
                  totalPages: Math.ceil(historyData.meta.total / historyData.meta.limit),
                }
              : undefined
          }
          onPageChange={setHistoryPage}
        />
      )}

      {/* 重置確認對話框 */}
      <AlertDialog
        open={!!confirmResetKey}
        onOpenChange={(open) => !open && setConfirmResetKey(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('configManagement.resetDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('configManagement.resetDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetConfigMutation.isPending}>
              {t('configManagement.resetDialog.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmReset}
              disabled={resetConfigMutation.isPending}
            >
              {resetConfigMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('configManagement.resetDialog.resetting')}
                </>
              ) : (
                t('configManagement.resetDialog.confirm')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default ConfigManagement
