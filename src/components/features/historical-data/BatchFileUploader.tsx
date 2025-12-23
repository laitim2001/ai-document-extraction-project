'use client'

/**
 * @fileoverview 批量文件上傳組件
 * @description
 *   提供拖放和點擊上傳的批量文件上傳介面：
 *   - 支援最多 500 個文件
 *   - 每個文件最大 50MB
 *   - 支援 PDF、JPG、PNG、TIFF 格式
 *   - 顯示上傳進度和結果
 *
 * @module src/components/features/historical-data/BatchFileUploader
 * @since Epic 0 - Story 0.1
 * @lastModified 2025-12-23
 */

import * as React from 'react'
import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

// ============================================================
// Types
// ============================================================

interface UploadFile {
  file: File
  id: string
  status: 'pending' | 'uploading' | 'success' | 'error'
  progress: number
  error?: string
  result?: {
    id: string
    detectedType: string | null
    confidence: number
  }
}

interface BatchFileUploaderProps {
  /** 目標批次 ID */
  batchId: string
  /** 上傳完成後的回調 */
  onUploadComplete?: (results: { successful: number; failed: number }) => void
  /** 是否禁用上傳 */
  disabled?: boolean
  /** 額外的 CSS 類名 */
  className?: string
}

// ============================================================
// Constants
// ============================================================

const MAX_FILES = 500
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/tiff': ['.tiff', '.tif'],
}

const FILE_TYPE_LABELS: Record<string, string> = {
  NATIVE_PDF: '原生 PDF',
  SCANNED_PDF: '掃描 PDF',
  IMAGE: '圖片',
}

// ============================================================
// Component
// ============================================================

/**
 * 批量文件上傳組件
 *
 * @description
 *   使用 react-dropzone 實現拖放上傳
 *   支援批量選擇和即時進度顯示
 */
export function BatchFileUploader({
  batchId,
  onUploadComplete,
  disabled = false,
  className,
}: BatchFileUploaderProps) {
  const [files, setFiles] = useState<UploadFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  // --- Handlers ---

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      // 限制總文件數
      const remainingSlots = MAX_FILES - files.length
      const filesToAdd = acceptedFiles.slice(0, remainingSlots)

      const newFiles: UploadFile[] = filesToAdd.map((file) => ({
        file,
        id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
        status: 'pending' as const,
        progress: 0,
      }))

      setFiles((prev) => [...prev, ...newFiles])
    },
    [files.length]
  )

  const removeFile = useCallback((fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId))
  }, [])

  const clearAllFiles = useCallback(() => {
    setFiles([])
  }, [])

  const uploadFiles = useCallback(async () => {
    const pendingFiles = files.filter((f) => f.status === 'pending')
    if (pendingFiles.length === 0) return

    setIsUploading(true)
    let successCount = 0
    let failCount = 0

    // 分批上傳（每批 10 個文件）
    const BATCH_SIZE = 10
    const batches = []
    for (let i = 0; i < pendingFiles.length; i += BATCH_SIZE) {
      batches.push(pendingFiles.slice(i, i + BATCH_SIZE))
    }

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex]

      // 準備 FormData
      const formData = new FormData()
      formData.append('batchId', batchId)
      batch.forEach((f) => formData.append('files', f.file))

      // 更新狀態為上傳中
      setFiles((prev) =>
        prev.map((f) =>
          batch.some((b) => b.id === f.id) ? { ...f, status: 'uploading' as const, progress: 50 } : f
        )
      )

      try {
        const response = await fetch('/api/admin/historical-data/upload', {
          method: 'POST',
          body: formData,
        })

        const result = await response.json()

        if (result.success) {
          const successFiles = new Set(result.data.results.successful.map((s: { originalName: string }) => s.originalName))
          const failedMap = new Map<string, string>(
            result.data.results.failed.map((f: { fileName: string; error: string }) => [f.fileName, f.error] as [string, string])
          )

          setFiles((prev) =>
            prev.map((f) => {
              if (!batch.some((b) => b.id === f.id)) return f

              if (successFiles.has(f.file.name)) {
                successCount++
                const successResult = result.data.results.successful.find(
                  (s: { originalName: string }) => s.originalName === f.file.name
                ) as { id: string; detectedType: string | null; confidence: number } | undefined
                return {
                  ...f,
                  status: 'success' as const,
                  progress: 100,
                  result: successResult,
                }
              } else if (failedMap.has(f.file.name)) {
                failCount++
                return {
                  ...f,
                  status: 'error' as const,
                  progress: 100,
                  error: failedMap.get(f.file.name),
                }
              }
              return f
            })
          )
        } else {
          // API 錯誤
          setFiles((prev) =>
            prev.map((f) =>
              batch.some((b) => b.id === f.id)
                ? { ...f, status: 'error' as const, progress: 100, error: result.detail || '上傳失敗' }
                : f
            )
          )
          failCount += batch.length
        }
      } catch (_error) {
        // 網絡錯誤
        setFiles((prev) =>
          prev.map((f) =>
            batch.some((b) => b.id === f.id)
              ? { ...f, status: 'error' as const, progress: 100, error: '網絡錯誤' }
              : f
          )
        )
        failCount += batch.length
      }

      // 更新總進度
      setUploadProgress(Math.round(((batchIndex + 1) / batches.length) * 100))
    }

    setIsUploading(false)
    onUploadComplete?.({ successful: successCount, failed: failCount })
  }, [files, batchId, onUploadComplete])

  // --- Dropzone ---

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_FILE_SIZE,
    disabled: disabled || isUploading,
  })

  // --- Computed ---

  const pendingCount = files.filter((f) => f.status === 'pending').length
  const successCount = files.filter((f) => f.status === 'success').length
  const errorCount = files.filter((f) => f.status === 'error').length

  // --- Render ---

  return (
    <div className={cn('space-y-4', className)}>
      {/* 拖放區域 */}
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          isDragActive && 'border-primary bg-primary/5',
          isDragReject && 'border-destructive bg-destructive/5',
          disabled && 'opacity-50 cursor-not-allowed',
          !isDragActive && !isDragReject && 'border-muted-foreground/25 hover:border-primary/50'
        )}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg font-medium">
          {isDragActive ? '放開以上傳文件' : '拖放文件到此處，或點擊選擇'}
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          支援 PDF、JPG、PNG、TIFF 格式，每個文件最大 50MB，最多 {MAX_FILES} 個文件
        </p>
      </div>

      {/* 文件列表 */}
      {files.length > 0 && (
        <Card>
          <CardContent className="p-4">
            {/* 統計和操作 */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">已選擇 {files.length} 個文件</span>
                {successCount > 0 && (
                  <Badge variant="default" className="bg-green-500">
                    成功 {successCount}
                  </Badge>
                )}
                {errorCount > 0 && (
                  <Badge variant="destructive">失敗 {errorCount}</Badge>
                )}
                {pendingCount > 0 && (
                  <Badge variant="secondary">待上傳 {pendingCount}</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!isUploading && pendingCount > 0 && (
                  <Button onClick={uploadFiles} size="sm">
                    <Upload className="h-4 w-4 mr-2" />
                    上傳 {pendingCount} 個文件
                  </Button>
                )}
                {!isUploading && (
                  <Button variant="outline" size="sm" onClick={clearAllFiles}>
                    清除全部
                  </Button>
                )}
              </div>
            </div>

            {/* 上傳進度 */}
            {isUploading && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">上傳中...</span>
                  <span className="text-sm text-muted-foreground">{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} />
              </div>
            )}

            {/* 文件列表 */}
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 p-2 rounded-md bg-muted/50"
                  >
                    {/* 狀態圖標 */}
                    {file.status === 'pending' && (
                      <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    )}
                    {file.status === 'uploading' && (
                      <Loader2 className="h-5 w-5 text-primary animate-spin flex-shrink-0" />
                    )}
                    {file.status === 'success' && (
                      <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                    )}
                    {file.status === 'error' && (
                      <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                    )}

                    {/* 文件資訊 */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.file.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{(file.file.size / 1024 / 1024).toFixed(2)} MB</span>
                        {file.result?.detectedType && (
                          <Badge variant="outline" className="text-xs">
                            {FILE_TYPE_LABELS[file.result.detectedType] || file.result.detectedType}
                          </Badge>
                        )}
                        {file.result?.confidence && (
                          <span>信心度: {file.result.confidence}%</span>
                        )}
                        {file.error && (
                          <span className="text-destructive">{file.error}</span>
                        )}
                      </div>
                    </div>

                    {/* 移除按鈕 */}
                    {file.status === 'pending' && !isUploading && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => removeFile(file.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
