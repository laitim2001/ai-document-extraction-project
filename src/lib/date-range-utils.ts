/**
 * @fileoverview 日期範圍工具函數
 * @description
 *   提供日期範圍計算、驗證和格式化功能：
 *   - 預設範圍計算（今天、本週、本月等）
 *   - 日期範圍驗證
 *   - 日期格式化
 *   - 範圍天數計算
 *
 * @module src/lib/date-range-utils
 * @since Epic 7 - Story 7.2 (時間範圍篩選器)
 *
 * @dependencies
 *   - date-fns - 日期計算庫
 */

import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  subDays,
  subWeeks,
  subMonths,
  subQuarters,
  subYears,
  differenceInDays,
  isAfter,
  isBefore,
  isValid,
  parseISO,
  format,
} from 'date-fns';
import { zhTW } from 'date-fns/locale';
import {
  type PresetRange,
  type DateRange,
  type DateRangeValidation,
  MAX_RANGE_DAYS,
  DEFAULT_PRESET,
} from '@/types/date-range';

/**
 * 根據預設範圍計算日期範圍
 * @param preset - 預設範圍類型
 * @param referenceDate - 參考日期（預設為當前時間）
 * @returns 計算後的日期範圍
 */
export function getDateRangeFromPreset(
  preset: PresetRange,
  referenceDate: Date = new Date()
): DateRange {
  const now = referenceDate;

  switch (preset) {
    case 'today':
      return {
        startDate: startOfDay(now),
        endDate: endOfDay(now),
        preset,
      };

    case 'yesterday': {
      const yesterday = subDays(now, 1);
      return {
        startDate: startOfDay(yesterday),
        endDate: endOfDay(yesterday),
        preset,
      };
    }

    case 'thisWeek':
      return {
        startDate: startOfWeek(now, { weekStartsOn: 1 }), // 週一開始
        endDate: endOfWeek(now, { weekStartsOn: 1 }),
        preset,
      };

    case 'lastWeek': {
      const lastWeek = subWeeks(now, 1);
      return {
        startDate: startOfWeek(lastWeek, { weekStartsOn: 1 }),
        endDate: endOfWeek(lastWeek, { weekStartsOn: 1 }),
        preset,
      };
    }

    case 'thisMonth':
      return {
        startDate: startOfMonth(now),
        endDate: endOfMonth(now),
        preset,
      };

    case 'lastMonth': {
      const lastMonth = subMonths(now, 1);
      return {
        startDate: startOfMonth(lastMonth),
        endDate: endOfMonth(lastMonth),
        preset,
      };
    }

    case 'thisQuarter':
      return {
        startDate: startOfQuarter(now),
        endDate: endOfQuarter(now),
        preset,
      };

    case 'lastQuarter': {
      const lastQuarter = subQuarters(now, 1);
      return {
        startDate: startOfQuarter(lastQuarter),
        endDate: endOfQuarter(lastQuarter),
        preset,
      };
    }

    case 'thisYear':
      return {
        startDate: startOfYear(now),
        endDate: endOfYear(now),
        preset,
      };

    case 'lastYear': {
      const lastYear = subYears(now, 1);
      return {
        startDate: startOfYear(lastYear),
        endDate: endOfYear(lastYear),
        preset,
      };
    }

    case 'custom':
    default:
      // 自訂範圍預設為本月
      return {
        startDate: startOfMonth(now),
        endDate: endOfMonth(now),
        preset: 'custom',
      };
  }
}

/**
 * 取得預設日期範圍
 * @returns 預設的日期範圍（本月）
 */
export function getDefaultDateRange(): DateRange {
  return getDateRangeFromPreset(DEFAULT_PRESET);
}

/**
 * 驗證日期範圍
 * @param startDate - 起始日期
 * @param endDate - 結束日期
 * @returns 驗證結果
 */
export function validateDateRange(
  startDate: Date,
  endDate: Date
): DateRangeValidation {
  // 檢查日期是否有效
  if (!isValid(startDate)) {
    return { isValid: false, error: '起始日期無效' };
  }
  if (!isValid(endDate)) {
    return { isValid: false, error: '結束日期無效' };
  }

  // 檢查結束日期不能早於起始日期
  if (isBefore(endDate, startDate)) {
    return { isValid: false, error: '結束日期不能早於起始日期' };
  }

  // 檢查日期範圍不能超過最大天數
  const daysDiff = differenceInDays(endDate, startDate);
  if (daysDiff > MAX_RANGE_DAYS) {
    return {
      isValid: false,
      error: `日期範圍不能超過 ${MAX_RANGE_DAYS} 天`,
    };
  }

  // 檢查結束日期不能超過今天
  const today = endOfDay(new Date());
  if (isAfter(endDate, today)) {
    return { isValid: false, error: '結束日期不能超過今天' };
  }

  return { isValid: true };
}

/**
 * 計算日期範圍的天數
 * @param startDate - 起始日期
 * @param endDate - 結束日期
 * @returns 天數
 */
export function getRangeDays(startDate: Date, endDate: Date): number {
  return differenceInDays(endDate, startDate) + 1; // 包含起始和結束日期
}

/**
 * 格式化日期為顯示字串
 * @param date - 日期
 * @param formatStr - 格式字串（預設為 yyyy/MM/dd）
 * @returns 格式化後的字串
 */
export function formatDisplayDate(
  date: Date,
  formatStr: string = 'yyyy/MM/dd'
): string {
  return format(date, formatStr, { locale: zhTW });
}

/**
 * 格式化日期範圍為顯示字串
 * @param range - 日期範圍
 * @returns 格式化後的字串
 */
export function formatDateRangeDisplay(range: DateRange): string {
  const start = formatDisplayDate(range.startDate);
  const end = formatDisplayDate(range.endDate);
  return `${start} - ${end}`;
}

/**
 * 格式化日期為 ISO 字串（用於 API 和 URL）
 * @param date - 日期
 * @returns ISO 格式字串（yyyy-MM-dd）
 */
export function formatISODate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * 解析 ISO 日期字串
 * @param dateString - ISO 格式日期字串
 * @returns 日期物件，如果無效則返回 null
 */
export function parseISODate(dateString: string): Date | null {
  try {
    const date = parseISO(dateString);
    return isValid(date) ? date : null;
  } catch {
    return null;
  }
}

/**
 * 檢查是否為有效的預設範圍
 * @param value - 要檢查的值
 * @returns 是否為有效的預設範圍
 */
export function isValidPreset(value: unknown): value is PresetRange {
  const validPresets: PresetRange[] = [
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
    'custom',
  ];
  return typeof value === 'string' && validPresets.includes(value as PresetRange);
}

/**
 * 比較兩個日期範圍是否相同
 * @param range1 - 第一個日期範圍
 * @param range2 - 第二個日期範圍
 * @returns 是否相同
 */
export function areDateRangesEqual(
  range1: DateRange,
  range2: DateRange
): boolean {
  return (
    formatISODate(range1.startDate) === formatISODate(range2.startDate) &&
    formatISODate(range1.endDate) === formatISODate(range2.endDate)
  );
}

/**
 * 根據日期範圍推斷預設類型
 * @param range - 日期範圍
 * @returns 匹配的預設類型，如果沒有匹配則返回 'custom'
 */
export function inferPresetFromRange(range: DateRange): PresetRange {
  const presets: PresetRange[] = [
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

  for (const preset of presets) {
    const presetRange = getDateRangeFromPreset(preset);
    if (areDateRangesEqual(range, presetRange)) {
      return preset;
    }
  }

  return 'custom';
}
