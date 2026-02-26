# CHANGE-051: Extracted Fields 顯示重構 -- 來源標籤 i18n 化 + Line Items 支援

> **日期**: 2026-02-26
> **狀態**: 📋 規劃中
> **優先級**: High
> **類型**: Enhancement / Refactor
> **影響範圍**: 文件詳情頁 Extracted Fields Tab（API 端 + 前端組件 + i18n）
> **前置條件**: 無
> **觸發事件**: Extracted Fields 面板存在 3 個問題 -- 來源標籤硬編碼、Line Items 不顯示、無分節結構

---

## 變更背景

### 現況分析

文件詳情頁的「提取欄位 (Extracted Fields)」Tab 存在以下 3 個問題：

#### 問題 1: 來源標籤硬編碼（違反 i18n 規範）

**位置**: `src/types/extracted-field.ts` 第 26-31 行

```typescript
export const FIELD_SOURCE_LABELS: Record<FieldSource, string> = {
  AZURE_DI: 'Azure DI',       // 硬編碼英文
  GPT_VISION: 'GPT Vision',   // 硬編碼英文
  MANUAL: '手動輸入',           // 硬編碼中文
  MAPPING: '映射規則',          // 硬編碼中文
};
```

**問題**: `FIELD_SOURCE_LABELS` 混合了中英文硬編碼字串，被 `FieldCard.tsx` 第 207 行直接引用：

```typescript
{FIELD_SOURCE_LABELS[field.source]}
```

然而，`FieldFilters.tsx` 的來源過濾器**已經正確使用 i18n**（`documentPreview.json` 的 `filters.source.*`），造成同一頁面中標籤顯示不一致。

#### 問題 2: Line Items 不顯示

**位置**: `src/app/api/documents/[id]/route.ts` 第 71-113 行

API 的 `mapFieldMappingsToExtractedFields()` 函數只從 `ExtractionResult.fieldMappings`（JSON 欄位）轉換 header fields，**完全忽略**了 `ExtractionResult.stage3Result` 中的 `lineItems` 資料。

`stage3Result` 的結構（定義於 `src/types/extraction-v3.types.ts` 第 1203-1246 行 `Stage3ExtractionResult`）：

```typescript
interface Stage3ExtractionResult {
  standardFields: StandardFieldsV3;
  fields?: Record<string, FieldValue>;
  lineItems: LineItemV3[];        // <-- 行項目，目前 API 未提取
  extraCharges?: ExtraChargeV3[]; // <-- 已 deprecated
  // ...
}
```

`LineItemV3` 結構（第 268-283 行）：

```typescript
interface LineItemV3 {
  description: string;
  classifiedAs?: string;
  quantity?: number;
  unitPrice?: number;
  amount: number;
  confidence: number;
  needsClassification?: boolean;
}
```

目前 API 只查詢 `stage3Result` 用於 `stageDetails` 和 `aiDetails`（第 180 行），而在組裝 `extractedFields` 回應時（第 210-220 行），只處理 `fieldMappings`，不處理 `stage3Result.lineItems`。

#### 問題 3: 無分節結構

**位置**: `src/components/features/document-preview/ExtractedFieldsPanel.tsx`

`ExtractedFieldsPanelProps.fields` 只接受扁平的 `ExtractedField[]` 陣列。即使 API 端返回了 line items 資料，前端面板也無法區分「Header Fields（表頭欄位）」和「Line Items（行項目）」，導致兩者混在一起或 line items 無法以表格形式呈現。

### 資料庫結構

`ExtractionResult` model（`prisma/schema.prisma` 第 556-596 行）中相關欄位：

| 欄位 | 說明 |
|------|------|
| `fieldMappings` (Json) | 提取的 header fields（key-value 結構） |
| `stage3Result` (Json) | V3.1 Stage 3 完整結果，內含 `lineItems[]` |

---

## 變更內容

### Step 1: 將 FIELD_SOURCE_LABELS 改為使用 i18n

**目標**: 移除 `extracted-field.ts` 中的硬編碼標籤，改由 `FieldCard.tsx` 使用 `useTranslations()` 動態取得翻譯。

#### 1a: 修改 `src/types/extracted-field.ts`

移除 `FIELD_SOURCE_LABELS` 常量（第 26-31 行）。由於此常量可能在其他位置被引用，改為標記 `@deprecated` 並保留空殼（避免破壞性變更），同時新增 i18n key 映射常量：

```typescript
/**
 * 來源顯示標籤
 * @deprecated 使用 i18n key 代替。請參考 FIELD_SOURCE_I18N_KEYS
 */
export const FIELD_SOURCE_LABELS: Record<FieldSource, string> = {
  AZURE_DI: 'Azure DI',
  GPT_VISION: 'GPT Vision',
  MANUAL: 'Manual',
  MAPPING: 'Mapping',
};

/**
 * 來源 i18n key 映射
 * @description 將 FieldSource 映射到 documentPreview.json 的 i18n key
 * @since CHANGE-051
 */
export const FIELD_SOURCE_I18N_KEYS: Record<FieldSource, string> = {
  AZURE_DI: 'fieldCard.source.azureDi',
  GPT_VISION: 'fieldCard.source.gptVision',
  MANUAL: 'fieldCard.source.manual',
  MAPPING: 'fieldCard.source.mapping',
};
```

#### 1b: 修改 `src/components/features/document-preview/FieldCard.tsx`

將第 207 行的 `{FIELD_SOURCE_LABELS[field.source]}` 改為使用 `useTranslations`：

```typescript
import { useTranslations } from 'next-intl'
import { FIELD_SOURCE_I18N_KEYS } from '@/types/extracted-field'

export function FieldCard({ field, ... }: FieldCardProps) {
  const t = useTranslations('documentPreview')

  // ... 在 render 中：
  <span className={cn('rounded px-2 py-0.5 text-xs', getSourceStyles(field.source))}>
    {t(FIELD_SOURCE_I18N_KEYS[field.source])}
  </span>
}
```

#### 1c: 更新 `messages/{en,zh-TW,zh-CN}/documentPreview.json`

在三個語言文件中新增 `fieldCard.source` 區塊：

**en:**
```json
{
  "fieldCard": {
    "source": {
      "azureDi": "Azure DI",
      "gptVision": "GPT Vision",
      "manual": "Manual",
      "mapping": "Mapping Rule"
    }
  }
}
```

**zh-TW:**
```json
{
  "fieldCard": {
    "source": {
      "azureDi": "Azure DI",
      "gptVision": "GPT Vision",
      "manual": "手動輸入",
      "mapping": "映射規則"
    }
  }
}
```

**zh-CN:**
```json
{
  "fieldCard": {
    "source": {
      "azureDi": "Azure DI",
      "gptVision": "GPT Vision",
      "manual": "手动输入",
      "mapping": "映射规则"
    }
  }
}
```

---

### Step 2: API 端新增 Line Items 提取

**目標**: 修改 `documents/[id]/route.ts`，從 `stage3Result` 中提取 `lineItems` 並返回給前端。

#### 2a: 修改 Prisma 查詢

在 `extractionResult` 的 `select` 中，當 `includes.has('extractedFields')` 時也查詢 `stage3Result`：

```typescript
// 第 157-189 行，新增條件
extractionResult: {
  select: {
    // ... 現有欄位
    fieldMappings: includes.has('extractedFields'),
    // CHANGE-051: 查詢 stage3Result 以取得 lineItems
    stage3Result: includes.has('extractedFields') || includes.has('stageDetails') || includes.has('aiDetails'),
    // ... 其他欄位
  },
},
```

#### 2b: 提取 lineItems 並組裝回應

在第 210-220 行（轉換 extractedFields）之後新增 lineItems 提取邏輯：

```typescript
// CHANGE-051: 提取 lineItems
let lineItems: LineItemV3[] | undefined
if (includes.has('extractedFields') && document.extractionResult?.stage3Result) {
  try {
    const stage3 = document.extractionResult.stage3Result as Record<string, unknown>
    const rawLineItems = stage3.lineItems as LineItemV3[] | undefined
    lineItems = Array.isArray(rawLineItems) ? rawLineItems : []
  } catch (err) {
    console.error(`[Document Detail] Failed to parse lineItems for ${id}:`, err)
    lineItems = []
  }
}
```

在回應物件中新增 `lineItems` 欄位：

```typescript
const responseData = {
  // ... 現有欄位
  ...(includes.has('extractedFields') && { extractedFields: extractedFields ?? [] }),
  // CHANGE-051: 新增 lineItems
  ...(includes.has('extractedFields') && { lineItems: lineItems ?? [] }),
}
```

#### 2c: 新增 import

在 route.ts 頂部新增：

```typescript
import type { LineItemV3 } from '@/types/extraction-v3.types'
```

---

### Step 3: 新增 LineItemsTable 組件

**目標**: 建立一個支援動態欄位的行項目表格組件。

#### 3a: 新增 `src/components/features/document-preview/LineItemsTable.tsx`

**設計原則**：
- 支援動態欄位（不同文件格式的 line items 欄位不同）
- 自動從 `LineItemV3[]` 中推斷可用欄位
- 使用 shadcn/ui 的 `Table` 組件
- 信心度和分類狀態以視覺化方式呈現
- 支援 i18n

```typescript
/**
 * @fileoverview Line Items 表格組件
 * @module src/components/features/document-preview
 * @since CHANGE-051
 * @lastModified 2026-02-26
 */

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { LineItemV3 } from '@/types/extraction-v3.types'

export interface LineItemsTableProps {
  /** 行項目列表 */
  lineItems: LineItemV3[]
  /** 自定義 CSS 類名 */
  className?: string
}

/**
 * 從 lineItems 中推斷可用的動態欄位
 */
function inferColumns(lineItems: LineItemV3[]): string[] {
  // 固定欄位順序
  const fixedColumns = ['description', 'classifiedAs', 'quantity', 'unitPrice', 'amount', 'confidence']
  // 檢查哪些欄位有值
  const availableColumns = fixedColumns.filter((col) =>
    lineItems.some((item) => {
      const value = item[col as keyof LineItemV3]
      return value !== undefined && value !== null
    })
  )
  return availableColumns
}

export function LineItemsTable({ lineItems, className }: LineItemsTableProps) {
  const t = useTranslations('documentPreview')

  const columns = React.useMemo(() => inferColumns(lineItems), [lineItems])

  if (lineItems.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-500">
        <p>{t('lineItems.empty')}</p>
      </div>
    )
  }

  return (
    <div className={cn('overflow-auto', className)}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            {columns.map((col) => (
              <TableHead key={col}>
                {t(`lineItems.columns.${col}`)}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {lineItems.map((item, index) => (
            <TableRow key={index}>
              <TableCell className="font-mono text-xs text-gray-500">
                {index + 1}
              </TableCell>
              {columns.map((col) => (
                <TableCell key={col}>
                  {renderCellValue(col, item, t)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
```

`renderCellValue` 函數根據欄位名稱渲染不同的顯示格式：
- `amount` / `unitPrice`: 數字格式化
- `confidence`: 信心度百分比 + 顏色編碼
- `classifiedAs`: 帶 badge 的分類標籤，`needsClassification=true` 時顯示警告
- 其他: 直接顯示值

---

### Step 4: 重構 ExtractedFieldsPanel（分為 Header Fields 區和 Line Items 區）

**目標**: 在 `ExtractedFieldsPanel` 中支援分節顯示，Header Fields 保持現有卡片式佈局，新增 Line Items 區使用表格佈局。

#### 4a: 擴展 ExtractedFieldsPanelProps

```typescript
export interface ExtractedFieldsPanelProps {
  /** Header 欄位列表 */
  fields: ExtractedField[]
  /** CHANGE-051: 行項目列表 */
  lineItems?: LineItemV3[]
  /** 欄位類別定義 */
  categories?: FieldCategory[]
  /** 選中的欄位 ID */
  selectedFieldId: string | null
  /** 欄位選中回調 */
  onFieldSelect: (fieldId: string) => void
  /** 欄位編輯回調 */
  onFieldEdit: (fieldId: string, newValue: string) => void
  /** 自定義 CSS 類名 */
  className?: string
  /** 是否顯示過濾器 */
  showFilters?: boolean
  /** 是否顯示統計資訊 */
  showStats?: boolean
}
```

#### 4b: 修改 render 邏輯

在現有的 header fields 區塊之後，新增 Line Items 區：

```tsx
{/* 現有：Header Fields 區（卡片佈局） */}
<div className="flex-1 overflow-auto p-4">
  {/* ... 現有的 groupedFields 渲染邏輯 ... */}
</div>

{/* CHANGE-051: Line Items 區（表格佈局） */}
{lineItems && lineItems.length > 0 && (
  <div className="border-t p-4">
    <h3 className="mb-3 flex items-center font-semibold text-gray-900">
      <span>{t('lineItems.title')}</span>
      <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-xs font-normal text-gray-500">
        {lineItems.length}
      </span>
    </h3>
    <LineItemsTable lineItems={lineItems} />
  </div>
)}
```

---

### Step 5: 更新 DocumentDetailTabs（傳遞 lineItems 數據）

**目標**: 修改 `DocumentDetailTabs` 和 `useDocumentDetail` 以支援 lineItems 數據流。

#### 5a: 更新 `src/hooks/use-document-detail.ts`

在 `DocumentDetail` interface 中新增 `lineItems` 欄位：

```typescript
interface DocumentDetail {
  // ... 現有欄位
  extractedFields: ExtractedField[] | null
  /** CHANGE-051: 行項目列表 */
  lineItems?: LineItemV3[] | null
  processingSteps: ProcessingStep[] | null
  // ...
}
```

新增 import：

```typescript
import type { LineItemV3 } from '@/types/extraction-v3.types'
```

#### 5b: 更新 `src/components/features/document/detail/DocumentDetailTabs.tsx`

在 `DocumentData` interface 中新增 `lineItems`：

```typescript
interface DocumentData {
  // ... 現有欄位
  extractedFields?: ExtractedField[] | null
  /** CHANGE-051: 行項目列表 */
  lineItems?: LineItemV3[] | null
  // ...
}
```

在「提取欄位 Tab」中傳遞 `lineItems` 給 `ExtractedFieldsPanel`：

```tsx
<ExtractedFieldsPanel
  fields={document.extractedFields}
  lineItems={document.lineItems}  // CHANGE-051
  selectedFieldId={selectedFieldId}
  onFieldSelect={handleFieldSelect}
  onFieldEdit={handleFieldEdit}
/>
```

---

### Step 6: 更新 i18n（documentPreview 命名空間新增 Line Items 相關翻譯）

**目標**: 在 `documentPreview` 命名空間中新增 Line Items 相關翻譯 key。

#### 6a: `messages/en/documentPreview.json`

```json
{
  "fieldCard": {
    "source": {
      "azureDi": "Azure DI",
      "gptVision": "GPT Vision",
      "manual": "Manual",
      "mapping": "Mapping Rule"
    }
  },
  "lineItems": {
    "title": "Line Items",
    "empty": "No line items extracted",
    "columns": {
      "description": "Description",
      "classifiedAs": "Classification",
      "quantity": "Qty",
      "unitPrice": "Unit Price",
      "amount": "Amount",
      "confidence": "Confidence"
    },
    "needsClassification": "Needs classification",
    "stats": {
      "total": "{count} line items",
      "needsReview": "{count} needs review"
    }
  }
}
```

#### 6b: `messages/zh-TW/documentPreview.json`

```json
{
  "fieldCard": {
    "source": {
      "azureDi": "Azure DI",
      "gptVision": "GPT Vision",
      "manual": "手動輸入",
      "mapping": "映射規則"
    }
  },
  "lineItems": {
    "title": "行項目",
    "empty": "未提取到行項目",
    "columns": {
      "description": "描述",
      "classifiedAs": "分類",
      "quantity": "數量",
      "unitPrice": "單價",
      "amount": "金額",
      "confidence": "信心度"
    },
    "needsClassification": "需要分類",
    "stats": {
      "total": "共 {count} 個行項目",
      "needsReview": "{count} 個需審核"
    }
  }
}
```

#### 6c: `messages/zh-CN/documentPreview.json`

```json
{
  "fieldCard": {
    "source": {
      "azureDi": "Azure DI",
      "gptVision": "GPT Vision",
      "manual": "手动输入",
      "mapping": "映射规则"
    }
  },
  "lineItems": {
    "title": "行项目",
    "empty": "未提取到行项目",
    "columns": {
      "description": "描述",
      "classifiedAs": "分类",
      "quantity": "数量",
      "unitPrice": "单价",
      "amount": "金额",
      "confidence": "置信度"
    },
    "needsClassification": "需要分类",
    "stats": {
      "total": "共 {count} 个行项目",
      "needsReview": "{count} 个需审核"
    }
  }
}
```

---

## 修改檔案清單

| # | 動作 | 檔案 | 說明 |
|---|------|------|------|
| 1 | 修改 | `src/types/extracted-field.ts` | 標記 `FIELD_SOURCE_LABELS` deprecated，新增 `FIELD_SOURCE_I18N_KEYS` |
| 2 | 修改 | `src/components/features/document-preview/FieldCard.tsx` | 改用 `useTranslations()` + `FIELD_SOURCE_I18N_KEYS` 取代硬編碼標籤 |
| 3 | 修改 | `src/app/api/documents/[id]/route.ts` | 從 `stage3Result` 提取 `lineItems` 並加入 API 回應 |
| 4 | 新增 | `src/components/features/document-preview/LineItemsTable.tsx` | Line Items 動態表格組件 |
| 5 | 修改 | `src/components/features/document-preview/ExtractedFieldsPanel.tsx` | 新增 `lineItems` prop，分節顯示 Header Fields + Line Items |
| 6 | 修改 | `src/components/features/document-preview/index.ts` | 導出新的 `LineItemsTable` 組件（如有 barrel export） |
| 7 | 修改 | `src/hooks/use-document-detail.ts` | `DocumentDetail` 新增 `lineItems` 欄位 |
| 8 | 修改 | `src/components/features/document/detail/DocumentDetailTabs.tsx` | `DocumentData` 新增 `lineItems` 欄位，傳遞給 `ExtractedFieldsPanel` |
| 9 | 修改 | `messages/en/documentPreview.json` | 新增 `fieldCard.source.*` 和 `lineItems.*` 翻譯 |
| 10 | 修改 | `messages/zh-TW/documentPreview.json` | 同上 |
| 11 | 修改 | `messages/zh-CN/documentPreview.json` | 同上 |

---

## 影響評估

### API 影響

- **修改端點**: 1 個（`GET /api/documents/[id]`）
- **新增欄位**: `lineItems` 加入 API 回應（當 `include=extractedFields` 時）
- **向後相容**: 新欄位為可選，不影響既有前端（未使用 `lineItems` 的頁面不受影響）
- **查詢變更**: `stage3Result` 在 `extractedFields` include 時也會查詢，但該欄位已是 JSON 類型，不增加 JOIN

### 組件影響

- **新增組件**: 1 個（`LineItemsTable.tsx`）
- **修改組件**: 4 個（`FieldCard.tsx`, `ExtractedFieldsPanel.tsx`, `DocumentDetailTabs.tsx`, 可能的 `index.ts`）
- **修改類型**: 1 個（`extracted-field.ts`）
- **修改 Hook**: 1 個（`use-document-detail.ts`）

### i18n 影響

- **修改命名空間**: `documentPreview`（新增 `fieldCard.source.*` 和 `lineItems.*`）
- **不新增命名空間**
- **三語言同步**: en / zh-TW / zh-CN 均需更新

### 資料庫影響

- **無需 Migration**: 使用既有 `ExtractionResult.stage3Result` JSON 欄位，不新增表或欄位

---

## 風險評估

| 風險 | 嚴重度 | 可能性 | 緩解措施 |
|------|--------|--------|----------|
| `stage3Result` 為 null（老舊文件無 V3.1 資料） | 低 | 中 | 已有 null check：`lineItems` 為空陣列時 Line Items 區不顯示 |
| `FIELD_SOURCE_LABELS` 被其他文件引用 | 低 | 低 | 保留 deprecated 常量，不刪除，避免破壞性變更。全局搜尋確認引用點 |
| `LineItemV3` 欄位在不同文件格式中差異大 | 中 | 高 | `inferColumns()` 動態推斷可用欄位，只顯示有值的欄位 |
| Line Items 資料量大（數百行）影響效能 | 中 | 中 | 表格使用虛擬化或分頁（首版可先不實作，後續如有需要再加） |
| `ExtractedFieldsPanel` prop 變更影響其他引用方 | 低 | 低 | `lineItems` 為可選 prop（`lineItems?: LineItemV3[]`），不影響現有調用 |

---

## 實施順序建議

```
Phase 1（i18n 修復 -- 獨立可部署）:
  Step 1: FIELD_SOURCE_LABELS i18n 化
    1a. 修改 extracted-field.ts（新增 FIELD_SOURCE_I18N_KEYS）
    1b. 修改 FieldCard.tsx（改用 useTranslations）
    1c. 更新 documentPreview.json（3 語言新增 fieldCard.source.*）

Phase 2（API 端 -- 後端準備）:
  Step 2: API 新增 lineItems 提取
    2a. 修改 Prisma 查詢（stage3Result 條件）
    2b. 提取 lineItems 並組裝回應
    2c. 更新 import

Phase 3（前端組件 -- UI 呈現）:
  Step 3: 新增 LineItemsTable 組件
  Step 4: 重構 ExtractedFieldsPanel
  Step 5: 更新 DocumentDetailTabs + useDocumentDetail

Phase 4（i18n 完善 + 驗證）:
  Step 6: 更新 i18n（lineItems.* 翻譯）
  驗證:
    - npm run type-check
    - npm run lint
    - npm run i18n:check
    - 手動測試
```

**說明**: Phase 1 可獨立部署，修復 i18n 問題。Phase 2-4 為一組完整變更。

---

## 測試場景

| # | 場景 | 測試步驟 | 預期結果 |
|---|------|----------|----------|
| 1 | 來源標籤 i18n -- 英文 | 切換語言為 English，查看 Extracted Fields Tab 中的 FieldCard 來源標籤 | 顯示 "Azure DI", "GPT Vision", "Manual", "Mapping Rule" |
| 2 | 來源標籤 i18n -- 繁體中文 | 切換語言為繁體中文，查看來源標籤 | 顯示 "Azure DI", "GPT Vision", "手動輸入", "映射規則" |
| 3 | 來源標籤 i18n -- 簡體中文 | 切換語言為簡體中文，查看來源標籤 | 顯示 "Azure DI", "GPT Vision", "手动输入", "映射规则" |
| 4 | 來源過濾器一致性 | 比較 FieldFilters 過濾器下拉選單和 FieldCard 標籤的翻譯 | 兩處顯示一致 |
| 5 | Line Items -- V3.1 文件 | 查看經 V3.1 處理且有 lineItems 的文件詳情 | Header Fields 區顯示卡片，Line Items 區顯示表格 |
| 6 | Line Items -- V3 文件（無 stage3Result） | 查看經 V3 處理的文件詳情 | 只顯示 Header Fields 區，不顯示 Line Items 區 |
| 7 | Line Items -- 空 lineItems | 查看 stage3Result 存在但 lineItems 為空陣列的文件 | 不顯示 Line Items 區 |
| 8 | Line Items -- 動態欄位推斷 | 查看只有 description + amount 的 lineItems（無 quantity/unitPrice） | 表格只顯示 #, Description, Amount, Confidence 欄 |
| 9 | Line Items -- needsClassification 標記 | 查看含 `needsClassification: true` 的行項目 | classifiedAs 欄顯示警告標記 |
| 10 | API 向後相容 | 不帶 `include=extractedFields` 查詢 API | 回應中不包含 `lineItems` 欄位 |
| 11 | 分節結構 -- 視覺區分 | 查看同時有 header fields 和 line items 的文件 | 兩區之間有明確的視覺分隔線 |
| 12 | 無 extractedFields | 查看未完成處理的文件 | 顯示空狀態提示（現有行為不變） |
