# Story 19.1: Template Field Mapping 數據模型與服務

**Status:** draft

---

## Story

**As a** 系統管理員,
**I want** 建立第二層映射規則（標準欄位 → 數據模版欄位）,
**So that** 提取的標準化數據可以正確填入用戶定義的數據模版中。

---

## 背景說明

### 問題陳述

目前的 FieldMappingConfig（第一層映射）已將不同公司/格式的術語統一為標準欄位名，但缺少「第二層映射」將這些標準欄位對應到 DataTemplate 中定義的模版欄位。

### 雙層映射架構

```
第一層（已實現）：
  不同公司術語 → 標準欄位名
  例：oceanFrt (DHL) → sea_freight (標準)
      seaFreight (Maersk) → sea_freight (標準)

第二層（本 Story）：
  標準欄位名 → 模版欄位名
  例：sea_freight (標準) → shipping_cost (模版 A)
      sea_freight (標準) → freight_total (模版 B)
```

### 為什麼需要兩層

- **降低維護成本**：10 間公司 × 3 個模版 ≠ 30 組映射
- **第一層**：10 間公司 = 10 組映射（與模版數量無關）
- **第二層**：3 個模版 = 3 組映射（與公司數量無關）
- **新增公司**：只需配置第一層
- **新增模版**：只需配置第二層

---

## Acceptance Criteria

### AC1: TemplateFieldMapping 模型

**Given** Prisma Schema
**When** 執行遷移
**Then** 正確建立 TemplateFieldMapping 表和關聯

### AC2: 三層優先級支援

**Given** 多個不同 scope 的 TemplateFieldMapping 配置
**When** 解析映射規則
**Then** 按 FORMAT → COMPANY → GLOBAL 優先級正確解析

### AC3: 映射規則結構

**Given** TemplateFieldMapping 的 mappings 欄位
**When** 定義映射規則
**Then** 支援以下結構：
  - sourceField：標準欄位名
  - targetField：模版欄位名
  - transformType：DIRECT | FORMULA | LOOKUP
  - transformParams：轉換參數（可選）

### AC4: CRUD API

**Given** /api/v1/template-field-mappings
**When** 執行 CRUD 操作
**Then**:
  - GET: 列表支援篩選（dataTemplateId, scope, companyId）
  - POST: 創建新映射配置
  - PATCH: 更新映射配置
  - DELETE: 軟刪除映射配置

### AC5: 配置解析服務

**Given** TemplateFieldMappingService
**When** 調用 resolveMapping(dataTemplateId, companyId?, formatId?)
**Then** 返回合併後的映射規則列表

### AC6: 預設映射配置

**Given** 系統初始化
**When** 執行 seed
**Then** 為預設 DataTemplate 建立 GLOBAL 級別的預設映射

---

## Tasks / Subtasks

- [ ] **Task 1: Prisma Schema** (AC: #1, #2)
  - [ ] 1.1 新增 TemplateFieldMapping 模型
  - [ ] 1.2 定義 TemplateFieldMappingScope 枚舉
  - [ ] 1.3 建立與 DataTemplate、Company、DocumentFormat 的關聯
  - [ ] 1.4 執行資料庫遷移

- [ ] **Task 2: 類型定義** (AC: #3)
  - [ ] 2.1 新增 `template-field-mapping.ts` 類型
  - [ ] 2.2 定義 TemplateFieldMappingRule 結構
  - [ ] 2.3 定義 TransformType 枚舉和參數類型
  - [ ] 2.4 定義 API 請求/響應類型

- [ ] **Task 3: Zod 驗證** (AC: #4)
  - [ ] 3.1 新增 `template-field-mapping.ts` 驗證 Schema
  - [ ] 3.2 實現創建/更新驗證
  - [ ] 3.3 實現映射規則驗證

- [ ] **Task 4: 服務層** (AC: #4, #5)
  - [ ] 4.1 新增 `template-field-mapping.service.ts`
  - [ ] 4.2 實現 list/getById/create/update/delete
  - [ ] 4.3 實現 resolveMapping（三層優先級解析）
  - [ ] 4.4 實現配置快取機制

- [ ] **Task 5: API 端點** (AC: #4)
  - [ ] 5.1 新增 `/api/v1/template-field-mappings/route.ts`
  - [ ] 5.2 新增 `/api/v1/template-field-mappings/[id]/route.ts`
  - [ ] 5.3 新增 `/api/v1/template-field-mappings/resolve/route.ts`

- [ ] **Task 6: Seed Data** (AC: #6)
  - [ ] 6.1 為 ERP 標準模版建立預設映射
  - [ ] 6.2 為費用報表模版建立預設映射
  - [ ] 6.3 為物流追蹤模版建立預設映射

- [ ] **Task 7: 單元測試**
  - [ ] 7.1 三層優先級解析測試
  - [ ] 7.2 映射規則驗證測試
  - [ ] 7.3 Transform 轉換測試

---

## Dev Notes

### 依賴項

- **Story 16-7**: DataTemplate 模型（必須先完成）
- **Story 13-4**: FieldMappingConfig（參考架構設計）

### 新增文件

```
prisma/
├── schema.prisma                         # 更新：新增 TemplateFieldMapping
└── seed/
    └── template-field-mappings.ts        # 新增

src/
├── types/
│   └── template-field-mapping.ts         # 新增
├── validations/
│   └── template-field-mapping.ts         # 新增
├── services/
│   └── template-field-mapping.service.ts # 新增
└── app/api/v1/template-field-mappings/
    ├── route.ts                          # 新增
    ├── [id]/route.ts                     # 新增
    └── resolve/route.ts                  # 新增
```

### Prisma Schema 設計

```prisma
enum TemplateFieldMappingScope {
  GLOBAL
  COMPANY
  FORMAT
}

enum FieldTransformType {
  DIRECT     // 直接映射
  FORMULA    // 公式計算
  LOOKUP     // 查表映射
}

model TemplateFieldMapping {
  id                String    @id @default(cuid())

  // 關聯到數據模版
  dataTemplateId    String    @map("data_template_id")
  dataTemplate      DataTemplate @relation(fields: [dataTemplateId], references: [id])

  // 範圍和優先級
  scope             TemplateFieldMappingScope @default(GLOBAL)
  companyId         String?   @map("company_id")
  company           Company?  @relation(fields: [companyId], references: [id])
  documentFormatId  String?   @map("document_format_id")
  documentFormat    DocumentFormat? @relation(fields: [documentFormatId], references: [id])

  // 配置內容
  name              String
  description       String?
  mappings          Json      // TemplateFieldMappingRule[]

  // 狀態
  priority          Int       @default(0)
  isActive          Boolean   @default(true) @map("is_active")

  // 時間戳
  createdAt         DateTime  @default(now()) @map("created_at")
  updatedAt         DateTime  @updatedAt @map("updated_at")
  createdBy         String?   @map("created_by")

  @@unique([dataTemplateId, scope, companyId, documentFormatId])
  @@index([dataTemplateId])
  @@index([scope])
  @@index([companyId])
  @@index([documentFormatId])
  @@map("template_field_mappings")
}
```

### 映射規則結構

```typescript
interface TemplateFieldMappingRule {
  sourceField: string;           // 標準欄位名（如 sea_freight）
  targetField: string;           // 模版欄位名（如 shipping_cost）
  transformType: FieldTransformType;
  transformParams?: {
    // FORMULA 類型
    formula?: string;            // 如 "{value} * 1.1"

    // LOOKUP 類型
    lookupTable?: Record<string, unknown>;
    defaultValue?: unknown;
  };
  isRequired: boolean;           // 目標欄位是否必填
  order: number;                 // 處理順序
}
```

### 三層優先級解析邏輯

```typescript
async resolveMapping(
  dataTemplateId: string,
  companyId?: string,
  formatId?: string
): Promise<ResolvedMappingConfig> {
  // 1. 查詢所有相關配置
  const configs = await this.findRelevantConfigs(dataTemplateId, companyId, formatId);

  // 2. 按優先級排序：FORMAT > COMPANY > GLOBAL
  const sorted = this.sortByPriority(configs);

  // 3. 合併映射規則（高優先級覆蓋低優先級）
  const mergedMappings = this.mergeMappings(sorted);

  return {
    dataTemplateId,
    resolvedFrom: sorted.map(c => ({ id: c.id, scope: c.scope })),
    mappings: mergedMappings,
  };
}
```

### 預設映射範例

```typescript
// ERP 標準模版的預設映射
{
  dataTemplateId: 'erp-standard-import',
  scope: 'GLOBAL',
  name: 'ERP 標準欄位映射',
  mappings: [
    { sourceField: 'invoice_number', targetField: 'invoice_number', transformType: 'DIRECT', isRequired: true, order: 1 },
    { sourceField: 'invoice_date', targetField: 'invoice_date', transformType: 'DIRECT', isRequired: true, order: 2 },
    { sourceField: 'vendor_name', targetField: 'vendor_name', transformType: 'DIRECT', isRequired: true, order: 3 },
    { sourceField: 'sea_freight', targetField: 'subtotal', transformType: 'FORMULA', transformParams: { formula: '{sea_freight} + {terminal_handling}' }, isRequired: false, order: 4 },
    { sourceField: 'total_amount', targetField: 'total_amount', transformType: 'DIRECT', isRequired: true, order: 5 },
  ]
}
```

---

## Implementation Notes

（開發完成後填寫）

---

## Related Files

- `prisma/schema.prisma` - 更新
- `src/types/template-field-mapping.ts` - 新增
- `src/validations/template-field-mapping.ts` - 新增
- `src/services/template-field-mapping.service.ts` - 新增
- `src/app/api/v1/template-field-mappings/` - 新增
