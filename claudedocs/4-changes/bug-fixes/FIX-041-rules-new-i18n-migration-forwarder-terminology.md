# FIX-041: Rules New 頁面 i18n 遷移遺漏 + Forwarder→Company 術語統一 + 提取類型可用性標記

> **建立日期**: 2026-02-21
> **發現方式**: 代碼審查
> **影響頁面/功能**: `/rules/new`（新增映射規則建議頁面）
> **優先級**: P2
> **狀態**: ✅ 已修復

---

## 問題描述

`/rules/new` 頁面（page.tsx、NewRuleForm.tsx、RuleTestPanel.tsx）建於 Epic 4（2025-12-18），早於 Epic 17 i18n 實施（2026-01-17）和 REFACTOR-001 Forwarder→Company 重構（2025-12-24），存在三個遺漏問題：

| # | 問題 | 嚴重度 | 影響範圍 |
|---|------|--------|----------|
| BUG-1 | 硬編碼中文（60+ 處），英文 locale 下顯示中文 | 高 | 三個組件全部 UI 文字 |
| BUG-2 | Forwarder 術語未統一（15+ 處），與 REFACTOR-001 不一致 | 中 | 表單 label、placeholder、驗證訊息、i18n keys |
| BUG-3 | 提取類型可用性不清，用戶無法區分可用/不可用功能 | 低 | NewRuleForm 提取類型選擇區 |

---

## 重現步驟

### BUG-1: 硬編碼中文

1. 前往 `http://localhost:3005/en/rules/new`
2. 觀察現象：頁面標題、表單 label、按鈕、placeholder、驗證訊息全部顯示中文
3. 預期行為：英文 locale 下應顯示英文

### BUG-2: Forwarder 術語

1. 在 `/en/rules/new` 或 `/zh-TW/rules/new`
2. 觀察 Company 選擇區域的 FormLabel 顯示 "Forwarder"
3. 預期行為：應顯示 "Company"（與系統其他頁面一致）

### BUG-3: 提取類型可用性

1. 在 `/rules/new` 選擇提取類型「座標位置」或「AI 提示詞」
2. 輸入 pattern 和測試文本後點「執行測試」
3. 觀察現象：返回錯誤但無明確的「功能未實作」提示
4. 預期行為：應在選擇時就清楚標示可用性狀態

---

## 根本原因

### BUG-1: Epic 4 → Epic 17 遷移遺漏

三個組件（`page.tsx`、`NewRuleForm.tsx`、`RuleTestPanel.tsx`）在 Epic 17 i18n 大規模遷移時被遺漏。組件完全沒有 `useTranslations()` 呼叫，所有使用者可見文字都是硬編碼中文字串。

`rules.json` 翻譯檔中已有 `ruleEdit.extractionTypes.*` 等 key（由 RuleEditDialog 使用），可部分複用，但新增頁面特有的文字（頁面標題、步驟說明、測試面板）需新增 i18n keys。

### BUG-2: REFACTOR-001 未覆蓋此頁面

REFACTOR-001（2025-12-24）將 `forwarders/` 組件遷移到 `companies/`，並建立了 `useForwarderList` → `useCompanyList` 的 backward-compatible re-export。但 `NewRuleForm.tsx` 中的 UI 文字（FormLabel、placeholder、驗證訊息）和 `rules.json` 中的 i18n keys（`ruleTable.forwarder`、`ruleFilters.forwarder`、`detail.forwarder`）仍使用 "Forwarder"。

### BUG-3: 提取類型可用性未標記

深入調查 5 種提取類型的後端實作狀態：

| 類型 | 規則測試端點 | 主系統實作 | 結論 |
|------|------------|-----------|------|
| REGEX | 完全可用 | 多處使用 | ✅ 完整功能 |
| KEYWORD | 完全可用 | 多處使用 | ✅ 完整功能 |
| POSITION | Stub（返回錯誤） | 全系統未實作 | ❌ 架構已設計但無執行邏輯 |
| AI_PROMPT | Stub（返回錯誤） | 全系統未實作 | ❌ V3 管線 GPT 與此無關 |
| TEMPLATE | Stub（返回錯誤） | Epic 19 完整實作 | ⚠️ 功能存在但入口不同 |

**TEMPLATE 補充說明**：`/api/rules/test` 是針對 OCR 原始文字做模式匹配的工具，而 TEMPLATE 匹配引擎操作的是已提取的 `fieldMappings` 結構化數據。兩者功能域完全不同。系統已有完整的模板匹配測試頁面在 `/admin/test/template-matching/`。

---

## 解決方案

### BUG-1 修復：全面 i18n 遷移

#### 1.1 新增 i18n keys（`rules.json` 三個語言）

在 `rules.json` 新增 `newRule` 和 `testPanel` 命名空間：

```json
{
  "newRule": {
    "pageTitle": "Suggest New Mapping Rule",
    "pageDescription": "Create a new extraction rule suggestion. It will be applied to document processing after review.",
    "instructions": {
      "title": "Rule Suggestion Process",
      "step1": "Select a company (if applicable to a specific company) or set as universal rule",
      "step2": "Select the target field to extract",
      "step3": "Configure extraction pattern (regex, keyword, etc.)",
      "step4": "Use the test function to verify extraction results",
      "step5": "Submit for review, or save as draft first"
    },
    "basicSettings": {
      "title": "Basic Settings",
      "description": "Select the company and target field for this rule"
    },
    "company": {
      "label": "Company",
      "placeholder": "Select company...",
      "universalRule": "Universal Rule",
      "universalRuleAppliesAll": "(Applies to all companies)",
      "universalRuleDescription": "Selecting \"Universal Rule\" will apply to all companies"
    },
    "fieldName": {
      "label": "Field Name",
      "placeholder": "e.g.: invoice_number",
      "description": "Enter field name or click a suggestion"
    },
    "description": {
      "label": "Description (Optional)",
      "placeholder": "Describe the purpose or special cases of this rule..."
    },
    "extractionMode": {
      "title": "Extraction Mode",
      "description": "Configure how to extract the target field value from documents",
      "typeLabel": "Extraction Type",
      "patternLabel": "Pattern Configuration"
    },
    "extractionTypes": {
      "regex": {
        "label": "Regex",
        "description": "Match and extract text using regular expressions"
      },
      "keyword": {
        "label": "Keyword",
        "description": "Extract adjacent text based on keyword position"
      },
      "position": {
        "label": "Position",
        "description": "Extract based on PDF coordinate position (requires OCR)",
        "notAvailable": "Position extraction requires OCR coordinate data. This feature is under development."
      },
      "aiPrompt": {
        "label": "AI Prompt",
        "description": "Use AI to understand and extract content (requires AI service)",
        "notAvailable": "AI Prompt extraction requires Azure OpenAI integration. This feature is under development."
      },
      "template": {
        "label": "Template",
        "description": "Use predefined templates for matching and extraction",
        "notAvailable": "Template matching has a dedicated test page. Please use the Template Matching Test page.",
        "linkText": "Go to Template Matching Test"
      }
    },
    "regex": {
      "placeholder": "Enter regex, e.g.: ^Invoice No[.:]?\\s*(\\S+)",
      "presetInvoiceNumber": "Invoice Number",
      "presetDateFormat": "Date Format",
      "presetAmountFormat": "Amount Format"
    },
    "keyword": {
      "placeholder": "Enter JSON format:\n{\n  \"keywords\": [\"Invoice No\", \"Invoice Number\"],\n  \"position\": \"after\",\n  \"maxDistance\": 100\n}"
    },
    "aiPrompt": {
      "placeholder": "Enter AI prompt, e.g.: Extract the invoice number from the document"
    },
    "priority": {
      "label": "Priority (0-100)",
      "description": "Higher number means higher priority"
    },
    "confidence": {
      "label": "Default Confidence (0-1)",
      "description": "Recommended between 0.7-0.9"
    },
    "buttons": {
      "saveDraft": "Save as Draft",
      "submitReview": "Submit for Review"
    },
    "toast": {
      "success": "Success",
      "error": "Error",
      "draftError": "Cannot Save as Draft",
      "draftMinFields": "Please fill in at least Company, Field Name, and Pattern"
    },
    "validation": {
      "companyRequired": "Please select a company or universal rule",
      "fieldNameRequired": "Please enter field name",
      "extractionTypeRequired": "Please select extraction type",
      "patternRequired": "Please enter extraction pattern"
    }
  },
  "testPanel": {
    "title": "Test Rule",
    "description": "Test extraction results before submitting to ensure the rule works correctly",
    "configureFirst": "Please configure the extraction pattern above before testing",
    "testText": "Test Text",
    "useSample": "Use Sample",
    "clear": "Clear",
    "placeholder": "Paste invoice text content for testing...",
    "testing": "Testing...",
    "runTest": "Run Test",
    "result": "Test Result",
    "matched": "Matched",
    "notMatched": "Not Matched",
    "confidenceLabel": "Confidence",
    "extractedValue": "Extracted Value",
    "matchPositions": "Match Positions",
    "matchPositionCount": "{count} matches",
    "lineColumn": "Line {line}, Col {column} (char {start}-{end})",
    "moreMatches": "{count} more matches...",
    "debugInfo": "Debug Info",
    "processingTime": "Processing Time: {time} ms",
    "matchAttempts": "Match Attempts: {count}",
    "errors": "Errors:"
  }
}
```

#### 1.2 遷移三個組件

在 `page.tsx`、`NewRuleForm.tsx`、`RuleTestPanel.tsx` 中：
- 添加 `import { useTranslations } from 'next-intl'`
- 使用 `const t = useTranslations('rules')` 取得翻譯函數
- 將所有硬編碼字串替換為 `t('newRule.xxx')` 或 `t('testPanel.xxx')`

### BUG-2 修復：Forwarder→Company 術語統一

#### 2.1 組件內文字

| 原文 | 替換為 | 影響檔案 |
|------|--------|----------|
| `FormLabel: Forwarder` | `t('newRule.company.label')` → "Company" | NewRuleForm.tsx:240 |
| `placeholder: 選擇 Forwarder...` | `t('newRule.company.placeholder')` | NewRuleForm.tsx:248 |
| `(適用所有 Forwarder)` | `t('newRule.company.universalRuleAppliesAll')` | NewRuleForm.tsx:255 |
| `適用於所有 Forwarder` | `t('newRule.company.universalRuleDescription')` | NewRuleForm.tsx:266 |
| Zod 驗證訊息中的 Forwarder | `t('newRule.validation.companyRequired')` | NewRuleForm.tsx:106 |
| Toast 訊息中的 Forwarder | `t('newRule.toast.draftMinFields')` | NewRuleForm.tsx:216 |

#### 2.2 Import 更新

```typescript
// 舊
import { useForwarderList } from '@/hooks/useForwarderList'
// 新（功能相同，但語義更清晰）
import { useCompanyList } from '@/hooks/useCompanyList'
```

#### 2.3 i18n keys 更新（三個語言檔案）

| 舊 key | 新 key | 影響範圍 |
|--------|--------|----------|
| `ruleTable.forwarder` | `ruleTable.company` | 規則列表表頭 |
| `ruleFilters.forwarder` | `ruleFilters.company` | 規則篩選器 |
| `ruleFilters.allForwarders` | `ruleFilters.allCompanies` | 篩選器選項 |
| `detail.forwarder` | `detail.company` | 規則詳情 |

> **注意**：需確認這些 keys 在其他組件中的使用情況，避免破壞現有功能。

### BUG-3 修復：提取類型可用性標記

在 `EXTRACTION_TYPES` 常量和 UI 中標記可用性：

#### 3.1 NewRuleForm.tsx — 提取類型常量增加可用性標記

```typescript
const EXTRACTION_TYPES = [
  { value: 'REGEX', available: true },
  { value: 'KEYWORD', available: true },
  { value: 'POSITION', available: false },
  { value: 'AI_PROMPT', available: false },
  { value: 'TEMPLATE', available: false, hasAlternative: true },
] as const
```

#### 3.2 UI 呈現策略

| 類型 | 可選擇 | Tab 顯示 | Pattern 區域 |
|------|--------|----------|-------------|
| REGEX | ✅ 可選 | 正常顯示 | 正常輸入 + 預設模板按鈕 |
| KEYWORD | ✅ 可選 | 正常顯示 | JSON 格式輸入 |
| POSITION | ✅ 可選 | 顯示「開發中」標記 | 顯示 Alert：功能開發中 |
| AI_PROMPT | ✅ 可選 | 顯示「開發中」標記 | 顯示 Alert：功能開發中 |
| TEMPLATE | ✅ 可選 | 顯示「另有入口」標記 | 顯示 Alert + 連結至 `/admin/test/template-matching/` |

> POSITION 和 AI_PROMPT 保留可選（允許存為草稿），但明確標示功能狀態。
> TEMPLATE 引導用戶至正確的測試入口。

---

## 修改的檔案

| 檔案 | 修改內容 |
|------|----------|
| `src/app/[locale]/(dashboard)/rules/new/page.tsx` | 全面 i18n 化，移除所有硬編碼中文 |
| `src/components/features/rules/NewRuleForm.tsx` | i18n 化 + Forwarder→Company + 提取類型可用性標記 |
| `src/components/features/rules/RuleTestPanel.tsx` | 全面 i18n 化 |
| `messages/en/rules.json` | 新增 `newRule.*` 和 `testPanel.*` keys + forwarder→company |
| `messages/zh-TW/rules.json` | 新增 `newRule.*` 和 `testPanel.*` keys + forwarder→company |
| `messages/zh-CN/rules.json` | 新增 `newRule.*` 和 `testPanel.*` keys + forwarder→company |

---

## 測試驗證

修復完成後需驗證：

### i18n 驗證

- [ ] `/en/rules/new` 頁面所有文字顯示英文
- [ ] `/zh-TW/rules/new` 頁面所有文字顯示繁體中文
- [ ] `/zh-CN/rules/new` 頁面所有文字顯示簡體中文
- [ ] 表單驗證訊息依 locale 正確顯示
- [ ] Toast 訊息依 locale 正確顯示
- [ ] `npm run i18n:check` 通過

### Forwarder→Company 驗證

- [ ] Company 選擇區 FormLabel 顯示 "Company"（en）/ "公司"（zh-TW/zh-CN）
- [ ] 通用規則描述文字不含 "Forwarder"
- [ ] 規則列表頁（`/rules`）的表頭和篩選器同步更新
- [ ] 規則詳情頁（`/rules/[id]`）同步更新

### 提取類型可用性驗證

- [ ] REGEX 和 KEYWORD 正常可用，無額外標記
- [ ] POSITION 和 AI_PROMPT Tab 顯示「開發中」標記
- [ ] POSITION 選中後 Pattern 區域顯示功能開發中提示
- [ ] AI_PROMPT 選中後 Pattern 區域顯示功能開發中提示
- [ ] TEMPLATE 選中後顯示引導連結至模板匹配測試頁
- [ ] 所有類型仍可存為草稿（不阻斷功能）

### 通用驗證

- [ ] TypeScript 類型檢查通過：`npx tsc --noEmit`
- [ ] ESLint 檢查通過：`npm run lint`
- [ ] 瀏覽器 console 無 `IntlError` 錯誤

---

## 修復優先級與順序

```
Step 1: 新增 i18n keys（三個語言檔案）
Step 2: NewRuleForm.tsx — i18n 化 + Forwarder→Company + 提取類型標記
Step 3: RuleTestPanel.tsx — i18n 化
Step 4: page.tsx — i18n 化
Step 5: 更新 rules.json 中現有的 forwarder keys → company
Step 6: 驗證測試
```

---

*文件建立日期: 2026-02-21*
*最後更新: 2026-02-22*
