# Freight Invoice Data Mapping 策略
## 如何高效處理 100+ 種發票格式

---

## 核心問題分析

你面對的挑戰：
- **100+ 種不同格式** 的發票（來自不同 Forwarder）
- 需要映射到 **90 個統一 Header**
- 需要 AI **自動識別文件類型** 並選擇正確的 mapping rule

**好消息是：你不需要為每種格式都手動建立完整的 mapping！**

---

## 策略一：分層 Mapping 架構（推薦）

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    THREE-TIER MAPPING ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ TIER 1: UNIVERSAL MAPPING (通用映射層)                          │    │
│  │ ════════════════════════════════════════                        │    │
│  │ 覆蓋 70-80% 的常見術語，所有 Forwarder 通用                      │    │
│  │                                                                  │    │
│  │ Examples:                                                        │    │
│  │ • "OCEAN FREIGHT" / "SEA FREIGHT" / "O/F" → Freight             │    │
│  │ • "THC" / "TERMINAL HANDLING" → THC                              │    │
│  │ • "DRAYAGE" / "TRUCKING" / "HAULAGE" → Delivery                 │    │
│  │                                                                  │    │
│  │ 維護成本: 低 (只需維護一份)                                       │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                           │
│                              ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ TIER 2: FORWARDER-SPECIFIC OVERRIDE (貨代特定覆蓋層)            │    │
│  │ ════════════════════════════════════════════════════            │    │
│  │ 只記錄該 Forwarder 與通用規則「不同」的映射                       │    │
│  │                                                                  │    │
│  │ Example - CEVA:                                                  │    │
│  │ • "HANDLING & PROCESSING" → Handling (CEVA 特有叫法)            │    │
│  │ • "ADMIN FEE" → Docs Fee (CEVA 特有)                            │    │
│  │                                                                  │    │
│  │ Example - TOLL:                                                  │    │
│  │ • "DELIVERY ORDER RELEASE" → Delivery (TOLL 特有叫法)           │    │
│  │                                                                  │    │
│  │ 維護成本: 中 (每個 Forwarder 只需記錄差異)                        │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                           │
│                              ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ TIER 3: LEARNED MAPPING (AI 學習層)                             │    │
│  │ ════════════════════════════════════                            │    │
│  │ 從人工校正中自動學習，持續優化                                    │    │
│  │                                                                  │    │
│  │ • 記錄每次人工修正                                               │    │
│  │ • 當同一映射被確認 3+ 次，自動加入 Tier 2                        │    │
│  │ • 減少未來人工介入                                               │    │
│  │                                                                  │    │
│  │ 維護成本: 自動 (系統自動學習)                                     │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ FALLBACK: LLM CLASSIFICATION (LLM 兜底)                         │    │
│  │ ════════════════════════════════════                            │    │
│  │ 當以上都無法匹配時，使用 GPT-5.2 / Claude 智能分類                 │    │
│  │ • 理解語義，不需要精確匹配                                        │    │
│  │ • 可處理從未見過的術語                                           │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 這個架構的優勢

| 方案 | 需維護的 Mapping 數量 | 工作量 |
|------|---------------------|--------|
| ❌ 為每種格式建立完整 mapping | 100 × 90 = 9,000 條 | 極高 |
| ✅ 分層架構 | ~300 通用 + ~500 特定 = ~800 條 | 低 |

---

## 策略二：高效準備 Data Mapping 的方法

### Step 1: 建立通用映射表（一次性工作）

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    UNIVERSAL MAPPING TABLE                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  SCM_Category     │ Keywords (精確匹配)        │ Patterns (模糊匹配)     │
│  ─────────────────┼───────────────────────────┼────────────────────────│
│  Freight          │ OCEAN FREIGHT             │ freight                 │
│                   │ SEA FREIGHT               │ o/f                     │
│                   │ AIR FREIGHT               │ a/f                     │
│                   │ FREIGHT CHARGE            │ sea.*freight            │
│  ─────────────────┼───────────────────────────┼────────────────────────│
│  Delivery         │ DRAYAGE                   │ drayage                 │
│                   │ TRUCKING                  │ truck                   │
│                   │ HAULAGE                   │ haulage                 │
│                   │ CARTAGE                   │ delivery                │
│                   │ D/O FEE                   │ d/o                     │
│                   │ DELIVERY ORDER FEE        │ transport               │
│  ─────────────────┼───────────────────────────┼────────────────────────│
│  THC              │ THC                       │ thc                     │
│                   │ TERMINAL HANDLING CHARGE  │ terminal.*handling      │
│                   │ TERMINAL HANDLING         │                         │
│  ─────────────────┼───────────────────────────┼────────────────────────│
│  ... (其他 87 個 Categories)                                            │
└─────────────────────────────────────────────────────────────────────────┘
```

### Step 2: 使用 AI 輔助生成 Forwarder-Specific Mapping

**方法：讓 AI 分析樣本發票，自動提取術語差異**

```python
def generate_forwarder_mapping(forwarder_code: str, sample_invoices: list):
    """
    輸入：Forwarder 代碼 + 3-5 張樣本發票
    輸出：該 Forwarder 的特定映射規則
    """
    
    prompt = f"""
    分析以下來自 {forwarder_code} 的發票樣本，提取所有費用項目描述。
    
    對比我們的標準 SCM 分類表，找出：
    1. 該 Forwarder 使用的特殊術語
    2. 與標準術語不同的說法
    3. 建議的映射關係
    
    標準 SCM 分類表：
    {SCM_CATEGORIES}
    
    發票內容：
    {sample_invoices}
    
    請輸出 JSON 格式：
    {{
        "forwarder": "{forwarder_code}",
        "specific_mappings": [
            {{
                "original_term": "該 Forwarder 使用的術語",
                "scm_category": "對應的 SCM 分類",
                "confidence": 0.95,
                "notes": "備註"
            }}
        ],
        "unmapped_terms": ["無法確定分類的術語"]
    }}
    """
    
    return llm.generate(prompt)
```

### Step 3: 建立 Mapping 工作流程

```
┌─────────────────────────────────────────────────────────────────────────┐
│              MAPPING PREPARATION WORKFLOW                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ PHASE 1: 收集樣本 (每個 Forwarder 3-5 張)                        │   │
│  │                                                                   │   │
│  │  Forwarder    │ HEX 樣本 │ HIM 樣本 │ CEX 樣本 │ CIM 樣本       │   │
│  │  ─────────────┼──────────┼──────────┼──────────┼─────────       │   │
│  │  TOLL         │    2     │    2     │    2     │    2           │   │
│  │  RIL          │    2     │    2     │    1     │    1           │   │
│  │  WK           │    2     │    2     │    -     │    1           │   │
│  │  ... (其他 Forwarder)                                            │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                              │                                           │
│                              ▼                                           │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ PHASE 2: AI 自動提取術語                                         │   │
│  │                                                                   │   │
│  │  1. 使用 Azure Doc Intelligence 提取所有 line items             │   │
│  │  2. 使用 GPT-5.2 識別獨特術語                                     │   │
│  │  3. 自動生成建議映射                                             │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                              │                                           │
│                              ▼                                           │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ PHASE 3: 人工審核確認                                            │   │
│  │                                                                   │   │
│  │  • 審核 AI 建議的映射                                            │   │
│  │  • 處理「無法確定」的術語                                         │   │
│  │  • 確認後寫入 Mapping 數據庫                                      │   │
│  │                                                                   │   │
│  │  預計時間：每個 Forwarder 約 15-30 分鐘                          │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                              │                                           │
│                              ▼                                           │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ PHASE 4: 持續學習優化                                            │   │
│  │                                                                   │   │
│  │  • 系統上線後，記錄所有人工修正                                   │   │
│  │  • 自動識別重複出現的新術語                                       │   │
│  │  • 定期更新 Mapping 規則                                          │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 策略三：文件類型識別方案

### 問題：AI 如何知道這張發票來自哪間公司？

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    FORWARDER IDENTIFICATION SYSTEM                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  每個 Forwarder 建立一個「Profile」，包含多種識別特徵：                   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    FORWARDER PROFILE                             │    │
│  │                                                                  │    │
│  │  {                                                               │    │
│  │    "code": "TOLL",                                               │    │
│  │    "name": "Toll Global Forwarding",                             │    │
│  │                                                                  │    │
│  │    // ===== 識別特徵 =====                                       │    │
│  │    "identification": {                                           │    │
│  │                                                                  │    │
│  │      // 1. 文件名模式 (從你的數據可以直接提取)                    │    │
│  │      "filename_patterns": [                                      │    │
│  │        "^TOLL_",           // 文件名以 TOLL_ 開頭                │    │
│  │        "^Toll_"                                                  │    │
│  │      ],                                                          │    │
│  │                                                                  │    │
│  │      // 2. 發票號碼格式                                          │    │
│  │      "invoice_number_patterns": [                                │    │
│  │        "^TL[A-Z]{2}\\d{8}$",  // e.g., TLTH00150706             │    │
│  │        "^\\d{10}$"                                               │    │
│  │      ],                                                          │    │
│  │                                                                  │    │
│  │      // 3. Header 關鍵文字 (發票頂部通常出現的文字)               │    │
│  │      "header_keywords": [                                        │    │
│  │        "TOLL GLOBAL FORWARDING",                                 │    │
│  │        "TOLL GROUP",                                             │    │
│  │        "Toll Logistics"                                          │    │
│  │      ],                                                          │    │
│  │                                                                  │    │
│  │      // 4. 地址關鍵字                                            │    │
│  │      "address_keywords": [                                       │    │
│  │        "tollgroup.com",                                          │    │
│  │        "Toll Global Forwarding (HK)"                             │    │
│  │      ],                                                          │    │
│  │                                                                  │    │
│  │      // 5. 銀行賬號 (非常可靠的識別方式)                          │    │
│  │      "bank_accounts": [                                          │    │
│  │        "012-878-xxxxxx-001",                                     │    │
│  │        "HSBC 567-xxxxxx"                                         │    │
│  │      ],                                                          │    │
│  │                                                                  │    │
│  │      // 6. 特有術語 (該公司獨有的說法)                            │    │
│  │      "unique_terms": [                                           │    │
│  │        "TOLL PRIORITY",                                          │    │
│  │        "TOLL EXPRESS"                                            │    │
│  │      ]                                                           │    │
│  │    },                                                            │    │
│  │                                                                  │    │
│  │    // ===== Mapping 規則 =====                                   │    │
│  │    "specific_mappings": [                                        │    │
│  │      {"term": "DELIVERY ORDER RELEASE", "category": "Delivery"}, │    │
│  │      {"term": "TOLL PRIORITY SERVICE", "category": "Handling"}   │    │
│  │    ]                                                             │    │
│  │  }                                                               │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 識別流程

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    FORWARDER IDENTIFICATION FLOW                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  輸入: Invoice PDF/Image                                                 │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ STEP 1: 文件名匹配 (最快，準確度 95%+)                           │   │
│  │ ─────────────────────────────────────────                        │   │
│  │ 文件名: "TOLL_HEX240565_89136.pdf"                               │   │
│  │ 匹配: ^TOLL_ → 識別為 TOLL ✓                                     │   │
│  │                                                                   │   │
│  │ 如果匹配成功且置信度高 → 直接使用 TOLL 的 Mapping 規則            │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                              │                                           │
│                              ▼ (如果文件名不規範)                        │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ STEP 2: 發票 Header 分析 (準確度 90%+)                           │   │
│  │ ─────────────────────────────────────                            │   │
│  │ 使用 Azure Doc Intelligence 提取文字                             │   │
│  │ 在前 500 字符中搜索 header_keywords                              │   │
│  │                                                                   │   │
│  │ 找到 "TOLL GLOBAL FORWARDING" → 識別為 TOLL ✓                    │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                              │                                           │
│                              ▼ (如果 Header 不明確)                      │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ STEP 3: 發票號碼格式匹配 (準確度 85%+)                           │   │
│  │ ─────────────────────────────────────────                        │   │
│  │ 發票號: "TLTH00150706"                                           │   │
│  │ 匹配: ^TL[A-Z]{2}\d{8}$ → 識別為 TOLL ✓                          │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                              │                                           │
│                              ▼ (如果還是無法確定)                        │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ STEP 4: 銀行賬號/地址匹配 (準確度 95%+)                          │   │
│  │ ─────────────────────────────────────────                        │   │
│  │ 在發票中搜索已知的銀行賬號或地址                                  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                              │                                           │
│                              ▼ (最後手段)                                │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ STEP 5: LLM 智能識別 (準確度 80%+)                               │   │
│  │ ─────────────────────────────────────                            │   │
│  │ 將發票圖片/文字發送給 GPT-5.2                                      │   │
│  │ 詢問: "這張發票來自哪個貨運代理公司？"                            │   │
│  │                                                                   │   │
│  │ 提供已知 Forwarder 列表供參考                                     │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                              │                                           │
│                              ▼                                           │
│  輸出: {forwarder: "TOLL", confidence: 0.95, method: "filename"}        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 實際執行計劃

### 根據你的數據（45 個 Forwarder，102 種組合）

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PRACTICAL EXECUTION PLAN                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  WEEK 1: 準備通用映射表                                                  │
│  ════════════════════════                                               │
│  • 整理 90 個 SCM Header 的完整定義                                     │
│  • 收集行業通用術語（約 300 個）                                        │
│  • 建立通用映射規則                                                      │
│  • 預計工作量：2-3 人天                                                  │
│                                                                          │
│  WEEK 2-3: 建立 Top 10 Forwarder Profile                                │
│  ════════════════════════════════════════                               │
│  Top 10 Forwarder (覆蓋 80% 業務量)：                                   │
│  │                                                                       │
│  │  排名 │ Forwarder      │ 發票數 │ 佔比                              │
│  │  ─────┼────────────────┼────────┼──────                              │
│  │   1   │ WK             │   346  │ 15.5%                              │
│  │   2   │ RIL            │   512  │ 23.0%                              │
│  │   3   │ MTL            │   186  │  8.3%                              │
│  │   4   │ TOLL           │   368  │ 16.5%                              │
│  │   5   │ NEX            │   134  │  6.0%                              │
│  │   6   │ WORLDWIDE      │    57  │  2.6%                              │
│  │   7   │ CEVA           │    96  │  4.3%                              │
│  │   8   │ DHL            │    88  │  3.9%                              │
│  │   9   │ NIPPON         │    69  │  3.1%                              │
│  │  10   │ CYTS           │    47  │  2.1%                              │
│  │       │ 小計           │ ~1,900 │ ~85%                               │
│  │                                                                       │
│  每個 Forwarder：                                                        │
│  • 收集 3-5 張樣本發票                                                  │
│  • AI 輔助提取術語                                                       │
│  • 人工審核確認                                                          │
│  • 預計每個 Forwarder：30-60 分鐘                                       │
│  • 總計：5-10 人天                                                       │
│                                                                          │
│  WEEK 4: 建立剩餘 Forwarder Profile (簡化版)                            │
│  ══════════════════════════════════════════                             │
│  • 剩餘 35 個 Forwarder（只佔 15% 業務量）                              │
│  • 只建立識別規則，使用通用 Mapping                                      │
│  • 讓系統在實際運行中學習特定規則                                        │
│  • 預計：2-3 人天                                                        │
│                                                                          │
│  總計：約 10-15 人天準備工作                                             │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 數據庫設計

### Forwarder Profile 表

```sql
-- Forwarder 主表
CREATE TABLE forwarders (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,       -- e.g., 'TOLL'
    name VARCHAR(200) NOT NULL,              -- 'Toll Global Forwarding'
    short_name VARCHAR(50),                  -- 'TOLL'
    
    -- ===== 識別特徵 =====
    filename_patterns TEXT[],                -- ['^TOLL_', '^Toll_']
    invoice_number_patterns TEXT[],          -- ['^TL[A-Z]{2}\\d{8}$']
    header_keywords TEXT[],                  -- ['TOLL GLOBAL FORWARDING']
    address_keywords TEXT[],                 -- ['tollgroup.com']
    bank_accounts TEXT[],                    -- ['012-878-xxxxx']
    unique_terms TEXT[],                     -- ['TOLL PRIORITY']
    
    -- ===== 設定 =====
    default_currency VARCHAR(3) DEFAULT 'HKD',
    invoice_format_type VARCHAR(50),         -- 'structured', 'semi-structured'
    
    -- ===== 狀態 =====
    profile_completeness INT DEFAULT 0,      -- 0-100%
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Forwarder 特定映射表
CREATE TABLE forwarder_mappings (
    id SERIAL PRIMARY KEY,
    forwarder_id INT REFERENCES forwarders(id),
    
    -- 映射規則
    original_term VARCHAR(500) NOT NULL,     -- Forwarder 使用的術語
    normalized_term VARCHAR(500),            -- 標準化後的術語
    scm_category_id INT REFERENCES scm_categories(id),
    
    -- 匹配設定
    match_type VARCHAR(20) DEFAULT 'exact',  -- 'exact', 'contains', 'regex'
    case_sensitive BOOLEAN DEFAULT false,
    
    -- 統計
    match_count INT DEFAULT 0,
    last_matched_at TIMESTAMP,
    
    -- 來源
    source VARCHAR(50) DEFAULT 'manual',     -- 'manual', 'ai_suggested', 'learned'
    confidence DECIMAL(3,2) DEFAULT 1.0,
    
    -- 狀態
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,       -- 人工確認過
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(forwarder_id, original_term)
);

-- 學習記錄表 (記錄人工修正)
CREATE TABLE mapping_corrections (
    id SERIAL PRIMARY KEY,
    
    -- 原始數據
    invoice_id INT,
    original_description VARCHAR(1000),
    
    -- AI 分類結果
    ai_suggested_category_id INT,
    ai_confidence DECIMAL(3,2),
    
    -- 人工修正結果
    corrected_category_id INT,
    corrected_by INT,
    corrected_at TIMESTAMP,
    
    -- 學習狀態
    forwarder_id INT,
    is_learned BOOLEAN DEFAULT false,        -- 是否已加入映射規則
    learned_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- 自動學習 Trigger
CREATE OR REPLACE FUNCTION auto_learn_mapping()
RETURNS TRIGGER AS $$
BEGIN
    -- 如果同一 Forwarder 的同一術語被修正 3 次以上，自動加入映射
    IF (
        SELECT COUNT(*) FROM mapping_corrections
        WHERE forwarder_id = NEW.forwarder_id
          AND original_description = NEW.original_description
          AND corrected_category_id = NEW.corrected_category_id
          AND is_learned = false
    ) >= 3 THEN
        -- 插入新的映射規則
        INSERT INTO forwarder_mappings (
            forwarder_id, original_term, scm_category_id, 
            source, confidence, is_verified
        ) VALUES (
            NEW.forwarder_id, NEW.original_description, NEW.corrected_category_id,
            'learned', 0.95, false
        )
        ON CONFLICT (forwarder_id, original_term) DO UPDATE
        SET scm_category_id = EXCLUDED.scm_category_id,
            confidence = LEAST(1.0, forwarder_mappings.confidence + 0.05),
            updated_at = NOW();
        
        -- 標記為已學習
        UPDATE mapping_corrections
        SET is_learned = true, learned_at = NOW()
        WHERE forwarder_id = NEW.forwarder_id
          AND original_description = NEW.original_description;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_learn
AFTER INSERT ON mapping_corrections
FOR EACH ROW
EXECUTE FUNCTION auto_learn_mapping();
```

---

## 工具：Mapping 準備助手

### 給你一個實用工具來加速準備工作

```python
class MappingPreparationAssistant:
    """
    Mapping 準備助手
    幫助快速為新 Forwarder 建立 Profile 和 Mapping
    """
    
    def __init__(self, azure_client, openai_client, db):
        self.azure = azure_client
        self.llm = openai_client
        self.db = db
    
    def analyze_forwarder_samples(self, forwarder_code: str, sample_files: list) -> dict:
        """
        分析 Forwarder 的樣本發票，自動生成 Profile 和 Mapping 建議
        
        用法：
            assistant.analyze_forwarder_samples(
                'TOLL',
                ['TOLL_HEX240565.pdf', 'TOLL_CIM240408.pdf', 'TOLL_HIM240531.pdf']
            )
        """
        
        results = {
            'forwarder_code': forwarder_code,
            'identification_features': {},
            'suggested_mappings': [],
            'unmapped_terms': [],
            'sample_analysis': []
        }
        
        all_line_items = []
        header_texts = []
        invoice_numbers = []
        
        # Step 1: 提取每個樣本的數據
        for file_path in sample_files:
            extraction = self._extract_invoice(file_path)
            
            results['sample_analysis'].append({
                'file': file_path,
                'invoice_number': extraction.get('invoice_number'),
                'line_items_count': len(extraction.get('line_items', [])),
                'confidence': extraction.get('confidence')
            })
            
            # 收集數據
            all_line_items.extend(extraction.get('line_items', []))
            header_texts.append(extraction.get('header_text', ''))
            if extraction.get('invoice_number'):
                invoice_numbers.append(extraction['invoice_number'])
        
        # Step 2: 分析識別特徵
        results['identification_features'] = self._analyze_identification_features(
            forwarder_code, header_texts, invoice_numbers
        )
        
        # Step 3: 提取唯一術語並生成映射建議
        unique_terms = self._extract_unique_terms(all_line_items)
        results['suggested_mappings'] = self._generate_mapping_suggestions(
            forwarder_code, unique_terms
        )
        
        # Step 4: 找出無法自動映射的術語
        results['unmapped_terms'] = [
            term for term in unique_terms
            if not any(m['term'] == term for m in results['suggested_mappings'])
        ]
        
        return results
    
    def _extract_invoice(self, file_path: str) -> dict:
        """使用 Azure Doc Intelligence 提取發票數據"""
        
        with open(file_path, 'rb') as f:
            poller = self.azure.begin_analyze_document(
                'prebuilt-invoice', f
            )
            result = poller.result()
        
        # 解析結果
        extracted = {
            'invoice_number': None,
            'line_items': [],
            'header_text': result.content[:500] if result.content else '',
            'confidence': 0
        }
        
        if result.documents:
            doc = result.documents[0]
            fields = doc.fields
            
            if 'InvoiceId' in fields:
                extracted['invoice_number'] = fields['InvoiceId'].content
            
            if 'Items' in fields:
                for item in fields['Items'].value:
                    if 'Description' in item.value:
                        extracted['line_items'].append({
                            'description': item.value['Description'].content,
                            'amount': item.value.get('Amount', {}).get('content')
                        })
        
        return extracted
    
    def _analyze_identification_features(self, forwarder_code: str, 
                                          header_texts: list, 
                                          invoice_numbers: list) -> dict:
        """分析並提取識別特徵"""
        
        prompt = f"""
        分析以下來自 {forwarder_code} 的發票數據，提取識別特徵：
        
        發票頂部文字樣本：
        {header_texts}
        
        發票號碼樣本：
        {invoice_numbers}
        
        請提取：
        1. 公司名稱關鍵字 (header_keywords)
        2. 發票號碼格式的正則表達式 (invoice_number_pattern)
        3. 可能的地址/聯繫方式關鍵字 (address_keywords)
        4. 任何獨特的標識 (unique_identifiers)
        
        輸出 JSON 格式。
        """
        
        response = self.llm.chat.completions.create(
            model="gpt-5.2",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )

        return json.loads(response.choices[0].message.content)

    def _generate_mapping_suggestions(self, forwarder_code: str, 
                                       terms: list) -> list:
        """生成映射建議"""
        
        # 載入 SCM 分類表
        scm_categories = self._load_scm_categories()
        
        prompt = f"""
        將以下來自 {forwarder_code} 的費用術語映射到 SCM 標準分類。
        
        費用術語：
        {json.dumps(terms, ensure_ascii=False, indent=2)}
        
        SCM 標準分類：
        {json.dumps(scm_categories, ensure_ascii=False, indent=2)}
        
        對於每個術語：
        1. 找到最合適的 SCM 分類
        2. 給出置信度 (0-1)
        3. 說明理由
        
        如果無法確定，將其標記為 "NEEDS_REVIEW"
        
        輸出 JSON 數組格式：
        [
            {{
                "term": "原始術語",
                "scm_category": "SCM 分類名稱",
                "confidence": 0.95,
                "reasoning": "理由"
            }}
        ]
        """
        
        response = self.llm.chat.completions.create(
            model="gpt-5.2",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )

        result = json.loads(response.choices[0].message.content)
        return result.get('mappings', result)
    
    def save_to_database(self, analysis_result: dict, verified: bool = False):
        """將分析結果保存到數據庫"""
        
        forwarder_code = analysis_result['forwarder_code']
        features = analysis_result['identification_features']
        mappings = analysis_result['suggested_mappings']
        
        # 更新 Forwarder Profile
        self.db.execute("""
            INSERT INTO forwarders (code, header_keywords, invoice_number_patterns)
            VALUES (%s, %s, %s)
            ON CONFLICT (code) DO UPDATE
            SET header_keywords = EXCLUDED.header_keywords,
                invoice_number_patterns = EXCLUDED.invoice_number_patterns,
                updated_at = NOW()
        """, (
            forwarder_code,
            features.get('header_keywords', []),
            features.get('invoice_number_patterns', [])
        ))
        
        # 插入映射規則
        forwarder_id = self.db.execute(
            "SELECT id FROM forwarders WHERE code = %s", (forwarder_code,)
        ).fetchone()[0]
        
        for mapping in mappings:
            if mapping.get('scm_category') != 'NEEDS_REVIEW':
                self.db.execute("""
                    INSERT INTO forwarder_mappings 
                    (forwarder_id, original_term, scm_category_id, confidence, 
                     source, is_verified)
                    SELECT %s, %s, id, %s, 'ai_suggested', %s
                    FROM scm_categories WHERE name = %s
                    ON CONFLICT (forwarder_id, original_term) DO NOTHING
                """, (
                    forwarder_id,
                    mapping['term'],
                    mapping['confidence'],
                    verified,
                    mapping['scm_category']
                ))
        
        self.db.commit()
        
        return {
            'forwarder_id': forwarder_id,
            'mappings_saved': len([m for m in mappings if m.get('scm_category') != 'NEEDS_REVIEW']),
            'needs_review': len([m for m in mappings if m.get('scm_category') == 'NEEDS_REVIEW'])
        }
```

---

## 總結

### 回答你的兩個問題：

**Q1: 如何高效準備 Data Mapping？**

1. **不要為每種格式單獨建立完整 mapping**
   - 使用三層架構：通用層 + 特定覆蓋層 + AI 學習層

2. **善用 AI 輔助**
   - 讓 GPT-5.2 分析樣本發票，自動提取術語和建議映射
   - 人工只需審核確認，而非從零開始

3. **優先處理高頻 Forwarder**
   - Top 10 Forwarder 覆蓋 85% 業務量
   - 剩餘 35 個可以用通用規則 + 系統學習

4. **預計工作量**
   - 約 10-15 人天完成初始準備
   - 系統上線後持續優化

---

**Q2: 如何讓 AI 識別文件類型？**

1. **建立 Forwarder Profile**
   - 包含多種識別特徵：文件名模式、發票號碼格式、Header 關鍵字、銀行賬號等

2. **多層識別策略**
   - 文件名匹配 → Header 分析 → 發票號碼格式 → 銀行賬號 → LLM 推斷

3. **根據你的數據，文件名已經包含 Forwarder 信息**
   - `TOLL_HEX240565_89136.pdf` → 直接識別為 TOLL
   - 這是最快最準確的方式（95%+ 準確度）

4. **Fallback 機制**
   - 對於不規範的文件名，使用 OCR + LLM 分析內容

---

*需要我生成一個 Excel 模板來幫助你收集 Forwarder Profile 和 Mapping 規則嗎？*
