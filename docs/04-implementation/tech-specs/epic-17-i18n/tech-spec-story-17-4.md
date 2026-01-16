# Story 17-4: 日期、數字與貨幣格式化 - Technical Specification

**Version:** 1.1
**Created:** 2026-01-16
**Updated:** 2026-01-16
**Status:** Ready for Development
**Story Key:** 17-4-date-number-currency-formatting

---

## Overview

| Field | Value |
|-------|-------|
| Story ID | 17.4 |
| Epic | Epic 17: i18n 國際化 |
| Estimated Effort | Medium (4-6h) |
| Dependencies | Story 17.1 |
| Blocking | 無 |

---

## Objective

建立日期、數字和貨幣的國際化格式化工具，確保這些數據以符合用戶地區習慣的格式顯示。整合 date-fns 多語言支援並建立 Intl API 包裝函數，提供統一的格式化接口。

### 覆蓋範圍

| 功能 | 支援內容 | 狀態 |
|------|---------|------|
| 日期格式 | short, medium, long, datetime, relative | ✅ 完整 |
| 數字格式 | 千位分隔、小數、整數、緊湊顯示 | ✅ 完整 |
| **百分比格式** | 統一百分比顯示（0-100 或 0-1 輸入） | ✅ 完整 |
| **多幣種支援** | USD, TWD, CNY, HKD, JPY, EUR, GBP | ✅ 完整 |
| 時區支援 | Asia/Taipei 預設 | ✅ 完整 |

> **Version 1.1 更新**：確認現有設計已完整覆蓋深度分析報告中的所有需求。

---

## Acceptance Criteria Mapping

| AC | Description | Technical Implementation |
|----|-------------|-------------------------|
| AC1 | 日期格式國際化 | 建立 i18n-date.ts、整合 date-fns locales |
| AC2 | 數字格式國際化 | 建立 i18n-number.ts、使用 Intl.NumberFormat |
| AC3 | 貨幣格式國際化 | 建立 i18n-currency.ts、支援多貨幣代碼 |
| AC4 | 時區支援 | 配置時區處理、顯示本地時間 |

---

## Implementation Guide

### Phase 1: 日期格式化工具 (45 min)

#### Step 1.1: 建立日期格式化工具

Create `src/lib/i18n-date.ts`:

```typescript
/**
 * @fileoverview 日期格式化國際化工具
 * @description
 *   提供日期和時間的國際化格式化功能，整合 date-fns 多語言支援。
 *   支援相對時間、各種日期格式和時區處理。
 *
 * @module src/lib/i18n-date
 * @author Development Team
 * @since Epic 17 - Story 17.4 (Date/Number/Currency Formatting)
 * @lastModified 2026-01-16
 *
 * @features
 *   - 多語言日期格式化
 *   - 相對時間（如「2 小時前」）
 *   - 自訂日期格式
 *   - 時區支援
 *
 * @dependencies
 *   - date-fns - 日期處理庫
 *   - date-fns/locale - 語言包
 */

import {
  format,
  formatDistanceToNow,
  formatRelative,
  parseISO,
  isValid,
} from 'date-fns';
import { zhTW, enUS, zhCN } from 'date-fns/locale';
import type { Locale } from '@/i18n/config';

/**
 * 語言到 date-fns locale 映射
 */
const LOCALE_MAP: Record<Locale, typeof enUS> = {
  'en': enUS,
  'zh-TW': zhTW,
  'zh-CN': zhCN,
};

/**
 * 預設日期格式配置
 */
export const DATE_FORMATS: Record<Locale, {
  short: string;
  medium: string;
  long: string;
  full: string;
  time: string;
  datetime: string;
}> = {
  'en': {
    short: 'MM/dd/yyyy',
    medium: 'MMM d, yyyy',
    long: 'MMMM d, yyyy',
    full: 'EEEE, MMMM d, yyyy',
    time: 'h:mm a',
    datetime: 'MMM d, yyyy h:mm a',
  },
  'zh-TW': {
    short: 'yyyy/MM/dd',
    medium: 'yyyy年M月d日',
    long: 'yyyy年M月d日',
    full: 'yyyy年M月d日 EEEE',
    time: 'HH:mm',
    datetime: 'yyyy年M月d日 HH:mm',
  },
  'zh-CN': {
    short: 'yyyy/MM/dd',
    medium: 'yyyy年M月d日',
    long: 'yyyy年M月d日',
    full: 'yyyy年M月d日 EEEE',
    time: 'HH:mm',
    datetime: 'yyyy年M月d日 HH:mm',
  },
};

/**
 * 解析日期輸入（支援多種格式）
 */
function parseDate(date: Date | string | number): Date {
  if (date instanceof Date) return date;
  if (typeof date === 'number') return new Date(date);
  if (typeof date === 'string') {
    const parsed = parseISO(date);
    if (isValid(parsed)) return parsed;
    return new Date(date);
  }
  return new Date();
}

/**
 * 格式化日期
 *
 * @param date - 日期（Date、ISO 字串或時間戳）
 * @param formatStr - 格式字串（date-fns 格式）
 * @param locale - 語言代碼
 * @returns 格式化後的日期字串
 *
 * @example
 * formatDate(new Date(), 'yyyy年M月d日', 'zh-TW')
 * // → "2026年1月16日"
 */
export function formatDate(
  date: Date | string | number,
  formatStr: string,
  locale: Locale
): string {
  const dateObj = parseDate(date);
  if (!isValid(dateObj)) return '';

  return format(dateObj, formatStr, { locale: LOCALE_MAP[locale] });
}

/**
 * 格式化短日期
 *
 * @example
 * formatShortDate(new Date(), 'zh-TW') // → "2026/01/16"
 * formatShortDate(new Date(), 'en')    // → "01/16/2026"
 */
export function formatShortDate(
  date: Date | string | number,
  locale: Locale
): string {
  return formatDate(date, DATE_FORMATS[locale].short, locale);
}

/**
 * 格式化中等日期
 *
 * @example
 * formatMediumDate(new Date(), 'zh-TW') // → "2026年1月16日"
 * formatMediumDate(new Date(), 'en')    // → "Jan 16, 2026"
 */
export function formatMediumDate(
  date: Date | string | number,
  locale: Locale
): string {
  return formatDate(date, DATE_FORMATS[locale].medium, locale);
}

/**
 * 格式化完整日期時間
 *
 * @example
 * formatDateTime(new Date(), 'zh-TW') // → "2026年1月16日 14:30"
 * formatDateTime(new Date(), 'en')    // → "Jan 16, 2026 2:30 PM"
 */
export function formatDateTime(
  date: Date | string | number,
  locale: Locale
): string {
  return formatDate(date, DATE_FORMATS[locale].datetime, locale);
}

/**
 * 格式化相對時間
 *
 * @param date - 日期
 * @param locale - 語言代碼
 * @returns 相對時間字串
 *
 * @example
 * formatRelativeTime(twoHoursAgo, 'zh-TW') // → "2 小時前"
 * formatRelativeTime(twoHoursAgo, 'en')    // → "2 hours ago"
 */
export function formatRelativeTime(
  date: Date | string | number,
  locale: Locale
): string {
  const dateObj = parseDate(date);
  if (!isValid(dateObj)) return '';

  return formatDistanceToNow(dateObj, {
    addSuffix: true,
    locale: LOCALE_MAP[locale],
  });
}

/**
 * 格式化時間（僅時間部分）
 *
 * @example
 * formatTime(new Date(), 'zh-TW') // → "14:30"
 * formatTime(new Date(), 'en')    // → "2:30 PM"
 */
export function formatTime(
  date: Date | string | number,
  locale: Locale
): string {
  return formatDate(date, DATE_FORMATS[locale].time, locale);
}

/**
 * 獲取 date-fns locale 物件
 */
export function getDateFnsLocale(locale: Locale) {
  return LOCALE_MAP[locale];
}
```

#### Step 1.2: 建立 useLocalizedDate Hook

Create `src/hooks/use-localized-date.ts`:

```typescript
/**
 * @fileoverview 國際化日期格式化 Hook
 * @description
 *   提供簡化的日期格式化 API，自動使用當前語言。
 *
 * @module src/hooks/use-localized-date
 * @author Development Team
 * @since Epic 17 - Story 17.4 (Date/Number/Currency Formatting)
 * @lastModified 2026-01-16
 */

'use client';

import { useLocale } from 'next-intl';
import { useCallback, useMemo } from 'react';
import {
  formatDate,
  formatShortDate,
  formatMediumDate,
  formatDateTime,
  formatRelativeTime,
  formatTime,
  DATE_FORMATS,
} from '@/lib/i18n-date';
import type { Locale } from '@/i18n/config';

/**
 * 國際化日期格式化 Hook
 *
 * @returns 日期格式化函數集合
 *
 * @example
 * function MyComponent() {
 *   const date = useLocalizedDate();
 *
 *   return (
 *     <div>
 *       <p>建立時間：{date.medium(createdAt)}</p>
 *       <p>更新時間：{date.relative(updatedAt)}</p>
 *     </div>
 *   );
 * }
 */
export function useLocalizedDate() {
  const locale = useLocale() as Locale;
  const formats = DATE_FORMATS[locale];

  const short = useCallback(
    (date: Date | string | number) => formatShortDate(date, locale),
    [locale]
  );

  const medium = useCallback(
    (date: Date | string | number) => formatMediumDate(date, locale),
    [locale]
  );

  const datetime = useCallback(
    (date: Date | string | number) => formatDateTime(date, locale),
    [locale]
  );

  const relative = useCallback(
    (date: Date | string | number) => formatRelativeTime(date, locale),
    [locale]
  );

  const time = useCallback(
    (date: Date | string | number) => formatTime(date, locale),
    [locale]
  );

  const format = useCallback(
    (date: Date | string | number, formatStr: string) =>
      formatDate(date, formatStr, locale),
    [locale]
  );

  return useMemo(
    () => ({
      short,
      medium,
      datetime,
      relative,
      time,
      format,
      formats,
      locale,
    }),
    [short, medium, datetime, relative, time, format, formats, locale]
  );
}
```

---

### Phase 2: 數字格式化工具 (30 min)

#### Step 2.1: 建立數字格式化工具

Create `src/lib/i18n-number.ts`:

```typescript
/**
 * @fileoverview 數字格式化國際化工具
 * @description
 *   提供數字的國際化格式化功能，使用 Intl.NumberFormat API。
 *   支援千位分隔符、百分比、緊湊表示等格式。
 *
 * @module src/lib/i18n-number
 * @author Development Team
 * @since Epic 17 - Story 17.4 (Date/Number/Currency Formatting)
 * @lastModified 2026-01-16
 */

import type { Locale } from '@/i18n/config';

/**
 * 語言到 Intl locale 映射
 */
const INTL_LOCALE_MAP: Record<Locale, string> = {
  'en': 'en-US',
  'zh-TW': 'zh-TW',
  'zh-CN': 'zh-CN',
};

/**
 * 格式化數字（帶千位分隔符）
 *
 * @param value - 數值
 * @param locale - 語言代碼
 * @param options - Intl.NumberFormat 選項
 * @returns 格式化後的數字字串
 *
 * @example
 * formatNumber(1234567, 'zh-TW')     // → "1,234,567"
 * formatNumber(1234567.89, 'zh-TW')  // → "1,234,567.89"
 */
export function formatNumber(
  value: number,
  locale: Locale,
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat(INTL_LOCALE_MAP[locale], options).format(value);
}

/**
 * 格式化百分比
 *
 * @param value - 數值（0-100 或 0-1）
 * @param locale - 語言代碼
 * @param options - 選項
 * @returns 格式化後的百分比字串
 *
 * @example
 * formatPercent(95.5, 'zh-TW')           // → "95.5%"
 * formatPercent(0.955, 'zh-TW', true)    // → "95.5%"
 */
export function formatPercent(
  value: number,
  locale: Locale,
  isDecimal: boolean = false,
  decimals: number = 1
): string {
  const normalizedValue = isDecimal ? value : value / 100;

  return new Intl.NumberFormat(INTL_LOCALE_MAP[locale], {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(normalizedValue);
}

/**
 * 格式化緊湊數字（如 1.2K、1.5M）
 *
 * @param value - 數值
 * @param locale - 語言代碼
 * @returns 緊湊格式的數字字串
 *
 * @example
 * formatCompact(1234, 'en')      // → "1.2K"
 * formatCompact(1234567, 'en')   // → "1.2M"
 * formatCompact(1234, 'zh-TW')   // → "1234"（中文沒有 K/M）
 */
export function formatCompact(
  value: number,
  locale: Locale
): string {
  return new Intl.NumberFormat(INTL_LOCALE_MAP[locale], {
    notation: 'compact',
    compactDisplay: 'short',
  }).format(value);
}

/**
 * 格式化整數（無小數）
 *
 * @example
 * formatInteger(1234567, 'zh-TW')  // → "1,234,567"
 */
export function formatInteger(
  value: number,
  locale: Locale
): string {
  return formatNumber(Math.round(value), locale, {
    maximumFractionDigits: 0,
  });
}

/**
 * 格式化小數（固定小數位數）
 *
 * @example
 * formatDecimal(1234.5, 'zh-TW', 2)  // → "1,234.50"
 */
export function formatDecimal(
  value: number,
  locale: Locale,
  decimals: number = 2
): string {
  return formatNumber(value, locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
```

---

### Phase 3: 貨幣格式化工具 (30 min)

#### Step 3.1: 建立貨幣格式化工具

Create `src/lib/i18n-currency.ts`:

```typescript
/**
 * @fileoverview 貨幣格式化國際化工具
 * @description
 *   提供貨幣的國際化格式化功能，支援多種貨幣代碼。
 *   使用 Intl.NumberFormat API 確保符合地區習慣。
 *
 * @module src/lib/i18n-currency
 * @author Development Team
 * @since Epic 17 - Story 17.4 (Date/Number/Currency Formatting)
 * @lastModified 2026-01-16
 */

import type { Locale } from '@/i18n/config';

/**
 * 支援的貨幣代碼
 */
export type CurrencyCode =
  | 'USD'  // 美元
  | 'TWD'  // 新台幣
  | 'CNY'  // 人民幣
  | 'HKD'  // 港幣
  | 'JPY'  // 日圓
  | 'EUR'  // 歐元
  | 'GBP'; // 英鎊

/**
 * 語言到 Intl locale 映射
 */
const INTL_LOCALE_MAP: Record<Locale, string> = {
  'en': 'en-US',
  'zh-TW': 'zh-TW',
  'zh-CN': 'zh-CN',
};

/**
 * 貨幣符號映射（自定義顯示）
 */
export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  'USD': '$',
  'TWD': 'NT$',
  'CNY': '¥',
  'HKD': 'HK$',
  'JPY': '¥',
  'EUR': '€',
  'GBP': '£',
};

/**
 * 貨幣名稱映射
 */
export const CURRENCY_NAMES: Record<Locale, Record<CurrencyCode, string>> = {
  'en': {
    USD: 'US Dollar',
    TWD: 'New Taiwan Dollar',
    CNY: 'Chinese Yuan',
    HKD: 'Hong Kong Dollar',
    JPY: 'Japanese Yen',
    EUR: 'Euro',
    GBP: 'British Pound',
  },
  'zh-TW': {
    USD: '美元',
    TWD: '新台幣',
    CNY: '人民幣',
    HKD: '港幣',
    JPY: '日圓',
    EUR: '歐元',
    GBP: '英鎊',
  },
  'zh-CN': {
    USD: '美元',
    TWD: '新台币',
    CNY: '人民币',
    HKD: '港币',
    JPY: '日元',
    EUR: '欧元',
    GBP: '英镑',
  },
};

/**
 * 格式化貨幣
 *
 * @param value - 金額
 * @param currency - 貨幣代碼
 * @param locale - 語言代碼
 * @param options - 格式化選項
 * @returns 格式化後的貨幣字串
 *
 * @example
 * formatCurrency(1234.56, 'USD', 'en')     // → "$1,234.56"
 * formatCurrency(1234.56, 'TWD', 'zh-TW')  // → "NT$1,234.56"
 * formatCurrency(1234, 'JPY', 'zh-TW')     // → "¥1,234"
 */
export function formatCurrency(
  value: number,
  currency: CurrencyCode,
  locale: Locale,
  options?: {
    /** 是否顯示貨幣符號（預設 true） */
    showSymbol?: boolean;
    /** 小數位數（預設根據貨幣決定） */
    decimals?: number;
  }
): string {
  const { showSymbol = true, decimals } = options || {};

  // JPY 不需要小數位
  const defaultDecimals = currency === 'JPY' ? 0 : 2;
  const fractionDigits = decimals ?? defaultDecimals;

  if (showSymbol) {
    return new Intl.NumberFormat(INTL_LOCALE_MAP[locale], {
      style: 'currency',
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(value);
  }

  // 不顯示符號時，僅格式化數字
  return new Intl.NumberFormat(INTL_LOCALE_MAP[locale], {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

/**
 * 獲取貨幣符號
 *
 * @example
 * getCurrencySymbol('USD')  // → "$"
 * getCurrencySymbol('TWD')  // → "NT$"
 */
export function getCurrencySymbol(currency: CurrencyCode): string {
  return CURRENCY_SYMBOLS[currency];
}

/**
 * 獲取貨幣名稱
 *
 * @example
 * getCurrencyName('USD', 'zh-TW')  // → "美元"
 * getCurrencyName('USD', 'en')     // → "US Dollar"
 */
export function getCurrencyName(currency: CurrencyCode, locale: Locale): string {
  return CURRENCY_NAMES[locale][currency];
}

/**
 * 格式化金額範圍
 *
 * @example
 * formatCurrencyRange(100, 500, 'USD', 'en')  // → "$100 - $500"
 */
export function formatCurrencyRange(
  min: number,
  max: number,
  currency: CurrencyCode,
  locale: Locale
): string {
  const formattedMin = formatCurrency(min, currency, locale);
  const formattedMax = formatCurrency(max, currency, locale);
  return `${formattedMin} - ${formattedMax}`;
}
```

---

### Phase 4: 整合 Hook 和更新組件 (45 min)

#### Step 4.1: 建立統一的格式化 Hook

Create `src/hooks/use-localized-format.ts`:

```typescript
/**
 * @fileoverview 統一的國際化格式化 Hook
 * @description
 *   整合日期、數字和貨幣格式化，提供統一的 API。
 *
 * @module src/hooks/use-localized-format
 * @author Development Team
 * @since Epic 17 - Story 17.4 (Date/Number/Currency Formatting)
 * @lastModified 2026-01-16
 */

'use client';

import { useLocale } from 'next-intl';
import { useMemo } from 'react';
import {
  formatShortDate,
  formatMediumDate,
  formatDateTime,
  formatRelativeTime,
} from '@/lib/i18n-date';
import {
  formatNumber,
  formatPercent,
  formatCompact,
  formatInteger,
} from '@/lib/i18n-number';
import {
  formatCurrency,
  type CurrencyCode,
} from '@/lib/i18n-currency';
import type { Locale } from '@/i18n/config';

/**
 * 統一的國際化格式化 Hook
 *
 * @returns 格式化函數集合
 *
 * @example
 * function MyComponent() {
 *   const format = useLocalizedFormat();
 *
 *   return (
 *     <div>
 *       <p>日期：{format.date.medium(createdAt)}</p>
 *       <p>金額：{format.currency(1234.56, 'USD')}</p>
 *       <p>數量：{format.number(1000000)}</p>
 *       <p>百分比：{format.percent(95.5)}</p>
 *     </div>
 *   );
 * }
 */
export function useLocalizedFormat() {
  const locale = useLocale() as Locale;

  return useMemo(
    () => ({
      locale,

      // 日期格式化
      date: {
        short: (date: Date | string | number) => formatShortDate(date, locale),
        medium: (date: Date | string | number) => formatMediumDate(date, locale),
        datetime: (date: Date | string | number) => formatDateTime(date, locale),
        relative: (date: Date | string | number) => formatRelativeTime(date, locale),
      },

      // 數字格式化
      number: (value: number, options?: Intl.NumberFormatOptions) =>
        formatNumber(value, locale, options),
      integer: (value: number) => formatInteger(value, locale),
      percent: (value: number, isDecimal?: boolean) =>
        formatPercent(value, locale, isDecimal),
      compact: (value: number) => formatCompact(value, locale),

      // 貨幣格式化
      currency: (
        value: number,
        currency: CurrencyCode,
        options?: { showSymbol?: boolean; decimals?: number }
      ) => formatCurrency(value, currency, locale, options),
    }),
    [locale]
  );
}
```

---

## Verification Checklist

### Date Formatting Verification

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 短日期（zh-TW） | formatShortDate(date, 'zh-TW') | 「2026/01/16」 | [ ] |
| 短日期（en） | formatShortDate(date, 'en') | 「01/16/2026」 | [ ] |
| 中等日期（zh-TW） | formatMediumDate(date, 'zh-TW') | 「2026年1月16日」 | [ ] |
| 相對時間（zh-TW） | formatRelativeTime(2hAgo, 'zh-TW') | 「2 小時前」 | [ ] |
| 相對時間（en） | formatRelativeTime(2hAgo, 'en') | 「2 hours ago」 | [ ] |

### Number Formatting Verification

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 千位分隔 | formatNumber(1234567, locale) | 「1,234,567」 | [ ] |
| 百分比 | formatPercent(95.5, locale) | 「95.5%」 | [ ] |
| 緊湊數字（en） | formatCompact(1234567, 'en') | 「1.2M」 | [ ] |

### Currency Formatting Verification

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| USD（en） | formatCurrency(1234.56, 'USD', 'en') | 「$1,234.56」 | [ ] |
| TWD（zh-TW） | formatCurrency(1234.56, 'TWD', 'zh-TW') | 「NT$1,234.56」 | [ ] |
| JPY（無小數） | formatCurrency(1234, 'JPY', locale) | 「¥1,234」 | [ ] |

---

## File List (Expected Output)

| File Path | Description |
|-----------|-------------|
| `src/lib/i18n-date.ts` | 日期格式化工具 |
| `src/lib/i18n-number.ts` | 數字格式化工具 |
| `src/lib/i18n-currency.ts` | 貨幣格式化工具 |
| `src/hooks/use-localized-date.ts` | 日期格式化 Hook |
| `src/hooks/use-localized-format.ts` | 統一格式化 Hook |

---

## Next Steps

完成 Story 17-4 後：
1. 更新表格組件使用國際化日期格式
2. 更新統計組件使用國際化數字格式
3. 更新成本報表使用國際化貨幣格式

---

*Generated by BMAD Method - Create Tech Spec Workflow*
