# FIX-073: 頁面層授權 gate（admin / report server component 缺角色檢查）

> **建立日期**: 2026-06-10
> **發現方式**: 代碼審查（2026-06-10 全面安全審查）
> **影響頁面/功能**: `src/app/[locale]/(dashboard)` route group、`admin/test/*`、`admin/template-field-mappings/*` 等 admin server component 頁面
> **優先級**: 高
> **狀態**: 🚧 待修復
> **來源**: SECURITY-ASSESSMENT.md §5 主題 C（A-01/A-02、PAGES-A-01/A-02）、REMEDIATION-ROADMAP.md WP-11
> **相依**: 聚焦頁面層授權；對應 API 由 FIX-063/066/067/071 收口

---

## 問題描述

`(dashboard)` route group 的共用 layout（`src/app/[locale]/(dashboard)/layout.tsx`）只做「是否登入」檢查（`await auth()` + 未登入 redirect），**完全沒有角色 / 權限 gate**。因此任何已登入的低權限使用者，只要知道 URL 即可直接開啟 admin 頁面。其中部分 admin server component 還會在 render 過程中**直接查 DB 並把結果回傳**到頁面，等同把管理資料洩漏給任意登入者。

本 FIX 聚焦**頁面層（server component）授權**。這些頁面消費的 API 端點本身的認證 / 授權缺口，由 FIX-063（admin/historical-data、term-analysis、settings）、FIX-066（test 端點生產禁用 + path traversal）、FIX-067（v1 / confidence / prompts / classified-as-values）、FIX-071（對應 test API 收口）分別處理，不在本 FIX 範圍。

| # | 問題 | 嚴重度 | 位置 |
|---|------|--------|------|
| BUG-1 (A-01) | `(dashboard)` route group layout 只驗登入未驗角色；大量 admin 子頁面繼承後仍無角色 gate | High | `src/app/[locale]/(dashboard)/layout.tsx:47-54` |
| BUG-2 (A-02) | `template-field-mappings` server component 直接查 DB（`prisma.templateFieldMapping` / `dataTemplate` / `company` / `documentFormat`）並回傳，無 `auth()` + 角色 gate | High | `admin/template-field-mappings/page.tsx`、`[id]/page.tsx:86-118`、`new/page.tsx` |
| BUG-3 (PAGES-A-01) | `admin/test/*` 三個測試工具頁面完全無角色 gate（`extraction-v2`、`extraction-compare` 為 `'use client'` 無任何 gate；`template-matching` 為 server component 無 gate） | High | `admin/test/extraction-v2/page.tsx`、`admin/test/extraction-compare/page.tsx`、`admin/test/template-matching/page.tsx` |
| BUG-4 (PAGES-A-02) | `admin/test/*` 頁面消費的 `/api/test/extraction-v2` 等 API 無認證（API 側由 FIX-066/FIX-071 收口；本 FIX 僅補頁面層 gate，避免未授權者載入工具頁） | High（API 部分轉交） | 頁面：同 BUG-3；API：`/api/test/extraction-v2`（FIX-066/071） |

---

## 重現步驟

1. 以一個**非 admin、無 `ADMIN_MANAGE` / `isGlobalAdmin`** 的已登入帳號登入系統。
2. 直接於瀏覽器輸入 `/{locale}/admin/template-field-mappings` 或 `/{locale}/admin/test/extraction-v2`。
3. 觀察現象：頁面正常渲染並回傳管理資料 / 測試工具（預期應 redirect 到 `dashboard?error=access_denied` 或 `notFound()`）。

---

## 根本原因

1. **route group layout 只擋「未登入」不擋「無角色」**：`(dashboard)/layout.tsx` 僅 `if (!session) redirect('/auth/login')`，沒有角色判斷。所有 admin 子頁面預設只繼承到「已登入」這層保護。
2. **頁面層授權靠各頁自行手寫，覆蓋不一致**：經盤點，`admin/` 下僅約半數頁面有 server 端角色 gate（見下方「既有範本」），其餘（含本 FIX 涵蓋的 `test/*`、`template-field-mappings/*`）完全沒有。
3. **client-side gate 不等於 server-side gate**：例如 `admin/config/page.tsx` 是 `'use client'`，用 `useSession()` 在客戶端 redirect，server 端資料仍會先載入、client redirect 可被繞過。本 FIX 涵蓋頁面的修復必須是 **server 端**判斷。
4. **server component 直查 DB**：`template-field-mappings/[id]/page.tsx` 在沒有任何授權前就執行多筆 Prisma 查詢並回傳結果，授權缺口直接等於資料洩漏。

---

## 盤點結果（既有授權現狀）

> 以下為本次 Read/Grep 實測，作為修復決策依據。

### `(dashboard)` route group layout 角色檢查現狀

| 項目 | 現狀 |
|------|------|
| `src/app/[locale]/(dashboard)/layout.tsx` | **只有** `await auth()` + 未登入 redirect（第 47-54 行），**無任何角色 / 權限 gate** |

### 已有 server 端角色 gate 的頁面（可作為範本）

| 頁面 | gate 寫法 | 模式 |
|------|-----------|------|
| `admin/users/page.tsx` | server component：`auth()` + `hasPermission(session.user, PERMISSIONS.USER_VIEW)` → 未過 redirect `dashboard?error=access_denied` | ⭐ 權限式（推薦範本） |
| `admin/roles/page.tsx` | 同上（`USER_VIEW` / `USER_MANAGE`） | 權限式 |
| `admin/monitoring/health/page.tsx` | `auth()` + `hasPermission(SYSTEM_MONITOR) \|\| isGlobalAdmin` → redirect | 權限式 + admin 旁路 |
| `admin/companies/review/page.tsx` | `auth()` + `hasPermission(FORWARDER_VIEW)` → redirect `/unauthorized` | 權限式 |
| `admin/integrations/outlook/page.tsx` | server component：`auth()` + `!session.user.isGlobalAdmin` → redirect `/dashboard` | isGlobalAdmin 式 |
| `admin/backup/page.tsx` | 同上（`isGlobalAdmin`） | isGlobalAdmin 式 |
| `companies/[id]/edit`、`companies/new` | `auth()` + `hasPermission(FORWARDER_MANAGE)` → redirect | 權限式 |
| `audit/query`、`global`、`reports/regional` | `auth()` + `isGlobalAdmin` / 角色判斷 → redirect | 混合 |

### 本 FIX 需補 gate 的頁面（目前完全無 server 角色 gate）

| 頁面 | 現狀 | 是否 server 直查 DB |
|------|------|----------------------|
| `admin/template-field-mappings/page.tsx` | server component，僅 `getTranslations`，無 gate | 否（資料由 client 組件取） |
| `admin/template-field-mappings/[id]/page.tsx` | server component，render 中 `prisma.*.findMany/findUnique`，僅 `notFound()` | **是**（4 筆查詢） |
| `admin/template-field-mappings/new/page.tsx` | server component，無 gate | 視內容（需確認） |
| `admin/test/extraction-v2/page.tsx` | `'use client'`，無 gate | 否 |
| `admin/test/extraction-compare/page.tsx` | `'use client'`，無 gate | 否 |
| `admin/test/template-matching/page.tsx` | server component，僅 `getTranslations`，無 gate | 否 |

### 既有頁面 gate 範本（可直接複用）

> 推薦以 `admin/users/page.tsx` 為主範本（server component + `hasPermission`）：

```typescript
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { hasPermission } from '@/lib/auth/city-permission'
import { PERMISSIONS } from '@/types/permissions'

export default async function SomeAdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const session = await auth()
  if (!session?.user) redirect(`/${locale}/auth/login`)
  if (!hasPermission(session.user, PERMISSIONS.ADMIN_MANAGE)) {
    redirect(`/${locale}/dashboard?error=access_denied`)
  }
  // ...原本的資料查詢與 render（授權通過後才執行）
}
```

> 對 `'use client'` 的 `admin/test/extraction-v2`、`extraction-compare`：需引入一個 server component 包裝（或將 gate 上移到 `admin/test/layout.tsx`），不可只靠 client `useSession()`。

---

## 解決方案

### 評估：route group 統一 gate vs 逐頁 gate

| 選項 | 方案 | 優點 | 缺點 / 風險 |
|------|------|------|-------------|
| A | **`(dashboard)/layout.tsx` 統一加角色 gate** | 一處改動覆蓋全部子頁 | `(dashboard)` 同時包含**非 admin** 頁面（dashboard、documents、review、reports、companies 等），統一加 admin gate 會誤擋一般使用者，**不可行** |
| B | **新增 `admin/layout.tsx` 統一 gate（推薦）** | admin 子樹單點收口；新增 admin 頁自動受保護；與現有 layout 嵌套機制相容 | 需確認各 admin 頁原有的**更細粒度**權限（如 `USER_VIEW` vs `SYSTEM_MONITOR`）是否該保留 → admin layout 用較寬的「是否 admin」基線，個別頁仍可疊加細權限 |
| C | **逐頁補 gate（沿用既有 pattern）** | 與既有半數頁面寫法一致；每頁可用精確權限 | 易再次遺漏；新增頁仍需記得加 |

**建議採選項 B + C 混合**：
1. 新增 `src/app/[locale]/(dashboard)/admin/layout.tsx`，做 admin 基線 gate（`auth()` + 「是 admin」判斷，未過 redirect `dashboard?error=access_denied`），作為 admin 子樹的**安全網**。
2. 本 FIX 涵蓋的頁面（`test/*`、`template-field-mappings/*`）若有更精確的權限語意，仍可在頁內疊加（與 `admin/users` 一致）；無特殊語意者由 admin layout 統一保護即可。
3. 「是 admin」基線判斷沿用既有 helper：`hasPermission(session.user, PERMISSIONS.ADMIN_MANAGE)` 或 `session.user.isGlobalAdmin`（與 FIX-063 一致，避免另造輪子）。

> ⚠️ **H6 決策點**：是否新增 `admin/layout.tsx`（route 結構改動）需用戶確認。若用戶傾向「不改 route 結構」，則退回選項 C 逐頁補 gate。本文件預設方案為 B+C，待用戶於實作前拍板。

### 不在本 FIX 範圍（API 側收口）

- `/api/test/extraction-v2`、`/api/test/extraction-compare` 的認證 / 生產禁用 → **FIX-066 / FIX-071**
- `/api/admin/template-field-mappings`、historical-data、term-analysis、settings → **FIX-063**
- `/api/v1/*`、`confidence`、`prompts/resolve`、`classified-as-values` → **FIX-067**

---

## 修改的檔案

| 檔案 | 修改內容 |
|------|----------|
| `src/app/[locale]/(dashboard)/admin/layout.tsx`（新增，選項 B） | admin 子樹基線角色 gate（`auth()` + admin 判斷 + redirect） |
| `src/app/[locale]/(dashboard)/admin/template-field-mappings/page.tsx` | 補 server 端角色 gate（若未由 admin layout 覆蓋則頁內補） |
| `src/app/[locale]/(dashboard)/admin/template-field-mappings/[id]/page.tsx` | gate 必須在 `prisma.*` 查詢**之前**執行 |
| `src/app/[locale]/(dashboard)/admin/template-field-mappings/new/page.tsx` | 補 server 端角色 gate |
| `src/app/[locale]/(dashboard)/admin/test/extraction-v2/page.tsx` | 由 admin layout 保護；若維持逐頁，需以 server 包裝補 gate（不可只靠 client `useSession`） |
| `src/app/[locale]/(dashboard)/admin/test/extraction-compare/page.tsx` | 同上 |
| `src/app/[locale]/(dashboard)/admin/test/template-matching/page.tsx` | 補 server 端角色 gate |

> **不修改**：`(dashboard)/layout.tsx`（選項 A 已否決，避免誤擋非 admin 頁面）。

---

## 測試驗證

**程式碼層面**
- [ ] admin 子樹（layout 或逐頁）已有 server 端角色 gate，未授權 redirect / `notFound`
- [ ] `template-field-mappings/[id]` 的角色 gate 在所有 `prisma.*` 查詢**之前**執行（授權前不查 DB）
- [ ] `admin/test/*` 三頁皆有 server 端 gate（`'use client'` 頁面改由 server 包裝，不依賴 client `useSession`）
- [ ] gate 沿用既有 `hasPermission(session.user, PERMISSIONS.ADMIN_MANAGE)` / `isGlobalAdmin`，未新造重複 helper
- [ ] 非 admin 頁面（dashboard / documents / review / reports / companies）行為**未受影響**（未誤加 admin gate）
- [ ] `npm run type-check`：`src/` 零新增錯誤
- [ ] `npm run lint`：本批檔案無新增 error
- [ ] 涉及任何新 UI 文字（如 access_denied 提示）→ `npm run i18n:check`（本 FIX 預期沿用既有 `error=access_denied` query 機制，無新增字串）

**執行期（待 staging 驗證）**
- [ ] 非 admin 已登入帳號開 `/admin/test/extraction-v2`、`/admin/template-field-mappings` → 被 redirect（非渲染內容）
- [ ] admin 帳號開上述頁面 → 正常 200
- [ ] 未登入直接開上述頁面 → redirect 到 `auth/login`（既有 `(dashboard)` layout 行為迴歸正常）

---

## 待用戶決策事項

1. **是否採選項 B（新增 `admin/layout.tsx`）** 作為 admin 子樹統一 gate？或退回選項 C 逐頁補 gate？（H6 決策點）
2. **admin 基線判斷**用 `PERMISSIONS.ADMIN_MANAGE` 還是 `isGlobalAdmin`？建議與 FIX-063 對齊（`ADMIN_MANAGE`）。
3. `template-field-mappings`、`test/*` 是否需要比「是 admin」更精確的權限語意？（預設：套 admin 基線即可）

---

*文件建立日期: 2026-06-10*
*最後更新: 2026-06-10*
