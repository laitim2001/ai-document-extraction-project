/**
 * @fileoverview 待審核公司列表 API
 * @description
 *   提供待審核公司的分頁列表查詢：
 *   - 列出所有 PENDING 狀態的公司
 *   - 包含出現次數和相關文件
 *   - 包含可能的重複公司建議
 *
 * @module src/app/api/admin/companies/pending
 * @since Epic 0 - Story 0.3
 * @lastModified 2025-12-23
 *
 * @features
 *   - 分頁查詢
 *   - 重複公司建議
 *   - 出現次數統計
 *
 * @dependencies
 *   - company-auto-create.service - 公司自動建立服務
 *
 * @related
 *   - src/app/(dashboard)/admin/companies/review/page.tsx - 審核頁面
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { hasPermission } from '@/lib/auth/city-permission'
import { PERMISSIONS } from '@/types/permissions'
import { getPendingCompanies } from '@/services/company-auto-create.service'

// ============================================================
// GET Handler
// ============================================================

/**
 * 獲取待審核公司列表
 *
 * @description
 *   查詢所有 PENDING 狀態的公司，包含：
 *   - 公司基本資訊
 *   - 出現次數統計
 *   - 可能的重複建議
 *
 * @param request - Next.js 請求對象
 * @returns 待審核公司列表
 *
 * @example
 * ```http
 * GET /api/admin/companies/pending?page=1&limit=20
 * ```
 */
export async function GET(request: NextRequest) {
  try {
    // 驗證認證
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '未授權' },
        { status: 401 }
      )
    }

    // 檢查權限（使用 COMPANY_VIEW 或 FORWARDER_VIEW）
    const hasViewPerm = hasPermission(session.user, PERMISSIONS.FORWARDER_VIEW)
    if (!hasViewPerm) {
      return NextResponse.json(
        { success: false, error: '權限不足' },
        { status: 403 }
      )
    }

    // 解析查詢參數
    const searchParams = request.nextUrl.searchParams
    const pageParam = searchParams.get('page') ?? '1'
    const limitParam = searchParams.get('limit') ?? '20'

    const page = Math.max(1, parseInt(pageParam, 10))
    const limit = Math.min(100, Math.max(1, parseInt(limitParam, 10)))

    // 獲取待審核公司列表
    const result = await getPendingCompanies({
      page,
      limit,
      includeDocumentCount: true,
    })

    return NextResponse.json({
      success: true,
      data: {
        companies: result.companies.map((company) => ({
          id: company.id,
          name: company.name,
          displayName: company.displayName,
          type: company.type,
          status: company.status,
          source: company.source,
          documentCount: company.documentCount || 0,
          firstSeenAt: company.createdAt.toISOString(),
          possibleDuplicates: company.possibleDuplicates || [],
        })),
        pagination: {
          page: result.page,
          limit,
          total: result.total,
          totalPages: result.totalPages,
        },
      },
    })
  } catch (error) {
    console.error('Error fetching pending companies:', error)
    return NextResponse.json(
      {
        success: false,
        error: '獲取待審核公司列表失敗',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
