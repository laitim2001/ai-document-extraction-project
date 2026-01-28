# CHANGE-019: 統一管線中間處理狀態更新

> **建立日期**: 2026-01-28
> **完成日期**: 2026-01-28
> **狀態**: ✅ 已完成
> **優先級**: Medium
> **類型**: Enhancement (UX)
> **影響範圍**: Epic 15 (統一處理管線) + Epic 2 (發票列表 UX)
> **前置條件**: 無

---

## 1. 變更概述

### 問題背景

文件上傳後，狀態從 `UPLOADED` 直接跳到 `MAPPING_COMPLETED`，用戶體驗不佳。
統一處理管線（11 步）在內部執行完所有步驟後才一次性更新狀態，
使用者無法感知處理過程。

### 當前行為

```
文件上傳 → 狀態: UPLOADED
             ↓ （數秒內完成 11 步處理，無視覺回饋）
          狀態: MAPPING_COMPLETED    ← 突然出現
```

### 期望行為

```
文件上傳 → 狀態: UPLOADED
             ↓ （進入 OCR 提取步驟）
          狀態: OCR_PROCESSING       ← 🔄 旋轉動畫
             ↓ （進入欄位映射步驟）
          狀態: MAPPING_PROCESSING   ← 🔄 旋轉動畫
             ↓ （持久化結果）
          狀態: MAPPING_COMPLETED    ← ✅ 完成
```

### 根本原因

`UnifiedDocumentProcessorService.executePipeline()` 方法在執行 11 步處理時
**不更新 Document 狀態**。僅在最終的 `processing-result-persistence.service.ts`
才設定 `MAPPING_COMPLETED`（或 `OCR_FAILED`）。

---

## 2. 已有但未使用的基礎設施

| 基礎設施 | 位置 | 狀態 |
|----------|------|------|
| `DocumentStatus.OCR_PROCESSING` | `prisma/schema.prisma` | ✅ 已定義 |
| `DocumentStatus.MAPPING_PROCESSING` | `prisma/schema.prisma` | ✅ 已定義 |
| `ProcessingStatus` 組件 | `src/components/features/invoice/ProcessingStatus.tsx` | ✅ 已支援 `isProcessing` + `Loader2 animate-spin` |
| `document-status.ts` 配置 | `src/lib/document-status.ts` | ✅ `OCR_PROCESSING` / `MAPPING_PROCESSING` 已配置 |
| 列表頁 polling | `src/hooks/use-documents.ts` | ✅ `hasProcessingDocuments()` → 5s polling |
| 詳情頁 polling | `src/hooks/use-invoice-detail.ts` | ✅ `PROCESSING_STATUSES` → 3s polling |

**結論**: 所有 UI 基礎設施已就緒，只需在管線中加入中間狀態更新。

---

## 3. 技術設計

### 3.1 修改 `executePipeline()` — 加入狀態更新

**檔案**: `src/services/unified-processor/unified-document-processor.service.ts`

**方案**: 在管線迴圈中，於特定步驟前更新 Document 狀態：

```typescript
import { prisma } from '@/lib/prisma'

// 步驟 → Document 狀態映射
const STEP_STATUS_MAP: Partial<Record<ProcessingStep, string>> = {
  [ProcessingStep.AZURE_DI_EXTRACTION]: 'OCR_PROCESSING',
  [ProcessingStep.FIELD_MAPPING]: 'MAPPING_PROCESSING',
}

// 在 executePipeline 迴圈中：
for (const handler of this.stepHandlers) {
  context.currentStep = handler.step

  // 在關鍵步驟前更新 Document 狀態
  const newStatus = STEP_STATUS_MAP[handler.step]
  if (newStatus) {
    await prisma.document.update({
      where: { id: context.input.fileId },
      data: { status: newStatus },
    })
  }

  // ... 原有邏輯不變
}
```

---

## 4. 影響範圍

### 修改的檔案

| 檔案 | 修改類型 | 說明 |
|------|----------|------|
| `src/services/unified-processor/unified-document-processor.service.ts` | **修改** | 在 `executePipeline` 中加入中間狀態更新 |

### 不需修改的檔案

| 檔案 | 原因 |
|------|------|
| `prisma/schema.prisma` | `OCR_PROCESSING`、`MAPPING_PROCESSING` 已存在 |
| `src/lib/document-status.ts` | 已有完整狀態配置 |
| `src/components/features/invoice/ProcessingStatus.tsx` | 已支援 `isProcessing` 動畫 |
| `src/hooks/use-documents.ts` | 已有 5s polling（`hasProcessingDocuments`）|
| `src/hooks/use-invoice-detail.ts` | 已有 3s polling（`PROCESSING_STATUSES`）|
| `src/services/processing-result-persistence.service.ts` | 最終狀態設定不受影響 |

---

## 5. 風險評估

| 風險 | 可能性 | 影響 | 緩解措施 |
|------|--------|------|----------|
| 狀態更新增加 DB 操作 | 高 | 低 | 每個文件僅增加 2 次 `UPDATE`，開銷極小 |
| 管線中途失敗時狀態不一致 | 低 | 低 | `persistence.service.ts` 最終會設定正確狀態（`MAPPING_COMPLETED` 或 `OCR_FAILED`）|
| 狀態更新失敗影響管線 | 低 | 中 | 用 try-catch 包裝，失敗只 log 不中斷處理 |

---

## 6. 驗收標準

- [x] 上傳文件後，狀態依序顯示 `UPLOADED` → `OCR Processing 🔄` → `Mapping 🔄` → `Mapping Completed ✅`
- [x] `OCR Processing` 和 `Mapping` 狀態顯示旋轉動畫 (`Loader2 animate-spin`)
- [x] 列表頁在處理中狀態自動 5s 刷新
- [x] 處理失敗時狀態正確顯示 `OCR Failed` 或 `Failed`
- [x] TypeScript 零錯誤（排除預存 test 檔案）
- [x] 不影響批量處理功能

---

## 7. 實施順序

```
Phase 1: 建立 CHANGE-019 文件               ✅
Phase 2: 修改統一處理器管線                  ✅
Phase 3: TypeScript 檢查 + 瀏覽器驗證        ✅
```

---

## 8. 驗證結果

### 伺服器日誌確認

上傳 `BSI_HEX250124_00238.pdf` 後，管線日誌清楚顯示兩次中間 `UPDATE documents SET status`：

1. **`OCR_PROCESSING`** — 在 Step 7 (Azure DI/GPT 提取) 前觸發
2. **`MAPPING_PROCESSING`** — 在 Step 8 (Field Mapping) 前觸發
3. **`MAPPING_COMPLETED`** — 最終持久化（由 persistence service）

### 處理結果

- 公司識別: BSI LOGISTICS LIMITED (confidence: 93, method: HEADER)
- 提取信心度: 0.96
- 路由決策: FULL_REVIEW
- 處理完成: 所有步驟成功

---

*文件建立日期: 2026-01-28*
*最後更新: 2026-01-28*
