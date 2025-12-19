'use client'

/**
 * @fileoverview Forwarder 詳情檢視主組件
 * @description
 *   整合 Forwarder 詳情頁面的所有子組件，提供：
 *   - 標題區域（名稱、狀態、返回按鈕）
 *   - Tabs 導航（總覽、規則、統計、文件）
 *   - 各 Tab 內容區域
 *
 * @module src/components/features/forwarders/ForwarderDetailView
 * @author Development Team
 * @since Epic 5 - Story 5.2 (Forwarder Detail Config View)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @/hooks/use-forwarder-detail - 數據獲取
 *   - @/types/forwarder - 類型定義
 *   - @/components/ui - UI 組件
 */

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useForwarderDetail } from '@/hooks/use-forwarder-detail'
import { ForwarderInfo } from './ForwarderInfo'
import { ForwarderStatsPanel } from './ForwarderStatsPanel'
import { ForwarderRulesTable } from './ForwarderRulesTable'
import { RecentDocumentsTable } from './RecentDocumentsTable'
import {
  FORWARDER_STATUS_CONFIG,
  getForwarderDisplayStatus,
} from '@/types/forwarder'
import { ArrowLeft, Building2, RefreshCw } from 'lucide-react'
import Link from 'next/link'

// ============================================================
// Types
// ============================================================

interface ForwarderDetailViewProps {
  /** Forwarder ID */
  forwarderId: string
}

// ============================================================
// Sub Components
// ============================================================

/**
 * 載入狀態骨架屏
 */
function DetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* 標題骨架 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-8 w-20" />
      </div>

      {/* Tabs 骨架 */}
      <Skeleton className="h-10 w-full max-w-md" />

      {/* 內容骨架 */}
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  )
}

/**
 * 錯誤狀態顯示
 */
function ErrorDisplay({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-destructive/10 p-4 mb-4">
        <Building2 className="h-8 w-8 text-destructive" />
      </div>
      <h2 className="text-lg font-semibold mb-2">無法載入 Forwarder 資料</h2>
      <p className="text-muted-foreground mb-4">{message}</p>
      <Link href="/forwarders">
        <Button variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回列表
        </Button>
      </Link>
    </div>
  )
}

/**
 * 404 狀態顯示
 */
function NotFoundDisplay() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <Building2 className="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold mb-2">找不到 Forwarder</h2>
      <p className="text-muted-foreground mb-4">
        該 Forwarder 可能已被刪除或您沒有權限存取
      </p>
      <Link href="/forwarders">
        <Button variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回列表
        </Button>
      </Link>
    </div>
  )
}

// ============================================================
// Main Component
// ============================================================

/**
 * Forwarder 詳情檢視主組件
 *
 * @description
 *   整合所有詳情頁面子組件，提供 Tabs 導航
 *
 * @param props - 組件屬性
 * @param props.forwarderId - Forwarder ID
 */
export function ForwarderDetailView({ forwarderId }: ForwarderDetailViewProps) {
  // 獲取 Forwarder 詳情
  const { forwarder, isLoading, error, refetch } = useForwarderDetail(forwarderId)

  // 載入中狀態
  if (isLoading) {
    return <DetailSkeleton />
  }

  // 錯誤狀態
  if (error) {
    return <ErrorDisplay message={error.message} />
  }

  // 找不到資料
  if (!forwarder) {
    return <NotFoundDisplay />
  }

  // 計算狀態顯示
  const displayStatus = getForwarderDisplayStatus(forwarder.isActive)
  const statusConfig = FORWARDER_STATUS_CONFIG[displayStatus]

  return (
    <div className="space-y-6">
      {/* 頁面標題區 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          {/* 返回按鈕 */}
          <Link href="/forwarders">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>

          {/* Logo 和名稱 */}
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold">
                  {forwarder.displayName || forwarder.name}
                </h1>
                <Badge className={statusConfig.className}>
                  {statusConfig.label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground font-mono">
                {forwarder.code}
              </p>
            </div>
          </div>
        </div>

        {/* 操作按鈕 */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            重新整理
          </Button>
        </div>
      </div>

      {/* Tabs 導航 */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-4">
          <TabsTrigger value="overview">總覽</TabsTrigger>
          <TabsTrigger value="rules">規則</TabsTrigger>
          <TabsTrigger value="stats">統計</TabsTrigger>
          <TabsTrigger value="documents">文件</TabsTrigger>
        </TabsList>

        {/* 總覽 Tab */}
        <TabsContent value="overview" className="space-y-4">
          <ForwarderInfo forwarder={forwarder} />
        </TabsContent>

        {/* 規則 Tab */}
        <TabsContent value="rules" className="space-y-4">
          <ForwarderRulesTable forwarderId={forwarderId} />
        </TabsContent>

        {/* 統計 Tab */}
        <TabsContent value="stats" className="space-y-4">
          <ForwarderStatsPanel stats={forwarder.stats} />
        </TabsContent>

        {/* 文件 Tab */}
        <TabsContent value="documents" className="space-y-4">
          <RecentDocumentsTable forwarderId={forwarderId} limit={10} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
