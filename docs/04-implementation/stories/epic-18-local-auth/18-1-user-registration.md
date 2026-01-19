# Story 18.1: 用戶註冊功能

**Status:** ready-for-dev

---

## Story

**As a** 新用戶,
**I want** 使用電子郵件和密碼註冊帳號,
**So that** 我可以建立本地帳號並使用系統功能。

---

## Acceptance Criteria

### AC1: 註冊表單顯示

**Given** 用戶訪問註冊頁面
**When** 頁面載入完成
**Then** 顯示包含以下欄位的註冊表單：
  - 姓名（必填）
  - 電子郵件（必填）
  - 密碼（必填）
  - 確認密碼（必填）
**And** 顯示「註冊」按鈕
**And** 顯示「已有帳號？登入」連結

### AC2: 表單驗證

**Given** 用戶填寫註冊表單
**When** 用戶輸入不符合要求的資料
**Then** 系統即時顯示驗證錯誤訊息：
  - 姓名：至少 2 個字元
  - 電子郵件：有效的電子郵件格式
  - 密碼：至少 8 字元，包含大小寫字母和數字
  - 確認密碼：與密碼一致

### AC3: 註冊成功

**Given** 用戶填寫有效的註冊資料
**When** 用戶點擊「註冊」按鈕
**Then** 系統建立新用戶帳號
**And** 密碼以 bcrypt 加密存儲
**And** 設定 emailVerified 為 null（待驗證）
**And** 指派預設角色（Data Processor）
**And** 發送驗證郵件至用戶信箱
**And** 重導向至登入頁面並顯示成功訊息

### AC4: 電子郵件重複檢查

**Given** 用戶嘗試使用已存在的電子郵件註冊
**When** 用戶提交註冊表單
**Then** 系統顯示錯誤訊息：「此電子郵件已被註冊」
**And** 不建立重複帳號

### AC5: 密碼安全要求

**Given** 用戶設定密碼
**When** 密碼不符合安全要求
**Then** 系統顯示具體的密碼要求提示：
  - 至少 8 個字元
  - 包含至少一個大寫字母
  - 包含至少一個小寫字母
  - 包含至少一個數字

---

## Tasks / Subtasks

- [ ] **Task 1: 資料庫 Schema 更新** (AC: #3)
  - [ ] 1.1 確認 User 模型的 password 欄位已啟用
  - [ ] 1.2 新增 emailVerificationToken 欄位
  - [ ] 1.3 新增 emailVerificationExpires 欄位
  - [ ] 1.4 執行 Prisma 遷移

- [ ] **Task 2: 安裝依賴套件** (AC: #3, #5)
  - [ ] 2.1 安裝 bcryptjs 密碼加密套件
  - [ ] 2.2 安裝 @types/bcryptjs 類型定義
  - [ ] 2.3 安裝 nodemailer 郵件套件（如尚未安裝）
  - [ ] 2.4 安裝 @types/nodemailer 類型定義

- [ ] **Task 3: 註冊 API 端點** (AC: #3, #4)
  - [ ] 3.1 建立 `POST /api/auth/register` 端點
  - [ ] 3.2 實現 Zod 請求驗證 Schema
  - [ ] 3.3 實現電子郵件重複檢查邏輯
  - [ ] 3.4 實現 bcrypt 密碼加密
  - [ ] 3.5 實現用戶建立邏輯
  - [ ] 3.6 實現預設角色指派
  - [ ] 3.7 實現驗證 Token 產生
  - [ ] 3.8 整合郵件發送服務

- [ ] **Task 4: 密碼驗證服務** (AC: #2, #5)
  - [ ] 4.1 建立 `src/lib/password.ts` 密碼工具
  - [ ] 4.2 實現密碼強度驗證函數
  - [ ] 4.3 實現 bcrypt 加密函數
  - [ ] 4.4 實現 bcrypt 比對函數

- [ ] **Task 5: 郵件服務** (AC: #3)
  - [ ] 5.1 建立 `src/lib/email.ts` 郵件服務
  - [ ] 5.2 配置 Nodemailer SMTP 設定
  - [ ] 5.3 實現發送驗證郵件函數
  - [ ] 5.4 建立驗證郵件 HTML 模板

- [ ] **Task 6: 註冊頁面 UI** (AC: #1, #2)
  - [ ] 6.1 建立 `src/app/[locale]/(auth)/auth/register/page.tsx`
  - [ ] 6.2 實現註冊表單組件
  - [ ] 6.3 實現即時表單驗證（React Hook Form + Zod）
  - [ ] 6.4 實現密碼強度指示器
  - [ ] 6.5 實現載入狀態和錯誤處理
  - [ ] 6.6 加入國際化翻譯支援

- [ ] **Task 7: 翻譯文件更新** (AC: #1, #2)
  - [ ] 7.1 新增 `messages/en/auth.json` 註冊相關翻譯
  - [ ] 7.2 新增 `messages/zh-TW/auth.json` 註冊相關翻譯
  - [ ] 7.3 新增 `messages/zh-CN/auth.json` 註冊相關翻譯

- [ ] **Task 8: 驗證與測試** (AC: #1-5)
  - [ ] 8.1 測試註冊表單顯示
  - [ ] 8.2 測試表單驗證邏輯
  - [ ] 8.3 測試成功註冊流程
  - [ ] 8.4 測試電子郵件重複處理
  - [ ] 8.5 測試密碼加密存儲
  - [ ] 8.6 測試驗證郵件發送

---

## Dev Notes

### 技術棧

| 技術 | 版本 | 用途 |
|------|------|------|
| bcryptjs | ^2.4.3 | 密碼加密 |
| nodemailer | ^6.9.x | 郵件發送 |
| React Hook Form | 現有 | 表單管理 |
| Zod | 現有 | 驗證 Schema |

### 依賴項

此 Story 依賴：
- Prisma ORM 配置（已完成）
- shadcn/ui 組件（已完成）
- next-intl 國際化（已完成）

### Project Structure Notes

#### 新增文件結構

```
src/
├── app/
│   └── [locale]/
│       └── (auth)/
│           └── auth/
│               └── register/
│                   └── page.tsx          # 註冊頁面
├── lib/
│   ├── password.ts                       # 密碼工具函數
│   └── email.ts                          # 郵件服務
├── validations/
│   └── auth.ts                           # 認證相關驗證 Schema
└── app/
    └── api/
        └── auth/
            └── register/
                └── route.ts              # 註冊 API 端點

messages/
├── en/
│   └── auth.json                         # 英文翻譯
├── zh-TW/
│   └── auth.json                         # 繁體中文翻譯
└── zh-CN/
    └── auth.json                         # 簡體中文翻譯
```

### Architecture Compliance

#### 密碼加密範例

```typescript
// src/lib/password.ts
import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 12

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

export function validatePasswordStrength(password: string): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters')
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain a lowercase letter')
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain an uppercase letter')
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain a number')
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}
```

#### 註冊 API 範例

```typescript
// src/app/api/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, validatePasswordStrength } from '@/lib/password'
import { sendVerificationEmail } from '@/lib/email'
import { generateToken } from '@/lib/token'
import { z } from 'zod'

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = registerSchema.parse(body)

    // 檢查密碼強度
    const passwordCheck = validatePasswordStrength(validatedData.password)
    if (!passwordCheck.isValid) {
      return NextResponse.json(
        { error: 'Password does not meet requirements', details: passwordCheck.errors },
        { status: 400 }
      )
    }

    // 檢查電子郵件是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      )
    }

    // 加密密碼
    const hashedPassword = await hashPassword(validatedData.password)

    // 產生驗證 Token
    const verificationToken = generateToken(64)
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // 建立用戶
    const user = await prisma.user.create({
      data: {
        name: validatedData.name,
        email: validatedData.email,
        password: hashedPassword,
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
        status: 'ACTIVE',
      },
    })

    // 指派預設角色
    const defaultRole = await prisma.role.findFirst({
      where: { name: 'Data Processor' },
    })

    if (defaultRole) {
      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: defaultRole.id,
        },
      })
    }

    // 發送驗證郵件
    await sendVerificationEmail(user.email, user.name, verificationToken)

    return NextResponse.json(
      { message: 'Registration successful. Please check your email to verify your account.' },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    )
  }
}
```

### Testing Requirements

#### 本次 Story 驗證標準

| 驗證項目 | 測試方法 | 預期結果 |
|---------|---------|---------|
| 註冊頁面顯示 | 訪問 /auth/register | 顯示註冊表單 |
| 表單驗證 | 輸入無效資料 | 顯示驗證錯誤訊息 |
| 密碼強度 | 輸入弱密碼 | 顯示密碼要求提示 |
| 成功註冊 | 填寫有效資料提交 | 建立用戶並重導向 |
| 重複郵件 | 使用已存在的郵件註冊 | 顯示「已被註冊」錯誤 |
| 密碼加密 | 檢查資料庫 | 密碼為 bcrypt hash |
| 驗證郵件 | 註冊後檢查信箱 | 收到驗證郵件 |

### References

- [bcryptjs Documentation](https://github.com/dcodeIO/bcrypt.js)
- [Nodemailer Documentation](https://nodemailer.com/)
- [NextAuth Credentials Provider](https://authjs.dev/getting-started/providers/credentials)

---

## Dev Agent Record

### Context Reference

- Architecture: `docs/02-architecture/sections/`
- Epic: `docs/04-implementation/stories/epic-18-local-auth/epic-18-overview.md`
- Related: Story 1-1 (Azure AD SSO)

### File List

**Expected Files to Create/Modify:**

| 文件 | 操作 | 說明 |
|------|------|------|
| `prisma/schema.prisma` | 修改 | 新增驗證 Token 欄位 |
| `src/lib/password.ts` | 新增 | 密碼工具函數 |
| `src/lib/email.ts` | 新增 | 郵件服務 |
| `src/lib/token.ts` | 新增 | Token 產生工具 |
| `src/validations/auth.ts` | 新增 | 註冊驗證 Schema |
| `src/app/api/auth/register/route.ts` | 新增 | 註冊 API |
| `src/app/[locale]/(auth)/auth/register/page.tsx` | 新增 | 註冊頁面 |
| `src/components/features/auth/RegisterForm.tsx` | 新增 | 註冊表單組件 |
| `messages/*/auth.json` | 新增 | 翻譯文件 |
| `.env.example` | 修改 | 新增郵件配置 |

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 18.1 |
| Story Key | 18-1-user-registration |
| Epic | Epic 18: 本地帳號認證系統 |
| Estimated Effort | 1.5 天 |
| Dependencies | Prisma ORM, shadcn/ui, next-intl |
| Blocking | Story 18-2 (本地帳號登入) |

---

*Story created: 2026-01-19*
*Status: ready-for-dev*
*Generated by: Claude AI Assistant*
