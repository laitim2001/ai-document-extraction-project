/**
 * @fileoverview 文件預覽測試頁面 - OCR 提取 API
 * @description
 *   為測試頁面提供真實的 OCR 提取功能：
 *   - 接收上傳的 PDF/圖片文件
 *   - PDF 使用 Azure Document Intelligence 進行提取
 *   - 圖片使用 GPT Vision 進行提取
 *   - 將結果轉換為 ExtractedField 格式
 *   - 返回提取結果供前端顯示
 *
 * @module src/app/api/admin/document-preview-test/extract
 * @since Epic 13 - Story 13.6 (文件預覽整合測試)
 * @lastModified 2026-01-03
 *
 * @features
 *   - 支援 PDF 和圖片文件
 *   - PDF 使用 Azure DI（避免 pdf-to-img 問題）
 *   - 圖片使用 GPT Vision 進行 OCR 提取
 *   - 將提取結果轉換為 ExtractedField 結構
 *   - 自動清理臨時文件
 */

import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  processImageWithVision,
  type InvoiceExtractionResult,
} from '@/services/gpt-vision.service';
import {
  processPdfWithAzureDI,
  type AzureDIExtractionResult,
} from '@/services/azure-di.service';
import type {
  ExtractedField,
  FieldSource,
} from '@/types/extracted-field';
import { getConfidenceLevelFromScore } from '@/types/extracted-field';

/**
 * 判斷是否為 PDF 文件
 */
function isPdfFile(mimeType: string): boolean {
  return mimeType === 'application/pdf';
}

/**
 * 判斷是否為圖片文件
 */
function isImageFile(mimeType: string): boolean {
  const imageTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/tiff',
    'image/webp',
  ];
  return imageTypes.includes(mimeType);
}

/**
 * 統一提取結果類型（Azure DI 和 GPT Vision 兼容）
 */
type ExtractionResult = InvoiceExtractionResult | AzureDIExtractionResult;

// ============================================================
// Types
// ============================================================

/**
 * API 響應結構
 */
interface ExtractResponse {
  success: boolean;
  fields: ExtractedField[];
  pageCount: number;
  metadata?: {
    processedAt: string;
    source: string;
    avgConfidence: number;
  };
  error?: string;
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 產生唯一 ID
 */
function generateFieldId(): string {
  return `field-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 將提取結果轉換為 ExtractedField 格式
 * 支援 Azure DI 和 GPT Vision 兩種來源
 *
 * @param result - 提取結果（Azure DI 或 GPT Vision）
 * @param source - 提取來源標識
 * @returns ExtractedField 陣列
 */
function transformToExtractedFields(
  result: ExtractionResult,
  source: FieldSource = 'GPT_VISION'
): ExtractedField[] {
  const fields: ExtractedField[] = [];
  const invoiceData = result.invoiceData;

  if (!invoiceData) {
    return fields;
  }

  // 發票基本資訊
  if (invoiceData.invoiceNumber) {
    fields.push(createField('invoiceNumber', '發票號碼', invoiceData.invoiceNumber, 'invoice', result.confidence, source));
  }

  if (invoiceData.invoiceDate) {
    fields.push(createField('invoiceDate', '發票日期', invoiceData.invoiceDate, 'invoice', result.confidence, source));
  }

  if (invoiceData.dueDate) {
    fields.push(createField('dueDate', '到期日', invoiceData.dueDate, 'invoice', result.confidence, source));
  }

  if (invoiceData.currency) {
    fields.push(createField('currency', '幣別', invoiceData.currency, 'invoice', result.confidence, source));
  }

  // 供應商資訊
  if (invoiceData.vendor) {
    if (invoiceData.vendor.name) {
      fields.push(createField('vendorName', '供應商名稱', invoiceData.vendor.name, 'vendor', result.confidence, source));
    }
    if (invoiceData.vendor.address) {
      fields.push(createField('vendorAddress', '供應商地址', invoiceData.vendor.address, 'vendor', result.confidence * 0.95, source));
    }
    if (invoiceData.vendor.taxId) {
      fields.push(createField('vendorTaxId', '供應商稅號', invoiceData.vendor.taxId, 'vendor', result.confidence, source));
    }
  }

  // 客戶資訊
  if (invoiceData.buyer) {
    if (invoiceData.buyer.name) {
      fields.push(createField('buyerName', '客戶名稱', invoiceData.buyer.name, 'customer', result.confidence, source));
    }
    if (invoiceData.buyer.address) {
      fields.push(createField('buyerAddress', '客戶地址', invoiceData.buyer.address, 'customer', result.confidence * 0.95, source));
    }
  }

  // 明細項目
  if (invoiceData.lineItems && invoiceData.lineItems.length > 0) {
    invoiceData.lineItems.forEach((item, index) => {
      if (item.description) {
        fields.push(
          createField(
            `lineItem_${index}_description`,
            `明細 ${index + 1} - 描述`,
            item.description,
            'lineItems',
            result.confidence * 0.9,
            source
          )
        );
      }
      if (item.quantity !== undefined) {
        fields.push(
          createField(
            `lineItem_${index}_quantity`,
            `明細 ${index + 1} - 數量`,
            item.quantity,
            'lineItems',
            result.confidence,
            source
          )
        );
      }
      if (item.unitPrice !== undefined) {
        fields.push(
          createField(
            `lineItem_${index}_unitPrice`,
            `明細 ${index + 1} - 單價`,
            item.unitPrice,
            'lineItems',
            result.confidence,
            source
          )
        );
      }
      if (item.amount !== undefined) {
        fields.push(
          createField(
            `lineItem_${index}_amount`,
            `明細 ${index + 1} - 金額`,
            item.amount,
            'lineItems',
            result.confidence,
            source
          )
        );
      }
    });
  }

  // 金額資訊
  if (invoiceData.subtotal !== undefined) {
    fields.push(createField('subtotal', '小計', invoiceData.subtotal, 'amounts', result.confidence, source));
  }

  if (invoiceData.taxAmount !== undefined) {
    fields.push(createField('taxAmount', '稅額', invoiceData.taxAmount, 'amounts', result.confidence, source));
  }

  if (invoiceData.totalAmount !== undefined) {
    fields.push(createField('totalAmount', '總金額', invoiceData.totalAmount, 'amounts', result.confidence, source));
  }

  return fields;
}

/**
 * 建立 ExtractedField 物件
 */
function createField(
  fieldName: string,
  displayName: string,
  value: string | number | null,
  category: string,
  confidence: number,
  source: FieldSource = 'GPT_VISION'
): ExtractedField {
  return {
    id: generateFieldId(),
    fieldName,
    displayName,
    value,
    rawValue: value !== null ? String(value) : null,
    confidence,
    confidenceLevel: getConfidenceLevelFromScore(confidence),
    source,
    isEdited: false,
    category,
  };
}

/**
 * 驗證上傳文件類型
 */
function isValidFileType(mimeType: string): boolean {
  const validTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/tiff',
    'image/webp',
  ];
  return validTypes.includes(mimeType);
}

// ============================================================
// API Handler
// ============================================================

/**
 * POST /api/admin/document-preview-test/extract
 *
 * 處理文件上傳並執行 OCR 提取
 *
 * @param request - 包含 multipart/form-data 的請求
 * @returns 提取結果
 */
export async function POST(request: NextRequest): Promise<NextResponse<ExtractResponse>> {
  let tempFilePath: string | null = null;

  try {
    // 解析 multipart/form-data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          fields: [],
          pageCount: 0,
          error: '未提供文件',
        },
        { status: 400 }
      );
    }

    // 驗證文件類型
    if (!isValidFileType(file.type)) {
      return NextResponse.json(
        {
          success: false,
          fields: [],
          pageCount: 0,
          error: `不支援的文件類型: ${file.type}。請上傳 PDF 或圖片文件。`,
        },
        { status: 400 }
      );
    }

    // 建立臨時目錄
    const tempDir = path.join(os.tmpdir(), `doc-extract-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    // 保存文件到臨時目錄
    const fileExtension = file.name.split('.').pop() || 'pdf';
    tempFilePath = path.join(tempDir, `upload.${fileExtension}`);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.writeFile(tempFilePath, buffer);

    console.log(`[Test Extract API] Processing file: ${file.name} (${file.type})`);

    // 根據文件類型選擇處理服務
    let extractionResult: ExtractionResult;
    let processingSource: FieldSource;

    if (isPdfFile(file.type)) {
      // PDF 使用 Azure Document Intelligence
      console.log(`[Test Extract API] Using Azure DI for PDF file`);
      extractionResult = await processPdfWithAzureDI(tempFilePath, {});
      processingSource = 'AZURE_DI';
    } else if (isImageFile(file.type)) {
      // 圖片使用 GPT Vision
      console.log(`[Test Extract API] Using GPT Vision for image file`);
      extractionResult = await processImageWithVision(tempFilePath, {});
      processingSource = 'GPT_VISION';
    } else {
      // 不應該到達這裡，因為已經驗證過文件類型
      return NextResponse.json(
        {
          success: false,
          fields: [],
          pageCount: 0,
          error: `不支援的文件類型: ${file.type}`,
        },
        { status: 400 }
      );
    }

    if (!extractionResult.success) {
      return NextResponse.json(
        {
          success: false,
          fields: [],
          pageCount: extractionResult.pageCount,
          error: extractionResult.error || '提取失敗',
        },
        { status: 500 }
      );
    }

    // 轉換為 ExtractedField 格式
    const fields = transformToExtractedFields(extractionResult, processingSource);

    // 計算平均信心度
    const avgConfidence =
      fields.length > 0
        ? fields.reduce((sum, f) => sum + f.confidence, 0) / fields.length
        : 0;

    console.log(`[Test Extract API] Extraction successful (${processingSource}): ${fields.length} fields, avg confidence: ${(avgConfidence * 100).toFixed(1)}%`);

    return NextResponse.json({
      success: true,
      fields,
      pageCount: extractionResult.pageCount,
      metadata: {
        processedAt: new Date().toISOString(),
        source: processingSource,
        avgConfidence,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Test Extract API] Error:', errorMessage);

    return NextResponse.json(
      {
        success: false,
        fields: [],
        pageCount: 0,
        error: `處理錯誤: ${errorMessage}`,
      },
      { status: 500 }
    );
  } finally {
    // 清理臨時文件
    if (tempFilePath) {
      try {
        const tempDir = path.dirname(tempFilePath);
        await fs.rm(tempDir, { recursive: true, force: true });
        console.log(`[Test Extract API] Cleaned up temp directory: ${tempDir}`);
      } catch (cleanupError) {
        console.warn('[Test Extract API] Failed to cleanup temp files:', cleanupError);
      }
    }
  }
}
