# Story 2.3: Forwarder 自動識別

**Status:** ready-for-dev

---

## Story

**As a** 系統,
**I want** 自動識別發票所屬的 Forwarder,
**So that** 可以應用該 Forwarder 特定的映射規則。

---

## Acceptance Criteria

### AC1: Forwarder 識別邏輯

**Given** OCR 提取完成
**When** 系統分析提取的文字
**Then** 系統識別 Forwarder 標識（公司名稱、Logo 文字、格式特徵）
**And** 返回 Forwarder ID 和信心度分數

### AC2: 高信心度自動關聯

**Given** 系統成功識別 Forwarder
**When** 信心度 >= 80%
**Then** 自動關聯該 Forwarder Profile
**And** 記錄識別結果

### AC3: 低信心度處理

**Given** 系統無法識別 Forwarder
**When** 信心度 < 80% 或無匹配
**Then** 標記為「未識別 Forwarder」
**And** 列入需人工指定的隊列

---

## Tasks / Subtasks

- [ ] **Task 1: Forwarder 資料表設計** (AC: #1, #2)
  - [ ] 1.1 創建 Forwarder Prisma 模型
  - [ ] 1.2 定義欄位（id, name, code, identificationPatterns, status）
  - [ ] 1.3 創建 ForwarderIdentification 結果記錄模型
  - [ ] 1.4 執行 Prisma 遷移

- [ ] **Task 2: Forwarder 種子數據** (AC: #1)
  - [ ] 2.1 定義初始 Forwarder 列表
  - [ ] 2.2 配置識別模式（公司名稱、關鍵字）
  - [ ] 2.3 創建種子腳本

- [ ] **Task 3: 識別服務 Python 端** (AC: #1, #2, #3)
  - [ ] 3.1 創建 `python-services/mapping/main.py`
  - [ ] 3.2 實現 `/identify-forwarder` 端點
  - [ ] 3.3 實現模式匹配邏輯
  - [ ] 3.4 計算信心度分數

- [ ] **Task 4: Next.js 識別 API** (AC: #1, #2, #3)
  - [ ] 4.1 創建 POST `/api/forwarders/identify`
  - [ ] 4.2 調用 Python 識別服務
  - [ ] 4.3 根據信心度處理結果
  - [ ] 4.4 更新 Document 關聯

- [ ] **Task 5: 識別結果記錄** (AC: #2, #3)
  - [ ] 5.1 創建 ForwarderIdentification 記錄
  - [ ] 5.2 記錄識別方法和依據
  - [ ] 5.3 記錄信心度分數

- [ ] **Task 6: 未識別處理隊列** (AC: #3)
  - [ ] 6.1 創建未識別文件列表視圖
  - [ ] 6.2 提供手動指定 Forwarder 功能
  - [ ] 6.3 記錄手動指定操作

- [ ] **Task 7: Forwarder 服務層** (AC: #1, #2, #3)
  - [ ] 7.1 創建 `src/services/forwarder.service.ts`
  - [ ] 7.2 實現 identifyForwarder 函數
  - [ ] 7.3 實現 getAllForwarders 函數

- [ ] **Task 8: 驗證與測試** (AC: #1-3)
  - [ ] 8.1 測試已知 Forwarder 識別
  - [ ] 8.2 測試高信心度自動關聯
  - [ ] 8.3 測試低信心度隊列處理
  - [ ] 8.4 測試未知 Forwarder 處理

---

## Dev Notes

### 依賴項

- **Story 2.2**: OCR 提取結果

### Architecture Compliance

#### Prisma Schema - Forwarder

```prisma
model Forwarder {
  id                    String   @id @default(uuid())
  name                  String   @unique
  code                  String   @unique  // 簡碼，如 "DHL", "FDX"
  identificationPatterns Json     @map("identification_patterns")
  // patterns: { names: [], keywords: [], formats: [] }
  status                ForwarderStatus @default(ACTIVE)
  createdAt             DateTime @default(now()) @map("created_at")
  updatedAt             DateTime @updatedAt @map("updated_at")

  documents             Document[]
  mappingRules          MappingRule[]
  identifications       ForwarderIdentification[]

  @@map("forwarders")
}

enum ForwarderStatus {
  ACTIVE
  INACTIVE
}

model ForwarderIdentification {
  id            String   @id @default(uuid())
  documentId    String   @map("document_id")
  forwarderId   String?  @map("forwarder_id")
  confidence    Float    // 0-100
  matchedPattern String? @map("matched_pattern")
  isManual      Boolean  @default(false) @map("is_manual")
  createdAt     DateTime @default(now()) @map("created_at")

  document  Document   @relation(fields: [documentId], references: [id])
  forwarder Forwarder? @relation(fields: [forwarderId], references: [id])

  @@index([documentId])
  @@map("forwarder_identifications")
}
```

#### Python 識別服務

```python
# python-services/mapping/main.py
from fastapi import FastAPI
from pydantic import BaseModel
import re

app = FastAPI()

class IdentifyRequest(BaseModel):
    document_id: str
    extracted_text: str
    forwarders: list  # 從 DB 傳入的 Forwarder 列表

class IdentifyResponse(BaseModel):
    document_id: str
    forwarder_id: str | None
    forwarder_name: str | None
    confidence: float
    matched_pattern: str | None

@app.post("/identify-forwarder", response_model=IdentifyResponse)
async def identify_forwarder(request: IdentifyRequest):
    best_match = None
    best_confidence = 0
    matched_pattern = None

    text_lower = request.extracted_text.lower()

    for forwarder in request.forwarders:
        patterns = forwarder["identificationPatterns"]
        confidence = 0
        pattern_used = None

        # 檢查名稱匹配
        for name in patterns.get("names", []):
            if name.lower() in text_lower:
                confidence = max(confidence, 90)
                pattern_used = f"name:{name}"

        # 檢查關鍵字匹配
        for keyword in patterns.get("keywords", []):
            if keyword.lower() in text_lower:
                confidence = max(confidence, 70)
                if not pattern_used:
                    pattern_used = f"keyword:{keyword}"

        if confidence > best_confidence:
            best_confidence = confidence
            best_match = forwarder
            matched_pattern = pattern_used

    return IdentifyResponse(
        document_id=request.document_id,
        forwarder_id=best_match["id"] if best_match else None,
        forwarder_name=best_match["name"] if best_match else None,
        confidence=best_confidence,
        matched_pattern=matched_pattern
    )
```

#### Forwarder 種子數據示例

```typescript
// prisma/seed.ts - Forwarder 種子數據
const forwarders = [
  {
    name: 'DHL Express',
    code: 'DHL',
    identificationPatterns: {
      names: ['DHL Express', 'DHL International'],
      keywords: ['DHL', 'WAYBILL', 'EXPRESS WORLDWIDE'],
    },
  },
  {
    name: 'FedEx',
    code: 'FDX',
    identificationPatterns: {
      names: ['FedEx', 'Federal Express'],
      keywords: ['FEDEX', 'TRACKING NUMBER'],
    },
  },
  {
    name: 'UPS',
    code: 'UPS',
    identificationPatterns: {
      names: ['UPS', 'United Parcel Service'],
      keywords: ['UPS', 'TRACKING#', '1Z'],
    },
  },
  // ... 更多 Forwarder
]
```

### Testing Requirements

| 驗證項目 | 預期結果 |
|---------|---------|
| 已知 Forwarder | 正確識別並返回 ID |
| 高信心度 (>=80%) | 自動關聯 Forwarder |
| 低信心度 (<80%) | 標記為待人工處理 |
| 未知 Forwarder | 進入未識別隊列 |

### References

- [Source: docs/03-epics/sections/epic-2-manual-invoice-upload-ai-processing.md#story-23]
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR5]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 2.3 |
| Story Key | 2-3-forwarder-auto-identification |
| Epic | Epic 2: 手動發票上傳與 AI 處理 |
| FR Coverage | FR5 |
| Dependencies | Story 2.2 |

---

*Story created: 2025-12-16*
*Status: ready-for-dev*
