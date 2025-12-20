/**
 * @fileoverview 數據變更追蹤類型定義
 * @description
 *   定義數據變更追蹤系統所需的所有類型、介面和常數。
 *   包含：
 *   - DataChangeHistoryEntry：變更歷史條目介面
 *   - VersionSnapshot：版本快照介面
 *   - VersionCompareResult：版本比較結果介面
 *   - 追蹤配置和常數
 *
 * @module src/types/change-tracking
 * @since Epic 8 - Story 8.2 (數據變更追蹤)
 * @lastModified 2025-12-20
 *
 * @features
 *   - 完整的變更追蹤類型定義
 *   - 版本快照和比較功能
 *   - 追蹤模型和排除欄位配置
 *
 * @dependencies
 *   - Prisma HistoryChangeType enum
 *   - Prisma DataChangeHistory model
 *
 * @related
 *   - src/services/change-tracking.service.ts - 變更追蹤服務
 *   - src/lib/prisma/change-tracking-middleware.ts - Prisma 中間件
 *   - prisma/schema.prisma - DataChangeHistory 模型定義
 */

import { HistoryChangeType } from '@prisma/client';

// ============================================================
// Re-exports
// ============================================================

export { HistoryChangeType };

// ============================================================
// Types
// ============================================================

/**
 * 追蹤的模型類型
 * 定義系統中需要進行變更追蹤的模型名稱
 */
export type TrackedModel =
  | 'user'
  | 'role'
  | 'forwarder'
  | 'mappingRule'
  | 'ruleVersion'
  | 'systemConfig'
  | 'city'
  | 'region'
  | 'apiPricingConfig';

/**
 * 變更詳情結構
 * 記錄變更前後的值和變更的欄位列表
 */
export interface ChangeDetails {
  /** 變更前的值 */
  before?: Record<string, unknown>;
  /** 變更後的值 */
  after?: Record<string, unknown>;
  /** 變更的欄位列表 */
  changedFields?: string[];
}

/**
 * 數據變更歷史條目
 * 對應資料庫中的 DataChangeHistory 記錄
 */
export interface DataChangeHistoryEntry {
  /** 記錄 ID */
  id: string;
  /** 資源類型 */
  resourceType: string;
  /** 資源 ID */
  resourceId: string;
  /** 版本號 */
  version: number;
  /** 上一個版本的記錄 ID */
  previousId: string | null;
  /** 完整資料快照 */
  snapshot: Record<string, unknown>;
  /** 變更詳情 */
  changes: ChangeDetails | null;
  /** 變更者 ID */
  changedBy: string;
  /** 變更者名稱 */
  changedByName: string;
  /** 變更原因 */
  changeReason: string | null;
  /** 變更類型 */
  changeType: HistoryChangeType;
  /** 城市代碼 */
  cityCode: string | null;
  /** 創建時間 */
  createdAt: Date;
}

/**
 * 版本快照
 * 用於展示某個時間點的資料狀態
 */
export interface VersionSnapshot {
  /** 版本號 */
  version: number;
  /** 資料快照 */
  data: Record<string, unknown>;
  /** 變更類型 */
  changeType: HistoryChangeType;
  /** 變更者名稱 */
  changedByName: string;
  /** 變更原因 */
  changeReason: string | null;
  /** 時間戳 */
  timestamp: Date;
}

/**
 * 欄位差異
 * 記錄單個欄位的變更
 */
export interface FieldDiff {
  /** 欄位名稱 */
  field: string;
  /** 舊值 */
  oldValue: unknown;
  /** 新值 */
  newValue: unknown;
  /** 變更類型 */
  type: 'added' | 'removed' | 'modified';
}

/**
 * 版本比較結果
 * 用於比較兩個版本之間的差異
 */
export interface VersionCompareResult {
  /** 來源版本號 */
  fromVersion: number;
  /** 目標版本號 */
  toVersion: number;
  /** 欄位差異列表 */
  diffs: FieldDiff[];
  /** 來源快照 */
  fromSnapshot: VersionSnapshot;
  /** 目標快照 */
  toSnapshot: VersionSnapshot;
}

/**
 * 變更追蹤配置
 * 定義追蹤行為的配置選項
 */
export interface ChangeTrackingConfig {
  /** 是否啟用追蹤 */
  enabled: boolean;
  /** 追蹤的模型列表 */
  trackedModels: TrackedModel[];
  /** 排除的欄位列表 */
  excludedFields: string[];
  /** 是否記錄快照 */
  captureSnapshot: boolean;
  /** 是否計算差異 */
  calculateDiff: boolean;
}

/**
 * 記錄變更的參數
 */
export interface RecordChangeParams {
  /** 資源類型 */
  resourceType: TrackedModel;
  /** 資源 ID */
  resourceId: string;
  /** 變更類型 */
  changeType: HistoryChangeType;
  /** 完整資料快照 */
  snapshot: Record<string, unknown>;
  /** 變更前的資料（用於計算差異） */
  beforeData?: Record<string, unknown>;
  /** 變更者 ID */
  changedBy: string;
  /** 變更者名稱 */
  changedByName: string;
  /** 變更原因（可選） */
  changeReason?: string;
  /** 城市代碼（可選） */
  cityCode?: string;
}

/**
 * 獲取歷史記錄的參數
 */
export interface GetHistoryParams {
  /** 資源類型 */
  resourceType: TrackedModel;
  /** 資源 ID */
  resourceId: string;
  /** 分頁大小（可選，預設 20） */
  limit?: number;
  /** 偏移量（可選） */
  offset?: number;
}

/**
 * 歷史記錄查詢結果
 */
export interface HistoryQueryResult {
  /** 歷史記錄列表 */
  data: DataChangeHistoryEntry[];
  /** 分頁資訊 */
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * 時間線項目
 * 用於 UI 展示
 */
export interface TimelineItem {
  /** 記錄 ID */
  id: string;
  /** 版本號 */
  version: number;
  /** 變更類型 */
  changeType: HistoryChangeType;
  /** 變更者名稱 */
  changedByName: string;
  /** 變更原因 */
  changeReason: string | null;
  /** 時間戳 */
  timestamp: Date;
  /** 變更的欄位數量 */
  changedFieldCount: number;
  /** 是否為最新版本 */
  isCurrent: boolean;
}

// ============================================================
// Constants
// ============================================================

/**
 * 需要追蹤變更的模型列表
 */
export const TRACKED_MODELS: TrackedModel[] = [
  'user',
  'role',
  'forwarder',
  'mappingRule',
  'ruleVersion',
  'systemConfig',
  'city',
  'region',
  'apiPricingConfig',
];

/**
 * 排除追蹤的欄位
 * 這些欄位的變更不會被記錄到變更歷史中
 */
export const EXCLUDED_FIELDS: string[] = [
  'updatedAt', // 自動更新時間戳
  'createdAt', // 創建時間戳
  'password', // 敏感資訊
  'passwordHash', // 敏感資訊
  'refreshToken', // 敏感資訊
  'accessToken', // 敏感資訊
  'sessionToken', // 敏感資訊
];

/**
 * 模型到 Prisma 模型名稱的映射
 */
export const MODEL_TO_PRISMA_NAME: Record<TrackedModel, string> = {
  user: 'User',
  role: 'Role',
  forwarder: 'Forwarder',
  mappingRule: 'MappingRule',
  ruleVersion: 'RuleVersion',
  systemConfig: 'SystemConfig',
  city: 'City',
  region: 'Region',
  apiPricingConfig: 'ApiPricingConfig',
};

/**
 * 變更類型的描述
 */
export const CHANGE_TYPE_DESCRIPTIONS: Record<HistoryChangeType, string> = {
  CREATE: '創建',
  UPDATE: '更新',
  DELETE: '刪除',
  RESTORE: '還原',
};

/**
 * 預設追蹤配置
 */
export const DEFAULT_TRACKING_CONFIG: ChangeTrackingConfig = {
  enabled: true,
  trackedModels: TRACKED_MODELS,
  excludedFields: EXCLUDED_FIELDS,
  captureSnapshot: true,
  calculateDiff: true,
};

// ============================================================
// Helper Functions
// ============================================================

/**
 * 判斷模型是否需要追蹤
 *
 * @param modelName - 模型名稱
 * @returns 是否需要追蹤
 */
export function isTrackedModel(modelName: string): modelName is TrackedModel {
  return TRACKED_MODELS.includes(modelName as TrackedModel);
}

/**
 * 判斷欄位是否應該被排除
 *
 * @param fieldName - 欄位名稱
 * @returns 是否應該排除
 */
export function isExcludedField(fieldName: string): boolean {
  return EXCLUDED_FIELDS.includes(fieldName);
}

/**
 * 過濾排除的欄位
 *
 * @param data - 原始資料
 * @returns 過濾後的資料
 */
export function filterExcludedFields(
  data: Record<string, unknown>
): Record<string, unknown> {
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!isExcludedField(key)) {
      filtered[key] = value;
    }
  }
  return filtered;
}

/**
 * 計算兩個物件之間的差異
 *
 * @param before - 變更前的資料
 * @param after - 變更後的資料
 * @returns 欄位差異列表
 */
export function calculateDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of allKeys) {
    if (isExcludedField(key)) continue;

    const oldValue = before[key];
    const newValue = after[key];

    // 使用 JSON.stringify 進行深度比較
    const oldValueStr = JSON.stringify(oldValue);
    const newValueStr = JSON.stringify(newValue);

    if (oldValueStr !== newValueStr) {
      let type: FieldDiff['type'];
      if (oldValue === undefined) {
        type = 'added';
      } else if (newValue === undefined) {
        type = 'removed';
      } else {
        type = 'modified';
      }

      diffs.push({
        field: key,
        oldValue,
        newValue,
        type,
      });
    }
  }

  return diffs;
}

/**
 * 將變更歷史記錄轉換為時間線項目
 *
 * @param entry - 變更歷史記錄
 * @param isCurrent - 是否為最新版本
 * @returns 時間線項目
 */
export function toTimelineItem(
  entry: DataChangeHistoryEntry,
  isCurrent: boolean = false
): TimelineItem {
  return {
    id: entry.id,
    version: entry.version,
    changeType: entry.changeType,
    changedByName: entry.changedByName,
    changeReason: entry.changeReason,
    timestamp: entry.createdAt,
    changedFieldCount: entry.changes?.changedFields?.length ?? 0,
    isCurrent,
  };
}
