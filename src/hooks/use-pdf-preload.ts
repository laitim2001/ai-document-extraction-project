/**
 * @fileoverview PDF 預載 Hook
 * @description
 *   提供 PDF 文件預載功能，在用戶實際瀏覽前預先載入文件，
 *   以減少等待時間並改善用戶體驗。
 *
 * @module src/hooks
 * @since Epic 13 - Story 13.1 (文件預覽組件與欄位高亮)
 * @lastModified 2025-01-02
 *
 * @features
 *   - PDF 文件預載入
 *   - 載入狀態追蹤
 *   - 錯誤處理
 *   - 快取管理
 *
 * @dependencies
 *   - pdfjs-dist
 */

'use client'

import * as React from 'react'
import { pdfjs } from 'react-pdf'

// ============================================================
// Types
// ============================================================

interface PreloadResult {
  /** 文件 URL */
  url: string
  /** 總頁數 */
  numPages: number
  /** 預載時間戳 */
  timestamp: number
}

interface UsePdfPreloadReturn {
  /** 預載 PDF 文件 */
  preload: (url: string) => Promise<PreloadResult | null>
  /** 檢查是否已預載 */
  isPreloaded: (url: string) => boolean
  /** 獲取預載結果 */
  getPreloadResult: (url: string) => PreloadResult | null
  /** 清除快取 */
  clearCache: (url?: string) => void
  /** 當前預載狀態 */
  isLoading: boolean
  /** 錯誤訊息 */
  error: Error | null
}

// ============================================================
// Constants
// ============================================================

/** 快取過期時間 (5 分鐘) */
const CACHE_EXPIRY_MS = 5 * 60 * 1000

/** 最大快取數量 */
const MAX_CACHE_SIZE = 10

// ============================================================
// Hook
// ============================================================

/**
 * PDF 預載 Hook
 *
 * @description
 *   預載 PDF 文件以提升瀏覽體驗。
 *   支援快取管理和錯誤處理。
 *
 * @returns 預載相關方法和狀態
 *
 * @example
 * ```typescript
 * const { preload, isPreloaded, getPreloadResult } = usePdfPreload();
 *
 * // 預載文件
 * await preload('/documents/invoice.pdf');
 *
 * // 檢查是否已預載
 * if (isPreloaded('/documents/invoice.pdf')) {
 *   const result = getPreloadResult('/documents/invoice.pdf');
 *   console.log(`文件共 ${result?.numPages} 頁`);
 * }
 * ```
 */
export function usePdfPreload(): UsePdfPreloadReturn {
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<Error | null>(null)
  const cacheRef = React.useRef<Map<string, PreloadResult>>(new Map())

  /**
   * 清理過期快取
   */
  const cleanExpiredCache = React.useCallback(() => {
    const now = Date.now()
    const cache = cacheRef.current

    for (const [url, result] of cache.entries()) {
      if (now - result.timestamp > CACHE_EXPIRY_MS) {
        cache.delete(url)
      }
    }

    // 如果快取超過上限，移除最舊的項目
    if (cache.size > MAX_CACHE_SIZE) {
      const entries = Array.from(cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)

      const toRemove = entries.slice(0, cache.size - MAX_CACHE_SIZE)
      toRemove.forEach(([url]) => cache.delete(url))
    }
  }, [])

  /**
   * 預載 PDF 文件
   */
  const preload = React.useCallback(
    async (url: string): Promise<PreloadResult | null> => {
      // 檢查快取
      const cached = cacheRef.current.get(url)
      if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY_MS) {
        return cached
      }

      setIsLoading(true)
      setError(null)

      try {
        // 使用 pdfjs 載入文件
        const loadingTask = pdfjs.getDocument(url)
        const pdf = await loadingTask.promise

        const result: PreloadResult = {
          url,
          numPages: pdf.numPages,
          timestamp: Date.now(),
        }

        // 清理過期快取
        cleanExpiredCache()

        // 儲存到快取
        cacheRef.current.set(url, result)

        setIsLoading(false)
        return result
      } catch (err) {
        const error = err instanceof Error ? err : new Error('PDF 預載失敗')
        setError(error)
        setIsLoading(false)
        return null
      }
    },
    [cleanExpiredCache]
  )

  /**
   * 檢查是否已預載
   */
  const isPreloaded = React.useCallback((url: string): boolean => {
    const cached = cacheRef.current.get(url)
    if (!cached) return false

    // 檢查是否過期
    return Date.now() - cached.timestamp < CACHE_EXPIRY_MS
  }, [])

  /**
   * 獲取預載結果
   */
  const getPreloadResult = React.useCallback(
    (url: string): PreloadResult | null => {
      const cached = cacheRef.current.get(url)
      if (!cached) return null

      // 檢查是否過期
      if (Date.now() - cached.timestamp > CACHE_EXPIRY_MS) {
        cacheRef.current.delete(url)
        return null
      }

      return cached
    },
    []
  )

  /**
   * 清除快取
   */
  const clearCache = React.useCallback((url?: string) => {
    if (url) {
      cacheRef.current.delete(url)
    } else {
      cacheRef.current.clear()
    }
  }, [])

  return {
    preload,
    isPreloaded,
    getPreloadResult,
    clearCache,
    isLoading,
    error,
  }
}
