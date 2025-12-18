# Story 2.6: 處理路徑自動分流

**Status:** done

---

## Story

**As a** 系統,
**I want** 根據信心度自動分流處理路徑,
**So that** 高信心度的發票可以自動處理，低信心度的需要人工審核。

---

## Acceptance Criteria

### AC1: 自動通過路徑

**Given** 信心度評分完成
**When** 整體信心度 >= 95%
**Then** 文件分流至「自動通過」路徑
**And** 無需人工審核直接完成

### AC2: 快速確認路徑

**Given** 信心度評分完成
**When** 整體信心度在 80-94% 之間
**Then** 文件分流至「快速確認」路徑
**And** 僅需確認低信心度欄位

### AC3: 完整審核路徑

**Given** 信心度評分完成
**When** 整體信心度 < 80%
**Then** 文件分流至「完整審核」路徑
**And** 需要逐欄檢查和修正

### AC4: 分流記錄

**Given** 分流完成
**When** 更新文件狀態
**Then** 記錄分流決策和原因
**And** 通知相關審核人員（如需要）

---

## Tasks / Subtasks

- [x] **Task 1: 分流邏輯模組** (AC: #1, #2, #3)
  - [x] 1.1 創建 `src/lib/routing/router.ts`
  - [x] 1.2 實現分流決策邏輯
  - [x] 1.3 定義處理路徑枚舉
  - [x] 1.4 記錄分流原因

- [x] **Task 2: ProcessingQueue 資料表** (AC: #2, #3, #4)
  - [x] 2.1 創建 ProcessingQueue Prisma 模型
  - [x] 2.2 定義欄位（documentId, processingPath, assignedTo, priority）
  - [x] 2.3 執行 Prisma 遷移

- [x] **Task 3: Document 狀態更新** (AC: #1, #2, #3)
  - [x] 3.1 在 Document 模型加入 processingPath 欄位
  - [x] 3.2 更新狀態流轉邏輯
  - [x] 3.3 記錄狀態變更歷史

- [x] **Task 4: 自動通過處理** (AC: #1)
  - [x] 4.1 實現自動完成邏輯
  - [x] 4.2 創建最終提取記錄
  - [x] 4.3 標記為已完成

- [x] **Task 5: 審核隊列管理** (AC: #2, #3)
  - [x] 5.1 創建待審核隊列視圖
  - [x] 5.2 實現隊列優先級排序
  - [x] 5.3 支援分配給特定審核人員

- [x] **Task 6: 分流 API** (AC: #1, #2, #3, #4)
  - [x] 6.1 創建 POST `/api/routing/route.ts`
  - [x] 6.2 接收信心度後執行分流
  - [x] 6.3 返回分流結果

- [ ] **Task 7: 通知服務** (AC: #4) - Deferred to Epic 3
  - [ ] 7.1 實現審核任務通知
  - [ ] 7.2 支援即時通知（WebSocket 或輪詢）
  - [ ] 7.3 記錄通知狀態

- [x] **Task 8: 分流配置** (AC: #1, #2, #3)
  - [x] 8.1 閾值可配置化
  - [x] 8.2 支援管理員調整
  - [x] 8.3 記錄配置變更

- [x] **Task 9: 驗證與測試** (AC: #1-4)
  - [x] 9.1 測試 >=95% 自動通過
  - [x] 9.2 測試 80-94% 快速確認
  - [x] 9.3 測試 <80% 完整審核
  - [x] 9.4 測試分流記錄

---

## Dev Notes

### 依賴項

- **Story 2.5**: 信心度評分結果

### Architecture Compliance

#### Prisma Schema 更新

```prisma
// 更新 Document 模型
model Document {
  // ... 現有欄位
  processingPath ProcessingPath? @map("processing_path")
  routingDecision Json?          @map("routing_decision")
  // routingDecision: { path, reason, confidence, decidedAt }
}

enum ProcessingPath {
  AUTO_APPROVE     // >= 95%
  QUICK_REVIEW     // 80-94%
  FULL_REVIEW      // < 80%
  MANUAL_REQUIRED  // 特殊情況
}

model ProcessingQueue {
  id            String         @id @default(uuid())
  documentId    String         @unique @map("document_id")
  processingPath ProcessingPath @map("processing_path")
  priority      Int            @default(0)  // 數字越大越優先
  assignedTo    String?        @map("assigned_to")
  status        QueueStatus    @default(PENDING)
  enteredAt     DateTime       @default(now()) @map("entered_at")
  startedAt     DateTime?      @map("started_at")
  completedAt   DateTime?      @map("completed_at")

  document Document @relation(fields: [documentId], references: [id])
  assignee User?    @relation(fields: [assignedTo], references: [id])

  @@index([processingPath, status])
  @@index([assignedTo])
  @@map("processing_queues")
}

enum QueueStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  SKIPPED
}
```

#### 分流邏輯模組

```typescript
// src/lib/routing/router.ts
import { ROUTING_THRESHOLDS } from '@/lib/confidence/thresholds'

export type ProcessingPath = 'AUTO_APPROVE' | 'QUICK_REVIEW' | 'FULL_REVIEW'

interface RoutingDecision {
  path: ProcessingPath
  reason: string
  confidence: number
  lowConfidenceFields: string[]
  decidedAt: Date
}

export function determineProcessingPath(
  overallConfidence: number,
  fieldConfidences: Record<string, number>
): RoutingDecision {
  const lowConfidenceFields = Object.entries(fieldConfidences)
    .filter(([_, score]) => score < ROUTING_THRESHOLDS.quickReview)
    .map(([field]) => field)

  let path: ProcessingPath
  let reason: string

  if (overallConfidence >= ROUTING_THRESHOLDS.autoApprove) {
    path = 'AUTO_APPROVE'
    reason = `整體信心度 ${overallConfidence.toFixed(1)}% >= ${ROUTING_THRESHOLDS.autoApprove}%，自動通過`
  } else if (overallConfidence >= ROUTING_THRESHOLDS.quickReview) {
    path = 'QUICK_REVIEW'
    reason = `整體信心度 ${overallConfidence.toFixed(1)}%，需快速確認 ${lowConfidenceFields.length} 個低信心度欄位`
  } else {
    path = 'FULL_REVIEW'
    reason = `整體信心度 ${overallConfidence.toFixed(1)}% < ${ROUTING_THRESHOLDS.quickReview}%，需完整審核`
  }

  return {
    path,
    reason,
    confidence: overallConfidence,
    lowConfidenceFields,
    decidedAt: new Date(),
  }
}
```

#### 分流 API

```typescript
// src/app/api/routing/route.ts
import { determineProcessingPath } from '@/lib/routing/router'

export async function POST(request: Request) {
  const { documentId, overallConfidence, fieldConfidences } = await request.json()

  const decision = determineProcessingPath(overallConfidence, fieldConfidences)

  // 更新 Document
  await prisma.document.update({
    where: { id: documentId },
    data: {
      processingPath: decision.path,
      routingDecision: decision,
      status: decision.path === 'AUTO_APPROVE' ? 'COMPLETED' : 'PENDING_REVIEW',
    },
  })

  // 如果需要審核，加入隊列
  if (decision.path !== 'AUTO_APPROVE') {
    await prisma.processingQueue.create({
      data: {
        documentId,
        processingPath: decision.path,
        priority: decision.path === 'FULL_REVIEW' ? 0 : 1, // 快速確認優先
      },
    })
  }

  return Response.json({
    success: true,
    data: decision,
  })
}
```

#### 自動通過處理

```typescript
// src/services/routing.service.ts
export async function handleAutoApprove(documentId: string) {
  // 創建最終提取記錄
  const extraction = await prisma.extractionResult.findFirst({
    where: { documentId },
    orderBy: { createdAt: 'desc' },
  })

  // 將提取結果標記為最終版本
  await prisma.extractionResult.update({
    where: { id: extraction.id },
    data: { status: 'APPROVED' },
  })

  // 更新文件狀態
  await prisma.document.update({
    where: { id: documentId },
    data: { status: 'COMPLETED' },
  })

  // 記錄審計日誌
  await logAudit({
    entityType: 'DOCUMENT',
    entityId: documentId,
    action: 'AUTO_APPROVED',
    performedBy: 'SYSTEM',
  })
}
```

### Testing Requirements

| 驗證項目 | 預期結果 |
|---------|---------|
| >= 95% | 自動通過，狀態為 COMPLETED |
| 80-94% | 進入快速確認隊列 |
| < 80% | 進入完整審核隊列 |
| 分流記錄 | 正確記錄決策和原因 |

### References

- [Source: docs/03-epics/sections/epic-2-manual-invoice-upload-ai-processing.md#story-26]
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR8]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 2.6 |
| Story Key | 2-6-processing-path-auto-routing |
| Epic | Epic 2: 手動發票上傳與 AI 處理 |
| FR Coverage | FR8 |
| Dependencies | Story 2.5 |

---

## Implementation Notes (2025-12-18)

### Files Created/Modified

#### Database Schema
- `prisma/schema.prisma` - Added `QueueStatus` enum and `ProcessingQueue` model
- Migration: `add_processing_queue`

#### Types
- `src/types/routing.ts` - Routing types, RoutingDecision, ProcessingQueueItem, QueueStats

#### Configuration
- `src/lib/routing/config.ts` - ROUTING_CONFIG, PROCESSING_PATH_CONFIG, QUEUE_PRIORITY
- `src/lib/routing/index.ts` - Module exports

#### Router Logic
- `src/lib/routing/router.ts` - Core routing logic with:
  - `determineProcessingPath()` - Main routing decision function
  - `calculateQueuePriority()` - Priority calculation
  - `shouldAutoApprove()` - Quick auto-approve check
  - `getFieldsForReview()` - Get fields requiring review
  - `estimateReviewTime()` - Review time estimation
  - `isValidRoutingDecision()` - Decision validation

#### Service
- `src/services/routing.service.ts` - Routing service with:
  - `routeDocument()` - Complete routing flow
  - `handleAutoApprove()` - Auto-approve completion
  - `getProcessingQueue()` - Queue queries
  - `assignToReviewer()` - Reviewer assignment
  - `completeReview()` - Review completion
  - `cancelQueueItem()` - Queue item cancellation
  - `getQueueStats()` - Queue statistics
  - `batchRouteDocuments()` - Batch routing

#### API Endpoints
- `src/app/api/routing/route.ts` - POST /api/routing (single/batch routing)
- `src/app/api/routing/queue/route.ts` - GET /api/routing/queue
- `src/app/api/routing/queue/[id]/assign/route.ts` - POST /api/routing/queue/[id]/assign

### Routing Thresholds
| Path | Threshold | Review Scope |
|------|-----------|--------------|
| AUTO_APPROVE | ≥95% | None |
| QUICK_REVIEW | 80-94% | Low-confidence fields |
| FULL_REVIEW | <80% | All fields |
| MANUAL_REQUIRED | ≥3 critical fields low | All fields |

### Deferred Tasks
- Task 7 (Notification Service) deferred to Epic 3 - Review Workflow

---

*Story created: 2025-12-16*
*Status: done*
*Completed: 2025-12-18*
