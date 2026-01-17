'use client'

/**
 * @fileoverview 規則詳情視圖組件（國際化版本）
 * @description
 *   顯示映射規則的完整詳情：
 *   - 規則標頭（名稱、狀態、操作按鈕）
 *   - 基本資訊卡片（類型、版本、優先級、信心度）
 *   - 應用統計圖表
 *   - 提取模式詳情
 *   - 最近應用記錄
 *   - 元數據（創建者、時間等）
 *   - 完整國際化支援
 *
 * @module src/components/features/rules/RuleDetailView
 * @since Epic 4 - Story 4.1 (映射規則列表與查看)
 * @lastModified 2026-01-17
 *
 * @dependencies
 *   - next-intl - 國際化
 *   - @/hooks/useRuleDetail - 規則詳情 Hook
 *   - @/components/ui/* - shadcn UI 組件
 */

import { useTranslations, useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useRuleDetail } from '@/hooks/useRuleDetail'
import { RuleStatusBadge } from './RuleStatusBadge'
import { ExtractionTypeIcon } from './ExtractionTypeIcon'
import { RuleStats } from './RuleStats'
import { RulePatternViewer } from './RulePatternViewer'
import { RecentApplicationsTable } from './RecentApplicationsTable'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft,
  History,
  Settings,
  Activity,
  FileText,
  AlertCircle,
  Globe,
} from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { zhTW, enUS } from 'date-fns/locale'

// ============================================================
// Types
// ============================================================

interface RuleDetailViewProps {
  /** 規則 ID */
  ruleId: string
}

// ============================================================
// Skeleton Component
// ============================================================

/**
 * 規則詳情骨架屏
 */
export function RuleDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* 標頭骨架 */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-24" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <Skeleton className="h-5 w-48" />
      </div>

      {/* 基本資訊卡片骨架 */}
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-16" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 統計骨架 */}
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>

      {/* 內容骨架 */}
      <Skeleton className="h-64" />
    </div>
  )
}

// ============================================================
// Component
// ============================================================

/**
 * 規則詳情視圖
 *
 * @example
 * ```tsx
 * <RuleDetailView ruleId="rule-123" />
 * ```
 */
export function RuleDetailView({ ruleId }: RuleDetailViewProps) {
  const t = useTranslations('rules')
  const locale = useLocale()
  const dateLocale = locale === 'zh-TW' || locale === 'zh-CN' ? zhTW : enUS

  // --- Hooks ---
  const router = useRouter()
  const { data: ruleData, isLoading, error } = useRuleDetail(ruleId)

  // --- Loading State ---
  if (isLoading) {
    return <RuleDetailSkeleton />
  }

  // --- Error State ---
  if (error || !ruleData) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="text-lg font-medium">{t('detail.loadFailed')}</h3>
        <p className="text-sm text-muted-foreground mb-4">{error?.message}</p>
        <Button onClick={() => router.push('/rules')}>{t('detail.backToList')}</Button>
      </div>
    )
  }

  const rule = ruleData

  // --- Render ---
  return (
    <div className="space-y-6" data-testid="rule-detail">
      {/* 標頭 */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/rules')}
            className="mb-2 -ml-2"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t('detail.backToList')}
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">
              {rule.company ? (
                <>
                  {rule.company.name} - {rule.fieldName}
                </>
              ) : (
                <span className="flex items-center gap-2">
                  <Globe className="h-6 w-6 text-blue-600" />
                  {t('detail.universalRule')} - {rule.fieldName}
                </span>
              )}
            </h1>
            <RuleStatusBadge status={rule.status} />
          </div>
          <p className="text-muted-foreground">
            {rule.description || t('detail.noDescription')}
          </p>
          {rule.fieldLabel && (
            <p className="text-sm text-muted-foreground">
              {t('detail.fieldLabel')}{rule.fieldLabel}
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/rules/${ruleId}/history`}>
              <History className="h-4 w-4 mr-2" />
              {t('detail.versionHistory')}
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/rules/${ruleId}/edit`}>
              <Settings className="h-4 w-4 mr-2" />
              {t('detail.edit')}
            </Link>
          </Button>
        </div>
      </div>

      {/* 基本資訊卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('detail.extractionType')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ExtractionTypeIcon
              type={rule.extractionPattern.method}
              showLabel
              size="lg"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('detail.version')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">v{rule.version}</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('detail.priority')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{rule.priority}</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('detail.confidenceThreshold')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">
              {(rule.confidence * 100).toFixed(0)}%
            </span>
          </CardContent>
        </Card>
      </div>

      {/* 統計資訊 */}
      <RuleStats stats={rule.stats} />

      {/* 詳細內容標籤頁 */}
      <Tabs defaultValue="pattern" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pattern" className="gap-2">
            <FileText className="h-4 w-4" />
            {t('detail.extractionPattern')}
          </TabsTrigger>
          <TabsTrigger value="applications" className="gap-2">
            <Activity className="h-4 w-4" />
            {t('detail.applications')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pattern">
          <Card>
            <CardHeader>
              <CardTitle>{t('detail.patternDetails')}</CardTitle>
            </CardHeader>
            <CardContent>
              <RulePatternViewer pattern={rule.extractionPattern} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="applications">
          <Card>
            <CardHeader>
              <CardTitle>{t('detail.recentApplications')}</CardTitle>
            </CardHeader>
            <CardContent>
              <RecentApplicationsTable applications={rule.recentApplications} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 元資料 */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">{t('detail.createdBy')}</span>
              <span className="ml-2">{rule.createdBy?.name ?? t('detail.system')}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('detail.createdAt')}</span>
              <span className="ml-2">
                {format(new Date(rule.createdAt), 'yyyy/MM/dd HH:mm', {
                  locale: dateLocale,
                })}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('detail.forwarder')}</span>
              <span className="ml-2">
                {rule.company
                  ? `${rule.company.name} (${rule.company.code})`
                  : t('detail.universalRule')}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('detail.updatedAt')}</span>
              <span className="ml-2">
                {format(new Date(rule.updatedAt), 'yyyy/MM/dd HH:mm', {
                  locale: dateLocale,
                })}
              </span>
            </div>
            {rule.category && (
              <div>
                <span className="text-muted-foreground">{t('detail.category')}</span>
                <span className="ml-2">{rule.category}</span>
              </div>
            )}
            {rule.isRequired && (
              <div>
                <span className="text-muted-foreground">{t('detail.requiredField')}</span>
                <span className="ml-2 text-amber-600">{t('detail.yes')}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
