'use client'

/**
 * @fileoverview 階層式術語報告匯出按鈕
 * @description
 *   提供批次術語報告的 Excel 匯出功能。
 *   僅在批次狀態為 COMPLETED 時可用。
 *
 * @module src/components/features/historical-data/HierarchicalTermsExportButton
 * @since Epic 0 - CHANGE-002
 * @lastModified 2025-12-27
 *
 * @features
 *   - 一鍵下載 Excel 報告
 *   - 匯出狀態指示
 *   - 錯誤處理與提示
 */

import * as React from 'react'
import { useState, useCallback } from 'react'
import { Loader2, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'

// ============================================================
// Types
// ============================================================

interface HierarchicalTermsExportButtonProps {
  /** 批次 ID */
  batchId: string
  /** 批次名稱（用於文件命名提示） */
  batchName?: string
  /** 批次狀態 */
  batchStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  /** 按鈕尺寸 */
  size?: 'default' | 'sm' | 'lg' | 'icon'
  /** 按鈕變體 */
  variant?: 'default' | 'secondary' | 'outline' | 'ghost'
  /** 額外的 CSS 類名 */
  className?: string
  /** 是否顯示文字標籤 */
  showLabel?: boolean
}

// ============================================================
// Component
// ============================================================

/**
 * 階層式術語報告匯出按鈕
 *
 * @description
 *   點擊後會下載包含術語聚合資料的 Excel 報告。
 *   僅在批次狀態為 COMPLETED 時啟用。
 */
export function HierarchicalTermsExportButton({
  batchId,
  batchName,
  batchStatus,
  size = 'sm',
  variant = 'outline',
  className,
  showLabel = true,
}: HierarchicalTermsExportButtonProps) {
  const { toast } = useToast()
  const [isExporting, setIsExporting] = useState(false)

  const isDisabled = batchStatus !== 'COMPLETED' || isExporting

  // --- Handlers ---

  const handleExport = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation() // 防止觸發父元素的 onClick

      if (isDisabled) return

      setIsExporting(true)

      try {
        const response = await fetch(
          `/api/v1/batches/${batchId}/hierarchical-terms/export`,
          {
            method: 'GET',
          }
        )

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || '匯出失敗')
        }

        // 獲取文件名
        const contentDisposition = response.headers.get('Content-Disposition')
        let fileName = `術語報告-${batchName || batchId}.xlsx`
        if (contentDisposition) {
          const match = contentDisposition.match(/filename\*?=["']?(?:UTF-8'')?([^"';\n]+)/)
          if (match && match[1]) {
            fileName = decodeURIComponent(match[1])
          }
        }

        // 下載文件
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)

        toast({
          title: '匯出成功',
          description: `已下載「${fileName}」`,
        })
      } catch (error) {
        console.error('[Export] Error:', error)
        toast({
          variant: 'destructive',
          title: '匯出失敗',
          description: error instanceof Error ? error.message : '無法匯出術語報告',
        })
      } finally {
        setIsExporting(false)
      }
    },
    [batchId, batchName, isDisabled, toast]
  )

  // --- Render ---

  const buttonContent = (
    <>
      {isExporting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <FileSpreadsheet className="h-4 w-4" />
      )}
      {showLabel && (
        <span className="ml-1">
          {isExporting ? '匯出中...' : '匯出術語'}
        </span>
      )}
    </>
  )

  // 如果不是 COMPLETED 狀態，顯示 Tooltip 說明原因
  if (batchStatus !== 'COMPLETED') {
    const tooltipMessage =
      batchStatus === 'PENDING'
        ? '批次尚未開始處理'
        : batchStatus === 'PROCESSING'
          ? '批次正在處理中'
          : batchStatus === 'FAILED'
            ? '批次處理失敗'
            : '批次已取消'

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                variant={variant}
                size={size}
                disabled
                className={className}
              >
                {buttonContent}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltipMessage}，無法匯出術語報告</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={variant}
            size={size}
            onClick={handleExport}
            disabled={isExporting}
            className={className}
          >
            {buttonContent}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>匯出階層式術語報告（Excel）</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
