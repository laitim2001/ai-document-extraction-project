'use client'

/**
 * @fileoverview 匯出對話框組件
 * @description
 *   提供費用明細報表的匯出配置對話框：
 *   - 顯示預估匯出記錄數
 *   - 欄位選擇（可複選）
 *   - 直接下載或背景處理
 *   - 進度顯示
 *
 * @module src/components/reports/ExportDialog
 * @since Epic 7 - Story 7.4 (費用明細報表匯出)
 * @lastModified 2025-12-19
 *
 * @features
 *   - AC1: 匯出選項對話框
 *   - AC2: 匯出參數配置（日期、欄位）
 *   - AC3: 報表內容生成與下載
 *   - AC4: 背景處理提示
 *
 * @dependencies
 *   - @/components/ui/* - shadcn/ui 組件
 *   - @/contexts/DashboardFilterContext - 篩選器 Context
 *   - @/types/report-export - 匯出類型
 *   - @tanstack/react-query - 資料查詢
 */

import { useState, useCallback } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Download, Loader2, FileSpreadsheet, AlertCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/hooks/use-toast'
import { useDashboardFilter } from '@/contexts/DashboardFilterContext'
import {
  ExportConfig,
  ExportField,
  EXPORT_FIELD_LABELS,
  DEFAULT_EXPORT_FIELDS,
  LARGE_EXPORT_THRESHOLD,
  ExportResponse
} from '@/types/report-export'

// ============================================================
// Types
// ============================================================

interface ExportDialogProps {
  /** 是否禁用 */
  disabled?: boolean
  /** 權限檢查 */
  hasPermission?: boolean
}

// ============================================================
// Component
// ============================================================

/**
 * 匯出對話框組件
 *
 * @description
 *   提供報表匯出的完整工作流程：
 *   1. 顯示預估數量
 *   2. 選擇匯出欄位
 *   3. 執行匯出（直接或背景）
 *   4. 下載或等待通知
 *
 * @example
 * ```tsx
 * <ExportDialog hasPermission={user.permissions.includes('EXPORT_REPORTS')} />
 * ```
 */
export function ExportDialog({
  disabled = false,
  hasPermission = true
}: ExportDialogProps) {
  const [open, setOpen] = useState(false)
  const [selectedFields, setSelectedFields] = useState<ExportField[]>(DEFAULT_EXPORT_FIELDS)
  const { dateRange, selectedForwarderIds } = useDashboardFilter()
  const { toast } = useToast()

  // 格式化日期為 ISO 字串
  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0]
  }

  // 獲取估計數量
  const { data: estimatedCount, isLoading: countLoading } = useQuery({
    queryKey: ['export-estimate', dateRange.startDate, dateRange.endDate, selectedForwarderIds],
    queryFn: async () => {
      const response = await fetch('/api/reports/expense-detail/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: formatDate(dateRange.startDate),
          endDate: formatDate(dateRange.endDate),
          forwarderIds: selectedForwarderIds.length > 0 ? selectedForwarderIds : undefined
        })
      })
      const result = await response.json()
      return result.data?.count as number
    },
    enabled: open
  })

  // 匯出 mutation
  const exportMutation = useMutation({
    mutationFn: async (config: ExportConfig): Promise<ExportResponse & { mode?: string }> => {
      const response = await fetch('/api/reports/expense-detail/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Export failed')
      }

      // 檢查是否為背景任務
      const contentType = response.headers.get('Content-Type')
      if (contentType?.includes('application/json')) {
        const result = await response.json()
        return { ...result, mode: 'background' }
      }

      // 直接下載
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `expense-report-${formatDate(new Date())}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      return { success: true, mode: 'direct' }
    },
    onSuccess: (result) => {
      if (result.mode === 'background') {
        toast({
          title: '報表生成中',
          description: '報表正在背景生成，完成後將發送通知。'
        })
      } else {
        toast({
          title: '匯出成功',
          description: '報表已下載。'
        })
      }
      setOpen(false)
    },
    onError: (error) => {
      toast({
        title: '匯出失敗',
        description: error instanceof Error ? error.message : '請稍後再試',
        variant: 'destructive'
      })
    }
  })

  // 切換欄位選擇
  const toggleField = useCallback((field: ExportField) => {
    setSelectedFields(prev =>
      prev.includes(field)
        ? prev.filter(f => f !== field)
        : [...prev, field]
    )
  }, [])

  // 全選/取消全選
  const toggleAllFields = useCallback(() => {
    const allFields = Object.keys(EXPORT_FIELD_LABELS) as ExportField[]
    if (selectedFields.length === allFields.length) {
      setSelectedFields(DEFAULT_EXPORT_FIELDS)
    } else {
      setSelectedFields(allFields)
    }
  }, [selectedFields])

  // 執行匯出
  const handleExport = useCallback(() => {
    const config: ExportConfig = {
      dateRange: {
        startDate: formatDate(dateRange.startDate),
        endDate: formatDate(dateRange.endDate)
      },
      format: 'xlsx',
      fields: selectedFields,
      companyIds: selectedForwarderIds.length > 0 ? selectedForwarderIds : undefined
    }
    exportMutation.mutate(config)
  }, [dateRange, selectedFields, selectedForwarderIds, exportMutation])

  const isLargeExport = estimatedCount && estimatedCount > LARGE_EXPORT_THRESHOLD
  const allFields = Object.keys(EXPORT_FIELD_LABELS) as ExportField[]

  // 權限不足
  if (!hasPermission) {
    return (
      <Button variant="outline" disabled>
        <Download className="mr-2 h-4 w-4" />
        匯出報表
      </Button>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          <Download className="mr-2 h-4 w-4" />
          匯出報表
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>匯出費用明細報表</DialogTitle>
          <DialogDescription>
            選擇要包含的欄位，然後匯出 Excel 報表。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 數據量提示 */}
          <div className="rounded-lg bg-muted p-3 text-sm">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
              <span>
                {countLoading ? (
                  '計算中...'
                ) : (
                  <>預計匯出 <strong>{estimatedCount?.toLocaleString() || 0}</strong> 筆資料</>
                )}
              </span>
            </div>
            {isLargeExport && (
              <Alert className="mt-3" variant="default">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  數據量較大，將在背景處理，完成後發送通知。
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* 欄位選擇 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>選擇欄位</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleAllFields}
              >
                {selectedFields.length === allFields.length ? '重設為預設' : '全選'}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-[240px] overflow-y-auto pr-2">
              {allFields.map((field) => (
                <div
                  key={field}
                  className="flex items-center space-x-2 p-2 rounded hover:bg-muted"
                >
                  <Checkbox
                    id={field}
                    checked={selectedFields.includes(field)}
                    onCheckedChange={() => toggleField(field)}
                  />
                  <label
                    htmlFor={field}
                    className="text-sm font-medium leading-none cursor-pointer select-none"
                  >
                    {EXPORT_FIELD_LABELS[field]}
                  </label>
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              已選擇 {selectedFields.length} / {allFields.length} 個欄位
            </p>
          </div>

          {/* 匯出進度 */}
          {exportMutation.isPending && (
            <div className="space-y-2">
              <Progress value={50} />
              <p className="text-sm text-center text-muted-foreground">
                正在生成報表...
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={exportMutation.isPending}
          >
            取消
          </Button>
          <Button
            onClick={handleExport}
            disabled={exportMutation.isPending || selectedFields.length === 0}
          >
            {exportMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {isLargeExport ? '開始背景匯出' : '匯出'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
