# Story 0-11: GPT Vision Prompt 優化

**Status:** done

---

## Story

**As a** 系統管理員,
**I want** 優化 GPT Vision 的提取 Prompt，使其在源頭排除非運費內容,
**So that** 減少後續需要過濾的錯誤提取數據，提高整體處理效率和準確性。

---

## 背景說明

### 問題陳述

目前 GPT Vision 處理 Scanned PDF 和 Image 時，提取 Prompt 過於寬鬆，導致：

| 問題 | 說明 | 影響 |
|------|------|------|
| **過度提取** | 將地址區塊、聯絡人資訊都提取為 "term" | 術語聚合階段需要大量過濾 |
| **區域混淆** | 未明確區分 Line Items vs Header/Footer | 地址、公司名混入術語 |
| **缺乏指引** | Prompt 未說明什麼「不應該」提取 | AI 傾向提取所有文字 |

### 現狀分析

**當前 Prompt 的問題**:
```
Extract invoice line items with description and amount...
```

此 Prompt 過於簡單，未指導 AI：
- 哪些區域應該忽略
- 什麼類型的內容不是 line items
- 如何區分地址 vs 運費描述

### 解決方案

優化 GPT Vision Prompt，採用 **結構化指引 + 負面範例** 策略：

1. **區域定義**: 明確定義 Line Items 區域的特徵
2. **排除指引**: 列出不應提取的內容類型
3. **負面範例**: 提供錯誤提取的例子
4. **驗證規則**: 提供自我驗證邏輯

---

## Acceptance Criteria

### AC1: 優化提取 Prompt 設計

**Given** 現有的 GPT Vision 提取服務
**When** 更新提取 Prompt
**Then**
- Prompt 包含明確的區域識別指引
- Prompt 包含排除內容列表（地址、人名、公司名等）
- Prompt 包含正確/錯誤範例
- Prompt 包含自我驗證邏輯

### AC2: 區域識別增強

**Given** 一張運費發票圖片
**When** GPT Vision 分析圖片
**Then**
- 正確識別 Header 區域（發票編號、日期、公司資訊）
- 正確識別 Line Items 區域（費用明細表格）
- 正確識別 Footer 區域（總計、備註、聯絡資訊）
- 只從 Line Items 區域提取術語

### AC3: 負面範例整合

**Given** 過去錯誤提取的案例
**When** 更新 Prompt
**Then**
- 整合 FIX-005 ~ FIX-006 發現的錯誤模式作為負面範例
- 包含機場代碼 + 城市模式 (e.g., "HKG, HONG KONG")
- 包含人名模式 (e.g., "KATHY LAM")
- 包含公司名模式 (e.g., "XXX LIMITED")

### AC4: 效果驗證

**Given** 優化後的 Prompt
**When** 處理測試文件集（20+ 文件）
**Then**
- 錯誤提取率下降 50% 以上
- Line Items 提取準確率維持 90% 以上
- 不影響有效運費術語的提取

---

## Tasks / Subtasks

- [x] **Task 1: 分析現有 Prompt 問題** (AC: #1) ✅
  - [x] 1.1 審查現有 `gpt-vision.service.ts` 的提取 Prompt
  - [x] 1.2 分析 TEST-PLAN-005 中錯誤提取的案例
  - [x] 1.3 整理錯誤模式分類表

- [x] **Task 2: 設計優化 Prompt** (AC: #1, #2) ✅
  - [x] 2.1 設計區域識別指引
  - [x] 2.2 設計排除內容規則
  - [x] 2.3 設計自我驗證邏輯
  - [x] 2.4 整合負面範例

- [x] **Task 3: 實現 Prompt 更新** (AC: #2, #3) ✅
  - [x] 3.1 更新 `gpt-vision.service.ts` 提取 Prompt
  - [x] 3.2 實現區域標記輸出格式
  - [x] 3.3 添加 Prompt 版本管理
  - [x] 3.4 更新相關文檔

- [x] **Task 4: 效果測試與驗證** (AC: #4) ✅
  - [x] 4.1 準備測試數據集（20+ 文件）
  - [x] 4.2 執行 A/B 測試（舊 Prompt vs 新 Prompt）
  - [x] 4.3 統計錯誤提取率變化
  - [x] 4.4 驗證有效術語提取率

- [x] **Task 5: 文檔與監控** ✅
  - [x] 5.1 更新 Prompt 設計文檔
  - [x] 5.2 添加 Prompt 效果監控指標
  - [x] 5.3 建立 Prompt 版本變更記錄

---

## Dev Notes

### 依賴項

- Story 0-8: 文件發行者識別（已完成）- 理解 GPT Vision 現有用法
- FIX-005 ~ FIX-006: 錯誤模式分析資料

### 現有 Prompt 位置

```
src/services/gpt-vision.service.ts
```

### 優化 Prompt 設計

```typescript
const OPTIMIZED_EXTRACTION_PROMPT = `
You are an expert at extracting freight invoice line items. Analyze this invoice image carefully.

## IMPORTANT: What to Extract

ONLY extract from the LINE ITEMS section of the invoice - this is typically a table or list containing:
- Freight charges (e.g., "AIR FREIGHT", "OCEAN FREIGHT")
- Surcharges (e.g., "FUEL SURCHARGE", "SECURITY FEE")
- Service fees (e.g., "HANDLING", "CUSTOMS CLEARANCE")
- Duties and taxes (e.g., "IMPORT DUTY", "VAT")

Each line item should have:
- Description: The charge/fee name
- Amount: The monetary value

## CRITICAL: What NOT to Extract

DO NOT extract content from these areas:
- HEADER: Company logos, invoice numbers, dates, addresses
- SHIPPER/CONSIGNEE: Sender and receiver names, addresses, contact info
- FOOTER: Payment terms, bank details, signatures, total summaries

Specifically EXCLUDE:
❌ Airport codes with cities (e.g., "HKG, HONG KONG", "BLR, BANGALORE")
❌ Person names (e.g., "KATHY LAM", "Nguyen Van Anh")
❌ Company names (e.g., "RICOH ASIA PACIFIC OPERATIONS LIMITED")
❌ Building/street addresses (e.g., "CENTRAL PLAZA TOWER", "123 Main Street")
❌ Contact information (phone numbers, emails)
❌ Reference numbers, tracking codes
❌ "TOTAL", "SUBTOTAL", "GRAND TOTAL" rows

## Self-Verification

Before including a term, verify:
1. Is it from the LINE ITEMS table section? (NOT header/footer)
2. Does it describe a freight charge, fee, or surcharge?
3. Does it have an associated amount?
4. Is it NOT a location, person name, or company name?

## Examples

✅ CORRECT extractions:
- "EXPRESS WORLDWIDE NONDOC" - $150.00
- "FUEL SURCHARGE" - $25.00
- "CUSTOMS CLEARANCE FEE" - $45.00

❌ WRONG extractions (DO NOT include):
- "HKG, HONG KONG" - (This is origin/destination, not a charge)
- "KATHY LAM" - (This is a contact name, not a charge)
- "DHL EXPRESS PTE LTD" - (This is company name, not a charge)

## Output Format

Return JSON:
{
  "lineItems": [
    { "description": "...", "amount": number, "currency": "..." }
  ],
  "metadata": {
    "invoiceRegionsIdentified": ["header", "lineItems", "footer"],
    "extractionConfidence": 0.0-1.0
  }
}
`;
```

### 區域識別視覺指引

```
┌─────────────────────────────────────────────────────┐
│  HEADER REGION - DO NOT EXTRACT                     │
│  ┌───────────────────────────────────────────────┐  │
│  │ DHL LOGO        Invoice #: INV-12345         │  │
│  │                 Date: 2025-01-01              │  │
│  │ From: HKG, HONG KONG  ← IGNORE                │  │
│  │ To: BLR, BANGALORE    ← IGNORE                │  │
│  │ Contact: KATHY LAM    ← IGNORE                │  │
│  └───────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────┤
│  LINE ITEMS REGION - EXTRACT FROM HERE              │
│  ┌───────────────────────────────────────────────┐  │
│  │ Description              │ Amount    │ Currency│  │
│  │─────────────────────────┼───────────┼─────────│  │
│  │ EXPRESS WORLDWIDE NONDOC │ 150.00    │ USD     │ ← EXTRACT  │
│  │ FUEL SURCHARGE           │ 25.00     │ USD     │ ← EXTRACT  │
│  │ CUSTOMS CLEARANCE FEE    │ 45.00     │ USD     │ ← EXTRACT  │
│  └───────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────┤
│  FOOTER REGION - DO NOT EXTRACT                     │
│  ┌───────────────────────────────────────────────┐  │
│  │ SUBTOTAL: 220.00         ← IGNORE              │  │
│  │ TOTAL: 220.00 USD        ← IGNORE              │  │
│  │ Bank: XXX BANK           ← IGNORE              │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### 效果指標定義

| 指標 | 定義 | 目標 |
|------|------|------|
| **錯誤提取率** | 錯誤術語數 / 總提取數 | < 5% (下降 50%+) |
| **有效提取率** | 正確術語數 / 應提取術語數 | > 90% |
| **區域識別準確率** | 正確識別區域 / 總區域數 | > 95% |
| **處理時間** | 平均每文件處理時間 | 無顯著增加 |

### 與 Story 0-10 的關係

```
┌─────────────────────────────────────────────────────────────┐
│ 雙層防護機制                                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Story 0-11: GPT Vision Prompt 優化                         │
│  ↓ (源頭過濾 - 減少錯誤提取)                                │
│                                                             │
│  ↓ 提取結果                                                  │
│                                                             │
│  Story 0-10: AI 術語驗證服務                                 │
│  ↓ (終端驗證 - 捕獲漏網之魚)                                │
│                                                             │
│  ↓ 最終有效術語                                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘

預期效果：
- Story 0-11 在源頭減少 60-70% 錯誤提取
- Story 0-10 捕獲剩餘 20-30% 錯誤
- 最終錯誤率 < 5%
```

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 0.11 |
| Story Key | 0-11-gpt-vision-prompt-optimization |
| Epic | Epic 0: 歷史數據初始化 |
| Dependencies | Story 0-8 (文件發行者識別) |
| Related To | Story 0-10 (AI 術語驗證服務) |
| Estimated Points | 5 |
| Priority | High |
| Type | Enhancement |

---

## Implementation Notes

### 完成摘要 (2025-01-02)

**新增文件**:
- `src/lib/prompts/optimized-extraction-prompt.ts` (375 行)
  - 5 步驟結構化 Prompt (區域識別 → 提取規則 → 排除規則 → 負面範例 → 自我驗證)
  - Prompt 版本管理 (V1.0.0 Legacy / V2.0.0 Optimized)
  - ExcludedItem 追蹤介面

**修改文件**:
- `src/lib/prompts/index.ts` - 導出優化版 Prompt 和版本管理函數
- `src/services/gpt-vision.service.ts` - 整合優化 Prompt，移除舊版常數

**主要功能**:

| 功能 | 說明 |
|------|------|
| **5 步驟 Prompt 結構** | 區域識別 → 提取規則 → 排除規則 → 負面範例 → 自我驗證 |
| **Prompt 版本管理** | `getActiveExtractionPrompt()`, `getPromptByVersion()`, `isPromptVersionExists()` |
| **ExcludedItem 追蹤** | 記錄被排除項目 (text, reason, region) |
| **區域識別** | Header (忽略), Line Items (提取), Footer (忽略) |
| **負面範例整合** | 機場代碼+城市、人名、公司名、地址等排除模式 |

**版本資訊**:
- PROMPT_VERSION: '2.0.0'
- 支援版本: V1.0.0 (Legacy), V2.0.0 (Optimized)

**與 Story 0-10 的雙層防護**:
- Story 0-11 (源頭過濾): 減少 60-70% 錯誤提取
- Story 0-10 (終端驗證): 捕獲剩餘 20-30% 錯誤
- 預期最終錯誤率: < 5%

---

*Story created: 2025-01-01*
*Completed: 2025-01-02*
*Status: done*
