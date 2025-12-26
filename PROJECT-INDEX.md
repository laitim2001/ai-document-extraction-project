# 項目索引 - AI Document Extraction

> 本文件為項目所有重要文件的快速導航索引。
> 最後同步日期：2025-12-26

---

## 快速導航

### 核心入口
| 文件 | 說明 |
|------|------|
| [AI-ASSISTANT-GUIDE.md](./AI-ASSISTANT-GUIDE.md) | AI 助手開發指引 |
| [CLAUDE.md](./CLAUDE.md) | 完整開發規範 |
| [claudedocs/CLAUDE.md](./claudedocs/CLAUDE.md) | 執行記錄說明 |

### 維護工具
| 文件 | 說明 |
|------|------|
| [INDEX-MAINTENANCE-GUIDE.md](./INDEX-MAINTENANCE-GUIDE.md) | 索引維護指引 |
| [scripts/check-index-sync.js](./scripts/check-index-sync.js) | 索引同步檢查腳本 |

### 🔥 核心開發資源
| 文件 | 說明 |
|------|------|
| [docs/04-implementation/sprint-status.yaml](./docs/04-implementation/sprint-status.yaml) | **項目進度的唯一真實來源** |
| [docs/04-implementation/stories/](./docs/04-implementation/stories/) | 所有 Story 檔案（91 個）|
| [docs/04-implementation/tech-specs/](./docs/04-implementation/tech-specs/) | 技術規格文檔 |
| [docs/04-implementation/prompt-templates/all-story-prompts.md](./docs/04-implementation/prompt-templates/all-story-prompts.md) | 開發階段 Prompt |

---

## 項目文檔結構

### docs/00-discovery/ - 產品探索
| 文件 | 說明 |
|------|------|
| [product-brief-ai-document-extraction-project-2025-12-14.md](./docs/00-discovery/product-brief-ai-document-extraction-project-2025-12-14.md) | 產品簡介 |
| [past-discussions/](./docs/00-discovery/past-discussions/) | 過往討論記錄 |

### docs/01-planning/ - 規劃階段
| 文件 | 說明 |
|------|------|
| [prd/prd.md](./docs/01-planning/prd/prd.md) | 產品需求文件（PRD）|
| [ux/ux-design-specification.md](./docs/01-planning/ux/ux-design-specification.md) | UX 設計規格 |

### docs/02-architecture/ - 架構設計
| 文件 | 說明 |
|------|------|
| [architecture.md](./docs/02-architecture/architecture.md) | 系統架構文件 |
| [sections/core-architecture-decisions.md](./docs/02-architecture/sections/core-architecture-decisions.md) | 核心架構決策 |
| [sections/implementation-patterns-consistency-rules.md](./docs/02-architecture/sections/implementation-patterns-consistency-rules.md) | 實現模式和一致性規則 |
| [sections/project-structure-boundaries.md](./docs/02-architecture/sections/project-structure-boundaries.md) | 項目結構邊界 |

### docs/03-epics/ - Epic 和 Stories
| 文件 | 說明 |
|------|------|
| [epics.md](./docs/03-epics/epics.md) | Epic 總覽 |
| [sections/epic-list.md](./docs/03-epics/sections/epic-list.md) | Epic 列表 |
| [sections/requirements-inventory.md](./docs/03-epics/sections/requirements-inventory.md) | 需求清單 |

---

## Epic 索引（13 個 Epic，90 個 Stories）

> **狀態來源**: `docs/04-implementation/sprint-status.yaml`

### Epic 0: 歷史數據初始化（前置 Epic）✅
| Story | 文件 | 狀態 |
|-------|------|------|
| 0-1 | [0-1-batch-file-upload-metadata-detection.md](./docs/04-implementation/stories/0-1-batch-file-upload-metadata-detection.md) | ✅ |
| 0-2 | [0-2-intelligent-processing-routing.md](./docs/04-implementation/stories/0-2-intelligent-processing-routing.md) | ✅ |
| 0-3 | [0-3-just-in-time-company-profile.md](./docs/04-implementation/stories/0-3-just-in-time-company-profile.md) | ✅ |
| 0-4 | [0-4-batch-processing-progress-tracking.md](./docs/04-implementation/stories/0-4-batch-processing-progress-tracking.md) | ✅ |
| 0-5 | [0-5-term-aggregation-initial-rules.md](./docs/04-implementation/stories/0-5-term-aggregation-initial-rules.md) | ✅ |
| 0-6 | [0-6-batch-company-integration.md](./docs/04-implementation/stories/0-6-batch-company-integration.md) | ✅ |
| 0-7 | [0-7-batch-term-aggregation-integration.md](./docs/04-implementation/stories/0-7-batch-term-aggregation-integration.md) | ✅ |

**Tech Specs**: [docs/04-implementation/tech-specs/epic-00-historical-data/](./docs/04-implementation/tech-specs/epic-00-historical-data/)

### Epic 1: 用戶認證與存取控制 ✅
| Story | 文件 | 狀態 |
|-------|------|------|
| 1-0 | [1-0-project-init-foundation.md](./docs/04-implementation/stories/1-0-project-init-foundation.md) | ✅ |
| 1-1 | [1-1-azure-ad-sso-login.md](./docs/04-implementation/stories/1-1-azure-ad-sso-login.md) | ✅ |
| 1-2 | [1-2-user-database-role-foundation.md](./docs/04-implementation/stories/1-2-user-database-role-foundation.md) | ✅ |
| 1-3 | [1-3-user-list-search.md](./docs/04-implementation/stories/1-3-user-list-search.md) | ✅ |
| 1-4 | [1-4-add-user-role-assignment.md](./docs/04-implementation/stories/1-4-add-user-role-assignment.md) | ✅ |
| 1-5 | [1-5-modify-user-role-city.md](./docs/04-implementation/stories/1-5-modify-user-role-city.md) | ✅ |
| 1-6 | [1-6-disable-enable-user-account.md](./docs/04-implementation/stories/1-6-disable-enable-user-account.md) | ✅ |
| 1-7 | [1-7-custom-role-management.md](./docs/04-implementation/stories/1-7-custom-role-management.md) | ✅ |
| 1-8 | [1-8-city-manager-user-management.md](./docs/04-implementation/stories/1-8-city-manager-user-management.md) | ✅ |

**Tech Specs**: [docs/04-implementation/tech-specs/epic-01-auth/](./docs/04-implementation/tech-specs/epic-01-auth/)

### Epic 2: 手動發票上傳與 AI 處理 ✅
| Story | 文件 | 狀態 |
|-------|------|------|
| 2-1 | [2-1-file-upload-interface-validation.md](./docs/04-implementation/stories/2-1-file-upload-interface-validation.md) | ✅ |
| 2-2 | [2-2-file-ocr-extraction-service.md](./docs/04-implementation/stories/2-2-file-ocr-extraction-service.md) | ✅ |
| 2-3 | [2-3-forwarder-auto-identification.md](./docs/04-implementation/stories/2-3-forwarder-auto-identification.md) | ✅ |
| 2-4 | [2-4-field-mapping-extraction.md](./docs/04-implementation/stories/2-4-field-mapping-extraction.md) | ✅ |
| 2-5 | [2-5-confidence-score-calculation.md](./docs/04-implementation/stories/2-5-confidence-score-calculation.md) | ✅ |
| 2-6 | [2-6-processing-path-auto-routing.md](./docs/04-implementation/stories/2-6-processing-path-auto-routing.md) | ✅ |
| 2-7 | [2-7-processing-status-tracking-display.md](./docs/04-implementation/stories/2-7-processing-status-tracking-display.md) | ✅ |

**Tech Specs**: [docs/04-implementation/tech-specs/epic-02-ai-processing/](./docs/04-implementation/tech-specs/epic-02-ai-processing/)

### Epic 3: 發票審核與修正工作流 ✅
| Story | 文件 | 狀態 |
|-------|------|------|
| 3-1 | [3-1-pending-review-invoice-list.md](./docs/04-implementation/stories/3-1-pending-review-invoice-list.md) | ✅ |
| 3-2 | [3-2-side-by-side-pdf-review-interface.md](./docs/04-implementation/stories/3-2-side-by-side-pdf-review-interface.md) | ✅ |
| 3-3 | [3-3-confidence-color-coding-display.md](./docs/04-implementation/stories/3-3-confidence-color-coding-display.md) | ✅ |
| 3-4 | [3-4-confirm-extraction-result.md](./docs/04-implementation/stories/3-4-confirm-extraction-result.md) | ✅ |
| 3-5 | [3-5-correct-extraction-result.md](./docs/04-implementation/stories/3-5-correct-extraction-result.md) | ✅ |
| 3-6 | [3-6-correction-type-marking.md](./docs/04-implementation/stories/3-6-correction-type-marking.md) | ✅ |
| 3-7 | [3-7-escalate-complex-cases.md](./docs/04-implementation/stories/3-7-escalate-complex-cases.md) | ✅ |
| 3-8 | [3-8-super-user-handle-escalated-cases.md](./docs/04-implementation/stories/3-8-super-user-handle-escalated-cases.md) | ✅ |

**Tech Specs**: [docs/04-implementation/tech-specs/epic-03-review-workflow/](./docs/04-implementation/tech-specs/epic-03-review-workflow/)

### Epic 4: 映射規則管理與自動學習 ✅
| Story | 文件 | 狀態 |
|-------|------|------|
| 4-1 | [4-1-mapping-rule-list-view.md](./docs/04-implementation/stories/4-1-mapping-rule-list-view.md) | ✅ |
| 4-2 | [4-2-suggest-new-mapping-rule.md](./docs/04-implementation/stories/4-2-suggest-new-mapping-rule.md) | ✅ |
| 4-3 | [4-3-correction-pattern-recording-analysis.md](./docs/04-implementation/stories/4-3-correction-pattern-recording-analysis.md) | ✅ |
| 4-4 | [4-4-rule-upgrade-suggestion-generation.md](./docs/04-implementation/stories/4-4-rule-upgrade-suggestion-generation.md) | ✅ |
| 4-5 | [4-5-rule-impact-scope-analysis.md](./docs/04-implementation/stories/4-5-rule-impact-scope-analysis.md) | ✅ |
| 4-6 | [4-6-review-learning-rule.md](./docs/04-implementation/stories/4-6-review-learning-rule.md) | ✅ |
| 4-7 | [4-7-rule-version-history-management.md](./docs/04-implementation/stories/4-7-rule-version-history-management.md) | ✅ |
| 4-8 | [4-8-rule-auto-rollback.md](./docs/04-implementation/stories/4-8-rule-auto-rollback.md) | ✅ |

**Tech Specs**: [docs/04-implementation/tech-specs/epic-04-mapping-rules/](./docs/04-implementation/tech-specs/epic-04-mapping-rules/)

### Epic 5: Forwarder 配置管理 ✅
| Story | 文件 | 狀態 |
|-------|------|------|
| 5-1 | [5-1-forwarder-profile-list.md](./docs/04-implementation/stories/5-1-forwarder-profile-list.md) | ✅ |
| 5-2 | [5-2-forwarder-detail-config-view.md](./docs/04-implementation/stories/5-2-forwarder-detail-config-view.md) | ✅ |
| 5-3 | [5-3-edit-forwarder-mapping-rules.md](./docs/04-implementation/stories/5-3-edit-forwarder-mapping-rules.md) | ✅ |
| 5-4 | [5-4-test-rule-change-effect.md](./docs/04-implementation/stories/5-4-test-rule-change-effect.md) | ✅ |
| 5-5 | [5-5-add-disable-forwarder-profile.md](./docs/04-implementation/stories/5-5-add-disable-forwarder-profile.md) | ✅ |

**Tech Specs**: [docs/04-implementation/tech-specs/epic-05-forwarder-config/](./docs/04-implementation/tech-specs/epic-05-forwarder-config/)

### Epic 6: 多城市數據隔離 ✅
| Story | 文件 | 狀態 |
|-------|------|------|
| 6-1 | [6-1-city-data-model-rls-config.md](./docs/04-implementation/stories/6-1-city-data-model-rls-config.md) | ✅ |
| 6-2 | [6-2-city-user-data-access-control.md](./docs/04-implementation/stories/6-2-city-user-data-access-control.md) | ✅ |
| 6-3 | [6-3-regional-manager-cross-city-access.md](./docs/04-implementation/stories/6-3-regional-manager-cross-city-access.md) | ✅ |
| 6-4 | [6-4-global-admin-full-access.md](./docs/04-implementation/stories/6-4-global-admin-full-access.md) | ✅ |
| 6-5 | [6-5-global-rule-sharing-mechanism.md](./docs/04-implementation/stories/6-5-global-rule-sharing-mechanism.md) | ✅ |

**Tech Specs**: [docs/04-implementation/tech-specs/epic-06-multi-city/](./docs/04-implementation/tech-specs/epic-06-multi-city/)

### Epic 7: 報表儀表板與成本追蹤 ✅
| Story | 文件 | 狀態 |
|-------|------|------|
| 7-1 | [7-1-processing-statistics-dashboard.md](./docs/04-implementation/stories/7-1-processing-statistics-dashboard.md) | ✅ |
| 7-2 | [7-2-time-range-filter.md](./docs/04-implementation/stories/7-2-time-range-filter.md) | ✅ |
| 7-3 | [7-3-forwarder-filter.md](./docs/04-implementation/stories/7-3-forwarder-filter.md) | ✅ |
| 7-4 | [7-4-expense-detail-report-export.md](./docs/04-implementation/stories/7-4-expense-detail-report-export.md) | ✅ |
| 7-5 | [7-5-cross-city-summary-report.md](./docs/04-implementation/stories/7-5-cross-city-summary-report.md) | ✅ |
| 7-6 | [7-6-ai-api-usage-cost-display.md](./docs/04-implementation/stories/7-6-ai-api-usage-cost-display.md) | ✅ |
| 7-7 | [7-7-city-processing-volume-tracking.md](./docs/04-implementation/stories/7-7-city-processing-volume-tracking.md) | ✅ |
| 7-8 | [7-8-city-ai-cost-tracking.md](./docs/04-implementation/stories/7-8-city-ai-cost-tracking.md) | ✅ |
| 7-9 | [7-9-city-cost-report.md](./docs/04-implementation/stories/7-9-city-cost-report.md) | ✅ |
| 7-10 | [7-10-monthly-cost-allocation-report.md](./docs/04-implementation/stories/7-10-monthly-cost-allocation-report.md) | ✅ |

**Tech Specs**: [docs/04-implementation/tech-specs/epic-07-reports-dashboard/](./docs/04-implementation/tech-specs/epic-07-reports-dashboard/)

### Epic 8: 審計追溯與合規 ✅
| Story | 文件 | 狀態 |
|-------|------|------|
| 8-1 | [8-1-user-operation-log-recording.md](./docs/04-implementation/stories/8-1-user-operation-log-recording.md) | ✅ |
| 8-2 | [8-2-data-change-tracking.md](./docs/04-implementation/stories/8-2-data-change-tracking.md) | ✅ |
| 8-3 | [8-3-processing-record-query.md](./docs/04-implementation/stories/8-3-processing-record-query.md) | ✅ |
| 8-4 | [8-4-original-file-traceability.md](./docs/04-implementation/stories/8-4-original-file-traceability.md) | ✅ |
| 8-5 | [8-5-audit-report-export.md](./docs/04-implementation/stories/8-5-audit-report-export.md) | ✅ |
| 8-6 | [8-6-long-term-data-retention.md](./docs/04-implementation/stories/8-6-long-term-data-retention.md) | ✅ |

**Tech Specs**: [docs/04-implementation/tech-specs/epic-08-audit-compliance/](./docs/04-implementation/tech-specs/epic-08-audit-compliance/)

### Epic 9: 自動化文件獲取 ✅
| Story | 文件 | 狀態 |
|-------|------|------|
| 9-1 | [9-1-sharepoint-file-monitoring-api.md](./docs/04-implementation/stories/9-1-sharepoint-file-monitoring-api.md) | ✅ |
| 9-2 | [9-2-sharepoint-connection-config.md](./docs/04-implementation/stories/9-2-sharepoint-connection-config.md) | ✅ |
| 9-3 | [9-3-outlook-mail-attachment-extraction-api.md](./docs/04-implementation/stories/9-3-outlook-mail-attachment-extraction-api.md) | ✅ |
| 9-4 | [9-4-outlook-connection-config.md](./docs/04-implementation/stories/9-4-outlook-connection-config.md) | ✅ |
| 9-5 | [9-5-auto-retrieval-source-tracking.md](./docs/04-implementation/stories/9-5-auto-retrieval-source-tracking.md) | ✅ |

**Tech Specs**: [docs/04-implementation/tech-specs/epic-09-auto-retrieval/](./docs/04-implementation/tech-specs/epic-09-auto-retrieval/)

### Epic 10: n8n 工作流整合 ✅
| Story | 文件 | 狀態 |
|-------|------|------|
| 10-1 | [10-1-n8n-bidirectional-communication-api.md](./docs/04-implementation/stories/10-1-n8n-bidirectional-communication-api.md) | ✅ |
| 10-2 | [10-2-webhook-config-management.md](./docs/04-implementation/stories/10-2-webhook-config-management.md) | ✅ |
| 10-3 | [10-3-workflow-execution-status-view.md](./docs/04-implementation/stories/10-3-workflow-execution-status-view.md) | ✅ |
| 10-4 | [10-4-manual-trigger-workflow.md](./docs/04-implementation/stories/10-4-manual-trigger-workflow.md) | ✅ |
| 10-5 | [10-5-workflow-error-detail-view.md](./docs/04-implementation/stories/10-5-workflow-error-detail-view.md) | ✅ |
| 10-6 | [10-6-document-processing-progress-tracking.md](./docs/04-implementation/stories/10-6-document-processing-progress-tracking.md) | ✅ |
| 10-7 | [10-7-n8n-connection-status-monitoring.md](./docs/04-implementation/stories/10-7-n8n-connection-status-monitoring.md) | ✅ |

**Tech Specs**: [docs/04-implementation/tech-specs/epic-10-n8n-integration/](./docs/04-implementation/tech-specs/epic-10-n8n-integration/)

### Epic 11: 對外 API 服務 ✅
| Story | 文件 | 狀態 |
|-------|------|------|
| 11-1 | [11-1-api-invoice-submission-endpoint.md](./docs/04-implementation/stories/11-1-api-invoice-submission-endpoint.md) | ✅ |
| 11-2 | [11-2-api-processing-status-query-endpoint.md](./docs/04-implementation/stories/11-2-api-processing-status-query-endpoint.md) | ✅ |
| 11-3 | [11-3-api-processing-result-retrieval-endpoint.md](./docs/04-implementation/stories/11-3-api-processing-result-retrieval-endpoint.md) | ✅ |
| 11-4 | [11-4-webhook-notification-service.md](./docs/04-implementation/stories/11-4-webhook-notification-service.md) | ✅ |
| 11-5 | [11-5-api-access-control-authentication.md](./docs/04-implementation/stories/11-5-api-access-control-authentication.md) | ✅ |
| 11-6 | [11-6-api-documentation-developer-support.md](./docs/04-implementation/stories/11-6-api-documentation-developer-support.md) | ✅ |

**Tech Specs**: [docs/04-implementation/tech-specs/epic-11-external-api/](./docs/04-implementation/tech-specs/epic-11-external-api/)

### Epic 12: 系統管理與監控 ✅
| Story | 文件 | 狀態 |
|-------|------|------|
| 12-1 | [12-1-system-health-monitoring-dashboard.md](./docs/04-implementation/stories/12-1-system-health-monitoring-dashboard.md) | ✅ |
| 12-2 | [12-2-performance-metrics-tracking.md](./docs/04-implementation/stories/12-2-performance-metrics-tracking.md) | ✅ |
| 12-3 | [12-3-error-alert-configuration.md](./docs/04-implementation/stories/12-3-error-alert-configuration.md) | ✅ |
| 12-4 | [12-4-system-configuration-management.md](./docs/04-implementation/stories/12-4-system-configuration-management.md) | ✅ |
| 12-5 | [12-5-data-backup-management.md](./docs/04-implementation/stories/12-5-data-backup-management.md) | ✅ |
| 12-6 | [12-6-data-recovery-functionality.md](./docs/04-implementation/stories/12-6-data-recovery-functionality.md) | ✅ |
| 12-7 | [12-7-system-log-query.md](./docs/04-implementation/stories/12-7-system-log-query.md) | ✅ |

**Tech Specs**: [docs/04-implementation/tech-specs/epic-12-system-admin/](./docs/04-implementation/tech-specs/epic-12-system-admin/)

---

## 源代碼結構

### src/app/ - Next.js App Router

#### 頁面路由
| 路徑 | 說明 |
|------|------|
| `src/app/(auth)/` | 認證相關頁面（登入）|
| `src/app/(dashboard)/` | 儀表板頁面 |
| `src/app/(dashboard)/forwarders/` | Forwarder 管理 |
| `src/app/(dashboard)/documents/` | 文件管理 |
| `src/app/(dashboard)/mappings/` | 映射管理 |
| `src/app/(dashboard)/admin/` | 管理員功能 |
| `src/app/(dashboard)/historical-data/` | 歷史數據處理 |

#### API 路由
| 路徑 | 說明 |
|------|------|
| `src/app/api/auth/` | 認證 API (NextAuth) |
| `src/app/api/admin/` | 管理員 API |
| `src/app/api/documents/` | 文件處理 API |
| `src/app/api/forwarders/` | Forwarder API |
| `src/app/api/mappings/` | 映射規則 API |
| `src/app/api/confidence/` | 信心度 API |
| `src/app/api/audit/` | 審計 API |
| `src/app/api/cost/` | 成本追蹤 API |
| `src/app/api/dashboard/` | 儀表板統計 API |
| `src/app/api/upload/` | 批次上傳 API |
| `src/app/api/companies/` | 公司管理 API |
| `src/app/api/terms/` | 術語管理 API |

### src/services/ - 業務邏輯服務

#### 核心處理服務
| 服務 | 說明 |
|------|------|
| [document.service.ts](./src/services/document.service.ts) | 文件管理服務 |
| [extraction.service.ts](./src/services/extraction.service.ts) | AI 提取服務 |
| [mapping.service.ts](./src/services/mapping.service.ts) | 映射規則服務 |
| [confidence.service.ts](./src/services/confidence.service.ts) | 信心度計算服務 |
| [routing.service.ts](./src/services/routing.service.ts) | 信心度路由服務 |
| [forwarder.service.ts](./src/services/forwarder.service.ts) | Forwarder 服務 |
| [forwarder-identifier.ts](./src/services/forwarder-identifier.ts) | Forwarder 自動識別 |

#### 批次處理服務（Epic 0）
| 服務 | 說明 |
|------|------|
| [batch-processor.service.ts](./src/services/batch-processor.service.ts) | 批次處理服務 |
| [company-matcher.service.ts](./src/services/company-matcher.service.ts) | 公司匹配服務（3 層匹配）|
| [company-auto-create.service.ts](./src/services/company-auto-create.service.ts) | 公司自動創建服務 |
| [term-aggregation.service.ts](./src/services/term-aggregation.service.ts) | 術語聚合服務 |
| [term-classification.service.ts](./src/services/term-classification.service.ts) | 術語分類服務 |
| [processing-router.service.ts](./src/services/processing-router.service.ts) | 處理路由服務 |
| [cost-estimation.service.ts](./src/services/cost-estimation.service.ts) | 成本估算服務 |
| [gpt-vision.service.ts](./src/services/gpt-vision.service.ts) | GPT Vision 服務 |
| [file-detection.service.ts](./src/services/file-detection.service.ts) | 文件偵測服務 |
| [batch-progress.service.ts](./src/services/batch-progress.service.ts) | 批次進度服務 |

#### 用戶和權限服務
| 服務 | 說明 |
|------|------|
| [user.service.ts](./src/services/user.service.ts) | 用戶管理服務 |
| [role.service.ts](./src/services/role.service.ts) | 角色管理服務 |
| [city.service.ts](./src/services/city.service.ts) | 城市管理服務 |
| [city-access.service.ts](./src/services/city-access.service.ts) | 城市權限服務 |
| [global-admin.service.ts](./src/services/global-admin.service.ts) | 全球管理員服務 |

#### 審計和監控服務
| 服務 | 說明 |
|------|------|
| [audit-log.service.ts](./src/services/audit-log.service.ts) | 審計日誌服務 |
| [audit-query.service.ts](./src/services/audit-query.service.ts) | 審計查詢服務 |
| [audit-report.service.ts](./src/services/audit-report.service.ts) | 審計報告服務 |
| [change-tracking.service.ts](./src/services/change-tracking.service.ts) | 變更追蹤服務 |
| [traceability.service.ts](./src/services/traceability.service.ts) | 可追溯性服務 |
| [health-check.service.ts](./src/services/health-check.service.ts) | 健康檢查服務 |
| [performance.service.ts](./src/services/performance.service.ts) | 效能監控服務 |

#### 成本和報表服務
| 服務 | 說明 |
|------|------|
| [ai-cost.service.ts](./src/services/ai-cost.service.ts) | AI 成本追蹤服務 |
| [city-cost.service.ts](./src/services/city-cost.service.ts) | 城市成本服務 |
| [city-cost-report.service.ts](./src/services/city-cost-report.service.ts) | 城市成本報告 |
| [expense-report.service.ts](./src/services/expense-report.service.ts) | 費用報告服務 |
| [monthly-cost-report.service.ts](./src/services/monthly-cost-report.service.ts) | 月度成本報告 |
| [dashboard-statistics.service.ts](./src/services/dashboard-statistics.service.ts) | 儀表板統計服務 |

#### 告警和通知服務
| 服務 | 說明 |
|------|------|
| [alert.service.ts](./src/services/alert.service.ts) | 告警服務 |
| [alert-rule.service.ts](./src/services/alert-rule.service.ts) | 告警規則服務 |
| [alert-notification.service.ts](./src/services/alert-notification.service.ts) | 告警通知服務 |
| [notification.service.ts](./src/services/notification.service.ts) | 通知服務 |
| [webhook.service.ts](./src/services/webhook.service.ts) | Webhook 服務 |

#### 整合服務
| 服務 | 說明 |
|------|------|
| [microsoft-graph.service.ts](./src/services/microsoft-graph.service.ts) | Microsoft Graph API |
| [sharepoint-document.service.ts](./src/services/sharepoint-document.service.ts) | SharePoint 文件服務 |
| [sharepoint-config.service.ts](./src/services/sharepoint-config.service.ts) | SharePoint 配置 |
| [outlook-mail.service.ts](./src/services/outlook-mail.service.ts) | Outlook 郵件服務 |
| [outlook-document.service.ts](./src/services/outlook-document.service.ts) | Outlook 文件服務 |
| [outlook-config.service.ts](./src/services/outlook-config.service.ts) | Outlook 配置 |

#### 規則學習服務
| 服務 | 說明 |
|------|------|
| [rule-suggestion-generator.ts](./src/services/rule-suggestion-generator.ts) | 規則建議生成 |
| [rule-resolver.ts](./src/services/rule-resolver.ts) | 規則解析器 |
| [rule-simulation.ts](./src/services/rule-simulation.ts) | 規則模擬 |
| [rule-accuracy.ts](./src/services/rule-accuracy.ts) | 規則準確度 |
| [pattern-analysis.ts](./src/services/pattern-analysis.ts) | 模式分析 |
| [impact-analysis.ts](./src/services/impact-analysis.ts) | 影響分析 |
| [correction-recording.ts](./src/services/correction-recording.ts) | 修正記錄 |

#### 備份和恢復服務
| 服務 | 說明 |
|------|------|
| [backup.service.ts](./src/services/backup.service.ts) | 備份服務 |
| [backup-scheduler.service.ts](./src/services/backup-scheduler.service.ts) | 備份排程服務 |
| [restore.service.ts](./src/services/restore.service.ts) | 恢復服務 |
| [data-retention.service.ts](./src/services/data-retention.service.ts) | 資料保留服務 |

### src/components/ - React 組件
| 路徑 | 說明 |
|------|------|
| `src/components/ui/` | shadcn/ui 基礎組件 |
| `src/components/features/` | 功能組件 |
| `src/components/layouts/` | 佈局組件 |

### src/lib/ - 工具庫
| 路徑 | 說明 |
|------|------|
| `src/lib/auth.ts` | 認證配置 |
| `src/lib/prisma.ts` | Prisma 客戶端 |
| `src/lib/azure/` | Azure 服務整合 |
| `src/lib/utils/` | 通用工具函數 |

### src/types/ - TypeScript 類型
| 文件 | 說明 |
|------|------|
| `src/types/index.ts` | 類型索引 |
| `src/types/document.ts` | 文件類型 |
| `src/types/mapping.ts` | 映射類型 |
| `src/types/user.ts` | 用戶類型 |
| `src/types/batch-company.ts` | 批次公司類型 |

### prisma/ - 資料庫
| 文件 | 說明 |
|------|------|
| [prisma/schema.prisma](./prisma/schema.prisma) | Prisma Schema |
| `prisma/migrations/` | 資料庫遷移 |

---

## 執行記錄（claudedocs/）

| 分類 | 路徑 | 說明 |
|------|------|------|
| 規劃 | `claudedocs/1-planning/` | Epic 規劃和目標 |
| Sprint | `claudedocs/2-sprints/` | Sprint 執行記錄 |
| 進度 | `claudedocs/3-progress/` | 日報和週報 |
| 變更 | `claudedocs/4-changes/` | Bug 修復和功能變更 |
| 狀態 | `claudedocs/5-status/` | 測試和檢查狀態 |
| AI 助手 | `claudedocs/6-ai-assistant/` | Session 指引和交接 |
| 歸檔 | `claudedocs/7-archive/` | 已完成的歷史記錄 |

### AI 助手提示系統（claudedocs/6-ai-assistant/prompts/）

| 情境 | 文件 | 說明 |
|------|------|------|
| 項目入門 | [SITUATION-1-PROJECT-ONBOARDING.md](./claudedocs/6-ai-assistant/prompts/SITUATION-1-PROJECT-ONBOARDING.md) | 新手快速了解項目 |
| 開發前準備 | [SITUATION-2-FEATURE-DEV-PREP.md](./claudedocs/6-ai-assistant/prompts/SITUATION-2-FEATURE-DEV-PREP.md) | 開發前需求分析和計劃 |
| 功能修改 | [SITUATION-3-FEATURE-ENHANCEMENT.md](./claudedocs/6-ai-assistant/prompts/SITUATION-3-FEATURE-ENHANCEMENT.md) | Bug 修復和功能增強 |
| 新功能開發 | [SITUATION-4-NEW-FEATURE-DEV.md](./claudedocs/6-ai-assistant/prompts/SITUATION-4-NEW-FEATURE-DEV.md) | 完整功能開發流程 |
| 保存進度 | [SITUATION-5-SAVE-PROGRESS.md](./claudedocs/6-ai-assistant/prompts/SITUATION-5-SAVE-PROGRESS.md) | 保存和記錄工作進度 |

---

## 配置文件

| 文件 | 說明 |
|------|------|
| [package.json](./package.json) | npm 依賴配置 |
| [tsconfig.json](./tsconfig.json) | TypeScript 配置 |
| [tailwind.config.ts](./tailwind.config.ts) | Tailwind CSS 配置 |
| [next.config.ts](./next.config.ts) | Next.js 配置 |
| [docker-compose.yml](./docker-compose.yml) | Docker 配置 |
| [.env.example](./.env.example) | 環境變數範例 |

---

## 開發規則（.claude/rules/）

| 文件 | 說明 |
|------|------|
| [general.md](./.claude/rules/general.md) | 通用開發規範 |
| [technical-obstacles.md](./.claude/rules/technical-obstacles.md) | 技術障礙處理 |

---

## 狀態說明

| 圖標 | 說明 |
|------|------|
| ✅ | 已完成 |
| 🟡 | 進行中 |
| ⚪ | 待開始 |

---

*索引版本：2.0.0*
*建立日期：2025-12-21*
*最後同步：2025-12-26*
