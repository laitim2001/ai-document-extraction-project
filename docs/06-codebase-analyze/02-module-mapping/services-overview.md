# Services Layer Overview — 200 Files, 99,684 Lines

> **分析日期**: 2026-04-09
> **路徑**: `src/services/`

---

## Summary

| 指標 | 數值 |
|------|------|
| 總文件數 | 200 |
| 總行數 | 99,684 |
| 子目錄 | 12 |
| 子目錄文件數 | 89 |
| 根層級獨立文件 | 111 |
| 根層級行數 | 67,110 |
| 子目錄行數 | 32,574 |

---

## Subdirectory Breakdown (12 directories, 89 files)

| 子目錄 | 文件數 | 行數 | 用途 |
|--------|--------|------|------|
| `extraction-v3/` | 20 | 10,582 | V3 三階段提取管線（Stage1 公司 → Stage2 格式 → Stage3 欄位） |
| `unified-processor/` | 22 | 7,388 | 11 步統一處理管道 |
| `n8n/` | 10 | 5,298 | n8n 工作流整合（API Key、文件、Webhook、健康監控） |
| `mapping/` | 7 | 2,216 | 三層映射系統（Universal → Forwarder → LLM） |
| `extraction-v2/` | 4 | 1,767 | Legacy V2 提取管線（Azure DI + GPT-mini） |
| `transform/` | 9 | 1,449 | 欄位轉換器（6 種類型：DIRECT/FORMULA/LOOKUP/CONCAT/SPLIT/AGGREGATE） |
| `rule-inference/` | 4 | 1,123 | 規則推理引擎 |
| `logging/` | 3 | 1,007 | 結構化日誌（寫入 + 查詢 + SSE 串流） |
| `similarity/` | 4 | 892 | 術語相似度計算 |
| `identification/` | 2 | 399 | 公司自動識別（Python 服務調用） |
| `document-processing/` | 2 | 265 | 文件處理輔助 |
| `prompt/` | 2 | 188 | Prompt 識別規則構建 |

---

## Standalone Files by Business Domain (111 files, 67,110 lines)

| 領域 | 文件數 | 行數 | 核心服務 |
|------|--------|------|----------|
| **Rule Management** | 11 | 6,404 | rule-resolver, rule-change, rule-testing, pattern-analysis, auto-rollback |
| **Document Processing** | 16 | 9,453 | document CRUD, batch-processor, extraction, processing-router, invoice-submission |
| **AI / OCR** | 11 | 7,440 | gpt-vision, azure-di, ai-cost, confidence, mapping, term-aggregation |
| **Cost & Reports** | 9 | 6,195 | city-cost, monthly-cost-report, regional-report, dashboard-statistics |
| **Backup & System Admin** | 10 | 6,845 | backup, restore, health-check, system-config, performance |
| **External Integration** | 10 | 6,077 | microsoft-graph, sharepoint-*, outlook-*, webhook, openapi-loader |
| **Alert & Notification** | 6 | 2,782 | alert, alert-rule, alert-evaluation, alert-notification, notification |
| **Auditing & Compliance** | 7 | 4,486 | audit-log, audit-report, change-tracking, traceability, data-retention |
| **User & Auth** | 10 | 4,345 | user, role, city-access, global-admin, security-log, encryption, api-key |
| **Template & Export** | 6 | 4,195 | template-field-mapping, template-instance, template-matching-engine, auto-template-matching |
| **Company Management** | 5 | 3,289 | company, company-matcher, company-auto-create, forwarder-identifier |
| **Prompt Configuration** | 8 | 2,060 | prompt-resolver, prompt-merge-engine, prompt-variable-engine, hybrid-prompt-provider |
| **Miscellaneous** | 4 | 2,027 | exchange-rate, field-definition-set, index.ts, forwarder.service(deprecated) |

---

## All 200 Files — Alphabetical Index

### Root-Level Standalone (111 files)

| # | 文件名 | 行數 | 領域 |
|---|--------|------|------|
| 1 | `ai-cost.service.ts` | 888 | AI/OCR |
| 2 | `ai-term-validator.service.ts` | 740 | AI/OCR |
| 3 | `alert.service.ts` | 762 | Alert |
| 4 | `alert-evaluation.service.ts` | 449 | Alert |
| 5 | `alert-evaluation-job.ts` | 512 | Alert |
| 6 | `alert-notification.service.ts` | 531 | Alert |
| 7 | `alert-rule.service.ts` | 414 | Alert |
| 8 | `api-audit-log.service.ts` | 583 | Audit |
| 9 | `api-key.service.ts` | 577 | User/Auth |
| 10 | `audit-log.service.ts` | 349 | Audit |
| 11 | `audit-query.service.ts` | 367 | Audit |
| 12 | `audit-report.service.ts` | 850 | Audit |
| 13 | `auto-rollback.ts` | 524 | Rules |
| 14 | `auto-template-matching.service.ts` | 890 | Template |
| 15 | `azure-di.service.ts` | 505 | AI/OCR |
| 16 | `backup.service.ts` | 1,120 | System |
| 17 | `backup-scheduler.service.ts` | 776 | System |
| 18 | `batch-processor.service.ts` | 1,356 | Document |
| 19 | `batch-progress.service.ts` | 476 | Document |
| 20 | `batch-term-aggregation.service.ts` | 703 | Document |
| 21 | `change-tracking.service.ts` | 637 | Audit |
| 22 | `city.service.ts` | 291 | User/Auth |
| 23 | `city-access.service.ts` | 523 | User/Auth |
| 24 | `city-cost.service.ts` | 936 | Reports |
| 25 | `city-cost-report.service.ts` | 1,045 | Reports |
| 26 | `company.service.ts` | 1,720 | Company |
| 27 | `company-auto-create.service.ts` | 562 | Company |
| 28 | `company-matcher.service.ts` | 549 | Company |
| 29 | `confidence.service.ts` | 436 | AI/OCR |
| 30 | `correction-recording.ts` | 342 | Rules |
| 31 | `cost-estimation.service.ts` | 292 | Reports |
| 32 | `dashboard-statistics.service.ts` | 566 | Reports |
| 33 | `data-retention.service.ts` | 1,150 | Audit |
| 34 | `data-template.service.ts` | 423 | Template |
| 35 | `document.service.ts` | 619 | Document |
| 36 | `document-format.service.ts` | 748 | Document |
| 37 | `document-issuer.service.ts` | 550 | Document |
| 38 | `document-progress.service.ts` | 737 | Document |
| 39 | `document-source.service.ts` | 436 | Document |
| 40 | `encryption.service.ts` | 258 | User/Auth |
| 41 | `example-generator.service.ts` | 1,139 | External |
| 42 | `exchange-rate.service.ts` | 1,110 | Misc |
| 43 | `expense-report.service.ts` | 666 | Reports |
| 44 | `extraction.service.ts` | 341 | Document |
| 45 | `field-definition-set.service.ts` | 568 | Misc |
| 46 | `file-detection.service.ts` | 377 | Document |
| 47 | `forwarder.service.ts` | 50 | Company(dep) |
| 48 | `forwarder-identifier.ts` | 408 | Company |
| 49 | `global-admin.service.ts` | 411 | User/Auth |
| 50 | `gpt-vision.service.ts` | 1,199 | AI/OCR |
| 51 | `health-check.service.ts` | 676 | System |
| 52 | `hierarchical-term-aggregation.service.ts` | 708 | AI/OCR |
| 53 | `historical-accuracy.service.ts` | 421 | AI/OCR |
| 54 | `hybrid-prompt-provider.service.ts` | 376 | Prompt |
| 55 | `impact-analysis.ts` | 484 | Rules |
| 56 | `index.ts` | 455 | Entry |
| 57 | `invoice-submission.service.ts` | 417 | Document |
| 58 | `mapping.service.ts` | 605 | AI/OCR |
| 59 | `microsoft-graph.service.ts` | 638 | External |
| 60 | `monthly-cost-report.service.ts` | 903 | Reports |
| 61 | `notification.service.ts` | 263 | Alert |
| 62 | `openapi-loader.service.ts` | 409 | External |
| 63 | `outlook-config.service.ts` | 843 | External |
| 64 | `outlook-document.service.ts` | 768 | External |
| 65 | `outlook-mail.service.ts` | 455 | External |
| 66 | `pattern-analysis.ts` | 791 | Rules |
| 67 | `performance.service.ts` | 762 | System |
| 68 | `performance-collector.service.ts` | 491 | System |
| 69 | `pipeline-config.service.ts` | 390 | System |
| 70 | `processing-result-persistence.service.ts` | 744 | Document |
| 71 | `processing-router.service.ts` | 284 | Document |
| 72 | `processing-stats.service.ts` | 932 | Document |
| 73 | `prompt-cache.service.ts` | 182 | Prompt |
| 74 | `prompt-merge-engine.service.ts` | 160 | Prompt |
| 75 | `prompt-provider.interface.ts` | 270 | Prompt |
| 76 | `prompt-resolver.factory.ts` | 107 | Prompt |
| 77 | `prompt-resolver.service.ts` | 306 | Prompt |
| 78 | `prompt-variable-engine.service.ts` | 244 | Prompt |
| 79 | `rate-limit.service.ts` | 234 | User/Auth |
| 80 | `reference-number.service.ts` | 989 | Reports |
| 81 | `region.service.ts` | 427 | Reports |
| 82 | `regional-manager.service.ts` | 583 | User/Auth |
| 83 | `regional-report.service.ts` | 790 | Reports |
| 84 | `restore.service.ts` | 1,017 | System |
| 85 | `result-retrieval.service.ts` | 550 | Document |
| 86 | `role.service.ts` | 495 | User/Auth |
| 87 | `routing.service.ts` | 575 | AI/OCR |
| 88 | `rule-accuracy.ts` | 360 | Rules |
| 89 | `rule-change.service.ts` | 915 | Rules |
| 90 | `rule-metrics.ts` | 627 | Rules |
| 91 | `rule-resolver.ts` | 526 | Rules |
| 92 | `rule-simulation.ts` | 412 | Rules |
| 93 | `rule-suggestion-generator.ts` | 506 | Rules |
| 94 | `rule-testing.service.ts` | 799 | Rules |
| 95 | `security-log.ts` | 521 | User/Auth |
| 96 | `sharepoint-config.service.ts` | 493 | External |
| 97 | `sharepoint-document.service.ts` | 527 | External |
| 98 | `static-prompts.ts` | 415 | Prompt |
| 99 | `system-config.service.ts` | 1,553 | System |
| 100 | `system-settings.service.ts` | 261 | System |
| 101 | `task-status.service.ts` | 468 | Document |
| 102 | `template-export.service.ts` | 479 | Template |
| 103 | `template-field-mapping.service.ts` | 527 | Template |
| 104 | `template-instance.service.ts` | 978 | Template |
| 105 | `template-matching-engine.service.ts` | 800 | Template |
| 106 | `term-aggregation.service.ts` | 832 | AI/OCR |
| 107 | `term-classification.service.ts` | 483 | AI/OCR |
| 108 | `traceability.service.ts` | 528 | Audit |
| 109 | `user.service.ts` | 902 | User/Auth |
| 110 | `webhook.service.ts` | 682 | External |
| 111 | `webhook-event-trigger.ts` | 311 | External |

### Subdirectory Files (89 files)

| 子目錄 | 文件列表 |
|--------|----------|
| `document-processing/` (2) | 2 files, 265 lines |
| `extraction-v2/` (4) | azure-di-document, data-selector, gpt-mini-extractor, index |
| `extraction-v3/` (20) | Stage orchestrator, 3-stage pipeline, confidence-v3-1, post-processors |
| `identification/` (2) | identification.service, index |
| `logging/` (3) | logger.service, log-query.service, index |
| `mapping/` (7) | 三層映射核心 + tier resolvers |
| `n8n/` (10) | api-key, document, webhook, config, definition, error, execution, trigger, health, index |
| `prompt/` (2) | identification-rules-prompt-builder, index |
| `rule-inference/` (4) | 規則推理引擎 |
| `similarity/` (4) | 術語相似度（Levenshtein, Jaccard 等） |
| `transform/` (9) | 6 轉換器 + executor + types + index |
| `unified-processor/` (22) | 11 步統一管道 + context + steps + utils |

---

## Size Distribution

| 行數範圍 | 文件數 | 佔比 |
|----------|--------|------|
| 1-100 | 10 | 5% |
| 101-300 | 43 | 21.5% |
| 301-500 | 62 | 31% |
| 501-800 | 60 | 30% |
| 801-1000 | 13 | 6.5% |
| 1001-1500 | 10 | 5% |
| 1500+ | 2 | 1% |

**最大文件（根層級）**: `company.service.ts` (1,720), `system-config.service.ts` (1,553), `batch-processor.service.ts` (1,356)
> 注：僅統計根層級文件。子目錄中 `extraction-v3/stages/stage-3-extraction.service.ts` (1,451) 未列入上述排名。

---

## Architecture Patterns

| 模式 | 使用情況 |
|------|----------|
| **Singleton** | 大多數 class-based 服務（getInstance 或 module-level const） |
| **Pure Functions** | user, company, mapping, extraction, document 等服務 |
| **Strategy** | transform/ 的 Transform 介面 + TransformExecutor |
| **Factory** | prompt-resolver.factory, TransformExecutor |
| **Observer** | LogStreamEmitter (EventEmitter for SSE) |
| **Three-Tier Config** | prompt-resolver (Global→Format→Company), pipeline-config (GLOBAL→REGION→COMPANY) |

## External Service Dependencies

| 外部服務 | 對應服務文件 |
|----------|-------------|
| Python OCR (port 8000) | extraction.service.ts |
| Python Mapping (port 8001) | identification/, mapping.service.ts |
| Azure Document Intelligence | azure-di.service.ts, extraction-v2/ |
| Azure OpenAI GPT-5.2 | gpt-vision.service.ts, ai-term-validator.service.ts |
| Azure Blob Storage | n8n/n8n-document.service.ts, sharepoint-document.service.ts |
| Microsoft Graph API | microsoft-graph.service.ts, outlook-mail.service.ts |
| Upstash Redis | rate-limit.service.ts, prompt-cache.service.ts |
| n8n Workflow Engine | n8n/*.service.ts |
