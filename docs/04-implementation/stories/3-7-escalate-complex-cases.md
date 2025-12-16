# Story 3.7: 升級複雜案例

**Status:** ready-for-dev

---

## Story

**As a** 數據處理員,
**I want** 將無法處理的複雜案例升級給 Super User,
**So that** 專業人員可以處理特殊情況。

---

## Acceptance Criteria

### AC1: 升級按鈕

**Given** 用戶遇到無法判斷的情況
**When** 點擊「升級案例」按鈕
**Then** 系統顯示升級表單

### AC2: 提交升級請求

**Given** 填寫升級原因
**When** 提交升級請求
**Then** 文件狀態更新為「已升級」
**And** 指派給 Super User 隊列
**And** 通知相關 Super User

### AC3: 升級原因選擇

**Given** 升級表單
**When** 填寫內容
**Then** 必須選擇升級原因類型：
- 無法識別 Forwarder
- 映射規則不適用
- 文件品質問題
- 其他（需說明）

---

## Tasks / Subtasks

- [ ] **Task 1: 升級按鈕 UI** (AC: #1)
  - [ ] 1.1 在審核界面加入升級按鈕
  - [ ] 1.2 設計按鈕樣式和位置
  - [ ] 1.3 權限檢查

- [ ] **Task 2: 升級表單對話框** (AC: #1, #3)
  - [ ] 2.1 創建 `EscalationDialog.tsx`
  - [ ] 2.2 升級原因類型選擇
  - [ ] 2.3 備註輸入欄位
  - [ ] 2.4 表單驗證

- [ ] **Task 3: 升級 API** (AC: #2)
  - [ ] 3.1 創建 POST `/api/review/[id]/escalate`
  - [ ] 3.2 更新 Document 狀態
  - [ ] 3.3 創建 Escalation 記錄

- [ ] **Task 4: Escalation 模型** (AC: #2)
  - [ ] 4.1 創建 Prisma Escalation 模型
  - [ ] 4.2 定義升級原因枚舉
  - [ ] 4.3 記錄升級人和時間

- [ ] **Task 5: 通知 Super User** (AC: #2)
  - [ ] 5.1 查詢可用的 Super User
  - [ ] 5.2 創建通知記錄
  - [ ] 5.3 即時通知（如有 WebSocket）

- [ ] **Task 6: Super User 隊列** (AC: #2)
  - [ ] 6.1 更新 ProcessingQueue
  - [ ] 6.2 設置高優先級
  - [ ] 6.3 分配邏輯

- [ ] **Task 7: 驗證與測試** (AC: #1-3)
  - [ ] 7.1 測試升級流程
  - [ ] 7.2 測試通知發送
  - [ ] 7.3 測試狀態更新

---

## Dev Notes

### 依賴項

- **Story 3.5**: 審核功能

### Architecture Compliance

```prisma
model Escalation {
  id            String   @id @default(uuid())
  documentId    String   @unique @map("document_id")
  escalatedBy   String   @map("escalated_by")
  reason        EscalationReason
  reasonDetail  String?  @map("reason_detail")
  status        EscalationStatus @default(PENDING)
  assignedTo    String?  @map("assigned_to")
  createdAt     DateTime @default(now()) @map("created_at")
  resolvedAt    DateTime? @map("resolved_at")

  document  Document @relation(fields: [documentId], references: [id])
  escalator User     @relation("Escalator", fields: [escalatedBy], references: [id])
  assignee  User?    @relation("Assignee", fields: [assignedTo], references: [id])

  @@map("escalations")
}

enum EscalationReason {
  UNKNOWN_FORWARDER     // 無法識別 Forwarder
  RULE_NOT_APPLICABLE   // 映射規則不適用
  POOR_QUALITY          // 文件品質問題
  OTHER                 // 其他
}

enum EscalationStatus {
  PENDING
  IN_PROGRESS
  RESOLVED
  CANCELLED
}
```

```typescript
// POST /api/review/[id]/escalate
interface EscalateRequest {
  reason: EscalationReason
  reasonDetail?: string
}
```

### References

- [Source: docs/03-epics/sections/epic-3-invoice-review-correction-workflow.md#story-37]
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR14]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 3.7 |
| Story Key | 3-7-escalate-complex-cases |
| Epic | Epic 3: 發票審核與修正工作流 |
| FR Coverage | FR14 |
| Dependencies | Story 3.5 |

---

*Story created: 2025-12-16*
*Status: ready-for-dev*
