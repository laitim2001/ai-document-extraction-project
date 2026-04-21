# FIX-050: auth.config.ts 將用戶 Email (PII) 記錄到 console

> **建立日期**: 2026-04-21
> **發現方式**: 代碼審查（`docs/06-codebase-analyze/05-security-quality/security-audit.md` + MEMORY 安全審計記錄）
> **影響頁面/功能**: 認證流程（本地帳號登入 + 開發模式）
> **優先級**: 🔴 高（GDPR 合規風險）
> **狀態**: ✅ 已修復（2026-04-21）

---

## 問題描述

`src/lib/auth.config.ts` 的 `authorize()` 回呼函數中，有 **6 處 `console.log` 語句將用戶 email（PII）明文寫入 server 日誌**，且**完全沒有被 `NODE_ENV` 或其他環境判斷包裹**。這違反了最小化資料處理原則（GDPR Article 5(1)(c)），每次登入嘗試（成功或失敗）都會在日誌中留下用戶 email 軌跡。

### 風險點

| 風險 | 說明 |
|------|------|
| GDPR 違規 | 明文記錄個人識別資訊到非加密/非受控的 server log |
| 日誌外洩 | 若 log 被匯出/備份/傳送給第三方（CloudWatch、Azure Monitor 等），email 會跟著外流 |
| 帳號列舉 | 「User not found」和「Invalid password」分別記錄 email，攻擊者若能讀取 log 可區分帳號存在與否 |

---

## 重現步驟

1. 啟動服務（`npm run dev`）
2. 在任何環境（開發/生產）嘗試本地登入 `/login`
3. 觀察 server console 或 stdout log
4. **觀察現象**：無論登入成功或失敗，都會看到 `[Auth] ... for: user@example.com` 的訊息

---

## 根本原因

`src/lib/auth.config.ts` 中 6 處直接 `console.log` email：

| 行號 | 代碼片段 | 情境 |
|------|---------|------|
| 134 | `console.log('[Auth] Development mode login for:', email)` | 開發模式登入成功 |
| 146 | `console.log('[Auth] Production mode - verifying credentials for:', email)` | 生產模式開始驗證 |
| 168 | `console.log('[Auth] User not found or no password:', email)` | 用戶不存在（帳號列舉風險） |
| 175 | `console.log('[Auth] Invalid password for:', email)` | 密碼錯誤 |
| 192 | `console.log('[Auth] Email not verified for:', email)` | 郵件未驗證 |
| 196 | `console.log('[Auth] Login successful for:', email)` | 登入成功 |

### 進一步觀察

- L120, L129, L181 也有 `console.log`，但**不含 email**（只含 metadata），風險較低（但也應改用 logger）
- 專案**已有**完整 logger 服務可替代：`src/services/logging/logger.service.ts`（`LoggerService`），支援 DEBUG/INFO/WARN/ERROR/CRITICAL + correlation ID + AsyncLocalStorage context

---

## 解決方案

### 策略：分離「開發模式調試」與「生產日誌」

1. **開發模式 (`NODE_ENV === 'development'`)**：保留 email 用於本地調試，但改用 `LoggerService.debug()`
2. **生產模式**：**完全移除 email 輸出**，改用 `userId`（若已查到）或匿名 hash（例如 email 前 3 字元 + 尾碼 `...@domain.com`）
3. **帳號列舉緩解**：L168 和 L175 的錯誤訊息在生產環境改為相同格式（不區分「帳號不存在」vs「密碼錯誤」）

### 實作範例

```typescript
import { logger } from '@/services/logging/logger.service';

const isDev = process.env.NODE_ENV === 'development';

// L134 開發模式登入
if (email.includes('@')) {
  if (isDev) logger.debug('[Auth] Development mode login', { email });
  return { id: 'dev-user-1', email, ... };
}

// L168/L175 帳號列舉緩解（生產環境）
if (!user || !user.password || !isValidPassword) {
  if (isDev) {
    logger.debug('[Auth] Credential check failed', {
      email,
      reason: !user ? 'USER_NOT_FOUND' : (!user.password ? 'NO_PASSWORD' : 'INVALID_PASSWORD'),
    });
  } else {
    logger.info('[Auth] Credential check failed'); // 不含 email, 不含 reason
  }
  return null;
}

// L196 登入成功
logger.info('[Auth] Login successful', { userId: user.id }); // 只記 userId
```

### 決策細節

- `email` 的原始 lowercase 值**不應**寫入生產 log，即使是 hash 後也要小心避免可逆
- `logger.debug()` 在生產環境會被過濾（依 `LOG_LEVEL` 環境變數），這是安全的做法
- 現有的 L129（`NODE_ENV` 本身）可保留但改用 `logger.debug`

---

## 修改的檔案（實際）

| 檔案 | 修改內容 |
|------|---------|
| `src/lib/edge-logger.ts` | **新建** — Edge Runtime 兼容的輕量 logger（LOG_LEVEL 過濾、結構化輸出）。因 `auth.config.ts` 是 Edge-compatible，無法使用含 Prisma 的 `LoggerService` |
| `src/lib/auth.config.ts` | 9 處 console.* 改用 `edgeLogger`（含原 6 處 PII + 3 處 metadata）；實施帳號列舉緩解（合併 `USER_NOT_FOUND`/`NO_PASSWORD`/`INVALID_PASSWORD` 外觀，詳細 reason 僅在 debug 級別輸出）；登入成功改記 userId 而非 email |

### 技術決策記錄

**為何不直接使用 `LoggerService`？**
`src/lib/auth.config.ts` 是 Edge Runtime 兼容配置（Middleware 使用），不能 import `src/services/logging/logger.service.ts`，因為該 service 依賴 Prisma（Node-only）。因此新建 `src/lib/edge-logger.ts` 作為純 JS 的 console 包裝器，符合 Edge 限制。未來其他 Edge-compatible 模組也可複用。

---

## 測試驗證

修復完成後需驗證：

- [x] **TypeScript 類型檢查**：`npx tsc --noEmit` — FIX-050 相關檔案零錯誤（2026-04-21）
- [x] **ESLint 檢查**：`npx eslint src/lib/auth.config.ts src/lib/edge-logger.ts --max-warnings 0` — 零警告（2026-04-21）
- [x] **代碼審查**：auth.config.ts 已無任何 `console.*` 語句
- [ ] **開發模式登入**：成功與失敗場景都能在 console 看到足夠調試訊息（含 email）— 需手動驗證
- [ ] **生產模式登入**：設置 `NODE_ENV=production` + `LOG_LEVEL=info`，日誌**不含**任何明文 email — 需手動驗證
- [ ] **帳號列舉緩解**：輸入「不存在的 email」vs「存在但密碼錯」，生產環境回傳的 `info` 級別訊息為 `[Auth] Credential check failed`（相同），外觀上無法區分
- [ ] **登入功能無退化**：Playwright E2E 測試 `/login` 流程全數通過 — 待下次 E2E 執行
- [ ] **Edge Runtime 相容性**：`npm run build` 不報 Edge-incompatible import 錯誤 — 需完整 build 驗證

> **注意**：LoggerService correlation ID 整合不適用（auth.config.ts 是 Edge-compatible，改用 edgeLogger 而非 LoggerService）。

---

## 相關文件

- 觸發來源：`docs/06-codebase-analyze/00-analysis-index.md` §Critical Findings
- 安全審計：`docs/06-codebase-analyze/05-security-quality/security-audit.md`
- Logger 服務：`src/services/logging/logger.service.ts`
- 類似議題：`.claude/rules/general.md` §禁止事項（不要提交 console.log）

---

*文件建立日期: 2026-04-21*
*最後更新: 2026-04-21（標記為已修復）*
