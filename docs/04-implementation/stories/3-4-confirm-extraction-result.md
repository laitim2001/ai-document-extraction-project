# Story 3.4: 確認提取結果

**Status:** done

---

## Story

**As a** 數據處理員,
**I want** 確認正確的提取結果,
**So that** 已驗證的數據可以進入下一步處理。

---

## Acceptance Criteria

### AC1: 確認無誤按鈕

**Given** 用戶審核完所有欄位
**When** 所有欄位無需修改
**Then** 可以點擊「確認無誤」按鈕

### AC2: 確認處理

**Given** 點擊「確認無誤」
**When** 系統處理確認
**Then** 文件狀態更新為「已審核」
**And** 記錄審核人、審核時間
**And** 返回待審核列表

### AC3: 快速確認模式

**Given** 快速確認路徑的發票
**When** 進入審核頁面
**Then** 僅顯示需要確認的低信心度欄位
**And** 提供「全部確認」快捷按鈕

---

## Tasks / Subtasks

- [x] **Task 1: 確認按鈕組件** (AC: #1, #2)
  - [x] 1.1 創建確認按鈕 UI
  - [x] 1.2 實現確認前驗證
  - [x] 1.3 顯示確認進度

- [x] **Task 2: 確認 API** (AC: #2)
  - [x] 2.1 創建 POST `/api/review/[id]/approve`
  - [x] 2.2 更新 Document 和 ProcessingQueue 狀態
  - [x] 2.3 記錄審計日誌

- [x] **Task 3: 快速確認模式** (AC: #3)
  - [x] 3.1 判斷處理路徑類型
  - [x] 3.2 篩選低信心度欄位
  - [x] 3.3 實現全部確認按鈕

- [x] **Task 4: 審核記錄** (AC: #2)
  - [x] 4.1 創建 ReviewRecord 模型
  - [x] 4.2 記錄審核人和時間
  - [x] 4.3 記錄審核動作類型

- [x] **Task 5: 返回列表邏輯** (AC: #2)
  - [x] 5.1 確認後重導向
  - [x] 5.2 顯示成功訊息
  - [x] 5.3 刷新列表數據

- [x] **Task 6: 驗證與測試** (AC: #1-3)
  - [x] 6.1 測試確認流程
  - [x] 6.2 測試快速確認模式
  - [x] 6.3 測試審計記錄

---

## Implementation Summary

### Completed: 2025-12-18

#### Files Created/Modified

1. **Database Layer**
   - `prisma/schema.prisma` - Added ReviewAction enum, ReviewRecord model, APPROVED status to DocumentStatus

2. **API Layer**
   - `src/app/api/review/[id]/approve/route.ts` - POST endpoint for document approval
   - `src/lib/audit/index.ts` - Unified audit logging utility

3. **Type Definitions**
   - `src/types/review.ts` - Added ReviewAction, ApproveRequest/Response types

4. **Hooks**
   - `src/hooks/useApproveReview.ts` - React Query mutation hook for approval

5. **Components**
   - `src/components/features/review/ApprovalConfirmDialog.tsx` - Confirmation dialog
   - `src/components/features/review/ReviewPanel/QuickReviewMode.tsx` - Quick review mode UI
   - `src/components/features/review/ReviewPanel/ReviewActions.tsx` - Updated with tooltips and processing path indicators

6. **Pages**
   - `src/app/(dashboard)/review/[id]/page.tsx` - Integrated approval flow

#### Key Features
- **Approve API**: Atomic transaction updating Document status, ProcessingQueue, creating ReviewRecord
- **Audit Logging**: 7-year compliance audit trail for all review actions
- **ApprovalConfirmDialog**: Optional notes input, field count display, processing path context
- **QuickReviewMode**: Shows only low/medium confidence fields, auto-approved high confidence fields expandable
- **Tooltips**: All action buttons have helpful tooltips explaining their function

---

## Dev Notes

### 依賴項

- **Story 3.3**: 信心度顯示

### Architecture Compliance

```typescript
// POST /api/review/[id]/approve
interface ApproveRequest {
  confirmedFields?: string[]  // 快速確認時指定欄位
  notes?: string              // 審核備註
  reviewStartedAt?: string    // 審核開始時間（計算時長）
}

interface ApproveResponse {
  success: true
  data: {
    documentId: string
    status: 'APPROVED'
    reviewedBy: string
    reviewedAt: string
    reviewRecordId: string
  }
}
```

```prisma
model ReviewRecord {
  id              String         @id @default(uuid())
  documentId      String         @map("document_id")
  reviewerId      String         @map("reviewer_id")
  action          ReviewAction   @default(APPROVED)
  processingPath  ProcessingPath @map("processing_path")
  confirmedFields String[]       @map("confirmed_fields")
  modifiedFields  Json?          @map("modified_fields")
  notes           String?        @db.Text
  reviewDuration  Int?           @map("review_duration")
  startedAt       DateTime?      @map("started_at")
  completedAt     DateTime       @default(now()) @map("completed_at")
  createdAt       DateTime       @default(now()) @map("created_at")

  document Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
  reviewer User     @relation(fields: [reviewerId], references: [id])

  @@index([documentId])
  @@index([reviewerId])
  @@index([action])
  @@index([completedAt])
  @@map("review_records")
}

enum ReviewAction {
  APPROVED   // 確認無誤
  CORRECTED  // 修正後確認
  ESCALATED  // 升級處理
}
```

### References

- [Source: docs/03-epics/sections/epic-3-invoice-review-correction-workflow.md#story-34]
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR11]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 3.4 |
| Story Key | 3-4-confirm-extraction-result |
| Epic | Epic 3: 發票審核與修正工作流 |
| FR Coverage | FR11 |
| Dependencies | Story 3.3 |

---

*Story created: 2025-12-16*
*Status: done*
*Completed: 2025-12-18*
