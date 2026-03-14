# Task 4: 設計決策分析

> **產出日期**: 2026-02-27
> **分析方法**: 4 個並行 Explore Agent 深度代碼追蹤
> **用途**: 最終報告中「關鍵設計決策」和「平台定位與價值主張」章節的數據來源

---

## 目錄

1. [決策 1: 三層映射系統 (Three-Tier Mapping)](#決策-1-三層映射系統-three-tier-mapping)
2. [決策 2: V3.1 三階段提取管線](#決策-2-v31-三階段提取管線)
3. [決策 3: 信心度路由機制](#決策-3-信心度路由機制)
4. [決策 4: 統一處理器 + V3 雙軌架構](#決策-4-統一處理器--v3-雙軌架構)
5. [決策 5: Forwarder → Company 重構](#決策-5-forwarder--company-重構)
6. [決策 6: 技術棧選擇](#決策-6-技術棧選擇)
7. [決策 7: Python 微服務分離](#決策-7-python-微服務分離)
8. [決策 8: 平台定位與價值主張](#決策-8-平台定位與價值主張)
9. [決策 9: 企業級認證與授權架構](#決策-9-企業級認證與授權架構)
10. [決策 10: n8n 工作流引擎整合](#決策-10-n8n-工作流引擎整合)
11. [決策 11: 多維度審計日誌系統](#決策-11-多維度審計日誌系統)
12. [總結: 決策全景矩陣](#總結-決策全景矩陣)

---

## 決策 1: 三層映射系統 (Three-Tier Mapping)

**問題**: 如何高效且可維護地支援多家 Forwarder（運輸公司）的術語映射，同時保持系統的靈活性和成本效益？原始需求需要處理 45+ 個 Forwarder、100+ 種格式、約 90 個統一 Header，如果每家公司建立獨立映射規則集（~9,000 條），維護成本將難以承受。

**選擇**: 分層映射架構 — Tier 1（通用層）→ Tier 2（特定覆蓋層）→ Tier 3（AI 智能分類），將 9,000 條規則精簡為 ~800 條，維護成本降低 90%。

**替代方案**:

| 方案 | 說明 | 問題 |
|------|------|------|
| 單層映射 | 統一映射表，所有 Forwarder 共用 | 無法應對差異化需求，準確率低 |
| 完全個性化 | 每個 Forwarder 獨立規則集 | 維護成本 O(n)，9,000+ 條規則 |
| 純 AI 分類 | 完全依賴 GPT 分類 | 成本過高（每份 $0.01+），無法利用確定映射 |

**理由**: 三層漸進式設計在維護成本、準確率和靈活性之間取得最優平衡。

### 層級架構與覆蓋率

**Tier 1: Universal Mapping（通用層）— 覆蓋 70-80%**

所有 Forwarder 通用的常見術語映射。在 Prisma 模型中以 `companyId: null` 標識：

```typescript
// src/services/rule-resolver.ts (行 283-334)
const rules = await prisma.mappingRule.findMany({
  where: {
    companyId: null,      // Tier 1 標識：通用規則
    status: 'ACTIVE',
    isActive: true,
  },
  orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
});
```

**Tier 2: Company-Specific Override（特定覆蓋層）— 額外 10-15%**

只記錄該 Forwarder 與通用規則「不同」的映射，以 `companyId` 非 null 標識：

```typescript
// src/services/rule-resolver.ts (行 183-215)
const rules = await prisma.mappingRule.findMany({
  where: {
    companyId,  // Tier 2 標識：公司特定規則
    status: 'ACTIVE',
    isActive: true,
  },
  orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
});
```

**Tier 3: LLM Classification（AI 智能分類）— 剩餘 5-10%**

Tier 1 和 Tier 2 都無匹配時，調用 GPT-5.2 進行智能分類。在 `term-classification.service.ts`（Epic 4 Story 4.4）中實現，返回分類結果 + 信心度。

### 層間優先順序與覆蓋邏輯

配置層級優先級在 `config-resolver.ts` 中定義：

```typescript
// src/services/mapping/config-resolver.ts (行 40-44)
const SCOPE_PRIORITY: Record<ConfigScope, number> = {
  GLOBAL: 1,      // 最低優先級（Tier 1）
  COMPANY: 2,     // 中等優先級（Tier 2）
  FORMAT: 3,      // 最高優先級（Tier 2 細粒度）
};
```

**查詢流程**:
1. 查詢 Tier 2（公司特定規則）→ 如有匹配，優先使用
2. 查詢 Tier 1（通用規則）→ Tier 2 無結果時使用
3. 回退到 Tier 3（LLM 分類）→ Tier 1/2 都無匹配時觸發

### 規則合併與轉換策略

當同一欄位有多條適用規則時，按 `priority` 選擇最高的。通過 `TransformExecutor` 執行 5 種轉換類型：

| 轉換類型 | 說明 |
|----------|------|
| `DIRECT` | 直接映射 |
| `CONCAT` | 串接多個欄位 |
| `SPLIT` | 分割為多個值 |
| `LOOKUP` | 查詢表映射 |
| `CUSTOM` | 自定義邏輯 |

結果通過 `result-validation.service.ts` 驗證轉換正確性。

**取捨**:

| 好處 | 代價 |
|------|------|
| 規則數量從 9,000 → 800（↓90%） | 需要維護三層優先級邏輯 |
| 新 Forwarder 只需添加差異規則 | Tier 3 LLM 調用有成本和延遲 |
| 通用層知識可跨 Forwarder 共享 | 層間覆蓋邏輯需要充分測試 |
| 支持持續學習（修正 → 新規則） | 規則衝突排查複雜度增加 |

**代碼證據**:

| 文件路徑 | 行號 | 功能 |
|----------|------|------|
| `prisma/schema.prisma` | 514-554 | MappingRule 模型定義（含 companyId Tier 標識） |
| `src/services/rule-resolver.ts` | 183-215 | `getRulesForCompany()` — Tier 2 查詢 |
| `src/services/rule-resolver.ts` | 283-334 | `getUniversalRules()` — Tier 1 查詢 |
| `src/services/mapping/config-resolver.ts` | 40-44 | `SCOPE_PRIORITY` — 層級優先級定義 |
| `src/services/mapping/dynamic-mapping.service.ts` | 1-100 | 映射整合層實現 |
| `docs/02-architecture/tier3-llm-implementation-assessment.md` | 全文 | Tier 3 設計與實現評估 |

**影響範圍**: 資料庫層（mapping_rules 表）、服務層（mapping/ 7 個文件含 6 服務 + index.ts）、API 層（/api/v1/mappings）、UI 層（Mapping Rule Management 頁面）

---

## 決策 2: V3.1 三階段提取管線

**問題**: 如何優化 V3 單次 GPT 提取的成本和準確度，同時應對複雜文件和新格式？V3 使用單次 GPT 調用完成所有工作，成本約 $0.01/份，且 prompt 過長影響準確度。

**選擇**: 三階段分離架構（CHANGE-024），將單次調用拆為三階段，前兩階段用廉價模型，只在最關鍵的欄位提取階段用高級模型：
- **Stage 1**: 公司識別（GPT-5-nano，~$0.0004）
- **Stage 2**: 格式識別（GPT-5-nano，~$0.0005）
- **Stage 3**: 欄位提取（GPT-5.2，~$0.0027）
- **總計**: ~$0.0036/份（**節省 86%**）

**替代方案**:

| 方案 | 說明 | 問題 |
|------|------|------|
| 保持 V3 單次 | 一個 prompt 完成所有工作 | 成本高（$0.01），prompt 過長影響準確度 |
| 純 GPT-5.2 三次調用 | 三階段都用最強模型 | 成本 $0.01+，經濟效益差 |
| 三次都用 nano | 三階段都用最便宜模型 | 欄位提取準確率達不到 92%+ |

**理由**: 任務分解 + 模型分級，在成本和準確度之間取得最優平衡。

### 三階段架構設計

**Stage 1: 公司識別 (GPT-5-nano)**

```typescript
// src/services/extraction-v3/stages/stage-1-company.service.ts
interface Stage1CompanyResult {
  companyId?: string;
  companyName: string;
  identificationMethod: 'LOGO' | 'HEADER' | 'ADDRESS' | 'TAX_ID' | 'LLM_INFERRED';
  confidence: number;  // 0-100
  isNewCompany: boolean;
}
```
- 預估耗時: ~9 秒
- 利用公司 Logo、頭部、地址、稅號等特徵進行快速識別

**Stage 2: 格式識別 (GPT-5-nano)**

```typescript
// src/services/extraction-v3/stages/stage-2-format.service.ts
interface Stage2FormatResult {
  formatId?: string;
  formatName: string;
  confidence: number;
  isNewFormat: boolean;
  configSource: 'COMPANY_SPECIFIC' | 'UNIVERSAL' | 'LLM_INFERRED';
}
```
- 預估耗時: ~10 秒
- 配置決策流程：公司特定配置 → 統一配置 → LLM 推斷

**Stage 3: 欄位提取 (GPT-5.2)**

```typescript
// src/services/extraction-v3/stages/stage-3-extraction.service.ts
interface Stage3ExtractionResult {
  standardFields: StandardFieldsV3;
  lineItems: LineItemV3[];
  extraCharges?: ExtraChargeV3[];
  overallConfidence: number;
  configUsed: {
    promptConfigScope: 'GLOBAL' | 'COMPANY' | 'FORMAT';
    universalMappingsCount: number;
    companyMappingsCount: number;
  };
}
```
- 預估耗時: ~6 秒
- 配置組裝：PromptConfig (FORMAT > COMPANY > GLOBAL) + FieldMappingConfig + MappingRule (Tier 1+2) + customFields

### 與三層映射系統的對應

```
TIER 1: Universal Mapping
  ├─ Stage 2：統一格式配置（無公司特定配置時）
  └─ Stage 3：GLOBAL 級 PromptConfig + 通用術語映射

TIER 2: Company-Specific Override
  ├─ Stage 2：公司特定格式配置（優先使用）
  └─ Stage 3：COMPANY/FORMAT 級 PromptConfig + 公司特定術語映射

TIER 3: LLM Classification
  ├─ Stage 1：公司識別（無配置匹配時由 LLM 推斷）
  ├─ Stage 2：格式識別（無配置時由 LLM 推斷並標記 isNewFormat）
  └─ Stage 3：術語分類（無映射的術語由 LLM 智能分類）
```

### V3 → V3.1 的演進

```
V3 (7 步管線)：                    V3.1 (7 步管線，三階段提取)：
1. FILE_PREPARATION                1. FILE_PREPARATION
2. DYNAMIC_PROMPT_ASSEMBLY  ─┐     2. STAGE_1_COMPANY_IDENTIFICATION  ┐
3. UNIFIED_GPT_EXTRACTION   ─┼─→   3. STAGE_2_FORMAT_IDENTIFICATION   ├─ 新三階段
4. RESULT_VALIDATION        ─┘     4. STAGE_3_FIELD_EXTRACTION        ┘
5. TERM_RECORDING                  5. TERM_RECORDING
6. CONFIDENCE_CALCULATION          6. CONFIDENCE_CALCULATION (V3.1 五維度)
7. ROUTING_DECISION                7. ROUTING_DECISION
```

### Feature Flag 灰度發布

```typescript
// src/types/extraction-v3.types.ts（定義位置；在 extraction-v3.service.ts 行 142 被引用）
export interface ExtractionV3Flags {
  useExtractionV3_1: boolean;           // 主開關
  extractionV3_1Percentage: number;     // 灰度百分比 (0-100)
  fallbackToV3OnError: boolean;         // V3.1 失敗回退到 V3
}
```

### 資料庫持久化

ExtractionResult 新增 13 個 stage 相關欄位支援三階段追蹤：

```sql
stage1Result, stage2Result, stage3Result                  (JSONB)     — 3 個
stage1AiDetails, stage2AiDetails, stage3AiDetails        (JSONB)     — 3 個
stage1DurationMs, stage2DurationMs, stage3DurationMs     (Integer)   — 3 個
stage2ConfigSource, stage3ConfigScope                    (String)    — 2 個
referenceNumberMatch, fxConversionResult                 (JSONB)     — 2 個
```

**取捨**:

| 好處 | 代價 |
|------|------|
| 成本從 $0.01 降至 $0.0036（↓86%）¹ | 三次 API 調用的延遲增加 |
| 每階段可獨立優化 prompt 和模型 | 系統複雜度增加（3 個 service + 協調器） |
| 前兩階段結果可為 Stage 3 提供上下文 | 需要處理階段間的錯誤傳播 |
| Feature Flag 支持灰度發布和快速回滾 | 資料庫 schema 擴展（13 個 stage 相關欄位） |

**代碼證據**:

| 文件路徑 | 功能 |
|----------|------|
| `src/services/extraction-v3/stages/stage-orchestrator.service.ts` | 三階段協調器 |
| `src/services/extraction-v3/stages/stage-1-company.service.ts` | Stage 1 公司識別 |
| `src/services/extraction-v3/stages/stage-2-format.service.ts` | Stage 2 格式識別 |
| `src/services/extraction-v3/stages/stage-3-extraction.service.ts` | Stage 3 欄位提取 |
| `src/services/extraction-v3/confidence-v3-1.service.ts` | V3.1 五維度信心度 |
| `prisma/schema.prisma` (行 583-596) | ExtractionResult 新增欄位 |
| `claudedocs/4-changes/feature-changes/CHANGE-024-*.md` | 完整規劃與實施文檔 |

> ¹ 成本數據來源於 CHANGE-024 設計文檔中的模型定價估算，代碼中未硬編碼此數據。

**影響範圍**: 服務層（stages/ 下 7 個服務 + 協調器）、API 層（支援 `?include=stageDetails`）、UI 層（ProcessingTimeline 三階段顯示）、資料庫（13 個 stage 相關欄位）

---

## 決策 3: 信心度路由機制

**問題**: 如何自動判斷提取結果的可靠性，決定是否需要人工審核以及審核級別？每年 45-50 萬張發票，自動化率目標 90%+，需要精準的路由決策避免漏審和過審。

**選擇**: 基於 V3.1 三階段的 **5 維度加權信心度計算** + **配置來源加成** + **智能降級機制**，實現兩層路由決策。

**替代方案**:

| 方案 | 說明 | 問題 |
|------|------|------|
| 單一維度評分 | 只基於 Stage 3 欄位提取信心度 | 無法反映三階段各自的質量 |
| 固定路由規則 | 按文件類型或公司硬編碼 | 缺乏自適應能力 |
| 純 LLM 決策 | 讓 GPT 決定路由 | 成本高、不可控、無法審計 |

**理由**: 多維度加權可全面反映提取質量，智能降級可主動防範新場景風險。

### 5 維度加權計算

```typescript
// src/types/extraction-v3.types.ts (行 1282-1290)
DEFAULT_CONFIDENCE_WEIGHTS_V3_1 = {
  STAGE_1_COMPANY: 0.20,        // 20% — 公司識別質量
  STAGE_2_FORMAT: 0.15,         // 15% — 格式識別質量
  STAGE_3_EXTRACTION: 0.30,     // 30% — 欄位提取質量（最重要）
  FIELD_COMPLETENESS: 0.20,     // 20% — 必填欄位完整性
  CONFIG_SOURCE_BONUS: 0.15,    // 15% — 配置來源加成
}
```

**權重設計理由**:
- **Stage 3 (30%)** 佔比最高：直接反映欄位提取質量，是業務價值的核心
- **Stage 1 (20%)**：公司識別影響後續所有步驟的配置選擇
- **欄位完整性 (20%)**：必填欄位數量決定數據可用性
- **Stage 2 (15%)**：格式識別錯誤影響相對較小（可後續修正）
- **配置來源 (15%)**：區分規則質量，避免虛假高分

> **注意**: 另有第 6 維度 `REFERENCE_NUMBER_MATCH`（權重預設為 0，由 CHANGE-032 新增但預設禁用），可在配置中啟用。

### 配置來源加成 (CONFIG_SOURCE_BONUS)

```typescript
// src/types/extraction-v3.types.ts (行 1297-1304，定義位置；在 confidence-v3-1.service.ts 中被引用)
CONFIG_SOURCE_BONUS_SCORES = {
  COMPANY_SPECIFIC: 100,  // 公司特定配置 → 滿分加成
  UNIVERSAL: 80,          // 通用配置 → 80 分
  LLM_INFERRED: 50,       // LLM 推斷 → 50 分（降權）
}
```

**運作原理**: Stage 2 結果的 `configSource` 決定加成分數。使用公司特定配置的提取結果天然更可靠。

### 路由閾值

```typescript
// src/services/extraction-v3/confidence-v3-1.service.ts (行 112-119)
ROUTING_THRESHOLDS_V3_1 = {
  AUTO_APPROVE: 90,    // ≥ 90% → 自動批准
  QUICK_REVIEW: 70,    // 70-89% → 快速審核（一鍵確認/修正）
  FULL_REVIEW: 0,      // < 70% → 完整人工審核
}
// 注意：CLAUDE.md 中記載的閾值為 95%/80%，這是早期設計值。
// 代碼在 CHANGE-024 實現時已調整為 90/70，以代碼為準。
```

### V3.1 智能降級邏輯

在標準信心度路由之上，有兩層降級機制：

**第一層：`getSmartReviewType()` — 前置強制降級**（行 527-590，5 條規則）：

| 優先級 | 條件 | 動作 | 理由 |
|--------|------|------|------|
| 1 | 新公司 + 新格式 | → 強制 `FULL_REVIEW` | 需同時配置兩個維度，風險最高 |
| 2 | 新公司 | → 強制 `FULL_REVIEW` | 無公司識別規則，Stage 1 不可信 |
| 3 | 新格式 | → 強制 `QUICK_REVIEW` | 新格式風險相對低，快速審核可驗證 |
| 4 | DEFAULT 配置來源 | → 降級一級 | 通用配置特定性低，風險增加 |
| 5 | 其他 | → 基於標準信心度路由 | 無特殊場景 |

**第二層：`generateRoutingDecision()` — 額外降級檢查**（行 373-478）：

| 條件 | 動作 |
|------|------|
| 新公司 | AUTO_APPROVE → QUICK_REVIEW |
| 新格式 | AUTO_APPROVE → QUICK_REVIEW |
| LLM 推斷配置 | AUTO_APPROVE → QUICK_REVIEW |
| 待分類項 > 3 | AUTO_APPROVE → QUICK_REVIEW |
| Stage 失敗 | → 強制 `FULL_REVIEW` |

**降級一級的邏輯**:
```
AUTO_APPROVE → QUICK_REVIEW
QUICK_REVIEW → FULL_REVIEW
FULL_REVIEW → FULL_REVIEW（無法再降）
```

### 路由決策執行流程

```typescript
// confidence-v3-1.service.ts (行 373-478) — 簡化版
generateRoutingDecision(input, score) {
  // Step 1: 基於分數的基本路由
  let decision = score >= 90 ? 'AUTO_APPROVE'
               : score >= 70 ? 'QUICK_REVIEW'
               : 'FULL_REVIEW';

  // Step 2-6: 業務場景降級檢查
  if (isNewCompany) decision = downgrade(decision);
  if (isNewFormat) decision = downgrade(decision);
  if (configSource === 'LLM_INFERRED') decision = downgrade(decision);
  if (itemsNeedingClassification > 3) decision = downgrade(decision);
  if (!stage1Success || !stage2Success) decision = 'FULL_REVIEW';

  return { decision, score, reasons: [...] };
}
```

**取捨**:

| 好處 | 代價 |
|------|------|
| 細粒度反映提取質量，精準路由 | 5 個權重參數需要調優和維護 |
| 配置來源加成避免虛假高分 | 需要準確的 configSource 標記 |
| 智能降級主動降低新場景風險 | 可能過度保守，影響自動化率 |
| 完整審計追蹤（記錄所有降級原因） | 決策邏輯複雜度增加 |

**代碼證據**:

| 文件路徑 | 功能 |
|----------|------|
| `src/services/extraction-v3/confidence-v3-1.service.ts` | V3.1 信心度計算核心（全文） |
| `src/services/extraction-v3/confidence-v3.service.ts` | V3 信心度計算（前版） |
| `src/services/confidence.service.ts` | V2 信心度計算（舊版） |
| `src/services/unified-processor/adapters/confidence-calculator-adapter.ts` | V2/V3 信心度適配器 |
| `src/services/unified-processor/steps/confidence-calculation.step.ts` | 管道步驟封裝 |
| `src/types/extraction-v3.types.ts` (行 1257-1304) | 維度定義、權重、閾值類型 |
| `src/constants/processing-steps-v3.ts` | 處理步驟常數 |

**影響範圍**: Stage Orchestrator、Result Validation、API 路由（返回路由決策）、審核流程（創建對應審核任務）、儀表板（信心度維度分解顯示）、審計日誌（降級原因記錄）

---

## 決策 4: 統一處理器 + V3 雙軌架構

**問題**: 系統同時存在 V2（11 步處理管線）和 V3（7 步純 GPT Vision 管線）。如何在保持系統穩定的同時，實現從 V2 到 V3/V3.1 的平滑過渡？

**選擇**: 建立 `UnifiedDocumentProcessorService` 作為統一入口，通過 Feature Flags 灰度發佈、工廠模式動態創建步驟處理器、適配器模式橋接 V2/V3 結果、錯誤自動回退。

**替代方案**:

| 方案 | 說明 | 問題 |
|------|------|------|
| 一次性切換 | 直接從 V2 切到 V3 | 風險高，無法驗證 |
| 並行兩套系統 | 完全獨立的 V2 和 V3 | 維護成本倍增、代碼重複 |
| 修改 V2 | 在 V2 中逐步添加 V3 特性 | 代碼混雜，難以維護 |

**理由**: 統一入口 + 灰度發佈是大規模系統過渡的業界最佳實踐。

### 統一處理器的三層決策

```typescript
// src/services/unified-processor/unified-document-processor.service.ts (行 160-184)
async processFile(input, options?) {
  // Layer 1: Legacy 檢查（向後兼容）
  if (options?.forceLegacy || !flags.enableUnifiedProcessor) {
    return this.useLegacyProcessor(input);
  }

  // Layer 2: V3 檢查（灰度發佈）
  if (this.shouldUseV3(input.fileId, options)) {
    return this.processWithV3(input, options, startTime);
  }

  // Layer 3: V2 默認（穩定路徑）
  const context = this.createContext(input);
  const stepResults = await this.executePipeline(context, flags);
  return this.buildResult(context, stepResults, startTime);
}
```

### Feature Flag 灰度決策

```typescript
// src/config/feature-flags.ts
function shouldUseExtractionV3(fileId?: string): boolean {
  const flags = getExtractionV3Flags();
  if (!flags.useExtractionV3) return false;

  // 基於 fileId hash 的確定性灰度（同一文件多次處理結果一致）
  const hash = hashFileId(fileId);
  return (hash % 100) < flags.extractionV3Percentage;
}
```

### 工廠模式 — 步驟處理器動態創建

```typescript
// src/services/unified-processor/factory/step-factory.ts
class StepFactory {
  createAllHandlers(): IStepHandler[] {
    return [
      new ConfigFetchingStepHandler(),
      new FileTypeDetectionStepHandler(),
      new AzureDIExtractionStepHandler(),
      new IssuerIdentificationStepHandler(),
      new FormatMatchingStepHandler(),
      new SmartRoutingStepHandler(),
      new RoutingDecisionStepHandler(),
      new GptEnhancedExtractionStepHandler(),
      new FieldMappingStepHandler(),
      new ConfidenceCalculationStepHandler(),
      new TermRecordingStepHandler(),
    ]; // V2 的 11 步
  }
}
```

### 適配器模式 — V3 結果轉為 V2 格式

```typescript
// unified-document-processor.service.ts (行 310+) — 簡化版
private convertV3Result(fileId, v3Result, startTime): UnifiedProcessingResult {
  // V3 StandardFieldsV3 → V2 InvoiceData
  const extractedData = {
    invoiceData: {
      invoiceNumber: result.standardFields.invoiceNumber.value?.toString(),
      invoiceDate: result.standardFields.invoiceDate.value?.toString(),
      // ...
    },
  };

  // V3 ProcessingStepV3_1 → V2 ProcessingStep
  const stepResults = v3Result.stepResults.map(sr => ({
    step: sr.step as unknown as ProcessingStep,
    success: sr.success,
    durationMs: sr.durationMs,
  }));

  return { success: true, fileId, extractedData, stepResults, usedV3: true };
}
```

### 回退機制

統一處理器層級的回退是 **V3 → V2**（兩級）。V3.1 是 V3 的內部版本（三階段 vs 單階段），不是獨立的回退層：

```
UnifiedProcessor 決策:
├─ forceLegacy → Legacy 處理器
├─ shouldUseV3 = true → V3 處理
│     └─ V3 失敗 + fallbackToV2OnError = true → 回退到 V2
└─ 默認 → V2 (11 步管線)

V3 內部決策（V3.1 是 V3 的子版本）:
└─ shouldUseV3_1 = true → 三階段提取（V3.1）
     └─ V3.1 內部失敗可回退到 V3 單階段
```

```typescript
// unified-document-processor.service.ts (行 226-282) — 簡化版
async processWithV3(input, options, startTime) {
  try {
    const v3Result = await this.getV3Service().processFile(v3Input);
    return this.convertV3Result(input.fileId, v3Result, startTime);
  } catch (error) {
    if (v3Flags.fallbackToV2OnError) {
      console.warn(`V3 failed for ${input.fileId}, falling back to V2`);
      const result = await this.executeV2Pipeline(input, startTime);
      result.usedV3Fallback = true;
      return result;
    }
    return this.buildErrorResult(input.fileId, error, startTime);
  }
}
```

### 架構流程圖

```
┌───────────────────────────────────────────────────────┐
│       UnifiedDocumentProcessor.processFile()           │
│                    統一入口                             │
└───────────────────────────────────────────────────────┘
                        │
       ┌────────────────┼────────────────┐
       ▼                ▼                ▼
  Legacy Check    V3 Decision      V2 Default
  (forceLegacy)   (Feature Flag)    (Stable)
       │                │                │
       ▼                ▼                ▼
  LegacyAdapter   V3 Service      V2 Pipeline
                  [3 Stages]      [11 Steps]
                       │                │
                       └───────┬────────┘
                               │
                           Adapter
                       (V3→V2 Convert)
                               │
                               ▼
                    UnifiedProcessingResult
```

**取捨**:

| 好處 | 代價 |
|------|------|
| 零停機灰度升級，快速回滾 | 需維護 V2/V3 兩套代碼 |
| Feature Flag 支持精細流量控制和 A/B 測試 | 增加配置複雜度 |
| 工廠模式讓步驟解耦，易於擴展 | 增加抽象層 |
| 適配器確保向後兼容 API | 適配器邏輯易出 bug |
| V3→V2 回退確保高可用性 | 可能隱藏 V3 問題 |

**代碼證據**:

| 文件路徑 | 功能 |
|----------|------|
| `src/services/unified-processor/unified-document-processor.service.ts` | 主協調器 |
| `src/services/unified-processor/factory/step-factory.ts` | 步驟工廠 |
| `src/services/unified-processor/interfaces/step-handler.interface.ts` | IStepHandler 介面 + BaseStepHandler 抽象基類 |
| `src/services/unified-processor/adapters/` | 7 個適配器 |
| `src/services/unified-processor/steps/` | 11 個步驟處理器（每步一個文件） |
| `src/services/extraction-v3/extraction-v3.service.ts` | V3 提取入口 |
| `src/config/feature-flags.ts` | Feature Flag 管理 |

**影響範圍**: 所有文件處理 API 端點、批次處理、n8n 工作流、監控面板（V2/V3 流量分佈）、審計日誌（處理器版本記錄）

---

## 決策 5: Forwarder → Company 重構

**問題**: 原始設計使用 "Forwarder" 模型表示貨運代理商，但系統實際需要支援多種公司類型（出口商、承運人、報關行等），且需要處理公司合併、名稱變體等業務邏輯。模型名稱無法準確反映業務範圍。

**選擇**: 將整個系統從 `Forwarder` 重構為更通用的 `Company` 模型（REFACTOR-001），擴展支援多公司類型、來源追蹤、名稱變體和合併管理。

**替代方案**:

| 方案 | 說明 | 問題 |
|------|------|------|
| 保留 Forwarder + 子類型 | 新增 ExporterProfile 等子模型 | 多對多關係複雜 |
| 單表繼承 | Forwarder 加 type 欄位 | 名稱語義不清 |
| 組合模式 | Company 包含 Forwarder | 過度設計 |

**理由**: 直接重命名最清晰，且新增的欄位（type, source, nameVariants, mergedIntoId）完整覆蓋業務需求。

### 模型對比

```prisma
// 舊: Forwarder 模型 (prisma/schema.prisma 行 401-433)
model Forwarder {
  id                     String   @id @default(uuid())
  name                   String   @unique
  code                   String   @unique
  identificationPatterns Json
  priority               Int      @default(0)
  status                 String   @default("ACTIVE")
  @@map("forwarders")
}

// 新: Company 模型 (prisma/schema.prisma 行 461-512)
model Company {
  id                        String          @id @default(uuid())
  name                      String
  code                      String?         @unique
  type                      CompanyType     @default(UNKNOWN)      // NEW: 多公司類型
  source                    CompanySource   @default(MANUAL)       // NEW: 創建來源追蹤
  nameVariants              String[]        @default([])           // NEW: 名稱變體（模糊匹配）
  mergedIntoId              String?                                // NEW: 公司合併追蹤
  identificationPatterns    Json
  // ... 擴展欄位
}

enum CompanyType { FORWARDER | EXPORTER | CARRIER | CUSTOMS_BROKER | OTHER | UNKNOWN }
enum CompanySource { MANUAL | AUTO_CREATED | IMPORTED }
```

### 遷移狀態

| 層級 | 影響 | 狀態 |
|------|------|------|
| Prisma Schema | Company 模型新增，Forwarder 保留（向後相容） | ✅ 完成 |
| API 路由 | `/forwarders` → `/companies`（CHANGE-007） | ✅ 完成 |
| 服務層 | company.service.ts 完全重建（1,720 行） | ✅ 完成 |
| 類型定義 | 新增 CompanyType, CompanySource enum | ✅ 完成 |
| 遺留引用 | 代碼庫中仍有 ~800+ 個 "forwarder" 引用（含 ~130+ 個文件） | 🔄 漸進清理中 |

**取捨**:

| 好處 | 代價 |
|------|------|
| 模型語義更準確，支援多公司類型 | 全系統重構工作量大 |
| 內建名稱變體改善模糊匹配 | ~800+ 個遺留引用需漸進清理 |
| 合併追蹤支持數據治理 | 向後相容需保留 Forwarder 模型 |

**代碼證據**:

| 文件路徑 | 功能 |
|----------|------|
| `prisma/schema.prisma` (行 401-512) | Forwarder 和 Company 模型定義 |
| `src/services/company.service.ts` (1,720 行) | Company CRUD 服務（REFACTOR-001 標記） |
| `prisma/CLAUDE.md` | 標記 Forwarder 為 deprecated |

**影響範圍**: Prisma Schema、331 個 API 路由、服務層、React 組件、i18n 翻譯、資料庫遷移

---

## 決策 6: 技術棧選擇

### 6.1 Next.js 15 App Router（非 Pages Router）

**問題**: 選擇 Next.js 路由方案。

**選擇**: 完全採用 App Router，與 next-intl 整合實現 `[locale]` 動態段多語言路由。

**使用的 App Router 特性**:

| 特性 | 使用證據 |
|------|---------|
| 路由組 `(auth)` / `(dashboard)` | 布局分離，各自有 layout.tsx |
| 動態段 `[locale]` | i18n 路由 |
| 嵌套路由 | 5 層深度：`[locale]/(dashboard)/admin/{module}/[id]/page.tsx` |
| Server/Client Components 混合 | 布局用 Server，交互用 Client |
| `loading.tsx` | documents/[id]/ 局部載入狀態 |
| **頁面總數** | **82 個 page.tsx** |

**路由結構**:
```
src/app/[locale]/
├── (auth)/              # 路由組 1 — 置中卡片式布局
│   └── auth/login/page.tsx
└── (dashboard)/         # 路由組 2 — Sidebar + TopBar（需認證）
    ├── admin/           # 22 個 admin 模組
    │   ├── companies/   # CRUD: page.tsx + new/ + [id]/
    │   ├── users/       # 單頁模組
    │   └── ...
    └── documents/       # 文件管理
        ├── upload/
        └── [id]/        # 含 loading.tsx
```

### 6.2 Prisma ORM 7.2（非 Drizzle/TypeORM/Knex）

**問題**: 選擇 ORM，需要管理 122 個資料庫模型。

**選擇**: Prisma 7.2 + `@prisma/adapter-pg`

**使用規模與特性**:

| 指標 | 數量 |
|------|------|
| Prisma Models | 122 個 |
| Enum 定義 | 113 個 |
| Schema 行數 | 4,200+ |
| 遷移文件 | 10 |

使用的 Prisma 特性：關聯映射、JSON 欄位、`$transaction`、Enum、關聯計數 `_count`、複雜 OR/insensitive 過濾、級聯刪除。

### 6.3 Zustand 5.x + React Query 5.x（非 Redux）

**問題**: 選擇狀態管理方案。

**選擇**: 分層管理 — Zustand 管理 UI 狀態，React Query 管理伺服器狀態。

| 工具 | 數量 | 職責 |
|------|------|------|
| Zustand Stores | 2 個 | UI 狀態（reviewStore, document-preview-test-store） |
| React Query Hooks | ~87 個 | API 數據獲取、快取、同步 |

**分工邊界**:
```
Zustand (UI 狀態)              React Query (伺服器狀態)
├─ Sidebar 展開/收合            ├─ 列表查詢結果 + 分頁
├─ 對話框開/關                  ├─ 詳情數據 + 快取
├─ 標籤頁選擇                  ├─ 創建/更新/刪除 mutations
└─ 客戶端通知                  └─ 錯誤處理 + 自動重試
```

### 6.4 next-intl 4.7（非 react-i18next）

**問題**: 選擇 i18n 方案。

**選擇**: next-intl，支援 3 語言 × 34 命名空間。

**使用的特性**: Server/Client 混合翻譯、i18n-aware 路由（`@/i18n/routing`）、格式化工具（日期/數字/貨幣）、Zod 驗證訊息翻譯（`use-localized-zod.ts`）。

**命名空間列表** (34 個):
```
common, navigation, dialogs, auth, validation, errors, dashboard, global,
escalation, review, documents, rules, companies, reports, admin, confidence,
historicalData, termAnalysis, documentPreview, fieldMappingConfig,
promptConfig, dataTemplates, formats, templateFieldMapping, templateInstance,
templateMatchingTest, standardFields, referenceNumber, exchangeRate, region,
profile, systemSettings, fieldDefinitionSet, pipelineConfig ← 後 4 個為近期新增
```

### 6.5 shadcn/ui（非 Ant Design/MUI）

**問題**: 選擇 UI 組件庫。

**選擇**: shadcn/ui（基於 Radix UI），**34 個預建組件**。

**組件列表**:
```
accordion, alert-dialog, alert, avatar, badge, button, calendar, card,
checkbox, collapsible, command, dialog, dropdown-menu, form, input, label,
month-picker, pagination, popover, progress, radio-group, resizable,
scroll-area, select, separator, skeleton, slider, switch, table, tabs,
textarea, toast, toaster, tooltip
```

**選擇理由**: 高度自訂（可修改源碼）、最小化包大小（按需使用）、Tailwind CSS 原生整合、出色的無障礙支援（Radix ARIA）。

### 技術棧總覽

| 決策 | 選擇 | 規模 |
|------|------|------|
| 路由 | App Router + i18n | 82 page.tsx |
| ORM | Prisma 7.2 | 122 models, 113 enums |
| 狀態 | Zustand + React Query | 2 stores, ~87 React Query hooks |
| i18n | next-intl 4.7 | 3 語言 × 34 命名空間 |
| UI | shadcn/ui + Radix | 34 組件 |

---

## 決策 7: Python 微服務分離

**問題**: 為什麼 OCR 提取和欄位映射用 Python FastAPI 而非 Node.js？雙語言架構增加了運維複雜度。

**選擇**: 雙語言微服務架構 — Node.js（業務邏輯、API、前端）+ Python FastAPI（OCR 提取、欄位映射、Forwarder 識別），通過 HTTP REST API 通信，Docker Compose 編排。

**替代方案**:

| 方案 | 說明 | 問題 |
|------|------|------|
| 全 Node.js | 使用 node-tesseract 或 aws-textract | Azure SDK Python 更成熟，node 版功能滯後 |
| 全 Python | FastAPI + React/Svelte | 失去 Next.js 的 SSR/SSG 優勢和 React 生態 |
| Node + 第三方 SaaS | 直接調用 Google Vision API 等 | 不支持 Azure Document Intelligence 的高級特性 |

**理由**: Python 的 Azure AI SDK 更成熟且更新更快，數據密集型處理（OCR、正則、NLP）生態更完善。

### Python 服務架構

```
python-services/
├── extraction/          # OCR 提取服務 (port 8000)
│   ├── src/main.py      # FastAPI 入口
│   ├── src/ocr/azure_di.py  # Azure Document Intelligence SDK
│   └── requirements.txt # azure-ai-documentintelligence==1.0.0
└── mapping/             # 映射服務 (port 8001)
    ├── src/main.py      # FastAPI 入口
    └── requirements.txt # psycopg2-binary (直連 PostgreSQL)
```

### 通信方式

Node.js 通過 HTTP REST API 調用 Python 服務：

```typescript
// src/services/extraction.service.ts (行 41-50)
const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || 'http://localhost:8000';

async function callOcrService(sasUrl: string, documentId: string) {
  const response = await fetch(`${OCR_SERVICE_URL}/extract/url`, {
    method: 'POST',
    body: JSON.stringify({ documentUrl: sasUrl, documentId }),
  });
}
```

```python
# python-services/extraction/src/main.py (行 168-182)
@app.post("/extract/url", response_model=ExtractResponse)
async def extract_from_url(request: ExtractUrlRequest) -> ExtractResponse:
    result = await processor.process_from_url(
        document_url=str(request.documentUrl),
        document_id=request.documentId,
    )
    return ExtractResponse(**result)
```

### Python 服務暴露的 API 端點

| 服務 | 端點 | 用途 |
|------|------|------|
| Extraction (8000) | `GET /health` | 健康檢查 |
| Extraction (8000) | `POST /extract/url` | 從 URL 提取文件 |
| Extraction (8000) | `POST /extract/file` | 從上傳文件提取 |
| Mapping (8001) | `GET /health` | 健康檢查 |
| Mapping (8001) | `GET /forwarders` | 獲取所有 Forwarder 列表 |
| Mapping (8001) | `POST /identify` | Forwarder 識別 |
| Mapping (8001) | `POST /map-fields` | 欄位映射 |

### Docker 編排

```yaml
# docker-compose.yml
ocr-extraction:
  build: ./python-services/extraction
  ports: ["8000:8000"]
  environment:
    AZURE_DI_ENDPOINT: ${AZURE_DI_ENDPOINT}
    AZURE_DI_KEY: ${AZURE_DI_KEY}

forwarder-mapping:
  ports: ["8001:8001"]
  environment:
    DATABASE_URL: postgresql://postgres:postgres@postgres:5432/...
  depends_on:
    postgres: { condition: service_healthy }
```

**取捨**:

| 好處 | 代價 |
|------|------|
| Azure AI SDK 最優支持 | 需維護兩套技術棧 |
| 數據處理性能最優（Python 生態） | 開發團隊需 Python 技能 |
| 服務可獨立部署和擴展 | 運維複雜度增加 |
| Docker 容器化確保環境一致 | HTTP 通信有延遲開銷 |

**影響範圍**: `src/services/extraction.service.ts`、`src/services/mapping.service.ts`、`docker-compose.yml`、CI/CD 需管理 Python 鏡像

---

## 決策 8: 平台定位與價值主張

**問題**: 這是什麼系統？為什麼要建？解決什麼業務痛點？

**選擇**: **AI 驅動的 Freight Invoice 智能提取與自動分類平台** — 垂直領域的內部 B2B 平台，而非通用 OCR 工具。

**替代方案**:

| 方案 | 說明 | 問題 |
|------|------|------|
| 手動 Excel/VBA | 現有流程的小幅優化 | 無法規模化，每張 5 分鐘 |
| 商用 RPA（UiPath） | 自動化工具 | 成本高、靈活性差、不理解發票語義 |
| 通用 OCR SaaS | Google Vision / AWS Textract | 只做 OCR，不含發票業務邏輯 |
| 自研全 Python 方案 | FastAPI + React | 前端交互體驗差 |

**理由**: 核心競爭力不在 OCR 本身，而在**三層映射 + 持續學習 + 信心度路由**的完整業務邏輯。

### 核心業務問題（PRD）

```
現狀痛點：
- 年處理量：450,000-500,000 張發票（APAC 地區）
- 人工時間：每張 5 分鐘 = 41,667 人時/年
- 錯誤率：~5%（手工錄入）
- 瓶頸：100+ 種格式，45+ 個 Forwarder

目標用戶：
1. Amy（數據處理專員）— 每日 150-200 張，希望減輕重複工作
2. David（SCM 經理）— 需完整費用明細做供應商分析與議價
```

### 核心價值主張

| 差異化優勢 | 具體含義 | 業務影響 |
|-----------|---------|---------|
| **智能三層映射** | 9,000 → 800 條規則 | 維護成本 ↓ 90% |
| **持續學習閉環** | 3 次確認 → 升級為正式規則 | 準確率持續提升 |
| **信心度路由** | ≥90% 自動 / 70-89% 快速 / <70% 完整 | 人工介入最小化 |
| **n8n 工作流** | 業務人員自行調整處理邏輯 | 無需開發團隊介入 |
| **多模態 AI** | GPT Vision 分析複雜版面 | 低質量掃描也可處理 |
| **Microsoft 整合** | Azure AD SSO + SharePoint + Outlook | 企業無縫集成 |

### 成功指標

```
短期目標（3 個月，香港試行）：
- 全面自動化：100% 發票進入系統
- AI 準確率：≥ 90%
- 無需人工介入：≥ 90%
- 效率提升：≥ 70% 處理時間減少

長期目標（12 個月，全球推廣）：
- 11 個城市全部上線
- 支援 45+ 個 Forwarder
- 年節省 35,000-40,000 人時
```

### 平台級設計證據

| 維度 | 實現 | 代碼證據 |
|------|------|---------|
| **多租戶** | Company model + 數據隔離 | `prisma/schema.prisma` — Company, City |
| **可配置** | SystemConfig（GLOBAL/REGION/CITY 三層級）+ PromptConfig/FieldMappingConfig（支持 COMPANY/FORMAT 層級） | `src/services/system-config.service.ts` |
| **可擴展** | 三階段管線 + 步驟工廠模式 | `extraction-v3/stages/`, `unified-processor/` |
| **國際化** | 3 語言 × 34 命名空間 | `messages/{en,zh-TW,zh-CN}/` |
| **審計合規** | AuditLog + StatisticsAuditLog + ApiAuditLog（3 種審計日誌） | `prisma/schema.prisma` — 3 個 AuditLog model |
| **監控告警** | 實時告警 + 健康檢查 + 成本統計 | `/api/admin/monitoring/`, `/api/admin/alerts/` |
| **階段推廣** | City model + `status`（CityStatus enum: ACTIVE/INACTIVE）控制 | 支援城市級灰度上線 |

### 平台成熟度指標

| 維度 | 數量 | 說明 |
|------|------|------|
| API 端點 | ~300+ | RFC 7807 標準錯誤格式 |
| 資料庫模型 | 122 | 覆蓋完整業務域 |
| 業務服務 | 124+ | 16 個子目錄，清晰分層 |
| React 組件 | 165+ | 含 34 個 shadcn/ui 基礎組件 |
| 自定義 Hooks | 104 | 完整 API 覆蓋 |
| i18n 翻譯 | 102 文件 | 3 語言 × 34 命名空間 |
| Admin 模組 | 22 | 完整的系統管理功能 |

**取捨**:

| 好處 | 代價 |
|------|------|
| 高度自動化，年省 35K-40K 人時 | 初期開發成本高 |
| 數據質量大幅提升（錯誤率 5% → <1%） | 需要詳細的規則維護 |
| 持續學習機制 | 需要初期人工標註數據 |
| 可規模化至 APAC 11 城市 | 多語言多地區管理複雜 |

**影響範圍**: 前端（165+ 組件，多角色權限）、後端（124+ 服務，三層映射 + 信心度路由）、數據（122 模型，多租戶隔離）、工作流（n8n 整合，18+ 服務文件 + 30+ API 路由）、外部系統（Azure AD, SharePoint, Outlook, Graph API）

---

## 決策 9: 企業級認證與授權架構

**問題**: 如何為一個多城市、多角色的企業內部平台實現安全的認證與細粒度授權，同時支援 Azure AD SSO 和本地帳號兩種登入方式？

**選擇**: **NextAuth v5 雙配置架構** + **RBAC 權限系統** + **城市/區域級數據隔離**，通過 Edge Runtime 兼容的分層配置和 JWT 無狀態認證實現。

**替代方案**:

| 方案 | 說明 | 問題 |
|------|------|------|
| 純 Azure AD | 僅依賴 SSO | 離線/無 Azure 環境無法使用 |
| 自建 JWT | 完全自實現認證 | 安全風險高，維護成本大 |
| NextAuth v4 | 穩定版 | 不支援 Edge Runtime，部署限制 |
| Keycloak | 獨立 IAM 服務 | 運維複雜度增加，過度設計 |

**理由**: NextAuth v5 原生支援 Edge Runtime + App Router，分層配置可兼顧中間件效能和完整功能。

### 雙配置架構

```
┌──────────────────────────────────────────────────────┐
│  auth.config.ts (292 行) — Edge Runtime 兼容         │
│  ├─ Credentials Provider（本地帳號驗證）               │
│  ├─ 帳號狀態檢查（ACTIVE/SUSPENDED/INACTIVE）         │
│  └─ 用於 middleware.ts 基本路由保護                    │
├──────────────────────────────────────────────────────┤
│  auth.ts (404 行) — 完整配置（含資料庫）               │
│  ├─ Azure AD (Microsoft Entra ID) Provider           │
│  ├─ JWT Callback: 載入角色/權限/城市存取               │
│  ├─ Session Callback: 傳遞至客戶端                    │
│  ├─ SignIn Callback: 帳號狀態驗證 + 更新登入時間       │
│  └─ Events: 首次登入自動創建用戶                      │
└──────────────────────────────────────────────────────┘
```

### RBAC 權限系統

**6 個預定義角色**:

| 角色 | 權限範圍 | 說明 |
|------|---------|------|
| Data Processor | 基礎發票操作 | 新用戶預設角色 |
| City Manager | 本城市管理 | 城市級別管理員 |
| Regional Manager | 多城市管理 | 區域級別管理員 |
| Super User | 規則 + 公司管理 | 進階用戶 |
| System Admin | 全系統存取 | 完全存取權限 |
| Auditor | 只讀報表 + 審計 | 審計專員 |

**細粒度權限常數**（`src/types/permissions.ts`）:
```
INVOICE_{VIEW,CREATE,REVIEW,APPROVE} | REPORT_{VIEW,EXPORT}
RULE_{VIEW,MANAGE,APPROVE}           | COMPANY_{VIEW,MANAGE}
USER_{VIEW,MANAGE,MANAGE_CITY,MANAGE_REGION}
SYSTEM_{CONFIG,MONITOR}              | AUDIT_{VIEW,EXPORT}
ADMIN_{VIEW,MANAGE}
```

### 多城市/區域數據隔離（Story 6.1）

```prisma
// 城市存取控制
model UserCityAccess {
  userId     String
  cityId     String
  grantedBy  String?    // 授權者追蹤
  @@unique([userId, cityId])
}

// 區域存取控制
model UserRegionAccess {
  userId     String
  regionId   String
  grantedBy  String?
  @@unique([userId, regionId])
}
```

JWT Session 擴展：
```typescript
interface Session {
  user: {
    id: string;
    status: UserStatus;           // ACTIVE | INACTIVE | SUSPENDED
    roles: SessionRole[];         // 角色 + 權限列表
    cityCodes: string[];          // 可存取的城市代碼
    primaryCityCode: string;      // 主要城市代碼
    isGlobalAdmin: boolean;       // 全域管理員
    isRegionalManager: boolean;   // 區域管理員
    regionCodes?: string[];       // 管轄區域代碼
    preferredLocale?: string;     // 語言偏好
  }
}
```

### 本地帳號認證（Story 18-2）

- **密碼策略**: bcryptjs（12 rounds）、最少 8 字元、大小寫+數字
- **自定義錯誤**: `EmailNotVerifiedError`, `AccountSuspendedError`, `AccountDisabledError`
- **完整流程**: 註冊 → 郵件驗證（24h Token）→ 登入 → 密碼重設（1h Token）
- **開發模式**: 接受任何有效 email，返回全權限模擬用戶（`dev-user-1`）

### API Key 認證（外部系統）

```typescript
// src/lib/auth/api-key.service.ts
// 用途：n8n、SharePoint、Outlook 等外部系統存取
// 格式：n8n_[64 hex chars]
// 存儲：SHA-256 雜湊（原始 Key 僅建立時返回一次）
// 權限：SHAREPOINT_SUBMIT, OUTLOOK_SUBMIT, DOCUMENT_UPLOAD, ALL(*)
```

**取捨**:

| 好處 | 代價 |
|------|------|
| Edge Runtime 兼容，部署靈活 | 雙配置維護成本 |
| JWT 無狀態認證（8h 過期） | Token 撤銷需等待過期 |
| 城市/區域級數據隔離 | 權限查詢增加資料庫負載 |
| SSO + 本地帳號雙模式 | 兩套認證流程需分別維護 |

**代碼證據**:

| 文件路徑 | 功能 |
|----------|------|
| `src/lib/auth.config.ts` (292 行) | Edge Runtime 認證配置 |
| `src/lib/auth.ts` (404 行) | 完整 NextAuth 配置 + callbacks |
| `src/lib/password.ts` (174 行) | 密碼驗證 + 加密 |
| `src/lib/auth/api-key.service.ts` (120+ 行) | API Key 驗證 |
| `src/middleware.ts` (183 行) | 路由保護中間件 |
| `src/services/role.service.ts` (250+ 行) | 角色權限管理 |
| `src/types/next-auth.d.ts` (115 行) | Session/JWT 類型擴展 |
| `src/types/permissions.ts` | 權限常數定義 |

**影響範圍**: 所有 API 路由（認證檢查）、中間件（路由保護）、Session 管理、用戶管理 UI、城市存取控制、外部系統整合

---

## 決策 10: n8n 工作流引擎整合

**問題**: 如何讓業務人員（非開發者）自行調整文件處理邏輯、觸發工作流、監控執行狀態，而無需修改代碼或部署？

**選擇**: 整合 **n8n** 作為外部工作流引擎，通過 **雙向 Webhook 通訊** + **API Key 認證** + **城市級隔離** 實現完整的工作流管理。

**替代方案**:

| 方案 | 說明 | 問題 |
|------|------|------|
| 硬編碼工作流 | 代碼中定義處理邏輯 | 每次調整需開發部署 |
| Temporal/Camunda | 企業級工作流引擎 | 部署運維複雜，學習曲線陡 |
| AWS Step Functions | 雲原生工作流 | 廠商鎖定，成本不可控 |
| 自建工作流引擎 | 完全自實現 | 開發成本巨大，功能有限 |

**理由**: n8n 提供可視化工作流設計、豐富的整合節點、自託管部署，業務人員可直接使用 UI 調整邏輯。

### 服務架構

**9 個專門服務**（`src/services/n8n/`，共 ~5,200 行）:

| 服務 | 行數 | 職責 |
|------|------|------|
| `workflow-definition.service.ts` | 441 | 工作流定義 CRUD、城市隔離、角色權限 |
| `workflow-execution.service.ts` | 535 | 執行狀態管理、統計 |
| `workflow-trigger.service.ts` | 702 | 手動觸發、參數驗證、重試 |
| `n8n-webhook.service.ts` | 463 | 事件發送、重試機制 |
| `n8n-api-key.service.ts` | 427 | API Key 管理（SHA-256） |
| `workflow-error.service.ts` | 479 | 錯誤分類、敏感資訊遮蔽 |
| `n8n-health.service.ts` | 745 | 連接監控、24h 統計、自動告警 |
| `n8n-document.service.ts` | 564 | 文件提交、狀態更新 |
| `webhook-config.service.ts` | 809 | Webhook 配置 CRUD、連接測試 |

### 雙向通訊架構

```
┌─────────────────┐    POST /api/n8n/webhook     ┌──────────┐
│   n8n 引擎       │  ──────────────────────────→  │  主系統   │
│  (工作流編排)    │  ←──────────────────────────  │ (業務邏輯) │
└─────────────────┘    sendEvent() Webhook        └──────────┘

入站: n8n → 主系統（API Key 認證）
  ├─ workflow.started    → 更新執行狀態
  ├─ workflow.completed  → 保存結果
  ├─ workflow.failed     → 記錄錯誤
  ├─ workflow.progress   → 更新進度
  └─ document.status_changed → 更新文件狀態

出站: 主系統 → n8n（Webhook 事件）
  ├─ DOCUMENT_RECEIVED     → 觸發處理工作流
  ├─ DOCUMENT_COMPLETED    → 通知處理完成
  ├─ DOCUMENT_REVIEW_NEEDED → 觸發審核工作流
  └─ WORKFLOW_FAILED       → 觸發錯誤處理
```

### Webhook 重試機制

```typescript
// 重試策略: 3 次，延遲遞增
const RETRY_DELAYS = [1000, 5000, 30000];  // 1s → 5s → 30s
const MAX_ATTEMPTS = 3;

// 應用重啟後自動恢復待重試事件
async processRetryQueue() {
  const pending = await prisma.n8nWebhookEvent.findMany({
    where: { status: 'RETRYING', nextRetryAt: { lte: now() } },
    take: 100  // 批次限制
  });
}
```

### 工作流參數動態驗證

```typescript
// WorkflowDefinition.parameters 使用 JSON Schema
// 支持：類型驗證、必填檢查、依賴條件、選項列表
{
  "parameters": [
    { "name": "mode", "type": "select", "required": true, "options": [...] },
    { "name": "threshold", "type": "number", "dependsOn": { "field": "mode", "value": "detail" } }
  ],
  "documentSelection": { "required": true, "maxCount": 10 }
}
```

### 數據模型（6 個核心模型）

| 模型 | 用途 |
|------|------|
| `WorkflowDefinition` | 工作流定義（含 triggerUrl、cityCode、allowedRoles） |
| `WorkflowExecution` | 執行記錄（含 status、progress、triggerData） |
| `WorkflowExecutionStep` | 執行步驟追蹤 |
| `N8nApiKey` | API Key 管理（SHA-256 雜湊、權限、速率限制） |
| `N8nWebhookEvent` | Webhook 事件日誌（含重試狀態） |
| `N8nIncomingWebhook` | 入站 Webhook 日誌 |

### 健康監控

```
N8nHealthService.scheduledHealthCheck()（每 5 分鐘）
├─ 遍歷所有活躍 WebhookConfig
├─ 發送 GET 請求測試連接
├─ 判斷狀態:
│  ├─ HEALTHY: 成功率 ≥ 90%
│  ├─ DEGRADED: 成功率 70-90%
│  └─ UNHEALTHY: 成功率 < 70% 或連續失敗 ≥ 3 次
└─ 狀態變化自動觸發告警
```

**取捨**:

| 好處 | 代價 |
|------|------|
| 業務人員可自行調整工作流 | 需要部署和維護 n8n 實例 |
| 可視化設計，降低技術門檻 | 雙系統間通訊增加延遲 |
| 豐富的整合節點（400+） | API Key 管理增加安全面向 |
| 完整的執行追蹤和重試機制 | ~5,200 行整合代碼需維護 |

**代碼證據**:

| 文件路徑 | 功能 |
|----------|------|
| `src/services/n8n/` (9 個文件，~5,200 行) | 完整 n8n 整合服務層 |
| `src/app/api/n8n/webhook/route.ts` (317 行) | Webhook 接收端點 |
| `src/app/api/n8n/documents/route.ts` (146 行) | 文件提交端點 |
| `src/app/api/workflows/` | 工作流管理 API |
| `src/lib/middleware/n8n-api.middleware.ts` | API Key 認證中間件 |
| `prisma/schema.prisma` (6 個 n8n 相關模型) | 數據模型定義 |

**影響範圍**: 文件處理流程（觸發/狀態更新）、外部系統整合（SharePoint/Outlook 通過 n8n 接入）、管理後台（Webhook 配置、API Key 管理、健康監控）、告警系統

---

## 決策 11: 多維度審計日誌系統

**問題**: 如何為一個處理敏感財務數據（45 萬張發票/年）的系統提供完整的操作追蹤、合規審計和安全監控，同時不影響系統效能？

**選擇**: **四層審計架構** — AuditLog（操作審計）+ SecurityLog（安全事件）+ StatisticsAuditLog（統計審計）+ ApiAuditLog（API 審計），通過**批次寫入 + 同步寫入雙模式**平衡效能與實時性。

**替代方案**:

| 方案 | 說明 | 問題 |
|------|------|------|
| 單一日誌表 | 所有事件記錄在一張表 | 查詢效能差，無法區分安全級別 |
| 純外部服務 | ELK/Splunk 集中日誌 | 成本高，合規數據需本地存儲 |
| 僅 console.log | 最簡單方案 | 不可查詢、不可審計、不合規 |
| 資料庫觸發器 | PostgreSQL 層面攔截 | 缺少業務上下文（誰？從哪裡？） |

**理由**: 財務數據合規要求完整的操作追蹤鏈，四層分離讓查詢效能和安全分級兼顧。

### 四層審計架構

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: AuditLog（操作審計，核心層）                         │
│ • 14 種操作類型（CRUD + LOGIN/LOGOUT + APPROVE/REJECT 等）   │
│ • 城市隔離（cityCode）                                       │
│ • 變更前後值追蹤（changes JSON）                             │
│ • 6 個索引優化查詢效能                                       │
├─────────────────────────────────────────────────────────────┤
│ Layer 2: SecurityLog（安全事件）                              │
│ • 7 種安全事件（未授權訪問、跨城市違規、權限提升嘗試等）      │
│ • 4 級嚴重度（LOW/MEDIUM/HIGH/CRITICAL）                    │
│ • 可標記已解決（resolved + resolvedBy）                      │
│ • AuditLog 寫入失敗時的降級目標                              │
├─────────────────────────────────────────────────────────────┤
│ Layer 3: StatisticsAuditLog（統計審計）                       │
│ • 每日統計層面的數據完整性檢查                                │
│ • 差異記錄和修正追蹤                                         │
├─────────────────────────────────────────────────────────────┤
│ Layer 4: ApiAuditLog（API 審計）                             │
│ • 外部 API 請求/響應記錄                                     │
│ • 敏感欄位自動遮蔽（password, token, apiKey 等）             │
│ • 速率限制統計                                               │
└─────────────────────────────────────────────────────────────┘
```

### 雙模式寫入策略

```typescript
// src/services/audit-log.service.ts (Singleton 模式)

// 模式 1: 同步寫入 — 敏感操作立即記錄
const SENSITIVE_OPERATIONS = {
  user: ['CREATE', 'UPDATE', 'DELETE'],
  role: ['CREATE', 'UPDATE', 'DELETE'],
  mappingRule: ['CREATE', 'UPDATE', 'DELETE', 'APPROVE'],
  systemConfig: ['UPDATE', 'CONFIGURE'],
  userCityAccess: ['GRANT', 'REVOKE'],
  globalAdmin: ['GRANT', 'REVOKE'],
};

// 模式 2: 批次寫入 — 非敏感操作性能優化
const BATCH_SIZE = 100;
const FLUSH_INTERVAL = 1000;  // 1 秒刷新
```

### 寫入失敗安全機制

```
AuditLog 批次寫入
  ↓ 失敗
嘗試逐條寫入
  ↓ 仍失敗
降級至 SecurityLog（絕不丟失審計信息）
  → eventType: 'SUSPICIOUS_ACTIVITY'
  → severity: 'HIGH'
```

### 審計報告系統

```
AuditReportService
├─ 4 種報告格式: Excel / PDF / CSV / JSON
├─ 4 種報告類型: PROCESSING_RECORDS / CHANGE_HISTORY / FULL_AUDIT / COMPLIANCE_SUMMARY
├─ 大型報告閾值: > 5,000 筆 → 背景異步生成
├─ SHA-256 checksum + 數位簽章
├─ 7 天過期時間
└─ 下載追蹤（AuditReportDownload 模型）
```

### 關鍵 Enum 定義

```prisma
enum AuditAction {
  CREATE | READ | UPDATE | DELETE | LOGIN | LOGOUT
  EXPORT | IMPORT | APPROVE | REJECT | ESCALATE
  CONFIGURE | GRANT | REVOKE                        // 14 種
}

enum SecurityEventType {
  UNAUTHORIZED_ACCESS_ATTEMPT | CROSS_CITY_ACCESS_VIOLATION
  INVALID_CITY_REQUEST | RESOURCE_ACCESS_DENIED
  SUSPICIOUS_ACTIVITY | PERMISSION_ELEVATION_ATTEMPT
  TAMPERING_ATTEMPT                                  // 7 種
}

enum SecuritySeverity { LOW | MEDIUM | HIGH | CRITICAL }
```

### 合規要求實現

| 要求 | 實現方式 |
|------|---------|
| 7 年數據保留 | DataRetentionPolicy + 歸檔機制（isArchived） |
| 日誌不可篡改 | PostgreSQL 觸發器（BEFORE UPDATE/DELETE → RAISE EXCEPTION） |
| 完整變更鏈 | changes JSON 記錄變更前後值 |
| 報告完整性 | SHA-256 checksum + 數位簽章 |
| 下載追蹤 | AuditReportDownload 模型記錄每次下載 |

**取捨**:

| 好處 | 代價 |
|------|------|
| 四層分離，查詢效能和安全分級兼顧 | 維護 4 個日誌表 + 5 個服務 |
| 批次寫入降低效能影響 | 非敏感操作有最多 1 秒延遲 |
| 寫入失敗降級確保不丟失 | SecurityLog 需額外監控 |
| 完整合規（7 年保留 + 不可篡改） | 存儲成本隨時間增長 |

**代碼證據**:

| 文件路徑 | 功能 |
|----------|------|
| `src/services/audit-log.service.ts` (349 行) | 審計日誌寫入（批次+同步） |
| `src/services/audit-query.service.ts` (250+ 行) | 多條件審計查詢 |
| `src/services/audit-report.service.ts` (400+ 行) | 報告生成（4 種格式） |
| `src/services/api-audit-log.service.ts` (583 行) | API 審計日誌 |
| `src/middlewares/audit-log.middleware.ts` (200+ 行) | withAuditLog 高階函數 |
| `src/app/api/audit/` (7 個端點) | 審計查詢和報告 API |
| `prisma/schema.prisma` | AuditLog, SecurityLog, StatisticsAuditLog, AuditReportJob |
| `src/types/audit.ts` + `audit-report.ts` | 共 41 個導出（type/interface/const/function） |

**影響範圍**: 所有寫入操作（透過 withAuditLog 中間件或直接調用）、安全監控（SecurityLog）、管理後台（審計查詢 + 報告生成）、合規審計（7 年保留 + 不可篡改）

---

## 總結: 決策全景矩陣

### 決策分類

```
核心架構決策（系統如何處理數據）
├── 決策 1: 三層映射系統        — 術語如何映射
├── 決策 2: V3.1 三階段管線     — 數據如何提取
├── 決策 3: 信心度路由          — 結果如何路由
└── 決策 4: 統一處理器          — 版本如何過渡

基礎設施決策（系統如何構建）
├── 決策 5: Company 重構        — 模型如何演進
├── 決策 6: 技術棧選擇          — 工具如何選型
└── 決策 7: Python 微服務       — 服務如何分離

企業級能力決策（系統如何安全運行）
├── 決策 9: 認證與授權          — 存取如何控制
├── 決策 10: n8n 工作流         — 流程如何編排
└── 決策 11: 審計日誌           — 操作如何追蹤

戰略決策（系統為何存在）
└── 決策 8: 平台定位            — 價值如何定義
```

### 全景對照表

| # | 決策 | 核心選擇 | 主要理由 | 影響文件數 |
|---|------|---------|---------|-----------|
| 1 | 三層映射 | Universal → Company → LLM | 規則 9K→800（↓90%） | mapping/ 7 文件 |
| 2 | V3.1 管線 | 三階段 + 模型分級 | 成本 ↓86%（$0.01→$0.0036） | stages/ 7 服務 |
| 3 | 信心度路由 | 5 維度 + 智能降級 | 精準路由 + 新場景防護 | confidence-v3-1 核心 |
| 4 | 統一處理器 | Feature Flag 灰度 + V3→V2 回退 | 零停機過渡 + 高可用 | unified-processor/ 全目錄 |
| 5 | Company 重構 | Forwarder → Company | 多公司類型支援 | 全系統（~800+ 遺留待清理） |
| 6 | 技術棧 | Next.js 15 + Prisma + Zustand + shadcn | 生態最優 + 開發效率 | 全系統基礎 |
| 7 | Python 微服務 | Node.js + Python FastAPI | Azure SDK 最優支持 | extraction + mapping |
| 8 | 平台定位 | 垂直 Freight Invoice 平台 | 年省 35K-40K 人時 | 業務方向定義 |
| 9 | 認證授權 | NextAuth v5 + RBAC + 城市隔離 | 企業級安全 + 多租戶 | auth 15+ 文件 |
| 10 | n8n 工作流 | 雙向 Webhook + API Key 認證 | 業務人員自助 + 可視化 | n8n/ 9 服務 (~5.2K 行) |
| 11 | 審計日誌 | 四層審計 + 批次/同步雙模式 | 合規審計 + 效能平衡 | audit 5 服務 + 7 API |

### 決策間的相互關係

```
決策 8（平台定位）
  ├─→ 決策 1（三層映射）← 核心業務邏輯
  ├─→ 決策 2（V3.1 管線）← 核心處理管線
  │     └─→ 決策 3（信心度路由）← 依賴三階段結果
  │     └─→ 決策 4（統一處理器）← 管線版本管理
  ├─→ 決策 7（Python 微服務）← OCR/Mapping 技術選型
  ├─→ 決策 5（Company 重構）← 業務模型演進
  ├─→ 決策 6（技術棧）← 基礎設施選型
  ├─→ 決策 9（認證授權）← 企業級安全基礎
  │     └─→ 決策 10（n8n 工作流）← 外部系統需 API Key 認證
  └─→ 決策 11（審計日誌）← 合規要求，依賴決策 9 的用戶身份
```

### 設計哲學總結

本項目的 11 個關鍵設計決策體現了一致的設計哲學：

1. **分層漸進**: 三層映射（通用→特定→AI）、三階段提取（識別→格式→提取）、四層審計（操作→安全→統計→API）、版本回退（V3→V2，V3.1→V3）
2. **成本敏感**: 模型分級（nano vs 5.2）、規則精簡（9K→800）、灰度發佈（避免全量風險）、批次寫入審計（降低效能影響）
3. **業務驅動**: 所有技術決策服務於「年省 35K-40K 人時」的業務目標，n8n 工作流讓業務人員自助調整
4. **持續演進**: Feature Flag 支持版本過渡、Forwarder→Company 漸進重構、持續學習閉環
5. **企業級安全**: RBAC 細粒度權限 + 城市/區域數據隔離 + 不可篡改審計日誌 + API Key 外部認證

---

*分析完成日期: 2026-02-27*
*分析方法: 4 個並行 Explore Agent 深度代碼追蹤*
*交叉驗證: 4+4 個並行 Explore Agent 逐項核實（共 70+ 項聲明驗證，8 處修正 + 3 個決策新增）*
*第二輪驗證: 4 個並行 Explore Agent 重新檢查（修正 8 處事實性錯誤，新增 3 個高重要性設計決策）*
*第三輪驗證: 4 個並行 Explore Agent 逐項代碼比對（修正 20 處：9 項顯著錯誤 + 11 項 ±1 行數偏差）*
*涵蓋範圍: 11 個關鍵設計決策，覆蓋核心架構、基礎設施、企業級能力和戰略定位*
