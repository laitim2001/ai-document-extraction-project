# Story 1.0: 專案初始化與基礎架構設定

**Status:** ready-for-dev

---

## Story

**As a** 開發團隊,
**I want** 使用標準化的 Next.js 專案結構初始化專案,
**So that** 後續開發可以在一致的技術棧上進行。

---

## Acceptance Criteria

### AC1: Next.js 專案初始化

**Given** 專案需要初始化
**When** 執行初始化腳本
**Then** 使用 create-next-app 創建專案：
- TypeScript 5.x 嚴格模式
- Tailwind CSS 配置
- ESLint 配置
- App Router 模式
- src/ 目錄結構

### AC2: UI 框架初始化

**Given** 專案創建完成
**When** 初始化 UI 框架
**Then** 執行 shadcn/ui 初始化
**And** 安裝基礎 UI 組件：
- button
- card
- table
- dialog
- toast
- form
- input
- label
- badge
- tabs

### AC3: 專案目錄結構

**Given** UI 框架初始化完成
**When** 配置專案基礎結構
**Then** 創建以下目錄結構：
- `src/app/` - 頁面路由
- `src/components/` - 可重用組件
- `src/lib/` - 工具函數
- `src/services/` - API 服務層
- `src/types/` - TypeScript 類型定義

### AC4: 開發環境配置

**Given** 專案結構完成
**When** 配置開發環境
**Then** 設定環境變數模板（.env.example）
**And** 配置 Prisma ORM 連接 PostgreSQL
**And** 創建初始 Prisma Schema

---

## Tasks / Subtasks

- [ ] **Task 1: Next.js 專案初始化** (AC: #1)
  - [ ] 1.1 執行 `npx create-next-app@latest` 創建專案
  - [ ] 1.2 驗證 TypeScript 5.x 嚴格模式配置
  - [ ] 1.3 驗證 App Router 啟用
  - [ ] 1.4 驗證 src/ 目錄結構正確

- [ ] **Task 2: shadcn/ui 初始化** (AC: #2)
  - [ ] 2.1 執行 `npx shadcn@latest init`
  - [ ] 2.2 安裝 10 個基礎 UI 組件
  - [ ] 2.3 驗證 components.json 配置正確

- [ ] **Task 3: 專案目錄結構建立** (AC: #3)
  - [ ] 3.1 創建 `src/components/ui/` 目錄
  - [ ] 3.2 創建 `src/components/features/` 目錄
  - [ ] 3.3 創建 `src/components/layouts/` 目錄
  - [ ] 3.4 創建 `src/lib/` 目錄
  - [ ] 3.5 創建 `src/services/` 目錄
  - [ ] 3.6 創建 `src/types/` 目錄
  - [ ] 3.7 創建 `src/hooks/` 目錄
  - [ ] 3.8 創建 `src/stores/` 目錄

- [ ] **Task 4: Prisma ORM 配置** (AC: #4)
  - [ ] 4.1 安裝 Prisma 依賴 (`prisma`, `@prisma/client`)
  - [ ] 4.2 執行 `npx prisma init`
  - [ ] 4.3 創建初始 Schema（User, Role 基礎模型）
  - [ ] 4.4 創建 `src/lib/prisma.ts` 單例模式

- [ ] **Task 5: 環境變數配置** (AC: #4)
  - [ ] 5.1 創建 `.env.example` 模板
  - [ ] 5.2 創建 `.env.local` 本地環境變數
  - [ ] 5.3 更新 `.gitignore` 確保安全

- [ ] **Task 6: ESLint 與 Prettier 配置** (AC: #1)
  - [ ] 6.1 配置 ESLint 規則
  - [ ] 6.2 配置 Prettier 規則
  - [ ] 6.3 設定 @/* 路徑別名

- [ ] **Task 7: 驗證與測試** (AC: #1-4)
  - [ ] 7.1 執行 `npm run dev` 驗證開發伺服器
  - [ ] 7.2 執行 `npm run build` 驗證編譯成功
  - [ ] 7.3 執行 `npm run lint` 驗證無錯誤

---

## Dev Notes

### 技術棧版本要求

| 技術 | 版本 | 來源 |
|------|------|------|
| Next.js | 15.x | [Source: docs/02-architecture/sections/starter-template-evaluation.md] |
| React | 19.x | [Source: docs/02-architecture/sections/starter-template-evaluation.md] |
| TypeScript | 5.x (嚴格模式) | [Source: docs/03-epics/sections/epic-1-user-auth-access-control.md] |
| Tailwind CSS | 最新穩定版 | [Source: docs/02-architecture/sections/starter-template-evaluation.md] |
| shadcn/ui | 最新穩定版 | [Source: docs/02-architecture/sections/starter-template-evaluation.md] |
| Prisma | 最新穩定版 | [Source: docs/02-architecture/sections/core-architecture-decisions.md] |

### 初始化命令序列

```bash
# Step 1: 創建 Next.js 專案
npx create-next-app@latest ai-document-extraction \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"

# Step 2: 進入專案目錄
cd ai-document-extraction

# Step 3: shadcn/ui 初始化
npx shadcn@latest init

# Step 4: 安裝基礎 UI 組件
npx shadcn@latest add button card table dialog toast form input label badge tabs

# Step 5: 安裝 Prisma
npm install prisma @prisma/client
npx prisma init

# Step 6: 安裝其他依賴
npm install zustand @tanstack/react-query zod react-hook-form @hookform/resolvers
```

### Project Structure Notes

#### 完整目錄結構規範

```
ai-document-extraction/
├── prisma/
│   ├── schema.prisma           # 資料庫 Schema
│   ├── migrations/             # 遷移文件
│   └── seed.ts                 # 種子數據（開發用）
├── public/
│   ├── assets/
│   │   ├── images/
│   │   └── icons/
│   └── locales/
│       ├── en.json
│       └── zh-TW.json
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── globals.css
│   │   ├── layout.tsx          # 根佈局
│   │   ├── page.tsx            # 首頁
│   │   ├── (auth)/             # 認證群組
│   │   ├── (dashboard)/        # 主功能群組
│   │   └── api/                # API Routes (BFF)
│   ├── components/
│   │   ├── ui/                 # shadcn/ui 組件
│   │   ├── features/           # 業務功能組件
│   │   └── layouts/            # 佈局組件
│   ├── lib/
│   │   ├── prisma.ts           # Prisma 客戶端單例
│   │   ├── utils.ts            # 工具函數
│   │   └── validations/        # Zod Schemas
│   ├── hooks/                  # 自定義 Hooks
│   ├── stores/                 # Zustand Stores
│   ├── services/               # 服務層
│   ├── types/                  # TypeScript 類型
│   └── middleware.ts           # Next.js 中間件
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .env.example
├── .env.local
├── .eslintrc.json
├── .prettierrc
├── components.json             # shadcn/ui 配置
├── next.config.js
├── package.json
├── tailwind.config.js
└── tsconfig.json
```

[Source: docs/02-architecture/sections/project-structure-boundaries.md]

### Architecture Compliance

#### Prisma Schema 命名規範

```prisma
// 模型使用 PascalCase 單數
model User { ... }
model Role { ... }

// 欄位使用 camelCase，資料庫欄位使用 snake_case + @map
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String
  azureAdId String?  @map("azure_ad_id")
  status    UserStatus @default(ACTIVE)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("users")
}

// 枚舉使用 PascalCase + SCREAMING_SNAKE_CASE 值
enum UserStatus {
  ACTIVE
  INACTIVE
}
```

[Source: docs/02-architecture/sections/implementation-patterns-consistency-rules.md]

#### Prisma 客戶端單例模式

```typescript
// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

[Source: docs/02-architecture/sections/implementation-patterns-consistency-rules.md]

### Library & Framework Requirements

#### 必須安裝的依賴

**核心依賴:**
- `next` - Next.js 框架
- `react`, `react-dom` - React 核心
- `typescript` - TypeScript 支援

**UI 相關:**
- `tailwindcss`, `postcss`, `autoprefixer` - Tailwind CSS
- `class-variance-authority`, `clsx`, `tailwind-merge` - shadcn/ui 依賴
- `lucide-react` - 圖標庫

**資料管理:**
- `prisma`, `@prisma/client` - ORM
- `zustand` - 客戶端狀態管理
- `@tanstack/react-query` - 伺服器狀態管理

**表單與驗證:**
- `zod` - Schema 驗證
- `react-hook-form` - 表單處理
- `@hookform/resolvers` - Zod 整合

**開發工具:**
- `eslint`, `eslint-config-next` - Linting
- `prettier` - 格式化
- `@types/node`, `@types/react`, `@types/react-dom` - 類型定義

### File Structure Requirements

#### 初始 Prisma Schema 模板

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ===========================================
// User & Role Models (Story 1.0 Foundation)
// ===========================================

model User {
  id        String     @id @default(uuid())
  email     String     @unique
  name      String
  azureAdId String?    @unique @map("azure_ad_id")
  status    UserStatus @default(ACTIVE)
  createdAt DateTime   @default(now()) @map("created_at")
  updatedAt DateTime   @updatedAt @map("updated_at")

  roles     UserRole[]

  @@map("users")
}

model Role {
  id          String    @id @default(uuid())
  name        String    @unique
  description String?
  permissions String[]  // JSON array of permission strings
  isSystem    Boolean   @default(false) @map("is_system")
  createdAt   DateTime  @default(now()) @map("created_at")

  users       UserRole[]

  @@map("roles")
}

model UserRole {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  roleId    String   @map("role_id")
  createdAt DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  role Role @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@unique([userId, roleId])
  @@map("user_roles")
}

enum UserStatus {
  ACTIVE
  INACTIVE
}
```

#### 環境變數模板

```bash
# .env.example

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/ai_document_extraction?schema=public"

# Next.js
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Azure AD (將在 Story 1.1 配置)
# AZURE_AD_CLIENT_ID=""
# AZURE_AD_CLIENT_SECRET=""
# AZURE_AD_TENANT_ID=""

# NextAuth (將在 Story 1.1 配置)
# NEXTAUTH_URL=""
# NEXTAUTH_SECRET=""
```

### Testing Requirements

#### 本次 Story 驗證標準

| 驗證項目 | 命令 | 預期結果 |
|---------|------|---------|
| 開發伺服器 | `npm run dev` | 成功啟動於 localhost:3000 |
| 編譯檢查 | `npm run build` | 無錯誤完成編譯 |
| Lint 檢查 | `npm run lint` | 無 ESLint 錯誤 |
| TypeScript | `npx tsc --noEmit` | 無類型錯誤 |
| Prisma 生成 | `npx prisma generate` | 成功生成客戶端 |

### References

- [Source: docs/02-architecture/sections/starter-template-evaluation.md] - 技術棧選擇依據
- [Source: docs/02-architecture/sections/core-architecture-decisions.md] - 核心架構決策
- [Source: docs/02-architecture/sections/implementation-patterns-consistency-rules.md] - 命名與模式規範
- [Source: docs/02-architecture/sections/project-structure-boundaries.md] - 完整目錄結構
- [Source: docs/03-epics/sections/epic-1-user-auth-access-control.md#story-10] - Story 需求定義

---

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->
- Architecture: `docs/02-architecture/sections/`
- Epic: `docs/03-epics/sections/epic-1-user-auth-access-control.md`
- PRD: `docs/01-planning/prd/sections/`

### Agent Model Used

<!-- Will be filled by Dev Agent -->

### Debug Log References

<!-- Will be filled during implementation -->

### Completion Notes List

<!-- Will be filled after implementation -->

### File List

**Expected Files to Create/Modify:**
- `package.json` - 依賴配置
- `tsconfig.json` - TypeScript 配置
- `tailwind.config.js` - Tailwind 配置
- `next.config.js` - Next.js 配置
- `components.json` - shadcn/ui 配置
- `.eslintrc.json` - ESLint 配置
- `.prettierrc` - Prettier 配置
- `.env.example` - 環境變數模板
- `.gitignore` - Git 忽略規則
- `prisma/schema.prisma` - 資料庫 Schema
- `src/lib/prisma.ts` - Prisma 客戶端單例
- `src/lib/utils.ts` - 工具函數
- `src/app/layout.tsx` - 根佈局
- `src/app/page.tsx` - 首頁
- `src/app/globals.css` - 全域樣式

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 1.0 |
| Story Key | 1-0-project-init-foundation |
| Epic | Epic 1: 用戶認證與存取控制 |
| FR Coverage | 基礎架構（技術前置條件） |
| Estimated Effort | 中 |
| Dependencies | 無 |
| Blocking | Story 1.1, 1.2 及所有後續 Stories |

---

*Story created: 2025-12-15*
*Status: ready-for-dev*
*Generated by: BMAD Method - Create Story Workflow*
