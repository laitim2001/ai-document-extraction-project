/**
 * @fileoverview URL 參數同步工具
 * @description
 *   提供日期範圍與 URL 參數的雙向同步功能：
 *   - 從 URL 解析日期範圍
 *   - 將日期範圍寫入 URL
 *   - 支援書籤和分享連結
 *
 * @module src/lib/url-params
 * @since Epic 7 - Story 7.2 (時間範圍篩選器)
 *
 * @dependencies
 *   - @/types/date-range - 日期範圍類型
 *   - @/lib/date-range-utils - 日期範圍工具
 */

import {
  type DateRange,
  type DateRangeUrlParams,
  type PresetRange,
  URL_PARAM_KEYS,
} from '@/types/date-range';
import {
  parseISODate,
  formatISODate,
  isValidPreset,
  getDateRangeFromPreset,
  getDefaultDateRange,
  validateDateRange,
} from '@/lib/date-range-utils';

/**
 * 從 URL 搜尋參數解析日期範圍
 * @param searchParams - URL 搜尋參數
 * @returns 解析後的日期範圍，如果無效則返回預設值
 */
export function parseDateRangeFromUrl(
  searchParams: URLSearchParams
): DateRange {
  const presetParam = searchParams.get(URL_PARAM_KEYS.PRESET);
  const startDateParam = searchParams.get(URL_PARAM_KEYS.START_DATE);
  const endDateParam = searchParams.get(URL_PARAM_KEYS.END_DATE);

  // 如果有有效的 preset 參數，使用預設範圍
  if (presetParam && isValidPreset(presetParam) && presetParam !== 'custom') {
    return getDateRangeFromPreset(presetParam);
  }

  // 如果有有效的日期參數，使用自訂範圍
  if (startDateParam && endDateParam) {
    const startDate = parseISODate(startDateParam);
    const endDate = parseISODate(endDateParam);

    if (startDate && endDate) {
      const validation = validateDateRange(startDate, endDate);
      if (validation.isValid) {
        return {
          startDate,
          endDate,
          preset: 'custom',
        };
      }
    }
  }

  // 返回預設值
  return getDefaultDateRange();
}

/**
 * 將日期範圍轉換為 URL 參數物件
 * @param dateRange - 日期範圍
 * @returns URL 參數物件
 */
export function dateRangeToUrlParams(dateRange: DateRange): DateRangeUrlParams {
  if (dateRange.preset && dateRange.preset !== 'custom') {
    return { preset: dateRange.preset };
  }

  return {
    startDate: formatISODate(dateRange.startDate),
    endDate: formatISODate(dateRange.endDate),
    preset: 'custom',
  };
}

/**
 * 更新 URL 搜尋參數
 * @param currentParams - 當前的 URL 搜尋參數
 * @param dateRange - 新的日期範圍
 * @returns 更新後的 URL 搜尋參數字串
 */
export function updateUrlSearchParams(
  currentParams: URLSearchParams,
  dateRange: DateRange
): string {
  const newParams = new URLSearchParams(currentParams);

  // 先清除舊的日期參數
  newParams.delete(URL_PARAM_KEYS.START_DATE);
  newParams.delete(URL_PARAM_KEYS.END_DATE);
  newParams.delete(URL_PARAM_KEYS.PRESET);

  // 設定新的參數
  if (dateRange.preset && dateRange.preset !== 'custom') {
    newParams.set(URL_PARAM_KEYS.PRESET, dateRange.preset);
  } else {
    newParams.set(URL_PARAM_KEYS.START_DATE, formatISODate(dateRange.startDate));
    newParams.set(URL_PARAM_KEYS.END_DATE, formatISODate(dateRange.endDate));
  }

  return newParams.toString();
}

/**
 * 建立包含日期範圍的完整 URL
 * @param baseUrl - 基礎 URL
 * @param dateRange - 日期範圍
 * @returns 完整 URL 字串
 */
export function buildUrlWithDateRange(
  baseUrl: string,
  dateRange: DateRange
): string {
  const url = new URL(baseUrl, window.location.origin);
  const params = dateRangeToUrlParams(dateRange);

  // 清除舊參數
  url.searchParams.delete(URL_PARAM_KEYS.START_DATE);
  url.searchParams.delete(URL_PARAM_KEYS.END_DATE);
  url.searchParams.delete(URL_PARAM_KEYS.PRESET);

  // 設定新參數
  if (params.preset && params.preset !== 'custom') {
    url.searchParams.set(URL_PARAM_KEYS.PRESET, params.preset);
  } else {
    if (params.startDate) {
      url.searchParams.set(URL_PARAM_KEYS.START_DATE, params.startDate);
    }
    if (params.endDate) {
      url.searchParams.set(URL_PARAM_KEYS.END_DATE, params.endDate);
    }
  }

  return url.toString();
}

/**
 * 從 Next.js router 的 searchParams 解析日期範圍
 * @param searchParams - Next.js 的 searchParams 物件
 * @returns 解析後的日期範圍
 */
export function parseDateRangeFromNextParams(
  searchParams: Record<string, string | string[] | undefined>
): DateRange {
  const getParam = (key: string): string | null => {
    const value = searchParams[key];
    if (Array.isArray(value)) {
      return value[0] || null;
    }
    return value || null;
  };

  const presetParam = getParam(URL_PARAM_KEYS.PRESET);
  const startDateParam = getParam(URL_PARAM_KEYS.START_DATE);
  const endDateParam = getParam(URL_PARAM_KEYS.END_DATE);

  // 如果有有效的 preset 參數，使用預設範圍
  if (presetParam && isValidPreset(presetParam) && presetParam !== 'custom') {
    return getDateRangeFromPreset(presetParam as PresetRange);
  }

  // 如果有有效的日期參數，使用自訂範圍
  if (startDateParam && endDateParam) {
    const startDate = parseISODate(startDateParam);
    const endDate = parseISODate(endDateParam);

    if (startDate && endDate) {
      const validation = validateDateRange(startDate, endDate);
      if (validation.isValid) {
        return {
          startDate,
          endDate,
          preset: 'custom',
        };
      }
    }
  }

  // 返回預設值
  return getDefaultDateRange();
}

/**
 * 檢查 URL 是否包含日期範圍參數
 * @param searchParams - URL 搜尋參數
 * @returns 是否包含日期範圍參數
 */
export function hasDateRangeParams(searchParams: URLSearchParams): boolean {
  return (
    searchParams.has(URL_PARAM_KEYS.PRESET) ||
    (searchParams.has(URL_PARAM_KEYS.START_DATE) &&
      searchParams.has(URL_PARAM_KEYS.END_DATE))
  );
}
