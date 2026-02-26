# CHANGE-014: 端到端管線整合 Phase 2 — 核心整合

> **建立日期**: 2026-01-27
> **狀態**: ✅ 已完成（commit: `32628a2`）
> **優先級**: High
> **類型**: Integration / New Feature
> **影響範圍**: Epic 15 (統一處理) + Epic 19 (模版匹配)
> **前置條件**: CHANGE-013 Phase 1 已完成
> **總體計劃**: `claudedocs/1-planning/e2e-pipeline-integration-plan.md`

---

## 1. 變更概述

Phase 2 是端到端管線整合的核心工作，負責建立「統一處理器 ↔ 資料庫」的橋樑：

1. 從 Azure Blob 下載文件 Buffer（餵給統一處理器）
2. 將統一處理結果寫入 `ExtractionResult` 表（供 Epic 19 讀取）
3. 建立 API 端點觸發整個流程

### Phase 2 包含 4 項工作

| # | 工作項 | 缺口 | 類型 | 複雜度 |
|---|--------|------|------|--------|
| 1 | Azure Blob 下載函數 | G8 | Utility | 低 |
| 2 | 結果持久化服務 | G5 + G10 | Service | 中高 |
| 3 | `/api/documents/[id]/process` 端點 | G1 + G2 | API Route | 中 |
| 4 | TypeScript 類型檢查 + 驗證 | - | QA | 低 |

### 資料流概覽

```
POST /api/documents/{id}/process
  │
  ├─ 1. 讀取 Document 記錄（取得 blobName, fileName, fileType）
  ├─ 2. downloadBlob(blobName) → Buffer       ← 工作項 1
  ├─ 3. 建構 ProcessFileInput
  ├─ 4. getUnifiedDocumentProcessor().processFile(input)
  ├─ 5. persistProcessingResult(documentId, result)  ← 工作項 2
  │     ├─ Upsert ExtractionResult
  │     ├─ 更新 Document.status
  │     ├─ 更新 Document.companyId
  │     └─ 更新 Document.processingPath
  └─ 6. 回傳處理摘要
```

---

## 2. 詳細設計

### 2.1 Azure Blob 下載函數 (G8)

**修改文件**: `src/lib/azure-blob.ts`

**現狀**: 該文件已有 `uploadToBlob`, `uploadBufferToBlob`, `deleteBlob`, `generateSasUrl`, `blobExists` 等函數，但**沒有下載函數**。

**新增函數**:

```typescript
/**
 * 從 Azure Blob Storage 下載文件為 Buffer
 * @param blobName - Blob 名稱（相對路徑）
 * @returns 文件內容的 Buffer
 * @throws 如果 blob 不存在或下載失敗
 */
export async function downloadBlob(blobName: string): Promise<Buffer> {
  const containerClient = getContainerClient();
  const blobClient = containerClient.getBlobClient(blobName);
  const response = await blobClient.download(0);

  if (!response.readableStreamBody) {
    throw new Error(`Failed to download blob: ${blobName}`);
  }

  // Node.js 環境：將 stream 轉為 Buffer
  const chunks: Buffer[] = [];
  for await (const chunk of response.readableStreamBody) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
```

**依賴**: 使用已有的 `getContainerClient()` 內部函數（該函數在 azure-blob.ts 已存在）。

**影響**: 僅新增一個 export 函數，不修改任何現有函數。

---

### 2.2 結果持久化服務 (G5 + G10)

**新增文件**: `src/services/processing-result-persistence.service.ts`

**職責**:
1. 接收 `UnifiedProcessingResult`
2. 轉換 `mappedFields[]` → `ExtractionResult.fieldMappings` JSON 格式
3. Upsert `ExtractionResult` 記錄
4. 更新 `Document` 狀態和關聯欄位

#### 2.2.1 核心介面

```typescript
interface PersistProcessingResultInput {
  documentId: string;
  result: UnifiedProcessingResult;
  userId: string;
}

interface PersistProcessingResultOutput {
  extractionResultId: string;
  documentStatus: DocumentStatus;
  fieldCount: {
    total: number;
    mapped: number;
    unmapped: number;
  };
}
```

#### 2.2.2 欄位映射轉換邏輯

統一處理器產出：
```typescript
// UnifiedProcessingResult.mappedFields
MappedFieldValue {
  targetField: string;       // 目標欄位名
  value: unknown;            // 轉換後的值
  originalValues: string[];  // 原始值
  sourceFields: string[];    // 來源欄位名
  transformType: string;     // DIRECT | FORMULA | LOOKUP
  success: boolean;
  ruleId?: string;
}
```

需要轉換為 ExtractionResult.fieldMappings 格式：
```typescript
// ExtractionResult.fieldMappings (JSON)
Record<string, {
  value: unknown;
  rawValue: string;
  confidence: number;        // 0-100
  source: string;            // "tier1" | "tier2" | "tier3" | "unified"
  ruleId?: string;
  extractionMethod: string;  // DIRECT | FORMULA | LOOKUP
}>
```

轉換偽代碼：
```
for each field in result.mappedFields:
  if field.success:
    fieldMappings[field.targetField] = {
      value: field.value,
      rawValue: field.originalValues[0] ?? '',
      confidence: deriveConfidence(field, result.overallConfidence),
      source: 'unified',
      ruleId: field.ruleId,
      extractionMethod: field.transformType,
    }
```

#### 2.2.3 Document 狀態更新

```typescript
// 處理成功
Document.status = 'MAPPING_COMPLETED'
Document.companyId = result.companyId       // 如果已識別
Document.processingPath = result.routingDecision  // AUTO_APPROVE | QUICK_REVIEW | FULL_REVIEW
Document.processingEndedAt = new Date()
Document.processingDuration = result.totalDurationMs

// 處理失敗
Document.status = 'OCR_FAILED'
Document.errorMessage = result.error
Document.processingEndedAt = new Date()
```

#### 2.2.4 Prisma 事務

```typescript
// 使用 Prisma 交易確保原子性
await prisma.$transaction([
  // 1. Upsert ExtractionResult
  prisma.extractionResult.upsert({
    where: { documentId },
    create: { ... },
    update: { ... },
  }),
  // 2. 更新 Document
  prisma.document.update({
    where: { id: documentId },
    data: { ... },
  }),
]);
```

---

### 2.3 API 端點 `/api/documents/[id]/process` (G1 + G2)

**新增文件**: `src/app/api/documents/[id]/process/route.ts`

**現有路由結構**:
```
src/app/api/documents/[id]/
├── route.ts          # GET, PATCH, DELETE（已存在）
├── progress/         # 進度追蹤（已存在）
├── retry/            # 重試（已存在）
├── source/           # 來源（已存在）
├── trace/            # 追溯（已存在）
└── process/          # 🆕 統一處理觸發（新增）
    └── route.ts
```

#### 2.3.1 API 規格

```
POST /api/documents/{id}/process

Request Body (可選):
{
  "forceUnified"?: boolean,   // 強制使用統一處理器（忽略 feature flag）
  "skipAutoMatch"?: boolean   // 跳過自動匹配（Phase 3 再實作）
}

Success Response (200):
{
  "success": true,
  "data": {
    "documentId": "uuid",
    "status": "MAPPING_COMPLETED",
    "processingDuration": 15234,
    "confidence": 0.87,
    "routingDecision": "QUICK_REVIEW",
    "fieldCount": {
      "total": 12,
      "mapped": 10,
      "unmapped": 2
    },
    "companyId": "uuid",
    "companyName": "DHL Express"
  }
}

Error Response (4xx/5xx):
{
  "type": "https://api.example.com/errors/processing-failed",
  "title": "Document Processing Failed",
  "status": 500,
  "detail": "Step 6 (AZURE_DI_EXTRACTION) failed: timeout",
  "instance": "/api/documents/{id}/process"
}
```

#### 2.3.2 處理流程

```typescript
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // 1. 驗證 session
  const session = await auth();
  if (!session?.user) return unauthorized();

  // 2. 讀取 Document
  const document = await prisma.document.findUnique({
    where: { id: params.id },
    select: { id, blobName, fileName, fileType, status, companyId },
  });
  if (!document) return notFound();

  // 3. 檢查狀態（只允許 UPLOADED 或 OCR_COMPLETED 的文件重新處理）
  const allowedStatuses = ['UPLOADED', 'OCR_COMPLETED', 'OCR_FAILED', 'MAPPING_COMPLETED'];
  if (!allowedStatuses.includes(document.status)) {
    return badRequest(`Document status ${document.status} cannot be processed`);
  }

  // 4. 更新狀態為處理中
  await prisma.document.update({
    where: { id: params.id },
    data: {
      status: 'OCR_PROCESSING',
      processingStartedAt: new Date(),
    },
  });

  try {
    // 5. 從 Azure Blob 下載文件
    const fileBuffer = await downloadBlob(document.blobName);

    // 6. 建構 ProcessFileInput
    const input: ProcessFileInput = {
      fileId: document.id,
      fileName: document.fileName,
      fileBuffer,
      mimeType: document.fileType,
      userId: session.user.id,
    };

    // 7. 執行統一處理
    const processor = getUnifiedDocumentProcessor();
    const result = await processor.processFile(input);

    // 8. 持久化結果
    const persistResult = await persistProcessingResult({
      documentId: document.id,
      result,
      userId: session.user.id,
    });

    // 9. 回傳摘要
    return NextResponse.json({
      success: true,
      data: {
        documentId: document.id,
        status: persistResult.documentStatus,
        processingDuration: result.totalDurationMs,
        confidence: result.overallConfidence,
        routingDecision: result.routingDecision,
        fieldCount: persistResult.fieldCount,
        companyId: result.companyId,
        companyName: result.companyName,
      },
    });
  } catch (error) {
    // 10. 錯誤處理：更新狀態為失敗
    await prisma.document.update({
      where: { id: params.id },
      data: {
        status: 'OCR_FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        processingEndedAt: new Date(),
      },
    });

    return serverError(error);
  }
}
```

#### 2.3.3 前置條件

| 條件 | 說明 | 如何滿足 |
|------|------|----------|
| 文件已上傳 | Document.status = 'UPLOADED' | 透過 upload API |
| Azure Blob 有文件 | blobName 指向有效的 blob | 上傳流程已處理 |
| Azure DI 配置正確 | AZURE_DI_ENDPOINT + KEY | .env 已配置 |
| Feature Flag 開啟 | ENABLE_UNIFIED_PROCESSOR=true | Phase 1 已完成 |

---

## 3. 影響範圍

### 直接影響

| 區域 | 影響 | 風險 |
|------|------|------|
| Azure Blob | 新增下載函數 | 低（只新增，不修改） |
| ExtractionResult 表 | 首次有數據寫入 | 低（upsert 安全） |
| Document 狀態 | 處理後更新狀態 | 低（使用已有的 status enum） |
| 新 API 端點 | `/api/documents/[id]/process` | 中（核心功能） |

### 不影響

- 統一處理器代碼本身（不修改）
- Template Matching Engine（不修改）
- 前端 UI 組件（不修改）
- 現有的上傳流程（不修改）
- 現有的 `/api/documents/[id]` 路由（不修改）

---

## 4. 文件清單

| 操作 | 文件路徑 | 說明 |
|------|----------|------|
| **修改** | `src/lib/azure-blob.ts` | 新增 `downloadBlob()` 函數 |
| **新增** | `src/services/processing-result-persistence.service.ts` | 結果持久化服務 |
| **新增** | `src/app/api/documents/[id]/process/route.ts` | 統一處理 API 端點 |

---

## 5. 驗收標準

- [ ] `downloadBlob(blobName)` 能正確下載已上傳的文件 Buffer
- [ ] `POST /api/documents/{id}/process` 回傳 200 + 處理摘要
- [ ] 處理後 `ExtractionResult` 記錄已建立
- [ ] `ExtractionResult.fieldMappings` 包含結構化的欄位數據
- [ ] `ExtractionResult.status` = `COMPLETED`
- [ ] `Document.status` 更新為 `MAPPING_COMPLETED`
- [ ] `Document.companyId` 已回寫（如果識別成功）
- [ ] `Document.processingPath` 已設置路由決策
- [ ] 處理失敗時 `Document.status` = `OCR_FAILED` + `errorMessage`
- [ ] TypeScript 類型檢查通過
- [ ] ESLint 檢查通過

---

## 6. 實作順序

```
工作項 1: downloadBlob()
    │
    ↓
工作項 2: persistProcessingResult()   ← 依賴：了解 UnifiedProcessingResult 結構
    │
    ↓
工作項 3: POST /api/documents/[id]/process  ← 依賴：工作項 1 + 2
    │
    ↓
工作項 4: TypeScript + ESLint 檢查
```

---

## 7. 後續 Phase

| Phase | 內容 | 依賴 |
|-------|------|------|
| Phase 3 | 處理完成後觸發 autoMatch + 上傳自動處理 | Phase 2 |
| Phase 4 | 端到端測試驗證 | Phase 3 |

詳見: `claudedocs/1-planning/e2e-pipeline-integration-plan.md`
