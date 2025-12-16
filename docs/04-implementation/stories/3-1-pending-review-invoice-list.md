# Story 3.1: 待審核發票列表

**Status:** ready-for-dev

---

## Story

**As a** 數據處理員,
**I want** 查看分配給我的待審核發票列表,
**So that** 我可以有效地安排審核工作。

---

## Acceptance Criteria

### AC1: 待審核列表顯示

**Given** 數據處理員已登入
**When** 導航至「待審核」頁面
**Then** 系統顯示分配給該用戶的待審核發票列表
**And** 列表包含：文件名、Forwarder、上傳時間、整體信心度、處理路徑
**And** 列表按上傳時間排序（最舊優先）

### AC2: 篩選功能

**Given** 待審核列表
**When** 篩選條件變更
**Then** 支援按 Forwarder、信心度範圍、處理路徑篩選

### AC3: 進入審核詳情

**Given** 待審核列表
**When** 點擊某筆發票
**Then** 進入該發票的審核詳情頁面

---

## Tasks / Subtasks

- [ ] **Task 1: 待審核頁面** (AC: #1, #3)
  - [ ] 1.1 創建 `src/app/(dashboard)/review/page.tsx`
  - [ ] 1.2 實現待審核列表表格
  - [ ] 1.3 顯示信心度 Badge
  - [ ] 1.4 顯示處理路徑標籤

- [ ] **Task 2: 待審核列表 API** (AC: #1, #2)
  - [ ] 2.1 創建 GET `/api/review/route.ts`
  - [ ] 2.2 查詢 ProcessingQueue 關聯 Document
  - [ ] 2.3 支援篩選參數
  - [ ] 2.4 按上傳時間排序

- [ ] **Task 3: 審核隊列組件** (AC: #1)
  - [ ] 3.1 創建 `ReviewQueue.tsx` 組件
  - [ ] 3.2 顯示列表欄位
  - [ ] 3.3 實現排序邏輯
  - [ ] 3.4 實現分頁

- [ ] **Task 4: 篩選組件** (AC: #2)
  - [ ] 4.1 創建 Forwarder 篩選下拉
  - [ ] 4.2 創建信心度範圍篩選
  - [ ] 4.3 創建處理路徑篩選
  - [ ] 4.4 組合篩選邏輯

- [ ] **Task 5: React Query Hook** (AC: #1, #2)
  - [ ] 5.1 創建 `useReviewQueue.ts`
  - [ ] 5.2 實現篩選參數處理
  - [ ] 5.3 配置自動刷新

- [ ] **Task 6: 驗證與測試** (AC: #1-3)
  - [ ] 6.1 測試列表顯示
  - [ ] 6.2 測試篩選功能
  - [ ] 6.3 測試點擊進入詳情

---

## Dev Notes

### 依賴項

- **Epic 2**: 文件處理流程、ProcessingQueue

### Architecture Compliance

```typescript
// GET /api/review
interface ReviewQueueResponse {
  success: true
  data: {
    id: string
    document: {
      id: string
      fileName: string
      createdAt: string
    }
    forwarder: { name: string } | null
    processingPath: ProcessingPath
    overallConfidence: number
    priority: number
    status: QueueStatus
  }[]
  meta: { total: number; page: number; pageSize: number }
}
```

### References

- [Source: docs/03-epics/sections/epic-3-invoice-review-correction-workflow.md#story-31]
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR9]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 3.1 |
| Story Key | 3-1-pending-review-invoice-list |
| Epic | Epic 3: 發票審核與修正工作流 |
| FR Coverage | FR9 |
| Dependencies | Epic 2 |

---

*Story created: 2025-12-16*
*Status: ready-for-dev*
