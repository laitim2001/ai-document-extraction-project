'use client'

/**
 * @fileoverview Forwarder 表格骨架屏組件
 * @description
 *   在資料載入時顯示的骨架屏。
 *   提供更好的使用者體驗。
 *
 * @module src/components/features/forwarders/ForwarderTableSkeleton
 * @author Development Team
 * @since Epic 5 - Story 5.1 (Forwarder Profile List)
 * @lastModified 2026-01-28
 *
 * @dependencies
 *   - @/components/ui - shadcn/ui 組件
 */

import { useTranslations } from 'next-intl'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'

// ============================================================
// Types
// ============================================================

interface ForwarderTableSkeletonProps {
  /** 骨架行數 */
  rows?: number
  /** 是否顯示操作欄 */
  showActions?: boolean
}

// ============================================================
// Component
// ============================================================

/**
 * Forwarder 表格骨架屏
 *
 * @description
 *   在資料載入時顯示的佔位元素，
 *   保持與實際表格相同的結構。
 *
 * @example
 *   <ForwarderTableSkeleton rows={5} />
 */
export function ForwarderTableSkeleton({
  rows = 5,
  showActions = true,
}: ForwarderTableSkeletonProps) {
  const t = useTranslations('companies.table.columns')

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">{t('name')}</TableHead>
            <TableHead className="w-[120px]">{t('code')}</TableHead>
            <TableHead className="w-[100px] text-center">{t('status')}</TableHead>
            <TableHead className="w-[100px] text-center">{t('ruleCount')}</TableHead>
            <TableHead className="w-[100px] text-center">{t('priority')}</TableHead>
            <TableHead className="w-[180px]">{t('updatedAt')}</TableHead>
            {showActions && <TableHead className="w-[80px] text-center">{t('actions')}</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, index) => (
            <TableRow key={index}>
              {/* 名稱 */}
              <TableCell>
                <div className="flex flex-col gap-1">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </TableCell>

              {/* 代碼 */}
              <TableCell>
                <Skeleton className="h-6 w-16" />
              </TableCell>

              {/* 狀態 */}
              <TableCell className="text-center">
                <Skeleton className="mx-auto h-6 w-12" />
              </TableCell>

              {/* 規則數 */}
              <TableCell className="text-center">
                <Skeleton className="mx-auto h-6 w-8" />
              </TableCell>

              {/* 優先級 */}
              <TableCell className="text-center">
                <Skeleton className="mx-auto h-5 w-6" />
              </TableCell>

              {/* 最後更新 */}
              <TableCell>
                <Skeleton className="h-5 w-20" />
              </TableCell>

              {/* 操作 */}
              {showActions && (
                <TableCell className="text-center">
                  <Skeleton className="mx-auto h-8 w-8 rounded-md" />
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
