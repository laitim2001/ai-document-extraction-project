/**
 * @fileoverview PDF 錯誤顯示組件
 * @description
 *   在 PDF 載入或渲染失敗時顯示的錯誤訊息組件，
 *   提供重試功能和錯誤詳情。
 *
 * @module src/components/features/document-preview
 * @since Epic 13 - Story 13.1 (文件預覽組件與欄位高亮)
 * @lastModified 2025-01-02
 */

'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCw, FileX } from 'lucide-react'

// ============================================================
// Types
// ============================================================

interface PDFErrorDisplayProps {
  /** 錯誤訊息 */
  error: string | Error
  /** 重試回調函數 */
  onRetry?: () => void
  /** 自定義 CSS 類名 */
  className?: string
  /** 是否顯示詳細錯誤訊息 */
  showDetails?: boolean
}

// ============================================================
// Component
// ============================================================

/**
 * @component PDFErrorDisplay
 * @description PDF 載入錯誤顯示組件，提供錯誤訊息和重試功能
 */
export function PDFErrorDisplay({
  error,
  onRetry,
  className,
  showDetails = false,
}: PDFErrorDisplayProps) {
  const errorMessage = error instanceof Error ? error.message : error

  // 解析常見錯誤類型
  const getErrorInfo = (msg: string): { title: string; description: string } => {
    if (msg.includes('network') || msg.includes('fetch')) {
      return {
        title: '網路錯誤',
        description: '無法載入文件，請檢查網路連線後重試。',
      }
    }
    if (msg.includes('Invalid PDF') || msg.includes('corrupted')) {
      return {
        title: '文件損壞',
        description: '此 PDF 文件可能已損壞或格式不正確。',
      }
    }
    if (msg.includes('password') || msg.includes('encrypted')) {
      return {
        title: '文件已加密',
        description: '此 PDF 文件已加密，無法直接開啟。',
      }
    }
    return {
      title: '載入失敗',
      description: '無法載入 PDF 文件，請稍後重試。',
    }
  }

  const { title, description } = getErrorInfo(errorMessage)

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center',
        'w-full h-full min-h-[400px]',
        'bg-destructive/5 rounded-lg border border-destructive/20',
        className
      )}
    >
      {/* 錯誤圖示 */}
      <div className="relative mb-4">
        <FileX className="h-16 w-16 text-destructive/50" />
        <AlertCircle className="absolute -bottom-1 -right-1 h-6 w-6 text-destructive" />
      </div>

      {/* 錯誤標題 */}
      <h3 className="text-lg font-semibold text-destructive mb-2">{title}</h3>

      {/* 錯誤描述 */}
      <p className="text-sm text-muted-foreground text-center max-w-md mb-4 px-4">
        {description}
      </p>

      {/* 詳細錯誤訊息 */}
      {showDetails && (
        <div className="mb-4 px-4 py-2 bg-muted/50 rounded text-xs text-muted-foreground max-w-md overflow-auto">
          <code>{errorMessage}</code>
        </div>
      )}

      {/* 重試按鈕 */}
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          重試
        </Button>
      )}
    </div>
  )
}

PDFErrorDisplay.displayName = 'PDFErrorDisplay'
