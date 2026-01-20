'use client'

/**
 * @fileoverview 階層式術語報告匯出按鈕（國際化版本）
 * @description
 *   提供批次術語報告的 Excel 匯出功能。
 *   僅在批次狀態為 COMPLETED 或 AGGREGATED 時可用。
 *   - i18n 國際化支援 (Epic 17)
 *
 * @module src/components/features/historical-data/HierarchicalTermsExportButton
 * @since Epic 0 - CHANGE-002
 * @lastModified 2026-01-20
 *
 * @features
 *   - 一鍵下載 Excel 報告
 *   - 匯出狀態指示
 *   - 錯誤處理與提示
 *   - 根據當前語言匯出對應語言的報告
 *
 * @dependencies
 *   - next-intl - 國際化支援
 */

import * as React from 'react'
import { useState, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'
import { HistoricalBatchStatus } from '@prisma/client'

// ============================================================
// Types
// ============================================================

interface HierarchicalTermsExportButtonProps {
  /** 批次 ID */
  batchId: string
  /** 批次名稱（用於文件命名提示） */
  batchName?: string
  /** 批次狀態 */
  batchStatus: HistoricalBatchStatus
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
 *   僅在批次狀態為 COMPLETED 或 AGGREGATED 時啟用。
 *   報告內容會根據當前語言設定進行翻譯。
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
  const t = useTranslations('historicalData')
  const locale = useLocale()
  const [isExporting, setIsExporting] = useState(false)

  const isDisabled = (batchStatus !== 'COMPLETED' && batchStatus !== 'AGGREGATED') || isExporting

  // --- Handlers ---

  const handleExport = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation() // 防止觸發父元素的 onClick

      if (isDisabled) return

      setIsExporting(true)

      try {
        // 傳遞當前語言設定到 API
        const response = await fetch(
          `/api/v1/batches/${batchId}/hierarchical-terms/export?locale=${locale}`,
          {
            method: 'GET',
            credentials: 'include', // 確保認證 cookies 被發送
          }
        )

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || t('export.toast.failed'))
        }

        // 檢查 Content-Type 確保是 Excel 格式
        // 修正 FIX-019: 認證失敗時會重導向到登入頁面，返回 HTML 而非 Excel
        const contentType = response.headers.get('Content-Type') || ''
        if (!contentType.includes('spreadsheetml') && !contentType.includes('application/octet-stream')) {
          // 可能是被重導向到登入頁面
          console.error('[Export] Unexpected content type:', contentType)
          throw new Error(t('export.toast.authExpired'))
        }

        // 獲取文件名
        const contentDisposition = response.headers.get('Content-Disposition')
        let fileName = `${t('export.button.label')}-${batchName || batchId}.xlsx`
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
          title: t('export.toast.success'),
          description: t('export.toast.successDesc', { fileName }),
        })
      } catch (error) {
        console.error('[Export] Error:', error)
        toast({
          variant: 'destructive',
          title: t('export.toast.failed'),
          description: error instanceof Error ? error.message : t('export.toast.failedDesc'),
        })
      } finally {
        setIsExporting(false)
      }
    },
    [batchId, batchName, isDisabled, toast, t, locale]
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
          {isExporting ? t('export.button.exporting') : t('export.button.label')}
        </span>
      )}
    </>
  )

  // 如果不是 COMPLETED 或 AGGREGATED 狀態，顯示 Tooltip 說明原因
  if (batchStatus !== 'COMPLETED' && batchStatus !== 'AGGREGATED') {
    // 使用狀態對應的翻譯 key
    const statusKey = batchStatus.toLowerCase() as 'pending' | 'processing' | 'paused' | 'aggregating' | 'aggregated' | 'completed' | 'failed' | 'cancelled'
    const tooltipMessage = t(`export.status.${statusKey}`) + t('export.status.cannotExport')

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
            <p>{tooltipMessage}</p>
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
          <p>{t('export.button.tooltip')}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
