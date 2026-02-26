/**
 * @fileoverview 階層式術語報告匯出 API 端點
 * @description
 *   提供批次的階層式術語報告 Excel 匯出功能。
 *   生成包含公司、格式、術語的四工作表 Excel 報告。
 *
 * @module src/app/api/v1/batches/[batchId]/hierarchical-terms/export
 * @since Epic 0 - CHANGE-002
 * @lastModified 2025-12-27
 *
 * @features
 *   - 四工作表 Excel 報告生成
 *   - 可配置最小頻率和最大術語數
 *   - 術語按頻率降序排列
 *   - 高頻術語顏色標記
 *
 * @dependencies
 *   - hierarchical-term-aggregation.service - 術語聚合服務
 *   - hierarchical-terms-excel - Excel 生成器
 *   - prisma - 資料庫查詢
 *   - zod - 參數驗證
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { aggregateTermsHierarchically } from '@/services/hierarchical-term-aggregation.service';
import {
  generateHierarchicalTermsExcel,
  generateReportFileName,
} from '@/lib/reports/hierarchical-terms-excel';

// ============================================================================
// Schema 驗證
// ============================================================================

/**
 * 查詢參數驗證 Schema
 */
const querySchema = z.object({
  minTermFrequency: z.coerce.number().min(1).default(1),
  maxTermsPerFormat: z.coerce.number().min(10).max(1000).default(500),
  includeExamples: z.coerce.boolean().default(true),
  /** 語言代碼 (en, zh-TW, zh-CN) */
  locale: z.string().optional().default('en'),
});

// ============================================================================
// API Handler
// ============================================================================

/**
 * GET /api/v1/batches/:batchId/hierarchical-terms/export
 * 匯出批次的階層式術語報告為 Excel
 *
 * @description
 *   對指定批次執行術語聚合並生成 Excel 報告。
 *   報告包含四個工作表：摘要、公司列表、格式列表、術語列表。
 *
 * @param request - Next.js 請求物件
 * @param params - 路由參數，包含批次 ID
 * @returns Excel 文件（application/vnd.openxmlformats-officedocument.spreadsheetml.sheet）
 *
 * @example
 * ```
 * GET /api/v1/batches/batch-123/hierarchical-terms/export
 * GET /api/v1/batches/batch-123/hierarchical-terms/export?minTermFrequency=2
 * ```
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const { batchId } = await params;
    const { searchParams } = new URL(request.url);
    const options = querySchema.parse(Object.fromEntries(searchParams));

    // 1. 驗證批次存在且已完成
    const batch = await prisma.historicalBatch.findUnique({
      where: { id: batchId },
      select: {
        id: true,
        name: true,
        status: true,
        startedAt: true,
        completedAt: true,
      },
    });

    if (!batch) {
      return NextResponse.json(
        {
          success: false,
          error: 'Batch not found',
          details: `No batch found with ID: ${batchId}`,
        },
        { status: 404 }
      );
    }

    if (batch.status !== 'COMPLETED') {
      return NextResponse.json(
        {
          success: false,
          error: 'Batch not completed',
          details: `Batch status is ${batch.status}. Export is only available for completed batches.`,
        },
        { status: 400 }
      );
    }

    // 2. 執行術語聚合
    const aggregation = await aggregateTermsHierarchically(batchId, {
      minTermFrequency: options.minTermFrequency,
      maxTermsPerFormat: options.maxTermsPerFormat,
    });

    // 3. 生成 Excel 報告
    const reportData = {
      batch: {
        id: batch.id,
        name: batch.name,
        startedAt: batch.startedAt,
        completedAt: batch.completedAt,
      },
      aggregation,
      generatedAt: new Date(),
      generatedBy: 'system', // TODO: 從 session 獲取用戶
    };

    const excelBuffer = await generateHierarchicalTermsExcel(reportData, {
      minTermFrequency: options.minTermFrequency,
      maxTermsPerFormat: options.maxTermsPerFormat,
      includeExamples: options.includeExamples,
      locale: options.locale,
    });

    // 4. 返回 Excel 文件
    const fileName = generateReportFileName(batch.name, new Date(), options.locale);

    return new NextResponse(new Uint8Array(excelBuffer), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        'Content-Length': excelBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('[API] Error exporting hierarchical terms:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid query parameters',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to export hierarchical terms report' },
      { status: 500 }
    );
  }
}
