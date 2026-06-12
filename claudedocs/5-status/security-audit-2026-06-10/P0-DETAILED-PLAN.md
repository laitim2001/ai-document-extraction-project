# P0 地基工作包 — 詳細實作規劃

> **範圍**：WP-1（認證後門）、WP-2（Middleware API 認證閘）、WP-3（Critical 無認證端點）
> **建立**：2026-06-10　**狀態**：📋 規劃中（WP-1/WP-2 屬 H1，實作前需 approve）
> **前置盤點**：所有根因已逐行驗證（見本文件各「現狀」段）

---

## WP-1 — 認證 fail-open + dev-bypass 後門

### 涵蓋發現
I-01（降級為 Critical→High，見下）、I-02、ADMIN0-06、ADMIN-1-004、AUTH-01

### 現狀（已驗證）
1. `src/lib/auth.ts:91-93`：`isDevelopmentMode()` = `NODE_ENV==='development' || !isAzureADConfigured()`
2. `src/lib/auth.ts:394-400`：`getAuthSession(request)` 在 `isDevelopmentMode()` 為真時，`X-Dev-Bypass-Auth: true` → 回傳 `DEV_MOCK_SESSION`（isGlobalAdmin，權限 `['*']`，城市 `['*']`）
3. `src/lib/auth.config.ts:129`：登入 authorize 用 `NODE_ENV==='development' && !isAzureADConfigured()`（與 #1 不一致）
4. `getAuthSession(request)` 使用端點（已 grep）：僅 `admin/historical-data/batches/route.ts`、`batches/[batchId]/route.ts`、`batches/[batchId]/process/route.ts`、`files/route.ts`、`upload/route.ts`
5. `.env.example:56`：`NODE_ENV="development"`（部署陷阱）

### 修復步驟
| # | 檔案:行 | 改動 |
|---|---------|------|
| 1 | `auth.ts:92` | `\|\|` 改 `&&`，與 auth.config.ts:129 對齊 → 生產（NODE_ENV=production）永遠非 dev 模式，關閉 bypass |
| 2 | `auth.ts:80-85` | 更新註解，明確兩處語意一致（dev bypass 僅本地） |
| 3 | `auth.ts:394` | 額外硬性 gate：`if (process.env.NODE_ENV === 'development' && request)`，與 isDevelopmentMode 解耦，雙重保險 |
| 4 | `.env.example:56` | 加註解警告：生產務必設 `NODE_ENV=production`；考慮預設改 production + 註解說明本地改 development |
| 5 | 部署文件 | 在 `docs/07-deployment/` 加「NODE_ENV 必須為 production」檢查項 |

### 驗證
- 寫測試：`NODE_ENV=production` + Azure AD 未配置 + `X-Dev-Bypass-Auth: true` → 應回 null（非 DEV_MOCK_SESSION）
- 寫測試：`NODE_ENV=production` → `admin@ai-document-extraction.com` 密碼登入仍成功
- 手動：本地 `NODE_ENV=development` 下 DevLogin 與 bypass 仍可用

### 風險與相依
- ⚠️ **H1**：認證行為改變，需 approve。
- ⚠️ 改 #1 後，生產 Azure AD 未配置時 `isDevelopmentMode()` 變 false → `auth.ts:135` 會掛 `PrismaAdapter`。**需測試**：Credentials + JWT 策略下掛 adapter 不破壞本地帳號登入（JWT 策略理論上不依賴 adapter session，但須實測）。若有問題，將 adapter 判斷與 dev-bypass 判斷拆成兩個獨立條件。
- 規模：小（單檔為主），高影響、低正常使用衝擊（本地帳號不受影響）。

---

## WP-2 — Middleware `/api` 統一認證閘

### 涵蓋發現
V1-0-A-01（系統性）、放大全部 WP-3 無認證端點

### 現狀（已驗證）
1. `src/middleware.ts:91-98`：對 `/api`、`/_next`、含 `.`、`/favicon` 直接 `NextResponse.next()`
2. `src/middleware.ts:181`：`matcher: ['/((?!api|_next|.*\\..*).*)']` → **matcher 根本不匹配 /api**，middleware 對 API 完全不執行
3. `src/middleware.ts:13-14`：JSDoc 謊稱 `/api/v1/*` 受保護
4. `src/lib/auth.config.ts:272-307`：`authorized` callback 已有 `/api/v1`、`/api/auth` 邏輯，但因 matcher 不含 /api 而從未執行

### 修復策略（建議兩階段，降低誤擋風險）
**階段 A — 盤點公開白名單**（必做前置）
- 逐一確認「設計上公開」的端點，候選白名單：
  - `/api/auth/*`（NextAuth，必須公開）
  - `/api/health`（健康檢查）
  - `/api/n8n/webhook`、`/api/n8n/*`（改用 API Key/簽章驗證，非 session）— 見 WP-4/WP-8
  - `/api/docs`、`/api/openapi`（如為公開 API 文件）
  - `/api/v1/*`（對外 API，用 ApiKey 而非 session — 需區分）
- ⚠️ `/api/v1/*` 是對外 API（ApiKey 認證），不應強制 session；需設計「session 或 ApiKey 二擇一」邏輯，否則 WP-2 會誤擋合法 API 客戶。

**階段 B — 實作認證閘**
| # | 改動 |
|---|------|
| 1 | 新增 `src/middleware.ts` 的 API 分支（或獨立 API middleware）：非白名單 `/api/*` 要求登入 session |
| 2 | 調整 `matcher` 納入需保護的 `/api` 路徑（排除白名單） |
| 3 | 修正 JSDoc 與實際行為 |
| 4 | 先以「記錄但不阻擋」模式上線，蒐集會被擋的端點 → 確認白名單無遺漏 → 再切換強制阻擋 |

### 驗證
- 未登入存取受保護 `/api/*` → 401
- 白名單端點（health/auth/ApiKey v1）→ 正常
- 既有前端登入後所有功能正常（迴歸）

### 風險與相依
- ⚠️ **H1**：全站認證架構改動，需 approve。
- ⚠️ 白名單盤點不全會誤擋正常端點 → 階段 A 必做，階段 B 用監測模式過渡。
- ⚠️ middleware 只擋「未登入」，**不能取代** WP-3/WP-4 的角色與城市檢查。
- 規模：中。

---

## WP-3 — Critical 無認證端點補認證 / 授權

> 即使 WP-2 加了登入閘，這些端點仍需補**角色 + 城市範圍**，且部分有額外漏洞。建議拆 5 個獨立 FIX 並行（不同檔案，無衝突）。

### WP-3a — admin/historical-data + term-analysis + settings
**涵蓋**：ADMIN0-01/02/03/04/05、ADMIN-1-001/002/003
| 端點 | 現狀 | 動作 |
|------|------|------|
| `admin/historical-data/files/[id]/detail/route.ts:111` | 無認證 | 補 `auth()` + admin 角色 |
| `admin/historical-data/batches/[batchId]/company-stats/route.ts:73` | 無認證 | 同上 |
| `admin/historical-data/batches/[batchId]/term-stats/route.ts:91,154,229` | 無認證 | 同上 |
| `admin/document-preview-test/extract/route.ts:278` | 無認證 + 無檔案上限 | 補認證 + 檔案大小上限（見 WP-9） |
| `admin/term-analysis/route.ts:63,130` | 無認證 | 補 `auth()` + admin 角色 |
| `admin/settings/route.ts:131`、`[key]/route.ts:145,234` | 只驗登入 | 補 admin 角色 |
| `admin/historical-data/{batches,process,files,upload}` | 用 `getAuthSession`（受 WP-1 bypass 影響）只驗登入 | 改用統一 `requireAdmin`，移除 getAuthSession 依賴 |
**附帶**：建立統一 `requireAdmin(session)` helper，取代分散的 5 種角色判斷寫法。

### WP-3b — cost/pricing
**涵蓋**：RPT-001/002/003
| 端點 | 動作 |
|------|------|
| `api/cost/pricing/route.ts:75(GET),143(POST)` | 補認證 + 角色 |
| `api/cost/pricing/[id]/route.ts:60(GET),125(PATCH)` | 補認證 + 角色；移除第 152 行 `changedBy='system-admin'` 硬編碼，改用 session user |

### WP-3c — mapping API
**涵蓋**：DOCFLOW-01
| 端點 | 動作 |
|------|------|
| `api/mapping/[id]/route.ts:28`、`api/mapping/route.ts:50,111` | 補 `auth()` + 城市範圍（見 WP-4 helper） |

### WP-3d — test 端點（含 path traversal）
**涵蓋**：API-MISC-01、API-MISC-02
| 端點 | 動作 |
|------|------|
| `api/test/extraction-compare/route.ts:392,435` | **生產禁用**（`NODE_ENV` gate 回 404）；修 path traversal：第 435 行勿用使用者 `file.name`，改用 `randomUUID()` + 副檔名白名單 |
| `api/test/extraction-v2/route.ts:136,177` | 生產禁用；若保留則補認證 + 檔案上限 |
**決策**：建議 test/* 整組在生產環境停用（這些是開發測試端點）。

### WP-3e — v1 / confidence / prompts / classified-as-values
**涵蓋**：V1-1-A-01、V1-0-A-01、CONF-01、PROMPT-01、A-01/COMP4-01
| 端點 | 動作 |
|------|------|
| `api/v1/*`（internal 管理路由，非對外 ApiKey 類） | 逐一補 `auth()` + 權限；對外 ApiKey 類維持 ApiKey 驗證 |
| `api/confidence/[id]/route.ts:49,147`、`review/route.ts:55` | 補認證 + 城市範圍 |
| `api/prompts/resolve/route.ts:53,145` | 補認證 + 權限 |
| `api/companies/[id]/classified-as-values/route.ts:64-155` | 補 `auth()` + 城市/權限 |
**注意**：需先區分 `api/v1/*` 哪些是「對外 ApiKey API」哪些是「內部管理 API」，前者用 ApiKey、後者用 session，與 WP-2 白名單設計一致。

### 驗證（WP-3 共通）
- 每個端點：未認證 → 401；無權限角色 → 403；跨城市 → 403；合法 → 200
- 迴歸：既有合法呼叫不被誤擋

### 風險與相依
- H6：補認證屬修正既有缺陷，不偏離設計；但 WP-3d「生產禁用 test」是行為決策，需確認。
- 建議在 WP-1/WP-2 後做，但角色/城市檢查邏輯可先開發。

---

## 建議立案方式

| 工作包 | 文件 | 狀態 | H 約束 |
|--------|------|------|--------|
| WP-1 | CHANGE-077（認證 fail-open + dev-bypass 修復） | ⏳ 待實作 | H1 ✅ approved |
| WP-2 | CHANGE-078（middleware /api 認證閘） | ⏳ 待實作 | H1 ✅ approved |
| WP-3a | FIX-063（admin/historical-data + term-analysis + settings） | 🚧 待修復 | H6 |
| WP-3b | FIX-064（cost/pricing + 審計歸屬） | 🚧 待修復 | H6 |
| WP-3c | FIX-065（mapping API + 城市範圍） | 🚧 待修復 | H6 |
| WP-3d | FIX-066（test 端點禁用 + path traversal） | 🚧 待修復 | H6 |
| WP-3e | FIX-067（v1 / confidence / prompts / classified-as-values） | 🚧 待修復 | H6 |

> 全部 7 份 P0 立案文件已於 2026-06-10 建立完成。

## 待 approve 事項
1. WP-1、WP-2 屬 H1 架構改動 — 需明確同意方可實作。
2. WP-3d：test 端點生產禁用（建議）。
3. WP-2 階段 A 白名單：是否同意「對外 `/api/v1` 用 ApiKey、內部 API 用 session」的雙軌設計。
