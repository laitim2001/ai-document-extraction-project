'use client'

/**
 * @fileoverview 文件追溯視圖組件
 * @description
 *   提供文件追溯鏈的視覺化展示：
 *   - 追溯鏈時間軸（從上傳到核准）
 *   - 修正記錄詳情
 *   - 變更歷史
 *   - 提取結果
 *   - 原始文件預覽
 *
 * @module src/components/audit/DocumentTraceView
 * @since Epic 8 - Story 8.4 (原始文件追溯)
 * @lastModified 2025-12-20
 *
 * @features
 *   - AC1: 查看原始文件（PDF/圖片）
 *   - AC2: 修正記錄追溯
 *   - AC3: 歸檔文件讀取
 *   - AC4: 追溯報告生成
 *
 * @dependencies
 *   - @tanstack/react-query - 數據獲取
 *   - date-fns - 日期格式化
 *   - lucide-react - 圖標
 *   - @/components/ui/* - UI 組件
 *   - @/types/traceability - 類型定義
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import {
  FileText,
  Eye,
  Edit3,
  CheckCircle,
  Clock,
  ArrowRight,
  Download,
  ExternalLink,
  FileCheck,
  Loader2,
  AlertCircle
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { DocumentTraceChain, TraceabilityReport } from '@/types/traceability'

// ============================================================
// Types
// ============================================================

interface DocumentTraceViewProps {
  /** 文件 ID */
  documentId: string
}

interface TraceNodeProps {
  icon: React.ReactNode
  title: string
  subtitle: string
  time?: string
  status: 'completed' | 'warning' | 'pending'
  onClick?: () => void
}

// ============================================================
// API Functions
// ============================================================

async function fetchDocumentTrace(documentId: string): Promise<DocumentTraceChain> {
  const response = await fetch(`/api/documents/${documentId}/trace`)
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch trace')
  }
  return (await response.json()).data
}

async function generateReport(documentId: string): Promise<TraceabilityReport> {
  const response = await fetch(`/api/documents/${documentId}/trace/report`, {
    method: 'POST'
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to generate report')
  }
  return (await response.json()).data
}

// ============================================================
// Sub Components
// ============================================================

/**
 * 追溯節點組件
 */
function TraceNode({
  icon,
  title,
  subtitle,
  time,
  status,
  onClick
}: TraceNodeProps) {
  const statusStyles = {
    completed: 'border-green-200 bg-green-50',
    warning: 'border-amber-200 bg-amber-50',
    pending: 'border-gray-200 bg-gray-50'
  }

  return (
    <div
      className={`flex-shrink-0 p-3 rounded-lg border-2 min-w-[140px] ${statusStyles[status]} ${
        onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="font-medium text-sm">{title}</span>
      </div>
      <div className="text-xs text-muted-foreground">{subtitle}</div>
      {time && (
        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {format(new Date(time), 'MM-dd HH:mm')}
        </div>
      )}
    </div>
  )
}

// ============================================================
// Main Component
// ============================================================

/**
 * 文件追溯視圖組件
 *
 * @description
 *   展示文件的完整追溯鏈，包含從上傳到核准的所有步驟。
 *   支援查看原始文件、修正記錄、變更歷史等。
 */
export function DocumentTraceView({ documentId }: DocumentTraceViewProps) {
  // --- State ---
  const [showSource, setShowSource] = useState(false)
  const queryClient = useQueryClient()

  // --- Queries ---
  const {
    data: traceChain,
    isLoading,
    error
  } = useQuery<DocumentTraceChain>({
    queryKey: ['document-trace', documentId],
    queryFn: () => fetchDocumentTrace(documentId)
  })

  // --- Mutations ---
  const reportMutation = useMutation({
    mutationFn: () => generateReport(documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-trace', documentId] })
    }
  })

  // --- Render: Loading ---
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse h-24 bg-muted rounded-lg" />
        ))}
      </div>
    )
  }

  // --- Render: Error ---
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {error instanceof Error ? error.message : '無法載入追溯資料'}
        </AlertDescription>
      </Alert>
    )
  }

  // --- Render: No Data ---
  if (!traceChain) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>找不到文件追溯資料</AlertDescription>
      </Alert>
    )
  }

  // --- Render: Main ---
  return (
    <div className="space-y-6">
      {/* 追溯鏈視覺化 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            文件追溯鏈
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => reportMutation.mutate()}
            disabled={reportMutation.isPending}
          >
            {reportMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileCheck className="mr-2 h-4 w-4" />
            )}
            生成報告
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 overflow-x-auto pb-4">
            {/* 原始文件 */}
            <TraceNode
              icon={<FileText className="h-4 w-4" />}
              title="原始文件"
              subtitle={traceChain.source.fileName}
              time={traceChain.source.uploadedAt}
              onClick={() => setShowSource(true)}
              status="completed"
            />
            <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />

            {/* OCR 處理 */}
            <TraceNode
              icon={<Eye className="h-4 w-4" />}
              title="OCR 處理"
              subtitle={`信心度: ${(traceChain.ocrResult.confidence * 100).toFixed(0)}%`}
              time={traceChain.ocrResult.processedAt}
              status="completed"
            />
            <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />

            {/* 欄位提取 */}
            <TraceNode
              icon={<Edit3 className="h-4 w-4" />}
              title="欄位提取"
              subtitle={`${Object.keys(traceChain.extractionResult.fields).length} 個欄位`}
              time={traceChain.extractionResult.extractedAt}
              status="completed"
            />

            {/* 人工修正（如有） */}
            {traceChain.corrections.length > 0 && (
              <>
                <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <TraceNode
                  icon={<Edit3 className="h-4 w-4" />}
                  title="人工修正"
                  subtitle={`${traceChain.corrections.length} 次修正`}
                  time={
                    traceChain.corrections[traceChain.corrections.length - 1]
                      .correctedAt
                  }
                  status="warning"
                />
              </>
            )}

            {/* 核准 */}
            <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <TraceNode
              icon={<CheckCircle className="h-4 w-4" />}
              title={
                traceChain.approvals[0]?.autoApproved ? '自動核准' : '人工核准'
              }
              subtitle={traceChain.approvals[0]?.approvedByName || '—'}
              time={traceChain.approvals[0]?.approvedAt}
              status="completed"
            />
          </div>
        </CardContent>
      </Card>

      {/* 報告生成成功提示 */}
      {reportMutation.isSuccess && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            追溯報告已成功生成。報告 ID: {reportMutation.data?.reportId}
          </AlertDescription>
        </Alert>
      )}

      {/* 報告生成錯誤提示 */}
      {reportMutation.isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {reportMutation.error instanceof Error
              ? reportMutation.error.message
              : '無法生成報告'}
          </AlertDescription>
        </Alert>
      )}

      {/* 詳細資訊標籤 */}
      <Tabs defaultValue="corrections">
        <TabsList>
          <TabsTrigger value="corrections">
            修正記錄 ({traceChain.corrections.length})
          </TabsTrigger>
          <TabsTrigger value="history">
            變更歷史 ({traceChain.changeHistory.length})
          </TabsTrigger>
          <TabsTrigger value="extraction">提取結果</TabsTrigger>
        </TabsList>

        {/* 修正記錄 */}
        <TabsContent value="corrections" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {traceChain.corrections.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  無修正記錄
                </p>
              ) : (
                <div className="space-y-4">
                  {traceChain.corrections.map((c) => (
                    <div key={c.correctionId} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">{c.field}</div>
                          <Badge variant="outline" className="mt-1">
                            {c.correctionType}
                          </Badge>
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          <div>{c.correctedByName}</div>
                          <div>
                            {format(new Date(c.correctedAt), 'yyyy-MM-dd HH:mm', {
                              locale: zhTW
                            })}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">修正前</div>
                          <div className="mt-1 p-2 bg-red-50 rounded border border-red-200">
                            {String(c.originalValue) || '(空)'}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">修正後</div>
                          <div className="mt-1 p-2 bg-green-50 rounded border border-green-200">
                            {String(c.correctedValue) || '(空)'}
                          </div>
                        </div>
                      </div>
                      {c.reason && (
                        <div className="mt-2 text-sm text-muted-foreground">
                          原因：{c.reason}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 變更歷史 */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {traceChain.changeHistory.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  無變更歷史
                </p>
              ) : (
                <div className="space-y-2">
                  {traceChain.changeHistory.map((h, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 border rounded"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">v{h.version}</Badge>
                        <span>{h.changeType}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {h.changedBy} ·{' '}
                        {format(new Date(h.changedAt), 'yyyy-MM-dd HH:mm')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 提取結果 */}
        <TabsContent value="extraction" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <pre className="text-sm bg-muted p-4 rounded overflow-auto max-h-[400px]">
                {JSON.stringify(traceChain.extractionResult.fields, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 原始文件對話框 */}
      <Dialog open={showSource} onOpenChange={setShowSource}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {traceChain.source.fileName}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span>
                大小: {(traceChain.source.fileSize / 1024).toFixed(1)} KB
              </span>
              <span>儲存: {traceChain.source.storageLocation}</span>
            </div>
            <div className="border rounded-lg overflow-hidden h-[60vh]">
              {traceChain.source.fileType.includes('pdf') ? (
                <iframe
                  src={traceChain.source.url}
                  className="w-full h-full"
                  title="原始文件"
                />
              ) : (
                <img
                  src={traceChain.source.url}
                  alt="原始文件"
                  className="max-w-full max-h-full object-contain mx-auto"
                />
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" asChild>
                <a
                  href={traceChain.source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  新視窗
                </a>
              </Button>
              <Button asChild>
                <a href={traceChain.source.url} download>
                  <Download className="mr-2 h-4 w-4" />
                  下載
                </a>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
