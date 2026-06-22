'use client'

/**
 * @fileoverview 測試結果統計組件
 * @description
 *   Story 5-4: 測試規則變更效果 - 結果統計展示
 *   顯示測試結果的統計摘要：
 *   - 改善/惡化/無變化的數量和比例
 *   - 準確率比較
 *   - 決策建議
 *
 * @module src/components/features/rules/ImpactStatistics
 * @since Epic 5 - Story 5.4 (測試規則變更效果)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @/components/ui/* - shadcn UI 組件
 *   - @/types/rule-test - 類型定義
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  XCircle,
  Minus,
  AlertCircle,
  CheckCircle,
  Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TestResults } from '@/types/rule-test'

// ============================================================
// Types
// ============================================================

interface ImpactStatisticsProps {
  /** 測試結果 */
  results: TestResults
  /** 總測試文件數 */
  totalDocuments: number
  /** 額外的 className */
  className?: string
}

// ============================================================
// Helper Components
// ============================================================

interface StatCardProps {
  title: string
  value: number
  percentage: number
  icon: React.ReactNode
  colorClass: string
  bgClass: string
}

function StatCard({
  title,
  value,
  percentage,
  icon,
  colorClass,
  bgClass,
}: StatCardProps) {
  return (
    <div className={cn('rounded-lg p-4', bgClass)}>
      <div className="flex items-center gap-3">
        <div className={cn('rounded-full p-2', colorClass)}>{icon}</div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
          <p className={cn('text-sm', colorClass)}>
            {(percentage * 100).toFixed(1)}%
          </p>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Component
// ============================================================

/**
 * 測試結果統計組件
 *
 * @example
 * ```tsx
 * <ImpactStatistics
 *   results={testResults}
 *   totalDocuments={100}
 * />
 * ```
 */
export function ImpactStatistics({
  results,
  totalDocuments,
  className,
}: ImpactStatisticsProps) {
  const t = useTranslations('rules')

  // --- Calculations ---

  const netImprovement = results.improved - results.regressed
  const netImprovementRate =
    totalDocuments > 0 ? netImprovement / totalDocuments : 0

  // --- Recommendation Logic ---

  const getRecommendation = () => {
    if (results.regressed > 0 && results.regressionRate > 0.05) {
      return {
        type: 'warning' as const,
        icon: <AlertCircle className="h-4 w-4" />,
        title: t('impactStats.recommendation.notRecommendedTitle'),
        description: t('impactStats.recommendation.notRecommendedDesc', {
          count: results.regressed,
          rate: (results.regressionRate * 100).toFixed(1),
        }),
      }
    }

    if (netImprovement > 0 && results.regressionRate <= 0.02) {
      return {
        type: 'success' as const,
        icon: <CheckCircle className="h-4 w-4" />,
        title: t('impactStats.recommendation.recommendedTitle'),
        description: t('impactStats.recommendation.recommendedDesc', {
          net: netImprovement,
          rate: (results.regressionRate * 100).toFixed(1),
        }),
      }
    }

    if (netImprovement <= 0) {
      return {
        type: 'info' as const,
        icon: <Info className="h-4 w-4" />,
        title: t('impactStats.recommendation.ineffectiveTitle'),
        description: t('impactStats.recommendation.ineffectiveDesc', {
          net: netImprovement,
        }),
      }
    }

    return {
      type: 'info' as const,
      icon: <Info className="h-4 w-4" />,
      title: t('impactStats.recommendation.cautiousTitle'),
      description: t('impactStats.recommendation.cautiousDesc', {
        improvementRate: (results.improvementRate * 100).toFixed(1),
        regressionRate: (results.regressionRate * 100).toFixed(1),
      }),
    }
  }

  const recommendation = getRecommendation()

  // --- Render ---

  return (
    <div className={cn('space-y-6', className)}>
      {/* 統計卡片 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title={t('impactStats.improved')}
          value={results.improved}
          percentage={results.improvementRate}
          icon={<TrendingUp className="h-4 w-4 text-green-600" />}
          colorClass="text-green-600"
          bgClass="bg-green-50 dark:bg-green-900/20"
        />
        <StatCard
          title={t('impactStats.regressed')}
          value={results.regressed}
          percentage={results.regressionRate}
          icon={<TrendingDown className="h-4 w-4 text-red-600" />}
          colorClass="text-red-600"
          bgClass="bg-red-50 dark:bg-red-900/20"
        />
        <StatCard
          title={t('impactStats.bothRight')}
          value={results.bothRight}
          percentage={totalDocuments > 0 ? results.bothRight / totalDocuments : 0}
          icon={<CheckCircle2 className="h-4 w-4 text-blue-600" />}
          colorClass="text-blue-600"
          bgClass="bg-blue-50 dark:bg-blue-900/20"
        />
        <StatCard
          title={t('impactStats.bothWrong')}
          value={results.bothWrong}
          percentage={totalDocuments > 0 ? results.bothWrong / totalDocuments : 0}
          icon={<XCircle className="h-4 w-4 text-yellow-600" />}
          colorClass="text-yellow-600"
          bgClass="bg-yellow-50 dark:bg-yellow-900/20"
        />
        <StatCard
          title={t('impactStats.unchanged')}
          value={results.unchanged}
          percentage={totalDocuments > 0 ? results.unchanged / totalDocuments : 0}
          icon={<Minus className="h-4 w-4 text-slate-600" />}
          colorClass="text-slate-600"
          bgClass="bg-slate-50 dark:bg-slate-900/20"
        />
      </div>

      {/* 準確率比較 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('impactStats.accuracyComparison')}</CardTitle>
          <CardDescription>{t('impactStats.accuracyComparisonDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>{t('impactStats.originalAccuracy')}</span>
              <span className="font-medium">
                {(results.originalAccuracyRate * 100).toFixed(1)}%
              </span>
            </div>
            <Progress value={results.originalAccuracyRate * 100} className="h-2" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>{t('impactStats.newAccuracy')}</span>
              <span className="font-medium">
                {(results.testAccuracyRate * 100).toFixed(1)}%
              </span>
            </div>
            <Progress
              value={results.testAccuracyRate * 100}
              className={cn(
                'h-2',
                results.testAccuracyRate > results.originalAccuracyRate
                  ? '[&>div]:bg-green-500'
                  : results.testAccuracyRate < results.originalAccuracyRate
                    ? '[&>div]:bg-red-500'
                    : ''
              )}
            />
          </div>
          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-sm font-medium">{t('impactStats.netImprovement')}</span>
            <Badge
              variant={netImprovement > 0 ? 'default' : netImprovement < 0 ? 'destructive' : 'secondary'}
              className={cn(
                netImprovement > 0 && 'bg-green-100 text-green-700 hover:bg-green-200',
                netImprovement < 0 && 'bg-red-100 text-red-700 hover:bg-red-200'
              )}
            >
              {t('impactStats.netImprovementValue', {
                prefix: netImprovement > 0 ? '+' : '',
                count: netImprovement,
                ratePrefix: netImprovementRate > 0 ? '+' : '',
                rate: (netImprovementRate * 100).toFixed(1),
              })}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* 決策建議 */}
      <Alert
        variant={recommendation.type === 'warning' ? 'destructive' : 'default'}
        className={cn(
          recommendation.type === 'success' && 'border-green-500 bg-green-50 dark:bg-green-900/20',
          recommendation.type === 'info' && 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
        )}
      >
        {recommendation.icon}
        <AlertTitle>{recommendation.title}</AlertTitle>
        <AlertDescription>{recommendation.description}</AlertDescription>
      </Alert>
    </div>
  )
}
