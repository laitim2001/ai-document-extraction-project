# AI Document Extraction Project — 系統架構總覽

> **分析日期**: 2026-02-13
> **版本**: V1.0
> **分析範圍**: 全專案 Codebase
> **驗證方式**: Agent Team (8 分析 Agent) 並行深度代碼庫驗證
> **代碼庫規模**: ~1,320 TypeScript 檔案, ~140,000 LOC
> **專案啟動**: 2025-09-25 (首次 Prisma Migration)
> **當前分支**: `feature/change-021-extraction-v3`

---

## 實現狀態總覽

> **重要說明**: V1.0 是基於 8 個獨立分析 Agent 的數據進行交叉驗證的綜合報告。涵蓋核心架構、資料庫、API、前端、服務層、提取管線、管理功能、安全與整合等八大維度。

### 各層實現狀態

| 層級 | 組件 | 檔案數 | 狀態 |
|------|------|--------|------|
| **資料庫層** | Prisma Schema (119 Models, 77 Enums) | 1 schema + 10 migrations | ✅ 完整 |
| **服務層** | 業務邏輯服務 (196 services) | 196 .ts | ✅ 完整 |
| **API 層** | Next.js Route Handlers (392 endpoints) | 319 route.ts | ✅ 完整 |
| **前端頁面** | App Router Pages (77 pages) | 77 page.tsx | ✅ 完整 |
| **UI 組件** | shadcn/ui + Feature Components (357 total) | 357 .tsx | ✅ 完整 |
| **Hooks** | React Query + UI Utility (101 hooks) | 101 .ts | ✅ 完整 |
| **提取管線** | V3/V3.1 三階段管線 (19 files) | 19 .ts | ✅ 完整 |
| **i18n** | next-intl (3 語言, 31 命名空間) | 93 .json | ✅ 完整 |
| **認證/授權** | Azure AD SSO + NextAuth + RBAC | 多檔案分散 | ✅ 完整 |

### 已知問題摘要

| # | 問題 | 影響 | 嚴重度 |
|---|------|------|--------|
| 1 | 143 個 `console.log` 殘留於服務層 | 效能、資訊洩漏風險 | **高** |
| 2 | Auth 覆蓋率僅 61.8% (242/392 endpoints) | 38.2% 端點無認證保護 | **高** |
| 3 | Zod 驗證覆蓋率僅 63.6% (249/392 endpoints) | 36.4% 端點無輸入驗證 | **高** |
| 4 | 部分 `any` 類型殘留 | 類型安全風險 | 中 |
| 5 | 重複 Hooks（如 `use-debounce.ts` + `useDebounce.ts`）| 維護困難 | 中 |
| 6 | 部分 Hooks 命名不一致（kebab-case vs camelCase 混用）| 代碼一致性 | 低 |

---

## 1. 執行摘要

### 1.1 項目使命

AI Document Extraction Project 是一套 **AI 驅動的文件內容提取與自動分類系統**，專門解決 SCM（Supply Chain Management）部門處理 Freight Invoice 的效率問題。系統透過三層映射架構（Universal → Forwarder-Specific → LLM Classification）與六維度信心度路由機制，實現高精度的自動化文件處理。

### 1.2 核心業務目標

| 指標 | 目標值 | 說明 |
|------|--------|------|
| **年處理量** | 450,000 - 500,000 張 | APAC 地區發票 |
| **自動化率** | 90% - 95% | 無需人工介入的比例 |
| **準確率** | 90% - 95% | 提取與分類正確率 |
| **節省人時** | 35,000 - 40,000 人時/年 | 效率提升 |

### 1.3 關鍵數據

```
代碼庫規模
═════════════════════════════════════════════
TypeScript 檔案數:    ~1,320 files
估算代碼行數:         ~140,000 LOC
生產依賴:             78 packages
開發依賴:             15 packages (含 @prisma/client)

資料庫
═════════════════════════════════════════════
Prisma Models:        119
Prisma Enums:         77
Composite/Unique 索引: 200+
Migration 數量:       10 (2025-09-25 → 2026-01-31)

API
═════════════════════════════════════════════
Route Files:          319
API Endpoints:        392
HTTP Methods:         GET:184 POST:109 PUT:49 DELETE:30 PATCH:20

前端
═════════════════════════════════════════════
頁面數:               77 (5 auth + 72 dashboard)
組件數:               357 (34 ui + 292 features + 31 other)
Hooks:                101
Zustand Stores:       2
React Contexts:       2

服務層
═════════════════════════════════════════════
Services:             196
Class-based:          142
使用 Prisma:          111

i18n
═════════════════════════════════════════════
支援語言:             3 (en, zh-TW, zh-CN)
命名空間:             31
使用 useTranslations: 235 files

完成進度
═════════════════════════════════════════════
已完成 Epics:         22 個 (157+ Stories)
累計變更:             33 CHANGE + 35 FIX
當前模式:             Phase 2 功能變更模式
```

### 1.4 技術棧概覽

```
┌─────────────────────────────────────────────────────────────────┐
│                    AI Document Extraction Platform               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Frontend                          Backend/API                   │
│  ─────────────────────            ────────────────────           │
│  • Next.js 15.0.0 (App Router)   • Next.js API Routes           │
│  • React 18.3                     • Prisma 7.2 ORM               │
│  • TypeScript 5.0                 • PostgreSQL 15                 │
│  • Tailwind CSS 3.4               • Zod 4.x Validation           │
│  • shadcn/ui (34 components)                                     │
│  • Zustand 5.x (UI State)        AI/OCR Services                │
│  • React Query 5.x (Server)      ────────────────────           │
│  • React Hook Form 7.x           • Azure Document Intelligence  │
│  • next-intl 4.7 (i18n)          • Azure OpenAI GPT-5.2         │
│                                   • OpenAI SDK 6.15              │
│  DevOps                                                          │
│  ─────────────────────            External Integration           │
│  • Docker Compose                 ────────────────────           │
│  • ESLint + Prettier              • Azure AD (Entra ID) SSO     │
│  • Playwright 1.57                • SharePoint / Outlook         │
│  • GitHub                         • n8n Workflow Engine          │
│                                   • @upstash/redis               │
└─────────────────────────────────────────────────────────────────┘
```

### 1.5 架構成熟度評估（快速概覽）

| 維度 | 評分 | 說明 |
|------|------|------|
| 代碼結構 | ⭐⭐⭐⭐ | 清晰的分層架構，服務分類完善（22 類別） |
| API 設計 | ⭐⭐⭐⭐ | RESTful 設計良好，但 auth/validation 覆蓋率需加強 |
| 資料庫設計 | ⭐⭐⭐⭐⭐ | 119 Models 設計完整，索引策略到位 |
| 前端架構 | ⭐⭐⭐⭐ | 組件分類清晰，但 Hooks 命名需統一 |
| 安全性 | ⭐⭐⭐ | RBAC 完整但 auth 覆蓋率僅 61.8% |
| 國際化 | ⭐⭐⭐⭐⭐ | 31 命名空間，235 files 使用翻譯 |
| AI 管線 | ⭐⭐⭐⭐⭐ | V3.1 三階段架構成熟，六維度信心度 |
| 測試覆蓋 | ⭐⭐ | 整合測試初步建立，E2E 尚待完善 |

---

## 2. 技術棧與依賴分析

### 2.1 核心框架

| 框架 | 版本 | 用途 | 檔案路徑 |
|------|------|------|----------|
| **Next.js** | 15.0.0 | 全棧框架 (App Router) | `package.json` L86 |
| **React** | 18.3.x | UI 函式庫 | `package.json` L98 |
| **TypeScript** | 5.0.x | 類型系統 | `devDependencies` |
| **Tailwind CSS** | 3.4.x | 實用優先 CSS | `devDependencies` |
| **Prisma** | 7.2.x | ORM + Migration | `devDependencies` |

### 2.2 生產依賴分類統計 (78 packages)

| 分類 | 數量 | 代表套件 |
|------|------|----------|
| **UI 框架 (Radix UI)** | 16 | `@radix-ui/react-{dialog,select,tabs,...}` |
| **UI 輔助** | 10 | `lucide-react`, `cmdk`, `sonner`, `recharts`, `tailwind-merge`, `class-variance-authority`, `clsx`, `tailwindcss-animate`, `react-resizable-panels`, `react-syntax-highlighter` |
| **表單/驗證** | 3 | `react-hook-form`, `@hookform/resolvers`, `zod` |
| **資料獲取/狀態** | 3 | `@tanstack/react-query`, `@tanstack/react-table`, `zustand` |
| **Azure 服務** | 3 | `@azure/ai-form-recognizer`, `@azure/identity`, `@azure/storage-blob` |
| **認證** | 2 | `next-auth`, `@auth/prisma-adapter` |
| **PDF 處理** | 6 | `pdfjs-dist`, `pdf-parse`, `pdf-to-img`, `react-pdf`, `pdfkit`, `unpdf` |
| **國際化** | 1 | `next-intl` |
| **資料庫** | 2 | `@prisma/adapter-pg`, `pg` |
| **拖放排序** | 4 | `@dnd-kit/{core,modifiers,sortable,utilities}` |
| **AI/OpenAI** | 1 | `openai` |
| **Microsoft** | 1 | `@microsoft/microsoft-graph-client` |
| **快取** | 1 | `@upstash/redis` |
| **Excel** | 1 | `exceljs` |
| **加密/安全** | 2 | `bcryptjs`, `jose` |
| **郵件** | 1 | `nodemailer` |
| **工具類** | 8 | `date-fns`, `diff`, `dotenv`, `js-yaml`, `canvas`, `p-queue-compat`, `use-debounce`, `swagger-ui-react` |
| **Next.js 生態** | 2 | `next-themes`, `react-day-picker` |
| **其他** | 11 | 各類型定義、`react-dom`, `react-dropzone` 等 |

### 2.3 開發依賴 (15 packages)

| 分類 | 套件 |
|------|------|
| **TypeScript 生態** | `typescript`, `ts-node`, `@types/{node,react,react-dom,bcryptjs,diff,nodemailer,pdfkit,pg,uuid,swagger-ui-react}` |
| **CSS 工具鏈** | `autoprefixer`, `postcss`, `tailwindcss` |
| **代碼品質** | `eslint`, `eslint-config-next` |
| **ORM** | `prisma`, `@prisma/client` |
| **E2E 測試** | `playwright` |

### 2.4 Radix UI Primitives (16 個)

```
@radix-ui/react-accordion      @radix-ui/react-alert-dialog
@radix-ui/react-avatar          @radix-ui/react-checkbox
@radix-ui/react-dialog          @radix-ui/react-dropdown-menu
@radix-ui/react-label           @radix-ui/react-popover
@radix-ui/react-progress        @radix-ui/react-radio-group
@radix-ui/react-scroll-area     @radix-ui/react-select
@radix-ui/react-separator       @radix-ui/react-slider
@radix-ui/react-slot            @radix-ui/react-switch
@radix-ui/react-tabs            @radix-ui/react-toast
@radix-ui/react-tooltip
```

> **注意**: package.json 安裝了 16 個 Radix UI 套件。部分 shadcn/ui 組件（如 `command.tsx` 基於 `cmdk`）不直接依賴 Radix。

### 2.5 外部服務整合

```
┌─────────────────────────────────────────────────────────────────┐
│                      外部服務整合架構                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  AI/OCR 服務                       認證服務                      │
│  ─────────────                     ─────────                     │
│  Azure Document Intelligence       Azure AD (Entra ID) SSO      │
│  └─ @azure/ai-form-recognizer     └─ next-auth + @auth/prisma   │
│                                                                  │
│  Azure OpenAI GPT-5.2              雲端存儲                      │
│  └─ openai SDK 6.15               ─────────                     │
│                                    Azure Blob Storage             │
│  Microsoft 365                     └─ @azure/storage-blob        │
│  ─────────────                                                   │
│  SharePoint + Outlook              快取服務                      │
│  └─ @microsoft/microsoft-graph     ─────────                     │
│                                    Upstash Redis                  │
│  工作流引擎                        └─ @upstash/redis             │
│  ─────────                                                       │
│  n8n (Webhook 整合)                容器化服務                    │
│                                    ─────────                     │
│  郵件服務                          PostgreSQL (5433)              │
│  ─────────                         pgAdmin (5050)                │
│  Nodemailer (通知系統)             Azurite (10010-10012)         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.6 Docker Compose 服務

| 服務 | 端口 | 映像/說明 |
|------|------|-----------|
| PostgreSQL | 5433 | 資料庫（映射至主機 5433） |
| pgAdmin | 5050 | 資料庫管理 UI |
| Azurite (Blob) | 10010 | Azure Blob Storage 本地模擬器 |
| Azurite (Queue) | 10011 | Azure Queue Storage 本地模擬器 |
| Azurite (Table) | 10012 | Azure Table Storage 本地模擬器 |

---

## 3. 代碼規模與結構

### 3.1 整體規模

| 指標 | 數量 | 備註 |
|------|------|------|
| TypeScript 檔案總數 | ~1,320 | `.ts` + `.tsx` |
| 估算代碼行數 | ~140,000 LOC | 含註釋和空行 |
| React 組件 | 357 | `src/components/` |
| 業務服務 | 196 | `src/services/` |
| API 路由文件 | 319 | `src/app/api/` |
| 自定義 Hooks | 101 | `src/hooks/` |
| Prisma Models | 119 | `prisma/schema.prisma` |
| i18n 命名空間 | 31 | 每語言 31 個 JSON |
| i18n 翻譯文件 | 93 | 3 語言 x 31 命名空間 |

### 3.2 目錄結構圖

```
ai-document-extraction-project/
│
├── .claude/                          # Claude Code 配置
│   ├── agents/                       #   9 個自定義 Agent
│   ├── rules/                        #   9 個規則文件
│   ├── skills/                       #   4 個技能定義
│   └── CLAUDE.md                     #   詳細操作指引
│
├── claudedocs/                       # AI 助手文檔系統
│   ├── 1-planning/                   #   Epic 架構設計
│   ├── 2-sprints/                    #   Sprint 計劃
│   ├── 3-progress/                   #   進度報告（日報/週報）
│   ├── 4-changes/                    #   變更管理記錄 (33 CHANGE + 35 FIX)
│   ├── 5-status/                     #   測試報告、系統狀態
│   ├── 6-ai-assistant/              #   情境提示詞 (SITUATION-1~6)
│   ├── 7-archive/                    #   歸檔文檔
│   └── reference/                    #   參考資料（目錄結構、進度表）
│
├── docs/                             # 項目正式文檔
│   ├── 01-planning/                  #   PRD、需求文檔
│   ├── 02-architecture/              #   系統架構設計
│   ├── 03-stories/                   #   User Stories + Tech Specs
│   ├── 04-implementation/            #   實施文檔 + sprint-status.yaml
│   └── 05-analysis/                  #   架構分析報告（本文件所在）
│
├── messages/                         # i18n 翻譯文件
│   ├── en/                           #   英文 (31 JSON files)
│   ├── zh-TW/                        #   繁體中文 (31 JSON files)
│   └── zh-CN/                        #   簡體中文 (31 JSON files)
│
├── prisma/                           # Prisma ORM
│   ├── schema.prisma                 #   主 Schema (119 models, 77 enums, 4200+ 行)
│   ├── migrations/                   #   10 次遷移 (2025-09-25 → 2026-01-31)
│   ├── seed.ts                       #   種子資料入口
│   └── seed-data/                    #   種子資料模組
│
├── python-services/                  # Python 後端微服務
│   ├── extraction/                   #   提取服務
│   └── mapping/                      #   映射服務
│
├── src/
│   ├── app/
│   │   ├── [locale]/                 # App Router (i18n 路由前綴)
│   │   │   ├── (auth)/               #   認證頁面 (5 pages)
│   │   │   │   ├── login/            #     登入
│   │   │   │   ├── register/         #     註冊
│   │   │   │   ├── verify-email/     #     郵件驗證
│   │   │   │   ├── forgot-password/  #     忘記密碼
│   │   │   │   └── reset-password/   #     重設密碼
│   │   │   └── (dashboard)/          #   儀表板頁面 (72 pages)
│   │   │       ├── dashboard/        #     主儀表板
│   │   │       ├── documents/        #     文件管理
│   │   │       ├── review/           #     審核工作流
│   │   │       ├── rules/            #     映射規則管理
│   │   │       ├── companies/        #     公司管理
│   │   │       ├── escalation/       #     升級管理
│   │   │       ├── reports/          #     報表
│   │   │       ├── admin/            #     管理後台 (25+ 子頁面)
│   │   │       └── ...               #     其他功能模組
│   │   └── api/                      # API 路由 (319 route files)
│   │       ├── admin/                #   管理 API (91 endpoints)
│   │       ├── documents/            #   文件 API (17 endpoints)
│   │       ├── companies/            #   公司 API (27 endpoints)
│   │       ├── review/               #   審核 API (13 endpoints)
│   │       ├── rules/                #   規則 API (18 endpoints)
│   │       ├── templates/            #   模板 API (23 endpoints)
│   │       ├── formats/              #   格式 API (13 endpoints)
│   │       ├── reports/              #   報表 API (7 endpoints)
│   │       ├── auth/                 #   認證 API
│   │       └── ...                   #   其他 API 模組
│   │
│   ├── components/                   # React 組件 (357 total)
│   │   ├── ui/                       #   shadcn/ui 基礎組件 (34)
│   │   ├── features/                 #   功能業務組件 (292)
│   │   │   ├── admin/                #     管理功能組件
│   │   │   ├── review/               #     審核組件
│   │   │   ├── document/             #     文件組件
│   │   │   ├── rules/                #     規則組件
│   │   │   ├── confidence/           #     信心度組件
│   │   │   ├── outlook/              #     Outlook 整合
│   │   │   ├── retention/            #     資料保留
│   │   │   └── ...                   #     (共 37 功能子目錄)
│   │   └── layout/                   #   佈局組件 (31)
│   │
│   ├── hooks/                        # 自定義 Hooks (101)
│   │   ├── use-*.ts                  #   kebab-case 命名 (~52)
│   │   └── use*.ts                   #   camelCase 命名 (~49)
│   │
│   ├── i18n/                         # i18n 配置
│   │   ├── config.ts                 #   語言配置常數
│   │   ├── routing.ts                #   next-intl 路由配置
│   │   └── request.ts                #   Server-side locale + namespaces 陣列
│   │
│   ├── lib/                          # 工具庫
│   │   ├── prisma.ts                 #   Prisma Client 單例
│   │   ├── utils.ts                  #   通用工具函數
│   │   ├── auth.ts                   #   NextAuth 配置
│   │   ├── i18n-date.ts              #   日期格式化
│   │   ├── i18n-number.ts            #   數字格式化
│   │   ├── i18n-currency.ts          #   貨幣格式化
│   │   ├── i18n-zod.ts               #   Zod 驗證國際化
│   │   └── validations/              #   Zod Schema 定義
│   │
│   ├── services/                     # 業務邏輯服務 (196)
│   │   ├── *.ts                      #   根層級服務 (108)
│   │   ├── extraction-v3/            #   V3 提取管線 (19 files)
│   │   ├── extraction-v2/            #   V2 提取服務 (3 files)
│   │   ├── unified-processor/        #   統一處理器 (21 files)
│   │   ├── mapping/                  #   欄位映射引擎 (6 files)
│   │   ├── transform/                #   資料轉換引擎 (7 files)
│   │   ├── n8n/                      #   n8n 整合 (9 files)
│   │   ├── logging/                  #   日誌服務 (2 files)
│   │   ├── similarity/               #   相似度計算 (3 files)
│   │   ├── rule-inference/           #   規則推斷 (3 files)
│   │   ├── identification/           #   發行方識別 (1 file)
│   │   ├── prompt/                   #   Prompt 構建 (1 file)
│   │   └── document-processing/      #   文件處理步驟 (1 file)
│   │
│   ├── stores/                       # Zustand 狀態管理 (2)
│   │   ├── reviewStore.ts            #   審核頁面狀態
│   │   └── document-preview-test-store.ts  # 文件預覽測試狀態
│   │
│   └── types/                        # TypeScript 類型定義
│       ├── extraction-v3.types.ts    #   V3/V3.1 提取類型
│       └── ...                       #   其他類型定義
│
├── tests/                            # 測試目錄
│   ├── unit/                         #   單元測試
│   ├── integration/                  #   整合測試
│   └── e2e/                          #   E2E 測試 (Playwright)
│
├── scripts/                          # 工具腳本
│   ├── check-i18n-completeness.ts    #   i18n 完整性檢查
│   └── check-index-sync.js          #   Index 同步檢查
│
├── package.json                      # 依賴定義 (78 prod + 15 dev)
├── docker-compose.yml                # Docker 服務定義
├── CLAUDE.md                         # 項目根 Claude 指引
└── tsconfig.json                     # TypeScript 配置
```

### 3.3 各層級文件分佈統計

| 目錄 | 檔案數 | 佔比 | 說明 |
|------|--------|------|------|
| `src/app/api/` | 319 | 24.2% | API 路由（最大目錄） |
| `src/components/features/` | 292 | 22.1% | 功能業務組件 |
| `src/services/` | 196 | 14.8% | 業務邏輯服務 |
| `src/hooks/` | 101 | 7.7% | 自定義 Hooks |
| `src/app/[locale]/` | 77 | 5.8% | 頁面路由 |
| `messages/` | 93 | 7.0% | i18n 翻譯 |
| `src/components/ui/` | 34 | 2.6% | shadcn/ui 組件 |
| `src/components/layout/` | 31 | 2.3% | 佈局組件 |
| `src/lib/` | ~30 | 2.3% | 工具庫 |
| `src/types/` | ~20 | 1.5% | 類型定義 |
| `prisma/` | ~15 | 1.1% | 資料庫相關 |
| 其他 | ~112 | 8.5% | 配置、腳本、測試等 |

---

## 4. 核心架構分析

### 4.1 系統架構概覽

```
┌─────────────────────────────────────────────────────────────────┐
│              AI Document Extraction Platform 架構圖              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    用戶界面層 (Frontend)                    │ │
│  │  77 Pages | 357 Components | 101 Hooks | 2 Stores          │ │
│  │  Next.js 15 App Router + React 18.3 + Tailwind + shadcn   │ │
│  └────────────────────────────┬───────────────────────────────┘ │
│                               │ HTTP / Fetch API                 │
│  ┌────────────────────────────┴───────────────────────────────┐ │
│  │                     API 路由層 (API Layer)                  │ │
│  │  319 route files | 392 endpoints | Zod validation 63.6%    │ │
│  │  Auth coverage 61.8% | RFC 7807 error format               │ │
│  └────────────────────────────┬───────────────────────────────┘ │
│                               │                                  │
│  ┌────────────────────────────┴───────────────────────────────┐ │
│  │                     業務服務層 (Service Layer)              │ │
│  │  196 services | 142 classes | 111 use Prisma               │ │
│  │  22 業務分類 | 三層映射 | 六維度信心度                      │ │
│  └──────────┬─────────────────┬──────────────┬────────────────┘ │
│             │                 │              │                   │
│  ┌──────────┴────┐  ┌────────┴───────┐  ┌──┴────────────────┐ │
│  │  提取管線     │  │  外部服務整合   │  │  資料存取層       │ │
│  │  V3/V3.1     │  │  Azure/n8n/O365│  │  Prisma ORM       │ │
│  │  19 files     │  │  Webhook/Redis │  │  119 Models       │ │
│  └───────────────┘  └────────────────┘  └──┬────────────────┘ │
│                                             │                   │
│  ┌──────────────────────────────────────────┴─────────────────┐ │
│  │                    資料庫層 (Database)                      │ │
│  │  PostgreSQL 15 | 119 Models | 77 Enums | 200+ Indexes     │ │
│  │  10 Migrations | UUID/CUID dual strategy                   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 三層映射系統

三層映射系統是本專案的核心業務架構，負責將發票中的原始術語映射到標準化的費用分類。

```
┌─────────────────────────────────────────────────────────────────┐
│                    三層映射系統 (Term Mapping)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  輸入術語 (e.g., "OCEAN FREIGHT CHARGE")                        │
│      │                                                           │
│      ▼                                                           │
│  ╔═══════════════════════════════════════════════════════════╗  │
│  ║  Tier 1: Universal Mapping（通用層）                      ║  │
│  ║  ───────────────────────────────────                      ║  │
│  ║  • 覆蓋率: 70-80% 常見術語                               ║  │
│  ║  • 維護成本: 低（僅一份映射表）                           ║  │
│  ║  • 實現: mapping.service.ts → universalMappings           ║  │
│  ║  • 資料來源: MappingRule (tier=UNIVERSAL)                 ║  │
│  ╠═══════════════════════════════════════════════════════════╣  │
│  ║  → 找到？ → 返回結果（信心度 90%+）                      ║  │
│  ║  → 未找到 ↓                                               ║  │
│  ╠═══════════════════════════════════════════════════════════╣  │
│  ║  Tier 2: Forwarder-Specific Override（特定覆蓋層）        ║  │
│  ║  ───────────────────────────────────────                   ║  │
│  ║  • 覆蓋率: 額外 10-15%                                   ║  │
│  ║  • 維護成本: 中（每個 Forwarder 僅記錄差異）              ║  │
│  ║  • 實現: mapping.service.ts → companyMappings             ║  │
│  ║  • 資料來源: MappingRule (tier=COMPANY_SPECIFIC)          ║  │
│  ╠═══════════════════════════════════════════════════════════╣  │
│  ║  → 找到？ → 返回結果（信心度 80%+）                      ║  │
│  ║  → 未找到 ↓                                               ║  │
│  ╠═══════════════════════════════════════════════════════════╣  │
│  ║  Tier 3: LLM Classification（AI 智能分類）                ║  │
│  ║  ───────────────────────────────────                       ║  │
│  ║  • 覆蓋率: 剩餘 5-10%（從未見過的新術語）                ║  │
│  ║  • 維護成本: AI 推理成本                                  ║  │
│  ║  • 實現: term-classification.service.ts (GPT-5.2)         ║  │
│  ║  • 輸出: 分類結果 + 信心度分數                            ║  │
│  ╚═══════════════════════════════════════════════════════════╝  │
│                                                                  │
│  關鍵服務文件:                                                   │
│  • src/services/mapping.service.ts          # 三層映射核心       │
│  • src/services/term-classification.service.ts  # Tier 3 LLM    │
│  • src/services/rule-resolver.ts            # 規則解析器         │
│  • src/services/mapping/field-mapping-engine.ts # 欄位映射引擎  │
│  • src/services/mapping/config-resolver.ts  # 配置解析器         │
│  • src/services/mapping/dynamic-mapping.service.ts # 動態映射   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 信心度路由機制

#### 4.3.1 路由閾值

| 信心度範圍 | 處理方式 | 說明 | 人工介入 |
|-----------|----------|------|----------|
| **>= 90%** | `AUTO_APPROVE` | 自動通過，直接進入下游系統 | 無 |
| **70% - 89%** | `QUICK_REVIEW` | 快速人工確認（一鍵確認/修正）| 最小化 |
| **< 70%** | `FULL_REVIEW` | 完整人工審核（詳細檢查）| 完整 |

```
實現位置:
• src/services/confidence.service.ts           # 基礎信心度計算
• src/services/extraction-v3/confidence-v3.service.ts    # V3 版本
• src/services/extraction-v3/confidence-v3-1.service.ts  # V3.1 版本（最新）
• src/services/routing.service.ts              # 審核路由決策
• src/services/index.ts                        # 常數定義
  → CONFIDENCE_THRESHOLD_HIGH = 90
  → CONFIDENCE_THRESHOLD_MEDIUM = 70
  → getReviewType(confidence) function
```

#### 4.3.2 六維度信心度計算 (V3.1)

V3.1 版本引入六維度信心度評估，每個維度獨立計算並加權合成最終分數：

| 維度 | 英文名稱 | 說明 | 評估對象 |
|------|----------|------|----------|
| 1 | `fieldMapping` | 欄位映射信心度 | 映射規則匹配品質 |
| 2 | `termMatching` | 術語匹配信心度 | 三層映射命中層級 |
| 3 | `formatRecognition` | 格式識別信心度 | 文件格式模板匹配 |
| 4 | `dataCompleteness` | 資料完整性 | 必填欄位填充率 |
| 5 | `ocrQuality` | OCR 品質 | 文字辨識可信度 |
| 6 | `overallExtraction` | 整體提取信心度 | GPT 提取結果品質 |

```
實現位置:
• src/services/extraction-v3/confidence-v3-1.service.ts
  → class ConfidenceV3_1Service
  → calculateConfidence(input: ConfidenceInputV3_1): ConfidenceResultV3_1
  → 每個維度輸出: { score: number, weight: number, factors: string[] }

• src/types/extraction-v3.types.ts
  → interface DimensionScoreV3_1
  → interface ConfidenceResultV3_1
```

### 4.4 四層配置繼承

系統支援四層配置繼承機制，用於 Prompt 配置、欄位映射配置和管線配置的精細化管理：

```
┌─────────────────────────────────────────────────────────────────┐
│              四層配置繼承 (Configuration Inheritance)             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Level 1: SYSTEM（系統預設）                                     │
│  ├─ 最低優先級                                                   │
│  ├─ 全局生效                                                     │
│  └─ 由系統管理員維護                                             │
│      │                                                           │
│      ▼ (可被覆蓋)                                                │
│  Level 2: GLOBAL（全局配置）                                     │
│  ├─ 覆蓋 SYSTEM 設定                                            │
│  ├─ 適用於所有公司                                               │
│  └─ 由管理員維護                                                 │
│      │                                                           │
│      ▼ (可被覆蓋)                                                │
│  Level 3: COMPANY（公司級配置）                                  │
│  ├─ 覆蓋 GLOBAL 設定                                            │
│  ├─ 特定公司的自定義設定                                         │
│  └─ 由公司管理員維護                                             │
│      │                                                           │
│      ▼ (可被覆蓋)                                                │
│  Level 4: FORMAT（格式級配置）                                   │
│  ├─ 最高優先級                                                   │
│  ├─ 特定文件格式的精確配置                                       │
│  └─ 由操作員或管理員維護                                         │
│                                                                  │
│  三種配置類型:                                                   │
│  ─────────────────────────────                                   │
│  1. PromptConfig - GPT Prompt 模板                               │
│     → src/services/prompt-resolver.service.ts                    │
│     → src/services/prompt-merge-engine.service.ts                │
│     → 支援 ${variable} 動態變數替換                              │
│                                                                  │
│  2. FieldMappingConfig - 欄位映射規則                            │
│     → src/services/mapping/config-resolver.ts                    │
│     → src/services/mapping/field-mapping-engine.ts               │
│                                                                  │
│  3. PipelineConfig - 管線功能開關                                │
│     → src/services/pipeline-config.service.ts                    │
│     → 控制參考編號匹配、匯率轉換等功能開關                      │
│                                                                  │
│  資料庫模型:                                                     │
│  • PromptConfig (prisma) → level: SYSTEM|GLOBAL|COMPANY|FORMAT  │
│  • FieldMappingConfig (prisma) → level: 同上                    │
│  • PipelineConfig (prisma) → level: 同上                        │
│                                                                  │
│  配置解析邏輯（向上查找）:                                       │
│  FORMAT → 未找到 → COMPANY → 未找到 → GLOBAL → 未找到 → SYSTEM  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.5 V3/V3.1 提取管線架構

V3 提取管線是專案的核心 AI 處理引擎，負責從 PDF/Image 文件中自動提取結構化資料。

#### 4.5.1 V3.1 三階段管線 (CHANGE-024)

```
┌─────────────────────────────────────────────────────────────────┐
│                V3.1 三階段提取管線 (3-Stage Pipeline)            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  PDF/Image 輸入                                                  │
│      │                                                           │
│      ▼                                                           │
│  ┌────────────────────────────────────────────────────┐         │
│  │  Step 1: FILE_PREPARATION                          │         │
│  │  PdfConverter → Base64 圖片陣列                    │         │
│  │  檔案: utils/pdf-converter.ts                      │         │
│  └────────────────────────────┬───────────────────────┘         │
│                               │                                  │
│  ╔════════════════════════════╧══════════════════════════════╗  │
│  ║  Step 2: STAGE_1_COMPANY_IDENTIFICATION                   ║  │
│  ║  ──────────────────────────────────────────               ║  │
│  ║  • 模型: GPT-5-nano（成本最低）                           ║  │
│  ║  • 輸入: 文件圖片 + 已知公司列表                          ║  │
│  ║  • 輸出: Stage1CompanyResult (公司名稱+匹配方式+信心度)   ║  │
│  ║  • 檔案: stages/stage-1-company.service.ts                ║  │
│  ╠═══════════════════════════════════════════════════════════╣  │
│  ║  Step 3: STAGE_2_FORMAT_IDENTIFICATION                    ║  │
│  ║  ──────────────────────────────────────────               ║  │
│  ║  • 模型: GPT-5-nano                                      ║  │
│  ║  • 輸入: Stage 1 結果 + 格式模板列表                      ║  │
│  ║  • 輸出: Stage2FormatResult (格式ID+配置來源+信心度)      ║  │
│  ║  • 檔案: stages/stage-2-format.service.ts                 ║  │
│  ╠═══════════════════════════════════════════════════════════╣  │
│  ║  Step 4: STAGE_3_FIELD_EXTRACTION                         ║  │
│  ║  ──────────────────────────────────────────               ║  │
│  ║  • 模型: GPT-5.2（最強推理能力）                          ║  │
│  ║  • 輸入: Stage 1+2 結果 + 動態 Prompt (四層繼承合併)      ║  │
│  ║  • 輸出: Stage3ExtractionResult (標準欄位+行項目+附加費)  ║  │
│  ║  • 後處理:                                                ║  │
│  ║    ├─ ReferenceNumberMatcher → 參考編號匹配 (Epic 20)     ║  │
│  ║    └─ ExchangeRateConverter → 匯率轉換 (Epic 21)         ║  │
│  ║  • 檔案: stages/stage-3-extraction.service.ts             ║  │
│  ╚═══════════════════════════════════════════════════════════╝  │
│                               │                                  │
│      ┌────────────────────────┤                                  │
│      ▼                        ▼                                  │
│  ┌───────────────┐  ┌─────────────────────┐                    │
│  │ Step 5:       │  │ Step 6:             │                    │
│  │ TERM_RECORDING│  │ CONFIDENCE_CALC     │                    │
│  │ 術語記錄      │  │ 六維度信心度計算    │                    │
│  └───────────────┘  └──────────┬──────────┘                    │
│                                │                                 │
│                     ┌──────────┴──────────┐                     │
│                     │ Step 7:             │                     │
│                     │ ROUTING_DECISION    │                     │
│                     │ >=90% AUTO_APPROVE  │                     │
│                     │ 70-89% QUICK_REVIEW │                     │
│                     │ <70% FULL_REVIEW    │                     │
│                     └─────────────────────┘                     │
│                                                                  │
│  核心檔案:                                                       │
│  • src/services/extraction-v3/extraction-v3.service.ts (入口)   │
│  • src/services/extraction-v3/stages/stage-orchestrator.service.ts│
│  • src/services/extraction-v3/stages/gpt-caller.service.ts      │
│  • src/services/extraction-v3/prompt-assembly.service.ts         │
│  • src/services/extraction-v3/confidence-v3-1.service.ts        │
│  • src/services/extraction-v3/result-validation.service.ts      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### 4.5.2 V3 vs V3.1 比較

| 特性 | V3 | V3.1 (CHANGE-024) |
|------|----|--------------------|
| GPT 呼叫次數 | 1 次 | 2-3 次 |
| Stage 架構 | 單階段 | 三階段分離 |
| 公司識別模型 | GPT-5.2 (同一次) | GPT-5-nano (專用) |
| 格式匹配模型 | GPT-5.2 (同一次) | GPT-5-nano (專用) |
| 欄位提取模型 | GPT-5.2 | GPT-5.2 |
| 信心度維度 | 基礎 | 六維度 |
| 適用場景 | 簡單文件 | 複雜文件、精確控制 |
| Feature Flag | `useStageMode: false` | `useStageMode: true` |

#### 4.5.3 提取管線目錄結構

```
src/services/extraction-v3/           (19 files total)
├── index.ts                          # 統一導出
├── extraction-v3.service.ts          # V3 主服務入口
├── prompt-assembly.service.ts        # Prompt 動態組裝
├── unified-gpt-extraction.service.ts # V3 單次 GPT 提取
├── confidence-v3.service.ts          # V3 信心度計算
├── confidence-v3-1.service.ts        # V3.1 六維度信心度（最新）
├── result-validation.service.ts      # 結果驗證
│
├── stages/                           # 三階段處理器 (V3.1)
│   ├── index.ts
│   ├── stage-orchestrator.service.ts # 階段協調器
│   ├── stage-1-company.service.ts    # Stage 1: 公司識別
│   ├── stage-2-format.service.ts     # Stage 2: 格式匹配
│   ├── stage-3-extraction.service.ts # Stage 3: 欄位提取
│   ├── gpt-caller.service.ts         # 共用 GPT 呼叫器
│   ├── reference-number-matcher.service.ts  # 參考編號匹配
│   └── exchange-rate-converter.service.ts   # 匯率轉換
│
└── utils/                            # 提取工具函數
    ├── pdf-converter.ts              # PDF → Base64 圖片
    ├── prompt-builder.ts             # Prompt 構建器
    ├── prompt-merger.ts              # 多層 Prompt 合併
    └── variable-replacer.ts          # ${variable} 動態替換
```

---

## 5. 資料庫架構

### 5.1 整體規模

| 指標 | 數量 | 備註 |
|------|------|------|
| **Models** | 119 | PascalCase 單數命名 |
| **Enums** | 77 | 分布於 6 大分類 |
| **Composite/Unique 索引** | 200+ | 確保查詢效能 |
| **Migrations** | 10 | 2025-09-25 → 2026-01-31 |
| **Schema 行數** | 4,200+ | `prisma/schema.prisma` |
| **ID 策略** | UUID + CUID | 新建用 UUID，舊模型用 CUID |

### 5.2 Migration 歷史

| 序號 | Migration 名稱 | 建立日期 | 說明 |
|------|---------------|----------|------|
| 1 | `add_rbac_tables` | 2025-12-18 03:15 | RBAC 角色權限表 |
| 2 | `add_city_model` | 2025-12-18 03:42 | 城市模型 |
| 3 | `add_document_model` | 2025-12-18 07:54 | 文件核心模型 |
| 4 | `add_ocr_result` | 2025-12-18 08:38 | OCR 結果 |
| 5 | `add_forwarder_identification` | 2025-12-18 08:53 | Forwarder 識別 |
| 6 | `add_mapping_rules_and_extraction_results` | 2025-12-18 09:18 | 映射規則+提取結果 |
| 7 | `add_processing_queue` | 2025-12-18 09:58 | 處理佇列 |
| 8 | `add_story_3_6_correction_type_and_rule_suggestion` | 2025-12-18 15:43 | 修正類型+規則建議 |
| 9 | `add_story_3_7_escalation_model` | 2025-12-18 16:05 | 升級模型 |
| 10 | `add_multi_city_support` | 2025-12-19 01:00 | 多城市支援 |

### 5.3 模型分類統計 (119 Models)

| 分類 | 數量 | 代表模型 |
|------|------|----------|
| **用戶與權限** | 8 | User, Account, Session, VerificationToken, Role, UserRole, UserCityAccess, UserRegionAccess |
| **區域與城市** | 2 | Region, City |
| **文件處理核心** | 7 | Document, OcrResult, ExtractionResult, ProcessingQueue, DocumentProcessingStage, DocumentFormat, BulkOperation |
| **公司管理** | 3 | Company, Forwarder (deprecated), ForwarderIdentification |
| **映射與規則** | 12 | MappingRule, RuleSuggestion, SuggestionSample, RuleVersion, RuleApplication, RollbackLog, RuleChangeRequest, RuleTestTask, RuleTestDetail, RuleCacheVersion, FieldMappingConfig, FieldMappingRule |
| **審核工作流** | 7 | ReviewRecord, Correction, FieldCorrectionHistory, CorrectionPattern, Escalation, PatternAnalysisLog, Notification |
| **審計與安全** | 5 | AuditLog, SecurityLog, DataChangeHistory, TraceabilityReport, StatisticsAuditLog |
| **報表與統計** | 6 | ReportJob, MonthlyReport, AuditReportJob, AuditReportDownload, ProcessingStatistics, HourlyProcessingStats |
| **AI 成本追蹤** | 3 | ApiUsageLog, ApiPricingConfig, ApiPricingHistory |
| **系統配置** | 3 | SystemConfig, ConfigHistory, PipelineConfig |
| **資料保留** | 4 | DataRetentionPolicy, DataArchiveRecord, DataDeletionRequest, DataRestoreRequest |
| **SharePoint 整合** | 3 | SharePointConfig, SharePointFetchLog, ApiKey |
| **Outlook 整合** | 3 | OutlookConfig, OutlookFilterRule, OutlookFetchLog |
| **n8n 整合** | 4 | N8nApiKey, N8nApiCall, N8nWebhookEvent, N8nIncomingWebhook |
| **工作流** | 5 | WorkflowExecution, WorkflowExecutionStep, WorkflowDefinition, WebhookConfig, WebhookConfigHistory |
| **外部 API** | 6 | ExternalApiTask, ExternalWebhookDelivery, ExternalWebhookConfig, ExternalApiKey, ApiAuthAttempt, ApiAuditLog |
| **效能監控** | 11 | ServiceHealthCheck, ServiceAvailability, SystemOverallStatus, ApiPerformanceMetric, SystemResourceMetric, AiServiceMetric, DatabaseQueryMetric, PerformanceHourlySummary, PerformanceThreshold, SystemHealthLog, N8nConnectionStats |
| **警報系統** | 5 | AlertRule, Alert, AlertRuleNotification, AlertRecord, AlertNotificationConfig |
| **備份與還原** | 7 | Backup, BackupSchedule, BackupConfig, BackupStorageUsage, RestoreRecord, RestoreDrill, RestoreLog |
| **系統日誌** | 3 | SystemLog, LogRetentionPolicy, LogExport |
| **歷史批次處理** | 4 | HistoricalBatch, HistoricalFile, TermAggregationResult, FileTransactionParty |
| **Prompt 配置** | 2 | PromptConfig, PromptVariable |
| **模板管理** | 4 | DataTemplate, TemplateFieldMapping, TemplateInstance, TemplateInstanceRow |
| **參考編號與匯率** | 2 | ReferenceNumber, ExchangeRate |

### 5.4 Enum 分類統計 (77 Enums)

| 分類 | 數量 | 代表 Enum |
|------|------|-----------|
| **Status 類** | 19 | DocumentStatus, ReviewStatus, ExtractionStatus, EscalationStatus, BackupStatus, ... |
| **Type 類** | 15 | CorrectionType, MappingTier, AlertSeverity, LogLevel, ... |
| **Config 類** | 10 | ConfigLevel, PromptType, PipelineFeature, ... |
| **AI/Processing** | 10 | ProcessingStep, ConfidenceDimension, ExtractionMode, ... |
| **Document Features** | 6 | FileType, DocumentSource, FormatCategory, ... |
| **System 類** | 17 | UserStatus, RoleType, AuditAction, SecurityEventType, ... |

### 5.5 核心模型關係圖

```
                        User (核心用戶模型)
                        ├── 84 個關聯關係（最大的中心模型）
                        │
           ┌────────────┼────────────┬─────────────────┐
           ▼            ▼            ▼                 ▼
        Document     UserRole    ReviewRecord      AuditLog
        ├─ OcrResult  ├─ Role     ├─ Correction     ├─ DataChangeHistory
        ├─ ExtractionResult       ├─ Escalation     └─ SecurityLog
        ├─ ProcessingQueue        └─ FieldCorrectionHistory
        ├─ DocumentProcessingStage
        │
        ├── Company (公司)
        │   ├─ Forwarder (deprecated)
        │   ├─ ForwarderIdentification
        │   ├─ MappingRule
        │   ├─ DocumentFormat
        │   │   ├─ PromptConfig
        │   │   ├─ FieldMappingConfig
        │   │   └─ PipelineConfig
        │   └─ DataTemplate
        │       ├─ TemplateFieldMapping
        │       └─ TemplateInstance
        │           └─ TemplateInstanceRow
        │
        ├── Region (區域)
        │   ├─ City
        │   │   ├─ UserCityAccess
        │   │   └─ Document (cityCode)
        │   ├─ UserRegionAccess
        │   └─ ReferenceNumber
        │
        └── ExchangeRate (獨立匯率表)
```

---

## 6. API 層架構

### 6.1 整體統計

| 指標 | 數量 | 備註 |
|------|------|------|
| **Route Files** | 319 | `src/app/api/**/route.ts` |
| **Total Endpoints** | 392 | 每個 route file 可含多個 HTTP method |
| **Auth Coverage** | 242/392 (61.8%) | 有認證保護的端點 |
| **Zod Validation** | 249/392 (63.6%) | 有輸入驗證的端點 |

### 6.2 HTTP 方法分佈

| HTTP Method | 數量 | 佔比 | 典型用途 |
|-------------|------|------|----------|
| **GET** | 184 | 46.9% | 查詢、列表、統計 |
| **POST** | 109 | 27.8% | 建立資源、觸發操作 |
| **PUT** | 49 | 12.5% | 更新資源 |
| **DELETE** | 30 | 7.7% | 刪除資源 |
| **PATCH** | 20 | 5.1% | 部分更新、切換狀態 |

### 6.3 路由分類統計

| 路由前綴 | Endpoints | 說明 |
|----------|-----------|------|
| `/api/admin/` | 91 | 管理後台（警報、備份、配置、日誌、效能、還原、保留、用戶、整合） |
| `/api/companies/` | 27 | 公司管理（CRUD + 格式 + 文件 + 統計） |
| `/api/templates/` | 23 | 模板管理（資料模板 + 欄位映射 + 實例 + 匹配測試） |
| `/api/rules/` | 18 | 映射規則（CRUD + 建議 + 測試 + 版本 + 變更請求） |
| `/api/documents/` | 17 | 文件管理（上傳 + 處理 + 批次 + 歷史 + 詳情） |
| `/api/review/` | 13 | 審核工作流（佇列 + 提交 + 升級 + 修正） |
| `/api/formats/` | 13 | 文件格式（CRUD + 欄位映射配置 + Prompt 配置） |
| `/api/reports/` | 7 | 報表（月報 + 審計 + 費用 + 統計） |
| `/api/dashboard/` | 6 | 儀表板（統計 + AI 成本 + 趨勢） |
| `/api/cost/` | 5 | 成本分析（定價 + 比較 + 趨勢） |
| `/api/cities/` | 3 | 城市管理 |
| `/api/regions/` | 4 | 區域管理 |
| `/api/analytics/` | 3 | 分析（全局 + 區域 + 城市比較） |
| `/api/audit/` | 2 | 審計報告（下載 + 驗證） |
| `/api/auth/` | 1 | 認證 (NextAuth catch-all) |
| 其他 | ~180 | 信心度、文檔、匯率、參考編號、n8n 等 |

### 6.4 API 響應格式

```typescript
// 成功響應
interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    total: number;
    page: number;
    limit: number;
  };
}

// 錯誤響應 (RFC 7807)
interface ErrorResponse {
  type: string;          // 錯誤類型 URI
  title: string;         // 人類可讀標題
  status: number;        // HTTP 狀態碼
  detail: string;        // 詳細錯誤描述
  instance: string;      // 請求路徑
  errors?: unknown[];    // 驗證錯誤陣列
}
```

### 6.5 認證與驗證覆蓋率分析

```
認證覆蓋率: 61.8% (242/392)
═══════════════════════════════════════

  已保護 ████████████████████████░░░░░░░░░░░░░░ 242 endpoints
  未保護 ░░░░░░░░░░░░░░░░████████████████████████ 150 endpoints

  ⚠️ 38.2% 端點無認證保護
  → 需優先覆蓋: admin/, companies/, templates/ 等管理功能

Zod 驗證覆蓋率: 63.6% (249/392)
═══════════════════════════════════════

  已驗證 █████████████████████████░░░░░░░░░░░░░░ 249 endpoints
  未驗證 ░░░░░░░░░░░░░░░░██████████████████████░░ 143 endpoints

  ⚠️ 36.4% 端點無輸入驗證
  → 所有 POST/PUT/PATCH 端點應有 Zod schema
```

---

## 7. 前端架構

### 7.1 頁面結構 (77 Pages)

```
src/app/[locale]/
├── (auth)/                    # 認證頁面 (5 pages)
│   ├── login/page.tsx
│   ├── register/page.tsx
│   ├── verify-email/page.tsx
│   ├── forgot-password/page.tsx
│   └── reset-password/page.tsx
│
└── (dashboard)/               # 儀表板頁面 (72 pages)
    ├── dashboard/page.tsx     # 主儀表板
    ├── documents/             # 文件管理 (~8 pages)
    │   ├── page.tsx           #   文件列表
    │   ├── upload/            #   文件上傳
    │   ├── [id]/              #   文件詳情
    │   ├── batch/             #   批次處理
    │   └── historical/        #   歷史資料
    ├── review/                # 審核 (~5 pages)
    │   ├── page.tsx           #   審核佇列
    │   └── [id]/              #   審核詳情
    ├── rules/                 # 映射規則 (~8 pages)
    │   ├── page.tsx           #   規則列表
    │   ├── suggestions/       #   規則建議
    │   ├── testing/           #   規則測試
    │   └── [id]/              #   規則詳情
    ├── companies/             # 公司管理 (~6 pages)
    │   ├── page.tsx           #   公司列表
    │   └── [id]/              #   公司詳情 + 格式
    ├── escalation/            # 升級管理
    ├── reports/               # 報表
    ├── admin/                 # 管理後台 (25+ sub-pages)
    │   ├── users/             #   用戶管理
    │   ├── config/            #   系統配置
    │   ├── integrations/      #   外部整合
    │   ├── alerts/            #   警報管理
    │   ├── backup/            #   備份管理
    │   ├── logs/              #   日誌管理
    │   ├── performance/       #   效能監控
    │   ├── retention/         #   資料保留
    │   └── roles/             #   角色管理
    └── ...                    # 其他頁面
```

### 7.2 組件分類 (357 Components)

| 分類 | 數量 | 目錄 | 說明 |
|------|------|------|------|
| **shadcn/ui 基礎** | 34 | `src/components/ui/` | Radix UI 封裝組件 |
| **功能業務組件** | 292 | `src/components/features/` | 按業務領域分組 |
| **佈局組件** | 31 | `src/components/layout/` | 頁面佈局、側邊欄等 |

#### shadcn/ui 組件清單 (34)

```
accordion    alert-dialog  alert       avatar      badge
button       calendar      card        checkbox    collapsible
command      dialog        dropdown-menu  form     input
label        month-picker  pagination  popover     progress
radio-group  resizable     scroll-area select      separator
skeleton     slider        switch      table       tabs
textarea     toast         toaster     tooltip
```

#### 功能組件子目錄 (37 個業務領域)

| 子目錄 | 組件數 | 代表組件 |
|--------|--------|----------|
| `admin/` | ~30 | AlertRuleManagement, ConfigEditDialog, HealthDashboard, RestoreDialog |
| `review/` | ~20 | ReviewPanel, FieldEditor, PdfViewer, CorrectionTypeSelector |
| `document/` | ~15 | DocumentUpload, ProcessingTimeline, DocumentDetail |
| `rules/` | ~15 | RulePreviewPanel, AccuracyMetrics, RuleTestConfig |
| `rule-review/` | ~8 | ReviewDetailPage, ApproveDialog, ImpactSummaryCard |
| `rule-version/` | ~4 | VersionCompareDialog, VersionDiffViewer, RollbackConfirmDialog |
| `confidence/` | ~3 | ConfidenceBadge, ConfidenceIndicator |
| `retention/` | ~5 | DataRetentionDashboard, RetentionPolicyList, DeletionRequestList |
| `outlook/` | ~4 | OutlookConfigForm, OutlookConfigList, OutlookFilterRulesEditor |
| `audit/` | ~4 | AuditReportExportDialog, AuditReportJobList |
| `escalation/` | ~3 | ResolveDialog, EscalationListSkeleton |
| `docs/` | ~5 | SwaggerUIWrapper, CodeBlock, SDKExamplesContent |
| `reports/` | ~3 | 報表相關組件 |
| `history/` | ~3 | ChangeHistoryTimeline, HistoryVersionCompareDialog |
| `forwarders/` | ~2 | LogoUploader |
| `document-source/` | ~4 | SourceTypeFilter, SourceTypeStats, SourceTypeTrend |
| 其他 | ~170 | 散布於各子目錄 |

### 7.3 Hooks 分析 (101 Hooks)

| 分類 | 數量 | 代表 Hook |
|------|------|-----------|
| **React Query (資料獲取)** | ~60 | `use-documents`, `use-companies`, `useReviewQueue`, `use-alerts` |
| **UI 工具** | ~15 | `use-debounce`, `useMediaQuery`, `use-toast`, `use-pdf-preload` |
| **i18n 國際化** | 6 | `use-localized-toast`, `use-localized-zod`, `use-localized-date`, `use-localized-format`, `use-locale-preference`, `use-field-label` |
| **表單 (React Hook Form)** | ~36 | 分散於各功能組件（使用 `useForm` + `zodResolver`） |

> **已知問題**: Hooks 存在命名不一致問題（kebab-case vs camelCase 混用）。例如 `use-debounce.ts` 和 `useDebounce.ts` 同時存在，`use-alerts.ts` 和 `useAlerts.ts` 並存。建議統一為 kebab-case。

### 7.4 狀態管理策略

```
┌─────────────────────────────────────────────────────────────────┐
│                      前端狀態管理架構                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  伺服器狀態 (Server State)                                       │
│  ─────────────────────────                                       │
│  React Query (@tanstack/react-query 5.x)                        │
│  • ~60 個 React Query hooks                                     │
│  • 自動快取、重新驗證、背景更新                                  │
│  • 典型模式: useQuery → GET, useMutation → POST/PUT/DELETE      │
│                                                                  │
│  UI 狀態 (Client State)                                          │
│  ─────────────────────                                           │
│  Zustand 5.x (2 Stores)                                         │
│  • src/stores/reviewStore.ts                                     │
│  •   → 審核頁面: 當前文件、欄位編輯狀態、修正記錄               │
│  • src/stores/document-preview-test-store.ts                     │
│  •   → 文件預覽測試: 預覽配置、測試結果                         │
│                                                                  │
│  React Context (2 Contexts)                                      │
│  • DashboardFilterContext → 儀表板篩選條件                       │
│  • DateRangeContext → 日期範圍選擇                               │
│                                                                  │
│  表單狀態 (Form State)                                           │
│  ─────────────────────                                           │
│  React Hook Form 7.x + Zod 4.x                                  │
│  • 36 個檔案使用 React Hook Form + Zod                          │
│  • useLocalizedZod hook 提供國際化驗證訊息                       │
│                                                                  │
│  客戶端渲染策略                                                  │
│  ─────────────────                                               │
│  • 450 個檔案使用 'use client' 指令（~93%）                     │
│  • 僅少數頁面使用 Server Components                              │
│  • 原因: 大量互動式 UI 需要客戶端渲染                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 7.5 i18n 國際化覆蓋

| 指標 | 數值 | 說明 |
|------|------|------|
| **支援語言** | 3 | en, zh-TW, zh-CN |
| **命名空間** | 31 | 每個語言 31 個 JSON 文件 |
| **使用 useTranslations** | 235 files | 93% 以上的客戶端組件 |
| **翻譯文件總數** | 93 | 3 語言 x 31 命名空間 |
| **日期/數字/貨幣格式化** | 完整 | `i18n-date.ts`, `i18n-number.ts`, `i18n-currency.ts` |
| **表單驗證國際化** | 完整 | `use-localized-zod.ts` |
| **語言偏好持久化** | 完整 | LocalStorage + Database |

#### i18n 命名空間清單 (31 個)

```
common          navigation      dialogs         auth            validation
errors          dashboard       global          escalation      review
documents       rules           companies       reports         admin
confidence      historicalData  termAnalysis    documentPreview
fieldMappingConfig  promptConfig  dataTemplates  formats
templateFieldMapping  templateInstance  templateMatchingTest
standardFields  referenceNumber exchangeRate    region
```

### 7.6 拖放功能

```
@dnd-kit (3 files)
• @dnd-kit/core + @dnd-kit/modifiers + @dnd-kit/sortable + @dnd-kit/utilities
• 使用場景: 欄位映射配置排序
• 涉及組件: FieldMappingConfig 相關組件
```

---

## 8. 服務層架構

### 8.1 整體統計

| 指標 | 數量 | 備註 |
|------|------|------|
| **服務總數** | 196 | 根層級 108 + 子目錄 88 |
| **Class-based** | 142 | 使用 class + 單例模式 |
| **使用 Prisma** | 111 | 直接依賴 Prisma Client |
| **子目錄數** | 12 | 含巢狀共 19 個目錄 |

### 8.2 業務領域分類 (22 類別)

| # | 領域 | 服務數 | 代表服務 |
|---|------|--------|----------|
| 1 | **核心處理** | 11 | `document.service.ts`, `extraction.service.ts`, `batch-processor.service.ts` |
| 2 | **AI/OCR** | 10 | `gpt-vision.service.ts`, `azure-di.service.ts`, `confidence.service.ts`, `term-classification.service.ts` |
| 3 | **映射與規則** | 15 | `mapping.service.ts`, `rule-resolver.ts`, `rule-suggestion-generator.ts`, `rule-testing.service.ts` |
| 4 | **公司/Forwarder** | 6 | `company.service.ts`, `company-matcher.service.ts`, `company-auto-create.service.ts` |
| 5 | **城市與區域** | 6 | `city.service.ts`, `city-access.service.ts`, `regional-manager.service.ts` |
| 6 | **報表與統計** | 6 | `dashboard-statistics.service.ts`, `expense-report.service.ts`, `audit-report.service.ts` |
| 7 | **審計與追蹤** | 6 | `audit-log.service.ts`, `change-tracking.service.ts`, `traceability.service.ts` |
| 8 | **審核工作流** | 3 | `invoice-submission.service.ts`, `routing.service.ts`, `task-status.service.ts` |
| 9 | **警報與通知** | 6 | `alert.service.ts`, `alert-rule.service.ts`, `notification.service.ts` |
| 10 | **備份與資料** | 5 | `backup.service.ts`, `restore.service.ts`, `data-retention.service.ts` |
| 11 | **Outlook 整合** | 4 | `outlook-mail.service.ts`, `outlook-document.service.ts`, `outlook-config.service.ts` |
| 12 | **SharePoint 整合** | 2 | `sharepoint-document.service.ts`, `sharepoint-config.service.ts` |
| 13 | **Webhook 整合** | 2 | `webhook.service.ts`, `webhook-event-trigger.ts` |
| 14 | **n8n 整合** | 9 | `n8n-api-key.service.ts`, `workflow-execution.service.ts`, `n8n-health.service.ts` |
| 15 | **系統管理** | 7 | `health-check.service.ts`, `system-config.service.ts`, `performance.service.ts` |
| 16 | **用戶與權限** | 4 | `user.service.ts`, `role.service.ts`, `api-key.service.ts`, `rate-limit.service.ts` |
| 17 | **V3 提取管線** | 19 | `extraction-v3.service.ts`, `stage-orchestrator.service.ts`, `confidence-v3-1.service.ts` |
| 18 | **V2 提取服務** | 3 | `azure-di-document.service.ts`, `data-selector.service.ts`, `gpt-mini-extractor.service.ts` |
| 19 | **統一處理器** | 21 | `unified-document-processor.service.ts`, 11 steps, 7 adapters |
| 20 | **欄位映射/轉換** | 13 | `field-mapping-engine.ts`, `transform-executor.ts`, 5 transform strategies |
| 21 | **Prompt 管理** | 10 | `prompt-resolver.service.ts`, `prompt-cache.service.ts`, `prompt-merge-engine.service.ts` |
| 22 | **模板管理** | 6 | `data-template.service.ts`, `template-matching-engine.service.ts`, `template-export.service.ts` |
| 23 | **參考編號/匯率** | 3 | `reference-number.service.ts`, `region.service.ts`, `exchange-rate.service.ts` |
| 24 | **工具服務** | 5 | `similarity/`, `logging/`, `rule-inference/` |

### 8.3 服務設計模式

```typescript
// 標準服務結構 (Class-based Singleton)
// 檔案: src/services/example.service.ts

/**
 * @fileoverview [服務功能描述]
 * @module src/services/example
 * @since Epic X - Story X.X
 * @lastModified YYYY-MM-DD
 */

import { prisma } from '@/lib/prisma';

export class ExampleService {
  async methodName(input: InputType): Promise<OutputType> {
    try {
      const result = await prisma.model.findMany({...});
      return { ...result };  // 不可變模式
    } catch (error) {
      throw new Error('操作失敗', { cause: error });
    }
  }
}

// 單例導出
export const exampleService = new ExampleService();
```

### 8.4 服務間依賴圖（核心路徑）

```
批次處理主流程:
batch-processor.service.ts
├── processing-router.service.ts
│   ├── azure-di.service.ts (OCR)
│   └── gpt-vision.service.ts (Vision)
├── company-matcher.service.ts
│   └── company.service.ts
├── mapping.service.ts
│   ├── confidence.service.ts
│   └── term-classification.service.ts
└── batch-progress.service.ts

V3.1 提取管線依賴:
extraction-v3.service.ts
├── stages/stage-orchestrator.service.ts
│   ├── stage-1-company.service.ts → company.service.ts
│   ├── stage-2-format.service.ts → document-format.service.ts
│   └── stage-3-extraction.service.ts
│       ├── gpt-caller.service.ts → Azure OpenAI SDK
│       ├── reference-number-matcher.service.ts → reference-number.service.ts
│       └── exchange-rate-converter.service.ts → exchange-rate.service.ts
├── prompt-assembly.service.ts
│   ├── prompt-resolver.service.ts → prompt-resolver.factory.ts
│   └── utils/prompt-builder.ts
├── confidence-v3-1.service.ts
└── result-validation.service.ts

Prompt 系統依賴:
hybrid-prompt-provider.service.ts
├── prompt-resolver.service.ts → prompt-resolver.factory.ts
├── prompt-cache.service.ts
├── prompt-merge-engine.service.ts
├── prompt-variable-engine.service.ts
└── static-prompts.ts
```

---

## 9. 安全與認證

### 9.1 認證架構

```
┌─────────────────────────────────────────────────────────────────┐
│                        認證系統架構                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  NextAuth.js v5 (next-auth@5.0.0-beta.30)               │  │
│  │  ─────────────────────────────────                       │  │
│  │  配置: src/lib/auth.ts                                   │  │
│  │  Adapter: @auth/prisma-adapter (PostgreSQL)              │  │
│  │                                                          │  │
│  │  Provider 1: Azure AD (Entra ID) SSO                     │  │
│  │  ├─ 企業 SSO 登入                                       │  │
│  │  ├─ 自動同步 Azure AD 用戶資料                          │  │
│  │  └─ azureAdId 欄位關聯                                  │  │
│  │                                                          │  │
│  │  Provider 2: Credentials                                 │  │
│  │  ├─ 本地帳號密碼登入                                    │  │
│  │  ├─ bcryptjs 密碼雜湊                                   │  │
│  │  └─ 支援註冊/忘記密碼/重設密碼流程                      │  │
│  │                                                          │  │
│  │  Session: JWT Strategy                                   │  │
│  │  ├─ jose 庫處理 JWT                                     │  │
│  │  └─ Session model 在 Prisma schema                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  API 認證覆蓋率: 61.8% (242/392 endpoints)                      │
│  ⚠️ 150 個端點尚未受認證保護                                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 9.2 RBAC 權限系統

| 角色 | 權限數 | 說明 |
|------|--------|------|
| **SUPER_ADMIN** | 22 (全部) | 超級管理員，擁有所有權限 |
| **ADMIN** | ~18 | 管理員，除系統級配置外全部 |
| **MANAGER** | ~14 | 經理，管理團隊和審核流程 |
| **OPERATOR** | ~10 | 操作員，執行日常操作 |
| **VIEWER** | ~5 | 檢視者，唯讀存取 |
| **AUDITOR** | ~8 | 審計員，查看審計日誌和報告 |

#### 22 項權限清單

```
用戶管理:     USER_READ, USER_WRITE, USER_DELETE
角色管理:     ROLE_MANAGE
文件管理:     DOCUMENT_READ, DOCUMENT_WRITE, DOCUMENT_DELETE
審核管理:     REVIEW_READ, REVIEW_WRITE, REVIEW_APPROVE
規則管理:     RULE_READ, RULE_WRITE, RULE_APPROVE
公司管理:     COMPANY_READ, COMPANY_WRITE
報表管理:     REPORT_READ, REPORT_GENERATE
系統配置:     CONFIG_READ, CONFIG_WRITE
審計管理:     AUDIT_READ, AUDIT_EXPORT
整合管理:     INTEGRATION_MANAGE
管理後台:     ADMIN_ACCESS
```

### 9.3 中間件鏈

```
HTTP 請求
    │
    ▼
┌──────────────┐
│  CORS 中間件  │  → 跨域請求處理
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Rate Limit  │  → src/services/rate-limit.service.ts
│  速率限制    │  → @upstash/redis 實現
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Auth 中間件  │  → NextAuth.js session 驗證
│  認證驗證    │  → RBAC 權限檢查
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Zod 驗證    │  → 輸入參數驗證（63.6% 覆蓋率）
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Route Handler│  → 業務邏輯處理
│  (API 路由)   │  → 呼叫 Service Layer
└──────────────┘
```

### 9.4 安全相關服務

| 服務 | 檔案路徑 | 功能 |
|------|----------|------|
| 加密服務 | `src/services/encryption.service.ts` | 資料加密/解密 |
| 安全日誌 | `src/services/security-log.ts` | 安全事件記錄 |
| API 審計 | `src/services/api-audit-log.service.ts` | API 存取記錄 |
| 速率限制 | `src/services/rate-limit.service.ts` | API 請求限流 |
| API 金鑰 | `src/services/api-key.service.ts` | 外部 API 金鑰管理 |

### 9.5 安全相關資料庫模型

```
SecurityLog         → 安全事件記錄
AuditLog            → 審計日誌（含 immutability trigger）
DataChangeHistory   → 資料變更歷史
ApiAuthAttempt      → API 認證嘗試記錄
ApiAuditLog         → API 審計日誌
```

> **特殊設計**: `prisma/sql/audit_log_immutability.sql` 定義了審計日誌不可變性 trigger，確保 AuditLog 記錄一旦寫入就不可修改或刪除。

---

## 10. 外部整合架構

### 10.1 整合服務概覽

```
┌─────────────────────────────────────────────────────────────────┐
│                      外部整合架構圖                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │  Azure      │    │  Azure      │    │  Azure      │         │
│  │  Document   │    │  OpenAI     │    │  Blob       │         │
│  │  Intelligence│   │  GPT-5.2    │    │  Storage    │         │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘         │
│         │                  │                  │                  │
│         ▼                  ▼                  ▼                  │
│  azure-di.service   gpt-vision.service  @azure/storage-blob    │
│                     extraction-v3/                               │
│                     gpt-caller.service                          │
│                                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │  Azure AD   │    │  SharePoint │    │  Outlook    │         │
│  │  (Entra ID) │    │  Online     │    │  (O365)     │         │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘         │
│         │                  │                  │                  │
│         ▼                  ▼                  ▼                  │
│  next-auth (SSO)    sharepoint-*.service outlook-*.service      │
│  @azure/identity    @microsoft/graph     @microsoft/graph       │
│                                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │  n8n        │    │  Upstash    │    │  Nodemailer │         │
│  │  (Workflow) │    │  Redis      │    │  (Email)    │         │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘         │
│         │                  │                  │                  │
│         ▼                  ▼                  ▼                  │
│  n8n/*.service      @upstash/redis     notification.service     │
│  webhook.service    rate-limit.service                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 10.2 各整合服務詳情

| 外部服務 | 用途 | 套件 | 服務文件 |
|----------|------|------|----------|
| Azure Document Intelligence | OCR 文字辨識 | `@azure/ai-form-recognizer` | `azure-di.service.ts` |
| Azure OpenAI GPT-5.2 | AI 提取/分類 | `openai` | `gpt-vision.service.ts`, `gpt-caller.service.ts` |
| Azure Blob Storage | 文件存儲 | `@azure/storage-blob` | Docker Azurite 本地模擬 |
| Azure AD (Entra ID) | SSO 認證 | `@azure/identity`, `next-auth` | `src/lib/auth.ts` |
| SharePoint | 文件來源抓取 | `@microsoft/microsoft-graph-client` | `sharepoint-*.service.ts` |
| Outlook | 郵件附件抓取 | `@microsoft/microsoft-graph-client` | `outlook-*.service.ts` |
| n8n | 工作流自動化 | Webhook API | `src/services/n8n/*.ts` (9 files) |
| Upstash Redis | 快取/速率限制 | `@upstash/redis` | `rate-limit.service.ts` |
| Nodemailer | 通知郵件 | `nodemailer` | `notification.service.ts` |

---

## 11. 已知問題與技術債

### 11.1 嚴重問題

| # | 問題 | 位置 | 影響 | 修復建議 |
|---|------|------|------|----------|
| 1 | **143 個 console.log 殘留** | `src/services/**/*.ts` | 效能降低、潛在資訊洩漏 | 逐批清理，替換為 logger.service |
| 2 | **認證覆蓋率 61.8%** | `src/app/api/**/*.ts` | 150 個端點無保護 | 優先覆蓋 admin、companies、templates |
| 3 | **Zod 驗證覆蓋率 63.6%** | `src/app/api/**/*.ts` | 143 個端點無輸入驗證 | 所有 POST/PUT/PATCH 必須加 Zod |

### 11.2 中等問題

| # | 問題 | 位置 | 影響 | 修復建議 |
|---|------|------|------|----------|
| 4 | **`any` 類型殘留** | 散布於服務層 | 類型安全風險 | 逐步替換為具體類型或 `unknown` |
| 5 | **重複 Hooks** | `src/hooks/` | 維護混亂 | 合併 `use-alerts.ts` / `useAlerts.ts` 等 |
| 6 | **Hooks 命名不一致** | `src/hooks/` | 程式碼一致性 | 統一為 kebab-case |
| 7 | **93% 使用 'use client'** | `src/components/` | Server Component 優勢未充分利用 | 評估哪些組件可改為 Server Component |

### 11.3 低等問題

| # | 問題 | 位置 | 影響 | 修復建議 |
|---|------|------|------|----------|
| 8 | **Forwarder model deprecated** | `prisma/schema.prisma` | 歷史遺留 | Company model 已取代，計劃移除 |
| 9 | **V2 提取服務仍存在** | `src/services/extraction-v2/` | 代碼冗餘 | 確認無使用後移除 |
| 10 | **部分 index.ts 匯出不完整** | `src/services/*/index.ts` | import 不便 | 定期執行 `npm run index:check` |

### 11.4 技術債務優先級矩陣

```
影響度 ↑
       │
  高   │  [1] console.log    [2] Auth 覆蓋    [3] Zod 驗證
       │
  中   │  [4] any 類型       [5] 重複 Hooks   [7] SSR 未利用
       │
  低   │  [6] 命名一致性     [8] Forwarder    [9] V2 清理
       │
       └──────────────────────────────────────────────────────→
              低                    中                   高
                              修復成本 →
```

---

## 12. 架構成熟度評估

### 12.1 各維度評分表

| 維度 | 評分 (1-5) | 強項 | 弱項 |
|------|-----------|------|------|
| **代碼結構** | 4.0 | 清晰分層、22 類服務分類、標準 JSDoc | 部分命名不一致 |
| **API 設計** | 3.5 | RESTful、RFC 7807 錯誤格式、392 端點 | Auth 61.8%、Zod 63.6% |
| **資料庫設計** | 4.5 | 119 Models、200+ indexes、審計觸發器 | 雙 ID 策略待統一 |
| **前端架構** | 4.0 | 357 組件分類清晰、React Query 資料獲取 | Hooks 命名混亂、SSR 不足 |
| **AI 管線** | 4.5 | V3.1 三階段、六維度信心度、四層配置 | V2/V3 共存需清理 |
| **安全性** | 3.0 | RBAC 完整(22 權限)、JWT、加密服務 | Auth 覆蓋率不足 |
| **國際化** | 4.5 | 31 命名空間、235 files、完整格式化 | 常量→i18n 同步需人工檢查 |
| **外部整合** | 4.0 | 9 個外部服務、完整 webhook 系統 | n8n 為鬆耦合 |
| **可維護性** | 3.5 | 標準化模式、CLAUDE.md 文檔完善 | console.log 殘留、技術債 |
| **測試覆蓋** | 2.0 | 整合測試初步建立 | E2E 不足、單元測試覆蓋率低 |
| **文檔完整度** | 4.5 | claudedocs 體系、CLAUDE.md 各層級 | 部分 API 文檔缺失 |

### 12.2 整體評估

```
整體成熟度分數: 3.77 / 5.0
═══════════════════════════════════════

  █████████████████████████████████████░░░░░░░░░  75.4%

  評級: ⭐⭐⭐⭐ (接近生產就緒)

  優勢領域:
  • AI 提取管線架構成熟（V3.1 三階段 + 六維度信心度）
  • 資料庫設計完善（119 Models + 200+ indexes）
  • 國際化支援完整（31 命名空間、3 語言）
  • 業務服務分類清晰（22 類別、196 services）

  需改善領域:
  • 測試覆蓋率嚴重不足（優先事項）
  • 認證/驗證覆蓋率需提升至 90%+
  • 143 個 console.log 需清理
  • Hooks 命名需統一
```

### 12.3 建議改善優先級

| 優先級 | 任務 | 預計影響 | 預計工作量 |
|--------|------|----------|-----------|
| **P0** | Auth 覆蓋率提升至 90%+ | 安全性大幅提升 | 3-5 天 |
| **P0** | Zod 驗證覆蓋率提升至 90%+ | 資料完整性保障 | 3-5 天 |
| **P1** | 清理 143 個 console.log | 效能+安全 | 1-2 天 |
| **P1** | 建立核心服務單元測試 (80%+) | 品質保障 | 10-15 天 |
| **P2** | Hooks 命名統一 (kebab-case) | 代碼一致性 | 2-3 天 |
| **P2** | 清理 V2 提取服務 | 減少技術債 | 1 天 |
| **P3** | ID 策略統一 (UUID) | 一致性 | 5-8 天 |
| **P3** | E2E 測試建立（關鍵流程） | 端到端品質 | 10-15 天 |

---

## 附錄 A: 關鍵文件索引

### 核心架構文件

| 文件 | 路徑 | 說明 |
|------|------|------|
| 項目根指引 | `CLAUDE.md` | 項目入口文檔 |
| 詳細操作指引 | `.claude/CLAUDE.md` | 服務啟動、問題排解 |
| Prisma Schema | `prisma/schema.prisma` | 119 Models 定義 |
| Package 定義 | `package.json` | 78 prod + 15 dev 依賴 |
| V3 管線入口 | `src/services/extraction-v3/extraction-v3.service.ts` | 提取管線主入口 |
| 信心度計算 | `src/services/extraction-v3/confidence-v3-1.service.ts` | 六維度信心度 |
| 三層映射 | `src/services/mapping.service.ts` | 映射系統核心 |
| 認證配置 | `src/lib/auth.ts` | NextAuth 配置 |
| i18n 配置 | `src/i18n/config.ts` + `routing.ts` + `request.ts` | 國際化配置 |
| Prisma Client | `src/lib/prisma.ts` | 資料庫單例 |

### 服務層文檔

| 文件 | 路徑 | 說明 |
|------|------|------|
| 服務層總覽 | `src/services/CLAUDE.md` | 196 services 分類 |
| V3 管線文檔 | `src/services/extraction-v3/CLAUDE.md` | 19 files 架構 |
| Prisma 文檔 | `prisma/CLAUDE.md` | 119 models 分類 |

### 規範文件

| 文件 | 路徑 | 說明 |
|------|------|------|
| 通用規範 | `.claude/rules/general.md` | JSDoc、命名規範 |
| TypeScript 規範 | `.claude/rules/typescript.md` | 類型、import 規範 |
| API 設計規範 | `.claude/rules/api-design.md` | 響應格式、錯誤處理 |
| 資料庫規範 | `.claude/rules/database.md` | Schema 命名、索引策略 |
| 組件規範 | `.claude/rules/components.md` | 組件結構、狀態管理 |
| 服務規範 | `.claude/rules/services.md` | 三層映射、信心度路由 |
| i18n 規範 | `.claude/rules/i18n.md` | 翻譯、格式化、同步規則 |
| 測試規範 | `.claude/rules/testing.md` | 測試類型、覆蓋率 |
| 技術障礙處理 | `.claude/rules/technical-obstacles.md` | 障礙處理流程 |

---

## 附錄 B: 變更歷史追蹤

### 近期重要變更

| 變更編號 | 說明 | 影響範圍 |
|----------|------|----------|
| CHANGE-021 | V3 統一提取重構 | `extraction-v3/` 全部 |
| CHANGE-024 | V3.1 三階段架構 | `stages/` 新增 |
| CHANGE-025 | Stage Prompt 載入 + 智能路由 | `prompt-assembly.service.ts` |
| CHANGE-026 | Prompt 合併器 + 變數替換器 | `utils/prompt-merger.ts`, `variable-replacer.ts` |
| CHANGE-032 | 管線配置（參考編號/匯率開關） | `pipeline-config.service.ts` |
| CHANGE-033 | CLAUDE.md Token 優化重構 | `CLAUDE.md` v2.6→v3.0 |
| CHANGE-036 | i18n Pipeline Steps 同步 | `documents.json`, `ProcessingTimeline.tsx` |
| CHANGE-037 | 模板匹配工作流改進 | `template-matching-engine.service.ts` |
| FIX-037 | 5 個匯率轉換 bug 修復 | `exchange-rate-converter.service.ts` |
| FIX-038 | matchDocuments 格式 ID 傳遞 | `template-matching-engine.service.ts` |

---

## 附錄 C: 術語表

| 術語 | 說明 |
|------|------|
| **Forwarder** | 貨運代理商（歷史用詞，已被 Company 取代） |
| **Company** | 公司實體（REFACTOR-001 後的正式用詞） |
| **Document Format** | 文件格式模板，定義特定公司的特定發票格式 |
| **Mapping Rule** | 映射規則，將原始術語映射到標準費用分類 |
| **Tier 1/2/3** | 三層映射的三個層級 |
| **Confidence Score** | 信心度分數（0-100），決定處理路由 |
| **Stage 1/2/3** | V3.1 三階段提取（公司識別→格式匹配→欄位提取） |
| **Prompt Config** | GPT Prompt 模板配置，支援四層繼承 |
| **Field Mapping Config** | 欄位映射配置，定義提取欄位到標準欄位的映射 |
| **Pipeline Config** | 管線功能配置，控制功能開關 |
| **Data Template** | 資料模板，定義匯出格式 |
| **Template Instance** | 模板實例，將提取結果填入模板 |
| **Reference Number** | 參考編號，用於交叉比對驗證 |
| **Exchange Rate** | 匯率，用於貨幣轉換 |

---

> **文件生成**: 2026-02-13 由 8 個分析 Agent 並行驗證
> **下次更新建議**: 當發生重大架構變更時（如新增 Epic 或核心模組重構）
> **維護者**: Development Team
