# Batch 1 - Agent A: 架構層級深度分析

> **分析日期**: 2026-02-27
> **驗證日期**: 2026-02-28（命令行逐項核實，修正 14 項錯誤：6 嚴重 + 5 中等 + 3 輕微）
> **Agent**: arch-layer-analyst (Explore)
> **方法**: 實際代碼掃描 + Glob/Grep/wc -l 統計

---

## 架構層級總覽表

| 層級 | 名稱 | 路徑 | 檔案數 | LOC | 狀態 | 關鍵特徵 |
|------|------|------|--------|-----|------|---------|
| **L1** | 前端展示層 | `src/app/`, `src/components/` | 429 | ~118K | ✅ | 429 組件 (34 UI + 358 features + 5 layout + 32 other), shadcn/ui, 81 頁面 ([locale]) |
| **L2** | API 路由層 | `src/app/api/` | 331 | ~67K | ✅ | ~414 端點, RFC 7807 錯誤格式, Auth 58.0%, Zod 64% |
| **L3** | 業務服務層 | `src/services/` | 200 | ~100K | ✅ | 22 分類, 三層映射, 工廠+適配器模式 |
| **L4** | AI 提取管線層 | `extraction-v3/`, `unified-processor/` | 42 | ~18K | ✅ | V3/V3.1 7 步, 三階段分離, 信心度路由 |
| **L5** | 映射與規則引擎 | `mapping/`, `transform/`, `rule-*.ts` | 31 | ~10K | ✅ | 三層映射系統, 7 轉換策略, 規則推斷 |
| **L6** | 資料存取層 | `prisma/` | 1 schema | ~4.4K | ✅ | 122 models, 113 enums, 10 遷移 |
| **L7** | 外部整合層 | `src/services/n8n/`, `python-services/` | 25+ (Node) + 12 (Python) | ~13K | ✅ | n8n, Outlook, SharePoint, 2 Python 微服務 |
| **L8** | i18n 與配置層 | `messages/`, `src/i18n/`, `src/lib/i18n-*` | 102 + 3 + 5 + 5 | ~2K (TS) + ~19K (JSON) | ✅ | 3 語言 × 34 namespace, ICU MessageFormat |
| **L9** | 基礎設施層 | `docker-compose.yml`, `tests/` | 1 + 配置 + 2 Dockerfile | ~500 | ✅ | Docker Compose, PostgreSQL, Azurite, Python Dockerfiles |

---

## Layer 1: 前端展示層 (Frontend/UI Layer)

- **路徑**: `src/app/[locale]/`, `src/components/`
- **檔案數**: 429 組件文件 + 81 頁面 (under [locale]) + 1 root page
  - UI 組件 (`components/ui/`): 34 組件 (shadcn/ui primitives, 2,573 LOC)
  - 功能組件 (`components/features/`): 358 組件 (306 .tsx + 52 .ts barrel exports, 38 子目錄, 86,086 LOC)
  - 佈局組件 (`components/layout/`): 5 組件 (1,136 LOC)
  - 其他頂層組件: 32 組件 (admin/analytics/audit/auth/dashboard/export/filters/reports, 8,457 LOC)
  - 頁面 (`app/[locale]/`): 81 pages + 3 layouts (19,992 LOC)
  - 根級: 1 page.tsx + 1 layout.tsx (41 LOC)
- **LOC**: ~118,000 行（組件 98,252 + 頁面 19,992）
- **關鍵組件**:
  - DocumentUploadForm, ReviewPanel, PdfViewer
  - DashboardFilters, AdminPanel, RuleEditor
  - DocumentDetail, TemplateMatchingUI, ExtractionPreview
  - ProcessingTimeline, ConfidenceIndicator, BulkActionBar
- **設計模式**:
  - Shadcn/ui + Tailwind CSS（低層次 UI）
  - Feature-based 組件分組（高層次功能）
  - Zustand + React Query 狀態管理
  - React Hook Form + Zod 驗證
- **依賴關係**:
  - ← Layer 2 (API 層) 透過 React Query hooks
  - ← Layer 8 (i18n) 多語言翻譯
  - ← Layer 6 (身分驗證) 權限控制
- **狀態**: ✅ REAL (429 組件 + 82 頁面完整實裝)
- **已知問題**:
  - 多個文件 > 500 行（需要拆分）

**Top 5 最大組件文件（已驗證）**:
1. `src/components/features/reference-number/ReferenceNumberImportDialog.tsx` (785 LOC)
2. `src/components/features/rules/RuleEditForm.tsx` (751 LOC)
3. `src/components/features/historical-data/TermAggregationSummary.tsx` (679 LOC)
4. `src/components/features/outlook/OutlookFilterRulesEditor.tsx` (671 LOC)
5. `src/components/features/admin/monitoring/HealthDashboard.tsx` (651 LOC)

---

## Layer 2: API 路由層 (API Layer)

- **路徑**: `src/app/api/`
- **檔案數**: 331 個 route.ts 文件
- **HTTP 方法分佈**:
  - GET: 201 文件 (60%)
  - POST: 141 文件 (43%)
  - PATCH: 33 文件 (10%)
  - DELETE: 31 文件 (9%)
  - PUT: 8 文件 (2%)
- **估計端點數**: ~414 個（平均 1.25 方法/文件）
- **LOC**: ~66,800 行
- **API 領域分佈**:
  1. `/admin/*` — 106 files (32%) — 系統管理
  2. `/v1/*` — 77 files (23%) — 版本化 API
  3. `/rules/*` — 20 files (6%) — 規則管理
  4. `/documents/*` — 19 files (6%) — 文件處理
  5. `/reports/*` — 12 files (4%) — 報表
  6. `/companies/*` — 12 files (4%) — 公司管理
  7. `/auth/*` — 7 files (2%) — 認證
  8. `/audit/*` — 7 files (2%) — 審計
  9. `/workflows/*` — 5 files (2%) — 工作流
  10. Others — 46 files (14%) — 其他
- **設計模式**:
  - RFC 7807 標準錯誤格式
  - Zod schema 驗證 + 自定義中間件
  - Prisma ORM 資料存取
  - 標準分頁 (?page, ?pageSize, ?sort, ?order)
  - 角色型授權檢查
- **特殊 API 類型**:
  - SSE: 2 端點 (/admin/logs/stream, /admin/historical-data/batches/[id]/progress)
  - Webhooks: n8n 整合配置、測試、歷史
  - File Upload: 7+ 端點
  - Batch Operations: 3+ 端點
- **依賴關係**:
  - → Layer 3 (服務層) 核心業務邏輯
  - → Layer 6 (資料層) Prisma ORM
  - ← Layer 1 (前端) 透過 React Query
- **狀態**: ✅ REAL (331 route files, ~414 endpoints)
- **安全覆蓋**:
  - Auth check（`await auth()` 模式）: 58.0% (192/331) — 42.0% 未保護需評估
  - Zod validation 覆蓋率: 64% (212/331)

---

## Layer 3: 業務服務層 (Service Layer)

- **路徑**: `src/services/` (根層級 + 12 個子目錄)
- **檔案數**: 200 服務文件
  - 根層級服務: 111 個
  - 子目錄服務: 89 個
- **LOC**: ~99,600 行
- **服務分類** (22 個分類):

| # | 分類 | 文件數 | 關鍵服務 |
|---|------|--------|----------|
| 1 | 核心處理 | 11 | document, extraction, batch-processor, routing, result-retrieval |
| 2 | AI/OCR | 10 | gpt-vision, azure-di, confidence, term-classification, ai-cost |
| 3 | 映射與規則 | 12 | mapping, rule-resolver, rule-suggestion-generator, pattern-analysis |
| 4 | 公司管理 | 6 | company, company-matcher, file-detection, forwarder (deprecated) |
| 5 | 城市與區域 | 6 | city, city-access, city-cost, regional-manager, regional-report |
| 6 | 報表與統計 | 6 | dashboard-statistics, monthly-cost-report, processing-stats |
| 7 | 審計與追蹤 | 5 | audit-log, audit-query, change-tracking, traceability, security-log |
| 8 | 審核工作流 | 3 | invoice-submission, routing, task-status |
| 9 | 警報與通知 | 6 | alert, alert-rule, alert-evaluation, notification |
| 10 | 備份與資料 | 5 | backup (1120 LOC), restore (1017 LOC), data-retention (1150 LOC) |
| 11 | 外部整合 | 15 | n8n (9), outlook (3), sharepoint (2), webhook (3) |
| 12 | 系統管理 | 7 | health-check, system-config (1553 LOC), performance, global-admin |
| 13 | 用戶與權限 | 4 | user, role, api-key, rate-limit |
| 14 | 工具服務 | 8 | logging (2), similarity (3), rule-inference (3) |
| 15 | V3 提取管線 | 20 | extraction-v3 (7 root) + stages (8) + utils (5, 含 classify-normalizer) |
| 16 | 統一處理器 | 22 | unified-processor (1) + steps (11) + adapters (7) + factory (1) + interfaces (1) + index (1) |
| 17 | 欄位映射與轉換 | 13 | mapping (6) + transform (7) |
| 18 | Prompt 管理 | 9 | 8 根層級 + 1 子目錄 |
| 19 | 模板管理 | 6 | data-template, template-field-mapping, template-matching-engine |
| 20 | 參考編號與匯率 | 3 | reference-number, region, exchange-rate |
| 21 | 管線配置 | 1 | pipeline-config |
| 22 | 其他專用 | 4 | company-auto-create, file-detection, term-aggregation |

- **核心架構**:
  - **三層映射系統**: Tier 1 (Universal) → Tier 2 (Company-Specific) → Tier 3 (AI Classification)
  - **V3 提取管線**: 7 步處理 + 三階段提取架構 (V3.1)
  - **統一處理器**: 11 步 + 工廠模式 + 適配器
  - **信心度路由**: ≥95% AUTO_APPROVE | 80-94% QUICK_REVIEW | <80% FULL_REVIEW
- **設計模式**:
  - 單一職責原則（Single Responsibility）
  - 工廠模式（extraction-v3, unified-processor）
  - 適配器模式（unified-processor adapters）
  - 策略模式（mapping tiers, transform strategies）
  - 責任鏈（三階段提取 V3.1）
- **狀態**: ✅ REAL (200 服務完整實裝, ~99,600 LOC)
- **已知問題**:
  - company.service.ts: 1,720 LOC（需要拆分）
  - system-config.service.ts: 1,553 LOC（需要拆分）
  - 287 處 console.log 語句（94 個文件，待清理）
  - 18 處 `any` 型態（13 個文件，待修復）

**Top 5 最大服務文件（已驗證）**:
1. `src/services/company.service.ts` (1,720 LOC)
2. `src/services/system-config.service.ts` (1,553 LOC)
3. `src/services/batch-processor.service.ts` (1,356 LOC)
4. `src/services/extraction-v3/extraction-v3.service.ts` (1,238 LOC)
5. `src/services/gpt-vision.service.ts` (1,199 LOC)

---

## Layer 4: AI/提取管線層 (AI Pipeline Layer)

- **路徑**: `src/services/extraction-v3/`, `src/services/unified-processor/`
- **檔案數**: 42 個文件
  - 提取 V3: 20 files (7 root + 8 stages + 5 utils)
  - 統一處理器: 22 files (1 service + 11 steps + 7 adapters + 1 factory + 1 interface + 1 index)
- **LOC**: ~18,000 行

### V3 提取管線架構 (7 步):
1. FILE_PREPARATION - 文件準備 (pdf-converter)
2. STAGE_1_COMPANY_IDENTIFICATION - 公司識別 (GPT-5-nano)
3. STAGE_2_FORMAT_IDENTIFICATION - 格式識別 (GPT-5-nano)
4. STAGE_3_FIELD_EXTRACTION - 欄位提取 (GPT-5.2)
5. TERM_RECORDING - 術語記錄
6. CONFIDENCE_CALCULATION - 信心度計算 (V3.1 三階段版)
7. ROUTING_DECISION - 路由決策 (自動/快速/完整審核)

### V3 核心服務:
- `extraction-v3.service.ts` - 主服務入口 & 管線協調
- `prompt-assembly.service.ts` - 動態 Prompt 組裝
- `unified-gpt-extraction.service.ts` - 統一 GPT 提取
- `confidence-v3.service.ts` - V3 信心度計算
- `confidence-v3-1.service.ts` - V3.1 三階段信心度
- `result-validation.service.ts` - 結果驗證

### 三階段處理器 (`stages/`):
- `stage-orchestrator.service.ts` - 階段協調器
- `stage-1-company.service.ts` - 公司識別
- `stage-2-format.service.ts` - 格式匹配
- `stage-3-extraction.service.ts` (1451 LOC) - 欄位提取
- `gpt-caller.service.ts` - 統一 GPT 呼叫器
- `reference-number-matcher.service.ts` - 參考編號匹配
- `exchange-rate-converter.service.ts` - 匯率轉換

### 統一處理器管線 (11 步, V2 向後相容):
Steps: azure-di-extraction, config-fetching, file-type-detection, issuer-identification, format-matching, smart-routing, gpt-enhanced-extraction, field-mapping, confidence-calculation, term-recording, routing-decision

Adapters: confidence-calculator, config-fetcher, format-matcher, issuer-identifier, legacy-processor, routing-decision, term-recorder

### 信心度維度 (V3.1):
- STAGE_1_COMPANY (20%), STAGE_2_FORMAT (15%), STAGE_3_EXTRACTION (30%)
- FIELD_COMPLETENESS (20%), CONFIG_SOURCE_BONUS (15%)
  - COMPANY_SPECIFIC: +5%, UNIVERSAL: +3%, LLM_INFERRED: 0%

- **設計模式**: 管線模式, 責任鏈, 適配器模式, 工廠模式
- **狀態**: ✅ REAL (42 個文件完整實裝，V3.1 最新版)
- **特性**: Feature Flag V2/V3 切換, 錯誤回退 V3→V2, 完整步驟時間追蹤

---

## Layer 5: 映射與規則引擎層 (Mapping Engine Layer)

- **路徑**: `src/services/mapping/`, `src/services/transform/`, `src/services/rule-*`
- **檔案數**: 31 文件
  - 映射引擎: 7 files (mapping/)
  - 轉換引擎: 9 files (transform/)
  - 規則管理: 7 files (rule-*.ts root level)
  - 規則推斷: 4 files (rule-inference/)
  - 相似度計算: 4 files (similarity/)
- **LOC**: ~9,800 行

### 映射引擎 (`mapping/`):
- `mapping.service.ts` - 三層映射系統核心
- `config-resolver.ts` - 映射配置解析 (FORMAT → COMPANY → GLOBAL)
- `dynamic-mapping.service.ts` - 動態映射
- `field-mapping-engine.ts` - 欄位映射引擎
- `mapping-cache.ts` - 映射快取
- `source-field.service.ts` - 來源欄位管理
- `transform-executor.ts` - 轉換執行器

### 三層映射架構:
- **Tier 1**: Universal Mappings (~70-80% 覆蓋)
- **Tier 2**: Company-Specific Overrides (~額外 10-15%)
- **Tier 3**: LLM Classification (GPT-5.2, ~剩餘 5-10%)

### 轉換策略 (`transform/`):
- Direct mapping, Concat, Split, Formula, Lookup, Aggregate

### 規則管理 (12+ services):
- rule-resolver, rule-suggestion-generator, rule-testing, rule-change, rule-accuracy, rule-metrics, rule-simulation, impact-analysis, pattern-analysis, correction-recording

### 規則推斷 (`rule-inference/`):
- keyword-inferrer, position-inferrer, regex-inferrer

### 相似度計算 (`similarity/`):
- levenshtein, date-similarity, numeric-similarity

- **設計模式**: 策略模式, 責任鏈, 快取模式, 工廠模式
- **狀態**: ✅ REAL (31 文件完整實裝)

---

## Layer 6: 資料存取層 (Data Access Layer)

- **路徑**: `prisma/schema.prisma`, `src/lib/prisma.ts`
- **LOC**: ~4,354 行 (schema.prisma)
- **資料模型**: 122 models, 113 enums, 439 索引, 73 唯一約束 (30 @@unique + 43 @unique), 10 遷移

### 模型領域分佈 (22 分類):

| 領域 | Model 數量 | 代表模型 |
|------|-----------|---------|
| 用戶與權限 | 8 | User, Account, Session, Role, UserRole, UserCityAccess, UserRegionAccess |
| 區域與城市 | 2 | Region, City |
| 文件處理 | 7 | Document, OcrResult, ExtractionResult, ProcessingQueue, DocumentFormat |
| 公司管理 | 3 | Company, Forwarder (deprecated), ForwarderIdentification |
| 映射與規則 | 12 | MappingRule, RuleSuggestion, RuleVersion, FieldMappingConfig |
| 審核工作流 | 5 | ReviewRecord, Correction, FieldCorrectionHistory, Escalation, Notification |
| 審計與安全 | 5 | AuditLog, SecurityLog, DataChangeHistory |
| 報表與統計 | 6 | ReportJob, MonthlyReport, ProcessingStatistics |
| AI 成本 | 3 | ApiUsageLog, ApiPricingConfig, ApiPricingHistory |
| 系統配置 | 3 | SystemConfig, ConfigHistory, PipelineConfig |
| 資料保留 | 4 | DataRetentionPolicy, DataArchiveRecord |
| SharePoint | 3 | SharePointConfig, SharePointFetchLog, ApiKey |
| Outlook | 3 | OutlookConfig, OutlookFilterRule, OutlookFetchLog |
| n8n | 4 | N8nApiKey, N8nApiCall, N8nWebhookEvent |
| 工作流 | 5 | WorkflowExecution, WorkflowDefinition, WebhookConfig |
| 外部 API | 6 | ExternalApiTask, ExternalWebhookDelivery |
| 效能監控 | 11 | ServiceHealthCheck, ApiPerformanceMetric |
| 警報系統 | 5 | AlertRule, Alert, AlertNotificationConfig |
| 備份與還原 | 7 | Backup, BackupSchedule, RestoreRecord |
| 系統日誌 | 3 | SystemLog, LogRetentionPolicy, LogExport |
| 歷史批次 | 4 | HistoricalBatch, HistoricalFile, TermAggregationResult |
| Prompt/模板/參考 | 8 | PromptConfig, DataTemplate, TemplateFieldMapping, ReferenceNumber, ExchangeRate |

### ID 策略:
- `@default(uuid())`: 47 models (38.5%)
- `@default(cuid())`: 74 models (60.7%)
- 其他: 1 (0.8%)
- 逐步遷移 CUID → UUID

### 最大 Models 關聯數:
- User: ~60 關聯 (最複雜)
- Document: ~24 關聯
- MappingRule: 多個關聯

- **狀態**: ✅ REAL (122 models, 10 遷移, 完整遷移歷史)

---

## Layer 7: 外部整合層 (External Integration Layer)

- **路徑**: `src/services/n8n/`, outlook/sharepoint services, `python-services/`
- **檔案數**: 25+ (Node.js) + 12 (Python)
- **LOC**: ~10,300 (Node.js: n8n 5,298 + outlook/sharepoint/webhook 4,980) + ~2,719 (Python)

### n8n 工作流整合 (10 files):
n8n-api-key, n8n-health, n8n-webhook, n8n-document, webhook-config, workflow-definition, workflow-error, workflow-execution, workflow-trigger

### Outlook 整合 (4 files):
outlook-mail, outlook-document, outlook-config, microsoft-graph

### SharePoint 整合 (2 files):
sharepoint-document, sharepoint-config

### Python 後端服務 (2 個 FastAPI 微服務):
- **Extraction Service** (port 8000): Azure Document Intelligence OCR
- **Mapping Service** (port 8001): Forwarder 識別 + 三層欄位映射
- 共計: 2,719 LOC (12 Python files)

### 外部服務依賴:
- Azure Document Intelligence (OCR), Azure OpenAI (GPT-5.2/nano), Azure Blob Storage, Azure Key Vault
- Microsoft Graph (Outlook Mail, SharePoint)
- n8n (workflow orchestration)
- Redis (caching, rate limiting)
- Nodemailer (email notifications)

- **狀態**: ✅ REAL (25+ Node.js + 10+ Python 文件)

---

## Layer 8: 國際化與配置層 (i18n & Config Layer)

- **路徑**: `messages/`, `src/i18n/`, `src/lib/i18n-*.ts`
- **檔案數**: 102 JSON + 3 config + 5 utility + 5 hooks
- **LOC**: ~2,062 行 (TS config/utility/hooks) + ~18,765 行 (JSON 翻譯資料)
- **支援語言**: en, zh-TW, zh-CN (3 語言 × 34 namespace = 102 JSON)

### i18n 命名空間 (34 個/語言):
admin, auth, common, companies, confidence, dashboard, dataTemplates, dialogs, documentPreview, documents, errors, escalation, exchangeRate, fieldDefinitionSet, fieldMappingConfig, formats, global, historicalData, navigation, pipelineConfig, profile, promptConfig, referenceNumber, region, reports, review, rules, standardFields, systemSettings, templateFieldMapping, templateInstance, templateMatchingTest, termAnalysis, validation

### i18n 工具:
- `i18n-date.ts`, `i18n-number.ts`, `i18n-currency.ts`, `i18n-zod.ts`, `i18n-api-error.ts`
- Hooks: use-locale-preference, use-localized-date, use-localized-format, use-localized-zod, use-localized-toast

- **狀態**: ✅ REAL (102 翻譯文件 + 完整工具鏈)

---

## Layer 9: 基礎設施層 (Infrastructure Layer)

- **Docker Compose 服務**:
  - PostgreSQL 15 (port 5433)
  - pgAdmin (port 5050)
  - Azurite: Blob (10010), Queue (10011), Table (10012)
  - Python Extraction Service (port 8000)
  - Python Mapping Service (port 8001)

- **開發工具**: ESLint, Prettier, TypeScript, Playwright 1.57, npm
- **應用端口**: Next.js 3000/3200, Python 8000/8001
- **狀態**: ✅ REAL (Docker Compose 完整，開發環境就緒)
- **已有**: Python 服務 Dockerfiles (`python-services/extraction/Dockerfile`, `python-services/mapping/Dockerfile`)
- **缺失**: Node.js 應用 Dockerfile, Kubernetes, CI/CD pipeline

---

## 層間依賴圖

```
┌──────────────────────────────────────────────────────────────────┐
│ Layer 1: 前端展示層 (429 組件, 82 頁面)                              │
│ ↓                                                                 │
├──────────────────────────────────────────────────────────────────┤
│ Layer 2: API 路由層 (331 route files, ~414 endpoints)           │
│ ↓                                                                 │
├──────────────────────────────────────────────────────────────────┤
│ Layer 3: 業務服務層 (200 services, 22 分類)                      │
│ ↙         ↓          ↘                                            │
├──────────┬───────────┬───────────────────────────────────────────┤
│ Layer 4  │  Layer 5  │  Layer 7                                  │
│ AI 管線  │ 映射+規則  │ 外部整合                                  │
│ (42 files)│ (31 files) │ (25+ Node + 12 Python)                  │
└──────────┴───────────┴──────────┬────────────────────────────────┘
                                   ↓
           ┌──────────────────────────────────────────┐
           │ Layer 6: 資料存取層 (122 models)         │
           │ Prisma ORM + PostgreSQL 15             │
           └──────────────────────────────────────────┘
                                   ↑
        ┌──────────────────────────┴──────────────────────┐
        │ Layer 8: i18n 層     │  Layer 9: 基礎設施層       │
        │ (102 JSON + 13 TS)   │  (Docker Compose)         │
        └──────────────────────┴───────────────────────────┘
```

---

## 關鍵設計模式使用統計

| 設計模式 | 使用層級 | 數量 | 典型場景 |
|----------|----------|------|---------|
| **工廠模式** | L4, L5 | 4+ | step-factory, prompt-resolver, transform-executor |
| **適配器模式** | L4, L7 | 8+ | unified-processor adapters, external service wrappers |
| **策略模式** | L5, L8 | 10+ | mapping tiers, transform strategies, formatters |
| **責任鏈** | L4 | 2 | stage pipeline, tier resolution |
| **快取模式** | L5, L6, L8 | 6+ | mapping-cache, prompt-cache, Redis layer |
| **單例模式** | L3, L6 | 8+ | service exports, Prisma client |

---

## 項目成熟度指標

| 指標 | 評分 | 備註 |
|------|------|------|
| **架構清晰度** | 9/10 | 9 層清晰分離，模式一致 |
| **代碼組織** | 8/10 | 目錄結構良好，部分文件過大 |
| **型態安全** | 8.5/10 | 完整 TypeScript，18 處 `any` 需修復 |
| **文檔完整性** | 8/10 | CLAUDE.md 詳盡，API 文檔齊全 |
| **測試覆蓋** | 6/10 | E2E 測試部分實施，單元測試待加強 |
| **國際化** | 9/10 | 3 語言完整支援，34 namespace 同步 |
| **外部整合** | 8.5/10 | 5+ 服務整合完善 |
| **效能監控** | 7.5/10 | 日誌完善，性能指標部分實施 |
| **總體評分** | **8.2/10** | 生產就緒，持續優化中 |

---

*分析完成: 2026-02-27*
*初次驗證: 2026-02-27（Agent 交叉核實）*
*二次驗證: 2026-02-28（命令行逐項核實，修正 6 嚴重 + 5 中等 + 3 輕微錯誤）*
*修正項目: Components 345→429, Auth 72.8%→58.0%, L1 LOC 45K→118K, L2 LOC 40K→67K, L3 LOC 120K→100K, L5 LOC 15K→10K, 唯一約束 30→73, 遷移 11→10, Python LOC 1872→2719, Node.js 整合 8K→10.3K, L8 LOC 3K→2K+19K, V3 files 19→20, UP files 21→22*
