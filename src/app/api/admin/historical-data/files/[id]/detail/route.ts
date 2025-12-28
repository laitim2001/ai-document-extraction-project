/**
 * @fileoverview Historical File Detail API - 獲取歷史文件完整詳情
 * @description
 *   提供單一歷史文件的完整資訊，包含：
 *   - 基本文件資訊（名稱、大小、類型、狀態）
 *   - 處理過程時間軸（上傳、檢測、處理、完成）
 *   - 提取結果（invoiceData 欄位）
 *   - 發行者識別資訊（方法、信心度、匹配公司）
 *   - 關聯的 DocumentFormat 資訊
 *
 * @module src/app/api/admin/historical-data/files/[id]/detail
 * @since CHANGE-003 - 歷史數據文件詳情頁
 * @lastModified 2025-12-28
 *
 * @features
 *   - 完整文件詳情查詢（含關聯資料）
 *   - 處理時間軸計算
 *   - RFC 7807 錯誤格式
 *
 * @dependencies
 *   - prisma - 資料庫查詢
 *   - next/server - API 路由處理
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * 歷史文件詳情響應類型
 * 注意：欄位名稱對應 Prisma Schema 中的 HistoricalFile 模型
 */
interface FileDetailResponse {
  success: boolean;
  data: {
    // 基本資訊
    id: string;
    fileName: string;
    originalName: string | null;
    fileSize: number;
    detectedType: string | null;
    mimeType: string | null;
    status: string;
    storagePath: string | null;

    // 處理資訊
    processingMethod: string | null;
    actualCost: number | null;

    // 時間軸
    timeline: {
      createdAt: Date;
      detectedAt: Date | null;
      processingStartAt: Date | null;
      processingEndAt: Date | null;
      processedAt: Date | null;
      updatedAt: Date;
    };

    // 提取結果
    extractionResult: Record<string, unknown> | null;

    // 發行者識別
    issuerIdentification: {
      method: string | null;
      confidence: number | null;
      matchedCompany: {
        id: string;
        name: string;
        code: string | null;
        displayName: string | null;
      } | null;
    };

    // 文件格式
    documentFormat: {
      id: string;
      name: string;
      documentType: string | null;
      documentSubtype: string | null;
    } | null;
    formatConfidence: number | null;

    // 批次資訊
    batch: {
      id: string;
      name: string | null;
      description: string | null;
    } | null;
  };
}

/**
 * RFC 7807 錯誤響應類型
 */
interface ErrorResponse {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
}

/**
 * GET /api/admin/historical-data/files/[id]/detail
 *
 * @description 獲取單一歷史文件的完整詳情
 * @param request - Next.js 請求對象
 * @param params - 路由參數，包含文件 ID
 * @returns 文件完整詳情或錯誤響應
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<FileDetailResponse | ErrorResponse>> {
  const resolvedParams = await params;
  const fileId = resolvedParams.id;

  try {
    // 查詢文件詳情（含所有關聯資料）
    // 欄位名稱對應 Prisma Schema: HistoricalFile 模型
    const file = await prisma.historicalFile.findUnique({
      where: { id: fileId },
      select: {
        // 基本資訊
        id: true,
        fileName: true,
        originalName: true,
        fileSize: true,
        detectedType: true,
        mimeType: true,
        status: true,
        storagePath: true,

        // 處理資訊
        processingMethod: true,
        actualCost: true,

        // 時間戳
        createdAt: true,
        detectedAt: true,
        processingStartAt: true,
        processingEndAt: true,
        processedAt: true,
        updatedAt: true,

        // 提取結果
        extractionResult: true,

        // 發行者識別
        issuerIdentificationMethod: true,
        issuerConfidence: true,
        // documentIssuer 關聯指向 Company 模型
        documentIssuer: {
          select: {
            id: true,
            name: true,
            code: true,
            displayName: true,
          },
        },

        // 文件格式
        documentFormat: {
          select: {
            id: true,
            name: true,
            documentType: true,
            documentSubtype: true,
          },
        },
        formatConfidence: true,

        // 批次資訊
        batch: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });

    // 文件不存在
    if (!file) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'File Not Found',
          status: 404,
          detail: `Historical file with ID "${fileId}" not found`,
          instance: `/api/admin/historical-data/files/${fileId}/detail`,
        },
        { status: 404 }
      );
    }

    // 構建響應
    const response: FileDetailResponse = {
      success: true,
      data: {
        // 基本資訊
        id: file.id,
        fileName: file.fileName,
        originalName: file.originalName,
        fileSize: file.fileSize,
        detectedType: file.detectedType,
        mimeType: file.mimeType,
        status: file.status,
        storagePath: file.storagePath,

        // 處理資訊
        processingMethod: file.processingMethod,
        actualCost: file.actualCost ? Number(file.actualCost) : null,

        // 時間軸
        timeline: {
          createdAt: file.createdAt,
          detectedAt: file.detectedAt,
          processingStartAt: file.processingStartAt,
          processingEndAt: file.processingEndAt,
          processedAt: file.processedAt,
          updatedAt: file.updatedAt,
        },

        // 提取結果
        extractionResult: file.extractionResult as Record<string, unknown> | null,

        // 發行者識別
        issuerIdentification: {
          method: file.issuerIdentificationMethod,
          confidence: file.issuerConfidence ? Number(file.issuerConfidence) : null,
          // documentIssuer 就是 Company
          matchedCompany: file.documentIssuer
            ? {
                id: file.documentIssuer.id,
                name: file.documentIssuer.name,
                code: file.documentIssuer.code,
                displayName: file.documentIssuer.displayName,
              }
            : null,
        },

        // 文件格式 (name 可能為 null，提供預設值)
        documentFormat: file.documentFormat
          ? {
              id: file.documentFormat.id,
              name: file.documentFormat.name ?? `Format-${file.documentFormat.id.substring(0, 8)}`,
              documentType: file.documentFormat.documentType as string | null,
              documentSubtype: file.documentFormat.documentSubtype as string | null,
            }
          : null,
        formatConfidence: file.formatConfidence ? Number(file.formatConfidence) : null,

        // 批次資訊
        batch: file.batch
          ? {
              id: file.batch.id,
              name: file.batch.name,
              description: file.batch.description,
            }
          : null,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Historical File Detail] Error:', error);

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal-error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to fetch file details',
        instance: `/api/admin/historical-data/files/${fileId}/detail`,
      },
      { status: 500 }
    );
  }
}
