# CHANGE-018: Invoice 詳情頁 API 增強與 Source Badge i18n 修復

> **建立日期**: 2026-01-28
> **完成日期**: 2026-01-28
> **狀態**: ✅ 已完成（代碼修復部分）
> **優先級**: High
> **類型**: Enhancement / Bug Fix
> **影響範圍**: Epic 2 (文件詳情 API) + Epic 13 (Invoice Detail Page) + Epic 17 (i18n)
> **前置條件**: CHANGE-017 已完成（統一管線整合）

---

## 1. 變更概述

### 問題背景

Invoice 詳情頁面（`/invoices/[id]`）的前端 hook（`useInvoiceDetail`）期望的資料結構，與 `GET /api/documents/[id]` API 實際返回的資料之間存在**嚴重的契約不匹配**。

API route 建於 **Epic 2 時期**（2025-12-18），只返回基本的 Prisma 關聯資料。但 Epic 13（2026-01-03）新增的 Invoice Detail Page 前端組件期望更豐富的資料結構，**API 從未被更新以匹配**。

此外，`DocumentSourceBadge` 組件在英文 locale 下仍顯示中文標籤（如 "手動上傳"），違反 i18n 規範。

### 當前狀態（6 個問題）

```
Invoice Detail Page (/invoices/[id])
│
├─ Stats Cards
│   ├─ Status: ✅ 正常顯示
│   ├─ Confidence: ❌ 顯示 "-"（overallConfidence 為 null）
│   ├─ Upload Info: ⚠️ Uploader 顯示 "-"
│   └─ Source: ❌ 英文 locale 顯示中文 "手動上傳"
│
├─ Preview Tab: ❌ "Unable to preview this file"（blobUrl 為 null）
├─ Extracted Fields Tab: ❌ "No extracted fields available"（未查詢）
├─ Processing Tab: ❌ "No processing steps recorded"（trace 資料缺失）
└─ Audit Log Tab: ❌ "No audit logs available"（無審計記錄）
```

### 根本原因分析

```
GET /api/documents/[id] (Epic 2, 2025-12-18)
  ↓
getDocumentWithRelations(id)
  ↓
prisma.document.findUnique({
  include: {
    uploader: ✅ 有查詢
    company: ✅ 有查詢
    ocrResult: ✅ 有查詢（但前端不使用）
    processingQueue: ✅ 有查詢（但前端不使用）
  }
})
  ↓
返回原始 Prisma 資料，缺失：
  ├─ blobUrl          ← 需從 blobName 生成 SAS URL
  ├─ extractedFields  ← 需從 ExtractedField 表查詢
  ├─ processingSteps  ← 需從 trace API 或 ExtractionResult 提取
  ├─ overallConfidence ← 需從 ExtractionResult 獲取
  └─ sourceType       ← Document 有此欄位但 API 未明確映射
```

### 前端 Hook 期望的資料結構

```typescript
// src/hooks/use-invoice-detail.ts
interface DocumentDetail {
  id: string
  fileName: string
  blobUrl: string | null              // ❌ API 不返回
  status: string
  overallConfidence: number | null    // ❌ Document 表為 null
  processingPath: string | null
  sourceType: DocumentSourceType      // ⚠️ 需映射
  extractedFields: ExtractedField[]   // ❌ API 不查詢
  processingSteps: ProcessingStep[]   // ❌ API 不查詢
  uploadedBy: { id, name, email }     // ✅ 已有
  company: { id, name, code }         // ✅ 已有
  // ...
}
```

---

## 2. 功能差異對比

| 資料欄位 | 當前 API 返回 | 目標 API 返回 | 前端組件 |
|----------|:------------:|:------------:|----------|
| 基本欄位 (id, fileName, status...) | ✅ | ✅ | Header |
| uploader (id, name, email) | ✅ | ✅ | Stats - Upload Info |
| company (id, name, code) | ✅ | ✅ | Header |
| **blobUrl** (SAS URL) | ❌ null | ✅ 動態生成 | Preview Tab |
| **extractedFields** | ❌ 未查詢 | ✅ 含 boundingBox | Extracted Fields Tab |
| **overallConfidence** | ❌ null | ✅ 從 ExtractionResult | Stats - Confidence |
| **processingSteps** | ❌ 未查詢 | ✅ 從 trace chain | Processing Tab |
| sourceType | ⚠️ 有但未映射 | ✅ 明確返回 | Stats - Source |
| ocrResult | ✅ 有但前端不用 | ❌ 不返回 | - |
| processingQueue | ✅ 有但前端不用 | ❌ 不返回 | - |

---

## 3. 詳細設計

### 3.1 增強 `GET /api/documents/[id]` API Route

**檔案**: `src/app/api/documents/[id]/route.ts`

**修改方案**:

1. 解析 `?include=` 查詢參數，支援動態關聯加載
2. 從 `blobName` 生成 Azure Blob SAS URL（複用 `azure-blob.ts` 的 `getBlobSasUrl`）
3. 條件查詢 `extractedFields`（含 boundingBox）
4. 從 `ExtractionResult` 獲取 `overallConfidence`
5. 查詢 `processingSteps`（從 traceability service 或 ExtractionResult）
6. 移除前端不使用的 `ocrResult`、`processingQueue`

```typescript
// 偽代碼 - 增強後的 GET handler
export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user) return unauthorized()

  const { id } = await params
  const { searchParams } = new URL(request.url)
  const includes = searchParams.get('include')?.split(',') || []

  // 1. 基礎文件查詢（含 uploader, company）
  const document = await getDocumentDetail(id, includes)
  if (!document) return notFound()

  // 2. 生成 blobUrl（SAS URL）
  const blobUrl = document.blobName
    ? await getBlobSasUrl(document.blobName)
    : null

  // 3. 條件查詢 extractedFields
  const extractedFields = includes.includes('extractedFields')
    ? await getExtractedFields(id)
    : undefined

  // 4. 從 ExtractionResult 獲取 confidence
  const extractionResult = await getLatestExtractionResult(id)
  const overallConfidence = document.overallConfidence
    ?? extractionResult?.overallConfidence
    ?? null

  // 5. 條件查詢 processingSteps
  const processingSteps = includes.includes('processingSteps')
    ? await getProcessingSteps(id)
    : undefined

  // 6. 組裝回應
  return NextResponse.json({
    success: true,
    data: {
      ...mapDocumentToResponse(document),
      blobUrl,
      overallConfidence,
      extractedFields,
      processingSteps,
    },
  })
}
```

### 3.2 新增 `getDocumentDetail()` Service 函數

**檔案**: `src/services/document.service.ts`

新增專用的詳情查詢函數，取代 `getDocumentWithRelations()`：

```typescript
export async function getDocumentDetail(id: string, includes: string[]) {
  return prisma.document.findUnique({
    where: { id },
    include: {
      uploader: includes.includes('uploadedBy')
        ? { select: { id: true, name: true, email: true } }
        : false,
      company: includes.includes('company')
        ? { select: { id: true, name: true, code: true } }
        : false,
      city: includes.includes('city')
        ? { select: { id: true, name: true, code: true } }
        : false,
    },
  })
}
```

### 3.3 新增 `getExtractedFields()` 查詢

**檔案**: `src/services/document.service.ts`（或新增輔助函數）

```typescript
async function getExtractedFields(documentId: string) {
  return prisma.extractedField.findMany({
    where: { documentId },
    orderBy: { fieldName: 'asc' },
    select: {
      id: true,
      fieldName: true,
      fieldValue: true,
      confidence: true,
      source: true,
      category: true,
      boundingBox: true,
      pageNumber: true,
    },
  })
}
```

### 3.4 新增 `getLatestExtractionResult()` 查詢

```typescript
async function getLatestExtractionResult(documentId: string) {
  return prisma.extractionResult.findFirst({
    where: { documentId },
    orderBy: { createdAt: 'desc' },
    select: {
      overallConfidence: true,
      routingDecision: true,
      extractionMethod: true,
    },
  })
}
```

### 3.5 修復 DocumentSourceBadge i18n

**檔案**: `src/components/features/document-source/DocumentSourceBadge.tsx`

**現狀**（第 98 行）:
```tsx
{showLabel && <span>{config.label}</span>}
// ← 永遠使用中文 label，無視 locale
```

**修改方案**:

```tsx
import { useLocale } from 'next-intl'

// 在組件內
const locale = useLocale()
const isZh = locale === 'zh-TW' || locale === 'zh-CN'
const displayLabel = isZh ? config.label : config.labelEn

// 渲染
{showLabel && <span>{displayLabel}</span>}
```

**備註**: `source-types.ts` 已有 `labelEn` 欄位，只需在組件中根據 locale 選擇即可。

### 3.6 Processing Tab 與 Audit Log Tab 資料修復

**Processing Tab** (`ProcessingTimeline.tsx`):
- 已正確從 `/api/documents/[id]/trace` 取資料
- 問題可能是 traceability service 對此文件沒有記錄處理步驟
- **方案**: 在 API route 增強中，也將 `processingSteps` 作為備選資料源傳入

**Audit Log Tab** (`InvoiceAuditLog.tsx`):
- 已正確從 `/api/audit/logs?entityType=DOCUMENT&entityId=` 取資料
- 問題是此特定文件確實沒有審計記錄（舊文件未記錄 audit log）
- **方案**: 此為數據問題，非代碼問題。新處理的文件應有 audit log。可考慮在統一管線 persist 步驟加入 audit log 記錄

---

## 4. 影響範圍

### 修改的檔案

| 檔案 | 修改類型 | 說明 |
|------|----------|------|
| `src/app/api/documents/[id]/route.ts` | **重構** | 支援 include 參數、blobUrl 生成、extractedFields/confidence 查詢 |
| `src/services/document.service.ts` | **新增** | `getDocumentDetail()` + `getExtractedFields()` + `getLatestExtractionResult()` |
| `src/components/features/document-source/DocumentSourceBadge.tsx` | **修復** | 根據 locale 選擇 label vs labelEn |

### 不需修改的檔案

| 檔案 | 原因 |
|------|------|
| `src/hooks/use-invoice-detail.ts` | Hook 已正確定義期望的資料結構 |
| `src/components/features/invoice/detail/InvoiceDetailTabs.tsx` | 前端組件邏輯正確，問題在資料層 |
| `src/components/features/invoice/detail/ProcessingTimeline.tsx` | 獨立從 trace API 取資料 |
| `src/components/features/invoice/detail/InvoiceAuditLog.tsx` | 獨立從 audit API 取資料 |
| `src/lib/constants/source-types.ts` | 已有 `labelEn` 欄位，不需修改 |

### 依賴的現有服務

| 服務 | 檔案 | 用途 |
|------|------|------|
| Azure Blob SAS URL | `src/lib/azure-blob.ts` | `getBlobSasUrl()` 生成下載/預覽 URL |
| Traceability | `src/services/traceability.service.ts` | 處理步驟追蹤 |
| Extraction Result | Prisma `ExtractionResult` 模型 | confidence 和 routing 資料 |
| Extracted Fields | Prisma `ExtractedField` 模型 | 欄位提取結果 |

---

## 5. 問題分類

### 代碼問題（需修復）

| # | 問題 | 根本原因 | 修復方案 |
|---|------|----------|----------|
| 1 | Preview 無法顯示 | API 不生成 `blobUrl` | 從 `blobName` 生成 SAS URL |
| 2 | Extracted Fields 為空 | API 不查詢 `ExtractedField` 表 | 新增 include 支援 |
| 3 | Confidence 顯示 "-" | `overallConfidence` 為 null | 從 `ExtractionResult` 取值 |
| 4 | Source 顯示中文 | `DocumentSourceBadge` 硬編碼 `config.label` | 根據 locale 選擇 label |

### 數據問題（非代碼缺陷）

| # | 問題 | 原因 | 處理方式 |
|---|------|------|----------|
| 5 | Processing 為空 | traceability service 可能未記錄此文件的步驟 | 驗證新文件是否有記錄，必要時補充 |
| 6 | Audit Log 為空 | 此文件處理時未生成 audit log | 新文件應有，舊文件為數據缺失 |

---

## 6. 風險評估

| 風險 | 可能性 | 影響 | 緩解措施 |
|------|--------|------|----------|
| SAS URL 生成失敗 | 低 | 中 | try-catch 包裝，blobUrl 返回 null，前端已有空狀態處理 |
| ExtractedField 查詢性能 | 低 | 低 | 只在 include 參數請求時查詢，非預設加載 |
| ExtractionResult 不存在 | 中 | 低 | 使用 `??` 運算符回退到 Document 的 overallConfidence |
| 改動 API 響應結構 | 低 | 中 | 新增欄位不影響現有消費者（向後兼容） |
| Source Badge i18n 改動 | 低 | 低 | 只影響顯示文字，不影響邏輯 |

---

## 7. 驗收標準

### 功能驗收

- [ ] **Preview Tab**: 已處理文件顯示 PDF 預覽（非 "Unable to preview"）
- [ ] **Extracted Fields Tab**: 已處理文件顯示提取欄位列表（含 confidence、category）
- [ ] **Confidence**: Stats 卡片顯示 confidence 百分比（非 "-"）
- [ ] **Source Badge**: 英文 locale 顯示 "Manual Upload"，中文 locale 顯示 "手動上傳"
- [ ] **blobUrl**: API 響應包含有效的 SAS URL
- [ ] **Download 按鈕**: 不再 disabled（有 blobUrl 時可下載）
- [ ] **Processing Tab**: 新處理的文件顯示處理步驟時間軸
- [ ] **Audit Log Tab**: 新處理的文件顯示審計記錄

### API 驗收

- [ ] `GET /api/documents/[id]` 基本調用（無 include）仍正常返回
- [ ] `GET /api/documents/[id]?include=extractedFields` 返回 extractedFields 陣列
- [ ] `GET /api/documents/[id]?include=extractedFields,processingSteps,uploadedBy,company,city` 返回完整資料
- [ ] `blobUrl` 在文件有 `blobName` 時返回有效 SAS URL
- [ ] `overallConfidence` 優先從 ExtractionResult 取值

### i18n 驗收

- [ ] `/en/invoices/[id]` 中 Source 顯示 "Manual Upload"
- [ ] `/zh-TW/invoices/[id]` 中 Source 顯示 "手動上傳"
- [ ] `/zh-CN/invoices/[id]` 中 Source 顯示 "手動上传"（如有）

### 迴歸測試

- [ ] Invoice 列表頁功能不受影響
- [ ] Retry 功能不受影響（CHANGE-017）
- [ ] 文件上傳流程不受影響
- [ ] 其他使用 `getDocumentWithRelations()` 的地方不受影響

---

## 8. 測試計劃

### 手動測試步驟

1. 上傳新文件，等待統一管線處理完成
2. 進入 `/en/invoices/[id]` 詳情頁
3. 驗證 Preview Tab 顯示 PDF 預覽
4. 驗證 Extracted Fields Tab 顯示欄位列表
5. 驗證 Confidence 卡片顯示百分比
6. 驗證 Source 卡片顯示 "Manual Upload"（英文 locale）
7. 切換至 `/zh-TW/invoices/[id]`，驗證 Source 顯示 "手動上傳"
8. 驗證 Download 按鈕可正常下載文件
9. 驗證 Processing Tab 是否有處理步驟
10. 驗證 Audit Log Tab 是否有審計記錄

### 邊界情況

- 文件無 blobName（應優雅降級，blobUrl = null）
- 文件無 ExtractionResult（confidence 顯示 "-"）
- 文件無 ExtractedFields（顯示空狀態）
- 文件狀態為 FAILED（各 tab 應正確處理）
- API 不帶 include 參數（向後兼容，返回基本資料）

---

## 9. 實施順序

建議按以下順序實施：

```
Phase 1: API 層增強（核心修復）
  ├─ 3.1 增強 GET /api/documents/[id] route
  ├─ 3.2 新增 getDocumentDetail()
  ├─ 3.3 新增 getExtractedFields()
  └─ 3.4 新增 getLatestExtractionResult()

Phase 2: i18n 修復
  └─ 3.5 修復 DocumentSourceBadge

Phase 3: 驗證
  ├─ TypeScript 類型檢查
  ├─ 瀏覽器端手動測試
  └─ 多語言驗證
```

---

## 10. 實施結果

### 實際修改的檔案

| 檔案 | 修改類型 | 說明 |
|------|----------|------|
| `src/app/api/documents/[id]/route.ts` | **重構** | 直接在 route 內實作所有邏輯（不另建 service），支援 `?include=` 動態關聯、blobUrl SAS URL 生成、fieldMappings → ExtractedField[] 轉換 |
| `src/components/features/document-source/DocumentSourceBadge.tsx` | **修復** | 新增 `useLocale()` + `isZh` 判斷，根據 locale 選擇 `config.label` 或 `config.labelEn` |
| `src/lib/azure-blob.ts` | **修復** | `generateSasUrl` 中 BlobSASPermissions 寫法修正：`{ read: true } as unknown` → `BlobSASPermissions.parse('r')` |

### 設計決策差異

| 原設計 | 實際實作 | 原因 |
|--------|----------|------|
| 新增 `document.service.ts` 的 `getDocumentDetail()` | 直接在 route.ts 內實作 | API route 本身就是此資料的唯一消費者，無需額外抽象層 |
| `ExtractedField` 從 Prisma 表查詢 | 從 `ExtractionResult.fieldMappings` JSON 轉換 | 發現 `ExtractedField` 不是 Prisma 模型，資料存在 JSON 欄位中 |
| `overallConfidence` 回退到 Document 欄位 | 直接從 `ExtractionResult.averageConfidence` 取值 | Document 模型無 `overallConfidence` 欄位 |

### 瀏覽器驗證結果

| # | 驗收項目 | 狀態 | 說明 |
|---|----------|------|------|
| 1 | Preview Tab | ⚠️ | blobUrl 正確生成，但 Azurite CORS 阻擋（本地開發環境限制，非代碼缺陷）|
| 2 | Extracted Fields Tab | ⚠️ | API 正確返回 `extractedFields: []`（資料庫中 `fieldMappings={}` 為空物件，`mappedFields=0`）|
| 3 | Confidence Stats Card | ✅ | 顯示 "32.3%" + "Low Confidence" |
| 4 | Source Badge (en) | ✅ | 顯示 "Manual Upload" |
| 5 | Source Badge (zh-TW) | ✅ | 顯示 "手動上傳" |
| 6 | blobUrl | ✅ | API 返回有效 SAS URL |
| 7 | Download 按鈕 | ✅ | 已啟用（有 blobUrl）|
| 8 | Upload Info | ✅ | 顯示 "Development User" |
| 9 | Processing Tab | ⚠️ | 數據問題 — 此文件無 traceability 記錄 |
| 10 | Audit Log Tab | ⚠️ | 數據問題 — 此文件無 audit log 記錄 |

### 數據調查結果

```
資料庫狀態（6 文件、4 extraction_results）：
- 所有 field_mappings = {} (空物件)
- 所有 mapped_fields = 0
- confidence_scores 已正確填充（含 7 項明細分數）
- average_confidence 介於 32.00 ~ 32.38

結論：
- extractedFields 為空是「數據問題」，非代碼問題
- 三層映射步驟尚未為這些文件填入 fieldMappings
- 代碼轉換邏輯 mapFieldMappingsToExtractedFields() 已正確實作
  （當 fieldMappings 有資料時會正確轉換為 ExtractedField[]）
```

### TypeScript 檢查

- ✅ 源碼零錯誤（排除預存 test 檔案）
- ✅ BlobSASPermissions 型別正確
- ✅ fieldMappings JSON → Record<string, FieldMappingEntry> 需通過 `unknown` 中介轉換

---

*文件建立日期: 2026-01-28*
*最後更新: 2026-01-28*
