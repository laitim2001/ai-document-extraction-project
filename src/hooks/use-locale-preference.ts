/**
 * @fileoverview 語言偏好管理 Hook
 * @description
 *   管理用戶語言偏好，支援 LocalStorage 和資料庫雙重持久化。
 *   優先級：資料庫 > LocalStorage > 瀏覽器語言 > 預設語言。
 *
 * @module src/hooks/use-locale-preference
 * @author Development Team
 * @since Epic 17 - Story 17.5 (Language Preference Settings)
 * @lastModified 2026-01-17
 *
 * @features
 *   - LocalStorage 讀寫
 *   - 資料庫同步（已登入用戶）
 *   - 優先級判斷
 *
 * @related
 *   - src/i18n/config.ts - 語言配置
 *   - src/components/features/locale/LocaleSwitcher.tsx - 語言切換組件
 *   - src/app/api/v1/users/me/locale/route.ts - 語言偏好 API
 */

'use client'

import { useCallback, useState } from 'react'
import { useSession } from 'next-auth/react'
import type { Locale } from '@/i18n/config'

/** LocalStorage 儲存鍵 */
const LOCALE_STORAGE_KEY = 'preferred-locale'

/**
 * 語言偏好管理 Hook 返回值
 */
interface UseLocalePreferenceReturn {
  /** 獲取語言偏好 */
  getLocalePreference: () => Locale | null
  /** 設置語言偏好 */
  setLocalePreference: (locale: Locale) => Promise<void>
  /** 清除語言偏好（恢復預設） */
  clearLocalePreference: () => void
  /** 是否正在載入 */
  isLoading: boolean
  /** 錯誤訊息 */
  error: string | null
}

/**
 * 語言偏好管理 Hook
 *
 * @description
 *   提供語言偏好的讀取、設置和清除功能。
 *   支援 LocalStorage 和資料庫雙重持久化。
 *
 * @returns {UseLocalePreferenceReturn} Hook 返回值
 *
 * @example
 * ```typescript
 * const { getLocalePreference, setLocalePreference, isLoading } = useLocalePreference();
 *
 * // 獲取偏好
 * const preference = getLocalePreference();
 *
 * // 設置偏好
 * await setLocalePreference('zh-TW');
 * ```
 */
export function useLocalePreference(): UseLocalePreferenceReturn {
  const { data: session, update: updateSession } = useSession()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * 獲取語言偏好
   *
   * 優先級：
   * 1. 資料庫偏好（已登入）
   * 2. LocalStorage
   * 3. null（使用瀏覽器偵測）
   */
  const getLocalePreference = useCallback((): Locale | null => {
    // 1. 優先使用資料庫偏好（已登入）
    if (session?.user?.preferredLocale) {
      return session.user.preferredLocale as Locale
    }

    // 2. 使用 LocalStorage
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
      if (stored) return stored as Locale
    }

    return null
  }, [session])

  /**
   * 設置語言偏好
   *
   * 同時保存到 LocalStorage 和資料庫（如果已登入）
   */
  const setLocalePreference = useCallback(
    async (locale: Locale) => {
      setIsLoading(true)
      setError(null)

      try {
        // 1. 保存到 LocalStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem(LOCALE_STORAGE_KEY, locale)
        }

        // 2. 如果已登入，保存到資料庫
        if (session?.user) {
          const response = await fetch('/api/v1/users/me/locale', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ locale }),
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(errorData.detail || 'Failed to save locale preference')
          }

          // 更新 session（這會觸發 session callback 重新獲取最新資料）
          await updateSession()
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save locale preference'
        setError(message)
        console.error('Failed to save locale preference:', err)
      } finally {
        setIsLoading(false)
      }
    },
    [session, updateSession]
  )

  /**
   * 清除語言偏好（恢復預設）
   */
  const clearLocalePreference = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(LOCALE_STORAGE_KEY)
    }
  }, [])

  return {
    getLocalePreference,
    setLocalePreference,
    clearLocalePreference,
    isLoading,
    error,
  }
}
