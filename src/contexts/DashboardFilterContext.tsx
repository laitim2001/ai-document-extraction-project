'use client';

/**
 * @fileoverview Dashboard Filter Context
 * @description
 *   統一的儀表板篩選器 Context，整合：
 *   - 日期範圍篩選（繼承自 Story 7.2）
 *   - 貨代商篩選（Story 7.3）
 *   - URL 參數同步（支援書籤和分享連結）
 *
 * @module src/contexts/DashboardFilterContext
 * @since Epic 7 - Story 7.3 (Forwarder Filter)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @/types/date-range - 日期範圍類型
 *   - @/types/dashboard-filter - Dashboard 篩選器類型
 *   - @/types/forwarder-filter - Forwarder 篩選器類型
 *   - @/lib/date-range-utils - 日期範圍工具
 *
 * @related
 *   - src/contexts/DateRangeContext.tsx - 原始日期範圍 Context
 *   - src/components/dashboard/DashboardFilters.tsx - 篩選器 UI
 */

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  type DateRange,
  type PresetRange,
  DEFAULT_PRESET,
} from '@/types/date-range';
import {
  type DashboardFilterContextType,
  type DashboardFilterParams,
  FILTER_URL_PARAMS,
} from '@/types/dashboard-filter';
import {
  type ForwarderOption,
  type ForwarderFilterMode,
} from '@/types/forwarder-filter';
import {
  getDateRangeFromPreset,
  getDefaultDateRange,
  validateDateRange,
  formatISODate,
  parseISODate,
  isValidPreset,
} from '@/lib/date-range-utils';

// ============================================================
// Context 定義
// ============================================================

const DashboardFilterContext = React.createContext<DashboardFilterContextType | null>(null);

// ============================================================
// Provider Props
// ============================================================

interface DashboardFilterProviderProps {
  children: React.ReactNode;
  /** 是否同步 URL（預設為 true） */
  syncUrl?: boolean;
  /** 初始貨代商列表（可選） */
  initialForwarders?: ForwarderOption[];
}

// ============================================================
// URL 解析工具
// ============================================================

/**
 * 從 URL 解析篩選器參數
 */
function parseFiltersFromUrl(searchParams: URLSearchParams): DashboardFilterParams {
  return {
    range: searchParams.get(FILTER_URL_PARAMS.RANGE) as PresetRange | 'custom' | undefined,
    from: searchParams.get(FILTER_URL_PARAMS.FROM) || undefined,
    to: searchParams.get(FILTER_URL_PARAMS.TO) || undefined,
    forwarders: searchParams.get(FILTER_URL_PARAMS.FORWARDERS) || undefined,
  };
}

/**
 * 從 URL 參數解析日期範圍
 */
function parseDateRangeFromParams(params: DashboardFilterParams): DateRange {
  // 如果有有效的 preset 參數
  if (params.range && params.range !== 'custom' && isValidPreset(params.range)) {
    return getDateRangeFromPreset(params.range);
  }

  // 如果有自訂日期範圍
  if (params.from && params.to) {
    const startDate = parseISODate(params.from);
    const endDate = parseISODate(params.to);

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

  return getDefaultDateRange();
}

/**
 * 從 URL 參數解析貨代商 IDs
 */
function parseForwarderIdsFromParams(params: DashboardFilterParams): string[] {
  if (!params.forwarders) return [];
  return params.forwarders.split(',').filter(Boolean);
}

// ============================================================
// Provider 實作
// ============================================================

/**
 * DashboardFilterProvider
 * @description 提供統一的儀表板篩選器狀態管理
 */
export function DashboardFilterProvider({
  children,
  syncUrl = true,
  initialForwarders = [],
}: DashboardFilterProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 狀態初始化
  const [isLoading, setIsLoading] = React.useState(true);
  const [dateRange, setDateRangeState] = React.useState<DateRange>(() => {
    if (syncUrl && searchParams) {
      const params = parseFiltersFromUrl(searchParams);
      return parseDateRangeFromParams(params);
    }
    return getDefaultDateRange();
  });

  const [selectedForwarderIds, setSelectedForwarderIdsState] = React.useState<string[]>(() => {
    if (syncUrl && searchParams) {
      const params = parseFiltersFromUrl(searchParams);
      return parseForwarderIdsFromParams(params);
    }
    return [];
  });

  // Note: Setters are intentionally kept for future use (e.g., loading forwarders from API)
  const [availableForwarders, _setAvailableForwarders] = React.useState<ForwarderOption[]>(initialForwarders);
  const [forwarderMode, setForwarderModeState] = React.useState<ForwarderFilterMode>('multiple');
  const [isForwardersLoading, _setIsForwardersLoading] = React.useState(false);

  // 初始化完成
  React.useEffect(() => {
    setIsLoading(false);
  }, []);

  // 監聽 URL 變更
  React.useEffect(() => {
    if (syncUrl && searchParams) {
      const params = parseFiltersFromUrl(searchParams);
      setDateRangeState(parseDateRangeFromParams(params));
      setSelectedForwarderIdsState(parseForwarderIdsFromParams(params));
    }
  }, [searchParams, syncUrl]);

  /**
   * 更新 URL 參數
   */
  const updateUrl = React.useCallback(
    (newDateRange: DateRange, newForwarderIds: string[]) => {
      if (!syncUrl) return;

      const newParams = new URLSearchParams(searchParams?.toString() || '');

      // 清除舊參數
      newParams.delete(FILTER_URL_PARAMS.RANGE);
      newParams.delete(FILTER_URL_PARAMS.FROM);
      newParams.delete(FILTER_URL_PARAMS.TO);
      newParams.delete(FILTER_URL_PARAMS.FORWARDERS);

      // 設定日期範圍參數
      if (newDateRange.preset && newDateRange.preset !== 'custom') {
        newParams.set(FILTER_URL_PARAMS.RANGE, newDateRange.preset);
      } else {
        newParams.set(FILTER_URL_PARAMS.FROM, formatISODate(newDateRange.startDate));
        newParams.set(FILTER_URL_PARAMS.TO, formatISODate(newDateRange.endDate));
      }

      // 設定貨代商參數
      if (newForwarderIds.length > 0) {
        newParams.set(FILTER_URL_PARAMS.FORWARDERS, newForwarderIds.join(','));
      }

      const queryString = newParams.toString();
      router.push(`${pathname}${queryString ? `?${queryString}` : ''}`, { scroll: false });
    },
    [syncUrl, searchParams, router, pathname]
  );

  // ============================================================
  // Date Range Actions
  // ============================================================

  const setPreset = React.useCallback(
    (preset: PresetRange) => {
      const range = getDateRangeFromPreset(preset);
      setDateRangeState(range);
      updateUrl(range, selectedForwarderIds);
    },
    [selectedForwarderIds, updateUrl]
  );

  const setCustomRange = React.useCallback(
    (from: Date, to: Date) => {
      const validation = validateDateRange(from, to);
      if (!validation.isValid) {
        console.error('Invalid date range:', validation.error);
        return;
      }

      const range: DateRange = {
        startDate: from,
        endDate: to,
        preset: 'custom',
      };
      setDateRangeState(range);
      updateUrl(range, selectedForwarderIds);
    },
    [selectedForwarderIds, updateUrl]
  );

  const resetDateRange = React.useCallback(() => {
    const defaultRange = getDefaultDateRange();
    setDateRangeState(defaultRange);
    updateUrl(defaultRange, selectedForwarderIds);
  }, [selectedForwarderIds, updateUrl]);

  // ============================================================
  // Forwarder Filter Actions
  // ============================================================

  const setSelectedForwarders = React.useCallback(
    (ids: string[]) => {
      setSelectedForwarderIdsState(ids);
      updateUrl(dateRange, ids);
    },
    [dateRange, updateUrl]
  );

  const toggleForwarder = React.useCallback(
    (id: string) => {
      const newIds = selectedForwarderIds.includes(id)
        ? selectedForwarderIds.filter((fid) => fid !== id)
        : [...selectedForwarderIds, id];
      setSelectedForwarders(newIds);
    },
    [selectedForwarderIds, setSelectedForwarders]
  );

  const selectAllForwarders = React.useCallback(() => {
    const allIds = availableForwarders.map((f) => f.id);
    setSelectedForwarders(allIds);
  }, [availableForwarders, setSelectedForwarders]);

  const clearForwarderSelection = React.useCallback(() => {
    setSelectedForwarders([]);
  }, [setSelectedForwarders]);

  const setForwarderMode = React.useCallback((mode: ForwarderFilterMode) => {
    setForwarderModeState(mode);
  }, []);

  // ============================================================
  // Combined Actions
  // ============================================================

  const resetAllFilters = React.useCallback(() => {
    const defaultRange = getDefaultDateRange();
    setDateRangeState(defaultRange);
    setSelectedForwarderIdsState([]);
    updateUrl(defaultRange, []);
  }, [updateUrl]);

  const updateFromParams = React.useCallback(
    (params: DashboardFilterParams) => {
      const newDateRange = parseDateRangeFromParams(params);
      const newForwarderIds = parseForwarderIdsFromParams(params);
      setDateRangeState(newDateRange);
      setSelectedForwarderIdsState(newForwarderIds);
      updateUrl(newDateRange, newForwarderIds);
    },
    [updateUrl]
  );

  // ============================================================
  // Computed Values
  // ============================================================

  const queryString = React.useMemo(() => {
    const params = new URLSearchParams();

    if (dateRange.preset && dateRange.preset !== 'custom') {
      params.set(FILTER_URL_PARAMS.RANGE, dateRange.preset);
    } else {
      params.set(FILTER_URL_PARAMS.FROM, formatISODate(dateRange.startDate));
      params.set(FILTER_URL_PARAMS.TO, formatISODate(dateRange.endDate));
    }

    if (selectedForwarderIds.length > 0) {
      params.set(FILTER_URL_PARAMS.FORWARDERS, selectedForwarderIds.join(','));
    }

    return params.toString();
  }, [dateRange, selectedForwarderIds]);

  const hasActiveFilters = React.useMemo(() => {
    const isDefaultDateRange = dateRange.preset === DEFAULT_PRESET;
    const hasForwarderFilter = selectedForwarderIds.length > 0;
    return !isDefaultDateRange || hasForwarderFilter;
  }, [dateRange.preset, selectedForwarderIds.length]);

  const getSelectedForwarders = React.useCallback(() => {
    return availableForwarders.filter((f) => selectedForwarderIds.includes(f.id));
  }, [availableForwarders, selectedForwarderIds]);

  const validation = React.useMemo(() => {
    return validateDateRange(dateRange.startDate, dateRange.endDate);
  }, [dateRange]);

  // ============================================================
  // Context Value
  // ============================================================

  const value = React.useMemo<DashboardFilterContextType>(
    () => ({
      // Date Range State
      preset: dateRange.preset || DEFAULT_PRESET,
      dateRange,
      isCustomRange: dateRange.preset === 'custom',
      validation,

      // Forwarder Filter State
      selectedForwarderIds,
      availableForwarders,
      forwarderMode,
      isForwardersLoading,

      // Date Range Actions
      setPreset,
      setCustomRange,
      resetDateRange,

      // Forwarder Filter Actions
      setSelectedForwarders,
      toggleForwarder,
      selectAllForwarders,
      clearForwarderSelection,
      setForwarderMode,

      // Combined Actions
      resetAllFilters,
      updateFromParams,

      // Computed Values
      queryString,
      hasActiveFilters,
      getSelectedForwarders,
    }),
    [
      dateRange,
      validation,
      selectedForwarderIds,
      availableForwarders,
      forwarderMode,
      isForwardersLoading,
      setPreset,
      setCustomRange,
      resetDateRange,
      setSelectedForwarders,
      toggleForwarder,
      selectAllForwarders,
      clearForwarderSelection,
      setForwarderMode,
      resetAllFilters,
      updateFromParams,
      queryString,
      hasActiveFilters,
      getSelectedForwarders,
    ]
  );

  // 載入中時返回 null 或載入狀態
  if (isLoading) {
    return (
      <DashboardFilterContext.Provider value={value}>
        {children}
      </DashboardFilterContext.Provider>
    );
  }

  return (
    <DashboardFilterContext.Provider value={value}>
      {children}
    </DashboardFilterContext.Provider>
  );
}

// ============================================================
// Hooks
// ============================================================

/**
 * useDashboardFilter Hook
 * @description 取得 Dashboard 篩選器 Context
 * @throws 如果在 DashboardFilterProvider 外部使用會拋出錯誤
 */
export function useDashboardFilter(): DashboardFilterContextType {
  const context = React.useContext(DashboardFilterContext);

  if (!context) {
    throw new Error('useDashboardFilter must be used within a DashboardFilterProvider');
  }

  return context;
}

/**
 * useDashboardFilterOptional Hook
 * @description 取得 Dashboard 篩選器 Context，如果不在 Provider 內則返回 null
 */
export function useDashboardFilterOptional(): DashboardFilterContextType | null {
  return React.useContext(DashboardFilterContext);
}

/**
 * useSetAvailableForwarders Hook
 * @description 用於設定可用貨代商列表（通常在載入貨代商列表後調用）
 */
export function useSetAvailableForwarders(): (forwarders: ForwarderOption[]) => void {
  const context = React.useContext(DashboardFilterContext);

  if (!context) {
    throw new Error('useSetAvailableForwarders must be used within a DashboardFilterProvider');
  }

  // 這個 hook 需要透過 context 暴露 setter，暫時返回空函數
  // TODO: 在 context 中添加 setAvailableForwarders 方法
  return React.useCallback(() => {
    console.warn('setAvailableForwarders is not yet implemented in context');
  }, []);
}
