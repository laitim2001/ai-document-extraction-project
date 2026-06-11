# CHANGE-078: Middleware `/api` 統一認證閘

> **日期**: 2026-06-10
> **狀態**: 🔧 實作中（程式碼完成、預設 `monitor` 模式上線就緒；type-check `src/` 零錯誤、eslint 通過；執行期驗收 + staging 監測日誌確認白名單後切 `enforce`）
> **實作摘要**: `src/middleware.ts` 新增 `handleApiAuthGate`：公開白名單（`/api/auth`、`/api/health`、`/api/docs`、`/api/openapi`）+ 對外 ApiKey 白名單（`/api/v1/invoices`、`/api/v1/webhooks`、`/api/n8n/webhook`）放行，其餘 `/api/*` 要求 session；`matcher` 納入 `/api/:path*`；兩階段由 `API_AUTH_GATE_MODE`（`monitor` 預設 / `enforce`）控制；修正誤導 JSDoc；`.env.example` 補環境變數說明。
> **優先級**: High
> **類型**: Security
> **影響範圍**: `src/middleware.ts`、`.env.example`、全部 `/api/*` 路由（行為層）
> **來源**: 2026-06-10 全面安全審查 — SECURITY-ASSESSMENT.md §3、P0-DETAILED-PLAN.md WP-2
> **H1 approval**: 用戶於 2026-06-10 明確 approve 此認證架構改動
> **設計決策確認**: 用戶 2026-06-10 拍板 — Q1 採「session 閘 + ApiKey 路徑白名單」、Q2 採「兩階段監測→強制」
> **相依**: 與 CHANGE-077（WP-1）同屬 P0 地基；FIX-063~067 的端點認證建立於本變更的登入閘之上

---

## 變更背景

全面安全審查發現：**middleware 完全不保護任何 `/api` 路由**，是所有「無認證 API 端點」Critical/High 的系統性放大器。

**已逐行驗證的根因**：
1. `src/middleware.ts:91-98`：對 `/api`、`/_next`、含 `.`、`/favicon` 直接 `NextResponse.next()`。
2. `src/middleware.ts:181`：`matcher: ['/((?!api|_next|.*\\..*).*)']` — **matcher 根本不匹配 `/api`**，middleware 對 API 完全不執行。
3. `src/middleware.ts:13-14`：JSDoc 聲稱 `/api/v1/*` 是「受保護路由」，與實際行為矛盾。
4. `src/lib/auth.config.ts:272-307`：`authorized` callback 已寫有 `/api/v1`、`/api/auth` 邏輯，但因 matcher 不含 `/api` 而從未執行。

**影響**：任何忘記寫 `auth()` 的 handler 等同對全網際網路公開。授權為逐 handler 手寫、無統一封裝（審查發現 5 種不同寫法），遺漏無可避免。

---

## 變更內容

> 採**兩階段**降低誤擋合法流量的風險。

### 階段 A：公開端點白名單盤點（必做前置）
逐一確認「設計上公開」或「非 session 認證」的端點，建立白名單。候選：

| 端點 | 認證方式 | 處置 |
|------|----------|------|
| `/api/auth/*` | NextAuth 自身 | 白名單（必須公開） |
| `/api/health` | 無 | 白名單 |
| `/api/n8n/webhook`、`/api/n8n/*` | API Key / 簽章 | 白名單（改用簽章驗證，見 WP-4/WP-8） |
| `/api/docs`、`/api/openapi` | 視設計 | 視為公開 API 文件則白名單 |
| `/api/v1/*`（對外 API） | **ApiKey** | **不可強制 session**，需「session 或 ApiKey 二擇一」 |
| 其餘 `/api/*`（內部） | session | 強制登入 |

> ⚠️ **關鍵約束**：`/api/v1/*` 多為對外 ApiKey API，若強制 session 會誤擋合法 API 客戶。需設計雙軌驗證。

### 階段 B：實作認證閘
1. 新增 API 認證檢查（middleware 分支或獨立 API middleware）：非白名單 `/api/*` 預設要求登入 session。
2. 調整 `matcher` 納入需保護的 `/api` 路徑。
3. 修正 `src/middleware.ts` JSDoc 與實際行為。
4. **過渡策略**：先以「記錄但不阻擋」模式上線，蒐集會被擋的端點清單 → 確認白名單無遺漏 → 再切換強制阻擋。

---

## 技術設計

### 修改範圍

| 文件 | 變更內容 |
|------|----------|
| `src/middleware.ts` | 移除 `/api` 無條件放行；matcher 納入受保護 `/api`；加 API 認證分支；修正 JSDoc |
| `src/lib/auth.config.ts` | 對齊 `authorized` callback 的 API 判斷（或改由 middleware 統一處理） |
| 新增 `src/lib/auth/require-api-auth.ts`（暫定） | 共用 API 認證 wrapper：session 或 ApiKey 二擇一 |

### i18n / 資料庫影響
無。

---

## 設計決策

1. **middleware 只負責「第一層：是否登入」** — 角色與城市範圍仍由各 handler（FIX-063~067、WP-4）負責，不在 middleware 做（Edge runtime 不查 DB）。
2. **`/api/v1` 雙軌（session 或 ApiKey）** — 兼顧內部使用者與對外 API 客戶。
3. **監測模式過渡** — 避免白名單遺漏造成生產中斷。

---

## ⚠️ 風險評估

| 風險 | 等級 | 緩解 |
|------|------|------|
| 白名單遺漏 → 誤擋合法端點 | 高 | 階段 A 完整盤點 + 階段 B 監測模式過渡 |
| `/api/v1` ApiKey 客戶被擋 | 高 | 雙軌驗證設計 |
| Edge runtime 對所有 API 加 `auth()` 的效能 | 中 | 評估 JWT 解碼成本；白名單減少不必要檢查 |
| 與 WP-1 改動交互 | 低 | 兩者同屬 P0，建議 WP-1 先行 |

## 回滾計劃
matcher 與 middleware 分支可獨立 revert；監測模式階段不影響現有行為。

---

## 驗收標準

| # | 驗收項目 | 驗收標準 | 優先級 |
|---|----------|----------|--------|
| 1 | 未登入擋下 | 未登入存取受保護 `/api/*` → 401 | High |
| 2 | 白名單放行 | health / auth / 公開端點正常 | High |
| 3 | ApiKey 雙軌 | `/api/v1` 帶合法 ApiKey → 正常 | High |
| 4 | 迴歸 | 既有前端登入後所有功能正常 | High |
| 5 | JSDoc 一致 | middleware 註解與行為相符 | Medium |

## 測試場景

| # | 場景 | 步驟 | 預期 |
|---|------|------|------|
| 1 | 未登入存取內部 API | 無 session 呼叫 `/api/documents` | 401 |
| 2 | 對外 API ApiKey | 帶 ApiKey 呼叫 `/api/v1/*` | 200 |
| 3 | 公開端點 | 呼叫 `/api/health` | 200 |
| 4 | 監測模式 | 開啟監測，蒐集被擋端點清單 | 日誌完整、不阻擋 |

---

## 實作記錄（2026-06-10）

### 實際實作 vs 規劃差異

| 項目 | 原規劃 | 實際實作 | 原因 |
|------|--------|----------|------|
| 雙軌認證 | 新增 `src/lib/auth/require-api-auth.ts`，「session 或 ApiKey 二擇一」wrapper | middleware 只驗 session；對外 ApiKey 路徑列白名單放行，ApiKey 驗證維持在各 handler（現狀已有） | **Edge runtime 限制**：`ApiKeyService.verify()` 需查 DB（Prisma），無法在 Edge middleware 執行。故不在 middleware 驗 ApiKey，改放行交 handler。 |
| 白名單範圍 | 候選清單（含 `/api/n8n/*` 整段） | 精確到 `/api/n8n/webhook`；`/api/v1` 僅 `invoices`/`webhooks` 子前綴放行，其餘 v1 內部管理端點要求 session | 避免把 v1 內部管理端點誤放行；n8n 管理端點仍需 session。 |
| 上線安全 | 監測模式過渡 | `API_AUTH_GATE_MODE=monitor`（預設）記錄但放行；確認後設 `enforce` 回 401 | 對齊用戶 Q2 決策。 |

### 白名單盤點結論（階段 A，已完成）

| 類別 | 端點 | middleware 處置 |
|------|------|----------------|
| 公開 | `/api/auth/*`、`/api/health`、`/api/docs/*`、`/api/openapi` | 放行 |
| 對外 ApiKey | `/api/v1/invoices/*`、`/api/v1/webhooks/*`、`/api/n8n/webhook` | 放行（handler 驗 ApiKey） |
| 受保護 | 其餘所有 `/api/*`（含 v1 內部管理端點） | 要求 session |

### Azure AD 環境盤點結論（回應 P0-DETAILED-PLAN 待確認 #2）

- `Dockerfile:75,127` 硬設 `ENV NODE_ENV=production` → 所有容器化部署（Azure App Service for Containers）在容器層為 `production`，覆蓋 .env 檔案。
- 盤點 `.env.azure-dev.local`：Azure AD 未配置。
- **結論**：CHANGE-077 fail-closed 修復對 Azure 環境安全且必要（修復前因「production + Azure AD 未配置」觸發舊 `||` 後門）；修復後這些環境改用 **seed 本地管理員帳號**登入，不會鎖死（容器啟動跑 seed）。
- ⚠️ **上線前置**：確認各環境本地管理員密碼已從預設 `ChangeMe@2026!` 改掉（屬 WP-7／INFRA-01）。

### 建議上線步驟

1. 部署（`API_AUTH_GATE_MODE` 未設或 `monitor`）→ 觀察日誌 `[API-AUTH-GATE][monitor]` 一段時間。
2. 若出現非預期被擋的合法端點 → 補入 `PUBLIC_API_PREFIXES` / `APIKEY_API_PREFIXES`。
3. 確認白名單無遺漏後，設 `API_AUTH_GATE_MODE=enforce` 並驗收（場景 1~4）。

### 待後續

- 執行期驗收（場景 1~4）需起服務 / staging 驗證。
- FIX-067 中 `/api/v1` 內部管理端點的逐 handler 角色檢查可於本閘上線後補強（middleware 只擋「未登入」，不含角色）。

---

## 相關文件
- SECURITY-ASSESSMENT.md §3、P0-DETAILED-PLAN.md WP-2
- 配套：CHANGE-077（WP-1）、FIX-063~067（WP-3）
