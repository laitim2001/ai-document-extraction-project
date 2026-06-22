/**
 * @fileoverview 審核隊列載入骨架組件
 * @description
 *   顯示審核列表載入中的骨架畫面，提供視覺反饋
 *
 * @module src/components/features/review/ReviewQueueSkeleton
 * @since Epic 3 - Story 3.1
 * @lastModified 2026-06-22 (CHANGE-089 Batch C: 表頭 i18n 化)
 *
 * @dependencies
 *   - next-intl - 國際化
 *   - @/components/ui/skeleton - shadcn Skeleton 組件
 *   - @/components/ui/table - shadcn Table 組件
 */

'use client'

import { useTranslations } from 'next-intl'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// ============================================================
// Component
// ============================================================

/**
 * 審核隊列載入骨架
 * 在數據載入時顯示，保持 UI 一致性
 *
 * @example
 * ```tsx
 * {isLoading && <ReviewQueueSkeleton />}
 * ```
 */
export function ReviewQueueSkeleton() {
  const t = useTranslations('review')

  return (
    <div className="space-y-4">
      {/* 頂部資訊列 */}
      <div className="flex justify-between items-center">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-16" />
      </div>

      {/* 表格骨架 */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">{t('table.fileName')}</TableHead>
              <TableHead>{t('panel.forwarder')}</TableHead>
              <TableHead>{t('table.uploadTime')}</TableHead>
              <TableHead className="text-center">{t('table.confidence')}</TableHead>
              <TableHead>{t('table.processingPath')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="h-4 w-[250px]" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell className="text-center">
                  <Skeleton className="h-6 w-12 mx-auto" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-6 w-20" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
