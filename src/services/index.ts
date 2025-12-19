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
 * @lastModified 2025-12-19
 *
 * @features
 *   - 統一服務導出入口
 *   - 服務層架構文檔
 *   - 核心常數定義
 *   - 全域規則快取與解析（Story 6.5）
 *   - 全域 Forwarder 識別（Story 6.5）
 *   - 規則成效統計（Story 6.5）
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

// Epic 5: Forwarder Configuration (Story 5.1)
export * from './forwarder.service'

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
