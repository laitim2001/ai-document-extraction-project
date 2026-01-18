'use client'

/**
 * @fileoverview 發票詳情統計卡片組件
 * @description
 *   顯示發票處理的四個統計摘要卡片：
 *   - 處理狀態
 *   - 信心度
 *   - 上傳資訊
 *   - 來源資訊
 *
 * @module src/components/features/invoice/detail/InvoiceDetailStats
 * @author Development Team
 * @since Epic 13 - Story 13-8 (Invoice Detail Page)
 * @lastModified 2026-01-18
 */

import * as React from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ProcessingStatus } from '@/components/features/invoice/ProcessingStatus'
import { ConfidenceBadge } from '@/components/features/confidence/ConfidenceBadge'
import { DocumentSourceBadge } from '@/components/features/document-source/DocumentSourceBadge'
import { formatRelativeTime, formatDateTime } from '@/lib/i18n-date'
import {
  Activity,
  TrendingUp,
  Upload,
  FileInput,
  Clock,
  User,
} from 'lucide-react'
import type { DocumentSourceType } from '@prisma/client'
import type { DocumentStatusKey } from '@/lib/document-status'
import type { Locale } from '@/i18n/config'

// ============================================================
// Types
// ============================================================

interface DocumentData {
  id: string
  status: DocumentStatusKey | string
  overallConfidence?: number | null
  processingPath?: string | null
  createdAt: string | Date
  updatedAt: string | Date
  sourceType?: DocumentSourceType | string | null
  uploadedBy?: {
    name?: string | null
    email?: string | null
  } | null
  processingStartedAt?: string | Date | null
  processingCompletedAt?: string | Date | null
}

interface InvoiceDetailStatsProps {
  /** 文件數據 */
  document: DocumentData
}

// ============================================================
// Helper Functions
// ============================================================

function calculateDuration(
  startDate: string | Date | null | undefined,
  endDate: string | Date | null | undefined
): number | null {
  if (!startDate || !endDate) return null
  const start = new Date(startDate).getTime()
  const end = new Date(endDate).getTime()
  return Math.round((end - start) / 1000) // 秒
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '-'
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ${seconds % 60}s`
  return `${Math.floor(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`
}

// ============================================================
// Component
// ============================================================

/**
 * 發票詳情統計卡片
 *
 * @description
 *   顯示四個統計摘要卡片
 */
export function InvoiceDetailStats({ document }: InvoiceDetailStatsProps) {
  const t = useTranslations('invoices')
  const locale = useLocale() as Locale

  const duration = calculateDuration(
    document.processingStartedAt,
    document.processingCompletedAt
  )

  const uploaderName = document.uploadedBy?.name || document.uploadedBy?.email || '-'
  const uploadTime = new Date(document.createdAt)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 處理狀態卡片 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
            <Activity className="h-4 w-4" />
            {t('detail.stats.status')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <ProcessingStatus status={document.status} size="lg" />
          {document.processingPath && (
            <div className="text-sm text-gray-500">
              {t(`processingPath.${document.processingPath}`)}
            </div>
          )}
          {duration !== null && (
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <Clock className="h-3 w-3" />
              <span>{t('detail.stats.processingTime')}: {formatDuration(duration)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 信心度卡片 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            {t('detail.stats.confidence')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {document.overallConfidence !== null && document.overallConfidence !== undefined ? (
            <>
              <div className="text-3xl font-bold">
                {document.overallConfidence.toFixed(1)}%
              </div>
              <ConfidenceBadge
                score={document.overallConfidence}
                locale={locale === 'zh-TW' || locale === 'zh-CN' ? 'zh' : 'en'}
              />
            </>
          ) : (
            <div className="text-2xl font-bold text-gray-400">-</div>
          )}
        </CardContent>
      </Card>

      {/* 上傳資訊卡片 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
            <Upload className="h-4 w-4" />
            {t('detail.stats.uploadInfo')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium truncate" title={uploaderName}>
              {uploaderName}
            </span>
          </div>
          <div className="text-sm text-gray-500">
            {formatDateTime(uploadTime, locale)}
          </div>
          <div className="text-xs text-gray-400">
            {formatRelativeTime(uploadTime, locale)}
          </div>
        </CardContent>
      </Card>

      {/* 來源資訊卡片 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
            <FileInput className="h-4 w-4" />
            {t('detail.stats.source')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {document.sourceType ? (
            <DocumentSourceBadge
              sourceType={document.sourceType}
              size="lg"
            />
          ) : (
            <DocumentSourceBadge
              sourceType="MANUAL"
              size="lg"
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
