/**
 * @fileoverview 路由配置常數
 * @description
 *   定義處理路徑路由的所有配置常數，包括：
 *   - 路由閾值配置 (ROUTING_CONFIG)
 *   - 處理路徑配置 (PROCESSING_PATH_CONFIG)
 *   - 隊列優先級配置 (QUEUE_PRIORITY)
 *
 *   ## 路由閾值說明
 *
 *   | 路徑 | 閾值 | 審核範圍 |
 *   |------|------|---------|
 *   | AUTO_APPROVE | ≥95% | 無需審核 |
 *   | QUICK_REVIEW | 80-94% | 僅低信心度欄位 |
 *   | FULL_REVIEW | <80% | 所有欄位 |
 *   | MANUAL_REQUIRED | 特殊 | 所有欄位 |
 *
 * @module src/lib/routing/config
 * @since Epic 2 - Story 2.6 (Processing Path Auto Routing)
 * @lastModified 2025-12-18
 *
 * @related
 *   - src/types/routing.ts - 路由類型定義
 *   - src/lib/routing/router.ts - 路由邏輯模組
 *   - src/services/routing.service.ts - 路由服務
 */

import type {
  RoutingConfig,
  ProcessingPath,
  ProcessingPathConfig,
} from '@/types/routing'

// ============================================================
// Routing Thresholds Configuration
// ============================================================

/**
 * 預設路由配置
 *
 * @description
 *   定義路由閾值和相關配置：
 *   - autoApproveThreshold: 95（≥95% 自動通過）
 *   - quickReviewThreshold: 80（80-94% 快速審核）
 *   - criticalFields: 關鍵欄位列表
 *   - priorityBoostForOlder: 為較舊文件提升優先級
 *   - maxQueueAge: 隊列最大年齡 48 小時
 */
export const ROUTING_CONFIG: RoutingConfig = {
  autoApproveThreshold: 95,
  quickReviewThreshold: 80,
  criticalFields: [
    'invoiceNumber',
    'invoiceDate',
    'totalAmount',
    'currency',
    'shipperName',
    'consigneeName',
  ],
  priorityBoostForOlder: true,
  maxQueueAge: 48, // 48 hours
}

// ============================================================
// Processing Path Configuration
// ============================================================

/**
 * 處理路徑配置
 *
 * @description
 *   每個處理路徑的顯示和行為配置
 */
export const PROCESSING_PATH_CONFIG: ProcessingPathConfig = {
  AUTO_APPROVE: {
    label: 'Auto Approve',
    labelZh: '自動通過',
    description: 'High confidence, no review needed',
    color: '#22c55e', // green-500
    reviewRequired: false,
    reviewScope: 'none',
  },
  QUICK_REVIEW: {
    label: 'Quick Review',
    labelZh: '快速確認',
    description: 'Review low-confidence fields only',
    color: '#eab308', // yellow-500
    reviewRequired: true,
    reviewScope: 'low_confidence',
  },
  FULL_REVIEW: {
    label: 'Full Review',
    labelZh: '完整審核',
    description: 'Review all extracted fields',
    color: '#ef4444', // red-500
    reviewRequired: true,
    reviewScope: 'all',
  },
  MANUAL_REQUIRED: {
    label: 'Manual Required',
    labelZh: '需人工處理',
    description: 'Special case requiring manual handling',
    color: '#8b5cf6', // purple-500
    reviewRequired: true,
    reviewScope: 'all',
  },
}

// ============================================================
// Queue Priority Configuration
// ============================================================

/**
 * 隊列優先級常數
 *
 * @description
 *   定義不同情況下的優先級值：
 *   - URGENT: 100（緊急）
 *   - HIGH: 75（高）
 *   - NORMAL: 50（正常）
 *   - LOW: 25（低）
 */
export const QUEUE_PRIORITY = {
  URGENT: 100,
  HIGH: 75,
  NORMAL: 50,
  LOW: 25,
} as const

/**
 * 優先級類型
 */
export type QueuePriorityLevel = keyof typeof QUEUE_PRIORITY

// ============================================================
// Helper Functions
// ============================================================

/**
 * 獲取處理路徑配置
 *
 * @param path - 處理路徑
 * @returns 處理路徑配置項目
 */
export function getPathConfig(path: ProcessingPath) {
  return PROCESSING_PATH_CONFIG[path]
}

/**
 * 獲取處理路徑顏色
 *
 * @param path - 處理路徑
 * @returns 顏色 hex 值
 */
export function getPathColor(path: ProcessingPath): string {
  return PROCESSING_PATH_CONFIG[path].color
}

/**
 * 獲取處理路徑標籤
 *
 * @param path - 處理路徑
 * @param locale - 語言（'en' | 'zh'）
 * @returns 標籤文字
 */
export function getPathLabel(path: ProcessingPath, locale: 'en' | 'zh' = 'zh'): string {
  const config = PROCESSING_PATH_CONFIG[path]
  return locale === 'zh' ? config.labelZh : config.label
}

/**
 * 檢查處理路徑是否需要審核
 *
 * @param path - 處理路徑
 * @returns 是否需要審核
 */
export function isReviewRequired(path: ProcessingPath): boolean {
  return PROCESSING_PATH_CONFIG[path].reviewRequired
}

/**
 * 獲取審核範圍
 *
 * @param path - 處理路徑
 * @returns 審核範圍
 */
export function getReviewScope(path: ProcessingPath): 'none' | 'low_confidence' | 'all' {
  return PROCESSING_PATH_CONFIG[path].reviewScope
}

/**
 * 檢查欄位是否為關鍵欄位
 *
 * @param fieldName - 欄位名稱
 * @returns 是否為關鍵欄位
 */
export function isCriticalField(fieldName: string): boolean {
  return ROUTING_CONFIG.criticalFields.includes(fieldName)
}

/**
 * 獲取所有關鍵欄位
 *
 * @returns 關鍵欄位列表
 */
export function getCriticalFields(): string[] {
  return [...ROUTING_CONFIG.criticalFields]
}
