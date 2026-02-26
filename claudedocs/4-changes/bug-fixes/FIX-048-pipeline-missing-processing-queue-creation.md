# FIX-048: 提取管線缺失 ProcessingQueue 記錄建立

> **建立日期**: 2026-02-26
> **發現方式**: 資料庫查詢 — ProcessingQueue 表完全為空，38 筆 QUICK_REVIEW 文件無佇列記錄
> **影響頁面/功能**: `/review` — 審核佇列頁面（無法顯示待審核文件）
> **優先級**: P0 (Critical) — 直接影響核心文件審核流程
> **狀態**: ✅ 已完成
> **相關**: Epic 2 (文件處理), Epic 3 (審核工作流), CHANGE-021 (V3 統一提取重構), CHANGE-024 (V3.1 三階段架構)

---

## 問題描述

提取管線在完成信心度計算和路由決策後，從未建立 `ProcessingQueue` 記錄，導致 Review Queue API (`GET /api/review`) 查詢 `ProcessingQueue` 表時返回空結果。審核人員無法在 Review 頁面看到任何待審核文件。

### 數據證據

| 指標 | 值 | 說明 |
|------|-----|------|
| QUICK_REVIEW 文件數 | 38 筆 | `Document.processingPath = 'QUICK_REVIEW'` |
| ProcessingQueue 記錄數 | **0 筆** | 表完全為空 |
| 平均信心度 | 88% | 正確範圍（80-94%） |
| 路由決策正確性 | ✅ 正確 | `Document.routingDecision` 已正確設定 |
| `Document.processingPath` | ✅ 正確 | 已正確寫入 QUICK_REVIEW |
| `ExtractionResult.confidenceScores` | ✅ 正確 | 信心度已正確計算並持久化 |

### 缺失的流程

```
文件提取完成 → 信心度計算 ✅ → 路由決策 ✅ → Document.processingPath 更新 ✅
                                                    ↓
                              建立 ProcessingQueue 記錄 ❌ ← 這步缺失
                                                    ↓
                              Review Queue API 查詢 → 表為空 → 無結果
```

### 復現步驟

1. 上傳一份 PDF 文件並觸發自動提取（V3.1 管線）
2. 等待處理完成（Document.status = 'MAPPING_COMPLETED'）
3. 確認 `Document.processingPath` 已設為 'QUICK_REVIEW' 或 'FULL_REVIEW'
4. 導航至 `/review` 頁面
5. **預期**: 在審核佇列中看到該文件
6. **實際**: 審核佇列為空，無任何待審核文件

---

## 根本原因分析

### 問題本質：功能缺失（非條件判斷問題）

提取管線中**根本沒有**呼叫建立 ProcessingQueue 的邏輯。這不是條件判斷錯誤或邏輯跳過，而是整個步驟從未被整合到管線中。

### 詳細分析

#### 1. `routing.service.ts` 已實現 ProcessingQueue 建立邏輯（但從未被管線呼叫）

`routeDocument()` 函數（第 69-181 行）已完整實現路由決策和 ProcessingQueue 建立：

```typescript
// routing.service.ts 第 138-156 行
// 這段代碼已存在但從未被提取管線呼叫
if (decision.path === 'AUTO_APPROVE' && document.extractionResult) {
  await tx.extractionResult.update({ ... });
} else {
  // 創建或更新隊列項目
  await tx.processingQueue.upsert({
    where: { documentId },
    create: {
      documentId,
      cityCode: document.cityCode,
      processingPath: decision.path as ProcessingPath,
      priority,
      routingReason: decision.reason,
      status: QueueStatus.PENDING,
    },
    update: { ... },
  });
}
```

**但** `routeDocument()` 只在以下位置被呼叫：
- `src/app/api/routing/route.ts`（手動觸發的 API 端點）
- `routing.service.ts` 內部的 `batchRouteDocuments()`

**從未被** 提取管線（V3/V3.1）或持久化服務呼叫。

#### 2. 提取管線的持久化路徑完全繞過 `routeDocument()`

提取管線的實際資料流：

```
Upload API / Process API
    ↓
UnifiedDocumentProcessor.processFile()
    ↓ 返回 UnifiedProcessingResult（含 routingDecision）
persistProcessingResult() / persistV3_1ProcessingResult()
    ↓ 只寫入 ExtractionResult + 更新 Document
結束 ← 從未呼叫 routeDocument()，也未直接建立 ProcessingQueue
```

#### 3. `persistV3_1ProcessingResult()` 只做了部分工作

`processing-result-persistence.service.ts`（第 458-666 行）負責 V3.1 結果持久化：
- ✅ 寫入 `ExtractionResult`（信心度、提取結果、AI 詳情）
- ✅ 更新 `Document.processingPath`（QUICK_REVIEW / FULL_REVIEW / AUTO_APPROVE）
- ✅ 更新 `Document.routingDecision`
- ❌ **未建立 `ProcessingQueue` 記錄**

同樣，`persistProcessingResult()`（第 218-359 行）也缺失此步驟。

#### 4. Outlook/SharePoint 服務有建立 ProcessingQueue（但用途不同）

對比 `outlook-document.service.ts`（第 461-470 行）和 `sharepoint-document.service.ts`（第 243-252 行），這兩個服務在建立 Document 後立即建立 ProcessingQueue，但：
- 它們使用硬編碼的 `AUTO_APPROVE` 路徑
- 這是在提取**之前**建立的佔位記錄
- 提取完成後應該被 `routeDocument()` 更新（但同樣從未呼叫）

### 根因總結

| 層級 | 狀態 | 說明 |
|------|------|------|
| V3.1 提取管線 (`extraction-v3.service.ts`) | ✅ 正確 | 正確計算信心度和路由決策 |
| 統一處理器 (`unified-document-processor.service.ts`) | ✅ 正確 | 正確轉換 V3 結果為統一格式 |
| 持久化服務 (`processing-result-persistence.service.ts`) | ⚠️ **不完整** | 只持久化 ExtractionResult + Document，缺失 ProcessingQueue |
| 路由服務 (`routing.service.ts`) | ✅ 正確 | 已實現完整的 ProcessingQueue 建立邏輯 |
| **整合缺口** | ❌ **缺失** | 持久化服務完成後從未呼叫路由服務或直接建立 ProcessingQueue |

---

## 修復方案

### 方案選擇

| 方案 | 說明 | 優點 | 缺點 |
|------|------|------|------|
| **A: 在持久化服務中直接建立** | 在 `persistV3_1ProcessingResult` 和 `persistProcessingResult` 的 Prisma 交易中新增 `processingQueue.upsert` | 原子性保證、改動最小 | 與 `routing.service.ts` 有部分邏輯重複 |
| B: 在持久化後呼叫 `routeDocument` | 在 API 層（process/route.ts, upload/route.ts）持久化完成後呼叫 `routeDocument()` | 重用現有邏輯 | `routeDocument` 會重新查詢 Document 和計算信心度（冗餘操作） |
| C: 新增獨立的 Queue 建立函數 | 在 `routing.service.ts` 新增 `createQueueFromResult()` 函數 | 職責清晰 | 需修改更多文件 |

### 建議方案：方案 A — 在持久化服務中直接建立

**理由**：
1. 改動最小，只需修改 `processing-result-persistence.service.ts` 一個文件
2. ProcessingQueue 建立與 Document/ExtractionResult 更新在同一個 Prisma 交易中，保證原子性
3. 避免方案 B 中 `routeDocument` 的冗餘查詢和計算
4. 所有需要的數據（processingPath、信心度、cityCode）在持久化服務中已可取得

### 修改詳情

#### 修改文件 1: `src/services/processing-result-persistence.service.ts`

##### 修改 1a: `persistV3_1ProcessingResult()` — 在 Prisma 交易中新增 ProcessingQueue upsert

**位置**: 第 524-653 行（`prisma.$transaction` 區塊）

**現有代碼**（第 524-653 行）只包含兩個操作：
```typescript
const [extractionResult] = await prisma.$transaction([
  // 1. Upsert ExtractionResult
  prisma.extractionResult.upsert({ ... }),
  // 2. 更新 Document
  prisma.document.update({ ... }),
]);
```

**修改為**：在交易中新增第三個操作（僅對 QUICK_REVIEW 和 FULL_REVIEW）：

```typescript
// 需要在函數頂部取得 Document.cityCode
// 新增：在函數開頭查詢 Document 的 cityCode
const document = await prisma.document.findUnique({
  where: { id: documentId },
  select: { cityCode: true },
});

// ... 現有的計算邏輯 ...

// 決定 processingPath
const processingPath = result.routingDecision?.decision === 'AUTO_APPROVE'
  ? 'AUTO_APPROVE'
  : result.routingDecision?.decision === 'QUICK_REVIEW'
    ? 'QUICK_REVIEW'
    : 'FULL_REVIEW';

// 計算優先級（基於信心度）
const queuePriority = processingPath === 'FULL_REVIEW' ? 10
  : processingPath === 'QUICK_REVIEW' ? 5
  : 0;

// 使用 Prisma 交易確保原子性
const operations: Prisma.PrismaPromise<unknown>[] = [
  // 1. Upsert ExtractionResult（現有邏輯不變）
  prisma.extractionResult.upsert({ ... }),
  // 2. 更新 Document（現有邏輯不變）
  prisma.document.update({ ... }),
];

// 3. 建立或更新 ProcessingQueue（僅 QUICK_REVIEW 和 FULL_REVIEW）
if (processingPath !== 'AUTO_APPROVE' && result.success) {
  operations.push(
    prisma.processingQueue.upsert({
      where: { documentId },
      create: {
        documentId,
        cityCode: document?.cityCode || '',
        processingPath: processingPath as ProcessingPath,
        priority: queuePriority,
        routingReason: result.routingDecision?.reasons?.join('; ') || '信心度路由',
        status: 'PENDING' as QueueStatus,
      },
      update: {
        processingPath: processingPath as ProcessingPath,
        priority: queuePriority,
        routingReason: result.routingDecision?.reasons?.join('; ') || '信心度路由',
        status: 'PENDING' as QueueStatus,
      },
    })
  );
}

const [extractionResult] = await prisma.$transaction(operations);
```

##### 修改 1b: `persistProcessingResult()` — 同樣新增 ProcessingQueue upsert

**位置**: 第 258-348 行（`prisma.$transaction` 區塊）

與 1a 類似的修改，針對使用統一處理器（非 V3.1）路徑的文件：

```typescript
// 需要在函數頂部取得 Document.cityCode
const document = await prisma.document.findUnique({
  where: { id: documentId },
  select: { cityCode: true },
});

// ... 現有邏輯 ...

const operations: Prisma.PrismaPromise<unknown>[] = [
  // 1. Upsert ExtractionResult（不變）
  prisma.extractionResult.upsert({ ... }),
  // 2. 更新 Document（不變）
  prisma.document.update({ ... }),
];

// 3. 建立 ProcessingQueue（僅 QUICK_REVIEW / FULL_REVIEW）
if (processingPath && processingPath !== ProcessingPath.AUTO_APPROVE && result.success) {
  const queuePriority = processingPath === ProcessingPath.FULL_REVIEW ? 10 : 5;
  operations.push(
    prisma.processingQueue.upsert({
      where: { documentId },
      create: {
        documentId,
        cityCode: document?.cityCode || '',
        processingPath,
        priority: queuePriority,
        routingReason: `信心度 ${Math.round((result.overallConfidence ?? 0) * 100)}%`,
        status: 'PENDING' as QueueStatus,
      },
      update: {
        processingPath,
        priority: queuePriority,
        routingReason: `信心度 ${Math.round((result.overallConfidence ?? 0) * 100)}%`,
        status: 'PENDING' as QueueStatus,
      },
    })
  );
}

const [extractionResult] = await prisma.$transaction(operations);
```

##### 修改 1c: 新增必要的 import

在文件頂部新增 `QueueStatus` import：

```typescript
// 現有
import { Prisma, ProcessingPath } from '@prisma/client';
// 修改為
import { Prisma, ProcessingPath, QueueStatus } from '@prisma/client';
```

### 邊界情況處理

| 情境 | 處理方式 |
|------|----------|
| `AUTO_APPROVE` 路由 | **不建立** ProcessingQueue — 自動通過不需進入審核佇列 |
| 提取失敗 (`result.success === false`) | **不建立** ProcessingQueue — 失敗的文件不應進入審核佇列 |
| 重複處理同一文件 | 使用 `upsert`（以 `documentId` 為唯一鍵）— 更新而非重複建立 |
| `REF_MATCH_FAILED` 狀態 | **不建立** ProcessingQueue — 已在持久化中標記為 REF_MATCH_FAILED |
| `cityCode` 為空 | 使用空字串作為 fallback — ProcessingQueue.cityCode 為必填欄位 |
| 信心度未計算 | 不會觸發此問題 — 信心度計算是管線必要步驟，失敗時 `result.success` 為 false |

---

## 修改檔案清單

| # | 檔案 | 改動說明 |
|---|------|----------|
| 1 | `src/services/processing-result-persistence.service.ts` | 在 `persistV3_1ProcessingResult()` 和 `persistProcessingResult()` 的 Prisma 交易中新增 `processingQueue.upsert` |

### 不需要修改的檔案（確認不影響）

| 檔案 | 原因 |
|------|------|
| `src/services/routing.service.ts` | 已有完整的 `routeDocument()` 實現，保留作為手動路由 API 使用 |
| `src/services/extraction-v3/extraction-v3.service.ts` | 提取管線本身不需修改，路由決策已正確產出 |
| `src/app/api/review/route.ts` | Review Queue API 查詢邏輯正確，問題在於無數據 |
| `src/app/api/documents/[id]/process/route.ts` | API 層不需修改，持久化服務內部處理 |
| `prisma/schema.prisma` | ProcessingQueue 模型定義完整，無需修改 |

---

## 影響評估

| 項目 | 影響 |
|------|------|
| Review Queue 頁面 (`/review`) | **直接修復** — 修復後 QUICK_REVIEW/FULL_REVIEW 文件將出現在審核佇列 |
| Dashboard 統計 (`dashboard-statistics.service.ts`) | **間接受益** — 使用 ProcessingQueue 統計的數據將回歸正常 |
| 警報評估 (`alert-evaluation-job.ts`) | **間接受益** — backlog 計數依賴 ProcessingQueue.count |
| 審計查詢 (`audit-query.service.ts`) | **間接受益** — 查詢關聯 processingQueue 的查詢將有數據 |
| 費用報表 (`expense-report.service.ts`) | **間接受益** — processingQueue.completedAt 可作為處理完成時間 |
| 手動文件上傳處理流程 | **修復** — 上傳後自動處理的文件將正確進入佇列 |
| SharePoint/Outlook 自動獲取 | **無直接影響** — 這些服務有自己的 ProcessingQueue 建立邏輯（但語義不同） |

---

## 風險評估

| 風險 | 嚴重度 | 說明 |
|------|--------|------|
| 重複建立 ProcessingQueue | 極低 | 使用 `upsert`（documentId 為唯一鍵），不會重複 |
| 交易失敗導致不一致 | 極低 | 所有操作在同一 Prisma 交易中 |
| 影響現有 Outlook/SharePoint 流程 | 無 | 修改僅限持久化服務，不影響其他服務的 ProcessingQueue 建立 |
| 歷史文件缺失佇列記錄 | 中等 | 已處理的 38 筆 QUICK_REVIEW 文件需要補建佇列記錄（見下方補救措施） |

### 歷史數據補救

修復代碼只對**新處理**的文件生效。對於已處理但缺失 ProcessingQueue 的 38 筆文件，需要執行一次性的數據補救：

```sql
-- 為已有 QUICK_REVIEW/FULL_REVIEW 路由但缺失 ProcessingQueue 的文件補建記錄
INSERT INTO processing_queues (id, document_id, city_code, processing_path, priority, routing_reason, status, entered_at, created_at, updated_at)
SELECT
  gen_random_uuid(),
  d.id,
  d.city_code,
  d.processing_path,
  CASE WHEN d.processing_path = 'FULL_REVIEW' THEN 10 ELSE 5 END,
  '歷史數據補建',
  'PENDING',
  d.processing_ended_at,
  NOW(),
  NOW()
FROM documents d
LEFT JOIN processing_queues pq ON pq.document_id = d.id
WHERE d.processing_path IN ('QUICK_REVIEW', 'FULL_REVIEW')
  AND d.status = 'MAPPING_COMPLETED'
  AND pq.id IS NULL;
```

---

## 測試場景

### 測試 1: V3.1 管線 — QUICK_REVIEW 文件
1. 上傳一份 PDF，觸發 V3.1 處理
2. 等待處理完成（信心度 70-89%）
3. **驗證**: `ProcessingQueue` 表有一筆記錄，`processingPath = 'QUICK_REVIEW'`，`status = 'PENDING'`
4. **驗證**: `/review` 頁面顯示該文件

### 測試 2: V3.1 管線 — FULL_REVIEW 文件
1. 上傳一份低信心度文件（信心度 < 70%）
2. 等待處理完成
3. **驗證**: `ProcessingQueue` 表有一筆記錄，`processingPath = 'FULL_REVIEW'`
4. **驗證**: `/review` 頁面顯示該文件

### 測試 3: V3.1 管線 — AUTO_APPROVE 文件（不應建立佇列）
1. 上傳一份高信心度文件（信心度 >= 90%）
2. 等待處理完成
3. **驗證**: `ProcessingQueue` 表**無**該文件的記錄
4. **驗證**: `Document.status = 'MAPPING_COMPLETED'`，`processingPath = 'AUTO_APPROVE'`

### 測試 4: 提取失敗文件（不應建立佇列）
1. 上傳一份損壞的 PDF
2. 等待處理失敗
3. **驗證**: `ProcessingQueue` 表**無**該文件的記錄
4. **驗證**: `Document.status = 'OCR_FAILED'`

### 測試 5: 重複處理同一文件（upsert 測試）
1. 對同一文件觸發兩次處理
2. **驗證**: `ProcessingQueue` 表只有**一筆**記錄（upsert 更新而非重複建立）

### 測試 6: Review Queue API 完整流程
1. 上傳多份文件，確保有 QUICK_REVIEW 和 FULL_REVIEW
2. 呼叫 `GET /api/review`
3. **驗證**: 返回正確的待審核文件列表
4. **驗證**: 支援 `processingPath` 篩選
5. **驗證**: 支援信心度範圍篩選

### 測試 7: 歷史數據補救 SQL
1. 執行補救 SQL
2. **驗證**: 38 筆 QUICK_REVIEW 文件在 ProcessingQueue 中有記錄
3. **驗證**: `/review` 頁面顯示這些歷史文件

---

## 相關代碼位置參考

| 文件 | 行數 | 功能 |
|------|------|------|
| `src/services/processing-result-persistence.service.ts:458-666` | `persistV3_1ProcessingResult()` | V3.1 結果持久化（需修改） |
| `src/services/processing-result-persistence.service.ts:218-359` | `persistProcessingResult()` | 統一處理結果持久化（需修改） |
| `src/services/routing.service.ts:69-181` | `routeDocument()` | 完整的路由 + 佇列建立邏輯（參考實現） |
| `src/services/routing.service.ts:139-155` | `processingQueue.upsert` | ProcessingQueue 建立邏輯（參考） |
| `src/app/api/review/route.ts:108-129` | `processingQueue.findMany` | Review Queue API 查詢邏輯 |
| `prisma/schema.prisma:635-661` | `ProcessingQueue` model | 資料模型定義 |
| `src/app/api/documents/[id]/process/route.ts:178-182` | `persistProcessingResult` 呼叫 | API 層調用持久化 |
| `src/app/api/documents/upload/route.ts:383-387` | `persistProcessingResult` 呼叫 | Upload API 調用持久化 |

---

## ProcessingQueue 模型欄位參考

```prisma
model ProcessingQueue {
  id             String         @id @default(uuid())
  documentId     String         @unique @map("document_id")
  processingPath ProcessingPath @map("processing_path")    // QUICK_REVIEW | FULL_REVIEW
  priority       Int            @default(0)                // 優先級（越高越優先）
  routingReason  String?        @map("routing_reason")     // 路由原因
  assignedTo     String?        @map("assigned_to")        // 分配的審核者
  assignedAt     DateTime?      @map("assigned_at")
  status         QueueStatus    @default(PENDING)          // PENDING | IN_PROGRESS | COMPLETED | CANCELLED
  enteredAt      DateTime       @default(now())            // 進入佇列時間
  startedAt      DateTime?      @map("started_at")
  completedAt    DateTime?      @map("completed_at")
  fieldsReviewed Int?           @map("fields_reviewed")
  fieldsModified Int?           @map("fields_modified")
  reviewNotes    String?        @map("review_notes")
  cityCode       String         @map("city_code")          // 城市代碼（必填）
  // ... relations and indexes
}
```
