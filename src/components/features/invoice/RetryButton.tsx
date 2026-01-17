'use client'

/**
 * @fileoverview 重試處理按鈕組件（國際化版本）
 * @description
 *   提供文件處理重試功能的按鈕：
 *   - 點擊觸發重試 API
 *   - 載入狀態顯示
 *   - 成功/失敗提示
 *   - 完整國際化支援
 *
 * @module src/components/features/invoice/RetryButton
 * @author Development Team
 * @since Epic 2 - Story 2.7 (Processing Status Tracking & Display)
 * @lastModified 2026-01-17
 *
 * @features
 *   - 整合 useDocuments hook 的 retry
 *   - 載入動畫
 *   - Toast 通知
 *   - i18n 國際化支援
 *
 * @dependencies
 *   - next-intl - 國際化
 *   - lucide-react - 圖標
 *   - sonner - Toast 通知
 *   - @/components/ui/button - Button 組件
 *   - @/hooks/use-documents - Documents Hook
 *
 * @related
 *   - src/hooks/use-documents.ts - Documents Hook
 *   - src/components/features/invoice/InvoiceListTable.tsx - 表格組件
 *   - messages/{locale}/invoices.json - 翻譯檔案
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { RefreshCw, Loader2 } from 'lucide-react'
import { useDocuments } from '@/hooks/use-documents'
import { toast } from 'sonner'

// ============================================================
// Types
// ============================================================

export interface RetryButtonProps {
  /** 文件 ID */
  documentId: string
  /** 重試成功回調 */
  onRetry?: () => void
  /** 按鈕尺寸 */
  size?: 'sm' | 'default'
  /** 自定義 className */
  className?: string
}

// ============================================================
// Component
// ============================================================

/**
 * 重試處理按鈕組件
 *
 * @description
 *   提供文件處理重試功能，點擊後會：
 *   1. 顯示載入狀態
 *   2. 調用重試 API
 *   3. 顯示成功/失敗提示
 *
 * @example
 * ```tsx
 * <RetryButton
 *   documentId="xxx-xxx-xxx"
 *   onRetry={() => console.log('Retried!')}
 * />
 * ```
 */
export function RetryButton({
  documentId,
  onRetry,
  size = 'sm',
  className,
}: RetryButtonProps) {
  const t = useTranslations('invoices')
  const { retry, isRetrying } = useDocuments()

  const handleRetry = () => {
    retry(documentId, {
      onSuccess: () => {
        toast.success(t('retry.success'))
        onRetry?.()
      },
      onError: (error) => {
        toast.error(t('retry.failed', { message: error.message }))
      },
    })
  }

  return (
    <Button
      variant="outline"
      size={size}
      onClick={handleRetry}
      disabled={isRetrying}
      className={className}
    >
      {isRetrying ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <RefreshCw className="h-4 w-4" />
      )}
      <span className="ml-1">{t('retry.button')}</span>
    </Button>
  )
}
