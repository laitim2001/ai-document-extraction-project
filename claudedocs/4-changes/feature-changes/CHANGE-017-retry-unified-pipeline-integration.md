# CHANGE-017: Retry 功能整合統一處理管線

> **建立日期**: 2026-01-28
> **完成日期**: 2026-01-28
> **狀態**: ✅ 已完成
> **優先級**: High
> **類型**: Integration / Bug Fix
> **影響範圍**: Epic 2 (文件重試) + Epic 15 (統一處理管線)
> **前置條件**: CHANGE-014 Phase 2 已完成、CHANGE-015 Phase 3 已完成

---

## 1. 變更概述

### 問題背景

Invoice 列表頁面 (`/invoices`) 的 **Retry（重試）** 按鈕目前調用的是 Epic 2 時期建立的舊版 OCR-only 處理管線（`extractDocument()`），而非 Epic 15 建立的統一 11 步處理管線（`UnifiedDocumentProcessorService`）。

這導致重試的文件**無法獲得完整的處理結果**，包括：公司識別、三層映射分類、信心度計算、路由決策、ExtractionResult 寫入、自動模版匹配等。

### 當前流程（過時）

```
User clicks Retry
  ↓
POST /api/documents/{id}/retry
  ↓
document.service.retryProcessing()
  ├─ 重置狀態為 UPLOADED
  ├─ 清空 processingQueue
  └─ extractDocument(id, { force: true })   ← ❌ Epic 2 舊版 OCR-only
      └─ 僅執行 OCR 提取，無後續處理
```

### 目標流程（統一管線）

```
User clicks Retry
  ↓
POST /api/documents/{id}/retry
  ↓
retryProcessing()（重構後）
  ├─ 重置狀態為 UPLOADED
  ├─ 清空 processingQueue + ExtractionResult
  └─ 觸發統一處理管線
      ├─ 下載 Azure Blob → Buffer
      ├─ UnifiedDocumentProcessorService.processFile()
      │   ├─ OCR (Azure DI / GPT Vision)
      │   ├─ Issuer Identification
      │   ├─ Company Detection
      │   ├─ Format Classification
      │   ├─ Term Extraction & Classification (三層映射)
      │   ├─ Confidence Calculation
      │   ├─ Routing Decision
      │   ├─ Field Extraction
      │   ├─ Validation
      │   ├─ Result Aggregation
      │   └─ Metadata Enrichment
      ├─ persistProcessingResult() → ExtractionResult + Document 更新
      └─ Fire-and-Forget: autoMatch() 自動模版匹配
```

---

## 2. 功能差異對比

| 處理步驟 | 當前 Retry（舊） | 統一管線（目標） |
|----------|:----------------:|:----------------:|
| OCR 提取 | ✅ | ✅ |
| 發行方識別 (Issuer ID) | ❌ | ✅ |
| 公司偵測 (Company Detection) | ❌ | ✅ |
| 格式分類 (Format Classification) | ❌ | ✅ |
| 術語提取與分類 (三層映射) | ❌ | ✅ |
| 信心度計算 (Confidence) | ❌ | ✅ |
| 路由決策 (Routing Decision) | ❌ | ✅ |
| 欄位提取 (Field Extraction) | ❌ | ✅ |
| 結果驗證 (Validation) | ❌ | ✅ |
| ExtractionResult 寫入 | ❌ | ✅ |
| Document 狀態更新 | ⚠️ 僅重置 | ✅ 完整更新 |
| autoMatch 自動匹配 | ❌ | ✅ |

---

## 3. 詳細設計

### 3.1 修改 `retryProcessing()`

**檔案**: `src/services/document.service.ts` (lines 492-528)

**現狀**:
```typescript
export async function retryProcessing(documentId: string): Promise<void> {
  // ...驗證...
  const retryableStatuses: DocumentStatus[] = ['OCR_FAILED', 'FAILED']
  // ...重置狀態...
  extractDocument(documentId, { force: true })  // ← 舊版
}
```

**修改方案**:

重構 `retryProcessing()` 使其：
1. 擴展可重試狀態，對齊 `/process` 端點的 `PROCESSABLE_STATUSES`
2. 重置時一併清除舊的 `ExtractionResult`（避免殘留數據）
3. 改為調用統一處理管線（複用 `/process` 端點的核心邏輯）

```typescript
import { downloadBlob } from '@/lib/azure-blob';
import { getUnifiedDocumentProcessor } from '@/services/unified-processor';
import {
  persistProcessingResult,
  markDocumentProcessingFailed,
} from '@/services/processing-result-persistence.service';
import { autoTemplateMatchingService } from '@/services/auto-template-matching.service';
import type { ProcessFileInput } from '@/types/unified-processor';

/** 允許重試的 Document 狀態 */
const RETRYABLE_STATUSES: DocumentStatus[] = [
  'OCR_FAILED',
  'FAILED',
  'UPLOADED',
  'OCR_COMPLETED',
  'MAPPING_COMPLETED',
];

export async function retryProcessing(documentId: string): Promise<void> {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });

  if (!document) {
    throw new Error('Document not found');
  }

  if (!RETRYABLE_STATUSES.includes(document.status)) {
    throw new Error(`Cannot retry document with status: ${document.status}`);
  }

  // 1. 重置狀態（清除舊數據）
  await prisma.$transaction([
    prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'OCR_PROCESSING',
        processingPath: null,
        routingDecision: Prisma.JsonNull,
        errorMessage: null,
        processingStartedAt: new Date(),
      },
    }),
    prisma.processingQueue.deleteMany({
      where: { documentId },
    }),
    // 清除舊的提取結果
    prisma.extractionResult.deleteMany({
      where: { documentId },
    }),
  ]);

  // 2. 非阻塞觸發統一處理管線
  (async () => {
    try {
      // 2a. 下載文件
      const fileBuffer = await downloadBlob(document.blobName);

      // 2b. 建構輸入
      const input: ProcessFileInput = {
        fileId: document.id,
        fileName: document.fileName,
        fileBuffer,
        mimeType: document.fileType,
        userId: document.uploadedBy ?? 'system',
      };

      // 2c. 執行統一處理
      const processor = getUnifiedDocumentProcessor();
      const result = await processor.processFile(input);

      // 2d. 持久化結果
      await persistProcessingResult({
        documentId: document.id,
        result,
        userId: document.uploadedBy ?? 'system',
      });

      // 2e. 觸發自動模版匹配
      if (result.success && result.companyId) {
        autoTemplateMatchingService.autoMatch(document.id).catch((err) => {
          console.error(`[Retry] Auto-match error for ${document.id}:`, err);
        });
      }

      console.log(`[Retry] Processing completed for ${document.id}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Retry] Processing failed for ${document.id}:`, msg);
      await markDocumentProcessingFailed(documentId, msg).catch(() => {});
    }
  })();
}
```

### 3.2 Retry API Route（最小修改）

**檔案**: `src/app/api/documents/[id]/retry/route.ts`

此 API route 本身**不需要修改**，因為它只是調用 `retryProcessing(id)`，底層邏輯的改變由 service 層處理。

### 3.3 RetryButton 組件（不需修改）

**檔案**: `src/components/features/invoice/RetryButton.tsx`

UI 組件已完整支援 loading 狀態、toast 通知和 i18n，不需修改。

---

## 4. 影響範圍

### 修改的檔案

| 檔案 | 修改類型 | 說明 |
|------|----------|------|
| `src/services/document.service.ts` | **重構** | `retryProcessing()` 改用統一管線 |

### 不需修改的檔案

| 檔案 | 原因 |
|------|------|
| `src/app/api/documents/[id]/retry/route.ts` | 僅調用 `retryProcessing()`，接口不變 |
| `src/components/features/invoice/RetryButton.tsx` | UI 層不受影響 |
| `src/hooks/use-documents.ts` | Hook 調用的 API 路徑不變 |

### 依賴的現有服務

| 服務 | 檔案 | 用途 |
|------|------|------|
| 統一處理器 | `src/services/unified-processor/` | 11 步處理管線 |
| 結果持久化 | `src/services/processing-result-persistence.service.ts` | ExtractionResult 寫入 |
| Azure Blob 下載 | `src/lib/azure-blob.ts` | 文件 Buffer 下載 |
| 自動模版匹配 | `src/services/auto-template-matching.service.ts` | autoMatch 觸發 |

---

## 5. 可重試狀態擴展

### 對比

| 狀態 | 當前可重試 | 修改後可重試 | `/process` 端點 | 說明 |
|------|:----------:|:------------:|:---------------:|------|
| `UPLOADED` | ❌ | ✅ | ✅ | 上傳後尚未處理 |
| `OCR_COMPLETED` | ❌ | ✅ | ✅ | OCR 完成但需重新處理 |
| `OCR_FAILED` | ✅ | ✅ | ✅ | OCR 失敗需重試 |
| `MAPPING_COMPLETED` | ❌ | ✅ | ✅ | 映射完成但需重新處理 |
| `FAILED` | ✅ | ✅ | ❌ | 一般處理失敗 |

> **設計決策**: Retry 保留 `FAILED` 狀態支援（與 `/process` 略有不同），因為 `FAILED` 是常見的重試場景。

---

## 6. 風險評估

| 風險 | 可能性 | 影響 | 緩解措施 |
|------|--------|------|----------|
| 統一處理器服務異常 | 低 | 高 | `markDocumentProcessingFailed` 記錄失敗狀態 |
| Azure Blob 下載失敗 | 低 | 中 | 錯誤處理 + 狀態標記 FAILED |
| ExtractionResult 清除影響 | 低 | 中 | 在 transaction 中執行，確保原子性 |
| 非阻塞處理無法追蹤 | 中 | 低 | 日誌記錄 + 文件狀態更新 |

---

## 7. 驗收標準

### 功能驗收

- [ ] 點擊 Retry 按鈕後，文件狀態變為 `OCR_PROCESSING`
- [ ] 處理完成後，文件狀態更新為 `MAPPING_COMPLETED` 或其他終態
- [ ] `ExtractionResult` 表中有對應的處理結果
- [ ] `overallConfidence` 欄位有值
- [ ] `routingDecision` 欄位有值（AUTO_APPROVE / QUICK_REVIEW / FULL_REVIEW）
- [ ] 處理成功且有 companyId 時，觸發 autoMatch
- [ ] 處理失敗時，文件狀態標記為 `FAILED` 並記錄 errorMessage

### UI 驗收

- [ ] Retry 按鈕在 `OCR_FAILED` 和 `FAILED` 狀態的文件上顯示
- [ ] 點擊後顯示 loading 狀態
- [ ] 成功後 toast 通知 + 列表自動刷新
- [ ] 失敗後 toast 顯示錯誤訊息

### 迴歸測試

- [ ] 正常上傳流程不受影響
- [ ] `/api/documents/[id]/process` 端點不受影響
- [ ] 文件詳情頁功能正常（FIX-034 修復不受影響）

---

## 8. 測試計劃

### 手動測試步驟

1. 上傳文件觸發統一處理管線
2. 模擬處理失敗（或找到 `FAILED` / `OCR_FAILED` 文件）
3. 點擊 Retry 按鈕
4. 確認文件重新進入處理
5. 確認處理完成後 ExtractionResult 有數據
6. 確認文件詳情頁顯示信心度、路由決策等資訊
7. 多語言驗證（en / zh-TW / zh-CN）

### 邊界情況

- 重試正在處理中的文件（應拒絕）
- 重試不存在的文件（應返回 404）
- Azure Blob 文件已刪除（應標記 FAILED）
- 連續快速點擊 Retry（按鈕 disabled 防止重複）

---

*文件建立日期: 2026-01-28*
*最後更新: 2026-01-28*
