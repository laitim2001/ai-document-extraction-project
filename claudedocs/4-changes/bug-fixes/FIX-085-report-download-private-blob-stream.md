# FIX-085: 報表下載改 server-side 串流（私有端點 Storage，瀏覽器無法直連 blob SAS URL）

> **建立日期**: 2026-06-18
> **發現方式**: FIX-083/084 部署後，在 Azure 成功產生月度成本 PDF 報表，但「下載」時跳轉到 blob SAS URL 失敗
> **影響頁面/功能**: 月度成本報表下載、審計報表下載
> **優先級**: 高（報表可產生但下載完全失效）
> **狀態**: ✅ 已實作（待部署後 Azure 驗證下載）

---

## 問題描述

在 Azure 成功產生 PDF 月度報表後，點「下載」跳到：

```
https://stscmdocprocessingdev.blob.core.windows.net/documents/reports/monthly-cost-2026-05.pdf?sv=...&sig=...
→ This site can't be reached / DNS_PROBE_FINISHED_NXDOMAIN
```

---

## 根本原因

下載端點回傳的是**直連 Azure Blob 公開端點的 SAS URL**（`generateSignedUrl`），由前端 `<a href=SAS>` 觸發。但本環境的 Storage 帳號 `stscmdocprocessingdev` 是**私有端點**（公開存取停用，見 [[FIX-078]] 環境）：

- **App**（在 VNet 內）→ 可經私有端點存取 blob。
- **瀏覽器**（公司網路、VNet 外）→ 解析不到 `stscmdocprocessingdev.blob.core.windows.net` → NXDOMAIN。

即「把直連 blob 的 URL 丟給瀏覽器、瀏覽器搆不到」。文件下載早已改 server-side 串流（`documents/[id]/blob/route.ts`），但**報表下載沒有**，直到報表能成功產生才暴露。

### 同病範圍（本次處理 2 個）

| 報表 | 服務 | 本次 |
|------|------|------|
| 月度成本報表 | `monthly-cost-report.service.ts` `getDownloadUrl` | ✅ 修 |
| 審計報表 | `audit-report.service.ts` `downloadReport` | ✅ 修 |
| 費用明細報表 | `expense-report.service.ts:529`（還會寄 email 連結） | 🚩 同病，另記後續 |
| 管理員日誌匯出 | `log-query.service.ts` + `LogExportDialog` `window.open` | 🚩 同病，另記後續 |

---

## 解決方案

照既有 `documents/[id]/blob/route.ts` 的 **server-side 串流** pattern：

- **Service**：用 `downloadBlob(path)`（app 經私有端點抓 blob）取得 `Buffer`，回傳 `{ buffer, fileName, contentType }`（取代回傳 SAS URL）。審計保留原驗證 + **下載稽核紀錄**（`auditReportDownload.create`）。
- **Route**：`new NextResponse(new Uint8Array(buffer), { headers: { Content-Type, Content-Length, Content-Disposition: attachment, Cache-Control } })` 串流回客戶端。
- **前端 Hook**：`fetch` → `response.blob()` → `URL.createObjectURL` → `<a download>` 觸發，並從 `Content-Disposition` 解析檔名。

---

## 修改的檔案

| 檔案 | 修改 |
|------|------|
| `src/services/monthly-cost-report.service.ts` | `getDownloadUrl` → `getReportFile`（回 buffer）；import `downloadBlob` 取代 `generateSignedUrl` |
| `src/app/api/reports/monthly-cost/[id]/download/route.ts` | 串流取代 JSON SAS URL |
| `src/hooks/use-monthly-report.ts` | `useDownloadMonthlyReport` 改 blob 下載 + 檔名解析 helper |
| `src/services/audit-report.service.ts` | `downloadReport` 回 buffer（保留驗證 + 下載稽核）；import `downloadBlob` |
| `src/app/api/audit/reports/[jobId]/download/route.ts` | 串流取代 JSON SAS URL（保留錯誤映射）|
| `src/hooks/useAuditReports.ts` | `useDownloadAuditReport` 改 blob 下載 |

> 呼叫端不受影響：頁面只用 `downloadMutation.mutate(...)` + `.isPending`，不讀回傳（已確認）。

---

## 測試驗證

- [ ] CI：type-check + lint
- [ ] 部署後 Azure：月度成本報表「下載」直接取得檔案（不再跳 blob SAS URL / NXDOMAIN）
- [ ] 審計報表下載正常 + 下載稽核紀錄仍寫入
- [ ] 本地（Azurite）下載正常

---

## 關聯

- [[FIX-078]]：blob 公開存取停用（同一私有端點環境）。
- [[FIX-083]]：修好 pdfkit 後報表能產生，才暴露此下載問題。
- 後續：`expense-report` + `admin logs export` 同病，建議另開 FIX 一併改 server-side 串流。

---

*文件建立日期: 2026-06-18*
*最後更新: 2026-06-18*
