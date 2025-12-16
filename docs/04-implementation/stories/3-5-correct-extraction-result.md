# Story 3.5: 修正提取結果

**Status:** ready-for-dev

---

## Story

**As a** 數據處理員,
**I want** 修正錯誤的提取值,
**So that** 最終數據的準確性得到保證。

---

## Acceptance Criteria

### AC1: 欄位編輯

**Given** 用戶發現某欄位提取錯誤
**When** 點擊該欄位
**Then** 欄位變為可編輯狀態

### AC2: 即時驗證

**Given** 修改欄位值
**When** 輸入新值
**Then** 系統即時驗證格式（日期、數字、必填等）
**And** 顯示驗證結果

### AC3: 儲存修正

**Given** 完成修改
**When** 點擊「儲存修正」
**Then** 系統儲存修正後的值
**And** 記錄原始值和修正值
**And** 記錄修正人和時間

### AC4: 未儲存提示

**Given** 修改多個欄位
**When** 離開頁面前未儲存
**Then** 系統提示「有未儲存的修改，是否離開？」

---

## Tasks / Subtasks

- [ ] **Task 1: 可編輯欄位組件** (AC: #1)
  - [ ] 1.1 創建 `FieldEditor.tsx` 組件
  - [ ] 1.2 實現點擊切換編輯模式
  - [ ] 1.3 支援不同欄位類型輸入

- [ ] **Task 2: 即時驗證** (AC: #2)
  - [ ] 2.1 定義欄位驗證規則
  - [ ] 2.2 實現即時驗證邏輯
  - [ ] 2.3 顯示驗證錯誤訊息

- [ ] **Task 3: 修正記錄模型** (AC: #3)
  - [ ] 3.1 創建 Correction Prisma 模型
  - [ ] 3.2 記錄原始值和修正值
  - [ ] 3.3 記錄修正人和時間

- [ ] **Task 4: 儲存修正 API** (AC: #3)
  - [ ] 4.1 創建 PATCH `/api/review/[id]/correct`
  - [ ] 4.2 更新 ExtractionResult
  - [ ] 4.3 創建 Correction 記錄

- [ ] **Task 5: 未儲存提示** (AC: #4)
  - [ ] 5.1 追蹤修改狀態
  - [ ] 5.2 實現離開頁面攔截
  - [ ] 5.3 顯示確認對話框

- [ ] **Task 6: 表單狀態管理** (AC: #1, #3, #4)
  - [ ] 6.1 使用 React Hook Form
  - [ ] 6.2 追蹤 dirty fields
  - [ ] 6.3 實現批量儲存

- [ ] **Task 7: 驗證與測試** (AC: #1-4)
  - [ ] 7.1 測試欄位編輯
  - [ ] 7.2 測試即時驗證
  - [ ] 7.3 測試修正記錄
  - [ ] 7.4 測試未儲存提示

---

## Dev Notes

### 依賴項

- **Story 3.4**: 確認功能

### Architecture Compliance

```prisma
model Correction {
  id              String   @id @default(uuid())
  documentId      String   @map("document_id")
  fieldName       String   @map("field_name")
  originalValue   String?  @map("original_value")
  correctedValue  String   @map("corrected_value")
  correctionType  CorrectionType @map("correction_type")
  correctedBy     String   @map("corrected_by")
  createdAt       DateTime @default(now()) @map("created_at")

  document Document @relation(fields: [documentId], references: [id])
  corrector User    @relation(fields: [correctedBy], references: [id])

  @@index([documentId])
  @@map("corrections")
}

enum CorrectionType {
  NORMAL      // 正常修正，系統應學習
  EXCEPTION   // 特例，不學習
}
```

```typescript
// PATCH /api/review/[id]/correct
interface CorrectionRequest {
  corrections: {
    fieldName: string
    originalValue: string | null
    correctedValue: string
    correctionType: 'NORMAL' | 'EXCEPTION'
  }[]
}
```

### References

- [Source: docs/03-epics/sections/epic-3-invoice-review-correction-workflow.md#story-35]
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR12]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 3.5 |
| Story Key | 3-5-correct-extraction-result |
| Epic | Epic 3: 發票審核與修正工作流 |
| FR Coverage | FR12 |
| Dependencies | Story 3.4 |

---

*Story created: 2025-12-16*
*Status: ready-for-dev*
