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
import { useTranslations } from 'next-intl'
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
 * 嚴重度樣式配置
 */
const SEVERITY_STYLES: Record<
  AnomalySeverity,
  { color: string; bgColor: string }
> = {
  low: {
    color: 'text-yellow-800',
    bgColor: 'bg-yellow-100',
  },
  medium: {
    color: 'text-orange-800',
    bgColor: 'bg-orange-100',
  },
  high: {
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
function AnomalyDetailCard({
  anomaly,
  t,
}: {
  anomaly: CostAnomalyDetail
  t: (key: string, values?: Record<string, string | number>) => string
}) {
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
            {t(`costAnomaly.types.${anomaly.type}`)}
          </span>
        </div>
        <Badge
          variant="outline"
          className={cn(
            SEVERITY_STYLES[anomaly.severity].bgColor,
            SEVERITY_STYLES[anomaly.severity].color
          )}
        >
          {t(`costAnomaly.severity.${anomaly.severity}`)} {t('costAnomaly.riskLabel')}
        </Badge>
      </div>

      {/* 描述 */}
      <p className="text-sm text-muted-foreground">{anomaly.description}</p>

      {/* 數值對比 */}
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div className="text-center">
          <div className="text-muted-foreground">{t('costAnomaly.currentValue')}</div>
          <div className="font-medium">
            {typeof anomaly.currentValue === 'number'
              ? anomaly.currentValue.toLocaleString()
              : anomaly.currentValue}
          </div>
        </div>
        <div className="text-center">
          <div className="text-muted-foreground">{t('costAnomaly.baselineValue')}</div>
          <div className="font-medium">
            {typeof anomaly.baselineValue === 'number'
              ? anomaly.baselineValue.toLocaleString()
              : anomaly.baselineValue}
          </div>
        </div>
        <div className="text-center">
          <div className="text-muted-foreground">{t('costAnomaly.change')}</div>
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
  const t = useTranslations('reports')

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
            {t('costAnomaly.dialogTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('costAnomaly.dialogDescription', { city: cityName || cityCode })}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <LoadingSkeleton />
        ) : anomalies.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {t('costAnomaly.noAnomalies')}
          </div>
        ) : (
          <div className="space-y-6">
            {/* 摘要統計 */}
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">
                {t('costAnomaly.totalCount', { count: anomalies.length })}
              </Badge>
              {highSeverityCount > 0 && (
                <Badge
                  variant="outline"
                  className={cn(
                    SEVERITY_STYLES.high.bgColor,
                    SEVERITY_STYLES.high.color
                  )}
                >
                  {t('cityCost.highRisk', { count: highSeverityCount })}
                </Badge>
              )}
              {mediumSeverityCount > 0 && (
                <Badge
                  variant="outline"
                  className={cn(
                    SEVERITY_STYLES.medium.bgColor,
                    SEVERITY_STYLES.medium.color
                  )}
                >
                  {t('cityCost.mediumRisk', { count: mediumSeverityCount })}
                </Badge>
              )}
              {lowSeverityCount > 0 && (
                <Badge
                  variant="outline"
                  className={cn(
                    SEVERITY_STYLES.low.bgColor,
                    SEVERITY_STYLES.low.color
                  )}
                >
                  {t('cityCost.lowRisk', { count: lowSeverityCount })}
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
                  <AnomalyDetailCard key={anomaly.id} anomaly={anomaly} t={t} />
                ))}
            </div>

            {/* 通用建議 */}
            <Alert>
              <Activity className="h-4 w-4" />
              <AlertTitle>{t('costAnomaly.recommendations.title')}</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1 mt-2 text-sm">
                  <li>{t('costAnomaly.recommendations.items.checkTrend')}</li>
                  <li>{t('costAnomaly.recommendations.items.analyzeAutomation')}</li>
                  <li>{t('costAnomaly.recommendations.items.reviewManual')}</li>
                  <li>{t('costAnomaly.recommendations.items.communicateBusiness')}</li>
                </ul>
              </AlertDescription>
            </Alert>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
