/**
 * @fileoverview 格式提取欄位 API
 * @description
 *   取得該格式文件曾經提取出的欄位名稱範例，
 *   用於動態來源欄位選擇器。
 *
 *   此 API 查詢該格式最近 20 個已處理文件的提取結果，
 *   合併所有欄位名稱並統計出現頻率和樣本值。
 *
 * @module src/app/api/v1/formats/[id]/extracted-fields
 * @since Epic 16 - Story 16.6
 * @lastModified 2026-01-13
 *
 * @features
 *   - 動態欄位發現：從已處理文件中提取欄位名稱
 *   - 出現頻率統計：追蹤每個欄位的出現次數
 *   - 樣本值收集：提供最多 3 個樣本值供參考
 *   - 按頻率排序：最常見的欄位排在前面
 *
 * @dependencies
 *   - prisma - 資料庫操作
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// ============================================================================
// Types
// ============================================================================

/**
 * 提取欄位資訊
 */
interface ExtractedFieldInfo {
  /** 欄位名稱 */
  name: string;
  /** 出現次數 */
  occurrences: number;
  /** 樣本值（最多 3 個） */
  sampleValues: (string | number | null)[];
}

// ============================================================================
// API Handlers
// ============================================================================

/**
 * GET /api/v1/formats/[id]/extracted-fields
 * 取得格式的提取欄位列表
 *
 * @description
 *   查詢該格式最近 20 個已處理文件的提取結果，
 *   合併所有欄位名稱並返回統計資訊。
 *
 * @param request - Next.js 請求物件
 * @param params - 路由參數（包含 id）
 * @returns 提取欄位列表和統計
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 驗證格式存在
    const format = await prisma.documentFormat.findUnique({
      where: { id },
      select: { id: true, companyId: true, name: true },
    });

    if (!format) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'NOT_FOUND',
            title: 'Format not found',
            status: 404,
            detail: `Document format with id ${id} not found`,
          },
        },
        { status: 404 }
      );
    }

    // 查詢該格式最近 20 個已處理文件的提取結果（從 HistoricalFile）
    const files = await prisma.historicalFile.findMany({
      where: {
        documentFormatId: id,
        status: 'COMPLETED',
        extractionResult: { not: { equals: undefined } },
      },
      select: {
        extractionResult: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });

    // 合併所有欄位名稱
    const fieldMap = new Map<string, ExtractedFieldInfo>();

    for (const file of files) {
      const data = file.extractionResult as Record<string, unknown> | null;
      if (!data) continue;

      // 處理 extractionResult 的各種結構
      const fieldsToProcess = extractFieldsFromData(data);

      for (const [key, value] of Object.entries(fieldsToProcess)) {
        // 跳過系統欄位
        if (key.startsWith('_') || key === 'confidence') {
          continue;
        }

        if (!fieldMap.has(key)) {
          fieldMap.set(key, {
            name: key,
            occurrences: 0,
            sampleValues: [],
          });
        }

        const info = fieldMap.get(key)!;
        info.occurrences++;

        // 收集樣本值（最多 3 個）
        if (
          info.sampleValues.length < 3 &&
          value !== null &&
          value !== undefined
        ) {
          const sampleValue = formatSampleValue(value);
          if (sampleValue !== null && !info.sampleValues.includes(sampleValue)) {
            info.sampleValues.push(sampleValue);
          }
        }
      }
    }

    // 轉換為陣列，按出現頻率排序
    const fields = Array.from(fieldMap.values()).sort(
      (a, b) => b.occurrences - a.occurrences
    );

    return NextResponse.json({
      success: true,
      data: {
        formatId: format.id,
        formatName: format.name,
        fields,
        totalDocuments: files.length,
      },
    });
  } catch (error) {
    console.error('[GET /api/v1/formats/[id]/extracted-fields] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'INTERNAL_ERROR',
          title: 'Internal server error',
          status: 500,
          detail: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 從提取數據中提取欄位
 * @description 處理 extractionResult 的各種結構（invoiceData、gptExtraction 等）
 */
function extractFieldsFromData(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // 處理頂層欄位
  for (const [key, value] of Object.entries(data)) {
    if (
      key === 'invoiceData' &&
      typeof value === 'object' &&
      value !== null
    ) {
      // 展開 invoiceData
      Object.assign(result, value);
    } else if (
      key === 'gptExtraction' &&
      typeof value === 'object' &&
      value !== null
    ) {
      // 展開 gptExtraction.fields
      const gptData = value as Record<string, unknown>;
      if (gptData.fields && typeof gptData.fields === 'object') {
        Object.assign(result, gptData.fields);
      }
    } else if (
      key !== 'lineItems' &&
      key !== 'documentIssuer' &&
      key !== 'rawText' &&
      key !== 'pageCount' &&
      key !== 'azureResponse' &&
      key !== 'rawAzureResponse' &&
      key !== 'gptResponse'
    ) {
      // 其他頂層欄位
      result[key] = value;
    }
  }

  return result;
}

/**
 * 格式化樣本值
 * @description 將值轉換為可顯示的格式
 */
function formatSampleValue(value: unknown): string | number | null {
  if (typeof value === 'string') {
    // 截斷過長的字串
    return value.length > 100 ? value.substring(0, 100) + '...' : value;
  }
  if (typeof value === 'number') {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return null;
}
