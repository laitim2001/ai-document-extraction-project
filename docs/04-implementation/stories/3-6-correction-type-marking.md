# Story 3.6: 修正類型標記

**Status:** ready-for-dev

---

## Story

**As a** 數據處理員,
**I want** 標記修正是「正常修正」或「特例不學習」,
**So that** 系統可以正確地進行規則學習。

---

## Acceptance Criteria

### AC1: 修正類型選擇

**Given** 用戶修正某個欄位
**When** 完成修正
**Then** 系統提示選擇修正類型：
- 正常修正：系統應學習此模式
- 特例不學習：此為特殊情況，不應影響規則

### AC2: 正常修正處理

**Given** 選擇「正常修正」
**When** 儲存修正
**Then** 系統記錄此修正供規則學習分析

### AC3: 特例修正處理

**Given** 選擇「特例不學習」
**When** 儲存修正
**Then** 系統標記此修正為特例
**And** 不納入規則學習統計

### AC4: 觸發規則升級建議

**Given** 同一欄位被標記為「正常修正」達 3 次
**When** 系統分析修正模式
**Then** 觸發規則升級建議流程（Epic 4）

---

## Tasks / Subtasks

- [ ] **Task 1: 修正類型選擇 UI** (AC: #1)
  - [ ] 1.1 創建類型選擇對話框
  - [ ] 1.2 說明兩種類型的差異
  - [ ] 1.3 記住用戶上次選擇

- [ ] **Task 2: 正常修正處理** (AC: #2)
  - [ ] 2.1 標記 correctionType 為 NORMAL
  - [ ] 2.2 記錄修正模式
  - [ ] 2.3 更新學習統計

- [ ] **Task 3: 特例修正處理** (AC: #3)
  - [ ] 3.1 標記 correctionType 為 EXCEPTION
  - [ ] 3.2 可選填特例原因
  - [ ] 3.3 排除學習統計

- [ ] **Task 4: 修正計數邏輯** (AC: #4)
  - [ ] 4.1 追蹤同一欄位+Forwarder 的修正次數
  - [ ] 4.2 達到閾值時觸發通知
  - [ ] 4.3 創建規則建議記錄

- [ ] **Task 5: 規則建議 API** (AC: #4)
  - [ ] 5.1 創建 RuleSuggestion 模型
  - [ ] 5.2 實現觸發邏輯
  - [ ] 5.3 通知 Super User

- [ ] **Task 6: 驗證與測試** (AC: #1-4)
  - [ ] 6.1 測試類型選擇
  - [ ] 6.2 測試學習統計
  - [ ] 6.3 測試規則建議觸發

---

## Dev Notes

### 依賴項

- **Story 3.5**: 修正功能

### Architecture Compliance

```prisma
model RuleSuggestion {
  id            String   @id @default(uuid())
  forwarderId   String   @map("forwarder_id")
  fieldName     String   @map("field_name")
  suggestedPattern String @map("suggested_pattern")
  correctionCount Int    @map("correction_count")
  status        SuggestionStatus @default(PENDING)
  createdAt     DateTime @default(now()) @map("created_at")
  reviewedAt    DateTime? @map("reviewed_at")
  reviewedBy    String?  @map("reviewed_by")

  forwarder Forwarder @relation(fields: [forwarderId], references: [id])

  @@index([forwarderId, fieldName])
  @@map("rule_suggestions")
}

enum SuggestionStatus {
  PENDING
  APPROVED
  REJECTED
  MERGED
}
```

```typescript
// 修正計數觸發邏輯
async function checkCorrectionThreshold(
  forwarderId: string,
  fieldName: string
) {
  const count = await prisma.correction.count({
    where: {
      document: { forwarderId },
      fieldName,
      correctionType: 'NORMAL',
      createdAt: { gte: last30Days },
    },
  })

  if (count >= 3) {
    await createRuleSuggestion(forwarderId, fieldName)
  }
}
```

### References

- [Source: docs/03-epics/sections/epic-3-invoice-review-correction-workflow.md#story-36]
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR13]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 3.6 |
| Story Key | 3-6-correction-type-marking |
| Epic | Epic 3: 發票審核與修正工作流 |
| FR Coverage | FR13 |
| Dependencies | Story 3.5 |

---

*Story created: 2025-12-16*
*Status: ready-for-dev*
