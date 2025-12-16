# Story 3.8: Super User 處理升級案例

**Status:** ready-for-dev

---

## Story

**As a** Super User,
**I want** 處理數據處理員升級的複雜案例,
**So that** 特殊情況可以得到正確處理。

---

## Acceptance Criteria

### AC1: 升級案例列表

**Given** Super User 已登入
**When** 導航至「升級案例」頁面
**Then** 系統顯示所有待處理的升級案例
**And** 包含：升級人、升級時間、升級原因、原始審核進度

### AC2: 查看案例詳情

**Given** Super User 查看升級案例
**When** 進入案例詳情
**Then** 可以看到完整的審核界面
**And** 可以看到升級原因和數據處理員的備註

### AC3: 完成處理

**Given** Super User 完成處理
**When** 提交處理結果
**Then** 文件狀態更新為「已審核」
**And** 記錄 Super User 的處理決策
**And** 可選擇是否創建新規則

### AC4: 創建規則建議

**Given** Super User 處理案例
**When** 發現需要新增映射規則
**Then** 可以直接創建規則建議（連結到 Epic 4）

---

## Tasks / Subtasks

- [ ] **Task 1: 升級案例頁面** (AC: #1)
  - [ ] 1.1 創建 `src/app/(dashboard)/escalations/page.tsx`
  - [ ] 1.2 顯示升級案例列表
  - [ ] 1.3 顯示升級詳情摘要
  - [ ] 1.4 支援篩選和排序

- [ ] **Task 2: 升級案例 API** (AC: #1)
  - [ ] 2.1 創建 GET `/api/escalations`
  - [ ] 2.2 查詢待處理案例
  - [ ] 2.3 關聯升級人和文件資訊

- [ ] **Task 3: 案例詳情頁面** (AC: #2)
  - [ ] 3.1 創建 `src/app/(dashboard)/escalations/[id]/page.tsx`
  - [ ] 3.2 顯示完整審核界面
  - [ ] 3.3 顯示升級原因和備註

- [ ] **Task 4: 處理完成 API** (AC: #3)
  - [ ] 4.1 創建 POST `/api/escalations/[id]/resolve`
  - [ ] 4.2 更新 Escalation 狀態
  - [ ] 4.3 更新 Document 狀態
  - [ ] 4.4 記錄處理決策

- [ ] **Task 5: 處理決策記錄** (AC: #3)
  - [ ] 5.1 記錄處理方式
  - [ ] 5.2 記錄修正內容
  - [ ] 5.3 記錄處理時間

- [ ] **Task 6: 創建規則建議** (AC: #4)
  - [ ] 6.1 在處理界面加入「創建規則」按鈕
  - [ ] 6.2 連結到 RuleSuggestion 創建
  - [ ] 6.3 預填相關資訊

- [ ] **Task 7: 權限控制** (AC: #1)
  - [ ] 7.1 僅 Super User 可訪問
  - [ ] 7.2 驗證用戶角色
  - [ ] 7.3 隱藏無權限功能

- [ ] **Task 8: 驗證與測試** (AC: #1-4)
  - [ ] 8.1 測試列表顯示
  - [ ] 8.2 測試詳情查看
  - [ ] 8.3 測試處理完成
  - [ ] 8.4 測試規則創建

---

## Dev Notes

### 依賴項

- **Story 3.7**: 升級功能

### Architecture Compliance

```typescript
// GET /api/escalations
interface EscalationsResponse {
  success: true
  data: {
    id: string
    document: {
      id: string
      fileName: string
      forwarder: { name: string } | null
    }
    escalatedBy: { name: string }
    reason: EscalationReason
    reasonDetail: string | null
    status: EscalationStatus
    createdAt: string
  }[]
}

// POST /api/escalations/[id]/resolve
interface ResolveRequest {
  decision: 'APPROVED' | 'CORRECTED' | 'REJECTED'
  corrections?: CorrectionInput[]
  notes?: string
  createRule?: {
    fieldName: string
    suggestedPattern: string
  }
}
```

```typescript
// src/app/(dashboard)/escalations/[id]/page.tsx
export default async function EscalationDetailPage({ params }: { params: { id: string } }) {
  // 權限檢查
  const session = await auth()
  const isSuperUser = session?.user?.roles?.some(r =>
    r.permissions.includes(PERMISSIONS.RULE_MANAGE)
  )

  if (!isSuperUser) {
    redirect('/unauthorized')
  }

  const escalation = await getEscalation(params.id)

  return (
    <div>
      <EscalationHeader escalation={escalation} />
      <ReviewPanel
        document={escalation.document}
        showEscalationInfo
        onResolve={handleResolve}
      />
    </div>
  )
}
```

### References

- [Source: docs/03-epics/sections/epic-3-invoice-review-correction-workflow.md#story-38]
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR15]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 3.8 |
| Story Key | 3-8-super-user-handle-escalated-cases |
| Epic | Epic 3: 發票審核與修正工作流 |
| FR Coverage | FR15 |
| Dependencies | Story 3.7 |

---

*Story created: 2025-12-16*
*Status: ready-for-dev*
