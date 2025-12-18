'use client'

/**
 * @fileoverview 最近應用記錄表格組件
 * @description
 *   顯示映射規則的最近應用記錄：
 *   - 文件名稱和連結
 *   - 提取值
 *   - 準確性狀態（已驗證/未驗證）
 *   - 應用時間
 *
 * @module src/components/features/rules/RecentApplicationsTable
 * @since Epic 4 - Story 4.1 (映射規則列表與查看)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @/components/ui/table - shadcn Table 組件
 *   - @/components/ui/badge - shadcn Badge 組件
 *   - date-fns - 日期格式化
 */

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle, HelpCircle, ExternalLink } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import type { RecentApplication } from '@/types/rule'

// ============================================================
// Types
// ============================================================

interface RecentApplicationsTableProps {
  /** 應用記錄列表 */
  applications: RecentApplication[]
  /** 額外的 className */
  className?: string
}

// ============================================================
// Helper Components
// ============================================================

/**
 * 準確性狀態 Badge
 */
function AccuracyBadge({ isAccurate }: { isAccurate: boolean | null }) {
  if (isAccurate === null) {
    return (
      <Badge variant="outline" className="gap-1">
        <HelpCircle className="h-3 w-3" />
        未驗證
      </Badge>
    )
  }

  if (isAccurate) {
    return (
      <Badge
        variant="outline"
        className="gap-1 bg-green-100 text-green-700 border-0 dark:bg-green-900/30 dark:text-green-400"
      >
        <CheckCircle2 className="h-3 w-3" />
        正確
      </Badge>
    )
  }

  return (
    <Badge
      variant="outline"
      className="gap-1 bg-red-100 text-red-700 border-0 dark:bg-red-900/30 dark:text-red-400"
    >
      <XCircle className="h-3 w-3" />
      錯誤
    </Badge>
  )
}

// ============================================================
// Component
// ============================================================

/**
 * 最近應用記錄表格
 *
 * @example
 * ```tsx
 * <RecentApplicationsTable applications={rule.recentApplications} />
 * ```
 */
export function RecentApplicationsTable({
  applications,
  className,
}: RecentApplicationsTableProps) {
  // --- Empty State ---
  if (applications.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center p-8 text-center border rounded-lg bg-muted/20',
          className
        )}
      >
        <p className="text-muted-foreground">尚無應用記錄</p>
        <p className="text-xs text-muted-foreground mt-1">
          當規則被應用到文件提取時，記錄將顯示在這裡
        </p>
      </div>
    )
  }

  // --- Render ---
  return (
    <div className={cn('border rounded-lg overflow-hidden', className)}>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>文件</TableHead>
            <TableHead>提取值</TableHead>
            <TableHead className="w-[100px]">狀態</TableHead>
            <TableHead className="w-[140px]">應用時間</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {applications.map((app) => (
            <TableRow key={app.id}>
              {/* 文件名稱 */}
              <TableCell>
                <div className="max-w-[250px] truncate font-medium">
                  {app.documentName}
                </div>
              </TableCell>

              {/* 提取值 */}
              <TableCell>
                {app.extractedValue ? (
                  <code className="px-2 py-1 bg-muted rounded text-sm font-mono">
                    {app.extractedValue}
                  </code>
                ) : (
                  <span className="text-muted-foreground text-sm">無值</span>
                )}
              </TableCell>

              {/* 準確性狀態 */}
              <TableCell>
                <AccuracyBadge isAccurate={app.isAccurate} />
              </TableCell>

              {/* 應用時間 */}
              <TableCell className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(app.appliedAt), {
                  addSuffix: true,
                  locale: zhTW,
                })}
              </TableCell>

              {/* 查看文件連結 */}
              <TableCell>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/review/${app.documentId}`}>
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
