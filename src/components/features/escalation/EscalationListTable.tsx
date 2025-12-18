'use client'

/**
 * @fileoverview 升級案例列表表格組件
 * @description
 *   顯示升級案例列表的表格，包含：
 *   - 文件名稱
 *   - Forwarder
 *   - 升級原因
 *   - 狀態
 *   - 升級者
 *   - 升級時間
 *   - 操作按鈕
 *
 * @module src/components/features/escalation/EscalationListTable
 * @since Epic 3 - Story 3.8 (Super User 處理升級案例)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @/components/ui/table - shadcn Table 組件
 *   - date-fns - 日期格式化
 *   - @/types/escalation - 類型定義
 */

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { EscalationStatusBadge } from './EscalationStatusBadge'
import { EscalationReasonBadge } from './EscalationReasonBadge'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { Eye } from 'lucide-react'
import type { EscalationListItem } from '@/types/escalation'

// ============================================================
// Types
// ============================================================

interface EscalationListTableProps {
  /** 升級案例列表 */
  items: EscalationListItem[]
  /** 選擇項目回調 */
  onSelectItem: (escalationId: string) => void
}

// ============================================================
// Component
// ============================================================

/**
 * 升級案例列表表格
 * 顯示待處理的升級案例，點擊可進入詳情
 *
 * @example
 * ```tsx
 * <EscalationListTable
 *   items={escalations}
 *   onSelectItem={(id) => router.push(`/escalations/${id}`)}
 * />
 * ```
 */
export function EscalationListTable({
  items,
  onSelectItem,
}: EscalationListTableProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center">
        <p className="text-muted-foreground">目前沒有升級案例</p>
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[250px]">文件名</TableHead>
            <TableHead>Forwarder</TableHead>
            <TableHead>升級原因</TableHead>
            <TableHead>狀態</TableHead>
            <TableHead>升級者</TableHead>
            <TableHead>升級時間</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id} className="group">
              <TableCell className="font-medium">
                <span
                  className="truncate block max-w-[230px]"
                  title={item.document.fileName}
                >
                  {item.document.fileName}
                </span>
              </TableCell>
              <TableCell>
                {item.document.forwarder?.name || (
                  <span className="text-muted-foreground">未識別</span>
                )}
              </TableCell>
              <TableCell>
                <EscalationReasonBadge reason={item.reason} showIcon />
              </TableCell>
              <TableCell>
                <EscalationStatusBadge status={item.status} />
              </TableCell>
              <TableCell>
                <span className="text-sm">
                  {item.escalatedBy.name || item.escalatedBy.email}
                </span>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDistanceToNow(new Date(item.createdAt), {
                  addSuffix: true,
                  locale: zhTW,
                })}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onSelectItem(item.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Eye className="h-4 w-4 mr-1" />
                  查看
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
