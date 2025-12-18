/**
 * @fileoverview 審核隊列表格組件
 * @description
 *   顯示待審核發票列表的表格，包含：
 *   - 文件名稱
 *   - Forwarder
 *   - 上傳時間（相對時間）
 *   - 信心度 Badge
 *   - 處理路徑 Badge
 *
 * @module src/components/features/review/ReviewQueueTable
 * @since Epic 3 - Story 3.1
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @/components/ui/table - shadcn Table 組件
 *   - date-fns - 日期格式化
 *   - @/types/review - 類型定義
 */

'use client'

import type { ReviewQueueItem } from '@/types/review'
import { ConfidenceBadge } from './ConfidenceBadge'
import { ProcessingPathBadge } from './ProcessingPathBadge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'

// ============================================================
// Types
// ============================================================

interface ReviewQueueTableProps {
  /** 審核項目列表 */
  items: ReviewQueueItem[]
  /** 選擇項目回調 */
  onSelectItem: (documentId: string) => void
}

// ============================================================
// Component
// ============================================================

/**
 * 審核隊列表格
 * 顯示待審核發票列表，點擊可進入詳情
 *
 * @example
 * ```tsx
 * <ReviewQueueTable
 *   items={data.data}
 *   onSelectItem={(id) => router.push(`/review/${id}`)}
 * />
 * ```
 */
export function ReviewQueueTable({
  items,
  onSelectItem,
}: ReviewQueueTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[300px]">文件名</TableHead>
            <TableHead>Forwarder</TableHead>
            <TableHead>上傳時間</TableHead>
            <TableHead className="text-center">信心度</TableHead>
            <TableHead>處理路徑</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow
              key={item.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onSelectItem(item.document.id)}
            >
              <TableCell className="font-medium">
                <span
                  className="truncate block max-w-[280px]"
                  title={item.document.fileName}
                >
                  {item.document.fileName}
                </span>
              </TableCell>
              <TableCell>
                {item.forwarder?.name || (
                  <span className="text-muted-foreground">未識別</span>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDistanceToNow(new Date(item.document.createdAt), {
                  addSuffix: true,
                  locale: zhTW,
                })}
              </TableCell>
              <TableCell className="text-center">
                <ConfidenceBadge score={item.overallConfidence} />
              </TableCell>
              <TableCell>
                <ProcessingPathBadge path={item.processingPath} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
