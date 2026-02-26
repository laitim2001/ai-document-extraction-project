/**
 * @fileoverview Company Classified-As Values API - 取得公司近期提取結果中的 classifiedAs 去重值
 * @description
 *   從指定公司最近 50 筆提取結果的 stage3Result 中，
 *   提取所有 lineItems[].classifiedAs 值，正規化後去重排序返回。
 *   用於前端 UI 的 classifiedAs 篩選選項。
 *
 *   端點：
 *   - GET /api/companies/[id]/classified-as-values
 *
 * @module src/app/api/companies/[id]/classified-as-values/route
 * @since CHANGE-046
 * @lastModified 2026-02-25
 *
 * @related
 *   - src/services/extraction-v3/utils/classify-normalizer.ts - classifiedAs 正規化工具
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { normalizeClassifiedAs } from '@/services/extraction-v3/utils/classify-normalizer';

/**
 * stage3Result JSON 中 lineItem 的最小型別定義
 */
interface Stage3LineItem {
  classifiedAs?: string;
  [key: string]: unknown;
}

/**
 * stage3Result JSON 的最小型別定義
 */
interface Stage3Result {
  lineItems?: Stage3LineItem[];
  [key: string]: unknown;
}

/**
 * GET /api/companies/[id]/classified-as-values
 * 取得公司近期提取結果中的所有 classifiedAs 去重值
 *
 * @description
 *   查詢該公司最近 50 筆有 stage3Result 的 ExtractionResult，
 *   從中提取 lineItems[].classifiedAs，經 normalizeClassifiedAs() 正規化後，
 *   去重、排序後返回。
 *
 * @param request - HTTP 請求
 * @param context - 路由參數（包含 id）
 * @returns 去重排序後的 classifiedAs 值陣列
 *
 * @example
 *   GET /api/companies/abc123/classified-as-values
 *
 *   Response:
 *   {
 *     "success": true,
 *     "data": {
 *       "values": ["Cleaning At Destination", "Delivery Order Fee", "Freight Charges"]
 *     }
 *   }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let companyId = '';

  try {
    const { id } = await params;
    companyId = id;

    // 1. 驗證 companyId 參數
    if (!companyId || companyId.trim().length === 0) {
      return NextResponse.json(
        {
          type: 'about:blank',
          title: 'Bad Request',
          status: 400,
          detail: 'Company ID is required',
          instance: `/api/companies/${companyId}/classified-as-values`,
        },
        { status: 400 }
      );
    }

    // 2. 查詢最近 50 筆有 stage3Result 的 ExtractionResult
    const extractionResults = await prisma.extractionResult.findMany({
      where: {
        document: {
          companyId: companyId,
        },
        stage3Result: {
          not: Prisma.DbNull,
        },
      },
      select: {
        stage3Result: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    });

    // 3. 從 stage3Result 中提取所有 classifiedAs 值
    const classifiedAsSet = new Set<string>();

    for (const result of extractionResults) {
      const stage3 = result.stage3Result as Stage3Result | null;
      if (!stage3?.lineItems || !Array.isArray(stage3.lineItems)) {
        continue;
      }

      for (const lineItem of stage3.lineItems) {
        if (
          lineItem.classifiedAs &&
          typeof lineItem.classifiedAs === 'string' &&
          lineItem.classifiedAs.trim().length > 0
        ) {
          // 4. 使用 normalizeClassifiedAs 正規化每個值
          const normalized = normalizeClassifiedAs(lineItem.classifiedAs);
          classifiedAsSet.add(normalized);
        }
      }
    }

    // 5. 去重（Set 已去重）、排序後返回
    const values = Array.from(classifiedAsSet).sort((a, b) =>
      a.localeCompare(b)
    );

    return NextResponse.json({
      success: true,
      data: { values },
    });
  } catch (error) {
    console.error(
      `[API] GET /api/companies/${companyId}/classified-as-values error:`,
      error
    );

    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to fetch classified-as values',
        instance: `/api/companies/${companyId}/classified-as-values`,
      },
      { status: 500 }
    );
  }
}
