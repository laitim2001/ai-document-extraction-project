'use client'

/**
 * @fileoverview 成本異常分析對話框組件
 * @description
 *   顯示城市成本異常的詳細分析：
 *   - 異常類型和嚴重度
 *   - 當前期間 vs 上期數據對比
 *   - 變化百分比摘要
 *   - 可能原因和建議行動
 *
 * @module src/components/features/reports/CostAnomalyDialog
 * @author Development Team
 * @since Epic 7 - Story 7.9 (城市成本報表)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 異常類型標籤
 *   - 嚴重度徽章
 *   - 數據對比展示
 *   - 原因分析與建議
 *
 * @dependencies
 *   - @/components/ui - shadcn/ui 組件
 *   - lucide-react - 圖示
 *
 * @related
 *   - src/types/city-cost.ts - 類型定義
 *   - src/hooks/use-city-cost-report.ts - 資料查詢
 */

import * as React from 'react'
import {
  AlertTriangle,
  Lightbulb,
  Activity,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import type {
  CostAnomalyDialogProps,
  CostAnomalyDetail,
  AnomalyType,
  AnomalySeverity,
} from '@/types/city-cost'

// ============================================================
// Constants
// ============================================================

/**
 * 異常類型標籤對應
 */
const ANOMALY_TYPE_LABELS: Record<AnomalyType, string> = {
  volume_spike: '處理量激增',
  volume_drop: '處理量下降',
  cost_per_doc_increase: '單位成本上升',
  cost_per_doc_decrease: '單位成本下降',
  api_cost_spike: 'API 成本激增',
  labor_cost_spike: '人工成本激增',
  automation_rate_drop: '自動化率下降',
  unknown: '待分析',
}

/**
 * 嚴重度配置
 */
const SEVERITY_CONFIG: Record<
  AnomalySeverity,
  { label: string; color: string; bgColor: string }
> = {
  low: {
    label: '低',
    color: 'text-yellow-800',
    bgColor: 'bg-yellow-100',
  },
  medium: {
    label: '中',
    color: 'text-orange-800',
    bgColor: 'bg-orange-100',
  },
  high: {
    label: '高',
    color: 'text-red-800',
    bgColor: 'bg-red-100',
  },
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 格式化百分比變化
 */
function formatPercentChange(value: number): string {
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${value.toFixed(1)}%`
}

// ============================================================
// Sub-components
// ============================================================

/**
 * 載入骨架
 */
function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  )
}

/**
 * 異常詳情卡片
 */
function AnomalyDetailCard({ anomaly }: { anomaly: CostAnomalyDetail }) {
  return (
    <div className="space-y-4 border rounded-lg p-4">
      {/* 異常類型標題 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle
            className={cn(
              'h-5 w-5',
              anomaly.severity === 'high'
                ? 'text-red-500'
                : anomaly.severity === 'medium'
                  ? 'text-orange-500'
                  : 'text-yellow-500'
            )}
          />
          <span className="font-medium">
            {ANOMALY_TYPE_LABELS[anomaly.type]}
          </span>
        </div>
        <Badge
          variant="outline"
          className={cn(
            SEVERITY_CONFIG[anomaly.severity].bgColor,
            SEVERITY_CONFIG[anomaly.severity].color
          )}
        >
          {SEVERITY_CONFIG[anomaly.severity].label}風險
        </Badge>
      </div>

      {/* 描述 */}
      <p className="text-sm text-muted-foreground">{anomaly.description}</p>

      {/* 數值對比 */}
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div className="text-center">
          <div className="text-muted-foreground">當前值</div>
          <div className="font-medium">
            {typeof anomaly.currentValue === 'number'
              ? anomaly.currentValue.toLocaleString()
              : anomaly.currentValue}
          </div>
        </div>
        <div className="text-center">
          <div className="text-muted-foreground">基準值</div>
          <div className="font-medium">
            {typeof anomaly.baselineValue === 'number'
              ? anomaly.baselineValue.toLocaleString()
              : anomaly.baselineValue}
          </div>
        </div>
        <div className="text-center">
          <div className="text-muted-foreground">變化</div>
          <div
            className={cn(
              'font-medium',
              anomaly.changePercentage > 0 ? 'text-red-600' : 'text-emerald-600'
            )}
          >
            {formatPercentChange(anomaly.changePercentage)}
          </div>
        </div>
      </div>

      {/* 建議 */}
      {anomaly.recommendation && (
        <div className="flex items-start gap-2 p-2 bg-amber-50 rounded text-sm">
          <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <span>{anomaly.recommendation}</span>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Component
// ============================================================

/**
 * 成本異常分析對話框
 *
 * @description
 *   顯示城市成本異常的詳細分析，包含：
 *   - 異常列表
 *   - 嚴重度標記
 *   - 數值對比
 *   - 建議處理方式
 *
 * @example
 * ```tsx
 * <CostAnomalyDialog
 *   open={dialogOpen}
 *   onClose={() => setDialogOpen(false)}
 *   cityCode="HKG"
 *   cityName="香港"
 *   anomalies={anomalies}
 * />
 * ```
 */
export function CostAnomalyDialog({
  open,
  onClose,
  cityCode,
  cityName,
  anomalies,
  isLoading = false,
}: CostAnomalyDialogProps) {
  // --- Computed values ---
  const highSeverityCount = anomalies.filter(
    (a) => a.severity === 'high'
  ).length
  const mediumSeverityCount = anomalies.filter(
    (a) => a.severity === 'medium'
  ).length
  const lowSeverityCount = anomalies.filter(
    (a) => a.severity === 'low'
  ).length

  // --- Render ---
  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            成本異常分析
          </DialogTitle>
          <DialogDescription>
            {cityName || cityCode} 的成本異常詳情
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <LoadingSkeleton />
        ) : anomalies.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            此城市目前沒有成本異常
          </div>
        ) : (
          <div className="space-y-6">
            {/* 摘要統計 */}
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">
                共 {anomalies.length} 個異常
              </Badge>
              {highSeverityCount > 0 && (
                <Badge
                  variant="outline"
                  className={cn(
                    SEVERITY_CONFIG.high.bgColor,
                    SEVERITY_CONFIG.high.color
                  )}
                >
                  {highSeverityCount} 高風險
                </Badge>
              )}
              {mediumSeverityCount > 0 && (
                <Badge
                  variant="outline"
                  className={cn(
                    SEVERITY_CONFIG.medium.bgColor,
                    SEVERITY_CONFIG.medium.color
                  )}
                >
                  {mediumSeverityCount} 中風險
                </Badge>
              )}
              {lowSeverityCount > 0 && (
                <Badge
                  variant="outline"
                  className={cn(
                    SEVERITY_CONFIG.low.bgColor,
                    SEVERITY_CONFIG.low.color
                  )}
                >
                  {lowSeverityCount} 低風險
                </Badge>
              )}
            </div>

            {/* 異常列表 */}
            <div className="space-y-4">
              {anomalies
                .sort((a, b) => {
                  // 按嚴重度排序
                  const severityOrder = { high: 0, medium: 1, low: 2 }
                  return severityOrder[a.severity] - severityOrder[b.severity]
                })
                .map((anomaly) => (
                  <AnomalyDetailCard key={anomaly.id} anomaly={anomaly} />
                ))}
            </div>

            {/* 通用建議 */}
            <Alert>
              <Activity className="h-4 w-4" />
              <AlertTitle>建議行動</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1 mt-2 text-sm">
                  <li>檢視處理量變化趨勢，確認是否為預期的業務變化</li>
                  <li>分析自動化率下降的原因，考慮更新映射規則</li>
                  <li>定期審查人工審核案例，尋找自動化改進機會</li>
                  <li>與業務團隊溝通，了解近期業務變動情況</li>
                </ul>
              </AlertDescription>
            </Alert>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
