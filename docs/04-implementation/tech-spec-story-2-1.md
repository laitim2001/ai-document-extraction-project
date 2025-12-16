# Story 2-1: File Upload Interface & Validation - Technical Specification

**Version:** 1.0
**Created:** 2025-12-16
**Status:** Ready for Development
**Story Key:** 2-1-file-upload-interface-validation

---

## Overview

| Field | Value |
|-------|-------|
| Story ID | 2.1 |
| Epic | Epic 2: Manual Invoice Upload & AI Processing |
| Estimated Effort | Medium |
| Dependencies | Epic 1 (Authentication) |
| Blocking | Story 2.2 ~ 2.7 |
| FR Coverage | FR1 |

---

## Objective

Implement a comprehensive file upload system that allows data processors to upload invoice documents (PDF, JPG, PNG) with proper validation, progress tracking, and batch upload support. Files are stored in Azure Blob Storage with metadata tracked in PostgreSQL.

---

## Acceptance Criteria Mapping

| AC | Description | Technical Implementation |
|----|-------------|-------------------------|
| AC1 | File format & size validation | Client + server-side validation |
| AC2 | Invalid format handling | Error toast with clear message |
| AC3 | Batch upload (max 20) | Multi-file dropzone with queue |

---

## Implementation Guide

### Phase 1: Database Schema (15 min)

#### Step 1.1: Add Document Model to Prisma

Update `prisma/schema.prisma`:

```prisma
// ===========================================
// Document Management Models
// ===========================================

model Document {
  id              String         @id @default(uuid())
  fileName        String         @map("file_name")
  fileType        String         @map("file_type")       // MIME type
  fileExtension   String         @map("file_extension")  // pdf, jpg, png
  fileSize        Int            @map("file_size")       // bytes
  filePath        String         @map("file_path")       // Azure Blob URL
  blobName        String         @map("blob_name")       // Azure Blob name
  status          DocumentStatus @default(UPLOADED)
  errorMessage    String?        @map("error_message")
  processingPath  ProcessingPath? @map("processing_path")
  routingDecision Json?          @map("routing_decision")

  uploadedBy      String         @map("uploaded_by")
  cityCode        String?        @map("city_code")

  createdAt       DateTime       @default(now()) @map("created_at")
  updatedAt       DateTime       @updatedAt @map("updated_at")

  // Relations
  uploader          User                    @relation(fields: [uploadedBy], references: [id])
  ocrResults        OcrResult[]
  extractions       ExtractionResult[]
  identifications   ForwarderIdentification[]
  processingQueue   ProcessingQueue?

  @@index([status])
  @@index([uploadedBy])
  @@index([cityCode])
  @@index([createdAt])
  @@map("documents")
}

enum DocumentStatus {
  UPLOADING
  UPLOADED
  OCR_PROCESSING
  OCR_COMPLETED
  OCR_FAILED
  MAPPING_PROCESSING
  MAPPING_COMPLETED
  PENDING_REVIEW
  IN_REVIEW
  COMPLETED
  FAILED
}

enum ProcessingPath {
  AUTO_APPROVE
  QUICK_REVIEW
  FULL_REVIEW
  MANUAL_REQUIRED
}
```

#### Step 1.2: Run Migration

```bash
npx prisma migrate dev --name add_document_model
npx prisma generate
```

---

### Phase 2: Azure Blob Storage Setup (20 min)

#### Step 2.1: Install Dependencies

```bash
npm install @azure/storage-blob
```

#### Step 2.2: Environment Variables

Add to `.env`:

```bash
# Azure Blob Storage
AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=xxx;AccountKey=xxx;EndpointSuffix=core.windows.net"
AZURE_STORAGE_CONTAINER="documents"
AZURE_STORAGE_ACCOUNT_URL="https://xxx.blob.core.windows.net"
```

#### Step 2.3: Create Azure Storage Service

Create `src/lib/azure/storage.ts`:

```typescript
import {
  BlobServiceClient,
  ContainerClient,
  BlockBlobClient,
  BlobSASPermissions,
  generateBlobSASQueryParameters,
  StorageSharedKeyCredential,
} from '@azure/storage-blob'

// ===========================================
// Configuration
// ===========================================

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!
const containerName = process.env.AZURE_STORAGE_CONTAINER || 'documents'

// Validate connection string
if (!connectionString && process.env.NODE_ENV === 'production') {
  throw new Error('AZURE_STORAGE_CONNECTION_STRING is required')
}

// ===========================================
// Clients
// ===========================================

const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString)
const containerClient = blobServiceClient.getContainerClient(containerName)

// ===========================================
// Types
// ===========================================

export interface UploadResult {
  blobName: string
  blobUrl: string
  contentType: string
  size: number
}

export interface UploadOptions {
  contentType: string
  metadata?: Record<string, string>
  folder?: string
}

// ===========================================
// Functions
// ===========================================

/**
 * Ensure container exists (call once on startup)
 */
export async function ensureContainer(): Promise<void> {
  await containerClient.createIfNotExists({
    access: 'blob', // or 'container' for public access
  })
}

/**
 * Upload a file to Azure Blob Storage
 */
export async function uploadFile(
  buffer: Buffer,
  fileName: string,
  options: UploadOptions
): Promise<UploadResult> {
  const { contentType, metadata, folder } = options

  // Generate unique blob name with timestamp
  const timestamp = Date.now()
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
  const blobName = folder
    ? `${folder}/${timestamp}-${sanitizedName}`
    : `${timestamp}-${sanitizedName}`

  const blockBlobClient = containerClient.getBlockBlobClient(blobName)

  // Upload with options
  await blockBlobClient.upload(buffer, buffer.length, {
    blobHTTPHeaders: {
      blobContentType: contentType,
      blobCacheControl: 'max-age=31536000', // 1 year cache
    },
    metadata,
  })

  return {
    blobName,
    blobUrl: blockBlobClient.url,
    contentType,
    size: buffer.length,
  }
}

/**
 * Generate SAS URL for temporary access
 */
export async function generateSasUrl(
  blobName: string,
  expiresInMinutes: number = 60
): Promise<string> {
  const blockBlobClient = containerClient.getBlockBlobClient(blobName)

  // For simple cases, use the blob URL directly if container is public
  // For private containers, generate SAS token
  const startsOn = new Date()
  const expiresOn = new Date(startsOn.getTime() + expiresInMinutes * 60 * 1000)

  const sasToken = await blockBlobClient.generateSasUrl({
    permissions: BlobSASPermissions.parse('r'), // Read only
    startsOn,
    expiresOn,
  })

  return sasToken
}

/**
 * Delete a blob
 */
export async function deleteFile(blobName: string): Promise<void> {
  const blockBlobClient = containerClient.getBlockBlobClient(blobName)
  await blockBlobClient.deleteIfExists()
}

/**
 * Check if blob exists
 */
export async function fileExists(blobName: string): Promise<boolean> {
  const blockBlobClient = containerClient.getBlockBlobClient(blobName)
  return blockBlobClient.exists()
}

/**
 * Get blob properties
 */
export async function getFileProperties(blobName: string) {
  const blockBlobClient = containerClient.getBlockBlobClient(blobName)
  return blockBlobClient.getProperties()
}
```

---

### Phase 3: Upload API Endpoint (25 min)

#### Step 3.1: Create Validation Constants

Create `src/lib/upload/constants.ts`:

```typescript
// ===========================================
// Upload Configuration
// ===========================================

export const UPLOAD_CONFIG = {
  // Allowed MIME types
  ALLOWED_TYPES: [
    'application/pdf',
    'image/jpeg',
    'image/png',
  ] as const,

  // Allowed extensions
  ALLOWED_EXTENSIONS: ['.pdf', '.jpg', '.jpeg', '.png'] as const,

  // Size limits
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_FILE_SIZE_DISPLAY: '10MB',

  // Batch limits
  MAX_FILES_PER_BATCH: 20,

  // Labels for UI
  ACCEPT_LABEL: 'PDF, JPG, PNG',
} as const

export type AllowedMimeType = typeof UPLOAD_CONFIG.ALLOWED_TYPES[number]

// ===========================================
// Validation Functions
// ===========================================

export function isAllowedType(mimeType: string): mimeType is AllowedMimeType {
  return UPLOAD_CONFIG.ALLOWED_TYPES.includes(mimeType as AllowedMimeType)
}

export function isAllowedSize(sizeInBytes: number): boolean {
  return sizeInBytes <= UPLOAD_CONFIG.MAX_FILE_SIZE
}

export function getExtensionFromMime(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/png': 'png',
  }
  return mimeToExt[mimeType] || 'unknown'
}

// ===========================================
// Error Messages
// ===========================================

export const UPLOAD_ERRORS = {
  INVALID_TYPE: `不支援的文件格式，請上傳 ${UPLOAD_CONFIG.ACCEPT_LABEL}`,
  FILE_TOO_LARGE: `文件大小超過限制 (${UPLOAD_CONFIG.MAX_FILE_SIZE_DISPLAY})`,
  TOO_MANY_FILES: `最多只能上傳 ${UPLOAD_CONFIG.MAX_FILES_PER_BATCH} 個文件`,
  UPLOAD_FAILED: '文件上傳失敗，請重試',
  NO_FILES: '請選擇要上傳的文件',
} as const
```

#### Step 3.2: Create Upload API Route

Create `src/app/api/documents/upload/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { uploadFile } from '@/lib/azure/storage'
import {
  UPLOAD_CONFIG,
  UPLOAD_ERRORS,
  isAllowedType,
  isAllowedSize,
  getExtensionFromMime,
} from '@/lib/upload/constants'
import { AppError, handleApiError } from '@/lib/errors'
import { PERMISSIONS, hasPermission } from '@/lib/auth/permissions'

// ===========================================
// Types
// ===========================================

interface UploadedFile {
  id: string
  fileName: string
  status: string
}

interface FailedFile {
  fileName: string
  error: string
}

interface UploadResponse {
  success: true
  data: {
    uploaded: UploadedFile[]
    failed: FailedFile[]
    total: number
    successCount: number
    failedCount: number
  }
}

// ===========================================
// POST /api/documents/upload
// ===========================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authentication
    const session = await auth()
    if (!session?.user) {
      throw new AppError('unauthorized', 'Unauthorized', 401, 'Please log in')
    }

    // Permission check
    if (!hasPermission(session.user, PERMISSIONS.INVOICE_CREATE)) {
      throw new AppError('forbidden', 'Forbidden', 403, 'Insufficient permissions')
    }

    // Parse multipart form data
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    const cityCode = formData.get('cityCode') as string | null

    // Validate file count
    if (files.length === 0) {
      throw new AppError('bad_request', 'No Files', 400, UPLOAD_ERRORS.NO_FILES)
    }

    if (files.length > UPLOAD_CONFIG.MAX_FILES_PER_BATCH) {
      throw new AppError('bad_request', 'Too Many Files', 400, UPLOAD_ERRORS.TOO_MANY_FILES)
    }

    // Process each file
    const uploaded: UploadedFile[] = []
    const failed: FailedFile[] = []

    for (const file of files) {
      try {
        // Validate type
        if (!isAllowedType(file.type)) {
          failed.push({ fileName: file.name, error: UPLOAD_ERRORS.INVALID_TYPE })
          continue
        }

        // Validate size
        if (!isAllowedSize(file.size)) {
          failed.push({ fileName: file.name, error: UPLOAD_ERRORS.FILE_TOO_LARGE })
          continue
        }

        // Convert to buffer
        const buffer = Buffer.from(await file.arrayBuffer())

        // Upload to Azure
        const uploadResult = await uploadFile(buffer, file.name, {
          contentType: file.type,
          folder: cityCode || 'general',
          metadata: {
            originalName: file.name,
            uploadedBy: session.user.id,
          },
        })

        // Create database record
        const document = await prisma.document.create({
          data: {
            fileName: file.name,
            fileType: file.type,
            fileExtension: getExtensionFromMime(file.type),
            fileSize: file.size,
            filePath: uploadResult.blobUrl,
            blobName: uploadResult.blobName,
            status: 'UPLOADED',
            uploadedBy: session.user.id,
            cityCode,
          },
        })

        uploaded.push({
          id: document.id,
          fileName: document.fileName,
          status: document.status,
        })

      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error)
        failed.push({
          fileName: file.name,
          error: UPLOAD_ERRORS.UPLOAD_FAILED,
        })
      }
    }

    const response: UploadResponse = {
      success: true,
      data: {
        uploaded,
        failed,
        total: files.length,
        successCount: uploaded.length,
        failedCount: failed.length,
      },
    }

    return NextResponse.json(response, {
      status: uploaded.length > 0 ? 201 : 400,
    })

  } catch (error) {
    return handleApiError(error)
  }
}

// ===========================================
// Config for Next.js
// ===========================================

export const config = {
  api: {
    bodyParser: false, // Required for file uploads
  },
}
```

---

### Phase 4: Upload Page & Components (35 min)

#### Step 4.1: Install Dependencies

```bash
npm install react-dropzone
```

#### Step 4.2: Create FileUploader Component

Create `src/components/features/invoice/FileUploader.tsx`:

```typescript
'use client'

import { useCallback, useState } from 'react'
import { useDropzone, FileRejection } from 'react-dropzone'
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
  Image,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { UPLOAD_CONFIG, UPLOAD_ERRORS } from '@/lib/upload/constants'

// ===========================================
// Types
// ===========================================

interface FileWithPreview extends File {
  preview?: string
  id: string
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
  progress?: number
}

interface UploadResult {
  uploaded: Array<{ id: string; fileName: string; status: string }>
  failed: Array<{ fileName: string; error: string }>
}

interface FileUploaderProps {
  cityCode?: string
  onUploadComplete?: (result: UploadResult) => void
}

// ===========================================
// Component
// ===========================================

export function FileUploader({ cityCode, onUploadComplete }: FileUploaderProps) {
  const [files, setFiles] = useState<FileWithPreview[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const queryClient = useQueryClient()

  // Handle file drop
  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
    // Check total count
    const totalCount = files.length + acceptedFiles.length
    if (totalCount > UPLOAD_CONFIG.MAX_FILES_PER_BATCH) {
      toast.error(UPLOAD_ERRORS.TOO_MANY_FILES)
      return
    }

    // Add accepted files
    const newFiles: FileWithPreview[] = acceptedFiles.map((file) => ({
      ...file,
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      status: 'pending' as const,
    }))

    setFiles((prev) => [...prev, ...newFiles])

    // Show rejection errors
    rejectedFiles.forEach((rejection) => {
      const error = rejection.errors[0]
      if (error.code === 'file-invalid-type') {
        toast.error(`${rejection.file.name}: ${UPLOAD_ERRORS.INVALID_TYPE}`)
      } else if (error.code === 'file-too-large') {
        toast.error(`${rejection.file.name}: ${UPLOAD_ERRORS.FILE_TOO_LARGE}`)
      }
    })
  }, [files.length])

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
    },
    maxSize: UPLOAD_CONFIG.MAX_FILE_SIZE,
    maxFiles: UPLOAD_CONFIG.MAX_FILES_PER_BATCH,
    disabled: isUploading,
  })

  // Remove file from list
  const removeFile = (fileId: string) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === fileId)
      if (file?.preview) {
        URL.revokeObjectURL(file.preview)
      }
      return prev.filter((f) => f.id !== fileId)
    })
  }

  // Clear all files
  const clearFiles = () => {
    files.forEach((file) => {
      if (file.preview) {
        URL.revokeObjectURL(file.preview)
      }
    })
    setFiles([])
  }

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (filesToUpload: File[]): Promise<UploadResult> => {
      const formData = new FormData()
      filesToUpload.forEach((file) => {
        formData.append('files', file)
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
        throw new Error(error.detail || 'Upload failed')
      }

      const result = await response.json()
      return result.data
    },
    onSuccess: (result) => {
      // Update file statuses
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

      // Show toast
      if (result.uploaded.length > 0) {
        toast.success(`成功上傳 ${result.uploaded.length} 個文件`)
      }
      if (result.failed.length > 0) {
        toast.error(`${result.failed.length} 個文件上傳失敗`)
      }

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['documents'] })

      // Callback
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

  // Handle upload
  const handleUpload = async () => {
    const pendingFiles = files.filter((f) => f.status === 'pending')
    if (pendingFiles.length === 0) {
      toast.error('沒有待上傳的文件')
      return
    }

    setIsUploading(true)
    setUploadProgress(0)

    // Update status to uploading
    setFiles((prev) =>
      prev.map((file) =>
        file.status === 'pending' ? { ...file, status: 'uploading' as const } : file
      )
    )

    // Simulate progress (actual progress would need XHR)
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

  // Get file icon
  const getFileIcon = (type: string) => {
    if (type === 'application/pdf') {
      return <FileText className="h-8 w-8 text-red-500" />
    }
    if (type.startsWith('image/')) {
      return <Image className="h-8 w-8 text-blue-500" />
    }
    return <FileIcon className="h-8 w-8 text-gray-500" />
  }

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const pendingCount = files.filter((f) => f.status === 'pending').length
  const hasFiles = files.length > 0

  return (
    <div className="space-y-4">
      {/* Dropzone */}
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
              支援 {UPLOAD_CONFIG.ACCEPT_LABEL}，單個文件最大 {UPLOAD_CONFIG.MAX_FILE_SIZE_DISPLAY}
            </p>
            <p className="text-sm text-muted-foreground">
              最多 {UPLOAD_CONFIG.MAX_FILES_PER_BATCH} 個文件
            </p>
          </>
        )}
      </div>

      {/* File List */}
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
              <Button variant="ghost" size="sm" onClick={clearFiles} disabled={isUploading}>
                清除全部
              </Button>
            </div>

            {/* Progress Bar */}
            {isUploading && (
              <div className="mb-4">
                <Progress value={uploadProgress} className="h-2" />
                <p className="text-sm text-muted-foreground mt-1 text-center">
                  上傳中... {uploadProgress}%
                </p>
              </div>
            )}

            {/* File Items */}
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
                  {/* File Icon */}
                  {getFileIcon(file.type)}

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatSize(file.size)}
                    </p>
                    {file.error && (
                      <p className="text-sm text-destructive">{file.error}</p>
                    )}
                  </div>

                  {/* Status */}
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

                    {/* Remove Button */}
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

      {/* Upload Button */}
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
```

#### Step 4.3: Create Upload Page

Create `src/app/(dashboard)/invoices/upload/page.tsx`:

```typescript
import { Suspense } from 'react'
import { FileUploader } from '@/components/features/invoice/FileUploader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export const metadata = {
  title: 'Upload Invoices | Document Extraction',
  description: 'Upload invoice documents for AI processing',
}

export default function UploadPage() {
  return (
    <div className="container mx-auto py-6 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>上傳發票文件</CardTitle>
          <CardDescription>
            上傳發票文件以進行 AI 處理和數據提取。支援 PDF、JPG、PNG 格式。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<UploadSkeleton />}>
            <FileUploader />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}

function UploadSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-48 w-full rounded-lg" />
      <Skeleton className="h-10 w-full" />
    </div>
  )
}
```

---

### Phase 5: Document Service Layer (15 min)

#### Step 5.1: Create Document Service

Create `src/services/document.service.ts`:

```typescript
import { prisma } from '@/lib/prisma'
import { deleteFile } from '@/lib/azure/storage'
import type { DocumentStatus, Prisma } from '@prisma/client'

// ===========================================
// Types
// ===========================================

export interface GetDocumentsParams {
  page: number
  pageSize: number
  status?: DocumentStatus
  search?: string
  cityCode?: string
  uploadedBy?: string
  sortBy?: 'createdAt' | 'fileName' | 'status'
  sortOrder?: 'asc' | 'desc'
}

export interface DocumentListResult {
  data: DocumentSummary[]
  meta: {
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
}

export interface DocumentSummary {
  id: string
  fileName: string
  fileType: string
  fileSize: number
  status: DocumentStatus
  processingPath: string | null
  overallConfidence: number | null
  createdAt: Date
  updatedAt: Date
}

// ===========================================
// Functions
// ===========================================

/**
 * Get paginated document list
 */
export async function getDocuments(
  params: GetDocumentsParams
): Promise<DocumentListResult> {
  const {
    page = 1,
    pageSize = 20,
    status,
    search,
    cityCode,
    uploadedBy,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = params

  const where: Prisma.DocumentWhereInput = {
    ...(status && { status }),
    ...(cityCode && { cityCode }),
    ...(uploadedBy && { uploadedBy }),
    ...(search && {
      OR: [
        { fileName: { contains: search, mode: 'insensitive' } },
        { id: { contains: search } },
      ],
    }),
  }

  const [data, total] = await prisma.$transaction([
    prisma.document.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { [sortBy]: sortOrder },
      select: {
        id: true,
        fileName: true,
        fileType: true,
        fileSize: true,
        status: true,
        processingPath: true,
        createdAt: true,
        updatedAt: true,
        extractions: {
          select: { overallConfidence: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    }),
    prisma.document.count({ where }),
  ])

  return {
    data: data.map((doc) => ({
      ...doc,
      overallConfidence: doc.extractions[0]?.overallConfidence ?? null,
    })) as DocumentSummary[],
    meta: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  }
}

/**
 * Get single document by ID
 */
export async function getDocumentById(id: string) {
  return prisma.document.findUnique({
    where: { id },
    include: {
      uploader: {
        select: { id: true, name: true, email: true },
      },
      ocrResults: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      extractions: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      identifications: {
        include: {
          forwarder: {
            select: { id: true, name: true, code: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  })
}

/**
 * Delete a document and its blob
 */
export async function deleteDocument(id: string): Promise<void> {
  const document = await prisma.document.findUnique({
    where: { id },
    select: { blobName: true },
  })

  if (document?.blobName) {
    await deleteFile(document.blobName)
  }

  await prisma.document.delete({
    where: { id },
  })
}

/**
 * Update document status
 */
export async function updateDocumentStatus(
  id: string,
  status: DocumentStatus,
  errorMessage?: string
): Promise<void> {
  await prisma.document.update({
    where: { id },
    data: {
      status,
      errorMessage: errorMessage ?? null,
      updatedAt: new Date(),
    },
  })
}
```

---

## Project Structure

```
src/
├── app/
│   ├── (dashboard)/
│   │   └── invoices/
│   │       └── upload/
│   │           └── page.tsx              # Upload page
│   └── api/
│       └── documents/
│           └── upload/
│               └── route.ts              # Upload API
├── components/
│   └── features/
│       └── invoice/
│           └── FileUploader.tsx          # Dropzone component
├── lib/
│   ├── azure/
│   │   └── storage.ts                    # Azure Blob SDK wrapper
│   └── upload/
│       └── constants.ts                  # Upload config & validation
└── services/
    └── document.service.ts               # Document CRUD
```

---

## API Endpoints

### POST /api/documents/upload

Upload one or more documents.

**Request:**
- Content-Type: `multipart/form-data`
- Body:
  - `files`: File[] (required, max 20)
  - `cityCode`: string (optional)

**Response (201 Created):**
```typescript
{
  success: true,
  data: {
    uploaded: Array<{
      id: string
      fileName: string
      status: string
    }>,
    failed: Array<{
      fileName: string
      error: string
    }>,
    total: number,
    successCount: number,
    failedCount: number
  }
}
```

**Error Responses:**
- `400` - No files / too many files / validation error
- `401` - Unauthorized
- `403` - Forbidden

---

## Verification Checklist

### Upload Functionality

| Test Case | Expected Result | Status |
|-----------|-----------------|--------|
| Single PDF upload | File uploaded, record created | [ ] |
| Single JPG upload | File uploaded, record created | [ ] |
| Single PNG upload | File uploaded, record created | [ ] |
| Batch upload (5 files) | All files processed | [ ] |
| Max batch (20 files) | All files processed | [ ] |
| Exceed batch limit | Error message shown | [ ] |

### Validation Testing

| Test Case | Expected Result | Status |
|-----------|-----------------|--------|
| Invalid file type (.doc) | Rejected with error | [ ] |
| File > 10MB | Rejected with size error | [ ] |
| Valid file < 10MB | Accepted | [ ] |
| Mixed valid/invalid batch | Partial success | [ ] |

### UI Testing

| Test Case | Expected Result | Status |
|-----------|-----------------|--------|
| Drag & drop | Files added to list | [ ] |
| Click to select | File dialog opens | [ ] |
| Progress indicator | Shows during upload | [ ] |
| Remove file button | File removed from list | [ ] |
| Clear all button | All files removed | [ ] |

---

## Dependencies

| Dependency | Purpose | Status |
|------------|---------|--------|
| Epic 1 | Authentication & permissions | Required |
| @azure/storage-blob | Azure Blob SDK | Install |
| react-dropzone | Drag & drop support | Install |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Large file upload timeout | Chunked upload (future) |
| Azure outage | Retry logic with exponential backoff |
| Duplicate files | Unique blob names with timestamp |
| Orphan blobs | Cleanup job for failed uploads |

---

*Tech Spec Version: 1.0*
*Last Updated: 2025-12-16*
