# Epic 16: 文件格式管理

**Status:** 🚧 進行中

---

## Epic 概覽

### 目標

提供文件格式的可視化管理和識別規則配置，讓用戶可以查看、編輯和配置每個公司的文件格式，並將識別規則真正整合到 AI 處理流程中。

### 問題陳述

目前系統：
1. **缺乏格式管理界面**: 無法查看/編輯已識別的格式
2. **識別規則不可配置**: 格式識別邏輯是硬編碼的
3. **專屬配置不直觀**: 無法直接為格式配置專屬的 Prompt 和映射
4. **識別規則未生效**: identificationRules 只存儲未使用
5. **欄位映射不完整**: field-mapping.step.ts 是 stub 實現
6. **目標欄位固定**: 缺乏數據模版概念定義輸出格式

### 解決方案

1. **格式列表 Tab**: 在公司詳情頁新增格式管理 Tab
2. **格式詳情頁**: 查看/編輯格式，管理識別規則
3. **配置關聯**: 直觀地關聯 Prompt 和映射配置
4. **識別規則整合**: 將規則注入 GPT Vision Prompt
5. **動態欄位映射**: 完成映射步驟，支援動態來源欄位
6. **數據模版**: 定義目標欄位結構

---

## 架構設計

### UI 入口設計

```
/companies/[id]
├─ 總覽 Tab
├─ 規則 Tab      (現有)
├─ 格式 Tab      (新增) ← 文件格式管理
├─ 統計 Tab
└─ 文件 Tab
```

### 格式詳情頁結構

```
/companies/[id]/formats/[formatId]
├─ 基本資訊 Tab    - 名稱、類型、子類型
├─ 識別規則 Tab    - Logo、關鍵字、版面特徵
├─ 常見術語 Tab    - 術語列表（可編輯）
├─ 專屬配置 Tab    - 關聯的 Prompt 和映射規則
└─ 文件列表 Tab    - 屬於此格式的文件
```

### 數據流設計

```
文件上傳
    ↓
GPT Vision 初步識別
    ↓
【識別規則匹配】 ← Story 16-5
├─ 讀取該公司的所有格式識別規則
├─ 注入到 GPT Prompt
├─ 按 priority 排序
├─ GPT 根據規則判斷格式
    ↓
├─ 如果找到高信心度匹配 → 使用該格式
├─ 如果找到低信心度匹配 → 標記需審核
└─ 如果未找到 → 使用 GPT Vision 結果創建新格式
    ↓
應用格式專屬配置
├─ PromptConfig (scope=FORMAT)
└─ FieldMappingConfig (scope=FORMAT)
    ↓
執行提取
    ↓
【欄位映射】 ← Story 16-6
├─ 讀取 FieldMappingConfig 規則
├─ 應用三層映射
├─ 輸出到 DataTemplate 定義的格式 ← Story 16-7
    ↓
返回結果
```

---

## 與其他 Epic 的關係

| Epic | 關係 | 說明 |
|------|------|------|
| **Epic 0** | 上游 | 使用 Epic 0 建立的 DocumentFormat 模型 |
| **Epic 13** | 互補 | Epic 13 處理欄位映射，Epic 16 處理格式管理 |
| **Epic 14** | 互補 | Epic 14 處理 Prompt 配置，Epic 16 提供 FORMAT 級配置關聯 |
| **Epic 15** | 下游 | Epic 15 的統一處理流程會使用 Epic 16 的識別規則 |

---

## Stories 列表

| Story ID | 標題 | 估點 | 狀態 |
|----------|------|------|------|
| 16-1 | 格式列表 Tab | 5 | ✅ 已完成 |
| 16-2 | 格式詳情與編輯 | 5 | ✅ 已完成 |
| 16-3 | 識別規則配置 | 8 | ✅ 已完成 |
| 16-4 | 專屬配置關聯 | 5 | ✅ 已完成 |
| 16-5 | 識別規則 Prompt 整合 | 5 | ✅ 已完成 |
| 16-6 | 動態欄位映射配置 | 8 | 🚧 規劃中 |
| 16-7 | 數據模版管理 | 8 | 🚧 規劃中 |

**總估點**: 44 點

---

## Story 摘要

### Story 16-1: 格式列表 Tab ✅

在公司詳情頁新增「格式」Tab，顯示該公司所有已識別的文件格式。

**關鍵產出**:
- `FormatList` 組件
- `FormatCard` 組件
- 篩選和排序功能

### Story 16-2: 格式詳情與編輯 ✅

建立格式詳情頁面，支援查看和編輯格式基本信息。

**關鍵產出**:
- `FormatDetailView` 組件
- `FormatForm` 組件
- `GET/PATCH /api/v1/formats/[id]` API

### Story 16-3: 識別規則配置 ✅

新增可配置的格式識別規則，支援 Logo、關鍵字、版面特徵。

**關鍵產出**:
- Prisma 欄位: `identificationRules`
- `IdentificationRulesEditor` 組件
- 識別邏輯整合

### Story 16-4: 專屬配置關聯 ✅

在格式頁面顯示和管理關聯的 Prompt 和映射配置。

**關鍵產出**:
- `FormatConfigPanel` 組件
- `LinkedPromptConfig` 組件
- `LinkedMappingConfig` 組件

### Story 16-5: 識別規則 Prompt 整合 🆕

將 `identificationRules` 注入到 GPT Vision Prompt，讓 AI 能夠根據配置的規則更準確地識別文件格式。

**關鍵產出**:
- `identification-rules-prompt-builder.ts` - Prompt 生成器
- 擴展 `config-fetching.step.ts` - 讀取識別規則
- 修改 `gpt-vision.service.ts` - 注入 Prompt

**驗收條件**:
- 讀取公司下所有格式的 identificationRules
- 按優先級排序，注入到 GPT Prompt
- 支援 Logo 特徵、關鍵字、版面特徵

### Story 16-6: 動態欄位映射配置 🆕

1. 動態來源欄位：從 GPT 結果 + invoice-fields.ts 合併
2. 完成 field-mapping.step.ts 的 stub 實現

**關鍵產出**:
- `source-field.service.ts` - 來源欄位服務
- `SourceFieldCombobox.tsx` - 動態來源欄位選擇器
- 完成 `field-mapping.step.ts` - 調用 DynamicMappingService

**驗收條件**:
- 來源欄位下拉顯示 90+ 標準欄位 + 提取欄位
- 支援自訂欄位名稱
- 三層映射正確執行

### Story 16-7: 數據模版管理 🆕

新增 `DataTemplate` 模型，定義目標欄位結構（如 ERP 匯入格式、報表格式）。

**關鍵產出**:
- `DataTemplate` Prisma 模型
- `/api/v1/data-templates` CRUD API
- `/admin/data-templates` 管理頁面
- `DataTemplateFieldEditor` 組件

**驗收條件**:
- 支援 GLOBAL/COMPANY 範圍
- 系統內建預設模版
- FieldMappingConfig 可關聯模版

---

## 技術重點

### 新增 Prisma 模型

```prisma
model DataTemplate {
  id              String    @id @default(cuid())
  name            String
  description     String?
  scope           ConfigScope @default(GLOBAL)
  companyId       String?   @map("company_id")
  company         Company?  @relation(fields: [companyId], references: [id])
  fields          Json      // DataTemplateField[]
  isActive        Boolean   @default(true) @map("is_active")
  isSystem        Boolean   @default(false) @map("is_system")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")
  createdBy       String?   @map("created_by")

  fieldMappingConfigs FieldMappingConfig[]

  @@map("data_templates")
}

model FieldMappingConfig {
  // ... 現有欄位
  dataTemplateId  String?   @map("data_template_id")
  dataTemplate    DataTemplate? @relation(fields: [dataTemplateId], references: [id])
}
```

### 現有 Prisma 欄位

```prisma
model DocumentFormat {
  // ... 現有欄位

  // 識別規則 (Story 16-3)
  identificationRules   Json?   @map("identification_rules")
  // 結構:
  // {
  //   logoPatterns: [{ position: "top-left", description: "DHL Logo" }],
  //   keywords: ["Ocean Freight", "B/L No", "Shipper"],
  //   layoutHints: "表格式發票，表頭包含公司資訊",
  //   priority: 100  // 識別優先級
  // }
}
```

### API 清單

| 方法 | 路徑 | 說明 | Story |
|------|------|------|-------|
| `GET` | `/api/v1/formats/[id]` | 詳情 | 16-2 |
| `PATCH` | `/api/v1/formats/[id]` | 更新 | 16-2 |
| `GET` | `/api/v1/formats/[id]/configs` | 關聯配置 | 16-4 |
| `GET` | `/api/v1/formats/[id]/extracted-fields` | 提取欄位 | 16-6 |
| `GET` | `/api/v1/data-templates` | 模版列表 | 16-7 |
| `POST` | `/api/v1/data-templates` | 創建模版 | 16-7 |
| `GET` | `/api/v1/data-templates/[id]` | 模版詳情 | 16-7 |
| `PATCH` | `/api/v1/data-templates/[id]` | 更新模版 | 16-7 |
| `DELETE` | `/api/v1/data-templates/[id]` | 刪除模版 | 16-7 |

### 組件結構

```
src/components/features/formats/
├── FormatList.tsx                    # 格式列表 (16-1)
├── FormatCard.tsx                    # 格式卡片 (16-1)
├── FormatDetailView.tsx              # 格式詳情視圖 (16-2)
├── FormatForm.tsx                    # 格式表單 (16-2)
├── FormatBasicInfo.tsx               # 基本資訊 Tab (16-2)
├── FormatTermsTable.tsx              # 常見術語表格 (16-2)
├── IdentificationRulesEditor.tsx     # 識別規則編輯器 (16-3)
├── FormatConfigPanel.tsx             # 專屬配置面板 (16-4)
├── LinkedPromptConfig.tsx            # 關聯的 Prompt 配置 (16-4)
├── LinkedMappingConfig.tsx           # 關聯的映射配置 (16-4)
└── FormatFilesTable.tsx              # 文件列表表格 (16-2)

src/components/features/field-mapping/
├── SourceFieldCombobox.tsx           # 來源欄位選擇器 (16-6)
└── FieldMappingRuleForm.tsx          # 映射規則表單 (修改)

src/components/features/data-template/
├── DataTemplateList.tsx              # 模版列表 (16-7)
├── DataTemplateForm.tsx              # 模版表單 (16-7)
└── DataTemplateFieldEditor.tsx       # 欄位定義編輯器 (16-7)
```

---

## 驗收標準

### 功能驗收
- [x] `/companies/[id]` 頁面有「格式」Tab
- [x] 能查看公司的所有格式
- [x] 能編輯格式名稱
- [x] 能配置識別規則
- [x] 能查看關聯的配置
- [x] 識別規則影響 GPT 格式識別（Story 16-5）
- [ ] 欄位映射正確執行
- [ ] 能創建和管理數據模版

### 技術驗收
- [x] 所有 API 返回正確的響應格式
- [x] 識別規則注入 GPT Prompt（Story 16-5）
- [ ] field-mapping.step.ts 不再是 stub
- [ ] DataTemplate 模型正確運作
- [x] 組件通過 TypeScript 類型檢查
- [x] 通過 ESLint 檢查

---

## 執行順序建議

```
1. Story 16-7 (DataTemplate)
   └─ 因為 Story 16-6 的目標欄位需要模版支援

2. Story 16-6 (動態欄位映射)
   └─ 完成 field-mapping.step.ts 和動態來源欄位

3. Story 16-5 (識別規則 Prompt)
   └─ 獨立功能，可最後實現
```

---

**建立日期**: 2026-01-12
**最後更新**: 2026-01-13
**狀態**: 進行中
