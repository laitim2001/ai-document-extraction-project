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
 * @lastModified 2026-06-21 (CHANGE-087 Phase 2: 遷移共用 DataTable)
 *
 * @dependencies
 *   - next-intl - 國際化
 *   - @/components/features/common/DataTable - 共用表格封裝（序號欄）
 *   - date-fns - 日期格式化
 *   - @/types/review - 類型定義
 */

'use client'

import { useMemo } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import type { ReviewQueueItem } from '@/types/review'
import { ConfidenceBadge } from './ConfidenceBadge'
import { ProcessingPathBadge } from './ProcessingPathBadge'
import {
  DataTable,
  type DataTableColumn,
} from '@/components/features/common/DataTable'
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

  // --- Column 定義 ---
  const columns = useMemo<DataTableColumn<ReviewQueueItem>[]>(
    () => [
      // 文件名稱
      {
        id: 'fileName',
        headerClassName: 'w-[300px]',
        cellClassName: 'font-medium',
        header: t('table.fileName'),
        cell: (item) => (
          <span
            className="truncate block max-w-[280px]"
            title={item.document.fileName}
          >
            {item.document.fileName}
          </span>
        ),
      },
      // Company
      {
        id: 'company',
        header: 'Company',
        cell: (item) =>
          item.company?.name || (
            <span className="text-muted-foreground">
              {t('table.unidentified')}
            </span>
          ),
      },
      // 上傳時間
      {
        id: 'uploadTime',
        cellClassName: 'text-muted-foreground',
        header: t('table.uploadTime'),
        cell: (item) =>
          formatDistanceToNow(new Date(item.document.createdAt), {
            addSuffix: true,
            locale: dateLocale,
          }),
      },
      // 信心度
      {
        id: 'confidence',
        headerClassName: 'text-center',
        cellClassName: 'text-center',
        header: t('table.confidence'),
        cell: (item) => <ConfidenceBadge score={item.overallConfidence} />,
      },
      // 處理路徑
      {
        id: 'processingPath',
        header: t('table.processingPath'),
        cell: (item) => <ProcessingPathBadge path={item.processingPath} />,
      },
    ],
    [t, dateLocale]
  )

  return (
    <div className="rounded-md border">
      <DataTable
        data={items}
        columns={columns}
        getRowId={(item) => item.id}
        rowProps={(item) => ({
          className: 'cursor-pointer hover:bg-muted/50',
          onClick: () => onSelectItem(item.document.id),
        })}
      />
    </div>
  )
}
