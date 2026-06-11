# 安全審查報告 — src/lib/（前半 lib-0）

> 審查日期：2026-06-10 | Scope：scopes/lib-0.txt | Agent：lib-0 安全審查 agent

## 1. 覆蓋清單

| # | 檔案 | 行數 | 完整讀取 |
|---|------|------|----------|
| 1 | src/lib/audit/index.ts | 346 | ✅ |
| 2 | src/lib/audit/logger.ts | 343 | ✅ |
| 3 | src/lib/auth.config.ts | 313 | ✅ |
| 4 | src/lib/auth.ts | 405 | ✅ |
| 5 | src/lib/auth/api-key.service.ts | 268 | ✅ |
| 6 | src/lib/auth/city-permission.ts | 458 | ✅ |
| 7 | src/lib/auth/index.ts | 27 | ✅ |
| 8 | src/lib/azure/index.ts | 20 | ✅ |
| 9 | src/lib/azure/storage.ts | 315 | ✅ |
| 10 | src/lib/azure-blob.ts | 438 | ✅ |
| 11 | src/lib/confidence/calculator.ts | 400 | ✅ |
| 12 | src/lib/confidence/index.ts | 58 | ✅ |
| 13 | src/lib/confidence/thresholds.ts | 426 | ✅ |
| 14 | src/lib/confidence/utils.ts | 135 | ✅ |
| 15 | src/lib/constants/api-auth.ts | 231 | ✅ |
| 16 | src/lib/constants/error-types.ts | 250 | ✅ |
| 17 | src/lib/constants/source-types.ts | 125 | ✅ |
| 18 | src/lib/date-range-utils.ts | 325 | ✅ |
| 19 | src/lib/db-context.ts | 277 | ✅ |
| 20 | src/lib/document-status.ts | 342 | ✅ |
| 21 | src/lib/edge-logger.ts | 121 | ✅ |
| 22 | src/lib/email.ts | 393 | ✅ |
| 23 | src/lib/encryption.ts | 388 | ✅ |
| 24 | src/lib/errors.ts | 142 | ✅ |
| 25 | src/lib/errors/prompt-resolution-errors.ts | 113 | ✅ |
| 26 | src/lib/hash.ts | 219 | ✅ |
| 27 | src/lib/i18n-api-error.ts | 283 | ✅ |
| 28 | src/lib/i18n-currency.ts | 192 | ✅ |
| 29 | src/lib/i18n-date.ts | 215 | ✅ |
| 30 | src/lib/i18n-number.ts | 132 | ✅ |
| 31 | src/lib/i18n-zod.ts | 228 | ✅ |
| 32 | src/lib/learning/correctionAnalyzer.ts | 267 | ✅ |
| 33 | src/lib/learning/index.ts | 30 | ✅ |
| 34 | src/lib/learning/ruleSuggestionTrigger.ts | 251 | ✅ |
| 35 | src/lib/metrics/index.ts | 19 | ✅ |
| 36 | src/lib/metrics/prompt-metrics.ts | 362 | ✅ |
| 37 | src/lib/middleware/n8n-api.middleware.ts | 330 | ✅ |
| 38 | src/lib/notification.ts | 72 | ✅ |

---

## 2. 發現

### [High] AUTH-01 生產環境未配置 Azure AD 時，`X-Dev-Bypass-Auth` header 可繞過認證取得全域管理員 Session
- **檔案**：src/lib/auth.ts:91-93、:392-404
- **類別**：A（認證與授權）、I（認證機制本身）
- **描述**：
  `isDevelopmentMode()` 的判斷為「`NODE_ENV === 'development'` **OR** `!isAzureADConfigured()`」。此為 OR 條件，代表**只要 Azure AD 沒有配置，即使 `NODE_ENV=production`，`isDevelopmentMode()` 仍回傳 `true`**。

  `getAuthSession()` 在此情況下會檢查請求 header，只要帶有 `X-Dev-Bypass-Auth: true`，就直接回傳 `DEV_MOCK_SESSION`（`isGlobalAdmin: true`、`cityCodes: ['*']`、`permissions: ['*']`）——完全繞過密碼/SSO 驗證。

  本專案明確支援「僅本地帳號」的部署型態（Epic 18），這類部署不會配置 Azure AD，因此 `isAzureADConfigured()` 為 `false`，導致此 bypass 在正式環境被啟用。`getAuthSession()` 目前被 `src/app/api/admin/historical-data/*`（共 5 個 admin 端點，含上傳、檔案列表、批次處理）使用，意味著未認證攻擊者只要附上該 header 即可觸發 admin 級操作。
- **證據**：
  ```ts
  // auth.ts:91-93
  function isDevelopmentMode(): boolean {
    return process.env.NODE_ENV === 'development' || !isAzureADConfigured()
  }
  // auth.ts:393-399
  if (isDevelopmentMode() && request) {
    const bypassHeader = request.headers.get('X-Dev-Bypass-Auth')
    if (bypassHeader === 'true') {
      console.log('[Auth] Development mode bypass enabled via X-Dev-Bypass-Auth header')
      return DEV_MOCK_SESSION   // 全域管理員
    }
  }
  ```
- **建議**：將 bypass 的閘門收斂為「**僅** `NODE_ENV === 'development'`」（與 auth.config.ts 中 `authorize` 的 dev 判斷一致：`NODE_ENV === 'development' && !isAzureADConfigured()`），不要把「未配置 Azure AD」視同開發模式。或新增獨立旗標（如 `ALLOW_DEV_AUTH_BYPASS`）並在生產組建時強制關閉。

### [Medium] AZURE-01 Blob 容器以 `access: 'blob'` 建立，文件（含發票 PII）對外公開可讀
- **檔案**：src/lib/azure/storage.ts:130-135（`ensureContainer`）、src/lib/azure-blob.ts:51-53（`getContainerClient`）
- **類別**：H（檔案處理）、J（資訊洩漏）
- **描述**：
  兩支 Blob 模組在建立容器時都設定 `access: 'blob'`，即**匿名 blob 級公開讀取**。預設容器名為 `documents`（storage.ts:70、azure-blob.ts:29），與發票文件共用。發票屬高敏感資料（含金額、公司、可能 PII），一旦容器為公開讀取，任何知道 blob URL 的人都能直接下載，**使 `generateSasUrl()`（只讀、限時）的存取控制設計形同虛設**。blob 名稱為 `${folder}/${timestamp}-${sanitizedName}`（storage.ts:171-176），帶有時間戳與原檔名，並非不可預測；且 `blobUrl` 會回傳並存入 DB，若任一 API 回應或前端洩漏 URL 即等同公開檔案。
- **證據**：
  ```ts
  // azure/storage.ts:130-135
  await client.createIfNotExists({
    access: 'blob', // blob 級別的公開訪問
  });
  ```
- **建議**：文件容器改為**私有**（`createIfNotExists()` 不帶 `access`，即 private），一律透過 SAS URL 授權讀取。若 forwarder logo 需要公開，應與發票文件分容器（公開容器只放非敏感圖片）。

### [Medium] AUTH-02 Middleware 授權僅覆蓋 `/dashboard` 與 `/api/v1`，其餘 API 命名空間不經 middleware 驗證
- **檔案**：src/lib/auth.config.ts:272-307（`authorized` callback）
- **類別**：A（認證與授權）
- **描述**：
  middleware 的 `authorized` callback 只把 `/dashboard` 與 `/api/v1` 視為受保護路徑（`isOnApi = pathname.startsWith('/api/v1')`）。`/api/admin`、`/api/documents`、`/api/reports`、`/api/companies`、`/api/rules`、`/api/cost` 等命名空間**完全不經 middleware 授權**，須各自在 route handler 內檢查。這與已知系統性缺口（auth 覆蓋率約 60%、`/companies` 與 `/cost` 為 0%）相符——任何漏寫 in-route 檢查的端點即等於對外公開。此檔為 middleware 授權邏輯的定義處，故在此記錄。
- **證據**：
  ```ts
  // auth.config.ts:274-275
  const isOnDashboard = nextUrl.pathname.startsWith('/dashboard')
  const isOnApi = nextUrl.pathname.startsWith('/api/v1')
  ```
- **建議**：對需要登入的 API 命名空間（admin、documents、reports、companies、rules、cost）在 middleware 增加統一的「已登入」基線檢查，再由 route 做細粒度權限；或建立明確白名單標示哪些路徑可匿名存取，其餘預設拒絕。

### [Low] AUTH-03 Wildcard `'*'` 權限於生產環境仍被接受，僅在 development 才有告警
- **檔案**：src/lib/auth/city-permission.ts:387-416（`hasPermission`）、:104-110、:339-348
- **類別**：A（認證與授權）
- **描述**：
  `hasPermission()` 對帶有 `'*'` 的角色直接放行所有權限檢查，僅在 `NODE_ENV === 'development'` 時 `console.warn`。函式 JSDoc 自述「wildcard 僅限開發/測試」「生產應避免使用」，但程式碼**在生產環境並未阻擋或審計** wildcard 角色。若任何角色（含被滲透或誤設的角色）持有 `'*'`，即取得全權限且無記錄。開發模式種子使用者 `dev-user-1` 即被賦予 `['*']`（auth.ts:178、:359）。
- **證據**：
  ```ts
  // city-permission.ts:400-409
  if (hasWildcard) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[Wildcard Permission] ...`)
    }
    return true
  }
  ```
- **建議**：生產環境若偵測到 wildcard 角色，應寫入審計日誌（而非僅 dev 告警），並評估是否禁止非系統角色持有 `'*'`。

### [Low] AUTH-04 `ApiKeyService.checkCityAccess` 空陣列代表「可存取所有城市」，預設過於寬鬆
- **檔案**：src/lib/auth/api-key.service.ts:186-195
- **類別**：A（認證與授權）
- **描述**：
  `checkCityAccess()` 當 `cityAccess` 為 `undefined` 或空陣列時回傳 `true`（視為全城市可存取）。若某 API Key 的 `cityAccess` 因資料異常或建立流程遺漏而為空，會被解讀為「不限城市」而非「無城市權限」，屬 fail-open 設計。多城市隔離（Epic 6）情境下風險較高。
- **證據**：
  ```ts
  // api-key.service.ts:191-194
  if (!cityAccess || cityAccess.length === 0) {
    return true;
  }
  return cityAccess.includes(cityCode);
  ```
- **建議**：確認此 fail-open 為刻意設計；若否，改為空陣列代表「無權限」（fail-closed），並在 API Key 建立時強制指定城市範圍或顯式的 `['*']` 標記。

### [Low] LOG-01 認證 debug 日誌仍含 email（FIX-050 未回歸，但 debug 級別仍輸出 PII）
- **檔案**：src/lib/auth.config.ts:139、:176-179、:187-190
- **類別**：E（PII 與日誌）
- **描述**：
  FIX-050（auth.config.ts 以 `console.log` 輸出 email）**未回歸**：登入成功僅記錄 `userId`（:215），失敗合併分支以緩解帳號列舉（:171-181），且已改用 `edgeLogger`。惟失敗原因與開發模式登入仍在 `edgeLogger.debug` 層級輸出 `{ email }`。edge-logger 在生產預設為 `info`（:42-47），故生產預設不會輸出，符合 H4 的「debug-only + 生產關閉」例外。屬縱深防禦提醒：若 `LOG_LEVEL=debug` 被誤設於生產，email 會進入 log。
- **證據**：
  ```ts
  // auth.config.ts:176-179
  edgeLogger.debug('[Auth] Failure detail', {
    email,
    reason: !user ? 'USER_NOT_FOUND' : 'NO_PASSWORD',
  })
  ```
- **建議**：維持現狀即可；若要更嚴格，debug 時也對 email 做遮蔽（如僅記錄 domain 或雜湊）。確保生產不要把 `LOG_LEVEL` 設為 `debug`。

### [Low] DB-01 `getAuditLogs` 的 `limit` 無上限，由呼叫端完全控制
- **檔案**：src/lib/audit/logger.ts:253-304
- **類別**：K（無界查詢 / DoS 面）
- **描述**：
  `getAuditLogs({ limit })` 預設 50，但未設上限（如 max 100/200）。若呼叫端（API route）直接把使用者輸入的 `limit` 傳入而未夾限，攻擊者可請求極大筆數造成昂貴查詢。此為 lib 層觀察，實際風險取決於呼叫端是否夾限。
- **證據**：
  ```ts
  // logger.ts:261-262, 285-288
  limit = 50, ...
  prisma.auditLog.findMany({ where, take: limit, skip: offset, ... })
  ```
- **建議**：在此函式對 `limit` 設硬上限（如 `Math.min(limit, 200)`），即使呼叫端遺漏夾限也能防護。

### [Info] DEV-01 開發模式種子使用者 `dev-user-1` 為硬編碼全權限身份
- **檔案**：src/lib/auth.ts:171-185、:350-367、prisma/seed.ts:431-438
- **類別**：A（認證與授權）
- **描述**：
  JWT callback 對 `token.sub === 'dev-user-1'` 直接賦予 `permissions: ['*']`、`cityCodes: ['*']`、`isGlobalAdmin: true`。此使用者由 `prisma/seed.ts` 建立（prod 專用 seed `seed-prod-essential.ts` 已明確不建立）。風險點：若正式環境誤跑 dev seed，DB 會存在全權限的 `dev-user-1`。auth.config.ts 的 `authorize` dev 分支（`NODE_ENV === 'development' && !isAzureADConfigured()`）才會回傳此 id，生產的 `authorize` 不會產生它；但與 AUTH-01 的 `getAuthSession` bypass 結合需一併留意部署衛生。
- **建議**：在部署檢查清單明確禁止於正式環境執行 dev seed；或於應用啟動時偵測到 `dev-user-1` 存在且 `NODE_ENV=production` 時告警。

### [Info] AZURE-02 `downloadBlob` / `generateSasUrl` / `deleteBlob` 等以 `blobName` 為參數，未在 lib 層驗證
- **檔案**：src/lib/azure-blob.ts:152-168、:182-204、:291-301；src/lib/azure/storage.ts:213-289
- **類別**：H（檔案處理 / path traversal）
- **描述**：
  這些函式直接以 `blobName` 操作 Blob。Azure Blob 為扁平命名空間、容器隔離，`/` 僅為分隔符，跨容器 traversal 不成立；但若上層 route 將使用者輸入直接當作 `blobName`，仍可在**同一容器**內存取非預期物件。屬上層責任，於此記錄供呼叫端審查時對照。
- **建議**：呼叫端傳入的 `blobName` 應來自 DB 紀錄而非使用者原始輸入；若需使用者輸入，應驗證前綴/格式。

### [Info] LOG-02 開發模式郵件以 `console.log` 輸出收件者地址
- **檔案**：src/lib/email.ts:104-110、:38-45
- **類別**：E（PII 與日誌）
- **描述**：
  `sendEmail` 在 `NODE_ENV === 'development' && !SMTP_HOST` 時 `console.log` 輸出 `{ to, subject }`，且 JSON transport 會把含驗證/重設 token 的內容輸出至 console。僅限開發環境，符合慣例例外。驗證/重設連結（含 token）本身透過郵件傳遞屬正常設計。
- **建議**：維持現狀；確保生產一定配置 `SMTP_HOST`，避免落入 JSON transport 分支。

---

## 3. 統計

| Critical | High | Medium | Low | Info |
|----------|------|--------|-----|------|
| 0 | 1 | 2 | 4 | 3 |

---

## 4. 區域整體觀察

- **FIX-050 / FIX-051 均未回歸**：
  - FIX-050（auth.config.ts console.log email）：已改用 `edgeLogger`，登入成功只記 `userId`，email 僅在 `debug` 層級出現（生產預設 info 不輸出）。
  - FIX-051（db-context.ts `$executeRawUnsafe` SQL injection）：`setRlsContext` 對所有 `cityCodes` 先過 `sanitizeCityCode()` 白名單正則 `^[A-Z]{2,4}$`，`isGlobalAdmin` 轉為字面量 `'true'/'false'`；`clearRlsContext` 僅嵌入 hard-coded 字面量。防護完整且有清楚註解。
- **加密與雜湊實作穩健**：`encryption.ts` 使用 AES-256-GCM + scrypt + 隨機 IV/Salt + `timingSafeEqual` 固定時間比較，`getMasterKey` 強制環境變數且長度 ≥32；`api-key.service.ts` 以 `crypto.randomBytes(32)` 產生 key、SHA-256 雜湊儲存。無硬編碼 secret。
- **本區最大風險為「開發便利性外溢到生產」**：AUTH-01 的 `isDevelopmentMode()` OR 邏輯，使「未配置 Azure AD」被當成開發模式，連帶啟用 `X-Dev-Bypass-Auth` 全域管理員繞過——在僅本地帳號的正式部署型態下為實質高風險。建議優先處理。
- **Blob 公開讀取（AZURE-02→AZURE-01）**：兩支 Blob 模組都以 `access: 'blob'` 建容器，與發票文件共用，使 SAS 限時授權失去意義；建議文件容器改私有。
- **i18n / confidence / constants / errors / date / metrics / learning 等檔**：均為純計算、格式化或資料存取，無原始 SQL、無 command injection、無硬編碼 secret，未發現可利用問題。`i18n-api-error.ts` 的 type URL 使用 `api.example.com` 佔位網域、不洩漏內部主機；錯誤回應結構（RFC 7807）不含 stack trace。
- **次要 fail-open 模式**：`hasPermission` 的 wildcard（AUTH-03）與 `checkCityAccess` 空陣列（AUTH-04）在邊界情況偏寬鬆，建議依實際需求收斂為 fail-closed 或加審計。
