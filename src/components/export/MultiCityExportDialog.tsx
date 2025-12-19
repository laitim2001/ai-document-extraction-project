'use client'

/**
 * @fileoverview 多城市報表匯出對話框
 * @description
 *   提供跨城市數據報表匯出的配置介面：
 *   - 城市選擇
 *   - 日期範圍選擇
 *   - 報表格式選擇
 *   - 報表類型選擇
 *   - 匯出進度顯示
 *
 * @module src/components/export/MultiCityExportDialog
 * @author Development Team
 * @since Epic 6 - Story 6.3 (Regional Manager Cross-City Access)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 多城市選擇
 *   - 日期範圍篩選
 *   - 多種報表格式
 *   - 匯出進度反饋
 *
 * @dependencies
 *   - @tanstack/react-query - 數據查詢
 *   - @/hooks/useUserCity - 用戶城市權限
 *   - @/components/filters/CityMultiSelect - 城市多選
 *   - sonner - Toast 通知
 *
 * @related
 *   - src/app/api/exports/multi-city/route.ts - 匯出 API
 *   - src/components/filters/CityMultiSelect.tsx - 城市多選組件
 */

import { useState, useEffect } from 'react'
import { useUserCity } from '@/hooks/useUserCity'
import { useMutation } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { CityMultiSelect } from '@/components/filters/CityMultiSelect'
import { toast } from 'sonner'
import { Download, Loader2, FileSpreadsheet, FileText, FileJson } from 'lucide-react'

// ============================================================
// Types
// ============================================================

interface MultiCityExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type ExportFormat = 'xlsx' | 'pdf' | 'json'
type ReportType = 'summary' | 'detailed' | 'comparison'
type Aggregation = 'individual' | 'combined'

interface ExportConfig {
  cityCodes: string[]
  format: ExportFormat
  aggregation: Aggregation
  includeCityBreakdown: boolean
  reportType: ReportType
  dateFrom?: string
  dateTo?: string
}

// ============================================================
// Constants
// ============================================================

const FORMAT_OPTIONS: Array<{
  value: ExportFormat
  label: string
  description: string
  icon: typeof FileSpreadsheet
}> = [
  {
    value: 'xlsx',
    label: 'Excel (CSV)',
    description: '適合進一步分析',
    icon: FileSpreadsheet,
  },
  {
    value: 'pdf',
    label: 'PDF',
    description: '適合分享和列印（暫未支援）',
    icon: FileText,
  },
  {
    value: 'json',
    label: 'JSON',
    description: '適合程式處理',
    icon: FileJson,
  },
]

const REPORT_TYPE_OPTIONS: Array<{
  value: ReportType
  label: string
  description: string
}> = [
  {
    value: 'summary',
    label: '摘要報表',
    description: '各城市的統計摘要',
  },
  {
    value: 'detailed',
    label: '詳細報表',
    description: '包含所有文件列表',
  },
  {
    value: 'comparison',
    label: '對比報表',
    description: '城市間的績效比較',
  },
]

// ============================================================
// Component
// ============================================================

/**
 * 多城市報表匯出對話框
 *
 * @description
 *   提供用戶選擇城市、日期範圍和報表格式的介面，
 *   然後調用 API 生成並下載報表。
 *
 * @example
 *   <MultiCityExportDialog
 *     open={showExportDialog}
 *     onOpenChange={setShowExportDialog}
 *   />
 */
export function MultiCityExportDialog({
  open,
  onOpenChange,
}: MultiCityExportDialogProps) {
  // --- Hooks ---
  const { cityCodes: userCityCodes, isSingleCity, isLoading: userLoading } = useUserCity()

  const [config, setConfig] = useState<ExportConfig>({
    cityCodes: [],
    format: 'xlsx',
    aggregation: 'combined',
    includeCityBreakdown: true,
    reportType: 'summary',
  })

  // 初始化選擇的城市
  useEffect(() => {
    if (open && userCityCodes.length > 0 && config.cityCodes.length === 0) {
      setConfig((prev) => ({
        ...prev,
        cityCodes: userCityCodes,
      }))
    }
  }, [open, userCityCodes, config.cityCodes.length])

  // --- Export Mutation ---
  const exportMutation = useMutation({
    mutationFn: async (exportConfig: ExportConfig) => {
      const response = await fetch('/api/exports/multi-city', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...exportConfig,
          dateFrom: exportConfig.dateFrom
            ? new Date(exportConfig.dateFrom).toISOString()
            : undefined,
          dateTo: exportConfig.dateTo
            ? new Date(exportConfig.dateTo).toISOString()
            : undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || error.title || 'Export failed')
      }

      // 下載文件
      const blob = await response.blob()
      const contentDisposition = response.headers.get('Content-Disposition')
      const filename =
        contentDisposition
          ?.split('filename=')[1]
          ?.replace(/"/g, '') || `multi-city-report-${Date.now()}`

      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    },
    onSuccess: () => {
      toast.success('報表已下載')
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(`匯出失敗: ${error.message}`)
    },
  })

  // --- Handlers ---
  const handleExport = () => {
    if (config.cityCodes.length === 0) {
      toast.error('請選擇至少一個城市')
      return
    }
    exportMutation.mutate(config)
  }

  const handleCityChange = (cities: string[]) => {
    setConfig((prev) => ({ ...prev, cityCodes: cities }))
  }

  // --- 單城市用戶不需要此功能 ---
  if (isSingleCity) {
    return null
  }

  // --- Render ---
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            匯出多城市報表
          </DialogTitle>
          <DialogDescription>
            選擇要匯出的城市和報表配置
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 城市選擇 */}
          <div className="space-y-2">
            <Label>選擇城市</Label>
            <CityMultiSelect
              value={config.cityCodes}
              onChange={handleCityChange}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              已選擇 {config.cityCodes.length} 個城市
            </p>
          </div>

          {/* 日期範圍 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dateFrom">開始日期</Label>
              <Input
                id="dateFrom"
                type="date"
                value={config.dateFrom || ''}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, dateFrom: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateTo">結束日期</Label>
              <Input
                id="dateTo"
                type="date"
                value={config.dateTo || ''}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, dateTo: e.target.value }))
                }
              />
            </div>
          </div>

          {/* 報表類型 */}
          <div className="space-y-2">
            <Label>報表類型</Label>
            <RadioGroup
              value={config.reportType}
              onValueChange={(value) =>
                setConfig((prev) => ({
                  ...prev,
                  reportType: value as ReportType,
                }))
              }
              className="space-y-2"
            >
              {REPORT_TYPE_OPTIONS.map((option) => (
                <div
                  key={option.value}
                  className="flex items-start space-x-3 p-2 rounded border hover:bg-muted/50"
                >
                  <RadioGroupItem value={option.value} id={option.value} />
                  <div className="flex-1">
                    <Label htmlFor={option.value} className="cursor-pointer">
                      {option.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {option.description}
                    </p>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* 報表格式 */}
          <div className="space-y-2">
            <Label>報表格式</Label>
            <div className="grid grid-cols-3 gap-2">
              {FORMAT_OPTIONS.map((option) => {
                const Icon = option.icon
                const isSelected = config.format === option.value
                const isDisabled = option.value === 'pdf' // PDF 暫未支援

                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={isDisabled}
                    onClick={() =>
                      setConfig((prev) => ({
                        ...prev,
                        format: option.value,
                      }))
                    }
                    className={`
                      flex flex-col items-center p-3 rounded border transition-colors
                      ${isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}
                      ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                  >
                    <Icon className="h-6 w-6 mb-1" />
                    <span className="text-sm font-medium">{option.label}</span>
                    <span className="text-xs text-muted-foreground text-center">
                      {option.description}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 額外選項 */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeCityBreakdown"
                checked={config.includeCityBreakdown}
                onCheckedChange={(checked) =>
                  setConfig((prev) => ({
                    ...prev,
                    includeCityBreakdown: checked === true,
                  }))
                }
              />
              <Label htmlFor="includeCityBreakdown" className="cursor-pointer">
                包含城市分組詳情
              </Label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={exportMutation.isPending}
          >
            取消
          </Button>
          <Button
            onClick={handleExport}
            disabled={
              exportMutation.isPending ||
              userLoading ||
              config.cityCodes.length === 0
            }
          >
            {exportMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                匯出中...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                匯出報表
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
