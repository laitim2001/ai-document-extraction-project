# Story 4.1: 映射規則列表與查看

**Status:** ready-for-dev

---

## Story

**As a** Super User,
**I want** 查看現有的映射規則,
**So that** 我可以了解系統的提取邏輯並進行管理。

---

## Acceptance Criteria

### AC1: 規則列表顯示

**Given** Super User 已登入
**When** 導航至「規則管理」頁面
**Then** 系統顯示所有映射規則列表
**And** 支援按 Forwarder、欄位名稱、狀態篩選
**And** 顯示規則的版本號和最後更新時間

### AC2: 規則詳情查看

**Given** 規則列表
**When** 點擊某條規則
**Then** 顯示規則詳情：提取模式、適用 Forwarder、創建人、應用統計

---

## Tasks / Subtasks

- [ ] **Task 1: 規則管理頁面** (AC: #1)
  - [ ] 1.1 創建 `src/app/(dashboard)/rules/page.tsx`
  - [ ] 1.2 實現規則列表表格
  - [ ] 1.3 顯示規則基本資訊
  - [ ] 1.4 顯示版本號和更新時間

- [ ] **Task 2: 篩選功能** (AC: #1)
  - [ ] 2.1 Forwarder 下拉篩選
  - [ ] 2.2 欄位名稱搜索
  - [ ] 2.3 狀態篩選（ACTIVE, DRAFT, DEPRECATED）
  - [ ] 2.4 組合篩選邏輯

- [ ] **Task 3: 規則列表 API** (AC: #1)
  - [ ] 3.1 創建 GET `/api/rules`
  - [ ] 3.2 實現篩選參數處理
  - [ ] 3.3 分頁支援
  - [ ] 3.4 排序功能

- [ ] **Task 4: 規則詳情頁面** (AC: #2)
  - [ ] 4.1 創建 `src/app/(dashboard)/rules/[id]/page.tsx`
  - [ ] 4.2 顯示提取模式詳情
  - [ ] 4.3 顯示適用 Forwarder
  - [ ] 4.4 顯示創建人資訊

- [ ] **Task 5: 應用統計顯示** (AC: #2)
  - [ ] 5.1 計算規則應用次數
  - [ ] 5.2 計算成功率
  - [ ] 5.3 顯示最近應用時間
  - [ ] 5.4 顯示統計趨勢

- [ ] **Task 6: 規則詳情 API** (AC: #2)
  - [ ] 6.1 創建 GET `/api/rules/[id]`
  - [ ] 6.2 關聯查詢應用統計
  - [ ] 6.3 返回完整規則資訊

- [ ] **Task 7: 權限控制** (AC: #1, #2)
  - [ ] 7.1 僅 Super User 可訪問
  - [ ] 7.2 驗證 RULE_VIEW 權限
  - [ ] 7.3 隱藏無權限功能

- [ ] **Task 8: 驗證與測試** (AC: #1-2)
  - [ ] 8.1 測試列表顯示
  - [ ] 8.2 測試篩選功能
  - [ ] 8.3 測試詳情查看
  - [ ] 8.4 測試權限控制

---

## Dev Notes

### 依賴項

- **Story 1.2**: 角色權限基礎
- **Story 5.3**: Forwarder 映射規則

### Architecture Compliance

```prisma
model MappingRule {
  id            String   @id @default(uuid())
  forwarderId   String   @map("forwarder_id")
  fieldName     String   @map("field_name")
  extractionType ExtractionType @map("extraction_type")
  pattern       String?
  confidence    Float    @default(0.8)
  priority      Int      @default(0)
  status        RuleStatus @default(ACTIVE)
  version       Int      @default(1)
  createdBy     String   @map("created_by")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  forwarder Forwarder @relation(fields: [forwarderId], references: [id])
  creator   User      @relation(fields: [createdBy], references: [id])
  versions  RuleVersion[]
  applications RuleApplication[]

  @@unique([forwarderId, fieldName, version])
  @@index([forwarderId])
  @@index([fieldName])
  @@map("mapping_rules")
}

enum ExtractionType {
  REGEX           // 正則表達式
  POSITION        // 位置提取
  KEYWORD         // 關鍵字匹配
  AI_PROMPT       // AI 提示詞
  TEMPLATE        // 模板匹配
}

enum RuleStatus {
  DRAFT           // 草稿
  PENDING_REVIEW  // 待審核
  ACTIVE          // 生效中
  DEPRECATED      // 已棄用
}
```

```typescript
// GET /api/rules
interface RulesQueryParams {
  forwarderId?: string
  fieldName?: string
  status?: RuleStatus
  page?: number
  limit?: number
  sortBy?: 'createdAt' | 'updatedAt' | 'priority'
  sortOrder?: 'asc' | 'desc'
}

interface RulesResponse {
  success: true
  data: {
    rules: {
      id: string
      forwarder: { id: string; name: string }
      fieldName: string
      extractionType: ExtractionType
      status: RuleStatus
      version: number
      createdBy: { name: string }
      createdAt: string
      updatedAt: string
      applicationCount: number
      successRate: number
    }[]
    pagination: {
      total: number
      page: number
      limit: number
      totalPages: number
    }
  }
}
```

### References

- [Source: docs/03-epics/sections/epic-4-mapping-rules-auto-learning.md#story-41]
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR17]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 4.1 |
| Story Key | 4-1-mapping-rule-list-view |
| Epic | Epic 4: 映射規則管理與自動學習 |
| FR Coverage | FR17 |
| Dependencies | Story 1.2, Story 5.3 |

---

*Story created: 2025-12-16*
*Status: ready-for-dev*
