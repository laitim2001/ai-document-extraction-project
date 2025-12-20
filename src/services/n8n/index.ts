/**
 * @fileoverview n8n 整合服務模組入口
 * @description
 *   本模組提供 n8n 工作流整合的完整服務，包含：
 *   - API Key 管理服務
 *   - 文件處理服務
 *   - Webhook 事件服務
 *
 *   ## 模組架構
 *
 *   ```
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │                      n8n 工作流                             │
 *   │                (SharePoint, Outlook, etc.)                  │
 *   └─────────────────────────┬───────────────────────────────────┘
 *                             │
 *                             ▼
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │                   n8n API 端點                              │
 *   │               (src/app/api/n8n/...)                         │
 *   │                                                             │
 *   │  POST /api/n8n/documents       → 提交文件                   │
 *   │  GET  /api/n8n/documents/[id]/status → 查詢狀態             │
 *   │  GET  /api/n8n/documents/[id]/result → 獲取結果             │
 *   │  POST /api/n8n/webhook         → 接收事件                   │
 *   └─────────────────────────┬───────────────────────────────────┘
 *                             │
 *                             ▼
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │                    n8n 服務層  ← 你在這裡                   │
 *   │                 (src/services/n8n/)                         │
 *   │                                                             │
 *   │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
 *   │  │  API Key     │ │   Document   │ │   Webhook    │        │
 *   │  │   Service    │ │   Service    │ │   Service    │        │
 *   │  └──────────────┘ └──────────────┘ └──────────────┘        │
 *   └─────────────────────────────────────────────────────────────┘
 *   ```
 *
 *   ## 認證流程
 *
 *   ```
 *   Request → n8nApiMiddleware → 驗證 API Key
 *                 ↓
 *           權限檢查 → 城市隔離 → 速率限制
 *                 ↓
 *           Service 處理 → Response
 *   ```
 *
 * @module src/services/n8n
 * @author Development Team
 * @since Epic 10 - Story 10.1
 * @lastModified 2025-12-20
 *
 * @features
 *   - 統一 n8n 服務導出
 *   - API Key 生命週期管理
 *   - 文件提交與狀態追蹤
 *   - Webhook 雙向通訊
 *   - Webhook 配置管理（Story 10.2）
 *
 * @related
 *   - src/types/n8n.ts - n8n 類型定義
 *   - src/app/api/n8n/ - n8n API 路由
 *   - src/lib/middleware/n8n-api.middleware.ts - API 認證中間件
 */

// ============================================================
// Service Exports
// ============================================================

/**
 * API Key 服務
 * @description 管理 n8n API Key 的生成、驗證、權限控制
 */
export { N8nApiKeyService, n8nApiKeyService } from './n8n-api-key.service';

/**
 * 文件服務
 * @description 處理 n8n 工作流提交的文件
 */
export { N8nDocumentService, n8nDocumentService } from './n8n-document.service';

/**
 * Webhook 服務
 * @description 管理 Webhook 事件發送與接收
 */
export { N8nWebhookService, n8nWebhookService } from './n8n-webhook.service';

/**
 * Webhook 配置服務
 * @description 管理 n8n Webhook 連接配置（Story 10.2）
 */
export { WebhookConfigService, webhookConfigService } from './webhook-config.service';

/**
 * 工作流執行服務
 * @description 管理工作流執行狀態追蹤（Story 10.3）
 */
export { WorkflowExecutionService, workflowExecutionService } from './workflow-execution.service';
