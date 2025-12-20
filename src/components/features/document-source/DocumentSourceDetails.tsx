/**
 * @fileoverview 文件來源詳情組件
 * @description
 *   顯示文件來源的詳細資訊，支援：
 *   - SharePoint 來源詳情（站點、路徑、連結）
 *   - Outlook 來源詳情（寄件者、主旨、附件資訊）
 *   - 手動上傳詳情（上傳者、上傳方式）
 *   - API 來源詳情（系統名稱、請求 ID）
 *
 * @module src/components/features/document-source/DocumentSourceDetails
 * @author Development Team
 * @since Epic 9 - Story 9.5 (自動獲取來源追蹤)
 * @lastModified 2025-12-20
 */

'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DocumentSourceBadge } from './DocumentSourceBadge'
import {
  FileText,
  Calendar,
  User,
  Mail,
  Link2,
  Folder,
  Clock,
  Paperclip,
  Upload,
  Globe,
  ExternalLink,
  FileSpreadsheet,
} from 'lucide-react'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import type { DocumentSourceInfo } from '@/types/document-source.types'

// ============================================================
// Types
// ============================================================

interface DocumentSourceDetailsProps {
  /** 文件 ID */
  documentId: string
  /** 是否為卡片模式 */
  asCard?: boolean
}

// ============================================================
// Component
// ============================================================

/**
 * @component DocumentSourceDetails
 * @description 顯示文件來源的詳細資訊
 */
export function DocumentSourceDetails({
  documentId,
  asCard = true,
}: DocumentSourceDetailsProps) {
  const {
    data: sourceInfo,
    isLoading,
    error,
  } = useQuery<{ data: DocumentSourceInfo }>({
    queryKey: ['document-source', documentId],
    queryFn: async () => {
      const response = await fetch(`/api/documents/${documentId}/source`)
      if (!response.ok) throw new Error('Failed to fetch source info')
      return response.json()
    },
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    )
  }

  if (error || !sourceInfo?.data) {
    return null
  }

  const { data } = sourceInfo
  const { details } = data

  const content = (
    <div className="space-y-4">
      {/* 共用資訊 */}
      <div className="space-y-2">
        <DetailRow
          icon={<FileText className="h-4 w-4" />}
          label="原始檔名"
          value={details.originalFileName}
        />
        <DetailRow
          icon={<Calendar className="h-4 w-4" />}
          label="獲取時間"
          value={formatDateTime(details.acquiredAt)}
        />
      </div>

      {/* SharePoint 詳情 */}
      {details.sharepoint && (
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-blue-600" />
            SharePoint 詳情
          </h4>
          <div className="space-y-2 pl-6">
            {details.sharepoint.siteName && (
              <DetailRow
                icon={<Folder className="h-4 w-4" />}
                label="站點"
                value={details.sharepoint.siteName}
              />
            )}
            {details.sharepoint.libraryPath && (
              <DetailRow
                icon={<Folder className="h-4 w-4" />}
                label="路徑"
                value={details.sharepoint.libraryPath}
              />
            )}
            {details.sharepoint.lastModifiedDateTime && (
              <DetailRow
                icon={<Clock className="h-4 w-4" />}
                label="最後修改"
                value={formatDateTime(details.sharepoint.lastModifiedDateTime)}
              />
            )}
            {details.sharepoint.webUrl && (
              <div className="flex items-center gap-2 text-sm">
                <Link2 className="h-4 w-4 text-muted-foreground" />
                <a
                  href={details.sharepoint.webUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline flex items-center gap-1"
                >
                  在 SharePoint 中查看
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Outlook 詳情 */}
      {details.outlook && (
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Mail className="h-4 w-4 text-cyan-600" />
            郵件詳情
          </h4>
          <div className="space-y-2 pl-6">
            <DetailRow
              icon={<User className="h-4 w-4" />}
              label="寄件者"
              value={
                details.outlook.senderName
                  ? `${details.outlook.senderName} <${details.outlook.senderEmail}>`
                  : details.outlook.senderEmail
              }
            />
            <DetailRow
              icon={<Mail className="h-4 w-4" />}
              label="主旨"
              value={details.outlook.subject}
            />
            <DetailRow
              icon={<Clock className="h-4 w-4" />}
              label="收件時間"
              value={formatDateTime(details.outlook.receivedAt)}
            />
            {details.outlook.totalAttachments > 1 && (
              <DetailRow
                icon={<Paperclip className="h-4 w-4" />}
                label="附件"
                value={`第 ${details.outlook.attachmentIndex + 1} 個，共 ${details.outlook.totalAttachments} 個`}
              />
            )}
          </div>
        </div>
      )}

      {/* 手動上傳詳情 */}
      {details.manual && (
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Upload className="h-4 w-4 text-gray-600" />
            上傳詳情
          </h4>
          <div className="space-y-2 pl-6">
            <DetailRow
              icon={<User className="h-4 w-4" />}
              label="上傳者"
              value={details.manual.uploadedByName || '未知'}
            />
            <DetailRow
              icon={<Upload className="h-4 w-4" />}
              label="上傳方式"
              value={details.manual.uploadMethod}
            />
          </div>
        </div>
      )}

      {/* API 詳情 */}
      {details.api && (
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Globe className="h-4 w-4 text-purple-600" />
            API 詳情
          </h4>
          <div className="space-y-2 pl-6">
            {details.api.systemName && (
              <DetailRow
                icon={<Globe className="h-4 w-4" />}
                label="系統"
                value={details.api.systemName}
              />
            )}
            {details.api.requestId && (
              <DetailRow
                icon={<FileText className="h-4 w-4" />}
                label="請求 ID"
                value={details.api.requestId}
                mono
              />
            )}
          </div>
        </div>
      )}
    </div>
  )

  if (!asCard) {
    return content
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">來源資訊</CardTitle>
          <DocumentSourceBadge sourceType={data.type} />
        </div>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  )
}

// ============================================================
// Helper Components
// ============================================================

/**
 * 詳情列元件
 */
function DetailRow({
  icon,
  label,
  value,
  mono = false,
}: {
  icon: React.ReactNode
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <span className="text-muted-foreground shrink-0">{label}：</span>
      <span className={`break-all ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </span>
    </div>
  )
}

/**
 * 日期格式化
 */
function formatDateTime(dateStr: string): string {
  try {
    return format(new Date(dateStr), 'yyyy/MM/dd HH:mm', { locale: zhTW })
  } catch {
    return dateStr
  }
}
