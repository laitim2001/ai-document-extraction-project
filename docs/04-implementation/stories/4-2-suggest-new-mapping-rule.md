# Story 4.2: 建議新映射規則

**Status:** ready-for-dev

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

- [ ] **Task 1: 新規則表單頁面** (AC: #1)
  - [ ] 1.1 創建 `src/app/(dashboard)/rules/new/page.tsx`
  - [ ] 1.2 設計表單佈局
  - [ ] 1.3 加入返回和提交按鈕

- [ ] **Task 2: 表單欄位實現** (AC: #2)
  - [ ] 2.1 目標欄位選擇（下拉選單）
  - [ ] 2.2 Forwarder 選擇（支援搜索）
  - [ ] 2.3 提取模式類型選擇
  - [ ] 2.4 提取模式內容輸入
  - [ ] 2.5 優先級設定

- [ ] **Task 3: 提取模式編輯器** (AC: #2)
  - [ ] 3.1 REGEX 模式：正則輸入 + 測試
  - [ ] 3.2 POSITION 模式：座標輸入
  - [ ] 3.3 KEYWORD 模式：關鍵字列表
  - [ ] 3.4 AI_PROMPT 模式：提示詞編輯
  - [ ] 3.5 TEMPLATE 模式：模板設計

- [ ] **Task 4: 規則測試功能** (AC: #2)
  - [ ] 4.1 上傳測試文件
  - [ ] 4.2 執行規則預覽
  - [ ] 4.3 顯示提取結果
  - [ ] 4.4 標記匹配位置

- [ ] **Task 5: 表單驗證** (AC: #2)
  - [ ] 5.1 必填欄位驗證
  - [ ] 5.2 正則表達式語法驗證
  - [ ] 5.3 重複規則檢查
  - [ ] 5.4 錯誤訊息顯示

- [ ] **Task 6: 創建規則 API** (AC: #3)
  - [ ] 6.1 創建 POST `/api/rules`
  - [ ] 6.2 驗證規則內容
  - [ ] 6.3 設定初始狀態為 PENDING_REVIEW
  - [ ] 6.4 創建 RuleSuggestion 記錄

- [ ] **Task 7: 審核通知** (AC: #3)
  - [ ] 7.1 查詢有審核權限的 Super User
  - [ ] 7.2 創建通知記錄
  - [ ] 7.3 發送即時通知

- [ ] **Task 8: 驗證與測試** (AC: #1-3)
  - [ ] 8.1 測試表單填寫
  - [ ] 8.2 測試規則預覽
  - [ ] 8.3 測試提交流程
  - [ ] 8.4 測試通知發送

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

```typescript
// POST /api/rules
interface CreateRuleRequest {
  forwarderId: string
  fieldName: string
  extractionType: ExtractionType
  pattern?: string
  priority?: number
  testDocumentId?: string  // 用於測試的文件
}

interface CreateRuleResponse {
  success: true
  data: {
    suggestionId: string
    status: 'PENDING'
    message: string
  }
}
```

```typescript
// src/app/(dashboard)/rules/new/page.tsx
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const ruleSchema = z.object({
  forwarderId: z.string().min(1, '請選擇 Forwarder'),
  fieldName: z.string().min(1, '請選擇目標欄位'),
  extractionType: z.enum(['REGEX', 'POSITION', 'KEYWORD', 'AI_PROMPT', 'TEMPLATE']),
  pattern: z.string().optional(),
  priority: z.number().min(0).max(100).default(0),
})

export default function NewRulePage() {
  const form = useForm({
    resolver: zodResolver(ruleSchema),
  })

  // 根據 extractionType 動態渲染不同的編輯器
  const renderPatternEditor = (type: string) => {
    switch (type) {
      case 'REGEX':
        return <RegexEditor />
      case 'POSITION':
        return <PositionEditor />
      case 'KEYWORD':
        return <KeywordEditor />
      case 'AI_PROMPT':
        return <PromptEditor />
      case 'TEMPLATE':
        return <TemplateEditor />
      default:
        return null
    }
  }
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
*Status: ready-for-dev*
