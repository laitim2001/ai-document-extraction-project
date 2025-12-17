# Tech Spec: Story 3-2 並排 PDF 對照審核界面

## 1. Overview

### 1.1 Story Reference
- **Story ID**: 3.2
- **Title**: 並排 PDF 對照審核界面
- **Epic**: Epic 3 - 發票審核與修正工作流

### 1.2 Story Description
作為數據處理員，我希望在同一畫面看到原始 PDF 和提取結果的對照，以便快速核對提取的準確性。

### 1.3 Dependencies
- **Story 3-1**: 待審核發票列表（提供導航入口）
- **Epic 2**: 文件處理流程、ExtractionResult 數據模型

---

## 2. Acceptance Criteria Mapping

| AC ID | Description | Implementation Approach |
|-------|-------------|------------------------|
| AC1 | 並排佈局 | ResizablePanel + PdfViewer + ReviewPanel 組件 |
| AC2 | 欄位-來源聯動 | fieldPosition 數據 + PDF highlight overlay |
| AC3 | PDF 翻頁功能 | react-pdf Document/Page + 翻頁控制器 |
| AC4 | 響應式佈局 | ResizablePanelGroup + 小螢幕 Tab 切換 |

---

## 3. Architecture Overview

### 3.1 System Context

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        審核詳情頁面                                       │
├───────────────────────────────┬─────────────────────────────────────────┤
│                               │                                          │
│  ┌─────────────────────────┐  │  ┌────────────────────────────────────┐ │
│  │ PdfViewer               │  │  │ ReviewPanel                        │ │
│  │                         │  │  │                                    │ │
│  │  ┌───────────────────┐  │  │  │ ┌────────────────────────────────┐│ │
│  │  │ PDF Content       │  │  │  │ │ Header Info Group              ││ │
│  │  │                   │  │  │  │ │ • Invoice Number: INV-001 ✓    ││ │
│  │  │  ┌─────────────┐  │  │  │  │ │ • Date: 2024-01-15 ○          ││ │
│  │  │  │ Highlight   │  │  │  │  │ └────────────────────────────────┘│ │
│  │  │  │ Overlay     │  │  │  │  │                                    │ │
│  │  │  └─────────────┘  │  │  │  │ ┌────────────────────────────────┐│ │
│  │  │                   │  │  │  │ │ Line Items Group               ││ │
│  │  └───────────────────┘  │  │  │ │ • Ocean Freight: $500 ✓       ││ │
│  │                         │  │  │  │ • THC: $120 △                 ││ │
│  │  ┌───────────────────┐  │  │  │ └────────────────────────────────┘│ │
│  │  │ Toolbar           │  │  │  │                                    │ │
│  │  │ [-] [100%] [+]    │  │  │  │ ┌────────────────────────────────┐│ │
│  │  │ [◄] 1/5 [►]       │  │  │  │ │ Actions                        ││ │
│  │  └───────────────────┘  │  │  │ │ [確認無誤] [儲存修正] [升級]   ││ │
│  └─────────────────────────┘  │  │ └────────────────────────────────┘│ │
│                               │  └────────────────────────────────────┘ │
│          ◄─── Resizable ───►  │                                          │
└───────────────────────────────┴─────────────────────────────────────────┘
```

### 3.2 Component Architecture

```
src/
├── app/(dashboard)/review/[id]/
│   └── page.tsx                      # 審核詳情頁面
├── components/features/review/
│   ├── ReviewDetailLayout.tsx        # 並排佈局容器
│   ├── PdfViewer/
│   │   ├── PdfViewer.tsx             # PDF 檢視器主組件
│   │   ├── PdfToolbar.tsx            # 縮放/翻頁工具列
│   │   ├── PdfHighlightOverlay.tsx   # 欄位高亮覆蓋層
│   │   └── PdfLoadingSkeleton.tsx    # PDF 載入骨架
│   ├── ReviewPanel/
│   │   ├── ReviewPanel.tsx           # 審核面板主組件
│   │   ├── FieldGroup.tsx            # 欄位分組
│   │   ├── FieldRow.tsx              # 單個欄位列
│   │   └── ReviewActions.tsx         # 審核操作按鈕
│   └── index.ts
├── hooks/
│   ├── useReviewDetail.ts            # 審核詳情 Hook
│   └── usePdfHighlight.ts            # PDF 高亮控制 Hook
├── stores/
│   └── reviewStore.ts                # 審核狀態 Store (Zustand)
└── app/api/review/[id]/
    └── route.ts                      # 審核詳情 API
```

### 3.3 Data Flow

```
User clicks field → ReviewPanel.onFieldSelect(fieldId)
                          │
                          ▼
              reviewStore.setSelectedField(fieldId)
                          │
                          ▼
              PdfViewer subscribes to selectedField
                          │
                          ▼
              Calculate highlight position from fieldPosition
                          │
                          ▼
              PdfHighlightOverlay renders highlight box
                          │
                          ▼
              Auto-scroll to highlighted position
```

---

## 4. Implementation Guide

### Phase 1: API Layer (AC1)

#### 4.1.1 審核詳情 API

**File**: `src/app/api/review/[id]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface RouteParams {
  params: { id: string }
}

// GET /api/review/[id] - 獲取審核詳情
export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({
      success: false,
      error: {
        type: 'unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: 'Authentication required'
      }
    }, { status: 401 })
  }

  const { id } = params

  try {
    // 獲取文件和提取結果
    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        forwarder: {
          select: { id: true, name: true, code: true }
        },
        extractionResults: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            fieldResults: {
              orderBy: { fieldName: 'asc' }
            }
          }
        },
        processingQueue: true
      }
    })

    if (!document) {
      return NextResponse.json({
        success: false,
        error: {
          type: 'not_found',
          title: 'Not Found',
          status: 404,
          detail: `Document ${id} not found`
        }
      }, { status: 404 })
    }

    const extractionResult = document.extractionResults[0]
    if (!extractionResult) {
      return NextResponse.json({
        success: false,
        error: {
          type: 'not_found',
          title: 'Not Found',
          status: 404,
          detail: 'No extraction result found for this document'
        }
      }, { status: 404 })
    }

    // 構建響應數據
    const data = {
      document: {
        id: document.id,
        fileName: document.originalName || document.fileName,
        fileUrl: document.fileUrl,
        mimeType: document.mimeType,
        pageCount: document.pageCount || 1,
        createdAt: document.createdAt.toISOString()
      },
      forwarder: document.forwarder,
      processingQueue: document.processingQueue ? {
        id: document.processingQueue.id,
        processingPath: document.processingQueue.processingPath,
        overallConfidence: Math.round(document.processingQueue.overallConfidence * 100),
        status: document.processingQueue.status
      } : null,
      extraction: {
        id: extractionResult.id,
        overallConfidence: Math.round(extractionResult.overallConfidence * 100),
        fields: extractionResult.fieldResults.map(field => ({
          id: field.id,
          fieldName: field.fieldName,
          fieldGroup: field.fieldGroup,
          value: field.value,
          confidence: Math.round(field.confidence * 100),
          sourcePosition: field.sourcePosition ? JSON.parse(field.sourcePosition) : null,
          mappingSource: field.mappingSource
        }))
      }
    }

    return NextResponse.json({
      success: true,
      data
    })
  } catch (error) {
    console.error('Failed to fetch review detail:', error)
    return NextResponse.json({
      success: false,
      error: {
        type: 'internal_error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to fetch review detail'
      }
    }, { status: 500 })
  }
}
```

#### 4.1.2 類型定義

**File**: `src/types/review.ts` (擴展)

```typescript
import { ProcessingPath, QueueStatus } from '@prisma/client'

// 欄位來源位置
export interface FieldSourcePosition {
  page: number      // 頁碼 (1-indexed)
  x: number         // X 座標 (百分比 0-1)
  y: number         // Y 座標 (百分比 0-1)
  width: number     // 寬度 (百分比 0-1)
  height: number    // 高度 (百分比 0-1)
}

// 提取欄位結果
export interface ExtractedField {
  id: string
  fieldName: string
  fieldGroup: string
  value: string | null
  confidence: number  // 0-100
  sourcePosition: FieldSourcePosition | null
  mappingSource: 'UNIVERSAL' | 'FORWARDER' | 'LLM' | null
}

// 審核詳情響應
export interface ReviewDetailData {
  document: {
    id: string
    fileName: string
    fileUrl: string
    mimeType: string
    pageCount: number
    createdAt: string
  }
  forwarder: {
    id: string
    name: string
    code: string
  } | null
  processingQueue: {
    id: string
    processingPath: ProcessingPath
    overallConfidence: number
    status: QueueStatus
  } | null
  extraction: {
    id: string
    overallConfidence: number
    fields: ExtractedField[]
  }
}

export interface ReviewDetailResponse {
  success: true
  data: ReviewDetailData
}

// 欄位分組
export interface FieldGroupData {
  groupName: string
  displayName: string
  fields: ExtractedField[]
  isExpanded: boolean
}
```

---

### Phase 2: State Management (AC2)

#### 4.2.1 審核狀態 Store

**File**: `src/stores/reviewStore.ts`

```typescript
import { create } from 'zustand'
import { FieldSourcePosition } from '@/types/review'

interface ReviewState {
  // 選中的欄位
  selectedFieldId: string | null
  selectedFieldPosition: FieldSourcePosition | null

  // PDF 狀態
  currentPage: number
  zoomLevel: number

  // 修改追蹤
  dirtyFields: Set<string>
  pendingChanges: Map<string, string>

  // Actions
  setSelectedField: (fieldId: string | null, position?: FieldSourcePosition | null) => void
  setCurrentPage: (page: number) => void
  setZoomLevel: (level: number) => void
  markFieldDirty: (fieldId: string, newValue: string) => void
  clearDirtyField: (fieldId: string) => void
  resetChanges: () => void
  hasPendingChanges: () => boolean
}

export const useReviewStore = create<ReviewState>((set, get) => ({
  // Initial state
  selectedFieldId: null,
  selectedFieldPosition: null,
  currentPage: 1,
  zoomLevel: 1,
  dirtyFields: new Set(),
  pendingChanges: new Map(),

  // Actions
  setSelectedField: (fieldId, position = null) => {
    set({
      selectedFieldId: fieldId,
      selectedFieldPosition: position
    })

    // 如果有位置信息，自動跳轉到對應頁面
    if (position?.page) {
      set({ currentPage: position.page })
    }
  },

  setCurrentPage: (page) => set({ currentPage: page }),

  setZoomLevel: (level) => set({ zoomLevel: Math.max(0.5, Math.min(3, level)) }),

  markFieldDirty: (fieldId, newValue) => {
    const { dirtyFields, pendingChanges } = get()
    const newDirtyFields = new Set(dirtyFields)
    const newPendingChanges = new Map(pendingChanges)

    newDirtyFields.add(fieldId)
    newPendingChanges.set(fieldId, newValue)

    set({ dirtyFields: newDirtyFields, pendingChanges: newPendingChanges })
  },

  clearDirtyField: (fieldId) => {
    const { dirtyFields, pendingChanges } = get()
    const newDirtyFields = new Set(dirtyFields)
    const newPendingChanges = new Map(pendingChanges)

    newDirtyFields.delete(fieldId)
    newPendingChanges.delete(fieldId)

    set({ dirtyFields: newDirtyFields, pendingChanges: newPendingChanges })
  },

  resetChanges: () => {
    set({
      dirtyFields: new Set(),
      pendingChanges: new Map(),
      selectedFieldId: null,
      selectedFieldPosition: null
    })
  },

  hasPendingChanges: () => get().dirtyFields.size > 0
}))
```

---

### Phase 3: React Query Hook (AC1)

**File**: `src/hooks/useReviewDetail.ts`

```typescript
import { useQuery } from '@tanstack/react-query'
import { ReviewDetailResponse } from '@/types/review'

async function fetchReviewDetail(documentId: string): Promise<ReviewDetailResponse> {
  const response = await fetch(`/api/review/${documentId}`)
  const result = await response.json()

  if (!result.success) {
    throw new Error(result.error?.detail || 'Failed to fetch review detail')
  }

  return result
}

export function useReviewDetail(documentId: string) {
  return useQuery({
    queryKey: ['reviewDetail', documentId],
    queryFn: () => fetchReviewDetail(documentId),
    enabled: !!documentId,
    staleTime: 5 * 60 * 1000,  // 5 分鐘
    refetchOnWindowFocus: false,
  })
}
```

---

### Phase 4: PDF Viewer Components (AC1, AC2, AC3)

#### 4.4.1 PDF 檢視器主組件

**File**: `src/components/features/review/PdfViewer/PdfViewer.tsx`

```typescript
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { useReviewStore } from '@/stores/reviewStore'
import { PdfToolbar } from './PdfToolbar'
import { PdfHighlightOverlay } from './PdfHighlightOverlay'
import { PdfLoadingSkeleton } from './PdfLoadingSkeleton'
import { cn } from '@/lib/utils'

import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// 設置 PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`

interface PdfViewerProps {
  url: string
  pageCount: number
  className?: string
}

export function PdfViewer({ url, pageCount, className }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const {
    currentPage,
    zoomLevel,
    selectedFieldPosition,
    setCurrentPage,
    setZoomLevel
  } = useReviewStore()

  // 監聽容器寬度變化
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const resizeObserver = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect
      setContainerWidth(width)
    })

    resizeObserver.observe(container)
    return () => resizeObserver.disconnect()
  }, [])

  // 計算頁面寬度
  const pageWidth = containerWidth > 0 ? (containerWidth - 48) * zoomLevel : undefined

  // 文件載入成功
  const handleLoadSuccess = useCallback(() => {
    setIsLoading(false)
    setError(null)
  }, [])

  // 文件載入失敗
  const handleLoadError = useCallback((err: Error) => {
    setIsLoading(false)
    setError('無法載入 PDF 文件')
    console.error('PDF load error:', err)
  }, [])

  // 翻頁
  const handlePrevPage = useCallback(() => {
    setCurrentPage(Math.max(1, currentPage - 1))
  }, [currentPage, setCurrentPage])

  const handleNextPage = useCallback(() => {
    setCurrentPage(Math.min(pageCount, currentPage + 1))
  }, [currentPage, pageCount, setCurrentPage])

  // 縮放
  const handleZoomIn = useCallback(() => {
    setZoomLevel(zoomLevel + 0.1)
  }, [zoomLevel, setZoomLevel])

  const handleZoomOut = useCallback(() => {
    setZoomLevel(zoomLevel - 0.1)
  }, [zoomLevel, setZoomLevel])

  const handleZoomReset = useCallback(() => {
    setZoomLevel(1)
  }, [setZoomLevel])

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* 工具列 */}
      <PdfToolbar
        currentPage={currentPage}
        pageCount={pageCount}
        zoomLevel={zoomLevel}
        onPrevPage={handlePrevPage}
        onNextPage={handleNextPage}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
      />

      {/* PDF 內容區 */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-muted/30 p-6"
      >
        {error ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-destructive">{error}</p>
          </div>
        ) : (
          <div className="relative flex justify-center">
            <Document
              file={url}
              onLoadSuccess={handleLoadSuccess}
              onLoadError={handleLoadError}
              loading={<PdfLoadingSkeleton />}
            >
              <div className="relative shadow-lg">
                <Page
                  pageNumber={currentPage}
                  width={pageWidth}
                  renderTextLayer={true}
                  renderAnnotationLayer={false}
                />

                {/* 高亮覆蓋層 */}
                {selectedFieldPosition &&
                  selectedFieldPosition.page === currentPage && (
                    <PdfHighlightOverlay
                      position={selectedFieldPosition}
                      containerWidth={pageWidth || containerWidth}
                    />
                  )}
              </div>
            </Document>
          </div>
        )}
      </div>
    </div>
  )
}
```

#### 4.4.2 PDF 工具列

**File**: `src/components/features/review/PdfViewer/PdfToolbar.tsx`

```typescript
'use client'

import { Button } from '@/components/ui/button'
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw
} from 'lucide-react'

interface PdfToolbarProps {
  currentPage: number
  pageCount: number
  zoomLevel: number
  onPrevPage: () => void
  onNextPage: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
}

export function PdfToolbar({
  currentPage,
  pageCount,
  zoomLevel,
  onPrevPage,
  onNextPage,
  onZoomIn,
  onZoomOut,
  onZoomReset
}: PdfToolbarProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-b bg-background">
      {/* 翻頁控制 */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onPrevPage}
          disabled={currentPage <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <span className="text-sm min-w-[80px] text-center">
          {currentPage} / {pageCount}
        </span>

        <Button
          variant="ghost"
          size="icon"
          onClick={onNextPage}
          disabled={currentPage >= pageCount}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* 縮放控制 */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onZoomOut}
          disabled={zoomLevel <= 0.5}
        >
          <ZoomOut className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onZoomReset}
          className="min-w-[60px]"
        >
          {Math.round(zoomLevel * 100)}%
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onZoomIn}
          disabled={zoomLevel >= 3}
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
```

#### 4.4.3 高亮覆蓋層

**File**: `src/components/features/review/PdfViewer/PdfHighlightOverlay.tsx`

```typescript
'use client'

import { useEffect, useRef } from 'react'
import { FieldSourcePosition } from '@/types/review'
import { cn } from '@/lib/utils'

interface PdfHighlightOverlayProps {
  position: FieldSourcePosition
  containerWidth: number
}

export function PdfHighlightOverlay({
  position,
  containerWidth
}: PdfHighlightOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  // 計算像素位置
  const style = {
    left: `${position.x * 100}%`,
    top: `${position.y * 100}%`,
    width: `${position.width * 100}%`,
    height: `${position.height * 100}%`
  }

  // 自動滾動到高亮位置
  useEffect(() => {
    if (overlayRef.current) {
      overlayRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center'
      })
    }
  }, [position])

  return (
    <div
      ref={overlayRef}
      className={cn(
        'absolute pointer-events-none',
        'border-2 border-primary',
        'bg-primary/20',
        'rounded-sm',
        'animate-pulse'
      )}
      style={style}
    >
      {/* 角標記 */}
      <div className="absolute -top-1 -left-1 w-2 h-2 bg-primary rounded-full" />
      <div className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />
      <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-primary rounded-full" />
      <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-primary rounded-full" />
    </div>
  )
}
```

#### 4.4.4 PDF 載入骨架

**File**: `src/components/features/review/PdfViewer/PdfLoadingSkeleton.tsx`

```typescript
import { Skeleton } from '@/components/ui/skeleton'
import { Loader2 } from 'lucide-react'

export function PdfLoadingSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-4">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">載入 PDF 中...</p>
      <Skeleton className="w-[400px] h-[566px]" />
    </div>
  )
}
```

---

### Phase 5: Review Panel Components (AC1, AC2)

#### 4.5.1 審核面板主組件

**File**: `src/components/features/review/ReviewPanel/ReviewPanel.tsx`

```typescript
'use client'

import { useMemo } from 'react'
import { ExtractedField, FieldGroupData, ReviewDetailData } from '@/types/review'
import { useReviewStore } from '@/stores/reviewStore'
import { FieldGroup } from './FieldGroup'
import { ReviewActions } from './ReviewActions'
import { ConfidenceBadge } from '../ConfidenceBadge'
import { ProcessingPathBadge } from '../ProcessingPathBadge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'

// 欄位分組配置
const FIELD_GROUPS: { key: string; displayName: string }[] = [
  { key: 'header', displayName: '發票基本資訊' },
  { key: 'shipper', displayName: '發貨人資訊' },
  { key: 'consignee', displayName: '收貨人資訊' },
  { key: 'shipment', displayName: '運輸資訊' },
  { key: 'charges', displayName: '費用明細' },
  { key: 'totals', displayName: '金額合計' },
  { key: 'other', displayName: '其他資訊' }
]

interface ReviewPanelProps {
  data: ReviewDetailData
  onApprove: () => void
  onSaveCorrections: () => void
  onEscalate: () => void
  isSubmitting?: boolean
}

export function ReviewPanel({
  data,
  onApprove,
  onSaveCorrections,
  onEscalate,
  isSubmitting
}: ReviewPanelProps) {
  const { selectedFieldId, setSelectedField, hasPendingChanges } = useReviewStore()

  // 將欄位按組分類
  const groupedFields = useMemo(() => {
    const groups: FieldGroupData[] = []
    const fieldsByGroup = new Map<string, ExtractedField[]>()

    // 分組
    data.extraction.fields.forEach(field => {
      const group = field.fieldGroup || 'other'
      if (!fieldsByGroup.has(group)) {
        fieldsByGroup.set(group, [])
      }
      fieldsByGroup.get(group)!.push(field)
    })

    // 按配置順序排列
    FIELD_GROUPS.forEach(({ key, displayName }) => {
      const fields = fieldsByGroup.get(key)
      if (fields && fields.length > 0) {
        groups.push({
          groupName: key,
          displayName,
          fields,
          isExpanded: true
        })
      }
    })

    return groups
  }, [data.extraction.fields])

  // 處理欄位選擇
  const handleFieldSelect = (field: ExtractedField) => {
    setSelectedField(
      field.id === selectedFieldId ? null : field.id,
      field.sourcePosition
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* 頭部信息 */}
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold truncate" title={data.document.fileName}>
            {data.document.fileName}
          </h2>
          {data.processingQueue && (
            <ProcessingPathBadge path={data.processingQueue.processingPath} />
          )}
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>Forwarder: {data.forwarder?.name || '未識別'}</span>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center gap-2">
            <span>整體信心度:</span>
            <ConfidenceBadge score={data.extraction.overallConfidence} />
          </div>
        </div>
      </div>

      {/* 欄位列表 */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {groupedFields.map((group) => (
            <FieldGroup
              key={group.groupName}
              group={group}
              selectedFieldId={selectedFieldId}
              onFieldSelect={handleFieldSelect}
            />
          ))}
        </div>
      </ScrollArea>

      {/* 操作按鈕 */}
      <ReviewActions
        onApprove={onApprove}
        onSaveCorrections={onSaveCorrections}
        onEscalate={onEscalate}
        hasPendingChanges={hasPendingChanges()}
        isSubmitting={isSubmitting}
      />
    </div>
  )
}
```

#### 4.5.2 欄位分組組件

**File**: `src/components/features/review/ReviewPanel/FieldGroup.tsx`

```typescript
'use client'

import { useState } from 'react'
import { ExtractedField, FieldGroupData } from '@/types/review'
import { FieldRow } from './FieldRow'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface FieldGroupProps {
  group: FieldGroupData
  selectedFieldId: string | null
  onFieldSelect: (field: ExtractedField) => void
}

export function FieldGroup({
  group,
  selectedFieldId,
  onFieldSelect
}: FieldGroupProps) {
  const [isExpanded, setIsExpanded] = useState(group.isExpanded)

  // 計算該組的最低信心度
  const minConfidence = Math.min(...group.fields.map(f => f.confidence))
  const hasLowConfidence = minConfidence < 70

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* 組標題 */}
      <Button
        variant="ghost"
        className={cn(
          'w-full justify-between rounded-none h-10',
          hasLowConfidence && 'bg-red-50'
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <span className="font-medium">{group.displayName}</span>
          <span className="text-xs text-muted-foreground">
            ({group.fields.length})
          </span>
        </div>

        {hasLowConfidence && (
          <span className="text-xs text-red-600">需要關注</span>
        )}
      </Button>

      {/* 欄位列表 */}
      {isExpanded && (
        <div className="divide-y">
          {group.fields.map((field) => (
            <FieldRow
              key={field.id}
              field={field}
              isSelected={field.id === selectedFieldId}
              onSelect={() => onFieldSelect(field)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

#### 4.5.3 單個欄位列組件

**File**: `src/components/features/review/ReviewPanel/FieldRow.tsx`

```typescript
'use client'

import { ExtractedField } from '@/types/review'
import { ConfidenceBadge } from '../ConfidenceBadge'
import { cn } from '@/lib/utils'
import { MapPin } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface FieldRowProps {
  field: ExtractedField
  isSelected: boolean
  onSelect: () => void
}

// 欄位名稱中英對照
const FIELD_LABELS: Record<string, string> = {
  invoiceNumber: '發票號碼',
  invoiceDate: '發票日期',
  dueDate: '到期日',
  currency: '幣別',
  totalAmount: '總金額',
  shipperName: '發貨人名稱',
  consigneeName: '收貨人名稱',
  vesselName: '船名',
  voyageNumber: '航次',
  containerNumber: '貨櫃號',
  blNumber: '提單號',
  // ... 更多欄位對照
}

export function FieldRow({ field, isSelected, onSelect }: FieldRowProps) {
  const confidenceLevel = field.confidence >= 90 ? 'high' :
                          field.confidence >= 70 ? 'medium' : 'low'

  const bgColor = {
    high: 'hover:bg-green-50',
    medium: 'hover:bg-yellow-50',
    low: 'bg-red-50 hover:bg-red-100'
  }[confidenceLevel]

  return (
    <div
      className={cn(
        'flex items-center justify-between p-3 cursor-pointer transition-colors',
        bgColor,
        isSelected && 'ring-2 ring-inset ring-primary bg-primary/5'
      )}
      onClick={onSelect}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {FIELD_LABELS[field.fieldName] || field.fieldName}
          </span>

          {/* 來源位置指示器 */}
          {field.sourcePosition && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <MapPin className="h-3 w-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>點擊查看 PDF 對應位置（第 {field.sourcePosition.page} 頁）</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        <p className="text-sm text-muted-foreground truncate">
          {field.value || '—'}
        </p>
      </div>

      <div className="flex items-center gap-2 ml-4">
        <ConfidenceBadge score={field.confidence} size="sm" />
      </div>
    </div>
  )
}
```

#### 4.5.4 審核操作組件

**File**: `src/components/features/review/ReviewPanel/ReviewActions.tsx`

```typescript
'use client'

import { Button } from '@/components/ui/button'
import { Check, Save, ArrowUpRight, Loader2 } from 'lucide-react'

interface ReviewActionsProps {
  onApprove: () => void
  onSaveCorrections: () => void
  onEscalate: () => void
  hasPendingChanges: boolean
  isSubmitting?: boolean
}

export function ReviewActions({
  onApprove,
  onSaveCorrections,
  onEscalate,
  hasPendingChanges,
  isSubmitting
}: ReviewActionsProps) {
  return (
    <div className="p-4 border-t bg-muted/30">
      <div className="flex items-center gap-3">
        {/* 確認無誤 */}
        <Button
          onClick={onApprove}
          disabled={hasPendingChanges || isSubmitting}
          className="flex-1"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Check className="h-4 w-4 mr-2" />
          )}
          確認無誤
        </Button>

        {/* 儲存修正 */}
        <Button
          variant="secondary"
          onClick={onSaveCorrections}
          disabled={!hasPendingChanges || isSubmitting}
          className="flex-1"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          儲存修正
        </Button>

        {/* 升級案例 */}
        <Button
          variant="outline"
          onClick={onEscalate}
          disabled={isSubmitting}
        >
          <ArrowUpRight className="h-4 w-4 mr-2" />
          升級
        </Button>
      </div>

      {hasPendingChanges && (
        <p className="text-xs text-muted-foreground mt-2 text-center">
          有未儲存的修改
        </p>
      )}
    </div>
  )
}
```

---

### Phase 6: Layout Components (AC1, AC4)

#### 4.6.1 並排佈局組件

**File**: `src/components/features/review/ReviewDetailLayout.tsx`

```typescript
'use client'

import { useEffect, useState } from 'react'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useMediaQuery } from '@/hooks/useMediaQuery'

interface ReviewDetailLayoutProps {
  pdfViewer: React.ReactNode
  reviewPanel: React.ReactNode
}

export function ReviewDetailLayout({
  pdfViewer,
  reviewPanel
}: ReviewDetailLayoutProps) {
  const isSmallScreen = useMediaQuery('(max-width: 1024px)')
  const [activeTab, setActiveTab] = useState<string>('pdf')

  // 小螢幕使用 Tab 佈局
  if (isSmallScreen) {
    return (
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex flex-col h-full"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="pdf">原始文件</TabsTrigger>
          <TabsTrigger value="review">提取結果</TabsTrigger>
        </TabsList>

        <TabsContent value="pdf" className="flex-1 mt-0">
          {pdfViewer}
        </TabsContent>

        <TabsContent value="review" className="flex-1 mt-0">
          {reviewPanel}
        </TabsContent>
      </Tabs>
    )
  }

  // 大螢幕使用並排佈局
  return (
    <ResizablePanelGroup
      direction="horizontal"
      className="h-full rounded-lg border"
    >
      <ResizablePanel defaultSize={55} minSize={30}>
        {pdfViewer}
      </ResizablePanel>

      <ResizableHandle withHandle />

      <ResizablePanel defaultSize={45} minSize={25}>
        {reviewPanel}
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
```

#### 4.6.2 Media Query Hook

**File**: `src/hooks/useMediaQuery.ts`

```typescript
import { useEffect, useState } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const media = window.matchMedia(query)

    // 初始值
    setMatches(media.matches)

    // 監聽變化
    const listener = (event: MediaQueryListEvent) => {
      setMatches(event.matches)
    }

    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [query])

  return matches
}
```

---

### Phase 7: Page Integration (AC1-4)

**File**: `src/app/(dashboard)/review/[id]/page.tsx`

```typescript
'use client'

import { useRouter } from 'next/navigation'
import { useReviewDetail } from '@/hooks/useReviewDetail'
import { useReviewStore } from '@/stores/reviewStore'
import { ReviewDetailLayout } from '@/components/features/review/ReviewDetailLayout'
import { PdfViewer } from '@/components/features/review/PdfViewer/PdfViewer'
import { ReviewPanel } from '@/components/features/review/ReviewPanel/ReviewPanel'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useEffect, useState } from 'react'

interface PageProps {
  params: { id: string }
}

export default function ReviewDetailPage({ params }: PageProps) {
  const router = useRouter()
  const { id } = params
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { data, isLoading, error } = useReviewDetail(id)
  const { resetChanges, hasPendingChanges } = useReviewStore()

  // 離開頁面前確認
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasPendingChanges()) {
        e.preventDefault()
        e.returnValue = ''
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasPendingChanges])

  // 重置狀態
  useEffect(() => {
    return () => resetChanges()
  }, [resetChanges])

  // 確認無誤
  const handleApprove = async () => {
    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/review/${id}/approve`, {
        method: 'POST'
      })
      const result = await response.json()

      if (result.success) {
        toast.success('已確認無誤')
        router.push('/review')
      } else {
        toast.error(result.error?.detail || '操作失敗')
      }
    } catch (err) {
      toast.error('操作失敗，請重試')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 儲存修正
  const handleSaveCorrections = async () => {
    // Story 3-5 實現
    toast.info('修正功能將在 Story 3-5 實現')
  }

  // 升級案例
  const handleEscalate = async () => {
    // Story 3-7 實現
    toast.info('升級功能將在 Story 3-7 實現')
  }

  // 返回列表
  const handleBack = () => {
    if (hasPendingChanges()) {
      if (confirm('有未儲存的修改，確定要離開嗎？')) {
        router.push('/review')
      }
    } else {
      router.push('/review')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !data?.data) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] gap-4">
        <p className="text-destructive">無法載入審核詳情</p>
        <Button variant="outline" onClick={handleBack}>
          返回列表
        </Button>
      </div>
    )
  }

  const reviewData = data.data

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* 頂部導航 */}
      <div className="flex items-center gap-4 px-6 py-3 border-b">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回列表
        </Button>
        <span className="text-sm text-muted-foreground">
          審核發票
        </span>
      </div>

      {/* 主要內容區 */}
      <div className="flex-1 p-6">
        <ReviewDetailLayout
          pdfViewer={
            <PdfViewer
              url={reviewData.document.fileUrl}
              pageCount={reviewData.document.pageCount}
            />
          }
          reviewPanel={
            <ReviewPanel
              data={reviewData}
              onApprove={handleApprove}
              onSaveCorrections={handleSaveCorrections}
              onEscalate={handleEscalate}
              isSubmitting={isSubmitting}
            />
          }
        />
      </div>
    </div>
  )
}
```

---

## 5. Testing Guide

### 5.1 Unit Tests

**File**: `tests/unit/components/PdfViewer.test.tsx`

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { PdfViewer } from '@/components/features/review/PdfViewer/PdfViewer'

// Mock react-pdf
jest.mock('react-pdf', () => ({
  Document: ({ children, onLoadSuccess }: any) => {
    React.useEffect(() => onLoadSuccess?.(), [])
    return <div data-testid="pdf-document">{children}</div>
  },
  Page: ({ pageNumber }: any) => (
    <div data-testid="pdf-page">Page {pageNumber}</div>
  ),
  pdfjs: { GlobalWorkerOptions: { workerSrc: '' }, version: '1.0' }
}))

describe('PdfViewer', () => {
  it('should render PDF document', async () => {
    render(<PdfViewer url="/test.pdf" pageCount={5} />)

    expect(screen.getByTestId('pdf-document')).toBeInTheDocument()
    expect(screen.getByTestId('pdf-page')).toHaveTextContent('Page 1')
  })

  it('should navigate between pages', () => {
    render(<PdfViewer url="/test.pdf" pageCount={5} />)

    const nextButton = screen.getByRole('button', { name: /►/i })
    fireEvent.click(nextButton)

    expect(screen.getByText('2 / 5')).toBeInTheDocument()
  })

  it('should zoom in and out', () => {
    render(<PdfViewer url="/test.pdf" pageCount={5} />)

    const zoomInButton = screen.getByRole('button', { name: /zoom in/i })
    fireEvent.click(zoomInButton)

    expect(screen.getByText('110%')).toBeInTheDocument()
  })
})
```

### 5.2 Integration Tests

**File**: `tests/integration/api/review-detail.test.ts`

```typescript
import { GET } from '@/app/api/review/[id]/route'
import { NextRequest } from 'next/server'

describe('GET /api/review/[id]', () => {
  it('should return review detail with extraction fields', async () => {
    const request = new NextRequest('http://localhost/api/review/test-doc-id')
    const response = await GET(request, { params: { id: 'test-doc-id' } })
    const data = await response.json()

    expect(data.success).toBe(true)
    expect(data.data.document).toHaveProperty('id')
    expect(data.data.document).toHaveProperty('fileUrl')
    expect(data.data.extraction).toHaveProperty('fields')
    expect(Array.isArray(data.data.extraction.fields)).toBe(true)
  })

  it('should return 404 for non-existent document', async () => {
    const request = new NextRequest('http://localhost/api/review/non-existent')
    const response = await GET(request, { params: { id: 'non-existent' } })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.success).toBe(false)
  })
})
```

### 5.3 E2E Tests

**File**: `tests/e2e/review-detail.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test.describe('Review Detail Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    // ... 登入流程
  })

  test('should display side-by-side layout on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/review/test-doc-id')

    // 檢查並排佈局
    await expect(page.locator('[data-testid="pdf-viewer"]')).toBeVisible()
    await expect(page.locator('[data-testid="review-panel"]')).toBeVisible()
  })

  test('should display tabs on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/review/test-doc-id')

    // 檢查 Tab 佈局
    await expect(page.getByRole('tab', { name: '原始文件' })).toBeVisible()
    await expect(page.getByRole('tab', { name: '提取結果' })).toBeVisible()
  })

  test('should highlight PDF when field is selected', async ({ page }) => {
    await page.goto('/review/test-doc-id')

    // 點擊欄位
    await page.locator('[data-testid="field-row"]').first().click()

    // 檢查高亮顯示
    await expect(page.locator('[data-testid="pdf-highlight"]')).toBeVisible()
  })

  test('should navigate PDF pages', async ({ page }) => {
    await page.goto('/review/test-doc-id')

    // 翻頁
    await page.getByRole('button', { name: /►/i }).click()
    await expect(page.getByText('2 / ')).toBeVisible()
  })
})
```

---

## 6. Verification Checklist

### 6.1 Acceptance Criteria Verification

- [ ] **AC1**: 並排佈局
  - [ ] 左側顯示 PDF 文件
  - [ ] 右側顯示提取結果表單
  - [ ] PDF 可縮放
  - [ ] PDF 可翻頁

- [ ] **AC2**: 欄位-來源聯動
  - [ ] 點擊欄位時 PDF 高亮對應位置
  - [ ] 自動滾動到高亮位置
  - [ ] 自動跳轉到正確頁面

- [ ] **AC3**: PDF 翻頁功能
  - [ ] 支援上一頁/下一頁導航
  - [ ] 顯示當前頁碼/總頁數
  - [ ] 首頁/末頁按鈕正確禁用

- [ ] **AC4**: 響應式佈局
  - [ ] 大螢幕顯示並排佈局
  - [ ] 小螢幕切換為 Tab 佈局
  - [ ] 可拖動調整分隔線

### 6.2 Technical Verification

- [ ] react-pdf 正確載入和渲染
- [ ] Zustand store 狀態管理正確
- [ ] API 響應符合 RFC 7807 格式
- [ ] 錯誤狀態正確處理
- [ ] 載入狀態顯示正確

### 6.3 UX Verification

- [ ] PDF 載入時顯示骨架屏
- [ ] 高亮動畫流暢
- [ ] 縮放控制直觀
- [ ] 欄位分組清晰
- [ ] 操作按鈕狀態正確

---

## 7. Files to Create/Modify

| File Path | Action | Description |
|-----------|--------|-------------|
| `src/app/api/review/[id]/route.ts` | Create | 審核詳情 API |
| `src/types/review.ts` | Modify | 擴展審核相關類型 |
| `src/stores/reviewStore.ts` | Create | 審核狀態 Store |
| `src/hooks/useReviewDetail.ts` | Create | 審核詳情 Hook |
| `src/hooks/useMediaQuery.ts` | Create | Media Query Hook |
| `src/app/(dashboard)/review/[id]/page.tsx` | Create | 審核詳情頁面 |
| `src/components/features/review/ReviewDetailLayout.tsx` | Create | 並排佈局組件 |
| `src/components/features/review/PdfViewer/PdfViewer.tsx` | Create | PDF 檢視器 |
| `src/components/features/review/PdfViewer/PdfToolbar.tsx` | Create | PDF 工具列 |
| `src/components/features/review/PdfViewer/PdfHighlightOverlay.tsx` | Create | 高亮覆蓋層 |
| `src/components/features/review/PdfViewer/PdfLoadingSkeleton.tsx` | Create | PDF 載入骨架 |
| `src/components/features/review/ReviewPanel/ReviewPanel.tsx` | Create | 審核面板 |
| `src/components/features/review/ReviewPanel/FieldGroup.tsx` | Create | 欄位分組 |
| `src/components/features/review/ReviewPanel/FieldRow.tsx` | Create | 欄位列 |
| `src/components/features/review/ReviewPanel/ReviewActions.tsx` | Create | 操作按鈕 |

---

## 8. Dependencies

### 8.1 NPM Packages

```bash
npm install react-pdf @react-pdf/renderer
npm install @radix-ui/react-resizable  # 如使用 shadcn/ui resizable
```

### 8.2 Configuration

**File**: `next.config.js` (添加 PDF.js worker 配置)

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.alias.canvas = false
    return config
  },
}

module.exports = nextConfig
```

---

*Tech Spec Created: 2025-12-16*
*Story Reference: 3-2-side-by-side-pdf-review-interface*
