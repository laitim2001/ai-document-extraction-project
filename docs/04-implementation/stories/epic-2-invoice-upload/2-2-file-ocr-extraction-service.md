# Story 2.2: 文件 OCR 提取服務

**Status:** ready-for-dev

---

## Story

**As a** 系統,
**I want** 對上傳的發票進行 OCR 文字提取,
**So that** 可以獲取發票中的所有文字內容供後續處理。

---

## Acceptance Criteria

### AC1: Azure Document Intelligence OCR

**Given** 文件已成功上傳
**When** 系統開始處理文件
**Then** 調用 Azure Document Intelligence API 進行 OCR
**And** 提取文件中的所有文字和結構化數據
**And** 處理時間 < 30 秒（單張發票）

### AC2: OCR 結果儲存

**Given** OCR 處理成功
**When** 結果返回
**Then** 系統儲存原始 OCR 結果（JSON 格式）
**And** 更新文件狀態為「OCR 完成」

### AC3: OCR 失敗處理

**Given** OCR 處理失敗
**When** API 返回錯誤
**Then** 系統記錄錯誤詳情
**And** 更新文件狀態為「OCR 失敗」
**And** 標記為需要人工處理

---

## Tasks / Subtasks

- [ ] **Task 1: OcrResult 資料表設計** (AC: #2)
  - [ ] 1.1 創建 OcrResult Prisma 模型
  - [ ] 1.2 定義欄位（id, documentId, rawResult, extractedText, processingTime）
  - [ ] 1.3 建立與 Document 的關聯
  - [ ] 1.4 執行 Prisma 遷移

- [ ] **Task 2: Python OCR 服務** (AC: #1, #2, #3)
  - [ ] 2.1 創建 `python-services/extraction/main.py` FastAPI 入口
  - [ ] 2.2 創建 `azure_di.py` Azure Document Intelligence 封裝
  - [ ] 2.3 實現 OCR 端點 `/extract`
  - [ ] 2.4 配置 Azure DI 連線

- [ ] **Task 3: Next.js OCR 觸發 API** (AC: #1)
  - [ ] 3.1 創建 POST `/api/extraction/route.ts`
  - [ ] 3.2 調用 Python 服務進行 OCR
  - [ ] 3.3 更新 Document 狀態
  - [ ] 3.4 創建 OcrResult 記錄

- [ ] **Task 4: 非同步處理機制** (AC: #1)
  - [ ] 4.1 實現背景任務處理
  - [ ] 4.2 上傳完成後自動觸發 OCR
  - [ ] 4.3 處理超時機制（30 秒）

- [ ] **Task 5: 錯誤處理與重試** (AC: #3)
  - [ ] 5.1 定義 OCR 錯誤類型
  - [ ] 5.2 實現自動重試機制（最多 3 次）
  - [ ] 5.3 記錄失敗詳情到資料庫

- [ ] **Task 6: 狀態查詢 API** (AC: #1, #2)
  - [ ] 6.1 創建 GET `/api/extraction/status/[jobId]`
  - [ ] 6.2 返回 OCR 處理狀態
  - [ ] 6.3 返回處理結果摘要

- [ ] **Task 7: OCR 服務層** (AC: #1, #2, #3)
  - [ ] 7.1 創建 `src/services/extraction.service.ts`
  - [ ] 7.2 實現 triggerOcr 函數
  - [ ] 7.3 實現 getOcrResult 函數

- [ ] **Task 8: 驗證與測試** (AC: #1-3)
  - [ ] 8.1 測試 PDF OCR 提取
  - [ ] 8.2 測試圖片 OCR 提取
  - [ ] 8.3 測試失敗重試機制
  - [ ] 8.4 測試處理時間 < 30 秒

---

## Dev Notes

### 依賴項

- **Story 2.1**: Document 模型、文件上傳功能

### Project Structure Notes

```
python-services/
├── extraction/
│   ├── __init__.py
│   ├── main.py                 # FastAPI 入口
│   ├── azure_di.py             # Azure Document Intelligence
│   └── processor.py            # OCR 處理器
src/
├── app/
│   └── api/
│       └── extraction/
│           ├── route.ts        # 觸發 OCR
│           └── status/
│               └── [jobId]/
│                   └── route.ts # 狀態查詢
└── services/
    └── extraction.service.ts   # 提取服務層
```

### Architecture Compliance

#### Prisma Schema - OcrResult

```prisma
model OcrResult {
  id            String   @id @default(uuid())
  documentId    String   @map("document_id")
  rawResult     Json     @map("raw_result")     // Azure DI 原始響應
  extractedText String   @map("extracted_text") @db.Text
  processingTime Int?    @map("processing_time") // 毫秒
  errorMessage  String?  @map("error_message")
  createdAt     DateTime @default(now()) @map("created_at")

  document Document @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@index([documentId])
  @@map("ocr_results")
}
```

#### Python FastAPI OCR 服務

```python
# python-services/extraction/main.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from azure_di import extract_document

app = FastAPI()

class ExtractionRequest(BaseModel):
    document_url: str
    document_id: str

class ExtractionResponse(BaseModel):
    document_id: str
    extracted_text: str
    raw_result: dict
    processing_time_ms: int

@app.post("/extract", response_model=ExtractionResponse)
async def extract(request: ExtractionRequest):
    try:
        result = await extract_document(request.document_url)
        return ExtractionResponse(
            document_id=request.document_id,
            extracted_text=result["text"],
            raw_result=result["raw"],
            processing_time_ms=result["processing_time"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

#### Azure Document Intelligence 封裝

```python
# python-services/extraction/azure_di.py
import os
import time
from azure.ai.formrecognizer import DocumentAnalysisClient
from azure.core.credentials import AzureKeyCredential

endpoint = os.environ["AZURE_DI_ENDPOINT"]
key = os.environ["AZURE_DI_KEY"]

client = DocumentAnalysisClient(endpoint, AzureKeyCredential(key))

async def extract_document(document_url: str) -> dict:
    start_time = time.time()

    poller = client.begin_analyze_document_from_url(
        "prebuilt-invoice",  # 或 "prebuilt-document"
        document_url
    )
    result = poller.result()

    processing_time = int((time.time() - start_time) * 1000)

    # 提取文字
    extracted_text = ""
    for page in result.pages:
        for line in page.lines:
            extracted_text += line.content + "\n"

    return {
        "text": extracted_text,
        "raw": result.to_dict(),
        "processing_time": processing_time
    }
```

#### Next.js 觸發 API

```typescript
// src/app/api/extraction/route.ts
export async function POST(request: Request) {
  const { documentId } = await request.json()

  // 更新狀態為處理中
  await prisma.document.update({
    where: { id: documentId },
    data: { status: 'OCR_PROCESSING' },
  })

  // 調用 Python 服務
  const document = await prisma.document.findUnique({
    where: { id: documentId },
  })

  const response = await fetch(`${PYTHON_SERVICE_URL}/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      document_url: document.filePath,
      document_id: documentId,
    }),
  })

  if (!response.ok) {
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'OCR_FAILED' },
    })
    throw new Error('OCR extraction failed')
  }

  const result = await response.json()

  // 儲存結果
  await prisma.ocrResult.create({
    data: {
      documentId,
      rawResult: result.raw_result,
      extractedText: result.extracted_text,
      processingTime: result.processing_time_ms,
    },
  })

  // 更新狀態
  await prisma.document.update({
    where: { id: documentId },
    data: { status: 'OCR_COMPLETED' },
  })

  return Response.json({ success: true, data: result })
}
```

### Environment Variables

```bash
# .env.example 新增
AZURE_DI_ENDPOINT="https://your-resource.cognitiveservices.azure.com/"
AZURE_DI_KEY="your-api-key"
PYTHON_SERVICE_URL="http://localhost:8000"
```

### Testing Requirements

| 驗證項目 | 預期結果 |
|---------|---------|
| PDF OCR | 成功提取文字內容 |
| 圖片 OCR | 成功提取文字內容 |
| 處理時間 | < 30 秒 |
| 結果儲存 | OcrResult 記錄正確創建 |
| 狀態更新 | Document 狀態正確更新 |
| 失敗處理 | 錯誤記錄並標記狀態 |

### References

- [Source: docs/03-epics/sections/epic-2-manual-invoice-upload-ai-processing.md#story-22]
- [Source: docs/02-architecture/sections/core-architecture-decisions.md]
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR4]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 2.2 |
| Story Key | 2-2-file-ocr-extraction-service |
| Epic | Epic 2: 手動發票上傳與 AI 處理 |
| FR Coverage | FR4 |
| Dependencies | Story 2.1 |

---

*Story created: 2025-12-16*
*Status: ready-for-dev*
