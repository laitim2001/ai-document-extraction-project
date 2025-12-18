/**
 * @fileoverview 單個欄位列組件
 * @description
 *   顯示單個提取欄位：
 *   - 欄位名稱（中文對照）
 *   - 提取值
 *   - 信心度徽章
 *   - 來源位置指示器
 *   - 選中狀態高亮
 *
 * @module src/components/features/review/ReviewPanel
 * @since Epic 3 - Story 3.2 (並排 PDF 審核介面)
 * @lastModified 2025-12-18
 */

'use client'

import type { ExtractedField } from '@/types/review'
import { ConfidenceBadge } from '../ConfidenceBadge'
import { cn } from '@/lib/utils'
import { MapPin } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

// ============================================================
// Constants
// ============================================================

/**
 * 欄位名稱中英對照
 */
const FIELD_LABELS: Record<string, string> = {
  // Header
  invoiceNumber: '發票號碼',
  invoiceDate: '發票日期',
  dueDate: '到期日',
  poNumber: 'PO 號碼',
  currency: '幣別',

  // Shipper
  shipperName: '發貨人名稱',
  shipperAddress: '發貨人地址',
  shipperContact: '發貨人聯絡人',

  // Consignee
  consigneeName: '收貨人名稱',
  consigneeAddress: '收貨人地址',
  consigneeContact: '收貨人聯絡人',

  // Shipment
  vesselName: '船名',
  voyageNumber: '航次',
  containerNumber: '貨櫃號',
  blNumber: '提單號',
  portOfLoading: '裝貨港',
  portOfDischarge: '卸貨港',
  etd: '預計開航日',
  eta: '預計到港日',

  // Charges
  oceanFreight: '海運費',
  thc: 'THC',
  docFee: '文件費',
  customsFee: '報關費',
  handlingFee: '手續費',

  // Totals
  totalAmount: '總金額',
  taxAmount: '稅額',
  netAmount: '淨額',
}

// ============================================================
// Types
// ============================================================

interface FieldRowProps {
  /** 欄位資料 */
  field: ExtractedField
  /** 是否選中 */
  isSelected: boolean
  /** 選擇回調 */
  onSelect: () => void
}

// ============================================================
// Component
// ============================================================

/**
 * 單個欄位列組件
 *
 * @example
 * ```tsx
 * <FieldRow
 *   field={field}
 *   isSelected={true}
 *   onSelect={handleSelect}
 * />
 * ```
 */
export function FieldRow({ field, isSelected, onSelect }: FieldRowProps) {
  const confidenceLevel =
    field.confidence >= 90 ? 'high' : field.confidence >= 70 ? 'medium' : 'low'

  const bgColor = {
    high: 'hover:bg-green-50 dark:hover:bg-green-950/20',
    medium: 'hover:bg-yellow-50 dark:hover:bg-yellow-950/20',
    low: 'bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/30',
  }[confidenceLevel]

  return (
    <div
      data-testid="field-row"
      className={cn(
        'flex items-center justify-between p-3 cursor-pointer transition-colors',
        bgColor,
        isSelected && 'ring-2 ring-inset ring-primary bg-primary/5'
      )}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {FIELD_LABELS[field.fieldName] || field.fieldName}
          </span>

          {/* 來源位置指示器 */}
          {field.sourcePosition && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>點擊查看 PDF 對應位置（第 {field.sourcePosition.page} 頁）</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        <p className="text-sm text-muted-foreground truncate">
          {field.value || '—'}
        </p>
      </div>

      <div className="flex items-center gap-2 ml-4 shrink-0">
        <ConfidenceBadge score={field.confidence} size="sm" />
      </div>
    </div>
  )
}
