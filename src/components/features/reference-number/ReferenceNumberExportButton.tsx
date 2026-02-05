'use client'

/**
 * @fileoverview Reference Number 導出按鈕組件
 * @description
 *   從 API 導出 Reference Number 資料並下載為 JSON 文件：
 *   - 應用當前篩選條件
 *   - 文件名包含日期
 *   - Loading 狀態顯示
 *
 * @module src/components/features/reference-number/ReferenceNumberExportButton
 * @since Epic 20 - Story 20.6 (Management Page - Form & Import)
 * @lastModified 2026-02-05
 *
 * @dependencies
 *   - next-intl - 國際化
 *   - @/hooks/use-reference-numbers - Export hook
 *   - @/hooks/use-toast - Toast 通知
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { useExportReferenceNumbers } from '@/hooks/use-reference-numbers'
import type { ExportReferenceNumbersParams } from '@/hooks/use-reference-numbers'

// ============================================================
// Types
// ============================================================

interface ReferenceNumberExportButtonProps {
  /** 當前篩選參數 */
  filters?: ExportReferenceNumbersParams
}

// ============================================================
// Component
// ============================================================

export function ReferenceNumberExportButton({
  filters = {},
}: ReferenceNumberExportButtonProps) {
  const t = useTranslations('referenceNumber')
  const { toast } = useToast()
  const exportMutation = useExportReferenceNumbers()

  const handleExport = React.useCallback(async () => {
    try {
      const result = await exportMutation.mutateAsync(filters)

      // 建立下載文件
      const blob = new Blob([JSON.stringify(result, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)

      const dateStr = new Date().toISOString().slice(0, 10)
      const link = document.createElement('a')
      link.href = url
      link.download = `reference-numbers-${dateStr}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch {
      toast({
        variant: 'destructive',
        title: t('messages.exportFailed'),
      })
    }
  }, [filters, exportMutation, toast, t])

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={exportMutation.isPending}
    >
      {exportMutation.isPending ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Download className="h-4 w-4 mr-2" />
      )}
      {exportMutation.isPending ? t('export.exporting') : t('actions.export')}
    </Button>
  )
}
