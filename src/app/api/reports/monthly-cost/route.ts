/**
 * @fileoverview 月度成本報告歷史 API
 * @description
 *   提供月度報告歷史列表查詢
 *
 * @module src/app/api/reports/monthly-cost
 * @since Epic 7 - Story 7.10
 * @lastModified 2025-12-20
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { hasPermission } from '@/lib/auth/city-permission'
import { PERMISSIONS } from '@/types/permissions'
import { monthlyCostReportService } from '@/services/monthly-cost-report.service'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!hasPermission(session?.user, PERMISSIONS.REPORT_VIEW)) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '12')

    const { reports, total } = await monthlyCostReportService.getReportHistory(
      page,
      pageSize
    )

    return NextResponse.json({
      success: true,
      data: reports,
      pagination: { total, page, pageSize },
    })
  } catch (error) {
    console.error('Get report history error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get report history' },
      { status: 500 }
    )
  }
}
