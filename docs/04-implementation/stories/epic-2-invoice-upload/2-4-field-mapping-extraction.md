# Story 2.4: 欄位映射與提取

**Status:** ready-for-dev

---

## Story

**As a** 系統,
**I want** 將 OCR 提取的內容映射到標準化欄位,
**So that** 數據可以被統一格式儲存和使用。

---

## Acceptance Criteria

### AC1: 應用 Forwarder 映射規則

**Given** Forwarder 已識別
**When** 系統應用該 Forwarder 的映射規則
**Then** 系統提取並映射約 90 個標準 Header 欄位
**And** 每個欄位包含：值、來源位置、提取方法

### AC2: 欄位值提取

**Given** 映射規則存在
**When** OCR 文字包含匹配內容
**Then** 系統提取對應的值
**And** 記錄提取來源（頁碼、位置）

### AC3: 無法映射處理

**Given** 某些欄位無法映射
**When** 規則無匹配或值不存在
**Then** 該欄位標記為「空值」
**And** 記錄無法映射的原因

---

## Tasks / Subtasks

- [ ] **Task 1: ExtractionResult 資料表設計** (AC: #1, #2)
  - [ ] 1.1 創建 ExtractionResult Prisma 模型
  - [ ] 1.2 定義欄位（id, documentId, forwarderId, fieldMappings, status）
  - [ ] 1.3 定義 fieldMappings JSON 結構
  - [ ] 1.4 執行 Prisma 遷移

- [ ] **Task 2: MappingRule 資料表設計** (AC: #1)
  - [ ] 2.1 創建 MappingRule Prisma 模型
  - [ ] 2.2 定義欄位（id, forwarderId, fieldName, extractionPattern, priority）
  - [ ] 2.3 建立與 Forwarder 的關聯
  - [ ] 2.4 執行 Prisma 遷移

- [ ] **Task 3: 標準欄位定義** (AC: #1)
  - [ ] 3.1 創建 `src/types/invoice-fields.ts`
  - [ ] 3.2 定義約 90 個標準 Header 欄位
  - [ ] 3.3 定義欄位類型和驗證規則

- [ ] **Task 4: Python 映射服務** (AC: #1, #2, #3)
  - [ ] 4.1 創建 `python-services/mapping/mapper.py`
  - [ ] 4.2 實現 `/map-fields` 端點
  - [ ] 4.3 實現規則匹配邏輯
  - [ ] 4.4 記錄提取來源

- [ ] **Task 5: Next.js 映射 API** (AC: #1, #2, #3)
  - [ ] 5.1 創建 POST `/api/mapping/route.ts`
  - [ ] 5.2 調用 Python 映射服務
  - [ ] 5.3 創建 ExtractionResult 記錄
  - [ ] 5.4 更新 Document 狀態

- [ ] **Task 6: 映射規則管理** (AC: #1)
  - [ ] 6.1 創建基礎映射規則種子數據
  - [ ] 6.2 實現規則載入邏輯
  - [ ] 6.3 支援規則優先級排序

- [ ] **Task 7: 映射服務層** (AC: #1, #2, #3)
  - [ ] 7.1 創建 `src/services/mapping.service.ts`
  - [ ] 7.2 實現 mapFields 函數
  - [ ] 7.3 實現 getExtractionResult 函數

- [ ] **Task 8: 驗證與測試** (AC: #1-3)
  - [ ] 8.1 測試欄位映射準確性
  - [ ] 8.2 測試提取來源記錄
  - [ ] 8.3 測試空值處理
  - [ ] 8.4 測試多規則優先級

---

## Dev Notes

### 依賴項

- **Story 2.3**: Forwarder 識別結果

### Architecture Compliance

#### Prisma Schema - ExtractionResult & MappingRule

```prisma
model ExtractionResult {
  id            String   @id @default(uuid())
  documentId    String   @map("document_id")
  forwarderId   String?  @map("forwarder_id")
  fieldMappings Json     @map("field_mappings")
  // fieldMappings: { [fieldName]: { value, source, confidence, method } }
  confidenceScores Json? @map("confidence_scores")
  status        ExtractionStatus @default(PENDING)
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  document  Document   @relation(fields: [documentId], references: [id])
  forwarder Forwarder? @relation(fields: [forwarderId], references: [id])

  @@index([documentId])
  @@index([forwarderId])
  @@map("extraction_results")
}

enum ExtractionStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}

model MappingRule {
  id               String   @id @default(uuid())
  forwarderId      String?  @map("forwarder_id")  // null = Universal Rule
  fieldName        String   @map("field_name")
  extractionPattern String  @map("extraction_pattern")
  // pattern: { type: 'regex' | 'keyword' | 'position', value: string }
  priority         Int      @default(0)
  isActive         Boolean  @default(true) @map("is_active")
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  forwarder Forwarder? @relation(fields: [forwarderId], references: [id])

  @@index([forwarderId, fieldName])
  @@map("mapping_rules")
}
```

#### 標準欄位定義

```typescript
// src/types/invoice-fields.ts
export const INVOICE_FIELDS = {
  // 基本資訊
  invoiceNumber: { label: '發票號碼', type: 'string', required: true },
  invoiceDate: { label: '發票日期', type: 'date', required: true },
  dueDate: { label: '到期日', type: 'date', required: false },

  // 發貨人
  shipperName: { label: '發貨人名稱', type: 'string', required: true },
  shipperAddress: { label: '發貨人地址', type: 'string', required: false },
  shipperCountry: { label: '發貨人國家', type: 'string', required: false },

  // 收貨人
  consigneeName: { label: '收貨人名稱', type: 'string', required: true },
  consigneeAddress: { label: '收貨人地址', type: 'string', required: false },
  consigneeCountry: { label: '收貨人國家', type: 'string', required: false },

  // 運輸資訊
  trackingNumber: { label: '追蹤號碼', type: 'string', required: false },
  serviceType: { label: '服務類型', type: 'string', required: false },
  weight: { label: '重量', type: 'number', required: false },
  weightUnit: { label: '重量單位', type: 'string', required: false },

  // 費用
  totalAmount: { label: '總金額', type: 'number', required: true },
  currency: { label: '幣別', type: 'string', required: true },
  freightCharge: { label: '運費', type: 'number', required: false },
  fuelSurcharge: { label: '燃油附加費', type: 'number', required: false },

  // ... 約 90 個欄位
} as const

export type InvoiceFieldName = keyof typeof INVOICE_FIELDS
```

#### Field Mapping JSON 結構

```typescript
interface FieldMapping {
  value: string | number | null
  source: {
    page: number
    position?: { x: number; y: number }
    text?: string  // 原始提取文字
  }
  confidence: number  // 0-100
  method: 'regex' | 'keyword' | 'position' | 'ai'
  ruleId?: string  // 使用的規則 ID
}

interface FieldMappings {
  [fieldName: string]: FieldMapping
}
```

#### Python 映射服務

```python
# python-services/mapping/mapper.py
from fastapi import FastAPI
from pydantic import BaseModel
import re

class MapRequest(BaseModel):
    document_id: str
    forwarder_id: str | None
    extracted_text: str
    ocr_result: dict
    mapping_rules: list

class MappedField(BaseModel):
    value: str | None
    source: dict
    confidence: float
    method: str
    rule_id: str | None

class MapResponse(BaseModel):
    document_id: str
    field_mappings: dict[str, MappedField]

@app.post("/map-fields", response_model=MapResponse)
async def map_fields(request: MapRequest):
    field_mappings = {}

    for rule in request.mapping_rules:
        field_name = rule["fieldName"]
        pattern = rule["extractionPattern"]

        # 根據提取類型執行匹配
        if pattern["type"] == "regex":
            match = re.search(pattern["value"], request.extracted_text)
            if match:
                field_mappings[field_name] = MappedField(
                    value=match.group(1) if match.groups() else match.group(0),
                    source={"page": 1, "text": match.group(0)},
                    confidence=85,
                    method="regex",
                    rule_id=rule["id"]
                )

        # ... 其他提取方法

    return MapResponse(
        document_id=request.document_id,
        field_mappings=field_mappings
    )
```

### Testing Requirements

| 驗證項目 | 預期結果 |
|---------|---------|
| 欄位提取 | 正確提取並映射值 |
| 來源記錄 | 記錄頁碼和位置 |
| 空值處理 | 標記為空並記錄原因 |
| 規則優先級 | 高優先級規則優先 |

### References

- [Source: docs/03-epics/sections/epic-2-manual-invoice-upload-ai-processing.md#story-24]
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR6]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 2.4 |
| Story Key | 2-4-field-mapping-extraction |
| Epic | Epic 2: 手動發票上傳與 AI 處理 |
| FR Coverage | FR6 |
| Dependencies | Story 2.3 |

---

*Story created: 2025-12-16*
*Status: ready-for-dev*
