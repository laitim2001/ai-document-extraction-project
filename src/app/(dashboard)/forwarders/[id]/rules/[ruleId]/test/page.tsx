'use client'

/**
 * @fileoverview 規則測試頁面
 * @description
 *   Story 5-4: 測試規則變更效果 - 主頁面
 *   提供規則批次測試的完整工作流：
 *   1. 配置測試範圍和參數
 *   2. 啟動測試並監控進度
 *   3. 查看測試結果統計
 *   4. 瀏覽詳細比較結果
 *   5. 下載測試報告
 *
 * @module src/app/(dashboard)/forwarders/[id]/rules/[ruleId]/test/page
 * @since Epic 5 - Story 5.4 (測試規則變更效果)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @/components/features/rules/* - 規則相關組件
 *   - @/hooks/useRuleTest - 測試 Hooks
 *   - @/types/rule-test - 類型定義
 */

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  ArrowLeft,
  FileSpreadsheet,
  FileText,
  Loader2,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { RuleTestConfig } from '@/components/features/rules/RuleTestConfig'
import { ImpactStatistics } from '@/components/features/rules/ImpactStatistics'
import { TestResultComparison } from '@/components/features/rules/TestResultComparison'
import {
  useStartRuleTest,
  useTestTask,
  useTestDetails,
  useCancelTestTask,
  useDownloadReport,
} from '@/hooks/useRuleTest'
import type { TestConfig, TestChangeType } from '@/types/rule-test'

// ============================================================
// Types
// ============================================================

interface Props {
  params: Promise<{ id: string; ruleId: string }>
}

interface RuleInfo {
  id: string
  fieldName: string
  fieldLabel: string
  extractionPattern: unknown
  forwarder: {
    id: string
    name: string
    code: string
  }
}

// ============================================================
// API Functions
// ============================================================

async function fetchRule(ruleId: string): Promise<RuleInfo> {
  const response = await fetch(`/api/rules/${ruleId}`)
  if (!response.ok) throw new Error('Failed to fetch rule')
  const result = await response.json()
  return result.data
}

// ============================================================
// Component
// ============================================================

export default function RuleTestPage({ params }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // --- State ---
  const [resolvedParams, setResolvedParams] = useState<{
    id: string
    ruleId: string
  } | null>(null)
  const [testConfig, setTestConfig] = useState<TestConfig>({
    scope: 'recent',
    recentCount: 100,
  })
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [detailsPage, setDetailsPage] = useState(1)
  const [changeTypeFilter, setChangeTypeFilter] = useState<
    TestChangeType | undefined
  >(undefined)

  // Resolve params
  useEffect(() => {
    params.then(setResolvedParams)
  }, [params])

  // Get test pattern from search params
  const testPatternParam = searchParams.get('pattern')
  const testPattern = testPatternParam
    ? JSON.parse(decodeURIComponent(testPatternParam))
    : null

  // --- Queries ---
  const { data: rule, isLoading: isLoadingRule } = useQuery({
    queryKey: ['rule', resolvedParams?.ruleId],
    queryFn: () => fetchRule(resolvedParams!.ruleId),
    enabled: !!resolvedParams?.ruleId,
  })

  const { data: taskData } = useTestTask(activeTaskId, {
    refetchInterval: 2000,
    stopPollingOnComplete: true,
  })

  const { data: detailsData, isLoading: isLoadingDetails } = useTestDetails(
    taskData?.status === 'COMPLETED' ? activeTaskId : null,
    {
      page: detailsPage,
      pageSize: 20,
      changeType: changeTypeFilter,
    }
  )

  // --- Mutations ---
  const startTestMutation = useStartRuleTest({
    onSuccess: (data) => {
      setActiveTaskId(data.data.taskId)
      toast.success(data.data.message)
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const cancelTestMutation = useCancelTestTask({
    onSuccess: () => {
      toast.success('測試已取消')
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const downloadReportMutation = useDownloadReport({
    onSuccess: () => {
      toast.success('報告下載成功')
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  // --- Handlers ---

  const handleStartTest = () => {
    if (!resolvedParams?.ruleId || !testPattern) return

    startTestMutation.mutate({
      ruleId: resolvedParams.ruleId,
      testPattern,
      config: testConfig,
    })
  }

  const handleCancelTest = () => {
    if (!activeTaskId) return
    cancelTestMutation.mutate(activeTaskId)
  }

  const handleDownloadPDF = () => {
    if (!activeTaskId) return
    downloadReportMutation.mutate({ taskId: activeTaskId, format: 'pdf' })
  }

  const handleDownloadExcel = () => {
    if (!activeTaskId) return
    downloadReportMutation.mutate({ taskId: activeTaskId, format: 'excel' })
  }

  const handleBack = () => {
    router.back()
  }

  // --- Loading State ---

  if (!resolvedParams || isLoadingRule) {
    return (
      <div className="container max-w-6xl py-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    )
  }

  // --- No Pattern State ---

  if (!testPattern) {
    return (
      <div className="container max-w-6xl py-6 space-y-6">
        <Button variant="ghost" onClick={handleBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回
        </Button>
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>缺少測試模式</AlertTitle>
          <AlertDescription>
            請從規則編輯頁面啟動測試，需要提供要測試的規則模式。
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  // --- Main Render ---

  const isTestRunning =
    taskData?.status === 'PENDING' || taskData?.status === 'RUNNING'
  const isTestCompleted = taskData?.status === 'COMPLETED'
  const isTestFailed = taskData?.status === 'FAILED'

  return (
    <div className="container max-w-6xl py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Button>
          <div>
            <h1 className="text-2xl font-bold">測試規則變更</h1>
            <p className="text-muted-foreground">
              {rule?.fieldLabel || rule?.fieldName} -{' '}
              {rule?.forwarder.name}
            </p>
          </div>
        </div>

        {/* Download Buttons */}
        {isTestCompleted && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleDownloadExcel}
              disabled={downloadReportMutation.isPending}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Excel 報告
            </Button>
            <Button
              variant="outline"
              onClick={handleDownloadPDF}
              disabled={downloadReportMutation.isPending}
            >
              <FileText className="mr-2 h-4 w-4" />
              PDF 報告
            </Button>
          </div>
        )}
      </div>

      {/* Test Config - Only show before test starts */}
      {!activeTaskId && (
        <RuleTestConfig
          config={testConfig}
          onConfigChange={setTestConfig}
          onStartTest={handleStartTest}
          isLoading={startTestMutation.isPending}
        />
      )}

      {/* Progress - Show during test */}
      {isTestRunning && taskData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              測試進行中
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>
                  已測試 {taskData.testedDocuments} / {taskData.totalDocuments} 份文件
                </span>
                <span>{taskData.progress}%</span>
              </div>
              <Progress value={taskData.progress} />
            </div>
            <Button variant="destructive" onClick={handleCancelTest}>
              取消測試
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Error - Show if test failed */}
      {isTestFailed && taskData && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>測試失敗</AlertTitle>
          <AlertDescription>
            {taskData.errorMessage || '測試過程中發生錯誤'}
          </AlertDescription>
        </Alert>
      )}

      {/* Results - Show after test completes */}
      {isTestCompleted && taskData?.results && (
        <>
          <ImpactStatistics
            results={taskData.results}
            totalDocuments={taskData.totalDocuments}
          />

          <TestResultComparison
            details={detailsData?.details || []}
            pagination={
              detailsData?.pagination || {
                total: 0,
                page: 1,
                pageSize: 20,
                totalPages: 0,
              }
            }
            changeTypeFilter={changeTypeFilter}
            onFilterChange={setChangeTypeFilter}
            onPageChange={setDetailsPage}
            isLoading={isLoadingDetails}
          />
        </>
      )}
    </div>
  )
}
