# CHANGE-032: Reference Number 匹配與 Exchange Rate 轉換 Pipeline 整合

> **日期**: 2026-02-08
> **狀態**: ✅ 已完成
> **完成日期**: 2026-02-09
> **優先級**: High
> **類型**: Feature
> **影響範圍**: extraction-v3 pipeline、新 PipelineConfig 資料模型、新 Admin UI 頁面、i18n

---

## 變更背景

Reference Numbers（參考編號）和 Exchange Rates（匯率）功能已實現為獨立的管理模組（CRUD + 批次操作 + Admin UI），但尚未整合到文件處理 pipeline 中。

**業務需求**：
1. **Reference Numbers**：在文件處理初期識別 shipment 號碼等參考編號，以便後續數據匹配到正確的物流成本記錄。用戶需要利用 shipment 號碼作為物流成本模版的記錄索引。如果文件號碼對不上，會影響到後面的數據模版匹配，令數據難以匹配到對應的記錄。
2. **Exchange Rates**：在 Stage 3 提取金額後，自動根據配置將金額轉換為指定的目標貨幣，支援不同區域的貨幣需求。

兩者都需要**可配置**（非硬編碼），並提供獨立的 Pipeline Settings 管理頁面。

---

## 變更內容

### 1. 新增 PipelineConfig 資料模型

建立 `PipelineConfig` Prisma model，支援 GLOBAL / REGION / COMPANY 三層 scope 配置，包含：
- Reference Number 匹配設定（啟用開關、匹配類型、來源、regex 模式等）
- Exchange Rate 轉換設定（啟用開關、目標貨幣、轉換欄位、精度等）

### 2. Reference Number 匹配步驟（混合模式）

**位置**：Stage 1 之前（FILE_PREPARATION 之後）

混合匹配策略：
- **Pre-Stage 1**：用 regex 掃描文件名，提取候選字串，透過現有 `validateReferenceNumbers()` 比對 DB
- **Stage 1 Prompt 注入**：將已匹配的 reference numbers 注入 Stage 1 的 prompt，讓 AI 從文件內容中識別更多
- **Stage 3 Prompt 注入**：將所有匹配結果注入 Stage 3，用於欄位關聯

### 3. Exchange Rate 轉換步驟（Post-Stage 3）

**位置**：Stage 3 之後、TERM_RECORDING 之前

處理流程：
- 從 Stage 3 結果讀取提取到的 `currency` 和金額
- 根據 PipelineConfig 的 `fxTargetCurrency` 查找匯率（透過現有 `convert()` 函數）
- 轉換 totalAmount、subtotal、lineItem 金額、extraCharge 金額
- 原始值和轉換值並存（不取代原始值）

### 4. Pipeline Settings 管理頁面

獨立的 Admin 設定頁面，含：
- Scope 選擇（GLOBAL / Region / Company）
- Reference Number Matching 設定區塊
- Exchange Rate Conversion 設定區塊
- 列表、新增、編輯功能

### 5. 信心度增強

Confidence 計算新增可選維度 `REFERENCE_NUMBER_MATCH`：
- 匹配成功加分，無匹配中性（不扣分）
- 僅在 refMatchEnabled 時啟用

---

## 技術設計

### Pipeline 架構變更

```
現有 V3.1 Pipeline（extraction-v3.service.ts:313 processFileV3_1）:

FILE_PREPARATION (PDF → Base64)                    [line 320-347]
    ↓
[NEW] REFERENCE_NUMBER_MATCHING (regex filename + DB lookup)
    ↓
orchestrator.execute (Stages 1-3)                  [line 349-387]
  ├─ STAGE_1_COMPANY (注入 ${matchedReferenceNumbers})
  ├─ STAGE_2_FORMAT
  └─ STAGE_3_EXTRACTION (注入 ${matchedReferenceNumbers} + ${exchangeRateInfo})
    ↓
[NEW] EXCHANGE_RATE_CONVERSION (code-based 轉換)
    ↓
TERM_RECORDING                                     [line 389-399]
    ↓
CONFIDENCE_CALCULATION (含可選 ref match 加分)      [line 401-416]
    ↓
ROUTING_DECISION
```

### Scope Resolution（Config 解析優先級）

```
1. COMPANY scope (companyId matches) — 最高優先
2. REGION scope (regionId matches) — 次優先
3. GLOBAL scope — 預設值
→ 合併策略：高優先覆蓋低優先的對應欄位
```

### 修改範圍

| 文件 | 變更類型 | 變更內容 |
|------|----------|----------|
| `prisma/schema.prisma` | 🔧 修改 | 新增 `PipelineConfig` model + `PipelineConfigScope` enum |
| `src/types/extraction-v3.types.ts` | 🔧 修改 | 新增 `ReferenceNumberMatchResult`、`ExchangeRateConversionResult`；擴展 `ExtractionV3Flags`、`ExtractionV3Output`；`ConfidenceDimensionV3_1` 新增 `REFERENCE_NUMBER_MATCH` |
| `src/services/extraction-v3/utils/variable-replacer.ts` | 🔧 修改 | `VariableContext`（line 39）新增 `matchedReferenceNumbers`、`exchangeRateInfo` 欄位 |
| `src/services/extraction-v3/extraction-v3.service.ts` | 🔧 修改 | `processFileV3_1()`（line 313）加入 ref match 和 FX conversion 步驟 |
| `src/services/extraction-v3/stages/stage-orchestrator.service.ts` | 🔧 修改 | 傳遞 ref match 結果到 Stage 1/3 variable context |
| `src/services/extraction-v3/confidence-v3-1.service.ts` | 🔧 修改 | 新增可選 `REFERENCE_NUMBER_MATCH` 維度 |
| `src/components/layout/Sidebar.tsx` | 🔧 修改 | 新增 Pipeline Settings 導航項目（約 line 126-136 區域） |
| `src/i18n/request.ts` | 🔧 修改 | 新增 `pipelineConfig` namespace |
| `prisma/seed.ts` | 🔧 修改 | 新增 default GLOBAL config seed |
| `src/services/pipeline-config.service.ts` | 🆕 新增 | PipelineConfig CRUD + scope resolution |
| `src/services/extraction-v3/stages/reference-number-matcher.service.ts` | 🆕 新增 | Ref number 匹配服務 |
| `src/services/extraction-v3/stages/exchange-rate-converter.service.ts` | 🆕 新增 | 匯率轉換服務 |
| `src/lib/validations/pipeline-config.schema.ts` | 🆕 新增 | Zod validation schema |
| `src/app/api/v1/pipeline-configs/route.ts` | 🆕 新增 | List + Create API |
| `src/app/api/v1/pipeline-configs/[id]/route.ts` | 🆕 新增 | Get + Update + Delete API |
| `src/app/api/v1/pipeline-configs/resolve/route.ts` | 🆕 新增 | Resolve effective config API |
| `src/hooks/use-pipeline-configs.ts` | 🆕 新增 | React Query hooks |
| `src/app/[locale]/(dashboard)/admin/pipeline-settings/page.tsx` | 🆕 新增 | 設定列表頁 |
| `src/app/[locale]/(dashboard)/admin/pipeline-settings/new/page.tsx` | 🆕 新增 | 新增設定頁 |
| `src/app/[locale]/(dashboard)/admin/pipeline-settings/[id]/page.tsx` | 🆕 新增 | 編輯設定頁 |
| `src/components/features/pipeline-config/PipelineConfigList.tsx` | 🆕 新增 | 列表組件 |
| `src/components/features/pipeline-config/PipelineConfigForm.tsx` | 🆕 新增 | 表單組件 |
| `src/components/features/pipeline-config/PipelineConfigFilters.tsx` | 🆕 新增 | 篩選組件 |
| `src/components/features/pipeline-config/PipelineConfigScopeBadge.tsx` | 🆕 新增 | Scope 標籤組件 |
| `src/components/features/pipeline-config/index.ts` | 🆕 新增 | 組件導出 |
| `messages/en/pipelineConfig.json` | 🆕 新增 | English 翻譯 |
| `messages/zh-TW/pipelineConfig.json` | 🆕 新增 | 繁體中文翻譯 |
| `messages/zh-CN/pipelineConfig.json` | 🆕 新增 | 簡體中文翻譯 |
| `messages/*/navigation.json` | 🔧 修改 | 新增 `sidebar.pipelineSettings` |

### 資料庫影響

```prisma
model PipelineConfig {
  id          String              @id @default(cuid())
  scope       PipelineConfigScope // GLOBAL | REGION | COMPANY
  regionId    String?
  companyId   String?

  // Reference Number Matching
  refMatchEnabled        Boolean @default(false)
  refMatchTypes          Json?   // ["SHIPMENT","HAWB","MAWB","BL","CONTAINER"]
  refMatchFromFilename   Boolean @default(true)
  refMatchFromContent    Boolean @default(true)
  refMatchPatterns       Json?   // Custom regex patterns
  refMatchMaxCandidates  Int     @default(20)

  // Exchange Rate Conversion
  fxConversionEnabled    Boolean @default(false)
  fxTargetCurrency       String? @db.VarChar(3)
  fxConvertLineItems     Boolean @default(true)
  fxConvertExtraCharges  Boolean @default(true)
  fxRoundingPrecision    Int     @default(2)
  fxFallbackBehavior     String  @default("skip") // skip | warn | error

  // Meta
  isActive    Boolean  @default(true)
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt()

  region      Region?  @relation(fields: [regionId], references: [id])
  company     Company? @relation(fields: [companyId], references: [id])

  @@unique([scope, regionId, companyId])
  @@index([scope])
  @@index([isActive])
  @@map("pipeline_configs")
}

enum PipelineConfigScope {
  GLOBAL
  REGION
  COMPANY
}
```

### i18n 影響

| 語言 | 文件 | 需要更新的 Key |
|------|------|---------------|
| en | `messages/en/pipelineConfig.json` | 🆕 新增（全部） |
| zh-TW | `messages/zh-TW/pipelineConfig.json` | 🆕 新增（全部） |
| zh-CN | `messages/zh-CN/pipelineConfig.json` | 🆕 新增（全部） |
| en | `messages/en/navigation.json` | 新增 `sidebar.pipelineSettings` |
| zh-TW | `messages/zh-TW/navigation.json` | 同上 |
| zh-CN | `messages/zh-CN/navigation.json` | 同上 |

### 可重用的現有服務方法

| 服務 | 方法 | 位置 | 用途 |
|------|------|------|------|
| `reference-number.service.ts` | `validateReferenceNumbers()` | line 834 | 驗證候選編號是否存在於 DB |
| `exchange-rate.service.ts` | `convert()` | line 676 | 匯率轉換（含 direct → inverse → cross-rate fallback） |

---

## 設計決策

1. **Ref matching 用混合模式** — filename 用 regex（快速精確），content 由 AI 透過 prompt 識別（支援圖片/PDF），兼顧效率與覆蓋率

2. **FX conversion 用 post-processing** — GPT 應提取文件上的原始金額，數學轉換由代碼確定性執行，避免 AI 計算錯誤

3. **Target currency 在 Region 層級設定** — Region（如 HKG → HKD, SGP → SGD）設預設目標貨幣，Company 可覆蓋

4. **獨立 PipelineConfig model** — 不重用 PromptConfig，避免概念混淆。Pipeline 設定有自己的 scope 解析和 UI

5. **Feature flags 獨立控制** — `refMatchEnabled` 和 `fxConversionEnabled` 各自獨立，可單獨啟用/關閉

6. **原始值不被取代** — FX conversion 結果與原始金額並存，保留審計追溯能力

---

## 影響範圍評估

### 文件影響清單

| 文件路徑 | 類型 | 說明 |
|----------|------|------|
| `prisma/schema.prisma` | 🔧 修改 | 新增 PipelineConfig model + enum |
| `src/types/extraction-v3.types.ts` | 🔧 修改 | 新增結果 interface、擴展 flags/output/dimension |
| `src/services/pipeline-config.service.ts` | 🆕 新增 | PipelineConfig CRUD + scope resolution |
| `src/services/extraction-v3/stages/reference-number-matcher.service.ts` | 🆕 新增 | Ref number 匹配服務 |
| `src/services/extraction-v3/stages/exchange-rate-converter.service.ts` | 🆕 新增 | 匯率轉換服務 |
| `src/services/extraction-v3/extraction-v3.service.ts` | 🔧 修改 | processFileV3_1 加入新步驟 |
| `src/services/extraction-v3/stages/stage-orchestrator.service.ts` | 🔧 修改 | 傳遞 ref match 到 variable context |
| `src/services/extraction-v3/utils/variable-replacer.ts` | 🔧 修改 | 新增 VariableContext 欄位 |
| `src/services/extraction-v3/confidence-v3-1.service.ts` | 🔧 修改 | 新增 ref match 維度 |
| `src/lib/validations/pipeline-config.schema.ts` | 🆕 新增 | Zod validation schema |
| `src/app/api/v1/pipeline-configs/route.ts` | 🆕 新增 | List + Create API |
| `src/app/api/v1/pipeline-configs/[id]/route.ts` | 🆕 新增 | Get + Update + Delete API |
| `src/app/api/v1/pipeline-configs/resolve/route.ts` | 🆕 新增 | Resolve effective config API |
| `src/hooks/use-pipeline-configs.ts` | 🆕 新增 | React Query hooks |
| `src/app/[locale]/(dashboard)/admin/pipeline-settings/page.tsx` | 🆕 新增 | 設定列表頁 |
| `src/app/[locale]/(dashboard)/admin/pipeline-settings/new/page.tsx` | 🆕 新增 | 新增設定頁 |
| `src/app/[locale]/(dashboard)/admin/pipeline-settings/[id]/page.tsx` | 🆕 新增 | 編輯設定頁 |
| `src/components/features/pipeline-config/` (5 files) | 🆕 新增 | UI 組件 |
| `messages/*/pipelineConfig.json` (3 files) | 🆕 新增 | i18n 翻譯 |
| `messages/*/navigation.json` (3 files) | 🔧 修改 | 新增 sidebar 項目 |
| `src/i18n/request.ts` | 🔧 修改 | 新增 namespace |
| `src/components/layout/Sidebar.tsx` | 🔧 修改 | 新增導航項目 |
| `prisma/seed.ts` | 🔧 修改 | 新增 default config |

**總計：~30 個文件**（18 個新增 + 12 個修改）

### 向後兼容性

- **Extraction Pipeline**: 完全向後兼容。兩個功能預設關閉（`enabled: false`），不影響現有文件處理。
- **Database**: 新增 table，不修改現有 table。需要 Prisma migration。
- **API**: 新增 endpoints，不修改現有 endpoints。
- **UI**: 新增頁面，不修改現有頁面。
- **Reused Services**: `reference-number.service.ts` 和 `exchange-rate.service.ts` 的現有方法被引用但不修改。

---

## 實施計劃（分 7 階段）

### Phase 1: Data Model & Types
1. 新增 `PipelineConfig` Prisma model + enum
2. 執行 `prisma migrate dev --name add_pipeline_config`
3. 擴展 `extraction-v3.types.ts` — 新增 interfaces、擴展 flags/output/dimension
4. 擴展 `variable-replacer.ts` — `VariableContext` 新增 2 個欄位

### Phase 2: Pipeline Config Service & API
1. 建立 `pipeline-config.service.ts`（CRUD + resolve effective config）
2. 建立 `pipeline-config.schema.ts`（Zod validation）
3. 建立 API routes（list/create, get/update/delete, resolve）

### Phase 3: Reference Number Matcher
1. 建立 `reference-number-matcher.service.ts`（regex filename scan + DB validate）
2. 整合到 `processFileV3_1()` — FILE_PREPARATION 和 orchestrator.execute 之間
3. 修改 `stage-orchestrator.service.ts` — 注入到 Stage 1/3 的 variable context

### Phase 4: Exchange Rate Converter
1. 建立 `exchange-rate-converter.service.ts`（讀取 Stage 3 結果 + 調用 `convert()`）
2. 整合到 `processFileV3_1()` — Stage 3 結果後、TERM_RECORDING 前

### Phase 5: Confidence Enhancement
1. `ConfidenceDimensionV3_1` enum 新增 `REFERENCE_NUMBER_MATCH`
2. `confidence-v3-1.service.ts` — 新增可選維度計算邏輯

### Phase 6: Admin UI
1. 建立 Pipeline Settings 頁面（列表、新增、編輯）
2. 建立組件（PipelineConfigList, Form, Filters, ScopeBadge）
3. 建立 `use-pipeline-configs.ts` React Query hooks
4. 更新 Sidebar.tsx 導航（line 126-136 區域）
5. 建立 i18n 翻譯文件（pipelineConfig.json x 3 語言）
6. 更新 navigation.json（x 3 語言）
7. 更新 `src/i18n/request.ts` 新增 namespace

### Phase 7: Seed Data & Testing
1. `prisma/seed.ts` — 新增 default GLOBAL config（兩功能預設關閉）
2. TypeScript 編譯驗證：`npm run type-check`
3. i18n 完整性驗證：`npm run i18n:check`
4. 瀏覽器手動測試 Pipeline Settings 頁面
5. 測試 extraction pipeline 在功能啟用/關閉狀態下的行為

---

## 風險評估

| 風險 | 可能性 | 影響 | 緩解措施 |
|------|--------|------|---------|
| Pipeline 性能下降 | 中 | 🟡 處理時間增加 | ref matching 僅增加 DB 查詢，FX conversion 純計算；兩者可獨立關閉 |
| Scope resolution 邏輯複雜 | 低 | 🟡 配置合併錯誤 | 建立 resolve API 供前端和 pipeline 共用，單一來源 |
| VariableContext 未注入 | 低 | 🟡 prompt 變數顯示原樣 | variable-replacer 已有 `unknownHandling: 'preserve'` 機制 |
| FX 匯率不存在 | 中 | 🟡 轉換失敗 | fxFallbackBehavior 可設為 skip/warn/error，用戶可控 |
| 現有 pipeline 被影響 | 極低 | 🔴 處理流程中斷 | 兩功能預設關閉，Feature Flag 控制 |

### 回滾計劃

1. 兩個功能都有獨立的 `enabled: false` 開關，可即時關閉
2. 資料庫為新增 table，不修改現有 table，rollback migration 即可還原
3. 新增的步驟在 processFileV3_1 中有 try-catch 保護

---

## 驗收標準

| # | 驗收項目 | 驗收標準 | 優先級 |
|---|----------|----------|--------|
| 1 | Pipeline Config CRUD | 可建立/讀取/更新/刪除 GLOBAL/REGION/COMPANY 級別的配置 | High |
| 2 | Scope Resolution | COMPANY 覆蓋 REGION 覆蓋 GLOBAL 的配置合併正確 | High |
| 3 | Ref Number Filename Matching | 上傳含 shipment 號碼的文件名時，自動匹配到 DB 中的 reference number | High |
| 4 | Ref Number Content Detection | Stage 1 prompt 注入 matched refs 後，AI 能從文件內容識別更多 reference numbers | High |
| 5 | FX Conversion | Stage 3 提取的金額能根據配置的 target currency 正確轉換 | High |
| 6 | FX Fallback | 當匯率不存在時，根據 fallbackBehavior 設定正確處理（skip/warn/error） | Medium |
| 7 | Pipeline Settings UI | Admin 頁面可管理 Pipeline Config 設定，三語翻譯正確 | High |
| 8 | Feature Flag 控制 | 兩個功能可各自獨立啟用/關閉 | High |
| 9 | 原始值保留 | FX 轉換後，原始金額和轉換金額並存 | Medium |
| 10 | Confidence 加分 | ref number 匹配成功時，信心度適當加分 | Low |
| 11 | TypeScript 編譯通過 | `npm run type-check` 無錯誤 | High |
| 12 | i18n 完整性 | `npm run i18n:check` 三語翻譯完整 | High |

## 測試場景

| # | 場景 | 測試步驟 | 預期結果 |
|---|------|----------|----------|
| 1 | 建立 GLOBAL 配置 | 在 Pipeline Settings 頁面建立 GLOBAL scope 配置，啟用 ref matching | 配置成功建立，列表顯示正確 |
| 2 | Ref matching（文件名） | 上傳文件名含 "SHP-2026-HK-123456" 的文件 | pipeline output 中包含匹配到的 reference number |
| 3 | Ref matching（文件內容） | 上傳文件內容含 shipment 號碼但文件名無 | Stage 1 AI 識別出 reference number |
| 4 | FX conversion（直接） | 提取到的 USD 金額，target 設為 HKD，DB 有 USD→HKD 匯率 | 正確轉換，原始和轉換值並存 |
| 5 | FX conversion（cross-rate） | 提取到的 EUR 金額，target 設為 HKD，無直接匯率 | 透過 USD cross-rate 轉換成功 |
| 6 | FX conversion（skip fallback） | DB 無對應匯率，fallbackBehavior = "skip" | 跳過轉換，output 無 conversion 結果 |
| 7 | Scope 覆蓋 | GLOBAL 設 target=USD，REGION(HKG) 設 target=HKD | HKG region 的文件使用 HKD 作為 target |
| 8 | 功能關閉 | 兩個功能都 disabled | pipeline 行為與現有完全一致 |
| 9 | TypeScript 編譯 | `npm run type-check` | 無錯誤 |
| 10 | i18n 完整性 | `npm run i18n:check` | 三語翻譯完整 |
