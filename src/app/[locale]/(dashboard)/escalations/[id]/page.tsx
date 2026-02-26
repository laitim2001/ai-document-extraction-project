/**
 * @fileoverview 升級案例詳情頁面
 * @description
 *   Super User 處理升級案例的詳情頁面，提供：
 *   - 升級案例完整資訊顯示
 *   - PDF 文件預覽
 *   - 提取欄位列表
 *   - 處理操作（核准/修正/拒絕）
 *
 * @module src/app/(dashboard)/escalations/[id]/page
 * @since Epic 3 - Story 3.8 (Super User 處理升級案例)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - next/navigation - URL 路由
 *   - @/components/features/escalation - 升級案例組件
 *   - @/hooks/useEscalationDetail - 詳情資料獲取
 *   - @/hooks/useResolveEscalation - 處理操作
 */

'use client'

import { useState, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  AlertCircle,
  FileText,
  CheckCircle,
  Edit,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import {
  EscalationStatusBadge,
  EscalationReasonBadge,
  ResolveDialog,
} from '@/components/features/escalation'
import { useEscalationDetail } from '@/hooks/useEscalationDetail'
import { useResolveEscalation } from '@/hooks/useResolveEscalation'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { toast } from 'sonner'
import type { ResolveEscalationRequest } from '@/types/escalation'

// ============================================================
// Types
// ============================================================

interface PageProps {
  params: Promise<{ id: string }>
}

// ============================================================
// Component
// ============================================================

/**
 * 升級案例詳情頁面
 * 顯示升級案例完整資訊並提供處理操作
 */
export default function EscalationDetailPage({ params }: PageProps) {
  const resolvedParams = use(params)
  const escalationId = resolvedParams.id
  const router = useRouter()

  // --- State ---
  const [showResolveDialog, setShowResolveDialog] = useState(false)

  // --- Data Fetching ---
  const { data: escalation, isLoading, error, refetch } = useEscalationDetail(escalationId)

  // --- Mutations ---
  const { mutate: resolveEscalation, isPending: isResolving } = useResolveEscalation({
    onSuccess: (data) => {
      const decisionLabels = {
        APPROVED: '核准',
        CORRECTED: '修正後核准',
        REJECTED: '拒絕',
      }
      toast.success(`案例已${decisionLabels[data.decision]}`)
      setShowResolveDialog(false)
      router.push('/escalations')
    },
    onError: (error) => {
      toast.error(`處理失敗：${error.message}`)
    },
  })

  // --- Handlers ---
  const handleResolve = useCallback(
    (data: ResolveEscalationRequest) => {
      resolveEscalation({
        escalationId,
        data,
      })
    },
    [escalationId, resolveEscalation]
  )

  // --- Loading State ---
  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[600px]" />
          <Skeleton className="h-[600px]" />
        </div>
      </div>
    )
  }

  // --- Error State ---
  if (error) {
    return (
      <div className="container mx-auto py-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>載入升級案例失敗：{error.message}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              重試
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  // --- Not Found State ---
  if (!escalation) {
    return (
      <div className="container mx-auto py-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>找不到此升級案例</AlertDescription>
        </Alert>
      </div>
    )
  }

  const isResolved = escalation.status === 'RESOLVED' || escalation.status === 'CANCELLED'

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 頁面標題 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/escalations">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">升級案例詳情</h1>
            <p className="text-muted-foreground">ID: {escalation.id}</p>
          </div>
        </div>
        {!isResolved && (
          <Button
            onClick={() => setShowResolveDialog(true)}
            className="bg-amber-600 hover:bg-amber-700"
          >
            <Edit className="h-4 w-4 mr-2" />
            處理此案例
          </Button>
        )}
      </div>

      {/* 狀態卡片 */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">狀態</p>
              <EscalationStatusBadge status={escalation.status} className="mt-1" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">升級原因</p>
              <EscalationReasonBadge reason={escalation.reason} showIcon className="mt-1" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">升級時間</p>
              <p className="text-sm font-medium mt-1">
                {formatDistanceToNow(new Date(escalation.createdAt), {
                  addSuffix: true,
                  locale: zhTW,
                })}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">升級者</p>
              <p className="text-sm font-medium mt-1">
                {escalation.escalatedBy.name || escalation.escalatedBy.email}
              </p>
            </div>
          </div>
          {escalation.reasonDetail && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">詳細說明</p>
              <p className="text-sm mt-1">{escalation.reasonDetail}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 主內容區域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PDF 預覽區域 */}
        <Card className="lg:row-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              文件預覽
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground mb-2">
                文件：{escalation.document.fileName}
              </p>
              {escalation.document.fileUrl ? (
                <div className="aspect-[3/4] bg-white rounded border">
                  <iframe
                    src={escalation.document.fileUrl}
                    className="w-full h-full"
                    title="PDF Preview"
                  />
                </div>
              ) : (
                <div className="aspect-[3/4] bg-white rounded border flex items-center justify-center">
                  <p className="text-muted-foreground">無法載入 PDF</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 提取欄位 */}
        <Card>
          <CardHeader>
            <CardTitle>提取欄位</CardTitle>
          </CardHeader>
          <CardContent>
            {escalation.document.extractionResult?.fields &&
            escalation.document.extractionResult.fields.length > 0 ? (
              <div className="space-y-2">
                {escalation.document.extractionResult.fields.map((field) => (
                  <div
                    key={field.id}
                    className="flex items-center justify-between p-2 rounded-lg border"
                  >
                    <div>
                      <p className="text-sm font-medium">{field.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {field.value || '(空)'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-sm font-medium ${
                          field.confidence >= 90
                            ? 'text-green-600'
                            : field.confidence >= 70
                              ? 'text-amber-600'
                              : 'text-red-600'
                        }`}
                      >
                        {field.confidence}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">無提取欄位</p>
            )}
          </CardContent>
        </Card>

        {/* 修正記錄 */}
        {escalation.corrections.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>修正記錄</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {escalation.corrections.map((correction) => (
                  <div
                    key={correction.id}
                    className="p-2 rounded-lg border space-y-1"
                  >
                    <p className="text-sm font-medium">{correction.fieldName}</p>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground line-through">
                        {correction.originalValue || '(空)'}
                      </span>
                      <span>→</span>
                      <span className="text-green-600">{correction.correctedValue}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 處理結果（已解決時顯示） */}
        {isResolved && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {escalation.status === 'RESOLVED' ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-gray-600" />
                )}
                處理結果
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {escalation.resolvedBy && (
                  <div>
                    <p className="text-sm text-muted-foreground">處理者</p>
                    <p className="text-sm font-medium">{escalation.resolvedBy.name}</p>
                  </div>
                )}
                {escalation.resolvedAt && (
                  <div>
                    <p className="text-sm text-muted-foreground">處理時間</p>
                    <p className="text-sm font-medium">
                      {formatDistanceToNow(new Date(escalation.resolvedAt), {
                        addSuffix: true,
                        locale: zhTW,
                      })}
                    </p>
                  </div>
                )}
                {escalation.resolution && (
                  <div>
                    <p className="text-sm text-muted-foreground">處理說明</p>
                    <p className="text-sm">{escalation.resolution}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 處理對話框 */}
      <ResolveDialog
        open={showResolveDialog}
        onOpenChange={setShowResolveDialog}
        onConfirm={handleResolve}
        documentName={escalation.document.fileName}
        fields={escalation.document.extractionResult?.fields || []}
        isSubmitting={isResolving}
      />
    </div>
  )
}
