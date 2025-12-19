'use client'

/**
 * @fileoverview Forwarder Logo 上傳組件
 * @description
 *   提供 Forwarder Logo 的拖放上傳和預覽功能。
 *   支援圖片類型驗證、檔案大小限制和預覽顯示。
 *
 * @module src/components/features/forwarders/LogoUploader
 * @author Development Team
 * @since Epic 5 - Story 5.5 (新增/停用貨代商配置)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 拖放上傳
 *   - 點擊選擇文件
 *   - 即時預覽
 *   - 檔案類型驗證
 *   - 檔案大小限制
 *   - 移除現有 Logo
 *
 * @dependencies
 *   - react-dropzone - 拖放上傳
 *   - @/types/forwarder - Logo 配置
 */

import * as React from 'react'
import { useCallback, useState } from 'react'
import { useDropzone, FileRejection } from 'react-dropzone'
import Image from 'next/image'
import { Upload, X, ImageIcon, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { LOGO_UPLOAD_CONFIG } from '@/types/forwarder'

// ============================================================
// Types
// ============================================================

interface LogoUploaderProps {
  /** 當前 Logo URL（用於編輯模式） */
  currentLogoUrl?: string | null
  /** Logo 變更回調 */
  onLogoChange: (file: File | null) => void
  /** 請求移除現有 Logo */
  onRemoveLogo?: () => void
  /** 錯誤訊息 */
  error?: string
  /** 是否禁用 */
  disabled?: boolean
  /** 自定義 className */
  className?: string
}

// ============================================================
// Component
// ============================================================

/**
 * @component LogoUploader
 * @description
 *   Forwarder Logo 上傳組件，支援拖放和點擊上傳。
 *   提供即時預覽、檔案驗證和錯誤提示。
 */
export function LogoUploader({
  currentLogoUrl,
  onLogoChange,
  onRemoveLogo,
  error,
  disabled = false,
  className,
}: LogoUploaderProps) {
  // --- State ---
  const [preview, setPreview] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  // --- Handlers ---
  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      // 清除之前的錯誤
      setUploadError(null)

      // 處理被拒絕的文件
      if (rejectedFiles.length > 0) {
        const rejection = rejectedFiles[0]
        const errorCode = rejection.errors[0]?.code

        switch (errorCode) {
          case 'file-too-large':
            setUploadError(
              `檔案大小超過限制（最大 ${LOGO_UPLOAD_CONFIG.maxSize / 1024 / 1024}MB）`
            )
            break
          case 'file-invalid-type':
            setUploadError('不支援的檔案格式，請上傳 PNG、JPEG、WebP、GIF 或 SVG 圖片')
            break
          default:
            setUploadError('檔案上傳失敗，請重試')
        }
        return
      }

      // 處理接受的文件
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0]
        setSelectedFile(file)

        // 創建預覽 URL
        const objectUrl = URL.createObjectURL(file)
        setPreview(objectUrl)

        // 通知父組件
        onLogoChange(file)
      }
    },
    [onLogoChange]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/webp': ['.webp'],
      'image/gif': ['.gif'],
      'image/svg+xml': ['.svg'],
    },
    maxSize: LOGO_UPLOAD_CONFIG.maxSize,
    multiple: false,
    disabled,
  })

  const handleRemove = useCallback(() => {
    // 清除預覽
    if (preview) {
      URL.revokeObjectURL(preview)
    }
    setPreview(null)
    setSelectedFile(null)
    setUploadError(null)

    // 通知父組件
    onLogoChange(null)

    // 如果有現有 Logo，請求移除
    if (currentLogoUrl && onRemoveLogo) {
      onRemoveLogo()
    }
  }, [preview, currentLogoUrl, onLogoChange, onRemoveLogo])

  // 清理預覽 URL
  React.useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview)
      }
    }
  }, [preview])

  // --- Render ---
  const displayUrl = preview || currentLogoUrl
  const displayError = uploadError || error

  return (
    <div className={cn('space-y-2', className)}>
      {/* 上傳區域 */}
      <div
        {...getRootProps()}
        className={cn(
          'relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors',
          isDragActive && 'border-primary bg-primary/5',
          !isDragActive && !displayUrl && 'border-muted-foreground/25 hover:border-primary/50',
          displayUrl && 'border-muted-foreground/25',
          disabled && 'cursor-not-allowed opacity-50',
          !disabled && !displayUrl && 'cursor-pointer',
          displayError && 'border-destructive'
        )}
      >
        <input {...getInputProps()} />

        {displayUrl ? (
          // 預覽模式
          <div className="relative">
            <div className="relative h-24 w-24 overflow-hidden rounded-lg bg-muted">
              <Image
                src={displayUrl}
                alt="Logo preview"
                fill
                className="object-contain"
                unoptimized={displayUrl.startsWith('blob:')}
              />
            </div>
            {!disabled && (
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute -right-2 -top-2 h-6 w-6 rounded-full"
                onClick={(e) => {
                  e.stopPropagation()
                  handleRemove()
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
            {!disabled && (
              <p className="mt-2 text-center text-xs text-muted-foreground">
                點擊或拖放以更換 Logo
              </p>
            )}
          </div>
        ) : (
          // 上傳模式
          <div className="flex flex-col items-center gap-2 text-center">
            {isDragActive ? (
              <>
                <Upload className="h-10 w-10 text-primary" />
                <p className="text-sm font-medium text-primary">放開以上傳</p>
              </>
            ) : (
              <>
                <ImageIcon className="h-10 w-10 text-muted-foreground" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    <span className="text-primary">點擊上傳</span> 或拖放圖片
                  </p>
                  <p className="text-xs text-muted-foreground">
                    支援 PNG, JPEG, WebP, GIF, SVG（最大{' '}
                    {LOGO_UPLOAD_CONFIG.maxSize / 1024 / 1024}MB）
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* 錯誤訊息 */}
      {displayError && (
        <div className="flex items-center gap-1 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>{displayError}</span>
        </div>
      )}

      {/* 已選擇文件資訊 */}
      {selectedFile && !displayError && (
        <p className="text-xs text-muted-foreground">
          已選擇: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
        </p>
      )}
    </div>
  )
}
