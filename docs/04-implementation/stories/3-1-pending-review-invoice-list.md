# Story 3.1: 待審核發票列表

**Status:** done

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

- [x] **Task 1: 待審核頁面** (AC: #1, #3)
  - [x] 1.1 創建 `src/app/(dashboard)/review/page.tsx`
  - [x] 1.2 實現待審核列表表格
  - [x] 1.3 顯示信心度 Badge
  - [x] 1.4 顯示處理路徑標籤

- [x] **Task 2: 待審核列表 API** (AC: #1, #2)
  - [x] 2.1 創建 GET `/api/review/route.ts`
  - [x] 2.2 查詢 ProcessingQueue 關聯 Document
  - [x] 2.3 支援篩選參數
  - [x] 2.4 按上傳時間排序

- [x] **Task 3: 審核隊列組件** (AC: #1)
  - [x] 3.1 創建 `ReviewQueue.tsx` 組件
  - [x] 3.2 顯示列表欄位
  - [x] 3.3 實現排序邏輯
  - [x] 3.4 實現分頁

- [x] **Task 4: 篩選組件** (AC: #2)
  - [x] 4.1 創建 Forwarder 篩選下拉
  - [x] 4.2 創建信心度範圍篩選
  - [x] 4.3 創建處理路徑篩選
  - [x] 4.4 組合篩選邏輯

- [x] **Task 5: React Query Hook** (AC: #1, #2)
  - [x] 5.1 創建 `useReviewQueue.ts`
  - [x] 5.2 實現篩選參數處理
  - [x] 5.3 配置自動刷新

- [x] **Task 6: 驗證與測試** (AC: #1-3)
  - [x] 6.1 測試列表顯示
  - [x] 6.2 測試篩選功能
  - [x] 6.3 測試點擊進入詳情

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

## Implementation Notes

### 實現日期
2025-12-18

### 建立的檔案

| 檔案路徑 | 說明 |
|---------|------|
| `src/types/review.ts` | 審核隊列類型定義（ReviewQueueItem, ReviewQueueFilters, ReviewQueueResponse） |
| `src/app/api/review/route.ts` | 審核隊列 API 端點（GET /api/review） |
| `src/hooks/useReviewQueue.ts` | React Query hooks（useReviewQueue, usePrefetchNextPage, useRefreshReviewQueue） |
| `src/components/features/review/ConfidenceBadge.tsx` | 信心度 Badge 組件（三級顏色編碼） |
| `src/components/features/review/ProcessingPathBadge.tsx` | 處理路徑 Badge 組件 |
| `src/components/features/review/ReviewFilters.tsx` | 篩選組件（Forwarder、處理路徑、信心度範圍） |
| `src/components/features/review/ReviewQueue.tsx` | 審核隊列主容器組件 |
| `src/components/features/review/ReviewQueueTable.tsx` | 審核隊列表格組件 |
| `src/components/features/review/ReviewQueueSkeleton.tsx` | 載入骨架屏組件 |
| `src/components/features/review/index.ts` | 組件統一導出 |
| `src/app/(dashboard)/review/page.tsx` | 審核列表頁面 |

### 關鍵實現決策

1. **信心度查詢策略**
   - ProcessingQueue 模型本身不包含 overallConfidence
   - 透過 JOIN ExtractionResult 獲取 confidenceScores JSON 欄位
   - 信心度範圍篩選在應用層進行（因 JSON 欄位無法在 Prisma 直接篩選）

2. **信心度數據來源優先級**
   - 優先使用 `extractionResult.confidenceScores.overallScore`
   - 回退到 `extractionResult.averageConfidence`

3. **篩選組件實現**
   - 使用 number inputs 替代 Slider 組件（shadcn Slider 安裝失敗）
   - 支援 Forwarder、處理路徑、信心度範圍篩選

4. **URL 狀態同步**
   - 篩選條件同步到 URL 查詢參數
   - 支援書籤和分享功能

5. **自動刷新機制**
   - staleTime: 30 秒
   - refetchInterval: 60 秒
   - refetchOnWindowFocus: true

### 驗證結果

```bash
# TypeScript 類型檢查
npm run type-check
# 結果: 通過 ✅

# ESLint 檢查
npm run lint
# 結果: 通過 ✅（僅有既存 use-toast.ts 警告）
```

---

*Story created: 2025-12-16*
*Story completed: 2025-12-18*
*Status: done*
