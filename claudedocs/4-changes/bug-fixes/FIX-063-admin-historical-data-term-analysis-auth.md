# FIX-063: admin/historical-data、term-analysis、settings 端點缺認證與 admin 角色驗證

> **建立日期**: 2026-06-10
> **發現方式**: 代碼審查（2026-06-10 全面安全審查）
> **影響頁面/功能**: `/api/admin/historical-data/*`、`/api/admin/term-analysis`、`/api/admin/settings`
> **優先級**: 高
> **狀態**: ✅ 已修復（2026-06-10）
> **實作摘要**: BUG-1~8 共 13 個 admin 端點補 `auth()` + `hasPermission(ADMIN_MANAGE)`（沿用既有 `@/lib/auth/city-permission`，未另建 `requireAdmin` helper）；`getAuthSession(request)` 依賴全數移除改用 `auth()`；`document-preview-test/extract` 加檔案大小上限（超限回 413）。type-check `src/` 零錯誤、本批檔案 lint 無 error（僅既有 `no-console` warning，非本次引入）。執行期 401/403/200 行為 E2E 待 staging 驗證。
> **來源**: SECURITY-ASSESSMENT.md §4/§5、P0-DETAILED-PLAN.md WP-3a
> **相依**: 建議於 CHANGE-077（WP-1）、CHANGE-078（WP-2 登入閘）後實作；角色檢查邏輯可先開發

---

## 問題描述

`/api/admin/*` 多個管理端點完全無認證、或只驗「是否登入」而未驗 admin 角色。配合 middleware 不保護 `/api`（CHANGE-078），這些端點等同對外公開或可被任意登入者越權。

| # | 問題 | 嚴重度 | 端點:行 |
|---|------|--------|---------|
| BUG-1 (ADMIN0-01) | GET 完全無認證，洩漏 storagePath 內部路徑與發票業務資料 | Critical | `admin/historical-data/files/[id]/detail/route.ts:111` |
| BUG-2 (ADMIN0-02) | GET 完全無認證 | Critical | `admin/historical-data/batches/[batchId]/company-stats/route.ts:73` |
| BUG-3 (ADMIN0-03) | GET/POST/DELETE 全無認證，POST 觸發昂貴 LLM 聚合 | Critical | `admin/historical-data/batches/[batchId]/term-stats/route.ts:91,154,229` |
| BUG-4 (ADMIN0-04) | POST 無認證 + 無檔案大小限制，耗盡 OCR/GPT 成本 | Critical | `admin/document-preview-test/extract/route.ts:278` |
| BUG-5 (ADMIN-1-001) | GET/POST 完全無認證，可讀歷史術語並觸發 GPT 分類 | Critical | `admin/term-analysis/route.ts:63,130` |
| BUG-6 (ADMIN0-05) | 多個寫操作（含級聯刪除 + `fs.unlink`）只驗登入 | High | `admin/historical-data/batches/route.ts`、`[batchId]/route.ts`、`process/route.ts`、`files/[id]/route.ts`、`files/[id]/result/route.ts` |
| BUG-7 (ADMIN-1-002) | 系統設定寫入只驗登入、未驗 admin 角色 | High | `admin/settings/route.ts:131`、`[key]/route.ts:145,234` |
| BUG-8 (ADMIN-1-003) | 歷史資料管理只驗登入、未驗 admin 角色（含實體檔刪除/寫檔） | High | `admin/historical-data/files/route.ts`、`files/bulk/route.ts`、`upload/route.ts` |

> **附帶**：BUG-6/8 部分端點使用 `getAuthSession`（受 CHANGE-077 dev-bypass 影響），修復時改用統一 `requireAdmin`，移除 `getAuthSession(request)` 依賴。

---

## 重現步驟
1. 不帶任何認證，直接 GET `/api/admin/historical-data/files/<id>/detail`
2. 觀察現象：回傳含 storagePath 與發票業務資料（應為 401）

---

## 根本原因
- 各 handler 缺 `auth()` 呼叫或僅檢查 `session?.user` 而未檢查 admin 角色。
- 同群組授權基線不一致（`skip/route.ts` 有正確權限檢查，鄰近端點卻沒有）。
- 缺統一 `requireAdmin` 封裝，逐 handler 手寫導致遺漏。

---

## 解決方案

### 方案：建立統一 `requireAdmin` helper + 逐端點套用
1. 新增 `requireAdmin(session)`（或沿用既有權限工具）：驗證登入 + admin 角色（`isGlobalAdmin` 或對應 `ADMIN_*` 權限）。
2. 對 BUG-1~8 每個 handler 補 `auth()` + `requireAdmin`；未通過回 401/403。
3. 移除 `getAuthSession(request)` 依賴，改用 `auth()` + `requireAdmin`。
4. BUG-4 的 `document-preview-test/extract` 一併加檔案大小上限（與 WP-9 對齊）。

---

## 修改的檔案

| 檔案 | 修改內容 |
|------|----------|
| `src/lib/auth/`（新增 `require-admin.ts` 或沿用既有） | 統一 admin 驗證 helper |
| `src/app/api/admin/historical-data/files/[id]/detail/route.ts` | 補認證 + admin |
| `src/app/api/admin/historical-data/batches/[batchId]/company-stats/route.ts` | 補認證 + admin |
| `src/app/api/admin/historical-data/batches/[batchId]/term-stats/route.ts` | 補認證 + admin（含 POST/DELETE） |
| `src/app/api/admin/document-preview-test/extract/route.ts` | 補認證 + admin + 檔案上限 |
| `src/app/api/admin/term-analysis/route.ts` | 補認證 + admin |
| `src/app/api/admin/settings/route.ts`、`settings/[key]/route.ts` | 補 admin 角色 |
| `src/app/api/admin/historical-data/{batches,batches/[batchId],batches/[batchId]/process,files,files/bulk,files/[id],files/[id]/result,upload}/route.ts` | 改用 `requireAdmin`，移除 `getAuthSession` |

---

## 測試驗證

**程式碼層面（已驗證 2026-06-10）**
- [x] 每個端點補 `auth()` + `hasPermission(ADMIN_MANAGE)`，401/403 分支齊備（13 端點 grep + git diff 確認）
- [x] `getAuthSession` 依賴已全部移除（grep 計數 = 0）
- [x] `document-preview-test/extract` 加檔案上限，超限回 413
- [x] `npm run type-check`：`src/` 零錯誤（38 個錯誤全在 `tests/`，屬既有 test runner 型別配置問題，與本修復無關）
- [x] `npm run lint`：本批 13 檔案無 error（僅既有 `no-console` warning）

**執行期（待 staging 驗證）**
- [ ] 未認證 → 401；非 admin → 403；admin → 200 的實際 HTTP 行為
- [ ] 既有 admin 功能迴歸正常

> **實作差異說明**：原方案規劃新建 `requireAdmin(session)` helper，實作改為沿用既有 `hasPermission(session.user, PERMISSIONS.ADMIN_MANAGE)`（`@/lib/auth/city-permission`），達成相同的「登入 + admin 角色」驗證，避免重複造輪。

---

*文件建立日期: 2026-06-10*
*最後更新: 2026-06-10（狀態同步：程式碼已完成，標記 ✅ 已修復）*
