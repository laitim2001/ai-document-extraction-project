'use client'

/**
 * @fileoverview 存取被拒絕提示組件
 * @description
 *   顯示權限不足時的錯誤提示。
 *   當用戶被從受權限保護的頁面重定向回 dashboard 時使用。
 *
 * @module src/components/dashboard/AccessDeniedAlert
 * @since Epic 17 - i18n Bug Fixes
 * @lastModified 2026-01-19
 */

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { AlertCircle, X } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

/**
 * 存取被拒絕提示組件
 *
 * @description
 *   檢查 URL 參數中是否有 error=access_denied，
 *   如果有則顯示錯誤提示。用戶可以關閉提示。
 */
export function AccessDeniedAlert() {
  const t = useTranslations('dashboard')
  const searchParams = useSearchParams()
  const [showAlert, setShowAlert] = useState(false)

  useEffect(() => {
    const error = searchParams.get('error')
    if (error === 'access_denied') {
      setShowAlert(true)
      // 清除 URL 參數，但不重新載入頁面
      const url = new URL(window.location.href)
      url.searchParams.delete('error')
      window.history.replaceState({}, '', url.toString())
    }
  }, [searchParams])

  if (!showAlert) {
    return null
  }

  return (
    <Alert variant="destructive" className="mb-6">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle className="flex items-center justify-between">
        {t('errors.access_denied.title')}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={() => setShowAlert(false)}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </Button>
      </AlertTitle>
      <AlertDescription>
        {t('errors.access_denied.description')}
      </AlertDescription>
    </Alert>
  )
}
