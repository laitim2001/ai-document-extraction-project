'use client'

/**
 * @fileoverview 升級案例列表表格組件（國際化版本）
 * @description
 *   顯示升級案例列表的表格，包含：
 *   - 文件名稱
 *   - Company (REFACTOR-001: 原 Forwarder)
 *   - 升級原因
 *   - 狀態
 *   - 升級者
 *   - 升級時間
 *   - 操作按鈕
 *   - 完整國際化支援
 *
 * @module src/components/features/escalation/EscalationListTable
 * @since Epic 3 - Story 3.8 (Super User 處理升級案例)
 * @lastModified 2026-06-21 (CHANGE-087 Phase 2: 遷移共用 DataTable)
 * @refactor REFACTOR-001 (Forwarder → Company)
 *
 * @dependencies
 *   - next-intl - 國際化
 *   - @/components/features/common/DataTable - 共用表格封裝（序號欄）
 *   - date-fns - 日期格式化
 *   - @/types/escalation - 類型定義
 */

import { useMemo } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import {
  DataTable,
  type DataTableColumn,
} from '@/components/features/common/DataTable'
import { Button } from '@/components/ui/button'
import { EscalationStatusBadge } from './EscalationStatusBadge'
import { EscalationReasonBadge } from './EscalationReasonBadge'
import { formatDistanceToNow } from 'date-fns'
import { zhTW, enUS } from 'date-fns/locale'
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
  const t = useTranslations('escalation')
  const locale = useLocale()

  // 根據 locale 選擇日期格式化的 locale
  const dateLocale = locale === 'zh-TW' || locale === 'zh-CN' ? zhTW : enUS

  // --- Column 定義 ---
  const columns = useMemo<DataTableColumn<EscalationListItem>[]>(
    () => [
      // 文件名稱
      {
        id: 'fileName',
        headerClassName: 'w-[250px]',
        cellClassName: 'font-medium',
        header: t('table.fileName'),
        cell: (item) => (
          <span
            className="truncate block max-w-[230px]"
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
          item.document.company?.name || (
            <span className="text-muted-foreground">
              {t('table.unidentified')}
            </span>
          ),
      },
      // 升級原因
      {
        id: 'reason',
        header: t('table.reason'),
        cell: (item) => <EscalationReasonBadge reason={item.reason} showIcon />,
      },
      // 狀態
      {
        id: 'status',
        header: t('table.status'),
        cell: (item) => <EscalationStatusBadge status={item.status} />,
      },
      // 升級者
      {
        id: 'escalatedBy',
        header: t('table.escalatedBy'),
        cell: (item) => (
          <span className="text-sm">
            {item.escalatedBy.name || item.escalatedBy.email}
          </span>
        ),
      },
      // 升級時間
      {
        id: 'escalatedAt',
        cellClassName: 'text-muted-foreground',
        header: t('table.escalatedAt'),
        cell: (item) =>
          formatDistanceToNow(new Date(item.createdAt), {
            addSuffix: true,
            locale: dateLocale,
          }),
      },
      // 操作
      {
        id: 'actions',
        headerClassName: 'text-right',
        cellClassName: 'text-right',
        header: t('table.actions'),
        cell: (item) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSelectItem(item.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Eye className="h-4 w-4 mr-1" />
            {t('table.view')}
          </Button>
        ),
      },
    ],
    [t, dateLocale, onSelectItem]
  )

  if (items.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center">
        <p className="text-muted-foreground">{t('list.noData')}</p>
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <DataTable
        data={items}
        columns={columns}
        getRowId={(item) => item.id}
        rowProps={() => ({ className: 'group' })}
      />
    </div>
  )
}
