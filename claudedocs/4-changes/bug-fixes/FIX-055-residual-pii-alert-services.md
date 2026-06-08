# FIX-055: alert-services 殘留 PII Email 明文輸出修復

> **建立日期**: 2026-04-28
> **發現方式**: Phase 2 安全治理盤點（`phase2-iam-dp-assessment.md` §DP-05-lite + `phase2-appsec-obs-assessment.md`）
> **影響頁面/功能**: Alert 通知 Email、Alert Service 模擬發送日誌
> **優先級**: 🔴 高（DP-05-lite 殘留 PII 風險）
> **狀態**: 📋 規劃中
> **類型**: 安全缺陷修復（PII 洩漏）
> **關聯**: FIX-050（auth.config.ts PII 已修）、CHANGE-065（Email 安全告警 — 將動同檔案，需協調）
> **對應安全控制項**: DP-05-lite（L2 → L3）

---

## 問題描述

FIX-050 在 2026-04-21 修復了 `src/lib/auth.config.ts` 中 6 處 console.log email 的 PII 洩漏問題。然而在 2026-04-28 的 Phase 2 全面盤點中發現，**FIX-050 未涵蓋的 alert services 仍有 2 處明文 email 輸出**，以及 register / resend-verification 的 emailError 對象**可能**含 email（取決於 nodemailer error format）。

### 殘留 PII 證據（grep 實證）

依 `phase2-iam-dp-assessment.md` 第 612-622 行 / `phase2-appsec-obs-assessment.md` 第 729 行直接證據：

| # | 檔案 | 行號 | 程式碼 | 嚴重度 | FIX-050 是否涵蓋 |
|---|------|------|-------|--------|----------------|
| 1 | `src/services/alert.service.ts` | **593** | `console.log(\`[AlertService] Would send email to ${recipient}:\`, message.title)` | 🔴 HIGH（明文 email + 可能附帶業務 metadata）| ❌ 未涵蓋 |
| 2 | `src/services/alert-notification.service.ts` | **408** | `console.log(\`[AlertNotification] Sending email to ${to}\`)` | 🔴 HIGH | ❌ 未涵蓋 |
| 3 | `src/app/api/auth/resend-verification/route.ts` | 174 | `console.error('Failed to send verification email:', emailError)` | 🟡 MEDIUM（取決於 nodemailer error format）| ❌ 未涵蓋 |
| 4 | `src/app/api/auth/register/route.ts` | 135 | `console.error('Failed to send verification email:', emailError)` | 🟡 MEDIUM | ❌ 未涵蓋 |

### 為何嚴重

- **GDPR / 隱私合規違規** — 員工 email 屬於 PII，不應出現在 server logs
- **FIX-050 修復不完整** — 當時只看 auth flow，未掃所有 alert services
- **CLAUDE.md 已提示**：「⚠️ 殘留 PII（`auth.config.ts` 6 處 console.log email）」標 ✅ 已修，但實際 alert services 仍有
- **CHANGE-065（Email 告警 5 條）即將動同檔案** — 必須先修 FIX-055，避免新增告警 Email 又引入 PII

### 程式碼直接驗證

從 `src/services/alert.service.ts:585-594`:
```typescript
/**
 * 發送 Email 通知
 */
private async sendEmailNotification(
  recipient: string,
  message: NotificationMessage
): Promise<void> {
  // TODO: 實現實際的 Email 發送邏輯
  // 目前只記錄日誌
  console.log(`[AlertService] Would send email to ${recipient}:`, message.title);
}
```

從 `src/services/alert-notification.service.ts:404-414`:
```typescript
/**
 * 發送 Email（模擬實現）
 */
private async sendEmail(to: string, subject: string, body: string): Promise<void> {
  // TODO: 實際實現需要整合 Email 服務（如 SendGrid、Azure Communication Services）
  console.log(`[AlertNotification] Sending email to ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Body: ${body}`);

  // 模擬發送延遲
  await new Promise((resolve) => setTimeout(resolve, 100));
}
```

---

## 重現步驟

### 情境 1：開發環境觸發告警

```bash
# 1. 啟動 dev server
npm run dev -- -p 3200

# 2. 進 admin alerts page → 建立告警規則 → 觸發
# 3. 觀察 server console
```

**預期看到的日誌**（PII 洩漏）:
```
[AlertNotification] Sending email to john.doe@example.com
Subject: Alert: Cost threshold exceeded
Body: ...
[AlertService] Would send email to admin@yourdomain.com: 成本告警
```

### 情境 2：生產環境（更危險）

若 prod 的 LOG_LEVEL=info（預設）+ console.log 寫入 Application Insights → **所有觸發告警的 user email 永久存於 log analytics**。

### 情境 3：用戶註冊失敗

```bash
# 模擬 SMTP 失敗（修改 SMTP_HOST 為無效）
# 嘗試註冊新用戶
curl -X POST http://localhost:3200/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"...","name":"Test"}'
```

**預期看到**:
```
[Error] Failed to send verification email: Error: Email send failed
  at ... (含 nodemailer 內部 envelope 資訊，可能含 to: ['test@example.com']）
```

---

## 根本原因

### FIX-050 範圍限制

FIX-050 的 commit message 與盤點僅針對 **auth flow**（auth.config.ts、edge-logger.ts），未做跨檔案 grep 找其他 PII 點。

### 設計缺陷

1. **無統一 maskEmail() 工具** — 開發者各自寫 `console.log` 時無 reminder 應遮罩
2. **無 ESLint rule 阻擋 console.log of email-like vars** — 程式無自動檢查
3. **alert services 為「TODO 暫實作」** — 註解標 `TODO: 實現實際的 Email 發送邏輯`，原意是 placeholder，但部署到 prod 後成為 PII 漏洞

### MEMORY 記錄佐證

依 MEMORY.md:
> **2. SQL Injection Risk in db-context.ts** [HIGH RISK]
> ...
> 而 PII 修復僅提到 auth.config.ts 6 處 console.log，未提 alert services 殘留

---

## 解決方案

### 設計方針

1. **30 分鐘修復** — 不引入新依賴，只動 4 處
2. **建立可重用 `maskEmail()` 工具** — 後續其他位置可一致使用
3. **替換 console.log → logger 服務** — 與 edgeLogger 模式一致
4. **加入單元測試** — 防止後續再次回歸

### Step 1：建立 maskEmail 工具

**檔案**：`src/lib/utils/mask-pii.ts`（新增；或併入既有 `src/lib/utils.ts`）

```typescript
/**
 * @fileoverview PII 遮罩工具 — 用於 logger / audit metadata 等場景，避免明文輸出敏感資訊
 * @module src/lib/utils/mask-pii
 * @since FIX-055
 */

/**
 * 遮罩 email 地址
 * @example
 * maskEmail('john.doe@example.com')  // 'jo****@example.com'
 * maskEmail('a@b.com')               // 'a***@b.com'
 * maskEmail(undefined)               // ''
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email || typeof email !== 'string') return ''
  const atIdx = email.indexOf('@')
  if (atIdx <= 0) return '***'
  const local = email.slice(0, atIdx)
  const domain = email.slice(atIdx)
  const visible = local.slice(0, Math.min(2, local.length))
  return `${visible}${'*'.repeat(4)}${domain}`
}

/** 遮罩 email 陣列 */
export function maskEmails(emails: string[] | null | undefined): string[] {
  if (!Array.isArray(emails)) return []
  return emails.map(maskEmail)
}
```

### Step 2：修復 alert.service.ts:593

**檔案**：`src/services/alert.service.ts`

```typescript
// 變更前（line 593）
console.log(`[AlertService] Would send email to ${recipient}:`, message.title);

// 變更後
import { maskEmail } from '@/lib/utils/mask-pii'
import { logger } from '@/services/logging/logger.service'
// ...
logger.debug('[AlertService] Would send email', {
  recipient: maskEmail(recipient),
  title: message.title,
})
```

### Step 3：修復 alert-notification.service.ts:408

**檔案**：`src/services/alert-notification.service.ts`

```typescript
// 變更前（line 406-410）
private async sendEmail(to: string, subject: string, body: string): Promise<void> {
  console.log(`[AlertNotification] Sending email to ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Body: ${body}`);
  ...
}

// 變更後
private async sendEmail(to: string, subject: string, body: string): Promise<void> {
  logger.debug('[AlertNotification] Sending email', {
    recipient: maskEmail(to),
    subject,
    bodyLength: body.length,  // 不輸出 body 全文（可能含 PII）
  })
  await new Promise((resolve) => setTimeout(resolve, 100))
}
```

### Step 4：修復 register / resend-verification emailError

**檔案**：`src/app/api/auth/register/route.ts`、`src/app/api/auth/resend-verification/route.ts`

```typescript
// 變更前
console.error('Failed to send verification email:', emailError)

// 變更後
import { logger } from '@/services/logging/logger.service'
// ...
logger.error('Failed to send verification email', {
  error: emailError instanceof Error ? emailError.message : 'unknown',
  // 不輸出 emailError 整個 object（可能含 envelope.to[] 明文 email）
})
```

### Step 5：加入單元測試

**檔案**：`src/lib/utils/mask-pii.test.ts`（新增）

```typescript
import { describe, it, expect } from 'vitest'  // 或 jest（依 SDLC-10 安裝後決定）
import { maskEmail, maskEmails } from './mask-pii'

describe('maskEmail', () => {
  it('遮罩標準 email', () => {
    expect(maskEmail('john.doe@example.com')).toBe('jo****@example.com')
  })

  it('遮罩短 local part', () => {
    expect(maskEmail('a@b.com')).toBe('a****@b.com')
  })

  it('處理空值', () => {
    expect(maskEmail(null)).toBe('')
    expect(maskEmail(undefined)).toBe('')
    expect(maskEmail('')).toBe('')
  })

  it('處理無效格式', () => {
    expect(maskEmail('notanemail')).toBe('***')
  })

  it('保留 domain 完整', () => {
    expect(maskEmail('verylongusername@my-company.co.uk')).toBe('ve****@my-company.co.uk')
  })
})

describe('maskEmails', () => {
  it('陣列遮罩', () => {
    expect(maskEmails(['a@b.com', 'c@d.com'])).toEqual(['a****@b.com', 'c****@d.com'])
  })

  it('處理 null/undefined', () => {
    expect(maskEmails(null)).toEqual([])
    expect(maskEmails(undefined)).toEqual([])
  })
})
```

### Step 6：alert services 整合測試

**檔案**：`src/services/alert.service.test.ts`、`src/services/alert-notification.service.test.ts`（新增或擴增）

```typescript
import { describe, it, expect, vi } from 'vitest'
import { logger } from '@/services/logging/logger.service'
import { AlertService } from './alert.service'

describe('AlertService email PII protection', () => {
  it('呼叫 sendEmailNotification 不應 log 明文 email', async () => {
    const debugSpy = vi.spyOn(logger, 'debug')
    const service = new AlertService()
    await service['sendEmailNotification']('user@example.com', { title: 'Test' } as any)

    expect(debugSpy).toHaveBeenCalled()
    const logArgs = debugSpy.mock.calls[0]
    expect(JSON.stringify(logArgs)).not.toContain('user@example.com')
    expect(JSON.stringify(logArgs)).toContain('us****@example.com')  // masked
  })
})
```

---

## 修改的檔案

| 檔案 | 變更類型 | 預估行數 |
|------|----------|---------|
| `src/lib/utils/mask-pii.ts` | ➕ 新增 | ~50 |
| `src/lib/utils/mask-pii.test.ts` | ➕ 新增 | ~80 |
| `src/services/alert.service.ts` | 🔄 修改 line 593 | +5 -1 |
| `src/services/alert-notification.service.ts` | 🔄 修改 line 408-410 | +6 -3 |
| `src/app/api/auth/register/route.ts` | 🔄 修改 line 135 | +5 -1 |
| `src/app/api/auth/resend-verification/route.ts` | 🔄 修改 line 174 | +5 -1 |
| `src/services/alert.service.test.ts` | 🔄 加 PII 防護測試 | +30 |
| `src/services/alert-notification.service.test.ts` | 🔄 加 PII 防護測試 | +30 |

---

## 測試驗證

### 自動化檢查

- [ ] `npx tsc --noEmit` 對 6 個修改的檔案無新錯誤
- [ ] `npm run lint` 無 warning
- [ ] `npm run test` 通過 maskEmail / alert services 新測試（依賴 SDLC-10 vitest 安裝）

### 手動驗證（dev 環境）

- [ ] 修改前：grep `console.log.*email\|to.*email` 在 src/services/ 應有 ≥ 4 處
- [ ] 修改後：grep 結果 0 處
- [ ] dev server 觸發告警 → 觀察 console，email 應為 `xx****@domain.com` 格式
- [ ] 註冊失敗時 → console.error 不再含 envelope.to[]

### 合規檢查

- [ ] `grep -r "console\.log.*${.*email" src/` → 0 結果
- [ ] `grep -r "console\.log.*\${.*recipient}" src/` → 0 結果
- [ ] `grep -r "console\.log.*\${.*to}" src/services/` → 0 結果

### 與其他 FIX/CHANGE 整合

- [ ] **與 CHANGE-065 協調**：FIX-055 必須先合併（CHANGE-065 將大改 alert services）
- [ ] **與 CHANGE-066 協調**：audit log middleware 也使用 maskEmail（同一工具）
- [ ] **回歸測試**：FIX-050 既有 auth flow 不受影響

---

## 風險提示

- **Logger 服務依賴**：若 `src/services/logging/logger.service.ts` 不存在或為 placeholder → 需先建立或暫用 `console.debug`（生產環境 LOG_LEVEL=info 時不輸出）
- **單元測試框架未安裝**：依 Phase 2 SDLC-10 報告 vitest 未安裝 → 本 FIX 的測試需配合後續 SDLC-10 修復一同 enable
- **既有 audit log retention**：若已運行的 alert services 已將 PII 寫入 audit_logs / Application Insights → 屬於歷史資料，需另案規劃 redaction（不在本 FIX 範圍）
- **alert services 是 TODO placeholder**：CHANGE-065 將實作真實 Email 發送 → 本 FIX 修的兩處可能在 CHANGE-065 中被重寫，需確保 maskEmail 規則在重寫後仍生效
- **CHANGE-065 撞檔案**：`alert.service.ts` + `alert-notification.service.ts` 兩個 CHANGE/FIX 都會動 → 嚴格依序：**FIX-055 先合併 → CHANGE-065 後實作**

---

## 業務決策記錄

無待決策事項（純安全修復，30 分鐘工作量）。

---

## 與其他 FIX/CHANGE 的協調

| 協調點 | 說明 |
|--------|------|
| **FIX-050（已修復）** | 本 FIX 是其延伸 — FIX-050 修了 auth.config.ts，本 FIX 補 alert services |
| **CHANGE-065（規劃中）** | CHANGE-065 將動 alert-notification.service.ts 加去重抑制邏輯 → **嚴格依序：FIX-055 先合併** |
| **CHANGE-066（規劃中）** | audit log middleware 也使用 maskEmail，本 FIX 建立的工具是其依賴 |
| **SDLC-10（後續 CHANGE）** | vitest / jest 未安裝 → 本 FIX 的測試暫不能跑，待 SDLC-10 解決後 enable |

**建議實施順序**：

1. 先合併 **FIX-055**（30 分鐘）— 純 PII 修復
2. 後續 SDLC-10 安裝 vitest 後 → 啟用 mask-pii.test.ts
3. CHANGE-065 在 FIX-055 基礎上擴增 alert services（不會撤回 maskEmail）
4. CHANGE-066 audit middleware 統一使用 maskEmail

---

## 相關文件

- **Phase 2 報告**:
  - `docs/08-security-and-governance/phase2-iam-dp-assessment.md` §DP-05-lite（line 597-637）
  - `docs/08-security-and-governance/phase2-appsec-obs-assessment.md` §九「console.log 總數 278 / 93 個檔案」
- **MEMORY 記錄**: PII Leakage 修復僅涵蓋 auth.config.ts
- **FIX-050**: 已修復 auth.config.ts 6 處 PII（2026-04-21）
- **CHANGE-065**: Email 告警 5 條（協調依賴）
- **CHANGE-066**: Audit Log middleware（共用 maskEmail）
- **既有 logger**: `src/services/logging/logger.service.ts` + `src/lib/edge-logger.ts`

---

## 後續延伸工作（不在本 FIX 範圍）

依 Phase 2 報告建議的後續工作：
- **`no-console` ESLint rule**：強制 import logger 而非 console.log（除 edge-logger.ts、test 文件）
- **520 console.* 漸進遷移到 logger**：每月 100 個（依 DP-05-lite 建議）
- **歷史 audit_logs PII redaction**：若已寫入 PII 需 retroactive 處理
- **GitHub repo Trufflehog secret scan**：掃 git 歷史確認無 PII commit

---

*文件建立日期: 2026-04-28*
*規劃人: Claude Opus 4.7（依 Phase 2 盤點報告產出）*
*下一步: 直接實作（無業務決策需求） → 30 分鐘可完成*
