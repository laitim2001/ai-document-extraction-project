/**
 * @fileoverview 單個欄位列組件
 * @description
 *   顯示單個提取欄位（已整合 Story 3.3 信心度顏色編碼）：
 *   - 欄位名稱（中文對照）
 *   - 提取值
 *   - 信心度徽章（帶 Tooltip 顯示詳情）
 *   - 左側邊框顏色指示
 *   - 來源位置指示器
 *   - 低信心度脈動動畫
 *
 * @module src/components/features/review/ReviewPanel
 * @since Epic 3 - Story 3.2 (並排 PDF 審核介面)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @/lib/confidence - 信心度閾值和工具函數
 *   - ../ConfidenceBadge - 信心度徽章組件
 *   - ../ConfidenceTooltip - 信心度詳情 Tooltip
 */

'use client'

import type { ExtractedField } from '@/types/review'
import type { ConfidenceFactors } from '@/types/confidence'
import { ConfidenceBadge } from '../ConfidenceBadge'
import { ConfidenceTooltip } from '../ConfidenceTooltip'
import { getConfidenceLevel } from '@/lib/confidence'
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

/**
 * 背景色樣式
 */
const BG_STYLES = {
  high: 'hover:bg-[hsl(var(--confidence-high-bg))]',
  medium: 'hover:bg-[hsl(var(--confidence-medium-bg))]',
  low: 'bg-[hsl(var(--confidence-low-bg))] hover:bg-[hsl(var(--confidence-low-bg)/80%)]',
} as const

/**
 * 左側邊框顏色
 */
const BORDER_STYLES = {
  high: 'border-l-[hsl(var(--confidence-high))]',
  medium: 'border-l-[hsl(var(--confidence-medium))]',
  low: 'border-l-[hsl(var(--confidence-low))]',
} as const

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
  /** 信心度計算因素（用於 Tooltip 顯示） */
  confidenceFactors?: ConfidenceFactors
}

// ============================================================
// Component
// ============================================================

/**
 * 單個欄位列組件
 *
 * @description
 *   整合 Story 3.3 的信心度顏色編碼：
 *   - 左側邊框顯示信心度顏色
 *   - 背景色根據信心度等級變化
 *   - ConfidenceTooltip 顯示詳情
 *   - 低信心度時有脈動動畫
 *
 * @example
 * ```tsx
 * <FieldRow
 *   field={field}
 *   isSelected={true}
 *   onSelect={handleSelect}
 *   confidenceFactors={factors}
 * />
 * ```
 */
export function FieldRow({
  field,
  isSelected,
  onSelect,
  confidenceFactors,
}: FieldRowProps) {
  const level = getConfidenceLevel(field.confidence)
  const bgStyle = BG_STYLES[level]
  const borderStyle = BORDER_STYLES[level]

  return (
    <div
      data-testid="field-row"
      data-confidence-level={level}
      className={cn(
        'flex items-center justify-between p-3 cursor-pointer transition-all',
        'border-l-4',
        bgStyle,
        borderStyle,
        isSelected && 'ring-2 ring-inset ring-primary bg-primary/5',
        level === 'low' && 'confidence-low-attention'
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
        {/* 信心度徽章帶 Tooltip (AC2) */}
        <ConfidenceTooltip score={field.confidence} factors={confidenceFactors}>
          <div data-testid="confidence-badge">
            <ConfidenceBadge score={field.confidence} size="sm" />
          </div>
        </ConfidenceTooltip>
      </div>
    </div>
  )
}
