'use client'

/**
 * @fileoverview Exchange Rate Import Dialog 匯率導入對話框組件
 * @description
 *   提供批次導入匯率功能：
 *   - 支援上傳 JSON 檔案
 *   - 支援貼上 JSON 文字
 *   - 顯示預覽表格
 *   - 導入選項（覆蓋現有、跳過無效）
 *   - 顯示導入結果統計和錯誤詳情
 *
 * @module src/components/features/exchange-rate/ExchangeRateImportDialog
 * @since Epic 21 - Story 21.8 (Management Page - Calculator & Import)
 * @lastModified 2026-02-06
 *
 * @dependencies
 *   - next-intl - 國際化
 *   - @/components/ui - UI 組件
 *   - @/hooks/use-exchange-rates - 匯率 API Hooks
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  Upload,
  FileJson,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useImportExchangeRates } from '@/hooks/use-exchange-rates'

// ============================================================
// Types
// ============================================================

interface ImportResult {
  imported: number
  updated: number
  skipped: number
  errors: Array<{ index: number; error: string }>
}

interface PreviewItem {
  fromCurrency: string
  toCurrency: string
  rate: number
  effectiveYear: number
}

interface ImportOptions {
  overwriteExisting: boolean
  skipInvalid: boolean
}

interface ExchangeRateImportDialogProps {
  /** 對話框狀態變更回調（用於外部控制刷新列表） */
  onImportSuccess?: () => void
}

// ============================================================
// Component
// ============================================================

/**
 * 匯率導入對話框組件
 *
 * @description
 *   提供批次導入匯率功能，支援 JSON 檔案上傳和文字貼上。
 *   顯示預覽表格、導入選項和結果統計。
 *
 * @param props - 組件屬性
 * @returns React 元素
 *
 * @example
 *   <ExchangeRateImportDialog onImportSuccess={() => refetch()} />
 */
export function ExchangeRateImportDialog({
  onImportSuccess,
}: ExchangeRateImportDialogProps) {
  const t = useTranslations('exchangeRate')

  // --- State ---
  const [open, setOpen] = React.useState(false)
  const [jsonText, setJsonText] = React.useState('')
  const [previewData, setPreviewData] = React.useState<PreviewItem[]>([])
  const [totalCount, setTotalCount] = React.useState(0)
  const [parseError, setParseError] = React.useState<string | null>(null)
  const [options, setOptions] = React.useState<ImportOptions>({
    overwriteExisting: false,
    skipInvalid: true,
  })
  const [result, setResult] = React.useState<ImportResult | null>(null)

  // --- Refs ---
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // --- Hooks ---
  const importMutation = useImportExchangeRates()

  // --- Handlers ---
  const parseJson = React.useCallback(
    (text: string) => {
      if (!text.trim()) {
        setPreviewData([])
        setTotalCount(0)
        setParseError(null)
        return
      }

      try {
        const data = JSON.parse(text)
        const items = data.items || data

        if (!Array.isArray(items)) {
          throw new Error('Invalid format: expected array')
        }

        setTotalCount(items.length)
        // 只預覽前 10 筆
        setPreviewData(items.slice(0, 10))
        setParseError(null)
      } catch (err) {
        setParseError(
          err instanceof Error ? err.message : t('import.parseError')
        )
        setPreviewData([])
        setTotalCount(0)
      }
    },
    [t]
  )

  const handleFileUpload = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (event) => {
        const text = event.target?.result as string
        setJsonText(text)
        parseJson(text)
      }
      reader.onerror = () => {
        setParseError(t('import.parseError'))
      }
      reader.readAsText(file)

      // 重置 input 以允許重複選擇相同檔案
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
    [parseJson, t]
  )

  const handleTextChange = React.useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const text = e.target.value
      setJsonText(text)
      parseJson(text)
    },
    [parseJson]
  )

  const handleImport = React.useCallback(async () => {
    try {
      const data = JSON.parse(jsonText)
      const items = data.items || data

      const importResult = await importMutation.mutateAsync({
        items,
        options,
      })

      setResult(importResult)
      onImportSuccess?.()
    } catch (err) {
      setParseError(
        err instanceof Error ? err.message : t('import.parseError')
      )
    }
  }, [jsonText, options, importMutation, onImportSuccess, t])

  const handleClose = React.useCallback(() => {
    setOpen(false)
    // 延遲重置狀態，避免動畫過程中閃爍
    setTimeout(() => {
      setJsonText('')
      setPreviewData([])
      setTotalCount(0)
      setParseError(null)
      setResult(null)
      setOptions({
        overwriteExisting: false,
        skipInvalid: true,
      })
    }, 300)
  }, [])

  const handleOptionChange = React.useCallback(
    (key: keyof ImportOptions, checked: boolean) => {
      setOptions((prev) => ({ ...prev, [key]: checked }))
    },
    []
  )

  // --- Render ---
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="h-4 w-4 mr-2" />
          {t('actions.import')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('import.title')}</DialogTitle>
          <DialogDescription>
            {t('import.uploadFile')} {t('import.pasteJson')}
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            {/* 檔案上傳 */}
            <div className="flex items-center gap-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
                id="import-file"
              />
              <label
                htmlFor="import-file"
                className="flex items-center gap-2 px-4 py-2 border rounded-md cursor-pointer hover:bg-muted transition-colors"
              >
                <FileJson className="h-4 w-4" />
                {t('import.uploadFile')}
              </label>
            </div>

            {/* JSON 文字輸入 */}
            <div className="space-y-2">
              <Label>{t('import.pasteJson')}</Label>
              <Textarea
                value={jsonText}
                onChange={handleTextChange}
                placeholder='{"items": [{"fromCurrency": "HKD", "toCurrency": "USD", "rate": 0.128, "effectiveYear": 2026}]}'
                rows={6}
                className="font-mono text-sm"
              />
            </div>

            {/* 解析錯誤 */}
            {parseError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{parseError}</AlertDescription>
              </Alert>
            )}

            {/* 預覽 */}
            {previewData.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">
                  {t('import.preview')} ({t('import.previewCount', { count: totalCount })})
                </h4>
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">{t('list.fromCurrency')}</TableHead>
                        <TableHead className="w-20">{t('list.toCurrency')}</TableHead>
                        <TableHead className="w-32">{t('list.rate')}</TableHead>
                        <TableHead className="w-20">{t('list.effectiveYear')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-mono">
                            {item.fromCurrency}
                          </TableCell>
                          <TableCell className="font-mono">
                            {item.toCurrency}
                          </TableCell>
                          <TableCell className="font-mono">
                            {item.rate}
                          </TableCell>
                          <TableCell>{item.effectiveYear}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {totalCount > 10 && (
                  <p className="text-sm text-muted-foreground">
                    ... and {totalCount - 10} more records
                  </p>
                )}
              </div>
            )}

            {/* 選項 */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">{t('import.options')}</h4>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="overwrite"
                    checked={options.overwriteExisting}
                    onCheckedChange={(checked) =>
                      handleOptionChange('overwriteExisting', checked as boolean)
                    }
                  />
                  <Label htmlFor="overwrite" className="text-sm font-normal cursor-pointer">
                    {t('import.overwriteExisting')}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="skipInvalid"
                    checked={options.skipInvalid}
                    onCheckedChange={(checked) =>
                      handleOptionChange('skipInvalid', checked as boolean)
                    }
                  />
                  <Label htmlFor="skipInvalid" className="text-sm font-normal cursor-pointer">
                    {t('import.skipInvalid')}
                  </Label>
                </div>
              </div>
            </div>

            {/* 按鈕 */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={handleClose}>
                {t('form.cancel')}
              </Button>
              <Button
                onClick={handleImport}
                disabled={!previewData.length || importMutation.isPending}
              >
                {importMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {t('import.submit')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <h4 className="text-lg font-medium">{t('import.result.title')}</h4>

            {/* 統計卡片 */}
            <div className="grid grid-cols-4 gap-3">
              <div className="text-center p-3 rounded-lg bg-green-100 dark:bg-green-900/30">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {result.imported}
                </div>
                <div className="text-xs text-green-600 dark:text-green-400">
                  {t('import.result.imported')}
                </div>
              </div>
              <div className="text-center p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {result.updated}
                </div>
                <div className="text-xs text-blue-600 dark:text-blue-400">
                  {t('import.result.updated')}
                </div>
              </div>
              <div className="text-center p-3 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {result.skipped}
                </div>
                <div className="text-xs text-yellow-600 dark:text-yellow-400">
                  {t('import.result.skipped')}
                </div>
              </div>
              <div className="text-center p-3 rounded-lg bg-red-100 dark:bg-red-900/30">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {result.errors.length}
                </div>
                <div className="text-xs text-red-600 dark:text-red-400">
                  {t('import.result.errors')}
                </div>
              </div>
            </div>

            {/* 錯誤詳情 */}
            {result.errors.length > 0 && (
              <div className="space-y-2">
                <h5 className="text-sm font-medium">
                  {t('import.result.errors')}:
                </h5>
                <div className="max-h-40 overflow-y-auto space-y-1 p-2 border rounded-md bg-muted/50">
                  {result.errors.map((error, index) => (
                    <div
                      key={index}
                      className="text-sm text-destructive flex items-start gap-2"
                    >
                      <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>
                        Row {error.index + 1}: {error.error}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 完成按鈕 */}
            <div className="flex justify-end pt-2">
              <Button onClick={handleClose}>
                <CheckCircle className="h-4 w-4 mr-2" />
                {t('import.done')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
