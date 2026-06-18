# FIX-083: PDF 報表全掛 — pdfkit 需 serverExternalPackages + bufferPages（補完 FIX-081）

> **建立日期**: 2026-06-18
> **發現方式**: 用戶在本地 `http://localhost:3200/en/reports/monthly` 觸發 PDF 報表匯出，連續失敗，逐層排查
> **影響頁面/功能**: 所有 pdfkit PDF 報表（月度成本報表等）— 本地 dev 與 Azure 皆無法產出
> **優先級**: 高（核心報表功能完全不可用）
> **狀態**: ✅ 已修復（本地實測：報表成功產生 + 可下載；DB `monthly_reports` status=COMPLETED）

---

## 問題描述

`POST /api/reports/monthly-cost/generate` 一律回 500。排查時連續暴露**兩個接連的 bug**：

| # | 錯誤 | 階段 |
|---|------|------|
| BUG-1 | `ENOENT: ... .next/server/vendor-chunks/data/Helvetica.afm` | pdfkit 載入字型 |
| BUG-2 | `switchToPage(0) out of bounds, current buffer covers pages 3 to 3` | `addPdfFooter` 加頁尾 |

BUG-2 原本被 BUG-1 遮住（產生流程在 pdfkit 讀字型時就掛、走不到加頁尾）。此報表路徑**從未成功跑完過**。

---

## 根本原因

### BUG-1：pdfkit 被 webpack 打包，`__dirname` 指向 bundle

- `monthly-cost-report.service.ts:47` 以**靜態 import**載入 pdfkit：`import PDFDocument from 'pdfkit'`。
- Next 15 App Router **預設把 route handler 的 node_modules 依賴打包**進 `.next/server/vendor-chunks/`。
- pdfkit 於 runtime 以 `fs.readFileSync(__dirname + '/data/Helvetica.afm')` 讀標準字型 metric——被打包後 `__dirname` 指向 bundle 目錄（`.next/server/vendor-chunks/`），那裡沒有 `data/*.afm` → `ENOENT`。
- **關鍵**：`next.config.ts` 既有的手動 `config.externals.push({...})` 對「**靜態 import** 的 route handler 依賴」**壓不住**。它只對 `pdf-to-img` 那種 `await import()`（動態載入）有效——這就是 FIX-080 能靠 externals 修好 pdf-to-img、但 pdfkit 不行的原因。
- 連帶澄清：[[FIX-081]] 只在 Dockerfile 加 `COPY node_modules/pdfkit`，**不足以修好**——COPY 只保證 .afm 在映像裡，但 pdfkit 被打包後根本不讀 node_modules 那條路徑。

### BUG-2：`addPdfFooter` 用 `switchToPage` 但沒開 `bufferPages`

- `generatePdfReport`（637）建立 `new PDFDocument({ margin, size })`，**未開 `bufferPages`**。
- `addPdfFooter`（798）以 `bufferedPageRange()` + `switchToPage(i)` 回頭為每頁加頁尾。
- 沒開 buffer 時，pdfkit 隨產隨 flush，`bufferedPageRange()` 只剩當前頁 → `switchToPage(0)` 出界。

---

## 解決方案

### BUG-1：`serverExternalPackages`（App Router 正解）

`next.config.ts` 把 pdfkit 併入既有的 `serverExternalPackages`（原本只有 re2-wasm）：

```ts
serverExternalPackages: ['re2-wasm', 'pdfkit'],
```

→ pdfkit 不被打包、runtime 從 `node_modules` require、`__dirname = node_modules/pdfkit/js`，讀得到 `data/*.afm`。**搭配 [[FIX-081]] 的 Dockerfile `COPY node_modules/pdfkit`**（standalone trace 不含 .afm 資產），Azure 才完整修好。本地 dev 同樣靠此修法生效。

### BUG-2：`bufferPages: true`

```ts
const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true })
```

→ 全部頁面保留在 buffer，`addPdfFooter` 的 `switchToPage(0..n)` 才有效。

> 另兩個 pdfkit 報表（`audit-report.service.ts`、`lib/reports/pdf-generator.ts`）**未使用** `switchToPage`，無此 bug，未改動；它們的字型載入由 `serverExternalPackages` 一併受惠。

---

## 修改的檔案

| 檔案 | 修改內容 |
|------|----------|
| `next.config.ts` | `serverExternalPackages` 加入 `'pdfkit'`（併入既有 `['re2-wasm']`） |
| `src/services/monthly-cost-report.service.ts` | `generatePdfReport` 的 `PDFDocument` 加 `bufferPages: true` |

---

## 測試驗證

- [x] 本地 dev：`/en/reports/monthly` 產生 PDF 月度報表成功、可下載；DB `monthly_reports` (2026-04) `status=COMPLETED`、`error_message=null`、有 `pdf_path`
- [x] bundle 層確認：`.next/server` 不再含 pdfkit chunk、0 個檔案引用 `Helvetica.afm`
- [ ] CI：type-check + lint（PR）
- [ ] Azure 重建後：PDF 報表匯出在雲端成功（搭配 FIX-081 的 COPY）

---

## 關聯

- [[FIX-081]]：pdfkit COPY/openapi/CJK — 本 FIX **補完** FIX-081 的 pdfkit 部分（COPY 必要但不充分，缺 serverExternalPackages）。
- [[FIX-080]]：pdf-to-img/canvas（`await import()` 動態載入 + externals，故當時 externals 有效）。
- [[feedback-nextjs-standalone-native-deploy-traps]]
- 衍生：月度報表 `parseMonth` 月份 off-by-one（時區）→ 另開 FIX-084 處理。

---

*文件建立日期: 2026-06-18*
*最後更新: 2026-06-18*
