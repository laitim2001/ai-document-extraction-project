'use client';

/**
 * @fileoverview 文件預覽測試頁面上傳組件
 * @description
 *   提供拖放式文件上傳功能，整合 react-dropzone。
 *   支援 PDF、PNG、JPG 格式。
 *   上傳後調用 GPT Vision API 進行實際 OCR 提取。
 *
 * @module src/app/(dashboard)/admin/document-preview-test/components
 * @since Epic 13 - Story 13.6 (文件預覽整合測試頁面)
 * @lastModified 2026-01-03
 *
 * @features
 *   - 拖放式文件上傳（react-dropzone）
 *   - 調用 /api/admin/document-preview-test/extract 進行實際提取
 *   - 處理狀態進度顯示
 */

import * as React from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Image, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// Store
import { useDocumentPreviewTestStore } from '@/stores/document-preview-test-store';

// Types
import type { FileRejection } from 'react-dropzone';

// ============================================================
// Constants
// ============================================================

/** 允許的文件類型 */
const ACCEPTED_FILE_TYPES = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
};

/** 最大文件大小 (20MB) */
const MAX_FILE_SIZE = 20 * 1024 * 1024;

// ============================================================
// Component
// ============================================================

/**
 * @component TestFileUploader
 * @description 拖放式文件上傳組件
 */
export function TestFileUploader() {
  // --- Store Actions ---
  const {
    setCurrentFile,
    setProcessingStatus,
    setProcessingProgress,
    setExtractedFields,
    setTotalPages,
    setError,
  } = useDocumentPreviewTestStore();

  // --- Handlers ---
  const onDrop = React.useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      // Reset error
      setError(null);

      // Start upload
      setProcessingStatus('uploading');
      setProcessingProgress(0);

      try {
        // Create object URL for preview
        const url = URL.createObjectURL(file);

        setCurrentFile({
          id: `upload-${Date.now()}`,
          fileName: file.name,
          mimeType: file.type,
          size: file.size,
          url,
          uploadedAt: new Date().toISOString(),
        });

        setProcessingProgress(50);

        // Start processing
        setProcessingStatus('processing');
        setProcessingProgress(0);

        // Call actual extraction API
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/admin/document-preview-test/extract', {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || '提取失敗');
        }

        // Use real extracted fields from API
        setExtractedFields(result.fields);
        setTotalPages(result.pageCount || 1);

        // Complete
        setProcessingStatus('completed');
        setProcessingProgress(100);

        console.log(`[TestFileUploader] Extraction successful: ${result.fields.length} fields`);
      } catch (error) {
        console.error('File processing error:', error);
        setProcessingStatus('error');
        setError({
          code: 'PROCESSING_ERROR',
          message: '文件處理失敗',
          details: error instanceof Error ? error.message : '未知錯誤',
        });
      }
    },
    [
      setCurrentFile,
      setProcessingStatus,
      setProcessingProgress,
      setExtractedFields,
      setTotalPages,
      setError,
    ]
  );

  const onDropRejected = React.useCallback(
    (fileRejections: FileRejection[]) => {
      const rejection = fileRejections[0];
      if (!rejection) return;

      const errorCode = rejection.errors[0]?.code || 'UNKNOWN';
      let message = '文件上傳失敗';
      let details = '';

      switch (errorCode) {
        case 'file-too-large':
          message = '文件太大';
          details = `最大允許 ${MAX_FILE_SIZE / 1024 / 1024}MB`;
          break;
        case 'file-invalid-type':
          message = '不支援的文件格式';
          details = '僅支援 PDF、PNG、JPG 格式';
          break;
        default:
          details = rejection.errors[0]?.message || '';
      }

      setError({
        code: errorCode,
        message,
        details,
      });
    },
    [setError]
  );

  // --- Dropzone ---
  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    onDropRejected,
    accept: ACCEPTED_FILE_TYPES,
    maxSize: MAX_FILE_SIZE,
    multiple: false,
  });

  // --- Render ---
  return (
    <div
      {...getRootProps()}
      className={cn(
        'flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-lg cursor-pointer transition-colors',
        isDragActive && !isDragReject && 'border-primary bg-primary/5',
        isDragReject && 'border-destructive bg-destructive/5',
        !isDragActive && 'border-muted-foreground/25 hover:border-muted-foreground/50'
      )}
    >
      <input {...getInputProps()} />

      {isDragReject ? (
        <>
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <p className="text-destructive font-medium">不支援的文件格式</p>
          <p className="text-sm text-muted-foreground mt-2">僅支援 PDF、PNG、JPG</p>
        </>
      ) : isDragActive ? (
        <>
          <Upload className="h-12 w-12 text-primary mb-4 animate-bounce" />
          <p className="text-primary font-medium">放開以上傳文件</p>
        </>
      ) : (
        <>
          <div className="flex gap-2 mb-4">
            <FileText className="h-10 w-10 text-muted-foreground" />
            <Image className="h-10 w-10 text-muted-foreground" />
          </div>
          <p className="font-medium">拖放文件至此處</p>
          <p className="text-sm text-muted-foreground mt-2">
            或點擊選擇文件
          </p>
          <p className="text-xs text-muted-foreground mt-4">
            支援 PDF、PNG、JPG（最大 20MB）
          </p>
        </>
      )}
    </div>
  );
}
