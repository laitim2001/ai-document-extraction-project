/**
 * @fileoverview Debounce Hook
 * @description
 *   提供值的防抖處理，用於搜尋輸入等場景。
 *   延遲更新值直到指定時間內沒有新的變化。
 *
 * @module src/hooks/use-debounce
 * @author Development Team
 * @since Epic 1 - Story 1.3 (User List & Search)
 * @lastModified 2025-12-18
 *
 * @example
 *   const [searchTerm, setSearchTerm] = useState('')
 *   const debouncedSearchTerm = useDebounce(searchTerm, 300)
 *   // debouncedSearchTerm 會在 searchTerm 停止變化 300ms 後更新
 */

import { useState, useEffect } from 'react'

/**
 * Debounce Hook - 防抖處理
 *
 * @description
 *   延遲值的更新直到指定時間內沒有新的變化。
 *   常用於搜尋輸入防抖，減少 API 請求頻率。
 *
 * @template T - 值的類型
 * @param value - 要進行防抖處理的值
 * @param delay - 延遲時間（毫秒）
 * @returns 防抖後的值
 *
 * @example
 *   // 搜尋輸入防抖
 *   const [query, setQuery] = useState('')
 *   const debouncedQuery = useDebounce(query, 300)
 *
 *   useEffect(() => {
 *     // 只有在用戶停止輸入 300ms 後才會執行搜尋
 *     searchUsers(debouncedQuery)
 *   }, [debouncedQuery])
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    // 設置定時器，在 delay 毫秒後更新 debouncedValue
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    // 清理函數：如果 value 或 delay 變化，清除之前的定時器
    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}
