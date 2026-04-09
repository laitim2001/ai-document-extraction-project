# AI Document Extraction Project - Codebase Analysis Raw Data

> **收集日期**: 2026-02-27
> **驗證日期**: 2026-02-28（二次驗證：逐項命令行核實，修正 10 項錯誤）
> **收集方式**: 10 個分析 Agent 並行深度代碼庫驗證 → 二次命令行逐項驗證
> **用途**: 作為撰寫最終分析報告的數據來源

---

## 1. 代碼庫規模統計

### 1.1 總體規模

| 指標 | 數量 |
|------|------|
| **Total TS/TSX files in src/** | 1,363 |
| **Total LOC (TypeScript)** | ~375,270 |
| **Python Services LOC** | 2,719 (12 files) |
| **Prisma Schema** | 4,354 lines, 122 models, 113 enums |
| **i18n Files** | 102 JSON (34 namespaces × 3 languages) |
| **Test files** | 1 (minimal) |
| **Package dependencies** | 77 production + 20 dev |

### 1.2 按目錄分類

| 目錄 | 文件數 | LOC | 說明 |
|------|--------|-----|------|
| `src/services/` | 200 | 99,635 | 核心業務邏輯（111 flat + 89 in subdirs） |
| `src/components/` | 429 | 98,252 | React 組件（34 UI + 358 features + 5 layout + 32 other） |
| `src/app/api/` | 331 route.ts | 66,787 | API 路由（~414 端點） |
| `src/types/` | 93 | 38,749 | TypeScript 類型定義 |
| `src/hooks/` | 104 | 28,528 | 自定義 Hooks |
| `src/app/[locale]/` | 104 | 19,992 | 頁面文件（81 pages + 3 layouts + 其他） |
| `messages/` | 102 | 18,765 | i18n 翻譯 |
| `src/lib/` | 68 | 15,955 | 工具庫和驗證邏輯 |
| `src/constants/` | 5 | 1,674 | 常量定義 |
| `src/middlewares/` | 5 | 1,435 | 中間件 |
| `src/validations/` | 6 | 1,340 | Zod 驗證 Schema |
| `src/contexts/` | 2 | 648 | React Context |
| `src/config/` | 2 | 423 | 應用配置 |
| `src/jobs/` | 2 | 360 | 背景任務 |
| `src/i18n/` | 3 | 195 | i18n 配置 |
| `src/events/` | 1 | 165 | 事件定義 |
| `src/providers/` | 3 | 163 | React Provider |
| `src/middleware.ts` | 1 | 182 | Next.js middleware |
| `src/app/` (root) | 2 | 41 | layout.tsx + page.tsx |
| `prisma/` | 1 schema | 4,354 | Prisma ORM Schema |
| `python-services/` | 12 | 2,719 | Python OCR + Mapping |
| `src/stores/` | 2 | 746 | Zustand 狀態管理 |

### 1.3 API 路由統計

| HTTP 方法 | 文件數 | 佔比 |
|-----------|--------|------|
| GET | 201 | 60.7% |
| POST | 141 | 42.6% |
| PATCH | 33 | 10% |
| DELETE | 31 | 9% |
| PUT | 8 | 2% |
| **估計總端點** | **~414** | avg 1.25 methods/file |

### 1.4 API 領域分佈

| 領域 | Route 文件數 | 主要功能 |
|------|-------------|---------|
| `/admin/*` | 106 | Alerts, Backups, Config, Health, Integrations, Logs, Users |
| `/v1/*` | 77 | Batches, Formats, Field Mapping, Prompt Configs, Templates |
| `/rules/*` | 20 | Mapping rule management |
| `/documents/*` | 19 | Document CRUD and processing |
| `/reports/*` | 12 | Report generation and download |
| `/companies/*` | 12 | Company management |
| `/auth/*` | 7 | NextAuth + local auth |
| `/audit/*` | 7 | Audit reporting |
| `/workflows/*` | 5 | n8n workflow management |
| Others | 66 | Reviews, Dashboard, Cost, Cities, Analytics, etc. |

### 1.5 Auth & Zod 覆蓋率

- **Auth check**: 192/331 route files = **58.0%**
- **Zod validation**: 213/331 = **64.4%**

> **Auth 認證模式**: 項目使用 `import { auth } from '@/lib/auth'` → `const session = await auth()` → `if (!session?.user)` 模式。192 個 route 使用此模式進行認證檢查。139 個 route 無認證保護（包含公開端點如 health check、auth 路由等）。

---

## 2. 前端架構

### 2.1 頁面結構（81 pages + 3 layouts）

| 分類 | 數量 | 路徑 |
|------|------|------|
| 認證頁面 | 6 | `(auth)/auth/` (login, register, forgot-password, reset-password, verify-email, error) |
| 儀表板首頁 | 1 | `(dashboard)/dashboard/` |
| 文件管理 | 3 | `(dashboard)/documents/` (list, upload, [id]) |
| 審核流程 | 2 | `(dashboard)/review/` (queue, [id]) |
| 規則管理 | 6 | `(dashboard)/rules/` (list, new, [id], edit, history, review) |
| 公司管理 | 5 | `(dashboard)/companies/` (list, new, [id], edit, formats, rules) |
| 升級處理 | 2 | `(dashboard)/escalations/` (list, [id]) |
| 報表 | 4 | `(dashboard)/reports/` (monthly, cost, ai-cost, regional) |
| 管理頁面 | 33+ | `(dashboard)/admin/` (users, roles, alerts, backup, config, logs, etc.) |
| 其他功能 | 5+ | global, profile, template-instances, docs |
| 根級頁面 | 2 | `/`, `/[locale]/` |

### 2.2 組件統計

| 類別 | 數量 | 說明 |
|------|------|------|
| shadcn/ui 基礎 (`ui/`) | 34 | button, dialog, table, form, etc. |
| 功能組件 (`features/`) | 358 | 38 個子目錄（306 tsx + 52 ts barrel exports） |
| 佈局組件 (`layout/`) | 5 | DashboardHeader, Sidebar, TopBar, etc. |
| 其他頂層組件 | 32 | dashboard(10), reports(8), audit(4), filters(3), admin(2), analytics(2), export(2), auth(1) |
| **總計** | **429** | |

> **計數方式說明**: 總計包含所有 `.ts` + `.tsx` 文件。功能組件中 52 個 `.ts` 文件主要為 `index.ts` barrel export。

### 2.3 功能組件子目錄（38 個）

> **計數方式**: tsx + ts（含 index.ts barrel export）

| 目錄 | tsx | ts | 合計 | Epic |
|------|-----|-----|------|------|
| admin/ | 47 | 10 | 57 | Epic 1, 12 |
| review/ | 27 | 5 | 32 | Epic 3 |
| rules/ | 22 | 1 | 23 | Epic 4 |
| formats/ | 17 | 1 | 18 | Epic 16 |
| historical-data/ | 16 | 2 | 18 | Epic 0 |
| template-instance/ | 13 | 2 | 15 | Epic 19 |
| forwarders/ | 12 | 1 | 13 | Epic 5 (legacy) |
| document/ | 11 | 2 | 13 | Epic 2 |
| template-field-mapping/ | 11 | 1 | 12 | Epic 19 |
| prompt-config/ | 10 | 1 | 11 | Epic 14 |
| document-preview/ | 10 | 1 | 11 | Epic 13 |
| mapping-config/ | 9 | 1 | 10 | Epic 13 |
| reference-number/ | 8 | 1 | 9 | Epic 20 |
| field-definition-set/ | 7 | 1 | 8 | Epic 19 |
| suggestions/ | 6 | 1 | 7 | Epic 4 |
| rule-review/ | 6 | 1 | 7 | Epic 4 |
| exchange-rate/ | 6 | 1 | 7 | Epic 21 |
| escalation/ | 6 | 1 | 7 | Epic 3 |
| template-match/ | 5 | 1 | 6 | Epic 19 |
| retention/ | 5 | 1 | 6 | Epic 12 |
| document-source/ | 5 | 1 | 6 | Epic 9 |
| data-template/ | 5 | 1 | 6 | Epic 19 |
| pipeline-config/ | 4 | 1 | 5 | CHANGE-032 |
| global/ | 4 | 1 | 5 | Epic 6 |
| docs/ | 4 | 1 | 5 | Epic 11 |
| rule-version/ | 3 | 1 | 4 | Epic 4 |
| reports/ | 3 | 1 | 4 | Epic 7 |
| outlook/ | 3 | 1 | 4 | Epic 9 |
| confidence/ | 3 | 1 | 4 | Epic 2 |
| audit/ | 3 | 1 | 4 | Epic 8 |
| auth/ | 3 | 0 | 3 | Epic 18 |
| term-analysis/ | 2 | 1 | 3 | Epic 0 |
| sharepoint/ | 2 | 1 | 3 | Epic 9 |
| history/ | 2 | 1 | 3 | Epic 8 |
| format-analysis/ | 2 | 1 | 3 | Epic 16 |
| companies/ | 2 | 1 | 3 | Epic 5 |
| region/ | 1 | 1 | 2 | Epic 20 |
| locale/ | 1 | 0 | 1 | Epic 17 |
| **合計** | **306** | **52** | **358** | |

### 2.4 Hooks 統計（104 個）

按功能分類：
- 文件處理: 12
- 審核升級: 7
- 規則管理: 12
- 公司管理: 8
- 城市區域: 5
- 儀表板統計: 6
- 審計追蹤: 5
- 系統管理: 11
- 認證權限: 3
- 外部整合: 7
- 配置管理: 3
- 術語影響: 5
- 模板管理: 4
- 參考編號匯率: 2
- i18n 本地化: 5
- UI 工具: 4
- AI 成本: 1

**命名風格**: kebab-case (~61) + camelCase (~43)

### 2.5 狀態管理

| Store | 文件 | 用途 |
|-------|------|------|
| reviewStore | `src/stores/reviewStore.ts` | 審核 UI 狀態 |
| document-preview-test | `src/stores/document-preview-test-store.ts` | 文件預覽測試 |

**架構**: Zustand 5.x (UI) + React Query 5.x (Server) + React Hook Form 7.x (表單)

---

## 3. 服務層分析

### 3.1 服務分類（22 類）

| # | 分類 | 文件數 | 關鍵服務 |
|---|------|--------|----------|
| 1 | 核心處理 | 11 | document, extraction, batch-processor, document-progress |
| 2 | AI/OCR | 10 | gpt-vision (1199 LOC), azure-di, confidence |
| 3 | 映射與規則 | 12 | mapping, rule-resolver, rule-testing |
| 4 | 公司管理 | 6 | company (1720 LOC), company-matcher, file-detection |
| 5 | 城市與區域 | 6 | city, regional-manager |
| 6 | 報表與統計 | 6 | dashboard-statistics, expense-report |
| 7 | 審計與追蹤 | 6 | audit-log, change-tracking, traceability |
| 8 | 審核工作流 | 3 | invoice-submission, routing |
| 9 | 警報與通知 | 5 | alert, notification |
| 10 | 備份與資料 | 5 | backup (1120 LOC), restore (1017 LOC), data-retention (1150 LOC) |
| 11 | 外部整合 | 20+ | n8n (9), outlook (3), sharepoint (2), webhook (3) |
| 12 | 系統管理 | 7 | health-check, performance, system-config (1553 LOC) |
| 13 | 用戶與權限 | 4 | user, role, api-key, rate-limit |
| 14 | 工具服務 | 8 | logging (2), similarity (3), encryption |
| 15 | V3 管線 | 17 | extraction-v3, stages (7), utils (4) |
| 16 | V2 管線 | 3 | azure-di-document, gpt-mini-extractor |
| 17 | 統一處理器 | 21 | unified-processor (11 steps + 7 adapters) |
| 18 | 欄位映射 | 13 | mapping (6), transform (7) |
| 19 | Prompt 管理 | 9 | prompt-resolver, prompt-cache |
| 20 | 模板管理 | 6 | data-template, template-matching |
| 21 | 參考編號/匯率 | 3 | reference-number, exchange-rate |
| 22 | 管線配置 | 1 | pipeline-config |

### 3.2 V3/V3.1 提取管線

**V3.1 三階段管線（CHANGE-024/025/026）:**
```
FILE_PREP →
Stage 1 (GPT-5-nano): 公司識別 →
Stage 2 (GPT-5-nano): 格式匹配 →
Stage 3 (GPT-5.2): 欄位提取
  ├─ 參考編號匹配 (CHANGE-032)
  └─ 匯率轉換 (CHANGE-032)
→ TERM_RECORDING → CONFIDENCE → ROUTING
```

**管線文件結構:**
```
extraction-v3/
├── extraction-v3.service.ts (1238 LOC) — 主服務
├── confidence-v3.service.ts — V3 信心度（5 維度）
├── confidence-v3-1.service.ts — V3.1 信心度（5 維度 + 配置加成）
├── prompt-assembly.service.ts — Prompt 組裝
├── result-validation.service.ts — 結果驗證
├── unified-gpt-extraction.service.ts — 統一 GPT 提取
├── stages/
│   ├── stage-orchestrator.service.ts — 三階段協調器
│   ├── stage-1-company.service.ts — 公司識別
│   ├── stage-2-format.service.ts — 格式匹配
│   ├── stage-3-extraction.service.ts (1451 LOC) — 欄位提取
│   ├── gpt-caller.service.ts — GPT API 調用
│   ├── reference-number-matcher.service.ts — 參考編號
│   └── exchange-rate-converter.service.ts — 匯率轉換
├── utils/
│   ├── pdf-converter.ts
│   ├── prompt-builder.ts
│   ├── prompt-merger.ts
│   ├── variable-replacer.ts
│   └── classify-normalizer.ts
└── index.ts
```

### 3.3 統一處理器框架

```
unified-processor/
├── unified-document-processor.service.ts — 主處理器
├── interfaces/step-handler.interface.ts — 步驟介面
├── factory/step-factory.ts — 步驟工廠
├── steps/ (11 個)
│   ├── azure-di-extraction.step.ts
│   ├── confidence-calculation.step.ts
│   ├── config-fetching.step.ts
│   ├── field-mapping.step.ts
│   ├── file-type-detection.step.ts
│   ├── format-matching.step.ts
│   ├── gpt-enhanced-extraction.step.ts
│   ├── issuer-identification.step.ts
│   ├── routing-decision.step.ts
│   ├── smart-routing.step.ts
│   └── term-recording.step.ts
├── adapters/ (7 個)
│   ├── confidence-calculator-adapter.ts
│   ├── config-fetcher-adapter.ts
│   ├── format-matcher-adapter.ts
│   ├── issuer-identifier-adapter.ts
│   ├── legacy-processor.adapter.ts
│   ├── routing-decision-adapter.ts
│   └── term-recorder-adapter.ts
└── index.ts
```

### 3.4 欄位映射引擎

```
mapping/ (7 files)
├── dynamic-mapping.service.ts — 動態映射引擎
├── config-resolver.ts — 三層配置解析 (FORMAT → COMPANY → GLOBAL)
├── field-mapping-engine.ts — 欄位映射引擎
├── mapping-cache.ts — 映射快取
├── source-field.service.ts — 來源欄位服務
├── transform-executor.ts — 轉換執行器
└── index.ts

transform/ (7 files)
├── core/ (5 transforms: direct, concat, split, formula, lookup)
├── transform-engine.ts — 轉換引擎
└── index.ts
```

### 3.5 信心度維度

**V3 (5 維度):**
- EXTRACTION (30%), ISSUER_IDENTIFICATION (20%), FORMAT_MATCHING (15%)
- FIELD_COMPLETENESS (20%), HISTORICAL_ACCURACY (15%)

**V3.1 (5 維度 + 配置加成):**
- STAGE_1_COMPANY (20%), STAGE_2_FORMAT (15%), STAGE_3_EXTRACTION (30%)
- FIELD_COMPLETENESS (20%), CONFIG_SOURCE_BONUS (15%)
  - COMPANY_SPECIFIC: +5%, UNIVERSAL: +3%, LLM_INFERRED: 0%

---

## 4. 資料庫分析

### 4.1 模型分類（122 models, 113 enums）

| 領域 | Model 數量 | 代表模型 |
|------|-----------|---------|
| 用戶與權限 | 8 | User, Role, UserRole, UserCityAccess, UserRegionAccess |
| 地區與城市 | 2 | Region, City |
| 文件處理核心 | 7 | Document, OcrResult, ExtractionResult, ProcessingQueue |
| 公司管理 | 3 | Company, Forwarder (deprecated), ForwarderIdentification |
| 映射與規則 | 12 | MappingRule, RuleSuggestion, RuleVersion, FieldMappingConfig |
| 審核工作流 | 7 | ReviewRecord, Correction, Escalation, Notification |
| 審計與安全 | 5 | AuditLog, SecurityLog, DataChangeHistory |
| 報表與統計 | 6 | ReportJob, MonthlyReport, ProcessingStatistics |
| AI 成本追蹤 | 3 | ApiUsageLog, ApiPricingConfig, ApiPricingHistory |
| 系統配置 | 3 | SystemConfig, ConfigHistory, PipelineConfig |
| 資料保留 | 4 | DataRetentionPolicy, DataArchiveRecord |
| SharePoint 整合 | 3 | SharePointConfig, SharePointFetchLog, ApiKey |
| Outlook 整合 | 3 | OutlookConfig, OutlookFilterRule, OutlookFetchLog |
| n8n 工作流 | 4 | N8nApiKey, N8nApiCall, N8nWebhookEvent |
| 工作流定義 | 5 | WorkflowExecution, WorkflowDefinition, WebhookConfig |
| 外部 API | 6 | ExternalApiTask, ExternalWebhookDelivery |
| 效能監控 | 11 | ServiceHealthCheck, ApiPerformanceMetric |
| 警報系統 | 5 | AlertRule, Alert, AlertNotificationConfig |
| 備份與還原 | 7 | Backup, BackupSchedule, RestoreRecord |
| 系統日誌 | 3 | SystemLog, LogRetentionPolicy, LogExport |
| 歷史批次 | 4 | HistoricalBatch, HistoricalFile, TermAggregationResult |
| Prompt 配置 | 2 | PromptConfig, PromptVariable |
| 模板管理 | 4 | DataTemplate, TemplateFieldMapping, TemplateInstance |
| 參考編號/匯率 | 2 | ReferenceNumber, ExchangeRate |
| 欄位定義 | 2 | FieldDefinitionSet, PipelineConfig |

### 4.2 ID 策略

| 策略 | 數量 | 佔比 |
|------|------|------|
| `@default(uuid())` | 47 | 38.5% |
| `@default(cuid())` | 74 | 60.7% |
| 其他 | 1 | 0.8% |

### 4.3 索引與約束
- 索引定義 (`@@index`): 439 個
- 唯一約束: 73 個（30 個 `@@unique` 複合約束 + 43 個 `@unique` 欄位級約束）
- 遷移: 10 個

---

## 5. i18n 分析

### 5.1 命名空間列表（34 個/語言）

```
admin, auth, common, companies, confidence, dashboard, dataTemplates,
dialogs, documentPreview, documents, errors, escalation, exchangeRate,
fieldDefinitionSet, fieldMappingConfig, formats, global, historicalData,
navigation, pipelineConfig, profile, promptConfig, referenceNumber,
region, reports, review, rules, standardFields, systemSettings,
templateFieldMapping, templateInstance, templateMatchingTest,
termAnalysis, validation
```

### 5.2 語言同步狀態
- en: 34 files ✅
- zh-TW: 34 files ✅
- zh-CN: 34 files ✅

---

## 6. Python 服務

### 6.1 Extraction Service (port 8000)
- Azure Document Intelligence OCR
- API: POST /extract/url, POST /extract/file, GET /health

### 6.2 Mapping Service (port 8001)
- Forwarder 識別 + 三層欄位映射
- API: POST /identify, POST /map-fields, GET /forwarders, GET /health

---

## 7. 外部整合

| 整合 | 套件 | 用途 |
|------|------|------|
| Azure Blob Storage | @azure/storage-blob@12.29 | 文件存儲 |
| Azure OpenAI | openai@6.15 | GPT-5.2 提取 |
| Azure Document Intelligence | Python SDK | OCR |
| Azure Identity | @azure/identity@4.13 | 認證 |
| Microsoft Graph | @microsoft/microsoft-graph-client@3.0 | SharePoint/Outlook |
| react-pdf | react-pdf@9.2.1 | PDF 渲染 |
| pdfjs-dist | pdfjs-dist@4.10.38 | PDF 解析 |
| pdf-parse | pdf-parse@1.1.1 | 文本提取 |
| pdf-to-img | pdf-to-img@5.0.0 | PDF 轉圖片 |
| pdfkit | pdfkit@0.17.2 | PDF 生成 |
| ExcelJS | exceljs@4.4.0 | Excel 報表 |
| Upstash Redis | @upstash/redis@1.35.8 | 快取/速率限制 |
| dnd-kit | @dnd-kit/core@6.3 | 拖放 UI |
| Nodemailer | nodemailer@7.0.12 | 電郵通知 |
| next-intl | next-intl@4.7.0 | i18n |

---

## 8. 代碼品質問題

### 8.1 嚴重性分類

| 嚴重度 | 問題 | 數量 | 說明 |
|--------|------|------|------|
| 🔴 CRITICAL | `any` 類型 | 18 處 (13 files) | 違反專案規範 |
| 🔴 CRITICAL | `console.log` | 287 處 (94 files) | 應移除 |
| 🟠 HIGH | TODO/FIXME | 42 處 (27 files) | 未完成功能 |
| 🟠 HIGH | Files >1000 lines | 16 files | 需拆分 |
| 🟡 MEDIUM | Auth coverage | 58.0% (192/331) | `auth()` 認證模式；42.0% 未保護需評估 |
| 🟡 MEDIUM | Raw SQL | 15 處 (9 files) | SQL 注入風險低（Prisma）但數量需關注 |
| 🟡 MEDIUM | Zod coverage | 64.4% (213/331) | API 驗證覆蓋率 |
| 🟢 LOW | Naming inconsistency | ~43 hooks | camelCase vs kebab-case |

### 8.2 console.log 分佈

| 目錄 | 數量 | Top files |
|------|------|-----------|
| services | 187 | gpt-vision(25), example-generator(22), batch-processor(21) |
| app/api | 32 | - |
| lib | 29 | auth.config.ts(9) |
| hooks | 20 | - |
| components | 4 | - |

### 8.3 最大文件（16 files >1000 LOC）

| 文件 | LOC |
|------|-----|
| extraction-v3.types.ts | 1,738 |
| company.service.ts | 1,720 |
| system-config.service.ts | 1,553 |
| field-mapping.ts (types) | 1,537 |
| stage-3-extraction.service.ts | 1,451 |
| batch-processor.service.ts | 1,356 |
| extraction-v3.service.ts | 1,238 |
| gpt-vision.service.ts | 1,199 |
| data-retention.service.ts | 1,150 |
| example-generator.service.ts | 1,139 |
| invoice-fields.ts (types) | 1,126 |
| backup.service.ts | 1,120 |
| exchange-rate.service.ts | 1,110 |
| company.ts (types) | 1,061 |
| city-cost-report.service.ts | 1,045 |
| restore.service.ts | 1,017 |

### 8.4 正面發現
- ✅ 0 hardcoded secrets/passwords
- ✅ 0 XSS vulnerabilities (no dangerouslySetInnerHTML)
- ✅ 100% JSDoc compliance (111/111 services)
- ✅ Consistent RFC 7807 error handling
- ✅ All imports use @/ alias correctly

---

## 9. 技術棧

### 核心框架
- Next.js 15.0.0, React 18.3, TypeScript 5.0
- Prisma 7.2 (122 models)
- Tailwind CSS 3.4 + shadcn/ui (34 primitives)
- Zustand 5.x + React Query 5.x
- React Hook Form 7.x + Zod 4.x
- next-intl 4.7 (en, zh-TW, zh-CN)

### Docker 服務
- PostgreSQL 15 (port 5433)
- pgAdmin (port 5050)
- Azurite Blob (port 10010), Queue (10011), Table (10012)
- Python Extraction Service (port 8000)
- Python Mapping Service (port 8001)

---

## 10. 項目狀態

- **22 個 Epic** (157+ Stories) 全部完成
- **Phase 2**: 52 CHANGE (001-052) + 48 FIX (001-048)
- **項目使命**: AI 驅動文件內容提取與自動分類系統
- **目標**: 450,000-500,000 invoices/year (APAC), 90-95% 自動化率, 90-95% 準確率

---

## 11. 核心架構 - 三層映射系統

```
┌─────────────────────────────────────────────────────────────────┐
│ TIER 1: Universal Mapping（通用層）                              │
│ • 覆蓋 70-80% 常見術語，所有 Forwarder 通用                      │
├─────────────────────────────────────────────────────────────────┤
│ TIER 2: Forwarder-Specific Override（特定覆蓋層）                │
│ • 只記錄該 Forwarder 與通用規則「不同」的映射                    │
├─────────────────────────────────────────────────────────────────┤
│ TIER 3: LLM Classification（AI 智能分類）                        │
│ • 當以上都無法匹配時，使用 GPT-5.2 智能分類                      │
└─────────────────────────────────────────────────────────────────┘
```

### 信心度路由
- ≥95% → AUTO_APPROVE
- 80-94% → QUICK_REVIEW
- <80% → FULL_REVIEW
- V3.1 智能降級: 新公司 → 強制 FULL_REVIEW; 新格式 → 強制 QUICK_REVIEW

---

## 12. 端到端流程

```
Document Upload → Azure Blob Storage → OCR (Azure Document Intelligence)
→ Three-Stage Extraction (V3.1: Company ID → Format Match → Field Extraction)
→ Three-Tier Mapping (Universal → Forwarder-Specific → LLM)
→ Confidence Scoring (5 dimensions + config bonus)
→ Routing Decision (AUTO_APPROVE / QUICK_REVIEW / FULL_REVIEW)
→ Review Workflow (if needed)
→ Template Matching → Export (Excel/PDF)
```

---

## 13. 功能完成度

### 13.1 全部 22 個 Epic (✅ 已完成)

| Epic | 名稱 | 功能數 | 狀態 |
|------|------|--------|------|
| 0 | Historical Data & Batch Processing | 4 | ✅ |
| 1 | User Management & Auth | 2 | ✅ |
| 2 | Document Upload & AI Processing | 4 | ✅ |
| 3 | Review Workflow | 3 | ✅ |
| 4 | Mapping Rules & Auto-Learning | 4 | ✅ |
| 5 | Company/Forwarder Management | 1 | ✅ |
| 6 | City & Regional Management | 2 | ✅ |
| 7 | Reports & Analytics | 2 | ✅ |
| 8 | Audit & Compliance | 1 | ✅ |
| 9 | External Integrations | 2 | ✅ |
| 10 | n8n Workflow Integration | 1 | ✅ |
| 11 | API Documentation & Webhooks | 2 | ✅ |
| 12 | System Administration | 6 | ✅ |
| 13 | Document Preview & Field Mapping | 2 | ✅ |
| 14 | Prompt Configuration | 1 | ✅ |
| 15 | Extraction V3 Pipeline | 1 | ✅ |
| 16 | Document Format Management | 1 | ✅ |
| 17 | Internationalization | 1 | ✅ |
| 18 | Local Account Auth | 1 | ✅ |
| 19 | Template System | 4 | ✅ |
| 20 | Reference Numbers & Regions | 2 | ✅ |
| 21 | Exchange Rate Management | 1 | ✅ |
| 22 | System Settings Hub | 1 | ✅ |

### 13.2 CHANGE/FIX 統計
- 52 個 CHANGE（功能變更，CHANGE-001 ~ CHANGE-052，其中 CHANGE-005 有 2 個重複文件）
- 48 個 FIX（Bug 修復，FIX-001 ~ FIX-048，其中 FIX-019/024/026 各有 2 個重複文件）

---

*數據收集完成: 2026-02-27*
*初次驗證: 2026-02-27（4 Agent 交叉核實）*
*二次驗證: 2026-02-28（逐項命令行核實，修正 3 項嚴重錯誤 + 4 項中等錯誤 + 3 項輕微錯誤）*
*三次驗證: 2026-02-28（GET/POST 路由數回正：225→201, 148→141。二次驗證中誤用包含 CLAUDE.md 的寬泛 grep 導致錯誤修正）*
*修正項目: Total LOC (+26,618), Components 文件數 (+84), Auth 覆蓋率 (-14.8%), Hooks/Pages/Layouts 微調, Prisma 唯一約束補全, 遺漏 9 個 src 子目錄, 補全大文件清單, GET/POST 回正*
*下一步: 使用此數據撰寫最終分析報告*
