'use client'

/**
 * @fileoverview 發票審計日誌組件
 * @description
 *   顯示發票的審計日誌和變更歷史：
 *   - 變更歷史時間軸
 *   - 操作記錄列表
 *   - 審核歷史
 *
 * @module src/components/features/invoice/detail/InvoiceAuditLog
 * @author Development Team
 * @since Epic 13 - Story 13-8 (Invoice Detail Page)
 * @lastModified 2026-01-18
 */

import * as React from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { formatDateTime, formatRelativeTime } from '@/lib/i18n-date'
import {
  User,
  Edit,
  CheckCircle,
  XCircle,
  Eye,
  Upload,
  RotateCcw,
  AlertCircle,
  FileText,
  History,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import type { Locale } from '@/i18n/config'

// ============================================================
// Types
// ============================================================

interface AuditLogEntry {
  id: string
  action: string
  entityType: string
  entityId: string
  changes?: Record<string, { old: unknown; new: unknown }> | null
  performedBy?: {
    id: string
    name?: string | null
    email?: string | null
  } | null
  performedAt: string | Date
  metadata?: Record<string, unknown> | null
}

interface InvoiceAuditLogProps {
  /** 文件 ID */
  documentId: string
}

interface AuditLogResponse {
  success: boolean
  data: AuditLogEntry[]
}

// ============================================================
// Constants
// ============================================================

const ACTION_CONFIG: Record<string, {
  icon: typeof User
  color: string
  bgColor: string
  labelEn: string
  labelZh: string
}> = {
  CREATE: {
    icon: Upload,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
    labelEn: 'Uploaded',
    labelZh: '上傳',
  },
  UPDATE: {
    icon: Edit,
    color: 'text-amber-500',
    bgColor: 'bg-amber-50',
    labelEn: 'Updated',
    labelZh: '更新',
  },
  APPROVE: {
    icon: CheckCircle,
    color: 'text-green-500',
    bgColor: 'bg-green-50',
    labelEn: 'Approved',
    labelZh: '批准',
  },
  REJECT: {
    icon: XCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-50',
    labelEn: 'Rejected',
    labelZh: '拒絕',
  },
  VIEW: {
    icon: Eye,
    color: 'text-gray-500',
    bgColor: 'bg-gray-50',
    labelEn: 'Viewed',
    labelZh: '查看',
  },
  RETRY: {
    icon: RotateCcw,
    color: 'text-purple-500',
    bgColor: 'bg-purple-50',
    labelEn: 'Retried',
    labelZh: '重試',
  },
  FIELD_CORRECTION: {
    icon: Edit,
    color: 'text-orange-500',
    bgColor: 'bg-orange-50',
    labelEn: 'Field Corrected',
    labelZh: '欄位修正',
  },
  STATUS_CHANGE: {
    icon: FileText,
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-50',
    labelEn: 'Status Changed',
    labelZh: '狀態變更',
  },
}

const DEFAULT_CONFIG = {
  icon: History,
  color: 'text-gray-500',
  bgColor: 'bg-gray-50',
  labelEn: 'Action',
  labelZh: '操作',
}

// ============================================================
// Helper Functions
// ============================================================

function getUserInitials(name?: string | null, email?: string | null): string {
  if (name) {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }
  if (email) {
    return email[0].toUpperCase()
  }
  return '?'
}

// ============================================================
// Component
// ============================================================

/**
 * 審計日誌組件
 */
export function InvoiceAuditLog({ documentId }: InvoiceAuditLogProps) {
  const t = useTranslations('invoices')
  const locale = useLocale() as Locale
  const isZh = locale === 'zh-TW' || locale === 'zh-CN'

  // 獲取審計日誌
  const { data, isLoading, isError } = useQuery<AuditLogResponse>({
    queryKey: ['document-audit', documentId],
    queryFn: async () => {
      const response = await fetch(`/api/audit/logs?entityType=DOCUMENT&entityId=${documentId}`)
      if (!response.ok) throw new Error('Failed to fetch audit logs')
      return response.json()
    },
  })

  const logs = data?.data || []

  // Loading
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-5 w-48 mb-2" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Error
  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {t('detail.errors.auditFailed')}
        </AlertDescription>
      </Alert>
    )
  }

  // Empty
  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500">
        <History className="h-12 w-12 mb-4 text-gray-300" />
        <p>{t('detail.empty.noAuditLogs')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 標題 */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t('detail.audit.title')}</h3>
        <Badge variant="secondary">{logs.length} {t('detail.audit.entries')}</Badge>
      </div>

      {/* 日誌列表 */}
      <div className="space-y-4">
        {logs.map((log) => {
          const config = ACTION_CONFIG[log.action] || DEFAULT_CONFIG
          const Icon = config.icon
          const actionLabel = isZh ? config.labelZh : config.labelEn
          const userName = log.performedBy?.name || log.performedBy?.email || t('detail.audit.system')

          return (
            <div
              key={log.id}
              className={cn(
                'flex gap-4 p-4 rounded-lg border',
                config.bgColor,
                'border-gray-200'
              )}
            >
              {/* 用戶頭像 */}
              <Avatar className="h-10 w-10">
                <AvatarFallback className={cn(config.bgColor, config.color)}>
                  {log.performedBy ? getUserInitials(log.performedBy.name, log.performedBy.email) : (
                    <Icon className="h-5 w-5" />
                  )}
                </AvatarFallback>
              </Avatar>

              {/* 內容 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate">{userName}</span>
                  <Badge variant="outline" className={cn('font-normal', config.color)}>
                    <Icon className="h-3 w-3 mr-1" />
                    {actionLabel}
                  </Badge>
                </div>

                {/* 時間 */}
                <div className="mt-1 text-sm text-gray-500">
                  {formatDateTime(new Date(log.performedAt), locale)}
                  <span className="mx-2">•</span>
                  {formatRelativeTime(new Date(log.performedAt), locale)}
                </div>

                {/* 變更詳情 */}
                {log.changes && Object.keys(log.changes).length > 0 && (
                  <div className="mt-2 text-sm">
                    {Object.entries(log.changes).map(([field, change]) => (
                      <div key={field} className="flex gap-2 text-gray-600">
                        <span className="font-medium">{field}:</span>
                        <span className="text-red-500 line-through">
                          {String(change.old ?? '-')}
                        </span>
                        <span>→</span>
                        <span className="text-green-600">
                          {String(change.new ?? '-')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
