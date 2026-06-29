# FIX-097: 文件處理 API 授權用錯 session 欄位（對所有人 403 / 城市越權）

> **建立日期**: 2026-06-29
> **發現方式**: 代碼審查（FIX-096 實作授權時，發現同檔 `progress/route.ts` 用了不存在的 session 欄位），並以 Playwright 實測證實
> **影響頁面/功能**: 文件處理進度與統計 API（`/api/documents/[id]/progress`、`/api/documents/processing`、`/api/documents/processing/stats`）
> **優先級**: 高（端點對所有人 403 = 功能失效；其一另有城市越權資料外洩）
> **狀態**: ✅ 已修復（2026-06-29，3 路由全修；type-check / lint / live 驗證通過）

---

## 問題描述

3 個文件處理相關 API 的城市授權檢查讀取了 **`session.user` 上不存在的欄位** `user.role` 與 `user.cityAccess`。正確欄位應為 `user.isGlobalAdmin`（boolean）與 `user.cityCodes`（string[]，見 `src/types/next-auth.d.ts` 與 `src/lib/auth.ts` session callback）。

由於讀到的是 `undefined`：
- `isGlobalAdmin = user.role === 'GLOBAL_ADMIN'` → `undefined === 'GLOBAL_ADMIN'` → **恆 false**
- `userCities = user.cityAccess || []` → **恆為空陣列**

導致授權邏輯對**所有用戶（含全域管理員）**判斷錯誤。

| # | 路由 | bug 用法 | 實際影響 |
|---|------|---------|----------|
| BUG-1 | `GET /api/documents/[id]/progress` | 無條件城市檢查 | 對**所有人 403**（含 global admin，已實測）→ 進度輪詢完全失效 |
| BUG-2 | `GET /api/documents/processing/stats` | 無條件城市檢查 | 對**所有人 403** → 處理統計取不到 |
| BUG-3 | `GET /api/documents/processing` | 帶 `cityCode` 參數時城市檢查 | 帶 `cityCode` → **所有人 403**；不帶 `cityCode` → 因 `userCities` 恆空而**不套用城市過濾 → 回傳所有城市的處理中文件**（城市受限用戶越權看到全部）|

> 為何「表面看似正常」：文件仍由後端 pipeline 處理完成、最終狀態與結果由其他正常端點（文件詳情 GET）顯示；壞掉的只是即時進度輪詢/統計與城市過濾，屬靜默退化，未明顯報錯。

---

## 重現步驟

1. 以**全域管理員**（如 `admin@itpm.local`，`isGlobalAdmin=true`）登入本地環境。
2. 在已登入的瀏覽器 console 執行：
   ```js
   await (await fetch('/api/documents/<任一文件id>/progress')).json()
   ```
3. 觀察現象：回傳 `{ success: false, error: "Access denied" }`，HTTP **403**——即使是全域管理員也被擋。
   - （2026-06-29 實測：doc `2cd87d82-...` → 403 "Access denied"。）

---

## 根本原因

`session.user` 的型別（`src/types/next-auth.d.ts`）**沒有** `role` 或 `cityAccess` 欄位，只有 `roles`（陣列）、`cityCodes`、`isGlobalAdmin`、`isRegionalManager` 等（由 `src/lib/auth.ts` 的 session callback 設置）。

三個路由皆以**錯誤的型別斷言**繞過 TS 檢查後讀取不存在欄位：

```ts
// ❌ 錯誤（3 處相同）
const user = session.user as { cityAccess?: string[]; role?: string }
const userCities = user.cityAccess || []          // 恆 []
const isGlobalAdmin = user.role === 'GLOBAL_ADMIN' // 恆 false
```

斷言 `as { cityAccess?: ...; role?: ... }` 把欄位宣告為**可選**，故 TS 不報錯，runtime 取得 `undefined`，bug 被型別斷言遮蔽。

- `src/app/api/documents/[id]/progress/route.ts:93-95`
- `src/app/api/documents/processing/route.ts:75-77`
- `src/app/api/documents/processing/stats/route.ts:90-92`

> 參考：FIX-096 的 DELETE handler 採用**正確**欄位（`isGlobalAdmin` / `cityCodes`），可作為修復對照。

---

## 解決方案

### 修復：3 個路由改用正確的 session 欄位

移除錯誤的型別斷言，改用 `session.user` 既有的正確欄位：

```ts
// ✅ 修復後
const userCities = session.user.cityCodes ?? []
const isGlobalAdmin = session.user.isGlobalAdmin === true
```

其餘授權判斷邏輯（`!isGlobalAdmin && !userCities.includes(cityCode) && !userCities.includes('*')`）**維持不變**——只換資料來源，行為即恢復正確：

- 全域管理員：`isGlobalAdmin=true` → 通過。
- 城市用戶：`cityCodes` 正確載入 → 僅放行其城市、過濾正確。

> 🔴 **範圍**：只改「讀錯欄位」這一根因，不改授權策略、不改 service、不動其他路由。
> ⚠️ **是否納入 `isRegionalManager`**：現行三處邏輯僅用 global + city 兩層；本 FIX **維持原邏輯**，不順手加區域管理員處理（如需，另開 CHANGE）。

---

## 修改的檔案

> 以下為**實際**修改範圍。

| 檔案 | 實際修改內容 |
|------|------------|
| `src/app/api/documents/[id]/progress/route.ts` | 移除錯誤型別斷言（3 行 → 2 行）：`session.user.cityCodes` / `session.user.isGlobalAdmin`，授權邏輯不變 |
| `src/app/api/documents/processing/route.ts` | 同上 |
| `src/app/api/documents/processing/stats/route.ts` | 同上 |

> 三檔皆為相同的 2 行替換 + 移除中介 `user` 變數（該變數僅用於這 3 行）。授權判斷邏輯本身未動。

---

## 測試驗證

修復完成後需驗證：

- [x] 全域管理員打 `GET /api/documents/[id]/progress` → **200**（非 403），回傳進度資料（2026-06-29 實測）
- [x] 全域管理員打 `GET /api/documents/processing/stats?period=day&cityCode=HKG` → **200**（`totalProcessed: 7`）
- [x] 全域管理員打 `GET /api/documents/processing`（含與不含 `cityCode`）→ **200**
- [x] `npm run type-check` 通過
- [x] `npm run lint` 通過
- [ ] 城市受限用戶：僅能取得其 `cityCodes` 範圍內的文件/統計；跨城市 → 403 — 本次僅以 global admin 驗證 200 路徑，城市受限用戶過濾路徑未個別測（需另一帳號）
- [ ] 文件詳情頁的即時進度輪詢 UI 恢復更新 — API 已回 200，UI 端未個別觀察

### Live 驗證（2026-06-29，本地，全域管理員 admin@itpm.local）

| 端點 | 修復前 | 修復後 |
|------|--------|--------|
| `GET /api/documents/[id]/progress` | 403 "Access denied" | **200**（`stage: RECEIVED`）|
| `GET /api/documents/processing` | 帶 cityCode→403 | **200** |
| `GET /api/documents/processing/stats?...&cityCode=HKG` | 403 | **200**（`totalProcessed: 7`）|

---

*文件建立日期: 2026-06-29*
*最後更新: 2026-06-29*
