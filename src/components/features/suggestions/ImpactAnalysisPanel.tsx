'use client'

/**
 * @fileoverview 影響分析面板組件
 * @description
 *   整合影響分析所有子組件的主面板：
 *   - 統計數據卡片
 *   - 風險案例表格
 *   - 時間軸趨勢
 *   - 模擬測試功能
 *
 * @module src/components/features/suggestions/ImpactAnalysisPanel
 * @since Epic 4 - Story 4.5 (規則影響範圍分析)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @/hooks/useImpactAnalysis - 影響分析 Hook
 *   - @/hooks/useSimulation - 模擬測試 Hook
 *   - @/components/ui/skeleton - shadcn Skeleton 組件
 *   - @/components/ui/alert - shadcn Alert 組件
 */

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertTriangle, BarChart3, FileSearch, FlaskConical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useImpactAnalysis } from '@/hooks/useImpactAnalysis'
import { useSimulation, toSimulationRequest } from '@/hooks/useSimulation'
import type { SimulationConfigFormData } from '@/hooks/useSimulation'
import { ImpactStatisticsCards } from './ImpactStatisticsCards'
import { RiskCasesTable } from './RiskCasesTable'
import { ImpactTimeline } from './ImpactTimeline'
import { SimulationConfigForm } from './SimulationConfigForm'
import { SimulationResultsPanel } from './SimulationResultsPanel'

// ============================================================
// Types
// ============================================================

interface ImpactAnalysisPanelProps {
  /** 規則建議 ID */
  suggestionId: string
  /** 額外的 className */
  className?: string
  /** 點擊文件時的回調 */
  onDocumentClick?: (documentId: string) => void
}

// ============================================================
// Sub Components
// ============================================================

/**
 * 載入骨架
 */
function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* 統計卡片骨架 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div>
                  <Skeleton className="h-7 w-12 mb-1" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 表格骨架 */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * 錯誤提示
 */
function ErrorAlert({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>載入失敗</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}

/**
 * 建議資訊頭部
 */
function SuggestionHeader({
  suggestion,
}: {
  suggestion: {
    fieldName: string
    forwarderName: string
    extractionType: string
  }
}) {
  return (
    <div className="mb-6 p-4 bg-muted/30 rounded-lg">
      <div className="flex items-center gap-6 text-sm">
        <div>
          <span className="text-muted-foreground">欄位：</span>
          <span className="font-medium ml-1">{suggestion.fieldName}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Forwarder：</span>
          <span className="font-medium ml-1">{suggestion.forwarderName}</span>
        </div>
        <div>
          <span className="text-muted-foreground">提取類型：</span>
          <span className="font-medium ml-1">{suggestion.extractionType}</span>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Component
// ============================================================

/**
 * 影響分析面板
 *
 * @description
 *   提供規則變更的完整影響分析視圖，包括：
 *   - AC1: 顯示影響分析報告（受影響文件、改善率、風險案例）
 *   - AC2: 提供模擬測試功能
 *   - AC3: 顯示對比結果（改善/惡化案例標記）
 *
 * @example
 * ```tsx
 * <ImpactAnalysisPanel
 *   suggestionId={suggestionId}
 *   onDocumentClick={(id) => router.push(`/documents/${id}`)}
 * />
 * ```
 */
export function ImpactAnalysisPanel({
  suggestionId,
  className,
  onDocumentClick,
}: ImpactAnalysisPanelProps) {
  // 獲取影響分析數據
  const {
    data: impactData,
    isLoading: isLoadingImpact,
    error: impactError,
  } = useImpactAnalysis(suggestionId)

  // 模擬測試
  const {
    mutate: runSimulation,
    data: simulationResult,
    isPending: isRunningSimulation,
    error: simulationError,
  } = useSimulation()

  // 處理模擬測試
  const handleRunSimulation = (config: SimulationConfigFormData) => {
    runSimulation({
      suggestionId,
      options: toSimulationRequest(config),
    })
  }

  // 載入中
  if (isLoadingImpact) {
    return (
      <div className={className}>
        <LoadingSkeleton />
      </div>
    )
  }

  // 錯誤
  if (impactError) {
    return (
      <div className={className}>
        <ErrorAlert message={impactError.message} />
      </div>
    )
  }

  // 無數據
  if (!impactData) {
    return (
      <div className={className}>
        <Alert>
          <FileSearch className="h-4 w-4" />
          <AlertTitle>無數據</AlertTitle>
          <AlertDescription>無法獲取影響分析數據</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* 建議資訊 */}
      <SuggestionHeader suggestion={impactData.suggestion} />

      {/* Tabs: 影響分析 / 模擬測試 */}
      <Tabs defaultValue="analysis">
        <TabsList>
          <TabsTrigger value="analysis" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            影響分析
          </TabsTrigger>
          <TabsTrigger value="simulation" className="gap-2">
            <FlaskConical className="h-4 w-4" />
            模擬測試
          </TabsTrigger>
        </TabsList>

        {/* 影響分析 Tab */}
        <TabsContent value="analysis" className="mt-6 space-y-6">
          {/* 統計卡片 */}
          <ImpactStatisticsCards statistics={impactData.statistics} />

          {/* 風險案例 */}
          <RiskCasesTable
            riskCases={impactData.riskCases}
            onCaseClick={onDocumentClick}
          />

          {/* 時間軸 */}
          <ImpactTimeline timeline={impactData.timeline} />
        </TabsContent>

        {/* 模擬測試 Tab */}
        <TabsContent value="simulation" className="mt-6 space-y-6">
          {/* 配置表單 */}
          <SimulationConfigForm
            onRun={handleRunSimulation}
            isRunning={isRunningSimulation}
          />

          {/* 模擬錯誤 */}
          {simulationError && (
            <ErrorAlert message={simulationError.message} />
          )}

          {/* 模擬結果 */}
          {simulationResult && (
            <SimulationResultsPanel result={simulationResult} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
