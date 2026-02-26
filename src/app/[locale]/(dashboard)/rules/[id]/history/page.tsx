/**
 * @fileoverview 規則版本歷史頁面
 * @description
 *   顯示規則的版本歷史列表，提供：
 *   - 版本時間線顯示
 *   - 版本選擇對比
 *   - 回滾操作入口
 *   - 分頁載入
 *
 * @module src/app/(dashboard)/rules/[id]/history/page
 * @since Epic 4 - Story 4.7 (規則版本歷史管理)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @/hooks/useVersions - 版本 Hooks
 *   - @/components/features/rule-version - 版本組件
 */

'use client'

import { useState, use } from 'react'
import Link from 'next/link'
import { useVersions, useManualRollback } from '@/hooks/useVersions'
import { VersionCompareDialog } from '@/components/features/rule-version'
import { RollbackConfirmDialog } from '@/components/features/rule-version'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertCircle,
  ArrowLeft,
  GitCompare,
  RotateCcw,
  Clock,
  User,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { VersionSummary } from '@/types/version'

// ============================================================
// Types
// ============================================================

interface RuleVersionHistoryPageProps {
  params: Promise<{ id: string }>
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 格式化日期時間
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * 格式化相對時間
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return '剛剛'
  if (diffMins < 60) return `${diffMins} 分鐘前`
  if (diffHours < 24) return `${diffHours} 小時前`
  if (diffDays < 7) return `${diffDays} 天前`
  return formatDate(dateString)
}

// ============================================================
// Components
// ============================================================

/**
 * 版本時間線項目
 */
function VersionTimelineItem({
  version,
  isSelected,
  onSelect,
  onRollback,
  isRollbackDisabled,
}: {
  version: VersionSummary
  isSelected: boolean
  onSelect: (id: string, checked: boolean) => void
  onRollback: (version: VersionSummary) => void
  isRollbackDisabled: boolean
}) {
  return (
    <div
      className={cn(
        'relative pl-8 pb-8 border-l-2',
        version.isActive ? 'border-primary' : 'border-muted',
        'last:pb-0'
      )}
    >
      {/* 時間線節點 */}
      <div
        className={cn(
          'absolute left-[-9px] w-4 h-4 rounded-full',
          version.isActive
            ? 'bg-primary'
            : 'bg-muted border-2 border-background'
        )}
      />

      {/* 內容卡片 */}
      <div
        className={cn(
          'p-4 rounded-lg border',
          version.isActive && 'border-primary bg-primary/5',
          isSelected && 'ring-2 ring-primary/50'
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {/* 選擇框 */}
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked) =>
                onSelect(version.id, checked === true)
              }
              aria-label={`選擇版本 ${version.version}`}
            />

            <div>
              {/* 版本標題 */}
              <div className="flex items-center gap-2">
                <h4 className="font-medium">版本 {version.version}</h4>
                {version.isActive && (
                  <Badge variant="default" className="text-xs">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    當前版本
                  </Badge>
                )}
              </div>

              {/* 變更原因 */}
              {version.changeReason && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {version.changeReason}
                </p>
              )}

              {/* 元數據 */}
              <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatRelativeTime(version.createdAt)}
                </span>
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {version.createdBy.name || version.createdBy.email}
                </span>
              </div>
            </div>
          </div>

          {/* 回滾按鈕 */}
          {!version.isActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRollback(version)}
              disabled={isRollbackDisabled}
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              回滾
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * 載入骨架
 */
function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="relative pl-8">
          <Skeleton className="absolute left-[-9px] w-4 h-4 rounded-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ))}
    </div>
  )
}

// ============================================================
// Main Page Component
// ============================================================

/**
 * 規則版本歷史頁面
 */
export default function RuleVersionHistoryPage({
  params,
}: RuleVersionHistoryPageProps) {
  const { id: ruleId } = use(params)

  // 狀態
  const [selectedVersions, setSelectedVersions] = useState<string[]>([])
  const [compareDialogOpen, setCompareDialogOpen] = useState(false)
  const [rollbackDialogOpen, setRollbackDialogOpen] = useState(false)
  const [rollbackTarget, setRollbackTarget] = useState<VersionSummary | null>(
    null
  )

  // 查詢版本列表
  const { data, isLoading, error, refetch } = useVersions(ruleId)

  // 回滾 Mutation
  const { mutate: rollback, isPending: isRollingBack } =
    useManualRollback(ruleId)

  /**
   * 處理版本選擇
   */
  const handleVersionSelect = (versionId: string, checked: boolean) => {
    if (checked) {
      if (selectedVersions.length < 2) {
        setSelectedVersions([...selectedVersions, versionId])
      } else {
        // 最多選擇 2 個，替換最早選擇的
        setSelectedVersions([selectedVersions[1], versionId])
      }
    } else {
      setSelectedVersions(selectedVersions.filter((id) => id !== versionId))
    }
  }

  /**
   * 處理對比按鈕點擊
   */
  const handleCompare = () => {
    if (selectedVersions.length === 2) {
      setCompareDialogOpen(true)
    }
  }

  /**
   * 處理回滾按鈕點擊
   */
  const handleRollbackClick = (version: VersionSummary) => {
    setRollbackTarget(version)
    setRollbackDialogOpen(true)
  }

  /**
   * 處理回滾確認
   */
  const handleRollbackConfirm = (reason?: string) => {
    if (!rollbackTarget) return

    rollback(
      {
        targetVersionId: rollbackTarget.id,
        reason,
      },
      {
        onSuccess: (result) => {
          toast.success(`成功回滾到版本 ${result.toVersion}`)
          setRollbackDialogOpen(false)
          setRollbackTarget(null)
          setSelectedVersions([])
        },
        onError: (err) => {
          toast.error(`回滾失敗: ${err.message}`)
        },
      }
    )
  }

  /**
   * 處理回滾成功（從對比對話框）
   */
  const handleRollbackSuccess = () => {
    setSelectedVersions([])
    refetch()
  }

  // 渲染載入狀態
  if (isLoading) {
    return (
      <div className="container max-w-4xl py-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <LoadingSkeleton />
          </CardContent>
        </Card>
      </div>
    )
  }

  // 渲染錯誤狀態
  if (error) {
    return (
      <div className="container max-w-4xl py-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>載入失敗</AlertTitle>
          <AlertDescription>
            {error.message || '無法載入版本歷史'}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const { ruleName, versions, totalVersions } = data ?? {
    ruleName: '',
    versions: [],
    totalVersions: 0,
  }

  return (
    <div className="container max-w-4xl py-6">
      {/* 頁面標題 */}
      <div className="mb-6">
        <Link
          href={`/rules/${ruleId}`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          返回規則詳情
        </Link>
        <h1 className="text-2xl font-bold">版本歷史</h1>
        <p className="text-muted-foreground">{ruleName}</p>
      </div>

      {/* 操作工具列 */}
      <div className="mb-6 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          共 {totalVersions} 個版本
          {selectedVersions.length > 0 && (
            <span className="ml-2">
              （已選擇 {selectedVersions.length} 個）
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleCompare}
            disabled={selectedVersions.length !== 2}
          >
            <GitCompare className="mr-2 h-4 w-4" />
            對比選中版本
          </Button>
        </div>
      </div>

      {/* 版本時間線 */}
      <Card>
        <CardHeader>
          <CardTitle>版本時間線</CardTitle>
          <CardDescription>
            選擇兩個版本進行對比，或直接回滾到歷史版本
          </CardDescription>
        </CardHeader>
        <CardContent>
          {versions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暫無版本記錄
            </div>
          ) : (
            <div className="relative">
              {versions.map((version) => (
                <VersionTimelineItem
                  key={version.id}
                  version={version}
                  isSelected={selectedVersions.includes(version.id)}
                  onSelect={handleVersionSelect}
                  onRollback={handleRollbackClick}
                  isRollbackDisabled={isRollingBack}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 對比對話框 */}
      <VersionCompareDialog
        ruleId={ruleId}
        versionId1={selectedVersions[0] ?? null}
        versionId2={selectedVersions[1] ?? null}
        open={compareDialogOpen}
        onOpenChange={setCompareDialogOpen}
        onRollbackSuccess={handleRollbackSuccess}
      />

      {/* 回滾確認對話框 */}
      <RollbackConfirmDialog
        open={rollbackDialogOpen}
        onOpenChange={setRollbackDialogOpen}
        onConfirm={handleRollbackConfirm}
        isLoading={isRollingBack}
        targetVersion={rollbackTarget?.version}
      />
    </div>
  )
}
