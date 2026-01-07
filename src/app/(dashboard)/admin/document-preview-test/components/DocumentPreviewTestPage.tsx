'use client';

/**
 * @fileoverview 文件預覽整合測試頁面主組件
 * @description
 *   整合 Epic 13 各 Story 的組件，提供完整的文件預覽測試環境：
 *   - 左側：提取欄位面板 (ExtractedFieldsPanel)
 *   - 中間：PDF 預覽區域 (DynamicPDFViewer + FieldHighlightOverlay)
 *   - 右側：映射配置面板 (MappingConfigPanel)
 *
 * @module src/app/(dashboard)/admin/document-preview-test/components
 * @since Epic 13 - Story 13.6 (文件預覽整合測試頁面)
 * @lastModified 2026-01-03
 *
 * @features
 *   - 三欄式響應式佈局
 *   - PDF 與欄位雙向聯動
 *   - 映射配置即時預覽
 *   - 文件上傳與處理狀態追蹤
 */

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText, Settings, Layers } from 'lucide-react';

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';

// Feature Components
import {
  DynamicPDFViewer,
  PDFControls,
  ExtractedFieldsPanel,
} from '@/components/features/document-preview';
import { MappingConfigPanel } from '@/components/features/mapping-config';

// Local Components
import { TestToolbar } from './TestToolbar';
import { TestFileUploader } from './TestFileUploader';

// Store
import {
  useDocumentPreviewTestStore,
  useFileState,
  useFieldsState,
  usePdfState,
} from '@/stores/document-preview-test-store';

// Types
import type { BoundingBox } from '@/lib/pdf';
import type { SourceFieldDefinition, TargetFieldDefinition } from '@/types/field-mapping';

// ============================================================
// Types
// ============================================================

interface PanelHeaderProps {
  icon: React.ReactNode;
  title: string;
  badge?: React.ReactNode;
}

// ============================================================
// Sub Components
// ============================================================

/**
 * 面板標題組件
 */
function PanelHeader({ icon, title, badge }: PanelHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
      <div className="flex items-center gap-2">
        {icon}
        <span className="font-medium text-sm">{title}</span>
      </div>
      {badge}
    </div>
  );
}

/**
 * 空狀態提示組件
 */
function EmptyStatePrompt() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
      <FileText className="h-16 w-16 mb-4 opacity-50" />
      <p className="text-lg font-medium">尚未載入文件</p>
      <p className="text-sm mt-2">請上傳文件或載入範例數據</p>
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

/**
 * @component DocumentPreviewTestPage
 * @description 文件預覽整合測試頁面主組件
 */
export function DocumentPreviewTestPage() {
  // --- Store State ---
  const { currentFile, processingStatus, error } = useFileState();
  const { extractedFields, selectedFieldId } = useFieldsState();
  const { currentPage, totalPages, zoomLevel } = usePdfState();

  // --- Store Actions ---
  const {
    setSelectedField,
    setCurrentPage,
    setTotalPages,
    setZoomLevel,
    updateField,
  } = useDocumentPreviewTestStore();

  // --- Computed ---
  const hasFile = currentFile !== null;
  const isProcessing = processingStatus === 'uploading' || processingStatus === 'processing';
  const hasError = error !== null;

  // --- Handlers ---
  const handleFieldSelect = React.useCallback(
    (fieldId: string | null) => {
      setSelectedField(fieldId);
    },
    [setSelectedField]
  );

  const handlePageChange = React.useCallback(
    (page: number) => {
      setCurrentPage(page);
    },
    [setCurrentPage]
  );

  const handleZoomChange = React.useCallback(
    (zoom: number) => {
      setZoomLevel(zoom);
    },
    [setZoomLevel]
  );

  const handleDocumentLoadSuccess = React.useCallback(
    (numPages: number) => {
      setTotalPages(numPages);
    },
    [setTotalPages]
  );

  const handleFieldEdit = React.useCallback(
    (fieldId: string, newValue: string) => {
      updateField(fieldId, { value: newValue, isEdited: true });
    },
    [updateField]
  );

  // --- Computed: Convert extracted fields to bounding boxes ---
  const boundingBoxes: BoundingBox[] = React.useMemo(() => {
    return extractedFields
      .filter((field) => field.boundingBox)
      .map((field) => ({
        fieldId: field.id,
        fieldName: field.fieldName,
        page: field.boundingBox!.page,
        x: field.boundingBox!.x,
        y: field.boundingBox!.y,
        width: field.boundingBox!.width,
        height: field.boundingBox!.height,
        confidence: field.confidence,
      }));
  }, [extractedFields]);

  // --- Computed: Convert extracted fields to source/target field definitions ---
  const sourceFields: SourceFieldDefinition[] = React.useMemo(() => {
    return extractedFields.map((field) => ({
      id: field.id,
      fieldName: field.fieldName,
      displayName: field.displayName,
      category: field.category ?? 'other',
      sampleValue: String(field.value ?? ''),
    }));
  }, [extractedFields]);

  const targetFields: TargetFieldDefinition[] = React.useMemo(() => {
    // 預設目標欄位列表（用於測試）
    return [
      { id: 'target-invoice-number', fieldName: 'invoiceNumber', displayName: 'Invoice Number', category: 'invoice', dataType: 'string' as const, required: true },
      { id: 'target-invoice-date', fieldName: 'invoiceDate', displayName: 'Invoice Date', category: 'invoice', dataType: 'date' as const, required: true },
      { id: 'target-vendor-name', fieldName: 'vendorName', displayName: 'Vendor Name', category: 'vendor', dataType: 'string' as const, required: false },
      { id: 'target-total-amount', fieldName: 'totalAmount', displayName: 'Total Amount', category: 'amounts', dataType: 'number' as const, required: true },
      { id: 'target-currency', fieldName: 'currency', displayName: 'Currency', category: 'amounts', dataType: 'string' as const, required: false },
    ];
  }, []);

  // --- Render ---
  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b bg-card">
        <div className="flex items-center gap-4">
          <Link
            href="/admin"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">返回管理後台</span>
          </Link>
          <Separator orientation="vertical" className="h-6" />
          <div>
            <h1 className="text-xl font-semibold">文件預覽整合測試</h1>
            <p className="text-sm text-muted-foreground">
              Epic 13 組件整合驗證環境
            </p>
          </div>
        </div>
        <TestToolbar />
      </header>

      {/* Main Content - Three Column Layout */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Left Panel - Extracted Fields */}
          <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
            <div className="h-full flex flex-col border-r">
              <PanelHeader
                icon={<FileText className="h-4 w-4" />}
                title="提取欄位"
                badge={
                  hasFile && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {extractedFields.length} 個欄位
                    </span>
                  )
                }
              />
              <div className="flex-1 overflow-hidden">
                {hasFile ? (
                  <ExtractedFieldsPanel
                    fields={extractedFields}
                    selectedFieldId={selectedFieldId}
                    onFieldSelect={handleFieldSelect}
                    onFieldEdit={handleFieldEdit}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                    上傳文件以查看提取欄位
                  </div>
                )}
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle className="w-2 bg-border hover:bg-primary/20 transition-colors" />

          {/* Center Panel - PDF Preview */}
          <ResizablePanel defaultSize={50} minSize={30} maxSize={60}>
            <div className="h-full flex flex-col">
              <PanelHeader
                icon={<Layers className="h-4 w-4" />}
                title="PDF 預覽"
                badge={
                  hasFile && totalPages > 0 && (
                    <span className="text-xs text-muted-foreground">
                      第 {currentPage} / {totalPages} 頁
                    </span>
                  )
                }
              />
              <div className="flex-1 overflow-hidden relative">
                {hasFile && currentFile?.url ? (
                  <>
                    <DynamicPDFViewer
                      file={currentFile.url}
                      page={currentPage}
                      scale={zoomLevel}
                      onPageChange={handlePageChange}
                      onScaleChange={handleZoomChange}
                      onLoadSuccess={handleDocumentLoadSuccess}
                      boundingBoxes={boundingBoxes}
                      selectedFieldId={selectedFieldId ?? undefined}
                      onFieldClick={(fieldId) => handleFieldSelect(fieldId)}
                      showHighlights={true}
                      showControls={false}
                      className="h-full"
                    />
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
                      <PDFControls
                        currentPage={currentPage}
                        totalPages={totalPages}
                        scale={zoomLevel}
                        onPageChange={handlePageChange}
                        onScaleChange={handleZoomChange}
                      />
                    </div>
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center p-4">
                    {isProcessing ? (
                      <div className="flex flex-col items-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4" />
                        <p className="text-muted-foreground">處理中...</p>
                      </div>
                    ) : hasError ? (
                      <Card className="w-full max-w-md">
                        <CardContent className="p-6 text-center text-destructive">
                          <p className="font-medium">{error?.message}</p>
                          {error?.details && (
                            <p className="text-sm mt-2">{error.details}</p>
                          )}
                        </CardContent>
                      </Card>
                    ) : (
                      <TestFileUploader />
                    )}
                  </div>
                )}
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle className="w-2 bg-border hover:bg-primary/20 transition-colors" />

          {/* Right Panel - Mapping Config */}
          <ResizablePanel defaultSize={30} minSize={20} maxSize={40}>
            <div className="h-full flex flex-col">
              <PanelHeader
                icon={<Settings className="h-4 w-4" />}
                title="映射配置"
              />
              <div className="flex-1 overflow-hidden">
                <MappingConfigPanel
                  sourceFields={sourceFields}
                  targetFields={targetFields}
                />
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
