# Story 16.5: 識別規則 Prompt 整合

**Status:** done

---

## Story

**As a** 系統管理員,
**I want** 識別規則自動整合到 GPT Vision Prompt 中,
**So that** AI 能夠根據配置的規則更準確地識別文件格式。

---

## 背景說明

### 問題陳述

目前 Story 16-3 已實現識別規則的 UI 配置，但：
- 這些規則只存儲在 `DocumentFormat.identificationRules` 欄位
- 未被 AI 處理流程讀取和使用
- 識別規則包括：Logo 特徵、關鍵字、版面特徵、優先級

### 解決方案

將識別規則整合到 GPT Vision Prompt 中：
1. ConfigFetchingStep 讀取公司下所有格式的 identificationRules
2. 構建規則 Prompt 片段，按優先級排序
3. 注入到 GPT Vision 分類 Prompt 中

---

## Acceptance Criteria

### AC1: 讀取識別規則

**Given** 公司有已配置識別規則的格式
**When** ConfigFetchingStep 執行
**Then** 正確讀取並存入 context.formatIdentificationRules

### AC2: Prompt 注入

**Given** formatIdentificationRules 不為空
**When** GPT Vision 分類執行
**Then** Prompt 包含識別規則片段

### AC3: 支援 Logo 特徵

**Given** 規則包含 logoPatterns
**When** 構建 Prompt
**Then** 包含「左上角: Logo 描述」等文本

### AC4: 支援關鍵字

**Given** 規則包含 keywords
**When** 構建 Prompt
**Then** 包含「文件關鍵字: keyword1, keyword2」

### AC5: 支援版面特徵

**Given** 規則包含 layoutHints
**When** 構建 Prompt
**Then** 包含「版面特徵: layoutHints 描述」

### AC6: 優先級影響

**Given** 多個格式有識別規則
**When** 構建 Prompt
**Then** 按 priority 降序排列，高優先級格式優先匹配

---

## Tasks / Subtasks

- [x] **Task 1: 類型定義** (AC: #1)
  - [x] 1.1 新增 FormatIdentificationRule 類型
  - [x] 1.2 擴展 UnifiedProcessingContext

- [x] **Task 2: Prompt 生成器** (AC: #2, #3, #4, #5, #6)
  - [x] 2.1 新增 `identification-rules-prompt-builder.ts`
  - [x] 2.2 實現 `buildIdentificationRulesPrompt()`
  - [x] 2.3 實現優先級排序
  - [x] 2.4 實現各類型規則格式化

- [x] **Task 3: ConfigFetchingStep 擴展** (AC: #1)
  - [x] 3.1 新增 `fetchFormatIdentificationRules()` 方法
  - [x] 3.2 在 doExecute 中調用並存入 context

- [x] **Task 4: GPT Vision 整合** (AC: #2)
  - [x] 4.1 修改 gpt-enhanced-extraction.step.ts
  - [x] 4.2 擴展 ProcessingOptions
  - [x] 4.3 修改 gpt-vision.service.ts 注入 Prompt

- [x] **Task 5: 測試驗證** (AC: #1-6)
  - [x] 5.1 TypeScript 類型檢查通過
  - [x] 5.2 Prompt 生成邏輯驗證

---

## Dev Notes

### 依賴項

- **Story 16-3**: 識別規則配置（identificationRules 欄位）
- **Epic 15**: 統一處理流程（ConfigFetchingStep, GptEnhancedExtractionStep）

### 新增文件

```
src/
├── types/
│   └── unified-processor.ts          # 更新：新增 FormatIdentificationRule
├── services/
│   ├── prompt/
│   │   └── identification-rules-prompt-builder.ts  # 新增
│   └── unified-processor/steps/
│       ├── config-fetching.step.ts   # 更新
│       └── gpt-enhanced-extraction.step.ts  # 更新
```

### Prompt 格式範例

```markdown
## 已知文件格式識別規則

### 1. ABC 物流 - 海運發票 (發票 - 海運)
- **識別優先級**: 80/100
- **Logo 特徵**: 左上角: ABC 藍色 Logo
- **文件關鍵字**: Ocean Freight Invoice, BL Number
- **版面特徵**: 表格式佈局，費用明細在右側
```

---

## Implementation Notes

### 完成日期
2026-01-13

### 實現摘要
- **Prompt 生成器**: `identification-rules-prompt-builder.ts` 按優先級排序生成規則片段
- **ConfigFetchingStep**: 讀取公司下所有格式的 identificationRules
- **GPT Vision**: 將規則 Prompt 注入分類請求

### Rollback 策略
- 在 `hasValidIdentificationRules` 直接返回 `false` 可跳過所有規則注入

---

## Related Files

- `src/services/prompt/identification-rules-prompt-builder.ts` - 新增
- `src/services/unified-processor/steps/config-fetching.step.ts` - 更新
- `src/services/unified-processor/steps/gpt-enhanced-extraction.step.ts` - 更新
- `src/services/gpt-vision.service.ts` - 更新
