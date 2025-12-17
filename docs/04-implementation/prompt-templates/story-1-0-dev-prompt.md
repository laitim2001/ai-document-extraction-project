# AI 助手開發指令：Story 1-0 專案初始化

> **使用說明**: 將此文件內容複製並提供給 AI 助手，作為開發 Story 1-0 的完整指引。

---

## 開發任務

**Story**: 1-0 專案初始化與基礎架構設定 (Project Init Foundation)
**Epic**: Epic 1 - 用戶認證與存取控制
**狀態**: ready-for-dev
**優先級**: 最高 (所有後續 Story 的前置條件)

---

## 第一步：載入專案上下文

請依序閱讀以下文件，了解專案背景和技術要求：

### 必讀文件 (按順序)

1. **專案整體上下文**
   - 路徑: `docs/04-implementation/implementation-context.md`
   - 內容: 核心使命、設計決策、編碼慣例、數據模型

2. **Story 需求定義**
   - 路徑: `docs/04-implementation/stories/1-0-project-init-foundation.md`
   - 內容: User Story、Acceptance Criteria、Tasks

3. **技術規格**
   - 路徑: `docs/04-implementation/tech-specs/epic-01-auth/tech-spec-story-1-0.md`
   - 內容: 詳細實作步驟、命令、程式碼範例

### 參考文件 (開發時查閱)

- `docs/04-implementation/dev-checklist.md` - 開發檢查清單
- `docs/04-implementation/component-registry.md` - 元件註冊表
- `docs/04-implementation/api-registry.md` - API 註冊表

---

## 第二步：確認開發目標

### Story 概述

**As a** 開發團隊
**I want** 使用標準化的 Next.js 專案結構初始化專案
**So that** 後續開發可以在一致的技術棧上進行

### Acceptance Criteria 摘要

| AC | 描述 | 驗證方式 |
|----|------|----------|
| AC1 | Next.js 15.x + TypeScript 嚴格模式 | `npm run build` 成功 |
| AC2 | shadcn/ui 初始化 + 10 個基礎元件 | 元件檔案存在於 `src/components/ui/` |
| AC3 | 標準目錄結構 | 所有必要目錄已建立 |
| AC4 | Prisma ORM + PostgreSQL | `npx prisma generate` 成功 |

---

## 第三步：執行開發任務

### 任務清單

請按照 Tech Spec 中的 Phase 1-9 依序執行：

```
Phase 1: Project Creation (專案建立)
Phase 2: UI Framework Setup (UI 框架設定)
Phase 3: Directory Structure (目錄結構)
Phase 4: Prisma Setup (Prisma 設定)
Phase 5: Additional Dependencies (額外依賴)
Phase 6: Configuration Files (配置檔案)
Phase 7: Docker Setup (Docker 設定)
Phase 8: Initialize Database (資料庫初始化)
Phase 9: Create Base Pages (建立基礎頁面)
```

### 關鍵命令序列

```bash
# 1. 建立 Next.js 專案
npx create-next-app@latest ai-document-extraction \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"

# 2. 進入專案目錄
cd ai-document-extraction

# 3. 初始化 shadcn/ui
npx shadcn@latest init

# 4. 安裝基礎 UI 元件
npx shadcn@latest add button card table dialog toast form input label badge tabs

# 5. 安裝 Prisma
npm install prisma @prisma/client
npx prisma init

# 6. 安裝其他依賴
npm install zustand @tanstack/react-query zod react-hook-form @hookform/resolvers

# 7. 啟動 Docker PostgreSQL
docker-compose up -d

# 8. 初始化資料庫
npx prisma generate
npx prisma migrate dev --name init
```

---

## 第四步：遵循編碼規範

### 命名規範 (強制)

| 類別 | 規範 | 範例 |
|------|------|------|
| Prisma Model | PascalCase 單數 | `User`, `Role` |
| Prisma Field | camelCase + @map snake_case | `azureAdId @map("azure_ad_id")` |
| Enum Value | SCREAMING_SNAKE_CASE | `ACTIVE`, `INACTIVE` |
| React Component | PascalCase | `InvoiceList.tsx` |
| API Route | kebab-case | `/api/invoices/[id]` |

### Prisma Schema 規範

```prisma
// ✅ 正確
model User {
  id        String     @id @default(uuid())
  email     String     @unique
  name      String
  azureAdId String?    @unique @map("azure_ad_id")
  status    UserStatus @default(ACTIVE)
  createdAt DateTime   @default(now()) @map("created_at")
  updatedAt DateTime   @updatedAt @map("updated_at")

  roles UserRole[]

  @@map("users")
}

// ❌ 錯誤 - 不要這樣做
model user {
  ID        String @id
  AzureADId String
  created_at DateTime
}
```

---

## 第五步：驗證完成

### 驗證命令

| 命令 | 預期結果 |
|------|----------|
| `npm run dev` | 伺服器啟動於 localhost:3000 |
| `npm run build` | 無錯誤完成編譯 |
| `npm run lint` | 無 ESLint 錯誤 |
| `npx tsc --noEmit` | 無 TypeScript 錯誤 |
| `docker-compose ps` | postgres 容器運行中 |
| `npx prisma generate` | 客戶端生成成功 |
| `npx prisma studio` | 可開啟資料庫瀏覽器 |

### 檔案結構驗證

確認以下檔案/目錄存在：

```
ai-document-extraction/
├── docker-compose.yml          ✓
├── .env.example                ✓
├── .prettierrc                 ✓
├── components.json             ✓
├── prisma/
│   └── schema.prisma           ✓
├── src/
│   ├── app/
│   │   ├── layout.tsx          ✓
│   │   ├── page.tsx            ✓
│   │   └── globals.css         ✓
│   ├── components/
│   │   └── ui/
│   │       ├── button.tsx      ✓
│   │       ├── card.tsx        ✓
│   │       └── ... (10 個元件) ✓
│   └── lib/
│       ├── prisma.ts           ✓
│       └── utils.ts            ✓
└── tests/
    ├── unit/                   ✓
    ├── integration/            ✓
    └── e2e/                    ✓
```

---

## 第六步：完成後更新文件

### 更新 component-registry.md

如果有新增或修改元件，請更新：
`docs/04-implementation/component-registry.md`

### 更新 lessons-learned.md

如果遇到值得記錄的問題或發現，請更新：
`docs/04-implementation/lessons-learned.md`

### Story 狀態更新

完成後，將 `sprint-status.yaml` 中的狀態從 `ready-for-dev` 更新為 `done`。

---

## 注意事項

### ⛔ 不要這樣做

1. **不要跳過 TypeScript 嚴格模式** - 必須啟用 `strict: true`
2. **不要使用 Pages Router** - 必須使用 App Router
3. **不要手動修改 shadcn/ui 元件** - 保持原始狀態
4. **不要在 .env.local 中提交敏感資訊** - 只提交 .env.example

### ✅ 最佳實踐

1. 每完成一個 Phase 就執行驗證
2. 遇到錯誤時先查看 Troubleshooting 章節
3. 保持 commit 的原子性（每個 Phase 一個 commit）
4. 使用 Docker 確保資料庫環境一致性

---

## 下一步

Story 1-0 完成後，繼續開發：
- **Story 1-1**: Azure AD SSO 登入
- **Story 1-2**: 使用者資料庫與角色基礎

---

*範本版本: 1.0*
*建立日期: 2025-12-17*
*適用於: AI Document Extraction Project*
