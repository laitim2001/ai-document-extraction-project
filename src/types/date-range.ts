/**
 * @fileoverview 日期範圍類型定義
 * @description
 *   定義儀表板時間範圍篩選器所需的類型：
 *   - PresetRange: 預設時間範圍選項
 *   - DateRange: 日期範圍介面
 *   - DateRangeState: Context 狀態類型
 *   - 相關常數和標籤
 *
 * @module src/types/date-range
 * @since Epic 7 - Story 7.2 (時間範圍篩選器)
 */

/**
 * 預設時間範圍選項
 * @description 支援的快速選擇時間範圍
 */
export type PresetRange =
  | 'today'
  | 'yesterday'
  | 'thisWeek'
  | 'lastWeek'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisQuarter'
  | 'lastQuarter'
  | 'thisYear'
  | 'lastYear'
  | 'custom';

/**
 * 日期範圍介面
 * @description 包含起始日期、結束日期和可選的預設範圍
 */
export interface DateRange {
  /** 起始日期 */
  startDate: Date;
  /** 結束日期 */
  endDate: Date;
  /** 預設範圍（如果是快速選擇） */
  preset?: PresetRange;
}

/**
 * 日期範圍 Context 狀態
 * @description 管理日期範圍的狀態和操作方法
 */
export interface DateRangeState {
  /** 當前日期範圍 */
  dateRange: DateRange;
  /** 設定日期範圍 */
  setDateRange: (range: DateRange) => void;
  /** 設定預設範圍 */
  setPreset: (preset: PresetRange) => void;
  /** 重置為預設值 */
  reset: () => void;
  /** 是否正在載入 */
  isLoading: boolean;
}

/**
 * 日期範圍驗證結果
 * @description 驗證日期範圍時的回傳結果
 */
export interface DateRangeValidation {
  /** 是否有效 */
  isValid: boolean;
  /** 錯誤訊息（如果無效） */
  error?: string;
}

/**
 * URL 參數類型
 * @description URL 同步時使用的參數格式
 */
export interface DateRangeUrlParams {
  /** 起始日期 ISO 字串 */
  startDate?: string;
  /** 結束日期 ISO 字串 */
  endDate?: string;
  /** 預設範圍 */
  preset?: PresetRange;
}

// ============================================================
// 常數定義
// ============================================================

/**
 * 最大日期範圍天數
 * @description 限制日期範圍最多為一年
 */
export const MAX_RANGE_DAYS = 365;

/**
 * 預設範圍標籤
 * @description 用於 UI 顯示的中文標籤
 */
export const PRESET_LABELS: Record<PresetRange, string> = {
  today: '今天',
  yesterday: '昨天',
  thisWeek: '本週',
  lastWeek: '上週',
  thisMonth: '本月',
  lastMonth: '上月',
  thisQuarter: '本季',
  lastQuarter: '上季',
  thisYear: '今年',
  lastYear: '去年',
  custom: '自訂範圍',
};

/**
 * 預設時間範圍
 * @description 系統預設使用本月
 */
export const DEFAULT_PRESET: PresetRange = 'thisMonth';

/**
 * 快速選擇選項（不含 custom）
 * @description 用於快速選擇按鈕的選項
 */
export const QUICK_SELECT_PRESETS: PresetRange[] = [
  'today',
  'yesterday',
  'thisWeek',
  'lastWeek',
  'thisMonth',
  'lastMonth',
  'thisQuarter',
  'lastQuarter',
  'thisYear',
  'lastYear',
];

/**
 * URL 參數名稱
 * @description 用於 URL 同步的參數鍵名
 */
export const URL_PARAM_KEYS = {
  START_DATE: 'startDate',
  END_DATE: 'endDate',
  PRESET: 'preset',
} as const;
