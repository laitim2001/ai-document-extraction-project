# Tech Spec: Story 22.1 - 帳號鎖定機制完整實作

> **Version**: 1.0.0
> **Created**: 2026-04-28
> **Status**: Draft
> **Story Key**: STORY-22-1

---

## Overview

| 項目 | 內容 |
|------|------|
| **Story ID** | 22.1 |
| **Epic** | Epic 22 — Enterprise Security & Governance |
| **Estimated Effort** | 8 Story Points（約 5-7 天）|
| **Dependencies** | 無硬性前置；建議 Story 22-5（測試框架）先做以提供測試基礎 |
| **Blocking** | CHANGE-059（`/api/auth/*` Rate Limit）會與此配套 |
| **對應風險** | IAM-07a / IAM-07b / IAM-07c（全部 L0 → L3）|

---

## Objective

實作完整的帳號鎖定機制，**三項齊發**（觸發 + 解鎖 + 審計）以避免矩陣 v1.2 警告的「半成品反模式」（IAM-07a 不得單獨實作）。建立企業級的暴力破解防護層，同時透過三選一解鎖機制（自動衰減 + admin UI + 用戶自助）確保不影響合法用戶體驗，避免 IT 高負擔。

---

## Acceptance Criteria Mapping

| AC ID | 驗收條件 | 實現方式 |
|-------|----------|----------|
| AC-22.1.1 | 鎖定觸發機制（5 次失敗 / 15 分鐘窗口）| `account-lockout.service.ts` + NextAuth integration |
| AC-22.1.2 | 自動時間衰減（30 分鐘）| 登入時檢查 `lockedUntil < now()` 自動解除 |
| AC-22.1.3 | 管理員手動解鎖 UI | `POST /api/admin/users/[id]/unlock` + `UnlockDialog.tsx` |
| AC-22.1.4 | 用戶自助解鎖（email token）| `POST /api/auth/self-unlock` + `UnlockToken` model |
| AC-22.1.5 | 完整審計記錄 | `SecurityLog` + `AuditLog` 雙寫入 |
| AC-22.1.6 | 失敗計數成功登入後重置 | `resetFailedAttempts(userId)` |
| AC-22.1.7 | 雙 Provider 整合 | Credentials + Microsoft Entra ID |
| AC-22.1.8 | 用戶體驗友善 | i18n 三語訊息 + 漸進顯示 |
| AC-22.1.9 | 鎖定郵件設計 | `lockout-notification.service.ts` |
| AC-22.1.10 | 防 Timing Attack | 一致的 bcrypt 計算時間 |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Account Lockout Architecture                         │
└─────────────────────────────────────────────────────────────────────────────┘

   User Login Attempt
   ────────────────►  ┌─────────────────────────┐
                      │   /api/auth/[...nextauth]│
                      │   (NextAuth handler)     │
                      └────────┬────────────────┘
                               │
                               ▼
                      ┌─────────────────────────┐
                      │ CredentialsProvider     │
                      │ .authorize()            │
                      └────────┬────────────────┘
                               │
                  ┌────────────┼─────────────────┐
                  │            │                 │
                  ▼            ▼                 ▼
        ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
        │ isLocked()?  │ │ verify pwd   │ │ on success/  │
        │              │ │              │ │ failure      │
        └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
               │                │                 │
               ▼                ▼                 ▼
        ┌────────────────────────────────────────────────┐
        │       AccountLockoutService                     │
        │  ┌─────────────────────────────────────────┐   │
        │  │ • incrementFailedAttempts(userId)       │   │
        │  │ • resetFailedAttempts(userId)           │   │
        │  │ • isLocked(user) → boolean              │   │
        │  │ • unlockAccount(userId, method, meta)   │   │
        │  └─────────────────────────────────────────┘   │
        └─────────────┬───────────────────────────────────┘
                      │
                      ▼
        ┌────────────────────────────┐    ┌──────────────────────┐
        │  User table                │    │  SecurityLog table    │
        │  • failedLoginAttempts     │    │  • ACCOUNT_LOCKED     │
        │  • lockedUntil             │    │  • ACCOUNT_UNLOCKED   │
        │  • lockReason              │    └──────────────────────┘
        │  • lastFailedLoginAt       │
        └────────────────────────────┘    ┌──────────────────────┐
                                           │  AuditLog table       │
                                           │  • action=LOCKED      │
                                           │  • action=UNLOCKED    │
                                           └──────────────────────┘

   Unlock Paths:
   ─────────────
   1. Auto Decay   ─►  isLocked() returns false when lockedUntil < now()
                       └─► Auto reset on next successful login

   2. Admin Unlock ─►  POST /api/admin/users/[id]/unlock
                       └─► Requires USER_MANAGE permission
                       └─► UnlockDialog.tsx UI

   3. Self Unlock  ─►  Email containing one-time token
                       └─► POST /api/auth/self-unlock { token }
                       └─► UnlockToken table validation
```

---

## Data Model

### Prisma Schema 變更

```prisma
// prisma/schema.prisma

model User {
  // ... 既有欄位 ...
  email                  String    @unique
  password               String?
  // ... 等等 ...

  // ✨ 新增帳號鎖定相關欄位（Story 22-1）
  failedLoginAttempts    Int       @default(0)              @map("failed_login_attempts")
  lockedUntil            DateTime?                          @map("locked_until")
  lockReason             String?                            @db.VarChar(255) @map("lock_reason")
  lastFailedLoginAt      DateTime?                          @map("last_failed_login_at")

  // 既有 relations
  unlockTokens           UnlockToken[]

  @@index([lockedUntil])  // 加速「目前哪些用戶被鎖定」查詢
}

// ✨ 新增：用戶自助解鎖 token model
model UnlockToken {
  id           String    @id @default(uuid())
  userId       String    @map("user_id")
  tokenHash    String    @unique @map("token_hash")     // SHA-256(plaintext token)
  createdAt    DateTime  @default(now())                @map("created_at")
  expiresAt    DateTime                                  @map("expires_at")
  usedAt       DateTime?                                 @map("used_at")
  ipAddress    String?   @db.VarChar(45)                @map("ip_address")
  userAgent    String?                                   @map("user_agent")

  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])    // 用於清理過期 tokens
  @@map("unlock_tokens")
}

// ✨ 新增 SecurityEventType 列舉值
enum SecurityEventType {
  // ... 既有值 ...
  UNAUTHORIZED_ACCESS_ATTEMPT
  CROSS_CITY_ACCESS_VIOLATION
  INVALID_CITY_REQUEST
  RESOURCE_ACCESS_DENIED
  SUSPICIOUS_ACTIVITY
  PERMISSION_ELEVATION_ATTEMPT
  TAMPERING_ATTEMPT

  // 新增（Story 22-1）
  ACCOUNT_LOCKED
  ACCOUNT_UNLOCKED
}

// ✨ 新增 AuditAction 列舉值（若不存在）
enum AuditAction {
  // ... 既有值 ...
  CREATE
  READ
  UPDATE
  DELETE
  LOGIN
  LOGOUT

  // 新增（Story 22-1）
  ACCOUNT_LOCKED
  ACCOUNT_UNLOCKED
}
```

### SQL Migration（給 production 部署參考）

```sql
-- 注意：本項目開發慣例使用 prisma db push --accept-data-loss
-- 此 SQL 僅作 production migration 參考

ALTER TABLE "users"
  ADD COLUMN "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "locked_until" TIMESTAMP,
  ADD COLUMN "lock_reason" VARCHAR(255),
  ADD COLUMN "last_failed_login_at" TIMESTAMP;

CREATE INDEX "users_locked_until_idx" ON "users"("locked_until");

CREATE TABLE "unlock_tokens" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash" TEXT NOT NULL UNIQUE,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "expires_at" TIMESTAMP NOT NULL,
  "used_at" TIMESTAMP,
  "ip_address" VARCHAR(45),
  "user_agent" TEXT
);

CREATE INDEX "unlock_tokens_user_id_idx" ON "unlock_tokens"("user_id");
CREATE INDEX "unlock_tokens_expires_at_idx" ON "unlock_tokens"("expires_at");

-- 列舉值新增需透過 Prisma migrate 或手動 ALTER TYPE
ALTER TYPE "SecurityEventType" ADD VALUE 'ACCOUNT_LOCKED';
ALTER TYPE "SecurityEventType" ADD VALUE 'ACCOUNT_UNLOCKED';
ALTER TYPE "AuditAction" ADD VALUE 'ACCOUNT_LOCKED';
ALTER TYPE "AuditAction" ADD VALUE 'ACCOUNT_UNLOCKED';
```

### Service Layer Interface

```typescript
// src/services/auth/account-lockout.service.ts

import type { User } from '@prisma/client';

export interface LockoutConfig {
  threshold: number;              // 預設 5
  windowMinutes: number;          // 預設 15
  lockDurationMinutes: number;    // 預設 30
}

export interface UnlockMetadata {
  reason: 'auto_decay' | 'admin_unlock' | 'self_unlock';
  unlockedBy?: string;            // admin user id（admin_unlock 時必填）
  comment?: string;               // admin 解鎖說明
  ipAddress?: string;
  userAgent?: string;
}

export class AccountLockoutService {
  constructor(
    private prisma: PrismaClient,
    private securityLog: SecurityLogService,
    private auditLog: AuditLogService,
    private notification: LockoutNotificationService,
    private config: LockoutConfig = {
      threshold: parseInt(process.env.ACCOUNT_LOCKOUT_THRESHOLD || '5'),
      windowMinutes: parseInt(process.env.ACCOUNT_LOCKOUT_WINDOW_MINUTES || '15'),
      lockDurationMinutes: parseInt(process.env.ACCOUNT_LOCKOUT_DURATION_MINUTES || '30'),
    }
  ) {}

  /**
   * 累加失敗計數，達閾值即鎖定
   */
  async incrementFailedAttempts(
    userId: string,
    context: { ipAddress?: string; userAgent?: string }
  ): Promise<{ locked: boolean; remainingAttempts: number }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    // 檢查 window 是否過期，若過期則重置計數
    const windowExpired = user.lastFailedLoginAt &&
      Date.now() - user.lastFailedLoginAt.getTime() > this.config.windowMinutes * 60 * 1000;

    const newAttempts = windowExpired ? 1 : user.failedLoginAttempts + 1;
    const shouldLock = newAttempts >= this.config.threshold;

    const updateData: any = {
      failedLoginAttempts: newAttempts,
      lastFailedLoginAt: new Date(),
    };

    if (shouldLock) {
      updateData.lockedUntil = new Date(Date.now() + this.config.lockDurationMinutes * 60 * 1000);
      updateData.lockReason = 'Too many failed login attempts';
    }

    await this.prisma.user.update({ where: { id: userId }, data: updateData });

    if (shouldLock) {
      await this.securityLog.log({
        eventType: 'ACCOUNT_LOCKED',
        severity: 'HIGH',
        userId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        metadata: {
          attempts: newAttempts,
          lockDurationMinutes: this.config.lockDurationMinutes,
        },
      });

      await this.auditLog.create({
        action: 'ACCOUNT_LOCKED',
        resourceType: 'User',
        resourceId: userId,
        userId,  // self
        metadata: { attempts: newAttempts },
      });

      // 寄送解鎖郵件（async，不阻擋鎖定流程）
      this.notification.sendLockoutEmail(user, context.ipAddress)
        .catch(err => console.error('Failed to send lockout email:', err));
    }

    return {
      locked: shouldLock,
      remainingAttempts: Math.max(0, this.config.threshold - newAttempts),
    };
  }

  /**
   * 成功登入後重置計數
   */
  async resetFailedAttempts(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lockReason: null,
        lastFailedLoginAt: null,
      },
    });
  }

  /**
   * 檢查用戶是否目前處於鎖定狀態
   */
  isLocked(user: Pick<User, 'lockedUntil'>): boolean {
    return user.lockedUntil !== null && user.lockedUntil > new Date();
  }

  /**
   * 統一解鎖入口
   */
  async unlockAccount(
    userId: string,
    metadata: UnlockMetadata
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
          lockReason: null,
        },
      });
    });

    await this.securityLog.log({
      eventType: 'ACCOUNT_UNLOCKED',
      severity: 'MEDIUM',
      userId,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      resolved: true,
      metadata: {
        reason: metadata.reason,
        unlockedBy: metadata.unlockedBy,
        comment: metadata.comment,
      },
    });

    await this.auditLog.create({
      action: 'ACCOUNT_UNLOCKED',
      resourceType: 'User',
      resourceId: userId,
      userId: metadata.unlockedBy || userId,
      metadata: { reason: metadata.reason },
    });
  }

  /**
   * 計算剩餘鎖定時間（分鐘）
   */
  remainingLockMinutes(user: Pick<User, 'lockedUntil'>): number {
    if (!user.lockedUntil) return 0;
    const remaining = user.lockedUntil.getTime() - Date.now();
    return Math.max(0, Math.ceil(remaining / 60000));
  }
}
```

---

## API Endpoints

### POST /api/admin/users/[id]/unlock

**Permission**: `USER_MANAGE`

**Request Body**:
```typescript
{
  reason: string;  // admin 必須填寫解鎖原因，3-500 字元
}
```

**Response 200**:
```json
{
  "success": true,
  "data": {
    "userId": "...",
    "unlockedAt": "2026-04-28T10:00:00Z"
  }
}
```

**Response 403**（缺權限）:
```json
{
  "type": "https://docs.example.com/errors/auth/insufficient-permission",
  "title": "Insufficient permission",
  "status": 403,
  "detail": "USER_MANAGE permission required",
  "instance": "/api/admin/users/abc/unlock"
}
```

**Response 404**（用戶不存在）:
```json
{
  "type": "https://docs.example.com/errors/user/not-found",
  "title": "User not found",
  "status": 404,
  "detail": "No user with id=abc",
  "instance": "/api/admin/users/abc/unlock"
}
```

### POST /api/auth/self-unlock

**Permission**: 無（公開端點，但有 rate limit）

**Rate Limit**: 每 IP 每小時 5 次

**Request Body**:
```typescript
{
  token: string;  // 從 email 取得的 unlock token
}
```

**Response 200**:
```json
{
  "success": true,
  "data": { "redirectTo": "/auth/login?unlocked=true" }
}
```

**Response 400**（token 無效）:
```json
{
  "type": "https://docs.example.com/errors/auth/invalid-unlock-token",
  "title": "Invalid or expired unlock token",
  "status": 400,
  "detail": "The unlock token has expired or has already been used",
  "instance": "/api/auth/self-unlock"
}
```

### Zod Schema

```typescript
// src/lib/validations/auth.ts

import { z } from 'zod';

export const adminUnlockSchema = z.object({
  reason: z.string().min(3).max(500),
});

export const selfUnlockSchema = z.object({
  token: z.string().min(32).max(128),  // hex-encoded SHA-256 hash 或 plain UUID
});
```

---

## UI Component（Admin 解鎖 UI）

### `src/components/features/admin/users/UnlockDialog.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useUnlockUser } from '@/hooks/use-unlock-user';

interface UnlockDialogProps {
  userId: string;
  userEmail: string;
  lockedUntil: Date;
  open: boolean;
  onClose: () => void;
}

export function UnlockDialog({ userId, userEmail, lockedUntil, open, onClose }: UnlockDialogProps) {
  const t = useTranslations('auth.unlock');
  const [reason, setReason] = useState('');
  const { mutate: unlock, isPending, error } = useUnlockUser();

  const handleUnlock = () => {
    unlock(
      { userId, reason },
      { onSuccess: () => onClose() }
    );
  };

  const remainingMinutes = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('dialog.title')}</DialogTitle>
        </DialogHeader>

        <Alert variant="warning">
          <AlertDescription>
            {t('dialog.description', { email: maskEmail(userEmail), minutes: remainingMinutes })}
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <label className="text-sm font-medium">{t('dialog.reasonLabel')}</label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('dialog.reasonPlaceholder')}
            minLength={3}
            maxLength={500}
            required
          />
        </div>

        {error && <Alert variant="destructive"><AlertDescription>{error.message}</AlertDescription></Alert>}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            {t('dialog.cancel')}
          </Button>
          <Button onClick={handleUnlock} disabled={isPending || reason.length < 3}>
            {isPending ? t('dialog.unlocking') : t('dialog.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function maskEmail(email: string): string {
  return email.replace(/^(.{2}).*(@.*)$/, '$1***$2');
}
```

---

## NextAuth Integration（auth.config.ts 修改要點）

```typescript
// src/lib/auth.config.ts (修改示意)

import { AccountLockoutService } from '@/services/auth/account-lockout.service';

const lockoutService = new AccountLockoutService(prisma, securityLog, auditLog, notification);

export const authConfig: NextAuthConfig = {
  providers: [
    Credentials({
      async authorize(credentials, request) {
        const { email, password } = credentials;
        const user = await prisma.user.findUnique({ where: { email } });

        // ⚠️ Timing attack 防護：對「不存在」的用戶仍執行 dummy bcrypt
        if (!user) {
          await bcrypt.compare('dummy', '$2a$12$dummyhashfortimingattack');
          return null;
        }

        // ✨ 新增：先檢查鎖定狀態
        if (lockoutService.isLocked(user)) {
          const remaining = lockoutService.remainingLockMinutes(user);
          throw new Error(`AccountLocked|${remaining}|${maskEmail(user.email)}`);
        }

        const valid = await bcrypt.compare(password, user.password!);
        const ipAddress = getClientIp(request);
        const userAgent = request?.headers.get('user-agent') ?? undefined;

        if (!valid) {
          // ✨ 新增：累加失敗計數（達閾值即鎖定）
          const result = await lockoutService.incrementFailedAttempts(user.id, { ipAddress, userAgent });

          if (result.locked) {
            throw new Error(`AccountJustLocked|${maskEmail(user.email)}`);
          }
          return null;
        }

        // ✨ 新增：成功登入重置計數
        await lockoutService.resetFailedAttempts(user.id);

        return { id: user.id, email: user.email, /* ... */ };
      },
    }),
    MicrosoftEntraId({ /* ... */ }),
  ],

  callbacks: {
    async signIn({ user, account }) {
      // ✨ Microsoft Entra ID 也要檢查鎖定（雖然不計數，但拒絕已鎖定帳號）
      if (account?.provider === 'microsoft-entra-id') {
        const dbUser = await prisma.user.findUnique({ where: { email: user.email! } });
        if (dbUser && lockoutService.isLocked(dbUser)) {
          return false;  // NextAuth 會顯示 OAuthSignin error
        }
      }
      return true;
    },
  },
};
```

---

## Security Considerations

### 1. Timing Attack 防護

| 情境 | 風險 | 緩解 |
|------|------|------|
| Email 不存在 | 響應時間 < 100ms（無 bcrypt）| 對不存在的 email 也跑一次 dummy bcrypt |
| 密碼錯誤 | 響應時間 ~200-500ms（含 bcrypt）| 一致的 bcrypt cost |
| 帳號鎖定中 | 響應時間 < 100ms（直接拒絕）| 仍跑 dummy bcrypt 統一響應時間 |

### 2. Race Condition

**問題**：兩個請求同時失敗，可能同時讀到 `failedLoginAttempts=4` 並各自寫入 `5`，但實際應為 `6`。

**緩解**：使用 Prisma `update with atomic increment`：
```typescript
await prisma.user.update({
  where: { id: userId },
  data: {
    failedLoginAttempts: { increment: 1 },
    lastFailedLoginAt: new Date(),
  },
});
```
然後讀取更新後的值來判斷是否達閾值。

### 3. Token 安全

- **UnlockToken** 在 DB 中只存 SHA-256 hash，不存明文
- 明文 token 僅在 email URL 中出現，TLS 保護
- Token 一次性使用（`usedAt` 標記）
- Token 30 分鐘過期
- IP 與 User Agent 記錄供 forensic 分析

### 4. 防 Enumeration

錯誤訊息設計避免洩漏 email 是否存在：
- 「Email 或密碼錯誤」（首次失敗）
- 「您的帳號目前處於鎖定狀態...」（鎖定中，僅當系統能確認 email 存在且鎖定時才顯示）

但鎖定訊息本身會洩漏「該 email 存在」— 此為合理 trade-off（用戶體驗 vs 完美 enumeration 防護）。

### 5. Dev Bypass 互動（FIX-056 配合）

`isDevelopmentMode()` 觸發 `DEV_MOCK_SESSION` 時，**不應觸發鎖定流程**（避免 dev 環境體驗異常）。但 FIX-056 將加固 `X-Dev-Bypass-Auth` 至 NODE_ENV === 'development' 強制檢查，雙重防線。

---

## Testing Strategy

### Unit Tests（Vitest，依賴 Story 22-5）

```
src/services/auth/__tests__/
├── account-lockout.service.test.ts
│   ├── incrementFailedAttempts
│   │   ├── 第 1 次失敗：counter = 1, locked = false
│   │   ├── 第 5 次失敗：counter = 5, locked = true, lockedUntil 設定
│   │   ├── window 過期重置：>15 分鐘後失敗，counter 重置為 1
│   │   └── 同時兩個 request：使用 atomic increment，無 race condition
│   ├── resetFailedAttempts
│   │   └── 成功登入後 counter = 0, lockedUntil = null
│   ├── isLocked
│   │   ├── lockedUntil = null → false
│   │   ├── lockedUntil < now() → false（自動衰減）
│   │   └── lockedUntil > now() → true
│   └── unlockAccount
│       ├── reason = 'admin_unlock' → SecurityLog 記錄 unlockedBy
│       ├── reason = 'self_unlock' → SecurityLog 記錄 method
│       └── 並寫入 AuditLog
└── lockout-notification.service.test.ts
    ├── 正常寄送 → 包含 unlock URL
    ├── SMTP 失敗 → log warning 但不 throw
    └── i18n 三語都能正確產生
```

### Integration Tests

```
tests/integration/auth/
├── lockout-trigger.test.ts
│   └── 端對端 5 次失敗 → DB 狀態正確 + SecurityLog 寫入
├── auto-decay.test.ts
│   └── mock time +31min → 下次登入成功
└── timing-attack.test.ts
    └── 測量三種情境響應時間差 < 100ms
```

### E2E Tests（Playwright）

```
tests/e2e/auth/
├── account-lockout.spec.ts
│   ├── 用戶輸入錯誤密碼 5 次 → 顯示鎖定訊息 + 收到 email
│   ├── 點擊 email 中 unlock URL → 解鎖成功 + 重定向登入頁
│   └── 鎖定中重試登入 → 顯示「剩餘 X 分鐘」訊息
└── admin-unlock.spec.ts
    ├── Admin 在 /admin/users/[id] 看到鎖定狀態
    ├── 點擊「立即解鎖」打開對話框
    ├── 填寫原因並確認 → API 200 + UI 顯示成功
    └── 用戶下次登入成功
```

### Security Tests

```
tests/security/auth/
├── enumeration.test.ts
│   └── 「不存在 email」與「存在但密碼錯誤」響應差 < 100ms
├── race-condition.test.ts
│   └── 並發 10 次失敗請求 → counter 最終正確（無漏記）
└── token-replay.test.ts
    └── 已使用的 unlock token 不能重複使用
```

---

## Performance Considerations

| 操作 | 預估延遲 | 注意 |
|------|----------|------|
| `incrementFailedAttempts` | 5-10ms | 單一 atomic update |
| `isLocked` 檢查 | < 1ms | 純記憶體比較 |
| `unlockAccount`（含 SecurityLog + AuditLog）| 15-25ms | 三個 DB writes（建議用 transaction）|
| 鎖定郵件寄送 | 100-500ms | Async，不阻擋登入流程 |
| timing attack dummy bcrypt | ~200ms | 必要 trade-off |

**索引策略**：
- `User.locked_until` 加 index（admin 列表「目前被鎖定的用戶」）
- `UnlockToken.expires_at` 加 index（清理過期 tokens 的 cron）

---

## Rollback Plan

若上線後發現重大問題：

1. **緊急降級**：環境變數 `ACCOUNT_LOCKOUT_THRESHOLD=99999`（實質禁用）
2. **資料庫回滾**：`UPDATE users SET failed_login_attempts=0, locked_until=NULL`（解放所有被鎖用戶）
3. **代碼回滾**：透過 git revert PR

回滾不影響資料完整性（schema 欄位保留，僅邏輯禁用）。

---

## File Structure

```
prisma/schema.prisma                                       # 更新

src/services/auth/
├── account-lockout.service.ts                            # 新增（核心服務）
├── lockout-notification.service.ts                       # 新增（郵件）
└── __tests__/
    ├── account-lockout.service.test.ts                   # 新增
    └── lockout-notification.service.test.ts              # 新增

src/lib/
├── auth.config.ts                                        # 更新（CredentialsProvider）
├── auth.ts                                               # 更新（signIn callback）
└── validations/
    └── auth.ts                                           # 更新（schema）

src/app/api/auth/self-unlock/route.ts                     # 新增
src/app/api/admin/users/[id]/unlock/route.ts              # 新增

src/app/[locale]/(dashboard)/admin/users/[id]/page.tsx    # 更新（顯示鎖定狀態）

src/components/features/admin/users/
└── UnlockDialog.tsx                                      # 新增

src/hooks/
└── use-unlock-user.ts                                    # 新增

messages/{en,zh-TW,zh-CN}/auth.json                       # 更新

tests/integration/auth/
├── lockout-trigger.test.ts                               # 新增
├── auto-decay.test.ts                                    # 新增
└── timing-attack.test.ts                                 # 新增

tests/e2e/auth/
├── account-lockout.spec.ts                               # 新增
└── admin-unlock.spec.ts                                  # 新增

tests/security/auth/
├── enumeration.test.ts                                   # 新增
├── race-condition.test.ts                                # 新增
└── token-replay.test.ts                                  # 新增

.env.example                                              # 更新（4 個新環境變數）
```

---

## i18n 新增 Keys（auth namespace）

```json
{
  "errors": {
    "invalidCredentials": "Email 或密碼錯誤",
    "accountLockedJustNow": "您的帳號因多次登入失敗已被鎖定 30 分鐘。我們已寄出解鎖郵件至 {email}，您也可以聯絡管理員協助。",
    "accountLockedRemaining": "您的帳號目前處於鎖定狀態，剩餘 {minutes} 分鐘。請查收解鎖郵件或聯絡管理員。"
  },
  "unlock": {
    "adminSuccess": "已成功解除帳號鎖定",
    "selfSuccess": "您的帳號已成功解除鎖定，請重新登入",
    "tokenInvalid": "解鎖連結無效或已過期，請重新申請",
    "dialog": {
      "title": "解除帳號鎖定",
      "description": "您即將解除 {email} 的帳號鎖定（剩餘 {minutes} 分鐘）",
      "reasonLabel": "解鎖原因",
      "reasonPlaceholder": "請說明解鎖原因（供審計追蹤）",
      "cancel": "取消",
      "confirm": "確認解鎖",
      "unlocking": "解鎖中..."
    }
  },
  "unlockEmail": {
    "subject": "您的帳號已被暫時鎖定",
    "body": "您的帳號因多次登入失敗於 {time} 被自動鎖定。\n觸發 IP：{ipAddress}\n自動解鎖時間：{unlockTime}\n\n您可以點擊以下連結立即解鎖：\n{unlockUrl}\n\n若這不是您本人的操作，建議您立即重設密碼。",
    "cta": "立即解鎖我的帳號"
  }
}
```

---

## Acceptance Criteria 驗證 Checklist

- [ ] AC1: 5 次失敗 / 15 分鐘窗口觸發鎖定
- [ ] AC2: 30 分鐘自動衰減解鎖
- [ ] AC3: Admin UI 即時解鎖（含填寫原因）
- [ ] AC4: 用戶 email token 自助解鎖（一次性 token）
- [ ] AC5: 雙寫入 SecurityLog + AuditLog
- [ ] AC6: 成功登入重置計數
- [ ] AC7: Credentials + Microsoft Entra ID 雙 Provider 整合
- [ ] AC8: 友善 i18n 錯誤訊息（三語齊全）
- [ ] AC9: 鎖定郵件設計（含 unlock URL + IP + 時間）
- [ ] AC10: Timing attack 響應時間差 < 100ms
- [ ] 全部 13 個測試套件通過
- [ ] 通過 `npm run type-check`、`npm run lint`、`npm run i18n:check`

---

## 版本資訊

- **建立日期**: 2026-04-28
- **版本**: 1.0.0
- **依據**: `docs/08-security-and-governance/phase2-iam-dp-assessment.md` IAM-07a/b/c
- **矩陣依據**: `docs/08-security-and-governance/enterprise-security-governance-matrix.md` v1.2 第 49-56 行
