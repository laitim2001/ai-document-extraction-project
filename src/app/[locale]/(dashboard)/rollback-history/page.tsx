/**
 * @fileoverview 回滾歷史頁面
 * @description
 *   顯示系統的回滾歷史列表，提供：
 *   - 回滾記錄列表顯示
 *   - 按規則 ID 和觸發類型過濾
 *   - 分頁功能
 *
 * @module src/app/(dashboard)/rollback-history/page
 * @since Epic 4 - Story 4.8 (規則自動回滾)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @/hooks/use-rollback - 回滾 Hooks
 *   - shadcn/ui - UI 組件
 */

'use client'

import { useState } from 'react'
import { useRollbackHistory } from '@/hooks/use-rollback'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Pagination } from '@/components/ui/pagination'
import {
  AlertCircle,
  RotateCcw,
  Clock,
  User,
  AlertTriangle,
  Zap,
  Hand,
} from 'lucide-react'
import type { RollbackHistoryItem, RollbackTrigger } from '@/types/accuracy'

// ============================================================
// Types
// ============================================================

type TriggerFilter = RollbackTrigger | 'all'

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
 * 獲取觸發類型標籤
 */
function getTriggerBadge(trigger: RollbackTrigger) {
  const config: Record<RollbackTrigger, { label: string; variant: 'default' | 'secondary' | 'destructive'; icon: React.ReactNode }> = {
    AUTO: {
      label: '自動',
      variant: 'default',
      icon: <Zap className="mr-1 h-3 w-3" />,
    },
    MANUAL: {
      label: '手動',
      variant: 'secondary',
      icon: <Hand className="mr-1 h-3 w-3" />,
    },
    EMERGENCY: {
      label: '緊急',
      variant: 'destructive',
      icon: <AlertTriangle className="mr-1 h-3 w-3" />,
    },
  }

  const { label, variant, icon } = config[trigger]

  return (
    <Badge variant={variant} className="text-xs">
      {icon}
      {label}
    </Badge>
  )
}

/**
 * 格式化準確率百分比
 */
function formatAccuracy(accuracy: number | null): string {
  if (accuracy === null) return '數據不足'
  return `${(accuracy * 100).toFixed(1)}%`
}

// ============================================================
// Components
// ============================================================

/**
 * 載入骨架
 */
function LoadingSkeleton() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>規則 ID</TableHead>
          <TableHead>版本</TableHead>
          <TableHead>觸發類型</TableHead>
          <TableHead>準確率變化</TableHead>
          <TableHead>執行者</TableHead>
          <TableHead>時間</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[1, 2, 3, 4, 5].map((i) => (
          <TableRow key={i}>
            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
            <TableCell><Skeleton className="h-5 w-16" /></TableCell>
            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
            <TableCell><Skeleton className="h-4 w-28" /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

/**
 * 回滾記錄表格行
 */
function RollbackRow({ item }: { item: RollbackHistoryItem }) {
  return (
    <TableRow>
      <TableCell>
        <code className="text-xs bg-muted px-1 py-0.5 rounded">
          {item.ruleId.slice(0, 8)}...
        </code>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1 text-sm">
          <span className="text-muted-foreground">v{item.fromVersion}</span>
          <span>→</span>
          <span className="font-medium">v{item.toVersion}</span>
        </div>
      </TableCell>
      <TableCell>{getTriggerBadge(item.trigger)}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2 text-sm">
          {item.accuracyBefore !== null && item.accuracyAfter !== null ? (
            <>
              <span className="text-destructive">
                {formatAccuracy(item.accuracyBefore)}
              </span>
              <span>→</span>
              <span className="text-green-600">
                {formatAccuracy(item.accuracyAfter)}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">數據不足</span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <User className="h-3 w-3" />
          {item.trigger === 'AUTO' ? '系統自動' : '人工操作'}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Clock className="h-3 w-3" />
          {formatDate(item.createdAt)}
        </div>
      </TableCell>
    </TableRow>
  )
}

// ============================================================
// Main Page Component
// ============================================================

/**
 * 回滾歷史頁面
 */
export default function RollbackHistoryPage() {
  // 狀態
  const [page, setPage] = useState(1)
  const [trigger, setTrigger] = useState<TriggerFilter>('all')
  const pageSize = 20

  // 查詢回滾歷史
  const { data, isLoading, error } = useRollbackHistory({
    page,
    pageSize,
    trigger: trigger === 'all' ? undefined : trigger,
  })

  /**
   * 處理觸發類型過濾變更
   */
  const handleTriggerChange = (value: string) => {
    setTrigger(value as TriggerFilter)
    setPage(1) // 重置頁碼
  }

  /**
   * 處理頁碼變更
   */
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && (!data || newPage <= data.totalPages)) {
      setPage(newPage)
    }
  }

  // 渲染錯誤狀態
  if (error) {
    return (
      <div className="container max-w-6xl py-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>載入失敗</AlertTitle>
          <AlertDescription>
            {error.message || '無法載入回滾歷史'}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const { items = [], total = 0, totalPages = 0 } = data ?? {}

  return (
    <div className="container max-w-6xl py-6">
      {/* 頁面標題 */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <RotateCcw className="h-6 w-6" />
          <h1 className="text-2xl font-bold">回滾歷史</h1>
        </div>
        <p className="text-muted-foreground mt-1">
          查看系統的規則回滾記錄
        </p>
      </div>

      {/* 過濾器 */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">觸發類型：</span>
            <Select value={trigger} onValueChange={handleTriggerChange}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="全部" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="AUTO">自動回滾</SelectItem>
                <SelectItem value="MANUAL">手動回滾</SelectItem>
                <SelectItem value="EMERGENCY">緊急回滾</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          共 {total} 筆記錄
        </div>
      </div>

      {/* 回滾歷史表格 */}
      <Card>
        <CardHeader>
          <CardTitle>回滾記錄</CardTitle>
          <CardDescription>
            顯示所有規則的回滾歷史，包含自動、手動和緊急回滾
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingSkeleton />
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              暫無回滾記錄
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>規則 ID</TableHead>
                  <TableHead>版本</TableHead>
                  <TableHead>觸發類型</TableHead>
                  <TableHead>準確率變化</TableHead>
                  <TableHead>執行者</TableHead>
                  <TableHead>時間</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <RollbackRow key={item.id} item={item} />
                ))}
              </TableBody>
            </Table>
          )}

          {/* 分頁 */}
          {totalPages > 1 && (
            <div className="mt-4 flex justify-center">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
