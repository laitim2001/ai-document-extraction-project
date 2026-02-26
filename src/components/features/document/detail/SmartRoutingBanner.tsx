/**
 * @fileoverview CHANGE-025 智能路由提示橫幅
 * @description
 *   當檢測到新公司或新格式時顯示配置提示：
 *   - 新公司：提示需要配置公司識別規則
 *   - 新格式：提示需要配置格式映射
 *   - 提供快速配置入口連結
 *
 * @module src/components/features/document/detail/SmartRoutingBanner
 * @since CHANGE-025 - 統一處理流程優化
 * @lastModified 2026-02-01
 */

'use client'

import { AlertTriangle, Building2, FileType, ArrowRight } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Link } from '@/i18n/routing'
import { useTranslations } from 'next-intl'

// ============================================================
// Types
// ============================================================

interface SmartRoutingMarkers {
  newCompanyDetected: boolean
  newFormatDetected: boolean
  needsConfigReview: boolean
  configSource: string | null
}

interface SmartRoutingBannerProps {
  /** 智能路由標記 */
  markers: SmartRoutingMarkers | null | undefined
  /** 公司 ID（用於配置連結） */
  companyId?: string | null
  /** 格式 ID（用於配置連結） */
  formatId?: string | null
  /** 公司名稱 */
  companyName?: string | null
}

// ============================================================
// Component
// ============================================================

/**
 * 智能路由提示橫幅
 *
 * @description
 *   當 needsConfigReview 為 true 時顯示提示橫幅，
 *   引導用戶配置新公司或新格式的識別規則。
 */
export function SmartRoutingBanner({
  markers,
  companyId,
  formatId,
  companyName,
}: SmartRoutingBannerProps) {
  const t = useTranslations('documents.detail.smartRouting')
  const tc = useTranslations('common')

  // 如果沒有標記或不需要配置審核，不顯示
  if (!markers || !markers.needsConfigReview) {
    return null
  }

  const { newCompanyDetected, newFormatDetected, configSource } = markers

  // 判斷提示類型
  const isNewCompanyAndFormat = newCompanyDetected && newFormatDetected
  const isNewCompanyOnly = newCompanyDetected && !newFormatDetected
  const isNewFormatOnly = !newCompanyDetected && newFormatDetected

  return (
    <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-800 dark:text-amber-200 flex items-center gap-2">
        {t('title')}
        {configSource && (
          <Badge variant="outline" className="ml-2 text-xs">
            {configSource}
          </Badge>
        )}
      </AlertTitle>
      <AlertDescription className="text-amber-700 dark:text-amber-300">
        <div className="mt-2 space-y-3">
          {/* 描述 */}
          <p>
            {isNewCompanyAndFormat && t('description.newCompanyAndFormat')}
            {isNewCompanyOnly && t('description.newCompanyOnly', { companyName: companyName || t('unknownCompany') })}
            {isNewFormatOnly && t('description.newFormatOnly')}
          </p>

          {/* 狀態標籤 */}
          <div className="flex flex-wrap gap-2">
            {newCompanyDetected && (
              <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                <Building2 className="mr-1 h-3 w-3" />
                {t('badges.newCompany')}
              </Badge>
            )}
            {newFormatDetected && (
              <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                <FileType className="mr-1 h-3 w-3" />
                {t('badges.newFormat')}
              </Badge>
            )}
          </div>

          {/* 操作按鈕 */}
          <div className="flex flex-wrap gap-2 pt-2">
            {newCompanyDetected && companyId && (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="border-amber-500 text-amber-700 hover:bg-amber-100"
              >
                <Link href={`/companies/${companyId}/edit`}>
                  <Building2 className="mr-1 h-4 w-4" />
                  {t('actions.configureCompany')}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            )}
            {newFormatDetected && formatId && (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="border-amber-500 text-amber-700 hover:bg-amber-100"
              >
                <Link href={`/formats/${formatId}/edit`}>
                  <FileType className="mr-1 h-4 w-4" />
                  {t('actions.configureFormat')}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            )}
            {/* 如果沒有具體 ID，提供通用配置連結 */}
            {(newCompanyDetected && !companyId) && (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="border-amber-500 text-amber-700 hover:bg-amber-100"
              >
                <Link href="/companies">
                  <Building2 className="mr-1 h-4 w-4" />
                  {t('actions.manageCompanies')}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>

          {/* 提示文字 */}
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
            {t('hint')}
          </p>
        </div>
      </AlertDescription>
    </Alert>
  )
}

export default SmartRoutingBanner
