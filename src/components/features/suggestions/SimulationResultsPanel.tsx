'use client'

/**
 * @fileoverview 模擬測試結果面板組件
 * @description
 *   顯示模擬測試結果：
 *   - 測試摘要統計
 *   - 準確率變化
 *   - 改善/惡化/無變化案例列表
 *
 * @module src/components/features/suggestions/SimulationResultsPanel
 * @since Epic 4 - Story 4.5 (規則影響範圍分析)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @/components/ui/card - shadcn Card 組件
 *   - @/components/ui/tabs - shadcn Tabs 組件
 *   - @/components/ui/badge - shadcn Badge 組件
 *   - @/components/ui/table - shadcn Table 組件
 *   - lucide-react - 圖標庫
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  FileText,
  CheckCircle2,
  XCircle,
  BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SimulationResult, SimulationCase, SimulationSummary } from '@/types/impact'

// ============================================================
// Types
// ============================================================

interface SimulationResultsPanelProps {
  /** 模擬結果 */
  result: SimulationResult
  /** 額外的 className */
  className?: string
}

// ============================================================
// Sub Components
// ============================================================

/**
 * 摘要統計卡片
 */
function SummaryCards({ summary }: { summary: SimulationSummary }) {
  const accuracyChangeColor =
    summary.accuracyChange !== null
      ? summary.accuracyChange > 0
        ? 'text-green-600'
        : summary.accuracyChange < 0
          ? 'text-red-600'
          : 'text-slate-600'
      : 'text-slate-600'

  const accuracyChangeIcon =
    summary.accuracyChange !== null
      ? summary.accuracyChange > 0
        ? TrendingUp
        : summary.accuracyChange < 0
          ? TrendingDown
          : Minus
      : Minus

  const AccuracyIcon = accuracyChangeIcon

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {/* 測試樣本數 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-lg dark:bg-slate-800">
              <FileText className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{summary.totalTested}</p>
              <p className="text-xs text-muted-foreground">測試樣本</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 改善數 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg dark:bg-green-900/30">
              <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{summary.improvedCount}</p>
              <p className="text-xs text-muted-foreground">改善</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 惡化數 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg dark:bg-red-900/30">
              <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{summary.regressedCount}</p>
              <p className="text-xs text-muted-foreground">惡化</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 準確率變化 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg dark:bg-blue-900/30">
              <AccuracyIcon className={cn('h-5 w-5', accuracyChangeColor)} />
            </div>
            <div>
              <p className={cn('text-2xl font-bold', accuracyChangeColor)}>
                {summary.accuracyChange !== null
                  ? `${summary.accuracyChange > 0 ? '+' : ''}${summary.accuracyChange}%`
                  : 'N/A'}
              </p>
              <p className="text-xs text-muted-foreground">準確率變化</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * 準確率對比
 */
function AccuracyComparison({ summary }: { summary: SimulationSummary }) {
  return (
    <div className="flex items-center justify-center gap-8 py-4 bg-muted/30 rounded-lg mb-6">
      <div className="text-center">
        <p className="text-sm text-muted-foreground mb-1">變更前準確率</p>
        <p className="text-3xl font-bold">
          {summary.accuracyBefore !== null ? `${summary.accuracyBefore}%` : 'N/A'}
        </p>
      </div>
      <div className="text-4xl text-muted-foreground">→</div>
      <div className="text-center">
        <p className="text-sm text-muted-foreground mb-1">變更後準確率</p>
        <p className="text-3xl font-bold">
          {summary.accuracyAfter !== null ? `${summary.accuracyAfter}%` : 'N/A'}
        </p>
      </div>
    </div>
  )
}

/**
 * 案例列表表格
 */
function CaseTable({ cases, type }: { cases: SimulationCase[]; type: 'improved' | 'regressed' | 'unchanged' }) {
  if (cases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <FileText className="h-8 w-8 mb-2" />
        <p>無{type === 'improved' ? '改善' : type === 'regressed' ? '惡化' : '無變化'}案例</p>
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">文件</TableHead>
            <TableHead className="w-[120px]">原始提取</TableHead>
            <TableHead className="w-[120px]">當前規則</TableHead>
            <TableHead className="w-[120px]">新規則</TableHead>
            <TableHead className="w-[120px]">實際值</TableHead>
            <TableHead className="w-[100px]">當前</TableHead>
            <TableHead className="w-[100px]">新規則</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cases.slice(0, 20).map((caseItem) => (
            <TableRow key={caseItem.documentId}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm truncate max-w-[150px]">{caseItem.fileName}</span>
                </div>
              </TableCell>
              <TableCell>
                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                  {caseItem.originalExtracted ?? '(無)'}
                </code>
              </TableCell>
              <TableCell>
                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                  {caseItem.currentRuleResult ?? '(無)'}
                </code>
              </TableCell>
              <TableCell>
                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                  {caseItem.newRuleResult ?? '(無)'}
                </code>
              </TableCell>
              <TableCell>
                <code className="text-xs bg-muted px-1 py-0.5 rounded font-medium">
                  {caseItem.actualValue ?? '(無)'}
                </code>
              </TableCell>
              <TableCell>
                {caseItem.currentAccurate ? (
                  <Badge variant="outline" className="gap-1 text-green-600">
                    <CheckCircle2 className="h-3 w-3" />
                    正確
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 text-red-600">
                    <XCircle className="h-3 w-3" />
                    錯誤
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                {caseItem.newAccurate ? (
                  <Badge variant="outline" className="gap-1 text-green-600">
                    <CheckCircle2 className="h-3 w-3" />
                    正確
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 text-red-600">
                    <XCircle className="h-3 w-3" />
                    錯誤
                  </Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {cases.length > 20 && (
        <div className="p-2 text-center text-sm text-muted-foreground border-t">
          顯示前 20 筆，共 {cases.length} 筆
        </div>
      )}
    </div>
  )
}

// ============================================================
// Component
// ============================================================

/**
 * 模擬測試結果面板
 *
 * @example
 * ```tsx
 * {result && <SimulationResultsPanel result={result} />}
 * ```
 */
export function SimulationResultsPanel({
  result,
  className,
}: SimulationResultsPanelProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            模擬測試結果
          </CardTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{result.duration}ms</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* 摘要卡片 */}
        <SummaryCards summary={result.summary} />

        {/* 準確率對比 */}
        <AccuracyComparison summary={result.summary} />

        {/* 案例分類 Tabs */}
        <Tabs defaultValue="improved">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="improved" className="gap-1">
              <TrendingUp className="h-4 w-4 text-green-600" />
              改善 ({result.results.improved.length})
            </TabsTrigger>
            <TabsTrigger value="regressed" className="gap-1">
              <TrendingDown className="h-4 w-4 text-red-600" />
              惡化 ({result.results.regressed.length})
            </TabsTrigger>
            <TabsTrigger value="unchanged" className="gap-1">
              <Minus className="h-4 w-4" />
              無變化 ({result.results.unchanged.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="improved" className="mt-4">
            <CaseTable cases={result.results.improved} type="improved" />
          </TabsContent>
          <TabsContent value="regressed" className="mt-4">
            <CaseTable cases={result.results.regressed} type="regressed" />
          </TabsContent>
          <TabsContent value="unchanged" className="mt-4">
            <CaseTable cases={result.results.unchanged} type="unchanged" />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
