'use client'

/**
 * @fileoverview Forwarder 資料表格組件
 * @description
 *   顯示 Forwarder 列表的資料表格。
 *   支援排序、分頁、空狀態顯示。
 *
 * @module src/components/features/forwarders/ForwarderTable
 * @author Development Team
 * @since Epic 5 - Story 5.1 (Forwarder Profile List)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - date-fns - 日期格式化
 *   - @/components/ui - shadcn/ui 組件
 *
 * @related
 *   - src/types/forwarder.ts - 類型定義
 *   - src/hooks/use-forwarders.ts - 資料查詢
 */

import * as React from 'react'
import { formatDistanceToNow, format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { ArrowUpDown, ArrowUp, ArrowDown, MoreHorizontal } from 'lucide-react'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
// REFACTOR-001: 使用 company 類型取代 forwarder 類型
import type {
  CompanyListItem as ForwarderListItem,
  CompanySortField as ForwarderSortField,
  SortOrder,
} from '@/types/company'
import { LEGACY_FORWARDER_STATUS_CONFIG, getForwarderDisplayStatus } from '@/types/forwarder'

// ============================================================
// Types
// ============================================================

interface ForwarderTableProps {
  /** Forwarder 列表 */
  forwarders: ForwarderListItem[]
  /** 當前排序欄位 */
  sortBy?: ForwarderSortField
  /** 當前排序方向 */
  sortOrder?: SortOrder
  /** 排序變更回調 */
  onSort?: (field: ForwarderSortField) => void
  /** 檢視詳情回調 */
  onView?: (id: string) => void
  /** 編輯回調 */
  onEdit?: (id: string) => void
  /** 是否顯示操作欄 */
  showActions?: boolean
}

// ============================================================
// Sub-components
// ============================================================

/**
 * 可排序表頭
 */
interface SortableHeaderProps {
  field: ForwarderSortField
  label: string
  currentSortBy?: ForwarderSortField
  currentSortOrder?: SortOrder
  onSort?: (field: ForwarderSortField) => void
  className?: string
}

function SortableHeader({
  field,
  label,
  currentSortBy,
  currentSortOrder,
  onSort,
  className,
}: SortableHeaderProps) {
  const isActive = currentSortBy === field

  const handleClick = () => {
    onSort?.(field)
  }

  const SortIcon = isActive
    ? currentSortOrder === 'asc'
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown

  return (
    <Button
      variant="ghost"
      size="sm"
      className={`-ml-3 h-8 data-[state=open]:bg-accent ${className}`}
      onClick={handleClick}
    >
      {label}
      <SortIcon className={`ml-2 h-4 w-4 ${isActive ? 'text-foreground' : 'text-muted-foreground'}`} />
    </Button>
  )
}

/**
 * 狀態徽章
 */
function StatusBadge({ isActive }: { isActive: boolean }) {
  const status = getForwarderDisplayStatus(isActive)
  const config = LEGACY_FORWARDER_STATUS_CONFIG[status]

  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  )
}

// ============================================================
// Component
// ============================================================

/**
 * Forwarder 資料表格組件
 *
 * @description
 *   顯示 Forwarder 資料的表格，包含以下欄位：
 *   - 名稱（可排序）
 *   - 代碼（可排序）
 *   - 狀態
 *   - 規則數量（可排序）
 *   - 優先級（可排序）
 *   - 最後更新（可排序）
 *   - 操作
 *
 * @example
 *   <ForwarderTable
 *     forwarders={forwarders}
 *     sortBy="updatedAt"
 *     sortOrder="desc"
 *     onSort={handleSort}
 *     onView={handleView}
 *     onEdit={handleEdit}
 *   />
 */
export function ForwarderTable({
  forwarders,
  sortBy,
  sortOrder,
  onSort,
  onView,
  onEdit,
  showActions = true,
}: ForwarderTableProps) {
  if (forwarders.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-muted-foreground">
        找不到符合條件的 Forwarder
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">
                <SortableHeader
                  field="name"
                  label="名稱"
                  currentSortBy={sortBy}
                  currentSortOrder={sortOrder}
                  onSort={onSort}
                />
              </TableHead>
              <TableHead className="w-[120px]">
                <SortableHeader
                  field="code"
                  label="代碼"
                  currentSortBy={sortBy}
                  currentSortOrder={sortOrder}
                  onSort={onSort}
                />
              </TableHead>
              <TableHead className="w-[100px] text-center">狀態</TableHead>
              <TableHead className="w-[100px] text-center">
                <SortableHeader
                  field="ruleCount"
                  label="規則數"
                  currentSortBy={sortBy}
                  currentSortOrder={sortOrder}
                  onSort={onSort}
                  className="justify-center"
                />
              </TableHead>
              <TableHead className="w-[100px] text-center">
                <SortableHeader
                  field="priority"
                  label="優先級"
                  currentSortBy={sortBy}
                  currentSortOrder={sortOrder}
                  onSort={onSort}
                  className="justify-center"
                />
              </TableHead>
              <TableHead className="w-[180px]">
                <SortableHeader
                  field="updatedAt"
                  label="最後更新"
                  currentSortBy={sortBy}
                  currentSortOrder={sortOrder}
                  onSort={onSort}
                />
              </TableHead>
              {showActions && <TableHead className="w-[80px] text-center">操作</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {forwarders.map((forwarder) => (
              <TableRow key={forwarder.id}>
                {/* 名稱 */}
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{forwarder.displayName || forwarder.name}</span>
                    {forwarder.displayName && forwarder.displayName !== forwarder.name && (
                      <span className="text-sm text-muted-foreground">{forwarder.name}</span>
                    )}
                  </div>
                </TableCell>

                {/* 代碼 */}
                <TableCell>
                  <code className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono">
                    {forwarder.code}
                  </code>
                </TableCell>

                {/* 狀態 */}
                <TableCell className="text-center">
                  <StatusBadge isActive={forwarder.isActive} />
                </TableCell>

                {/* 規則數量 */}
                <TableCell className="text-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help">
                        {forwarder.ruleCount > 0 ? (
                          <Badge variant="outline">{forwarder.ruleCount}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{forwarder.ruleCount} 個映射規則</p>
                    </TooltipContent>
                  </Tooltip>
                </TableCell>

                {/* 優先級 */}
                <TableCell className="text-center">
                  <span className={forwarder.priority > 0 ? 'font-medium' : 'text-muted-foreground'}>
                    {forwarder.priority}
                  </span>
                </TableCell>

                {/* 最後更新 */}
                <TableCell>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help text-muted-foreground">
                        {formatDistanceToNow(new Date(forwarder.updatedAt), {
                          addSuffix: true,
                          locale: zhTW,
                        })}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{format(new Date(forwarder.updatedAt), 'yyyy-MM-dd HH:mm:ss', { locale: zhTW })}</p>
                    </TooltipContent>
                  </Tooltip>
                </TableCell>

                {/* 操作 */}
                {showActions && (
                  <TableCell className="text-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onView?.(forwarder.id)}>
                          檢視詳情
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit?.(forwarder.id)}>
                          編輯
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  )
}
