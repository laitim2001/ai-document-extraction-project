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

import { useState, useCallback } from 'react'
import { ArrowLeft, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import {
  BatchFileUploader,
  HistoricalFileList,
  HistoricalBatchList,
  CreateBatchDialog,
} from '@/components/features/historical-data'
import {
  useHistoricalBatches,
  useHistoricalBatchDetail,
  useCreateBatch,
  useDeleteBatch,
  useDeleteFile,
  useUpdateFileType,
  type DetectedFileType,
} from '@/hooks/use-historical-data'

// ============================================================
// Component
// ============================================================

export default function HistoricalDataPage() {
  const { toast } = useToast()
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'files' | 'upload'>('files')

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
    async (data: { name: string; description?: string }) => {
      try {
        const result = await createBatchMutation.mutateAsync(data)
        toast({
          title: '批次建立成功',
          description: `批次「${data.name}」已建立`,
        })
        // 自動選擇新建立的批次
        setSelectedBatchId(result.data.id)
        setActiveTab('upload')
      } catch (error) {
        toast({
          variant: 'destructive',
          title: '建立失敗',
          description: error instanceof Error ? error.message : '無法建立批次',
        })
        throw error
      }
    },
    [createBatchMutation, toast]
  )

  const handleDeleteBatch = useCallback(
    async (batchId: string) => {
      try {
        await deleteBatchMutation.mutateAsync(batchId)
        toast({
          title: '批次已刪除',
        })
        if (selectedBatchId === batchId) {
          setSelectedBatchId(null)
        }
      } catch (error) {
        toast({
          variant: 'destructive',
          title: '刪除失敗',
          description: error instanceof Error ? error.message : '無法刪除批次',
        })
        throw error
      }
    },
    [deleteBatchMutation, selectedBatchId, toast]
  )

  const handleDeleteFile = useCallback(
    async (fileId: string) => {
      try {
        await deleteFileMutation.mutateAsync(fileId)
        toast({
          title: '文件已刪除',
        })
        refetchDetail()
      } catch (error) {
        toast({
          variant: 'destructive',
          title: '刪除失敗',
          description: error instanceof Error ? error.message : '無法刪除文件',
        })
        throw error
      }
    },
    [deleteFileMutation, refetchDetail, toast]
  )

  const handleUpdateFileType = useCallback(
    async (fileId: string, detectedType: DetectedFileType) => {
      try {
        await updateFileTypeMutation.mutateAsync({ fileId, detectedType })
        toast({
          title: '類型已更新',
        })
        refetchDetail()
      } catch (error) {
        toast({
          variant: 'destructive',
          title: '更新失敗',
          description: error instanceof Error ? error.message : '無法更新文件類型',
        })
        throw error
      }
    },
    [updateFileTypeMutation, refetchDetail, toast]
  )

  const handleUploadComplete = useCallback(
    (results: { successful: number; failed: number }) => {
      toast({
        title: '上傳完成',
        description: `成功 ${results.successful} 個，失敗 ${results.failed} 個`,
      })
      refetchDetail()
      setActiveTab('files')
    },
    [refetchDetail, toast]
  )

  const handleBackToList = useCallback(() => {
    setSelectedBatchId(null)
    refetchBatches()
  }, [refetchBatches])

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
                {batch?.name || '載入中...'}
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
              文件列表 ({files.length})
            </TabsTrigger>
            <TabsTrigger value="upload">
              <Upload className="h-4 w-4 mr-2" />
              上傳文件
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

  const batches = batchesData?.data?.batches || []

  return (
    <div className="space-y-6">
      {/* 頁面標題 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            歷史數據管理
          </h1>
          <p className="text-muted-foreground">
            上傳和處理歷史發票文件
          </p>
        </div>
        <CreateBatchDialog onCreateBatch={handleCreateBatch} />
      </div>

      {/* 批次列表 */}
      <HistoricalBatchList
        batches={batches}
        isLoading={isLoadingBatches}
        onSelectBatch={setSelectedBatchId}
        onDeleteBatch={handleDeleteBatch}
      />
    </div>
  )
}
