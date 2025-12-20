'use client'

/**
 * @fileoverview 報告完整性驗證對話框組件
 * @description
 *   提供報告完整性驗證的對話框介面：
 *   - 上傳報告檔案進行驗證
 *   - 顯示 checksum 和簽章驗證結果
 *   - 支援拖放上傳
 *
 * @module src/components/features/audit/ReportIntegrityDialog
 * @since Epic 8 - Story 8.5 (審計報告匯出)
 * @lastModified 2025-12-20
 *
 * @dependencies
 *   - @/components/ui/* - shadcn/ui 組件
 *   - lucide-react - 圖示
 */

import * as React from 'react'
import {
  Shield,
  CheckCircle,
  XCircle,
  Upload,
  Loader2,
  FileCheck,
  AlertCircle,
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
import { cn } from '@/lib/utils'

// ============================================================
// Types
// ============================================================

interface ReportIntegrityDialogProps {
  /** 對話框開啟狀態 */
  open: boolean
  /** 開啟狀態變更回呼 */
  onOpenChange: (open: boolean) => void
  /** 報告任務 ID */
  jobId: string
  /** 報告名稱 */
  reportTitle: string
  /** 驗證報告回呼 */
  onVerify: (jobId: string, fileContent: string) => Promise<VerifyResult>
}

interface VerifyResult {
  isValid: boolean
  details: {
    checksumMatch: boolean
    signatureValid: boolean
    originalChecksum: string
    calculatedChecksum: string
  }
  verifiedAt: string
}

// ============================================================
// Component
// ============================================================

/**
 * 報告完整性驗證對話框
 *
 * @description 用於驗證報告檔案完整性的對話框。
 *   用戶可以上傳報告檔案，系統會比對 checksum 和驗證數位簽章。
 *
 * @example
 * ```tsx
 * <ReportIntegrityDialog
 *   open={showDialog}
 *   onOpenChange={setShowDialog}
 *   jobId={selectedJobId}
 *   reportTitle={selectedJobTitle}
 *   onVerify={handleVerify}
 * />
 * ```
 */
export function ReportIntegrityDialog({
  open,
  onOpenChange,
  jobId,
  reportTitle,
  onVerify,
}: ReportIntegrityDialogProps) {
  // --- State ---
  const [file, setFile] = React.useState<File | null>(null)
  const [isVerifying, setIsVerifying] = React.useState(false)
  const [result, setResult] = React.useState<VerifyResult | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [isDragOver, setIsDragOver] = React.useState(false)

  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // --- Handlers ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setResult(null)
      setError(null)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      setFile(droppedFile)
      setResult(null)
      setError(null)
    }
  }

  const handleVerify = async () => {
    if (!file) return

    setIsVerifying(true)
    setError(null)
    setResult(null)

    try {
      // 讀取檔案並轉換為 Base64
      const arrayBuffer = await file.arrayBuffer()
      const base64Content = btoa(
        new Uint8Array(arrayBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ''
        )
      )

      const verifyResult = await onVerify(jobId, base64Content)
      setResult(verifyResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : '驗證失敗')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // 關閉時重置狀態
      setFile(null)
      setResult(null)
      setError(null)
      setIsDragOver(false)
    }
    onOpenChange(newOpen)
  }

  // --- Render ---
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            報告完整性驗證
          </DialogTitle>
          <DialogDescription>
            上傳報告檔案以驗證其完整性。系統會比對 SHA-256 checksum 和數位簽章。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 報告資訊 */}
          <div className="rounded-lg border bg-muted/50 p-3">
            <p className="text-sm">
              <span className="text-muted-foreground">報告：</span>
              <span className="font-medium">{reportTitle}</span>
            </p>
          </div>

          {/* 檔案上傳區域 */}
          <div
            className={cn(
              'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
              isDragOver ? 'border-blue-500 bg-blue-50' : 'border-muted-foreground/25',
              file && 'border-green-500 bg-green-50'
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileChange}
              accept=".xlsx,.pdf,.csv,.json"
            />

            {file ? (
              <div className="flex flex-col items-center gap-2">
                <FileCheck className="h-10 w-10 text-green-500" />
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024).toFixed(2)} KB
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  拖放報告檔案至此處，或點擊選擇檔案
                </p>
                <p className="text-xs text-muted-foreground">
                  支援 Excel、PDF、CSV、JSON 格式
                </p>
              </div>
            )}
          </div>

          {/* 驗證結果 */}
          {result && (
            <div
              className={cn(
                'rounded-lg border p-4 animate-in slide-in-from-top-2',
                result.isValid
                  ? 'border-green-200 bg-green-50'
                  : 'border-red-200 bg-red-50'
              )}
            >
              <div className="flex items-start gap-3">
                {result.isValid ? (
                  <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0" />
                ) : (
                  <XCircle className="h-6 w-6 text-red-500 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <p className={cn(
                    'font-medium',
                    result.isValid ? 'text-green-800' : 'text-red-800'
                  )}>
                    {result.isValid ? '報告驗證通過' : '報告驗證失敗'}
                  </p>

                  <div className="mt-2 space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      {result.details.checksumMatch ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className={result.details.checksumMatch ? 'text-green-700' : 'text-red-700'}>
                        Checksum {result.details.checksumMatch ? '相符' : '不相符'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {result.details.signatureValid ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className={result.details.signatureValid ? 'text-green-700' : 'text-red-700'}>
                        數位簽章 {result.details.signatureValid ? '有效' : '無效'}
                      </span>
                    </div>
                  </div>

                  {!result.isValid && (
                    <div className="mt-3 pt-3 border-t border-red-200">
                      <p className="text-xs text-red-600 font-mono">
                        原始 Checksum: {result.details.originalChecksum.slice(0, 16)}...
                      </p>
                      <p className="text-xs text-red-600 font-mono">
                        計算 Checksum: {result.details.calculatedChecksum.slice(0, 16)}...
                      </p>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground mt-2">
                    驗證時間：{new Date(result.verifiedAt).toLocaleString('zh-TW')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 錯誤訊息 */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isVerifying}
          >
            關閉
          </Button>
          <Button
            onClick={handleVerify}
            disabled={!file || isVerifying}
          >
            {isVerifying ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                驗證中...
              </>
            ) : (
              <>
                <Shield className="h-4 w-4 mr-2" />
                驗證報告
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
