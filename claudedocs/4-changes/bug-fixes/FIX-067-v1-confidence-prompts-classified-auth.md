# FIX-067: v1 / confidence / prompts / classified-as-values 端點缺認證

> **建立日期**: 2026-06-10
> **發現方式**: 代碼審查（2026-06-10 全面安全審查）
> **影響頁面/功能**: `/api/v1/*`（內部管理）、`/api/confidence/*`、`/api/prompts/resolve`、`/api/companies/[id]/classified-as-values`
> **優先級**: 高
> **狀態**: 🔧 部分修復（2026-06-10）：confidence/prompts/classified 已修；`/api/v1` 留 WP-2、城市範圍留 WP-4
> **實作摘要**: confidence×2、prompts/resolve、classified-as-values 補 `auth()`（對齊既有審核端點慣例採基本登入）。v1 部分待 WP-2 ApiKey 雙軌分類；城市範圍 IDOR 留 WP-4。type-check + lint 通過。
> **來源**: SECURITY-ASSESSMENT.md §4（V1-1-A-01）、§5（V1-0-A-01、CONF-01、PROMPT-01、A-01/COMP4-01）、P0-DETAILED-PLAN.md WP-3e
> **相依**: 與 CHANGE-078（WP-2）的「session 或 ApiKey 雙軌」設計緊密相關，建議於 WP-2 後實作

---

## 問題描述

一批端點完全無認證，可未授權讀寫或洩漏內部資料。需先區分「對外 ApiKey API」與「內部 session API」（與 CHANGE-078 白名單一致）。

| # | 問題 | 嚴重度 | 端點:行 |
|---|------|--------|---------|
| BUG-1 (V1-1-A-01) | 整批 `/api/v1` 內部管理路由完全缺認證/授權 | Critical | `api/v1/**`（prompt-configs 等內部管理） |
| BUG-2 (V1-0-A-01) | 版本化 API 認證覆蓋率實測 0%（37 端點 60+ handler） | High | `api/v1/*` |
| BUG-3 (CONF-01) | 信心度三端點無認證，可讀取、觸發重算、污染審核歷史 | High | `api/confidence/[id]/route.ts:49,147`、`review/route.ts:55` |
| BUG-4 (PROMPT-01) | Prompt 解析端點無認證，洩漏公司特定 Prompt 配置（內部智財） | High | `api/prompts/resolve/route.ts:53,145` |
| BUG-5 (A-01/COMP4-01) | classified-as-values 無認證 + IDOR，可枚舉任意公司業務術語 | High | `api/companies/[id]/classified-as-values/route.ts:64-155` |

---

## 重現步驟
1. 不帶認證，GET `/api/prompts/resolve?...` 或 `/api/companies/<id>/classified-as-values`
2. 觀察現象：回傳內部 Prompt 配置 / 公司業務術語（應為 401）

---

## 根本原因
- 各 handler 缺 `auth()`；middleware 不保護 `/api`（CHANGE-078）。
- `/api/v1/*` 需區分對外 ApiKey（維持 ApiKey 驗證）與內部管理（補 session + 權限），目前一律無防護。

---

## 解決方案
1. **先分類 `/api/v1/*`**：標出哪些是對外 ApiKey API、哪些是內部管理 API（與 CHANGE-078 白名單盤點同步）。
2. 對外 ApiKey 類：確認維持 ApiKey 驗證（不強制 session）。
3. 內部管理類 + `confidence` + `prompts/resolve` + `classified-as-values`：補 `auth()` + 對應權限；依資源 `cityCode` 補城市範圍（classified-as-values、confidence）。

---

## 修改的檔案

| 檔案 | 修改內容 |
|------|----------|
| `src/app/api/v1/**/route.ts`（內部管理類，逐一盤點） | 補 `auth()` + 權限 |
| `src/app/api/confidence/[id]/route.ts`、`confidence/[id]/review/route.ts` | 補認證 + 城市範圍 |
| `src/app/api/prompts/resolve/route.ts` | 補認證 + 權限 |
| `src/app/api/companies/[id]/classified-as-values/route.ts` | 補 `auth()` + 城市/權限 |

---

## 測試驗證
- [ ] `/api/v1` 內部端點：未認證 → 401；對外 ApiKey 端點帶合法 key → 200
- [ ] confidence / prompts / classified-as-values：未認證 → 401；跨城市 → 403
- [ ] `npm run type-check && npm run lint` 通過
- [ ] 既有合法 API 客戶（ApiKey）不被誤擋

---

*文件建立日期: 2026-06-10*
*最後更新: 2026-06-10*
