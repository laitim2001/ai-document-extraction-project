# FIX-066: test 端點生產禁用與 path traversal 修復

> **建立日期**: 2026-06-10
> **發現方式**: 代碼審查（2026-06-10 全面安全審查）
> **影響頁面/功能**: `/api/test/extraction-compare`、`/api/test/extraction-v2`
> **優先級**: 高
> **狀態**: ✅ 已修復（2026-06-10）
> **實作摘要**: test×2 生產禁用（404 guard）；path traversal 改 `randomUUID()` + 副檔名白名單。type-check + lint 通過。
> **來源**: SECURITY-ASSESSMENT.md §4（API-MISC-01）、§5（API-MISC-02）、P0-DETAILED-PLAN.md WP-3d
> **相依**: 可獨立實作（不阻塞於 WP-1/WP-2）

---

## 問題描述

開發測試端點在生產完全公開，且其中一個存在 path traversal 任意檔案寫入。

| # | 問題 | 嚴重度 | 端點:行 |
|---|------|--------|---------|
| BUG-1 (API-MISC-01) | 未認證 + 暫存檔名直接用使用者可控 `file.name`，造成 path traversal 任意檔案寫入（最壞 RCE） | Critical | `api/test/extraction-compare/route.ts:435`（觸發 392） |
| BUG-2 (API-MISC-02) | `extraction-v2`、`extraction-compare` 未認證觸發 Azure DI + OpenAI，且無檔案大小限制（成本濫用 / 記憶體 DoS） | High | `api/test/extraction-v2/route.ts:136,177`、`extraction-compare/route.ts:392` |

---

## 重現步驟
1. 不帶認證，POST `/api/test/extraction-compare`，上傳檔名含 `../` 的檔案
2. 觀察現象：檔案寫入路徑可被 `file.name` 操控（應拒絕或清洗）

---

## 根本原因
- `test/*` 為開發測試端點，但無 `NODE_ENV` gate，在生產仍可存取。
- `extraction-compare/route.ts:435` 以使用者 `file.name` 組裝暫存檔路徑，未清洗。
- 無檔案大小上限，觸發昂貴 AI/OCR。

---

## 解決方案

### 主方案：生產禁用 test 端點（建議）
1. `test/*` 整組加 `NODE_ENV` gate：非 development 回 404（已於用戶決策確認生產禁用）。

### 縱深防禦（即使保留亦需）
2. 修 path traversal：`extraction-compare/route.ts:435` 不使用 `file.name`，改 `randomUUID()` + 副檔名白名單。
3. 若保留則補認證 + 檔案大小上限 + MIME 內容驗證。

---

## 修改的檔案

| 檔案 | 修改內容 |
|------|----------|
| `src/app/api/test/extraction-compare/route.ts` | 生產禁用 gate；path traversal 修復（randomUUID + 副檔名白名單）；檔案上限 |
| `src/app/api/test/extraction-v2/route.ts` | 生產禁用 gate；（保留時）補認證 + 檔案上限 |

---

## 測試驗證
- [ ] 生產（`NODE_ENV=production`）存取 test 端點 → 404
- [ ] 開發環境功能保留正常
- [ ] 惡意檔名（含 `../`）不影響寫入路徑
- [ ] 超大檔 → 413/400
- [ ] `npm run type-check && npm run lint` 通過

---

*文件建立日期: 2026-06-10*
*最後更新: 2026-06-10*
