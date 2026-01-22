/**
 * @fileoverview 服務層模組入口 - AI Document Extraction 核心業務邏輯
 * @description
 *   本模組是整個應用程式業務邏輯的統一入口點。
 *   服務層負責封裝所有核心業務邏輯，與 API 路由層和資料存取層分離。
 *
 *   ## 架構概覽
 *
 *   ```
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │                      API Routes Layer                       │
 *   │                   (src/app/api/v1/...)                      │
 *   └─────────────────────────┬───────────────────────────────────┘
 *                             │
 *                             ▼
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │                     Services Layer  ← 你在這裡               │
 *   │                    (src/services/)                          │
 *   │                                                             │
 *   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
 *   │  │   mapping   │  │     ocr     │  │   review    │         │
 *   │  │   service   │  │   service   │  │   service   │         │
 *   │  └─────────────┘  └─────────────┘  └─────────────┘         │
 *   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
 *   │  │  forwarder  │  │   document  │  │  analytics  │         │
 *   │  │   service   │  │   service   │  │   service   │         │
 *   │  └─────────────┘  └─────────────┘  └─────────────┘         │
 *   └─────────────────────────┬───────────────────────────────────┘
 *                             │
 *                             ▼
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │                    Data Access Layer                        │
 *   │               (Prisma ORM + External APIs)                  │
 *   └─────────────────────────────────────────────────────────────┘
 *   ```
 *
 *   ## 服務模組說明
 *
 *   | 服務 | 職責 | Epic |
 *   |------|------|------|
 *   | mapping | 三層映射邏輯、信心度計算 | Epic 6 |
 *   | ocr | Azure Document Intelligence 整合 | Epic 5 |
 *   | review | 人工審核流程管理 | Epic 7 |
 *   | forwarder | Forwarder Profile CRUD | Epic 4 |
 *   | document | 文件上傳和管理 | Epic 2 |
 *   | analytics | 數據統計和報表 | Epic 8 |
 *   | rule-resolver | 全域規則快取與解析 | Epic 6 Story 6.5 |
 *   | forwarder-identifier | 全域 Forwarder 識別 | Epic 6 Story 6.5 |
 *   | rule-metrics | 規則成效統計與分析 | Epic 6 Story 6.5 |
 *   | audit-log | 用戶操作日誌記錄 | Epic 8 Story 8.1 |
 *   | change-tracking | 數據變更追蹤 | Epic 8 Story 8.2 |
 *   | n8n | n8n 工作流雙向通訊 API | Epic 10 Story 10.1 |
 *   | document-progress | 文件處理進度追蹤 | Epic 10 Story 10.6 |
 *   | invoice-submission | 外部 API 發票提交 | Epic 11 Story 11.1 |
 *   | task-status | 外部 API 任務狀態查詢 | Epic 11 Story 11.2 |
 *   | result-retrieval | 外部 API 結果擷取 | Epic 11 Story 11.3 |
 *   | webhook | Webhook 通知服務 | Epic 11 Story 11.4 |
 *   | api-key | API Key 管理服務 | Epic 11 Story 11.5 |
 *   | api-audit-log | API 審計日誌服務 | Epic 11 Story 11.5 |
 *   | health-check | 系統健康監控服務 | Epic 12 Story 12.1 |
 *   | processing-router | 文件處理路由服務 | Epic 0 Story 0.2 |
 *   | cost-estimation | 處理成本估算服務 | Epic 0 Story 0.2 |
 *   | batch-processor | 批量處理執行器 | Epic 0 Story 0.2 |
 *   | gpt-vision | GPT-5.2 Vision 處理服務 | Epic 0 Story 0.2 |
 *   | company-matcher | 公司名稱模糊匹配服務 | Epic 0 Story 0.3 |
 *   | company-auto-create | JIT 公司 Profile 自動建立 | Epic 0 Story 0.3 |
 *   | unified-processor | 11 步統一處理管道 | Epic 15 Story 15.1 |
 *
 *   ## 核心設計原則
 *
 *   1. **單一職責**: 每個服務只處理一個業務領域
 *   2. **依賴注入**: 服務通過構造函數接收依賴，便於測試
 *   3. **錯誤處理**: 統一使用自定義 Error 類型，便於 API 層轉換
 *   4. **類型安全**: 所有輸入輸出都有明確的 TypeScript 類型
 *   5. **可測試性**: 純函數優先，副作用隔離到邊界
 *
 *   ## 三層映射架構（核心）
 *
 *   ```
 *   輸入術語 → Tier 1 (Universal) → 找到？ → 返回結果
 *                    ↓ 未找到
 *             Tier 2 (Forwarder-Specific) → 找到？ → 返回結果
 *                    ↓ 未找到
 *             Tier 3 (LLM Classification) → 返回結果 + 信心度
 *   ```
 *
 *   ## 信心度路由機制
 *
 *   | 信心度 | 處理方式 | 常數 |
 *   |--------|---------|------|
 *   | ≥ 90% | AUTO_APPROVE | CONFIDENCE_THRESHOLD_HIGH |
 *   | 70-89% | QUICK_REVIEW | CONFIDENCE_THRESHOLD_MEDIUM |
 *   | < 70% | FULL_REVIEW | - |
 *
 * @module src/services
 * @author Development Team
 * @since Epic 1 - Story 1.0 (Project Init Foundation)
 * @lastModified 2026-01-03
 *
 * @features
 *   - 統一服務導出入口
 *   - 服務層架構文檔
 *   - 核心常數定義
 *   - 全域規則快取與解析（Story 6.5）
 *   - 全域 Forwarder 識別（Story 6.5）
 *   - 規則成效統計（Story 6.5）
 *   - SharePoint 連線配置管理（Story 9.2）
 *   - n8n 工作流雙向通訊 API（Story 10.1）
 *   - 文件處理進度追蹤（Story 10.6）
 *   - 外部 API 發票提交（Story 11.1）
 *   - 外部 API 任務狀態查詢（Story 11.2）
 *   - 外部 API 結果擷取（Story 11.3）
 *   - Webhook 通知服務（Story 11.4）
 *   - API 存取控制與認證（Story 11.5）
 *   - 系統健康監控服務（Story 12.1）
 *   - 11 步統一處理管道（Story 15.1）
 *
 * @related
 *   - src/app/api/ - API 路由層（調用服務）
 *   - src/lib/prisma.ts - 資料庫客戶端
 *   - src/types/ - 類型定義
 *   - docs/02-architecture/ - 架構設計文檔
 *
 * @example
 *   // 在 API 路由中使用服務
 *   import { mappingService, documentService } from '@/services';
 *
 *   const result = await mappingService.classifyTerm(term, forwarderId);
 *   if (result.confidence >= CONFIDENCE_THRESHOLD_HIGH) {
 *     // 自動通過
 *   }
 */

// ============================================================
// 核心常數
// ============================================================

/**
 * 信心度閾值 - 高（自動通過）
 * 當映射結果的信心度 ≥ 此值時，系統自動批准
 */
export const CONFIDENCE_THRESHOLD_HIGH = 90;

/**
 * 信心度閾值 - 中（快速審核）
 * 當映射結果的信心度在此值與高閾值之間時，需要快速人工確認
 */
export const CONFIDENCE_THRESHOLD_MEDIUM = 70;

/**
 * 映射層級優先順序
 */
export const MAPPING_TIER_PRIORITY = {
  UNIVERSAL: 1,
  FORWARDER_SPECIFIC: 2,
  LLM_CLASSIFICATION: 3,
} as const;

/**
 * 審核類型
 */
export const REVIEW_TYPE = {
  AUTO_APPROVE: 'AUTO_APPROVE',
  QUICK_REVIEW: 'QUICK_REVIEW',
  FULL_REVIEW: 'FULL_REVIEW',
} as const;

// ============================================================
// 服務導出
// ============================================================

// Epic 1: User Authentication & Access Control
export * from './role.service'
export * from './user.service'
export * from './city.service'

// Epic 6: Multi-City Data Isolation (Story 6.1)
export * from './city-access.service'

// Epic 6: Global Admin Full Access (Story 6.4)
export * from './global-admin.service'
export * from './system-config.service'

// TODO: Epic 6 實現後取消註釋
// export { mappingService } from './mapping';
// export { MappingService } from './mapping/mapping-service';

// TODO: Epic 5 實現後取消註釋
// export { ocrService } from './ocr';
// export { OcrService } from './ocr/ocr-service';

// TODO: Epic 7 實現後取消註釋
// export { reviewService } from './review';
// export { ReviewService } from './review/review-service';

// REFACTOR-001: Company Configuration (原 Forwarder)
// 注意：已包含向後相容的 Forwarder 別名，無需額外導出 forwarder.service
export * from './company.service'

// Epic 2: Manual Invoice Upload & AI Processing
export * from './document.service'
export * from './extraction.service'
export * from './identification'
export * from './mapping.service'
export * from './historical-accuracy.service'
export * from './confidence.service'
export * from './routing.service'

// Epic 3: Invoice Review & Correction Workflow
export * from './notification.service'

// Epic 4: 映射規則管理與自動學習 (Story 4.3, 4.4, 4.5)
export * from './correction-recording'
export * from './pattern-analysis'
export * from './similarity'
export * from './impact-analysis'
export * from './rule-simulation'

// Epic 5: Forwarder Configuration (Story 5.3 - 規則變更請求)
export * from './rule-change.service'

// Epic 5: Forwarder Configuration (Story 5.4 - 規則測試服務)
export * from './rule-testing.service'

// Epic 6: Multi-City Data Isolation (Story 6.5 - Global Rule Sharing)
export * from './rule-resolver'
export * from './forwarder-identifier'
export * from './rule-metrics'

// Epic 7: Reports Dashboard (Story 7.1 - Processing Statistics Dashboard)
export * from './dashboard-statistics.service'

// Epic 7: Reports Dashboard (Story 7.4 - Expense Report Export)
export * from './expense-report.service'

// Epic 7: Reports Dashboard (Story 7.5 - Regional Report)
export * from './regional-report.service'

// Epic 7: Reports Dashboard (Story 7.6 - AI API Cost Tracking)
export * from './ai-cost.service'

// Epic 7: Reports Dashboard (Story 7.7 - City Processing Statistics)
export * from './processing-stats.service'

// Epic 7: Reports Dashboard (Story 7.8 - City AI Cost Tracking)
export * from './city-cost.service'

// Epic 7: Reports Dashboard (Story 7.9 - City Cost Report)
export * from './city-cost-report.service'

// Epic 7: Reports Dashboard (Story 7.10 - Monthly Cost Allocation Report)
export * from './monthly-cost-report.service'

// Epic 8: Audit Trail & Compliance (Story 8.1 - User Operation Log Recording)
export * from './audit-log.service'

// Epic 8: Audit Trail & Compliance (Story 8.2 - Data Change Tracking)
export * from './change-tracking.service'

// Epic 8: Audit Trail & Compliance (Story 8.3 - Processing Record Query)
export * from './audit-query.service'

// Epic 8: Audit Trail & Compliance (Story 8.4 - Original Document Traceability)
export * from './traceability.service'

// Epic 8: Audit Trail & Compliance (Story 8.5 - Audit Report Export)
export * from './audit-report.service'

// Epic 8: Audit Trail & Compliance (Story 8.6 - Long-term Data Retention)
export * from './data-retention.service'

// Epic 9: Automated Document Acquisition (Story 9.1 - SharePoint Document Monitoring API)
export * from './encryption.service'
export * from './microsoft-graph.service'
export * from './sharepoint-document.service'

// Epic 9: Automated Document Acquisition (Story 9.2 - SharePoint Connection Configuration)
export * from './sharepoint-config.service'

// Epic 9: Automated Document Acquisition (Story 9.3 - Outlook Mail Attachment Extraction API)
export * from './outlook-mail.service'
export * from './outlook-document.service'

// Epic 9: Automated Document Acquisition (Story 9.4 - Outlook Connection Configuration)
export * from './outlook-config.service'

// Epic 9: Automated Document Acquisition (Story 9.5 - Auto Retrieval Source Tracking)
export * from './document-source.service'

// Epic 10: n8n Workflow Integration (Story 10.1 - n8n Bidirectional Communication API)
export * from './n8n'

// Epic 10: n8n Workflow Integration (Story 10.6 - Document Processing Progress Tracking)
export * from './document-progress.service'

// Epic 10: n8n Workflow Integration (Story 10.7 - n8n Connection Status Monitoring)
export * from './alert.service'

// Epic 11: External API Services (Story 11.1 - API Invoice Submission Endpoint)
export * from './invoice-submission.service'
export * from './rate-limit.service'

// Epic 11: External API Services (Story 11.2 - API Processing Status Query Endpoint)
export * from './task-status.service'

// Epic 11: External API Services (Story 11.3 - API Processing Result Retrieval Endpoint)
export * from './result-retrieval.service'

// Epic 11: External API Services (Story 11.4 - Webhook Notification Service)
export * from './webhook.service'
export * from './webhook-event-trigger'

// Epic 11: External API Services (Story 11.5 - API Access Control & Authentication)
export * from './api-key.service'
export * from './api-audit-log.service'

// Epic 11: External API Services (Story 11.6 - API Documentation & Developer Support)
export * from './openapi-loader.service'
export * from './example-generator.service'

// Epic 12: System Administration & Monitoring (Story 12.1 - System Health Monitoring Dashboard)
export * from './health-check.service'

// Epic 12: System Administration & Monitoring (Story 12-3 - Error Alert Configuration)
export * from './alert-rule.service'
export * from './alert-evaluation.service'
export * from './alert-notification.service'
export * from './alert-evaluation-job'

// Epic 12: System Administration & Monitoring (Story 12-4 - System Configuration Management)
export * from './system-config.service'

// Epic 12: System Administration & Monitoring (Story 12-5 - Data Backup Management)
export * from './backup.service'
export * from './backup-scheduler.service'

// Epic 12: System Administration & Monitoring (Story 12-6 - Data Recovery Functionality)
export * from './restore.service'

// Epic 12: System Administration & Monitoring (Story 12-7 - System Log Query)
export * from './logging'

// Epic 0: Historical Data Initialization (Story 0-1 - Batch File Upload)
export * from './file-detection.service'

// Epic 0: Historical Data Initialization (Story 0-2 - Intelligent Processing Routing)
export * from './processing-router.service'
export * from './cost-estimation.service'
export * from './batch-processor.service'
export * from './gpt-vision.service'
export * from './azure-di.service'

// Epic 0: Historical Data Initialization (Story 0-3 - JIT Company Profile)
export * from './company-matcher.service'
export * from './company-auto-create.service'

// Epic 0: Historical Data Initialization (Story 0-4 - Batch Processing Progress Tracking)
export * from './batch-progress.service'

// Epic 0: Historical Data Initialization (Story 0-5 - Term Aggregation & Rules)
export * from './term-aggregation.service'
export * from './term-classification.service'

// Epic 0: Historical Data Initialization (Story 0-7 - Batch Term Aggregation Integration)
export * from './batch-term-aggregation.service'

// Epic 0: Historical Data Initialization (Story 0-8 - Document Issuer Identification)
export * from './document-issuer.service'

// Epic 0: Historical Data Initialization (Story 0-9 - Document Format & Hierarchical Term Aggregation)
export * from './document-format.service'
export * from './hierarchical-term-aggregation.service'

// Epic 0: Historical Data Initialization (Story 0-10 - AI Term Validation Service)
export * from './ai-term-validator.service'

// Epic 14: Prompt Configuration & Dynamic Generation (Story 14.3 - Prompt Resolution Service)
export * from './prompt-resolver.factory'
export * from './prompt-resolver.service'
export * from './prompt-merge-engine.service'
export * from './prompt-variable-engine.service'
export * from './prompt-cache.service'

// Epic 14: Prompt Configuration & Dynamic Generation (Story 14.4 - GPT Vision Integration)
export * from './prompt-provider.interface'
export * from './static-prompts'
export * from './hybrid-prompt-provider.service'

// Epic 15: Unified Processing Pipeline (Story 15.1 - Processing Flow Refactoring)
export * from './unified-processor'

// Epic 16: Format Management (Story 16.7 - Data Template)
export * from './data-template.service'

// Epic 19: Template Matching & Export (Story 19.1 - Template Field Mapping)
export * from './template-field-mapping.service'

// Epic 19: Template Matching & Export (Story 19.2 - Template Instance)
export * from './template-instance.service'

// TODO: Epic 8 實現後取消註釋
// export { analyticsService } from './analytics';
// export { AnalyticsService } from './analytics/analytics-service';

// ============================================================
// 輔助函數
// ============================================================

/**
 * 根據信心度決定審核類型
 *
 * @description
 *   根據映射結果的信心度評分，決定該筆資料應該進入哪種審核流程。
 *   這是系統核心的路由邏輯之一。
 *
 * @param confidence - 信心度評分 (0-100)
 * @returns 審核類型
 *
 * @example
 *   const reviewType = getReviewType(85);
 *   // 返回: 'QUICK_REVIEW'
 */
export function getReviewType(
  confidence: number
): (typeof REVIEW_TYPE)[keyof typeof REVIEW_TYPE] {
  if (confidence >= CONFIDENCE_THRESHOLD_HIGH) {
    return REVIEW_TYPE.AUTO_APPROVE;
  }
  if (confidence >= CONFIDENCE_THRESHOLD_MEDIUM) {
    return REVIEW_TYPE.QUICK_REVIEW;
  }
  return REVIEW_TYPE.FULL_REVIEW;
}

/**
 * 驗證信心度值是否有效
 *
 * @param confidence - 信心度評分
 * @returns 是否為有效的信心度值 (0-100)
 */
export function isValidConfidence(confidence: number): boolean {
  return (
    typeof confidence === 'number' &&
    !Number.isNaN(confidence) &&
    confidence >= 0 &&
    confidence <= 100
  );
}
