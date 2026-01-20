'use client'

/**
 * @fileoverview 歷史數據管理頁面
 * @description
 *   提供歷史數據批次的管理介面：
 *   - 批次列表查看
 *   - 建立新批次
 *   - 批次詳情與文件管理
 *   - 文件上傳和類型修正
 *
 * @module src/app/(dashboard)/admin/historical-data/page
 * @since Epic 0 - Story 0.1
 * @lastModified 2025-12-23
 *
 * @features
 *   - 批量文件上傳（500 個文件，每個 50MB）
 *   - 自動元數據檢測
 *   - 手動類型修正
 *   - 批次操作管理
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { useRouter, usePathname } from '@/i18n/routing'
import { ArrowLeft, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import {
  BatchFileUploader,
  HistoricalFileList,
  HistoricalBatchList,
  CreateBatchDialog,
  ProcessingConfirmDialog,
  type CreateBatchData,
} from '@/components/features/historical-data'
import {
  estimateBatchCost,
  type BatchCostEstimation,
  type FileForCostEstimation,
} from '@/services/cost-estimation.service'
import {
  useHistoricalBatches,
  useHistoricalBatchDetail,
  useCreateBatch,
  useDeleteBatch,
  useDeleteFile,
  useUpdateFileType,
  type DetectedFileType,
  type HistoricalBatch,
} from '@/hooks/use-historical-data'

// ============================================================
// Component
// ============================================================

export default function HistoricalDataPage() {
  const t = useTranslations('historicalData')
  const { toast } = useToast()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'files' | 'upload'>('files')
  // 用於追蹤用戶手動返回列表，避免 useEffect 競態條件
  const isReturningToList = useRef(false)

  // 從 URL 參數讀取 batchId（從文件詳情頁返回時使用）
  useEffect(() => {
    // 如果用戶正在手動返回列表，跳過自動設置
    if (isReturningToList.current) {
      isReturningToList.current = false
      return
    }
    const batchIdFromUrl = searchParams.get('batchId')
    if (batchIdFromUrl && !selectedBatchId) {
      setSelectedBatchId(batchIdFromUrl)
    }
  }, [searchParams, selectedBatchId])

  // 處理確認對話框狀態
  const [processingDialogOpen, setProcessingDialogOpen] = useState(false)
  const [processingBatchId, setProcessingBatchId] = useState<string | null>(null)
  const [costEstimation, setCostEstimation] = useState<BatchCostEstimation | null>(null)
  const [isStartingProcess, setIsStartingProcess] = useState(false)

  // --- Queries ---

  const {
    data: batchesData,
    isLoading: isLoadingBatches,
    refetch: refetchBatches,
  } = useHistoricalBatches()

  const {
    data: batchDetailData,
    isLoading: isLoadingDetail,
    refetch: refetchDetail,
  } = useHistoricalBatchDetail(selectedBatchId)

  // --- Mutations ---

  const createBatchMutation = useCreateBatch()
  const deleteBatchMutation = useDeleteBatch()
  const deleteFileMutation = useDeleteFile()
  const updateFileTypeMutation = useUpdateFileType()

  // --- Handlers ---

  const handleCreateBatch = useCallback(
    async (data: CreateBatchData) => {
      try {
        const result = await createBatchMutation.mutateAsync({
          name: data.name,
          description: data.description,
          // Story 0.6: 公司識別配置
          enableCompanyIdentification: data.enableCompanyIdentification,
          fuzzyMatchThreshold: data.fuzzyMatchThreshold,
          autoMergeSimilar: data.autoMergeSimilar,
        })
        toast({
          title: t('page.toast.batchCreated'),
          description: t('page.toast.batchCreatedDesc', { name: data.name }),
        })
        // 自動選擇新建立的批次 - CHANGE-012: 使用 URL 導航
        setActiveTab('upload')
        router.push(`${pathname}?batchId=${result.data.id}`)
      } catch (error) {
        toast({
          variant: 'destructive',
          title: t('page.toast.createFailed'),
          description: error instanceof Error ? error.message : t('page.toast.createFailedDesc'),
        })
        throw error
      }
    },
    [createBatchMutation, toast, t, router, pathname]
  )

  const handleDeleteBatch = useCallback(
    async (batchId: string) => {
      try {
        await deleteBatchMutation.mutateAsync(batchId)
        toast({
          title: t('page.toast.batchDeleted'),
        })
        // CHANGE-012: 如果刪除的是當前選中的批次，使用 URL 導航清除
        if (selectedBatchId === batchId) {
          isReturningToList.current = true
          setSelectedBatchId(null)
          router.push(pathname)
        }
      } catch (error) {
        toast({
          variant: 'destructive',
          title: t('page.toast.deleteFailed'),
          description: error instanceof Error ? error.message : t('page.toast.deleteFailedDesc'),
        })
        throw error
      }
    },
    [deleteBatchMutation, selectedBatchId, toast, t, router, pathname]
  )

  const handleDeleteFile = useCallback(
    async (fileId: string) => {
      try {
        await deleteFileMutation.mutateAsync(fileId)
        toast({
          title: t('page.toast.fileDeleted'),
        })
        refetchDetail()
      } catch (error) {
        toast({
          variant: 'destructive',
          title: t('page.toast.fileDeleteFailed'),
          description: error instanceof Error ? error.message : t('page.toast.fileDeleteFailedDesc'),
        })
        throw error
      }
    },
    [deleteFileMutation, refetchDetail, toast, t]
  )

  const handleUpdateFileType = useCallback(
    async (fileId: string, detectedType: DetectedFileType) => {
      try {
        await updateFileTypeMutation.mutateAsync({ fileId, detectedType })
        toast({
          title: t('page.toast.typeUpdated'),
        })
        refetchDetail()
      } catch (error) {
        toast({
          variant: 'destructive',
          title: t('page.toast.typeUpdateFailed'),
          description: error instanceof Error ? error.message : t('page.toast.typeUpdateFailedDesc'),
        })
        throw error
      }
    },
    [updateFileTypeMutation, refetchDetail, toast, t]
  )

  const handleUploadComplete = useCallback(
    (results: { successful: number; failed: number }) => {
      toast({
        title: t('page.toast.uploadComplete'),
        description: t('page.toast.uploadCompleteDesc', { successful: results.successful, failed: results.failed }),
      })
      refetchDetail()
      setActiveTab('files')
    },
    [refetchDetail, toast, t]
  )

  /**
   * 選擇批次 - 更新 URL 以保持導航一致性
   * CHANGE-012: 使用 URL 參數管理批次選擇狀態
   */
  const handleSelectBatch = useCallback((batchId: string) => {
    router.push(`${pathname}?batchId=${batchId}`)
  }, [router, pathname])

  /**
   * 返回批次列表 - 清除 URL 參數
   */
  const handleBackToList = useCallback(() => {
    // 標記正在返回列表，避免 useEffect 競態條件又設置回 batchId
    isReturningToList.current = true
    setSelectedBatchId(null)
    refetchBatches()
    // 清除 URL 參數
    router.push(pathname)
  }, [refetchBatches, router, pathname])

  // --- 開始處理相關 Handlers ---

  /**
   * 打開處理確認對話框，計算成本估算
   */
  const handleStartProcessing = useCallback(
    async (batchId: string) => {
      // 找到該批次
      const batch = batchesData?.data?.find((b: HistoricalBatch) => b.id === batchId)
      if (!batch) {
        toast({
          variant: 'destructive',
          title: t('page.toast.batchNotFound'),
          description: t('page.toast.batchNotFoundDesc'),
        })
        return
      }

      // 先獲取批次詳情以計算成本
      try {
        const response = await fetch(`/api/admin/historical-data/batches/${batchId}`)
        if (!response.ok) {
          throw new Error(t('page.toast.fetchDetailFailedDesc'))
        }
        const { data } = await response.json()
        const files: FileForCostEstimation[] = data.files.map((file: { id: string; detectedType: string | null; metadata: { pageCount?: number } | null }) => ({
          id: file.id,
          detectedType: file.detectedType,
          pageCount: file.metadata?.pageCount,
        }))

        // 計算成本估算
        const estimation = estimateBatchCost(files)

        // 設置狀態並打開對話框
        setProcessingBatchId(batchId)
        setCostEstimation(estimation)
        setProcessingDialogOpen(true)
      } catch (error) {
        toast({
          variant: 'destructive',
          title: t('page.toast.fetchDetailFailed'),
          description: error instanceof Error ? error.message : t('page.toast.fetchDetailFailedDesc'),
        })
      }
    },
    [batchesData, toast, t]
  )

  /**
   * 確認開始處理批次
   */
  const handleConfirmProcessing = useCallback(async () => {
    if (!processingBatchId) return

    setIsStartingProcess(true)
    try {
      const response = await fetch(
        `/api/admin/historical-data/batches/${processingBatchId}/process`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || t('page.toast.startProcessingFailed'))
      }

      toast({
        title: t('page.toast.processingStarted'),
        description: t('page.toast.processingStartedDesc'),
      })

      setProcessingDialogOpen(false)
      refetchBatches()
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('page.toast.startProcessingFailed'),
        description: error instanceof Error ? error.message : t('page.toast.startProcessingFailedDesc'),
      })
    } finally {
      setIsStartingProcess(false)
    }
  }, [processingBatchId, refetchBatches, toast, t])

  // --- Render: Batch Detail View ---

  if (selectedBatchId) {
    const batch = batchDetailData?.data
    const files = batch?.files || []

    return (
      <div className="space-y-6">
        {/* 頁面標題 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={handleBackToList}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {batch?.name || t('page.loading')}
              </h1>
              {batch?.description && (
                <p className="text-muted-foreground">{batch.description}</p>
              )}
            </div>
          </div>
        </div>

        {/* 批次內容標籤頁 */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'files' | 'upload')}>
          <TabsList>
            <TabsTrigger value="files">
              {t('page.tabs.files')} ({files.length})
            </TabsTrigger>
            <TabsTrigger value="upload">
              <Upload className="h-4 w-4 mr-2" />
              {t('page.tabs.upload')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="files" className="mt-4">
            <HistoricalFileList
              batchId={selectedBatchId}
              files={files}
              isLoading={isLoadingDetail}
              onDeleteFile={handleDeleteFile}
              onUpdateFileType={handleUpdateFileType}
              onRefresh={() => refetchDetail()}
            />
          </TabsContent>

          <TabsContent value="upload" className="mt-4">
            <BatchFileUploader
              batchId={selectedBatchId}
              onUploadComplete={handleUploadComplete}
              disabled={batch?.status === 'PROCESSING'}
            />
          </TabsContent>
        </Tabs>
      </div>
    )
  }

  // --- Render: Batch List View ---

  const batches = batchesData?.data || []

  return (
    <div className="space-y-6">
      {/* 頁面標題 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('page.title')}
          </h1>
          <p className="text-muted-foreground">
            {t('page.description')}
          </p>
        </div>
        <CreateBatchDialog onCreateBatch={handleCreateBatch} />
      </div>

      {/* 批次列表 */}
      <HistoricalBatchList
        batches={batches}
        isLoading={isLoadingBatches}
        onSelectBatch={handleSelectBatch}
        onDeleteBatch={handleDeleteBatch}
        onStartProcessing={handleStartProcessing}
      />

      {/* 處理確認對話框 */}
      <ProcessingConfirmDialog
        open={processingDialogOpen}
        onOpenChange={setProcessingDialogOpen}
        costEstimation={costEstimation}
        onConfirm={handleConfirmProcessing}
        isProcessing={isStartingProcess}
        batchName={batchesData?.data?.find((b: HistoricalBatch) => b.id === processingBatchId)?.name}
      />
    </div>
  )
}
