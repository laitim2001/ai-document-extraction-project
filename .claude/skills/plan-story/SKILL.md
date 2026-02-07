---
name: plan-story
description: 為全新功能建立完整規劃文件（Story + Tech Spec + Prompt Template）
trigger: /plan-story
---

# Plan Story - 全新功能規劃

為全新功能建立符合項目規範的完整規劃文件套件。

## 執行流程

### Step 1: 收集基本資訊

詢問用戶以下資訊（逐一確認）：

1. **Epic 編號與名稱**（例：Epic 21 - Exchange Rate Management）
2. **Story 編號**（例：21-1）
3. **Story 標題**（中文，例：資料庫模型與遷移）
4. **Story 描述**（As a... I want... So that...）
5. **功能概要**（用一段話描述要做什麼）

### Step 2: 掃描現有文件確認編號不衝突

```
1. Glob: docs/04-implementation/stories/epic-{NN}-*/*.md
   → 確認 Story 編號不重複
2. Glob: docs/04-implementation/tech-specs/epic-{NN}-*/*.md
   → 確認 Tech Spec 不重複
3. Read: 同一 Epic 下最近的 1 個 Story 文件作為格式參考
4. Read: 同一 Epic 下最近的 1 個 Tech Spec 文件作為格式參考
```

如果 Epic 目錄不存在，詢問用戶 Epic 目錄名稱（格式：`epic-{NN}-{kebab-case-name}`）。

### Step 3: 生成 Story 文件

**路徑**: `docs/04-implementation/stories/epic-{NN}-{name}/{E}-{S}-{kebab-case-title}.md`

**必須遵循的格式**：

```markdown
# Story {E}.{S}: {中文標題}

**Status:** backlog

---

## Story

**As a** {角色},
**I want** {需求},
**So that** {價值}。

---

## 背景說明

### 問題陳述
{描述待解決的問題}

### 設計決策
{關鍵設計決策要點}

---

## Acceptance Criteria

### AC1: {驗收標準名稱}

**Given** {前置條件}
**When** {操作}
**Then**：
  - {預期結果}

---

## Tasks / Subtasks

- [ ] **Task 1: {任務名稱}** (AC: #1)
  - [ ] 1.1 {子任務}

---

## Dev Notes

### 依賴項
- {前置依賴}

### 新增文件
```
{路徑結構}
```

---

## Related Files
- `{路徑}` - {說明}
```

向用戶展示生成結果，等待確認後寫入。

### Step 4: 生成 Tech Spec 文件

**路徑**: `docs/04-implementation/tech-specs/epic-{NN}-{name}/tech-spec-story-{E}-{S}.md`

**必須遵循的格式**：

```markdown
# Tech Spec: Story {E}.{S} - {中文標題}

> **Version**: 1.0.0
> **Created**: {YYYY-MM-DD}
> **Status**: Draft
> **Story Key**: STORY-{E}-{S}

---

## Overview

| 項目 | 內容 |
|------|------|
| **Story ID** | {E}.{S} |
| **Epic** | Epic {E} - {Epic 名稱} |
| **Estimated Effort** | {N} Story Points |
| **Dependencies** | {前置依賴} |

---

## Objective
{技術實現目標}

---

## Acceptance Criteria Mapping

| AC ID | 驗收條件 | 實現方式 |
|-------|----------|----------|
| AC-{E}.{S}.1 | {驗收標準} | {技術方案} |

---

## Implementation Guide

### Phase 1: {階段名稱}

#### 1.1 {子任務}
{技術細節、代碼範例}

---

## File Structure

```
{新增/修改的文件路徑結構}
```

---

## Testing Checklist

- [ ] {測試項目}
```

向用戶展示生成結果，等待確認後寫入。

### Step 5: 更新 all-story-prompts.md

**路徑**: `docs/04-implementation/prompt-templates/all-story-prompts.md`

在對應 Epic 段落末尾新增以下內容：

```markdown
### Story {E}-{S}: {Story 名稱}

\`\`\`
# 開發任務：Story {E}-{S} {Story 標題}

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/epic-{NN}-{name}/{E}-{S}-{file-name}.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Story 文件中的 Tasks 和 Dev Notes
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件：Status 改為 `done`、所有 Tasks 打勾、添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
\`\`\`
```

如果對應 Epic 段落不存在，先建立 Epic 標題段落：

```markdown
## Epic {NN}: {Epic 名稱}

> **說明**：{Epic 簡述}
```

向用戶展示變更內容，等待確認後寫入。

### Step 6: 輸出摘要

```markdown
## ✅ Story 規劃完成

| 文件 | 路徑 | 狀態 |
|------|------|------|
| Story | docs/04-implementation/stories/... | ✅ 已建立 |
| Tech Spec | docs/04-implementation/tech-specs/... | ✅ 已建立 |
| Prompt | docs/04-implementation/prompt-templates/all-story-prompts.md | ✅ 已更新 |

### 下一步
- 使用對應的 prompt 開始實作
- 或繼續 `/plan-story` 建立下一個 Story
```

## 重要規則

- 所有文件內容使用**繁體中文**
- 嚴格遵循現有文件的格式和章節結構
- 每個步驟的輸出都必須等用戶確認後才寫入
- 如果 Epic 目錄結構不存在，先建立目錄
- Story 編號必須與同 Epic 下現有 Story 不衝突
