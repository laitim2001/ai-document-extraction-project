# AI Document Extraction Project - Claude Code 開發指引

> 本文件為 Claude Code AI 助手的開發指引，自動作為 system prompt 載入。

---

## 項目概覽

### 項目使命

建立一套 AI 驅動的文件內容提取與自動分類系統，專門解決 SCM 部門處理 Freight Invoice 的效率問題。

### 核心目標

- **年處理量**: 450,000-500,000 張發票（APAC 地區）
- **自動化率**: 90-95%
- **準確率**: 90-95%
- **節省人時**: 35,000-40,000 人時/年

### 核心架構 - 三層映射系統

```
┌─────────────────────────────────────────────────────────────────┐
│ TIER 1: Universal Mapping（通用層）                              │
│ • 覆蓋 70-80% 常見術語，所有 Forwarder 通用                      │
│ • 維護成本：低（只需維護一份）                                   │
├─────────────────────────────────────────────────────────────────┤
│ TIER 2: Forwarder-Specific Override（特定覆蓋層）                │
│ • 只記錄該 Forwarder 與通用規則「不同」的映射                    │
│ • 維護成本：中（每個 Forwarder 只需記錄差異）                    │
├─────────────────────────────────────────────────────────────────┤
│ TIER 3: LLM Classification（AI 智能分類）                        │
│ • 當以上都無法匹配時，使用 GPT-4o 智能分類                       │
│ • 可處理從未見過的新術語                                         │
└─────────────────────────────────────────────────────────────────┘
```

### 信心度路由機制

| 信心度範圍 | 處理方式     | 說明                          |
| ---------- | ------------ | ----------------------------- |
| ≥ 90%      | AUTO_APPROVE | 自動通過，無需人工介入        |
| 70-89%     | QUICK_REVIEW | 快速人工確認（一鍵確認/修正） |
| < 70%      | FULL_REVIEW  | 完整人工審核（詳細檢查）      |

---

## 技術棧

### 核心框架

- **前端**: Next.js 15.0.0 (App Router) + TypeScript 5.0 + React 18.3
- **樣式**: Tailwind CSS 3.4 + shadcn/ui (Radix UI 20+ primitives)
- **資料庫**: PostgreSQL 15 + Prisma ORM 7.2 (117 models)
- **狀態管理**: Zustand 5.x (UI) + React Query 5.x (Server State)
- **表單**: React Hook Form 7.x + Zod 4.x 驗證
- **國際化**: next-intl 4.7 (支援 en, zh-TW, zh-CN，30 個命名空間)
- **快取**: @upstash/redis
- **拖放**: @dnd-kit (sortable UI)

### 外部服務

- **OCR**: Azure Document Intelligence
- **AI**: Azure OpenAI GPT-5.2 + OpenAI SDK
- **認證**: Azure AD (Entra ID) SSO + 本地帳號認證
- **工作流**: n8n
- **文件來源**: SharePoint / Outlook / Azure Blob Storage
- **Office 365**: Microsoft Graph Client

### 文件處理

- **PDF**: pdfjs-dist, pdf-parse, pdf-to-img, react-pdf, pdfkit
- **Excel**: ExcelJS (匯出功能)
- **Email**: Nodemailer (通知系統)

### 開發工具

- **容器化**: Docker Compose (PostgreSQL + pgAdmin + Azurite + Python OCR/Mapping)
- **代碼品質**: ESLint + Prettier
- **E2E 測試**: Playwright 1.57
- **套件管理**: npm

### 代碼規模概覽

| 指標 | 數量 | 說明 |
|------|------|------|
| React 組件 | 165+ | `src/components/` 下所有 `.tsx` |
| 業務服務 | 124+ | `src/services/` 下所有 `.ts` |
| API 路由文件 | 175+ | 每個 route.ts 處理多個 HTTP 方法，約 300+ 端點 |
| 自定義 Hooks | 89 | `src/hooks/` |
| Prisma Models | 117 | 資料庫模型定義 |
| i18n 命名空間 | 30/語言 | 3 種語言各 30 個 JSON 文件 |

---

## 目錄結構

```
ai-document-extraction-project/
│
├── .claude/                    # 🤖 Claude Code 配置
│   ├── rules/                  # 開發規範（9 個規則文件）
│   │   ├── general.md          # 通用開發規範
│   │   ├── typescript.md       # TypeScript 規範
│   │   ├── services.md         # 服務層規範
│   │   ├── api-design.md       # API 設計規範
│   │   ├── components.md       # 組件開發規範
│   │   ├── database.md         # 資料庫規範
│   │   ├── testing.md          # 測試規範
│   │   ├── i18n.md             # 國際化規範
│   │   └── technical-obstacles.md  # 技術障礙處理
│   ├── agents/                 # 🤖 自定義 AI Agent（8 個）
│   ├── skills/                 # ⚡ 自定義 Skill（4 個）
│   ├── commands/               # 🔧 BMAD 工作流命令
│   ├── settings.local.json     # 本地設定
│   └── CLAUDE.md               # 詳細操作指引（服務啟動等）
│
├── claudedocs/                 # 📚 AI 助手文檔目錄（見下方詳細說明）
│   ├── 1-planning/             # 規劃文檔（Epic 架構設計 + Plan docs）
│   ├── 2-sprints/              # Sprint 文檔
│   ├── 3-progress/             # 進度追蹤（日報/週報）
│   ├── 4-changes/              # 變更記錄（32 CHANGE + 35 FIX）
│   ├── 5-status/               # 狀態報告
│   ├── 6-ai-assistant/         # AI 助手相關（6 個 SITUATION 提示詞）
│   ├── 7-archive/              # 歸檔文檔
│   └── CLAUDE.md               # 目錄索引
│
├── docs/                       # 📖 項目正式文檔
│   ├── 00-discovery/           # 產品探索階段
│   ├── 01-planning/            # 規劃階段 (PRD, UX)
│   ├── 02-architecture/        # 架構設計
│   ├── 03-stories/             # 用戶故事
│   └── 04-implementation/      # 實施文檔
│
├── python-services/            # 🐍 Python 後端服務
│   ├── extraction/             # OCR 提取服務 (Azure DI + GPT Vision)
│   └── mapping/                # 映射邏輯服務
│
├── openapi/                    # 📄 OpenAPI 規格
│
├── messages/                   # 🌐 i18n 翻譯文件（30 命名空間/語言）
│   ├── en/                     # English 翻譯
│   ├── zh-TW/                  # 繁體中文翻譯
│   └── zh-CN/                  # 简体中文翻譯
│
├── prisma/                     # 🗄️ Prisma Schema（117 models）和遷移
├── public/                     # 靜態資源
├── scripts/                    # 工具腳本
│
├── src/                        # 💻 Next.js 源代碼
│   ├── app/                    # App Router 頁面
│   │   ├── [locale]/           # 🌐 i18n 動態路由
│   │   │   ├── (auth)/         # 認證相關頁面
│   │   │   └── (dashboard)/    # 儀表板頁面（25+ admin 頁面）
│   │   └── api/                # API 路由（175 route files, ~300 端點）
│   ├── components/             # React 組件（165+ 組件）
│   │   ├── ui/                 # shadcn/ui 基礎組件
│   │   ├── features/           # 功能組件（10+ 子目錄）
│   │   └── layout/             # 佈局組件
│   ├── config/                 # ⚙️ 應用配置
│   ├── constants/              # 📋 常數定義
│   ├── contexts/               # React Context 提供者
│   ├── events/                 # 事件處理系統
│   ├── hooks/                  # 自定義 Hooks（89 個）
│   ├── i18n/                   # 🌐 i18n 配置
│   │   ├── config.ts           # 語言配置常數
│   │   ├── routing.ts          # next-intl 路由配置
│   │   └── request.ts          # Server-side locale + 命名空間載入
│   ├── jobs/                   # 背景任務和排程
│   ├── lib/                    # 工具庫
│   │   └── validations/        # Zod 驗證 Schema（新標準位置）
│   ├── middlewares/            # 中間件
│   ├── providers/              # 應用程式提供者
│   ├── services/               # 業務邏輯服務層（124+ 服務）
│   │   └── extraction-v3/      # V3 提取管線（3-stage architecture）
│   │       ├── stages/         # Stage 1/2/3 服務
│   │       └── utils/          # 提取工具函數
│   ├── stores/                 # Zustand 狀態管理
│   ├── types/                  # TypeScript 類型定義
│   └── validations/            # Zod 驗證 Schema（舊位置，漸遷至 lib/）
│
├── tests/                      # 🧪 測試文件
│   ├── unit/                   # 單元測試
│   ├── integration/            # 整合測試
│   └── e2e/                    # 端到端測試
│
├── .github/                    # GitHub Actions CI/CD
├── .bmad/                      # BMAD 工作流配置
└── .vscode/                    # VS Code 設定
```

### Claude Code 自定義基礎設施

#### `.claude/agents/` - 8 個自定義 AI Agent

| Agent | 模型 | 用途 | 修改代碼？ |
|-------|------|------|------------|
| `project-analyst` | sonnet | 文檔審計與差距分析 | 否（文檔） |
| `requirement-analyst` | sonnet | 需求探索與影響分析 | 否（唯讀） |
| `architecture-reviewer` | sonnet | 架構設計驗證（對照 9 規則文件） | 否（唯讀） |
| `i18n-guardian` | haiku | 翻譯同步檢查（en/zh-TW/zh-CN） | 否（建議修復） |
| `code-quality-checker` | sonnet | 項目品質審查 | 否（唯讀） |
| `fullstack-scaffolder` | sonnet | 全端代碼骨架生成 | 是（新文件） |
| `test-strategist` | sonnet | 測試計劃文檔 | 否（文檔） |
| `session-manager` | haiku | SITUATION-5 自動化 | 否（文檔） |

#### `.claude/skills/` - 4 個自定義 Skill

| Skill | 觸發命令 | 用途 |
|-------|----------|------|
| `quickcompact` | `/quickcompact` | 快速 compact 並保留執行狀態 |
| `plan-story` | `/plan-story` | 新功能規劃（Story + Tech Spec + Prompt） |
| `plan-change` | `/plan-change` | 功能變更規劃（CHANGE-XXX） |
| `plan-fix` | `/plan-fix` | Bug 修復規劃（FIX-XXX） |

---

## 📚 ClaudeDocs - AI 助手文檔目錄

> **完整索引**: `claudedocs/CLAUDE.md`

### 目錄用途

`claudedocs/` 是 AI 助手（Claude）與開發團隊協作產出的項目文檔中心，用於：

| 用途            | 目錄              | 說明                     |
| --------------- | ----------------- | ------------------------ |
| **規劃文檔**    | `1-planning/`     | Epic 架構設計、功能規劃  |
| **Sprint 追蹤** | `2-sprints/`      | Sprint 計劃記錄          |
| **進度報告**    | `3-progress/`     | 日報/週報、進度追蹤      |
| **變更管理**    | `4-changes/`      | Bug 修復、功能變更記錄   |
| **狀態報告**    | `5-status/`       | 測試報告、系統狀態       |
| **AI 協作**     | `6-ai-assistant/` | 情境提示詞、工作流程指南 |
| **歸檔**        | `7-archive/`      | 舊版文檔、範本           |

### AI 助手情境提示詞 (SITUATION)

開發過程中，AI 助手應根據不同情境使用對應的提示詞：

| 情境            | 文件                     | 使用時機             |
| --------------- | ------------------------ | -------------------- |
| **SITUATION-1** | `PROJECT-ONBOARDING.md`  | 新會話啟動、項目入門 |
| **SITUATION-2** | `FEATURE-DEV-PREP.md`    | 功能開發前的任務分析 |
| **SITUATION-3** | `FEATURE-ENHANCEMENT.md` | 功能增強、代碼優化   |
| **SITUATION-4** | `NEW-FEATURE-DEV.md`     | 新功能實作執行       |
| **SITUATION-5** | `SAVE-PROGRESS.md`       | 保存進度、會話結束   |
| **SITUATION-6** | `SERVICE-STARTUP.md`     | 服務啟動、環境重啟   |

**路徑**: `claudedocs/6-ai-assistant/prompts/SITUATION-*.md`

### 文檔命名約定

```
claudedocs/
├── 1-planning/epics/epic-{N}/     # Epic 規劃 (N: 0-21)
├── 1-planning/plan-docs/          # CHANGE/FIX 規劃文件
├── 4-changes/bug-fixes/FIX-{NNN}-*.md       # Bug 修復 (001-035+)
├── 4-changes/feature-changes/CHANGE-{NNN}-*.md  # 功能變更 (001-032+)
├── 3-progress/daily/{YYYY}-{MM}/{YYYY}-{MM}-{DD}.md  # 日報
└── 3-progress/weekly/{YYYY}-W{WW}.md        # 週報
```

### 狀態標記

| 標記 | 含義          |
| ---- | ------------- |
| ✅   | 已完成        |
| 🚧   | 進行中        |
| ⏸️   | 暫停/待開發   |
| ❌   | 已取消        |
| ⚠️   | 有風險/需注意 |

---

## 代碼規範

### 文件頭部註釋標準（必須遵守）

所有業務邏輯文件必須包含標準 JSDoc 頭部註釋：

```typescript
/**
 * @fileoverview [文件的主要目的和功能概述]
 * @description
 *   [更詳細的描述，包含：]
 *   - 主要功能說明
 *   - 設計決策說明
 *   - 重要注意事項
 *
 * @module [模組路徑，如 src/services/mapping]
 * @author [作者或團隊名稱]
 * @since [Epic X - Story X.X (功能名稱)]
 * @lastModified [最後修改日期 YYYY-MM-DD]
 *
 * @features
 *   - [功能點 1]
 *   - [功能點 2]
 *
 * @dependencies
 *   - [依賴 1] - [用途說明]
 *   - [依賴 2] - [用途說明]
 *
 * @related
 *   - [相關文件路徑 1] - [關係說明]
 *   - [相關文件路徑 2] - [關係說明]
 */
```

### 適用範圍

| 文件類型                    | 是否需要完整頭部 | 說明           |
| --------------------------- | ---------------- | -------------- |
| Services (`src/services/`)  | ✅ 必須          | 核心業務邏輯   |
| API Routes (`src/app/api/`) | ✅ 必須          | API 端點       |
| Hooks (`src/hooks/`)        | ✅ 必須          | 自定義 Hooks   |
| Utils (`src/lib/`)          | ✅ 必須          | 工具函數       |
| Feature Components          | ✅ 必須          | 功能性組件     |
| UI Components (`ui/`)       | ❌ 不需要        | shadcn/ui 組件 |
| Type Definitions            | ⚠️ 簡化版        | 類型文件       |

### 函數/方法註釋標準

````typescript
/**
 * [函數功能簡述]
 *
 * @description [詳細描述，包含業務邏輯說明]
 * @param {Type} paramName - [參數說明]
 * @returns {ReturnType} [返回值說明]
 * @throws {ErrorType} [可能拋出的錯誤]
 * @example
 * ```typescript
 * const result = functionName(param);
 * ```
 */
````

### 命名規範

| 類型      | 規範             | 範例                       |
| --------- | ---------------- | -------------------------- |
| 文件名    | kebab-case       | `use-document-upload.ts`   |
| 組件      | PascalCase       | `DocumentUploadForm.tsx`   |
| 函數      | camelCase        | `calculateConfidenceScore` |
| 常數      | UPPER_SNAKE_CASE | `MAX_FILE_SIZE`            |
| 類型/介面 | PascalCase       | `DocumentMetadata`         |
| Enum 值   | UPPER_SNAKE_CASE | `Status.PENDING_REVIEW`    |

### TypeScript 規範

```typescript
// ✅ 優先使用 interface 定義物件類型
interface DocumentMetadata {
  id: string;
  fileName: string;
  forwarderId: string;
}

// ✅ 使用 type 定義聯合類型
type ConfidenceLevel = 'high' | 'medium' | 'low';

// ✅ 使用 Zod 進行運行時驗證
const DocumentSchema = z.object({
  id: z.string().cuid(),
  fileName: z.string().min(1),
  forwarderId: z.string().cuid(),
});

// ❌ 避免使用 any
function process(data: any) { ... }  // 不好

// ✅ 使用具體類型或 unknown
function process(data: DocumentMetadata) { ... }  // 好
```

---

## API 設計規範

### 路由結構（175 route files，~300 端點）

```
src/app/api/
├── admin/              # 管理端點（50+ routes）
│   ├── alerts/         # 警報管理
│   ├── backups/        # 備份與恢復
│   ├── config/         # 系統配置
│   ├── health/         # 健康檢查
│   ├── integrations/   # 外部整合
│   ├── logs/           # 日誌管理
│   ├── performance/    # 效能監控
│   ├── retention/      # 資料保留
│   └── users/          # 用戶管理
├── analytics/          # 統計分析
├── auth/               # 認證 (NextAuth)
├── cities/             # 城市管理
├── dashboard/          # 儀表板數據
├── documents/          # 文件處理（20+ routes）
├── exchange-rates/     # 匯率管理
├── field-mappings/     # 欄位映射
├── formats/            # 文件格式
├── reference-numbers/  # 參考編號
├── rules/              # 映射規則（15+ routes）
└── v1/                 # 版本化端點
    └── pipeline-configs/ # 管線配置（新增）
```

### 響應格式

**成功響應：**

```typescript
{
  success: true,
  data: T,
  meta?: {
    pagination?: { page, limit, total, totalPages }
  }
}
```

**錯誤響應 (RFC 7807)：**

```typescript
{
  type: "https://api.example.com/errors/validation",
  title: "Validation Error",
  status: 400,
  detail: "One or more fields failed validation",
  instance: "/api/v1/documents/123",
  errors?: {
    field: ["error message"]
  }
}
```

---

## 資料庫規範

### Prisma Schema 命名

```prisma
// 模型名稱: PascalCase 單數
model Document {
  // 欄位名稱: camelCase
  id            String   @id @default(uuid())  // 新模型使用 uuid()
  fileName      String   @map("file_name")
  createdAt     DateTime @default(now()) @map("created_at")

  // 關聯欄位
  companyId     String   @map("company_id")
  company       Company  @relation(fields: [companyId], references: [id])

  // 表名: snake_case 複數
  @@map("documents")
}
```

> **ID 策略**: 新建模型一律使用 `@default(uuid())`。舊模型部分仍使用 `cuid()`，正在逐步遷移中。

### 遷移命名

```bash
# 格式: YYYYMMDDHHMMSS_描述
npx prisma migrate dev --name add_confidence_score_to_mappings
```

---

## 組件開發規範

### 組件結構

```typescript
'use client';  // 如果需要客戶端互動

import * as React from 'react';
// 1. React/Next.js imports
// 2. 第三方庫
// 3. 本地組件
// 4. Hooks
// 5. Utils
// 6. Types

interface ComponentProps {
  // Props 定義
}

/**
 * @component ComponentName
 * @description 組件功能描述
 */
export function ComponentName({ prop1, prop2 }: ComponentProps) {
  // 1. Hooks
  // 2. State
  // 3. Effects
  // 4. Handlers
  // 5. Render

  return (
    // JSX
  );
}
```

### 狀態管理模式

```typescript
// UI 狀態 - Zustand
// src/stores/ui-store.ts
export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}))

// 伺服器狀態 - React Query
// src/hooks/use-documents.ts
export function useDocuments(filters: DocumentFilters) {
  return useQuery({
    queryKey: ['documents', filters],
    queryFn: () => documentApi.list(filters),
  })
}
```

---

## 測試規範

### 測試文件命名

```
tests/
├── unit/
│   └── services/
│       └── mapping-service.test.ts
├── integration/
│   └── api/
│       └── documents.test.ts
└── e2e/
    └── document-workflow.spec.ts
```

### 測試覆蓋率目標

- **單元測試**: 核心業務邏輯 80%+
- **整合測試**: API 端點 70%+
- **E2E 測試**: 關鍵用戶流程

---

## Git 規範

### 分支命名

```
main                                  # 生產分支
develop                               # 開發分支
feature/epic-X-story-Y                # Epic Story 功能分支（Phase 1 模式）
feature/change-NNN-description        # 功能變更分支（Phase 2 模式，當前主要使用）
fix/issue-description                 # 修復分支
hotfix/critical-issue                 # 緊急修復
```

> **分支演進**: 項目從 `feature/epic-X-story-Y`（Story 開發）演進到 `feature/change-NNN-description`（功能變更）模式。新的開發工作應使用 `feature/change-NNN` 格式。

### Commit Message 格式

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

**類型：**

- `feat`: 新功能
- `fix`: Bug 修復
- `docs`: 文檔更新
- `style`: 代碼格式
- `refactor`: 重構
- `test`: 測試相關
- `chore`: 構建/工具

**範例：**

```
feat(document): add confidence score calculation

- Implement three-tier mapping logic
- Add confidence threshold constants
- Create unit tests for edge cases

Relates to: Epic-3, Story-3.2
```

---

## 開發工作流

### 本地開發啟動

```bash
# 1. 啟動資料庫
docker-compose up -d

# 2. 安裝依賴
npm install

# 3. 生成 Prisma Client
npx prisma generate

# 4. 執行資料庫遷移
npx prisma migrate dev

# 5. 檢查端口佔用（Windows）
netstat -ano | findstr :3000 | findstr LISTENING

# 6. 啟動開發伺服器
npm run dev
# 如果 port 3000 被佔用，使用備用端口:
npm run dev -- -p 3200
```

### 端口佔用處理

| 問題 | 解決方案 |
|------|----------|
| `EADDRINUSE` 錯誤 | 使用備用端口: `npm run dev -- -p 3200` |
| 查找佔用進程 | `netstat -ano \| findstr :3000` |
| 終止進程 | `taskkill /F /PID <PID>` |

**推薦備用端口**: 3200, 3300, 3500

> 📋 詳細排解指南請參考: `.claude/CLAUDE.md`

### 代碼提交前檢查

```bash
# 類型檢查
npm run type-check

# Lint 檢查
npm run lint

# 格式化
npm run format

# 測試
npm run test
```

---

## AI 開發輔助指引

### 優先參考文檔

1. **Tech Specs**: `docs/03-stories/tech-specs/` - 各 Story 的技術規格
2. **Implementation Context**: `docs/04-implementation/implementation-context.md`
3. **PRD**: `docs/01-planning/prd/prd.md`

### 代碼生成規則

1. **必須添加標準註釋** - 按上述規範添加文件頭部和函數註釋
2. **遵循現有模式** - 參考 `src/` 下現有代碼風格
3. **類型安全優先** - 使用嚴格的 TypeScript 類型
4. **Zod 驗證** - API 輸入必須使用 Zod schema 驗證
5. **錯誤處理** - 使用 RFC 7807 格式返回錯誤

### 禁止事項

- ❌ 不要使用 `any` 類型
- ❌ 不要跳過錯誤處理
- ❌ 不要硬編碼敏感資訊
- ❌ 不要在客戶端組件中直接訪問資料庫
- ❌ 不要忽略 TypeScript 錯誤
- ❌ **不要擅自偏離設計規格**（見下方技術障礙處理規範）

---

## 🌐 i18n 同步規則（必須遵守）

> **常見問題**：開發者在 TypeScript 中新增常量（如 `PROMPT_TYPES`）但忘記更新 i18n 翻譯，導致運行時 `IntlError: MISSING_MESSAGE` 錯誤。

### i18n 命名空間完整列表（30 個/語言）

```
common, navigation, dialogs, auth, validation, errors, dashboard, global,
escalation, review, documents, rules, companies, reports, admin, confidence,
historicalData, termAnalysis, documentPreview, fieldMappingConfig,
promptConfig, dataTemplates, formats, templateFieldMapping, templateInstance,
templateMatchingTest, standardFields, referenceNumber, exchangeRate, region
```

> **重要**: 新增命名空間時，除了建立 3 個語言的 JSON 文件外，還必須在 `src/i18n/request.ts` 的 `namespaces` 陣列中加入新命名空間名稱，否則會導致 `IntlError`。

### 常量 → i18n 映射表

| 常量文件 | 常量名稱 | i18n 文件 | i18n Key 前綴 |
|----------|----------|-----------|---------------|
| `src/types/prompt-config.ts` | `PROMPT_TYPES` | `promptConfig.json` | `types.` |
| `src/constants/status.ts` | `DOCUMENT_STATUS` | `common.json` | `status.` |
| `src/constants/roles.ts` | `USER_ROLES` | `common.json` | `roles.` |

### AI 助手必須遵守的規則

**當修改以下文件時，必須同步檢查 i18n：**
- `src/types/*.ts` 中含有 `label`、`description` 的 `export const` 常量
- `src/constants/*.ts` 中的任何常量
- 任何會在 UI 顯示的 enum/object

**新增功能模組時，必須同時：**
1. 建立 `messages/en/<namespace>.json`
2. 建立 `messages/zh-TW/<namespace>.json`
3. 建立 `messages/zh-CN/<namespace>.json`
4. 在 `src/i18n/request.ts` 的 `namespaces` 陣列中加入新命名空間

**開發完成前必須執行：**
```bash
npm run i18n:check
```

### 同步更新檢查清單

當新增/修改含 UI 顯示文字的常量時：

- [ ] 已更新 `messages/en/*.json`
- [ ] 已更新 `messages/zh-TW/*.json`
- [ ] 已更新 `messages/zh-CN/*.json`
- [ ] 已更新 `src/i18n/request.ts` 命名空間陣列（如新增命名空間）
- [ ] 已執行 `npm run i18n:check` 驗證
- [ ] 已在瀏覽器確認無 `IntlError`

> 📋 完整規範請參考: `.claude/rules/i18n.md`

---

## 🚨 技術障礙處理規範（必須遵守）

> **核心原則**: 遇到技術障礙時，**絕不擅自改變設計決策**。任何偏離原設計的方案必須獲得用戶確認。

### 禁止行為

| 禁止            | 說明                            |
| --------------- | ------------------------------- |
| ❌ 擅自替換組件 | 安裝失敗不能直接換其他組件      |
| ❌ 簡化功能     | 遇到困難不能減少功能            |
| ❌ 隱藏問題     | 不能不告知用戶就使用 workaround |

### 正確處理流程

```
遇到技術障礙
    ↓
1. 深入調查根本原因（嘗試至少 3 種方法）
    ↓
2. 如果無法解決 → 必須詢問用戶
   - 說明問題是什麼
   - 說明已嘗試的方案
   - 提供替代方案選項（含影響分析）
    ↓
3. 如果用戶接受替代方案
   - 記錄為技術債務
   - 在 Implementation Notes 詳細說明
```

### 詢問模板

```markdown
## ⚠️ 技術障礙報告

### 問題：[問題描述]

### 已嘗試：

1. [方案 1] → [失敗原因]
2. [方案 2] → [失敗原因]

### 替代方案：

| 選項 | 方案       | 影響         |
| ---- | ---------- | ------------ |
| A    | 繼續調查   | 需要更多時間 |
| B    | [替代方案] | [影響說明]   |

請問您希望如何處理？
```

> 📋 完整規範請參考: `.claude/rules/technical-obstacles.md`

---

## 🔄 開發後文檔更新檢查（必須執行）

> **重要**: 每次完成開發任務後，AI 助手必須執行以下檢查流程，確保項目文檔保持最新狀態。

### 文檔更新決策流程

```
開發任務完成後，依序檢查：

1. 是否涉及技術棧/架構變更？
   └─ 是 → 更新 CLAUDE.md（技術棧、目錄結構等章節）

2. 是否新增/修改模組的公開 API？
   └─ 是 → 更新對應模組的 index.ts（導出、文檔註釋）

3. 是否發現新的開發規範/最佳實踐/踩坑經驗？
   └─ 是 → 更新對應的 .claude/rules/*.md

4. 是否完成 Epic/Story？
   └─ 是 → 更新 CLAUDE.md 項目進度追蹤表
```

### 各文檔更新時機

| 文檔類型                | 更新觸發條件                              | 更新頻率 |
| ----------------------- | ----------------------------------------- | -------- |
| **CLAUDE.md**           | 技術棧變更、架構調整、目錄重組、Epic 完成 | 低       |
| **index.ts**            | 新增服務、導出變更、常數調整              | 中       |
| **.claude/rules/\*.md** | 新開發模式、踩坑經驗、團隊約定變更        | 中低     |

### 開發完成檢查清單

完成每個 Story 或重要功能後，AI 助手應自動執行以下檢查：

```markdown
## 📋 開發完成檢查

### 代碼品質

- [ ] 通過 TypeScript 類型檢查 (`npm run type-check`)
- [ ] 通過 ESLint 檢查 (`npm run lint`)
- [ ] 新增代碼包含標準 JSDoc 註釋

### 文檔同步

- [ ] 如涉及新模組 → 已更新/建立 index.ts
- [ ] 如涉及架構變更 → 已更新 CLAUDE.md
- [ ] 如發現新規範/踩坑 → 已更新 .claude/rules/
- [ ] 如完成 Story → 已更新項目進度

### 測試驗證

- [ ] 相關測試通過
- [ ] 新功能已有對應測試（如適用）
```

### 自動提醒規則

AI 助手在以下情況應**主動提醒**用戶考慮更新文檔：

1. **建立新的 service 文件** → 提醒更新 `src/services/index.ts`
2. **新增外部依賴** → 提醒檢查是否需更新 CLAUDE.md 技術棧
3. **修改 Prisma Schema** → 提醒檢查 `.claude/rules/database.md`
4. **建立新的 API 端點** → 提醒檢查 API 路由結構文檔
5. **遇到並解決複雜問題** → 提醒記錄到 `.claude/rules/` 作為經驗

### 範例：開發完成後的文檔更新

```bash
# 情境：完成 Story 3.2 - 新增映射服務

## 需要更新的文檔：

1. src/services/index.ts
   - 新增 export * from './mapping-service'
   - 更新 @features 列表

2. CLAUDE.md
   - 更新項目進度：Epic 3 狀態改為 🟡 進行中

3. .claude/rules/services.md（如發現新模式）
   - 記錄映射服務的設計模式
   - 記錄三層映射的實現要點
```

---

## 項目進度追蹤

> **進度來源**: `docs/04-implementation/sprint-status.yaml` - 項目進度的唯一真實來源

### Epic 結構（22 個 Epic，157+ 個 Stories — 全部完成）

| Epic | 名稱                        | Stories | 狀態      | 完成日期   |
| ---- | --------------------------- | ------- | --------- | ---------- |
| 0    | 歷史數據初始化（前置 Epic） | 7       | ✅ 已完成 | 2025-12-26 |
| 1    | 用戶認證與存取控制          | 9       | ✅ 已完成 | 2025-12-18 |
| 2    | 手動發票上傳與 AI 處理      | 7       | ✅ 已完成 | 2025-12-18 |
| 3    | 發票審核與修正工作流        | 8       | ✅ 已完成 | 2025-12-19 |
| 4    | 映射規則管理與自動學習      | 8       | ✅ 已完成 | 2025-12-19 |
| 5    | Forwarder 配置管理          | 5       | ✅ 已完成 | 2025-12-19 |
| 6    | 多城市數據隔離              | 5       | ✅ 已完成 | 2025-12-19 |
| 7    | 報表儀表板與成本追蹤        | 10      | ✅ 已完成 | 2025-12-20 |
| 8    | 審計追溯與合規              | 6       | ✅ 已完成 | 2025-12-20 |
| 9    | 自動化文件獲取              | 5       | ✅ 已完成 | 2025-12-20 |
| 10   | n8n 工作流整合              | 7       | ✅ 已完成 | 2025-12-21 |
| 11   | 對外 API 服務               | 6       | ✅ 已完成 | 2025-12-21 |
| 12   | 系統管理與監控              | 7       | ✅ 已完成 | 2025-12-21 |
| 13   | 文件預覽與欄位映射          | 8       | ✅ 已完成 | 2026-01-18 |
| 14   | Prompt 配置與動態生成       | 4       | ✅ 已完成 | 2026-01-03 |
| 15   | 統一 3 層機制到日常處理流程 | 5       | ✅ 已完成 | 2026-01-03 |
| 16   | 文件格式管理                | 8       | ✅ 已完成 | 2026-01-14 |
| 17   | 國際化 (i18n) 多語言支援    | 7       | ✅ 已完成 | 2026-01-17 |
| 18   | 本地帳號認證系統            | 8       | ✅ 已完成 | 2026-01-19 |
| 19   | 資料模板匹配與匯出          | 8       | ✅ 已完成 | 2026-01-23 |
| 20   | 參考編號主檔管理            | 8       | ✅ 已完成 | 2026-02-05 |
| 21   | 匯率管理                    | 8       | ✅ 已完成 | 2026-02-06 |

### 重要重構與變更記錄

| 記錄 | 說明 | 狀態 | 備註 |
| ---- | ---- | ---- | ---- |
| REFACTOR-001 | Forwarder → Company 模型重構 | ✅ 已完成 | Story 0-3 |
| CHANGE-031 | Frontend Invoice → Document 重命名 | ✅ 已完成 | 30 文件修改 |
| CHANGE-032 | Pipeline 參考編號匹配 + 匯率轉換 | 📋 規劃中 | 下一期開發 |

### 變更管理統計

| 類型 | 數量 | 路徑 |
|------|------|------|
| 功能變更 (CHANGE) | 32 份 | `claudedocs/4-changes/feature-changes/` |
| Bug 修復 (FIX) | 35 份 | `claudedocs/4-changes/bug-fixes/` |

---

## 🗣️ 語言設定（必須遵守）

> **🔴 核心規則**: AI 助手在所有對話中**必須全程使用繁體中文**回應用戶。這是最高優先級的溝通規則，無論任何情境、任何技術討論，都不可使用英文或其他語言回覆用戶。技術術語和代碼標識符保留原文即可。

| 場景 | 語言 | 強制等級 |
|------|------|----------|
| **用戶對話與回應** | 繁體中文 | 🔴 必須（無例外） |
| **問題解釋與建議** | 繁體中文 | 🔴 必須（無例外） |
| **代碼註釋** | 中文或英文 | 🟡 依上下文選擇 |
| **Commit Message** | 英文 | 🟡 遵循 Conventional Commits |
| **技術文檔** | 繁體中文為主 | 🟡 claudedocs/ 和 docs/ |
| **代碼中的 UI 字串** | 使用 i18n key | 🔴 禁止硬編碼 |

---

## 版本資訊

- **CLAUDE.md 版本**: 2.6.0
- **建立日期**: 2025-12-17
- **最後更新**: 2026-02-08
- **維護者**: Development Team

### 更新記錄

| 版本  | 日期       | 變更內容                                                                         |
| ----- | ---------- | -------------------------------------------------------------------------------- |
| 2.6.0 | 2026-02-08 | 全面審核更新：加強語言設定措辭為必須遵守、新增 Epic 18-21（全 22 Epic 完成）、更新代碼計量（組件 165+、服務 124+、Hooks 89、Models 117）、新增 agents/skills 文檔、新增 i18n 命名空間完整列表（30 個）、更新目錄結構樹、更新 API 路由結構、新增變更管理統計、新增 Git change-NNN 分支模式、更新技術棧版本號與新增依賴 |
| 2.5.0 | 2026-02-03 | 新增「i18n 同步規則」章節、新增 `npm run i18n:check` 命令、防止常量與翻譯不同步  |
| 2.4.0 | 2026-01-18 | 新增 Epic 16 (文件格式管理)、更新 Epic 總數至 18 個、Story 總數至 119 個         |
| 2.3.0 | 2026-01-18 | 新增 Epic 17 (i18n)、新增 i18n.md 規則文件、技術棧新增 next-intl                 |
| 2.2.0 | 2026-01-03 | Epic 13-15 全部完成、Story 13-6 整合測試頁面實作完成                             |
| 2.1.0 | 2026-01-02 | 新增 Epic 13-15 規劃文檔、更新 Epic 總數至 16 個、Story 總數至 104 個            |
| 2.0.0 | 2025-12-26 | 重大更新：全部 13 個 Epic 已完成、新增 Epic 0、更新目錄結構、Story 數量更正為 90 |
| 1.4.0 | 2025-12-18 | Story 2-2 完成：OCR 提取服務（Python FastAPI + Next.js API）                     |
| 1.3.0 | 2025-12-18 | Story 2-1 完成，Epic 2 開始進行                                                  |
| 1.2.0 | 2025-12-18 | Epic 1 完成，更新項目進度和 Epic 名稱（中文化）                                  |
| 1.1.0 | 2025-12-18 | 新增「開發後文檔更新檢查」章節                                                   |
| 1.0.0 | 2025-12-17 | 初始版本                                                                         |
