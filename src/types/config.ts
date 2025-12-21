/**
 * @fileoverview 系統配置管理類型定義
 * @description
 *   定義 Story 12-4 系統配置管理相關的 TypeScript 類型
 *   包含配置值、驗證規則、歷史記錄等完整類型系統
 *
 * @module src/types/config
 * @since Epic 12 - Story 12-4 (系統配置管理)
 */

import type {
  SystemConfig,
  ConfigHistory,
  ConfigCategory,
  ConfigValueType,
  ConfigEffectType,
} from '@prisma/client';

// ============================================================
// Re-export Prisma Enum Types
// ============================================================

export {
  ConfigCategory,
  ConfigValueType,
  ConfigEffectType,
  ConfigScope,
} from '@prisma/client';

// ============================================================
// Validation Types
// ============================================================

/**
 * 配置驗證規則
 */
export interface ConfigValidation {
  /** 最小值（用於 NUMBER 類型） */
  min?: number;
  /** 最大值（用於 NUMBER 類型） */
  max?: number;
  /** 正則表達式（用於 STRING 類型） */
  pattern?: string;
  /** 可選選項（用於 ENUM 類型） */
  options?: string[];
  /** 是否必填 */
  required?: boolean;
  /** 最小長度（用於 STRING 類型） */
  minLength?: number;
  /** 最大長度（用於 STRING 類型） */
  maxLength?: number;
}

// ============================================================
// Config Value Types
// ============================================================

/**
 * 配置值介面（API 回傳格式）
 */
export interface ConfigValue {
  /** 配置鍵 */
  key: string;
  /** 實際值，敏感值會被遮罩 */
  value: unknown;
  /** 顯示名稱 */
  name: string;
  /** 詳細描述 */
  description: string;
  /** 配置類別 */
  category: ConfigCategory;
  /** 值類型 */
  valueType: ConfigValueType;
  /** 生效類型 */
  effectType: ConfigEffectType;
  /** 預設值 */
  defaultValue: unknown;
  /** 驗證規則 */
  validation?: ConfigValidation;
  /** 變更影響說明 */
  impactNote?: string;
  /** 是否加密儲存 */
  isEncrypted: boolean;
  /** 是否唯讀 */
  isReadOnly: boolean;
  /** 是否已修改（與預設值不同） */
  isModified: boolean;
  /** 最後更新時間 */
  updatedAt: Date;
  /** 更新者 ID */
  updatedBy?: string;
}

/**
 * 分組後的配置列表
 */
export type GroupedConfigs = Record<ConfigCategory, ConfigValue[]>;

// ============================================================
// Config Update Types
// ============================================================

/**
 * 配置更新輸入
 */
export interface ConfigUpdateInput {
  /** 新值 */
  value: unknown;
  /** 變更原因 */
  changeReason?: string;
}

/**
 * 配置更新結果
 */
export interface ConfigUpdateResult {
  /** 是否成功 */
  success: boolean;
  /** 是否需要重啟 */
  requiresRestart: boolean;
  /** 錯誤訊息 */
  error?: string;
}

// ============================================================
// Config Query Types
// ============================================================

/**
 * 配置列表查詢選項
 */
export interface ConfigListOptions {
  /** 按類別過濾 */
  category?: ConfigCategory;
  /** 搜尋關鍵字 */
  search?: string;
  /** 是否包含唯讀配置 */
  includeReadOnly?: boolean;
}

// ============================================================
// Config History Types
// ============================================================

/**
 * 配置歷史記錄
 */
export interface ConfigHistoryItem {
  /** 記錄 ID */
  id: string;
  /** 變更前的值 */
  previousValue: string;
  /** 變更後的值 */
  newValue: string;
  /** 變更時間 */
  changedAt: Date;
  /** 變更者 */
  changedBy: string;
  /** 變更者名稱 */
  changedByName?: string;
  /** 變更原因 */
  changeReason?: string;
  /** 是否為回滾操作 */
  isRollback: boolean;
}

/**
 * 配置歷史查詢選項
 */
export interface ConfigHistoryOptions {
  /** 限制返回數量 */
  limit?: number;
  /** 偏移量 */
  offset?: number;
}

/**
 * 配置歷史查詢結果
 */
export interface ConfigHistoryResult {
  /** 歷史記錄列表 */
  history: ConfigHistoryItem[];
  /** 總記錄數 */
  total: number;
}

// ============================================================
// Config Rollback Types
// ============================================================

/**
 * 配置回滾請求
 */
export interface ConfigRollbackRequest {
  /** 目標歷史記錄 ID */
  historyId: string;
  /** 回滾原因 */
  reason?: string;
}

/**
 * 配置重置請求
 */
export interface ConfigResetRequest {
  /** 重置原因 */
  reason?: string;
}

// ============================================================
// Config Export/Import Types
// ============================================================

/**
 * 配置匯出格式
 */
export interface ConfigExport {
  /** 匯出時間 */
  exportedAt: Date;
  /** 匯出者 */
  exportedBy: string;
  /** 配置鍵值對 */
  configs: Record<string, unknown>;
}

/**
 * 配置匯入結果
 */
export interface ConfigImportResult {
  /** 成功匯入數量 */
  imported: number;
  /** 跳過數量 */
  skipped: number;
  /** 錯誤訊息列表 */
  errors: string[];
}

// ============================================================
// Category & Effect Type Info
// ============================================================

/**
 * 類別顯示資訊
 */
export interface CategoryInfo {
  label: string;
  icon: string;
  description: string;
}

/**
 * 類別顯示資訊映射
 */
export const CATEGORY_INFO: Record<ConfigCategory, CategoryInfo> = {
  PROCESSING: {
    label: '處理參數',
    icon: '⚙️',
    description: '控制文件處理和 AI 提取的相關參數',
  },
  INTEGRATION: {
    label: '整合設定',
    icon: '🔗',
    description: 'AI 服務、n8n 和外部系統的連線設定',
  },
  SECURITY: {
    label: '安全設定',
    icon: '🔒',
    description: 'Session 管理、密碼策略和帳戶安全設定',
  },
  NOTIFICATION: {
    label: '通知設定',
    icon: '📧',
    description: 'Email、Teams 和其他通知管道的設定',
  },
  SYSTEM: {
    label: '系統設定',
    icon: '🖥️',
    description: '日誌、維護模式和系統級別的設定',
  },
  // Legacy categories from Story 6.4
  DISPLAY: {
    label: '顯示設定',
    icon: '🖼️',
    description: '介面顯示相關設定',
  },
  AI_MODEL: {
    label: 'AI 模型設定',
    icon: '🤖',
    description: 'AI 模型相關配置',
  },
  THRESHOLD: {
    label: '閾值設定',
    icon: '📊',
    description: '各種閾值配置',
  },
};

/**
 * 效果類型顯示資訊
 */
export interface EffectTypeInfo {
  label: string;
  color: string;
}

/**
 * 效果類型顯示資訊映射
 */
export const EFFECT_TYPE_INFO: Record<ConfigEffectType, EffectTypeInfo> = {
  IMMEDIATE: {
    label: '立即生效',
    color: 'green',
  },
  RESTART_REQUIRED: {
    label: '需重啟',
    color: 'orange',
  },
  SCHEDULED: {
    label: '排程生效',
    color: 'blue',
  },
};

/**
 * 值類型顯示資訊
 */
export interface ValueTypeInfo {
  label: string;
  description: string;
}

/**
 * 值類型顯示資訊映射
 */
export const VALUE_TYPE_INFO: Record<ConfigValueType, ValueTypeInfo> = {
  STRING: {
    label: '文字',
    description: '文字字串值',
  },
  NUMBER: {
    label: '數值',
    description: '整數或浮點數',
  },
  BOOLEAN: {
    label: '布林值',
    description: 'true 或 false',
  },
  JSON: {
    label: 'JSON',
    description: 'JSON 物件或陣列',
  },
  SECRET: {
    label: '敏感資料',
    description: '加密儲存的敏感資料',
  },
  ENUM: {
    label: '選項',
    description: '預定義選項列表',
  },
};

// ============================================================
// Seed Data Types
// ============================================================

/**
 * 配置種子資料
 */
export interface ConfigSeed {
  key: string;
  value: string;
  name: string;
  description: string;
  category: ConfigCategory;
  valueType: ConfigValueType;
  effectType?: ConfigEffectType;
  defaultValue?: string;
  impactNote?: string;
  validation?: ConfigValidation;
  isEncrypted?: boolean;
  isReadOnly?: boolean;
  sortOrder?: number;
}

// ============================================================
// Cache Types
// ============================================================

/**
 * 配置快取項目
 */
export interface ConfigCacheItem<T = unknown> {
  /** 配置值 */
  value: T;
  /** 快取時間 */
  cachedAt: number;
  /** 過期時間（毫秒） */
  ttl: number;
}

/**
 * 配置快取選項
 */
export interface ConfigCacheOptions {
  /** TTL（毫秒），預設 60000（60 秒） */
  ttl?: number;
  /** 是否強制刷新 */
  forceRefresh?: boolean;
}

// ============================================================
// Re-export Prisma types
// ============================================================

export type { SystemConfig, ConfigHistory };
