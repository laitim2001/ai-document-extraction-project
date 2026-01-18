'use client'

/**
 * @fileoverview 發票詳情選項卡組件
 * @description
 *   顯示發票詳情的四個選項卡：
 *   - 文件預覽（PDF + 欄位高亮）
 *   - 提取欄位（欄位面板）
 *   - 處理詳情（時間軸）
 *   - 審計日誌
 *
 * @module src/components/features/invoice/detail/InvoiceDetailTabs
 * @author Development Team
 * @since Epic 13 - Story 13-8 (Invoice Detail Page)
 * @lastModified 2026-01-18
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import {
  DynamicPDFViewer,
  ExtractedFieldsPanel,
} from '@/components/features/document-preview'
import { ProcessingTimeline } from './ProcessingTimeline'
import { InvoiceAuditLog } from './InvoiceAuditLog'
import { FileText, ListChecks, Clock, History } from 'lucide-react'
import type { ExtractedField } from '@/types/extracted-field'
import type { DocumentStatusKey } from '@/lib/document-status'
import type { BoundingBox } from '@/lib/pdf'

// ============================================================
// Types
// ============================================================

interface DocumentData {
  id: string
  fileName: string
  status: DocumentStatusKey | string
  blobUrl?: string | null
  extractedFields?: ExtractedField[] | null
  processingSteps?: ProcessingStep[] | null
}

interface ProcessingStep {
  step: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  startedAt?: string | Date | null
  completedAt?: string | Date | null
  error?: string | null
}

interface InvoiceDetailTabsProps {
  /** 文件數據 */
  document: DocumentData
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 將 ExtractedField 轉換為 BoundingBox 格式
 */
function fieldsToBoundingBoxes(fields: ExtractedField[]): BoundingBox[] {
  return fields
    .filter((field) => field.boundingBox)
    .map((field) => ({
      fieldId: field.id,
      fieldName: field.fieldName,
      page: field.boundingBox?.page ?? 1,
      x: field.boundingBox?.x ?? 0,
      y: field.boundingBox?.y ?? 0,
      width: field.boundingBox?.width ?? 0,
      height: field.boundingBox?.height ?? 0,
      confidence: field.confidence * 100, // Convert 0-1 to 0-100
    }))
}

// ============================================================
// Component
// ============================================================

/**
 * 發票詳情選項卡
 *
 * @description
 *   整合預覽、欄位、處理和審計四個選項卡
 */
export function InvoiceDetailTabs({ document }: InvoiceDetailTabsProps) {
  const t = useTranslations('invoices')
  const [selectedFieldId, setSelectedFieldId] = React.useState<string | null>(null)

  // 將欄位轉換為邊界框格式
  const boundingBoxes = React.useMemo(() => {
    if (!document.extractedFields) return []
    return fieldsToBoundingBoxes(document.extractedFields)
  }, [document.extractedFields])

  // 處理欄位點擊（從 PDF 預覽）
  const handleFieldClick = React.useCallback((fieldId: string, _fieldName: string) => {
    setSelectedFieldId((prev) => (prev === fieldId ? null : fieldId))
  }, [])

  // 處理欄位選擇（從欄位面板）
  const handleFieldSelect = React.useCallback((fieldId: string) => {
    setSelectedFieldId((prev) => (prev === fieldId ? null : fieldId))
  }, [])

  // 處理欄位編輯（暫時不實作，留給未來擴展）
  const handleFieldEdit = React.useCallback((_fieldId: string, _newValue: string) => {
    // TODO: 實作欄位編輯功能
    // 未來可在此處添加欄位編輯 API 調用
  }, [])

  return (
    <Tabs defaultValue="preview" className="w-full">
      <TabsList className="grid w-full grid-cols-4 max-w-xl">
        <TabsTrigger value="preview" className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          <span className="hidden sm:inline">{t('detail.tabs.preview')}</span>
        </TabsTrigger>
        <TabsTrigger value="fields" className="flex items-center gap-2">
          <ListChecks className="h-4 w-4" />
          <span className="hidden sm:inline">{t('detail.tabs.fields')}</span>
        </TabsTrigger>
        <TabsTrigger value="processing" className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          <span className="hidden sm:inline">{t('detail.tabs.processing')}</span>
        </TabsTrigger>
        <TabsTrigger value="audit" className="flex items-center gap-2">
          <History className="h-4 w-4" />
          <span className="hidden sm:inline">{t('detail.tabs.audit')}</span>
        </TabsTrigger>
      </TabsList>

      {/* 文件預覽 Tab */}
      <TabsContent value="preview" className="mt-4">
        <Card>
          <CardContent className="p-4">
            <div className="min-h-[600px]">
              {document.blobUrl ? (
                <DynamicPDFViewer
                  file={document.blobUrl}
                  boundingBoxes={boundingBoxes}
                  selectedFieldId={selectedFieldId ?? undefined}
                  onFieldClick={handleFieldClick}
                  showControls
                  showHighlights
                />
              ) : (
                <div className="flex items-center justify-center h-[600px] text-gray-500">
                  <div className="text-center">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>{t('detail.empty.noPreview')}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* 提取欄位 Tab */}
      <TabsContent value="fields" className="mt-4">
        <Card>
          <CardContent className="p-4">
            {document.extractedFields && document.extractedFields.length > 0 ? (
              <ExtractedFieldsPanel
                fields={document.extractedFields}
                selectedFieldId={selectedFieldId}
                onFieldSelect={handleFieldSelect}
                onFieldEdit={handleFieldEdit}
              />
            ) : (
              <div className="flex items-center justify-center h-[400px] text-gray-500">
                <div className="text-center">
                  <ListChecks className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>{t('detail.empty.noFields')}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* 處理詳情 Tab */}
      <TabsContent value="processing" className="mt-4">
        <Card>
          <CardContent className="p-4">
            <ProcessingTimeline
              documentId={document.id}
              steps={document.processingSteps}
            />
          </CardContent>
        </Card>
      </TabsContent>

      {/* 審計日誌 Tab */}
      <TabsContent value="audit" className="mt-4">
        <Card>
          <CardContent className="p-4">
            <InvoiceAuditLog documentId={document.id} />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
