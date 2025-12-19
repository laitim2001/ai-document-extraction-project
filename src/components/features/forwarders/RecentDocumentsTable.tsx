'use client'

/**
 * @fileoverview 近期文件列表組件
 * @description
 *   顯示 Forwarder 最近處理的文件列表，包含：
 *   - 文件名稱和連結
 *   - 處理狀態
 *   - 信心度
 *   - 處理時間
 *
 * @module src/components/features/forwarders/RecentDocumentsTable
 * @author Development Team
 * @since Epic 5 - Story 5.2 (Forwarder Detail Config View)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @/types/forwarder - 類型定義
 *   - @/components/ui - UI 組件
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useForwarderDocuments } from '@/hooks/use-forwarder-detail'
import type { RecentDocumentItem } from '@/types/forwarder'
import { DOCUMENT_PROCESSING_STATUS_CONFIG } from '@/types/forwarder'
import { FileText, ExternalLink, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import Link from 'next/link'

// ============================================================
// Types
// ============================================================

interface RecentDocumentsTableProps {
  /** Forwarder ID */
  forwarderId: string
  /** 顯示數量限制 */
  limit?: number
}

// ============================================================
// Component
// ============================================================

/**
 * 近期文件列表組件
 *
 * @description
 *   顯示 Forwarder 最近處理的文件，支援查看文件詳情
 */
export function RecentDocumentsTable({
  forwarderId,
  limit = 10,
}: RecentDocumentsTableProps) {
  // 使用 hook 獲取近期文件
  const { documents, isLoading, error } = useForwarderDocuments(
    forwarderId,
    limit
  )

  // 格式化時間
  const formatTime = (date: Date | string | null) => {
    if (!date) return '-'
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: zhTW })
  }

  // 格式化信心度
  const formatConfidence = (confidence: number | null) => {
    if (confidence === null) return '-'
    return `${confidence}%`
  }

  // 獲取信心度樣式
  const getConfidenceStyle = (confidence: number | null) => {
    if (confidence === null) return 'text-muted-foreground'
    if (confidence >= 90) return 'text-green-600 font-medium'
    if (confidence >= 70) return 'text-yellow-600'
    return 'text-red-600'
  }

  // 載入中狀態
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            近期文件
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  // 錯誤狀態
  if (error) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-destructive">載入近期文件失敗</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          近期文件
          <span className="text-sm font-normal text-muted-foreground">
            (最近 {limit} 筆)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {documents.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            尚無處理紀錄
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>檔案名稱</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead className="text-right">信心度</TableHead>
                <TableHead>處理時間</TableHead>
                <TableHead className="w-[80px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc: RecentDocumentItem) => (
                <TableRow key={doc.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium truncate max-w-[200px]">
                        {doc.fileName}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={DOCUMENT_PROCESSING_STATUS_CONFIG[doc.status].className}>
                      {DOCUMENT_PROCESSING_STATUS_CONFIG[doc.status].label}
                    </Badge>
                  </TableCell>
                  <TableCell className={`text-right ${getConfidenceStyle(doc.confidence)}`}>
                    {formatConfidence(doc.confidence)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatTime(doc.processedAt)}
                  </TableCell>
                  <TableCell>
                    <Link href={`/documents/${doc.id}`}>
                      <Button variant="ghost" size="sm">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
