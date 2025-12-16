# Story 1.1: Azure AD SSO 登入

**Status:** ready-for-dev

---

## Story

**As a** 系統用戶,
**I want** 使用公司的 Azure AD 帳戶登入系統,
**So that** 我可以使用單一身份驗證安全地存取系統。

---

## Acceptance Criteria

### AC1: Azure AD 登入流程

**Given** 用戶尚未登入系統
**When** 用戶點擊「使用 Microsoft 登入」按鈕
**Then** 系統重導向至 Azure AD 登入頁面
**And** 成功驗證後，用戶被重導向回系統首頁
**And** 系統顯示用戶的名稱和頭像

### AC2: Session 超時處理

**Given** 用戶已登入系統
**When** Session 超過 8 小時
**Then** 系統自動登出用戶
**And** 重導向至登入頁面

### AC3: 閒置超時處理

**Given** 用戶已登入但閒置超過 30 分鐘
**When** 用戶嘗試進行任何操作
**Then** 系統要求重新驗證

---

## Tasks / Subtasks

- [ ] **Task 1: NextAuth v5 配置** (AC: #1)
  - [ ] 1.1 安裝 NextAuth v5 依賴 (`next-auth@beta`)
  - [ ] 1.2 創建 `src/lib/auth.ts` NextAuth 配置文件
  - [ ] 1.3 配置 Azure AD Provider
  - [ ] 1.4 創建 `src/app/api/auth/[...nextauth]/route.ts` API Route

- [ ] **Task 2: Azure AD 環境變數配置** (AC: #1)
  - [ ] 2.1 更新 `.env.example` 加入 Azure AD 變數
  - [ ] 2.2 配置 `AZURE_AD_CLIENT_ID`
  - [ ] 2.3 配置 `AZURE_AD_CLIENT_SECRET`
  - [ ] 2.4 配置 `AZURE_AD_TENANT_ID`
  - [ ] 2.5 配置 `NEXTAUTH_URL` 和 `NEXTAUTH_SECRET`

- [ ] **Task 3: User 資料表創建** (AC: #1)
  - [ ] 3.1 更新 Prisma Schema 加入完整 User 模型
  - [ ] 3.2 加入 `azureAdId` 欄位（unique）
  - [ ] 3.3 加入 `status` 欄位（UserStatus enum）
  - [ ] 3.4 執行 Prisma 遷移

- [ ] **Task 4: Session 管理配置** (AC: #2, #3)
  - [ ] 4.1 配置 JWT Session 策略
  - [ ] 4.2 設定 Session 最大存活時間（8 小時）
  - [ ] 4.3 實現 Session 回調處理用戶資料

- [ ] **Task 5: 登入頁面 UI** (AC: #1)
  - [ ] 5.1 創建 `src/app/(auth)/login/page.tsx`
  - [ ] 5.2 創建 `src/app/(auth)/layout.tsx` 認證佈局
  - [ ] 5.3 實現「使用 Microsoft 登入」按鈕
  - [ ] 5.4 加入載入狀態和錯誤處理

- [ ] **Task 6: 認證中間件** (AC: #1, #2, #3)
  - [ ] 6.1 更新 `src/middleware.ts` 保護路由
  - [ ] 6.2 配置公開路由白名單
  - [ ] 6.3 實現未認證重導向邏輯

- [ ] **Task 7: 用戶首次登入處理** (AC: #1)
  - [ ] 7.1 實現 signIn 回調檢查用戶是否存在
  - [ ] 7.2 自動創建新用戶記錄（首次登入）
  - [ ] 7.3 同步 Azure AD 用戶資料（name, email, avatar）

- [ ] **Task 8: 登出功能** (AC: #2)
  - [ ] 8.1 實現登出 API 端點
  - [ ] 8.2 創建登出 UI 組件
  - [ ] 8.3 清除 Session 和本地狀態

- [ ] **Task 9: 錯誤頁面** (AC: #1)
  - [ ] 9.1 創建 `src/app/(auth)/error/page.tsx`
  - [ ] 9.2 處理認證錯誤類型顯示
  - [ ] 9.3 提供返回登入選項

- [ ] **Task 10: 驗證與測試** (AC: #1-3)
  - [ ] 10.1 測試完整登入流程
  - [ ] 10.2 測試 Session 超時行為
  - [ ] 10.3 測試受保護路由重導向
  - [ ] 10.4 測試登出流程

---

## Dev Notes

### 技術棧版本要求

| 技術 | 版本 | 來源 |
|------|------|------|
| NextAuth | v5 (beta) | [Source: docs/02-architecture/sections/core-architecture-decisions.md] |
| Azure AD Provider | NextAuth 內建 | [Source: docs/02-architecture/sections/core-architecture-decisions.md] |
| Session 策略 | JWT（無狀態） | [Source: docs/02-architecture/sections/core-architecture-decisions.md] |

### 依賴項（Story 1.0）

此 Story 依賴 Story 1.0 完成的：
- Next.js 專案基礎結構
- Prisma ORM 配置
- shadcn/ui 組件（button, card）

### Project Structure Notes

#### 認證相關文件結構

```
src/
├── app/
│   ├── (auth)/                     # 認證群組（無導航）
│   │   ├── layout.tsx              # 認證頁面佈局
│   │   ├── login/
│   │   │   └── page.tsx            # 登入頁面
│   │   └── error/
│   │       └── page.tsx            # 認證錯誤頁面
│   └── api/
│       └── auth/
│           └── [...nextauth]/
│               └── route.ts        # NextAuth API 端點
├── lib/
│   └── auth.ts                     # NextAuth 配置
└── middleware.ts                   # 路由保護中間件
```

[Source: docs/02-architecture/sections/project-structure-boundaries.md]

### Architecture Compliance

#### NextAuth v5 配置範例

```typescript
// src/lib/auth.ts
import NextAuth from "next-auth"
import AzureADProvider from "next-auth/providers/azure-ad"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AD_TENANT_ID!,
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      // 首次登入自動創建用戶
      if (account?.provider === "azure-ad") {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email! },
        })

        if (!existingUser) {
          await prisma.user.create({
            data: {
              email: user.email!,
              name: user.name!,
              azureAdId: profile?.sub,
              status: "ACTIVE",
            },
          })
        }
      }
      return true
    },
    async session({ session, token }) {
      if (token.sub && session.user) {
        session.user.id = token.sub
      }
      return session
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
  },
  pages: {
    signIn: "/login",
    error: "/error",
  },
})
```

[Source: docs/02-architecture/sections/core-architecture-decisions.md]

#### API Route 配置

```typescript
// src/app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/lib/auth"

export const { GET, POST } = handlers
```

#### Middleware 配置

```typescript
// src/middleware.ts
import { auth } from "@/lib/auth"

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isAuthPage = req.nextUrl.pathname.startsWith("/login") ||
                     req.nextUrl.pathname.startsWith("/error")
  const isApiAuthRoute = req.nextUrl.pathname.startsWith("/api/auth")
  const isPublicRoute = req.nextUrl.pathname === "/" ||
                        req.nextUrl.pathname.startsWith("/api/health")

  // 允許 API auth 路由
  if (isApiAuthRoute) {
    return
  }

  // 已登入用戶訪問認證頁面，重導向到儀表板
  if (isLoggedIn && isAuthPage) {
    return Response.redirect(new URL("/dashboard", req.nextUrl))
  }

  // 未登入用戶訪問受保護路由，重導向到登入頁
  if (!isLoggedIn && !isAuthPage && !isPublicRoute) {
    return Response.redirect(new URL("/login", req.nextUrl))
  }
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
```

### Library & Framework Requirements

#### 必須安裝的額外依賴

```bash
# NextAuth v5
npm install next-auth@beta @auth/prisma-adapter

# 需要更新 Prisma Schema 以支援 NextAuth
# 參考: https://authjs.dev/reference/adapter/prisma
```

#### Prisma Schema 更新

```prisma
// prisma/schema.prisma - 新增/更新內容

model User {
  id            String     @id @default(uuid())
  email         String     @unique
  name          String
  image         String?    // Azure AD 頭像 URL
  azureAdId     String?    @unique @map("azure_ad_id")
  emailVerified DateTime?  @map("email_verified")
  status        UserStatus @default(ACTIVE)
  createdAt     DateTime   @default(now()) @map("created_at")
  updatedAt     DateTime   @updatedAt @map("updated_at")

  accounts      Account[]
  sessions      Session[]
  roles         UserRole[]

  @@map("users")
}

// NextAuth 必要的 Account 模型
model Account {
  id                String  @id @default(uuid())
  userId            String  @map("user_id")
  type              String
  provider          String
  providerAccountId String  @map("provider_account_id")
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("accounts")
}

// NextAuth 必要的 Session 模型（JWT 模式下可選）
model Session {
  id           String   @id @default(uuid())
  sessionToken String   @unique @map("session_token")
  userId       String   @map("user_id")
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("sessions")
}
```

### File Structure Requirements

#### 環境變數模板更新

```bash
# .env.example - 新增內容

# Azure AD Configuration
AZURE_AD_CLIENT_ID="your-client-id"
AZURE_AD_CLIENT_SECRET="your-client-secret"
AZURE_AD_TENANT_ID="your-tenant-id"

# NextAuth Configuration
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-generate-with-openssl-rand-base64-32"
```

### Testing Requirements

#### 本次 Story 驗證標準

| 驗證項目 | 測試方法 | 預期結果 |
|---------|---------|---------|
| 登入按鈕 | 點擊「使用 Microsoft 登入」 | 重導向至 Azure AD 登入頁面 |
| 登入成功 | 完成 Azure AD 驗證 | 重導向回應用並顯示用戶資訊 |
| 受保護路由 | 未登入訪問 /dashboard | 重導向至 /login |
| Session 持續 | 登入後刷新頁面 | 維持登入狀態 |
| 登出功能 | 點擊登出按鈕 | 清除 Session，重導向至登入頁 |
| 用戶創建 | 首次 Azure AD 登入 | 自動創建 User 記錄 |

#### 手動測試流程

1. **登入測試**
   - 訪問 `/login`
   - 點擊「使用 Microsoft 登入」
   - 完成 Azure AD 認證
   - 驗證重導向回應用
   - 檢查用戶名稱和頭像顯示

2. **Session 測試**
   - 登入後關閉瀏覽器
   - 重新開啟訪問應用
   - 驗證是否維持登入狀態

3. **登出測試**
   - 登入狀態下點擊登出
   - 驗證重導向至登入頁
   - 嘗試訪問受保護路由
   - 驗證被重導向至登入頁

### References

- [Source: docs/02-architecture/sections/core-architecture-decisions.md#認證與安全] - Azure AD 整合決策
- [Source: docs/02-architecture/sections/implementation-patterns-consistency-rules.md] - 命名與模式規範
- [Source: docs/02-architecture/sections/project-structure-boundaries.md] - 目錄結構
- [Source: docs/03-epics/sections/epic-1-user-auth-access-control.md#story-11] - Story 需求定義
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR36] - 功能需求 FR36

---

## Dev Agent Record

### Context Reference

- Architecture: `docs/02-architecture/sections/`
- Epic: `docs/03-epics/sections/epic-1-user-auth-access-control.md`
- PRD: `docs/01-planning/prd/sections/`
- Previous Story: `docs/04-implementation/stories/1-0-project-init-foundation.md`

### Agent Model Used

<!-- Will be filled by Dev Agent -->

### Debug Log References

<!-- Will be filled during implementation -->

### Completion Notes List

<!-- Will be filled after implementation -->

### File List

**Expected Files to Create/Modify:**
- `src/lib/auth.ts` - NextAuth 配置
- `src/app/api/auth/[...nextauth]/route.ts` - NextAuth API Route
- `src/app/(auth)/layout.tsx` - 認證佈局
- `src/app/(auth)/login/page.tsx` - 登入頁面
- `src/app/(auth)/error/page.tsx` - 錯誤頁面
- `src/middleware.ts` - 路由保護中間件
- `prisma/schema.prisma` - 更新 User、Account、Session 模型
- `.env.example` - 更新環境變數模板

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 1.1 |
| Story Key | 1-1-azure-ad-sso-login |
| Epic | Epic 1: 用戶認證與存取控制 |
| FR Coverage | FR36 |
| Estimated Effort | 中-高 |
| Dependencies | Story 1.0 (專案初始化) |
| Blocking | Story 1.2 及後續認證相關 Stories |

---

*Story created: 2025-12-15*
*Status: ready-for-dev*
*Generated by: BMAD Method - Create Story Workflow*
