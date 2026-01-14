'use client'

/**
 * @fileoverview 文件上傳組件
 * @description
 *   提供發票文件上傳功能，支援：
 *   - 拖放上傳
 *   - 點擊選擇
 *   - 批量上傳（最多 20 個）
 *   - 文件預覽
 *   - 進度顯示
 *   - 錯誤處理
 *
 * @module src/components/features/invoice/FileUploader
 * @author Development Team
 * @since Epic 2 - Story 2.1 (File Upload Interface & Validation)
 * @lastModified 2025-12-18
 *
 * @features
 *   - react-dropzone 整合
 *   - 客戶端文件驗證
 *   - 上傳進度追蹤
 *   - 成功/失敗狀態顯示
 *
 * @dependencies
 *   - react-dropzone - 拖放上傳
 *   - @tanstack/react-query - 伺服器狀態管理
 *   - sonner - Toast 通知
 *
 * @related
 *   - src/app/api/documents/upload/route.ts - 上傳 API
 *   - src/lib/upload/constants.ts - 上傳配置
 */

import { useCallback, useState } from 'react'
import { useDropzone, type FileRejection } from 'react-dropzone'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  Upload,
  FileIcon,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  FileText,
  Image as ImageIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  UPLOAD_CONFIG,
  UPLOAD_ERRORS,
  DROPZONE_ACCEPT,
  formatFileSize,
} from '@/lib/upload'

// ===========================================
// Types
// ===========================================

/**
 * 帶狀態的文件對象
 *
 * @description
 *   不再繼承 File 類型，因為 File 的原生 getter 屬性（如 size, name, type）
 *   在使用 spread operator 時會丟失。改為顯式保存所有需要的屬性。
 */
interface FileWithStatus {
  /** 唯一識別碼 */
  id: string
  /** 文件名稱 */
  name: string
  /** 文件大小 (bytes) */
  size: number
  /** 文件 MIME 類型 */
  type: string
  /** 原始 File 對象（用於上傳） */
  file: File
  /** 預覽 URL (圖片用) */
  preview?: string
  /** 上傳狀態 */
  status: 'pending' | 'uploading' | 'success' | 'error'
  /** 錯誤訊息 */
  error?: string
}

/**
 * 上傳結果
 */
interface UploadResult {
  uploaded: Array<{ id: string; fileName: string; status: string }>
  failed: Array<{ fileName: string; error: string }>
  total: number
  successCount: number
  failedCount: number
}

/**
 * 組件屬性
 */
interface FileUploaderProps {
  /** 城市代碼（可選） */
  cityCode?: string
  /** 上傳完成回調 */
  onUploadComplete?: (result: UploadResult) => void
}

// ===========================================
// Component
// ===========================================

/**
 * 文件上傳組件
 *
 * @component FileUploader
 * @description 提供拖放和點擊上傳功能的發票文件上傳器
 */
export function FileUploader({ cityCode, onUploadComplete }: FileUploaderProps) {
  // --- State ---
  const [files, setFiles] = useState<FileWithStatus[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const queryClient = useQueryClient()

  // --- Handlers ---

  /**
   * 處理文件拖放
   */
  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      // 檢查總數量
      const totalCount = files.length + acceptedFiles.length
      if (totalCount > UPLOAD_CONFIG.MAX_FILES_PER_BATCH) {
        toast.error(UPLOAD_ERRORS.TOO_MANY_FILES)
        return
      }

      // 添加接受的文件
      // 顯式複製 File 屬性，避免 spread operator 丟失原生 getter
      const newFiles: FileWithStatus[] = acceptedFiles.map((file) => ({
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        size: file.size,
        type: file.type,
        file: file, // 保留原始 File 對象用於上傳
        preview: file.type.startsWith('image/')
          ? URL.createObjectURL(file)
          : undefined,
        status: 'pending' as const,
      }))

      setFiles((prev) => [...prev, ...newFiles])

      // 顯示拒絕的文件錯誤
      rejectedFiles.forEach((rejection) => {
        const error = rejection.errors[0]
        if (error.code === 'file-invalid-type') {
          toast.error(`${rejection.file.name}: ${UPLOAD_ERRORS.INVALID_TYPE}`)
        } else if (error.code === 'file-too-large') {
          toast.error(`${rejection.file.name}: ${UPLOAD_ERRORS.FILE_TOO_LARGE}`)
        }
      })
    },
    [files.length]
  )

  /**
   * Dropzone 配置
   */
  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: DROPZONE_ACCEPT,
    maxSize: UPLOAD_CONFIG.MAX_FILE_SIZE,
    maxFiles: UPLOAD_CONFIG.MAX_FILES_PER_BATCH,
    disabled: isUploading,
  })

  /**
   * 移除單個文件
   */
  const removeFile = (fileId: string) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === fileId)
      if (file?.preview) {
        URL.revokeObjectURL(file.preview)
      }
      return prev.filter((f) => f.id !== fileId)
    })
  }

  /**
   * 清除所有文件
   */
  const clearFiles = () => {
    files.forEach((file) => {
      if (file.preview) {
        URL.revokeObjectURL(file.preview)
      }
    })
    setFiles([])
  }

  /**
   * 上傳 Mutation
   */
  const uploadMutation = useMutation({
    mutationFn: async (filesToUpload: FileWithStatus[]): Promise<UploadResult> => {
      const formData = new FormData()
      filesToUpload.forEach((fileItem) => {
        // 使用保存的原始 File 對象
        formData.append('files', fileItem.file)
      })
      if (cityCode) {
        formData.append('cityCode', cityCode)
      }

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.detail || '上傳失敗')
      }

      const result = await response.json()
      return result.data
    },
    onSuccess: (result) => {
      // 更新文件狀態
      setFiles((prev) =>
        prev.map((file) => {
          const uploaded = result.uploaded.find((u) => u.fileName === file.name)
          const failed = result.failed.find((f) => f.fileName === file.name)

          if (uploaded) {
            return { ...file, status: 'success' as const }
          }
          if (failed) {
            return { ...file, status: 'error' as const, error: failed.error }
          }
          return file
        })
      )

      // 顯示 Toast
      if (result.uploaded.length > 0) {
        toast.success(`成功上傳 ${result.uploaded.length} 個文件`)
      }
      if (result.failed.length > 0) {
        toast.error(`${result.failed.length} 個文件上傳失敗`)
      }

      // 使緩存失效
      queryClient.invalidateQueries({ queryKey: ['documents'] })

      // 回調
      onUploadComplete?.(result)
    },
    onError: (error: Error) => {
      toast.error(error.message)
      setFiles((prev) =>
        prev.map((file) =>
          file.status === 'uploading'
            ? { ...file, status: 'error' as const, error: error.message }
            : file
        )
      )
    },
  })

  /**
   * 處理上傳
   */
  const handleUpload = async () => {
    const pendingFiles = files.filter((f) => f.status === 'pending')
    if (pendingFiles.length === 0) {
      toast.error('沒有待上傳的文件')
      return
    }

    setIsUploading(true)
    setUploadProgress(0)

    // 更新狀態為上傳中
    setFiles((prev) =>
      prev.map((file) =>
        file.status === 'pending' ? { ...file, status: 'uploading' as const } : file
      )
    )

    // 模擬進度（實際進度需要 XHR）
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => Math.min(prev + 10, 90))
    }, 200)

    try {
      await uploadMutation.mutateAsync(pendingFiles)
      setUploadProgress(100)
    } finally {
      clearInterval(progressInterval)
      setIsUploading(false)
    }
  }

  /**
   * 獲取文件圖標
   */
  const getFileIcon = (type: string | undefined) => {
    if (!type) {
      return <FileIcon className="h-8 w-8 text-gray-500" />
    }
    if (type === 'application/pdf') {
      return <FileText className="h-8 w-8 text-red-500" />
    }
    if (type.startsWith('image/')) {
      return <ImageIcon className="h-8 w-8 text-blue-500" />
    }
    return <FileIcon className="h-8 w-8 text-gray-500" />
  }

  // --- Derived State ---
  const pendingCount = files.filter((f) => f.status === 'pending').length
  const hasFiles = files.length > 0

  // --- Render ---
  return (
    <div className="space-y-4">
      {/* Dropzone 區域 */}
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          isDragActive && !isDragReject && 'border-primary bg-primary/5',
          isDragReject && 'border-destructive bg-destructive/5',
          !isDragActive && 'border-muted-foreground/25 hover:border-primary/50',
          isUploading && 'pointer-events-none opacity-50'
        )}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        {isDragActive ? (
          <p className="text-lg font-medium">
            {isDragReject ? '不支援的文件格式' : '放開以上傳文件'}
          </p>
        ) : (
          <>
            <p className="text-lg font-medium">拖放文件到此處，或點擊選擇</p>
            <p className="text-sm text-muted-foreground mt-1">
              支援 {UPLOAD_CONFIG.ACCEPT_LABEL}，單個文件最大{' '}
              {UPLOAD_CONFIG.MAX_FILE_SIZE_DISPLAY}
            </p>
            <p className="text-sm text-muted-foreground">
              最多 {UPLOAD_CONFIG.MAX_FILES_PER_BATCH} 個文件
            </p>
          </>
        )}
      </div>

      {/* 文件列表 */}
      {hasFiles && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">
                已選擇 {files.length} 個文件
                {pendingCount > 0 && pendingCount !== files.length && (
                  <span className="text-muted-foreground ml-2">
                    ({pendingCount} 個待上傳)
                  </span>
                )}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFiles}
                disabled={isUploading}
              >
                清除全部
              </Button>
            </div>

            {/* 進度條 */}
            {isUploading && (
              <div className="mb-4">
                <Progress value={uploadProgress} className="h-2" />
                <p className="text-sm text-muted-foreground mt-1 text-center">
                  上傳中... {uploadProgress}%
                </p>
              </div>
            )}

            {/* 文件項目 */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {files.map((file) => (
                <div
                  key={file.id}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border',
                    file.status === 'success' && 'bg-green-50 border-green-200',
                    file.status === 'error' && 'bg-red-50 border-red-200',
                    file.status === 'uploading' && 'bg-blue-50 border-blue-200'
                  )}
                >
                  {/* 文件圖標 */}
                  {getFileIcon(file.type)}

                  {/* 文件資訊 */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(file.size)}
                    </p>
                    {file.error && (
                      <p className="text-sm text-destructive">{file.error}</p>
                    )}
                  </div>

                  {/* 狀態 */}
                  <div className="flex items-center gap-2">
                    {file.status === 'pending' && (
                      <Badge variant="secondary">待上傳</Badge>
                    )}
                    {file.status === 'uploading' && (
                      <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                    )}
                    {file.status === 'success' && (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    )}
                    {file.status === 'error' && (
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    )}

                    {/* 移除按鈕 */}
                    {!isUploading && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removeFile(file.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 上傳按鈕 */}
      {hasFiles && pendingCount > 0 && (
        <Button
          onClick={handleUpload}
          disabled={isUploading}
          className="w-full"
          size="lg"
        >
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              上傳中...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              上傳 {pendingCount} 個文件
            </>
          )}
        </Button>
      )}
    </div>
  )
}
