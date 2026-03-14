# AI 文件提取平台功能架構映射指南

> **文件版本**: 1.0
> **最後更新**: 2026-02-27
> **定位**: AI-Driven Document Extraction & Classification Platform
> **前置文件**: AIDE-Architecture-Analysis-V1.md (架構總覽)
> **狀態**: Phase 1 完成 (22 Epics), Phase 2 進行中 (52 CHANGE + 48 FIX)
> **驗證方式**: 多輪 Agent 並行分析 + 交叉驗證（10 分析 Agent + 三次命令行逐項核實）

---

## 實現狀態總覽

> **說明**: 本文件涵蓋 **65 個功能**（49 個 Phase 1 原始功能 + 16 個 Phase 2 新功能），
> 基於 2026-02-28 三次驗證後的代碼庫，由多輪 Agent 並行分析並逐項命令行核實。

### 功能驗證結果

| 狀態 | 數量 | 比例 | 說明 |
|------|------|------|------|
| ✅ 完整實現 | 49 | 100% | Phase 1: 22 Epics 全部功能完整實現 |
| ✅ Phase 2 新功能 | 11 | — | A 類新功能（新增頁面/組件/服務） |
| ✅ Phase 2 重構 | 5 | — | B 類重大架構重構 |
| **總計** | **65** | **100%** | 所有功能均有對應代碼 |

### 按功能域統計

| 功能域 | 功能數 | ✅ | ⚠️ | ❌ | 實現率 | Phase 2 擴展 |
|--------|--------|-----|-----|-----|--------|-------------|
| D1 文件處理與 OCR | 8 | 8 | 0 | 0 | 100% | CHANGE-031 |
| D2 AI 提取管線 | 10 | 10 | 0 | 0 | 100% | CHANGE-024/025/026/036/038/042/051 |
| D3 三層映射引擎 | 8 | 8 | 0 | 0 | 100% | CHANGE-028/029/030 |
| D4 審核工作流 | 6 | 6 | 0 | 0 | 100% | CHANGE-041 |
| D5 公司與模板管理 | 8 | 8 | 0 | 0 | 100% | CHANGE-032/037/043/044/045 |
| D6 報表與儀表板 | 5 | 5 | 0 | 0 | 100% | — |
| D7 外部整合與批量處理 | 8 | 8 | 0 | 0 | 100% | CHANGE-047 |
| D8 系統管理與基礎設施 | 12 | 12 | 0 | 0 | 100% | CHANGE-049/050 |
| **合計** | **65** | **65** | **0** | **0** | **100%** | 16 CHANGE |

### Phase 1 → Phase 2 狀態變更

| 維度 | Phase 1 | Phase 2 (目前) | 變更 |
|------|---------|---------------|------|
| 開發模式 | Epic/Story 模式 | CHANGE/FIX 模式 | Sprint-based → Issue-based |
| 功能數 | 49 (22 Epics) | 65 (+16 Phase 2) | +33% 功能增長 |
| 變更追蹤 | — | 52 CHANGE + 48 FIX | 持續優化與修復 |
| 提取管線 | V3 單次 GPT | V3.1 三階段分離 | CHANGE-024/025/026 |
| 命名重構 | Invoice/Forwarder | Document/Company | CHANGE-031/005 |
| 模板系統 | 基礎 CRUD | Line Item + Hybrid 模式 | CHANGE-043/044/045 |

---

## 執行摘要

AIDE 平台是一套 **AI 驅動的文件內容提取與自動分類系統**，專門解決 SCM 部門處理 Freight Invoice 的效率問題。平台目標年處理量 450,000-500,000 張發票（APAC 地區），自動化率 90-95%，準確率 90-95%。

**65 個功能**構成平台的八大功能域：

1. **文件處理與 OCR** (D1, 8 功能) --- 多格式文件上傳、Azure Document Intelligence OCR、PDF/Image 處理
2. **AI 提取管線** (D2, 10 功能) --- V3.1 三階段提取（GPT-5-nano + GPT-5.2）、5-6 維度信心度計算、智能路由
3. **三層映射引擎** (D3, 8 功能) --- Tier 1 通用 → Tier 2 公司特定 → Tier 3 LLM 分類、規則自動學習、影響分析
4. **審核工作流** (D4, 6 功能) --- 信心度路由決策、待審核列表、修正與確認、升級處理
5. **公司與模板管理** (D5, 8 功能) --- 公司配置、文件格式管理、模板欄位映射、Line Item Pivot/Hybrid 模式
6. **報表與儀表板** (D6, 5 功能) --- 處理統計儀表板、成本報表、AI 成本追蹤、區域報表
7. **外部整合與批量處理** (D7, 8 功能) --- SharePoint/Outlook 自動獲取、n8n 工作流、批量歷史導入、SSE 進度追蹤
8. **系統管理與基礎設施** (D8, 12 功能) --- 用戶/角色管理、認證授權、i18n 三語言、備份還原、告警系統、系統設定中心

---

## 1. 架構層級與功能映射總覽

### 1.1 架構層級定義 (9 層模型)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│               完整架構層級 (Phase 2, V1 - 9 層模型)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Layer 1: 前端展示層 (Frontend Layer)                                       │
│  ════════════════════════════════════                                        │
│  • Next.js 15 + React 18 + TypeScript (App Router)                         │
│  • 429 組件 (34 UI + 358 features + 5 layout + 32 other)                   │
│  • 81 頁面 + 3 layouts ([locale])，shadcn/ui + Tailwind CSS               │
│  • Zustand (UI State) + React Query (Server State) + 104 Hooks            │
│  • LOC: ~118,000                                                            │
│                                                                              │
│  Layer 2: API 路由層 (API Layer)                                            │
│  ═══════════════════════════════                                            │
│  • 331 route.ts 文件，~414 端點                                            │
│  • GET 201 / POST 141 / PATCH 33 / DELETE 31 / PUT 8                      │
│  • RFC 7807 錯誤格式，Auth 58.0%，Zod 64%                                 │
│  • LOC: ~67,000                                                             │
│                                                                              │
│  Layer 3: 業務服務層 (Service Layer)                                        │
│  ═══════════════════════════════════                                        │
│  • 200 服務文件 (111 flat + 89 subdirs), 22 分類                           │
│  • 三層映射系統、工廠+適配器+策略模式                                       │
│  • LOC: ~100,000                                                            │
│                                                                              │
│  Layer 4: AI 提取管線層 (AI Pipeline Layer)                                 │
│  ══════════════════════════════════════════                                  │
│  • extraction-v3/ (20 files) + unified-processor/ (22 files)               │
│  • V3.1 三階段: Company→Format→Extraction                                  │
│  • 信心度路由: AUTO_APPROVE / QUICK_REVIEW / FULL_REVIEW                   │
│  • LOC: ~18,000                                                             │
│                                                                              │
│  Layer 5: 映射與規則引擎層 (Mapping Engine Layer)                           │
│  ═══════════════════════════════════════════════                             │
│  • mapping/ (7) + transform/ (9) + rule-* (7) + inference (4) + sim (4)   │
│  • Tier 1 Universal → Tier 2 Company → Tier 3 LLM                         │
│  • 7 轉換策略 (Direct, Concat, Split, Formula, Lookup, Aggregate)          │
│  • LOC: ~10,000                                                             │
│                                                                              │
│  Layer 6: 資料存取層 (Data Access Layer)                                    │
│  ═══════════════════════════════════════                                     │
│  • Prisma ORM 7.2 + PostgreSQL 15                                          │
│  • 122 models, 113 enums, 439 indexes, 73 unique constraints              │
│  • LOC: ~4,354 (schema)                                                     │
│                                                                              │
│  Layer 7: 外部整合層 (External Integration Layer)                           │
│  ════════════════════════════════════════════════                            │
│  • n8n (10), Outlook (4), SharePoint (2), Microsoft Graph                  │
│  • Python: Extraction (8000) + Mapping (8001), 2,719 LOC                   │
│  • LOC: ~13,000 (Node.js + Python)                                         │
│                                                                              │
│  Layer 8: 國際化與配置層 (i18n & Config Layer)                              │
│  ═════════════════════════════════════════════                               │
│  • 3 語言 (en, zh-TW, zh-CN) × 34 namespaces = 102 JSON                  │
│  • i18n tools: date, number, currency, zod, api-error                      │
│  • LOC: ~2,000 (TS) + ~19,000 (JSON)                                       │
│                                                                              │
│  Layer 9: 基礎設施層 (Infrastructure Layer)                                 │
│  ══════════════════════════════════════════                                  │
│  • Docker Compose: PostgreSQL + pgAdmin + Azurite + Python Services        │
│  • ESLint + Prettier + TypeScript + Playwright 1.57                        │
│  • 缺失: Node.js Dockerfile, K8s, CI/CD Pipeline                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

| 層級 | 名稱 | 說明 | 規模 |
|------|------|------|------|
| **L1** | 前端展示層 | Next.js 15 + React 18 + shadcn/ui | 429 組件, 81 頁面, ~118K LOC |
| **L2** | API 路由層 | 331 route files, RFC 7807 | ~414 端點, ~67K LOC |
| **L3** | 業務服務層 | 200 服務, 22 分類 | ~100K LOC |
| **L4** | AI 提取管線層 | V3.1 三階段 + 統一處理器 | 42 files, ~18K LOC |
| **L5** | 映射與規則引擎層 | 三層映射 + 7 轉換策略 | 31 files, ~10K LOC |
| **L6** | 資料存取層 | Prisma 7.2, PostgreSQL 15 | 122 models, ~4.4K LOC |
| **L7** | 外部整合層 | n8n, Outlook, SharePoint, Python | 37+ files, ~13K LOC |
| **L8** | i18n 與配置層 | 3 語言 × 34 namespaces | 102 JSON + ~2K TS |
| **L9** | 基礎設施層 | Docker Compose, Dev Tools | 配置文件 |

### 1.2 功能域與架構層級對應

| 功能域 | 主要層級 | 功能數 |
|--------|----------|--------|
| D1 文件處理與 OCR | L1 (Upload UI) + L2 (API) + L3 (Services) + L7 (Azure DI) | 8 |
| D2 AI 提取管線 | L4 (Pipeline) + L3 (Services) + L7 (GPT) | 10 |
| D3 三層映射引擎 | L5 (Mapping Engine) + L3 (Rule Services) + L6 (MappingRule) | 8 |
| D4 審核工作流 | L1 (Review UI) + L2 (API) + L3 (Routing) | 6 |
| D5 公司與模板管理 | L1 (Admin UI) + L3 (Company/Template) + L6 (Prisma) | 8 |
| D6 報表與儀表板 | L1 (Dashboard/Reports) + L2 (API) + L3 (Statistics) | 5 |
| D7 外部整合與批量 | L7 (External) + L3 (Batch) + L2 (Webhook API) | 8 |
| D8 系統管理與基礎設施 | L1-L9 全棧 (Auth, i18n, Backup, Config, Alerts) | 12 |

### 1.3 功能實現狀態速查表

| # | 功能名稱 | 狀態 | 架構層級 | 主要位置 | 所屬域 |
|---|---------|------|----------|----------|--------|
| 1 | 批量文件上傳與元數據檢測 | ✅ | L1+L2+L3 | `historical-data/`, `file-detection.service.ts` | D1 |
| 2 | 智能處理路由 | ✅ | L3 | `processing-router.service.ts`, `batch-processor.service.ts` | D1 |
| 3 | 批量任務管理 | ✅ | L1+L2+L3 | `admin/historical-data/`, `batch-progress.service.ts` | D1 |
| 4 | 元數據聚合與詞彙學習 | ✅ | L3 | `term-aggregation.service.ts`, `hierarchical-term-aggregation.service.ts` | D1 |
| 5 | 手動上傳發票 | ✅ | L1+L2 | `documents/upload/`, `FileUploader.tsx` | D1 |
| 6 | OCR 文字提取 | ✅ | L3+L7 | `azure-di.service.ts`, `extraction.service.ts` | D1 |
| 7 | 文件預覽與對比視圖 | ✅ | L1 | `features/document/detail/`, `DocumentDetailTabs.tsx` | D1 |
| 8 | 文件格式與模板管理 | ✅ | L1+L3 | `admin/field-definition-sets/`, `document-format.service.ts` | D1 |
| 9 | V3.1 三階段提取架構 | ✅ | L4 | `extraction-v3/stages/stage-orchestrator.service.ts` | D2 |
| 10 | Stage 1 公司識別 (GPT-5-nano) | ✅ | L4 | `stages/stage-1-company.service.ts` | D2 |
| 11 | Stage 2 格式識別 (GPT-5-nano) | ✅ | L4 | `stages/stage-2-format.service.ts` | D2 |
| 12 | Stage 3 欄位提取 (GPT-5.2) | ✅ | L4 | `stages/stage-3-extraction.service.ts` (1,451 LOC) | D2 |
| 13 | 信心度計算 (V3.1, 5-6 維度) | ✅ | L4 | `confidence-v3-1.service.ts` | D2 |
| 14 | Prompt 動態組裝 | ✅ | L4 | `prompt-assembly.service.ts` | D2 |
| 15 | GPT 提示詞管理與優化 | ✅ | L1+L3 | `admin/prompt-configs/`, `prompt-resolver.service.ts` | D2 |
| 16 | 統一處理器框架 (11 步) | ✅ | L4 | `unified-processor/` (22 files) | D2 |
| 17 | 參考編號匹配 (CHANGE-032) | ✅ | L4 | `stages/reference-number-matcher.service.ts` | D2 |
| 18 | 匯率轉換 (CHANGE-032) | ✅ | L4 | `stages/exchange-rate-converter.service.ts` | D2 |
| 19 | 三層映射核心引擎 | ✅ | L5 | `mapping/dynamic-mapping.service.ts`, `config-resolver.ts` | D3 |
| 20 | 欄位映射配置管理 | ✅ | L1+L3 | `admin/field-mapping-configs/`, `field-mapping-engine.ts` | D3 |
| 21 | 規則查看與建議 | ✅ | L1+L2+L3 | `rules/`, `rule-change.service.ts` | D3 |
| 22 | 規則學習與升級建議 | ✅ | L3 | `rule-suggestion-generator.ts`, `pattern-analysis.ts` | D3 |
| 23 | 影響範圍分析與版本控制 | ✅ | L3 | `impact-analysis.ts`, `rule-change.service.ts` | D3 |
| 24 | 自動回滾機制 | ✅ | L3 | `auto-rollback.ts`, `rule-accuracy.ts` | D3 |
| 25 | 轉換引擎 (7 策略) | ✅ | L5 | `transform/` (7 files) | D3 |
| 26 | 規則推斷引擎 | ✅ | L5 | `rule-inference/` (keyword, position, regex) | D3 |
| 27 | 待審核列表與詳細對照 | ✅ | L1+L2 | `review/`, `ReviewQueue.tsx`, `ReviewPanel/` | D4 |
| 28 | 修正與確認 | ✅ | L2+L3 | `review/[id]/approve`, `review/[id]/correct` | D4 |
| 29 | 複雜案例升級 | ✅ | L1+L2 | `escalations/`, `routing.service.ts` | D4 |
| 30 | 信心度路由決策 | ✅ | L4 | `confidence-v3-1.service.ts` → AUTO/QUICK/FULL | D4 |
| 31 | 批量文件匹配 (CHANGE-041) | ✅ | L1 | `BulkMatchDialog`, 文件列表頁整合 | D4 |
| 32 | Extracted Fields 顯示重構 (CHANGE-051) | ✅ | L1 | Line Items 展示 + i18n 源標籤 | D4 |
| 33 | 公司配置管理 | ✅ | L1+L3 | `companies/`, `company.service.ts` (1,720 LOC) | D5 |
| 34 | 模板定義與管理 | ✅ | L1+L3 | `admin/data-templates/`, `data-template.service.ts` | D5 |
| 35 | 模板欄位映射 | ✅ | L1+L3 | `admin/template-field-mappings/`, `template-field-mapping.service.ts` | D5 |
| 36 | 模板實例與匹配 | ✅ | L1+L3 | `template-instances/`, `template-matching-engine.service.ts` | D5 |
| 37 | 模板匹配測試 | ✅ | L1+L2 | `admin/test/template-matching/` | D5 |
| 38 | Line Item Pivot 展平 (CHANGE-043) | ✅ | L3 | Template Matching Engine lineItem 聚合 | D5 |
| 39 | Line Item Hybrid 雙模式 (CHANGE-044) | ✅ | L3+L6 | DataTemplate `outputMode` 配置 | D5 |
| 40 | FieldDefinitionSet 欄位類型 (CHANGE-045) | ✅ | L3+L6 | `fieldType` 屬性，動態 Line Item 生成 | D5 |
| 41 | 處理統計儀表板 | ✅ | L1+L3 | `dashboard/`, `dashboard-statistics.service.ts` | D6 |
| 42 | 成本報表與追蹤 | ✅ | L1+L3 | `reports/cost`, `city-cost-report.service.ts` | D6 |
| 43 | AI 成本追蹤 | ✅ | L1+L3 | `reports/ai-cost`, `ai-cost.service.ts` | D6 |
| 44 | 區域報表 | ✅ | L1+L3 | `reports/regional`, `regional-report.service.ts` | D6 |
| 45 | 月度報表 | ✅ | L1+L3 | `reports/monthly`, `monthly-cost-report.service.ts` | D6 |
| 46 | SharePoint 自動獲取 | ✅ | L3+L7 | `sharepoint-document.service.ts`, `microsoft-graph.service.ts` | D7 |
| 47 | Outlook 郵件附件提取 | ✅ | L1+L3+L7 | `admin/integrations/outlook/`, `outlook-mail.service.ts` | D7 |
| 48 | n8n 雙向通訊與狀態追蹤 | ✅ | L3+L7 | `n8n/` (10 services), `webhook.service.ts` | D7 |
| 49 | RESTful API 與文檔 | ✅ | L2+L3 | `invoice-submission.service.ts`, `result-retrieval.service.ts` | D7 |
| 50 | Webhook 與通知系統 | ✅ | L3 | `webhook.service.ts`, `notification.service.ts` | D7 |
| 51 | 批量歷史文件詳情頁 (CHANGE-003) | ✅ | L1 | `/admin/historical-data/[id]/detail` | D7 |
| 52 | AI 詳情 Tab (CHANGE-023) | ✅ | L1 | 文件詳情頁 AI Details 標籤 | D7 |
| 53 | Data Template 流程完善 (CHANGE-037) | ✅ | L2+L3 | autoMatch, export 配置 API | D7 |
| 54 | Azure AD SSO + 本地帳號認證 | ✅ | L2+L3+L8 | `auth/`, `user.service.ts`, NextAuth | D8 |
| 55 | 用戶與角色管理 | ✅ | L1+L2+L3 | `admin/users/`, `role.service.ts` | D8 |
| 56 | User Profile 個人資料頁 (CHANGE-049) | ✅ | L1+L2 | `/profile` 頁面 | D8 |
| 57 | 多語言支援 (zh-TW, zh-CN, en) | ✅ | L8 | `messages/` (102 JSON), `src/i18n/` | D8 |
| 58 | 系統健康監控 | ✅ | L1+L3 | `admin/monitoring/health/`, `health-check.service.ts` | D8 |
| 59 | 系統日誌查看 (含 SSE) | ✅ | L2 | `/api/admin/logs` (含 SSE streaming) | D8 |
| 60 | 系統參數配置 | ✅ | L1+L3 | `admin/settings/`, `system-config.service.ts` (1,553 LOC) | D8 |
| 61 | 告警通知系統 | ✅ | L1+L3 | `admin/alerts/`, `alert.service.ts`, `alert-evaluation.service.ts` | D8 |
| 62 | 備份與還原 | ✅ | L1+L3 | `admin/backup/`, `backup.service.ts` (1,120 LOC), `restore.service.ts` | D8 |
| 63 | 審計追蹤與合規報告 | ✅ | L1+L3 | `audit/query/`, `audit-log.service.ts`, `traceability.service.ts` | D8 |
| 64 | 多城市數據隔離與區域管理 | ✅ | L3 | `city.service.ts`, `regional-manager.service.ts` | D8 |
| 65 | 統一設定中心 (CHANGE-050) | ✅ | L1+L3 | `/admin/settings`, `system-settings.service.ts` | D8 |

---

## 2. 功能詳細映射

### 2.1 文件處理與 OCR (D1)

| # | 功能 | 狀態 | 層級 | 實現文件 | 說明 |
|---|------|------|------|---------|------|
| 1 | 批量文件上傳 | ✅ | L1+L2+L3 | `BatchFileUploader.tsx`, `file-detection.service.ts` | Multipart 上傳 + 元數據檢測 |
| 2 | 智能處理路由 | ✅ | L3 | `processing-router.service.ts` | Azure DI vs GPT Vision 路由 |
| 3 | 批量任務管理 | ✅ | L1+L2 | `HistoricalBatchList.tsx`, `batch-progress.service.ts` | 暫停/恢復/取消生命週期 |
| 4 | 詞彙聚合學習 | ✅ | L3 | `term-aggregation.service.ts` | Levenshtein 聚類 + AI 分類 |
| 5 | 手動上傳發票 | ✅ | L1+L2 | `FileUploader.tsx`, `POST /api/documents/upload` | 拖放上傳 + Azure Blob |
| 6 | OCR 文字提取 | ✅ | L3+L7 | `azure-di.service.ts` | Azure Document Intelligence |
| 7 | 文件預覽對比 | ✅ | L1 | `DocumentDetailTabs.tsx`, `AiDetailsTab.tsx` | PDF 預覽 + AI 提取結果對照 |
| 8 | 格式管理 | ✅ | L1+L3 | `field-definition-sets/`, `document-format.service.ts` | 欄位定義集 + 格式配置 |

**代碼結構說明**:
- 文件上傳經 `POST /api/documents/upload` 到 Azure Blob Storage，建立 Document 記錄後 Fire-and-Forget 觸發處理管線
- OCR 由 Python Extraction Service (port 8000) 的 Azure Document Intelligence 執行
- 批量處理使用 `p-queue-compat` 並發控制（默認 5 並發，10 req/sec 速率限制）

**已知問題**:
- 7 個 TODO 涉及 Azure Blob Storage 整合（備份刪除、公司上傳等未完全整合）
- 測試覆蓋率 ≈ 0%

---

### 2.2 AI 提取管線 (D2)

| # | 功能 | 狀態 | 層級 | 實現文件 | 說明 |
|---|------|------|------|---------|------|
| 9 | V3.1 三階段架構 | ✅ | L4 | `stage-orchestrator.service.ts` | CHANGE-024: 單次→三階段分離 |
| 10 | Stage 1 公司識別 | ✅ | L4 | `stage-1-company.service.ts` | GPT-5-nano, ~$0.0004 |
| 11 | Stage 2 格式識別 | ✅ | L4 | `stage-2-format.service.ts` | GPT-5-nano, ~$0.0005 |
| 12 | Stage 3 欄位提取 | ✅ | L4 | `stage-3-extraction.service.ts` (1,451 LOC) | GPT-5.2, ~$0.0027 |
| 13 | 信心度計算 | ✅ | L4 | `confidence-v3-1.service.ts` | 5-6 維度加權 |
| 14 | Prompt 動態組裝 | ✅ | L4 | `prompt-assembly.service.ts` | 動態 Prompt + 變數替換 |
| 15 | Prompt 管理 UI | ✅ | L1+L3 | `admin/prompt-configs/` | CRUD + 測試功能 |
| 16 | 統一處理器 | ✅ | L4 | `unified-processor/` (22 files) | 11 步 + 工廠 + 適配器 |
| 17 | 參考編號匹配 | ✅ | L4 | `reference-number-matcher.service.ts` | CHANGE-032 |
| 18 | 匯率轉換 | ✅ | L4 | `exchange-rate-converter.service.ts` | CHANGE-032 |

**代碼結構說明**:

V3.1 三階段管線 (CHANGE-024/025/026):
```
FILE_PREP → Stage 1 (GPT-5-nano): 公司識別
         → Stage 2 (GPT-5-nano): 格式匹配
         → Stage 3 (GPT-5.2): 欄位提取
           ├─ 參考編號匹配 (CHANGE-032)
           └─ 匯率轉換 (CHANGE-032)
         → TERM_RECORDING → CONFIDENCE → ROUTING
```

信心度 V3.1 (5-6 維度):
```
20% × STAGE_1_COMPANY + 15% × STAGE_2_FORMAT + 30% × STAGE_3_EXTRACTION
+ 20% × FIELD_COMPLETENESS + 15% × CONFIG_SOURCE_BONUS
(refMatch 啟用時: CONFIG_SOURCE_BONUS 降為 10%, 新增 5% REFERENCE_NUMBER_MATCH)
```

路由決策 (V3.1 閾值):
- >= 90% → AUTO_APPROVE
- 70-89% → QUICK_REVIEW
- < 70% → FULL_REVIEW
- 智能降級: 新公司→強制 FULL_REVIEW; 新格式→強制 QUICK_REVIEW

**已知問題**:
- 3 個 P0 TODO 在 `stage-3-extraction.service.ts` (GPT 調用 + 術語映射)
- V2/V3 雙軌並存，統一處理器代碼重複率約 23%
- `stage-3-extraction.service.ts` (1,451 LOC) 需拆分

---

### 2.3 三層映射引擎 (D3)

| # | 功能 | 狀態 | 層級 | 實現文件 | 說明 |
|---|------|------|------|---------|------|
| 19 | 三層映射核心 | ✅ | L5 | `dynamic-mapping.service.ts`, `config-resolver.ts` | Tier 1→2→3 |
| 20 | 欄位映射配置 | ✅ | L1+L3 | `field-mapping-engine.ts` | Admin UI + 配置管理 |
| 21 | 規則查看建議 | ✅ | L1+L2+L3 | `rules/`, `rule-change.service.ts` | 規則 CRUD + 建議列表 |
| 22 | 規則學習升級 | ✅ | L3 | `rule-suggestion-generator.ts`, `pattern-analysis.ts` | 三次修正→CANDIDATE |
| 23 | 影響分析 | ✅ | L3 | `impact-analysis.ts` | 三維度: 影響文件/預估改善/風險 |
| 24 | 自動回滾 | ✅ | L3 | `auto-rollback.ts`, `rule-accuracy.ts` | 準確率下降 >10% 觸發 |
| 25 | 轉換引擎 | ✅ | L5 | `transform/` (7 files) | Direct/Concat/Split/Formula/Lookup/Aggregate |
| 26 | 規則推斷 | ✅ | L5 | `rule-inference/` | Keyword/Position/Regex 推斷器 |

**代碼結構說明**:

三層映射系統:
- **Tier 1 (Universal)**: `companyId: null` 的規則，覆蓋 70-80% 常見術語
- **Tier 2 (Company-Specific)**: `companyId` 非 null，只記錄差異映射
- **Tier 3 (LLM)**: GPT-5.2 智能分類，處理未見過的新術語

配置優先級 (`config-resolver.ts`): FORMAT (3) > COMPANY (2) > GLOBAL (1)

規則學習循環: 修正記錄 → 模式分析 (≥3 次同模式) → 規則建議生成 → Super User 審核 → 規則生效 → 準確率監控 → 自動回滾

**已知問題**:
- 無測試覆蓋（映射核心完全無單元/整合測試）

---

### 2.4 審核工作流 (D4)

| # | 功能 | 狀態 | 層級 | 實現文件 | 說明 |
|---|------|------|------|---------|------|
| 27 | 待審核列表 | ✅ | L1+L2 | `review/`, `ReviewQueue.tsx` | 列表 + 詳細對照 |
| 28 | 修正與確認 | ✅ | L2+L3 | `approve/route.ts`, `correct/route.ts` | 一鍵確認 / 欄位修正 |
| 29 | 升級處理 | ✅ | L1+L2 | `escalations/`, `routing.service.ts` | 複雜案例升級 |
| 30 | 信心度路由 | ✅ | L4 | `confidence-v3-1.service.ts` | AUTO/QUICK/FULL 決策 |
| 31 | 批量匹配 | ✅ | L1 | `BulkMatchDialog` (CHANGE-041) | 文件列表批量操作 |
| 32 | Fields 重構 | ✅ | L1 | CHANGE-051 | Line Items 展示 + i18n |

**代碼結構說明**:
- 審核工作流由信心度分數驅動: AUTO_APPROVE (>=90%) 自動通過, QUICK_REVIEW (70-89%) 一鍵確認, FULL_REVIEW (<70%) 完整審核
- 修正記錄 (`Correction` model) 同時作為規則學習的輸入源

**已知問題**:
- `DocumentDetailTabs.tsx` 有 TODO: 實作欄位編輯功能

---

### 2.5 公司與模板管理 (D5)

| # | 功能 | 狀態 | 層級 | 實現文件 | 說明 |
|---|------|------|------|---------|------|
| 33 | 公司配置管理 | ✅ | L1+L3 | `companies/`, `company.service.ts` (1,720 LOC) | Forwarder→Company 重構 |
| 34 | 模板定義 | ✅ | L1+L3 | `admin/data-templates/` | 模板 CRUD |
| 35 | 模板欄位映射 | ✅ | L1+L3 | `admin/template-field-mappings/` | 欄位映射配置 |
| 36 | 模板實例匹配 | ✅ | L1+L3 | `template-instances/`, `template-matching-engine.service.ts` | 自動匹配 |
| 37 | 匹配測試 | ✅ | L1+L2 | `admin/test/template-matching/` | 測試工具 |
| 38 | Line Item Pivot | ✅ | L3 | CHANGE-043 | lineItem 聚合展平 |
| 39 | Hybrid 雙模式 | ✅ | L3+L6 | CHANGE-044 | `outputMode` 配置 |
| 40 | 欄位類型擴展 | ✅ | L3+L6 | CHANGE-045 | `fieldType` 動態 Line Item |

**代碼結構說明**:
- `company.service.ts` (1,720 LOC) 是代碼庫第二大服務文件，涵蓋公司 CRUD、詳情、統計、規則管理
- 模板系統 (Epic 19) 提供 DataTemplate → TemplateFieldMapping → TemplateInstance 三層結構
- CHANGE-043/044/045 為 Phase 2 模板增強，支援 Line Item Pivot 展平和 Hybrid 雙模式輸出

**已知問題**:
- `company.service.ts` (1,720 LOC) 需拆分為 4 個子服務

---

### 2.6 報表與儀表板 (D6)

| # | 功能 | 狀態 | 層級 | 實現文件 | 說明 |
|---|------|------|------|---------|------|
| 41 | 處理統計儀表板 | ✅ | L1+L3 | `dashboard/`, `dashboard-statistics.service.ts` | 總覽統計 |
| 42 | 成本報表 | ✅ | L1+L3 | `reports/cost`, `city-cost-report.service.ts` (1,045 LOC) | 城市成本分析 |
| 43 | AI 成本追蹤 | ✅ | L1+L3 | `reports/ai-cost`, `ai-cost.service.ts` | GPT 使用成本 |
| 44 | 區域報表 | ✅ | L1+L3 | `reports/regional`, `regional-report.service.ts` | 跨區域統計 |
| 45 | 月度報表 | ✅ | L1+L3 | `reports/monthly`, `monthly-cost-report.service.ts` | 月度彙總 |

**代碼結構說明**:
- 儀表板使用 `dashboard-statistics.service.ts` 和 `processing-stats.service.ts` 聚合數據
- 報表支援 Excel 匯出 (ExcelJS)

**已知問題**:
- `/api/cost/*` (5 路由) 和 `/api/dashboard/*` (5 路由) 全部無認證保護

---

### 2.7 外部整合與批量處理 (D7)

| # | 功能 | 狀態 | 層級 | 實現文件 | 說明 |
|---|------|------|------|---------|------|
| 46 | SharePoint 獲取 | ✅ | L3+L7 | `sharepoint-document.service.ts`, `microsoft-graph.service.ts` | Graph API |
| 47 | Outlook 附件 | ✅ | L1+L3+L7 | `outlook-mail.service.ts`, `outlook-document.service.ts` | 過濾規則引擎 |
| 48 | n8n 整合 | ✅ | L3+L7 | `n8n/` (10 services) | 三條子路徑 |
| 49 | RESTful API | ✅ | L2+L3 | `invoice-submission.service.ts` | 外部提交 API |
| 50 | Webhook 通知 | ✅ | L3 | `webhook.service.ts` | 回調重試策略 |
| 51 | 歷史詳情頁 | ✅ | L1 | CHANGE-003 | 批量處理詳情 |
| 52 | AI 詳情 Tab | ✅ | L1 | CHANGE-023 | 文件 AI Details |
| 53 | Template 流程 | ✅ | L2+L3 | CHANGE-037 | autoMatch + export |

**代碼結構說明**:
- SharePoint: API Key 認證 (`x-api-key`) → Graph API 下載 → Blob → Document → ProcessingQueue
- Outlook: 兩種模式 (MESSAGE_ID / DIRECT_UPLOAD) + 白/黑名單過濾規則引擎
- n8n: 三條子路徑 — 文件提交 (`/api/n8n/documents`)、入站 Webhook (`/api/n8n/webhook`)、手動觸發 (`/api/workflows/trigger`)
- SSE 進度追蹤: `ReadableStream` + `TextEncoder`，1 秒更新 + 15 秒心跳 + 5 分鐘超時

**已知問題**:
- n8n `uploadToStorage()` 為 Stub（返回模擬 URL，未整合 Azure Blob）
- n8n `triggerProcessing()` 為 Stub（只改 status，未觸發統一處理器）
- SharePoint/Outlook 無主動監控，依賴外部系統主動呼叫

---

### 2.8 系統管理與基礎設施 (D8)

| # | 功能 | 狀態 | 層級 | 實現文件 | 說明 |
|---|------|------|------|---------|------|
| 54 | 認證授權 | ✅ | L2+L3+L8 | `auth/`, NextAuth v5, Azure AD SSO + 本地 | 雙模式認證 |
| 55 | 用戶管理 | ✅ | L1+L2+L3 | `admin/users/`, `user.service.ts` | 用戶 CRUD + 角色 |
| 56 | User Profile | ✅ | L1+L2 | CHANGE-049 | 個人資料 + 密碼變更 |
| 57 | 多語言 i18n | ✅ | L8 | `messages/` (102 JSON), `src/i18n/` | 34 命名空間 × 3 語言 |
| 58 | 健康監控 | ✅ | L1+L3 | `admin/monitoring/health/`, `health-check.service.ts` | 系統狀態 |
| 59 | 系統日誌 | ✅ | L2 | `/api/admin/logs` (SSE) | SSE 串流日誌 |
| 60 | 系統配置 | ✅ | L1+L3 | `admin/settings/`, `system-config.service.ts` (1,553 LOC) | 參數配置 |
| 61 | 告警系統 | ✅ | L1+L3 | `admin/alerts/`, `alert-*.service.ts` (4 services) | 規則 + 評估 + 通知 |
| 62 | 備份還原 | ✅ | L1+L3 | `admin/backup/`, `backup.service.ts` (1,120 LOC) | 備份 + 排程 + 還原 |
| 63 | 審計合規 | ✅ | L1+L3 | `audit/`, `audit-log.service.ts`, `traceability.service.ts` | 審計追蹤 |
| 64 | 城市區域 | ✅ | L3 | `city.service.ts`, `regional-manager.service.ts` | 數據隔離 |
| 65 | 設定中心 | ✅ | L1+L3 | CHANGE-050, `system-settings.service.ts` | 統一設定入口 |

**代碼結構說明**:
- 認證: NextAuth v5 (`auth.config.ts`) + Azure AD SSO + 本地帳號密碼登入
- i18n: next-intl 4.7，使用 `[locale]` 路由前綴，ICU MessageFormat
- 備份: 支援手動/排程備份，含 `backup-scheduler.service.ts` 和 `restore.service.ts` (1,017 LOC)
- 告警: AlertRule → AlertEvaluation → Alert → Notification 四步流程

**已知問題**:
- `auth.config.ts` 有 9 個 console.log 洩露用戶電郵/密碼驗證資訊（最高安全風險）
- `system-config.service.ts` (1,553 LOC) 需拆分
- Email 通知服務未完整整合（2 個 TODO）
- 測試覆蓋率 ≈ 0%，Playwright 已安裝但未配置

---

## 3. 功能整合總覽

### 3.1 功能與架構層級映射矩陣

| 層級 | 功能編號 | 功能數 |
|------|----------|--------|
| **L1** 前端展示層 | #1,3,5,7,8,15,20,21,27,29,31,32,33-37,41-45,47,51,52,55,56,58,60-65 | 30+ |
| **L2** API 路由層 | #1,5,20,21,27-29,37,48-50,53,54,55,59 | 15+ |
| **L3** 業務服務層 | #1-4,6,19-26,28-30,33-40,41-50,53,54,55,58,60-65 | 40+ |
| **L4** AI 管線層 | #9-18,30 | 11 |
| **L5** 映射引擎層 | #19,20,25,26 | 4 |
| **L6** 資料存取層 | 橫切所有功能 (122 models) | 橫切 |
| **L7** 外部整合層 | #6,10-12,46-48 | 6 |
| **L8** i18n 層 | #54,57 + 橫切所有 UI 功能 | 橫切 |
| **L9** 基礎設施層 | Docker + Dev Tools | 橫切 |

### 3.2 架構層級功能分布

```
L1  Frontend:             ██████████████████████████████  30+ 功能 (UI 組件 429 個)
L2  API Layer:            ███████████████  15+ 功能 (331 routes, ~414 endpoints)
L3  Service Layer:        ████████████████████████████████████████  40+ 功能 (200 services)
L4  AI Pipeline:          ███████████  11 功能 (42 files)
L5  Mapping Engine:       ████  4 功能 (31 files)
L6  Data Access:          (橫切)  122 models, Prisma ORM
L7  External:             ██████  6 功能 (37+ files)
L8  i18n:                 (橫切)  102 JSON × 3 語言
L9  Infrastructure:       (橫切)  Docker Compose
```

> **注**: L3 業務服務層是規模最大的層級（~100K LOC），D1-D8 所有功能域的核心邏輯均在此層實現。L1 前端展示層次之（~118K LOC），因為大量功能需要 Admin UI。

### 3.3 代碼品質熱點 (按功能域)

| 功能域 | console.log | any 類型 | TODO/FIXME | >1000 LOC 文件 | 主要問題 |
|--------|-------------|----------|------------|----------------|---------|
| D1 文件處理 | 25+ | 2 | 7 | 1 | Azure Blob 整合 TODO |
| D2 AI 管線 | 47+ | 5 | 6 | 3 | GPT 調用 TODO、大文件 |
| D3 映射引擎 | 4+ | 0 | 0 | 0 | 無測試 |
| D4 審核工作流 | 4+ | 0 | 1 | 0 | 欄位編輯 TODO |
| D5 公司模板 | 8+ | 3 | 1 | 2 | company.service.ts 過大 |
| D6 報表 | 3+ | 0 | 0 | 1 | Auth 覆蓋率 0% |
| D7 外部整合 | 30+ | 2 | 3 | 1 | n8n Stub 功能 |
| D8 系統管理 | 166+ | 9 | 27 | 8 | auth log 安全風險 |
| **合計** | **287** | **21** | **45** | **16** | — |

### 3.4 Phase 2 功能擴展分析

Phase 2 通過 CHANGE 機制引入了 16 個重大新功能：

| CHANGE | 功能 | 功能域 | 影響分析 |
|--------|------|--------|---------|
| CHANGE-003 | 歷史文件詳情頁 | D7 | 新增頁面 + API |
| CHANGE-023 | AI 詳情 Tab | D7 | 文件詳情頁增強 |
| CHANGE-024 | 三階段提取架構 | D2 | **重大重構**: 單次 GPT → 三階段分離 |
| CHANGE-025 | 統一處理流程優化 | D2 | 三階段路由邏輯優化 |
| CHANGE-026 | Prompt Config Stage | D2 | Prompt 與三階段深度整合 |
| CHANGE-031 | Invoice→Document 重命名 | D1 | **全局重構**: 路由/變量/UI 文本 |
| CHANGE-032 | Pipeline Ref-Match + FX | D5 | 新 PipelineConfig 模型 + Admin UI |
| CHANGE-037 | Data Template 完善 | D7 | autoMatch + export API |
| CHANGE-041 | 批量文件匹配 | D4 | BulkMatchDialog 整合 |
| CHANGE-043 | Line Item Pivot | D5 | Template Engine lineItem 聚合 |
| CHANGE-044 | Line Item Hybrid | D5 | DataTemplate outputMode 配置 |
| CHANGE-045 | FieldDefinitionSet 類型 | D5 | fieldType 動態 Line Item |
| CHANGE-049 | User Profile | D8 | 新頁面 `/profile` |
| CHANGE-050 | System Settings Hub | D8 | 統一設定中心 `/admin/settings` |
| CHANGE-051 | Extracted Fields 重構 | D4 | Line Items + i18n 源標籤 |

**域影響分析**: D2 (AI 管線) 受 Phase 2 影響最大（7 個 CHANGE），其次是 D5 (公司模板, 5 個 CHANGE)。

### 3.5 功能缺口分析

| 缺口 | 嚴重度 | 功能域 | 對應 TODO | 說明 |
|------|--------|--------|----------|------|
| 測試覆蓋 ≈ 0% | 🔴 | 全域 | — | 僅 1 個測試文件，核心管線無測試 |
| Auth 覆蓋率 58% | 🔴 | D8 | — | 140 個路由無認證，含 `/v1/*` 74 個 |
| n8n Blob/Processing Stub | 🟡 | D7 | TODO (2) | 返回模擬 URL，未觸發真實處理 |
| Azure Blob 整合不完整 | 🟡 | D1/D8 | TODO (7) | 備份刪除、公司上傳等 |
| Email 通知未整合 | 🟡 | D8 | TODO (2) | `alert.service.ts`, `alert-notification.service.ts` |
| Node.js Dockerfile 缺失 | 🟡 | D8 | — | 無生產部署容器配置 |
| CI/CD Pipeline 缺失 | 🟡 | D8 | — | 零自動化部署 |
| WebSocket 推送 | 🟢 | D8 | TODO (2) | 健康檢查即時通知 |

---

## 4. 能力總結

### 4.1 八大功能域能力矩陣

| 功能域 | 成熟度 | 功能數 | 實現率 | 主要風險 |
|--------|--------|--------|--------|---------|
| D1 文件處理與 OCR | Production | 8 | 100% | Azure Blob TODO (7 處) |
| D2 AI 提取管線 | Production | 10 | 100% | V2/V3 雙軌代碼重複；3 個 P0 TODO |
| D3 三層映射引擎 | Production | 8 | 100% | 無測試覆蓋 |
| D4 審核工作流 | Stable | 6 | 100% | 欄位編輯 TODO |
| D5 公司與模板管理 | Stable | 8 | 100% | company.service.ts 過大 (1,720 LOC) |
| D6 報表與儀表板 | Stable | 5 | 100% | Auth 覆蓋率 0% (/cost, /dashboard) |
| D7 外部整合 | Needs Improvement | 8 | 100% | n8n 2 個 Stub 功能 |
| D8 系統管理 | Needs Improvement | 12 | 100% | Auth 安全 log；Email 未整合；無 CI/CD |

### 4.2 安全風險評估

**整體安全評分: 5.5/10** (三次驗證下修)

| 維度 | 評分 | 說明 |
|------|------|------|
| Auth 覆蓋率 | 4/10 | `/v1/*` 74 路由無認證、`/cost/*` `/dashboard/*` 全無認證 |
| 輸入驗證 | 6/10 | 62% Zod 覆蓋率，73 個寫入端點缺失驗證 |
| 代碼品質 | 7/10 | 100% JSDoc (200/200)，287 console.log 待清理 |
| 類型安全 | 9/10 | 僅 21 處 any，整體類型嚴謹 |
| 測試覆蓋 | 1/10 | 幾乎無測試，最大風險 |
| 技術債務 | 5/10 | 45 TODO + 16 大文件 + 15 處 raw SQL |

**高風險未保護路由**:
- `/api/v1/*` (74 路由): 版本化業務 API 無 session auth
- `/api/cost/*` (5 路由): 全部無認證，敏感財務數據
- `/api/dashboard/*` (5 路由): 全部無認證
- `auth.config.ts` 的 9 個 console.log: 洩露用戶電郵和環境配置

**正面發現**:
- 0 硬編碼密碼/密鑰
- 0 XSS 漏洞 (無 dangerouslySetInnerHTML)
- 100% JSDoc 合規 (200/200 services)
- 99.4% 類型安全 (僅 21 處 any)

### 4.3 已知技術債務與風險

| 嚴重度 | 問題 | 數量 | 影響 |
|--------|------|------|------|
| 🔴 CRITICAL | 未保護 API 路由 | 140 | 數據洩露風險 |
| 🔴 CRITICAL | 測試覆蓋率 ≈ 0% | — | 回歸風險極高 |
| 🔴 CRITICAL | auth.config.ts 安全 log | 9 | 用戶隱私洩露 |
| 🟠 HIGH | console.log | 287 (94 files) | 生產環境噪音 |
| 🟠 HIGH | 大文件 >1000 LOC | 16 files | 可維護性差 |
| 🟠 HIGH | TODO/FIXME | 45 (30+ files) | 未完成功能 |
| 🟡 MEDIUM | any 類型 | 21 (15 files) | 類型安全降低 |
| 🟡 MEDIUM | Zod 覆蓋率 62% | 73 端點缺失 | 輸入驗證缺口 |
| 🟡 MEDIUM | Raw SQL | 15 (9 files) | SQL 注入風險低但需關注 |
| 🟡 MEDIUM | V2/V3 雙軌並存 | 42 files | 代碼重複 23% |
| 🟢 LOW | Hook 命名不一致 | ~43 | camelCase vs kebab-case |
| 🟢 LOW | CUID/UUID 混用 | 74:47 | ID 策略不統一 |

### 4.4 架構演進建議

| 建議 | 優先級 | 工作量 | 目標成果 |
|------|--------|--------|---------|
| **安全加固** | P0 | 8 天 | Auth 95%+, Zod 95%+, 消除安全 log |
| **代碼品質提升** | P1 | 13 天 | 清理 287 console.log, 修復 21 any, 拆分 5 大文件 |
| **測試策略** | P1 | 24 天 | 70%+ 覆蓋率, P0 核心 90%+ |
| **管線統一** | P2 | 36-42 天 | 統一 V2/V3, 消除代碼重複 |
| **生產就緒** | P2 | 24-30 天 | K8s + CI/CD + Prometheus 監控 |
| **功能擴展** | P1(框架) P2(應用) | 12-16 週 | 插拔式文件處理框架 |

**建議實施順序**:
1. Week 1: P0 安全加固 (立即修復) + 測試框架搭建
2. Week 2-3: 代碼品質清理 + 核心測試
3. Week 4-5: 大文件重構 + E2E 測試 + 容器化
4. Week 6-8: 系統性安全覆蓋 + CI/CD + 監控
5. Q2 起: 管線統一 + 功能擴展

---

## 5. 端到端場景

### 場景一：文件上傳 → AI 提取 → 審核（核心流程）

```
用戶：拖放上傳 PDF 發票到系統

┌──────────────────────────────────────────────────────────────┐
│  文件上傳 → AI 提取 → 審核流程 (涉及 D1→D2→D3→D4)            │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│  [D1] 用戶拖放上傳 (FileUploader.tsx)                         │
│      │                                                         │
│      ▼  POST /api/documents/upload                            │
│  驗證 + Azure Blob Upload + Document.create(UPLOADED)         │
│      │                                                         │
│      ▼  Fire-and-Forget Pipeline                               │
│  [D1] downloadBlob → PdfConverter.convert() → Base64[]        │
│      │                                                         │
│      ▼  [D2] V3.1 StageOrchestrator                           │
│      ├── Stage 1: GPT-5-nano → 公司識別 (Company.findMany)    │
│      ├── Stage 2: GPT-5-nano → 格式識別 (DocumentFormat)      │
│      └── Stage 3: GPT-5.2 → 欄位提取                         │
│          ├── [D5] PromptAssembly (PromptConfig.findMany)       │
│          ├── [D5] ReferenceNumberMatcher (CHANGE-032)         │
│          └── [D5] ExchangeRateConverter (CHANGE-032)          │
│      │                                                         │
│      ▼  [D2] ConfidenceV3_1Service.calculate()                │
│  5-6 維度: Company(20%) + Format(15%) + Extraction(30%)       │
│           + Completeness(20%) + ConfigBonus(15%)               │
│      │                                                         │
│      ▼  [D4] RoutingDecision                                  │
│      ├── ≥90% → AUTO_APPROVE → Document.status=APPROVED       │
│      ├── 70-89% → QUICK_REVIEW → ReviewRecord.create()       │
│      └── <70% → FULL_REVIEW → 詳細審核                        │
│      │                                                         │
│      ▼  [D3] 術語記錄 → TermAggregationResult                │
│      │                                                         │
│      ▼  [D5] autoTemplateMatching → TemplateInstance          │
│      │                                                         │
│      ▼  [D8] AuditLog.create()                                │
│                                                                │
│  涉及: D1(上傳/OCR), D2(提取/信心度), D3(映射/術語),          │
│        D4(審核/路由), D5(模板/公司), D8(審計)                  │
│  橫跨 6 個架構層級 (L1, L2, L3, L4, L5, L7)                  │
│  Prisma Models: 17+ (Document, ExtractionResult, Company,     │
│    DocumentFormat, PromptConfig, MappingRule, ReviewRecord,    │
│    Correction, AuditLog, TemplateInstance, ...)                │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

### 場景二：規則學習循環

```
觸發: 人工修正同一欄位 ≥3 次

┌──────────────────────────────────────────────────────────────┐
│  規則學習循環 (涉及 D3→D4→D3)                                 │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│  [D4] 用戶修正欄位 (PATCH /api/review/[id]/correct)          │
│      │                                                         │
│      ▼  Correction.create() + FieldCorrectionHistory          │
│  Day 1: "100000" → "1000.00" (修正 #1)                       │
│  Day 2: "200000" → "2000.00" (修正 #2)                       │
│  Day 3: "150000" → "1500.00" (修正 #3 → 達到閾值!)           │
│      │                                                         │
│      ▼  [D3] PatternAnalysis 定時掃描 (日 1 次)              │
│  CorrectionPattern status → CANDIDATE (≥3 次同模式)           │
│      │                                                         │
│      ▼  [D3] RuleSuggestionGenerator                          │
│  推斷最佳規則 → ImpactAnalysis (90 天影響 + 風險分析)         │
│      │                                                         │
│      ▼  RuleSuggestion.create() + 通知 Super Users            │
│      │                                                         │
│      ▼  [D3] Super User 批准 (POST /api/rules/suggestions/    │
│          [id]/approve)                                         │
│  MappingRule.create(ACTIVE) + RuleVersion + 快取失效           │
│      │                                                         │
│      ▼  [D3] 新發票自動套用規則                               │
│  field-mapping-engine.ts → 準確率 88%→93.2%                   │
│      │                                                         │
│      ▼  [D3] AutoRollback 監控 (定時)                         │
│  if (accuracyDrop > 10%) → 回滾 + 通知                       │
│                                                                │
│  涉及: D3(映射/規則), D4(審核/修正), D8(審計/通知)            │
│  API 方法: 35 (修正 4 + 建議 9 + 規則 22)                    │
│  Prisma Models: 12+ (Correction, CorrectionPattern,           │
│    RuleSuggestion, MappingRule, RuleVersion, RollbackLog, ...) │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

### 場景三：批量處理（歷史數據導入）

```
觸發: 管理員上傳批量歷史文件

┌──────────────────────────────────────────────────────────────┐
│  批量處理流程 (涉及 D1→D2→D7)                                 │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│  [D7] 建立批次 (POST /api/admin/historical-data/batches)      │
│      │                                                         │
│      ▼  HistoricalBatch.create(PENDING)                       │
│      │                                                         │
│      ▼  [D1] 上傳文件 (POST /upload, Multipart)               │
│  HistoricalFile.create(PENDING) × N                           │
│      │                                                         │
│      ▼  [D1] 檔案類型檢測 (file-detection.service.ts)        │
│      │                                                         │
│      ▼  [D7] 開始處理 (POST .../process)                      │
│  p-queue-compat: 5 並發, 10 req/sec                           │
│      │                                                         │
│      ├── [D2] 文件 1: Azure DI/GPT Vision → 統一處理器        │
│      ├── [D2] 文件 2: (並行)                                  │
│      ├── [D2] 文件 3: (並行)                                  │
│      ├── [D2] 文件 4: (並行)                                  │
│      └── [D2] 文件 5: (並行)                                  │
│      │                                                         │
│      ▼  [D7] SSE 進度追蹤 (GET .../progress)                 │
│  ReadableStream: 1s 更新 + 15s 心跳 + 5min 超時              │
│      │                                                         │
│      ▼  [D1] 術語聚合 (batch-term-aggregation)                │
│  Levenshtein 聚類 (threshold 0.85) + AI 分類 (可選)           │
│      │                                                         │
│      ▼  HistoricalBatch.update(COMPLETED)                     │
│                                                                │
│  涉及: D1(上傳/OCR), D2(提取), D7(批量/SSE)                  │
│  API 方法: 26 (批次 16 + 文件 10)                             │
│  Prisma Models: 6 (HistoricalBatch, HistoricalFile,           │
│    TermAggregationResult, FileTransactionParty, ...)           │
│  限制: 50MB/文件, 500 文件/批次, 5 並發, 2 次重試            │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

### 場景四：外部整合觸發

```
觸發: SharePoint/Outlook/n8n 外部系統推送文件

┌──────────────────────────────────────────────────────────────┐
│  外部整合流程 (涉及 D7→D1→D2)                                 │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│  三條子路徑:                                                   │
│                                                                │
│  [4A] SharePoint ──────────────────────────────────────       │
│  │ API Key 驗證 (x-api-key) → Graph API 下載                 │
│  │ → 驗證 (MIME + 50MB + 重複) → Blob Upload                 │
│  │ → Document.create(SHAREPOINT) → ProcessingQueue            │
│  │ Prisma: ApiKey, SharePointConfig, SharePointFetchLog       │
│  │                                                             │
│  [4B] Outlook ────────────────────────────────────────        │
│  │ API Key 驗證 → 過濾規則引擎 (6 規則類型 × 白/黑名單)      │
│  │ → 兩種模式: MESSAGE_ID (Graph API) / DIRECT_UPLOAD         │
│  │ → 逐附件: MIME + 30MB + SHA-256 + 重複 → Blob Upload      │
│  │ → Document.create(OUTLOOK) → ProcessingQueue               │
│  │ Prisma: OutlookConfig, OutlookFilterRule, OutlookFetchLog  │
│  │                                                             │
│  [4C] n8n Webhook ────────────────────────────────────        │
│  │ n8nApiMiddleware (獨立 API Key) → Base64 直傳              │
│  │ → Document.create(N8N_WORKFLOW)                            │
│  │ ⚠️ Blob: Stub (模擬 URL) / Processing: Stub (只改 status) │
│  │ Prisma: N8nApiKey, N8nApiCall, N8nWebhookEvent             │
│  │                                                             │
│  所有路徑最終匯入:                                             │
│       ▼                                                        │
│  [D1] Azure Blob Storage → [D2] 統一處理器/V3.1 管線          │
│                                                                │
│  涉及: D7(外部), D1(儲存), D2(處理)                           │
│  API 方法: 36 (SharePoint 9 + Outlook 14 + n8n 13)           │
│  Prisma Models: 18 (ApiKey, City, Document,                   │
│    ProcessingQueue, *Config, *FetchLog, N8n*, Workflow*, ...)  │
│                                                                │
│  關鍵差異:                                                     │
│  SharePoint: Graph API + 50MB + ✅ Blob                       │
│  Outlook: Graph API/Base64 + 30MB + 過濾規則 + ✅ Blob        │
│  n8n: Base64 + 50MB + ⚠️ Blob Stub + ⚠️ Processing Stub     │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

---

## 附錄 A: 代碼庫規模快速參考

| 指標 | 數量 |
|------|------|
| **TypeScript 文件** | 1,363 |
| **TypeScript LOC** | ~375,270 |
| **Python 服務 LOC** | 2,719 (12 files) |
| **Prisma Schema** | 4,354 lines, 122 models, 113 enums |
| **React 組件** | 429 (34 UI + 358 features + 5 layout + 32 other) |
| **頁面** | 81 pages + 3 layouts ([locale]) |
| **API 路由文件** | 331 route.ts |
| **API 端點** | ~414 |
| **業務服務** | 200 (111 flat + 89 subdirs) |
| **自定義 Hooks** | 104 |
| **i18n 翻譯文件** | 102 JSON (34 namespaces × 3 languages) |
| **Prisma Models** | 122 |
| **Prisma Enums** | 113 |
| **索引** | 439 |
| **唯一約束** | 73 (30 @@unique + 43 @unique) |
| **遷移** | 10 |
| **Package 依賴** | 77 production + 20 dev |
| **測試文件** | 1 |
| **>1000 LOC 文件** | 16 |
| **console.log** | 287 (94 files) |
| **any 類型** | 21 (15 files) |
| **TODO/FIXME** | 45 (30+ files) |

---

## 附錄 B: Epic → 功能域對照表

| Epic | 名稱 | 功能域 | 功能數 | Phase 2 CHANGE |
|------|------|--------|--------|----------------|
| 0 | Historical Data & Batch Processing | D1, D7 | 4 | CHANGE-003, CHANGE-006 |
| 1 | User Management & Auth | D8 | 2 | CHANGE-049 |
| 2 | Document Upload & AI Processing | D1, D2 | 4 | CHANGE-031, CHANGE-042 |
| 3 | Review Workflow | D4 | 3 | CHANGE-041, CHANGE-051 |
| 4 | Mapping Rules & Auto-Learning | D3 | 4 | CHANGE-028/029/030 |
| 5 | Company/Forwarder Management | D5 | 1 | CHANGE-032, CHANGE-044 |
| 6 | City & Regional Management | D8 | 2 | — |
| 7 | Reports & Analytics | D6 | 2 | — |
| 8 | Audit & Compliance | D8 | 1 | — |
| 9 | External Integrations (SharePoint/Outlook) | D7 | 2 | CHANGE-047 |
| 10 | n8n Workflow Integration | D7 | 1 | — |
| 11 | API Documentation & Webhooks | D7 | 2 | — |
| 12 | System Administration | D8 | 6 | — |
| 13 | Document Preview & Field Mapping | D1, D5 | 2 | CHANGE-023, CHANGE-042 |
| 14 | Prompt Configuration | D2 | 1 | CHANGE-026 |
| 15 | Extraction V3 Pipeline | D2 | 1 | CHANGE-024/025/026 |
| 16 | Document Format Management | D1 | 1 | — |
| 17 | Internationalization | D8 | 1 | — |
| 18 | Local Account Auth | D8 | 1 | — |
| 19 | Template System | D5 | 4 | CHANGE-037, CHANGE-043/044/045 |
| 20 | Reference Numbers & Regions | D5, D8 | 2 | CHANGE-032 |
| 21 | Exchange Rate Management | D5 | 1 | CHANGE-032 |
| 22 | System Settings Hub | D8 | 1 | CHANGE-050 |

---

## 更新歷史

| 版本 | 日期 | 說明 |
|------|------|------|
| V1.0 | 2026-02-27 | 初版建立，基於多輪 Agent 並行分析 + 三次命令行驗證 |

---

*數據來源: ANALYSIS-RAW-DATA.md, BATCH1-FEATURE-MAPPING.md, BATCH1-ARCH-LAYERS.md, TASK3-E2E-FLOW-TRACING.md, TASK4-DESIGN-DECISIONS.md, TASK5-SECURITY-QUALITY.md, TASK6-RECOMMENDATIONS.md*
*驗證方式: 10 個分析 Agent 並行 + 三次命令行逐項核實*
