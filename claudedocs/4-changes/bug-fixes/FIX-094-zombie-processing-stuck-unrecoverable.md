# FIX-094: 處理程序中斷致文件永久卡在 processing 狀態（殭屍處理）無法自救

> **建立日期**: 2026-06-28
> **發現方式**: 用戶回報（Azure DEV 文件卡 OCR_PROCESSING 約 12 小時）+ 代碼追蹤
> **影響頁面/功能**: 文件處理管線 / 文件列表頁 + 詳情頁「重試」/ `retryProcessing`
> **優先級**: 中
> **狀態**: 🟡 方案 B 已實作（2026-06-28，`type-check` + 改動檔 `lint` 0 error 通過；待部署 Azure 驗證）。方案 A（閾值式手動重試）列為可選、尚未實作

---

## 問題描述

當文件處理流程在 `OCR_PROCESSING` 或 `MAPPING_PROCESSING` 階段被「硬中斷」（程序回收 / 逾時 / 容器重啟），文件狀態會**永久停留**在 processing 狀態，且：

1. 沒有任何背景機制會偵測或重試這類卡住的文件；
2. UI 與 service 三道關卡都不接受 processing 狀態重試 → 文件**無法從介面自救**，永遠不會完成也不會失敗。

實例（2026-06-28 Azure DEV）：`CEVA LOGISTICS_CEX240464_39613.pdf` 卡在 `OCR_PROCESSING` 約 12 小時。診斷確認 `error_message=null`、`processing_started_at=null`、`document_processing_stages` 空、`processing_queues` 空、`ocr_results=0`。同批次其他 5 份文件正常跑到 `MAPPING_COMPLETED`，僅此 1 份在 OCR 早期被中斷（未走到 catch 區塊標記 `OCR_FAILED`）。

| # | 問題 | 嚴重度 | 影響 |
|---|------|--------|------|
| BUG-1 | 處理中斷後狀態永久卡在 processing，無背景偵測 | 中 | 文件永久卡死、佔用「處理中」 |
| BUG-2 | UI/service 不接受 processing 狀態重試，無法自救 | 中 | 使用者無法從介面恢復 |

---

## 重現步驟

1. 上傳文件觸發處理（同步在 request 內跑：upload route → `UnifiedDocumentProcessor`）。
2. 在 OCR/映射階段使處理 request 中斷（容器回收 / 逾時）。
3. 觀察現象：文件狀態停在 `OCR_PROCESSING`（或 `MAPPING_PROCESSING`），`error_message` 為空，且文件列表頁與詳情頁皆**無「重試」按鈕**，無法恢復。

---

## 根本原因

### 主因 1：同步處理 + 無殭屍偵測
處理同步在 HTTP request 內執行，一旦該 request 程序被中斷，狀態永遠停在 processing；系統無任何背景 worker 掃描/回收卡住的文件。

### 主因 2：三道關卡皆拒絕 processing 狀態重試（雙重死局）
| 位置 | 現況 |
|------|------|
| `src/lib/document-status.ts:116-127` | `OCR_PROCESSING` 的 `canRetry: false`（列表頁 `DocumentListTable.tsx:317` 依 `statusConfig.canRetry` 不顯示重試按鈕） |
| `src/components/features/document/detail/DocumentDetailHeader.tsx:84` | `isRetryable = ['OCR_FAILED','FAILED'].includes(status)`，不含 processing 狀態（詳情頁不顯示按鈕） |
| `src/services/document.service.ts:567` | `retryProcessing()` 的 `retryableStatuses` 不含 `OCR_PROCESSING`/`MAPPING_PROCESSING`（後端拒絕） |

---

## 解決方案

> 關鍵約束：**不可無條件**對 processing 狀態開放重試，否則正在正常處理中的文件也會冒出重試按鈕，使用者誤點會中斷處理、造成競態與重複處理。必須以「卡住時間」為條件。

### 方向 B（建議優先，治本且風險最低）：背景偵測殭屍處理
新增定期 job（參考既有 `src/jobs/webhook-retry-job.ts` 模式），掃描 `status ∈ {OCR_PROCESSING, MAPPING_PROCESSING}` 且 `updatedAt` 超過閾值（建議 10 分鐘，可配置）的文件，自動標記為 `OCR_FAILED` + 寫入 `error_message`。文件因此回到**既有的失敗 → 重試路徑**，UI 三處邏輯**不需更動**，無競態風險。

### 方向 A（可選增強）：閾值式手動重試
新增以時間為條件的判斷（如 `isStaleProcessing(status, updatedAt)`），讓「卡在 processing 且超過閾值」的文件才顯示重試按鈕並被後端接受。需同步調整三處（`document-status.ts` 改用函數判斷、`DocumentDetailHeader.tsx` 的 `isRetryable`、`retryProcessing` 的 `retryableStatuses` + 加 `updatedAt` 守衛），三者邏輯與閾值須一致。

> 建議：先實作 B（自動回收，最小且安全）；A 視需要再加。

---

## 修改的檔案

> 本次實作**方案 B**（背景偵測回收）。方案 A（閾值式手動重試）尚未實作。

| 檔案 | 修改內容 |
|------|----------|
| `src/services/document.service.ts` | 新增 `sweepStuckProcessingDocuments()`（將逾時殭屍處理標記為 `OCR_FAILED`，`updateMany` 同時以 `status` 為條件防競態）+ `getStuckProcessingDocuments()`（唯讀狀態查詢）+ 常數 `DEFAULT_STUCK_THRESHOLD_MINUTES=10`、`STUCK_PROCESSING_STATUSES` |
| `src/jobs/stuck-processing-sweeper-job.ts`（新增） | `triggerStuckProcessingSweep()` + `getStuckProcessingStatus()` + `STUCK_PROCESSING_SWEEPER_CRON_CONFIG`（建議每 5 分鐘）；閾值可由 env `STUCK_PROCESSING_THRESHOLD_MINUTES` 覆蓋 |
| `src/app/api/jobs/stuck-processing-sweeper/route.ts`（新增） | POST 觸發（`x-cron-secret` 或 `INVOICE_REVIEW` 權限）+ GET 狀態（`INVOICE_VIEW`）；沿用 `pattern-analysis` route 的雙重驗證模式 |

### 實作說明

- **觸發方式**：與既有 job 一致，由外部排程器（n8n / Vercel Cron）或手動 `POST /api/jobs/stuck-processing-sweeper` 觸發；無常駐 worker。建議排程每 5 分鐘、閾值 10 分鐘。
- **防競態**：先 `findMany` 撈候選，再 `updateMany` 時於 `where` 同時要求 `status ∈ {OCR_PROCESSING, MAPPING_PROCESSING}`，確保不會誤標在掃描期間剛完成的文件。
- **回到既有路徑**：標記為 `OCR_FAILED` 後，文件即符合既有 UI 重試條件（列表頁 `canRetry` / 詳情頁 `isRetryable`）與 `retryProcessing` 後端條件，使用者可直接重試，**不需更動 UI 三處邏輯**、無競態風險。
- **logging**：沿用 `jobs/` 目錄既有風格（`console`），與 `pattern-analysis-job` / `webhook-retry-job` 一致；logger 遷移屬全專案漸進清理範圍，不納入本 FIX。
- **部署**：本項目 Azure 為手動 `az acr build`，需重建映像並部署後此功能才在 Azure 生效；並需在排程器（n8n）設定定期呼叫此端點。

---

## 測試驗證

- [ ] 模擬卡在 `OCR_PROCESSING` 超過閾值的文件 → 背景 job 自動標記為 `OCR_FAILED` + 寫入 `error_message`
- [ ] 正常處理中（未超過閾值）的文件**不被**標記、**不顯示**重試按鈕（無競態）
- [ ] 被標記 `OCR_FAILED` 後，列表頁與詳情頁出現重試按鈕，點擊可重跑完整 OCR→映射流程
- [x] `type-check` / 改動檔 `lint` 0 error 通過（2026-06-28）
- [ ] （方向 A 若採用）三處重試判斷邏輯與閾值一致

---

## 備註

- 本次（2026-06-28）已手動把該文件 `OCR_PROCESSING` → `OCR_FAILED` 解除阻塞，屬一次性資料修復，非根治。
- 本項目 Azure 部署為手動 `az acr build`，此 FIX 程式碼變更需走正常開發 + 手動部署流程才會在 Azure 生效。

---

*文件建立日期: 2026-06-28*
*最後更新: 2026-06-28*
