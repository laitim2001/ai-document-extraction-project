'use client'

/**
 * @fileoverview 公司類型選擇器組件（國際化版本）
 * @description
 *   提供公司類型的選擇功能，用於分類待審核的公司。
 *   - 完整國際化支援
 *
 * @module src/components/features/companies/CompanyTypeSelector
 * @since Epic 0 - Story 0.3
 * @lastModified 2026-01-17
 *
 * @features
 *   - 類型選擇下拉選單
 *   - 類型圖標顯示
 *   - 即時更新
 *   - 完整國際化支援
 *
 * @dependencies
 *   - next-intl - 國際化
 *   - @/components/ui/select - 選擇器組件
 *
 * @related
 *   - src/app/(dashboard)/admin/companies/review/page.tsx - 審核頁面
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CompanyType } from '@prisma/client'
import {
  Truck,
  Package,
  Ship,
  FileText,
  HelpCircle,
  Building2,
} from 'lucide-react'

// ============================================================
// Types
// ============================================================

interface CompanyTypeSelectorProps {
  value?: CompanyType
  onChange: (type: CompanyType) => void
  disabled?: boolean
  className?: string
}

// ============================================================
// Constants
// ============================================================

// i18n key mapping for company types
const COMPANY_TYPE_I18N_KEYS: Record<
  CompanyType,
  { labelKey: string; descKey: string }
> = {
  FORWARDER: { labelKey: 'forwarder', descKey: 'forwarderDesc' },
  EXPORTER: { labelKey: 'exporter', descKey: 'exporterDesc' },
  CARRIER: { labelKey: 'carrier', descKey: 'carrierDesc' },
  CUSTOMS_BROKER: { labelKey: 'customsBroker', descKey: 'customsBrokerDesc' },
  OTHER: { labelKey: 'other', descKey: 'otherDesc' },
  UNKNOWN: { labelKey: 'unknown', descKey: 'unknownDesc' },
}

const COMPANY_TYPE_ICONS: Record<
  CompanyType,
  React.ComponentType<{ className?: string }>
> = {
  FORWARDER: Truck,
  EXPORTER: Package,
  CARRIER: Ship,
  CUSTOMS_BROKER: FileText,
  OTHER: Building2,
  UNKNOWN: HelpCircle,
}

// ============================================================
// Component
// ============================================================

/**
 * 公司類型選擇器
 *
 * @description
 *   提供下拉選單讓用戶選擇公司類型。
 *   每個類型都有對應的圖標和描述。
 *
 * @param props - 組件屬性
 * @returns 公司類型選擇器
 */
export function CompanyTypeSelector({
  value,
  onChange,
  disabled = false,
  className,
}: CompanyTypeSelectorProps) {
  const t = useTranslations('companies')

  const handleValueChange = React.useCallback(
    (newValue: string) => {
      onChange(newValue as CompanyType)
    },
    [onChange]
  )

  return (
    <Select
      value={value}
      onValueChange={handleValueChange}
      disabled={disabled}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={t('companyType.selectPlaceholder')}>
          {value && (
            <div className="flex items-center gap-2">
              {React.createElement(COMPANY_TYPE_ICONS[value], {
                className: 'h-4 w-4',
              })}
              <span>{t(`companyType.${COMPANY_TYPE_I18N_KEYS[value].labelKey}`)}</span>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(COMPANY_TYPE_I18N_KEYS) as CompanyType[])
          .filter((type) => type !== 'UNKNOWN') // 不顯示 UNKNOWN 選項
          .map((type) => {
            const i18nKeys = COMPANY_TYPE_I18N_KEYS[type]
            const Icon = COMPANY_TYPE_ICONS[type]
            return (
              <SelectItem key={type} value={type}>
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <div>
                    <div className="font-medium">{t(`companyType.${i18nKeys.labelKey}`)}</div>
                    <div className="text-xs text-muted-foreground">
                      {t(`companyType.${i18nKeys.descKey}`)}
                    </div>
                  </div>
                </div>
              </SelectItem>
            )
          })}
      </SelectContent>
    </Select>
  )
}

/**
 * 公司類型徽章
 *
 * @description
 *   顯示公司類型的徽章（只讀）。
 *
 * @param props - 組件屬性
 * @returns 公司類型徽章
 */
export function CompanyTypeBadge({
  type,
  className,
}: {
  type: CompanyType
  className?: string
}) {
  const t = useTranslations('companies')
  const i18nKeys = COMPANY_TYPE_I18N_KEYS[type]
  const Icon = COMPANY_TYPE_ICONS[type]

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        type === 'UNKNOWN'
          ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
          : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
      } ${className}`}
    >
      <Icon className="h-3 w-3" />
      {t(`companyType.${i18nKeys.labelKey}`)}
    </div>
  )
}

export { COMPANY_TYPE_I18N_KEYS, COMPANY_TYPE_ICONS }
