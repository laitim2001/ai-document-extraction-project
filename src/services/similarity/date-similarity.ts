/**
 * @fileoverview 日期格式相似度計算算法
 * @description
 *   實現日期欄位的相似度比較和格式轉換檢測：
 *   - 支援多種日期格式解析
 *   - 計算日期相似度
 *   - 檢測日期格式轉換模式
 *
 * @module src/services/similarity/date-similarity
 * @since Epic 4 - Story 4.3
 * @lastModified 2025-12-19
 *
 * @features
 *   - 多格式日期解析
 *   - 同日不同格式檢測
 *   - 格式轉換模式識別
 */

import type { DateSimilarityResult, DateFormatPattern } from '@/types/pattern';

// ============================================================
// 類型定義
// ============================================================

interface DateFormat {
  regex: RegExp;
  format: string;
  parse: (match: RegExpMatchArray) => Date;
}

interface ParsedDate {
  date: Date;
  format: string;
}

// ============================================================
// 日期格式配置
// ============================================================

/**
 * 支援的日期格式列表
 * 按常見程度排序
 */
const DATE_FORMATS: DateFormat[] = [
  // ISO 格式
  {
    regex: /^(\d{4})-(\d{2})-(\d{2})$/,
    format: 'YYYY-MM-DD',
    parse: (m) => new Date(+m[1], +m[2] - 1, +m[3]),
  },
  // 美式格式
  {
    regex: /^(\d{2})\/(\d{2})\/(\d{4})$/,
    format: 'MM/DD/YYYY',
    parse: (m) => new Date(+m[3], +m[1] - 1, +m[2]),
  },
  // 歐式格式（日/月/年）
  {
    regex: /^(\d{2})\/(\d{2})\/(\d{4})$/,
    format: 'DD/MM/YYYY',
    parse: (m) => new Date(+m[3], +m[2] - 1, +m[1]),
  },
  // 日式/中式格式
  {
    regex: /^(\d{4})\/(\d{2})\/(\d{2})$/,
    format: 'YYYY/MM/DD',
    parse: (m) => new Date(+m[1], +m[2] - 1, +m[3]),
  },
  // 連字符歐式
  {
    regex: /^(\d{2})-(\d{2})-(\d{4})$/,
    format: 'DD-MM-YYYY',
    parse: (m) => new Date(+m[3], +m[2] - 1, +m[1]),
  },
  // 連字符美式
  {
    regex: /^(\d{2})-(\d{2})-(\d{4})$/,
    format: 'MM-DD-YYYY',
    parse: (m) => new Date(+m[3], +m[1] - 1, +m[2]),
  },
  // 緊湊格式
  {
    regex: /^(\d{4})(\d{2})(\d{2})$/,
    format: 'YYYYMMDD',
    parse: (m) => new Date(+m[1], +m[2] - 1, +m[3]),
  },
  // 中文格式
  {
    regex: /^(\d{4})年(\d{1,2})月(\d{1,2})日$/,
    format: 'YYYY年M月D日',
    parse: (m) => new Date(+m[1], +m[2] - 1, +m[3]),
  },
  // 簡短年份
  {
    regex: /^(\d{2})\/(\d{2})\/(\d{2})$/,
    format: 'DD/MM/YY',
    parse: (m) => {
      const year = +m[3] + (parseInt(m[3]) > 50 ? 1900 : 2000);
      return new Date(year, +m[2] - 1, +m[1]);
    },
  },
  // 點分隔
  {
    regex: /^(\d{2})\.(\d{2})\.(\d{4})$/,
    format: 'DD.MM.YYYY',
    parse: (m) => new Date(+m[3], +m[2] - 1, +m[1]),
  },
];

// ============================================================
// 日期解析
// ============================================================

/**
 * 解析日期字串
 *
 * @description
 *   嘗試使用多種格式解析日期字串
 *   返回解析結果和識別的格式
 *
 * @param value - 日期字串
 * @returns 解析結果，包含 Date 對象和格式字串，無法解析返回 null
 *
 * @example
 * ```typescript
 * parseDate('2024-01-15')
 * // { date: Date, format: 'YYYY-MM-DD' }
 *
 * parseDate('15/01/2024')
 * // { date: Date, format: 'DD/MM/YYYY' }
 * ```
 */
function parseDate(value: string): ParsedDate | null {
  if (!value || typeof value !== 'string') return null;

  const trimmed = value.trim();

  // 嘗試預定義格式
  for (const fmt of DATE_FORMATS) {
    const match = trimmed.match(fmt.regex);
    if (match) {
      try {
        const date = fmt.parse(match);
        if (!isNaN(date.getTime()) && isValidDate(date)) {
          return { date, format: fmt.format };
        }
      } catch {
        continue;
      }
    }
  }

  // 嘗試原生解析（作為備選）
  try {
    const nativeDate = new Date(trimmed);
    if (!isNaN(nativeDate.getTime()) && isValidDate(nativeDate)) {
      return { date: nativeDate, format: 'NATIVE' };
    }
  } catch {
    // 忽略原生解析錯誤
  }

  return null;
}

/**
 * 驗證日期是否合理
 * 檢查年份範圍、月份、日期的有效性
 */
function isValidDate(date: Date): boolean {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  // 年份範圍檢查（1900-2100）
  if (year < 1900 || year > 2100) return false;

  // 月份範圍檢查
  if (month < 0 || month > 11) return false;

  // 日期範圍檢查
  if (day < 1 || day > 31) return false;

  return true;
}

/**
 * 比較兩個日期是否為同一天
 */
function isSameDate(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

// ============================================================
// 相似度計算
// ============================================================

/**
 * 計算日期相似度
 *
 * @description
 *   比較兩個日期字串的相似度
 *   - 同一天不同格式：相似度 1.0
 *   - 不同日期：根據天數差異計算
 *
 * @param value1 - 第一個日期字串
 * @param value2 - 第二個日期字串
 * @returns 相似度結果
 *
 * @example
 * ```typescript
 * dateSimilarity('2024-01-15', '15/01/2024')
 * // { similarity: 1, isDate: true, formatChange: 'YYYY-MM-DD → DD/MM/YYYY' }
 *
 * dateSimilarity('2024-01-15', '2024-01-16')
 * // { similarity: 0.997, isDate: true }
 * ```
 */
export function dateSimilarity(value1: string, value2: string): DateSimilarityResult {
  const date1 = parseDate(value1);
  const date2 = parseDate(value2);

  // 非日期情況
  if (!date1 || !date2) {
    return { similarity: 0, isDate: false };
  }

  // 檢查是否為同一日期（不同格式）
  if (isSameDate(date1.date, date2.date)) {
    return {
      similarity: 1,
      isDate: true,
      formatChange:
        date1.format !== date2.format ? `${date1.format} → ${date2.format}` : undefined,
    };
  }

  // 計算日期差異（以天為單位）
  const daysDiff = Math.abs(
    (date1.date.getTime() - date2.date.getTime()) / (1000 * 60 * 60 * 24)
  );

  // 日期差異在 1 年內，根據差異計算相似度
  if (daysDiff <= 365) {
    const similarity = Math.max(0, 1 - daysDiff / 365);
    return { similarity, isDate: true };
  }

  return { similarity: 0, isDate: true };
}

/**
 * 判斷是否可能為日期欄位
 *
 * @param value - 要檢查的值
 * @returns 是否可能為日期
 */
export function isPossiblyDate(value: string): boolean {
  return parseDate(value) !== null;
}

// ============================================================
// 模式檢測
// ============================================================

/**
 * 檢測日期格式轉換模式
 *
 * @description
 *   分析一組原始值-修正值配對，檢測是否存在一致的日期格式轉換
 *
 * @param pairs - 原始值與修正值配對陣列
 * @returns 格式轉換模式檢測結果
 *
 * @example
 * ```typescript
 * detectDateFormatPattern([
 *   { original: '2024-01-15', corrected: '15/01/2024' },
 *   { original: '2024-02-20', corrected: '20/02/2024' }
 * ])
 * // { hasPattern: true, fromFormat: 'YYYY-MM-DD', toFormat: 'DD/MM/YYYY' }
 * ```
 */
export function detectDateFormatPattern(
  pairs: Array<{ original: string; corrected: string }>
): DateFormatPattern {
  const formatPairs: Array<{ from: string; to: string }> = [];

  for (const pair of pairs) {
    const orig = parseDate(pair.original);
    const corr = parseDate(pair.corrected);

    // 兩者都是日期且為同一天
    if (orig && corr && isSameDate(orig.date, corr.date)) {
      formatPairs.push({ from: orig.format, to: corr.format });
    }
  }

  // 需要至少 2 對格式轉換才能確認模式
  if (formatPairs.length < 2) {
    return { hasPattern: false };
  }

  // 檢查格式轉換是否一致
  const firstFrom = formatPairs[0].from;
  const firstTo = formatPairs[0].to;

  const isConsistent = formatPairs.every((p) => p.from === firstFrom && p.to === firstTo);

  if (isConsistent && firstFrom !== firstTo) {
    return {
      hasPattern: true,
      fromFormat: firstFrom,
      toFormat: firstTo,
    };
  }

  return { hasPattern: false };
}

/**
 * 格式化日期為指定格式
 *
 * @param date - Date 對象
 * @param format - 目標格式
 * @returns 格式化後的字串
 */
export function formatDate(date: Date, format: string): string {
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');

  switch (format) {
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`;
    case 'DD/MM/YYYY':
      return `${day}/${month}/${year}`;
    case 'MM/DD/YYYY':
      return `${month}/${day}/${year}`;
    case 'YYYY/MM/DD':
      return `${year}/${month}/${day}`;
    case 'YYYYMMDD':
      return `${year}${month}${day}`;
    case 'DD-MM-YYYY':
      return `${day}-${month}-${year}`;
    case 'DD.MM.YYYY':
      return `${day}.${month}.${year}`;
    default:
      return `${year}-${month}-${day}`;
  }
}

/**
 * 獲取支援的日期格式列表
 */
export function getSupportedDateFormats(): string[] {
  return DATE_FORMATS.map((f) => f.format);
}
