/**
 * @fileoverview Debounce Hook
 * @description
 *   提供輸入防抖功能，用於搜尋輸入優化：
 *   - 防止過度頻繁的 API 呼叫
 *   - 支援自訂延遲時間
 *   - 支援泛型類型
 *
 * @module src/hooks/useDebounce
 * @since Epic 7 - Story 7.3 (Forwarder Filter)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - React useState, useEffect
 *
 * @related
 *   - src/components/dashboard/ForwarderMultiSelect.tsx - 搜尋防抖
 */

import * as React from 'react';

/**
 * 預設防抖延遲時間（毫秒）
 */
export const DEFAULT_DEBOUNCE_DELAY = 300;

/**
 * useDebounce Hook
 * @description 對值進行防抖處理，在指定延遲後才更新
 * @param value - 要防抖的值
 * @param delay - 延遲時間（毫秒），預設 300ms
 * @returns 防抖後的值
 * @example
 * ```typescript
 * const [searchTerm, setSearchTerm] = useState('');
 * const debouncedSearch = useDebounce(searchTerm, 300);
 *
 * useEffect(() => {
 *   // 只有在使用者停止輸入 300ms 後才會執行
 *   searchApi(debouncedSearch);
 * }, [debouncedSearch]);
 * ```
 */
export function useDebounce<T>(value: T, delay: number = DEFAULT_DEBOUNCE_DELAY): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  React.useEffect(() => {
    // 設定計時器
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // 清除計時器（如果值在延遲期間改變）
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * useDebouncedCallback Hook
 * @description 對回調函數進行防抖處理
 * @param callback - 要防抖的回調函數
 * @param delay - 延遲時間（毫秒），預設 300ms
 * @returns 防抖後的回調函數
 * @example
 * ```typescript
 * const handleSearch = useDebouncedCallback((term: string) => {
 *   searchApi(term);
 * }, 300);
 *
 * <input onChange={(e) => handleSearch(e.target.value)} />
 * ```
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number = DEFAULT_DEBOUNCE_DELAY
): (...args: Parameters<T>) => void {
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const callbackRef = React.useRef(callback);

  // 更新 callback ref
  React.useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // 清理計時器
  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return React.useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay]
  );
}
