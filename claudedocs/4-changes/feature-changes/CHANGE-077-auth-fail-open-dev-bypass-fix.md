# CHANGE-077: 認證 fail-open 與 dev-bypass 後門修復

> **日期**: 2026-06-10
> **狀態**: 🔧 實作中（code + 文件完成、type-check/lint 通過；adapter E2E 待 staging 驗證）
> **優先級**: High
> **類型**: Security
> **影響範圍**: `src/lib/auth.ts`、`src/lib/auth.config.ts`（驗證對齊）、`.env.example`、部署文件
> **來源**: 2026-06-10 全面安全審查 — SECURITY-ASSESSMENT.md §2、REMEDIATION-ROADMAP.md WP-1、P0-DETAILED-PLAN.md WP-1
> **H1 approval**: 用戶於 2026-06-10 明確 approve 此認證架構改動

---

## 變更背景

2026-06-10 全面安全審查（逐檔逐行）發現**認證 fail-open 與 dev-bypass 後門**，被 5 個獨立審查範圍重複命中（I-01、I-02、ADMIN0-06、ADMIN-1-004、AUTH-01），屬 P0 最高優先地基問題。

**已逐行驗證的根因 — 兩處「開發模式」判斷邏輯不一致**：

| 位置 | 判斷式 | 語意 |
|------|--------|------|
| `src/lib/auth.config.ts:129`（登入 `authorize`） | `NODE_ENV==='development' && !isAzureADConfigured()` | 嚴格（正確） |
| `src/lib/auth.ts:92`（`isDevelopmentMode`） | `NODE_ENV==='development' \|\| !isAzureADConfigured()` | 寬鬆（**危險**） |

而 `src/lib/auth.ts:80-85` 的註解錯誤聲稱「此邏輯必須與 auth.config.ts 一致」——實際不一致（`||` vs `&&`）。

**衍生的兩個風險**：

1. **`X-Dev-Bypass-Auth` header 後門（屬實）**：`getAuthSession(request)`（`auth.ts:392-400`）在 `isDevelopmentMode()`（`||` 版本）為真時，請求帶 `X-Dev-Bypass-Auth: true` → 直接回傳 `DEV_MOCK_SESSION`（`isGlobalAdmin`、權限 `['*']`、城市 `['*']`）。在「`NODE_ENV=production` 但 Azure AD 未配置」狀態即生效。**影響面**：目前僅 5 個使用 `getAuthSession(request)` 的 historical-data 端點（已 grep 確認），但任何新端點誤用 `getAuthSession` 即擴大攻擊面。

2. **「免密碼登入」部署陷阱**：登入 `authorize` 用 `&&`，故 `NODE_ENV=production` 下即使 Azure AD 未配置仍走真實 bcrypt 密碼驗證；「免密碼登入」**僅在 `NODE_ENV=development` 成立**。但 `.env.example:56` 預設 `NODE_ENV="development"`，生產若沿用此預設則完整 dev 後門全開。

> **定級說明**：原審查 I-01 列 Critical，經逐行驗證後降為 High（生產實際走真實驗證，非 fail-open）；SECURITY-ASSESSMENT.md 已同步修正（Critical 11→10、High 36→37）。

**正面前提（降低修復風險）**：seed 建立的 `admin@ai-document-extraction.com`（有密碼、`isGlobalAdmin`、`emailVerified`）為本地帳號，走 `auth.config.ts` 獨立的真實密碼驗證，**不受 `isDevelopmentMode` 影響**。因此本變更改為 fail-closed 後，正常登入幾乎零影響。

---

## 變更內容

### 變更項目 1：統一 `isDevelopmentMode()` 判斷邏輯（`||` → `&&`）
`src/lib/auth.ts:92` 改為與 `auth.config.ts:129` 一致：
```ts
// Before
return process.env.NODE_ENV === 'development' || !isAzureADConfigured()
// After
return process.env.NODE_ENV === 'development' && !isAzureADConfigured()
```
效果：`NODE_ENV=production` 下 `isDevelopmentMode()` 恆為 false → 關閉 X-Dev-Bypass 與 dev 分支。

### 變更項目 2：`getAuthSession` 的 X-Dev-Bypass 加 NODE_ENV 硬 gate
`src/lib/auth.ts:394` 將條件與 `isDevelopmentMode()` 解耦，獨立硬性要求 `NODE_ENV==='development'`，作為雙重保險（即使未來 `isDevelopmentMode` 再被改寬，後門仍被 `NODE_ENV` 擋住）：
```ts
if (process.env.NODE_ENV === 'development' && request) {
  const bypassHeader = request.headers.get('X-Dev-Bypass-Auth')
  ...
}
```

### 變更項目 3：修正誤導性註解
`src/lib/auth.ts:80-85` 註解更新，明確兩處 dev 判斷語意一致、且 dev bypass 僅限本地。

### 變更項目 4：`.env.example` 部署陷阱告警
`.env.example:56` 加註解警告生產務必設 `NODE_ENV=production`（考慮預設值改為 production + 註解說明本地開發改 development）。

### 變更項目 5：部署文件檢查項
於 `docs/07-deployment/` 相關檢查清單加入「生產環境 `NODE_ENV` 必須為 `production`」驗證項。

---

## 技術設計

### 修改範圍

| 文件 | 變更內容 | 處數 |
|------|----------|------|
| `src/lib/auth.ts` | `isDevelopmentMode()` `\|\|`→`&&`（L92）；`getAuthSession` 加 `NODE_ENV` gate（L394）；註解修正（L80-85） | 3 |
| `.env.example` | `NODE_ENV` 部署陷阱告警註解（L56 附近） | 1 |
| `docs/07-deployment/*`（待定位具體檔案） | 加 `NODE_ENV=production` 檢查項 | 1 |
| `tests/`（新增） | WP-1 認證行為迴歸測試 | 新增 |

### i18n 影響
無（不涉及 UI 字串）。

### 資料庫影響
無 Schema 變更。但需注意 `auth.ts:135` 的 `PrismaAdapter` 掛載條件依賴 `isDevelopmentMode()`（見技術債務）。

---

## 設計決策

1. **採 `&&` 而非直接移除 `!isAzureADConfigured()`** — 保留「本地開發且未配置 Azure AD 時用簡化流程」的開發體驗，與 `auth.config.ts:129` 完全對齊，最小化語意變動。
2. **X-Dev-Bypass 額外加獨立 `NODE_ENV` gate（縱深防禦）** — 即使 `isDevelopmentMode()` 未來再被誤改，`NODE_ENV` 仍是最後防線。
3. **fail-closed 而非 fail-open** — Azure AD 未配置的生產環境應拒絕降級登入；本地帳號（含 seed admin）不受影響，故可安全 fail-closed。

---

## ⚠️ 技術債務 / 待測試項

| 項目 | 說明 |
|------|------|
| 原設計 | `isDevelopmentMode()` 用 `\|\|`，且兼作 `PrismaAdapter` 掛載判斷（`auth.ts:135`） |
| 變更後副作用 | 改 `&&` 後，「生產 + Azure AD 未配置」時 `isDevelopmentMode()` 變 false → 會掛載 `PrismaAdapter` |
| 風險 | JWT 策略理論上不依賴 adapter session，但需**實測** Credentials + JWT 登入在掛 adapter 後仍正常 |
| 緩解方案 | 若實測有問題，將「adapter 掛載判斷」與「dev-bypass 判斷」拆成兩個獨立條件函數（adapter 用 `!isAzureADConfigured()`、bypass 用 `NODE_ENV==='development'`） |
| H1 approval | 用戶 2026-06-10 approve |

---

## 影響範圍評估

### 文件影響清單

| 文件路徑 | 類型 | 說明 |
|----------|------|------|
| `src/lib/auth.ts` | 🔧 修改 | 核心修復 |
| `.env.example` | 🔧 修改 | 部署告警 |
| `docs/07-deployment/*` | 🔧 修改 | 檢查項 |
| `tests/*` | 🆕 新增 | 迴歸測試 |

### 向後兼容性
- ✅ 本地開發（`NODE_ENV=development`）：DevLogin 與 X-Dev-Bypass 仍可用，無影響。
- ✅ 生產（`NODE_ENV=production`）+ Azure AD 已配置：無影響。
- ✅ 生產 + 本地帳號（如 seed admin）：真實密碼登入不受影響。
- ⚠️ 生產 + Azure AD 未配置 + 過去依賴 X-Dev-Bypass 的腳本/整合：將失效（這正是修復目標）。需確認無生產流程依賴此後門。

---

## 風險評估

| 風險 | 等級 | 緩解 |
|------|------|------|
| PrismaAdapter 掛載破壞 Credentials 登入 | 中 | 實測；必要時拆分判斷條件（見技術債務） |
| 某環境正依賴 fail-open 登入 | 中 | 前置盤點各環境 `NODE_ENV` 與 Azure AD 配置（用戶已知需盤點）；確保本地帳號可登入後再上線 |
| 部署誤設 `NODE_ENV` | 低 | 變更項目 4/5 加告警與檢查項 |

## 回滾計劃
單檔改動，git revert 即可還原。上線後監控登入成功率與 401/403 異常。

---

## 驗收標準

| # | 驗收項目 | 驗收標準 | 優先級 |
|---|----------|----------|--------|
| 1 | 關閉 header 後門 | `NODE_ENV=production` + 帶 `X-Dev-Bypass-Auth: true` → 不回傳 mock session | High |
| 2 | 本地帳號登入正常 | `NODE_ENV=production`，`admin@...` 密碼登入成功 | High |
| 3 | 本地開發體驗保留 | `NODE_ENV=development` 下 DevLogin 與 bypass 仍可用 | Medium |
| 4 | adapter 行為 | 掛載 PrismaAdapter 後 Credentials 登入無迴歸 | High |
| 5 | type-check / lint | `npm run type-check && npm run lint` 通過 | High |

## 測試場景

| # | 場景 | 測試步驟 | 預期結果 |
|---|------|----------|----------|
| 1 | 生產關閉 bypass | 設 `NODE_ENV=production`，對 historical-data 端點帶 `X-Dev-Bypass-Auth: true` | 401（非管理員 session） |
| 2 | 生產本地帳號登入 | `NODE_ENV=production`，以 seed admin 帳密登入 | 登入成功，取得 isGlobalAdmin |
| 3 | 開發 bypass 保留 | `NODE_ENV=development`，帶 bypass header | 回傳 dev mock session |
| 4 | adapter 迴歸 | 生產 + Azure AD 未配置，本地帳號登入 | 登入成功，無 adapter 相關錯誤 |

---

## 實作記錄（2026-06-10）

### 已完成改動
| 檔案 | 改動 | 結果 |
|------|------|------|
| `src/lib/auth.ts:92` | `isDevelopmentMode()` `\|\|`→`&&`（與 auth.config.ts:129 對齊） | ✅ |
| `src/lib/auth.ts:~396` | `getAuthSession` 的 X-Dev-Bypass 加獨立 `NODE_ENV==='development'` 硬 gate | ✅ |
| `src/lib/auth.ts:76-91` | 註解修正（標註 CHANGE-077 安全理由、移除誤導描述） | ✅ |
| `.env.example` | `NODE_ENV` 部署陷阱告警 + Azure AD 註解修正 | ✅ |
| `docs/07-deployment/01-local-deployment/environment-variables-reference.md` | `NODE_ENV` 生產檢查項 + Azure AD 影響描述修正 | ✅ |

### 驗證結果
- ✅ `tsc --noEmit`：`auth.ts` / `auth.config.ts` 0 類型錯誤
- ✅ `eslint auth.ts auth.config.ts`：0 errors（2 個既有 warning：L280 `account` 未用、L399 dev-only console.log，與本次改動無關，依 surgical 原則未動）
- ⏳ **adapter E2E（驗收標準 #4）待 staging 驗證**

### 技術債務驗證：PrismaAdapter 行為（靜態分析，低風險）
- **疑慮**：改 `&&` 後「生產 + Azure AD 未配置」時 `isDevelopmentMode()` 為 false → `auth.ts:135` 會掛 `PrismaAdapter`。
- **靜態分析結論**：session 策略為 `jwt`（`auth.config.ts:258`）；NextAuth v5 中 Credentials provider 強制走 JWT，登入流程（`authorize` → `jwt` → `session` callback）不呼叫 adapter 的 `createUser`/`session` 方法。`PrismaAdapter` 僅在 OAuth（Azure AD）登入時介入 account linking。**故掛 adapter 不影響本地帳號 Credentials 登入**，風險低。
- **待驗證**：staging（`NODE_ENV=production` + Azure AD 未配置 + seed admin 登入）做一次 E2E 確認，作為部署前 gate（對應測試場景 #2、#4）。

---

## 相關文件
- SECURITY-ASSESSMENT.md §2（根因與定級修正）
- REMEDIATION-ROADMAP.md WP-1
- P0-DETAILED-PLAN.md WP-1
- 後續：CHANGE-078（WP-2 middleware）、FIX-063~067（WP-3 端點認證）
