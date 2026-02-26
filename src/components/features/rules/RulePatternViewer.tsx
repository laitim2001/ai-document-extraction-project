'use client'

/**
 * @fileoverview 規則模式查看器組件
 * @description
 *   顯示映射規則的提取模式詳情：
 *   - 正則表達式模式
 *   - 關鍵字列表
 *   - 位置座標
 *   - Azure 欄位名稱
 *   - AI 提示詞
 *
 * @module src/components/features/rules/RulePatternViewer
 * @since Epic 4 - Story 4.1 (映射規則列表與查看)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @/components/ui/badge - shadcn Badge 組件
 */

import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { ExtractionTypeIcon, getExtractionTypeConfig } from './ExtractionTypeIcon'
import { cn } from '@/lib/utils'
import type { ExtractionPattern } from '@/types/rule'

// ============================================================
// Types
// ============================================================

interface RulePatternViewerProps {
  /** 提取模式 */
  pattern: ExtractionPattern
  /** 額外的 className */
  className?: string
}

// ============================================================
// Helper Components
// ============================================================

/**
 * 代碼區塊
 */
function CodeBlock({
  children,
  label,
}: {
  children: React.ReactNode
  label?: string
}) {
  return (
    <div className="space-y-1">
      {label && (
        <span className="text-xs text-muted-foreground">{label}</span>
      )}
      <pre className="p-4 bg-muted rounded-lg overflow-x-auto">
        <code className="text-sm font-mono">{children}</code>
      </pre>
    </div>
  )
}

/**
 * 正則表達式模式查看器
 */
function RegexPatternViewer({ pattern }: { pattern: ExtractionPattern }) {
  return (
    <div className="space-y-4">
      {pattern.pattern && (
        <CodeBlock label="正則表達式">{pattern.pattern}</CodeBlock>
      )}
      {pattern.confidence_boost !== undefined && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">信心度增益：</span>
          <Badge variant="outline">+{pattern.confidence_boost * 100}%</Badge>
        </div>
      )}
    </div>
  )
}

/**
 * 關鍵字模式查看器
 */
function KeywordPatternViewer({ pattern }: { pattern: ExtractionPattern }) {
  return (
    <div className="space-y-4">
      {pattern.keywords && pattern.keywords.length > 0 && (
        <div className="space-y-2">
          <span className="text-sm text-muted-foreground">關鍵字列表：</span>
          <div className="flex flex-wrap gap-2">
            {pattern.keywords.map((keyword, index) => (
              <Badge key={index} variant="secondary" className="font-mono">
                {keyword}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * 位置模式查看器
 */
function PositionPatternViewer({ pattern }: { pattern: ExtractionPattern }) {
  const position = pattern.position

  if (!position) {
    return (
      <p className="text-sm text-muted-foreground">未配置位置資訊</p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">頁碼</span>
          <p className="font-medium">第 {position.page} 頁</p>
        </div>
      </div>

      {position.region && (
        <div className="space-y-2">
          <span className="text-sm text-muted-foreground">提取區域：</span>
          <div className="grid grid-cols-4 gap-2">
            <div className="p-2 bg-muted rounded text-center">
              <p className="text-xs text-muted-foreground">X</p>
              <p className="font-mono text-sm">{position.region.x}</p>
            </div>
            <div className="p-2 bg-muted rounded text-center">
              <p className="text-xs text-muted-foreground">Y</p>
              <p className="font-mono text-sm">{position.region.y}</p>
            </div>
            <div className="p-2 bg-muted rounded text-center">
              <p className="text-xs text-muted-foreground">寬度</p>
              <p className="font-mono text-sm">{position.region.width}</p>
            </div>
            <div className="p-2 bg-muted rounded text-center">
              <p className="text-xs text-muted-foreground">高度</p>
              <p className="font-mono text-sm">{position.region.height}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Azure 欄位模式查看器
 */
function AzureFieldPatternViewer({ pattern }: { pattern: ExtractionPattern }) {
  return (
    <div className="space-y-4">
      {pattern.azureFieldName && (
        <div className="space-y-1">
          <span className="text-sm text-muted-foreground">
            Azure Document Intelligence 欄位：
          </span>
          <Badge variant="outline" className="font-mono text-base px-3 py-1">
            {pattern.azureFieldName}
          </Badge>
        </div>
      )}
    </div>
  )
}

/**
 * AI 提示詞模式查看器
 */
function AIPromptPatternViewer({ pattern }: { pattern: ExtractionPattern }) {
  return (
    <div className="space-y-4">
      {pattern.aiPrompt && (
        <CodeBlock label="AI 提示詞">{pattern.aiPrompt}</CodeBlock>
      )}
    </div>
  )
}

// ============================================================
// Component
// ============================================================

/**
 * 規則模式查看器
 *
 * @example
 * ```tsx
 * <RulePatternViewer pattern={rule.extractionPattern} />
 * ```
 */
export function RulePatternViewer({
  pattern,
  className,
}: RulePatternViewerProps) {
  const t = useTranslations('rules')
  const config = getExtractionTypeConfig(pattern.method)
  const label = t(`extractionType.${config.i18nKey}`)
  const description = t(`extractionType.${config.i18nKey}Desc`)

  // 根據類型渲染對應的查看器
  const renderPatternContent = () => {
    switch (pattern.method) {
      case 'regex':
        return <RegexPatternViewer pattern={pattern} />
      case 'keyword':
        return <KeywordPatternViewer pattern={pattern} />
      case 'position':
        return <PositionPatternViewer pattern={pattern} />
      case 'azure_field':
        return <AzureFieldPatternViewer pattern={pattern} />
      case 'ai_prompt':
        return <AIPromptPatternViewer pattern={pattern} />
      default:
        return (
          <p className="text-sm text-muted-foreground">
            未知的提取類型
          </p>
        )
    }
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* 類型標題 */}
      <div className="flex items-center gap-3 pb-4 border-b">
        <ExtractionTypeIcon type={pattern.method} size="lg" />
        <div>
          <h4 className="font-medium">{label}</h4>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      {/* 模式詳情 */}
      {renderPatternContent()}
    </div>
  )
}
