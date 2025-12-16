# Story 2-7: Processing Status Tracking & Display - Technical Specification

**Version:** 1.0
**Created:** 2025-12-16
**Status:** Ready for Development
**Story Key:** 2-7-processing-status-tracking-display

---

## Overview

| Field | Value |
|-------|-------|
| Story ID | 2.7 |
| Epic | Epic 2: Manual Invoice Upload & AI Processing |
| Estimated Effort | Medium |
| Dependencies | Story 2.1 ~ 2.6 (Full processing pipeline) |
| Blocking | Epic 3 |
| FR Coverage | FR1, FR4, FR5, FR6, FR7, FR8 (Integration) |

---

## Objective

Implement a document list page with real-time status tracking, displaying processing progress for uploaded invoices. Users can view document status, see processing errors, and retry failed documents.

---

## Acceptance Criteria Mapping

| AC | Description | Technical Implementation |
|----|-------------|-------------------------|
| AC1 | Processing status display | Status badges with icons/colors |
| AC2 | Real-time status updates | Polling (5s for processing, 30s idle) |
| AC3 | Error handling & retry | Error display with retry button |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Document Status Tracking                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    Document List Page                              │   │
│  │  ┌──────────────────────────────────────────────────────────────┐ │   │
│  │  │ File Name    │ Status        │ Confidence │ Path    │ Actions │ │   │
│  │  ├──────────────┼───────────────┼────────────┼─────────┼─────────┤ │   │
│  │  │ invoice.pdf  │ 🔄 OCR中      │    --      │   --    │  ...    │ │   │
│  │  │ receipt.jpg  │ ✅ 已完成     │   95%      │  Auto   │  View   │ │   │
│  │  │ bill.pdf     │ ❌ OCR失敗    │    --      │   --    │  Retry  │ │   │
│  │  └──────────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                              │                                           │
│                              ▼                                           │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                   React Query + Polling                           │   │
│  │         refetchInterval: processing ? 5s : 30s                    │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Guide

### Phase 1: Document Status Configuration (10 min)

#### Step 1.1: Create Status Configuration

Create `src/lib/document-status.ts`:

```typescript
/**
 * Document status configuration
 * Defines display properties for each status
 */

import {
  Upload,
  Check,
  Scan,
  GitMerge,
  Clock,
  Eye,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type DocumentStatusKey =
  | 'UPLOADING'
  | 'UPLOADED'
  | 'OCR_PROCESSING'
  | 'OCR_COMPLETED'
  | 'OCR_FAILED'
  | 'MAPPING_PROCESSING'
  | 'MAPPING_COMPLETED'
  | 'PENDING_REVIEW'
  | 'IN_REVIEW'
  | 'COMPLETED'
  | 'FAILED'

export interface StatusConfig {
  label: string
  labelZh: string
  icon: LucideIcon
  color: string
  bgColor: string
  textColor: string
  isProcessing: boolean
  isError: boolean
  canRetry: boolean
  order: number  // For sorting
}

export const DOCUMENT_STATUS_CONFIG: Record<DocumentStatusKey, StatusConfig> = {
  UPLOADING: {
    label: 'Uploading',
    labelZh: '上傳中',
    icon: Upload,
    color: 'blue',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
    isProcessing: true,
    isError: false,
    canRetry: false,
    order: 1
  },
  UPLOADED: {
    label: 'Uploaded',
    labelZh: '已上傳',
    icon: Check,
    color: 'green',
    bgColor: 'bg-green-100',
    textColor: 'text-green-700',
    isProcessing: false,
    isError: false,
    canRetry: false,
    order: 2
  },
  OCR_PROCESSING: {
    label: 'OCR Processing',
    labelZh: 'OCR 處理中',
    icon: Scan,
    color: 'blue',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
    isProcessing: true,
    isError: false,
    canRetry: false,
    order: 3
  },
  OCR_COMPLETED: {
    label: 'OCR Completed',
    labelZh: 'OCR 完成',
    icon: Check,
    color: 'green',
    bgColor: 'bg-green-100',
    textColor: 'text-green-700',
    isProcessing: false,
    isError: false,
    canRetry: false,
    order: 4
  },
  OCR_FAILED: {
    label: 'OCR Failed',
    labelZh: 'OCR 失敗',
    icon: AlertCircle,
    color: 'red',
    bgColor: 'bg-red-100',
    textColor: 'text-red-700',
    isProcessing: false,
    isError: true,
    canRetry: true,
    order: 5
  },
  MAPPING_PROCESSING: {
    label: 'Mapping',
    labelZh: '映射中',
    icon: GitMerge,
    color: 'blue',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
    isProcessing: true,
    isError: false,
    canRetry: false,
    order: 6
  },
  MAPPING_COMPLETED: {
    label: 'Mapping Completed',
    labelZh: '映射完成',
    icon: Check,
    color: 'green',
    bgColor: 'bg-green-100',
    textColor: 'text-green-700',
    isProcessing: false,
    isError: false,
    canRetry: false,
    order: 7
  },
  PENDING_REVIEW: {
    label: 'Pending Review',
    labelZh: '待審核',
    icon: Clock,
    color: 'yellow',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-700',
    isProcessing: false,
    isError: false,
    canRetry: false,
    order: 8
  },
  IN_REVIEW: {
    label: 'In Review',
    labelZh: '審核中',
    icon: Eye,
    color: 'blue',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
    isProcessing: true,
    isError: false,
    canRetry: false,
    order: 9
  },
  COMPLETED: {
    label: 'Completed',
    labelZh: '已完成',
    icon: CheckCircle,
    color: 'green',
    bgColor: 'bg-green-100',
    textColor: 'text-green-700',
    isProcessing: false,
    isError: false,
    canRetry: false,
    order: 10
  },
  FAILED: {
    label: 'Failed',
    labelZh: '處理失敗',
    icon: XCircle,
    color: 'red',
    bgColor: 'bg-red-100',
    textColor: 'text-red-700',
    isProcessing: false,
    isError: true,
    canRetry: true,
    order: 11
  }
}

/**
 * Get status config by key
 */
export function getStatusConfig(status: string): StatusConfig {
  return DOCUMENT_STATUS_CONFIG[status as DocumentStatusKey] || DOCUMENT_STATUS_CONFIG.FAILED
}

/**
 * Check if any document is processing
 */
export function hasProcessingDocuments(statuses: string[]): boolean {
  return statuses.some(status => {
    const config = getStatusConfig(status)
    return config.isProcessing
  })
}

/**
 * Get processing stage number (for progress display)
 */
export function getProcessingStage(status: string): number {
  const stages: Record<string, number> = {
    UPLOADING: 1,
    UPLOADED: 1,
    OCR_PROCESSING: 2,
    OCR_COMPLETED: 2,
    OCR_FAILED: 2,
    MAPPING_PROCESSING: 3,
    MAPPING_COMPLETED: 3,
    PENDING_REVIEW: 4,
    IN_REVIEW: 4,
    COMPLETED: 5,
    FAILED: 0
  }
  return stages[status] || 0
}
```

---

### Phase 2: Document Service Layer (15 min)

#### Step 2.1: Create Document Service

Create `src/services/document.service.ts`:

```typescript
/**
 * Document Service
 * Handles document CRUD and status operations
 */

import { prisma } from '@/lib/prisma'
import { DocumentStatus } from '@prisma/client'
import { triggerExtraction } from './extraction.service'

export interface DocumentListParams {
  page?: number
  pageSize?: number
  status?: DocumentStatus | DocumentStatus[]
  search?: string
  sortBy?: 'createdAt' | 'fileName' | 'status'
  sortOrder?: 'asc' | 'desc'
  uploadedBy?: string
}

export interface DocumentListResult {
  data: DocumentListItem[]
  meta: {
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
}

export interface DocumentListItem {
  id: string
  fileName: string
  fileType: string
  fileSize: number
  status: DocumentStatus
  processingPath: string | null
  overallConfidence: number | null
  errorMessage: string | null
  createdAt: Date
  updatedAt: Date
  uploader: {
    name: string | null
  } | null
}

/**
 * Get paginated document list
 */
export async function getDocuments(
  params: DocumentListParams = {}
): Promise<DocumentListResult> {
  const {
    page = 1,
    pageSize = 20,
    status,
    search,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    uploadedBy
  } = params

  // Build where clause
  const where: any = {}

  if (status) {
    where.status = Array.isArray(status) ? { in: status } : status
  }

  if (search) {
    where.fileName = { contains: search, mode: 'insensitive' }
  }

  if (uploadedBy) {
    where.uploadedBy = uploadedBy
  }

  // Get total count
  const total = await prisma.document.count({ where })

  // Get documents
  const documents = await prisma.document.findMany({
    where,
    include: {
      uploader: {
        select: { name: true }
      },
      extractions: {
        select: { averageConfidence: true },
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    },
    orderBy: { [sortBy]: sortOrder },
    skip: (page - 1) * pageSize,
    take: pageSize
  })

  // Transform to list items
  const data: DocumentListItem[] = documents.map(doc => ({
    id: doc.id,
    fileName: doc.fileName,
    fileType: doc.fileType,
    fileSize: doc.fileSize,
    status: doc.status,
    processingPath: doc.processingPath,
    overallConfidence: doc.extractions[0]?.averageConfidence || null,
    errorMessage: doc.errorMessage,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    uploader: doc.uploader
  }))

  return {
    data,
    meta: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    }
  }
}

/**
 * Get single document with full details
 */
export async function getDocument(id: string) {
  return prisma.document.findUnique({
    where: { id },
    include: {
      uploader: {
        select: { id: true, name: true, email: true }
      },
      forwarder: {
        select: { id: true, name: true, code: true }
      },
      ocrResults: {
        orderBy: { createdAt: 'desc' },
        take: 1
      },
      extractions: {
        orderBy: { createdAt: 'desc' },
        take: 1
      },
      identifications: {
        orderBy: { createdAt: 'desc' },
        take: 1
      },
      processingQueue: true
    }
  })
}

/**
 * Retry failed document processing
 */
export async function retryProcessing(documentId: string): Promise<void> {
  const document = await prisma.document.findUnique({
    where: { id: documentId }
  })

  if (!document) {
    throw new Error('Document not found')
  }

  const retryableStatuses: DocumentStatus[] = [
    'OCR_FAILED',
    'FAILED'
  ]

  if (!retryableStatuses.includes(document.status)) {
    throw new Error(`Cannot retry document with status: ${document.status}`)
  }

  // Reset document status
  await prisma.$transaction([
    prisma.document.update({
      where: { id: documentId },
      data: {
        status: DocumentStatus.UPLOADED,
        processingPath: null,
        routingDecision: null,
        errorMessage: null
      }
    }),
    // Remove any existing queue entry
    prisma.processingQueue.deleteMany({
      where: { documentId }
    })
  ])

  // Trigger processing again (non-blocking)
  triggerExtraction(documentId).catch(error => {
    console.error(`Retry processing failed for ${documentId}:`, error)
  })
}

/**
 * Get processing statistics
 */
export async function getProcessingStats(): Promise<{
  byStatus: Record<string, number>
  processing: number
  completed: number
  failed: number
  total: number
}> {
  const statuses = await prisma.document.groupBy({
    by: ['status'],
    _count: true
  })

  const byStatus: Record<string, number> = {}
  let processing = 0
  let completed = 0
  let failed = 0
  let total = 0

  const processingStatuses = ['UPLOADING', 'OCR_PROCESSING', 'MAPPING_PROCESSING', 'IN_REVIEW']
  const failedStatuses = ['OCR_FAILED', 'FAILED']

  for (const item of statuses) {
    byStatus[item.status] = item._count
    total += item._count

    if (processingStatuses.includes(item.status)) {
      processing += item._count
    } else if (item.status === 'COMPLETED') {
      completed += item._count
    } else if (failedStatuses.includes(item.status)) {
      failed += item._count
    }
  }

  return { byStatus, processing, completed, failed, total }
}
```

---

### Phase 3: API Endpoints (15 min)

#### Step 3.1: Document List API

Create `src/app/api/documents/route.ts`:

```typescript
/**
 * GET /api/documents
 * List documents with pagination and filtering
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getDocuments, getProcessingStats } from '@/services/document.service'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)

    const params = {
      page: parseInt(searchParams.get('page') || '1', 10),
      pageSize: parseInt(searchParams.get('pageSize') || '20', 10),
      status: searchParams.get('status') || undefined,
      search: searchParams.get('search') || undefined,
      sortBy: searchParams.get('sortBy') as any || 'createdAt',
      sortOrder: searchParams.get('sortOrder') as any || 'desc'
    }

    const [result, stats] = await Promise.all([
      getDocuments(params),
      getProcessingStats()
    ])

    return NextResponse.json({
      success: true,
      ...result,
      stats
    })

  } catch (error) {
    console.error('Get documents error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

#### Step 3.2: Document Detail API

Create `src/app/api/documents/[id]/route.ts`:

```typescript
/**
 * GET /api/documents/[id]
 * Get single document details
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getDocument } from '@/services/document.service'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const document = await getDocument(id)

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: document
    })

  } catch (error) {
    console.error('Get document error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

#### Step 3.3: Retry API

Create `src/app/api/documents/[id]/retry/route.ts`:

```typescript
/**
 * POST /api/documents/[id]/retry
 * Retry failed document processing
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { retryProcessing } from '@/services/document.service'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    await retryProcessing(id)

    return NextResponse.json({
      success: true,
      message: 'Processing retry initiated'
    })

  } catch (error) {
    console.error('Retry error:', error)

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }
      if (error.message.includes('Cannot retry')) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

---

### Phase 4: React Query Hooks (15 min)

#### Step 4.1: Create Documents Hook

Create `src/hooks/useDocuments.ts`:

```typescript
'use client'

/**
 * React Query hook for document list
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { hasProcessingDocuments } from '@/lib/document-status'
import type { DocumentListItem } from '@/services/document.service'

interface UseDocumentsParams {
  page?: number
  pageSize?: number
  status?: string
  search?: string
}

interface DocumentsResponse {
  success: boolean
  data: DocumentListItem[]
  meta: {
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
  stats: {
    byStatus: Record<string, number>
    processing: number
    completed: number
    failed: number
    total: number
  }
}

export function useDocuments(params: UseDocumentsParams = {}) {
  const queryClient = useQueryClient()

  const query = useQuery<DocumentsResponse>({
    queryKey: ['documents', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.set(key, String(value))
        }
      })
      const response = await fetch(`/api/documents?${searchParams}`)
      if (!response.ok) throw new Error('Failed to fetch documents')
      return response.json()
    },
    // Dynamic refetch interval based on processing status
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data?.data) return 30000  // 30s default

      const statuses = data.data.map(doc => doc.status)
      return hasProcessingDocuments(statuses) ? 5000 : 30000
    },
    staleTime: 2000
  })

  const retryMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const response = await fetch(`/api/documents/${documentId}/retry`, {
        method: 'POST'
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Retry failed')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
    }
  })

  return {
    ...query,
    retry: retryMutation.mutate,
    isRetrying: retryMutation.isPending
  }
}
```

#### Step 4.2: Create Single Document Hook

Create `src/hooks/useDocument.ts`:

```typescript
'use client'

/**
 * React Query hook for single document
 */

import { useQuery } from '@tanstack/react-query'
import { getStatusConfig } from '@/lib/document-status'

interface UseDocumentParams {
  id: string
  enabled?: boolean
}

export function useDocument({ id, enabled = true }: UseDocumentParams) {
  return useQuery({
    queryKey: ['document', id],
    queryFn: async () => {
      const response = await fetch(`/api/documents/${id}`)
      if (!response.ok) throw new Error('Failed to fetch document')
      return response.json()
    },
    enabled,
    // Refetch more frequently if processing
    refetchInterval: (query) => {
      const status = query.state.data?.data?.status
      if (!status) return false
      const config = getStatusConfig(status)
      return config.isProcessing ? 3000 : false
    }
  })
}
```

---

### Phase 5: UI Components (25 min)

#### Step 5.1: ProcessingStatus Component

Create `src/components/features/invoice/ProcessingStatus.tsx`:

```typescript
'use client'

/**
 * Processing status badge component
 */

import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import { getStatusConfig, type DocumentStatusKey } from '@/lib/document-status'

interface ProcessingStatusProps {
  status: DocumentStatusKey | string
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function ProcessingStatus({
  status,
  showLabel = true,
  size = 'md',
  className
}: ProcessingStatusProps) {
  const config = getStatusConfig(status)
  const Icon = config.icon

  const sizeClasses = {
    sm: 'text-xs gap-1',
    md: 'text-sm gap-1.5',
    lg: 'text-base gap-2'
  }

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  }

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 font-medium',
        config.bgColor,
        config.textColor,
        sizeClasses[size],
        className
      )}
    >
      {config.isProcessing ? (
        <Loader2 className={cn(iconSizes[size], 'animate-spin')} />
      ) : (
        <Icon className={iconSizes[size]} />
      )}
      {showLabel && <span>{config.labelZh}</span>}
    </div>
  )
}
```

#### Step 5.2: RetryButton Component

Create `src/components/features/invoice/RetryButton.tsx`:

```typescript
'use client'

/**
 * Retry processing button
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw, Loader2 } from 'lucide-react'
import { useDocuments } from '@/hooks/useDocuments'
import { toast } from 'sonner'

interface RetryButtonProps {
  documentId: string
  onRetry?: () => void
  size?: 'sm' | 'default'
}

export function RetryButton({
  documentId,
  onRetry,
  size = 'sm'
}: RetryButtonProps) {
  const { retry, isRetrying } = useDocuments()

  const handleRetry = () => {
    retry(documentId, {
      onSuccess: () => {
        toast.success('處理重新開始')
        onRetry?.()
      },
      onError: (error) => {
        toast.error(`重試失敗: ${error.message}`)
      }
    })
  }

  return (
    <Button
      variant="outline"
      size={size}
      onClick={handleRetry}
      disabled={isRetrying}
    >
      {isRetrying ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <RefreshCw className="h-4 w-4" />
      )}
      <span className="ml-1">重試</span>
    </Button>
  )
}
```

#### Step 5.3: InvoiceListTable Component

Create `src/components/features/invoice/InvoiceListTable.tsx`:

```typescript
'use client'

/**
 * Invoice list table with status tracking
 */

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { ProcessingStatus } from './ProcessingStatus'
import { RetryButton } from './RetryButton'
import { ConfidenceBadge } from '../confidence/ConfidenceBadge'
import { getStatusConfig } from '@/lib/document-status'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { Eye, FileText } from 'lucide-react'
import Link from 'next/link'
import type { DocumentListItem } from '@/services/document.service'

interface InvoiceListTableProps {
  documents: DocumentListItem[]
  isLoading?: boolean
}

export function InvoiceListTable({
  documents,
  isLoading
}: InvoiceListTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-pulse text-gray-500">載入中...</div>
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500">
        <FileText className="h-12 w-12 mb-4 opacity-50" />
        <p>沒有找到文件</p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>文件名稱</TableHead>
          <TableHead>狀態</TableHead>
          <TableHead>信心度</TableHead>
          <TableHead>處理路徑</TableHead>
          <TableHead>上傳時間</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {documents.map((doc) => {
          const statusConfig = getStatusConfig(doc.status)

          return (
            <TableRow key={doc.id}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-gray-400" />
                  <span className="truncate max-w-[200px]" title={doc.fileName}>
                    {doc.fileName}
                  </span>
                </div>
              </TableCell>

              <TableCell>
                <ProcessingStatus status={doc.status} />
                {doc.errorMessage && (
                  <p className="text-xs text-red-500 mt-1 truncate max-w-[150px]" title={doc.errorMessage}>
                    {doc.errorMessage}
                  </p>
                )}
              </TableCell>

              <TableCell>
                {doc.overallConfidence !== null ? (
                  <ConfidenceBadge score={doc.overallConfidence} />
                ) : (
                  <span className="text-gray-400">--</span>
                )}
              </TableCell>

              <TableCell>
                {doc.processingPath ? (
                  <span className="text-sm capitalize">
                    {doc.processingPath.replace('_', ' ').toLowerCase()}
                  </span>
                ) : (
                  <span className="text-gray-400">--</span>
                )}
              </TableCell>

              <TableCell className="text-gray-500 text-sm">
                {formatDistanceToNow(new Date(doc.createdAt), {
                  addSuffix: true,
                  locale: zhTW
                })}
              </TableCell>

              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  {statusConfig.canRetry && (
                    <RetryButton documentId={doc.id} />
                  )}
                  <Link href={`/invoices/${doc.id}`}>
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
```

---

### Phase 6: Invoice List Page (15 min)

#### Step 6.1: Create Invoice List Page

Create `src/app/(dashboard)/invoices/page.tsx`:

```typescript
'use client'

/**
 * Invoice list page with status tracking
 */

import { useState } from 'react'
import { useDocuments } from '@/hooks/useDocuments'
import { InvoiceListTable } from '@/components/features/invoice/InvoiceListTable'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Search, Filter, RefreshCw } from 'lucide-react'

export default function InvoicesPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  const {
    data,
    isLoading,
    isRefetching,
    refetch
  } = useDocuments({
    page,
    pageSize: 20,
    search: search || undefined,
    status: statusFilter || undefined
  })

  const stats = data?.stats

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">發票文件</h1>
          <p className="text-gray-500">管理和追蹤上傳的發票處理狀態</p>
        </div>
        <Button onClick={() => refetch()} disabled={isRefetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                總計
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-500">
                處理中
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {stats.processing}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-500">
                已完成
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats.completed}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-500">
                失敗
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {stats.failed}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="搜尋文件名稱..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="pl-10"
          />
        </div>

        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="所有狀態" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">所有狀態</SelectItem>
            <SelectItem value="UPLOADING">上傳中</SelectItem>
            <SelectItem value="OCR_PROCESSING">OCR 處理中</SelectItem>
            <SelectItem value="PENDING_REVIEW">待審核</SelectItem>
            <SelectItem value="COMPLETED">已完成</SelectItem>
            <SelectItem value="FAILED">失敗</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <InvoiceListTable
            documents={data?.data || []}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>

      {/* Pagination */}
      {data?.meta && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            顯示 {((page - 1) * data.meta.pageSize) + 1} - {Math.min(page * data.meta.pageSize, data.meta.total)} of {data.meta.total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              上一頁
            </Button>
            <span className="text-sm">
              {page} / {data.meta.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(data.meta.totalPages, p + 1))}
              disabled={page === data.meta.totalPages}
            >
              下一頁
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
```

---

## Testing Guide

### Component Tests

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProcessingStatus } from '../ProcessingStatus'

describe('ProcessingStatus', () => {
  it('shows spinning loader for processing status', () => {
    render(<ProcessingStatus status="OCR_PROCESSING" />)

    expect(screen.getByText('OCR 處理中')).toBeInTheDocument()
    // Check for animate-spin class
  })

  it('shows error styling for failed status', () => {
    render(<ProcessingStatus status="OCR_FAILED" />)

    const element = screen.getByText('OCR 失敗').parentElement
    expect(element).toHaveClass('bg-red-100')
  })
})
```

---

## Verification Checklist

| Item | Expected Result | Status |
|------|-----------------|--------|
| Document list loads | Shows all documents | [ ] |
| Status badges display | Correct icons/colors | [ ] |
| Processing animation | Spinner for processing | [ ] |
| Auto-refresh works | 5s for processing, 30s idle | [ ] |
| Error message shows | Red text under status | [ ] |
| Retry button works | Resets and restarts | [ ] |
| Pagination works | Navigate pages correctly | [ ] |
| Search works | Filters by filename | [ ] |
| Status filter works | Filters by status | [ ] |

---

## Polling Strategy Reference

| Condition | Interval | Rationale |
|-----------|----------|-----------|
| Has processing docs | 5 seconds | Quick updates needed |
| No processing docs | 30 seconds | Conserve resources |
| Single doc view | 3 seconds | Detailed tracking |

---

## Related Documentation

- [Story 2.7 User Story](./stories/2-7-processing-status-tracking-display.md)
- [Stories 2.1 ~ 2.6](./stories/) (Prerequisites)
- [Document Status Config](../src/lib/document-status.ts)

---

*Tech Spec Version: 1.0*
*Last Updated: 2025-12-16*
