/**
 * @fileoverview 國際化 Toast 通知 Hook
 * @description
 *   提供國際化的 Toast 通知功能，自動使用當前語言的翻譯。
 *   整合 sonner toast 和 next-intl 翻譯系統。
 *
 * @module src/hooks/use-localized-toast
 * @author Development Team
 * @since Epic 17 - Story 17.3 (Validation Internationalization)
 * @lastModified 2026-01-17
 *
 * @features
 *   - 自動獲取當前語言翻譯
 *   - 預設 Toast 類型（success, error, saved 等）
 *   - 自定義 Toast 支援
 *   - 網路錯誤處理
 *
 * @dependencies
 *   - sonner - Toast 通知組件
 *   - next-intl - 國際化框架
 *
 * @related
 *   - messages/{locale}/common.json - Toast 翻譯（toast 區塊）
 *   - messages/{locale}/errors.json - 錯誤訊息翻譯
 */

'use client'

import { useTranslations } from 'next-intl'
import { useCallback } from 'react'
import { toast as sonnerToast } from 'sonner'

/**
 * Toast 類型
 */
type ToastType = 'success' | 'error' | 'info' | 'warning'

/**
 * Toast 選項
 */
interface ToastOptions {
  /** 自定義描述（覆蓋預設翻譯） */
  description?: string
  /** 持續時間（毫秒） */
  duration?: number
  /** 操作按鈕 */
  action?: {
    label: string
    onClick: () => void
  }
}

/**
 * 國際化 Toast 通知 Hook 返回類型
 */
interface UseLocalizedToastReturn {
  /** 操作成功 */
  success: (options?: ToastOptions) => void
  /** 操作失敗 */
  error: (options?: ToastOptions) => void
  /** 已保存 */
  saved: (options?: ToastOptions) => void
  /** 已刪除 */
  deleted: (options?: ToastOptions) => void
  /** 已更新 */
  updated: (options?: ToastOptions) => void
  /** 已建立 */
  created: (options?: ToastOptions) => void
  /** 已複製 */
  copied: (options?: ToastOptions) => void
  /** 網路錯誤 */
  networkError: () => void
  /** 認證過期 */
  sessionExpired: () => void
  /** 自定義 Toast */
  custom: (
    type: ToastType,
    title: string,
    options?: Omit<ToastOptions, 'description'> & { description?: string }
  ) => void
  /** 顯示 API 錯誤（從 ProblemDetails 格式解析） */
  apiError: (error: { title?: string; detail?: string }) => void
}

/**
 * 國際化 Toast 通知 Hook
 *
 * @returns Toast 函數集合
 *
 * @example
 * function MyComponent() {
 *   const toast = useLocalizedToast();
 *
 *   const handleSave = async () => {
 *     try {
 *       await saveData();
 *       toast.saved(); // 顯示「已保存」或「Saved」
 *     } catch {
 *       toast.error(); // 顯示「操作失敗」或「Operation failed」
 *     }
 *   };
 *
 *   const handleCopy = () => {
 *     navigator.clipboard.writeText(text);
 *     toast.copied();
 *   };
 * }
 */
export function useLocalizedToast(): UseLocalizedToastReturn {
  const t = useTranslations('common.toast')
  const tErrors = useTranslations('errors')

  const showToast = useCallback(
    (type: ToastType, key: string, options?: ToastOptions) => {
      const title = t(key)
      const toastFn =
        type === 'error'
          ? sonnerToast.error
          : type === 'warning'
            ? sonnerToast.warning
            : type === 'info'
              ? sonnerToast.info
              : sonnerToast.success

      toastFn(title, {
        description: options?.description,
        duration: options?.duration || 4000,
        action: options?.action
          ? {
              label: options.action.label,
              onClick: options.action.onClick,
            }
          : undefined,
      })
    },
    [t]
  )

  const success = useCallback(
    (options?: ToastOptions) => showToast('success', 'success', options),
    [showToast]
  )

  const error = useCallback(
    (options?: ToastOptions) => showToast('error', 'error', options),
    [showToast]
  )

  const saved = useCallback(
    (options?: ToastOptions) => showToast('success', 'saved', options),
    [showToast]
  )

  const deleted = useCallback(
    (options?: ToastOptions) => showToast('success', 'deleted', options),
    [showToast]
  )

  const updated = useCallback(
    (options?: ToastOptions) => showToast('success', 'updated', options),
    [showToast]
  )

  const created = useCallback(
    (options?: ToastOptions) => showToast('success', 'created', options),
    [showToast]
  )

  const copied = useCallback(
    (options?: ToastOptions) => showToast('success', 'copied', options),
    [showToast]
  )

  const networkError = useCallback(() => {
    sonnerToast.error(t('networkError'))
  }, [t])

  const sessionExpired = useCallback(() => {
    sonnerToast.error(tErrors('auth.sessionExpired'))
  }, [tErrors])

  const custom = useCallback(
    (
      type: ToastType,
      title: string,
      options?: Omit<ToastOptions, 'description'> & { description?: string }
    ) => {
      const toastFn =
        type === 'error'
          ? sonnerToast.error
          : type === 'warning'
            ? sonnerToast.warning
            : type === 'info'
              ? sonnerToast.info
              : sonnerToast.success

      toastFn(title, {
        description: options?.description,
        duration: options?.duration || 4000,
        action: options?.action,
      })
    },
    []
  )

  const apiError = useCallback(
    (error: { title?: string; detail?: string }) => {
      const title = error.title || t('error')
      const description = error.detail

      sonnerToast.error(title, {
        description,
        duration: 5000,
      })
    },
    [t]
  )

  return {
    success,
    error,
    saved,
    deleted,
    updated,
    created,
    copied,
    networkError,
    sessionExpired,
    custom,
    apiError,
  }
}
