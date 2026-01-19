# Story 18.2: 本地帳號登入

**Status:** ready-for-dev

---

## Story

**As a** 已註冊的用戶,
**I want** 使用電子郵件和密碼登入系統,
**So that** 我可以存取系統功能而無需使用 Azure AD。

---

## Acceptance Criteria

### AC1: 登入頁面整合

**Given** 用戶訪問登入頁面
**When** 頁面載入完成
**Then** 顯示以下登入選項：
  - 「使用 Microsoft 登入」按鈕（現有 Azure AD）
  - 分隔線「或」
  - 電子郵件輸入欄位
  - 密碼輸入欄位
  - 「登入」按鈕
  - 「忘記密碼？」連結
  - 「沒有帳號？註冊」連結

### AC2: 本地帳號登入流程

**Given** 用戶輸入有效的電子郵件和密碼
**When** 用戶點擊「登入」按鈕
**Then** 系統驗證密碼正確
**And** 建立 JWT Session（與 Azure AD 登入相同結構）
**And** 重導向至 Dashboard
**And** 顯示用戶名稱和角色資訊

### AC3: 登入失敗處理

**Given** 用戶輸入錯誤的電子郵件或密碼
**When** 用戶嘗試登入
**Then** 系統顯示「電子郵件或密碼錯誤」訊息
**And** 不洩漏是哪個欄位錯誤（安全考量）
**And** 記錄失敗的登入嘗試

### AC4: 郵件未驗證處理

**Given** 用戶的電子郵件尚未驗證
**When** 用戶嘗試登入
**Then** 系統顯示「請先驗證您的電子郵件」訊息
**And** 提供「重新發送驗證郵件」選項

### AC5: 帳號狀態檢查

**Given** 用戶帳號狀態為 INACTIVE 或 SUSPENDED
**When** 用戶嘗試登入
**Then** 系統顯示相應的錯誤訊息：
  - INACTIVE: 「此帳號已停用」
  - SUSPENDED: 「此帳號已被暫停」
**And** 阻止登入

### AC6: Session 統一性

**Given** 用戶透過本地帳號成功登入
**When** Session 建立完成
**Then** Session 包含與 Azure AD 登入相同的結構：
  - user.id
  - user.email
  - user.name
  - user.status
  - user.roles
  - user.cityCodes
  - user.isGlobalAdmin
  - user.isRegionalManager

---

## Tasks / Subtasks

- [ ] **Task 1: 修改 Credentials Provider** (AC: #2, #3, #5)
  - [ ] 1.1 更新 `auth.config.ts` 的 authorize 函數
  - [ ] 1.2 實現資料庫用戶查詢
  - [ ] 1.3 實現 bcrypt 密碼比對
  - [ ] 1.4 實現帳號狀態檢查
  - [ ] 1.5 返回完整用戶資訊

- [ ] **Task 2: 修改 JWT Callback** (AC: #6)
  - [ ] 2.1 更新 `auth.ts` 的 jwt callback
  - [ ] 2.2 處理本地帳號登入的 token 設置
  - [ ] 2.3 確保與 Azure AD 登入的 token 結構一致

- [ ] **Task 3: 郵件驗證檢查** (AC: #4)
  - [ ] 3.1 在 signIn callback 中檢查 emailVerified
  - [ ] 3.2 實現未驗證用戶的錯誤處理
  - [ ] 3.3 建立重新發送驗證郵件 API

- [ ] **Task 4: 登入頁面 UI 更新** (AC: #1)
  - [ ] 4.1 修改 `login/page.tsx` 加入本地登入表單
  - [ ] 4.2 實現雙重登入選項 UI（Azure AD + 本地）
  - [ ] 4.3 實現表單驗證
  - [ ] 4.4 實現載入狀態和錯誤處理
  - [ ] 4.5 加入「忘記密碼」和「註冊」連結

- [ ] **Task 5: 登入失敗記錄** (AC: #3)
  - [ ] 5.1 建立登入嘗試記錄資料表（可選）
  - [ ] 5.2 實現登入失敗計數
  - [ ] 5.3 實現暫時鎖定機制（5 次失敗後鎖定 15 分鐘）

- [ ] **Task 6: 翻譯文件更新** (AC: #1, #3, #4, #5)
  - [ ] 6.1 更新 `messages/*/auth.json` 登入相關翻譯
  - [ ] 6.2 新增錯誤訊息翻譯

- [ ] **Task 7: 驗證與測試** (AC: #1-6)
  - [ ] 7.1 測試本地帳號登入成功流程
  - [ ] 7.2 測試登入失敗處理
  - [ ] 7.3 測試未驗證郵件處理
  - [ ] 7.4 測試帳號狀態檢查
  - [ ] 7.5 測試 Session 結構一致性
  - [ ] 7.6 測試與 Azure AD 登入並存

---

## Dev Notes

### 技術重點

此 Story 的核心是修改現有的 NextAuth Credentials Provider，從「開發模式模擬」升級為「真正的帳號密碼驗證」。

### 關鍵修改

#### auth.config.ts 修改

```typescript
// 修改前：開發模式模擬
Credentials({
  async authorize(credentials) {
    if (credentials?.email?.includes('@')) {
      return { id: 'dev-user-1', email: credentials.email }
    }
    return null
  }
})

// 修改後：真正的帳號密碼驗證
Credentials({
  credentials: {
    email: { label: 'Email', type: 'email' },
    password: { label: 'Password', type: 'password' },
  },
  async authorize(credentials) {
    if (!credentials?.email || !credentials?.password) {
      return null
    }

    const user = await prisma.user.findUnique({
      where: { email: credentials.email as string },
      include: {
        roles: { include: { role: true } },
      },
    })

    if (!user || !user.password) {
      return null // 用戶不存在或無密碼（Azure AD 用戶）
    }

    const isValid = await verifyPassword(
      credentials.password as string,
      user.password
    )

    if (!isValid) {
      return null
    }

    // 檢查帳號狀態
    if (user.status !== 'ACTIVE') {
      throw new Error(user.status === 'SUSPENDED' ? 'AccountSuspended' : 'AccountDisabled')
    }

    // 檢查郵件驗證（可選，根據業務需求）
    if (!user.emailVerified) {
      throw new Error('EmailNotVerified')
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
    }
  }
})
```

#### 登入頁面 UI 設計

```
┌─────────────────────────────────────────┐
│                                         │
│    AI Document Extraction               │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │   Sign in with Microsoft        │   │  ← Azure AD 登入
│  └─────────────────────────────────┘   │
│                                         │
│  ──────────── 或 ────────────          │  ← 分隔線
│                                         │
│  Email                                  │
│  ┌─────────────────────────────────┐   │
│  │ user@example.com                │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Password                               │
│  ┌─────────────────────────────────┐   │
│  │ ••••••••                        │   │
│  └─────────────────────────────────┘   │
│                                         │
│           Forgot password?              │  ← 忘記密碼連結
│                                         │
│  ┌─────────────────────────────────┐   │
│  │          Sign In                │   │  ← 本地帳號登入
│  └─────────────────────────────────┘   │
│                                         │
│    Don't have an account? Register     │  ← 註冊連結
│                                         │
└─────────────────────────────────────────┘
```

### 依賴項

- Story 18-1: 用戶註冊功能（password.ts 工具）
- 現有 NextAuth 配置
- bcryptjs 套件

### Testing Requirements

| 驗證項目 | 測試方法 | 預期結果 |
|---------|---------|---------|
| 本地登入成功 | 有效帳號密碼登入 | 重導向至 Dashboard |
| 登入失敗 | 錯誤密碼登入 | 顯示錯誤訊息 |
| 未驗證郵件 | 未驗證帳號登入 | 顯示驗證提示 |
| 帳號停用 | 停用帳號登入 | 顯示停用訊息 |
| Session 檢查 | 登入後檢查 Session | 包含完整用戶資訊 |
| 雙重登入 | Azure AD 和本地並存 | 兩種方式都可用 |

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 18.2 |
| Story Key | 18-2-local-account-login |
| Epic | Epic 18: 本地帳號認證系統 |
| Estimated Effort | 1 天 |
| Dependencies | Story 18-1 |
| Blocking | Story 18-3, Story 18-4 |

---

*Story created: 2026-01-19*
*Status: ready-for-dev*
*Generated by: Claude AI Assistant*
