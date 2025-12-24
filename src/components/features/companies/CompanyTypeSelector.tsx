'use client'

/**
 * @fileoverview 公司類型選擇器組件
 * @description
 *   提供公司類型的選擇功能，用於分類待審核的公司。
 *
 * @module src/components/features/companies/CompanyTypeSelector
 * @since Epic 0 - Story 0.3
 * @lastModified 2025-12-23
 *
 * @features
 *   - 類型選擇下拉選單
 *   - 類型圖標顯示
 *   - 即時更新
 *
 * @dependencies
 *   - @/components/ui/select - 選擇器組件
 *
 * @related
 *   - src/app/(dashboard)/admin/companies/review/page.tsx - 審核頁面
 */

import * as React from 'react'
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

const COMPANY_TYPE_CONFIG: Record<
  CompanyType,
  {
    label: string
    icon: React.ComponentType<{ className?: string }>
    description: string
  }
> = {
  FORWARDER: {
    label: '貨運代理商',
    icon: Truck,
    description: '提供貨運代理服務的公司',
  },
  EXPORTER: {
    label: '出口商',
    icon: Package,
    description: '從事商品出口的公司',
  },
  CARRIER: {
    label: '承運人',
    icon: Ship,
    description: '提供運輸服務的公司',
  },
  CUSTOMS_BROKER: {
    label: '報關行',
    icon: FileText,
    description: '提供報關服務的公司',
  },
  OTHER: {
    label: '其他',
    icon: Building2,
    description: '其他類型的公司',
  },
  UNKNOWN: {
    label: '未分類',
    icon: HelpCircle,
    description: '尚未分類的公司',
  },
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
        <SelectValue placeholder="選擇公司類型">
          {value && (
            <div className="flex items-center gap-2">
              {React.createElement(COMPANY_TYPE_CONFIG[value].icon, {
                className: 'h-4 w-4',
              })}
              <span>{COMPANY_TYPE_CONFIG[value].label}</span>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(COMPANY_TYPE_CONFIG) as CompanyType[])
          .filter((type) => type !== 'UNKNOWN') // 不顯示 UNKNOWN 選項
          .map((type) => {
            const config = COMPANY_TYPE_CONFIG[type]
            const Icon = config.icon
            return (
              <SelectItem key={type} value={type}>
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <div>
                    <div className="font-medium">{config.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {config.description}
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
  const config = COMPANY_TYPE_CONFIG[type]
  const Icon = config.icon

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        type === 'UNKNOWN'
          ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
          : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
      } ${className}`}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </div>
  )
}

export { COMPANY_TYPE_CONFIG }
