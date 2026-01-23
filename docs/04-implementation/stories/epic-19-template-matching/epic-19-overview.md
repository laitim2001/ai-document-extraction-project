# Epic 19: 數據模版匹配與輸出

**Status:** draft

---

## Epic 概述

### 背景

目前系統的文件處理流程（11 步驟 Unified Processing Pipeline）已完成「數據提取」和「第一層 Field Mapping」，但缺少將提取數據填入用戶定義的「數據模版」功能。

**現有流程：**
```
文件 → 識別公司/格式 → 配置獲取 → AI 提取 → Field Mapping → 存入 Document 記錄
                                                    ↑
                                            (第一層：術語 → 標準欄位)
```

**需要新增：**
```
Document 記錄 → 選擇數據模版 → 第二層 Mapping → 填入模版 → 導出 Excel/CSV
                                    ↑
                      (第二層：標準欄位 → 模版欄位)
```

### 目標

1. **建立第二層映射系統**：將標準化欄位映射到用戶定義的數據模版欄位
2. **建立模版實例管理**：存儲和管理填充後的模版數據
3. **提供導出功能**：支援 Excel/CSV 導出
4. **整合到現有流程**：自動或手動將處理完的文件匹配到模版

### 業務價值

- **靈活輸出格式**：用戶可建立多個數據模版，滿足不同輸出需求（ERP、報表、對帳單等）
- **降低維護成本**：雙層映射架構，新增公司只需配置第一層，新增模版只需配置第二層
- **提高自動化率**：批量文件自動匹配到模版，減少人工操作

---

## 架構設計

### 雙層映射架構

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              雙層映射架構                                                 │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  📄 文件輸入                                                                            │
│      │                                                                                  │
│      ▼                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────┐            │
│  │ 第一階段：數據提取 (現有 - Epic 0-16)                                    │            │
│  │                                                                        │            │
│  │  識別公司/格式 → PromptConfig → AI 提取 → FieldMappingConfig            │            │
│  │                                                │                       │            │
│  │                                                ▼                       │            │
│  │                                   ┌──────────────────────┐             │            │
│  │                                   │ 第一層 Field Mapping │             │            │
│  │                                   │ (術語 → 標準欄位)    │             │            │
│  │                                   │                      │             │            │
│  │                                   │ oceanFrt → sea_freight│            │            │
│  │                                   │ thc → terminal_handling│           │            │
│  │                                   └──────────────────────┘             │            │
│  │                                                │                       │            │
│  │                                                ▼                       │            │
│  │                                   Document 記錄 (mappedFields)          │            │
│  │                                                                        │            │
│  └────────────────────────────────────────────────────────────────────────┘            │
│                                                │                                        │
│                                                ▼                                        │
│  ┌────────────────────────────────────────────────────────────────────────┐            │
│  │ 第二階段：模版匹配與輸出 (新增 - Epic 19)                                │            │
│  │                                                                        │            │
│  │  選擇數據模版 → TemplateFieldMapping → 填入模版 → 導出                   │            │
│  │                        │                                               │            │
│  │                        ▼                                               │            │
│  │           ┌──────────────────────────┐                                 │            │
│  │           │ 第二層 Template Mapping  │                                 │            │
│  │           │ (標準欄位 → 模版欄位)    │                                 │            │
│  │           │                          │                                 │            │
│  │           │ sea_freight → shipping_cost│                               │            │
│  │           │ terminal_handling → port_fees│                             │            │
│  │           └──────────────────────────┘                                 │            │
│  │                        │                                               │            │
│  │                        ▼                                               │            │
│  │           ┌──────────────────────────┐                                 │            │
│  │           │ TemplateInstance         │                                 │            │
│  │           │ (填充後的模版實例)        │                                 │            │
│  │           │                          │                                 │            │
│  │           │ ┌────────┬───────┬─────┐ │                                 │            │
│  │           │ │shipment│cost   │fees │ │                                 │            │
│  │           │ ├────────┼───────┼─────┤ │                                 │            │
│  │           │ │S001    │500    │100  │ │                                 │            │
│  │           │ │S002    │450    │120  │ │                                 │            │
│  │           │ └────────┴───────┴─────┘ │                                 │            │
│  │           └──────────────────────────┘                                 │            │
│  │                        │                                               │            │
│  │                        ▼                                               │            │
│  │                   導出 Excel/CSV                                        │            │
│  │                                                                        │            │
│  └────────────────────────────────────────────────────────────────────────┘            │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 新增數據模型

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              新增 Prisma 模型                                            │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  TemplateFieldMapping (第二層映射規則)                                                   │
│  ├── id: String                                                                         │
│  ├── dataTemplateId: String (關聯到 DataTemplate)                                       │
│  ├── scope: GLOBAL | COMPANY | FORMAT                                                   │
│  ├── companyId?: String                                                                 │
│  ├── documentFormatId?: String                                                          │
│  ├── name: String                                                                       │
│  ├── mappings: Json (TemplateFieldMappingRule[])                                        │
│  │       ├── sourceField: String (標準欄位名)                                           │
│  │       ├── targetField: String (模版欄位名)                                           │
│  │       ├── transformType: DIRECT | FORMULA | LOOKUP                                   │
│  │       └── transformParams?: Json                                                     │
│  ├── priority: Int                                                                      │
│  └── isActive: Boolean                                                                  │
│                                                                                         │
│  TemplateInstance (填充後的模版實例)                                                     │
│  ├── id: String                                                                         │
│  ├── dataTemplateId: String                                                             │
│  ├── name: String (如 "2026年1月海運費用")                                               │
│  ├── description?: String                                                               │
│  ├── status: DRAFT | PROCESSING | COMPLETED | EXPORTED                                  │
│  ├── rowCount: Int                                                                      │
│  ├── validRowCount: Int                                                                 │
│  ├── errorRowCount: Int                                                                 │
│  ├── rows: TemplateInstanceRow[]                                                        │
│  ├── exportedAt?: DateTime                                                              │
│  ├── exportedBy?: String                                                                │
│  └── createdBy: String                                                                  │
│                                                                                         │
│  TemplateInstanceRow (模版實例的每一行數據)                                              │
│  ├── id: String                                                                         │
│  ├── templateInstanceId: String                                                         │
│  ├── rowKey: String (如 shipment_no 或 invoice_no)                                      │
│  ├── rowIndex: Int                                                                      │
│  ├── sourceDocumentIds: String[] (來源文件 ID)                                          │
│  ├── fieldValues: Json ({ field_name: value })                                          │
│  ├── validationErrors?: Json                                                            │
│  └── status: PENDING | VALID | INVALID | SKIPPED                                        │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 三層優先級解析

```
第二層映射配置的優先級解析（與第一層相同）：

1. FORMAT 級別（最高優先）
   └── 特定文件格式的映射規則
   └── 例：DHL Air Waybill 有特殊的欄位對應

2. COMPANY 級別
   └── 特定公司的映射規則
   └── 例：DHL 所有格式共用的欄位對應

3. GLOBAL 級別（最低優先）
   └── 全局預設映射規則
   └── 例：標準欄位到 ERP 模版的預設對應
```

---

## Stories 列表

| Story ID | 名稱 | 估計工時 | 依賴 | 狀態 |
|----------|------|----------|------|------|
| 18-1 | Template Field Mapping 數據模型與服務 | 8 SP | 16-7 | draft |
| 18-2 | Template Instance 數據模型與管理服務 | 6 SP | 18-1 | draft |
| 18-3 | 模版匹配引擎服務 | 10 SP | 18-1, 18-2 | draft |
| 18-4 | Template Field Mapping 配置 UI | 8 SP | 18-1 | draft |
| 18-5 | Template Instance 管理介面 | 6 SP | 18-2, 18-3 | draft |
| 18-6 | 模版實例導出功能 | 5 SP | 18-5 | draft |
| 18-7 | 批量文件自動匹配到模版 | 8 SP | 18-3 | draft |
| 18-8 | 模版匹配整合測試與驗證 | 4 SP | 18-1~18-7 | draft |

**總計：55 Story Points**

---

## 依賴關係

```
前置條件（已完成）：
├── Epic 13: 文件預覽與欄位映射（FieldMappingConfig）
├── Epic 14: Prompt 配置
├── Epic 15: 統一處理流程
└── Epic 16: 文件格式管理（DataTemplate）

Story 依賴圖：
Story 19-1 (TemplateFieldMapping 模型)
    │
    ├──────────────────┐
    │                  │
    ▼                  ▼
Story 19-2         Story 19-4
(TemplateInstance) (Mapping UI)
    │
    ▼
Story 19-3 (匹配引擎)
    │
    ├──────────────────┬──────────────────┐
    │                  │                  │
    ▼                  ▼                  ▼
Story 19-5         Story 19-6         Story 19-7
(Instance UI)      (導出功能)         (批量匹配)
    │                  │                  │
    └──────────────────┴──────────────────┘
                       │
                       ▼
                  Story 19-8
               (整合測試)
```

---

## 技術考量

### 效能考量

1. **批量處理**：支援大量文件同時匹配到模版
2. **分頁載入**：Template Instance 的 rows 支援分頁
3. **非同步處理**：大量數據匹配使用背景任務

### 擴展性考量

1. **Transform Types**：支援 DIRECT、FORMULA、LOOKUP 三種轉換類型
2. **驗證規則**：利用 DataTemplate 的 field validation
3. **導出格式**：Excel、CSV，未來可擴展 JSON、XML

### 安全考量

1. **權限控制**：基於 City/Company 的數據隔離
2. **審計日誌**：記錄模版實例的創建、修改、導出操作

---

## 驗收標準概覽

1. ✅ 可建立和管理 Template Field Mapping 規則
2. ✅ 可將多個 Document 記錄匹配到同一個 Template Instance
3. ✅ Template Instance 正確填充所有映射欄位
4. ✅ 驗證錯誤的行正確標記並可修正
5. ✅ 可導出完整的 Template Instance 為 Excel/CSV
6. ✅ 支援自動和手動選擇目標模版
7. ✅ 三層優先級（FORMAT → COMPANY → GLOBAL）正確執行

---

## 相關文檔

- [Story 16-7: 數據模版管理](../epic-16-format-management/16-7-data-template-management.md)
- [Story 13-4: 映射配置 API](../epic-13-document-preview/13-4-mapping-config-api.md)
- [Story 13-5: 動態欄位映射整合](../epic-13-document-preview/13-5-dynamic-field-mapping-integration.md)

---

## 修訂記錄

| 版本 | 日期 | 變更內容 |
|------|------|----------|
| 1.0.0 | 2026-01-22 | 初版建立 |
