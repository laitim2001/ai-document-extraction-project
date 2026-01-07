'use client';

/**
 * @fileoverview 文件預覽測試頁面工具列組件
 * @description
 *   提供測試頁面的操作工具列，包含：
 *   - 文件上傳按鈕
 *   - 載入範例數據按鈕
 *   - 重置按鈕
 *   - 處理狀態指示
 *
 * @module src/app/(dashboard)/admin/document-preview-test/components
 * @since Epic 13 - Story 13.6 (文件預覽整合測試頁面)
 * @lastModified 2026-01-03
 */

import * as React from 'react';
import { Upload, FileArchive, RotateCcw, Loader2 } from 'lucide-react';

// UI Components
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Store
import {
  useDocumentPreviewTestStore,
  useFileState,
} from '@/stores/document-preview-test-store';

// Types
import type { ExtractedField, ConfidenceLevel, FieldSource } from '@/types/extracted-field';

// ============================================================
// Constants
// ============================================================

/**
 * 範例提取欄位數據（用於測試）
 */
const SAMPLE_EXTRACTED_FIELDS: ExtractedField[] = [
  {
    id: 'field-1',
    fieldName: 'invoiceNumber',
    displayName: 'Invoice Number',
    value: 'INV-2024-001234',
    rawValue: 'INV-2024-001234',
    confidence: 0.95,
    confidenceLevel: 'HIGH' as ConfidenceLevel,
    source: 'AZURE_DI' as FieldSource,
    isEdited: false,
    category: 'invoice',
    boundingBox: {
      page: 1,
      x: 100,
      y: 50,
      width: 150,
      height: 20,
    },
  },
  {
    id: 'field-2',
    fieldName: 'invoiceDate',
    displayName: 'Invoice Date',
    value: '2024-12-25',
    rawValue: '2024-12-25',
    confidence: 0.92,
    confidenceLevel: 'HIGH' as ConfidenceLevel,
    source: 'AZURE_DI' as FieldSource,
    isEdited: false,
    category: 'invoice',
    boundingBox: {
      page: 1,
      x: 100,
      y: 80,
      width: 120,
      height: 20,
    },
  },
  {
    id: 'field-3',
    fieldName: 'vendorName',
    displayName: 'Vendor Name',
    value: 'ACME Logistics Ltd.',
    rawValue: 'ACME Logistics Ltd.',
    confidence: 0.88,
    confidenceLevel: 'MEDIUM' as ConfidenceLevel,
    source: 'AZURE_DI' as FieldSource,
    isEdited: false,
    category: 'vendor',
    boundingBox: {
      page: 1,
      x: 50,
      y: 150,
      width: 200,
      height: 25,
    },
  },
  {
    id: 'field-4',
    fieldName: 'totalAmount',
    displayName: 'Total Amount',
    value: '$12,500.00',
    rawValue: '$12,500.00',
    confidence: 0.97,
    confidenceLevel: 'HIGH' as ConfidenceLevel,
    source: 'AZURE_DI' as FieldSource,
    isEdited: false,
    category: 'amounts',
    boundingBox: {
      page: 1,
      x: 400,
      y: 500,
      width: 100,
      height: 25,
    },
  },
  {
    id: 'field-5',
    fieldName: 'currency',
    displayName: 'Currency',
    value: 'USD',
    rawValue: 'USD',
    confidence: 0.99,
    confidenceLevel: 'HIGH' as ConfidenceLevel,
    source: 'AZURE_DI' as FieldSource,
    isEdited: false,
    category: 'amounts',
    boundingBox: {
      page: 1,
      x: 350,
      y: 500,
      width: 40,
      height: 25,
    },
  },
  {
    id: 'field-6',
    fieldName: 'shippingTerms',
    displayName: 'Shipping Terms',
    value: 'FOB Destination',
    rawValue: 'FOB Destination',
    confidence: 0.75,
    confidenceLevel: 'MEDIUM' as ConfidenceLevel,
    source: 'GPT_VISION' as FieldSource,
    isEdited: false,
    category: 'other',
    boundingBox: {
      page: 1,
      x: 50,
      y: 300,
      width: 150,
      height: 20,
    },
  },
  {
    id: 'field-7',
    fieldName: 'containerNumber',
    displayName: 'Container Number',
    value: 'MSKU1234567',
    rawValue: 'MSKU1234567',
    confidence: 0.82,
    confidenceLevel: 'MEDIUM' as ConfidenceLevel,
    source: 'GPT_VISION' as FieldSource,
    isEdited: false,
    category: 'other',
    boundingBox: {
      page: 1,
      x: 50,
      y: 330,
      width: 130,
      height: 20,
    },
  },
  {
    id: 'field-8',
    fieldName: 'weight',
    displayName: 'Weight',
    value: '2,500 KG',
    rawValue: '2,500 KG',
    confidence: 0.68,
    confidenceLevel: 'LOW' as ConfidenceLevel,
    source: 'GPT_VISION' as FieldSource,
    isEdited: false,
    category: 'other',
    boundingBox: {
      page: 2,
      x: 200,
      y: 100,
      width: 80,
      height: 20,
    },
  },
];

// ============================================================
// Component
// ============================================================

/**
 * @component TestToolbar
 * @description 測試頁面工具列，提供上傳、載入範例和重置功能
 */
export function TestToolbar() {
  // --- Store State ---
  const { processingStatus } = useFileState();

  // --- Store Actions ---
  const {
    setCurrentFile,
    setProcessingStatus,
    setExtractedFields,
    setTotalPages,
    reset,
  } = useDocumentPreviewTestStore();

  // --- Local State ---
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  // --- Computed ---
  const isProcessing = processingStatus === 'uploading' || processingStatus === 'processing';

  // --- Handlers ---
  const handleUploadClick = React.useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setProcessingStatus('uploading');

      try {
        // Create object URL for preview
        const url = URL.createObjectURL(file);

        setCurrentFile({
          id: `upload-${Date.now()}`,
          fileName: file.name,
          mimeType: file.type,
          size: file.size,
          url,
          uploadedAt: new Date().toISOString(),
        });

        setProcessingStatus('processing');

        // Call actual extraction API
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/admin/document-preview-test/extract', {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || '提取失敗');
        }

        // Use real extracted fields from API
        setExtractedFields(result.fields);
        setTotalPages(result.pageCount || 1);
        setProcessingStatus('completed');

        console.log(`[TestToolbar] Extraction successful: ${result.fields.length} fields`);
      } catch (error) {
        console.error('Upload/extraction error:', error);
        setProcessingStatus('error');
      }

      // Reset file input
      event.target.value = '';
    },
    [setCurrentFile, setProcessingStatus, setExtractedFields, setTotalPages]
  );

  const handleLoadSample = React.useCallback(async () => {
    setIsLoading(true);
    setProcessingStatus('processing');

    try {
      // Simulate loading delay
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Load sample data without actual file
      setCurrentFile({
        id: 'sample-001',
        fileName: 'sample-invoice.pdf',
        mimeType: 'application/pdf',
        size: 125000,
        // Note: No URL means no actual PDF preview, but fields will show
        uploadedAt: new Date().toISOString(),
      });

      setExtractedFields(SAMPLE_EXTRACTED_FIELDS);
      setTotalPages(2);
      setProcessingStatus('completed');
    } catch (error) {
      console.error('Load sample error:', error);
      setProcessingStatus('error');
    } finally {
      setIsLoading(false);
    }
  }, [setCurrentFile, setProcessingStatus, setExtractedFields, setTotalPages]);

  const handleReset = React.useCallback(() => {
    reset();
  }, [reset]);

  // --- Render ---
  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Upload Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={handleUploadClick}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              上傳文件
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>上傳 PDF、PNG 或 JPG 文件進行測試</p>
          </TooltipContent>
        </Tooltip>

        {/* Load Sample Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLoadSample}
              disabled={isProcessing || isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileArchive className="h-4 w-4 mr-2" />
              )}
              載入範例
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>載入預設的範例提取欄位數據</p>
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6" />

        {/* Reset Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={isProcessing}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              重置
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>清除所有數據並重置頁面狀態</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
