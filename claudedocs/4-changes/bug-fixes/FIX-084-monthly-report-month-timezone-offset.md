# FIX-084: 月度報表月份 off-by-one（parseMonth 用本地時區建構日期）

> **建立日期**: 2026-06-18
> **發現方式**: FIX-083 修好 PDF 報表後，檢查 DB 發現 `report_month` 與 `pdf_path` 月份對不上
> **影響頁面/功能**: 月度成本報表（`monthly_reports` 的 `reportMonth` 值、成本聚合視窗、前月比較）
> **優先級**: 中（非阻塞；本地 UI 顯示正常但 DB 原始值錯、且在 UTC 伺服器/跨時區會浮現）
> **狀態**: ✅ 已修復（程式碼修正；待產一次報表 runtime 驗證）

---

## 問題描述

產生 2026-05 月度報表後，DB `monthly_reports` 出現不一致：

| 欄位 | 值 | 預期 |
|------|-----|------|
| `report_month` | `2026-04-30` | `2026-05-01`（或該月任一日） |
| `pdf_path` | `reports/monthly-cost-2026-05.pdf` | ✓（用原始 `month` 字串，正確）|

`report_month` 比請求的月份**少了一天/退到上個月**。

---

## 根本原因

`parseMonth`（`monthly-cost-report.service.ts`）以**本地時區**建構日期：

```ts
const startDate = new Date(year, monthNum - 1, 1)   // 本地時區午夜
```

在 UTC+8（台灣/香港）環境，`new Date(2026, 4, 1)` = `2026-05-01T00:00:00+08:00` = **`2026-04-30T16:00:00Z`**。Prisma 以 UTC 儲存 → DB 的 `report_month` 變成 `2026-04-30`。月份邊界因此 off-by-one。

連帶：
- `formatMonth` 用本地 getter（`getMonth()`），在**同一個本地時區**讀回時剛好抵銷位移 → **UI 顯示看似正常**，掩蓋了問題；但**原始 DB 值是錯的**。
- `collectReportData` 的 SQL 聚合用 `startDate`/`endDate` 當視窗 → 整體偏移一個時區差（月初/月底邊界附近 ~16h 的紀錄會被錯誤納入/排除）。
- 在 **UTC 伺服器（如 Azure）** 上 `new Date(2026,4,1)` = `2026-05-01T00:00Z`，不位移 → 行為與本地 dev **不一致**（典型「本地一個樣、雲端另一個樣」的時區陷阱）。
- `getPreviousMonthStats` 用 `setMonth`/`setDate`/`setHours`（本地）對 UTC 日期做運算，會再引入位移。

---

## 解決方案

`parseMonth` / `formatMonth` / `getPreviousMonthStats` 全程改用 **UTC**：

```ts
// parseMonth
const startDate = new Date(Date.UTC(year, monthNum - 1, 1))
const endDate = new Date(Date.UTC(year, monthNum, 0, 23, 59, 59, 999))

// formatMonth
return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`

// getPreviousMonthStats
prevStart.setUTCMonth(prevStart.getUTCMonth() - 1)
prevEnd.setUTCDate(prevEnd.getUTCDate() - 1)
prevEnd.setUTCHours(23, 59, 59, 999)
```

UTC 一致後：`2026-05` → `reportMonth = 2026-05-01T00:00:00Z`（DB 顯示 2026-05-01）、聚合視窗為正確的 UTC 月份、本地 dev 與 Azure 行為一致。

---

## 修改的檔案

| 檔案 | 修改內容 |
|------|----------|
| `src/services/monthly-cost-report.service.ts` | `parseMonth`、`formatMonth`、`getPreviousMonthStats` 改用 `Date.UTC` / `getUTC*` / `setUTC*` |

---

## 測試驗證

- [ ] CI：type-check + lint
- [ ] 產一次月度報表，DB `report_month` 與請求月份一致（如 2026-05 → `2026-05-01`），與 `pdf_path` 月份相符
- [ ] 成本聚合數字與「以該月所有紀錄」一致（無邊界 off-by-one）

### ⚠️ 既有資料注意

`reportMonth` 是 upsert 唯一鍵的一部分。修正後同一月份的 `reportMonth` 值改變（如舊 `2026-04-30` vs 新 `2026-05-01`），與**修正前產生的舊紀錄不會匹配** → 重新產生會新增一筆而非更新舊的。DEV 環境可手動清掉舊的位移紀錄（目前無 production，無遷移風險）。

---

## 關聯

- [[FIX-083]]：修好 pdfkit PDF 報表後才得以檢視到此資料不一致。
- [[feedback-local-vs-azure-separation]]：又一個「本地時區 vs UTC 伺服器」差異案例。

---

*文件建立日期: 2026-06-18*
*最後更新: 2026-06-18*
