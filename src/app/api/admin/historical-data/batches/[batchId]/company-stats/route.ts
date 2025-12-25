/**
 * @fileoverview 批量處理公司識別統計 API
 * @description
 *   提供批量處理後的公司識別統計資料：
 *   - 總識別數量
 *   - 新建與匹配統計
 *   - 按匹配類型分類
 *   - 按公司分類的文件統計
 *
 * @module src/app/api/admin/historical-data/batches/[batchId]/company-stats
 * @since Epic 0 - Story 0.6
 * @lastModified 2025-12-25
 *
 * @features
 *   - 公司識別統計查詢
 *   - 匹配類型分佈
 *   - 公司文件關聯統計
 *
 * @dependencies
 *   - Prisma Client - 數據庫操作
 *
 * @related
 *   - src/services/batch-processor.service.ts - 批量處理服務
 *   - src/types/batch-company.ts - 類型定義
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type {
  BatchCompanyStats,
  CompanyFileCount,
  CompanyMatchType,
} from '@/types/batch-company'

// ============================================================
// Types
// ============================================================

interface RouteContext {
  params: Promise<{
    batchId: string
  }>
}

interface CompanyStatsResponse {
  success: boolean
  data: {
    batchId: string
    batchName: string
    stats: BatchCompanyStats
  }
}

// ============================================================
// GET Handler
// ============================================================

/**
 * 獲取批次的公司識別統計
 *
 * @description
 *   返回指定批次的公司識別統計資料，包含：
 *   - 總識別文件數
 *   - 新建公司數量
 *   - 匹配現有公司數量
 *   - 按匹配類型分類統計
 *   - 按公司分類的文件數量
 *
 * @param request - Next.js 請求對象
 * @param context - 路由上下文（包含 batchId）
 * @returns 公司識別統計
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse<CompanyStatsResponse | { error: string }>> {
  try {
    const { batchId } = await context.params

    // 驗證批次是否存在
    const batch = await prisma.historicalBatch.findUnique({
      where: { id: batchId },
      select: {
        id: true,
        name: true,
        enableCompanyIdentification: true,
        companiesIdentified: true,
      },
    })

    if (!batch) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      )
    }

    // 如果未啟用公司識別，返回空統計
    if (!batch.enableCompanyIdentification) {
      const emptyStats: BatchCompanyStats = {
        totalIdentified: 0,
        newCreated: 0,
        existingMatched: 0,
        matchTypeBreakdown: {
          exact: 0,
          variant: 0,
          fuzzy: 0,
          new: 0,
        },
        companyBreakdown: [],
      }

      return NextResponse.json({
        success: true,
        data: {
          batchId,
          batchName: batch.name,
          stats: emptyStats,
        },
      })
    }

    // 查詢所有已識別公司的文件
    const filesWithCompany = await prisma.historicalFile.findMany({
      where: {
        batchId,
        identifiedCompanyId: { not: null },
      },
      select: {
        id: true,
        identifiedCompanyId: true,
        companyMatchType: true,
        companyMatchScore: true,
        identifiedCompany: {
          select: {
            id: true,
            name: true,
            source: true,
          },
        },
      },
    })

    // 計算統計數據
    const matchTypeBreakdown = {
      exact: 0,
      variant: 0,
      fuzzy: 0,
      new: 0,
    }

    let newCreated = 0
    let existingMatched = 0

    // 按公司分組統計
    const companyMap = new Map<
      string,
      { id: string; name: string; count: number; isNew: boolean }
    >()

    for (const file of filesWithCompany) {
      // 匹配類型統計
      const matchType = (file.companyMatchType as CompanyMatchType) || 'EXACT'
      switch (matchType) {
        case 'EXACT':
          matchTypeBreakdown.exact++
          break
        case 'VARIANT':
          matchTypeBreakdown.variant++
          break
        case 'FUZZY':
          matchTypeBreakdown.fuzzy++
          break
        case 'NEW':
          matchTypeBreakdown.new++
          break
      }

      // 新建/匹配統計
      const isNew = matchType === 'NEW'
      if (isNew) {
        newCreated++
      } else {
        existingMatched++
      }

      // 按公司分組
      if (file.identifiedCompanyId && file.identifiedCompany) {
        const companyId = file.identifiedCompanyId
        const existing = companyMap.get(companyId)
        if (existing) {
          existing.count++
        } else {
          companyMap.set(companyId, {
            id: companyId,
            name: file.identifiedCompany.name,
            count: 1,
            isNew: file.identifiedCompany.source === 'AUTO_CREATED',
          })
        }
      }
    }

    // 轉換為 CompanyFileCount 數組，按文件數量降序排列
    const companyBreakdown: CompanyFileCount[] = Array.from(companyMap.values())
      .map((c) => ({
        companyId: c.id,
        companyName: c.name,
        fileCount: c.count,
        isNew: c.isNew,
      }))
      .sort((a, b) => b.fileCount - a.fileCount)

    const stats: BatchCompanyStats = {
      totalIdentified: filesWithCompany.length,
      newCreated,
      existingMatched,
      matchTypeBreakdown,
      companyBreakdown,
    }

    return NextResponse.json({
      success: true,
      data: {
        batchId,
        batchName: batch.name,
        stats,
      },
    })
  } catch (error) {
    console.error('Failed to get company stats:', error)
    return NextResponse.json(
      { error: 'Failed to get company statistics' },
      { status: 500 }
    )
  }
}
