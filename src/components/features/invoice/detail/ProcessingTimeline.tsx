'use client'

/**
 * @fileoverview 發票處理時間軸組件
 * @description
 *   顯示發票處理的各個步驟及其狀態：
 *   - 步驟狀態（待處理、處理中、完成、失敗）
 *   - 步驟耗時
 *   - 錯誤訊息
 *
 * @module src/components/features/invoice/detail/ProcessingTimeline
 * @author Development Team
 * @since Epic 13 - Story 13-8 (Invoice Detail Page)
 * @lastModified 2026-01-18
 */

import * as React from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/i18n-date'
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { Locale } from '@/i18n/config'

// ============================================================
// Types
// ============================================================

interface ProcessingStep {
  step: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  startedAt?: string | Date | null
  completedAt?: string | Date | null
  error?: string | null
  duration?: number | null
}

interface ProcessingTimelineProps {
  /** 文件 ID */
  documentId: string
  /** 預載入的步驟（可選） */
  steps?: ProcessingStep[] | null
}

interface TraceResponse {
  success: boolean
  data: {
    steps: ProcessingStep[]
    startTime: string
    endTime: string | null
    totalDuration: number | null
    errorMessage: string | null
  }
}

// ============================================================
// Constants
// ============================================================

const STEP_LABELS: Record<string, { en: string; zh: string }> = {
  UPLOAD: { en: 'File Upload', zh: '文件上傳' },
  OCR_EXTRACTION: { en: 'OCR Extraction', zh: 'OCR 提取' },
  FIELD_MAPPING: { en: 'Field Mapping', zh: '欄位映射' },
  CONFIDENCE_CALCULATION: { en: 'Confidence Calculation', zh: '信心度計算' },
  ROUTING_DECISION: { en: 'Routing Decision', zh: '路由決策' },
  REVIEW: { en: 'Manual Review', zh: '人工審核' },
  COMPLETION: { en: 'Processing Complete', zh: '處理完成' },
}

const STATUS_CONFIG: Record<ProcessingStep['status'], {
  icon: typeof Clock
  color: string
  bgColor: string
  borderColor: string
  animate?: boolean
}> = {
  pending: {
    icon: Clock,
    color: 'text-gray-400',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-300',
  },
  processing: {
    icon: Loader2,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-300',
    animate: true,
  },
  completed: {
    icon: CheckCircle,
    color: 'text-green-500',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-300',
  },
  failed: {
    icon: XCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-300',
  },
}

// ============================================================
// Helper Functions
// ============================================================

function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '-'
  if (seconds < 1) return '<1s'
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`
  return `${Math.floor(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`
}

// ============================================================
// Component
// ============================================================

/**
 * 處理時間軸組件
 */
export function ProcessingTimeline({
  documentId,
  steps: preloadedSteps,
}: ProcessingTimelineProps) {
  const t = useTranslations('invoices')
  const locale = useLocale() as Locale
  const isZh = locale === 'zh-TW' || locale === 'zh-CN'

  // 獲取處理追蹤數據
  const { data, isLoading, isError } = useQuery<TraceResponse>({
    queryKey: ['document-trace', documentId],
    queryFn: async () => {
      const response = await fetch(`/api/documents/${documentId}/trace`)
      if (!response.ok) throw new Error('Failed to fetch trace')
      return response.json()
    },
    enabled: !preloadedSteps,
  })

  const steps = preloadedSteps || data?.data?.steps || []

  // Loading
  if (isLoading && !preloadedSteps) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-5 w-32 mb-2" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Error
  if (isError && !preloadedSteps) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {t('detail.errors.traceFailed')}
        </AlertDescription>
      </Alert>
    )
  }

  // Empty
  if (steps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500">
        <Clock className="h-12 w-12 mb-4 text-gray-300" />
        <p>{t('detail.empty.noProcessingSteps')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 標題 */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t('detail.timeline.title')}</h3>
        {data?.data?.totalDuration && (
          <span className="text-sm text-gray-500">
            {t('detail.timeline.totalTime')}: {formatDuration(data.data.totalDuration)}
          </span>
        )}
      </div>

      {/* 時間軸 */}
      <div className="relative">
        {/* 連接線 */}
        <div className="absolute left-5 top-5 bottom-5 w-0.5 bg-gray-200" />

        {/* 步驟列表 */}
        <div className="space-y-6">
          {steps.map((step, index) => {
            const config = STATUS_CONFIG[step.status]
            const Icon = config.icon
            const stepLabel = STEP_LABELS[step.step]
              ? (isZh ? STEP_LABELS[step.step].zh : STEP_LABELS[step.step].en)
              : step.step

            return (
              <div key={index} className="relative flex gap-4">
                {/* 圖標 */}
                <div
                  className={cn(
                    'relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2',
                    config.bgColor,
                    config.borderColor
                  )}
                >
                  <Icon
                    className={cn(
                      'h-5 w-5',
                      config.color,
                      config.animate && 'animate-spin'
                    )}
                  />
                </div>

                {/* 內容 */}
                <div className="flex-1 pb-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">{stepLabel}</h4>
                    {step.duration !== null && step.duration !== undefined && (
                      <span className="text-sm text-gray-500">
                        {formatDuration(step.duration)}
                      </span>
                    )}
                  </div>

                  {/* 時間 */}
                  <div className="mt-1 text-sm text-gray-500">
                    {step.startedAt && (
                      <span>
                        {formatDateTime(new Date(step.startedAt), locale)}
                      </span>
                    )}
                    {step.completedAt && step.startedAt && (
                      <span className="mx-2">→</span>
                    )}
                    {step.completedAt && (
                      <span>
                        {formatDateTime(new Date(step.completedAt), locale)}
                      </span>
                    )}
                  </div>

                  {/* 錯誤訊息 */}
                  {step.error && (
                    <Alert variant="destructive" className="mt-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-sm">
                        {step.error}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
