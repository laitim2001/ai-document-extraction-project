'use client'

/**
 * @fileoverview 提取類型圖標組件
 * @description
 *   顯示映射規則提取類型的圖標：
 *   - regex: 正則表達式
 *   - keyword: 關鍵字匹配
 *   - position: 位置提取
 *   - azure_field: Azure 欄位
 *   - ai_prompt: AI 提示詞
 *
 * @module src/components/features/rules/ExtractionTypeIcon
 * @since Epic 4 - Story 4.1 (映射規則列表與查看)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - lucide-react - 圖標庫
 */

import {
  Regex,
  Search,
  Target,
  FileText,
  Brain,
  LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ExtractionMethod } from '@/types/rule'

// ============================================================
// Types
// ============================================================

interface ExtractionTypeIconProps {
  /** 提取類型 */
  type: ExtractionMethod
  /** 是否顯示標籤 */
  showLabel?: boolean
  /** 圖標大小 */
  size?: 'sm' | 'md' | 'lg'
  /** 額外的 className */
  className?: string
}

// ============================================================
// Type Configuration
// ============================================================

const TYPE_CONFIG: Record<
  ExtractionMethod,
  {
    label: string
    description: string
    icon: LucideIcon
    color: string
    bgColor: string
  }
> = {
  regex: {
    label: '正則表達式',
    description: '使用正則表達式匹配文字模式',
    icon: Regex,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/30',
  },
  keyword: {
    label: '關鍵字',
    description: '根據關鍵字定位提取',
    icon: Search,
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/30',
  },
  position: {
    label: '位置提取',
    description: '根據 PDF 座標位置提取',
    icon: Target,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-900/30',
  },
  azure_field: {
    label: 'Azure 欄位',
    description: '使用 Azure Document Intelligence 欄位',
    icon: FileText,
    color: 'text-cyan-600 dark:text-cyan-400',
    bgColor: 'bg-cyan-50 dark:bg-cyan-900/30',
  },
  ai_prompt: {
    label: 'AI 提示詞',
    description: '使用 LLM 智能提取',
    icon: Brain,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-900/30',
  },
}

// ============================================================
// Size Configuration
// ============================================================

const SIZE_CONFIG = {
  sm: { icon: 'h-3.5 w-3.5', text: 'text-xs', gap: 'gap-1', padding: 'p-1' },
  md: { icon: 'h-4 w-4', text: 'text-sm', gap: 'gap-1.5', padding: 'p-1.5' },
  lg: { icon: 'h-5 w-5', text: 'text-base', gap: 'gap-2', padding: 'p-2' },
}

// ============================================================
// Component
// ============================================================

/**
 * 提取類型圖標
 *
 * @example
 * ```tsx
 * <ExtractionTypeIcon type="regex" />
 * <ExtractionTypeIcon type="ai_prompt" showLabel size="lg" />
 * ```
 */
export function ExtractionTypeIcon({
  type,
  showLabel = false,
  size = 'md',
  className,
}: ExtractionTypeIconProps) {
  const config = TYPE_CONFIG[type]
  const sizeConfig = SIZE_CONFIG[size]
  const Icon = config.icon

  if (!showLabel) {
    return (
      <div
        className={cn(
          'inline-flex items-center justify-center rounded',
          sizeConfig.padding,
          config.bgColor,
          className
        )}
        title={config.label}
      >
        <Icon className={cn(sizeConfig.icon, config.color)} />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'inline-flex items-center rounded px-2 py-1',
        sizeConfig.gap,
        config.bgColor,
        className
      )}
    >
      <Icon className={cn(sizeConfig.icon, config.color)} />
      <span className={cn(sizeConfig.text, config.color, 'font-medium')}>
        {config.label}
      </span>
    </div>
  )
}

/**
 * 獲取提取類型配置
 */
export function getExtractionTypeConfig(type: ExtractionMethod) {
  return TYPE_CONFIG[type]
}
