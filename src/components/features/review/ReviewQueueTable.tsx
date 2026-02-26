/**
 * @fileoverview 審核隊列表格組件（國際化版本）
 * @description
 *   顯示待審核發票列表的表格，包含：
 *   - 文件名稱
 *   - Forwarder
 *   - 上傳時間（相對時間）
 *   - 信心度 Badge
 *   - 處理路徑 Badge
 *   - 完整國際化支援
 *
 * @module src/components/features/review/ReviewQueueTable
 * @since Epic 3 - Story 3.1
 * @lastModified 2026-01-17
 *
 * @dependencies
 *   - next-intl - 國際化
 *   - @/components/ui/table - shadcn Table 組件
 *   - date-fns - 日期格式化
 *   - @/types/review - 類型定義
 */

'use client'

import { useTranslations, useLocale } from 'next-intl'
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
import { zhTW, enUS } from 'date-fns/locale'

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
  const t = useTranslations('review')
  const locale = useLocale()

  // 根據 locale 選擇日期格式化的 locale
  const dateLocale = locale === 'zh-TW' || locale === 'zh-CN' ? zhTW : enUS

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[300px]">{t('table.fileName')}</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>{t('table.uploadTime')}</TableHead>
            <TableHead className="text-center">{t('table.confidence')}</TableHead>
            <TableHead>{t('table.processingPath')}</TableHead>
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
                {item.company?.name || (
                  <span className="text-muted-foreground">{t('table.unidentified')}</span>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDistanceToNow(new Date(item.document.createdAt), {
                  addSuffix: true,
                  locale: dateLocale,
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
