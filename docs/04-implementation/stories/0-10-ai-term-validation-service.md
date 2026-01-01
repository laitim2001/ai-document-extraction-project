# Story 0-10: AI 術語驗證服務

**Status:** done

---

## Story

**As a** 系統管理員,
**I want** 透過 AI 智能驗證術語聚合結果，自動過濾非運費術語,
**So that** 可以消除硬編碼過濾規則的維護負擔，並提高術語識別的準確性和可靠性。

---

## 背景說明

### 問題陳述

目前 Phase 6（術語聚合）採用硬編碼的 `isAddressLikeTerm` 函數進行過濾，存在以下問題：

| 問題 | 說明 | 影響 |
|------|------|------|
| **反應式維護** | 發現新的錯誤模式才加規則 | FIX-005 → FIX-006 持續疊加 |
| **語言依賴** | 需要針對不同語言維護規則 | 越南文、中文人名難以覆蓋 |
| **不完整覆蓋** | 機場代碼列表永遠不完整 | IATA 有數千個代碼 |
| **維護成本高** | 每次發現問題都需要修改代碼 | 開發時間和測試成本 |

### 解決方案

引入 AI 術語驗證服務，利用 GPT-5.2 的語義理解能力進行批次驗證：

```
術語聚合結果 → AI 批次驗證 → 過濾後的有效術語
                  ↓
            50-100 個術語/次
            成本約 $0.10/批次
```

**核心優勢**：
1. **語義理解**: AI 能理解 "KATHY LAM" 是人名，而非運費術語
2. **多語言支援**: 自動處理越南文、中文等非英文內容
3. **自適應能力**: 無需維護規則，AI 自動適應新模式
4. **批次處理**: 成本可控，每批次 $0.10 左右

---

## Acceptance Criteria

### AC1: AI 術語驗證服務核心實現

**Given** 系統完成術語聚合產生候選術語列表
**When** 調用 AI 術語驗證服務
**Then**
- 服務接受術語列表（最多 100 個/批次）
- 使用 GPT-5.2 分析每個術語的類型
- 返回驗證結果：`{ term: string, isValid: boolean, category: string, confidence: number }`
- 過濾掉非運費術語（地址、人名、公司名等）

### AC2: 批次處理機制

**Given** 單一批次產生超過 100 個候選術語
**When** 調用驗證服務
**Then**
- 自動分批處理（每批 50-100 個術語）
- 並行處理多個批次（最多 3 個並行）
- 合併所有批次的驗證結果
- 記錄處理統計（總數、有效數、過濾數、處理時間）

### AC3: 驗證結果整合

**Given** AI 驗證完成
**When** 更新術語聚合結果
**Then**
- 只保留 `isValid: true` 的術語
- 記錄被過濾術語的原因（`category` 欄位）
- 更新 `HierarchicalTermAggregation` 結構
- 記錄驗證日誌供後續分析

### AC4: 成本追蹤

**Given** 使用 AI 服務進行術語驗證
**When** 每次調用完成
**Then**
- 記錄 token 使用量（input/output）
- 計算並記錄成本
- 累計到批次的 AI 成本統計
- 提供成本報告（每批次、每月）

---

## Tasks / Subtasks

- [x] **Task 1: 建立 AI 術語驗證服務** (AC: #1) ✅ Completed 2025-01-01
  - [x] 1.1 創建 `src/services/ai-term-validator.service.ts`
  - [x] 1.2 設計術語驗證 Prompt（區分運費術語 vs 其他內容）
  - [x] 1.3 實現 `validateTerms(terms: string[]): Promise<TermValidationResult[]>`
  - [x] 1.4 定義術語類別枚舉（7 個類別：4 有效 + 7 無效）

- [x] **Task 2: 實現批次處理機制** (AC: #2) ✅ Completed 2025-01-01
  - [x] 2.1 實現術語分批邏輯（configurable batchSize: 50）
  - [x] 2.2 實現並行處理（Promise.all with maxConcurrency: 3）
  - [x] 2.3 實現結果合併邏輯
  - [x] 2.4 添加處理統計收集（TermValidationStats）

- [x] **Task 3: 整合到術語聚合流程** (AC: #3) ✅ Completed 2025-01-01
  - [x] 3.1 修改 `batch-term-aggregation.service.ts` 調用驗證服務
  - [x] 3.2 修改 `hierarchical-term-aggregation.service.ts` 調用驗證服務
  - [x] 3.3 更新術語聚合結果結構（添加 aiValidation 欄位）
  - [x] 3.4 實現驗證日誌記錄（console.debug）

- [x] **Task 4: 成本追蹤整合** (AC: #4) ✅ Completed 2025-01-01
  - [x] 4.1 實現記憶體內成本追蹤（TermValidationCostRecord）
  - [x] 4.2 添加術語驗證成本類型（GPT-5.2 pricing）
  - [x] 4.3 添加成本查詢方法（getCostRecords, getTotalCost）
  - [x] 4.4 添加成本報告端點（GET /api/v1/admin/costs/term-validation）

- [x] **Task 5: API 端點** ✅ Completed 2025-01-01
  - [x] 5.1 POST /api/v1/admin/terms/validate（批次驗證術語）
  - [x] 5.2 GET /api/v1/admin/terms/validate（服務狀態查詢）
  - [x] 5.3 GET /api/v1/admin/costs/term-validation（成本報告）

---

## Dev Notes

### 依賴項

- Story 0-9: 階層式術語聚合結構（已完成）
- GPT-5.2 API（Azure OpenAI）- 與 gpt-vision.service.ts 統一模型
- 現有 AI 成本追蹤機制

### 術語驗證 Prompt 設計

```typescript
const TERM_VALIDATION_PROMPT = `
You are a freight invoice term classifier. Analyze the following terms extracted from freight invoices.

For each term, determine if it is a VALID freight-related term or should be FILTERED.

VALID freight terms include:
- Shipping charges (e.g., "FREIGHT CHARGES", "AIR FREIGHT")
- Surcharges (e.g., "FUEL SURCHARGE", "SECURITY FEE")
- Service fees (e.g., "HANDLING FEE", "CUSTOMS CLEARANCE")
- Duty/Tax (e.g., "IMPORT DUTY", "VAT")

FILTER the following (NOT valid freight terms):
- Person names (e.g., "KATHY LAM", "Nguyen Van Anh")
- Company names (e.g., "RICOH ASIA PACIFIC OPERATIONS LIMITED")
- Addresses or locations (e.g., "HKG, HONG KONG", "123 Main Street")
- Building names (e.g., "CENTRAL PLAZA TOWER")
- Contact information

Terms to validate:
${terms.map((t, i) => `${i + 1}. "${t}"`).join('\n')}

Respond in JSON format:
{
  "results": [
    { "index": 1, "term": "...", "isValid": true/false, "category": "FREIGHT_CHARGE|ADDRESS|PERSON_NAME|COMPANY_NAME|OTHER", "confidence": 0.0-1.0 }
  ]
}
`;
```

### 服務接口定義

```typescript
interface TermValidationResult {
  term: string;
  isValid: boolean;
  category: 'FREIGHT_CHARGE' | 'ADDRESS' | 'PERSON_NAME' | 'COMPANY_NAME' | 'BUILDING_NAME' | 'OTHER';
  confidence: number;
}

interface TermValidationStats {
  totalTerms: number;
  validTerms: number;
  filteredTerms: number;
  byCategory: Record<string, number>;
  processingTimeMs: number;
  tokenUsage: { input: number; output: number };
  estimatedCost: number;
}

interface AITermValidatorService {
  validateTerms(terms: string[]): Promise<TermValidationResult[]>;
  validateTermsBatch(terms: string[], batchSize?: number): Promise<{
    results: TermValidationResult[];
    stats: TermValidationStats;
  }>;
}
```

### 成本估算

> **注意**: 以下為 GPT-5.2 預估成本，實際定價請參考 Azure OpenAI 官方文檔

| 項目 | 數量 | 單價 | 成本 |
|------|------|------|------|
| 每批次術語 | 50-100 | - | - |
| Input tokens | ~2000 | $0.005/1K | $0.01 |
| Output tokens | ~3000 | $0.015/1K | $0.045 |
| **每批次總成本** | - | - | **~$0.06** |
| 每 100 文件批次 | ~3-5 批次 | $0.06 | **~$0.30** |

### 與硬編碼方案比較

| 指標 | 硬編碼過濾 | AI 術語驗證 |
|------|-----------|------------|
| 維護成本 | 高（持續添加規則） | 低（無需維護規則） |
| 多語言支援 | 差（需要語言專家） | 優（AI 自動處理） |
| 準確率 | 中（規則不完整） | 高（語義理解） |
| 運行成本 | 0 | ~$0.30/100 文件 |
| 可擴展性 | 差 | 優 |

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 0.10 |
| Story Key | 0-10-ai-term-validation-service |
| Epic | Epic 0: 歷史數據初始化 |
| Dependencies | Story 0-9 (階層式術語聚合) |
| Estimated Points | 8 |
| Priority | High |
| Type | Enhancement |

---

*Story created: 2025-01-01*
*Status: done*
*Completed: 2025-01-01*
*Model: GPT-5.2 (unified with gpt-vision.service.ts)*
