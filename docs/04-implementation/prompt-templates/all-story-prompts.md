# 全部 Story 開發提示 (方式一：簡短版)

本文檔包含所有 Story 的簡短版開發提示。使用時直接複製對應 Story 的內容貼到 AI 助手對話中。

---

## Epic 00: 歷史數據初始化

> **說明**：此 Epic 在系統正式運營前執行，用於處理歷史發票文件並建立初始映射規則。

### Story 0-1: 批量文件上傳與元數據檢測

```
# 開發任務：Story 0-1 批量文件上傳與元數據檢測

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/0-1-batch-file-upload-metadata-detection.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md
- docs/03-epics/sections/epic-0-historical-data-initialization.md

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

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/0-1-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 0-2: 智能處理路由

```
# 開發任務：Story 0-2 智能處理路由

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/0-2-intelligent-processing-routing.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md
- docs/03-epics/sections/epic-0-historical-data-initialization.md

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
- [ ] 更新 Story 文件：Status 改為 `done`，Tasks 打勾 `[x]`

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 0-3: 即時公司 Profile 建立

```
# 開發任務：Story 0-3 即時公司 Profile 建立（Just-in-Time）

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/0-3-just-in-time-company-profile.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/03-epics/sections/epic-0-historical-data-initialization.md
- claudedocs/4-changes/refactors/REFACTOR-001-forwarder-to-company.md (如存在)

## 開發要求
1. 嚴格遵循 Story 文件中的 Tasks 和 Dev Notes
2. **注意**：此 Story 涉及 Company 模型，需要與 REFACTOR-001 協調
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`
- [ ] 更新 Story 文件

### 3. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 0-4: 批量處理進度追蹤

```
# 開發任務：Story 0-4 批量處理進度追蹤

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/0-4-batch-processing-progress-tracking.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/03-epics/sections/epic-0-historical-data-initialization.md

## 開發要求
1. 嚴格遵循 Story 文件中的 Tasks 和 Dev Notes
2. 實現即時更新機制（推薦 SSE）
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`
- [ ] 更新 Story 文件

### 3. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 0-5: 術語聚合與初始規則建立

```
# 開發任務：Story 0-5 術語聚合與初始規則建立

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/0-5-term-aggregation-initial-rules.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/03-epics/sections/epic-0-historical-data-initialization.md
- docs/04-implementation/stories/4-1-mapping-rule-list-view.md (規則模型參考)

## 開發要求
1. 嚴格遵循 Story 文件中的 Tasks 和 Dev Notes
2. GPT-5.2 分類需注意 token 限制，使用批量處理
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`
- [ ] 更新 Story 文件

### 3. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 0-6: 批量處理公司識別整合

```
# 開發任務：Story 0-6 批量處理公司識別整合

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/0-6-batch-company-integration.md
3. docs/04-implementation/tech-specs/epic-00-historical-data/tech-spec-story-0-6.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/03-epics/sections/epic-0-historical-data-initialization.md
- src/services/company-auto-create.service.ts (現有公司識別服務)
- src/services/company-matcher.service.ts (三層匹配策略)
- src/services/batch-processor.service.ts (需整合目標)

## 開發要求
1. 嚴格遵循 Tech Spec 中的整合模式
2. 在 batch-processor.service.ts 中呼叫現有的 company-auto-create.service
3. 公司識別失敗不應中斷主處理流程（錯誤降級處理）
4. 新增的 API 需更新 api-registry.md
5. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**

## 關鍵整合點
- 修改 `processFile()` 方法，在 OCR 完成後呼叫 `identifyCompaniesFromExtraction()`
- 擴展 HistoricalBatch 和 HistoricalFile 模型添加公司識別相關欄位
- 建立 `/api/admin/historical-data/[batchId]/company-stats` API

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過
- [ ] Prisma migration 成功執行

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`
- [ ] 更新 Story 文件

### 3. 功能驗證
- [ ] 批量處理時自動識別公司（不中斷主流程）
- [ ] 公司統計 API 正確返回數據
- [ ] UI 正確顯示公司識別配置選項

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 0-7: 批量處理術語聚合整合

```
# 開發任務：Story 0-7 批量處理術語聚合整合

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/0-7-batch-term-aggregation-integration.md
3. docs/04-implementation/tech-specs/epic-00-historical-data/tech-spec-story-0-7.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/03-epics/sections/epic-0-historical-data-initialization.md
- src/services/term-aggregation.service.ts (現有術語聚合服務)
- src/services/batch-processor.service.ts (需整合目標)
- docs/04-implementation/stories/0-6-batch-company-integration.md (前置依賴)

## 開發要求
1. 嚴格遵循 Tech Spec 中的整合模式
2. 批量處理完成後自動觸發術語聚合（如果啟用）
3. 擴展 BatchStatus 枚舉添加 AGGREGATING、AGGREGATED 狀態
4. 術語需按公司分組統計
5. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**

## 關鍵整合點
- 建立 `onBatchComplete()` 觸發機制
- 建立 `TermAggregationResult` Prisma 模型儲存聚合結果
- 修改 `term-aggregation.service.ts` 支援按公司分組 (`groupByCompany: true`)
- 建立 `/api/admin/historical-data/[batchId]/term-stats` API

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過
- [ ] Prisma migration 成功執行

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`
- [ ] 更新 Story 文件

### 3. 功能驗證
- [ ] 批量完成後自動觸發術語聚合
- [ ] 聚合結果正確按公司分組
- [ ] UI 正確顯示術語統計摘要

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 0-8: 文件發行者識別

```
# 開發任務：Story 0-8 文件發行者識別

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/0-8-document-issuer-identification.md
3. docs/04-implementation/tech-specs/epic-00-historical-data/tech-spec-story-0-8.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/03-epics/sections/epic-0-historical-data-initialization.md
- src/services/company-matcher.service.ts (公司匹配服務)
- src/services/batch-processor.service.ts (批量處理服務)
- docs/04-implementation/stories/0-6-batch-company-integration.md (前置依賴)

## 開發要求
1. 嚴格遵循 Tech Spec 中的 GPT Vision Prompt 設計
2. 使用 Azure OpenAI GPT-5.2 Vision 識別文件發行者（從 Logo/標題/頁首）
3. 區分「文件發行者」與「交易對象」（vendor/shipper/consignee）
4. 實現三層公司匹配策略（Exact > Variant > Fuzzy）
5. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**

## 關鍵整合點
- 擴展 GPT Vision Prompt 添加 `DOCUMENT_ISSUER_PROMPT`
- 創建 `IssuerIdentificationMethod` enum (LOGO, HEADER, LETTERHEAD, FOOTER, AI_INFERENCE)
- 創建 `FileTransactionParty` 模型（多對多關聯）
- 擴展 `HistoricalFile` 添加 `documentIssuerId`、`issuerIdentificationMethod`、`issuerConfidence`
- 創建 `src/services/document-issuer.service.ts`

## 核心邏輯
文件發行者 ≠ 交易對象
- documentIssuer: 發出文件的公司（如 DHL 發出的發票，發行者是 DHL）
- vendor/shipper/consignee: 交易相關方（客戶、托運人、收貨人）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過
- [ ] Prisma migration 成功執行

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`
- [ ] 更新 Story 文件

### 3. 功能驗證
- [ ] GPT Vision 正確識別文件發行者（從 Logo/標題）
- [ ] 發行者與交易對象正確區分儲存
- [ ] 三層公司匹配策略正確運作
- [ ] 批量處理整合正確

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 0-9: 文件格式識別與術語重組

```
# 開發任務：Story 0-9 文件格式識別與術語重組

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/0-9-document-format-term-reorganization.md
3. docs/04-implementation/tech-specs/epic-00-historical-data/tech-spec-story-0-9.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/03-epics/sections/epic-0-historical-data-initialization.md
- src/services/batch-term-aggregation.service.ts (現有術語聚合服務)
- docs/04-implementation/stories/0-7-batch-term-aggregation-integration.md (前置依賴)
- docs/04-implementation/stories/0-8-document-issuer-identification.md (前置依賴)

## 開發要求
1. 嚴格遵循 Tech Spec 中的三層聚合架構
2. 使用 Azure OpenAI GPT-5.2 Vision 識別文件類型和子類型
3. 使用 GPT-nano 進行術語分類
4. 建立「公司 → 文件格式 → 術語」三層數據結構
5. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**

## 關鍵整合點
- 擴展 GPT Vision Prompt 添加 `DOCUMENT_FORMAT_PROMPT`
- 創建 `DocumentType` enum (INVOICE, DEBIT_NOTE, CREDIT_NOTE, 等)
- 創建 `DocumentSubtype` enum (OCEAN_FREIGHT, AIR_FREIGHT, 等)
- 創建 `DocumentFormat` Prisma 模型
- 擴展 `HistoricalFile` 添加 `documentFormatId`
- 創建 `src/services/document-format.service.ts`
- 創建 `src/services/hierarchical-term-aggregation.service.ts`

## 三層聚合結構
```
Company (發行公司)
├── DocumentFormat (文件格式)
│   ├── Term (術語)
│   ├── Term
│   └── ...
├── DocumentFormat
│   ├── Term
│   └── ...
└── ...
```

範例：
```
DHL Express
├── Ocean Freight Invoice
│   ├── BAF (Bunker Adjustment Factor)
│   ├── THC (Terminal Handling Charge)
│   └── DOC FEE
└── Air Freight Invoice
    ├── AWB FEE
    ├── FSC (Fuel Surcharge)
    └── HANDLING FEE
```

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過
- [ ] Prisma migration 成功執行

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`
- [ ] 更新 Story 文件

### 3. 功能驗證
- [ ] GPT Vision 正確識別文件類型和子類型
- [ ] DocumentFormat 記錄正確創建和關聯
- [ ] 三層術語聚合結構正確
- [ ] UI 樹狀結構正確顯示

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 0-10: AI 術語驗證服務

```
# 開發任務：Story 0-10 AI 術語驗證服務

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/0-10-ai-term-validation-service.md
3. docs/04-implementation/tech-specs/epic-00-historical-data/tech-spec-story-0-10.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/03-epics/sections/epic-0-historical-data-initialization.md
- src/services/batch-term-aggregation.service.ts (現有術語聚合服務)
- src/services/hierarchical-term-aggregation.service.ts (階層式術語聚合)
- src/services/ai-cost.service.ts (AI 成本追蹤)
- claudedocs/4-changes/bug-fixes/FIX-005-*.md (地址過濾問題)
- claudedocs/4-changes/bug-fixes/FIX-006-*.md (人名過濾問題)

## 開發要求
1. 嚴格遵循 Tech Spec 中的 AI 術語驗證 Prompt 設計
2. 使用 Azure OpenAI GPT-4o 進行批次術語驗證（50-100 術語/批次）
3. 實現術語分類：FREIGHT_CHARGE, SURCHARGE, SERVICE_FEE, DUTY_TAX (有效) / ADDRESS, PERSON_NAME, COMPANY_NAME 等 (無效)
4. 整合成本追蹤機制（~$0.11/批次）
5. 保留現有 `isAddressLikeTerm` 作為回退機制
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**

## 關鍵整合點
- 創建 `src/services/ai-term-validator.service.ts`
- 創建 `src/types/term-validation.ts` (TermValidationResult, TermCategory, TermValidationStats)
- 修改 `batch-term-aggregation.service.ts` 整合 AI 驗證
- 修改 `hierarchical-term-aggregation.service.ts` 整合 AI 驗證
- 創建 API: `POST /api/v1/admin/terms/validate`
- 創建 API: `GET /api/v1/admin/costs/term-validation`

## 核心邏輯
```
術語聚合結果 → AI 批次驗證 (GPT-4o) → 過濾後的有效術語
                    ↓
              50-100 術語/批次
              最多 3 個並行批次
              成本約 $0.11/批次
```

## 術語分類邏輯
✅ 有效術語類型：
- FREIGHT_CHARGE (運費): AIR FREIGHT, OCEAN FREIGHT
- SURCHARGE (附加費): FUEL SURCHARGE, BAF, CAF
- SERVICE_FEE (服務費): HANDLING FEE, DOC FEE
- DUTY_TAX (關稅/稅項): IMPORT DUTY, VAT

❌ 無效術語類型（需過濾）：
- ADDRESS: 地址相關
- PERSON_NAME: 人名
- COMPANY_NAME: 公司名
- BUILDING_NAME: 建築物名
- AIRPORT_CODE: 機場代碼 + 城市 (如 "HKG, HONG KONG")
- REFERENCE: 參考編號

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`
- [ ] 更新 Story 文件

### 3. 功能驗證
- [ ] AI 術語驗證服務正確分類術語
- [ ] 批次處理機制正常（50-100 術語/批次）
- [ ] 成本追蹤正確記錄 token 使用量和費用
- [ ] 回退機制正常運作（當 AI 服務失敗時）
- [ ] 術語聚合流程正確整合 AI 驗證

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 0-11: GPT Vision Prompt 優化

```
# 開發任務：Story 0-11 GPT Vision Prompt 優化

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/0-11-gpt-vision-prompt-optimization.md
3. docs/04-implementation/tech-specs/epic-00-historical-data/tech-spec-story-0-11.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/03-epics/sections/epic-0-historical-data-initialization.md
- src/services/gpt-vision.service.ts (現有 GPT Vision 服務)
- claudedocs/4-changes/bug-fixes/FIX-005-*.md (地址過濾問題的錯誤模式)
- claudedocs/4-changes/bug-fixes/FIX-006-*.md (人名過濾問題的錯誤模式)
- docs/04-implementation/stories/0-10-ai-term-validation-service.md (雙層防護機制)

## 開發要求
1. 嚴格遵循 Tech Spec 中的優化 Prompt 設計（5 步驟結構）
2. 實現區域識別指引（Header / Line Items / Footer）
3. 整合負面範例（FIX-005 ~ FIX-006 發現的錯誤模式）
4. 實現自我驗證邏輯
5. 添加 Prompt 版本管理機制
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**

## 關鍵整合點
- 修改 `src/services/gpt-vision.service.ts` 的 `LINE_ITEMS_EXTRACTION_PROMPT`
- 添加 `PROMPT_VERSION` 常數（版本管理）
- 添加 `ExcludedItem` 介面（追蹤被排除的項目）
- 可選：添加 A/B 測試機制

## 優化 Prompt 結構（5 步驟）
```
1. ROLE DEFINITION (角色定義)
   └─ 明確 AI 的專業角色和任務目標

2. REGION IDENTIFICATION (區域識別)
   └─ Header: 公司資訊、發票編號、日期 → 不提取
   └─ Line Items: 費用明細表格 → 提取
   └─ Footer: 總計、付款資訊 → 不提取

3. EXTRACTION RULES (提取規則)
   ✅ 提取: FREIGHT CHARGES, SURCHARGES, SERVICE FEES, DUTY/TAX
   ❌ 排除: 地址、人名、公司名、機場代碼+城市

4. NEGATIVE EXAMPLES (負面範例)
   ❌ "HKG, HONG KONG" - 機場代碼+城市，不是運費
   ❌ "KATHY LAM" - 人名，不是運費
   ❌ "DHL EXPRESS PTE LTD" - 公司名，不是運費

5. SELF-VERIFICATION (自我驗證)
   □ 是否來自 Line Items 區域？
   □ 是否描述運費/附加費/服務費？
   □ 是否有關聯金額？
   □ 不是地址/人名/公司名？
```

## 與 Story 0-10 的關係（雙層防護機制）
```
Story 0-11 (源頭過濾) → 在提取階段減少 60-70% 錯誤
        ↓
Story 0-10 (終端驗證) → 捕獲剩餘 20-30% 錯誤
        ↓
最終錯誤率 < 5%
```

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`
- [ ] 更新 Story 文件

### 3. 功能驗證
- [ ] 優化 Prompt 正確識別發票區域
- [ ] 負面範例有效排除錯誤內容
- [ ] 自我驗證邏輯正常運作
- [ ] Prompt 版本管理機制正常
- [ ] 效果測試：錯誤提取率下降 50%+

### 4. A/B 測試（可選）
- [ ] 準備 20+ 測試文件
- [ ] 執行舊 Prompt vs 新 Prompt 對比
- [ ] 統計並記錄效果差異

### 5. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

## Epic 01: 用戶認證與權限管理

### Story 1-0: 專案初始化

```
# 開發任務：Story 1-0 專案初始化

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/1-0-project-init-foundation.md
3. docs/04-implementation/tech-specs/epic-01-auth/tech-spec-story-1-0.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 1-1: Azure AD SSO 登入

```
# 開發任務：Story 1-1 Azure AD SSO 登入

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/1-1-azure-ad-sso-login.md
3. docs/04-implementation/tech-specs/epic-01-auth/tech-spec-story-1-1.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 1-2: 用戶資料庫與角色基礎

```
# 開發任務：Story 1-2 用戶資料庫與角色基礎

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/1-2-user-database-role-foundation.md
3. docs/04-implementation/tech-specs/epic-01-auth/tech-spec-story-1-2.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 1-3: 用戶列表與搜尋

```
# 開發任務：Story 1-3 用戶列表與搜尋

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/1-3-user-list-search.md
3. docs/04-implementation/tech-specs/epic-01-auth/tech-spec-story-1-3.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 1-4: 新增用戶與角色分配

```
# 開發任務：Story 1-4 新增用戶與角色分配

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/1-4-add-user-role-assignment.md
3. docs/04-implementation/tech-specs/epic-01-auth/tech-spec-story-1-4.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 1-5: 修改用戶角色與城市

```
# 開發任務：Story 1-5 修改用戶角色與城市

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/1-5-modify-user-role-city.md
3. docs/04-implementation/tech-specs/epic-01-auth/tech-spec-story-1-5.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 1-6: 停用/啟用用戶帳號

```
# 開發任務：Story 1-6 停用/啟用用戶帳號

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/1-6-disable-enable-user-account.md
3. docs/04-implementation/tech-specs/epic-01-auth/tech-spec-story-1-6.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 1-7: 自訂角色管理

```
# 開發任務：Story 1-7 自訂角色管理

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/1-7-custom-role-management.md
3. docs/04-implementation/tech-specs/epic-01-auth/tech-spec-story-1-7.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 1-8: 城市管理員用戶管理

```
# 開發任務：Story 1-8 城市管理員用戶管理

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/1-8-city-manager-user-management.md
3. docs/04-implementation/tech-specs/epic-01-auth/tech-spec-story-1-8.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

## Epic 02: 文件上傳與 AI 處理

### Story 2-1: 文件上傳介面與驗證

```
# 開發任務：Story 2-1 文件上傳介面與驗證

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/2-1-file-upload-interface-validation.md
3. docs/04-implementation/tech-specs/epic-02-ai-processing/tech-spec-story-2-1.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 2-2: 文件 OCR 擷取服務

```
# 開發任務：Story 2-2 文件 OCR 擷取服務

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/2-2-file-ocr-extraction-service.md
3. docs/04-implementation/tech-specs/epic-02-ai-processing/tech-spec-story-2-2.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 2-3: 貨代商自動識別

```
# 開發任務：Story 2-3 貨代商自動識別

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/2-3-forwarder-auto-identification.md
3. docs/04-implementation/tech-specs/epic-02-ai-processing/tech-spec-story-2-3.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 2-4: 欄位映射擷取

```
# 開發任務：Story 2-4 欄位映射擷取

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/2-4-field-mapping-extraction.md
3. docs/04-implementation/tech-specs/epic-02-ai-processing/tech-spec-story-2-4.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 2-5: 信心分數計算

```
# 開發任務：Story 2-5 信心分數計算

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/2-5-confidence-score-calculation.md
3. docs/04-implementation/tech-specs/epic-02-ai-processing/tech-spec-story-2-5.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 2-6: 處理路徑自動路由

```
# 開發任務：Story 2-6 處理路徑自動路由

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/2-6-processing-path-auto-routing.md
3. docs/04-implementation/tech-specs/epic-02-ai-processing/tech-spec-story-2-6.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 2-7: 處理狀態追蹤顯示

```
# 開發任務：Story 2-7 處理狀態追蹤顯示

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/2-7-processing-status-tracking-display.md
3. docs/04-implementation/tech-specs/epic-02-ai-processing/tech-spec-story-2-7.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

## Epic 03: 人工審核工作流程

### Story 3-1: 待審核發票列表

```
# 開發任務：Story 3-1 待審核發票列表

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/3-1-pending-review-invoice-list.md
3. docs/04-implementation/tech-specs/epic-03-review-workflow/tech-spec-story-3-1.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 3-2: 並排 PDF 審核介面

```
# 開發任務：Story 3-2 並排 PDF 審核介面

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/3-2-side-by-side-pdf-review-interface.md
3. docs/04-implementation/tech-specs/epic-03-review-workflow/tech-spec-story-3-2.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 3-3: 信心度顏色編碼顯示

```
# 開發任務：Story 3-3 信心度顏色編碼顯示

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/3-3-confidence-color-coding-display.md
3. docs/04-implementation/tech-specs/epic-03-review-workflow/tech-spec-story-3-3.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 3-4: 確認擷取結果

```
# 開發任務：Story 3-4 確認擷取結果

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/3-4-confirm-extraction-result.md
3. docs/04-implementation/tech-specs/epic-03-review-workflow/tech-spec-story-3-4.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 3-5: 修正擷取結果

```
# 開發任務：Story 3-5 修正擷取結果

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/3-5-correct-extraction-result.md
3. docs/04-implementation/tech-specs/epic-03-review-workflow/tech-spec-story-3-5.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 3-6: 修正類型標記

```
# 開發任務：Story 3-6 修正類型標記

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/3-6-correction-type-marking.md
3. docs/04-implementation/tech-specs/epic-03-review-workflow/tech-spec-story-3-6.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 3-7: 升級複雜案例

```
# 開發任務：Story 3-7 升級複雜案例

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/3-7-escalate-complex-cases.md
3. docs/04-implementation/tech-specs/epic-03-review-workflow/tech-spec-story-3-7.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 3-8: Super User 處理升級案例

```
# 開發任務：Story 3-8 Super User 處理升級案例

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/3-8-super-user-handle-escalated-cases.md
3. docs/04-implementation/tech-specs/epic-03-review-workflow/tech-spec-story-3-8.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

## Epic 04: 映射規則管理

### Story 4-1: 映射規則列表檢視

```
# 開發任務：Story 4-1 映射規則列表檢視

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/4-1-mapping-rule-list-view.md
3. docs/04-implementation/tech-specs/epic-04-mapping-rules/tech-spec-story-4-1.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 4-2: 建議新映射規則

```
# 開發任務：Story 4-2 建議新映射規則

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/4-2-suggest-new-mapping-rule.md
3. docs/04-implementation/tech-specs/epic-04-mapping-rules/tech-spec-story-4-2.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 4-3: 修正模式記錄分析

```
# 開發任務：Story 4-3 修正模式記錄分析

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/4-3-correction-pattern-recording-analysis.md
3. docs/04-implementation/tech-specs/epic-04-mapping-rules/tech-spec-story-4-3.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 4-4: 規則升級建議生成

```
# 開發任務：Story 4-4 規則升級建議生成

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/4-4-rule-upgrade-suggestion-generation.md
3. docs/04-implementation/tech-specs/epic-04-mapping-rules/tech-spec-story-4-4.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 4-5: 規則影響範圍分析

```
# 開發任務：Story 4-5 規則影響範圍分析

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/4-5-rule-impact-scope-analysis.md
3. docs/04-implementation/tech-specs/epic-04-mapping-rules/tech-spec-story-4-5.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 4-6: 審核學習規則

```
# 開發任務：Story 4-6 審核學習規則

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/4-6-review-learning-rule.md
3. docs/04-implementation/tech-specs/epic-04-mapping-rules/tech-spec-story-4-6.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 4-7: 規則版本歷史管理

```
# 開發任務：Story 4-7 規則版本歷史管理

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/4-7-rule-version-history-management.md
3. docs/04-implementation/tech-specs/epic-04-mapping-rules/tech-spec-story-4-7.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 4-8: 規則自動回滾

```
# 開發任務：Story 4-8 規則自動回滾

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/4-8-rule-auto-rollback.md
3. docs/04-implementation/tech-specs/epic-04-mapping-rules/tech-spec-story-4-8.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

## Epic 05: 貨代商設定管理

### Story 5-1: 貨代商配置檔列表

```
# 開發任務：Story 5-1 貨代商配置檔列表

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/5-1-forwarder-profile-list.md
3. docs/04-implementation/tech-specs/epic-05-forwarder-config/tech-spec-story-5-1.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 5-2: 貨代商詳細設定檢視

```
# 開發任務：Story 5-2 貨代商詳細設定檢視

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/5-2-forwarder-detail-config-view.md
3. docs/04-implementation/tech-specs/epic-05-forwarder-config/tech-spec-story-5-2.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 5-3: 編輯貨代商映射規則

```
# 開發任務：Story 5-3 編輯貨代商映射規則

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/5-3-edit-forwarder-mapping-rules.md
3. docs/04-implementation/tech-specs/epic-05-forwarder-config/tech-spec-story-5-3.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 5-4: 測試規則變更效果

```
# 開發任務：Story 5-4 測試規則變更效果

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/5-4-test-rule-change-effect.md
3. docs/04-implementation/tech-specs/epic-05-forwarder-config/tech-spec-story-5-4.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 5-5: 新增/停用貨代商配置

```
# 開發任務：Story 5-5 新增/停用貨代商配置

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/5-5-add-disable-forwarder-profile.md
3. docs/04-implementation/tech-specs/epic-05-forwarder-config/tech-spec-story-5-5.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

## Epic 06: 多城市資料隔離

### Story 6-1: 城市資料模型與 RLS 設定

```
# 開發任務：Story 6-1 城市資料模型與 RLS 設定

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/6-1-city-data-model-rls-config.md
3. docs/04-implementation/tech-specs/epic-06-multi-city/tech-spec-story-6-1.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 6-2: 城市用戶資料存取控制

```
# 開發任務：Story 6-2 城市用戶資料存取控制

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/6-2-city-user-data-access-control.md
3. docs/04-implementation/tech-specs/epic-06-multi-city/tech-spec-story-6-2.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 6-3: 區域經理跨城市存取

```
# 開發任務：Story 6-3 區域經理跨城市存取

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/6-3-regional-manager-cross-city-access.md
3. docs/04-implementation/tech-specs/epic-06-multi-city/tech-spec-story-6-3.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 6-4: Global Admin 完整存取

```
# 開發任務：Story 6-4 Global Admin 完整存取

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/6-4-global-admin-full-access.md
3. docs/04-implementation/tech-specs/epic-06-multi-city/tech-spec-story-6-4.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 6-5: 全域規則共享機制

```
# 開發任務：Story 6-5 全域規則共享機制

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/6-5-global-rule-sharing-mechanism.md
3. docs/04-implementation/tech-specs/epic-06-multi-city/tech-spec-story-6-5.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

## Epic 07: 報表與儀表板

### Story 7-1: 處理統計儀表板

```
# 開發任務：Story 7-1 處理統計儀表板

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/7-1-processing-statistics-dashboard.md
3. docs/04-implementation/tech-specs/epic-07-reports-dashboard/tech-spec-story-7-1.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 7-2: 時間範圍篩選器

```
# 開發任務：Story 7-2 時間範圍篩選器

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/7-2-time-range-filter.md
3. docs/04-implementation/tech-specs/epic-07-reports-dashboard/tech-spec-story-7-2.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 7-3: 貨代商篩選器

```
# 開發任務：Story 7-3 貨代商篩選器

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/7-3-forwarder-filter.md
3. docs/04-implementation/tech-specs/epic-07-reports-dashboard/tech-spec-story-7-3.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 7-4: 費用明細報表匯出

```
# 開發任務：Story 7-4 費用明細報表匯出

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/7-4-expense-detail-report-export.md
3. docs/04-implementation/tech-specs/epic-07-reports-dashboard/tech-spec-story-7-4.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 7-5: 跨城市匯總報表

```
# 開發任務：Story 7-5 跨城市匯總報表

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/7-5-cross-city-summary-report.md
3. docs/04-implementation/tech-specs/epic-07-reports-dashboard/tech-spec-story-7-5.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 7-6: AI API 使用成本顯示

```
# 開發任務：Story 7-6 AI API 使用成本顯示

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/7-6-ai-api-usage-cost-display.md
3. docs/04-implementation/tech-specs/epic-07-reports-dashboard/tech-spec-story-7-6.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 7-7: 城市處理量追蹤

```
# 開發任務：Story 7-7 城市處理量追蹤

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/7-7-city-processing-volume-tracking.md
3. docs/04-implementation/tech-specs/epic-07-reports-dashboard/tech-spec-story-7-7.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 7-8: 城市 AI 成本追蹤

```
# 開發任務：Story 7-8 城市 AI 成本追蹤

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/7-8-city-ai-cost-tracking.md
3. docs/04-implementation/tech-specs/epic-07-reports-dashboard/tech-spec-story-7-8.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 7-9: 城市成本報表

```
# 開發任務：Story 7-9 城市成本報表

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/7-9-city-cost-report.md
3. docs/04-implementation/tech-specs/epic-07-reports-dashboard/tech-spec-story-7-9.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 7-10: 月度成本分攤報表

```
# 開發任務：Story 7-10 月度成本分攤報表

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/7-10-monthly-cost-allocation-report.md
3. docs/04-implementation/tech-specs/epic-07-reports-dashboard/tech-spec-story-7-10.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

## Epic 08: 稽核與合規

### Story 8-1: 用戶操作日誌記錄

```
# 開發任務：Story 8-1 用戶操作日誌記錄

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/8-1-user-operation-log-recording.md
3. docs/04-implementation/tech-specs/epic-08-audit-compliance/tech-spec-story-8-1.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 8-2: 資料變更追蹤

```
# 開發任務：Story 8-2 資料變更追蹤

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/8-2-data-change-tracking.md
3. docs/04-implementation/tech-specs/epic-08-audit-compliance/tech-spec-story-8-2.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 8-3: 處理記錄查詢

```
# 開發任務：Story 8-3 處理記錄查詢

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/8-3-processing-record-query.md
3. docs/04-implementation/tech-specs/epic-08-audit-compliance/tech-spec-story-8-3.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 8-4: 原始文件追溯

```
# 開發任務：Story 8-4 原始文件追溯

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/8-4-original-file-traceability.md
3. docs/04-implementation/tech-specs/epic-08-audit-compliance/tech-spec-story-8-4.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 8-5: 稽核報表匯出

```
# 開發任務：Story 8-5 稽核報表匯出

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/8-5-audit-report-export.md
3. docs/04-implementation/tech-specs/epic-08-audit-compliance/tech-spec-story-8-5.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 8-6: 長期資料保留

```
# 開發任務：Story 8-6 長期資料保留

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/8-6-long-term-data-retention.md
3. docs/04-implementation/tech-specs/epic-08-audit-compliance/tech-spec-story-8-6.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

## Epic 09: 自動化檔案擷取

### Story 9-1: SharePoint 文件監控 API

```
# 開發任務：Story 9-1 SharePoint 文件監控 API

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/9-1-sharepoint-file-monitoring-api.md
3. docs/04-implementation/tech-specs/epic-09-auto-retrieval/tech-spec-story-9-1.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 9-2: SharePoint 連線設定

```
# 開發任務：Story 9-2 SharePoint 連線設定

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/9-2-sharepoint-connection-config.md
3. docs/04-implementation/tech-specs/epic-09-auto-retrieval/tech-spec-story-9-2.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 9-3: Outlook 郵件附件擷取 API

```
# 開發任務：Story 9-3 Outlook 郵件附件擷取 API

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/9-3-outlook-mail-attachment-extraction-api.md
3. docs/04-implementation/tech-specs/epic-09-auto-retrieval/tech-spec-story-9-3.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 9-4: Outlook 連線設定

```
# 開發任務：Story 9-4 Outlook 連線設定

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/9-4-outlook-connection-config.md
3. docs/04-implementation/tech-specs/epic-09-auto-retrieval/tech-spec-story-9-4.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 9-5: 自動擷取來源追蹤

```
# 開發任務：Story 9-5 自動擷取來源追蹤

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/9-5-auto-retrieval-source-tracking.md
3. docs/04-implementation/tech-specs/epic-09-auto-retrieval/tech-spec-story-9-5.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

## Epic 10: n8n 工作流程整合

### Story 10-1: n8n 雙向通訊 API

```
# 開發任務：Story 10-1 n8n 雙向通訊 API

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/10-1-n8n-bidirectional-communication-api.md
3. docs/04-implementation/tech-specs/epic-10-n8n-integration/tech-spec-story-10-1.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 10-2: Webhook 設定管理

```
# 開發任務：Story 10-2 Webhook 設定管理

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/10-2-webhook-config-management.md
3. docs/04-implementation/tech-specs/epic-10-n8n-integration/tech-spec-story-10-2.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 10-3: 工作流程執行狀態檢視

```
# 開發任務：Story 10-3 工作流程執行狀態檢視

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/10-3-workflow-execution-status-view.md
3. docs/04-implementation/tech-specs/epic-10-n8n-integration/tech-spec-story-10-3.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 10-4: 手動觸發工作流程

```
# 開發任務：Story 10-4 手動觸發工作流程

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/10-4-manual-trigger-workflow.md
3. docs/04-implementation/tech-specs/epic-10-n8n-integration/tech-spec-story-10-4.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 10-5: 工作流程錯誤詳情檢視

```
# 開發任務：Story 10-5 工作流程錯誤詳情檢視

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/10-5-workflow-error-detail-view.md
3. docs/04-implementation/tech-specs/epic-10-n8n-integration/tech-spec-story-10-5.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 10-6: 文件處理進度追蹤

```
# 開發任務：Story 10-6 文件處理進度追蹤

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/10-6-document-processing-progress-tracking.md
3. docs/04-implementation/tech-specs/epic-10-n8n-integration/tech-spec-story-10-6.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 10-7: n8n 連線狀態監控

```
# 開發任務：Story 10-7 n8n 連線狀態監控

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/10-7-n8n-connection-status-monitoring.md
3. docs/04-implementation/tech-specs/epic-10-n8n-integration/tech-spec-story-10-7.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

## Epic 11: 外部 API 服務

### Story 11-1: API 發票提交端點

```
# 開發任務：Story 11-1 API 發票提交端點

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/11-1-api-invoice-submission-endpoint.md
3. docs/04-implementation/tech-specs/epic-11-external-api/tech-spec-story-11-1.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 11-2: API 處理狀態查詢端點

```
# 開發任務：Story 11-2 API 處理狀態查詢端點

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/11-2-api-processing-status-query-endpoint.md
3. docs/04-implementation/tech-specs/epic-11-external-api/tech-spec-story-11-2.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 11-3: API 處理結果擷取端點

```
# 開發任務：Story 11-3 API 處理結果擷取端點

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/11-3-api-processing-result-retrieval-endpoint.md
3. docs/04-implementation/tech-specs/epic-11-external-api/tech-spec-story-11-3.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 11-4: Webhook 通知服務

```
# 開發任務：Story 11-4 Webhook 通知服務

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/11-4-webhook-notification-service.md
3. docs/04-implementation/tech-specs/epic-11-external-api/tech-spec-story-11-4.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 11-5: API 存取控制與認證

```
# 開發任務：Story 11-5 API 存取控制與認證

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/11-5-api-access-control-authentication.md
3. docs/04-implementation/tech-specs/epic-11-external-api/tech-spec-story-11-5.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 11-6: API 文件與開發者支援

```
# 開發任務：Story 11-6 API 文件與開發者支援

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/11-6-api-documentation-developer-support.md
3. docs/04-implementation/tech-specs/epic-11-external-api/tech-spec-story-11-6.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

## Epic 12: 系統管理與監控

### Story 12-1: 系統健康監控儀表板

```
# 開發任務：Story 12-1 系統健康監控儀表板

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/12-1-system-health-monitoring-dashboard.md
3. docs/04-implementation/tech-specs/epic-12-system-admin/tech-spec-story-12-1.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 12-2: 效能指標追蹤

```
# 開發任務：Story 12-2 效能指標追蹤

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/12-2-performance-metrics-tracking.md
3. docs/04-implementation/tech-specs/epic-12-system-admin/tech-spec-story-12-2.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 12-3: 錯誤警報設定

```
# 開發任務：Story 12-3 錯誤警報設定

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/12-3-error-alert-configuration.md
3. docs/04-implementation/tech-specs/epic-12-system-admin/tech-spec-story-12-3.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 12-4: 系統設定管理

```
# 開發任務：Story 12-4 系統設定管理

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/12-4-system-configuration-management.md
3. docs/04-implementation/tech-specs/epic-12-system-admin/tech-spec-story-12-4.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 12-5: 資料備份管理

```
# 開發任務：Story 12-5 資料備份管理

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/12-5-data-backup-management.md
3. docs/04-implementation/tech-specs/epic-12-system-admin/tech-spec-story-12-5.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 12-6: 資料復原功能

```
# 開發任務：Story 12-6 資料復原功能

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/12-6-data-recovery-functionality.md
3. docs/04-implementation/tech-specs/epic-12-system-admin/tech-spec-story-12-6.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 12-7: 系統日誌查詢

```
# 開發任務：Story 12-7 系統日誌查詢

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/12-7-system-log-query.md
3. docs/04-implementation/tech-specs/epic-12-system-admin/tech-spec-story-12-7.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

## Epic 13: 文件預覽與欄位映射

> **說明**：此 Epic 提供文件預覽、欄位高亮、提取結果顯示及動態欄位映射配置功能。

### Story 13-1: 文件預覽組件與欄位高亮

```
# 開發任務：Story 13-1 文件預覽組件與欄位高亮

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/tech-specs/epic-13-document-preview/tech-spec-story-13-1.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 PDF.js 實現 PDF 預覽功能
3. 實現欄位高亮顯示與互動
4. 新增的元件需更新 component-registry.md
5. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Tech Spec 文件：Status 改為 `done`

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 13-2: 欄位提取結果面板

```
# 開發任務：Story 13-2 欄位提取結果面板

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/tech-specs/epic-13-document-preview/tech-spec-story-13-2.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/tech-specs/epic-13-document-preview/tech-spec-story-13-1.md（依賴）

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 實現結構化欄位顯示面板
3. 實現欄位與 PDF 預覽的雙向互動
4. 新增的元件需更新 component-registry.md
5. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Tech Spec 文件：Status 改為 `done`

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 13-3: 欄位映射配置介面

```
# 開發任務：Story 13-3 欄位映射配置介面

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/tech-specs/epic-13-document-preview/tech-spec-story-13-3.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/tech-specs/epic-13-document-preview/tech-spec-story-13-4.md（依賴：映射 API）

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 實現視覺化映射規則編輯器
3. 支援拖放式映射配置
4. 實現規則預覽與驗證
5. 新增的元件需更新 component-registry.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Tech Spec 文件：Status 改為 `done`

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 13-4: 映射配置 API

```
# 開發任務：Story 13-4 映射配置 API

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/tech-specs/epic-13-document-preview/tech-spec-story-13-4.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 實現 FieldMappingConfig Prisma 模型
3. 實現映射配置 CRUD API
4. 支援層級覆蓋邏輯（Global → Company → Specific）
5. 新增的 API 需更新 api-registry.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Tech Spec 文件：Status 改為 `done`

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 13-5: 動態欄位映射服務整合

```
# 開發任務：Story 13-5 動態欄位映射服務整合

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/tech-specs/epic-13-document-preview/tech-spec-story-13-5.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/tech-specs/epic-13-document-preview/tech-spec-story-13-4.md（依賴：映射 API）

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 實現 DynamicMappingService 服務
3. 實現映射規則解析與應用
4. 整合到文件處理流程
5. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Tech Spec 文件：Status 改為 `done`

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 13-6: 文件預覽整合測試頁面

```
# 開發任務：Story 13-6 文件預覽整合測試頁面

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/13-6-document-preview-integration-page.md
3. docs/04-implementation/tech-specs/epic-13-document-preview/tech-spec-story-13-6.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- src/components/features/document-preview/index.ts（Story 13-1, 13-2 組件）
- src/components/features/mapping-config/index.ts（Story 13-3 組件）

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 建立 `/admin/document-preview-test` 頁面路由
3. 實現三欄佈局：欄位面板 | PDF 預覽 | 映射配置
4. 整合現有組件：
   - DynamicPDFViewer, FieldHighlightOverlay (Story 13-1)
   - ExtractedFieldsPanel (Story 13-2)
   - MappingConfigPanel (Story 13-3)
5. 建立 Zustand store 管理頁面狀態
6. 實現文件上傳與處理觸發
7. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶

## 現有組件索引

### 文件預覽組件
- PDFViewer, DynamicPDFViewer, PDFControls
- FieldHighlightOverlay
- ExtractedFieldsPanel, FieldCard, FieldFilters

### 映射配置組件
- MappingConfigPanel, ConfigSelector
- SourceFieldSelector, TargetFieldSelector
- MappingRuleList, RuleEditor, MappingPreview

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 功能驗證
- [ ] 頁面可正常訪問 `/admin/document-preview-test`
- [ ] 非 ADMIN 用戶被正確重定向
- [ ] PDF 預覽正確顯示
- [ ] 欄位面板與 PDF 高亮聯動正常
- [ ] 映射配置面板功能正常

### 3. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Tech Spec 文件：Status 改為 `done`

### 4. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 5. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 13-7: Field Mapping 後台管理頁面

```
# 開發任務：Story 13-7 Field Mapping 後台管理頁面

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/13-7-field-mapping-admin-page.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- src/hooks/use-prompt-configs.ts（Hooks 模式參考）
- src/app/(dashboard)/admin/prompt-configs/page.tsx（列表頁模式參考）
- src/components/features/mapping-config/MappingConfigPanel.tsx（核心 UI 組件）
- src/types/field-mapping.ts（類型定義）
- src/app/api/v1/field-mapping-configs/route.ts（API 端點）

## 開發要求
1. 嚴格遵循 Story 文件中的 Tasks 和 Dev Notes
2. 建立 React Query Hooks（參考 use-prompt-configs.ts 模式）：
   - 查詢：useFieldMappingConfigs, useFieldMappingConfig
   - 變更：useCreateFieldMappingConfig, useUpdateFieldMappingConfig, useDeleteFieldMappingConfig
   - 規則：useCreateFieldMappingRule, useUpdateFieldMappingRule, useDeleteFieldMappingRule, useReorderFieldMappingRules
   - 測試：useTestFieldMappingConfig
3. 建立三個後台頁面：
   - `/admin/field-mapping-configs`（列表頁）
   - `/admin/field-mapping-configs/new`（新增頁）
   - `/admin/field-mapping-configs/[id]`（編輯頁）
4. 複用現有 MappingConfigPanel 組件
5. 實現規則同步邏輯（編輯頁：新增/更新/刪除規則比對）
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶

## 現有組件索引

### 映射配置組件（直接複用）
- MappingConfigPanel - 核心配置面板
- ConfigSelector - 配置範圍選擇器
- MappingRuleList - 規則列表
- SortableRuleItem - 可排序規則項
- RuleEditor - 規則編輯器
- SourceFieldSelector, TargetFieldSelector - 欄位選擇器
- TransformConfigPanel - 轉換設定面板
- MappingPreview - 映射預覽

### API 端點（已存在）
- GET/POST /api/v1/field-mapping-configs - 列表/創建
- GET/PATCH/DELETE /api/v1/field-mapping-configs/[id] - 單一配置 CRUD
- POST /api/v1/field-mapping-configs/[id]/rules - 創建規則
- PATCH/DELETE /api/v1/field-mapping-configs/[id]/rules/[ruleId] - 規則 CRUD
- POST /api/v1/field-mapping-configs/[id]/rules/reorder - 規則排序
- POST /api/v1/field-mapping-configs/[id]/test - 測試配置

## 數據格式轉換（關鍵）
```typescript
// API → UI 轉換
function transformToVisualConfig(apiData: FieldMappingConfigDTO): VisualMappingConfig {
  return {
    id: apiData.id,
    scope: apiData.scope as ConfigScope,
    companyId: apiData.companyId,
    documentFormatId: apiData.documentFormatId,
    name: apiData.name,
    description: apiData.description,
    rules: apiData.rules.map(transformToVisualRule),
    isActive: apiData.isActive,
    version: apiData.version,
  };
}
```

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 功能驗證
- [ ] 頁面可正常訪問 `/admin/field-mapping-configs`
- [ ] 列表頁篩選功能正常（範圍/公司/格式/狀態）
- [ ] 新增配置流程正常（含規則批量創建）
- [ ] 編輯配置流程正常（含規則同步：新增/更新/刪除）
- [ ] 刪除配置功能正常（含確認對話框）
- [ ] Toast 提示正確顯示（成功/錯誤）

### 3. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/13-7-*.md`)：Status 改為 `done`

### 4. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 5. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 13-8: 發票詳情頁面

```
# 開發任務：Story 13-8 發票詳情頁面

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/epic-13-document-preview/13-8-invoice-detail-page.md
3. docs/04-implementation/tech-specs/epic-13-document-preview/tech-spec-story-13-8.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- src/components/features/document-preview/index.ts（Story 13-1, 13-2 組件）
- src/components/features/invoice/ProcessingStatus.tsx（現有狀態組件）
- src/components/features/confidence/ConfidenceBadge.tsx（信心度徽章）
- messages/{locale}/invoices.json（i18n 翻譯）

## 開發要求
1. 嚴格遵循 Story 文件和 Tech Spec 的設計
2. 建立發票詳情頁面 `/[locale]/(dashboard)/invoices/[id]/page.tsx`
3. 實現以下組件：
   - InvoiceDetailHeader（頭部：返回、標題、狀態、操作按鈕）
   - InvoiceDetailStats（統計卡片：狀態、信心度、上傳、來源）
   - InvoiceDetailTabs（Tabs 容器）
   - PreviewTab（整合 DynamicPDFViewer + FieldHighlightOverlay）
   - FieldsTab（整合 ExtractedFieldsPanel）
   - ProcessingTab + ProcessingTimeline
   - AuditTab + InvoiceAuditLog
4. 建立 useInvoiceDetail Hook（含處理中狀態輪詢）
5. 新增 i18n 翻譯（en, zh-TW, zh-CN 三語言）
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶

## 可復用組件索引

### 文件預覽組件（來自 Story 13-1, 13-2）
- DynamicPDFViewer - PDF 預覽（含懶加載）
- FieldHighlightOverlay - 欄位高亮覆蓋層
- ExtractedFieldsPanel - 提取欄位面板
- PDFControls - PDF 控制列
- FieldFilters - 欄位篩選器

### 現有發票組件
- ProcessingStatus - 處理狀態徽章
- RetryButton - 重試按鈕

### 現有通用組件
- ConfidenceBadge - 信心度徽章
- DocumentSourceBadge - 來源徽章

## API 端點（已存在）
- GET /api/documents/[id] - 文件詳情
- GET /api/documents/[id]/download - 文件下載
- POST /api/documents/[id]/retry - 重試處理
- GET /api/documents/[id]/trace - 處理追蹤
- GET /api/extraction/[id]/fields - 提取欄位
- GET /api/confidence/[id] - 信心度詳情
- GET /api/audit-logs - 審計日誌

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 功能驗證
- [ ] 從發票列表可點擊進入詳情頁 `/invoices/{id}`
- [ ] 頭部組件正確顯示（返回按鈕、標題、狀態、操作）
- [ ] 4 張統計卡片數據正確
- [ ] 文件預覽 Tab 功能正常（PDF 預覽 + 欄位高亮）
- [ ] 提取欄位 Tab 功能正常（搜尋、篩選、聯動）
- [ ] 處理詳情 Tab 時間軸正確顯示
- [ ] 審計日誌 Tab 正確載入
- [ ] 處理中狀態有輪詢更新（3 秒間隔）
- [ ] 失敗狀態可重試

### 3. i18n 驗證
- [ ] 所有文字使用翻譯系統
- [ ] en / zh-TW / zh-CN 翻譯完整
- [ ] 日期、數字格式化正確

### 4. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`13-8-invoice-detail-page.md`)：Status 改為 `done`

### 5. 附加文檔（如適用）
- [ ] 更新 src/components/features/invoice/index.ts（導出新組件）
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 6. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

## Epic 14: Prompt 配置系統

> **說明**：此 Epic 提供 GPT Vision Prompt 的可配置化管理，支援層級覆蓋與動態解析。

### Story 14-1: Prompt 配置模型與 API

```
# 開發任務：Story 14-1 Prompt 配置模型與 API

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/tech-specs/epic-14-prompt-config/tech-spec-story-14-1.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 實現 PromptConfig Prisma 模型
3. 實現四層配置結構（Global, Company, Format, Specific）
4. 實現配置 CRUD API 端點
5. 新增的 API 需更新 api-registry.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Tech Spec 文件：Status 改為 `done`

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 14-2: Prompt 配置管理介面

```
# 開發任務：Story 14-2 Prompt 配置管理介面

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/tech-specs/epic-14-prompt-config/tech-spec-story-14-2.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/tech-specs/epic-14-prompt-config/tech-spec-story-14-1.md（依賴）

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 實現 Prompt 配置列表與編輯器
3. 實現配置預覽與語法高亮
4. 支援變數插入與驗證
5. 新增的元件需更新 component-registry.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Tech Spec 文件：Status 改為 `done`

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 14-3: Prompt 解析與合併服務

```
# 開發任務：Story 14-3 Prompt 解析與合併服務

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/tech-specs/epic-14-prompt-config/tech-spec-story-14-3.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/tech-specs/epic-14-prompt-config/tech-spec-story-14-1.md（依賴）

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 實現 PromptResolverService 服務
3. 實現層級優先級解析（Specific > Format > Company > Global）
4. 實現變數替換與條件渲染
5. 實現 Prompt 合併策略（Replace, Append, Merge）
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Tech Spec 文件：Status 改為 `done`

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 14-4: GPT Vision 服務整合

```
# 開發任務：Story 14-4 GPT Vision 服務整合

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/tech-specs/epic-14-prompt-config/tech-spec-story-14-4.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/tech-specs/epic-14-prompt-config/tech-spec-story-14-1.md（依賴）
- docs/04-implementation/tech-specs/epic-14-prompt-config/tech-spec-story-14-3.md（依賴）

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 重構現有 GPT Vision 服務使用動態 Prompt
3. 整合 PromptResolver 服務
4. 實現 Prompt 版本追蹤
5. 維護向後兼容性
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Tech Spec 文件：Status 改為 `done`

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

## Epic 15: 統一處理架構

> **說明**：此 Epic 將 Epic 0 的歷史數據處理能力整合到日常文件處理流程，實現統一的 11 步處理管道。

### Story 15-1: 處理流程重構 - 統一入口

```
# 開發任務：Story 15-1 處理流程重構 - 統一入口

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/tech-specs/epic-15-unified-processing/tech-spec-story-15-1.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- src/services/batch-processor.service.ts（現有處理邏輯）
- src/services/processing-router.service.ts（現有路由邏輯）

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 實現 UnifiedDocumentProcessor 核心服務
3. 實現 ProcessingContext 和 ProcessingResult 類型
4. 實現 11 步處理管道基礎架構
5. 實現 Feature Flag 控制漸進式部署
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Tech Spec 文件：Status 改為 `done`

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 15-2: 發行者識別整合

```
# 開發任務：Story 15-2 發行者識別整合

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/tech-specs/epic-15-unified-processing/tech-spec-story-15-2.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- src/services/document-issuer.service.ts（Epic 0 服務）
- docs/04-implementation/tech-specs/epic-15-unified-processing/tech-spec-story-15-1.md（依賴）

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 實現 IssuerIdentifierAdapter 適配器
3. 整合 Epic 0 Story 0-8 的發行者識別功能
4. 實現 Step 4（發行者識別）和 Step 5（公司匹配）
5. 維護向後兼容性
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Tech Spec 文件：Status 改為 `done`

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 15-3: 格式匹配與動態配置

```
# 開發任務：Story 15-3 格式匹配與動態配置

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/tech-specs/epic-15-unified-processing/tech-spec-story-15-3.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- src/services/document-format.service.ts（Epic 0 服務）
- docs/04-implementation/tech-specs/epic-15-unified-processing/tech-spec-story-15-2.md（依賴）

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 實現 FormatMatcherAdapter 適配器
3. 實現 ConfigFetcherAdapter 適配器
4. 整合 Epic 0 Story 0-9 的格式匹配功能
5. 實現 Step 6（格式匹配）和 Step 7（配置獲取）
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Tech Spec 文件：Status 改為 `done`

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 15-4: 持續術語學習

```
# 開發任務：Story 15-4 持續術語學習

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/tech-specs/epic-15-unified-processing/tech-spec-story-15-4.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- src/services/hierarchical-term-aggregation.service.ts（Epic 0 服務）
- src/services/ai-term-validation.service.ts（Epic 0 服務）
- docs/04-implementation/tech-specs/epic-15-unified-processing/tech-spec-story-15-3.md（依賴）

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 實現 TermRecorderAdapter 適配器
3. 整合 Epic 0 Story 0-9/0-10 的術語聚合與驗證功能
4. 實現 Step 9（術語記錄）
5. 支援增量術語學習和統計更新
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Tech Spec 文件：Status 改為 `done`

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 15-5: 信心度計算增強

```
# 開發任務：Story 15-5 信心度計算增強

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/tech-specs/epic-15-unified-processing/tech-spec-story-15-5.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/tech-specs/epic-15-unified-processing/tech-spec-story-15-2.md（依賴：發行者識別）
- docs/04-implementation/tech-specs/epic-15-unified-processing/tech-spec-story-15-3.md（依賴：格式匹配）
- docs/04-implementation/tech-specs/epic-15-unified-processing/tech-spec-story-15-4.md（依賴：術語學習）

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 實現 ConfidenceCalculatorService 服務（7 維度計算）
3. 實現 RoutingDecisionService 服務（AUTO_APPROVE/QUICK_REVIEW/FULL_REVIEW）
4. 實現 Step 10（信心度計算）和 Step 11（路由決策）
5. 支援可配置的維度權重和閾值
6. 實現 ConfidenceDetailsPanel UI 組件
7. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Tech Spec 文件：Status 改為 `done`

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

## Epic 16: 文件格式管理

> **說明**：此 Epic 提供文件格式的可視化管理和識別規則配置，讓用戶可以查看、編輯和配置每個公司的文件格式。

### Story 16-1: 格式列表 Tab

```
# 開發任務：Story 16-1 格式列表 Tab

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/tech-specs/epic-16-format-management/tech-spec-story-16-1.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/stories/16-1-format-list-tab.md
- src/services/document-format.service.ts（現有服務）
- src/app/api/v1/formats/route.ts（現有 API）

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 修改 ForwarderDetailView 新增「格式」Tab
3. 實現 FormatList 和 FormatCard 組件
4. 實現 FormatFilters 篩選組件
5. 實現 useCompanyFormats Hook
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件：Status 改為 `done`，Tasks 打勾 `[x]`

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 16-2: 格式詳情與編輯

```
# 開發任務：Story 16-2 格式詳情與編輯

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/tech-specs/epic-16-format-management/tech-spec-story-16-2.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/stories/16-2-format-detail-edit.md
- docs/04-implementation/tech-specs/epic-16-format-management/tech-spec-story-16-1.md（依賴）

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 新增 API: GET/PATCH /api/v1/formats/[id]
3. 實現 FormatDetailView 組件（Tabs 結構）
4. 實現 FormatBasicInfo、FormatTermsTable、FormatFilesTable 組件
5. 實現 FormatForm 編輯表單
6. 實現 useFormatDetail Hook
7. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件：Status 改為 `done`，Tasks 打勾 `[x]`

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 16-3: 識別規則配置

```
# 開發任務：Story 16-3 識別規則配置

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/tech-specs/epic-16-format-management/tech-spec-story-16-3.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/stories/16-3-identification-rules-config.md
- docs/04-implementation/tech-specs/epic-16-format-management/tech-spec-story-16-2.md（依賴）

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 新增 Prisma 欄位: identificationRules (Json)
3. 執行 Prisma 遷移
4. 定義 IdentificationRules 類型和 Zod 驗證 schema
5. 實現 IdentificationRulesEditor 組件
6. 實現 LogoPatternEditor 和 KeywordTagInput 子組件
7. 更新 PATCH API 支援識別規則
8. 整合到 FormatDetailView 的識別規則 Tab
9. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件：Status 改為 `done`，Tasks 打勾 `[x]`

### 3. 資料庫變更
- [ ] Prisma 遷移已成功執行
- [ ] 遷移腳本已提交到版本控制

### 4. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 5. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 16-4: 專屬配置關聯

```
# 開發任務：Story 16-4 專屬配置關聯

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/tech-specs/epic-16-format-management/tech-spec-story-16-4.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/stories/16-4-linked-config-panel.md
- docs/04-implementation/tech-specs/epic-16-format-management/tech-spec-story-16-2.md（依賴）
- src/types/prompt-config.ts（類型定義）
- src/types/field-mapping.ts（類型定義）

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 新增 API: GET /api/v1/formats/[id]/configs
3. 實現 FormatConfigPanel 組件
4. 實現 LinkedPromptConfig 組件（顯示/創建 Prompt 配置）
5. 實現 LinkedMappingConfig 組件（顯示/創建映射配置）
6. 實現 ConfigInheritanceInfo 組件（繼承關係說明）
7. 整合到 FormatDetailView 的專屬配置 Tab
8. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件：Status 改為 `done`，Tasks 打勾 `[x]`

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 16-5: 識別規則 Prompt 整合

```
# 開發任務：Story 16-5 識別規則 Prompt 整合

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/tech-specs/epic-16-format-management/tech-spec-story-16-5.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/tech-specs/epic-16-format-management/tech-spec-story-16-3.md（依賴）
- src/services/unified-processor/steps/config-fetching.step.ts
- src/services/unified-processor/steps/gpt-enhanced-extraction.step.ts
- src/services/gpt-vision.service.ts
- src/types/document-format.ts（IdentificationRules 類型）

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 新增 FormatIdentificationRule 類型到 unified-processor.ts
3. 新增 identification-rules-prompt-builder.ts 服務
4. 擴展 ConfigFetchingStep 讀取公司下所有格式的識別規則
5. 修改 GptEnhancedExtractionStep 傳遞識別規則到 GPT
6. 修改 gpt-vision.service.ts 注入識別規則 Prompt
7. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Epic 16 overview：Story 16-5 狀態改為 ✅ 已完成

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 16-6: 動態欄位映射配置

```
# 開發任務：Story 16-6 動態欄位映射配置

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/tech-specs/epic-16-format-management/tech-spec-story-16-6.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/tech-specs/epic-16-format-management/tech-spec-story-16-7.md（依賴）
- src/types/invoice-fields.ts（90+ 標準欄位定義）
- src/services/unified-processor/steps/field-mapping.step.ts（需完成 stub）
- src/services/dynamic-field-mapping.service.ts

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 新增 source-field.service.ts（來源欄位服務）
3. 新增 GET /api/v1/formats/[id]/extracted-fields API
4. 完成 field-mapping.step.ts 的 applyThreeTierMapping 方法
5. 新增 SourceFieldCombobox.tsx 組件
6. 整合標準欄位（invoice-fields.ts）+ 動態提取欄位
7. 支援自訂欄位名稱輸入
8. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Epic 16 overview：Story 16-6 狀態改為 ✅ 已完成

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 16-7: 數據模版管理

```
# 開發任務：Story 16-7 數據模版管理

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/tech-specs/epic-16-format-management/tech-spec-story-16-7.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- prisma/schema.prisma（需新增 DataTemplate 模型）
- src/types/field-mapping.ts（FieldMappingConfig 關聯）
- src/validations/（Zod schema 參考）

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 新增 DataTemplate Prisma 模型並執行遷移
3. 新增 data-template.ts 類型定義
4. 新增 data-template.ts Zod 驗證 Schema
5. 新增 data-template.service.ts 服務層
6. 新增 CRUD API: /api/v1/data-templates
7. 新增 UI: /admin/data-templates 管理頁面
8. 新增 DataTemplateFieldEditor 欄位編輯器組件
9. 執行 Seed 創建系統預設模版
10. 更新 FieldMappingConfig 關聯 dataTemplateId
11. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過
- [ ] 執行 `npx prisma migrate dev` 確認遷移成功

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Epic 16 overview：Story 16-7 狀態改為 ✅ 已完成

### 3. 附加文檔（如適用）
- [ ] 更新 CLAUDE.md 的 Prisma 模型清單
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 16-8: 手動新增格式

```
# 開發任務：Story 16-8 手動新增格式

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/tech-specs/epic-16-format-management/tech-spec-story-16-8.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/stories/epic-16-format-management/16-8-manual-format-creation.md
- src/services/document-format.service.ts（現有服務）
- src/components/features/format/FormatList.tsx（整合點）

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 新增 POST /api/v1/formats API（支援 Prisma transaction）
3. 新增 createDocumentFormatSchema Zod 驗證
4. 新增 useCreateFormat mutation hook
5. 新增 CreateFormatDialog 組件（進階選項展開）
6. 整合到 FormatList（空狀態、統計資訊旁）
7. 支援自動建立 FieldMappingConfig/PromptConfig 選項
8. 處理 409 duplicate format 錯誤
9. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件：Status 改為 `done`，Tasks 打勾 `[x]`

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

## Epic 17: 國際化 (i18n)

> **說明**：此 Epic 為系統添加多語言支援，使用 next-intl 框架實現國際化。支援語言：zh-TW（繁體中文）、en（英文，預設）、zh-CN（簡體中文）。

### Story 17-1: i18n 基礎架構設置

```
# 開發任務：Story 17-1 i18n 基礎架構設置

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/tech-specs/epic-17-i18n/tech-spec-story-17-1.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/stories/epic-17-i18n/17-1-i18n-infrastructure-setup.md
- https://next-intl-docs.vercel.app/（next-intl 官方文檔）

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 安裝 next-intl 套件
3. 建立 src/i18n/ 配置檔案（config.ts, request.ts, routing.ts）
4. 建立 messages/{locale}/common.json 翻譯檔案（zh-TW, en, zh-CN）
5. 建立 src/app/[locale]/layout.tsx 語言感知佈局
6. 更新 src/middleware.ts 實現語言偵測和重定向
7. 更新 next.config.ts 添加 next-intl plugin
8. 移動現有 (auth) 和 (dashboard) 路由到 [locale]/ 下
9. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過
- [ ] 執行 `npm run build` 確認建置成功

### 2. 路由驗證
- [ ] 訪問 `/` 重定向到 `/en`
- [ ] 訪問 `/invoices` 重定向到 `/en/invoices`
- [ ] 訪問 `/zh-TW/invoices` 正常顯示
- [ ] 訪問 `/en/invoices` 正常顯示

### 3. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件：Status 改為 `done`，Tasks 打勾 `[x]`

### 4. 附加文檔
- [ ] 更新 CLAUDE.md 技術棧（新增 next-intl）
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 5. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 17-2: 核心 UI 文字國際化

```
# 開發任務：Story 17-2 核心 UI 文字國際化

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/tech-specs/epic-17-i18n/tech-spec-story-17-2.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/stories/epic-17-i18n/17-2-core-ui-text-internationalization.md
- docs/04-implementation/tech-specs/epic-17-i18n/tech-spec-story-17-1.md（依賴）

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 建立翻譯檔案命名空間：
   - messages/{locale}/common.json（通用文字 ~150 字串）
   - messages/{locale}/navigation.json（導航 ~30 字串）
   - messages/{locale}/invoices.json（發票模組 ~100 字串）
   - messages/{locale}/review.json（審核模組 ~80 字串）
3. 更新 src/i18n/request.ts 支援多命名空間載入
4. 重構發票列表頁（/invoices）使用 useTranslations
5. 重構審核頁面（/review）使用 useTranslations
6. 重構導航組件和側邊欄使用翻譯
7. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 翻譯驗證
- [ ] 訪問 `/zh-TW/invoices` 顯示繁體中文
- [ ] 訪問 `/en/invoices` 顯示英文
- [ ] 導航欄在兩種語言下正確顯示

### 3. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件：Status 改為 `done`，Tasks 打勾 `[x]`

### 4. 附加文檔（如適用）
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 5. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 17-3: 驗證訊息與錯誤處理國際化

```
# 開發任務：Story 17-3 驗證訊息與錯誤處理國際化

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/tech-specs/epic-17-i18n/tech-spec-story-17-3.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/stories/epic-17-i18n/17-3-validation-error-internationalization.md
- docs/04-implementation/tech-specs/epic-17-i18n/tech-spec-story-17-1.md（依賴）
- src/validations/（現有 Zod schemas）

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 建立翻譯檔案：
   - messages/{locale}/validation.json（驗證訊息）
   - messages/{locale}/errors.json（API 錯誤、Toast）
3. 建立 src/lib/i18n-zod.ts（Zod 錯誤訊息映射）
4. 建立 useLocalizedZod hook（整合 Zod 4.x 內建 locales）
5. 建立 useLocalizedToast hook
6. 建立 createLocalizedError 工具函數
7. 更新現有 Zod Schema 使用國際化訊息
8. 更新 API 路由返回國際化錯誤響應
9. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 功能驗證
- [ ] 表單驗證錯誤以當前語言顯示
- [ ] API 錯誤響應以當前語言返回
- [ ] Toast 通知以當前語言顯示

### 3. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件：Status 改為 `done`，Tasks 打勾 `[x]`

### 4. 附加文檔（如適用）
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 5. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 17-4: 日期、數字與貨幣格式化

```
# 開發任務：Story 17-4 日期、數字與貨幣格式化

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/tech-specs/epic-17-i18n/tech-spec-story-17-4.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/stories/epic-17-i18n/17-4-date-number-currency-formatting.md
- docs/04-implementation/tech-specs/epic-17-i18n/tech-spec-story-17-1.md（依賴）
- src/components/ui/date-range-picker.tsx（需更新）

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 建立 src/lib/i18n-date.ts：
   - 整合 date-fns 多語言 locale（zhTW, enUS, zhCN）
   - formatLocalizedDate, formatRelativeTime 函數
3. 建立 src/lib/i18n-number.ts：
   - formatNumber, formatPercent 函數
   - 使用 Intl.NumberFormat
4. 建立 src/lib/i18n-currency.ts：
   - formatCurrency 函數
   - 支援多貨幣（USD, TWD, CNY, HKD）
5. 建立相關 hooks（useLocalizedDate, useLocalizedNumber）
6. 更新 DateRangePicker 組件
7. 更新 StatCard 和表格數字顯示
8. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 格式化驗證
- [ ] 日期在 zh-TW 顯示為「2026年1月16日」格式
- [ ] 日期在 en 顯示為「January 16, 2026」格式
- [ ] 數字千位分隔符正確顯示
- [ ] 貨幣格式正確顯示（NT$、US$）

### 3. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件：Status 改為 `done`，Tasks 打勾 `[x]`

### 4. 附加文檔（如適用）
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 5. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 17-5: 語言偏好設置與切換 UI

```
# 開發任務：Story 17-5 語言偏好設置與切換 UI

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/tech-specs/epic-17-i18n/tech-spec-story-17-5.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/stories/epic-17-i18n/17-5-language-preference-settings.md
- docs/04-implementation/tech-specs/epic-17-i18n/tech-spec-story-17-1.md（依賴）
- prisma/schema.prisma（需擴展 User model）

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 建立 LocaleSwitcher.tsx 組件（Dropdown 顯示語言選項）
3. 整合 LocaleSwitcher 到 Header 組件
4. 建立 useLocalePreference hook（LocalStorage 持久化）
5. 擴展 User model 添加 preferredLocale 欄位
6. 執行 Prisma 遷移
7. 建立 PATCH /api/v1/users/me/locale API
8. 實作語言偏好優先級邏輯：
   - 資料庫偏好 > LocalStorage > 瀏覽器語言 > 預設語言
9. 更新 [locale]/layout.tsx 添加 hreflang 標籤
10. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過
- [ ] 執行 `npx prisma migrate dev` 確認遷移成功

### 2. 功能驗證
- [ ] LocaleSwitcher 組件正確顯示在 Header
- [ ] 切換語言後頁面即時更新
- [ ] 重新訪問網站自動載入上次選擇的語言
- [ ] 登入後載入資料庫中的語言偏好

### 3. SEO 驗證
- [ ] HTML lang 屬性正確設置
- [ ] hreflang 標籤正確生成

### 4. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件：Status 改為 `done`，Tasks 打勾 `[x]`
- [ ] 更新 sprint-status.yaml 將 epic-17 狀態改為 `done`

### 5. 附加文檔
- [ ] 更新 CLAUDE.md 的 Prisma 模型清單
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 6. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

## Epic 18: 本地帳號認證系統

> **說明**：此 Epic 實現完整的本地帳號認證功能，包括用戶註冊、登入、密碼重設及郵件驗證。

### Story 18-1: 用戶註冊

```
# 開發任務：Story 18-1 用戶註冊

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/epic-18-local-auth/18-1-user-registration.md
3. docs/04-implementation/tech-specs/epic-18-local-auth/tech-spec-story-19-1.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- src/lib/auth.ts（現有認證配置）
- src/lib/auth.config.ts（Provider 配置）
- prisma/schema.prisma（User 模型）
- messages/{locale}/auth.json（i18n 翻譯）

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 更新 Prisma Schema 添加驗證欄位：
   - emailVerificationToken, emailVerificationExpires
   - passwordResetToken, passwordResetExpires
3. 執行 Prisma 遷移
4. 建立密碼工具 src/lib/password.ts：
   - hashPassword（bcrypt cost 12）
   - verifyPassword
   - validatePasswordStrength
5. 建立 Token 工具 src/lib/token.ts：
   - generateToken（crypto.randomBytes）
   - getTokenExpiry
6. 建立郵件服務 src/lib/email.ts：
   - sendEmail（nodemailer）
   - sendVerificationEmail
7. 建立註冊 API POST /api/auth/register
8. 建立註冊頁面 /[locale]/(auth)/auth/register/page.tsx
9. 建立驗證 Schema src/validations/auth.ts
10. 新增 i18n 翻譯（en, zh-TW, zh-CN）
11. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶

## 環境變數需求
確保 .env 中已配置：
- SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM
- BCRYPT_SALT_ROUNDS="12"（可選，預設 12）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過
- [ ] 執行 `npx prisma migrate dev` 確認遷移成功

### 2. 功能驗證
- [ ] 註冊頁面正確顯示並可輸入
- [ ] 電子郵件驗證（格式、唯一性）
- [ ] 密碼強度驗證正確運作
- [ ] 註冊成功後發送驗證郵件
- [ ] 重複郵件註冊顯示錯誤訊息

### 3. 安全驗證
- [ ] 密碼以 bcrypt 加密存儲
- [ ] 驗證 Token 長度 64 字元
- [ ] Token 有效期正確設置（24 小時）

### 4. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件：Status 改為 `done`，Tasks 打勾 `[x]`

### 5. 附加文檔
- [ ] 更新 src/lib/index.ts（如存在）
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 6. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 18-2: 本地帳號登入

```
# 開發任務：Story 18-2 本地帳號登入

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/epic-18-local-auth/18-2-local-account-login.md
3. docs/04-implementation/tech-specs/epic-18-local-auth/tech-spec-story-19-2.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/tech-specs/epic-18-local-auth/tech-spec-story-19-1.md（依賴）
- src/lib/auth.config.ts（需修改 Credentials Provider）
- src/lib/auth.ts（需修改 JWT Callback）
- src/lib/password.ts（Story 18-1 建立）
- messages/{locale}/auth.json（i18n 翻譯）

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 修改 Credentials Provider（src/lib/auth.config.ts）：
   - 實現真正的帳號密碼驗證
   - 檢查帳號狀態（ACTIVE/SUSPENDED/DISABLED）
   - 檢查郵件驗證狀態
3. 修改 JWT Callback（src/lib/auth.ts）：
   - 確保 Session 結構與 Azure AD 一致
   - 統一載入用戶角色和城市權限
4. 更新登入頁面 /[locale]/(auth)/auth/login/page.tsx：
   - 整合 Azure AD 和本地帳號雙重登入選項
   - 實現本地帳號登入表單
   - 處理各種登入錯誤
5. 建立登入驗證 Schema（如未在 18-1 建立）
6. 新增 i18n 翻譯
7. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶

## 依賴
- Story 19-1（用戶註冊）必須先完成

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 功能驗證
- [ ] 登入頁面顯示 Azure AD 和本地帳號雙重選項
- [ ] Azure AD 登入仍正常運作
- [ ] 本地帳號登入成功後正確跳轉
- [ ] 錯誤密碼顯示正確錯誤訊息
- [ ] 未驗證郵件用戶無法登入並顯示提示
- [ ] 被暫停帳號無法登入並顯示提示

### 3. Session 驗證
- [ ] 本地帳號登入後 Session 包含所有必要資訊
- [ ] Session 結構與 Azure AD 登入一致
- [ ] 角色和城市權限正確載入

### 4. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件：Status 改為 `done`，Tasks 打勾 `[x]`

### 5. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 18-3: 忘記密碼與重設

```
# 開發任務：Story 18-3 忘記密碼與重設

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/epic-18-local-auth/18-3-password-reset.md
3. docs/04-implementation/tech-specs/epic-18-local-auth/tech-spec-story-19-3.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/tech-specs/epic-18-local-auth/tech-spec-story-19-1.md（依賴）
- src/lib/token.ts（Token 工具）
- src/lib/email.ts（郵件服務）
- src/lib/password.ts（密碼工具）
- messages/{locale}/auth.json（i18n 翻譯）

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 建立忘記密碼 API POST /api/auth/forgot-password：
   - 查詢用戶但不洩漏是否存在（安全考量）
   - 產生 Token（32 字元，1 小時有效）
   - 發送重設郵件
3. 建立重設密碼 API POST /api/auth/reset-password：
   - 驗證 Token 有效性
   - 驗證密碼強度
   - 更新密碼並清除 Token
   - 發送密碼變更通知郵件
4. 建立 Token 驗證 API GET /api/auth/verify-reset-token
5. 更新郵件服務（src/lib/email.ts）：
   - sendPasswordResetEmail
   - sendPasswordChangedEmail
6. 建立忘記密碼頁面 /[locale]/(auth)/auth/forgot-password/page.tsx
7. 建立重設密碼頁面 /[locale]/(auth)/auth/reset-password/page.tsx
8. 新增 i18n 翻譯
9. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶

## 依賴
- Story 19-1（用戶註冊）必須先完成
- Story 19-2（本地帳號登入）必須先完成

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 功能驗證
- [ ] 忘記密碼頁面正確顯示
- [ ] 輸入已註冊郵件後發送重設郵件
- [ ] 輸入未註冊郵件顯示相同成功訊息（安全）
- [ ] 有效 Token 可進入重設密碼頁面
- [ ] 過期 Token 顯示錯誤並提供重新請求選項
- [ ] 成功重設密碼後重導向登入頁面

### 3. 安全驗證
- [ ] Token 僅 1 小時有效
- [ ] Token 使用後立即失效
- [ ] 密碼變更後發送通知郵件

### 4. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件：Status 改為 `done`，Tasks 打勾 `[x]`

### 5. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 18-4: 郵件驗證系統

```
# 開發任務：Story 18-4 郵件驗證系統

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/epic-18-local-auth/18-4-email-verification.md
3. docs/04-implementation/tech-specs/epic-18-local-auth/tech-spec-story-19-4.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/tech-specs/epic-18-local-auth/tech-spec-story-19-1.md（依賴）
- src/lib/token.ts（Token 工具）
- src/lib/email.ts（郵件服務）
- messages/{locale}/auth.json（i18n 翻譯）

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 建立郵件驗證 API GET /api/auth/verify-email：
   - 處理有效 Token → 更新 emailVerified → 重導向登入
   - 處理過期 Token → 顯示過期訊息
   - 處理無效 Token → 顯示錯誤訊息
3. 建立重新發送 API POST /api/auth/resend-verification：
   - 實現速率限制（5 次/小時）
   - 產生新 Token 並失效舊 Token
   - 發送新驗證郵件
4. 確保驗證郵件模板已在 18-1 建立
5. 建立驗證結果頁面 /[locale]/(auth)/auth/verify-email/page.tsx：
   - 顯示各種驗證結果狀態
   - 提供重新發送功能
6. 整合到登入頁面（未驗證用戶提示）
7. 新增 i18n 翻譯
8. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶

## 依賴
- Story 19-1（用戶註冊）必須先完成

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 功能驗證
- [ ] 點擊有效驗證連結成功驗證並重導向登入
- [ ] 點擊過期連結顯示過期訊息
- [ ] 點擊無效連結顯示錯誤訊息
- [ ] 重新發送驗證郵件成功
- [ ] 已驗證用戶請求重發顯示適當訊息
- [ ] 速率限制正常運作（超過 5 次/小時顯示錯誤）

### 3. 安全驗證
- [ ] Token 驗證後立即刪除
- [ ] Token 僅 24 小時有效
- [ ] 重發請求不洩漏帳號存在資訊

### 4. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件：Status 改為 `done`，Tasks 打勾 `[x]`
- [ ] 如這是 Epic 最後一個 Story，更新 Epic 狀態為 `done`

### 5. 附加文檔
- [ ] 更新 CLAUDE.md 的項目進度追蹤表
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 6. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

## 使用說明

### 如何使用這些提示

1. **複製對應 Story 的程式碼區塊內容** (包含在 ``` 之間的文字)
2. **開啟新的 AI 助手對話**
3. **貼上提示內容**
4. **等待 AI 助手閱讀文件後開始實作**

### 開發流程建議

1. **依序開發**: 建議按照 Epic 和 Story 編號順序開發
2. **完成驗證**: 每個 Story 完成後使用 dev-checklist.md 進行品質檢查
3. **更新記錄**: 及時更新 component-registry.md、api-registry.md 和 lessons-learned.md
4. **版本控制**: 每個 Story 完成後進行 git commit

### Story 依賴關係提醒

- **Epic 01**: Story 1-0 必須最先完成 (專案基礎架構)
- **Epic 02**: 依賴 Epic 01 的認證基礎
- **Epic 03**: 依賴 Epic 02 的處理結果
- **Epic 06**: 多城市功能可能需要回頭調整早期 Story
- **Epic 17**: Story 17-1 是 i18n 基礎，必須先完成；其他 Stories 可平行開發
- **Epic 18**: Story 18-1 是認證基礎，必須先完成；18-2 依賴 18-1；18-3 依賴 18-1、18-2；18-4 依賴 18-1

---

## Epic 19: 數據模版匹配與輸出

> **說明**：此 Epic 實現第二層映射系統，將提取的標準化數據填入用戶定義的數據模版，並支援導出。

### Story 19-1: Template Field Mapping 數據模型與服務

```
# 開發任務：Story 19-1 Template Field Mapping 數據模型與服務

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/epic-19-template-matching/19-1-template-field-mapping-model.md
3. docs/04-implementation/tech-specs/epic-19-template-matching/tech-spec-story-19-1.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/stories/epic-19-template-matching/epic-19-overview.md
- docs/04-implementation/stories/epic-16-format-management/16-7-data-template-management.md

## 開發要求
1. 嚴格遵循 Tech Spec 的 Prisma Schema 設計
2. 實現三層優先級解析（FORMAT → COMPANY → GLOBAL）
3. 實現映射規則的 CRUD 和快取機制
4. 新增的 API 需更新 api-registry.md
5. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`
- [ ] 更新 Story 文件 Status 改為 `done`

### 3. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 19-2: Template Instance 數據模型與管理服務

```
# 開發任務：Story 19-2 Template Instance 數據模型與管理服務

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/epic-19-template-matching/19-2-template-instance-model.md
3. docs/04-implementation/tech-specs/epic-19-template-matching/tech-spec-story-19-2.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- Story 19-1 的實現（TemplateFieldMapping 模型）

## 開發要求
1. 嚴格遵循 Tech Spec 的 Prisma Schema 設計
2. 實現 TemplateInstance 和 TemplateInstanceRow 模型
3. 實現行驗證邏輯（根據 DataTemplate.fields）
4. 實現統計數據自動更新
5. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`
- [ ] 更新 Story 文件 Status 改為 `done`

### 3. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 19-3: 模版匹配引擎服務

```
# 開發任務：Story 19-3 模版匹配引擎服務

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/epic-19-template-matching/19-3-template-matching-engine.md
3. docs/04-implementation/tech-specs/epic-19-template-matching/tech-spec-story-19-3.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- Story 19-1（TemplateFieldMapping 服務）
- Story 19-2（TemplateInstance 服務）

## 開發要求
1. 實現核心的 TemplateMatchingEngineService
2. 實現三種轉換器（DIRECT、FORMULA、LOOKUP）
3. 實現批量處理和事務一致性
4. 實現同 rowKey 多文件合併邏輯
5. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`
- [ ] 更新 Story 文件 Status 改為 `done`

### 3. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 19-4: Template Field Mapping 配置 UI

```
# 開發任務：Story 19-4 Template Field Mapping 配置 UI

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/epic-19-template-matching/19-4-template-field-mapping-ui.md
3. docs/04-implementation/tech-specs/epic-19-template-matching/tech-spec-story-19-4.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- Story 19-1（TemplateFieldMapping API）
- src/constants/standard-fields.ts（標準欄位列表）

## 開發要求
1. 實現映射配置列表頁面
2. 實現可視化映射規則編輯器
3. 實現公式編輯器和查表編輯器
4. 實現映射測試預覽功能
5. 完整 i18n 支援
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`
- [ ] 更新 Story 文件 Status 改為 `done`

### 3. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 19-5: Template Instance 管理介面

```
# 開發任務：Story 19-5 Template Instance 管理介面

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/epic-19-template-matching/19-5-template-instance-ui.md
3. docs/04-implementation/tech-specs/epic-19-template-matching/tech-spec-story-19-5.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- Story 19-2（TemplateInstance API）
- Story 19-3（匹配引擎服務）

## 開發要求
1. 實現實例列表頁面和詳情頁面
2. 實現根據 DataTemplate.fields 動態生成表格列
3. 實現錯誤行高亮和編輯功能
4. 實現批量操作（刪除、重新驗證）
5. 完整 i18n 支援
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`
- [ ] 更新 Story 文件 Status 改為 `done`

### 3. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 19-6: 模版實例導出功能

```
# 開發任務：Story 19-6 模版實例導出功能

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/epic-19-template-matching/19-6-template-export.md
3. docs/04-implementation/tech-specs/epic-19-template-matching/tech-spec-story-19-6.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- Story 19-5（Template Instance UI）

## 開發要求
1. 安裝 exceljs 依賴
2. 實現 Excel 和 CSV 導出功能
3. 實現導出對話框（格式選擇、行篩選、欄位選擇）
4. 實現導出 API（支援串流）
5. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`
- [ ] 更新 Story 文件 Status 改為 `done`

### 3. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 19-7: 批量文件自動匹配到模版

```
# 開發任務：Story 19-7 批量文件自動匹配到模版

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/epic-19-template-matching/19-7-batch-auto-matching.md
3. docs/04-implementation/tech-specs/epic-19-template-matching/tech-spec-story-19-7.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- Story 19-3（匹配引擎服務）
- 現有的 Document 模型和處理流程

## 開發要求
1. 更新 Document、DocumentFormat、Company 模型
2. 實現自動匹配服務（三層優先級規則解析）
3. 實現手動匹配和批量匹配 UI
4. 整合到現有處理流程
5. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`
- [ ] 更新 Story 文件 Status 改為 `done`

### 3. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 19-8: 模版匹配整合測試與驗證

```
# 開發任務：Story 19-8 模版匹配整合測試與驗證

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/epic-19-template-matching/19-8-integration-testing.md
3. docs/04-implementation/tech-specs/epic-19-template-matching/tech-spec-story-19-8.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- Story 19-1 ~ 19-7 的所有實現

## 開發要求
1. 實現測試向導頁面（6 個步驟）
2. 實現模擬數據生成功能
3. 實現端到端測試流程
4. 實現測試報告生成
5. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`
- [ ] 更新 Story 文件 Status 改為 `done`

### 3. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

## Epic 20: Reference Number Master Setup

> **說明**：此 Epic 建立 Reference Number 主檔管理功能，以「地區」為主要分類維度。

### Story 20-1: 資料庫模型與基礎設施

```
# 開發任務：Story 20-1 資料庫模型與基礎設施

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/epic-20-reference-number-master/20-1-database-model-infrastructure.md
3. docs/04-implementation/tech-specs/epic-20-reference-number-master/tech-spec-story-20-1.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- prisma/schema.prisma

## 開發要求
1. 新增 Region 和 ReferenceNumber 模型到 Prisma Schema
2. 新增枚舉 ReferenceNumberType 和 ReferenceNumberStatus
3. 執行資料庫遷移
4. 建立預設地區種子資料（APAC, EMEA, AMER, GLOBAL）
5. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過
- [ ] 執行 `npx prisma migrate dev` 並確認成功

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`
- [ ] 更新 Story 文件 Status 改為 `done`

### 3. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 20-2: Region 管理 API 與 UI

```
# 開發任務：Story 20-2 Region 管理 API 與 UI

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/epic-20-reference-number-master/20-2-region-management-api-ui.md
3. docs/04-implementation/tech-specs/epic-20-reference-number-master/tech-spec-story-20-2.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- src/services/company.service.ts（參考 Service 模式）

## 開發要求
1. 建立 Region CRUD API（GET/POST/PATCH/DELETE）
2. 建立 RegionSelect 共用組件
3. 新增 i18n 翻譯文件
4. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過
- [ ] 執行 `npm run i18n:check` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`
- [ ] 更新 Story 文件 Status 改為 `done`

### 3. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 20-3: Reference Number CRUD API

```
# 開發任務：Story 20-3 Reference Number CRUD API

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/epic-20-reference-number-master/20-3-reference-number-crud-api.md
3. docs/04-implementation/tech-specs/epic-20-reference-number-master/tech-spec-story-20-3.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- src/app/api/v1/prompt-configs/route.ts（參考 API 模式）

## 開發要求
1. 建立 Zod 驗證 Schema
2. 建立 reference-number.service.ts
3. 建立 CRUD API 端點（支援分頁、篩選、排序）
4. 建立 React Query Hooks
5. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`
- [ ] 更新 Story 文件 Status 改為 `done`

### 3. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 20-4: 導入/導出與驗證 API

```
# 開發任務：Story 20-4 導入/導出與驗證 API

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/epic-20-reference-number-master/20-4-import-export-validate-api.md
3. docs/04-implementation/tech-specs/epic-20-reference-number-master/tech-spec-story-20-4.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- src/app/api/v1/field-mapping-configs/import/route.ts（參考 Import 模式）

## 開發要求
1. 建立 Import API（POST /import）
2. 建立 Export API（GET /export）
3. 建立 Validate API（POST /validate）
4. 實現 skipInvalid 和 overwriteExisting 選項
5. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`
- [ ] 更新 Story 文件 Status 改為 `done`

### 3. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 20-5: 管理頁面 - 列表與篩選

```
# 開發任務：Story 20-5 管理頁面 - 列表與篩選

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/epic-20-reference-number-master/20-5-management-page-list-filter.md
3. docs/04-implementation/tech-specs/epic-20-reference-number-master/tech-spec-story-20-5.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- src/app/[locale]/(dashboard)/admin/prompt-configs/page.tsx（參考頁面模式）

## 開發要求
1. 建立 /admin/reference-numbers 列表頁
2. 建立 ReferenceNumberList 組件
3. 建立 ReferenceNumberFilters 組件
4. 整合 RegionSelect 組件
5. 新增 i18n 翻譯
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過
- [ ] 執行 `npm run i18n:check` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`
- [ ] 更新 Story 文件 Status 改為 `done`

### 3. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 20-6: 管理頁面 - 表單與導入

```
# 開發任務：Story 20-6 管理頁面 - 表單與導入

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/epic-20-reference-number-master/20-6-management-page-form-import.md
3. docs/04-implementation/tech-specs/epic-20-reference-number-master/tech-spec-story-20-6.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- src/components/features/prompt-config/（參考表單組件模式）

## 開發要求
1. 建立新增/編輯頁面
2. 建立 ReferenceNumberForm 組件
3. 建立 ReferenceNumberImportDialog 組件
4. 使用 React Hook Form + Zod 驗證
5. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過
- [ ] 執行 `npm run i18n:check` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`
- [ ] 更新 Story 文件 Status 改為 `done`

### 3. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

## Epic 21: Exchange Rate Management

> **說明**：此 Epic 建立匯率管理功能，支援雙向匯率處理和貨幣轉換計算。

### Story 21-1: 資料庫模型與遷移

```
# 開發任務：Story 21-1 資料庫模型與遷移

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/epic-21-exchange-rate-management/21-1-database-model-migration.md
3. docs/04-implementation/tech-specs/epic-21-exchange-rate-management/tech-spec-story-21-1.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- prisma/schema.prisma

## 開發要求
1. 新增 ExchangeRateSource 枚舉
2. 新增 ExchangeRate 模型（含自關聯 inverseOf/inverseRates）
3. 設定 Decimal(18,8) 精度
4. 執行資料庫遷移
5. 建立類型定義和貨幣代碼常數
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過
- [ ] 執行 `npx prisma migrate dev` 並確認成功

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`
- [ ] 更新 Story 文件 Status 改為 `done`

### 3. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 21-2: 核心服務層

```
# 開發任務：Story 21-2 核心服務層

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/epic-21-exchange-rate-management/21-2-core-service-layer.md
3. docs/04-implementation/tech-specs/epic-21-exchange-rate-management/tech-spec-story-21-2.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- src/services/reference-number.service.ts（參考 Service 模式）

## 開發要求
1. 建立 Zod 驗證 Schema（create, update, convert, batch）
2. 建立 exchange-rate.service.ts
3. 實現 CRUD 操作
4. 實現 convert 方法（含 Fallback: direct → inverse → cross）
5. 實現 batchGetRates 方法
6. 實現自動反向匯率建立邏輯
7. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`
- [ ] 更新 Story 文件 Status 改為 `done`

### 3. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 21-3: CRUD API 端點

```
# 開發任務：Story 21-3 CRUD API 端點

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/epic-21-exchange-rate-management/21-3-crud-api-endpoints.md
3. docs/04-implementation/tech-specs/epic-21-exchange-rate-management/tech-spec-story-21-3.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- src/app/api/v1/reference-numbers/route.ts（參考 API 模式）

## 開發要求
1. 建立 /api/v1/exchange-rates 端點（GET/POST）
2. 建立 /api/v1/exchange-rates/[id] 端點（GET/PATCH/DELETE）
3. 建立 /api/v1/exchange-rates/[id]/toggle 端點（POST）
4. 建立 React Query Hooks
5. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`
- [ ] 更新 Story 文件 Status 改為 `done`

### 3. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 21-4: 轉換計算 API

```
# 開發任務：Story 21-4 轉換計算 API

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/epic-21-exchange-rate-management/21-4-convert-calculation-api.md
3. docs/04-implementation/tech-specs/epic-21-exchange-rate-management/tech-spec-story-21-4.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md

## 開發要求
1. 建立 /api/v1/exchange-rates/convert 端點（POST）
2. 建立 /api/v1/exchange-rates/batch 端點（POST）
3. 實現 Fallback 邏輯（direct → inverse → cross via USD）
4. 建立 useConvertCurrency 和 useBatchRates hooks
5. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`
- [ ] 更新 Story 文件 Status 改為 `done`

### 3. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 21-5: Import/Export API

```
# 開發任務：Story 21-5 Import/Export API

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/epic-21-exchange-rate-management/21-5-import-export-api.md
3. docs/04-implementation/tech-specs/epic-21-exchange-rate-management/tech-spec-story-21-5.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- src/app/api/v1/reference-numbers/import/route.ts（參考 Import 模式）

## 開發要求
1. 建立 /api/v1/exchange-rates/export 端點（GET）
2. 建立 /api/v1/exchange-rates/import 端點（POST）
3. 實現 skipInvalid 和 overwriteExisting 選項
4. 支援 createInverse 選項（導入時建立反向匯率）
5. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`
- [ ] 更新 Story 文件 Status 改為 `done`

### 3. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 21-6: 管理頁面 - 列表與篩選

```
# 開發任務：Story 21-6 管理頁面 - 列表與篩選

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/epic-21-exchange-rate-management/21-6-management-page-list-filter.md
3. docs/04-implementation/tech-specs/epic-21-exchange-rate-management/tech-spec-story-21-6.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- src/components/features/reference-number/（參考組件模式）

## 開發要求
1. 建立 /admin/exchange-rates 列表頁
2. 建立 ExchangeRateList 組件
3. 建立 ExchangeRateFilters 組件
4. 建立 CurrencySelect 組件
5. 新增 i18n 翻譯文件
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過
- [ ] 執行 `npm run i18n:check` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`
- [ ] 更新 Story 文件 Status 改為 `done`

### 3. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 21-7: 管理頁面 - 表單

```
# 開發任務：Story 21-7 管理頁面 - 表單

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/epic-21-exchange-rate-management/21-7-management-page-form.md
3. docs/04-implementation/tech-specs/epic-21-exchange-rate-management/tech-spec-story-21-7.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- src/components/features/exchange-rate/CurrencySelect.tsx

## 開發要求
1. 建立新增頁面（/admin/exchange-rates/new）
2. 建立編輯頁面（/admin/exchange-rates/[id]）
3. 建立 ExchangeRateForm 組件
4. 實現反向匯率預覽功能
5. 使用 React Hook Form + Zod 驗證
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過
- [ ] 執行 `npm run i18n:check` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`
- [ ] 更新 Story 文件 Status 改為 `done`

### 3. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 21-8: 管理頁面 - 計算器與 Import

```
# 開發任務：Story 21-8 管理頁面 - 計算器與 Import

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/epic-21-exchange-rate-management/21-8-management-page-calculator-import.md
3. docs/04-implementation/tech-specs/epic-21-exchange-rate-management/tech-spec-story-21-8.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- src/components/features/exchange-rate/

## 開發要求
1. 建立 ExchangeRateCalculator 組件
2. 建立 ExchangeRateImportDialog 組件
3. 實現即時匯率計算預覽
4. 實現 JSON 檔案上傳和貼上
5. 實現導入結果統計顯示
6. 實現導出功能
7. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過
- [ ] 執行 `npm run i18n:check` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`
- [ ] 更新 Story 文件 Status 改為 `done`

### 3. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

