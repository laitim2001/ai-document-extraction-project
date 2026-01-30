# 統一文件處理流程重構分析：從 Azure DI + GPT 到純 GPT-5.2 Vision

> **分析日期**: 2026-01-30
> **分析類型**: 架構重構分析
> **相關變更**: CHANGE-020, Extraction V3
> **狀態**: 分析完成，待實施
> **前置文檔**: `2026-01-30-ARCH-extraction-architecture-comparison.md`

---

## 1. 背景

### 1.1 決策依據

基於 `2026-01-30-ARCH-extraction-architecture-comparison.md` 的測試結果：

| 指標 | 方案 A (Azure DI + GPT-mini) | 方案 B (純 GPT-5.2 Vision) | 差異 |
|------|------------------------------|---------------------------|------|
| **欄位提取** | 8/8 (100%) | 8/8 (100%) | 相同 |
| **處理時間** | 21.8 秒 | **9.4 秒** | B 快 **57%** |
| **Token 消耗** | 2,908 | **1,528** | B 省 **47%** |
| **平均信心度** | ~86% | **~96%** | B 高 **10%** |
| **語義理解** | 一般 | **更準確** | B 優 |

**結論**：採用方案 B（純 GPT-5.2 Vision）作為新的提取架構。

### 1.2 重構目標

1. **簡化架構**：從 11 步減少到 7 步
2. **減少依賴**：移除 Azure DI 依賴，降低故障點
3. **提升效能**：處理時間降低 50%+
4. **降低成本**：Token 消耗降低 47%
5. **保持兼容**：保留現有配置系統和資料模型

---

## 2. 當前架構分析

### 2.1 現有 11 步流程

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 當前統一文件處理流程（11 步）                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│ Step 1:  FILE_TYPE_DETECTION      ⚠️ REQUIRED  → 檢測 PDF 類型              │
│ Step 2:  SMART_ROUTING            ⚠️ REQUIRED  → 決定處理方法               │
│ Step 3:  ISSUER_IDENTIFICATION    ❌ OPTIONAL  → GPT Vision 識別發行方      │
│ Step 4:  FORMAT_MATCHING          ❌ OPTIONAL  → 匹配文件格式               │
│ Step 5:  CONFIG_FETCHING          ❌ OPTIONAL  → 獲取 Prompt + 映射配置     │
│ Step 6:  AZURE_DI_EXTRACTION      ⚠️ REQUIRED  → Azure DI 提取              │
│ Step 7:  GPT_ENHANCED_EXTRACTION  ❌ OPTIONAL  → GPT 強化提取               │
│ Step 8:  FIELD_MAPPING            ❌ OPTIONAL  → 三層欄位映射               │
│ Step 9:  TERM_RECORDING           ❌ OPTIONAL  → 術語學習記錄               │
│ Step 10: CONFIDENCE_CALCULATION   ⚠️ REQUIRED  → 7 維度信心度               │
│ Step 11: ROUTING_DECISION         ⚠️ REQUIRED  → 路由決策                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 當前流程的問題

| 問題 | 說明 | 影響 |
|------|------|------|
| **多次 LLM 調用** | Step 3 + Step 7 各調用一次 GPT | 增加延遲和成本 |
| **Azure DI 瓶頸** | Step 6 佔總時間 45% | 處理速度受限 |
| **重複工作** | 發行方識別、格式匹配、欄位映射分散在多步 | 效率低下 |
| **配置分散** | 配置獲取與使用分離 | 維護複雜 |
| **雙源依賴** | 同時依賴 Azure DI 和 GPT | 故障點多 |

### 2.3 各步驟重構分析

#### Step 3: ISSUER_IDENTIFICATION → 合併到主調用

| 項目 | 當前方式 | 新方式 |
|------|---------|--------|
| **方法** | 獨立 GPT Vision 調用 `classifyDocument()` | 合併到主要 Prompt |
| **調用次數** | 1 次獨立調用 | 0 次（包含在主調用中） |
| **Token 消耗** | ~300-500 tokens | 節省 |

#### Step 4: FORMAT_MATCHING → 合併到 Prompt

| 項目 | 當前方式 | 新方式 |
|------|---------|--------|
| **方法** | 提取後匹配 | 識別規則寫入 Prompt |
| **時機** | 提取完成後 | LLM 調用時同步識別 |

#### Step 5: CONFIG_FETCHING → 重構為 DYNAMIC_PROMPT_ASSEMBLY

將配置獲取重構為 Prompt 組裝：
- 公司識別規則 → Prompt Section 1
- 格式識別規則 → Prompt Section 2
- 欄位提取規則 → Prompt Section 3
- 術語分類規則 → Prompt Section 4
- 輸出格式規範 → JSON Schema

#### Step 6: AZURE_DI_EXTRACTION → ❌ 移除

完全由 GPT-5.2 Vision 取代。

#### Step 7: GPT_ENHANCED_EXTRACTION → 升級為 UNIFIED_GPT_EXTRACTION

成為新架構的核心步驟，單次調用完成所有提取任務。

#### Step 8: FIELD_MAPPING → 大幅簡化

| 項目 | 當前方式 | 新方式 |
|------|---------|--------|
| **Tier 1 通用映射** | 運行時查詢 + 映射 | 寫入 Prompt |
| **Tier 2 公司映射** | 運行時查詢 + 映射 | 寫入 Prompt |
| **Tier 3 LLM 分類** | 獨立 LLM 調用 | 合併到主調用 |
| **後處理** | 無 | 輕量級驗證 |

#### Step 9: TERM_CLASSIFICATION → 合併到 Prompt

術語分類規則直接寫入 Prompt，LLM 在提取時同步分類。

---

## 3. 新架構設計

### 3.1 新流程概覽（7 步）

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    方案 B：純 GPT-5.2 Vision 新架構 (7 步)                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 階段 1：準備階段 (Pre-processing)                                    │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │                                                                     │   │
│  │  Step 1: FILE_PREPARATION                                           │   │
│  │  ┌──────────────────────────────────────────────────────────────┐   │   │
│  │  │ • 檔案類型檢測 (Native PDF / Scanned PDF / Image)             │   │   │
│  │  │ • PDF → Image 轉換 (如需要)                                   │   │   │
│  │  │ • 多頁處理策略決定                                            │   │   │
│  │  └──────────────────────────────────────────────────────────────┘   │   │
│  │                           ↓                                         │   │
│  │  Step 2: DYNAMIC_PROMPT_ASSEMBLY                                    │   │
│  │  ┌──────────────────────────────────────────────────────────────┐   │   │
│  │  │ 從資料庫/配置獲取並組裝：                                     │   │   │
│  │  │ • 公司識別規則 (已知公司列表 + 識別方法)                      │   │   │
│  │  │ • 格式識別規則 (格式模式 + 關鍵字)                           │   │   │
│  │  │ • 欄位定義 (標準 8 欄位 + 自定義欄位)                        │   │   │
│  │  │ • 術語映射規則 (Universal + Company-specific)                 │   │   │
│  │  │ • 輸出 JSON Schema                                           │   │   │
│  │  │                                                              │   │   │
│  │  │ 輸出: 完整的 System Prompt + User Prompt                     │   │   │
│  │  └──────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ↓                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 階段 2：核心提取 (Single LLM Call) ⭐ 核心                          │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │                                                                     │   │
│  │  Step 3: UNIFIED_GPT_EXTRACTION                                     │   │
│  │  ┌──────────────────────────────────────────────────────────────┐   │   │
│  │  │ 單次 GPT-5.2 Vision 調用，一次完成：                          │   │   │
│  │  │                                                              │   │   │
│  │  │ 📋 輸入:                                                     │   │   │
│  │  │   • 文件圖片 (base64)                                        │   │   │
│  │  │   • 組裝好的 Prompt                                          │   │   │
│  │  │                                                              │   │   │
│  │  │ 🎯 處理:                                                     │   │   │
│  │  │   1. 發行方識別 (companyName, confidence)                    │   │   │
│  │  │   2. 格式識別 (formatType, confidence)                       │   │   │
│  │  │   3. 標準欄位提取 (8 個核心欄位)                             │   │   │
│  │  │   4. 自定義欄位提取 (如有配置)                               │   │   │
│  │  │   5. 行項目提取 (lineItems[])                                │   │   │
│  │  │   6. 額外費用提取 (extraCharges[])                           │   │   │
│  │  │   7. 術語分類 (按規則映射到標準分類)                         │   │   │
│  │  │                                                              │   │   │
│  │  │ 📤 輸出: 標準化 JSON (符合 output schema)                    │   │   │
│  │  └──────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ↓                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 階段 3：後處理階段 (Post-processing)                                │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │                                                                     │   │
│  │  Step 4: RESULT_VALIDATION                                          │   │
│  │  ┌──────────────────────────────────────────────────────────────┐   │   │
│  │  │ • JSON Schema 驗證                                           │   │   │
│  │  │ • 必填欄位檢查                                               │   │   │
│  │  │ • 數值格式驗證 (金額、日期)                                  │   │   │
│  │  │ • 公司/格式 ID 解析 (名稱 → 資料庫 ID)                       │   │   │
│  │  │ • 未匹配術語標記                                             │   │   │
│  │  └──────────────────────────────────────────────────────────────┘   │   │
│  │                           ↓                                         │   │
│  │  Step 5: TERM_RECORDING (可選)                                      │   │
│  │  ┌──────────────────────────────────────────────────────────────┐   │   │
│  │  │ • 記錄新術語 (needsClassification: true 的項目)               │   │   │
│  │  │ • 更新術語頻率                                               │   │   │
│  │  │ • 識別同義詞候選                                             │   │   │
│  │  └──────────────────────────────────────────────────────────────┘   │   │
│  │                           ↓                                         │   │
│  │  Step 6: CONFIDENCE_CALCULATION                                     │   │
│  │  ┌──────────────────────────────────────────────────────────────┐   │   │
│  │  │ 簡化為 5 維度：                                              │   │   │
│  │  │ • EXTRACTION (30%): GPT 回報的整體信心度                     │   │   │
│  │  │ • ISSUER_IDENTIFICATION (20%): 公司識別信心度                │   │   │
│  │  │ • FORMAT_MATCHING (15%): 格式識別信心度                      │   │   │
│  │  │ • FIELD_COMPLETENESS (20%): 必填欄位完整性                   │   │   │
│  │  │ • HISTORICAL_ACCURACY (15%): 歷史準確率                      │   │   │
│  │  └──────────────────────────────────────────────────────────────┘   │   │
│  │                           ↓                                         │   │
│  │  Step 7: ROUTING_DECISION                                           │   │
│  │  ┌──────────────────────────────────────────────────────────────┐   │   │
│  │  │ • ≥ 90%: AUTO_APPROVE                                        │   │   │
│  │  │ • 70-89%: QUICK_REVIEW                                       │   │   │
│  │  │ • < 70%: FULL_REVIEW                                         │   │   │
│  │  └──────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 新舊步驟映射

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                        當前流程 vs 新流程映射                                   │
├──────────────────────────────────┬─────────────────────────────────────────────┤
│        當前 11 步流程             │           新流程 (7 步)                     │
├──────────────────────────────────┼─────────────────────────────────────────────┤
│ 1. FILE_TYPE_DETECTION           │ 1. FILE_PREPARATION ✅                      │
│ 2. SMART_ROUTING                 │    (合併檔案類型檢測 + PDF 轉換)            │
├──────────────────────────────────┼─────────────────────────────────────────────┤
│ 3. ISSUER_IDENTIFICATION         │ 2. DYNAMIC_PROMPT_ASSEMBLY 🆕               │
│ 4. FORMAT_MATCHING               │    ┌─ 公司識別規則                          │
│ 5. CONFIG_FETCHING               │    ├─ 格式識別規則                          │
│                                  │    ├─ 欄位提取規則                          │
│                                  │    ├─ 術語分類規則                          │
│                                  │    └─ 輸出格式規範                          │
├──────────────────────────────────┼─────────────────────────────────────────────┤
│ 6. AZURE_DI_EXTRACTION ❌        │ 3. UNIFIED_GPT_EXTRACTION 🆕               │
│ 7. GPT_ENHANCED_EXTRACTION       │    (單次調用完成所有提取任務)               │
│ 8. FIELD_MAPPING                 │                                             │
│ 9. TERM_CLASSIFICATION           │                                             │
├──────────────────────────────────┼─────────────────────────────────────────────┤
│                                  │ 4. RESULT_VALIDATION 🆕                    │
├──────────────────────────────────┼─────────────────────────────────────────────┤
│ 9. TERM_RECORDING                │ 5. TERM_RECORDING ✅                        │
├──────────────────────────────────┼─────────────────────────────────────────────┤
│ 10. CONFIDENCE_CALCULATION       │ 6. CONFIDENCE_CALCULATION ✅ (簡化)         │
├──────────────────────────────────┼─────────────────────────────────────────────┤
│ 11. ROUTING_DECISION             │ 7. ROUTING_DECISION ✅                      │
└──────────────────────────────────┴─────────────────────────────────────────────┘
```

---

## 4. 核心組件設計

### 4.1 Dynamic Prompt Assembly

#### 配置結構

```typescript
interface DynamicPromptConfig {
  // 1. 公司識別規則
  issuerIdentificationRules: {
    knownCompanies: Array<{
      id: string;
      name: string;
      aliases: string[];
      identifiers: string[];  // Logo 特徵、信頭關鍵字等
    }>;
    identificationMethods: ('LOGO' | 'HEADER' | 'ADDRESS' | 'TAX_ID')[];
  };

  // 2. 格式識別規則
  formatIdentificationRules: {
    formatPatterns: Array<{
      formatId: string;
      formatName: string;
      patterns: string[];
      keywords: string[];
    }>;
  };

  // 3. 欄位提取規則
  fieldExtractionRules: {
    standardFields: FieldDefinition[];      // 8 個標準欄位
    customFields: FieldDefinition[];        // 公司/格式特定欄位
    extraChargesConfig: {
      enabled: boolean;
      categories: string[];
    };
  };

  // 4. 術語分類規則
  termClassificationRules: {
    universalMappings: Record<string, string>;  // Tier 1: 通用映射
    companyMappings: Record<string, string>;    // Tier 2: 公司特定
    fallbackBehavior: 'MARK_UNCLASSIFIED' | 'USE_ORIGINAL';
  };

  // 5. 輸出格式規範
  outputSchema: JSONSchema7;
}

interface FieldDefinition {
  key: string;
  displayName: string;
  type: 'string' | 'number' | 'date' | 'currency';
  required: boolean;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
  };
}
```

#### Prompt 組裝範例

```typescript
function assemblePrompt(config: DynamicPromptConfig): { system: string; user: string } {
  const systemPrompt = `
你是專業的文件資料提取助手。請分析發票圖片，一次性完成以下所有任務。

## 任務 1: 發行方識別
從文件中識別發行方公司：
- 優先檢查：Logo、信頭、公司印章
- 已知公司列表：
${config.issuerIdentificationRules.knownCompanies.map(c =>
  `  - ${c.name} (別名: ${c.aliases.join(', ')})`
).join('\n')}

## 任務 2: 文件格式識別
識別文件格式類型：
${config.formatIdentificationRules.formatPatterns.map(f =>
  `  - ${f.formatName}: 關鍵字 [${f.keywords.join(', ')}]`
).join('\n')}

## 任務 3: 欄位提取
### 標準欄位 (必填)
${config.fieldExtractionRules.standardFields.filter(f => f.required).map(f =>
  `- ${f.key}: ${f.displayName} (${f.type})`
).join('\n')}

### 標準欄位 (選填)
${config.fieldExtractionRules.standardFields.filter(f => !f.required).map(f =>
  `- ${f.key}: ${f.displayName} (${f.type})`
).join('\n')}

${config.fieldExtractionRules.customFields.length > 0 ? `
### 自定義欄位
${config.fieldExtractionRules.customFields.map(f =>
  `- ${f.key}: ${f.displayName} (${f.type})`
).join('\n')}
` : ''}

## 任務 4: 術語分類
對於 lineItems 和 extraCharges 中的描述，按以下規則分類：

### 通用映射
${Object.entries(config.termClassificationRules.universalMappings).map(([k, v]) =>
  `- "${k}" → ${v}`
).join('\n')}

${Object.keys(config.termClassificationRules.companyMappings).length > 0 ? `
### 公司特定映射
${Object.entries(config.termClassificationRules.companyMappings).map(([k, v]) =>
  `- "${k}" → ${v}`
).join('\n')}
` : ''}

無法匹配的術語請標記 "needsClassification": true

## 輸出格式
請嚴格按照以下 JSON Schema 輸出：
\`\`\`json
${JSON.stringify(config.outputSchema, null, 2)}
\`\`\`
`;

  const userPrompt = `請分析附件中的發票圖片，按照上述要求提取所有信息。`;

  return { system: systemPrompt, user: userPrompt };
}
```

### 4.2 Unified GPT Extraction

#### Output Schema

```typescript
interface UnifiedExtractionOutput {
  // 發行方識別結果
  issuerIdentification: {
    companyName: string;
    companyId?: string;  // 如果匹配到已知公司
    identificationMethod: 'LOGO' | 'HEADER' | 'ADDRESS' | 'TAX_ID' | 'UNKNOWN';
    confidence: number;  // 0-100
    isNewCompany: boolean;
  };

  // 格式識別結果
  formatIdentification: {
    formatName: string;
    formatId?: string;  // 如果匹配到已知格式
    confidence: number;
    isNewFormat: boolean;
  };

  // 標準欄位
  standardFields: {
    invoiceNumber: FieldValue;
    invoiceDate: FieldValue;
    dueDate?: FieldValue;
    vendorName: FieldValue;
    customerName?: FieldValue;
    totalAmount: FieldValue;
    subtotal?: FieldValue;
    currency: FieldValue;
  };

  // 自定義欄位
  customFields?: Record<string, FieldValue>;

  // 行項目
  lineItems: Array<{
    description: string;
    classifiedAs?: string;  // 術語分類結果
    quantity?: number;
    unitPrice?: number;
    amount: number;
    confidence: number;
    needsClassification?: boolean;
  }>;

  // 額外費用
  extraCharges?: Array<{
    description: string;
    classifiedAs?: string;
    amount: number;
    currency?: string;
    confidence: number;
    needsClassification?: boolean;
  }>;

  // 整體信心度
  overallConfidence: number;

  // 處理元數據
  metadata: {
    modelUsed: string;
    processingTimeMs: number;
    tokensUsed: number;
    warnings?: string[];
  };
}

interface FieldValue {
  value: string | number | null;
  confidence: number;
  source?: string;  // 在文件中的位置描述
}
```

### 4.3 信心度計算（簡化版）

```typescript
interface SimplifiedConfidenceInput {
  // 從 GPT 輸出獲取
  extractionConfidence: number;           // GPT 回報的整體信心度
  issuerConfidence: number;               // 發行方識別信心度
  formatConfidence: number;               // 格式識別信心度

  // 從驗證步驟計算
  fieldCompleteness: {
    requiredFieldsCount: number;
    filledRequiredFieldsCount: number;
  };

  // 從歷史數據獲取
  historicalAccuracy?: number;            // 該公司/格式的歷史準確率
}

const SIMPLIFIED_WEIGHTS = {
  EXTRACTION: 0.30,
  ISSUER_IDENTIFICATION: 0.20,
  FORMAT_MATCHING: 0.15,
  FIELD_COMPLETENESS: 0.20,
  HISTORICAL_ACCURACY: 0.15,
};

function calculateSimplifiedConfidence(input: SimplifiedConfidenceInput): number {
  const fieldCompletenessScore =
    (input.fieldCompleteness.filledRequiredFieldsCount /
     input.fieldCompleteness.requiredFieldsCount) * 100;

  const historicalScore = input.historicalAccuracy ?? 80;  // 默認 80%

  return (
    input.extractionConfidence * SIMPLIFIED_WEIGHTS.EXTRACTION +
    input.issuerConfidence * SIMPLIFIED_WEIGHTS.ISSUER_IDENTIFICATION +
    input.formatConfidence * SIMPLIFIED_WEIGHTS.FORMAT_MATCHING +
    fieldCompletenessScore * SIMPLIFIED_WEIGHTS.FIELD_COMPLETENESS +
    historicalScore * SIMPLIFIED_WEIGHTS.HISTORICAL_ACCURACY
  );
}
```

---

## 5. 影響評估

### 5.1 對現有系統的影響

| 組件 | 影響程度 | 說明 | 行動 |
|------|---------|------|------|
| **UnifiedProcessor** | 🔴 高 | 核心流程重構 | 新增 V3 版本 |
| **Step 實現** | 🔴 高 | 多個步驟合併/移除 | 新增/移除步驟 |
| **適配器** | 🟡 中 | 部分適配器不再需要 | 保留但標記廢棄 |
| **配置服務** | 🟡 中 | 輸出格式變更 | 新增 Prompt 組裝 |
| **信心度計算** | 🟡 中 | 維度從 7 → 5 | 簡化計算邏輯 |
| **資料庫模型** | 🟢 低 | 結構不變 | 僅更新 extractionMethod |
| **API 層** | 🟢 低 | 輸入輸出基本不變 | 新增 Feature Flag |
| **前端 UI** | 🟢 低 | 不受影響 | 無需改動 |

### 5.2 風險評估

| 風險 | 可能性 | 影響 | 緩解措施 |
|------|--------|------|---------|
| GPT-5.2 服務不穩定 | 低 | 高 | 保留舊流程作為 fallback |
| 特殊文件類型處理不佳 | 中 | 中 | 保留 Azure DI 作為備選 |
| Prompt 過長影響性能 | 低 | 低 | 動態裁剪不必要的規則 |
| 輸出格式不穩定 | 中 | 中 | 嚴格的 Schema 驗證 |

---

## 6. 實施計劃

### 6.1 階段劃分

#### 第一階段：建立新核心服務 (1-2 週)

```
新增文件:
├── src/services/extraction-v3/
│   ├── index.ts
│   ├── extraction-v3.service.ts           # 主服務
│   ├── prompt-assembler.service.ts        # Prompt 組裝
│   ├── unified-gpt-extractor.service.ts   # GPT 調用
│   ├── extraction-validator.service.ts    # 結果驗證
│   └── types.ts                           # 類型定義
```

#### 第二階段：整合到 UnifiedProcessor (1 週)

```
修改文件:
├── src/services/unified-processor/
│   ├── unified-processor.service.ts       # 新增 V3 路徑
│   ├── steps/
│   │   ├── file-preparation.step.ts       # 合併 Step 1+2
│   │   ├── dynamic-prompt-assembly.step.ts # 新步驟
│   │   ├── unified-gpt-extraction.step.ts # 新核心步驟
│   │   └── result-validation.step.ts      # 新步驟
│   └── types/processing-context.ts        # 更新類型
```

#### 第三階段：測試與驗證 (1 週)

```
測試範圍:
├── 單元測試: Prompt 組裝、結果驗證
├── 整合測試: 完整流程測試
├── 對比測試: V2 vs V3 結果比對
└── 性能測試: 處理時間、Token 消耗
```

#### 第四階段：漸進式發布 (1-2 週)

```
發布策略:
├── Week 1: Feature Flag 控制，10% 流量
├── Week 2: 驗證無問題後，50% 流量
├── Week 3: 全量發布
└── Week 4: 移除舊流程代碼
```

### 6.2 Feature Flag 設計

```typescript
interface ExtractionFlags {
  // 現有 flags
  enableUnifiedProcessor: boolean;

  // 新增 flags
  useExtractionV3: boolean;              // 使用新架構
  extractionV3Percentage: number;         // 灰度發布百分比 (0-100)
  fallbackToV2OnError: boolean;          // 錯誤時回退到 V2

  // 調試 flags
  logPromptAssembly: boolean;            // 記錄組裝的 Prompt
  logGptResponse: boolean;               // 記錄 GPT 原始響應
}
```

---

## 7. 效益預估

### 7.1 量化效益

| 指標 | 當前 (V2) | 新架構 (V3) | 改善 |
|------|----------|------------|------|
| **處理時間** | ~22 秒 | ~10 秒 | **-55%** |
| **LLM 調用次數** | 2-3 次 | 1 次 | **-50~67%** |
| **Token 消耗** | ~2,900 | ~1,500 | **-48%** |
| **外部服務依賴** | 2 (Azure DI + GPT) | 1 (GPT) | **-50%** |
| **代碼複雜度** | 11 步 | 7 步 | **-36%** |

### 7.2 年度成本估算

假設年處理量 500,000 張發票：

| 項目 | 當前成本 | 新架構成本 | 節省 |
|------|---------|-----------|------|
| **Azure DI** | ~$15,000/年 | $0 | **$15,000** |
| **GPT Token** | ~$8,700/年 | ~$4,500/年 | **$4,200** |
| **總計** | ~$23,700/年 | ~$4,500/年 | **$19,200 (81%)** |

---

## 8. 附錄

### A. 保留 Azure DI 作為備選的場景

1. **極度複雜的多層表格文件**
2. **需要精確座標定位的場景**
3. **GPT Vision 處理失敗時的降級方案**
4. **監管合規要求雙重驗證的場景**

### B. 相關文檔

- `2026-01-30-ARCH-extraction-architecture-comparison.md` - 架構對比測試
- `docs/02-architecture/` - 系統架構文檔
- `src/services/unified-processor/` - 現有統一處理器
- `src/services/extraction-v2/` - 現有 V2 提取服務

### C. 待決事項

| # | 事項 | 狀態 | 負責人 |
|---|------|------|--------|
| 1 | 確認 Prompt 最大長度限制 | 待確認 | - |
| 2 | 定義完整的 Output JSON Schema | 待設計 | - |
| 3 | 確認灰度發布策略 | 待確認 | - |
| 4 | 制定回滾計劃 | 待制定 | - |

---

**文檔建立日期**: 2026-01-30
**作者**: AI Assistant (Claude)
**版本**: 1.0.0
**狀態**: 待審核
