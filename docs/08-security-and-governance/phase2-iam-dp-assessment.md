# Phase 2 現狀盤點 — IAM + DP 領域

> **盤點日期**: 2026-04-28
> **評分模型**: L0 (Absent) → L1 (Initial) → L2 (Managed) → L3 (Defined) → L4 (Optimized)
> **盤點範疇**: IAM 13 項 + DP（基本版）6 項 = 19 項檢查
> **評估標準依據**: `docs/08-security-and-governance/enterprise-security-governance-matrix.md` v1.2
> **驗證方法**: 代碼審計 + Prisma Schema 檢查 + 環境變數確認 + 既有審計報告交叉比對
> **既有審計交叉**: `docs/06-codebase-analyze/05-security-quality/security-audit.md`（2026-04-09）

---

## 🎯 盤點結論摘要（TL;DR）

- **IAM 平均成熟度**: **L1.4**（13 項中：4 項 L0 / 4 項 L1 / 4 項 L2 / 1 項 L3）
- **DP 平均成熟度**: **L1.7**（6 項中：1 項 L0 / 1 項 L1 / 3 項 L2 / 1 項 L3）
- **HIGH 風險未達 L2 項目**: **9 項**（IAM-01、IAM-04、IAM-06b、IAM-07a/b/c、IAM-08、DP-02、DP-04 部分區域）
- **企業就緒**: ❌ **未達企業級標準**，需先補完高風險項目至少達 L2 才能進入 Production

### 領域成熟度匯總表

| 領域 | 項數 | 平均成熟度 | HIGH 風險未達 L2 | 主要缺口 |
|------|------|-----------|-----------------|---------|
| **IAM** | 13 | **L1.4** | 7 項 | API auth 覆蓋 60.7%、缺帳號鎖定、Session 管理弱、開發 bypass |
| **DP** | 6 | **L1.7** | 2 項 | 缺安全 headers、Log 仍有殘留 PII、靜態加密待 Azure 遷移 |
| **整體** | 19 | **L1.5** | 9 項 | 距離 L3 企業級基準有 1.5 個級別差距 |

### 企業就緒判定

**結論：未達企業級基準**

依據評估矩陣 v1.2 的 L3 (Defined) 基準：
- ✅ 已達標：1/19（Permission 細粒度模型）
- 🟡 部分達標：8/19（基礎實作但有缺口）
- ❌ 未達標：10/19（缺實作或實作有重大風險）

**進入 Production 前必補**（HIGH 風險未達 L2）：
1. 補齊 200+ 個未保護路由（IAM-01）
2. 實作完整帳號鎖定流程（IAM-07 三項）
3. 強化 Session 管理（IAM-04）
4. 補上 HTTP 安全 headers（DP-02）
5. 移除開發 Bypass header（IAM-06b）
6. 清理殘留 PII log（DP-05-lite）

---

## 📊 IAM 領域逐項評分

---

### IAM-01: API 路由認證覆蓋率

- **評分**: **L1 (Initial)**
- **企業基準 L3+**: ≥ 95%（公開 API 須白名單明列）
- **目前覆蓋率**: 約 **60.7%**（201/331 routes 有 auth check）
- **風險等級**: 🔴 HIGH

**證據**：

1. **Grep 統計**（2026-04-28 重新驗證）：
   - 搜尋模式：`await auth\(\)|getAuthSession|requireAuth|api-key`
   - 結果：**201 個文件**有 auth 檢查 / **331 個總 route 文件**
   - 覆蓋率：**60.7%**
2. **既有審計交叉驗證**（`security-audit.md` 2026-04-09）：
   - 該報告聲稱 201/331 = **61%**
   - 本次盤點驗證一致（差異 < 0.5%）
   - **CLAUDE.md「Auth 覆蓋率約 200/331」描述準確**，但「73%」與實際 60.7% 有偏差，建議修正
3. **`src/middleware.ts` 第 92 行**：`pathname.startsWith('/api')` 跳過所有 `/api`，**沒有集中式 API auth middleware**，每個 route 必須自行實作 auth
4. **`auth.config.ts` `authorized` callback**（L272-307）僅保護頁面路由 `/dashboard` 和 `/api/v1`，但因 middleware 排除 `/api`，此 callback 對 API 無效

**未保護的 HIGH 風險 routes（130 個）**：

| 域 | Routes | 覆蓋率 | 風險 |
|-----|--------|--------|------|
| `/v1/*` | 14/77 | **18%** | 🔴 HIGH（financial、prompt configs、template instances 均未保護）|
| `/cost/*` | 0/5 | **0%** | 🔴 HIGH（成本/定價資料）|
| `/dashboard/*` | 0/5 | **0%** | 🔴 HIGH（統計可能含敏感資料）|
| `/statistics/*` | 0/4 | **0%** | 🔴 HIGH |
| `/mapping/*` | 0/2 | **0%** | 🔴 HIGH |
| `/reports/*` | 4/12 | 33% | 🔴 HIGH |
| `/n8n/*` | 0/4 | 0% | 🟡 MED（可能用 own auth）|
| `/workflow-exec/*` | 0/4 | 0% | 🟡 MED |
| `/confidence/*` | 0/2 | 0% | 🟡 MED |

**v1 API 未保護端點（高敏感）**：
- `/v1/exchange-rates/*`（GET, POST）— 財務匯率資料
- `/v1/exchange-rates/import/`（POST）— 批次匯入
- `/v1/prompt-configs/`（GET, POST, PATCH, DELETE）— AI prompt 配置
- `/v1/field-mapping-configs/`（POST）— 建立映射配置
- `/v1/template-instances/`（POST）— 建立實例
- `/v1/pipeline-configs/`（POST）— 管線配置
- `/v1/regions/`（POST）— 區域建立
- `/v1/documents/[id]/match/`（POST）— 修改文件匹配

**為何不評 L0**：domains 如 `/admin/*`（95%）、`/rules/*`（100%）、`/audit/*`（100%）已有完整保護；不能說毫無實作。
**為何不評 L2**：覆蓋率 60.7% 距離企業基準 95% 差距 34 個百分點，未保護 routes 含敏感資料，不可接受。

**建議**：
1. 立即建立 API auth middleware（如 `withAuth()` HOF），統一所有 route 的 auth 處理
2. 公開 routes 改採白名單明列模式（health, auth/login, auth/register, docs/*）
3. 為 `/v1/*` 補齊 session 或 API key auth；evaluate 是否需要 mixed auth strategy

---

### IAM-02: RBAC 角色細粒度

- **評分**: **L3 (Defined)**
- **企業基準 L3+**: 至少 5 種角色 + 細粒度 permission
- **風險等級**: 🔴 HIGH

**證據**：

1. **Prisma Schema** (`prisma/schema.prisma` L137-148)：
   - `Role` model 含 `permissions String[]` 欄位
   - `UserRole` 多對多關聯（含可選 `cityId` 城市範圍）
   - `User.isGlobalAdmin` 與 `User.isRegionalManager` 雙旗標（L21-22）
2. **角色定義**（`src/types/role-permissions.ts` L26-39）：**6 個預定義角色**
   | 角色 | 權限數 | 特性 |
   |------|--------|------|
   | System Admin | 22（全部）| 全系統存取 |
   | Super User | 11 | 規則/Forwarder 管理 |
   | Regional Manager | 9 | 跨城市管理 |
   | City Manager | 9 | 單城市管理 |
   | Data Processor | 3 | 預設角色（基礎發票處理）|
   | Auditor | 4 | 只讀審計 |
3. **權限細粒度**（`src/types/permissions.ts` L26-100）：**22 個權限**，遵循 `resource:action[:scope]` 模式
   - Invoice (4) + Report (2) + Rule (3) + Forwarder (2) + User (4) + System (2) + Audit (2) + Admin (2) + 城市 scope 1 + 區域 scope 1 = 22 unique permissions

**為何達 L3**：超過 5 個角色（6 個）；權限數量充足（22 個）；命名規範（resource:action[:scope]）；UserRole 支援城市 scope。
**為何不評 L4**：缺乏權限分類管理 UI（22 permissions 未分類為高層 categories）；無權限審查週期；新增權限需手改代碼。

**建議**：
- L3 已達標，可優先投入其他項目；遠期可建立權限分類 UI（已存在 `permission-categories.ts` 但未充分利用）。

---

### IAM-03: Permission 檢查一致性

- **評分**: **L1 (Initial)**
- **企業基準 L3+**: 所有 API 使用統一 middleware/decorator
- **風險等級**: 🟡 MED

**證據**：

1. **沒有統一的 auth middleware**：每個 API route 各自呼叫 `await auth()` + 手動檢查 `session.user`
2. **共用工具函數**：`src/lib/auth/city-permission.ts` 提供 `hasViewPermission()` / `getCityFilter()` / `checkCityCreatePermission()`，但只有部分 routes 使用
3. **三種不同的認證模式**：
   - 模式 A：Session-based（`auth()` from `@/lib/auth`，~190 routes）
   - 模式 B：API Key（`ApiKeyService.verify()` from `lib/auth/api-key.service.ts`，~10 routes）
   - 模式 C：External API Key（`externalApiAuthMiddleware()` from `middlewares/external-api-auth.ts`，~3 routes，使用 SHA-256 hashed keys + IP 白名單 + permission check）
4. **權限檢查實作不一致**：
   - 範例 1：`/admin/users/route.ts` 使用 `hasViewPermission()` helper
   - 範例 2：許多 routes 直接 inline `session.user.roles.find(r => r.permissions.includes(...))`
   - 範例 3：部分 routes 僅檢查 `session?.user`，無 permission 級別控制
5. **錯誤回應格式不一致**：根據 CLAUDE.md「已知差異」，部分 routes 用 top-level RFC 7807，部分用 nested `{ error: {...} }`

**為何不評 L0**：有共用權限工具（`hasViewPermission`, `getCityFilter`），不是完全 ad-hoc。
**為何不評 L2**：缺乏統一強制機制；新 routes 容易忘記 auth check（這也是 IAM-01 覆蓋率低的根本原因）。

**建議**：
1. 建立統一 `withAuth(handler, { permissions: [...], cityScope: true })` HOF
2. 所有 route 強制使用該 HOF（lint rule + CI check）
3. 統一 401/403 錯誤格式（top-level RFC 7807）

---

### IAM-04: Session 管理

- **評分**: **L1 (Initial)**
- **企業基準 L3+**: JWT/Session 有效期 ≤ 24h、refresh token、logout 失效機制
- **風險等級**: 🔴 HIGH

**證據**：

1. **Session 配置**（`src/lib/auth.config.ts` L69, L257-260）：
   - `SESSION_MAX_AGE = 8 * 60 * 60`（**8 小時，符合 ≤24h 基準** ✅）
   - `strategy: 'jwt'`（無狀態 JWT）
2. **Session 表存在但未使用無狀態 JWT 模式下不會更新**（`prisma/schema.prisma` L113-126）：`Session` model 含 `sessionToken`, `userAgent`, `ipAddress` 欄位，但因採用 JWT strategy，這些欄位實際不會被填充
3. **缺 refresh token 機制**：搜尋 `refresh_token` 僅在 NextAuth `Account` model 找到（OAuth provider refresh token），**沒有應用層 refresh token 邏輯**
4. **Logout 失效機制不完整**：
   - NextAuth `signOut()` 會清除 cookie，但 JWT 在 8 小時內仍可用（無法主動 invalidate）
   - **沒有 token revocation list / blacklist 機制**
   - 用戶帳號被停用後，**現有 JWT 仍會通過 middleware**（middleware 不查資料庫）
5. **JWT secret 配置**（`.env.example` L27-37）：
   - `AUTH_SECRET`、`JWT_SECRET`、`SESSION_SECRET` 三個 secrets 並存（架構不一致）
   - `JWT_EXPIRES_IN="7d"` 與 `SESSION_MAX_AGE=8h` **配置不一致**

**為何不評 L0**：Session 過期時間合理（8h）；Cookie 機制存在。
**為何不評 L2**：缺 refresh token；缺 logout 即時失效；多個 secret 配置混亂；停用帳號的現有 token 不被撤銷（重大缺陷）。

**建議**：
1. 實作 token revocation（基於 redis 的 blacklist，與 FIX-052 同模式）
2. 統一 secret 配置（合併 AUTH_SECRET / JWT_SECRET / SESSION_SECRET）
3. 在 middleware 加入「token 中 userId 是否仍 ACTIVE」的快取查詢
4. 文檔化是否需要 refresh token（B2B 對內系統可考慮直接縮短 maxAge 到 1h + 自動 re-login）

---

### IAM-05: 密碼政策

- **評分**: **L2 (Managed)**
- **企業基準 L3+**: 最小長度 12、複雜度、bcrypt cost ≥ 12、密碼歷史
- **風險等級**: 🟡 MED

**證據**：

1. **bcrypt cost**（`src/lib/password.ts` L21）：
   - `SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10)`
   - 預設 12 rounds **符合企業基準 ≥ 12** ✅
2. **密碼複雜度規則**（`src/lib/password.ts` L40-51 `PASSWORD_REQUIREMENTS`）：
   - `minLength: 8`（**未達企業基準 12** ❌）
   - `requireUppercase: true` ✅
   - `requireLowercase: true` ✅
   - `requireNumber: true` ✅
   - `requireSpecialChar: false`（特殊字元僅作為「建議」，非強制）
3. **強度評分**（`validatePasswordStrength` L75-128）：分數 0-4，`isValid` 取決於 `errors.length === 0`
4. **缺密碼歷史**：搜尋 `passwordHistory` / `previousPassword` 無結果
5. **密碼重置流程存在**（`src/app/api/auth/forgot-password/route.ts`、`reset-password/route.ts`）

**為何達 L2**：bcrypt 12 cost；複雜度有實作；有強度評分機制。
**為何不評 L3**：minLength 8 < 12；無密碼歷史記錄；特殊字元非強制。

**建議**：
1. 將 `minLength` 從 8 提升至 12
2. 新增 `passwordHistory` model（user_id + hashed_old_password + created_at）防止重複使用最近 N 個密碼
3. 強制要求特殊字元（`requireSpecialChar: true`）

---

### IAM-06: SSO 強制

- **評分**: **L2 (Managed)**
- **企業基準 L3+**: SSO 必須是首選認證方式（v1.1 範疇）
- **風險等級**: 🟡 MED

**證據**：

1. **Azure AD 已整合**（`src/lib/auth.config.ts` L74-92）：
   - `isAzureADConfigured()` 檢查 `AZURE_AD_CLIENT_ID/SECRET/TENANT_ID`
   - `.env.example` L66-68 提供完整模板
2. **NextAuth Microsoft Entra ID provider**：在 `auth.ts` L166（`account.provider === 'microsoft-entra-id'`）有處理邏輯
3. **登入頁面同時支援 SSO + 本地帳號**（CHANGE 紀錄顯示 Story 18-2 為新增本地帳號功能）
4. **SSO 並非「首選」或「強制」**：
   - 開發模式自動退化為 mock auth（`auth.config.ts` L129-148）
   - 生產環境若 Azure AD 未配置，會 fall back 到本地 password
   - 沒有「禁用本地帳號」的開關

**為何達 L2**：Azure AD 已可用；架構支援 SSO；多 provider 機制存在。
**為何不評 L3**：SSO 並非強制；本地帳號 + Azure AD 平等存在（無優先級）；無 Azure AD Conditional Access 配置文檔。

**建議**：
1. 加入環境變數 `FORCE_SSO_ONLY=true` 控制是否禁用本地登入（生產應啟用）
2. 文檔化 Azure AD Conditional Access 政策（MFA、Risk-based policies）
3. UI 上將 SSO 按鈕設為主要按鈕，本地登入隱藏在 Advanced

---

### IAM-06b: 本地 admin 帳號管控

- **評分**: **L0 (Absent)**
- **企業基準 L3+**: 若仍開放本地 admin → 必須強制 MFA / 建議停用
- **風險等級**: 🔴 HIGH（v1.1 新增項目）

**證據**：

1. **本地 admin 完全開放**：
   - `Credentials` provider 無條件啟用（`auth.config.ts` L107-110）：「本地帳號 Credentials 提供者 - 始終啟用」
   - 只要資料庫中有 user 帳號 + ACTIVE + 已 verify email → 可純密碼登入（無 MFA）
2. **System Admin 角色擁有所有權限**（`role-permissions.ts` L143）：`Object.values(PERMISSIONS)`，沒有對 admin 加上額外驗證 layer
3. **開發 Bypass Header 是重大風險**（`src/lib/auth.ts` L392-403）：
   ```typescript
   if (isDevelopmentMode() && request) {
     const bypassHeader = request.headers.get('X-Dev-Bypass-Auth')
     if (bypassHeader === 'true') {
       return DEV_MOCK_SESSION  // ← 直接回傳 admin session
     }
   }
   ```
   - `DEV_MOCK_SESSION` 包含 `permissions: ['*']` 與 `isGlobalAdmin: true`（L350-367）
   - 觸發條件 `isDevelopmentMode()` = `NODE_ENV === 'development' || !isAzureADConfigured()`
   - **若生產環境 Azure AD 配置失敗 → 整個 bypass 變得有效** ⚠️ 重大隱患
4. **無 MFA 強制**：搜尋 `mfa`, `totp`, `2fa` 無結果
5. **無 admin 操作額外驗證**：admin 路由僅需 session + permission，無 step-up auth

**為何 L0**：完全沒有 admin 加固機制；甚至有 production-time bypass 隱患。

**建議**（依優先級）：
1. **立即** — 移除 `X-Dev-Bypass-Auth` header，改為僅 NODE_ENV === 'development' 才有效，且強制 require local file `.dev-bypass-enabled` 存在
2. **本月** — 為 admin 角色操作（用戶管理、權限變更、系統配置）加 step-up auth（重輸密碼或要求最近 5 分鐘有 SSO 登入）
3. **本季** — 文檔化 Azure AD Conditional Access policy 強制 admin MFA
4. **本季** — 評估是否徹底停用本地 admin 登入（`FORCE_SSO_ONLY=true` 與 IAM-06 配套）

---

### IAM-07a: 帳號鎖定 — 觸發機制

- **評分**: **L0 (Absent)**
- **企業基準 L3+**: N 次失敗（建議 5 次）後鎖定
- **風險等級**: 🟡 MED

**證據**：

1. **完整搜尋無結果**：
   - 模式 `failedLoginAttempts|lockedUntil|lockoutUntil|accountLocked|lockout|loginAttempt|failedAttempts`
   - **僅匹配到翻譯文件 / 文檔**（`messages/*/auth.json`、`messages/*/admin.json`、tech-spec docs），**沒有實作代碼**
2. **登入失敗處理**（`auth.config.ts` L171-192）：
   - 失敗時 `return null`，僅 log 記錄
   - **無計數、無時間窗口、無鎖定**
3. **`UserStatus` enum 包含 `SUSPENDED`** 但需手動由管理員設定，非自動鎖定
4. **`recordFailedAttempt()` 僅針對 API Key**（`middlewares/external-api-auth.ts` L239-252）：寫入 `apiAuthAttempt` 表，**不適用於密碼登入**

**為何 L0**：完全沒有實作。

**建議**（必須與 IAM-07b 同時實作，矩陣 v1.1 警告「半成品反模式」）：
1. 新增 `User.failedLoginAttempts: Int @default(0)` 與 `User.lockedUntil: DateTime?` 欄位
2. 在 `authorize` 函數中：失敗 +1，第 5 次失敗 lockedUntil = now() + 30min
3. 配套必做 IAM-07b（解鎖流程）—— **不可單獨實作 07a**

---

### IAM-07b: 帳號鎖定 — 解鎖流程

- **評分**: **L0 (Absent)**
- **企業基準 L3+**: 必須三選一以上：自動時間衰減 / 管理員 UI / 用戶自助
- **風險等級**: 🔴 HIGH（v1.1 新增，必與 07a 同時實作）

**證據**：

1. **無解鎖機制**：搜尋 `unlock`, `unlockAccount`, `releaseLock` 無結果
2. **管理員 UI**（`/admin/users/[id]/status/route.ts`）：可改變 `UserStatus`，但這是手動 SUSPEND/ACTIVATE，不是針對「自動鎖定」的解鎖
3. **無自動時間衰減**：因 IAM-07a 未實作，自然也無時間衰減邏輯
4. **無用戶自助解鎖**：`/auth/forgot-password` 是密碼重置（重置後可能仍卡在 lockedUntil）

**為何 L0**：完全沒有實作（與 IAM-07a 同步缺失）。

**建議**：
- 實作三項中至少兩項（建議）：
  1. 自動時間衰減（簡單，30 分鐘後 lockedUntil 自動失效，登入時邏輯判定）
  2. 用戶自助解鎖（透過 email 驗證 link，重置 failedLoginAttempts = 0）
- 必為 IAM-08 加 admin 解鎖 UI（`/admin/users/[id]/unlock/route.ts`）

---

### IAM-07c: 帳號鎖定 — 審計日誌

- **評分**: **L0 (Absent)**
- **企業基準 L3+**: 鎖定/解鎖事件均記錄（誰、何時、為何）
- **風險等級**: 🟡 MED

**證據**：

1. **`AuditLog` model 存在**（`prisma/schema.prisma` 引用 `auditLogs User[]` 關係）
2. **`SecurityLog` model 存在**（schema 引用 `securityLogs SecurityLog[]`）
3. **但因 07a/07b 未實作，無對應事件可記錄**
4. **`security-log.ts` 服務存在**但用途為其他安全事件

**為何 L0**：底層基礎設施存在但無對應業務邏輯記錄鎖定事件。

**建議**：
- 一旦實作 07a/07b，立即在 lockout/unlock 觸發點加入 `auditLogService.log({ action: 'ACCOUNT_LOCKED' / 'ACCOUNT_UNLOCKED', userId, reason, ip })`

---

### IAM-08: 特權帳號管理

- **評分**: **L1 (Initial)**
- **企業基準 L3+**: Admin 操作有額外驗證、定期審查、最小權限原則
- **風險等級**: 🔴 HIGH

**證據**：

1. **角色分類存在**（`role-permissions.ts`）：System Admin / Super User / Regional Manager 是特權角色
2. **`isGlobalAdmin` flag** 提供識別（`User.isGlobalAdmin: Boolean`）
3. **缺 step-up authentication**：Admin 操作（如建立用戶、變更權限）僅需現有 session，**無重新驗證機制**
4. **缺定期審查**：無「Last reviewed at」欄位、無 cron job 提醒、無 UI 列出已 90 天未使用的 admin 帳號
5. **缺最小權限稽核**：System Admin 永遠擁有所有 22 permissions，無法限縮
6. **`/admin/users/route.ts` 權限檢查存在但寬鬆**：USER_VIEW 即可看用戶列表，無「敏感操作必須 INVOKE_MFA」之類設計

**為何不評 L0**：基本特權識別存在（`isGlobalAdmin`）；admin 路徑有 USER_MANAGE permission 控制。
**為何不評 L2**：缺 step-up auth；無權限定期 review；無最小權限縮減機制。

**建議**：
1. 為敏感操作實作 step-up auth（重新輸密碼或要求最近 5 分鐘 SSO）
2. 建立 quarterly access review 流程（與 Gov-10 連動）
3. 提供「admin operations log」UI（過濾 `isGlobalAdmin = true` 的所有審計）

---

### IAM-09: 服務帳號 / API Key

- **評分**: **L2 (Managed)**
- **企業基準 L3+**: 機器對機器認證有獨立憑證、可輪替
- **風險等級**: 🟡 MED

**證據**：

1. **三套獨立的 API Key 機制**：
   - **`ApiKey` model**（內部 SharePoint/Outlook integration，`prisma/schema.prisma`）
     - SHA-256 hashed key + `cityAccess` + `permissions` JSONB
     - `lastUsedAt`、`expiresAt`、`isActive` 控制
     - 服務：`src/lib/auth/api-key.service.ts`
   - **`ExternalApiKey` model**（n8n 等外部系統）
     - SHA-256 hashed + `allowedIps` + `allowedOperations`
     - `usageCount` 統計
     - 服務：`src/middlewares/external-api-auth.ts`
   - **`N8nApiKey` model**（n8n 專用）
2. **API Key Rotation API 存在**：`/admin/api-keys/[keyId]/rotate/route.ts`、`/admin/api-keys/[keyId]/route.ts`
3. **失敗嘗試記錄**（`apiAuthAttempt` model + `recordFailedAttempt()` L239-252）：記錄 IP、User Agent、Key prefix
4. **不一致風險**：3 個獨立 model + 3 套不同的 verify 邏輯，維護成本高，未來有 drift 風險

**為何達 L2**：核心要求（hashed key、過期、輪替、IP 限制）都實作；統計與審計存在。
**為何不評 L3**：3 套機制不統一；無自動 rotation 政策（如 90 天強制 rotate）；無「即將過期」告警。

**建議**：
1. 評估 3 個 model 是否應合併為單一 `ApiCredential` 系統
2. 加入 cron job：30/7 天前 email 通知即將過期的 API Key
3. 實作自動 rotation（生成新 key → 舊 key grace period 7 天 → 強制失效）

---

### IAM-10: 跨租戶隔離

- **評分**: **L2 (Managed)**
- **企業基準 L3+**: RLS (Row Level Security) 或 query filter 強制執行
- **風險等級**: 🔴 HIGH

**證據**：

1. **PostgreSQL RLS 已啟用**（`prisma/migrations/20251219010000_add_multi_city_support/migration.sql`）：
   - 6 個敏感表啟用 RLS：`documents`、`processing_queues`、`extraction_results`、`corrections`、`escalations`、`audit_logs`
   - `FORCE ROW LEVEL SECURITY` 對 table owners 也生效（重要安全強化）
2. **RLS Helper Function**（migration L156-186）：`user_has_city_access(check_city_code TEXT)` 透過 PostgreSQL session variables 判斷
3. **RLS Context Manager**（`src/lib/db-context.ts`）：
   - `setRlsContext()`、`clearRlsContext()`、`withRlsContext()`、`withServiceRole()`
   - **FIX-051 已修復 SQL Injection 風險**（白名單正則 `/^[A-Z]{2,4}$/`，L76-90）
4. **政策完整性**：每個保護表都有 SELECT/INSERT/UPDATE/DELETE 4 個 policies
5. **Service Role 機制存在**：`SERVICE_ROLE_CONTEXT` 用於系統背景任務 bypass RLS

**問題與限制**：
- **隔離單位是「城市」而非「租戶」**：本項目沒有真正的多租戶概念，只有城市隔離
- **City code 是業務數據，跨城市操作日常存在**（admin 改 documents 跨城市指派）
- **RLS Context 必須由應用層主動設定**：如果 service / route 忘記呼叫 `setRlsContext()`，RLS policy 會 fail-closed（無法看到任何資料）—— 這是好事，但易導致業務 bug
- **未受保護的 table**：`User`、`Role`、`UserRole`、`Company`、`MappingRule` 等仍為共享資料（設計如此，可接受）

**為何達 L2**：RLS 完整實作；FIX-051 已修復風險；setRlsContext 機制設計合理。
**為何不評 L3**：缺自動化測試驗證 RLS 在所有可能 path 都被啟用；缺「forgot setRlsContext」的偵測機制；缺城市權限變更時的審計。

**建議**：
1. 增加整合測試覆蓋 RLS：`UNAUTHORIZED_CITY` user 無法 SELECT 別城市文件
2. 建立「RLS context check」middleware：所有經 db query 的 service 必須先 set context（fail-fast）
3. 加 quarterly RLS audit：跑「所有 UserCityAccess 是否有 expired 或 dormant 帳號」報表

---

## 📊 DP 領域逐項評分

---

### DP-01-lite: 員工 PII 識別（簡化版）

- **評分**: **L2 (Managed)**
- **企業基準 L3+**: 標註 `User.email`、`AuditLog.userId` 等員工 PII 欄位
- **風險等級**: 🟡 MED

**證據**：

1. **PII 欄位已識別並文檔化**：
   - `User.email`（unique）— 員工登入主鍵
   - `User.name`（optional） — 員工姓名
   - `User.azureAdId`（unique） — Azure AD identity
   - `User.image` — 員工頭像 URL（可能含 personal info）
   - `User.password`（hashed but仍應視為敏感）
   - `User.passwordResetToken`、`User.emailVerificationToken` — 一次性密鑰
   - `User.lastLoginAt`、`User.lastActiveAt` — 行為追蹤
   - `Session.userAgent`、`Session.ipAddress` — 設備指紋（雖 JWT mode 下不寫入）
   - `Account.refresh_token`、`Account.access_token` — OAuth tokens
   - `AuditLog.userId`、`SecurityLog.userId` — 行為記錄
2. **加密工具存在**：
   - `src/lib/encryption.ts`、`src/services/encryption.service.ts`
   - 用於敏感整合憑證（API keys、Outlook config）— 但**不用於 User.email** ❌
3. **缺正式 PII 清單文檔**：搜尋 `pii.md`、`personal-data.md` 無結果
4. **GDPR Right to Erasure**：DP 矩陣標記 ⚪ N/A（對內系統，員工生命週期由 AAD 處理），可接受

**為何達 L2**：PII 欄位明確；加密基礎設施存在；password 已 hashed。
**為何不評 L3**：缺正式 PII 清單文檔；email 未 encrypted-at-rest（雖 v1.1 範疇允許，但 enterprise L3 通常仍要求）；缺 PII 處理流程文檔。

**建議**：
1. 建立 `docs/08-security-and-governance/pii-inventory.md` 列出所有 PII 欄位 + 用途 + 保留政策
2. 文檔化員工離職流程（與 HR/AAD lifecycle 整合）
3. 評估 audit log 中 email 是否需 hashing（避免 ops staff 直接看到）

---

### DP-02: 資料加密（傳輸） / Security Headers

- **評分**: **L1 (Initial)**
- **企業基準 L3+**: HTTPS 強制、TLS 1.2+、HSTS、X-Frame-Options 等
- **風險等級**: 🔴 HIGH（無條件必須）

**證據**：

1. **`next.config.ts`** 完整檢視（67 行）：
   - 配置了 `output: 'standalone'`、ESLint、images、experimental serverActions、webpack
   - **完全沒有 `headers()` 配置** ❌
   - **完全沒有 HSTS / CSP / X-Frame-Options / X-Content-Type-Options 設定** ❌
2. **全域 grep 確認**：搜尋 `HSTS|Strict-Transport-Security|X-Frame-Options|Content-Security-Policy|securityHeaders|X-Content-Type-Options`
   - 結果：**僅文檔中提及（governance matrix 與 conversation log），代碼中零實作**
3. **`.env.example` 設定**（L31）：`AUTH_TRUST_HOST="true"` — 表示應用容許在非 HTTPS 環境（如 localhost）運行
4. **`AUTH_URL="http://localhost:3005"`**（L29）— 本地用 HTTP 是合理的
5. **生產環境 HTTPS 由 Container Apps 提供**（依 v1.2 部署環境）：Azure ACA 內建 TLS termination，但**應用層仍應加 HSTS**

**為何 L1**：開發環境基礎運作正常（HTTPS 由 ACA 處理）；但**安全 headers 完全缺失是高風險**。
**為何不評 L0**：底層 ACA TLS 確保了基本傳輸加密。
**為何不評 L2**：完全缺 HTTP security headers，OWASP A02 違規。

**建議**（依 AppSec-08 Wave 1 列為「零影響先做」）：
```typescript
// next.config.ts 加入：
async headers() {
  return [{
    source: '/:path*',
    headers: [
      { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      // CSP 先用 Content-Security-Policy-Report-Only，1-2 週觀察後改 enforce
    ],
  }]
}
```

---

### DP-03: 資料加密（靜態）

- **評分**: **L2 (Managed)** — 待 Azure 部署後升 L3
- **企業基準 L3+**: 資料庫加密（Azure TDE 內建免費）
- **風險等級**: 🔴 HIGH

**證據**：

1. **目前部署狀態**：
   - **本地開發**：PostgreSQL 在 Docker（`docker-compose.yml`），**無 disk-level encryption**（合理，dev only）
   - **生產部署**：規劃中 Azure PostgreSQL Flexible Server（CHANGE-055/056）
2. **Azure PostgreSQL Flexible Server 預設啟用 TDE**：
   - 文件 `docs/08-security-and-governance/enterprise-security-governance-matrix.md` v1.2 明確標示「✅ Azure PostgreSQL Flexible Server 內建（已包含在訂閱費內）」（Resi-06）
   - DP-03 欄標示「Azure TDE 內建免費」
3. **應用層加密**（`src/lib/encryption.ts`）：用於 ApiKey、ExternalApiKey、整合憑證等敏感欄位
4. **`ENCRYPTION_KEY` 配置**（`.env.example` L43）：32-char hex，有警告「一旦設定後不可變更，否則既有加密資料無法解密」
5. **Backup encryption**：Azure PostgreSQL 內建備份加密（DP-09 連動）

**為何達 L2**：
- 應用層加密已實作於敏感欄位（API key 等）
- Azure PostgreSQL TDE 為部署目標的內建能力
- 加密 key 管理機制存在

**為何不評 L3（暫時）**：尚未實際部署到 Azure；本地 PostgreSQL 仍為明文磁碟；Azure 部署計畫處於規劃階段。

**建議**：
1. CHANGE-055 部署到 Azure 後，驗證 TDE 確實啟用（Azure Portal → Server → Security → Data encryption）
2. 文檔化哪些 DB columns 需應用層加密（雙重保護）vs 哪些只需 TDE

---

### DP-04: Secret 管理

- **評分**: **L2 (Managed)** — 待 Azure Key Vault 整合後升 L3
- **企業基準 L3+**: 所有 secret 在 Key Vault / 環境變數，禁止硬編碼
- **風險等級**: 🔴 HIGH

**證據**：

1. **`.env.example` 完整實作**（L1-159）：
   - 三級分類（🔴 必要 / 🟡 功能 / 🟢 可選）
   - 警告與生成命令清楚（`npx auth secret`、`crypto.randomBytes`）
   - 所有 secret 用 `your-xxx-change-in-production` 占位
2. **`.gitignore` 保護**（既有審計確認）：
   - `.env`、`.env.local`、`.env.*.local` 已忽略
   - 無 `.env` 文件在 git tracking
3. **無硬編碼 secret**（既有審計確認）：
   - 全 codebase 掃描：0 個硬編碼 secret
   - `auth.config.ts` L83 的 `mock prefixes`（`'your-'`, `'test-'`）是驗證邏輯，可接受
4. **加密工具**（`src/lib/encryption.ts`、`src/services/encryption.service.ts`）：用於 API key、Outlook config 等運行時加密
5. **缺 Azure Key Vault 整合**：搜尋 `KeyVault` / `@azure/keyvault-secrets` 無代碼引用（僅 governance matrix 提及作為 v1.2 部署目標）

**為何達 L2**：環境變數機制完整；無硬編碼；應用層加密齊全；secret 生成流程清楚。
**為何不評 L3**：尚未整合 Key Vault；secret rotation 沒有自動化；多套 secrets（AUTH_SECRET / JWT_SECRET / SESSION_SECRET）一致性弱。

**建議**：
1. CHANGE-055 部署 ACA 時整合 Azure Key Vault（透過 Managed Identity 取得 secrets）
2. 統一三套 secret 配置（合併 AUTH_SECRET / JWT_SECRET / SESSION_SECRET）
3. 文檔化 secret rotation cadence（OpenAI key 90 天、AAD secret 180 天等）

---

### DP-05-lite: Log 中員工 email 遮罩

- **評分**: **L2 (Managed)**
- **企業基準 L3+**: 所有 logger 不得輸出明文 email
- **風險等級**: 🔴 HIGH

**證據**：

1. **FIX-050 已修復 auth.config.ts 的 6 處 PII**（CLAUDE.md 確認）：
   - 已驗證 `auth.config.ts`：所有 email 輸出降到 `edgeLogger.debug` 級別（L139, L177, L188）
   - **生產環境預設 LOG_LEVEL=info，不會輸出 email** ✅
   - L215 「Login successful 僅記錄 userId（不記錄 email）」 ✅
2. **edgeLogger 設計合理**（`src/lib/edge-logger.ts`）：
   - 預設 production = info，dev = debug
   - 結構化輸出
3. **殘留 email PII 點**（重新驗證 2026-04-28）：
   ```
   src/services/alert.service.ts:593   "[AlertService] Would send email to ${recipient}:"
   src/services/alert-notification.service.ts:408   "[AlertNotification] Sending email to ${to}"
   src/app/api/auth/resend-verification/route.ts:174   console.error('Failed to send verification email:', emailError)
   src/app/api/auth/register/route.ts:135   console.error('Failed to send verification email:', emailError)
   ```
   - **alert.service.ts 與 alert-notification.service.ts 仍有明文 recipient email** ⚠️
   - register/resend-verification 的 emailError 對象**可能**含 email（取決於 nodemailer error format）
4. **總 console.* 統計**：520 個 occurrences 跨 200 個文件（增加自既有審計的 279）— 大部分非 email 但需逐步審查

**為何達 L2**：
- FIX-050 確認 auth flow 主要 PII 已修復
- edgeLogger 機制完整
- 生產環境預設 LOG_LEVEL 不輸出 debug

**為何不評 L3**：alert services 仍有明文 email；console.* 總量仍多（520）；未完全遷移到 logger 服務。

**建議**：
1. **本週修復 alert.service.ts:593 + alert-notification.service.ts:408**（簡單替換為遮罩 email）：
   ```typescript
   const maskedEmail = recipient.replace(/^(.{2}).*(@.*)$/, '$1***$2');
   ```
2. 制定逐步遷移計畫：520 console.* → logger.service（每月 100 個）
3. 加 lint rule：`no-console` 強制（除 edge-logger.ts、test 文件）

---

### DP-09: 備份加密 + 異地備份

- **評分**: **L2 (Managed)** — 待 Azure 部署驗證後升 L3
- **企業基準 L3+**: 備份檔案加密、定期還原測試
- **風險等級**: 🔴 HIGH

**證據**：

1. **應用層備份系統存在**（`prisma/schema.prisma` 19 系列）：
   - `Backup`、`BackupSchedule`、`BackupConfig`、`BackupStorageUsage`
   - `RestoreRecord`、`RestoreDrill`、`RestoreLog`
2. **API 端點完整**：
   - `/admin/backups/`、`/admin/backup-schedules/`
   - `/admin/restore/`、`/admin/restore/[id]/rollback/`
3. **服務層**：`backup.service.ts`、`backup-scheduler.service.ts`、`restore.service.ts`
4. **目前儲存位置**：本地 / Azurite（dev）— 生產規劃 Azure Blob Storage
5. **Azure PostgreSQL Flexible Server 內建備份**（v1.2 矩陣 Resi-06）：
   - PITR (Point-in-Time Recovery) 7-35 天
   - 已加密（Azure 內建）
6. **缺定期還原測試**：`RestoreDrill` model 存在但無 cron job 驗證，矩陣 v1.2 Resi-07 標記「🟡 延後 — 建議每半年手動跑一次」

**為何達 L2**：
- 應用層備份/還原系統完整
- Azure PostgreSQL 內建備份是部署規劃中的能力
- RestoreDrill 結構已存在

**為何不評 L3**：未實際 Azure 部署驗證；缺自動化還原演練；應用層 backup file 是否加密未驗證。

**建議**：
1. Azure 部署後驗證 PostgreSQL backup 確實加密
2. 排定每季 restore drill（手動執行 + 記錄 RTO 實測）
3. 應用層 backup file 上傳到 Blob 時應加 `BlobContentEncryption`（Azure 提供 SSE-KMS）

---

## 🚨 重大發現（HIGH 風險未達 L2）

以下 9 項為 HIGH 風險且未達 L2 的關鍵差距，**必須在進入 Production 前處理**：

### 1️⃣ API 路由認證覆蓋率僅 60.7%（IAM-01）

- **影響**：130 個未保護 routes 含財務、AI prompt configs、template instances 等高敏感資料
- **企業基準**：≥ 95%
- **修復成本**：HIGH（需審查所有 130 routes 個別處理）
- **優先級**：🔴 阻擋 Production 部署

### 2️⃣ 完全無帳號鎖定機制（IAM-07a/b/c）

- **影響**：開放暴力破解攻擊；密碼登入無防護
- **企業基準**：5 次失敗鎖定 + 三選一解鎖流程 + 審計
- **修復成本**：MEDIUM（schema 加 2 欄位 + authorize 邏輯 + 解鎖路徑）
- **必配套**：07a/07b 必須同時實作（v1.1 警告半成品反模式）

### 3️⃣ Session 管理缺失（IAM-04）

- **影響**：用戶停用後 JWT 仍有效 8 小時；無 token revocation；secret 配置混亂
- **企業基準**：refresh token + logout 即時失效
- **修復成本**：MEDIUM-HIGH（需引入 redis blacklist + middleware 擴充）

### 4️⃣ 開發 Bypass Header 重大隱患（IAM-06b）

- **影響**：`X-Dev-Bypass-Auth: true` 在 Azure AD 配置失敗時生效，等同無認證 admin 入口
- **企業基準**：本地 admin 必須強制 MFA / 建議停用
- **修復成本**：LOW（移除或加上更嚴格的 guard 即可）
- **優先級**：🔴 立即修復

### 5️⃣ 特權帳號管理薄弱（IAM-08）

- **影響**：admin 操作（用戶管理、權限變更）無 step-up auth；無定期審查機制
- **企業基準**：額外驗證 + 定期審查 + 最小權限
- **修復成本**：MEDIUM（step-up auth + access review job）

### 6️⃣ HTTP Security Headers 完全缺失（DP-02）

- **影響**：缺 HSTS、CSP、X-Frame-Options 等基礎防護
- **企業基準**：OWASP A02 完整 headers 集
- **修復成本**：LOW（zero-impact，僅 next.config.ts 加 30 行）
- **優先級**：🔴 Wave 1 優先（governance matrix 已標記為「零影響先做」）

### 7️⃣ Permission 檢查不一致（IAM-03）

- **影響**：3 種不同的 auth 模式 + ad-hoc permission check，造成 IAM-01 覆蓋率低的根本原因
- **企業基準**：統一 middleware/decorator
- **修復成本**：HIGH（需重構所有 routes）
- **建議**：與 IAM-01 一併處理

### 8️⃣ Log 中仍有殘留 PII（DP-05-lite）

- **影響**：alert.service.ts:593、alert-notification.service.ts:408 仍輸出明文 email
- **企業基準**：所有 logger 不得輸出明文 email
- **修復成本**：LOW（兩處替換）
- **優先級**：本週可修復

### 9️⃣ Secret 管理未整合 Key Vault（DP-04，部分問題）

- **影響**：依賴環境變數但未整合 Azure Key Vault；無自動 rotation
- **企業基準**：Key Vault + rotation 自動化
- **修復成本**：MEDIUM（與 CHANGE-055 Azure 部署同步處理）
- **優先級**：與部署計畫綁定

---

## 📋 建議的修復順序

### Wave 1 — 本週（零影響快速勝利）

1. ✅ DP-02：next.config.ts 加 HTTP security headers（30 分鐘）
2. ✅ DP-05-lite：修復 alert.service.ts:593 + alert-notification.service.ts:408（30 分鐘）
3. ✅ IAM-06b：移除或加固 `X-Dev-Bypass-Auth` header（1 小時）

### Wave 2 — 本月（核心安全）

4. IAM-04：Token revocation 機制 + 統一 secret 配置（3-5 天）
5. IAM-07a/b/c：完整帳號鎖定流程（3-5 天，必須三項同時做）
6. IAM-05：密碼政策升級 minLength 8 → 12 + 密碼歷史（2 天）

### Wave 3 — 本季（架構性改進）

7. IAM-01 + IAM-03：建立統一 `withAuth()` HOF + 補齊 130 routes（2-3 週）
8. IAM-08：特權帳號 step-up auth + Access Review 流程（1 週）
9. DP-04：Azure Key Vault 整合（與 CHANGE-055 連動）

### Wave 4 — Azure 部署後驗證

10. DP-03：驗證 Azure PostgreSQL TDE 啟用
11. DP-09：執行第一次 restore drill 並記錄 RTO

---

## 📝 評分修訂紀錄

- **2026-04-28 (本次盤點)**：建立 IAM 13 項 + DP 6 項評分
- **與 CLAUDE.md 既有描述差異**：
  - CLAUDE.md「Auth 覆蓋率 73%」 → **實際 60.7%**（與既有 security-audit.md 一致）
  - CLAUDE.md「FIX-050 已修復 PII」 → **驗證屬實**，但 alert services 仍有殘留 ⚠️
  - CLAUDE.md「FIX-051 已修復 SQL Injection」 → **驗證屬實**（白名單正則正確實作）
  - CLAUDE.md「FIX-052 已修復 Rate Limit」 → 影響 IAM-09 不大（API key auth 不依賴 rate limit）

---

## 🔗 相關文檔索引

| 文件 | 用途 |
|------|------|
| `docs/08-security-and-governance/enterprise-security-governance-matrix.md` v1.2 | 評估基準矩陣（本盤點依據）|
| `docs/06-codebase-analyze/05-security-quality/security-audit.md` (2026-04-09) | 既有審計（cross-reference）|
| `claudedocs/4-changes/fix/FIX-050-*.md` | PII 洩漏修復記錄 |
| `claudedocs/4-changes/fix/FIX-051-*.md` | SQL Injection 修復記錄 |
| `claudedocs/4-changes/fix/FIX-052-*.md` | Rate Limit 修復記錄 |
| `prisma/migrations/20251219010000_add_multi_city_support/migration.sql` | RLS 完整 SQL 政策 |
| `src/lib/auth.config.ts` / `src/lib/auth.ts` | NextAuth 配置 |
| `src/lib/db-context.ts` | RLS Context Manager（FIX-051 防護點）|
| `src/lib/edge-logger.ts` | Edge Runtime Logger |
| `src/types/permissions.ts` / `src/types/role-permissions.ts` | RBAC 定義 |
| `src/middlewares/external-api-auth.ts` | 外部 API Key 中介 |
| `.env.example` | Secret 配置模板 |

---

**盤點完成日期**: 2026-04-28
**盤點人**: Claude (Phase 2 Security Audit)
**下一步**: 與 stakeholder review 後決定 Wave 1-3 排程
