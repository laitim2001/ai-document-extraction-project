# Epic 18: 本地帳號認證系統

**Status:** planning
**Created:** 2026-01-19
**Epic Key:** epic-18-local-auth

---

## Epic Overview

### 目標

建立完整的本地帳號認證系統，讓用戶可以透過電子郵件和密碼註冊、登入系統，並支援密碼重設和郵件驗證功能。此系統將與現有的 Azure AD SSO 並存，提供更靈活的認證選項。

### 背景

目前系統僅支援：
1. **Azure AD SSO** - 企業級單點登入
2. **開發模式登入** - 僅供開發測試使用的模擬登入

為了支援更廣泛的使用場景（如外部合作夥伴、非 Azure AD 用戶等），需要建立本地帳號認證系統。

### 業務價值

| 價值項目 | 說明 |
|---------|------|
| 使用彈性 | 支援非 Azure AD 用戶使用系統 |
| 合作夥伴整合 | 允許外部合作夥伴註冊使用 |
| 開發測試 | 提供真實的測試帳號機制 |
| 備援方案 | Azure AD 服務中斷時的替代登入方式 |

---

## Stories 清單

| Story ID | Story 名稱 | 優先級 | 預估工時 | 狀態 |
|----------|-----------|--------|---------|------|
| 18-1 | 用戶註冊功能 | P0 | 1.5 天 | ⏸️ 待開發 |
| 18-2 | 本地帳號登入 | P0 | 1 天 | ⏸️ 待開發 |
| 18-3 | 忘記密碼與重設 | P1 | 1 天 | ⏸️ 待開發 |
| 18-4 | 郵件驗證系統 | P1 | 1 天 | ⏸️ 待開發 |

**總預估工時**: 4.5 天

---

## 技術架構

### 認證流程圖

```
                    ┌─────────────────────────────────────────┐
                    │           用戶認證入口                    │
                    │         /auth/login                      │
                    └─────────────────┬───────────────────────┘
                                      │
                    ┌─────────────────┴───────────────────────┐
                    │                                          │
           ┌────────▼────────┐                    ┌────────────▼────────────┐
           │   Azure AD SSO   │                    │      本地帳號登入         │
           │  (現有功能)       │                    │     (Epic 18 新增)       │
           └────────┬────────┘                    └────────────┬────────────┘
                    │                                          │
                    │                              ┌───────────┴───────────┐
                    │                              │                        │
                    │                    ┌─────────▼─────────┐    ┌────────▼────────┐
                    │                    │    帳號密碼驗證     │    │    忘記密碼      │
                    │                    │  bcrypt 密碼比對   │    │   重設流程       │
                    │                    └─────────┬─────────┘    └────────┬────────┘
                    │                              │                        │
                    │                    ┌─────────▼─────────┐    ┌────────▼────────┐
                    │                    │   檢查郵件驗證狀態  │    │   發送重設郵件   │
                    │                    │   emailVerified    │    │   Token 機制     │
                    │                    └─────────┬─────────┘    └─────────────────┘
                    │                              │
                    └──────────────────────────────┴───────────────────────┐
                                                                           │
                                              ┌────────────────────────────▼────┐
                                              │         建立 JWT Session         │
                                              │       統一的 Session 結構        │
                                              └────────────────────────────────┘
```

### 資料庫結構擴展

```prisma
model User {
  // 現有欄位
  id            String     @id @default(cuid())
  email         String     @unique
  name          String?
  image         String?
  password      String?    // ← 啟用此欄位（bcrypt 加密）
  azureAdId     String?    @unique
  emailVerified DateTime?  // ← 郵件驗證時間戳
  status        UserStatus @default(ACTIVE)

  // 新增欄位
  passwordResetToken     String?   @unique
  passwordResetExpires   DateTime?
  emailVerificationToken String?   @unique
  emailVerificationExpires DateTime?

  // ... 其他關聯
}
```

### 郵件服務

```
┌───────────────────────────────────────────────────────────┐
│                      郵件服務架構                          │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────────┐     ┌─────────────┐     ┌────────────┐  │
│  │ Email Service│ --> │   Nodemailer │ --> │   SMTP     │  │
│  │  (抽象層)    │     │   (傳送器)   │     │  Provider  │  │
│  └─────────────┘     └─────────────┘     └────────────┘  │
│                                                           │
│  支援的 Provider:                                         │
│  - SendGrid (推薦生產環境)                                │
│  - Azure Communication Services                          │
│  - Gmail SMTP (開發測試)                                  │
│  - Ethereal (開發模式，不實際發送)                        │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

---

## 安全考量

### 密碼安全

| 項目 | 要求 |
|------|------|
| 加密演算法 | bcrypt (cost factor: 12) |
| 最小長度 | 8 字元 |
| 複雜度要求 | 至少包含大小寫字母、數字 |
| 密碼歷史 | 不可與最近 3 次密碼相同（可選） |

### Token 安全

| Token 類型 | 有效期 | 長度 | 用途 |
|-----------|--------|------|------|
| 密碼重設 Token | 1 小時 | 64 字元 | 重設密碼連結 |
| 郵件驗證 Token | 24 小時 | 64 字元 | 驗證郵件連結 |
| JWT Session | 8 小時 | - | 登入狀態維持 |

### 速率限制

| 操作 | 限制 | 時間窗口 |
|------|------|---------|
| 登入嘗試 | 5 次 | 15 分鐘 |
| 密碼重設請求 | 3 次 | 1 小時 |
| 註冊請求 | 3 次 | 1 小時 |

---

## 依賴項

### 新增套件

```json
{
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "nodemailer": "^6.9.x"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.x",
    "@types/nodemailer": "^6.4.x"
  }
}
```

### 環境變數

```bash
# Email Service (必須配置)
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_USER="your-email@example.com"
SMTP_PASSWORD="your-smtp-password"
SMTP_FROM="noreply@example.com"

# Password Security
BCRYPT_SALT_ROUNDS="12"

# Token Settings
PASSWORD_RESET_TOKEN_EXPIRES_HOURS="1"
EMAIL_VERIFICATION_TOKEN_EXPIRES_HOURS="24"
```

---

## 與現有系統的整合

### NextAuth 配置擴展

現有的 Credentials Provider 將從「開發模式模擬」升級為「真正的帳號密碼驗證」：

```typescript
// Before: 開發模式（任何 email 都接受）
Credentials({
  async authorize(credentials) {
    if (credentials?.email?.includes('@')) {
      return { id: 'dev-user-1', email: credentials.email }
    }
    return null
  }
})

// After: 真正的帳號密碼驗證
Credentials({
  async authorize(credentials) {
    const user = await prisma.user.findUnique({
      where: { email: credentials.email }
    })

    if (user && user.password) {
      const isValid = await bcrypt.compare(credentials.password, user.password)
      if (isValid) {
        return { id: user.id, email: user.email, name: user.name }
      }
    }
    return null
  }
})
```

### Session 統一性

無論是 Azure AD 還是本地帳號登入，Session 結構保持完全一致：

```typescript
interface Session {
  user: {
    id: string
    email: string
    name: string
    status: UserStatus
    roles: SessionRole[]
    cityCodes: string[]
    isGlobalAdmin: boolean
    // ... 其他屬性
  }
}
```

---

## 驗收標準

### 功能驗收

| 功能 | 驗收條件 |
|------|---------|
| 註冊 | 用戶可透過表單註冊新帳號，密碼正確加密存儲 |
| 登入 | 用戶可使用 email/密碼登入，Session 正確建立 |
| 忘記密碼 | 用戶可請求重設密碼，郵件正確發送，Token 有效 |
| 重設密碼 | 用戶可透過連結重設密碼，舊 Token 失效 |
| 郵件驗證 | 用戶收到驗證郵件，點擊後 emailVerified 更新 |

### 安全驗收

| 項目 | 驗收條件 |
|------|---------|
| 密碼加密 | 資料庫中不存在明文密碼 |
| Token 唯一性 | 每個 Token 只能使用一次 |
| Token 過期 | 過期 Token 無法使用 |
| 速率限制 | 超過限制返回 429 錯誤 |

---

## 實施順序

```
Story 18-1: 用戶註冊功能
    ↓
Story 18-2: 本地帳號登入
    ↓
Story 18-3: 忘記密碼與重設
    ↓
Story 18-4: 郵件驗證系統
```

每個 Story 完成後需進行集成測試，確保與現有 Azure AD 登入功能無衝突。

---

## 相關文檔

- Story 1-1: Azure AD SSO 登入（現有）
- Tech-spec 1-1: Azure AD 技術規格（現有）
- PRD FR36: 用戶認證功能需求

---

*Epic created: 2026-01-19*
*Status: planning*
*Generated by: Claude AI Assistant*
