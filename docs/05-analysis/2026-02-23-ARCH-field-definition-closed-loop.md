# 三步閉環架構：欄位定義 → AI 提取 → 模版匹配

> **建立日期**: 2026-02-23
> **類型**: 架構分析 / 設計提案
> **狀態**: ✅ 架構已確認 → CHANGE-042
> **影響範圍**: Stage 3 提取管線、Template Matching、欄位定義管理

---

## 目錄

- [1. 現狀問題：數據流斷裂](#1-現狀問題數據流斷裂)
- [2. 三步閉環：完整架構總覽](#2-三步閉環完整架構總覽)
- [3. STEP A 詳細：欄位定義登錄](#3-step-a-詳細欄位定義登錄)
- [4. STEP B 詳細：提取 + 結構化存儲](#4-step-b-詳細提取--結構化存儲)
- [5. STEP C 詳細：模版欄位匹配](#5-step-c-詳細模版欄位匹配)
- [6. 閉環回饋機制](#6-閉環回饋機制)
- [7. 完整端到端流程](#7-完整端到端流程一張圖)
- [8. 與現有系統的對照](#8-與現有系統的對照)
- [9. 需要的核心改動](#9-需要的核心改動)
- [10. 統一輸出格式建議](#10-統一輸出格式建議)

---

## 1. 現狀問題：數據流斷裂

### 問題背景

完整功能流程為：上傳文件 → 處理文件內容 → 準備數據模版 → 準備模版欄位匹配配置 → 運行模版 Instance → 得到相關數據的數據版本。

但在嘗試設定 Template Field Mapping 時，Source Field 的部分沒有該公司相關的欄位資料，導致 end-to-end 流程無法完成。

### 斷裂點圖示

```
 用戶上傳文件
      │
      ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────────────────────┐
│   Stage 1    │───▶│   Stage 2    │───▶│         Stage 3              │
│  文件分類     │    │  OCR/解析    │    │      AI 內容提取              │
│              │    │              │    │                              │
│ 輸出:        │    │ 輸出:        │    │  GPT prompt 寫死提取 8 欄位:  │
│ documentType │    │ rawText      │    │  invoiceNumber, invoiceDate, │
│ companyId    │    │ pages[]      │    │  vendorName, totalAmount,    │
│              │    │              │    │  currency, subtotal,         │
└──────────────┘    └──────────────┘    │  dueDate, customerName       │
                                        │                              │
                                        │  + lineItems[] (陣列)        │
                                        │  + extraCharges[] (陣列)     │
                                        └──────────────┬───────────────┘
                                                       │
                                                       ▼
                                        ┌──────────────────────────────┐
                                        │   persistV3_1Result()        │
                                        │                              │
                                        │   fieldMappings = {          │
                                        │     invoiceNumber: {v,c}     │
                                        │     invoiceDate: {v,c}       │
                                        │     vendorName: {v,c}        │
                                        │     totalAmount: {v,c}       │
                                        │     ... (只有 8 個 key)       │
                                        │   }                          │
                                        │                              │
                                        │   stage3Result = JSON blob   │
                                        │   (lineItems 埋在這裡,       │
                                        │    沒人讀取)                  │
                                        └──────────────┬───────────────┘
                                                       │
                                                       ▼
                              ┌─────────────────────────────────────────┐
                              │      Template Field Mapping 配置        │
                              │                                         │
                              │  用戶想設定:                             │
                              │  sourceField: "sea_freight"  ──▶ ╳ 不存在│
                              │  sourceField: "thc"          ──▶ ╳ 不存在│
                              │  sourceField: "origin_port"  ──▶ ╳ 不存在│
                              │                                         │
                              │  SourceFieldCombobox 只能顯示:          │
                              │  ✓ invoiceNumber                        │
                              │  ✓ invoiceDate                          │
                              │  ✓ vendorName                           │
                              │  ✓ totalAmount                          │
                              │  ... (只有 8 個可選)                     │
                              │                                         │
                              │  ⚠️ 用戶需要的 90+ 貨運欄位全部缺失！    │
                              └─────────────────────┬───────────────────┘
                                                    │
                                                    ▼
                              ┌─────────────────────────────────────────┐
                              │      Template Matching Engine           │
                              │                                         │
                              │  讀取 fieldMappings["sea_freight"]      │
                              │  → undefined ╳                          │
                              │                                         │
                              │  讀取 fieldMappings["origin_port"]      │
                              │  → undefined ╳                          │
                              │                                         │
                              │  ❌ 匹配失敗，流程卡住                    │
                              └─────────────────────────────────────────┘
```

### 根本原因分析

| # | 原因 | 代碼位置 | 影響 |
|---|------|---------|------|
| 1 | `loadFieldMappingConfig()` 是 stub | `stage-3-extraction.service.ts:366` | 永遠只回傳 8 個預設欄位 |
| 2 | lineItems/extraCharges 未被扁平化 | `processing-result-persistence.service.ts:527` | 含 `classifiedAs` 的數據沒有轉換成命名欄位 |
| 3 | `persistV3_1` 直接存 standardFields | `processing-result-persistence.service.ts:577` | 跳過舊版 unified-processor 的 field-mapping step |
| 4 | `invoice-fields.ts` 定義了 90+ 欄位但沒被 Stage 3 使用 | `src/types/invoice-fields.ts` | 理論上的欄位目錄，實際上沒有數據 |

---

## 2. 三步閉環：完整架構總覽

```
                    ┌─────────────────────────────────┐
                    │    管理介面 (Admin UI)            │
                    │    /field-definitions             │
                    │                                   │
                    │  「這間公司需要提取哪些欄位？」      │
                    │  ☑ sea_freight                    │
                    │  ☑ thc                            │
                    │  ☑ origin_port                    │
                    │  ☑ destination_port               │
                    │  ☐ customs_fee                    │
                    │  + 新增自定義欄位...               │
                    └────────────────┬──────────────────┘
                                     │ 寫入
                                     ▼
╔════════════════════════════════════════════════════════════════════════╗
║  STEP A: 欄位定義登錄 (Field Definition Registry)                      ║
║                                                                        ║
║  DB: FieldDefinitionSet                                                ║
║  ┌────────────────────────────────────────────────────────────────┐    ║
║  │ id: "fds_001"                                                  │    ║
║  │ companyId: "company_ABC" (或 null = 通用)                      │    ║
║  │ name: "ABC Logistics 標準欄位集"                                │    ║
║  │                                                                │    ║
║  │ fields: [                                                      │    ║
║  │   { key: "invoice_number", label: "Invoice No.",    cat: "基礎"},   ║
║  │   { key: "sea_freight",    label: "Sea Freight",    cat: "費用"},   ║
║  │   { key: "thc",            label: "THC",            cat: "費用"},   ║
║  │   { key: "origin_port",    label: "Origin Port",    cat: "航運"},   ║
║  │   { key: "bl_number",      label: "B/L No.",        cat: "參考"},   ║
║  │   { key: "custom_abc_fee", label: "ABC 特殊費",     cat: "自定義"}, ║
║  │   ...                                                          │    ║
║  │ ]                                                              │    ║
║  └────────────────────────────────────────────────────────────────┘    ║
╚════════════════╤═══════════════════════════════════╤═══════════════════╝
                 │ 讀取欄位定義                       │ 提供 Source Field
                 │ (驅動 prompt 生成)                 │ 候選清單
                 ▼                                    ▼
╔════════════════════════════════════╗  ╔════════════════════════════════╗
║  STEP B: 提取 + 結構化存儲         ║  ║  STEP C: 模版欄位匹配          ║
║                                    ║  ║                                ║
║  Stage 3 動態提取                  ║  ║  Source Fields (來自 Step B)    ║
║       +                            ║  ║       ↓                        ║
║  結果扁平化 + 存儲                  ║  ║  Template Field Mapping Rules  ║
║       │                            ║  ║       ↓                        ║
║       │ 寫入 fieldMappings         ║  ║  Template Matching Engine      ║
║       │ (完整版，30-90+ 欄位)      ║  ║       ↓                        ║
║       └────────────────────────────╬─▶║  Data Version (輸出)           ║
║                                    ║  ║                                ║
╚════════════════════════════════════╝  ╚════════════════════════════════╝
                 ▲                                    │
                 │              回饋循環               │
                 │  「這個欄位匹配失敗/缺失，           │
                 │    是否需要調整欄位定義？」           │
                 └────────────────────────────────────┘
```

---

## 3. STEP A 詳細：欄位定義登錄

### 概念說明

STEP A 是整個閉環的**起點和控制中心**。它定義了「這間公司需要從文件中提取哪些欄位」，直接驅動 Stage 3 的 prompt 生成，同時為 Template Field Mapping 提供 Source Field 候選清單。

### 資料來源與消費者

```
  資料來源                          DB 結構                    消費者
  ─────────                        ────────                   ──────

  ┌───────────────────┐
  │ invoice-fields.ts │
  │ (90+ 標準欄位目錄)  │
  │                   │
  │ 8 個分類:          │
  │ • basic           │
  │ • shipper         │
  │ • consignee       │
  │ • shipping        │──────┐
  │ • package         │      │ 作為「候選清單」
  │ • charges         │      │ 管理介面從此選擇
  │ • reference       │      │
  │ • payment         │      │
  └───────────────────┘      │
                              ▼
                   ┌──────────────────────┐
                   │     管理介面          │
                   │  /field-definitions   │
                   │                      │
                   │  ┌────────────────┐  │
                   │  │ 通用欄位集      │  │        ┌──────────────────┐
                   │  │ (companyId=null)│──│───────▶│ FieldDefinition  │
                   │  │ 適用所有公司    │  │        │ Set (DB)         │
                   │  └────────────────┘  │        │                  │
                   │                      │        │ ┌──────────────┐ │
                   │  ┌────────────────┐  │        │ │ 通用集        │ │
                   │  │ ABC Logistics  │──│───────▶│ │ 30 個基礎欄位 │ │
                   │  │ 專屬欄位集      │  │        │ └──────────────┘ │
                   │  │ 繼承通用+覆蓋   │  │        │                  │
                   │  └────────────────┘  │        │ ┌──────────────┐ │───▶ Stage 3
                   │                      │        │ │ ABC 專屬      │ │    prompt
                   │  ┌────────────────┐  │        │ │ 通用30+專屬15 │ │    生成
                   │  │ XYZ Shipping   │──│───────▶│ │ = 45 個欄位   │ │
                   │  │ 專屬欄位集      │  │        │ └──────────────┘ │───▶ Source
                   │  │ + 自定義欄位    │  │        │                  │    Field
                   │  └────────────────┘  │        │ ┌──────────────┐ │    候選
                   │                      │        │ │ XYZ 專屬      │ │
                   │  [+ 新增公司欄位集]   │        │ │ 通用30+專屬20 │ │
                   └──────────────────────┘        │ │ +自定義5      │ │
                                                    │ │ = 55 個欄位   │ │
                                                    │ └──────────────┘ │
                                                    └──────────────────┘
```

### 欄位定義的繼承機制

此機制與現有的三層映射系統 (Tier 1/2/3) 設計一致：

```
  Tier 1 通用欄位集 ──▶ 所有公司都會提取的基礎欄位
  (companyId=null)      invoice_number, invoice_date, vendor_name,
                        total_amount, currency, ...
         │
         ▼  繼承
  Tier 2 公司專屬 ──▶ 該公司額外需要的欄位
  (companyId=X)       sea_freight, thc, origin_port, ...
                      + 可覆蓋通用欄位的提取方式
         │
         ▼  合併
  最終欄位集 ──▶ 通用 ∪ 公司專屬 = 完整提取清單
                傳給 Stage 3 作為 prompt 的欄位定義
```

---

## 4. STEP B 詳細：提取 + 結構化存儲

### 概念說明

STEP B 是**數據處理的核心**。它從 STEP A 讀取欄位定義，動態生成 GPT prompt，接收 AI 提取結果後正規化並存入資料庫。這是解決現有斷裂的關鍵步驟。

### 處理流程

```
                    ┌─────────────────────┐
                    │  STEP A 欄位定義     │
                    │  (合併後: 45 個欄位)  │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
    ┌─────────────────┐ ┌──────────┐ ┌──────────────────┐
    │ prompt 模版注入  │ │ JSON     │ │ 驗證 schema      │
    │                 │ │ Schema   │ │                  │
    │ "請從以下文件    │ │ 生成     │ │ 用於驗證 GPT      │
    │  提取這些欄位:   │ │          │ │ 回傳的 JSON      │
    │                 │ │ {        │ │ 是否符合預期格式   │
    │  - invoice_no   │ │  type:   │ │                  │
    │  - sea_freight  │ │  object  │ │                  │
    │  - thc          │ │  props:  │ │                  │
    │  - origin_port  │ │  { ... } │ │                  │
    │  - ...          │ │ }        │ │                  │
    │  (共 45 個)"    │ │          │ │                  │
    └────────┬────────┘ └────┬─────┘ └────────┬─────────┘
             │               │                │
             ▼               ▼                ▼
    ┌─────────────────────────────────────────────────────┐
    │                    Stage 3                           │
    │              GPT-5.2 AI 提取                         │
    │                                                     │
    │  loadFieldMappingConfig()                           │
    │  ─────── 不再是 stub ──────                         │
    │  → 從 DB 讀取 FieldDefinitionSet                    │
    │  → 合併 通用 + 公司專屬                               │
    │  → 生成 prompt + JSON schema                        │
    │                                                     │
    │  GPT 回傳:                                          │
    │  {                                                  │
    │    fields: {                                        │
    │      invoice_number: { value: "INV-001", conf: 95 },│
    │      sea_freight: { value: 1200.00, conf: 88 },    │
    │      thc: { value: 350.00, conf: 92 },             │
    │      origin_port: { value: "Shanghai", conf: 90 }, │
    │      bl_number: { value: "BL123456", conf: 85 },   │
    │      ...                                           │
    │    },                                              │
    │    lineItems: [ ... ],                              │
    │    extraCharges: [ ... ]                            │
    │  }                                                  │
    └───────────────────────┬─────────────────────────────┘
                            │
                            ▼
    ┌─────────────────────────────────────────────────────┐
    │           結果正規化 (Normalize)                      │
    │                                                     │
    │  輸入: Stage 3 原始回傳                               │
    │                                                     │
    │  處理:                                               │
    │  1. fields{} 直接保留（已經是扁平 key-value）          │
    │                                                     │
    │  2. lineItems[] 分類扁平化:                           │
    │     lineItems[0] = { classifiedAs: "sea_freight",   │
    │                      amount: 1200 }                 │
    │     → 如果 fields 沒有 sea_freight，補充進去           │
    │     → 如果已有，驗證一致性                             │
    │                                                     │
    │  3. extraCharges[] 同理扁平化                         │
    │                                                     │
    │  4. 附加 metadata:                                   │
    │     每個欄位標記 source 來源                           │
    │     (ai_direct / line_item_classified / extra_charge)│
    └───────────────────────┬─────────────────────────────┘
                            │
                            ▼
    ┌─────────────────────────────────────────────────────┐
    │         結構化存儲 (Persist)                          │
    │                                                     │
    │  ExtractionResult.fieldMappings = {                  │
    │    invoice_number: {                                │
    │      value: "INV-001",                              │
    │      confidence: 95,                                │
    │      source: "ai_direct"                            │
    │    },                                               │
    │    sea_freight: {                                   │
    │      value: 1200.00,                                │
    │      confidence: 88,                                │
    │      source: "ai_direct"                            │
    │    },                                               │
    │    thc: {                                           │
    │      value: 350.00,                                 │
    │      confidence: 92,                                │
    │      source: "line_item_classified"                 │
    │    },                                               │
    │    origin_port: {                                   │
    │      value: "Shanghai",                             │
    │      confidence: 90,                                │
    │      source: "ai_direct"                            │
    │    },                                               │
    │    ... (45 個欄位全部有值或 null)                     │
    │  }                                                  │
    │                                                     │
    │  ✅ 現在 fieldMappings 有 45 個 key！                 │
    │     不再只有 8 個                                     │
    └─────────────────────────────────────────────────────┘
```

---

## 5. STEP C 詳細：模版欄位匹配

### 概念說明

STEP C 是**數據輸出的最後一哩路**。它將 STEP B 存儲的提取結果，通過用戶配置的映射規則，轉換為模版所需的格式，最終生成 Data Version。

### 匹配流程

```
  STEP A 提供                       STEP B 提供
  Source Field 候選清單              fieldMappings (45個key)
       │                                  │
       ▼                                  │
┌──────────────────────────┐              │
│  Template Field Mapping  │              │
│  配置介面                 │              │
│                          │              │
│  ┌─────────────────────────────────────────────┐
│  │  Rule 1:                                     │
│  │  sourceField: "sea_freight"    ← 從候選清單選 │
│  │  targetField: "Ocean Freight"  ← 模版欄位     │
│  │  transform:   DIRECT                         │
│  ├──────────────────────────────────────────────┤
│  │  Rule 2:                                     │
│  │  sourceField: "thc"                          │
│  │  targetField: "Terminal Handling"             │
│  │  transform:   DIRECT                         │
│  ├──────────────────────────────────────────────┤
│  │  Rule 3:                                     │
│  │  sourceField: "origin_port"                  │
│  │  targetField: "POL"                          │
│  │  transform:   LOOKUP (port_code_table)       │
│  ├──────────────────────────────────────────────┤
│  │  Rule 4:                                     │
│  │  sourceField: "sea_freight"                  │
│  │  targetField: "Total Freight (USD)"          │
│  │  transform:   FORMULA                        │
│  │  formula:     "sea_freight + thc + baf"      │
│  └──────────────────────────────────────────────┘
│                          │
└──────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────────────────┐
│              Template Matching Engine                     │
│                                                          │
│  輸入:                                                    │
│  ├── fieldMappings (來自 Step B): 45 個 key-value         │
│  └── mappingRules (來自配置): N 條規則                     │
│                                                          │
│  處理:                                                    │
│  for each rule:                                          │
│    sourceValue = fieldMappings[rule.sourceField]          │
│    ├── "sea_freight" → { value: 1200.00, conf: 88 } ✅   │
│    ├── "thc"         → { value: 350.00, conf: 92 }  ✅   │
│    ├── "origin_port" → { value: "Shanghai", conf: 90} ✅  │
│    └── 全部都找得到了！                                    │
│                                                          │
│    targetValue = transform(sourceValue, rule.transform)   │
│    output[rule.targetField] = targetValue                 │
│                                                          │
│  輸出:                                                    │
│  {                                                       │
│    "Ocean Freight": 1200.00,                             │
│    "Terminal Handling": 350.00,                           │
│    "POL": "CNSHA",  (經 LOOKUP 轉換)                      │
│    "Total Freight (USD)": 1850.00,  (經 FORMULA 計算)     │
│    ...                                                   │
│  }                                                       │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│              Template Instance / Data Version             │
│                                                          │
│  將匹配結果寫入 DataTemplate 的一個 Instance               │
│  生成 DataVersion → 用戶可審核/匯出                       │
│                                                          │
│  ✅ End-to-End 流程完成！                                  │
└──────────────────────────────────────────────────────────┘
```

---

## 6. 閉環回饋機制

### 概念說明

三步閉環的「閉環」體現在 STEP C 的匹配結果能**回饋**到 STEP A，驅動欄位定義的持續優化。這讓系統能自我進化，而不需要每次都由人工判斷哪些欄位缺失。

### 回饋流程

```
                 STEP A                    STEP B                 STEP C
            ┌─────────────┐          ┌─────────────┐       ┌──────────────┐
            │  欄位定義    │─────────▶│  AI 提取     │──────▶│  模版匹配     │
            │  Registry   │          │  + 存儲      │       │  Engine      │
            └──────┬──────┘          └─────────────┘       └──────┬───────┘
                   ▲                                              │
                   │                                              │
                   │         ┌─────────────────────────┐          │
                   │         │     回饋信號              │          │
                   │         │                         │          │
                   │    ┌────┤  1. 匹配報告             │◀─────────┘
                   │    │    │     "sea_freight 匹配成功" │
                   │    │    │     "baf 找不到值 (null)"  │
                   │    │    │     "新欄位 'ams_fee'      │
                   │    │    │      出現在文件中但        │
                   │    │    │      未在定義中"           │
                   │    │    │                         │
                   │    │    │  2. 信心度分析             │
                   │    │    │     平均 conf < 70%       │
                   │    │    │     → 建議調整提取 prompt  │
                   │    │    │                         │
                   │    │    │  3. 未知欄位發現           │
                   │    │    │     GPT 回傳了定義外欄位   │
                   │    │    │     → 建議新增到定義       │
                   │    │    └─────────────────────────┘
                   │    │
                   │    ▼
                   │  ┌───────────────────────────────────┐
                   │  │  管理介面 通知                      │
                   │  │                                   │
                   │  │  ⚠️ ABC Logistics 最近 10 份文件:   │
                   │  │  • "baf" 欄位 8/10 為 null         │
                   │  │    → 是否需要調整欄位定義？          │
                   │  │                                   │
                   │  │  💡 發現新欄位 "ams_fee"            │
                   │  │    出現在 5 份文件中                 │
                   │  │    → 是否新增到欄位定義？            │
                   └──┤                                   │
                      │  用戶操作:                          │
                      │  [新增欄位] [調整定義] [忽略]        │
                      └───────────────────────────────────┘
```

### 回饋信號類型

| 信號類型 | 觸發條件 | 建議動作 |
|---------|---------|---------|
| 欄位缺失 | sourceField 在 fieldMappings 中為 null | 檢查欄位定義是否完整 |
| 低信心度 | 某欄位連續多份文件 confidence < 70% | 調整提取 prompt 或欄位描述 |
| 未知欄位 | GPT 回傳了定義外的欄位 | 考慮新增到欄位定義 |
| 匹配率低 | Template Matching 整體匹配率 < 80% | 檢查欄位定義與模版配置 |

---

## 7. 完整端到端流程（一張圖）

```
  用戶上傳發票 PDF
       │
       ▼
  ┌─────────┐     ┌─────────┐     ┌─────────────────────────────────────┐
  │ Stage 1 │────▶│ Stage 2 │────▶│ Stage 3 (改造後)                     │
  │ 分類    │     │ OCR     │     │                                     │
  │         │     │         │     │  1. 查詢 companyId                   │
  │ → type  │     │ → text  │     │  2. loadFieldDefSet(companyId)      │
  │ → coId  │     │ → pages │     │     → 從 DB 讀取欄位定義             │
  └─────────┘     └─────────┘     │     → 合併通用 + 公司專屬             │
                                   │     → 得到 45 個欄位定義              │
                                   │                                     │
                                   │  3. 動態生成 GPT prompt:             │
                                   │     "提取以下 45 個欄位..."           │
                                   │                                     │
                                   │  4. GPT 回傳結構化 JSON              │
                                   │     → 45 個欄位都有 value + conf     │
                                   │                                     │
                                   │  5. 正規化:                          │
                                   │     fields{} + lineItems分類          │
                                   │     → 扁平化為統一格式                 │
                                   └──────────────┬──────────────────────┘
                                                  │
                                                  ▼
                                   ┌─────────────────────────────────────┐
                                   │  ExtractionResult.fieldMappings     │
                                   │  (45 個 key-value pairs)            │
                                   │                                     │
                                   │  invoice_number: "INV-001" (95%)   │
                                   │  sea_freight: 1200.00 (88%)        │
                                   │  thc: 350.00 (92%)                 │
                                   │  origin_port: "Shanghai" (90%)     │
                                   │  bl_number: "BL123456" (85%)       │
                                   │  ... (共 45 個)                     │
                                   └──────────────┬──────────────────────┘
                                                  │
                                                  ▼
                                   ┌─────────────────────────────────────┐
                                   │  Template Field Mapping Rules       │
                                   │  (用戶已配置好的映射規則)             │
                                   │                                     │
                                   │  sea_freight ──DIRECT──▶ 海運費     │
                                   │  thc ──────DIRECT──▶ 碼頭操作費     │
                                   │  origin_port ─LOOKUP──▶ 起運港代碼  │
                                   │  sea_freight+thc ─FORMULA─▶ 小計   │
                                   └──────────────┬──────────────────────┘
                                                  │
                                                  ▼
                                   ┌─────────────────────────────────────┐
                                   │  Template Instance                  │
                                   │  (匹配結果 → 填入模版)               │
                                   │                                     │
                                   │  ┌───────────────────────────────┐  │
                                   │  │ DataTemplate: "ABC 月結報表"   │  │
                                   │  ├───────────┬───────────────────┤  │
                                   │  │ 海運費     │ $1,200.00        │  │
                                   │  │ 碼頭操作費  │ $350.00          │  │
                                   │  │ 起運港代碼  │ CNSHA            │  │
                                   │  │ 小計       │ $1,550.00        │  │
                                   │  └───────────┴───────────────────┘  │
                                   └──────────────┬──────────────────────┘
                                                  │
                                                  ▼
                                   ┌─────────────────────────────────────┐
                                   │  Data Version                       │
                                   │  (可審核 / 匯出 / 歸檔)              │
                                   │                                     │
                                   │  ✅ End-to-End 完成！                │
                                   └─────────────────────────────────────┘
```

---

## 8. 與現有系統的對照

| 面向 | 現狀 | 三步閉環 |
|------|------|---------|
| **Stage 3 提取欄位來源** | `loadFieldMappingConfig()` = stub, 寫死 8 個欄位 | 從 DB 動態讀取 N 個欄位定義 |
| **提取 prompt 生成方式** | 固定 prompt，只問 8 個欄位 | 根據欄位定義動態生成，問 N 個 |
| **結果存儲 fieldMappings** | standardFields 直存，只有 8 個 key | 扁平化 key-value，N 個 key (30-90+) |
| **lineItems 處理** | 存在 stage3Result JSON blob，沒人讀取 | 分類後扁平化，成為 fieldMappings 的一部分 |
| **Source Field Combobox** | 只顯示 8 個 + 理論上的 90 個（但實際沒有數據） | 顯示全部 N 個，來自欄位定義（都有實際數據） |
| **需要新增提取欄位時** | 改代碼，重新部署 | 管理介面操作，即時生效 |
| **欄位定義管理** | 無管理介面 | 完整 CRUD 管理頁面 |
| **回饋機制** | 無 | 匹配報告回饋到欄位定義，持續優化 |

---

## 9. 需要的核心改動

| 層級 | 改動 | 影響範圍 | 優先級 |
|------|------|---------|--------|
| **DB** | 新增/擴展 `FieldDefinitionSet` model（或擴展現有 `FieldMappingConfig`） | `prisma/schema.prisma` | 高 |
| **API** | 欄位定義 CRUD 端點 | 新 API routes | 高 |
| **Stage 3** | `loadFieldMappingConfig()` 從 DB 讀取 + prompt 動態生成 | `stage-3-extraction.service.ts` | 高 |
| **存儲** | `persistV3_1ProcessingResult()` 扁平化寫入 | `processing-result-persistence.service.ts` | 高 |
| **UI** | 欄位定義管理頁面 | 新頁面 `/field-definitions` | 中 |
| **Source Field** | Combobox 從欄位定義讀取候選 | `source-field.service.ts` | 中 |
| **回饋** | 匹配報告生成 + 通知機制 | 新服務 | 低（可後續實現） |

---

## 10. 統一輸出格式建議

### 取代固定的 StandardFieldsV3

```typescript
/**
 * 統一的提取結果格式
 * 取代固定的 StandardFieldsV3（只有 8 個欄位）
 */
interface ExtractedFieldSet {
  /**
   * 所有欄位統一為 key-value 結構
   * key = 欄位定義中的 field key（如 "sea_freight", "invoice_number"）
   */
  fields: Record<string, {
    value: string | number | null
    confidence: number
    source: 'ai_direct' | 'line_item_classified' | 'extra_charge' | 'custom'
    /** 來源追溯（可選） */
    sourceDetail?: {
      lineItemIndex?: number        // 來自哪個 lineItem
      originalDescription?: string  // 原始描述文字
      classifiedAs?: string         // 分類結果
    }
  }>

  /** lineItems 仍保留原始結構（供明細顯示用） */
  lineItems: LineItemV3[]

  /** extraCharges 仍保留原始結構 */
  extraCharges?: ExtraChargeV3[]

  /** 後設數據 */
  meta: {
    fieldDefinitionSetId: string  // 使用了哪個欄位定義集
    extractionVersion: string     // 提取版本
    overallConfidence: number     // 整體信心度
    fieldCount: number            // 提取了多少個欄位
    nullCount: number             // 多少個欄位為 null
  }
}
```

### 格式優勢

| 特性 | 說明 |
|------|------|
| **動態** | `fields` 是 `Record<string, ...>`，可接受任意數量的欄位 |
| **可追溯** | 每個欄位都標記 `source` 來源（AI 直接提取 / lineItem 分類 / extraCharge） |
| **向下兼容** | `lineItems` 和 `extraCharges` 原始結構保留，不影響現有明細顯示 |
| **銜接模版** | `fields` 的 key 直接成為 SourceField 候選，無需額外轉換 |
| **可監控** | `meta` 提供匹配率相關的後設數據，供回饋機制使用 |

---

## 附錄：相關代碼位置

| 模組 | 檔案路徑 | 說明 |
|------|---------|------|
| Stage 3 提取服務 | `src/services/extraction-v3/stages/stage-3-extraction.service.ts` | `loadFieldMappingConfig()` stub 在 line 366 |
| 提取結果類型 | `src/types/extraction-v3.types.ts` | `Stage3ExtractionResult` 在 line 1116 |
| V3.1 持久化 | `src/services/processing-result-persistence.service.ts` | `persistV3_1ProcessingResult()` 在 line 458 |
| 模版匹配引擎 | `src/services/template-matching-engine.service.ts` | `extractMappedFields()` 在 line 635 |
| 模版欄位映射服務 | `src/services/template-field-mapping.service.ts` | 映射規則處理 |
| Source Field 服務 | `src/services/mapping/source-field.service.ts` | Source Field 候選清單合併 |
| 標準欄位目錄 | `src/types/invoice-fields.ts` | 90+ 標準欄位定義（8 個分類） |
| DB Schema | `prisma/schema.prisma` | `ExtractionResult` model 在 line 554 |
| 動態映射服務 | `src/services/mapping/dynamic-mapping.service.ts` | 舊版 field mapping 系統 |
| Extracted Fields API | `src/app/api/v1/formats/[id]/extracted-fields/route.ts` | 從歷史提取結果發現動態欄位 |

---

*文件建立日期: 2026-02-23*
*最後更新: 2026-02-23*
