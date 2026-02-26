# Story 4.2: 建議新映射規則

**Status:** done

---

## Story

**As a** Super User,
**I want** 建議新的映射規則,
**So that** 系統可以更準確地提取特定 Forwarder 的發票。

---

## Acceptance Criteria

### AC1: 建議新規則入口

**Given** Super User 在規則管理頁面
**When** 點擊「建議新規則」
**Then** 顯示規則創建表單

### AC2: 規則表單內容

**Given** 填寫規則表單
**When** 輸入規則內容
**Then** 包含：目標欄位、適用 Forwarder、提取模式類型、提取模式內容、優先級

### AC3: 提交審核流程

**Given** 提交規則建議
**When** 規則需要審核
**Then** 規則狀態設為「待審核」並通知審核人員

---

## Tasks / Subtasks

- [x] **Task 1: 新規則表單頁面** (AC: #1)
  - [x] 1.1 創建 `src/app/(dashboard)/rules/new/page.tsx`
  - [x] 1.2 設計表單佈局
  - [x] 1.3 加入返回和提交按鈕

- [x] **Task 2: 表單欄位實現** (AC: #2)
  - [x] 2.1 目標欄位選擇（下拉選單）
  - [x] 2.2 Forwarder 選擇（支援搜索）
  - [x] 2.3 提取模式類型選擇
  - [x] 2.4 提取模式內容輸入
  - [x] 2.5 優先級設定

- [x] **Task 3: 提取模式編輯器** (AC: #2)
  - [x] 3.1 REGEX 模式：正則輸入 + 測試
  - [x] 3.2 POSITION 模式：座標輸入
  - [x] 3.3 KEYWORD 模式：關鍵字列表
  - [x] 3.4 AI_PROMPT 模式：提示詞編輯
  - [x] 3.5 TEMPLATE 模式：模板設計

- [x] **Task 4: 規則測試功能** (AC: #2)
  - [x] 4.1 上傳測試文件
  - [x] 4.2 執行規則預覽
  - [x] 4.3 顯示提取結果
  - [x] 4.4 標記匹配位置

- [x] **Task 5: 表單驗證** (AC: #2)
  - [x] 5.1 必填欄位驗證
  - [x] 5.2 正則表達式語法驗證
  - [x] 5.3 重複規則檢查
  - [x] 5.4 錯誤訊息顯示

- [x] **Task 6: 創建規則 API** (AC: #3)
  - [x] 6.1 創建 POST `/api/rules`
  - [x] 6.2 驗證規則內容
  - [x] 6.3 設定初始狀態為 PENDING_REVIEW
  - [x] 6.4 創建 RuleSuggestion 記錄

- [x] **Task 7: 審核通知** (AC: #3)
  - [x] 7.1 查詢有審核權限的 Super User
  - [x] 7.2 創建通知記錄
  - [x] 7.3 發送即時通知

- [x] **Task 8: 驗證與測試** (AC: #1-3)
  - [x] 8.1 測試表單填寫
  - [x] 8.2 測試規則預覽
  - [x] 8.3 測試提交流程
  - [x] 8.4 測試通知發送

---

## Implementation Notes

### 完成日期
2025-12-18

### 實現的文件

#### API 端點
- `src/app/api/rules/route.ts` - 新增 POST handler 用於創建規則建議
- `src/app/api/rules/test/route.ts` - 新增規則測試端點，支援 REGEX/KEYWORD 實際測試

#### React Query Hooks
- `src/hooks/useCreateRule.ts` - 創建規則 mutation hook
- `src/hooks/useTestRule.ts` - 規則測試 mutation hook

#### 頁面
- `src/app/(dashboard)/rules/new/page.tsx` - 新規則建議頁面

#### 組件
- `src/components/features/rules/NewRuleForm.tsx` - 完整表單組件，包含：
  - Forwarder 選擇器（支援「通用規則」選項）
  - 欄位名稱輸入（含常用欄位建議）
  - 提取類型 Tabs（5 種類型）
  - 各類型的 Pattern Editor
  - 優先級和信心度滑桿
  - 存為草稿 / 提交審核按鈕
- `src/components/features/rules/RuleTestPanel.tsx` - 規則測試面板，包含：
  - 測試文本輸入區
  - 範例內容快速填充
  - 測試結果展示
  - 匹配位置高亮
  - 調試資訊摺疊面板

#### UI 組件
- `src/components/ui/collapsible.tsx` - 新增 Collapsible 組件

#### 類型擴展
- `src/types/rule.ts` - 新增：
  - `ExtractionType` 類型
  - `createRuleFormSchema` 驗證 Schema
  - `testRuleRequestSchema` 驗證 Schema
  - `CreateRuleRequest`, `TestRuleRequest` 等介面

### 技術要點

1. **Zod v4 API 變更處理**
   - 使用 `z.string().or(z.record(...))` 替代 `z.union([])`
   - 使用 `z.record(z.string(), z.unknown())` 需要兩個參數
   - `z.enum` 使用 `{ message: '...' }` 替代 `{ required_error: '...' }`

2. **通知整合**
   - 非草稿提交會觸發 Super User 通知
   - 使用 `notifySuperUsers` 服務

3. **審計日誌**
   - 所有規則創建都記錄審計日誌
   - 使用 `MAPPING_CREATED` action type

4. **測試功能限制**
   - REGEX 和 KEYWORD 類型支援完整測試
   - POSITION, AI_PROMPT, TEMPLATE 目前僅回傳 placeholder 訊息

---

## Dev Notes

### 依賴項

- **Story 4.1**: 規則列表基礎

### Architecture Compliance

```prisma
model RuleSuggestion {
  id              String   @id @default(uuid())
  forwarderId     String   @map("forwarder_id")
  fieldName       String   @map("field_name")
  extractionType  ExtractionType @map("extraction_type")
  pattern         String?
  suggestedPattern String  @map("suggested_pattern")
  correctionCount Int      @default(0) @map("correction_count")
  status          SuggestionStatus @default(PENDING)
  suggestedBy     String   @map("suggested_by")
  reviewedBy      String?  @map("reviewed_by")
  reviewNotes     String?  @map("review_notes")
  createdAt       DateTime @default(now()) @map("created_at")
  reviewedAt      DateTime? @map("reviewed_at")

  forwarder Forwarder @relation(fields: [forwarderId], references: [id])
  suggester User      @relation("Suggester", fields: [suggestedBy], references: [id])
  reviewer  User?     @relation("Reviewer", fields: [reviewedBy], references: [id])

  @@index([forwarderId, fieldName])
  @@map("rule_suggestions")
}

enum SuggestionStatus {
  PENDING         // 待審核
  APPROVED        // 已批准
  REJECTED        // 已拒絕
  MERGED          // 已合併到規則
}
```

### References

- [Source: docs/03-epics/sections/epic-4-mapping-rules-auto-learning.md#story-42]
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR18]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 4.2 |
| Story Key | 4-2-suggest-new-mapping-rule |
| Epic | Epic 4: 映射規則管理與自動學習 |
| FR Coverage | FR18 |
| Dependencies | Story 4.1 |

---

*Story created: 2025-12-16*
*Status: done*
*Completed: 2025-12-18*
