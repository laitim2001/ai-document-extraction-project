/**
 * @fileoverview 外部 API 類型定義統一導出
 * @description
 *   匯出所有外部 API 相關的類型定義，包括：
 *   - 提交請求類型
 *   - 回應類型
 *   - 驗證 Schema
 *   - 任務狀態類型
 *   - 查詢參數類型
 *   - 處理步驟定義
 *
 * @module src/types/external-api
 * @author Development Team
 * @since Epic 11 - Story 11.1 (API 發票提交端點)
 * @lastModified 2025-12-21
 *
 * @features
 *   - Story 11-1: 發票提交類型
 *   - Story 11-2: 狀態查詢類型
 */

// 提交相關類型 (Story 11-1)
export * from './submission';

// 回應相關類型 (Story 11-1)
export * from './response';

// 驗證相關類型和 Schema (Story 11-1)
export * from './validation';

// 任務狀態相關類型 (Story 11-2)
export * from './status';

// 查詢參數相關類型和 Schema (Story 11-2)
export * from './query';

// 處理步驟定義 (Story 11-2)
export * from './steps';
