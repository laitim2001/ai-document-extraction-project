'use client'

/**
 * @fileoverview 風險案例表格組件
 * @description
 *   顯示規則變更可能造成問題的案例列表：
 *   - 文件名稱和 ID
 *   - 當前值和預測值對比
 *   - 風險等級標籤
 *   - 風險原因說明
 *
 * @module src/components/features/suggestions/RiskCasesTable
 * @since Epic 4 - Story 4.5 (規則影響範圍分析)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @/components/ui/table - shadcn Table 組件
 *   - @/components/ui/badge - shadcn Badge 組件
 *   - lucide-react - 圖標庫
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, AlertCircle, Info, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RiskCase, RiskLevel } from '@/types/impact'

// ============================================================
// Types
// ============================================================

interface RiskCasesTableProps {
  /** 風險案例列表 */
  riskCases: RiskCase[]
  /** 額外的 className */
  className?: string
  /** 點擊案例時的回調 */
  onCaseClick?: (documentId: string) => void
}

// ============================================================
// Risk Level Configuration
// ============================================================

interface RiskLevelConfig {
  level: RiskLevel
  label: string
  icon: typeof AlertTriangle
  variant: 'destructive' | 'default' | 'secondary' | 'outline'
  className: string
  iconColor: string
}

const RISK_LEVEL_CONFIGS: Record<RiskLevel, RiskLevelConfig> = {
  HIGH: {
    level: 'HIGH',
    label: '高風險',
    icon: AlertTriangle,
    variant: 'destructive',
    className: '',
    iconColor: 'text-red-500',
  },
  MEDIUM: {
    level: 'MEDIUM',
    label: '中風險',
    icon: AlertCircle,
    variant: 'outline',
    className: 'border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-900/20',
    iconColor: 'text-amber-500',
  },
  LOW: {
    level: 'LOW',
    label: '低風險',
    icon: Info,
    variant: 'secondary',
    className: '',
    iconColor: 'text-slate-500',
  },
}

// ============================================================
// Sub Components
// ============================================================

/**
 * 風險等級徽章
 */
function RiskLevelBadge({ level }: { level: RiskLevel }) {
  const config = RISK_LEVEL_CONFIGS[level]
  const Icon = config.icon

  return (
    <Badge variant={config.variant} className={cn('gap-1', config.className)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  )
}

/**
 * 值對比顯示
 */
function ValueComparison({
  currentValue,
  predictedValue,
}: {
  currentValue: string | null
  predictedValue: string | null
}) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground w-12">現有:</span>
        <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
          {currentValue ?? '(無)'}
        </code>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground w-12">預測:</span>
        <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
          {predictedValue ?? '(無)'}
        </code>
      </div>
    </div>
  )
}

// ============================================================
// Component
// ============================================================

/**
 * 風險案例表格
 *
 * @example
 * ```tsx
 * <RiskCasesTable
 *   riskCases={data.riskCases}
 *   onCaseClick={(id) => router.push(`/documents/${id}`)}
 * />
 * ```
 */
export function RiskCasesTable({
  riskCases,
  className,
  onCaseClick,
}: RiskCasesTableProps) {
  if (riskCases.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            風險案例
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Info className="h-8 w-8 mb-2" />
            <p>未發現風險案例</p>
            <p className="text-sm">此規則變更預計不會造成惡化</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          風險案例
          <Badge variant="outline" className="ml-2">
            {riskCases.length} 筆
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">文件</TableHead>
                <TableHead className="w-[100px]">風險等級</TableHead>
                <TableHead className="w-[250px]">值對比</TableHead>
                <TableHead>風險原因</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {riskCases.map((riskCase) => (
                <TableRow
                  key={riskCase.documentId}
                  className={cn(
                    onCaseClick && 'cursor-pointer hover:bg-muted/50'
                  )}
                  onClick={() => onCaseClick?.(riskCase.documentId)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div className="flex flex-col">
                        <span className="font-medium text-sm truncate max-w-[150px]">
                          {riskCase.fileName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {riskCase.documentId.slice(0, 8)}...
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <RiskLevelBadge level={riskCase.riskLevel} />
                  </TableCell>
                  <TableCell>
                    <ValueComparison
                      currentValue={riskCase.currentValue}
                      predictedValue={riskCase.predictedValue}
                    />
                  </TableCell>
                  <TableCell>
                    <p className="text-sm text-muted-foreground">
                      {riskCase.reason}
                    </p>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
