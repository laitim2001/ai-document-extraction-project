'use client';

/**
 * @fileoverview 日期範圍 Context
 * @description
 *   提供全域日期範圍狀態管理，支援：
 *   - URL 參數同步（支援書籤和分享連結）
 *   - 預設範圍快速選擇
 *   - 自訂日期範圍
 *   - 驗證和錯誤處理
 *
 * @module src/contexts/DateRangeContext
 * @since Epic 7 - Story 7.2 (時間範圍篩選器)
 *
 * @dependencies
 *   - @/types/date-range - 日期範圍類型
 *   - @/lib/date-range-utils - 日期範圍工具
 *   - @/lib/url-params - URL 參數工具
 */

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  type DateRange,
  type DateRangeState,
  type PresetRange,
} from '@/types/date-range';
import {
  getDateRangeFromPreset,
  getDefaultDateRange,
  validateDateRange,
} from '@/lib/date-range-utils';
import {
  parseDateRangeFromUrl,
  updateUrlSearchParams,
} from '@/lib/url-params';

// ============================================================
// Context 定義
// ============================================================

const DateRangeContext = React.createContext<DateRangeState | null>(null);

// ============================================================
// Provider Props
// ============================================================

interface DateRangeProviderProps {
  children: React.ReactNode;
  /** 是否同步 URL（預設為 true） */
  syncUrl?: boolean;
  /** 初始日期範圍（如果 URL 沒有參數時使用） */
  initialRange?: DateRange;
}

// ============================================================
// Provider 實作
// ============================================================

/**
 * DateRangeProvider
 * @description 提供日期範圍狀態管理的 Context Provider
 */
export function DateRangeProvider({
  children,
  syncUrl = true,
  initialRange,
}: DateRangeProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = React.useState(true);

  // 從 URL 或初始值初始化日期範圍
  const [dateRange, setDateRangeState] = React.useState<DateRange>(() => {
    if (syncUrl && searchParams) {
      return parseDateRangeFromUrl(searchParams);
    }
    return initialRange || getDefaultDateRange();
  });

  // 初始化完成後設定 loading 為 false
  React.useEffect(() => {
    setIsLoading(false);
  }, []);

  // 當 URL 參數變更時同步日期範圍
  React.useEffect(() => {
    if (syncUrl && searchParams) {
      const urlRange = parseDateRangeFromUrl(searchParams);
      setDateRangeState(urlRange);
    }
  }, [searchParams, syncUrl]);

  /**
   * 設定日期範圍
   * @param range - 新的日期範圍
   */
  const setDateRange = React.useCallback(
    (range: DateRange) => {
      // 驗證日期範圍
      const validation = validateDateRange(range.startDate, range.endDate);
      if (!validation.isValid) {
        console.error('Invalid date range:', validation.error);
        return;
      }

      setDateRangeState(range);

      // 同步到 URL
      if (syncUrl && searchParams) {
        const newParams = updateUrlSearchParams(searchParams, range);
        router.push(`${pathname}?${newParams}`, { scroll: false });
      }
    },
    [syncUrl, searchParams, router, pathname]
  );

  /**
   * 設定預設範圍
   * @param preset - 預設範圍類型
   */
  const setPreset = React.useCallback(
    (preset: PresetRange) => {
      const range = getDateRangeFromPreset(preset);
      setDateRange(range);
    },
    [setDateRange]
  );

  /**
   * 重置為預設值
   */
  const reset = React.useCallback(() => {
    const defaultRange = getDefaultDateRange();
    setDateRange(defaultRange);
  }, [setDateRange]);

  // Context 值
  const value = React.useMemo<DateRangeState>(
    () => ({
      dateRange,
      setDateRange,
      setPreset,
      reset,
      isLoading,
    }),
    [dateRange, setDateRange, setPreset, reset, isLoading]
  );

  return (
    <DateRangeContext.Provider value={value}>
      {children}
    </DateRangeContext.Provider>
  );
}

// ============================================================
// Hook
// ============================================================

/**
 * useDateRange Hook
 * @description 取得日期範圍 Context
 * @throws 如果在 DateRangeProvider 外部使用會拋出錯誤
 */
export function useDateRange(): DateRangeState {
  const context = React.useContext(DateRangeContext);

  if (!context) {
    throw new Error('useDateRange must be used within a DateRangeProvider');
  }

  return context;
}

// ============================================================
// 可選的獨立 Hook（不強制使用 Provider）
// ============================================================

/**
 * useDateRangeOptional Hook
 * @description 取得日期範圍 Context，如果不在 Provider 內則返回 null
 */
export function useDateRangeOptional(): DateRangeState | null {
  return React.useContext(DateRangeContext);
}
