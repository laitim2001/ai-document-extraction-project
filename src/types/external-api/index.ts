/**
 * @fileoverview 外部 API 類型定義統一導出
 * @description
 *   匯出所有外部 API 相關的類型定義，包括：
 *   - 提交請求類型
 *   - 回應類型
 *   - 驗證 Schema
 *
 * @module src/types/external-api
 * @author Development Team
 * @since Epic 11 - Story 11.1 (API 發票提交端點)
 * @lastModified 2025-12-20
 */

// 提交相關類型
export * from './submission';

// 回應相關類型
export * from './response';

// 驗證相關類型和 Schema
export * from './validation';
