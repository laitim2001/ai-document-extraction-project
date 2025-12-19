'use client'

/**
 * @fileoverview 樣本案例表格組件
 * @description
 *   顯示規則建議的樣本案例，展示：
 *   - 文件名稱
 *   - 原始值與提取值
 *   - 匹配結果
 *
 * @module src/components/features/rule-review/SampleCasesTable
 * @since Epic 4 - Story 4.6 (審核學習規則)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @/components/ui/table - shadcn Table 組件
 *   - @/components/ui/badge - shadcn Badge 組件
 */

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Check, X, Minus, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================================
// Types
// ============================================================

interface SampleCase {
  /** 文件 ID */
  documentId: string
  /** 文件名稱 */
  documentName?: string
  /** 原始值（人工確認的值） */
  originalValue: string
  /** 提取值（規則提取的值） */
  extractedValue: string
  /** 是否匹配 */
  isMatch: boolean
}

interface SampleCasesTableProps {
  /** 樣本案例列表 */
  cases: SampleCase[]
  /** 額外的 className */
  className?: string
  /** 點擊案例時的回調 */
  onCaseClick?: (documentId: string) => void
}

// ============================================================
// Sub Components
// ============================================================

/**
 * 匹配狀態標籤
 */
function MatchBadge({ isMatch }: { isMatch: boolean }) {
  if (isMatch) {
    return (
      <Badge variant="default" className="gap-1 bg-green-100 text-green-700 hover:bg-green-100">
        <Check className="h-3 w-3" />
        匹配
      </Badge>
    )
  }

  return (
    <Badge variant="destructive" className="gap-1">
      <X className="h-3 w-3" />
      不匹配
    </Badge>
  )
}

/**
 * 空狀態
 */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
      <p className="text-muted-foreground">無樣本案例</p>
      <p className="text-sm text-muted-foreground/75 mt-1">
        此規則建議尚無樣本案例資料
      </p>
    </div>
  )
}

// ============================================================
// Component
// ============================================================

/**
 * 樣本案例表格組件
 *
 * @description
 *   在審核頁面顯示規則建議的樣本案例
 *
 * @example
 * ```tsx
 * <SampleCasesTable
 *   cases={suggestion.sampleCases}
 *   onCaseClick={(id) => router.push(`/documents/${id}`)}
 * />
 * ```
 */
export function SampleCasesTable({
  cases,
  className,
  onCaseClick,
}: SampleCasesTableProps) {
  if (!cases || cases.length === 0) {
    return <EmptyState />
  }

  const matchCount = cases.filter((c) => c.isMatch).length
  const matchRate = Math.round((matchCount / cases.length) * 100)

  return (
    <div className={cn('space-y-4', className)}>
      {/* 統計摘要 */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          共 {cases.length} 個樣本案例
        </span>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">匹配率：</span>
          <span
            className={cn(
              'font-medium',
              matchRate >= 90
                ? 'text-green-600'
                : matchRate >= 70
                  ? 'text-yellow-600'
                  : 'text-red-600'
            )}
          >
            {matchRate}% ({matchCount}/{cases.length})
          </span>
        </div>
      </div>

      {/* 表格 */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">文件</TableHead>
              <TableHead>原始值</TableHead>
              <TableHead>提取值</TableHead>
              <TableHead className="w-[100px] text-center">匹配</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cases.map((caseItem) => (
              <TableRow
                key={caseItem.documentId}
                className={cn(
                  onCaseClick && 'cursor-pointer hover:bg-muted/50'
                )}
                onClick={() => onCaseClick?.(caseItem.documentId)}
              >
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate max-w-[160px]">
                      {caseItem.documentName || caseItem.documentId.slice(0, 8)}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  {caseItem.originalValue ? (
                    <code className="text-sm bg-muted px-2 py-1 rounded">
                      {caseItem.originalValue}
                    </code>
                  ) : (
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Minus className="h-3 w-3" />
                      無值
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {caseItem.extractedValue ? (
                    <code className="text-sm bg-muted px-2 py-1 rounded">
                      {caseItem.extractedValue}
                    </code>
                  ) : (
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Minus className="h-3 w-3" />
                      無值
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <MatchBadge isMatch={caseItem.isMatch} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
