# FIX-100: 上傳文件後 documents 頁面卡幾十秒（event loop 阻塞）

> **建立日期**: 2026-06-29
> **發現方式**: 用戶回報（上傳文件後馬上訪問 documents 頁面，必定卡幾十秒）
> **影響頁面/功能**: 上傳後的 documents 頁面載入（`/[locale]/documents` → `GET /api/documents`）
> **優先級**: 中（嚴重影響上傳後的操作體驗，但不影響資料正確性）
> **狀態**: ✅ 已實作（2026-06-29，type-check / lint 通過；端到端效果建議實測驗證）

---

## 問題描述

在 upload 頁上傳文件後，**馬上**點選 documents 頁面，頁面會卡住，可能隔幾十秒才有反應。經多次測試**必定出現**；**單一文件上傳也會發生**（用戶 2026-06-29 確認）。

---

## 重現步驟

1. 進入 `/zh-TW/documents/upload`，選城市，上傳 1 個 PDF。
2. 上傳成功後**立即**點側欄「文件列表」進入 `/zh-TW/documents`。
3. 觀察現象：頁面長時間 loading，幾十秒後才顯示列表。

---

## 根本原因

上傳 API（`upload/route.ts:357-405`）用 **fire-and-forget** 觸發處理 pipeline（`Promise.allSettled`），在**同一個 Node 進程**跑 OCR + GPT + PDF 處理。這個背景任務與 documents 頁面的 `GET /api/documents` 爭用單一進程資源。

### 調查脈絡（排除 → 鎖定）

| 假設 | 結論 |
|------|------|
| Prisma 連線池耗盡 | ❌ 單檔時單一 pipeline 最多佔 1–2 連線，pg Pool 預設 10 不會被耗盡 → 連線池非單檔主因 |
| 持久化長交易佔連線 | ❌ JSON 序列化在 `$transaction` **之外**完成，交易本身精簡（`processing-result-persistence.service.ts:228-247` vs `401-402`）|
| OCR/GPT 佔資源幾十秒 | ❌ 這些是 `await` IO，期間連線已歸還、event loop 空閒 |
| **PDF 渲染同步阻塞 event loop** | ✅ `pdf-converter.ts:146-179` 的 `pdf-to-img`（pdfjs）逐頁 rasterize 是**同步 JS CPU**（`dpi=200`，scale≈2.78），阻塞單線程主 event loop |
| **dev 每查詢 `console.log`** | ✅ `lib/prisma.ts:54` dev log 含 `'query'`，pipeline 數十個查詢 → 數十次同步 `console.log`，當 stdout 被導向檔案時累積阻塞主線程 |

> 註：`sharp` 壓縮（`pdf-converter.ts:293-327`）是 **native async**（libuv threadpool），**不阻塞**主 event loop，非元兇。

**核心**：單線程 Node event loop 被「PDF 逐頁渲染的同步 CPU」+「dev 大量同步 query log」佔住期間，所有 HTTP 請求（含 documents API）都無法被處理，造成幾十秒卡頓。

### 為何不採 C1（Worker Thread）

C1（PDF 轉換移 Worker Thread）可根治，但本專案 `next.config.ts` 為 `output: 'standalone'`，且 `pdf-to-img`/`pdfjs-dist` 標為 webpack externals。Worker 檔案與其 ESM/native 依賴極易被 standalone trace 漏搬 → 本地能跑、Azure 部署 ENOENT（與 FIX-079/081/083 同類地雷）。經與用戶確認，改採零部署風險的 C3。

---

## 解決方案（C3）

### ① PDF 逐頁渲染間讓出 event loop（`pdf-converter.ts`）

在 `for await (const page of document)` 迴圈每頁處理完後插入 `await new Promise((r) => setImmediate(r))`，把連續的 CPU burst 切成逐頁小塊，頁與頁之間讓出控制權，使前景請求（documents API）能在頁間被服務。**不改變輸出、不改變圖片品質**。

### ② dev 預設關閉 Prisma query log（`lib/prisma.ts`）

dev 環境 log 從 `['query', 'error', 'warn']` 改為預設 `['error', 'warn']`（移除 `'query'`）；保留 `PRISMA_QUERY_LOG=true` 可開回完整 query log 供除錯。**不影響生產**（生產本就只 `['error']`）。

---

## 修改的檔案

| 檔案 | 修改內容 |
|------|----------|
| `src/services/extraction-v3/utils/pdf-converter.ts` | `convertToBase64Images` 的逐頁迴圈末尾加 `await new Promise((r) => setImmediate(r))` 讓出 event loop |
| `src/lib/prisma.ts` | dev log 預設移除 `'query'`（`['error','warn']`）；`PRISMA_QUERY_LOG=true` 可開回 |

---

## 測試驗證

- [x] `npm run type-check` 通過
- [x] `npx eslint`（修改檔案）— 本次改動 0 新增 warning；`pdf-converter.ts` 的 `PageConversionResult` unused warning 為**既有**（非本次造成），依 surgical 原則不清理
- [ ] （建議）實測：上傳 PDF 後立即訪問 documents，回應時間明顯下降 — 待端到端量測

---

## 範圍與後續

- C3 對**多頁 PDF**（頁間 yield）與**所有情況的 query log 阻塞**有效。
- **單頁超大 PDF** 的單頁渲染期間仍無 yield 點——若日後遇到此極端情況仍卡，再評估 C1 的完整 Worker Thread + standalone 打包方案。
- 連線池韌性（方向 A：pg Pool `max` + 限背景並發）對**多檔批量上傳**仍有價值，列為獨立後續可選改善，不在本 FIX 範圍。

---

*文件建立日期: 2026-06-29*
*最後更新: 2026-06-29*
