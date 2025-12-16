# Story 3.4: 確認提取結果

**Status:** ready-for-dev

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

- [ ] **Task 1: 確認按鈕組件** (AC: #1, #2)
  - [ ] 1.1 創建確認按鈕 UI
  - [ ] 1.2 實現確認前驗證
  - [ ] 1.3 顯示確認進度

- [ ] **Task 2: 確認 API** (AC: #2)
  - [ ] 2.1 創建 POST `/api/review/[id]/approve`
  - [ ] 2.2 更新 Document 和 ProcessingQueue 狀態
  - [ ] 2.3 記錄審計日誌

- [ ] **Task 3: 快速確認模式** (AC: #3)
  - [ ] 3.1 判斷處理路徑類型
  - [ ] 3.2 篩選低信心度欄位
  - [ ] 3.3 實現全部確認按鈕

- [ ] **Task 4: 審核記錄** (AC: #2)
  - [ ] 4.1 創建 ReviewRecord 模型
  - [ ] 4.2 記錄審核人和時間
  - [ ] 4.3 記錄審核動作類型

- [ ] **Task 5: 返回列表邏輯** (AC: #2)
  - [ ] 5.1 確認後重導向
  - [ ] 5.2 顯示成功訊息
  - [ ] 5.3 刷新列表數據

- [ ] **Task 6: 驗證與測試** (AC: #1-3)
  - [ ] 6.1 測試確認流程
  - [ ] 6.2 測試快速確認模式
  - [ ] 6.3 測試審計記錄

---

## Dev Notes

### 依賴項

- **Story 3.3**: 信心度顯示

### Architecture Compliance

```typescript
// POST /api/review/[id]/approve
interface ApproveRequest {
  confirmedFields?: string[]  // 快速確認時指定欄位
}

interface ApproveResponse {
  success: true
  data: {
    documentId: string
    status: 'COMPLETED'
    reviewedBy: string
    reviewedAt: string
  }
}
```

```prisma
model ReviewRecord {
  id          String   @id @default(uuid())
  documentId  String   @map("document_id")
  reviewerId  String   @map("reviewer_id")
  action      ReviewAction
  notes       String?
  createdAt   DateTime @default(now()) @map("created_at")

  document Document @relation(fields: [documentId], references: [id])
  reviewer User     @relation(fields: [reviewerId], references: [id])

  @@map("review_records")
}

enum ReviewAction {
  APPROVED
  CORRECTED
  ESCALATED
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
*Status: ready-for-dev*
