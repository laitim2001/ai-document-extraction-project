'use client'

/**
 * @fileoverview 月度成本分攤報告生成對話框
 * @description
 *   提供月度報告生成的表單對話框，支援：
 *   - 月份選擇（限制不能選擇未來月份）
 *   - Excel/PDF 格式選擇
 *   - 報告生成狀態追蹤
 *
 * @module src/components/reports/MonthlyReportDialog
 * @since Epic 7 - Story 7.10 (月度成本分攤報告)
 * @lastModified 2025-12-20
 *
 * @features
 *   - 月份選擇器（限制最大日期為當月）
 *   - 多格式選擇（Excel/PDF）
 *   - 生成進度反饋
 *   - Toast 通知
 *
 * @dependencies
 *   - @/hooks/use-monthly-report - 報告生成 Hook
 *   - @/components/ui/month-picker - 月份選擇器
 *   - date-fns - 日期處理
 *
 * @related
 *   - src/app/(dashboard)/reports/monthly/page.tsx - 月度報告頁面
 *   - src/app/api/reports/monthly-cost/generate/route.ts - 生成 API
 */

import * as React from 'react'
import { subMonths } from 'date-fns'
import { Loader2, FileSpreadsheet, FileText } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { MonthPicker } from '@/components/ui/month-picker'
import { useToast } from '@/hooks/use-toast'
import { useGenerateMonthlyReport } from '@/hooks/use-monthly-report'
import type { ReportFormat } from '@/types/monthly-report'

// ============================================================
// Types
// ============================================================

interface MonthlyReportDialogProps {
  /** 自定義觸發器 */
  trigger?: React.ReactNode
  /** 外部控制 open 狀態 */
  open?: boolean
  /** open 狀態變更回調 */
  onOpenChange?: (open: boolean) => void
}

// ============================================================
// Component
// ============================================================

/**
 * 月度報告生成對話框
 *
 * @description
 *   提供完整的月度報告生成表單，包含月份選擇和格式選擇。
 *   成功生成後自動刷新報告列表並顯示通知。
 *
 * @example
 * ```tsx
 * <MonthlyReportDialog />
 * <MonthlyReportDialog trigger={<Button>自定義按鈕</Button>} />
 * ```
 */
export function MonthlyReportDialog({
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: MonthlyReportDialogProps) {
  // --- State ---
  const [internalOpen, setInternalOpen] = React.useState(false)
  const [selectedDate, setSelectedDate] = React.useState<Date>(() =>
    subMonths(new Date(), 1)
  )
  const [formats, setFormats] = React.useState<ReportFormat[]>(['excel', 'pdf'])

  // 支援 controlled 和 uncontrolled 模式
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled
    ? controlledOnOpenChange ?? (() => {})
    : setInternalOpen

  // --- Hooks ---
  const { toast } = useToast()
  const generateMutation = useGenerateMonthlyReport()

  // --- Handlers ---
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      // 關閉時重置格式選擇
      setFormats(['excel', 'pdf'])
    }
  }

  const toggleFormat = (format: ReportFormat) => {
    setFormats((prev) =>
      prev.includes(format)
        ? prev.filter((f) => f !== format)
        : [...prev, format]
    )
  }

  const handleGenerate = () => {
    const month = `${selectedDate.getFullYear()}-${String(
      selectedDate.getMonth() + 1
    ).padStart(2, '0')}`

    generateMutation.mutate(
      { month, formats },
      {
        onSuccess: () => {
          toast({
            title: '報告生成成功',
            description: '月度成本分攤報告已生成，可在報告歷史中下載。',
          })
          setOpen(false)
        },
        onError: (error) => {
          toast({
            title: '生成失敗',
            description:
              error instanceof Error ? error.message : '請稍後再試',
            variant: 'destructive',
          })
        },
      }
    )
  }

  // --- Render ---
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || <Button>生成月度報告</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>生成月度成本分攤報告</DialogTitle>
          <DialogDescription>
            選擇月份和匯出格式，系統將生成詳細的成本分攤報告。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 月份選擇 */}
          <div className="space-y-2">
            <Label>選擇月份</Label>
            <MonthPicker
              selected={selectedDate}
              onSelect={setSelectedDate}
              maxDate={new Date()}
              minDate={new Date(2023, 0, 1)}
            />
          </div>

          {/* 格式選擇 */}
          <div className="space-y-2">
            <Label>匯出格式</Label>
            <div className="flex gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="format-excel"
                  checked={formats.includes('excel')}
                  onCheckedChange={() => toggleFormat('excel')}
                />
                <label
                  htmlFor="format-excel"
                  className="flex items-center gap-1 text-sm cursor-pointer"
                >
                  <FileSpreadsheet className="h-4 w-4 text-green-600" />
                  Excel
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="format-pdf"
                  checked={formats.includes('pdf')}
                  onCheckedChange={() => toggleFormat('pdf')}
                />
                <label
                  htmlFor="format-pdf"
                  className="flex items-center gap-1 text-sm cursor-pointer"
                >
                  <FileText className="h-4 w-4 text-red-600" />
                  PDF
                </label>
              </div>
            </div>
            {formats.length === 0 && (
              <p className="text-xs text-destructive">請至少選擇一種格式</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={generateMutation.isPending || formats.length === 0}
          >
            {generateMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            生成報告
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
