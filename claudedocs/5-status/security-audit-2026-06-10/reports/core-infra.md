# 安全審查報告 — Core Infrastructure（中間件 / 設定 / 驗證 / Context / Job / Store / i18n）

> 審查日期：2026-06-10 | Scope：scopes/core-infra.txt | Agent：core-infra 安全審查 agent

## 1. 覆蓋清單

| # | 檔案 | 行數 | 完整讀取 |
|---|------|------|----------|
| 1 | src/config/feature-flags.ts | 406 | ✅ |
| 2 | src/config/index.ts | 19 | ✅ |
| 3 | src/constants/processing-steps.ts | 315 | ✅ |
| 4 | src/constants/processing-steps-v3.ts | 347 | ✅ |
| 5 | src/constants/prompt-config-list.ts | 39 | ✅ |
| 6 | src/constants/stage-prompt-templates.ts | 400 | ✅ |
| 7 | src/constants/standard-fields.ts | 578 | ✅ |
| 8 | src/contexts/DashboardFilterContext.tsx | 462 | ✅ |
| 9 | src/contexts/DateRangeContext.tsx | 188 | ✅ |
| 10 | src/events/handlers/document-processed.handler.ts | 166 | ✅ |
| 11 | src/i18n/config.ts | 50 | ✅ |
| 12 | src/i18n/request.ts | 123 | ✅ |
| 13 | src/i18n/routing.ts | 25 | ✅ |
| 14 | src/jobs/pattern-analysis-job.ts | 141 | ✅ |
| 15 | src/jobs/webhook-retry-job.ts | 221 | ✅ |
| 16 | src/middleware.ts | 183 | ✅ |
| 17 | src/middlewares/audit-log.middleware.ts | 416 | ✅ |
| 18 | src/middlewares/city-filter.ts | 343 | ✅ |
| 19 | src/middlewares/external-api-auth.ts | 289 | ✅ |
| 20 | src/middlewares/index.ts | 47 | ✅ |
| 21 | src/middlewares/resource-access.ts | 345 | ✅ |
| 22 | src/providers/AuthProvider.tsx | 69 | ✅ |
| 23 | src/providers/QueryProvider.tsx | 63 | ✅ |
| 24 | src/providers/ThemeProvider.tsx | 38 | ✅ |
| 25 | src/stores/document-preview-test-store.ts | 462 | ✅ |
| 26 | src/stores/reviewStore.ts | 286 | ✅ |
| 27 | src/validations/auth.ts | 149 | ✅ |
| 28 | src/validations/data-template.ts | 210 | ✅ |
| 29 | src/validations/document-format.ts | 119 | ✅ |
| 30 | src/validations/template-field-mapping.ts | 368 | ✅ |
| 31 | src/validations/template-instance.ts | 280 | ✅ |
| 32 | src/validations/template-matching.ts | 220 | ✅ |

**總計**：32 個檔案，約 7,367 行，全部完整讀取。

輔助交叉確認（非範圍檔案，僅用於驗證中間件保護鏈）：
`src/app/[locale]/(dashboard)/layout.tsx`、`src/app/[locale]/(auth)/auth/login/page.tsx`、`src/components/features/auth/LoginForm.tsx`、`src/services/mapping/transform-executor.ts`、`src/services/transform/formula.transform.ts`、`src/app/api/jobs/pattern-analysis/route.ts`。

---

## 2. 發現

### [Medium] CORE-01 開放重定向（Open Redirect）— callbackUrl 未驗證即用於重定向
- **檔案**：`src/middleware.ts:151-153`（產生來源，安全）→ `src/app/[locale]/(auth)/auth/login/page.tsx:72,149,178`（漏洞消費點）
- **類別**：I（認證機制本身 / open redirect）
- **描述**：
  中間件在 `isProtectedRoute` 未登入時會 `loginUrl.searchParams.set('callbackUrl', pathname)`，此處 `pathname` 為內部請求路徑，**本身安全**。但登入頁直接從 `searchParams` 取出**攻擊者可控**的 `callbackUrl`，未做「只允許站內相對路徑」白名單驗證，即用於三處重定向：
  - 已登入時 `redirect(callbackUrl ?? '/dashboard')`（page.tsx:72）
  - Azure AD `signIn('microsoft-entra-id', { redirectTo: callbackUrl ?? '/dashboard' })`（page.tsx:149）
  - 傳入 `LoginForm`，登入成功後 `router.push(callbackUrl)`（LoginForm.tsx:136）

  攻擊者可發送 `/{locale}/auth/login?callbackUrl=https://evil.example.com`，受害者登入後被導向外部網站，可用於釣魚或竊取後續憑證。
- **證據**：
  ```ts
  // login/page.tsx
  const { callbackUrl, error } = await searchParams
  if (session) { redirect(callbackUrl ?? '/dashboard') }      // L72
  await signIn('microsoft-entra-id', { redirectTo: callbackUrl ?? '/dashboard' }) // L149
  <LoginForm callbackUrl={callbackUrl ?? '/dashboard'} />     // L178
  ```
- **建議**：對 `callbackUrl` 加站內白名單驗證——只接受以單一 `/` 開頭（且非 `//` 或 `/\`）的相對路徑，否則 fallback 到 `/dashboard`。建議集中為一個 `sanitizeCallbackUrl()` 工具，於中間件與登入頁共用。
- **備註**：漏洞主體檔案不在本 scope（屬 auth/pages），但風險鏈由中間件的 callbackUrl 流程啟動，故在此記錄並轉交對應 agent 確認修復。

### [Medium] CORE-02 外部 API IP 白名單可被 x-forwarded-for 標頭偽造繞過
- **檔案**：`src/middlewares/external-api-auth.ts:163-175, 213-219`
- **類別**：A（授權）/ K（其他風險）
- **描述**：
  `externalApiAuthMiddleware` 在 API Key 設有 `allowedIps` 時，用 `getClientIpFromRequest()` 取得用戶端 IP 做白名單比對；該函數直接信任 `x-forwarded-for` 的第一段。若應用未確保**僅信任**反向代理覆寫的 IP（例如直接暴露或代理未 strip 客戶端傳入的標頭），持有有效（或外洩）API Key 的攻擊者可自行設定 `X-Forwarded-For: <白名單 IP>` 來繞過 IP 限制。同樣影響 `recordFailedAttempt` 與使用統計所記錄的 IP 準確性（污染審計）。
- **證據**：
  ```ts
  export function getClientIpFromRequest(request: NextRequest): string {
    return (
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') || 'unknown'
    );
  }
  // ...
  if (!allowedIps.includes(clientIp) && !allowedIps.includes('*')) { /* 拒絕 */ }
  ```
- **建議**：以受信任代理鏈解析真實 IP（例如取 `x-forwarded-for` 由右往左數第 N 個、N = 受信代理層數，或改用平台提供的可信來源 IP）。在文件中明確要求部署於會 strip/覆寫 `x-forwarded-for` 的反向代理之後。IP 白名單應視為輔助層，主防線仍為 API Key。

### [Low] CORE-03 中間件路由保護清單不完整，僅靠 layout 補償
- **檔案**：`src/middleware.ts:71-74, 148-155`
- **類別**：A（授權）
- **描述**：
  `isProtectedRoute` 只將 `/dashboard` 與 `/documents` 視為受保護路由，但 `(dashboard)` 路由組下尚有 `admin`、`companies`、`reports`、`review`、`rules`、`escalations`、`global`、`audit`、`profile`、`template-instances`、`rollback-history` 等頁面未列入。未登入者直接存取這些路徑時，中間件**不會**在邊緣層攔截重定向。實測補償機制為 `(dashboard)/layout.tsx:47-52` 的伺服器端 `auth()` 檢查（無 session → `redirect('/auth/login')`），因此**目前未造成實際未授權存取**（fail-closed）。風險在於：保護邏輯散落、易誤以為中間件已涵蓋，未來新增頁面群組若不在 layout 下即可能漏保護。
- **證據**：
  ```ts
  function isProtectedRoute(pathname: string): boolean {
    const { restPath } = extractLocaleFromPath(pathname)
    return restPath.startsWith('/dashboard') || restPath.startsWith('/documents')
  }
  ```
- **建議**：改以「白名單公開路由」反向邏輯（只放行 `/auth/*` 與少數公開頁，其餘一律需登入），或將整個 `(dashboard)` 前綴納入保護，使邊緣層與 layout 一致，降低未來漏保護機率。

### [Low] CORE-04 pattern-analysis CRON_SECRET 採非常數時間字串比對
- **檔案**：`src/app/api/jobs/pattern-analysis/route.ts:69-73`
- **類別**：I（時序攻擊）
- **描述**：
  `isValidCronSecret` 以 `providedSecret === CRON_SECRET` 比對密鑰，屬非常數時間比對，理論上存在時序側通道。`CRON_SECRET` 未設定時回傳 `false`（fail-closed，良好）。經網路的時序攻擊在實務上難以利用，故列為 Low。
- **證據**：
  ```ts
  function isValidCronSecret(request: NextRequest): boolean {
    if (!CRON_SECRET) return false;
    const providedSecret = request.headers.get('x-cron-secret');
    return providedSecret === CRON_SECRET;
  }
  ```
- **建議**：改用 `crypto.timingSafeEqual`（長度先比對後再常數時間比較）做密鑰驗證。
- **備註**：此檔案不在本 scope，但其驗證邏輯為 `src/jobs/pattern-analysis-job.ts` 的唯一入口，故一併記錄供交叉確認。

### [Low] CORE-05 外部 API 認證失敗僅記錄、無實際鎖定/節流
- **檔案**：`src/middlewares/external-api-auth.ts:239-252`
- **類別**：K（DoS / 暴力破解面）
- **描述**：
  `recordFailedAttempt` 將失敗嘗試寫入 `apiAuthAttempt`，但認證流程**未**讀取累積失敗次數做鎖定或節流，亦無全域 rate limit 中間件保護此端點（與專案已知「無全域 Rate Limiting」缺口一致）。API Key 要求 ≥20 字元（line 114），暴力破解空間大，故實際風險低。
- **建議**：搭配 `rate-limit.service` 對連續認證失敗的來源（IP / keyPrefix）做節流或暫時封鎖。

### [Low] CORE-06 FORMULA 轉換使用 Function() 動態求值（已有字元白名單緩解）
- **檔案**：`src/validations/template-field-mapping.ts:34-44`（schema）→ `src/services/transform/formula.transform.ts:139-169`（執行）
- **類別**：B（注入）
- **描述**：
  `formulaTransformParamsSchema` 允許公式包含字母、`{}`、運算符。實際執行於 `formula.transform.ts` 以 `Function("use strict"; return (...))` 求值。緩解措施完善：求值前先把 `{field}` 變數替換為數字（非數值強制為 `0`），再以 `SAFE_FORMULA_PATTERN = /^[\d\s\+\-\*\/\.\(\)]+$/` 驗證，僅允許數字與基本運算符，無法注入任意程式碼。屬殘餘風險，列為 Low。
- **建議**：維持現狀即可；若要徹底消除 `Function()`，可改用安全運算式解析器（如 expr-eval）。確認 `CUSTOM` transform（`mapping/transform-executor.ts` CustomStrategy）僅做字串 `replace`、不 eval，已驗證安全。

### [Info] CORE-07 generateTraceId 使用 Math.random（非安全用途）
- **檔案**：`src/middlewares/external-api-auth.ts:274-278`
- **類別**：K（不安全隨機數）
- **描述**：`generateTraceId` 以 `Math.random()` 生成追蹤 ID，僅用於日誌關聯、非安全敏感識別，無風險。記錄供避免日後被誤用於 token/密鑰生成。
- **建議**：若日後需安全識別碼，改用 `crypto.randomUUID()`。

### [Info] CORE-08 外部 API Key 以無鹽 SHA-256 雜湊查找
- **檔案**：`src/middlewares/external-api-auth.ts:125-130`
- **類別**：I（認證機制）
- **描述**：API Key 以 `createHash('sha256')` 無鹽雜湊後查 DB。對高熵隨機 API Key 而言，無鹽快速雜湊為業界可接受作法（非低熵密碼），無需 bcrypt。記錄為觀察。
- **建議**：維持現狀；確保 Key 生成端使用足夠長度的 CSPRNG。

### [Info] CORE-09 事件處理器與 Context 的 console 日誌內容
- **檔案**：`src/events/handlers/document-processed.handler.ts:96-108`、`src/contexts/DashboardFilterContext.tsx:228,459`、`src/contexts/DateRangeContext.tsx:104`
- **類別**：E（PII 與日誌）
- **描述**：相關 `console.log/error` 僅輸出 documentId、cityCode、日期驗證錯誤等非 PII 資訊，未發現 email / token / 密碼外洩。符合 H4 要求。記錄為觀察（專案整體 console.log 漸進清理中）。
- **建議**：長期可改用統一 logger，惟非安全問題。

---

## 3. 統計

| Critical | High | Medium | Low | Info |
|----------|------|--------|-----|------|
| 0 | 0 | 2 | 4 | 3 |

---

## 4. 區域整體觀察

1. **中間件設計：API 路由完全不經中間件認證**。`src/middleware.ts:91-98` 與 `config.matcher`（`'/((?!api|_next|.*\\..*).*)'`）刻意排除所有 `/api` 路徑，代表**所有 API 認證/授權均為各 route 自行實作**。這正是專案已知「auth 覆蓋率約 60-73%」缺口的結構性根因——中間件不是 API 的防線。本 scope 內檢視的高階函數（`withCityFilter`、`withResourceAccess`、`withAuditLog`、`externalApiAuthMiddleware`）品質良好且 fail-closed，但**是否被每個 route 套用**需由 API scope 的 agent 逐一驗證。

2. **頁面認證採「中間件 + layout 雙層」但中間件層不完整**：實際保護來自 `(dashboard)/layout.tsx` 的 `auth()`（fail-closed，良好）。需注意該 layout **只驗證 session 是否存在，不檢查角色/權限**——即任何已登入使用者都能抵達 `/admin/*` 頁面外殼，admin 授權完全依賴各頁面 server component 與其呼叫的 API 端點。建議 admin 區域增加 layout 級角色 gate 作為縱深防禦。

3. **城市隔離 / IDOR 防護紮實**：`city-filter.ts`（`buildCityWhereClause` 對無城市使用 `__NONE__` 不可能條件、全球管理員空條件）與 `resource-access.ts`（`validateResourceAccess` 依資源城市比對使用者 cityCodes，並記錄未授權嘗試到 SecurityLog）設計正確且 fail-closed。對 `forwarder`/`mappingRule` 等全域資源，非全球管理員會因 `cityCode === null` 被判 `allowed=false`（偏嚴格但 fail-secure），屬功能性而非安全問題。

4. **輸入驗證（Zod）品質高**：6 個 validations 檔案普遍有長度上限、enum 約束、分頁 `limit.max(100)`、批量上限（`batchAddRows` 1000、`executeMatch` documentIds 10000、`batchMatch` 500）、ID 格式（cuid/uuid）與跨欄位 refine（scope↔companyId/formatId 關聯、欄位名唯一性）。未發現缺少上限導致 DoS 的查詢參數。`template-matching.ts` 的 `executeMatch` documentIds 上限 10000 偏大，可評估是否需降低，惟非明確漏洞。

5. **Secrets / 硬編碼**：本 scope 全部設定皆讀自 `process.env`（feature-flags、CRON_SECRET、Azure 配置判斷等），未發現硬編碼 API key / 連線字串 / tenant ID / subscription ID。錯誤回應採 RFC 7807 結構、未回傳 stack trace 或內部路徑。

6. **FIX-050 / FIX-051 回歸檢查**：本 scope 內未見 auth.config.ts 的 PII console.log 回歸（該檔不在 scope，無法直接確認），亦未見 `$executeRawUnsafe` 字串拼接 SQL；所有 `new RegExp` 用法（transform、template-instance 驗證等）均為受控 pattern，無 SQL/command injection 面。

7. **Store / Provider**：Zustand stores（reviewStore、document-preview-test-store）與 React Query / Auth / Theme Provider 皆為純前端 UI 狀態，無敏感資料持久化、無客戶端直接 import prisma/server 模組，無安全問題。
