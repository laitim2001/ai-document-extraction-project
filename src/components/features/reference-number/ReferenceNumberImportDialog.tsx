'use client'

/**
 * @fileoverview Reference Number 導入對話框
 * @description
 *   批次導入 Reference Number 的對話框：
 *   - 支援 JSON 文件上傳
 *   - 顯示檔案名稱和待導入項目數量
 *   - 可選 overwriteExisting / skipInvalid 選項
 *   - 導入完成後顯示統計結果（imported, updated, skipped, errors）
 *   - 錯誤可查看詳情
 *
 * @module src/components/features/reference-number/ReferenceNumberImportDialog
 * @since Epic 20 - Story 20.6 (Management Page - Form & Import)
 * @lastModified 2026-02-05
 *
 * @dependencies
 *   - next-intl - 國際化
 *   - @/components/ui/dialog - 對話框
 *   - @/hooks/use-reference-numbers - Import hook
 *   - @/hooks/use-toast - Toast 通知
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Upload, FileJson, Loader2, CheckCircle, AlertTriangle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  useImportReferenceNumbers,
} from '@/hooks/use-reference-numbers'
import type { ImportReferenceNumbersResult } from '@/hooks/use-reference-numbers'

// ============================================================
// Types
// ============================================================

interface ReferenceNumberImportDialogProps {
  /** 對話框是否開啟 */
  open: boolean
  /** 控制對話框開關 */
  onOpenChange: (open: boolean) => void
  /** 導入成功後的回調 */
  onSuccess: () => void
}

interface ParsedImportData {
  exportVersion?: string
  items: Array<{
    code?: string
    number: string
    type: string
    year: number
    regionCode: string
    description?: string
    validFrom?: string
    validUntil?: string
    isActive?: boolean
  }>
}

// ============================================================
// Component
// ============================================================

export function ReferenceNumberImportDialog({
  open,
  onOpenChange,
  onSuccess,
}: ReferenceNumberImportDialogProps) {
  const t = useTranslations('referenceNumber.import')
  const tMsg = useTranslations('referenceNumber.messages')
  const { toast } = useToast()

  const [file, setFile] = React.useState<File | null>(null)
  const [parsedData, setParsedData] = React.useState<ParsedImportData | null>(null)
  const [parseError, setParseError] = React.useState(false)
  const [overwriteExisting, setOverwriteExisting] = React.useState(false)
  const [skipInvalid, setSkipInvalid] = React.useState(true)
  const [result, setResult] = React.useState<ImportReferenceNumbersResult | null>(null)

  const importMutation = useImportReferenceNumbers()

  // --- Reset State ---

  const resetState = React.useCallback(() => {
    setFile(null)
    setParsedData(null)
    setParseError(false)
    setOverwriteExisting(false)
    setSkipInvalid(true)
    setResult(null)
  }, [])

  // --- Handlers ---

  const handleFileChange = React.useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0]
      if (!selectedFile) return

      setFile(selectedFile)
      setResult(null)
      setParseError(false)

      try {
        const text = await selectedFile.text()
        const parsed: ParsedImportData = JSON.parse(text)

        if (!parsed.items || !Array.isArray(parsed.items)) {
          setParseError(true)
          setParsedData(null)
          return
        }

        setParsedData(parsed)
      } catch {
        setParseError(true)
        setParsedData(null)
      }
    },
    []
  )

  const handleImport = React.useCallback(async () => {
    if (!parsedData) return

    try {
      const importResult = await importMutation.mutateAsync({
        exportVersion: parsedData.exportVersion,
        items: parsedData.items,
        options: { overwriteExisting, skipInvalid },
      })
      setResult(importResult)
    } catch {
      toast({
        variant: 'destructive',
        title: tMsg('importFailed'),
      })
    }
  }, [parsedData, overwriteExisting, skipInvalid, importMutation, toast, tMsg])

  const handleClose = React.useCallback(() => {
    if (result && result.imported > 0) {
      onSuccess()
    }
    resetState()
    onOpenChange(false)
  }, [result, onSuccess, resetState, onOpenChange])

  // --- Render ---

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 文件上傳 */}
          {!result && (
            <>
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileChange}
                  className="hidden"
                  id="import-file"
                />
                <label htmlFor="import-file" className="cursor-pointer">
                  {file ? (
                    <div className="flex items-center justify-center gap-3">
                      <FileJson className="h-8 w-8 text-blue-500" />
                      <div className="text-left">
                        <p className="font-medium">{file.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {parsedData
                            ? `${parsedData.items.length} ${t('items')}`
                            : parseError
                              ? t('parseError')
                              : '...'
                          }
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">{t('dropzone')}</p>
                    </div>
                  )}
                </label>
              </div>

              {/* 解析錯誤 */}
              {parseError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{t('parseError')}</AlertDescription>
                </Alert>
              )}

              {/* 選項 */}
              {parsedData && (
                <div className="space-y-3">
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={overwriteExisting}
                      onCheckedChange={(v) => setOverwriteExisting(!!v)}
                    />
                    <span className="text-sm">{t('overwriteExisting')}</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={skipInvalid}
                      onCheckedChange={(v) => setSkipInvalid(!!v)}
                    />
                    <span className="text-sm">{t('skipInvalid')}</span>
                  </label>
                </div>
              )}
            </>
          )}

          {/* 結果 */}
          {result && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>{t('result.title')}</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1 mt-2">
                  <li>{t('result.imported', { count: result.imported })}</li>
                  <li>{t('result.updated', { count: result.updated })}</li>
                  <li>{t('result.skipped', { count: result.skipped })}</li>
                  {result.errors.length > 0 && (
                    <li className="text-destructive">
                      {t('result.errors', { count: result.errors.length })}
                    </li>
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* 錯誤詳情 */}
          {result && result.errors.length > 0 && (
            <div className="max-h-40 overflow-auto text-sm space-y-1">
              {result.errors.map((err, i) => (
                <div key={i} className="flex gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>Row {err.index + 1}: {err.error}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 按鈕 */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose}>
            {result ? t('close') : t('cancel')}
          </Button>
          {!result && (
            <Button
              onClick={handleImport}
              disabled={!parsedData || importMutation.isPending}
            >
              {importMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {t('import')}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
