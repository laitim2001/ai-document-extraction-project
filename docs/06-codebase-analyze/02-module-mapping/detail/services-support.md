# Services Layer - Support Services & Standalone Files Detail

> **分析日期**: 2026-04-09
> **範圍**: 6 個支援子目錄 + 111 個獨立根層級服務文件
> **總計**: 200 個 `.ts` 文件 | 99,684 行代碼

---

## Part A: Support Subdirectories (6 個)

### 1. `src/services/logging/` — 日誌服務 (3 files, 1,007 lines)

| 文件 | 行數 | 用途 | 關鍵導出 |
|------|------|------|----------|
| `logger.service.ts` | 369 | 結構化日誌寫入（5 級別）+ SSE 串流 + AsyncLocalStorage 上下文 | `LoggerService`, `logStreamEmitter`, `webLogger`, `apiLogger`, `aiLogger`, `dbLogger`, `n8nLogger`, `schedulerLogger`, `backgroundLogger`, `systemLogger`, `createLogger` |
| `log-query.service.ts` | 608 | 日誌查詢/統計/匯出/清理 | `LogQueryService`, `logQueryService` |
| `index.ts` | 30 | 統一導出 | — |

**業務邏輯**: LoggerService 為每筆日誌寫入 `SystemLog` Prisma 模型，同時透過 EventEmitter 推送 SSE 事件。使用 AsyncLocalStorage 追蹤 correlationId/requestId。LogQueryService 支援多條件篩選、CSV/JSON/TXT 匯出、保留策略清理。

**Prisma 模型**: `SystemLog`, `LogExport`, `LogRetentionPolicy`, `User`

**跨依賴**: `@/lib/prisma`, `@/types/logging`

---

### 2. `src/services/n8n/` — n8n 工作流整合 (10 files, 5,298 lines)

| 文件 | 行數 | 用途 | 關鍵導出 |
|------|------|------|----------|
| `n8n-api-key.service.ts` | 427 | API Key SHA-256 雜湊存儲、驗證、速率限制 | `N8nApiKeyService`, `n8nApiKeyService` |
| `n8n-document.service.ts` | 564 | 處理 n8n 提交的 Base64 文件、狀態查詢 | `N8nDocumentService`, `n8nDocumentService` |
| `n8n-webhook.service.ts` | 463 | Webhook 事件發送、重試機制（1s/5s/30s） | `N8nWebhookService`, `n8nWebhookService` |
| `webhook-config.service.ts` | 809 | Webhook 配置 CRUD、AES-256-GCM 加密令牌 | `WebhookConfigService`, `webhookConfigService` |
| `workflow-definition.service.ts` | 441 | 工作流定義 CRUD | `WorkflowDefinitionService`, `workflowDefinitionService` |
| `workflow-error.service.ts` | 479 | 錯誤診斷、智能分類、敏感資訊遮蔽 | `WorkflowErrorService`, `workflowErrorService` |
| `workflow-execution.service.ts` | 535 | 執行狀態追蹤、統計分析 | `WorkflowExecutionService`, `workflowExecutionService` |
| `workflow-trigger.service.ts` | 702 | 手動觸發工作流、參數驗證、重試/取消 | `WorkflowTriggerService`, `workflowTriggerService` |
| `n8n-health.service.ts` | 745 | n8n 連線健康監控（HEALTHY/DEGRADED/UNHEALTHY） | `N8nHealthService`, `n8nHealthService` |
| `index.ts` | 133 | 統一導出（含架構文檔） | — |

**業務邏輯**: 完整的 n8n 整合層。API Key 使用 SHA-256 雜湊存儲，原始 Key 僅建立時返回一次。文件服務接收 Base64 編碼文件後上傳 Blob Storage 並觸發處理。Webhook 支援 3 次重試（指數退避）。健康監控使用成功率閾值（≥90% HEALTHY, 70-90% DEGRADED, <70% UNHEALTHY）。

**Prisma 模型**: `N8nApiKey`, `N8nWebhookEvent`, `N8nWebhookConfig`, `WorkflowDefinition`, `WorkflowExecution`, `WorkflowExecutionStep`, `N8nHealthCheck`, `Document`

**跨依賴**: `@/lib/prisma`, `@/services/encryption.service`, Blob Storage

---

### 3. `src/services/prompt/` — Prompt 構建 (2 files, 188 lines)

| 文件 | 行數 | 用途 | 關鍵導出 |
|------|------|------|----------|
| `identification-rules-prompt-builder.ts` | 178 | 將 DocumentFormat.identificationRules 轉為 GPT 可理解的 Prompt | `buildIdentificationRulesPrompt`, `hasValidIdentificationRules` |
| `index.ts` | 10 | 導出 | — |

**業務邏輯**: 按優先級排序格式識別規則，將 Logo 特徵、關鍵字、版面特徵轉為結構化 Markdown Prompt 供 GPT Vision 使用。

**跨依賴**: `@/types/unified-processor`, `@/types/document-format`

---

### 4. `src/services/transform/` — 欄位轉換器 (9 files, 1,449 lines)

| 文件 | 行數 | 用途 | 關鍵導出 |
|------|------|------|----------|
| `types.ts` | 152 | Transform 介面定義、結果類型 | `Transform`, `TransformContext`, `TransformResult`, `BatchTransformResult` |
| `transform-executor.ts` | 266 | 工廠模式統一執行入口 | `TransformExecutor`, `transformExecutor` |
| `direct.transform.ts` | 86 | DIRECT 直接映射 | `DirectTransform`, `directTransform` |
| `formula.transform.ts` | 214 | FORMULA 公式計算 | `FormulaTransform`, `formulaTransform` |
| `lookup.transform.ts` | 147 | LOOKUP 查找表映射 | `LookupTransform`, `lookupTransform` |
| `concat.transform.ts` | 127 | CONCAT 欄位合併 | `ConcatTransform`, `concatTransform` |
| `split.transform.ts` | 138 | SPLIT 欄位拆分 | `SplitTransform`, `splitTransform` |
| `aggregate.transform.ts` | 261 | AGGREGATE 聚合轉換（lineItems/extraCharges） | `AggregateTransform`, `aggregateTransform` |
| `index.ts` | 58 | 統一導出（類型 + 執行器 + 各轉換器） | — |

**業務邏輯**: 6 種轉換類型的策略模式實現。TransformExecutor 作為工廠入口，根據 `FieldTransformType` 分派至對應轉換器。支援單一執行、安全執行（捕獲錯誤）、批量執行、參數驗證。CUSTOM 轉換器因安全考量暫未啟用。

**跨依賴**: `@/types/template-field-mapping`

---

### 5. `src/services/identification/` — 公司識別 (2 files, 399 lines)

| 文件 | 行數 | 用途 | 關鍵導出 |
|------|------|------|----------|
| `identification.service.ts` | 384 | 調用 Python Mapping 服務進行公司模式匹配 | `IdentificationService`, `identificationService`, `identifyForwarder`(deprecated), `CONFIDENCE_THRESHOLDS` |
| `index.ts` | 15 | 導出 | — |

**業務邏輯**: 從 OCR 文本識別公司。信心度路由：≥80% IDENTIFIED, 50-79% NEEDS_REVIEW, <50% UNIDENTIFIED。支援同步和 Fire-and-forget 模式。REFACTOR-001 將 Forwarder 重命名為 Company，保留向後兼容別名。

**Prisma 模型**: `Company`, `ForwarderIdentification`, `Document`

**跨依賴**: `@/lib/prisma`, Python Mapping Service (HTTP, port 8001)

---

### 6. `src/services/extraction-v2/` — Legacy V2 提取管線 (4 files, 1,767 lines)

| 文件 | 行數 | 用途 | 關鍵導出 |
|------|------|------|----------|
| `azure-di-document.service.ts` | 447 | Azure DI prebuilt-document 提取（替代 prebuilt-invoice） | `extractWithPrebuiltDocument`, `AzureDIDocumentResult` |
| `data-selector.service.ts` | 438 | 將 Azure DI 結果精選為 GPT 輸入（Markdown 格式） | `selectDataForGpt`, `analyzeResultQuality`, `SelectedData` |
| `gpt-mini-extractor.service.ts` | 616 | GPT-5-mini 智能欄位提取 | `extractFieldsWithGptMini`, `GptMiniExtractionResult` |
| `index.ts` | 266 | 統一導出 + `runExtractionV2Pipeline` 整合函數 | `runExtractionV2Pipeline`, `ExtractionV2Result` |

**業務邏輯**: CHANGE-020 新架構。4 步管線：(1) Azure DI prebuilt-document 提取 → (2) 數據精選（保留 KV pairs + tables，控制 token 數） → (3) 品質分析 → (4) GPT-mini 欄位提取。比 V1 更靈活，使用輕量 GPT 模型降低成本。

**跨依賴**: `@azure/ai-form-recognizer`, Azure OpenAI

---

## Part B: Standalone Service Files (111 files) — 按業務領域分類

### B1. User & Auth (9 files, 4,345 lines)

| 文件 | 行數 | 用途 |
|------|------|------|
| `user.service.ts` | 902 | 用戶 CRUD、Azure AD 同步、狀態管理 |
| `role.service.ts` | 495 | RBAC 角色管理、權限檢查、角色分配 |
| `city.service.ts` | 291 | 城市查詢、區域分組、權限過濾 |
| `city-access.service.ts` | 523 | 城市訪問權限授予/撤銷、過期清理 |
| `global-admin.service.ts` | 411 | 全域管理者角色管理 |
| `regional-manager.service.ts` | 583 | 區域經理角色管理 |
| `security-log.ts` | 521 | 安全事件記錄、嚴重性自動提升 |
| `encryption.service.ts` | 258 | AES-256-CBC 加密/解密 |
| `rate-limit.service.ts` | 234 | 滑動窗口速率限制（Upstash Redis） |
| `api-key.service.ts` | 577 | 外部 API Key 生命週期管理 |

### B2. Auditing & Compliance (7 files, 4,486 lines)

| 文件 | 行數 | 用途 |
|------|------|------|
| `audit-log.service.ts` | 349 | 審計日誌寫入（批次+同步） |
| `audit-query.service.ts` | 367 | 審計多條件篩選查詢 |
| `audit-report.service.ts` | 850 | 審計報告生成（4 種類型） |
| `api-audit-log.service.ts` | 583 | 外部 API 請求審計日誌 |
| `change-tracking.service.ts` | 637 | 數據變更追蹤、版本歷史 |
| `traceability.service.ts` | 528 | 文件追溯（數據點→原始發票） |
| `data-retention.service.ts` | 1150 | 數據保留策略 CRUD、歸檔執行 |

### B3. Company Management (5 files, 3,289 lines)

| 文件 | 行數 | 用途 |
|------|------|------|
| `company.service.ts` | 1720 | Company Profile CRUD、統計 |
| `company-matcher.service.ts` | 549 | 公司名稱模糊匹配（精確/變體/Fuzzy） |
| `company-auto-create.service.ts` | 562 | JIT 公司 Profile 自動建立 |
| `forwarder.service.ts` | 50 | (Deprecated) 重導至 company.service |
| `forwarder-identifier.ts` | 408 | 全域 Forwarder 識別快取與模式匹配 |

### B4. Document Processing (16 files, 9,453 lines)

| 文件 | 行數 | 用途 |
|------|------|------|
| `document.service.ts` | 619 | 文件 CRUD、分頁查詢 |
| `document-format.service.ts` | 748 | 文件格式識別/匹配/建立 |
| `document-issuer.service.ts` | 550 | 文件發行者識別與公司匹配 |
| `document-progress.service.ts` | 737 | 處理進度追蹤 |
| `document-source.service.ts` | 436 | 文件來源查詢與統計 |
| `extraction.service.ts` | 341 | OCR 提取（調用 Python 微服務） |
| `file-detection.service.ts` | 377 | 批量文件類型檢測（PDF/圖片） |
| `processing-router.service.ts` | 284 | 根據文件類型選擇 AI 處理方式 |
| `processing-result-persistence.service.ts` | 744 | 統一處理結果持久化至 DB |
| `processing-stats.service.ts` | 932 | 城市處理量統計 |
| `batch-processor.service.ts` | 1356 | 批量處理執行器（並發控制 5 任務） |
| `batch-progress.service.ts` | 476 | 批量處理進度追蹤 |
| `batch-term-aggregation.service.ts` | 703 | 批量術語聚合 |
| `invoice-submission.service.ts` | 417 | 外部 API 發票提交 |
| `task-status.service.ts` | 468 | 外部 API 任務狀態查詢 |
| `result-retrieval.service.ts` | 550 | 外部 API 結果擷取 |

### B5. AI / OCR Services (11 files, 7,440 lines)

| 文件 | 行數 | 用途 |
|------|------|------|
| `gpt-vision.service.ts` | 1199 | GPT-5.2 Vision 處理（圖片/掃描PDF） |
| `azure-di.service.ts` | 505 | Azure Document Intelligence（原生PDF） |
| `ai-cost.service.ts` | 888 | AI API 使用成本追蹤與快取 |
| `ai-term-validator.service.ts` | 740 | GPT-5.2 智能術語分類/驗證 |
| `confidence.service.ts` | 436 | 文件信心度計算與歷史準確率整合 |
| `routing.service.ts` | 575 | 文件路由決策與處理隊列管理 |
| `mapping.service.ts` | 605 | 欄位映射核心（調用 Python 服務） |
| `term-aggregation.service.ts` | 832 | 術語聚合與叢集分析 |
| `term-classification.service.ts` | 483 | AI 術語分類（GPT-5.2 批次處理） |
| `hierarchical-term-aggregation.service.ts` | 708 | Company→Format→Terms 三層聚合 |
| `historical-accuracy.service.ts` | 421 | 欄位提取歷史準確率管理 |

### B6. Prompt Configuration (8 files, 2,060 lines)

| 文件 | 行數 | 用途 |
|------|------|------|
| `prompt-resolver.service.ts` | 306 | 三層 Prompt 配置解析（Global/Format/Company） |
| `prompt-resolver.factory.ts` | 107 | Prompt 解析服務單例工廠 |
| `prompt-merge-engine.service.ts` | 160 | 三種合併策略（OVERRIDE/APPEND/SECTION_MERGE） |
| `prompt-variable-engine.service.ts` | 244 | 變數替換引擎（靜態/動態/條件） |
| `prompt-cache.service.ts` | 182 | In-Memory 快取（TTL 自動過期） |
| `prompt-provider.interface.ts` | 270 | Provider 介面定義 |
| `static-prompts.ts` | 415 | 靜態 Prompt 模板（備援） |
| `hybrid-prompt-provider.service.ts` | 376 | 動態/靜態混合策略 |

### B7. Rule Management (10 files, 5,880 lines)

| 文件 | 行數 | 用途 |
|------|------|------|
| `rule-resolver.ts` | 526 | 全域規則快取與版本管理 |
| `rule-accuracy.ts` | 360 | 規則準確率計算與下降檢測 |
| `rule-change.service.ts` | 915 | 規則變更請求 CRUD（5 種操作類型） |
| `rule-metrics.ts` | 627 | 規則應用成效統計分析 |
| `rule-simulation.ts` | 412 | 規則模擬測試（歷史數據） |
| `rule-suggestion-generator.ts` | 506 | 從 CANDIDATE 修正模式生成規則建議 |
| `rule-testing.service.ts` | 799 | 規則變更效果測試（A/B 對比） |
| `correction-recording.ts` | 342 | 用戶欄位修正記錄 |
| `pattern-analysis.ts` | 791 | 重複修正模式識別 |
| `impact-analysis.ts` | 484 | 規則變更影響分析 |
| `auto-rollback.ts` | 524 | 準確率下降自動回滾 |

### B8. Cost Tracking & Reports (9 files, 6,195 lines)

| 文件 | 行數 | 用途 |
|------|------|------|
| `city-cost.service.ts` | 936 | 城市級 AI 成本追蹤 |
| `city-cost-report.service.ts` | 1045 | 城市成本報表（AI + 人工） |
| `cost-estimation.service.ts` | 292 | 批量處理成本預估 |
| `monthly-cost-report.service.ts` | 903 | 月度成本分攤報告生成 |
| `expense-report.service.ts` | 666 | 費用明細報表匯出 |
| `dashboard-statistics.service.ts` | 566 | 儀表板統計（快取） |
| `regional-report.service.ts` | 790 | 跨城市匯總報表 |
| `region.service.ts` | 427 | Region CRUD |
| `reference-number.service.ts` | 989 | Reference Number CRUD |

### B9. Template & Export (6 files, 4,195 lines)

| 文件 | 行數 | 用途 |
|------|------|------|
| `template-field-mapping.service.ts` | 527 | 第二層映射配置 CRUD（標準→模版欄位） |
| `template-instance.service.ts` | 978 | 模版實例/行 CRUD、驗證、統計 |
| `template-matching-engine.service.ts` | 800 | 核心匹配引擎（mappedFields→TemplateInstance） |
| `template-export.service.ts` | 479 | Excel/CSV 導出 |
| `auto-template-matching.service.ts` | 890 | 文件自動匹配模版 |
| `data-template.service.ts` | 423 | 數據模版 CRUD |

### B10. Backup & System Admin (10 files, 6,845 lines)

| 文件 | 行數 | 用途 |
|------|------|------|
| `backup.service.ts` | 1120 | 數據備份管理（手動/排程） |
| `backup-scheduler.service.ts` | 776 | 備份排程 CRUD |
| `restore.service.ts` | 1017 | 數據恢復（完整/部分/演練/時間點） |
| `auto-rollback.ts` | 524 | 準確率下降自動回滾 |
| `health-check.service.ts` | 676 | 多服務健康檢查 |
| `system-config.service.ts` | 1553 | 系統配置 CRUD |
| `system-settings.service.ts` | 261 | 系統設定 CRUD + 預設值 |
| `pipeline-config.service.ts` | 390 | Pipeline 三層 scope 配置 |
| `performance.service.ts` | 762 | 效能指標查詢 |
| `performance-collector.service.ts` | 491 | 效能指標批量收集 |

### B11. Alert & Notification (6 files, 2,519 lines)

| 文件 | 行數 | 用途 |
|------|------|------|
| `alert.service.ts` | 762 | 告警生命週期管理 |
| `alert-rule.service.ts` | 414 | 警報規則 CRUD |
| `alert-evaluation.service.ts` | 449 | 警報觸發條件評估 |
| `alert-notification.service.ts` | 531 | 警報通知（Email/Teams/Webhook） |
| `alert-evaluation-job.ts` | 512 | 警報評估背景任務 |
| `notification.service.ts` | 263 | 通知記錄 CRUD |

### B12. External Integration (10 files, 6,077 lines)

| 文件 | 行數 | 用途 |
|------|------|------|
| `microsoft-graph.service.ts` | 638 | Microsoft Graph API（SharePoint 文件） |
| `sharepoint-config.service.ts` | 493 | SharePoint 連線配置 CRUD |
| `sharepoint-document.service.ts` | 527 | SharePoint 文件提交 |
| `outlook-config.service.ts` | 843 | Outlook 連線配置 CRUD |
| `outlook-document.service.ts` | 768 | Outlook 文件提交 |
| `outlook-mail.service.ts` | 455 | Outlook 郵件/附件操作 |
| `webhook.service.ts` | 682 | 外部 Webhook 通知 |
| `webhook-event-trigger.ts` | 311 | Webhook 事件統一觸發介面 |
| `openapi-loader.service.ts` | 409 | OpenAPI Spec 載入與快取 |
| `example-generator.service.ts` | 1139 | SDK 範例生成（TS/Python/C#） |

### B13. Miscellaneous (4 files, 2,027 lines)

| 文件 | 行數 | 用途 |
|------|------|------|
| `exchange-rate.service.ts` | 1110 | 匯率管理 CRUD + 轉換邏輯 |
| `field-definition-set.service.ts` | 568 | 欄位定義集 CRUD + 覆蓋率分析 |
| `index.ts` | 455 | 統一導出入口 + 核心常數（信心度閾值） |
| `forwarder.service.ts` | 50 | (Deprecated) 向後兼容重導 |

---

## Part C: Cross-Cutting Observations

### Prisma 模型使用密度（前 10）
1. `Document` — 被 16+ 服務引用
2. `Company` — 被 8+ 服務引用
3. `SystemLog` — logging/ 專用
4. `MappingRule` — rule-* 系列服務
5. `ExtractionResult` — document processing 系列
6. `Alert` / `AlertRule` — alert-* 系列
7. `N8nApiKey` / `WorkflowExecution` — n8n/ 系列
8. `AuditLog` — audit-* 系列
9. `Backup` / `BackupSchedule` — backup-* 系列
10. `TemplateInstance` — template-* 系列

### 設計模式
- **Singleton**: 幾乎所有 class-based 服務均導出單例實例（如 `logQueryService`, `n8nApiKeyService`）
- **Function-based**: 部分服務導出純函數（如 `user.service.ts`, `company.service.ts`）
- **Factory**: `prompt-resolver.factory.ts` 管理 PromptResolver 單例
- **Strategy**: `transform/` 的 Transform 介面 + TransformExecutor 工廠
- **Fire-and-forget**: `identification.service.ts` 的 `identifyAsync`
