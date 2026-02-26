/**
 * @fileoverview 文件來源類型徽章組件
 * @description
 *   顯示文件來源類型的徽章，支援：
 *   - 四種來源類型（手動上傳、SharePoint、Outlook、API）
 *   - 可選工具提示
 *   - 三種尺寸
 *   - 可選是否顯示標籤文字
 *
 * @module src/components/features/document-source/DocumentSourceBadge
 * @author Development Team
 * @since Epic 9 - Story 9.5 (自動獲取來源追蹤)
 * @lastModified 2026-01-28
 */

'use client'

import { useLocale } from 'next-intl'
import { DocumentSourceType } from '@prisma/client'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Upload, Mail, FileSpreadsheet, Globe, HelpCircle } from 'lucide-react'
import { SOURCE_TYPE_CONFIG } from '@/lib/constants/source-types'

// ============================================================
// Types
// ============================================================

interface DocumentSourceBadgeProps {
  /** 來源類型 */
  sourceType: DocumentSourceType | string
  /** 工具提示內容 */
  tooltip?: string
  /** 尺寸 */
  size?: 'sm' | 'md' | 'lg'
  /** 是否顯示文字 */
  showLabel?: boolean
}

const ICON_MAP = {
  Upload,
  Mail,
  FileSpreadsheet,
  Globe,
  HelpCircle,
}

// ============================================================
// Component
// ============================================================

/**
 * @component DocumentSourceBadge
 * @description 顯示文件來源類型的徽章
 */
export function DocumentSourceBadge({
  sourceType,
  tooltip,
  size = 'md',
  showLabel = true,
}: DocumentSourceBadgeProps) {
  const locale = useLocale()
  const isZh = locale === 'zh-TW' || locale === 'zh-CN'

  const config = SOURCE_TYPE_CONFIG[sourceType as DocumentSourceType] || {
    label: '未知',
    labelEn: 'Unknown',
    icon: 'HelpCircle',
    color: 'text-gray-400',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-300',
  }

  const displayLabel = isZh ? config.label : config.labelEn
  const Icon = ICON_MAP[config.icon as keyof typeof ICON_MAP] || HelpCircle

  const sizeClasses = {
    sm: 'text-xs py-0 px-1.5',
    md: 'text-sm py-0.5 px-2',
    lg: 'text-base py-1 px-3',
  }

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
    lg: 'h-4 w-4',
  }

  const badge = (
    <Badge
      variant="outline"
      className={`
        gap-1 font-normal
        ${config.bgColor} ${config.borderColor}
        ${sizeClasses[size]}
      `}
    >
      <Icon className={`${iconSizes[size]} ${config.color}`} />
      {showLabel && <span>{displayLabel}</span>}
    </Badge>
  )

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return badge
}
