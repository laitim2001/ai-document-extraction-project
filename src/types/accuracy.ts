/**
 * @fileoverview 準確率監控與自動回滾相關類型定義
 * @description
 *   定義規則準確率計算、回滾觸發和通知等功能所需的類型。
 *   支援 Story 4-8 的自動回滾功能實作。
 *
 * @module src/types/accuracy
 * @since Epic 4 - Story 4.8
 * @lastModified 2025-12-19
 *
 * @features
 *   - 準確率指標類型
 *   - 準確率下降檢測結果
 *   - 回滾結果和歷史記錄
 *   - 監控配置和通知請求
 *
 * @related
 *   - src/services/rule-accuracy.ts - 準確率計算服務
 *   - src/services/auto-rollback.ts - 自動回滾服務
 *   - prisma/schema.prisma - RollbackLog, RuleApplication 模型
 */

// ============================================================
// Rollback Trigger Types
// ============================================================

/**
 * 回滾觸發類型
 * @description 定義觸發規則回滾的原因類型
 */
export type RollbackTrigger = 'AUTO' | 'MANUAL' | 'EMERGENCY'

// ============================================================
// Notification Types
// ============================================================

/**
 * 通知類型
 * @description 系統通知的類型分類
 */
export type NotificationType =
  | 'RULE_AUTO_ROLLBACK'
  | 'RULE_SUGGESTION'
  | 'SYSTEM_ALERT'
  | 'GENERAL'

/**
 * 通知優先級
 * @description 通知的優先級等級
 */
export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'

// ============================================================
// Accuracy Metrics Types
// ============================================================

/**
 * 準確率指標
 * @description 規則應用的準確率統計數據
 */
export interface AccuracyMetrics {
  /** 總應用次數 */
  total: number
  /** 準確次數 */
  accurate: number
  /** 不準確次數 */
  inaccurate: number
  /** 未驗證次數 */
  unverified: number
  /** 準確率 (0-1)，null 表示數據不足 */
  accuracy: number | null
  /** 有效樣本數（已驗證的數量） */
  sampleSize: number
}

/**
 * 準確率下降檢測結果
 * @description 比較規則當前版本與上一版本的準確率變化
 */
export interface AccuracyDropResult {
  /** 規則 ID */
  ruleId: string
  /** 規則名稱 */
  ruleName: string
  /** 欄位名稱 */
  fieldName: string
  /** 當前版本號 */
  currentVersion: number
  /** 上一版本號 */
  previousVersion: number
  /** 當前版本準確率 (0-1) */
  currentAccuracy: number
  /** 上一版本準確率 (0-1) */
  previousAccuracy: number
  /** 下降幅度 (0-1)，正值表示下降 */
  drop: number
  /** 下降百分比 (0-100) */
  dropPercentage: number
  /** 是否應該觸發回滾 */
  shouldRollback: boolean
  /** 樣本數量資訊 */
  sampleSizes: {
    current: number
    previous: number
  }
}

// ============================================================
// Rollback Types
// ============================================================

/**
 * 回滾結果
 * @description 執行回滾操作後的結果資訊
 */
export interface RollbackResult {
  /** 是否成功 */
  success: boolean
  /** 規則 ID */
  ruleId: string
  /** 規則名稱 */
  ruleName: string
  /** 原版本號 */
  fromVersion: number
  /** 回滾目標版本號 */
  toVersion: number
  /** 新版本號（回滾後的版本） */
  newVersion: number
  /** 回滾日誌 ID */
  logId: string
  /** 觸發類型 */
  triggeredBy: RollbackTrigger
  /** 回滾原因 */
  reason: string
  /** 時間戳 */
  timestamp: string
}

/**
 * 回滾歷史項目
 * @description 回滾歷史記錄的單一項目
 */
export interface RollbackHistoryItem {
  /** 記錄 ID */
  id: string
  /** 規則 ID */
  ruleId: string
  /** 規則名稱 */
  ruleName: string
  /** 欄位名稱 */
  fieldName: string
  /** 原版本號 */
  fromVersion: number
  /** 回滾目標版本號 */
  toVersion: number
  /** 觸發類型 */
  trigger: RollbackTrigger
  /** 回滾原因 */
  reason: string
  /** 回滾前準確率 */
  accuracyBefore: number
  /** 回滾後準確率 */
  accuracyAfter: number
  /** 創建時間 */
  createdAt: string
}

/**
 * 回滾歷史列表響應
 * @description 分頁的回滾歷史列表
 */
export interface RollbackHistoryResponse {
  /** 歷史項目列表 */
  items: RollbackHistoryItem[]
  /** 總數量 */
  total: number
  /** 當前頁碼 */
  page: number
  /** 每頁大小 */
  pageSize: number
  /** 總頁數 */
  totalPages: number
}

// ============================================================
// Monitoring Types
// ============================================================

/**
 * 監控任務結果
 * @description 每小時準確率監控任務的執行結果
 */
export interface MonitoringResult {
  /** 處理的規則數量 */
  processedRules: number
  /** 回滾的規則 ID 列表 */
  rolledBackRules: string[]
  /** 錯誤列表 */
  errors: Array<{
    ruleId: string
    error: string
  }>
  /** 開始時間 */
  startTime: string
  /** 結束時間 */
  endTime: string
  /** 執行時長（毫秒） */
  duration: number
}

/**
 * 準確率監控配置
 * @description 監控任務的配置參數
 */
export interface AccuracyMonitorConfig {
  /** 觸發回滾的下降閾值（預設 0.10 = 10%） */
  dropThreshold: number
  /** 最小有效樣本數（預設 10） */
  minSampleSize: number
  /** 計算時間窗口（小時，預設 24） */
  timeWindowHours: number
  /** 回滾冷卻時間（分鐘，預設 60） */
  cooldownMinutes: number
}

// ============================================================
// Alert Notification Types
// ============================================================

/**
 * 告警通知請求
 * @description 發送告警通知的請求參數
 */
export interface AlertNotificationRequest {
  /** 用戶 ID */
  userId: string
  /** 通知類型 */
  type: NotificationType
  /** 標題 */
  title: string
  /** 訊息內容 */
  message: string
  /** 附加數據 */
  data?: Record<string, unknown>
  /** 優先級 */
  priority: NotificationPriority
}

// ============================================================
// API Response Types
// ============================================================

/**
 * 準確率 API 響應
 * @description 獲取規則準確率的 API 響應
 */
export interface AccuracyApiResponse {
  /** 規則 ID */
  ruleId: string
  /** 當前版本號 */
  currentVersion: number
  /** 當前準確率指標 */
  current: AccuracyMetrics
  /** 歷史準確率趨勢 */
  historical: Array<{
    /** 時間段（日期） */
    period: string
    /** 準確率 */
    accuracy: number | null
    /** 樣本數量 */
    sampleSize: number
  }>
}

/**
 * 回滾歷史查詢選項
 * @description 查詢回滾歷史的過濾和分頁參數
 */
export interface RollbackHistoryQueryOptions {
  /** 規則 ID 過濾 */
  ruleId?: string
  /** 觸發類型過濾 */
  trigger?: RollbackTrigger
  /** 頁碼 */
  page?: number
  /** 每頁大小 */
  pageSize?: number
}
