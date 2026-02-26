# Epic 13: 欄位映射配置介面

## 概覽

提供類似 Azure Document Intelligence Portal 的文件預覽和欄位映射配置功能，讓用戶可以視覺化地配置 AI 提取的欄位映射。

---

## 業務價值

### 問題陳述

目前系統的 Azure DI 欄位映射是**硬編碼**在 `azure-di.service.ts` 中：
- 無法根據不同公司/文件格式調整提取欄位
- 用戶無法看到 AI 識別的欄位位置
- 新增欄位需要修改代碼和重新部署
- 可能遺漏某些公司特有的欄位數據

### 解決方案

提供可視化的欄位映射配置介面，參考 Azure DI Portal 的設計：
- 左側：文件預覽，高亮顯示識別的欄位位置
- 右側：欄位面板，顯示提取結果和信心度
- 配置頁面：拖放式欄位映射配置

### 預期效益

| 指標 | 目前 | 目標 |
|------|------|------|
| 欄位配置靈活性 | 需開發人員修改代碼 | 管理員自助配置 |
| 新公司上線時間 | 1-2 天（需部署） | 即時（配置生效） |
| 數據遺漏風險 | 可能遺漏特有欄位 | 用戶自訂提取欄位 |
| 配置可見度 | 無可視化介面 | 完整預覽和驗證 |

---

## Stories 總覽

| Story ID | 名稱 | 預估點數 | 依賴 |
|----------|------|----------|------|
| 13-1 | 文件預覽組件與欄位高亮 | 8 | - |
| 13-2 | 欄位提取結果面板 | 5 | 13-1 |
| 13-3 | 欄位映射配置介面 | 8 | 13-2 |
| 13-4 | 映射配置 API | 5 | - |
| 13-5 | 動態欄位映射服務整合 | 8 | 13-3, 13-4 |

**總預估點數**: 34

---

## 架構設計

### 組件架構

```
┌─────────────────────────────────────────────────────────────────┐
│ 欄位映射配置頁面 (/admin/settings/field-mappings)               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐   │
│  │                     │  │ Fields | Content | Result | Code│   │
│  │   DocumentPreview   │  ├─────────────────────────────────┤   │
│  │                     │  │                                 │   │
│  │   [PDF 預覽區域]    │  │   ExtractedFieldsPanel          │   │
│  │                     │  │                                 │   │
│  │   - 高亮框標記欄位  │  │   - 欄位名稱                    │   │
│  │   - 點擊跳轉        │  │   - 提取值                      │   │
│  │   - 頁面導航        │  │   - 信心度 %                    │   │
│  │                     │  │   - 子欄位展開                  │   │
│  └─────────────────────┘  └─────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 映射配置編輯器                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Azure DI 欄位              →    系統內部欄位                   │
│  ┌─────────────────┐             ┌─────────────────┐            │
│  │ InvoiceId       │ ─────────→  │ invoiceNumber   │            │
│  │ InvoiceDate     │ ─────────→  │ invoiceDate     │            │
│  │ VendorName      │ ─────────→  │ vendor.name     │            │
│  │ CustomerAddress │ ─────────→  │ buyer.address   │            │
│  │ Items           │ ─────────→  │ lineItems       │            │
│  │ InvoiceTotal    │ ─────────→  │ totalAmount     │            │
│  └─────────────────┘             └─────────────────┘            │
│                                                                 │
│  [ + 新增映射 ]  [ 儲存配置 ]  [ 測試提取 ]                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 資料模型

```prisma
model FieldMappingConfig {
  id               String   @id @default(cuid())
  name             String
  description      String?  @db.Text

  // 適用範圍
  companyId        String?  @map("company_id")
  documentFormatId String?  @map("document_format_id")

  // 映射定義 (JSON)
  mappings         Json     // FieldMapping[]

  // 狀態
  isActive         Boolean  @default(true) @map("is_active")
  priority         Int      @default(0)

  // 審計
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")
  createdById      String   @map("created_by_id")

  company          Company?        @relation(...)
  documentFormat   DocumentFormat? @relation(...)
  createdBy        User            @relation(...)

  @@unique([companyId, documentFormatId])
  @@map("field_mapping_configs")
}
```

### 類型定義

```typescript
interface FieldMapping {
  id: string;
  sourceField: string;      // Azure DI 欄位名
  targetField: string;      // 系統欄位名
  isRequired: boolean;
  defaultValue?: string;
  transformation?: TransformationType;
}

type TransformationType =
  | 'none'
  | 'toUpperCase'
  | 'toLowerCase'
  | 'formatDate'
  | 'formatCurrency'
  | 'extractNumber';

interface FieldAnnotation {
  fieldId: string;
  fieldName: string;
  boundingBox: BoundingBox;
  page: number;
  color: string;
  confidence: number;
  value: string | number | null;
}

interface BoundingBox {
  x: number;      // 0-1 normalized
  y: number;
  width: number;
  height: number;
}
```

---

## 技術依賴

### 前端套件

- `react-pdf` 或 `@react-pdf-viewer/core` - PDF 渲染
- `fabric.js` 或 Canvas API - 高亮框繪製
- `@dnd-kit/core` - 拖放功能

### 後端服務

- Azure Document Intelligence API（現有）
- Field Mapping Configuration Service（新增）

---

## 風險與緩解

| 風險 | 嚴重度 | 緩解措施 |
|------|--------|----------|
| PDF 渲染效能問題 | 中 | 使用 lazy loading，只渲染可見頁面 |
| 高亮座標精度 | 中 | Azure DI 返回的 boundingBox 需要轉換 |
| 配置同步問題 | 低 | 使用版本控制，配置變更需確認 |

---

## 參考資料

- Azure Document Intelligence Portal UI
- 用戶提供截圖: `azure_DI_Portal_preview_document_content_and_fieldmapping_v1.png`

---

*Epic created: 2026-01-02*
*Status: backlog*
