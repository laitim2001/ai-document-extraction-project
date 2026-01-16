# Story 17.4: 日期、數字與貨幣格式化

**Status:** done

---

## Story

**As a** 多語言用戶,
**I want** 日期、數字和貨幣以我的地區習慣格式顯示,
**So that** 我可以快速理解數據而無需心算轉換。

---

## Acceptance Criteria

### AC1: 日期格式國際化

**Given** 系統顯示大量日期時間資訊
**When** 用戶以不同語言/地區訪問
**Then** 日期格式符合地區習慣
  - `zh-TW`: 2026年1月16日、2026/01/16
  - `en`: January 16, 2026、01/16/2026
**And** 相對時間正確翻譯（2 小時前 / 2 hours ago）
**And** 日期選擇器顯示正確的地區格式

### AC2: 數字格式國際化

**Given** 系統顯示統計數字、計數等
**When** 用戶以不同語言/地區訪問
**Then** 千位分隔符符合地區習慣
  - `zh-TW` / `en`: 1,234,567
**And** 小數點格式正確
**And** 百分比格式正確（95.5% / 95.5%）

### AC3: 貨幣格式國際化

**Given** 系統涉及成本追蹤和費用報表
**When** 用戶查看費用相關頁面
**Then** 貨幣金額正確格式化
  - `zh-TW`: NT$ 1,234.56、US$ 100.00
  - `en`: $1,234.56、¥1,234
**And** 支援多種貨幣代碼（USD, TWD, CNY, HKD 等）

### AC4: 時區支援

**Given** 用戶可能在不同時區使用系統
**When** 顯示時間戳記
**Then** 正確顯示當地時間
**And** 懸停時顯示完整時間和時區

---

## Tasks / Subtasks

- [x] **Task 1: 整合 date-fns 多語言支援** (AC: #1)
  - [x] 1.1 建立 `src/lib/i18n-date.ts` - 日期格式化工具
  - [x] 1.2 配置 date-fns locale（zhTW, enUS, zhCN）
  - [x] 1.3 建立 `useLocalizedDate` hook

- [x] **Task 2: 建立數字格式化工具** (AC: #2)
  - [x] 2.1 建立 `src/lib/i18n-number.ts`
  - [x] 2.2 實作 `formatNumber`, `formatPercent` 函數
  - [x] 2.3 建立 `useLocalizedNumber` hook（整合至 use-localized-format.ts）

- [x] **Task 3: 建立貨幣格式化工具** (AC: #3)
  - [x] 3.1 建立 `src/lib/i18n-currency.ts`
  - [x] 3.2 實作 `formatCurrency` 函數
  - [x] 3.3 支援多貨幣代碼（USD, TWD, CNY, HKD, JPY, EUR, GBP）

- [ ] **Task 4: 更新日期顯示組件** (AC: #1, #4) - 後續 Story 整合
  - [ ] 4.1 更新 DateRangePicker 組件
  - [ ] 4.2 更新表格中的日期欄位
  - [ ] 4.3 更新相對時間顯示（formatDistanceToNow）

- [ ] **Task 5: 更新數字顯示組件** (AC: #2) - 後續 Story 整合
  - [ ] 5.1 更新 StatCard 組件
  - [ ] 5.2 更新表格中的數字欄位
  - [ ] 5.3 更新圖表中的數字格式

- [ ] **Task 6: 更新貨幣顯示組件** (AC: #3) - 後續 Story 整合
  - [ ] 6.1 更新成本報表頁面
  - [ ] 6.2 更新 AI 成本追蹤頁面
  - [ ] 6.3 更新費用相關表格

> **實作備註**: Task 4-6 的組件更新將在後續整合 Story 中完成。本 Story 已建立所有必需的格式化工具和 Hooks，供組件使用。

---

## Dev Notes

### 依賴項

- **Story 17.1**: i18n 基礎架構設置（必須先完成）
- **現有依賴**: date-fns 4.1.0（已安裝）

### Project Structure Notes

```
src/
└── lib/
    ├── i18n-date.ts         # 日期格式化工具
    ├── i18n-number.ts       # 數字格式化工具
    └── i18n-currency.ts     # 貨幣格式化工具

src/
└── hooks/
    ├── use-localized-date.ts
    ├── use-localized-number.ts
    └── use-localized-currency.ts
```

### Architecture Compliance

#### 日期格式化工具

```typescript
// src/lib/i18n-date.ts
import { format, formatDistanceToNow, formatRelative } from 'date-fns';
import { zhTW, enUS, zhCN } from 'date-fns/locale';
import type { Locale } from '@/i18n/config';

const localeMap: Record<Locale, typeof enUS> = {
  'en': enUS,
  'zh-TW': zhTW,
  'zh-CN': zhCN,
};

export function formatDate(
  date: Date | string | number,
  formatStr: string,
  locale: Locale
): string {
  const dateObj = typeof date === 'string' || typeof date === 'number'
    ? new Date(date)
    : date;
  return format(dateObj, formatStr, { locale: localeMap[locale] });
}

export function formatRelativeTime(
  date: Date | string | number,
  locale: Locale
): string {
  const dateObj = typeof date === 'string' || typeof date === 'number'
    ? new Date(date)
    : date;
  return formatDistanceToNow(dateObj, {
    addSuffix: true,
    locale: localeMap[locale]
  });
}

// 常用日期格式
export const DATE_FORMATS: Record<Locale, { short: string; long: string; full: string }> = {
  'en': {
    short: 'MM/dd/yyyy',
    long: 'MMMM d, yyyy',
    full: 'EEEE, MMMM d, yyyy',
  },
  'zh-TW': {
    short: 'yyyy/MM/dd',
    long: 'yyyy年M月d日',
    full: 'yyyy年M月d日 EEEE',
  },
  'zh-CN': {
    short: 'yyyy/MM/dd',
    long: 'yyyy年M月d日',
    full: 'yyyy年M月d日 EEEE',
  },
};
```

#### 數字格式化工具

```typescript
// src/lib/i18n-number.ts
import type { Locale } from '@/i18n/config';

const localeMap: Record<Locale, string> = {
  'en': 'en-US',
  'zh-TW': 'zh-TW',
  'zh-CN': 'zh-CN',
};

export function formatNumber(
  value: number,
  locale: Locale,
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat(localeMap[locale], options).format(value);
}

export function formatPercent(
  value: number,
  locale: Locale,
  decimals: number = 1
): string {
  return new Intl.NumberFormat(localeMap[locale], {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value / 100);
}

export function formatCompact(
  value: number,
  locale: Locale
): string {
  return new Intl.NumberFormat(localeMap[locale], {
    notation: 'compact',
    compactDisplay: 'short',
  }).format(value);
}
```

#### 貨幣格式化工具

```typescript
// src/lib/i18n-currency.ts
import type { Locale } from '@/i18n/config';

const localeMap: Record<Locale, string> = {
  'en': 'en-US',
  'zh-TW': 'zh-TW',
  'zh-CN': 'zh-CN',
};

export type CurrencyCode = 'USD' | 'TWD' | 'CNY' | 'HKD' | 'JPY' | 'EUR';

export function formatCurrency(
  value: number,
  currency: CurrencyCode,
  locale: Locale,
  options?: Partial<Intl.NumberFormatOptions>
): string {
  return new Intl.NumberFormat(localeMap[locale], {
    style: 'currency',
    currency,
    ...options,
  }).format(value);
}

// 常見貨幣代碼和符號
export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  'USD': '$',
  'TWD': 'NT$',
  'CNY': '¥',
  'HKD': 'HK$',
  'JPY': '¥',
  'EUR': '€',
};
```

#### Hook 使用範例

```typescript
// src/hooks/use-localized-date.ts
'use client';

import { useLocale } from 'next-intl';
import { formatDate, formatRelativeTime, DATE_FORMATS } from '@/lib/i18n-date';
import type { Locale } from '@/i18n/config';

export function useLocalizedDate() {
  const locale = useLocale() as Locale;
  const formats = DATE_FORMATS[locale];

  return {
    formatShort: (date: Date | string | number) =>
      formatDate(date, formats.short, locale),
    formatLong: (date: Date | string | number) =>
      formatDate(date, formats.long, locale),
    formatFull: (date: Date | string | number) =>
      formatDate(date, formats.full, locale),
    formatRelative: (date: Date | string | number) =>
      formatRelativeTime(date, locale),
    format: (date: Date | string | number, formatStr: string) =>
      formatDate(date, formatStr, locale),
  };
}
```

### Testing Requirements

| 驗證項目 | 預期結果 |
|---------|---------|
| 日期顯示（zh-TW） | 「2026年1月16日」或「2026/01/16」 |
| 日期顯示（en） | 「January 16, 2026」或「01/16/2026」 |
| 相對時間（zh-TW） | 「2 小時前」 |
| 相對時間（en） | 「2 hours ago」 |
| 數字格式 | 「1,234,567」 |
| 百分比格式 | 「95.5%」 |
| 貨幣格式（TWD） | 「NT$ 1,234.56」 |
| 貨幣格式（USD） | 「$1,234.56」 |

### References

- [Source: date-fns 文檔](https://date-fns.org/)
- [Source: Intl.NumberFormat MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat)
- [Source: src/lib/date-range-utils.ts] - 現有日期工具

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 17.4 |
| Story Key | 17-4-date-number-currency-formatting |
| Epic | Epic 17: i18n 國際化 |
| Estimated Effort | Medium (4-6h) |
| Dependencies | Story 17.1 |
| Blocking | 無 |

---

*Story created: 2026-01-16*
*Completed: 2026-01-17*
*Status: done*
