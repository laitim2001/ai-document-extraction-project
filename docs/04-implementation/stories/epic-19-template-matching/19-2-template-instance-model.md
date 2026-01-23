# Story 19.2: Template Instance 數據模型與管理服務

**Status:** draft

---

## Story

**As a** 用戶,
**I want** 系統能存儲填充後的數據模版實例,
**So that** 我可以管理、查看和導出匹配後的結構化數據。

---

## 背景說明

### 問題陳述

當多個 Document 記錄的數據被匹配到同一個 DataTemplate 時，需要一個實體來存儲這些「填充後的模版數據」。這個實體就是 TemplateInstance。

### 數據結構設計

```
DataTemplate (模版定義)         TemplateInstance (填充後的實例)
├── id                         ├── id
├── name: "海運費用報表"        ├── dataTemplateId → DataTemplate
├── fields: [                  ├── name: "2026年1月海運費用"
│   { name: 'shipment_no' },   ├── status: COMPLETED
│   { name: 'shipping_cost' }, ├── rowCount: 150
│   { name: 'port_fees' }      ├── rows: [
│ ]                            │   ├── Row 1: { shipment_no: 'S001', shipping_cost: 500, port_fees: 100 }
│                              │   ├── Row 2: { shipment_no: 'S002', shipping_cost: 450, port_fees: 120 }
│                              │   └── Row 3: { shipment_no: 'S003', shipping_cost: 480, port_fees: 110 }
│                              │ ]
```

### 核心概念

- **TemplateInstance**：填充後的模版實例，包含元數據和狀態
- **TemplateInstanceRow**：實例中的每一行數據，以 shipment_no 或 invoice_no 為主鍵
- **來源追蹤**：每行數據記錄來源 Document IDs，支持多對一（多個文件合併為一行）

---

## Acceptance Criteria

### AC1: TemplateInstance 模型

**Given** Prisma Schema
**When** 執行遷移
**Then** 正確建立 TemplateInstance 和 TemplateInstanceRow 表

### AC2: 實例狀態管理

**Given** TemplateInstance
**When** 處理流程執行
**Then** 狀態正確轉換：DRAFT → PROCESSING → COMPLETED | ERROR

### AC3: 行數據驗證

**Given** TemplateInstanceRow
**When** 填入數據
**Then**:
  - 根據 DataTemplate.fields 驗證必填欄位
  - 驗證數據類型
  - 記錄驗證錯誤

### AC4: CRUD API

**Given** /api/v1/template-instances
**When** 執行 CRUD 操作
**Then**:
  - GET: 列表支援篩選（dataTemplateId, status, dateRange）
  - POST: 創建新實例
  - GET /:id: 取得實例詳情（含分頁的 rows）
  - PATCH: 更新實例元數據
  - DELETE: 軟刪除實例

### AC5: 行數據管理 API

**Given** /api/v1/template-instances/:id/rows
**When** 執行行操作
**Then**:
  - GET: 分頁取得行數據
  - POST: 新增行
  - PATCH /:rowId: 更新行數據
  - DELETE /:rowId: 刪除行

### AC6: 統計數據

**Given** TemplateInstance
**When** 行數據變更
**Then** 自動更新 rowCount、validRowCount、errorRowCount

---

## Tasks / Subtasks

- [ ] **Task 1: Prisma Schema** (AC: #1, #2)
  - [ ] 1.1 新增 TemplateInstance 模型
  - [ ] 1.2 新增 TemplateInstanceRow 模型
  - [ ] 1.3 定義 TemplateInstanceStatus 枚舉
  - [ ] 1.4 定義 TemplateInstanceRowStatus 枚舉
  - [ ] 1.5 執行資料庫遷移

- [ ] **Task 2: 類型定義** (AC: #1, #2, #3)
  - [ ] 2.1 新增 `template-instance.ts` 類型
  - [ ] 2.2 定義 TemplateInstance 和 TemplateInstanceRow 介面
  - [ ] 2.3 定義 ValidationError 結構
  - [ ] 2.4 定義 API 請求/響應類型

- [ ] **Task 3: Zod 驗證** (AC: #4, #5)
  - [ ] 3.1 新增 `template-instance.ts` 驗證 Schema
  - [ ] 3.2 實現創建/更新驗證
  - [ ] 3.3 實現行數據驗證

- [ ] **Task 4: 服務層** (AC: #3, #4, #5, #6)
  - [ ] 4.1 新增 `template-instance.service.ts`
  - [ ] 4.2 實現 list/getById/create/update/delete
  - [ ] 4.3 實現 addRow/updateRow/deleteRow
  - [ ] 4.4 實現 validateRow（根據 DataTemplate 驗證）
  - [ ] 4.5 實現 updateStatistics（更新統計數據）
  - [ ] 4.6 實現 changeStatus（狀態轉換）

- [ ] **Task 5: API 端點** (AC: #4, #5)
  - [ ] 5.1 新增 `/api/v1/template-instances/route.ts`
  - [ ] 5.2 新增 `/api/v1/template-instances/[id]/route.ts`
  - [ ] 5.3 新增 `/api/v1/template-instances/[id]/rows/route.ts`
  - [ ] 5.4 新增 `/api/v1/template-instances/[id]/rows/[rowId]/route.ts`

- [ ] **Task 6: React Hooks**
  - [ ] 6.1 新增 `use-template-instances.ts`
  - [ ] 6.2 實現 useTemplateInstances (列表)
  - [ ] 6.3 實現 useTemplateInstance (詳情)
  - [ ] 6.4 實現 useTemplateInstanceRows (行數據)
  - [ ] 6.5 實現 mutations

---

## Dev Notes

### 依賴項

- **Story 19-1**: TemplateFieldMapping（用於映射規則）
- **Story 16-7**: DataTemplate（模版定義）

### 新增文件

```
prisma/
└── schema.prisma                        # 更新

src/
├── types/
│   └── template-instance.ts             # 新增
├── validations/
│   └── template-instance.ts             # 新增
├── services/
│   └── template-instance.service.ts     # 新增
├── hooks/
│   └── use-template-instances.ts        # 新增
└── app/api/v1/template-instances/
    ├── route.ts                         # 新增
    ├── [id]/
    │   ├── route.ts                     # 新增
    │   └── rows/
    │       ├── route.ts                 # 新增
    │       └── [rowId]/route.ts         # 新增
```

### Prisma Schema 設計

```prisma
enum TemplateInstanceStatus {
  DRAFT       // 草稿，可編輯
  PROCESSING  // 處理中
  COMPLETED   // 完成，數據已填充
  EXPORTED    // 已導出
  ERROR       // 錯誤
}

enum TemplateInstanceRowStatus {
  PENDING     // 待驗證
  VALID       // 驗證通過
  INVALID     // 驗證失敗
  SKIPPED     // 跳過
}

model TemplateInstance {
  id                String    @id @default(cuid())

  // 關聯到數據模版
  dataTemplateId    String    @map("data_template_id")
  dataTemplate      DataTemplate @relation(fields: [dataTemplateId], references: [id])

  // 基本資訊
  name              String
  description       String?

  // 狀態
  status            TemplateInstanceStatus @default(DRAFT)

  // 統計
  rowCount          Int       @default(0) @map("row_count")
  validRowCount     Int       @default(0) @map("valid_row_count")
  errorRowCount     Int       @default(0) @map("error_row_count")

  // 行數據
  rows              TemplateInstanceRow[]

  // 導出記錄
  exportedAt        DateTime? @map("exported_at")
  exportedBy        String?   @map("exported_by")
  exportFormat      String?   @map("export_format")

  // 時間戳
  createdAt         DateTime  @default(now()) @map("created_at")
  updatedAt         DateTime  @updatedAt @map("updated_at")
  createdBy         String?   @map("created_by")

  @@index([dataTemplateId])
  @@index([status])
  @@index([createdAt])
  @@map("template_instances")
}

model TemplateInstanceRow {
  id                    String    @id @default(cuid())

  // 關聯到實例
  templateInstanceId    String    @map("template_instance_id")
  templateInstance      TemplateInstance @relation(fields: [templateInstanceId], references: [id], onDelete: Cascade)

  // 行標識
  rowKey                String    @map("row_key")    // 如 shipment_no 或 invoice_no
  rowIndex              Int       @map("row_index")

  // 來源文件（多對一支持）
  sourceDocumentIds     String[]  @map("source_document_ids")

  // 欄位值 (JSON)
  fieldValues           Json      @map("field_values")  // { field_name: value }

  // 驗證
  validationErrors      Json?     @map("validation_errors")  // { field_name: error_message }
  status                TemplateInstanceRowStatus @default(PENDING)

  // 時間戳
  createdAt             DateTime  @default(now()) @map("created_at")
  updatedAt             DateTime  @updatedAt @map("updated_at")

  @@unique([templateInstanceId, rowKey])
  @@index([templateInstanceId])
  @@index([status])
  @@map("template_instance_rows")
}
```

### 行驗證邏輯

```typescript
async validateRow(
  row: TemplateInstanceRow,
  templateFields: DataTemplateField[]
): Promise<ValidationResult> {
  const errors: Record<string, string> = {};
  const fieldValues = row.fieldValues as Record<string, unknown>;

  for (const field of templateFields) {
    const value = fieldValues[field.name];

    // 1. 必填檢查
    if (field.isRequired && (value === undefined || value === null || value === '')) {
      errors[field.name] = '此欄位為必填';
      continue;
    }

    // 2. 類型檢查
    if (value !== undefined && value !== null) {
      const typeError = this.validateType(value, field.dataType);
      if (typeError) {
        errors[field.name] = typeError;
        continue;
      }

      // 3. 驗證規則檢查
      if (field.validation) {
        const validationError = this.validateRules(value, field.validation);
        if (validationError) {
          errors[field.name] = validationError;
        }
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  };
}
```

### 狀態轉換規則

```
DRAFT ──┬──► PROCESSING ──┬──► COMPLETED ──► EXPORTED
        │                 │
        │                 └──► ERROR
        │
        └──► DELETE (只有 DRAFT 可刪除)

狀態轉換方法：
- startProcessing(): DRAFT → PROCESSING
- completeProcessing(): PROCESSING → COMPLETED
- markError(message): PROCESSING → ERROR
- markExported(format): COMPLETED → EXPORTED
```

---

## Implementation Notes

（開發完成後填寫）

---

## Related Files

- `prisma/schema.prisma` - 更新
- `src/types/template-instance.ts` - 新增
- `src/validations/template-instance.ts` - 新增
- `src/services/template-instance.service.ts` - 新增
- `src/hooks/use-template-instances.ts` - 新增
- `src/app/api/v1/template-instances/` - 新增
