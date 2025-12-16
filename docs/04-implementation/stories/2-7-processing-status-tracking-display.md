# Story 2.7: 處理狀態追蹤與顯示

**Status:** ready-for-dev

---

## Story

**As a** 數據處理員,
**I want** 查看已上傳文件的處理狀態,
**So that** 我可以了解處理進度並採取後續行動。

---

## Acceptance Criteria

### AC1: 處理狀態顯示

**Given** 用戶在文件列表頁面
**When** 查看已上傳的文件
**Then** 系統顯示每個文件的處理狀態：
- 上傳中 / 已上傳
- OCR 處理中 / OCR 完成 / OCR 失敗
- 映射中 / 映射完成
- 待審核 / 審核中 / 已完成

### AC2: 即時狀態更新

**Given** 文件處理中
**When** 狀態更新
**Then** 頁面自動刷新顯示最新狀態（輪詢或 WebSocket）

### AC3: 錯誤處理與重試

**Given** 文件處理出錯
**When** 任一步驟失敗
**Then** 顯示錯誤圖標和錯誤原因
**And** 提供「重試」按鈕

---

## Tasks / Subtasks

- [ ] **Task 1: 文件列表頁面** (AC: #1)
  - [ ] 1.1 創建 `src/app/(dashboard)/invoices/page.tsx`
  - [ ] 1.2 實現文件列表表格
  - [ ] 1.3 顯示各狀態欄位
  - [ ] 1.4 實現分頁和篩選

- [ ] **Task 2: 狀態顯示組件** (AC: #1)
  - [ ] 2.1 創建 `ProcessingStatus.tsx` 組件
  - [ ] 2.2 實現狀態圖標和顏色
  - [ ] 2.3 顯示狀態描述文字
  - [ ] 2.4 實現進度指示器

- [ ] **Task 3: 狀態查詢 API** (AC: #1, #2)
  - [ ] 3.1 創建 GET `/api/documents` 列表端點
  - [ ] 3.2 創建 GET `/api/documents/[id]` 詳情端點
  - [ ] 3.3 返回完整狀態資訊

- [ ] **Task 4: 即時更新機制** (AC: #2)
  - [ ] 4.1 實現輪詢機制（每 5 秒）
  - [ ] 4.2 使用 React Query 的 refetchInterval
  - [ ] 4.3 處理中文件優先更新

- [ ] **Task 5: 錯誤狀態顯示** (AC: #3)
  - [ ] 5.1 創建錯誤圖標和提示
  - [ ] 5.2 顯示錯誤原因詳情
  - [ ] 5.3 實現錯誤詳情彈窗

- [ ] **Task 6: 重試功能** (AC: #3)
  - [ ] 6.1 創建重試 API 端點
  - [ ] 6.2 實現重試按鈕
  - [ ] 6.3 重置狀態並重新處理

- [ ] **Task 7: 文件服務層** (AC: #1, #2, #3)
  - [ ] 7.1 創建 `src/services/document.service.ts`
  - [ ] 7.2 實現 getDocuments 函數
  - [ ] 7.3 實現 retryProcessing 函數

- [ ] **Task 8: React Query Hooks** (AC: #1, #2)
  - [ ] 8.1 創建 `useDocuments.ts` hook
  - [ ] 8.2 創建 `useDocument.ts` hook
  - [ ] 8.3 配置自動刷新策略

- [ ] **Task 9: 驗證與測試** (AC: #1-3)
  - [ ] 9.1 測試各狀態正確顯示
  - [ ] 9.2 測試即時更新
  - [ ] 9.3 測試錯誤顯示和重試

---

## Dev Notes

### 依賴項

- **Story 2.1 ~ 2.6**: 完整的處理流程

### Project Structure Notes

```
src/
├── app/
│   └── (dashboard)/
│       └── invoices/
│           ├── page.tsx            # 文件列表
│           └── [id]/
│               └── page.tsx        # 文件詳情
├── components/
│   └── features/
│       └── invoice/
│           ├── InvoiceList.tsx     # 列表組件
│           ├── ProcessingStatus.tsx # 狀態組件
│           └── RetryButton.tsx     # 重試按鈕
├── hooks/
│   ├── useDocuments.ts             # 列表 hook
│   └── useDocument.ts              # 單個 hook
└── services/
    └── document.service.ts         # 文件服務
```

### Architecture Compliance

#### 狀態顯示配置

```typescript
// src/lib/document-status.ts
export const DOCUMENT_STATUS_CONFIG = {
  UPLOADING: {
    label: '上傳中',
    icon: 'upload',
    color: 'blue',
    isProcessing: true,
  },
  UPLOADED: {
    label: '已上傳',
    icon: 'check',
    color: 'green',
    isProcessing: false,
  },
  OCR_PROCESSING: {
    label: 'OCR 處理中',
    icon: 'scan',
    color: 'blue',
    isProcessing: true,
  },
  OCR_COMPLETED: {
    label: 'OCR 完成',
    icon: 'check',
    color: 'green',
    isProcessing: false,
  },
  OCR_FAILED: {
    label: 'OCR 失敗',
    icon: 'alert-circle',
    color: 'red',
    isError: true,
  },
  MAPPING_PROCESSING: {
    label: '映射中',
    icon: 'git-merge',
    color: 'blue',
    isProcessing: true,
  },
  MAPPING_COMPLETED: {
    label: '映射完成',
    icon: 'check',
    color: 'green',
    isProcessing: false,
  },
  PENDING_REVIEW: {
    label: '待審核',
    icon: 'clock',
    color: 'yellow',
    isProcessing: false,
  },
  IN_REVIEW: {
    label: '審核中',
    icon: 'eye',
    color: 'blue',
    isProcessing: true,
  },
  COMPLETED: {
    label: '已完成',
    icon: 'check-circle',
    color: 'green',
    isProcessing: false,
  },
  FAILED: {
    label: '處理失敗',
    icon: 'x-circle',
    color: 'red',
    isError: true,
  },
} as const
```

#### ProcessingStatus 組件

```typescript
// src/components/features/invoice/ProcessingStatus.tsx
import { DOCUMENT_STATUS_CONFIG } from '@/lib/document-status'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'

interface ProcessingStatusProps {
  status: keyof typeof DOCUMENT_STATUS_CONFIG
  showLabel?: boolean
}

export function ProcessingStatus({ status, showLabel = true }: ProcessingStatusProps) {
  const config = DOCUMENT_STATUS_CONFIG[status]
  const Icon = getIcon(config.icon)

  return (
    <div className="flex items-center gap-2">
      {config.isProcessing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Icon className={`h-4 w-4 text-${config.color}-500`} />
      )}
      {showLabel && (
        <Badge variant={config.isError ? 'destructive' : 'secondary'}>
          {config.label}
        </Badge>
      )}
    </div>
  )
}
```

#### React Query Hook

```typescript
// src/hooks/useDocuments.ts
import { useQuery } from '@tanstack/react-query'

interface UseDocumentsParams {
  page?: number
  status?: string
  search?: string
}

export function useDocuments(params: UseDocumentsParams = {}) {
  return useQuery({
    queryKey: ['documents', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value) searchParams.set(key, String(value))
      })
      const response = await fetch(`/api/documents?${searchParams}`)
      return response.json()
    },
    // 處理中的文件更頻繁更新
    refetchInterval: (data) => {
      const hasProcessing = data?.data?.some((doc: any) =>
        DOCUMENT_STATUS_CONFIG[doc.status]?.isProcessing
      )
      return hasProcessing ? 5000 : 30000
    },
  })
}
```

#### 重試 API

```typescript
// POST /api/documents/[id]/retry
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const document = await prisma.document.findUnique({
    where: { id: params.id },
  })

  if (!document) {
    return Response.json({ success: false, error: 'Document not found' }, { status: 404 })
  }

  // 重置狀態
  await prisma.document.update({
    where: { id: params.id },
    data: {
      status: 'UPLOADED',
      processingPath: null,
      routingDecision: null,
    },
  })

  // 觸發重新處理
  await triggerProcessing(params.id)

  return Response.json({ success: true })
}
```

#### 文件列表 API

```typescript
// GET /api/documents
interface DocumentListResponse {
  success: true
  data: {
    id: string
    fileName: string
    fileType: string
    status: DocumentStatus
    processingPath: ProcessingPath | null
    overallConfidence: number | null
    createdAt: string
    updatedAt: string
  }[]
  meta: {
    total: number
    page: number
    pageSize: number
  }
}
```

### Testing Requirements

| 驗證項目 | 預期結果 |
|---------|---------|
| 狀態顯示 | 各狀態正確顯示圖標和文字 |
| 即時更新 | 處理中文件自動更新狀態 |
| 錯誤顯示 | 失敗狀態顯示錯誤原因 |
| 重試功能 | 重試後重新開始處理 |

### References

- [Source: docs/03-epics/sections/epic-2-manual-invoice-upload-ai-processing.md#story-27]
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR1,FR4,FR5,FR6,FR7,FR8]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 2.7 |
| Story Key | 2-7-processing-status-tracking-display |
| Epic | Epic 2: 手動發票上傳與 AI 處理 |
| FR Coverage | FR1, FR4, FR5, FR6, FR7, FR8 (整合) |
| Dependencies | Story 2.1 ~ 2.6 |

---

*Story created: 2025-12-16*
*Status: ready-for-dev*
