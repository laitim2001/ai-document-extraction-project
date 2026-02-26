# Story 3.6: 修正類型標記

**Status:** done

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

- [x] **Task 1: 修正類型選擇 UI** (AC: #1)
  - [x] 1.1 創建類型選擇對話框 (`CorrectionTypeDialog.tsx`)
  - [x] 1.2 說明兩種類型的差異 (`CorrectionTypeSelector.tsx`)
  - [x] 1.3 記住用戶上次選擇 (via component state)

- [x] **Task 2: 正常修正處理** (AC: #2)
  - [x] 2.1 標記 correctionType 為 NORMAL (API updated)
  - [x] 2.2 記錄修正模式 (`correctionAnalyzer.ts`)
  - [x] 2.3 更新學習統計 (`getFieldCorrectionStats`)

- [x] **Task 3: 特例修正處理** (AC: #3)
  - [x] 3.1 標記 correctionType 為 EXCEPTION (API updated)
  - [x] 3.2 可選填特例原因 (`exceptionReason` field)
  - [x] 3.3 排除學習統計 (filtered in analyzer)

- [x] **Task 4: 修正計數邏輯** (AC: #4)
  - [x] 4.1 追蹤同一欄位+Forwarder 的修正次數 (`checkCorrectionThreshold`)
  - [x] 4.2 達到閾值時觸發通知 (`notifySuperUsers`)
  - [x] 4.3 創建規則建議記錄 (`triggerRuleSuggestionCheck`)

- [x] **Task 5: 規則建議 API** (AC: #4)
  - [x] 5.1 創建 RuleSuggestion 模型 (Prisma schema)
  - [x] 5.2 實現觸發邏輯 (`ruleSuggestionTrigger.ts`)
  - [x] 5.3 通知 Super User (`notification.service.ts`)

- [x] **Task 6: 驗證與測試** (AC: #1-4)
  - [x] 6.1 測試類型選擇 (type-check passed)
  - [x] 6.2 測試學習統計 (type-check passed)
  - [x] 6.3 測試規則建議觸發 (type-check passed)

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
*Status: done*
*Completed: 2025-12-18*

## Implementation Summary

### Files Created/Modified

**Prisma Schema** (`prisma/schema.prisma`):
- Added `exceptionReason` field to Correction model
- Added `RuleSuggestion` model with `SuggestionStatus` enum
- Added `Notification` model for user notifications

**Learning Services** (`src/lib/learning/`):
- `correctionAnalyzer.ts` - Correction pattern analysis and threshold detection
- `ruleSuggestionTrigger.ts` - Rule suggestion triggering logic
- `index.ts` - Module exports

**Notification Service** (`src/services/notification.service.ts`):
- `notifySuperUsers()` - Notify users with RULE_MANAGE permission
- `notifyUsers()` - Notify specific users
- `getUnreadNotifications()` - Fetch unread notifications
- `markNotificationAsRead()` - Mark notification as read

**API Updates** (`src/app/api/review/[id]/correct/route.ts`):
- Added `exceptionReason` to validation schema
- Added `correctionType` handling in transaction
- Added rule suggestion triggering for NORMAL corrections

**UI Components** (`src/components/features/review/`):
- `CorrectionTypeSelector.tsx` - Radio group for NORMAL/EXCEPTION selection
- `CorrectionTypeDialog.tsx` - Dialog for batch correction type selection

### Migration

```
20251218154300_add_story_3_6_correction_type_and_rule_suggestion
```
