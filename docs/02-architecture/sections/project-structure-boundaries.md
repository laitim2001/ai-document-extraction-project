# 專案結構與邊界

## 需求映射分析

根據 PRD 功能需求，將主要功能領域映射到架構組件：

| 功能領域 | 目錄位置 | 說明 |
|---------|---------|------|
| AI 發票提取 | `src/app/api/extraction/`, `python-services/extraction/` | Azure DI + OpenAI 整合 |
| 智能映射系統 | `src/app/api/mapping/`, `python-services/mapping/` | 三層映射架構 |
| 審核界面 | `src/components/features/review/`, `src/app/(dashboard)/review/` | PDF 對照審核 |
| 信心度分流 | `src/lib/confidence/`, `src/app/api/routing/` | 路由邏輯 |
| Forwarder 管理 | `src/components/features/forwarder/`, `src/app/(dashboard)/forwarders/` | Profile 管理 |
| 持續學習 | `python-services/learning/`, `src/app/api/learning/` | 反饋機制 |
| 儀表板報表 | `src/components/features/dashboard/`, `src/app/(dashboard)/` | KPI 監控 |
| 用戶管理 | `src/app/(dashboard)/admin/`, `src/lib/auth.ts` | Azure AD 整合 |
| 審計日誌 | `src/lib/audit/`, `src/app/api/audit/` | 7 年保留 |

## 完整專案目錄結構

```
ai-document-extraction/
├── .github/
│   └── workflows/
│       ├── ci.yml                    # CI 流程（lint, test, build）
│       ├── cd-staging.yml            # 部署到 Staging
│       └── cd-production.yml         # 部署到 Production
│
├── prisma/
│   ├── schema.prisma                 # 資料庫 Schema
│   ├── migrations/                   # 遷移文件
│   └── seed.ts                       # 種子數據（開發用）
│
├── public/
│   ├── assets/
│   │   ├── images/                   # 靜態圖片
│   │   └── icons/                    # 應用圖示
│   └── locales/                      # i18n 翻譯文件
│       ├── en.json
│       └── zh-TW.json
│
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── globals.css               # 全域樣式
│   │   ├── layout.tsx                # 根佈局（含 Providers）
│   │   ├── page.tsx                  # 首頁（重定向）
│   │   │
│   │   ├── (auth)/                   # 認證群組（無導航）
│   │   │   ├── layout.tsx
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── error/
│   │   │       └── page.tsx
│   │   │
│   │   ├── (dashboard)/              # 主功能群組（含導航）
│   │   │   ├── layout.tsx            # Dashboard 佈局
│   │   │   ├── page.tsx              # 儀表板首頁
│   │   │   │
│   │   │   ├── invoices/             # 發票管理
│   │   │   │   ├── page.tsx          # 發票列表
│   │   │   │   ├── [id]/
│   │   │   │   │   └── page.tsx      # 發票詳情
│   │   │   │   └── upload/
│   │   │   │       └── page.tsx      # 手動上傳
│   │   │   │
│   │   │   ├── review/               # 審核工作台
│   │   │   │   ├── page.tsx          # 待審核列表
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx      # 審核界面（PDF對照）
│   │   │   │
│   │   │   ├── forwarders/           # Forwarder 管理
│   │   │   │   ├── page.tsx          # Forwarder 列表
│   │   │   │   ├── [id]/
│   │   │   │   │   └── page.tsx      # Profile 詳情
│   │   │   │   └── rules/
│   │   │   │       └── page.tsx      # 映射規則管理
│   │   │   │
│   │   │   ├── reports/              # 報表中心
│   │   │   │   ├── page.tsx          # 報表總覽
│   │   │   │   ├── export/
│   │   │   │   │   └── page.tsx      # 匯出設定
│   │   │   │   └── audit/
│   │   │   │       └── page.tsx      # 審計報表
│   │   │   │
│   │   │   ├── admin/                # 管理後台
│   │   │   │   ├── page.tsx          # 系統總覽
│   │   │   │   ├── users/
│   │   │   │   │   └── page.tsx      # 用戶管理
│   │   │   │   ├── settings/
│   │   │   │   │   └── page.tsx      # 系統設定
│   │   │   │   └── logs/
│   │   │   │       └── page.tsx      # 系統日誌
│   │   │   │
│   │   │   └── workflows/            # n8n 工作流監控
│   │   │       └── page.tsx
│   │   │
│   │   └── api/                      # API Routes (BFF)
│   │       ├── auth/
│   │       │   └── [...nextauth]/
│   │       │       └── route.ts      # NextAuth 端點
│   │       │
│   │       ├── invoices/
│   │       │   ├── route.ts          # GET, POST /api/invoices
│   │       │   ├── [id]/
│   │       │   │   └── route.ts      # GET, PATCH, DELETE
│   │       │   ├── upload/
│   │       │   │   └── route.ts      # POST 上傳文件
│   │       │   └── batch/
│   │       │       └── route.ts      # POST 批量操作
│   │       │
│   │       ├── extraction/
│   │       │   ├── route.ts          # POST 觸發提取
│   │       │   └── status/
│   │       │       └── [jobId]/
│   │       │           └── route.ts  # GET 提取狀態
│   │       │
│   │       ├── review/
│   │       │   ├── route.ts          # GET 待審核列表
│   │       │   └── [id]/
│   │       │       ├── route.ts      # GET, PATCH 審核操作
│   │       │       └── approve/
│   │       │           └── route.ts  # POST 批准
│   │       │
│   │       ├── forwarders/
│   │       │   ├── route.ts          # GET, POST /api/forwarders
│   │       │   └── [id]/
│   │       │       ├── route.ts      # GET, PATCH, DELETE
│   │       │       └── rules/
│   │       │           └── route.ts  # 映射規則 CRUD
│   │       │
│   │       ├── mapping/
│   │       │   ├── universal/
│   │       │   │   └── route.ts      # Universal Mapping 規則
│   │       │   └── learning/
│   │       │       └── route.ts      # 學習規則建議
│   │       │
│   │       ├── reports/
│   │       │   ├── route.ts          # GET 報表數據
│   │       │   └── export/
│   │       │       └── route.ts      # POST 匯出請求
│   │       │
│   │       ├── audit/
│   │       │   ├── route.ts          # GET 審計日誌
│   │       │   └── trail/
│   │       │       └── [entityId]/
│   │       │           └── route.ts  # GET 特定實體軌跡
│   │       │
│   │       ├── n8n/
│   │       │   ├── webhook/
│   │       │   │   └── route.ts      # POST n8n 回調
│   │       │   └── trigger/
│   │       │       └── route.ts      # POST 觸發工作流
│   │       │
│   │       └── health/
│   │           └── route.ts          # GET 健康檢查
│   │
│   ├── components/
│   │   ├── ui/                       # shadcn/ui 組件
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── table.tsx
│   │   │   ├── form.tsx
│   │   │   ├── input.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── toast.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── skeleton.tsx
│   │   │   └── ...
│   │   │
│   │   ├── features/                 # 業務功能組件
│   │   │   ├── invoice/
│   │   │   │   ├── InvoiceList.tsx
│   │   │   │   ├── InvoiceCard.tsx
│   │   │   │   ├── InvoiceDetail.tsx
│   │   │   │   ├── InvoiceUploader.tsx
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── review/
│   │   │   │   ├── ReviewQueue.tsx
│   │   │   │   ├── ReviewPanel.tsx       # 主審核界面
│   │   │   │   ├── PdfViewer.tsx         # PDF 顯示
│   │   │   │   ├── FieldEditor.tsx       # 欄位編輯
│   │   │   │   ├── ConfidenceBadge.tsx   # 信心度標籤
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── forwarder/
│   │   │   │   ├── ForwarderList.tsx
│   │   │   │   ├── ForwarderProfile.tsx
│   │   │   │   ├── MappingRuleEditor.tsx
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── dashboard/
│   │   │   │   ├── KpiCards.tsx
│   │   │   │   ├── ProcessingChart.tsx
│   │   │   │   ├── AccuracyTrend.tsx
│   │   │   │   ├── RecentActivity.tsx
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   └── admin/
│   │   │       ├── UserManagement.tsx
│   │   │       ├── SystemHealth.tsx
│   │   │       ├── AuditLogViewer.tsx
│   │   │       └── index.ts
│   │   │
│   │   └── layouts/
│   │       ├── AuthLayout.tsx
│   │       ├── DashboardLayout.tsx
│   │       ├── Sidebar.tsx
│   │       ├── Header.tsx
│   │       └── index.ts
│   │
│   ├── lib/
│   │   ├── prisma.ts                 # Prisma 客戶端單例
│   │   ├── auth.ts                   # NextAuth 配置
│   │   ├── api-client.ts             # API 客戶端封裝
│   │   ├── utils.ts                  # 通用工具函數
│   │   │
│   │   ├── confidence/               # 信心度計算
│   │   │   ├── calculator.ts
│   │   │   ├── thresholds.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── audit/                    # 審計日誌
│   │   │   ├── logger.ts
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── errors/                   # 錯誤處理
│   │   │   ├── app-error.ts
│   │   │   ├── handler.ts
│   │   │   └── index.ts
│   │   │
│   │   └── validations/              # Zod Schemas
│   │       ├── invoice.ts
│   │       ├── forwarder.ts
│   │       ├── user.ts
│   │       └── index.ts
│   │
│   ├── hooks/                        # 自定義 React Hooks
│   │   ├── useInvoices.ts
│   │   ├── useReview.ts
│   │   ├── useForwarders.ts
│   │   ├── useAuth.ts
│   │   ├── usePdfViewer.ts
│   │   └── index.ts
│   │
│   ├── stores/                       # Zustand Stores
│   │   ├── invoice.store.ts
│   │   ├── review.store.ts
│   │   ├── ui.store.ts               # 全域 UI 狀態
│   │   └── index.ts
│   │
│   ├── types/                        # TypeScript 類型
│   │   ├── invoice.ts
│   │   ├── forwarder.ts
│   │   ├── mapping.ts
│   │   ├── user.ts
│   │   ├── api.ts                    # API 響應類型
│   │   └── index.ts
│   │
│   ├── services/                     # 服務層（BFF 業務邏輯）
│   │   ├── invoice.service.ts
│   │   ├── extraction.service.ts
│   │   ├── forwarder.service.ts
│   │   ├── mapping.service.ts
│   │   ├── audit.service.ts
│   │   └── index.ts
│   │
│   └── middleware.ts                 # Next.js 中間件
│
├── python-services/                  # Python AI 服務
│   ├── requirements.txt
│   ├── Dockerfile
│   │
│   ├── extraction/                   # AI 提取服務
│   │   ├── __init__.py
│   │   ├── main.py                   # FastAPI 入口
│   │   ├── azure_di.py               # Azure Document Intelligence
│   │   ├── openai_vision.py          # OpenAI 多模態
│   │   └── processor.py              # 提取處理器
│   │
│   ├── mapping/                      # 映射服務
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── universal.py              # Universal Mapping
│   │   ├── forwarder_specific.py     # Forwarder Profile
│   │   └── matcher.py                # 匹配引擎
│   │
│   ├── learning/                     # 學習服務
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── feedback.py               # 反饋處理
│   │   ├── rule_generator.py         # 規則生成
│   │   └── confidence.py             # 信心度計算
│   │
│   └── shared/                       # 共用模組
│       ├── __init__.py
│       ├── config.py
│       ├── models.py                 # Pydantic Models
│       └── database.py               # DB 連接
│
├── tests/
│   ├── unit/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── lib/
│   ├── integration/
│   │   ├── api/
│   │   └── services/
│   └── e2e/
│       ├── auth.spec.ts
│       ├── review.spec.ts
│       └── invoice.spec.ts
│
├── .env.example                      # 環境變數範例
├── .env.local                        # 本地環境變數（不進版控）
├── .gitignore
├── .eslintrc.json
├── .prettierrc
├── components.json                   # shadcn/ui 配置
├── docker-compose.yml                # 本地開發環境
├── next.config.js
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── README.md
```

## 架構邊界定義

### API 邊界

| 邊界層 | 描述 | 技術 |
|-------|------|------|
| Client → BFF | Next.js API Routes 作為前端後端 | REST API + React Query |
| BFF → Python Services | 內部服務通信 | REST API（內網） |
| BFF → Azure AI | AI 服務調用 | Azure SDK |
| BFF → n8n | 工作流觸發 | Webhook + REST |

### 數據邊界

| 數據類型 | 存儲位置 | 訪問模式 |
|---------|---------|---------|
| 業務數據 | PostgreSQL | Prisma ORM |
| 文件存儲 | Azure Blob / SharePoint | Azure SDK |
| 緩存數據 | Azure Redis | 會話、熱數據 |
| 審計日誌 | PostgreSQL（獨立表） | 僅新增 |

### 服務邊界

| 服務 | 職責 | 邊界 |
|------|------|------|
| Next.js App | UI + BFF | 不直接訪問 AI 服務 |
| Extraction Service | AI 提取 | 不存取業務數據庫 |
| Mapping Service | 規則匹配 | 只讀映射規則 |
| Learning Service | 學習反饋 | 只寫學習庫 |

## 需求到結構映射

### 功能需求映射

| 功能需求 | 前端組件 | API 端點 | 服務/數據 |
|---------|---------|---------|---------|
| 發票處理隊列 | `ReviewQueue.tsx` | `/api/review` | `review.service.ts` |
| PDF 對照審核 | `ReviewPanel.tsx`, `PdfViewer.tsx` | `/api/review/[id]` | Azure Blob |
| 信心度分流 | `ConfidenceBadge.tsx` | `/api/routing` | `confidence/` |
| Forwarder Profile | `ForwarderProfile.tsx` | `/api/forwarders` | `forwarder.service.ts` |
| 映射規則管理 | `MappingRuleEditor.tsx` | `/api/mapping` | `mapping.service.ts` |
| KPI 儀表板 | `KpiCards.tsx`, `ProcessingChart.tsx` | `/api/reports` | Prisma aggregation |
| 審計追溯 | `AuditLogViewer.tsx` | `/api/audit` | `audit.service.ts` |
| 用戶管理 | `UserManagement.tsx` | `/api/admin/users` | Azure AD |

### 橫切關注點映射

| 關注點 | 實現位置 |
|-------|---------|
| 認證 | `src/lib/auth.ts`, `src/middleware.ts` |
| 授權 | `src/middleware.ts`, API Route guards |
| 審計日誌 | `src/lib/audit/`, `src/services/audit.service.ts` |
| 錯誤處理 | `src/lib/errors/`, API Route wrappers |
| 驗證 | `src/lib/validations/` (Zod schemas) |

## 開發工作流整合

### 本地開發

```bash
# 啟動開發環境
docker-compose up -d          # PostgreSQL + Redis
npx prisma migrate dev        # 資料庫遷移
npm run dev                   # Next.js 開發服務器
cd python-services && uvicorn extraction.main:app --reload  # Python 服務
```

### CI/CD 流程

```
Push → GitHub Actions
  ├── Lint (ESLint + Prettier)
  ├── Type Check (TypeScript)
  ├── Unit Tests (Jest/Vitest)
  ├── Integration Tests
  ├── Build
  └── Deploy (Staging/Production)
```

---
