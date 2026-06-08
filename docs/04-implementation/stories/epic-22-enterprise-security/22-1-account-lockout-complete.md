# Story 22.1: 帳號鎖定機制完整實作

**Status:** Planned

---

## Story

**As a** 系統安全管理員,
**I want** 系統具備完整的帳號鎖定機制（觸發 + 解鎖 + 審計三項齊發）,
**So that** 認證端點能抵禦暴力破解攻擊，且不會因為合法用戶被鎖定而造成 IT 高負擔。

---

## 背景說明

### 問題陳述

Phase 2 盤點報告（`docs/08-security-and-governance/phase2-iam-dp-assessment.md`）發現 **IAM-07a / IAM-07b / IAM-07c 三項全部 L0**（完全未實作）：

1. **IAM-07a**（觸發機制）— 完全沒有失敗計數、時間窗口、鎖定邏輯
2. **IAM-07b**（解鎖流程）— 沒有自動衰減、admin UI、用戶自助任何一種
3. **IAM-07c**（審計日誌）— 雖然 SecurityLog model 存在但無對應業務邏輯記錄

證據：
- 全 codebase 搜尋 `failedLoginAttempts|lockedUntil|lockoutUntil|accountLocked` 僅匹配翻譯文件，**沒有實作代碼**
- `auth.config.ts` L171-192 失敗時僅 `return null` + log 記錄，**無計數、無鎖定**
- `User` model 沒有 `failedLoginAttempts`、`lockedUntil` 欄位

### 為何需要

| 需求 | 說明 |
|------|------|
| **暴力破解防護** | API Auth 覆蓋率僅 60.7%，配合 `/api/auth/*` 端點完全無 rate limit，暴力破解風險極高 |
| **企業合規** | OWASP A07（Identification and Authentication Failures）要求帳號鎖定 |
| **防 IT 災難** | 若實作鎖定但無解鎖（07a 單做），用戶必須打給 IT 才能解鎖，業務癱瘓 |
| **審計追溯** | 鎖定事件必須記錄誰、何時、為何，供 SOC2 / ISO 27001 審計 |

### 矩陣 v1.2 半成品反模式警告

> **⚠️ 重要警告**：矩陣 v1.2 第 56 行明確標示「**IAM-07a 不得單獨實作。若實作鎖定但無解鎖流程，IAM-07 整體評為 L0（比沒做還危險）**，因為會導致用戶必須打給 IT 才能解鎖，影響業務」。
>
> 本 Story 必須**三項齊發**（觸發 + 解鎖 + 審計），否則應視為失敗。Tech Spec 已對齊矩陣 v1.2 IAM-07b 的解鎖三選項要求（自動衰減 / 管理員 UI / 用戶自助）— 本 Story 三項全做以提供最佳 UX。

### 設計決策

- **欄位設計**：`User.failedLoginAttempts: Int @default(0)`、`User.lockedUntil: DateTime?`、`User.lockReason: String?`
- **鎖定閾值**：5 次失敗 / 15 分鐘窗口（業界標準）
- **自動衰減**：30 分鐘後 lockedUntil 自動失效（用戶下次登入時自動解除）
- **解鎖三管齊下**：自動衰減 + admin 即時解鎖 + 用戶 email token 自助
- **跨 Provider**：CredentialsProvider（密碼登入）+ Microsoft Entra ID（SSO 失敗）都觸發
- **審計事件**：新增 `ACCOUNT_LOCKED` 與 `ACCOUNT_UNLOCKED` 兩個 SecurityEventType
- **i18n**：在 `messages/{en,zh-TW,zh-CN}/auth.json` 新增鎖定相關訊息

---

## Acceptance Criteria

### AC1: 鎖定觸發機制（IAM-07a）

**Given** 攻擊者嘗試對 `email@example.com` 進行密碼暴力破解
**When** 在 15 分鐘內累計 5 次登入失敗
**Then**
- `User.failedLoginAttempts` 累加至 5
- `User.lockedUntil` 設為 `now() + 30 minutes`
- `User.lockReason` 設為 `"Too many failed login attempts"`
- 第 6 次起的登入嘗試直接拒絕（即使密碼正確），返回統一鎖定訊息
- 寫入 `SecurityLog`：`eventType=ACCOUNT_LOCKED, severity=HIGH, userId, ipAddress, userAgent`

### AC2: 自動時間衰減解鎖（IAM-07b 選項 1）

**Given** 用戶帳號因 AC1 被鎖定（`lockedUntil = T+30min`）
**When** 在 `lockedUntil` 時間點之後（例如 T+31min）嘗試登入並輸入正確密碼
**Then**
- 系統視為解鎖（`lockedUntil < now()`）
- `User.failedLoginAttempts` 重置為 0
- `User.lockedUntil` 設為 `null`
- `User.lockReason` 設為 `null`
- 登入成功並寫入 `SecurityLog`：`eventType=ACCOUNT_UNLOCKED, severity=MEDIUM, metadata: { reason: 'auto_decay' }`

### AC3: 管理員手動解鎖 UI（IAM-07b 選項 2）

**Given** 用戶 A 帳號被鎖定，IT 收到求助電話
**When** System Admin 在 `/admin/users/[id]` 頁面點擊「立即解鎖」按鈕並填寫解鎖原因
**Then**
- 呼叫 `POST /api/admin/users/[id]/unlock` 端點
- 端點驗證 admin 具備 `USER_MANAGE` permission
- `User.failedLoginAttempts` 重置為 0
- `User.lockedUntil` 設為 `null`
- 寫入 `SecurityLog`：`eventType=ACCOUNT_UNLOCKED, severity=MEDIUM, metadata: { reason: 'admin_unlock', unlockedBy: <admin_id>, comment: <reason> }`
- UI 顯示成功訊息（i18n key: `auth.unlock.adminSuccess`）
- 用戶下次登入即可成功

### AC4: 用戶自助解鎖（IAM-07b 選項 3）

**Given** 用戶 A 收到帳號鎖定通知（含 email 內 self-unlock token）
**When** 用戶點擊 email 中的「立即解鎖我的帳號」連結（含一次性 token，30 分鐘內有效）
**Then**
- 呼叫 `POST /api/auth/self-unlock` 端點，body: `{ token: string }`
- 系統驗證 token 有效（未過期、未使用、屬於該用戶）
- `User.failedLoginAttempts` 重置為 0
- `User.lockedUntil` 設為 `null`
- Token 標記為已使用（`UnlockToken.usedAt = now()`）
- 寫入 `SecurityLog`：`eventType=ACCOUNT_UNLOCKED, severity=MEDIUM, metadata: { reason: 'self_unlock' }`
- 重定向到登入頁，顯示成功訊息

**SSO 用戶**：若用戶使用 Azure AD SSO 登入，不適用密碼鎖定流程；若 Azure AD 多次失敗導致鎖定，建議 SSO 重新登入即視為解鎖。

### AC5: 完整審計記錄（IAM-07c）

**Given** 任何鎖定 / 解鎖事件發生
**When** 觸發點執行
**Then**
- 必寫入 `SecurityLog`，欄位包含：
  - `eventType`: `ACCOUNT_LOCKED` 或 `ACCOUNT_UNLOCKED`（新 enum 值）
  - `severity`: `HIGH`（鎖定）/ `MEDIUM`（解鎖）
  - `userId`: 受影響用戶
  - `ipAddress`: 觸發者 IP
  - `userAgent`: 觸發者 User Agent
  - `metadata`: JSONB，包含 `{ reason, attempts, lockDuration, unlockMethod }` 等
  - `resolved`: false（鎖定）/ true（解鎖）
- 同時寫入 `AuditLog`（action=`ACCOUNT_LOCKED`/`ACCOUNT_UNLOCKED`，resourceType=`User`）
- admin 可在 `/admin/security-logs` 查詢這些事件

### AC6: 失敗計數成功登入後重置

**Given** 用戶 A 的 `User.failedLoginAttempts = 3`（尚未達 5 次鎖定）
**When** 用戶 A 在第 4 次嘗試輸入正確密碼成功登入
**Then**
- `User.failedLoginAttempts` 重置為 0
- `User.lockedUntil` 維持為 `null`
- 不寫入 SecurityLog（成功登入屬一般 audit log）
- 用戶能正常使用系統

### AC7: 雙 Provider 整合

**Given** 系統同時支援 Credentials Provider（本地密碼）+ Microsoft Entra ID（Azure AD SSO）
**When** 任一 Provider 認證流程
**Then**
- **CredentialsProvider**：失敗時呼叫 `incrementFailedAttempts(userId)`；成功時呼叫 `resetFailedAttempts(userId)`
- **Microsoft Entra ID**：因 AAD 自身有鎖定機制，本系統**不額外計數 SSO 失敗**；但 AAD 端鎖定後若用戶切換到 Credentials 嘗試，仍套用本機制
- 鎖定狀態檢查在 `auth.ts` `authorize` callback 與 NextAuth `signIn` callback 兩處生效，**任一 Provider 通過 callback 前都先檢查 `lockedUntil`**

### AC8: 用戶體驗友善（不影響合法用戶）

**Given** 鎖定錯誤訊息設計
**When** 用戶在以下情境見到錯誤
**Then**
- **首次失敗**：錯誤訊息為「Email 或密碼錯誤」（i18n: `auth.errors.invalidCredentials`），不洩漏 email 是否存在
- **第 5 次失敗剛好觸發鎖定**：錯誤訊息為「您的帳號因多次登入失敗已被鎖定 30 分鐘。我們已寄出解鎖郵件至 e***@example.com，您也可以聯絡管理員協助。」（i18n: `auth.errors.accountLockedJustNow`，email 必須遮罩）
- **鎖定中再次嘗試**：錯誤訊息為「您的帳號目前處於鎖定狀態，剩餘 X 分鐘。請查收解鎖郵件或聯絡管理員。」（i18n: `auth.errors.accountLockedRemaining`，動態插值剩餘分鐘）
- 三種訊息有清楚的 CTA（解鎖郵件 / 聯絡管理員），不會讓用戶感到「無路可走」

### AC9: 鎖定郵件設計

**Given** 帳號剛被鎖定
**When** 系統觸發解鎖郵件寄送
**Then**
- 透過既有 `src/lib/email.ts` Nodemailer 服務寄出
- 主旨（i18n: `auth.unlockEmail.subject`）：「您的帳號已被暫時鎖定」
- 內文包含：
  - 鎖定原因（5 次密碼失敗）
  - 觸發時的 IP 地址（含地理位置概述，如「台灣 / 台北市附近」— 透過 IP 查詢）
  - 鎖定時間 + 自動解鎖時間
  - 立即解鎖按鈕（含一次性 token URL）
  - 「若這不是你」的提示（建議重設密碼）
- 失敗時不影響鎖定本身（email 寄送 failure 應 log 但不阻擋）

### AC10: 防止計時攻擊（Timing Attack）

**Given** 攻擊者試圖透過響應時間判斷 email 是否存在
**When** 系統處理「不存在的 email」 vs 「存在但密碼錯誤」 vs 「鎖定中」
**Then**
- 三種情境的響應時間差異 < 100ms（透過固定延遲或一致的 bcrypt cost 模擬）
- 錯誤訊息也不洩漏（`auth.errors.invalidCredentials` 三種情境都用，僅鎖定中才換訊息）

---

## Tasks / Subtasks

- [ ] **Task 1: 資料庫 Schema 變更** (AC: #1, #2, #4, #5)
  - [ ] 1.1 在 `User` model 新增 `failedLoginAttempts Int @default(0)`、`lockedUntil DateTime?`、`lockReason String?`、`lastFailedLoginAt DateTime?`
  - [ ] 1.2 新增 `UnlockToken` model（id, userId, token (hashed), createdAt, expiresAt, usedAt）
  - [ ] 1.3 在 `enum SecurityEventType` 新增 `ACCOUNT_LOCKED` 與 `ACCOUNT_UNLOCKED`
  - [ ] 1.4 在 `enum AuditAction` 新增 `ACCOUNT_LOCKED` 與 `ACCOUNT_UNLOCKED`（若不存在）
  - [ ] 1.5 執行 `npx prisma db push --accept-data-loss`（依本項目慣例）
  - [ ] 1.6 執行 `npx prisma generate` 更新 Prisma Client

- [ ] **Task 2: 帳號鎖定服務層** (AC: #1, #2, #6)
  - [ ] 2.1 建立 `src/services/auth/account-lockout.service.ts`
  - [ ] 2.2 實作 `incrementFailedAttempts(userId)` — 累加 + 達閾值即鎖定
  - [ ] 2.3 實作 `resetFailedAttempts(userId)` — 成功登入後重置
  - [ ] 2.4 實作 `isLocked(user)` — 檢查 `lockedUntil > now()`
  - [ ] 2.5 實作 `unlockAccount(userId, method, metadata)` — 統一解鎖入口
  - [ ] 2.6 加入 SecurityLog 寫入邏輯（事件 + severity + metadata）
  - [ ] 2.7 加入單元測試（依賴 Story 22-5 完成 Vitest 框架後補齊）

- [ ] **Task 3: NextAuth 整合（雙 Provider）** (AC: #7)
  - [ ] 3.1 修改 `src/lib/auth.config.ts` `CredentialsProvider.authorize`：
    - 認證前先檢查 `isLocked(user)`，若鎖定則直接拒絕（拋出統一錯誤）
    - 密碼錯誤時呼叫 `incrementFailedAttempts(userId)`
    - 密碼正確時呼叫 `resetFailedAttempts(userId)`
  - [ ] 3.2 修改 `src/lib/auth.ts` `signIn` callback（Microsoft Entra ID 流程）：
    - 找到對應 user 後檢查 `isLocked(user)`，若鎖定則 `return false`（NextAuth 顯示 OAuthSignin error）
    - SSO 不計入 `failedLoginAttempts`
  - [ ] 3.3 確保 timing attack 防護（一致的 bcrypt 計算時間）

- [ ] **Task 4: 自助解鎖 API** (AC: #4)
  - [ ] 4.1 建立 `src/app/api/auth/self-unlock/route.ts` (POST)
  - [ ] 4.2 Zod schema 驗證 `{ token: string }`
  - [ ] 4.3 查詢 `UnlockToken` 並驗證未過期、未使用、屬於對應用戶
  - [ ] 4.4 呼叫 `unlockAccount(userId, 'self_unlock')`
  - [ ] 4.5 標記 token 為已使用
  - [ ] 4.6 加入 rate limiting（每 IP 每小時最多 5 次嘗試）
  - [ ] 4.7 RFC 7807 錯誤格式（top-level）

- [ ] **Task 5: 管理員解鎖 API + UI** (AC: #3)
  - [ ] 5.1 建立 `src/app/api/admin/users/[id]/unlock/route.ts` (POST)
  - [ ] 5.2 驗證 admin session + `USER_MANAGE` permission
  - [ ] 5.3 Zod schema 驗證 `{ reason: string }`
  - [ ] 5.4 呼叫 `unlockAccount(userId, 'admin_unlock', { unlockedBy, comment })`
  - [ ] 5.5 在 `src/app/[locale]/(dashboard)/admin/users/[id]/page.tsx` 顯示鎖定狀態 + 解鎖按鈕
  - [ ] 5.6 建立 `src/components/features/admin/users/UnlockDialog.tsx`（解鎖原因輸入表單）
  - [ ] 5.7 寫入 `AuditLog` 與 `SecurityLog`

- [ ] **Task 6: 鎖定郵件** (AC: #9)
  - [ ] 6.1 建立 `src/services/auth/lockout-notification.service.ts`
  - [ ] 6.2 實作 `sendLockoutEmail(user, ipAddress, unlockToken)`
  - [ ] 6.3 在 `messages/{en,zh-TW,zh-CN}/auth.json` 新增 email subject + body 翻譯
  - [ ] 6.4 整合到 `account-lockout.service.ts` 的鎖定觸發點
  - [ ] 6.5 失敗時 log warning 但不阻擋鎖定流程

- [ ] **Task 7: i18n 翻譯** (AC: #8, #9)
  - [ ] 7.1 在 `messages/en/auth.json` 新增以下 key：
    - `auth.errors.accountLockedJustNow`、`auth.errors.accountLockedRemaining`
    - `auth.unlock.adminSuccess`、`auth.unlock.selfSuccess`、`auth.unlock.tokenInvalid`
    - `auth.unlockEmail.subject`、`auth.unlockEmail.body`、`auth.unlockEmail.cta`
  - [ ] 7.2 同步翻譯到 `messages/zh-TW/auth.json`、`messages/zh-CN/auth.json`
  - [ ] 7.3 執行 `npm run i18n:check` 確認三語同步

- [ ] **Task 8: 整合測試與 E2E** (AC: 全部)
  - [ ] 8.1 撰寫整合測試：5 次失敗觸發鎖定 + SecurityLog 寫入正確
  - [ ] 8.2 撰寫整合測試：自動衰減 30 分鐘後解鎖（透過 mock time）
  - [ ] 8.3 撰寫 E2E 測試（Playwright）：admin 解鎖流程
  - [ ] 8.4 撰寫 E2E 測試（Playwright）：用戶 email 自助解鎖流程
  - [ ] 8.5 撰寫安全測試：timing attack 響應時間差 < 100ms

---

## Dev Notes

### 依賴項

- **前置**：無硬性前置（Story 22-5 測試框架建議先做以提供測試基礎，但本 Story 可獨立完成基本功能）
- **後續**：CHANGE-059（Rate Limit 推廣到 `/api/auth/*`）會與本 Story 配套

### 影響的檔案

```
prisma/schema.prisma                                       # 更新：User model + UnlockToken model + 2 enum 值

src/services/auth/
├── account-lockout.service.ts                            # 新增（核心邏輯）
└── lockout-notification.service.ts                       # 新增（郵件通知）

src/lib/
├── auth.config.ts                                        # 更新：CredentialsProvider 整合
└── auth.ts                                               # 更新：signIn callback 整合

src/app/api/auth/
└── self-unlock/route.ts                                  # 新增（用戶自助 API）

src/app/api/admin/users/[id]/
└── unlock/route.ts                                       # 新增（admin 解鎖 API）

src/app/[locale]/(dashboard)/admin/users/[id]/
└── page.tsx                                              # 更新：顯示鎖定狀態 + 解鎖按鈕

src/components/features/admin/users/
└── UnlockDialog.tsx                                      # 新增（解鎖對話框）

src/lib/validations/
└── auth.ts                                               # 更新：新增 selfUnlockSchema、adminUnlockSchema

messages/{en,zh-TW,zh-CN}/
└── auth.json                                             # 更新：新增鎖定相關訊息
```

### 半成品反模式風險檢查

**⚠️ 必讀**：實作過程中**任何時候**若發現以下情況，立即停止實作並重新評估範圍：

- 只實作了 Task 1（schema）+ Task 2（服務）+ Task 3（NextAuth）— **這是半成品 L0 狀態**
- 沒有完成 Task 4（自助解鎖）也沒有完成 Task 5（admin UI）
- 鎖定後用戶必須打給 IT 才能解鎖

矩陣 v1.2 明確警告：「**比沒做還危險**」。Story 必須三項齊發才算完成。

### 與既有代碼整合點

1. **`auth.config.ts` L171-192** 是現有失敗處理位置，需在此整合 `incrementFailedAttempts` 與 `isLocked`
2. **`auth.ts` L350-367** 的 `DEV_MOCK_SESSION` 不應觸發鎖定流程（FIX-056 將處理 dev bypass 加固）
3. **`SecurityLog` model**（schema L1010-1034）已存在，僅需新增 enum 值與寫入邏輯
4. **`UserStatus` enum** 中的 `SUSPENDED` 與本 Story 的鎖定不同 — `SUSPENDED` 是手動長期停用，鎖定是短期自動

### 與 v1.2 矩陣 IAM-07b「三選一」的對齊

矩陣 v1.2 第 50 行要求「**必須三選一以上**」：自動衰減 / admin UI / 用戶自助。本 Story **三項全做**以提供最佳 UX：
- ✅ 自動衰減 → AC2
- ✅ Admin UI → AC3
- ✅ 用戶自助 → AC4

### Dev Mode 行為

- `isDevelopmentMode() === true` 時，鎖定機制仍應啟動（避免 dev/prod 行為差異導致 prod 出問題）
- E2E 測試應提供「快速重置 lockedUntil」的 helper（僅 dev/test 環境可用）

### 環境變數新增

```env
# .env.example 新增
ACCOUNT_LOCKOUT_THRESHOLD=5             # 失敗次數閾值
ACCOUNT_LOCKOUT_WINDOW_MINUTES=15       # 計數窗口（分鐘）
ACCOUNT_LOCKOUT_DURATION_MINUTES=30     # 鎖定時長（分鐘）
ACCOUNT_LOCKOUT_TOKEN_EXPIRY_MINUTES=30 # 自助解鎖 token 有效期
```

### 關聯 CHANGE / FIX 文件

- **配套**：CHANGE-059（`/api/auth/*` Rate Limit）— 防 brute-force 第一道防線，本 Story 是第二道
- **配套**：FIX-056（X-Dev-Bypass-Auth 加固）— 防止鎖定機制被 bypass 繞過
- **配套**：CHANGE-066（5 條安全告警 — 含 Auth failure spike）— 偵測大規模攻擊

---

## Implementation Notes

> 此區塊在 Story 完成後補上實作摘要、技術決策、與最終的檔案清單。

---

## Related Files

- `prisma/schema.prisma` - 更新（User model + UnlockToken）
- `src/services/auth/account-lockout.service.ts` - 新增
- `src/services/auth/lockout-notification.service.ts` - 新增
- `src/lib/auth.config.ts` - 更新
- `src/lib/auth.ts` - 更新
- `src/app/api/auth/self-unlock/route.ts` - 新增
- `src/app/api/admin/users/[id]/unlock/route.ts` - 新增
- `src/app/[locale]/(dashboard)/admin/users/[id]/page.tsx` - 更新
- `src/components/features/admin/users/UnlockDialog.tsx` - 新增
- `src/lib/validations/auth.ts` - 更新
- `messages/{en,zh-TW,zh-CN}/auth.json` - 更新
- Tech Spec: `docs/04-implementation/tech-specs/epic-22-enterprise-security/tech-spec-story-22-1.md`
