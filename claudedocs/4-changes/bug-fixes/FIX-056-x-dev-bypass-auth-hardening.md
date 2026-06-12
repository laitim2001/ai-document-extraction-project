# FIX-056: X-Dev-Bypass-Auth Header 在 Production 觸發風險加固

> **建立日期**: 2026-04-28
> **發現方式**: Phase 2 安全治理盤點（`phase2-iam-dp-assessment.md` §IAM-06b）+ MEMORY 安全審計
> **影響頁面/功能**: 所有 API 路由的認證機制（`getAuthSession`）
> **優先級**: 🔴 **CRITICAL（TOP 1 致命風險）**
> **狀態**: 📋 規劃中
> **類型**: 認證安全加固（Authentication Bypass Hardening）
> **關聯**: FIX-050（PII Leakage 已修）、CHANGE-067（Risk Register 將收錄此修復）
> **對應安全控制項**: IAM-06b（L0 → L2）
> **用戶決策**: ✅ B1 已確認（2026-04-28）— 採用 NODE_ENV !== 'production' 雙重 guard 方案

---

## 問題描述

`src/lib/auth.ts:392-403` 實作了開發模式的 `X-Dev-Bypass-Auth` header 機制：當請求帶有此 header 且 `isDevelopmentMode()` 回傳 true 時，**直接回傳 admin session**（含 `permissions: ['*']` + `isGlobalAdmin: true`），跳過所有認證流程。

**致命缺陷**：`isDevelopmentMode()` 的判斷條件為 `NODE_ENV === 'development' || !isAzureADConfigured()`。**若 prod 部署時 Azure AD 配置失誤觸發 dev mode**（例如環境變數丟失、KV reference 錯誤、AAD app registration 過期），整個 production 應用程式就會接受 `X-Dev-Bypass-Auth: true` header，**等於完全繞過認證 + 所有用戶取得 admin 權限**。

### Phase 2 / MEMORY 報告原文佐證

依 `phase2-iam-dp-assessment.md` 第 269-280 行：

> **3. 開發 Bypass Header 是重大風險**（`src/lib/auth.ts` L392-403）：
> ```typescript
> if (isDevelopmentMode() && request) {
>   const bypassHeader = request.headers.get('X-Dev-Bypass-Auth')
>   if (bypassHeader === 'true') {
>     return DEV_MOCK_SESSION  // ← 直接回傳 admin session
>   }
> }
> ```
> - `DEV_MOCK_SESSION` 包含 `permissions: ['*']` 與 `isGlobalAdmin: true`（L350-367）
> - 觸發條件 `isDevelopmentMode()` = `NODE_ENV === 'development' || !isAzureADConfigured()`
> - **若生產環境 Azure AD 配置失敗 → 整個 bypass 變得有效** ⚠️ 重大隱患

### `current-state-assessment.md` TOP 10 風險排名

| # | 風險 | 領域 | 目前 | 影響 | Quick Win? |
|---|------|------|------|------|-----------|
| **1** | **`X-Dev-Bypass-Auth` Header 隱患** | IAM-06b | L0 | 🔴 致命：可繞過所有認證 | ✅ 30min |

> 本 FIX 對應 TOP 1 致命風險，30 分鐘修復。

### 程式碼直接驗證

從 `src/lib/auth.ts:392-404`:
```typescript
export async function getAuthSession(request?: NextRequest) {
  // 檢查開發模式繞過
  if (isDevelopmentMode() && request) {
    const bypassHeader = request.headers.get('X-Dev-Bypass-Auth')
    if (bypassHeader === 'true') {
      console.log('[Auth] Development mode bypass enabled via X-Dev-Bypass-Auth header')
      return DEV_MOCK_SESSION
    }
  }

  // 正常認證流程
  return auth()
}
```

從 `src/lib/auth.ts:350-367`（DEV_MOCK_SESSION 內容）:
```typescript
const DEV_MOCK_SESSION = {
  user: {
    id: 'dev-user-1',
    email: 'dev@example.com',
    name: 'Dev User',
    isGlobalAdmin: true,
    permissions: ['*'],  // 萬能權限
    // ...
  }
}
```

### 為何嚴重

- **TOP 1 致命風險** — Phase 2 報告判定為「**致命：可繞過所有認證**」
- **誤觸發風險高** — 任何下列情況都會讓 prod 進入 dev mode：
  - `AZURE_AD_CLIENT_ID` env var 丟失
  - Key Vault reference 錯誤（CHANGE-055 KV 整合）
  - AAD App Registration 過期或被刪除
  - `auth.config.ts` 的 `isAzureADConfigured()` 邏輯 bug
- **單一 header 就可繞過** — 不需密碼、不需 token、不需 session — 帶上 `X-Dev-Bypass-Auth: true` 即可
- **取得萬能權限** — `permissions: ['*']` 包含 USER_DELETE / RULE_DELETE / EXPORT 等高敏感操作

---

## 重現步驟

### 情境 1：Prod 環境 AAD 配置失誤（最危險）

```bash
# 1. Prod 部署時 KV reference 錯誤，AZURE_AD_CLIENT_ID 為空
# 2. isAzureADConfigured() 回傳 false → isDevelopmentMode() 回傳 true（即使 NODE_ENV=production）
# 3. 攻擊者隨意發 request
curl -H 'X-Dev-Bypass-Auth: true' https://prod.yourdomain.com/api/admin/users
# → 直接回傳所有用戶（admin 權限通過）
```

### 情境 2：Dev mode 在 Prod 被惡意觸發

```bash
# 1. 攻擊者掃描 endpoint，發現 /api/health 暴露
# 2. 嘗試帶不同 header
curl -H 'X-Dev-Bypass-Auth: true' https://prod.yourdomain.com/api/admin/system-config
# → 若 isDevelopmentMode() = true → 回傳 system config（含可能的 secret 引用）
```

### 情境 3：DevOps 誤操作

```bash
# DevOps 在 staging 測試完忘記移除 X-Dev-Bypass-Auth header
# Prod ALB / Front Door 將 header 透傳到 ACA
# 任何用戶請求都被視為 admin
```

---

## 根本原因

### 設計演進歷史推測

1. **Epic 1 / Epic 18** 期間，為方便本地開發（無 AAD 配置），加入 `X-Dev-Bypass-Auth` header
2. **isDevelopmentMode() 邏輯**：當時設計為「dev mode = NODE_ENV=dev OR AAD 沒配」— 為了讓 dev 環境即使沒 AAD 也能跑
3. **未考慮 Prod 失誤情境**：實作者假設 prod 一定有 AAD，未做硬性 NODE_ENV guard
4. **既有 `console.log('[Auth] Development mode bypass enabled')`** 為唯一警告，但 prod 不一定看 server log

### 設計缺陷

| 缺陷 | 說明 |
|------|------|
| **無 NODE_ENV 硬性 guard** | 唯一條件是 `isDevelopmentMode()` 函數，任何 bug 或誤配都導致 prod 觸發 |
| **無啟動時驗證** | 應用啟動時不檢查「prod 環境是否誤啟用 bypass」 |
| **無監控告警** | 即使 bypass 在 prod 觸發，僅 console.log 沒有 SecurityLog / 告警 |
| **bypass session 永遠相同** | `DEV_MOCK_SESSION` 是常量 → 攻擊者可預測 user.id（dev-user-1）|

---

## 解決方案

> ✅ **用戶確認（B1, 2026-04-28）**：經用戶於 2026-04-28 確認，採用「`process.env.NODE_ENV !== 'production'` 雙重 guard」方案 — 即在既有 `isDevelopmentMode()` 檢查之外，再加上硬性 NODE_ENV 守門，確保 production 環境完全禁用 X-Dev-Bypass-Auth header。本決策無待後續確認事項，可直接進入實作。

### 設計方針

1. **雙重保險硬性 guard** — 加 `process.env.NODE_ENV !== 'production'` 嚴格檢查（在 isDevelopmentMode() 之外）
2. **啟動時驗證** — 應用啟動時若偵測到「prod 環境且 bypass 邏輯可達」→ 拒絕啟動 + 寫 SecurityLog
3. **Prod env 配置驗證** — 確保 prod 部署時 NODE_ENV 強制為 production（透過環境變數驗證腳本）
4. **SecurityLog + 告警** — 任何 bypass 觸發都寫入 SecurityLog（即使 dev 也記錄，便於審計）
5. **單元測試** — Prod 環境完全禁用 bypass（即使誤觸發 isDevelopmentMode）

### Step 1：硬性 NODE_ENV guard

**檔案**：`src/lib/auth.ts`

```typescript
// 變更前（line 392-404）
export async function getAuthSession(request?: NextRequest) {
  if (isDevelopmentMode() && request) {
    const bypassHeader = request.headers.get('X-Dev-Bypass-Auth')
    if (bypassHeader === 'true') {
      console.log('[Auth] Development mode bypass enabled via X-Dev-Bypass-Auth header')
      return DEV_MOCK_SESSION
    }
  }
  return auth()
}

// 變更後
export async function getAuthSession(request?: NextRequest) {
  // 🔒 FIX-056: 雙重保險 — Prod 環境完全禁用 bypass，無論 isDevelopmentMode() 為何
  if (process.env.NODE_ENV === 'production') {
    return auth()
  }

  if (isDevelopmentMode() && request) {
    const bypassHeader = request.headers.get('X-Dev-Bypass-Auth')
    if (bypassHeader === 'true') {
      // 寫入 SecurityLog（即使 dev 也記錄，便於審計）
      try {
        await prisma.securityLog.create({
          data: {
            eventType: 'PERMISSION_ELEVATION_ATTEMPT',
            severity: 'MEDIUM',
            metadata: {
              method: 'X-Dev-Bypass-Auth',
              ip: request.headers.get('x-forwarded-for') ?? 'unknown',
              userAgent: request.headers.get('user-agent') ?? 'unknown',
              note: 'Dev bypass triggered (development mode)',
            },
          },
        })
      } catch (error) {
        // SecurityLog 失敗不阻止 dev 流程
        logger.warn('Failed to write SecurityLog for dev bypass', { error })
      }

      logger.info('[Auth] Development mode bypass enabled', {
        env: process.env.NODE_ENV,
        ip: request.headers.get('x-forwarded-for') ?? 'unknown',
      })
      return DEV_MOCK_SESSION
    }
  }

  return auth()
}
```

### Step 2：啟動時環境驗證

**檔案**：`scripts/verify-environment.ts`（既有，CHANGE-054 建立）

**動作**：在環境自檢腳本加入新檢查：

```typescript
// FIX-056 啟動時驗證
checks.push({
  name: 'FIX-056: NODE_ENV consistency check',
  description: 'Production deployment must have NODE_ENV=production',
  check: () => {
    const env = process.env.NODE_ENV
    const inferredProd = process.env.AUTH_URL?.startsWith('https://')
                        && !process.env.AUTH_URL?.includes('localhost')

    if (inferredProd && env !== 'production') {
      throw new Error(
        'CRITICAL: Production-like AUTH_URL but NODE_ENV is not "production". ' +
        'X-Dev-Bypass-Auth header would be reachable. ' +
        'Set NODE_ENV=production immediately.'
      )
    }
    return { pass: true, message: `NODE_ENV=${env}, AUTH_URL=${process.env.AUTH_URL}` }
  },
  required: true,
})
```

### Step 3：應用啟動時 sanity check

**檔案**：`src/lib/auth.ts`（top-level，模組載入時執行一次）

```typescript
// FIX-056: Module-load sanity check
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEV_BYPASS_IN_PROD !== 'true') {
  // 額外確認：production 不應允許 dev bypass
  // 此 check 在 module 載入時跑，prod build 時即觸發
  if (typeof DEV_MOCK_SESSION === 'object' && DEV_MOCK_SESSION.user.permissions?.includes('*')) {
    // 純警告（不 throw，避免破壞既有部署），但寫顯眼 stderr
    console.warn(
      '[FIX-056] Production deployment detected. X-Dev-Bypass-Auth is hard-blocked by NODE_ENV check. ' +
      'DEV_MOCK_SESSION exists in code but unreachable.'
    )
  }
}
```

### Step 4：Bicep / .env.example 強制 NODE_ENV=production

**檔案**：`infrastructure/bicep/modules/container-app.bicep`（既有）

```bicep
// 行 99-103（已有）
param envVars object = {
  NODE_ENV: 'production'  // ← 確認此行存在
  AUTH_TRUST_HOST: 'false'
  SYSTEM_USER_ID: 'system-user-prod'
}
```

**檔案**：`.env.example`

```env
# 🔴 必要：生產環境必須設為 production（FIX-056 防止 X-Dev-Bypass-Auth 觸發）
NODE_ENV="production"
```

### Step 5：CI 驗證

**檔案**：`.github/workflows/security.yml`（與 Wave 1 整合）

```yaml
- name: FIX-056 — Verify auth.ts NODE_ENV guard
  run: |
    grep -E "process\.env\.NODE_ENV === ['\"]production['\"]" src/lib/auth.ts || {
      echo "FIX-056 regression: NODE_ENV guard missing in auth.ts"
      exit 1
    }
```

### Step 6：單元測試

**檔案**：`src/lib/auth.test.ts`（新增）

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getAuthSession } from './auth'
import { auth } from '@/auth'

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

describe('FIX-056: X-Dev-Bypass-Auth hardening', () => {
  const ORIGINAL_NODE_ENV = process.env.NODE_ENV

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV
  })

  it('Production 環境完全禁用 bypass（雙重保險）', async () => {
    process.env.NODE_ENV = 'production'
    process.env.AZURE_AD_CLIENT_ID = ''  // 強制 isDevelopmentMode() 為 true

    const mockReq = new Request('https://prod.example.com/api/test', {
      headers: { 'X-Dev-Bypass-Auth': 'true' },
    })

    const session = await getAuthSession(mockReq as any)

    // 即使 isDevelopmentMode() 為 true，prod 也不應 bypass
    expect(auth).toHaveBeenCalled()
    expect(session?.user?.id).not.toBe('dev-user-1')
  })

  it('Development 環境 bypass 正常運作（向後相容）', async () => {
    process.env.NODE_ENV = 'development'

    const mockReq = new Request('http://localhost:3200/api/test', {
      headers: { 'X-Dev-Bypass-Auth': 'true' },
    })

    const session = await getAuthSession(mockReq as any)

    expect(session?.user?.id).toBe('dev-user-1')
    expect(session?.user?.permissions).toContain('*')
  })

  it('Test 環境也允許 bypass（CI 整合測試）', async () => {
    process.env.NODE_ENV = 'test'

    const mockReq = new Request('http://test.local/api/test', {
      headers: { 'X-Dev-Bypass-Auth': 'true' },
    })

    const session = await getAuthSession(mockReq as any)
    expect(session?.user?.id).toBe('dev-user-1')
  })

  it('Bypass 觸發時寫入 SecurityLog', async () => {
    process.env.NODE_ENV = 'development'
    const securityLogSpy = vi.spyOn(prisma.securityLog, 'create')

    const mockReq = new Request('http://localhost:3200/api/test', {
      headers: { 'X-Dev-Bypass-Auth': 'true' },
    })

    await getAuthSession(mockReq as any)

    expect(securityLogSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'PERMISSION_ELEVATION_ATTEMPT',
          severity: 'MEDIUM',
        }),
      })
    )
  })
})
```

---

## 修改的檔案

| 檔案 | 變更類型 | 預估行數 |
|------|----------|---------|
| `src/lib/auth.ts` | 🔄 加 NODE_ENV 雙重 guard + SecurityLog 記錄 | +25 -1 |
| `src/lib/auth.test.ts` | ➕ 新增 4 個測試 | ~120 |
| `scripts/verify-environment.ts` | 🔄 加 FIX-056 啟動時檢查 | +25 |
| `.env.example` | 🔄 補 NODE_ENV 註解 | +3 |
| `infrastructure/bicep/modules/container-app.bicep` | ✅ 確認 `NODE_ENV: 'production'` 存在 | 0 |
| `.github/workflows/security.yml` | 🔄 加 grep 驗證 | +6 |
| `src/lib/edge-logger.ts` 或 `src/services/logging/logger.service.ts` | ✅ 確認 logger 可用 | 0 |

---

## 測試驗證

### 自動化檢查

- [ ] `npx tsc --noEmit` 對 auth.ts 無新錯誤
- [ ] `npm run lint` 無 warning
- [ ] `npm run test src/lib/auth.test.ts` 4 個測試全通過（依賴 SDLC-10 vitest 安裝）

### 手動驗證

#### Dev 環境（NODE_ENV=development）

- [ ] 帶 X-Dev-Bypass-Auth: true → 取得 dev-user-1 session ✅（向後相容）
- [ ] SecurityLog 出現 PERMISSION_ELEVATION_ATTEMPT 記錄 ✅
- [ ] Logger 輸出 `[Auth] Development mode bypass enabled`（含 IP）

#### Prod 環境（NODE_ENV=production）

- [ ] 帶 X-Dev-Bypass-Auth: true + 強制 isDevelopmentMode()=true → **回傳 401（NextAuth 正常流程）**❌ Bypass
- [ ] 不帶 header → NextAuth 正常流程
- [ ] 即使 AAD 配置失誤 → 仍走 NextAuth（會 fail，但**不會給 admin session**）

#### CI

- [ ] PR 含 `process.env.NODE_ENV === "production"` 檢查 → CI grep pass
- [ ] PR 移除此檢查 → CI grep fail

#### Bicep

- [ ] `az bicep build` UAT/Staging/Prod parameters 都有 NODE_ENV=production
- [ ] Prod 部署後 `az containerapp show --query properties.template.containers[0].env` 確認 NODE_ENV

### 滲透測試（Phase 4 / W9 規劃）

- [ ] Pen-tester 嘗試 X-Dev-Bypass-Auth: true 在 prod → 確認 401
- [ ] 模擬 KV 失誤導致 AAD 配置丟失 → bypass 仍不生效

---

## 風險提示

- **既有 dev 工作流不受影響**：dev (NODE_ENV=development) 維持原行為，無回歸
- **Test 環境**：vitest 預設 NODE_ENV=test → 仍可 bypass（用於整合測試），這是預期行為
- **CI 整合測試環境**：若 CI 跑 `NODE_ENV=production npm run test:e2e` → 需注意 e2e 測試不能依賴 bypass header（應改用 mock auth）
- **DEV_MOCK_SESSION 仍在程式碼中**：本 FIX 不刪除（避免破壞 dev 開發），只確保 prod 不可達。**完全移除**為後續 CHANGE 工作（IAM-06b 升 L3 時）
- **SecurityLog 寫入失敗**：dev 環境若 DB 未啟動 → SecurityLog 寫入失敗 → 不阻止 bypass 流程（已 try/catch）
- **prisma client 在 module top-level**：`scripts/verify-environment.ts` 必須在 prisma client 可用時執行（CHANGE-054 已驗證）

---

## 業務決策記錄

無待業務決策事項：

- 純安全修復（30 分鐘）
- 純後端邏輯（無 UI 變動）
- 不破壞既有 dev workflow
- 通過 Phase 2 報告 TOP 1 風險判定 — 必須立即修復

---

## 與其他 FIX/CHANGE 的協調

| 協調點 | 說明 |
|--------|------|
| **FIX-050（已修復）** | PII Leakage — 本 FIX 也使用 logger（一致風格） |
| **CHANGE-054（已完成）**| `scripts/verify-environment.ts` 是 CHANGE-054 建立 — 本 FIX 在其上擴增 |
| **CHANGE-055（規劃中）** | Azure deployment foundation — 確保 Bicep `NODE_ENV: 'production'` |
| **CHANGE-067（規劃中）** | Risk Register — RISK-006 標記為 Mitigated（本 FIX 完成後）|
| **CHANGE-066（規劃中）** | audit log middleware — bypass 觸發也應走 audit log |
| **SDLC-10（後續 CHANGE）** | vitest 未安裝 → 本 FIX 的測試暫不能跑，待 SDLC-10 enable |

**建議實施順序**：

1. **立即** — 合併 FIX-056（30 分鐘工作量，TOP 1 風險）
2. **W2** — CHANGE-067 Risk Register 收錄
3. **W3-W4** — SDLC-10 vitest 安裝後啟用測試
4. **後續** — IAM-06b 升 L3：完全移除 DEV_MOCK_SESSION（透過 build-time tree-shaking 或 NODE_ENV guard）

---

## 後續延伸工作（不在本 FIX 範圍）

依 Phase 2 IAM-06b 報告建議：

1. **IAM-06b 升 L3**：本月內 — 為 admin 角色操作（用戶管理、權限變更、系統配置）加 step-up auth
2. **本季** — Azure AD Conditional Access policy 強制 admin MFA
3. **本季** — 評估是否徹底停用本地 admin 登入（`FORCE_SSO_ONLY=true` 與 IAM-06 配套）
4. **代碼層完全移除 DEV_MOCK_SESSION**：透過 `process.env.NODE_ENV === 'production' ? null : DEV_MOCK_SESSION` build-time elimination

---

## 相關文件

- **Phase 2 報告**:
  - `docs/08-security-and-governance/phase2-iam-dp-assessment.md` §IAM-06b（line 257-291）
  - `docs/08-security-and-governance/current-state-assessment.md` TOP 10 #1（line 55）
- **MEMORY 記錄**: 安全治理盤點 TOP 1 致命風險
- **CHANGE-054**: `scripts/verify-environment.ts` 是其產出
- **CHANGE-055**: Bicep `NODE_ENV: 'production'` 配置
- **CHANGE-067**: Risk Register 收錄
- **既有實作**: `src/lib/auth.ts:350-404`、`auth.config.ts`

---

*文件建立日期: 2026-04-28*
*規劃人: Claude Opus 4.7（依 Phase 2 盤點報告產出）*
*下一步: 直接實作 — 30 分鐘可完成（Phase 2 TOP 1 致命風險，零業務決策）*
*🔴 CRITICAL：建議立即排入下一個 sprint*
