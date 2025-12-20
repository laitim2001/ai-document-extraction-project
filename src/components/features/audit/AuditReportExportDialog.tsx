'use client'

/**
 * @fileoverview 審計報告匯出對話框組件
 * @description
 *   提供審計報告配置和匯出的對話框介面：
 *   - 報告類型選擇
 *   - 輸出格式選擇
 *   - 日期範圍設定
 *   - 進階過濾選項
 *
 * @module src/components/features/audit/AuditReportExportDialog
 * @since Epic 8 - Story 8.5 (審計報告匯出)
 * @lastModified 2025-12-20
 *
 * @dependencies
 *   - @/components/ui/* - shadcn/ui 組件
 *   - @/types/audit-report - 報告類型定義
 *   - lucide-react - 圖示
 */

import * as React from 'react'
import {
  FileText,
  FileSpreadsheet,
  FileJson,
  File,
  Loader2,
  Calendar,
  Filter,
  FileCheck,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import {
  AUDIT_REPORT_TYPES,
  REPORT_OUTPUT_FORMATS,
  LARGE_REPORT_THRESHOLD,
} from '@/types/audit-report'
import type { AuditReportType, ReportOutputFormat } from '@prisma/client'

// ============================================================
// Types
// ============================================================

interface AuditReportExportDialogProps {
  /** 對話框開啟狀態 */
  open: boolean
  /** 開啟狀態變更回呼 */
  onOpenChange: (open: boolean) => void
  /** 確認匯出回呼 */
  onConfirm: (config: ReportConfig) => void
  /** 是否正在提交 */
  isSubmitting?: boolean
  /** 預估記錄數（可選，用於顯示提示） */
  estimatedRecords?: number
}

interface ReportConfig {
  reportType: AuditReportType
  outputFormat: ReportOutputFormat
  title: string
  dateRange: {
    from: string
    to: string
  }
  filters: {
    cityIds?: string[]
    forwarderIds?: string[]
  }
  includeChanges: boolean
  includeFiles: boolean
}

// ============================================================
// Constants
// ============================================================

const REPORT_TYPE_ICONS: Record<AuditReportType, React.ElementType> = {
  PROCESSING_RECORDS: FileText,
  CHANGE_HISTORY: FileCheck,
  FULL_AUDIT: FileSpreadsheet,
  COMPLIANCE_SUMMARY: File,
}

const OUTPUT_FORMAT_ICONS: Record<ReportOutputFormat, React.ElementType> = {
  EXCEL: FileSpreadsheet,
  PDF: FileText,
  CSV: File,
  JSON: FileJson,
}

// ============================================================
// Helpers
// ============================================================

function getDefaultDateRange() {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  return {
    from: thirtyDaysAgo.toISOString().split('T')[0],
    to: now.toISOString().split('T')[0],
  }
}

function formatDateToISO(dateStr: string): string {
  return new Date(dateStr).toISOString()
}

// ============================================================
// Component
// ============================================================

/**
 * 審計報告匯出對話框
 *
 * @description 用於配置和建立審計報告匯出任務的對話框。
 *   支援多種報告類型和輸出格式。
 *
 * @example
 * ```tsx
 * <AuditReportExportDialog
 *   open={showDialog}
 *   onOpenChange={setShowDialog}
 *   onConfirm={handleExport}
 *   isSubmitting={isPending}
 * />
 * ```
 */
export function AuditReportExportDialog({
  open,
  onOpenChange,
  onConfirm,
  isSubmitting = false,
  estimatedRecords,
}: AuditReportExportDialogProps) {
  // --- State ---
  const defaultDateRange = React.useMemo(() => getDefaultDateRange(), [])

  const [reportType, setReportType] = React.useState<AuditReportType>('PROCESSING_RECORDS')
  const [outputFormat, setOutputFormat] = React.useState<ReportOutputFormat>('EXCEL')
  const [title, setTitle] = React.useState('')
  const [dateFrom, setDateFrom] = React.useState(defaultDateRange.from)
  const [dateTo, setDateTo] = React.useState(defaultDateRange.to)
  const [includeChanges, setIncludeChanges] = React.useState(true)
  const [includeFiles, setIncludeFiles] = React.useState(true)
  const [showAdvanced, setShowAdvanced] = React.useState(false)

  // --- Derived State ---
  const canSubmit = title.trim().length > 0 && dateFrom && dateTo && dateFrom <= dateTo

  const isLargeReport = estimatedRecords && estimatedRecords > LARGE_REPORT_THRESHOLD

  // --- Handlers ---
  const handleConfirm = () => {
    if (!canSubmit) return

    onConfirm({
      reportType,
      outputFormat,
      title: title.trim(),
      dateRange: {
        from: formatDateToISO(dateFrom),
        to: formatDateToISO(dateTo),
      },
      filters: {},
      includeChanges,
      includeFiles,
    })
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // 關閉時重置狀態
      setReportType('PROCESSING_RECORDS')
      setOutputFormat('EXCEL')
      setTitle('')
      setDateFrom(defaultDateRange.from)
      setDateTo(defaultDateRange.to)
      setIncludeChanges(true)
      setIncludeFiles(true)
      setShowAdvanced(false)
    }
    onOpenChange(newOpen)
  }

  // --- Render ---
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-blue-600" />
            匯出審計報告
          </DialogTitle>
          <DialogDescription>
            配置報告選項並匯出審計數據。大量數據將在背景處理。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 報告標題 */}
          <div className="space-y-2">
            <Label htmlFor="title">
              報告標題 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例：2025年1月處理記錄審計報告"
              maxLength={200}
              disabled={isSubmitting}
            />
          </div>

          {/* 報告類型 */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">報告類型</Label>
            <RadioGroup
              value={reportType}
              onValueChange={(v) => setReportType(v as AuditReportType)}
              className="grid grid-cols-2 gap-3"
            >
              {Object.values(AUDIT_REPORT_TYPES).map((config) => {
                const Icon = REPORT_TYPE_ICONS[config.value]
                const isSelected = reportType === config.value

                return (
                  <div
                    key={config.value}
                    className={cn(
                      'flex items-start space-x-3 rounded-lg border p-3 cursor-pointer transition-colors',
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'hover:bg-muted/50'
                    )}
                    onClick={() => setReportType(config.value)}
                  >
                    <RadioGroupItem
                      value={config.value}
                      id={config.value}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <Label
                        htmlFor={config.value}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-sm">{config.label}</span>
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {config.description}
                      </p>
                    </div>
                  </div>
                )
              })}
            </RadioGroup>
          </div>

          {/* 日期範圍 */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Calendar className="h-4 w-4" />
              日期範圍
            </Label>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Label htmlFor="dateFrom" className="text-xs text-muted-foreground">
                  開始日期
                </Label>
                <Input
                  id="dateFrom"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  max={dateTo}
                  disabled={isSubmitting}
                />
              </div>
              <span className="text-muted-foreground mt-4">至</span>
              <div className="flex-1">
                <Label htmlFor="dateTo" className="text-xs text-muted-foreground">
                  結束日期
                </Label>
                <Input
                  id="dateTo"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  min={dateFrom}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          {/* 輸出格式 */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">輸出格式</Label>
            <RadioGroup
              value={outputFormat}
              onValueChange={(v) => setOutputFormat(v as ReportOutputFormat)}
              className="flex flex-wrap gap-3"
            >
              {Object.values(REPORT_OUTPUT_FORMATS).map((config) => {
                const Icon = OUTPUT_FORMAT_ICONS[config.value]
                const isSelected = outputFormat === config.value

                return (
                  <div
                    key={config.value}
                    className={cn(
                      'flex items-center space-x-2 rounded-lg border px-4 py-2 cursor-pointer transition-colors',
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'hover:bg-muted/50'
                    )}
                    onClick={() => setOutputFormat(config.value)}
                  >
                    <RadioGroupItem value={config.value} id={`format-${config.value}`} />
                    <Label
                      htmlFor={`format-${config.value}`}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{config.label}</span>
                    </Label>
                  </div>
                )
              })}
            </RadioGroup>
          </div>

          {/* 進階選項 */}
          <div className="space-y-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-muted-foreground"
            >
              <Filter className="h-4 w-4" />
              {showAdvanced ? '隱藏進階選項' : '顯示進階選項'}
            </Button>

            {showAdvanced && (
              <div className="space-y-4 rounded-lg border p-4 animate-in slide-in-from-top-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="includeChanges">包含變更歷史</Label>
                    <p className="text-xs text-muted-foreground">
                      在報告中包含數據變更記錄
                    </p>
                  </div>
                  <Switch
                    id="includeChanges"
                    checked={includeChanges}
                    onCheckedChange={setIncludeChanges}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="includeFiles">包含文件清單</Label>
                    <p className="text-xs text-muted-foreground">
                      在報告中包含原始文件列表
                    </p>
                  </div>
                  <Switch
                    id="includeFiles"
                    checked={includeFiles}
                    onCheckedChange={setIncludeFiles}
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 大量數據警告 */}
          {isLargeReport && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm text-amber-800">
                預估記錄數超過 {LARGE_REPORT_THRESHOLD.toLocaleString()} 筆，
                報告將在背景處理。您可以在報告列表中查看進度。
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            取消
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                建立中...
              </>
            ) : (
              <>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                建立報告
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
