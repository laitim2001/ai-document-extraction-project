# Services 目錄 - 業務邏輯服務層

> **服務數量**: 95+ 服務文件
> **最後更新**: 2026-01-18
> **版本**: 1.1.0

---

## 概述

本目錄包含所有業務邏輯服務，是項目的核心處理層。服務層遵循以下原則：
- **單一職責**: 每個服務專注於特定業務領域
- **依賴注入**: 透過 Prisma Client 和其他服務進行依賴
- **類型安全**: 完整的 TypeScript 類型定義
- **錯誤處理**: 統一的錯誤處理模式

---

## 服務分類

### 1. 核心處理服務 (Core Processing)

| 服務 | 說明 | Epic |
|------|------|------|
| `document.service.ts` | 文件 CRUD 操作 | Epic 2 |
| `extraction.service.ts` | 欄位提取服務 | Epic 2 |
| `batch-processor.service.ts` | 批次處理引擎 | Epic 0 |
| `batch-progress.service.ts` | 批次進度追蹤 | Epic 0 |
| `processing-router.service.ts` | 智能處理路由 | Epic 0 |
| `document-progress.service.ts` | 文件處理進度 | Epic 2 |
| `document-source.service.ts` | 文件來源管理 | Epic 9 |
| `document-format.service.ts` | 文件格式處理 | Epic 0 |
| `document-issuer.service.ts` | 文件發行方識別 | Epic 0 |
| `result-retrieval.service.ts` | 結果檢索服務 | Epic 2 |

### 2. AI/OCR 服務 (AI & OCR)

| 服務 | 說明 | Epic |
|------|------|------|
| `gpt-vision.service.ts` | Azure OpenAI GPT-5.2 Vision 處理 | Epic 2 |
| `azure-di.service.ts` | Azure Document Intelligence | Epic 2 |
| `confidence.service.ts` | 信心度計算 | Epic 2 |
| `term-classification.service.ts` | 術語分類（Tier 3） | Epic 4 |
| `term-aggregation.service.ts` | 術語聚合 | Epic 0 |
| `batch-term-aggregation.service.ts` | 批次術語聚合 | Epic 0 |
| `hierarchical-term-aggregation.service.ts` | 階層術語聚合 | Epic 0 |
| `ai-cost.service.ts` | AI 成本追蹤 | Epic 7 |
| `cost-estimation.service.ts` | 成本估算 | Epic 7 |

### 3. 映射與規則服務 (Mapping & Rules)

| 服務 | 說明 | Epic |
|------|------|------|
| `mapping.service.ts` | 三層映射系統核心 | Epic 4 |
| `rule-resolver.ts` | 規則解析器 | Epic 4 |
| `rule-suggestion-generator.ts` | 規則建議生成 | Epic 4 |
| `rule-testing.service.ts` | 規則測試 | Epic 4 |
| `rule-change.service.ts` | 規則變更管理 | Epic 4 |
| `rule-accuracy.ts` | 規則準確度追蹤 | Epic 4 |
| `rule-metrics.ts` | 規則指標 | Epic 4 |
| `rule-simulation.ts` | 規則模擬 | Epic 4 |
| `impact-analysis.ts` | 影響分析 | Epic 4 |
| `pattern-analysis.ts` | 模式分析 | Epic 4 |
| `correction-recording.ts` | 修正記錄 | Epic 3 |
| `auto-rollback.ts` | 自動回滾 | Epic 4 |

**子目錄: `rule-inference/`**
| 服務 | 說明 |
|------|------|
| `keyword-inferrer.ts` | 關鍵字推斷器 |
| `position-inferrer.ts` | 位置推斷器 |
| `regex-inferrer.ts` | 正則推斷器 |

### 4. 公司/Forwarder 管理 (Company/Forwarder)

| 服務 | 說明 | Epic |
|------|------|------|
| `company.service.ts` | 公司 CRUD（重構後） | Epic 5 |
| `company-matcher.service.ts` | 公司匹配器 | Epic 0 |
| `company-auto-create.service.ts` | Just-in-Time 公司創建 | Epic 0 |
| `forwarder.service.ts` | Forwarder 服務（已棄用） | - |
| `forwarder-identifier.ts` | Forwarder 識別 | Epic 5 |
| `file-detection.service.ts` | 文件檢測（公司識別） | Epic 0 |

**子目錄: `identification/`**
| 服務 | 說明 |
|------|------|
| `identification.service.ts` | 文件發行方識別服務 |

> **注意**: `forwarder.service.ts` 因 REFACTOR-001 已被 `company.service.ts` 取代

### 5. 城市與區域 (City & Regional)

| 服務 | 說明 | Epic |
|------|------|------|
| `city.service.ts` | 城市管理 | Epic 6 |
| `city-access.service.ts` | 城市存取控制 | Epic 6 |
| `city-cost.service.ts` | 城市成本統計 | Epic 7 |
| `city-cost-report.service.ts` | 城市成本報表 | Epic 7 |
| `regional-manager.service.ts` | 區域管理員 | Epic 6 |
| `regional-report.service.ts` | 區域報表 | Epic 7 |

### 6. 報表與統計 (Reports & Statistics)

| 服務 | 說明 | Epic |
|------|------|------|
| `dashboard-statistics.service.ts` | 儀表板統計 | Epic 7 |
| `expense-report.service.ts` | 費用報表 | Epic 7 |
| `monthly-cost-report.service.ts` | 月度成本報表 | Epic 7 |
| `audit-report.service.ts` | 審計報表 | Epic 8 |
| `processing-stats.service.ts` | 處理統計 | Epic 7 |
| `historical-accuracy.service.ts` | 歷史準確度 | Epic 7 |

### 7. 審計與追蹤 (Audit & Tracking)

| 服務 | 說明 | Epic |
|------|------|------|
| `audit-log.service.ts` | 審計日誌 | Epic 8 |
| `audit-query.service.ts` | 審計查詢 | Epic 8 |
| `api-audit-log.service.ts` | API 審計日誌 | Epic 11 |
| `change-tracking.service.ts` | 變更追蹤 | Epic 8 |
| `traceability.service.ts` | 可追溯性服務 | Epic 8 |
| `security-log.ts` | 安全日誌 | Epic 8 |

### 8. 審核工作流 (Review Workflow)

| 服務 | 說明 | Epic |
|------|------|------|
| `invoice-submission.service.ts` | 發票提交 | Epic 3 |
| `routing.service.ts` | 審核路由 | Epic 3 |
| `task-status.service.ts` | 任務狀態管理 | Epic 3 |

### 9. 警報與通知 (Alerts & Notifications)

| 服務 | 說明 | Epic |
|------|------|------|
| `alert.service.ts` | 警報服務 | Epic 12 |
| `alert-rule.service.ts` | 警報規則 | Epic 12 |
| `alert-evaluation.service.ts` | 警報評估 | Epic 12 |
| `alert-evaluation-job.ts` | 警報評估任務 | Epic 12 |
| `alert-notification.service.ts` | 警報通知 | Epic 12 |
| `notification.service.ts` | 通知服務 | Epic 12 |

### 10. 備份與資料管理 (Backup & Data)

| 服務 | 說明 | Epic |
|------|------|------|
| `backup.service.ts` | 備份服務 | Epic 12 |
| `backup-scheduler.service.ts` | 備份排程 | Epic 12 |
| `restore.service.ts` | 還原服務 | Epic 12 |
| `data-retention.service.ts` | 資料保留策略 | Epic 12 |
| `encryption.service.ts` | 加密服務 | Epic 8 |

### 11. 外部整合 (External Integration)

**Outlook 整合**
| 服務 | 說明 | Epic |
|------|------|------|
| `outlook-mail.service.ts` | Outlook 郵件 | Epic 9 |
| `outlook-document.service.ts` | Outlook 文件 | Epic 9 |
| `outlook-config.service.ts` | Outlook 配置 | Epic 9 |
| `microsoft-graph.service.ts` | Microsoft Graph API | Epic 9 |

**SharePoint 整合**
| 服務 | 說明 | Epic |
|------|------|------|
| `sharepoint-document.service.ts` | SharePoint 文件 | Epic 9 |
| `sharepoint-config.service.ts` | SharePoint 配置 | Epic 9 |

**Webhook 整合**
| 服務 | 說明 | Epic |
|------|------|------|
| `webhook.service.ts` | Webhook 管理 | Epic 11 |
| `webhook-event-trigger.ts` | Webhook 事件觸發 | Epic 11 |

**子目錄: `n8n/`** (Epic 10)
| 服務 | 說明 |
|------|------|
| `n8n-api-key.service.ts` | n8n API 金鑰 |
| `n8n-document.service.ts` | n8n 文件處理 |
| `n8n-health.service.ts` | n8n 健康檢查 |
| `n8n-webhook.service.ts` | n8n Webhook |
| `webhook-config.service.ts` | Webhook 配置 |
| `workflow-definition.service.ts` | 工作流定義 |
| `workflow-error.service.ts` | 工作流錯誤處理 |
| `workflow-execution.service.ts` | 工作流執行 |
| `workflow-trigger.service.ts` | 工作流觸發 |

### 12. 系統管理 (System Management)

| 服務 | 說明 | Epic |
|------|------|------|
| `health-check.service.ts` | 健康檢查 | Epic 12 |
| `system-config.service.ts` | 系統配置 | Epic 12 |
| `performance.service.ts` | 效能監控 | Epic 12 |
| `performance-collector.service.ts` | 效能收集器 | Epic 12 |
| `global-admin.service.ts` | 全域管理員 | Epic 12 |
| `example-generator.service.ts` | 範例生成器 | Epic 4 |
| `openapi-loader.service.ts` | OpenAPI 載入器 | Epic 11 |

### 13. 用戶與權限 (User & Auth)

| 服務 | 說明 | Epic |
|------|------|------|
| `user.service.ts` | 用戶管理 | Epic 1 |
| `role.service.ts` | 角色管理 | Epic 1 |
| `api-key.service.ts` | API 金鑰管理 | Epic 11 |
| `rate-limit.service.ts` | 速率限制 | Epic 11 |

### 14. 工具服務 (Utility Services)

**子目錄: `logging/`**
| 服務 | 說明 |
|------|------|
| `logger.service.ts` | 日誌記錄器 |
| `log-query.service.ts` | 日誌查詢 |

**子目錄: `similarity/`**
| 服務 | 說明 |
|------|------|
| `levenshtein.ts` | Levenshtein 距離 |
| `date-similarity.ts` | 日期相似度 |
| `numeric-similarity.ts` | 數值相似度 |

---

## 服務設計模式

### 標準服務結構

```typescript
/**
 * @fileoverview [服務功能描述]
 * @module src/services/[service-name]
 * @since Epic X - Story X.X
 */

import { prisma } from '@/lib/prisma';
import { ServiceError } from '@/lib/errors';

export class ExampleService {
  /**
   * [方法功能描述]
   * @param input - 輸入參數
   * @returns 返回結果
   * @throws ServiceError
   */
  async methodName(input: InputType): Promise<OutputType> {
    try {
      // 業務邏輯
    } catch (error) {
      throw new ServiceError('操作失敗', { cause: error });
    }
  }
}

// 單例導出
export const exampleService = new ExampleService();
```

### 三層映射系統架構

```
┌─────────────────────────────────────────────────────────────────┐
│ Tier 1: Universal Mapping                                       │
│ → mapping.service.ts (universalMappings)                        │
├─────────────────────────────────────────────────────────────────┤
│ Tier 2: Company-Specific Override                               │
│ → mapping.service.ts (companyMappings)                          │
├─────────────────────────────────────────────────────────────────┤
│ Tier 3: LLM Classification                                      │
│ → term-classification.service.ts (GPT-5.2)                      │
└─────────────────────────────────────────────────────────────────┘
```

### 信心度路由

```
confidence.service.ts
├─ ≥ 90%  → AUTO_APPROVE
├─ 70-89% → QUICK_REVIEW
└─ < 70%  → FULL_REVIEW
```

---

## 服務間依賴

### 核心依賴圖

```
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
```

### 審計依賴

```
audit-log.service.ts
├── change-tracking.service.ts
├── traceability.service.ts
└── security-log.ts
```

---

## 新增服務指南

1. **確定分類**: 根據業務領域選擇正確的分類
2. **命名規範**: 使用 `[功能].service.ts` 格式
3. **文件頭部**: 必須包含標準 JSDoc 註釋
4. **更新 index.ts**: 在 `index.ts` 中導出新服務
5. **更新本文檔**: 將新服務加入對應分類表格

---

## 相關文檔

- [CLAUDE.md (根目錄)](../../CLAUDE.md) - 項目總指南
- [.claude/rules/services.md](../../.claude/rules/services.md) - 服務開發規範
- [docs/02-architecture/](../../docs/02-architecture/) - 系統架構設計
- [docs/04-implementation/tech-specs/](../../docs/04-implementation/tech-specs/) - 各 Epic 技術規格

---

**維護者**: Development Team
**最後更新**: 2026-01-18
**版本**: 1.1.0
